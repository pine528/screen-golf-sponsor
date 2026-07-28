/**
 * 개편 Phase 1 — 슬롯 인벤토리 서비스 (DATA-07/08)
 *  - 기간별 슬롯 상태 조회 (선수 상세 통합 구매화면의 데이터 소스)
 *  - 기간 겹침 중복판매 차단 (§19.1): 동일 선수·슬롯·기간에
 *    HELD/SOLD/AUCTION_ACTIVE/PENDING_APPROVAL 존재 시 신규 구매 차단
 */
import { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/** §19.1 차단 상태 */
const BLOCKING_STATUSES = ['HELD', 'SOLD', 'AUCTION_ACTIVE', 'PENDING_APPROVAL'] as const;

/** §13.2 임시예약 유지 시간(분) */
export const HOLD_MINUTES = 15;

export const inventoryService = {
  /**
   * 선수의 기간별 슬롯 인벤토리 (DATA-07)
   * - 판매 설정(AthleteSlot) + 해당 기간의 재고 상태
   * - start/end 없으면 오늘 이후 전체
   */
  async getAthleteInventory(athleteId: string, start?: Date, end?: Date) {
    const rangeStart = start ?? new Date();
    const slots = await prisma.athleteSlot.findMany({
      where: { athleteId },
      include: {
        slotTemplate: {
          select: {
            code: true, name: true, nameKr: true, bodyPart: true, category: true, grade: true,
            recommendedWMm: true, recommendedHMm: true, displayX: true, displayY: true,
            uiHeadline: true, uiCopy: true,
          },
        },
        inventories: {
          where: {
            endDate: { gte: rangeStart },
            ...(end ? { startDate: { lte: end } } : {}),
          },
          orderBy: { startDate: 'asc' },
          select: {
            id: true, startDate: true, endDate: true, status: true,
            reservedUntil: true, auctionId: true, slotInstanceId: true, restrictionReason: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // HELD 만료 자동 복구 (조회 시점 lazy 복구)
    const now = new Date();
    for (const s of slots) {
      for (const inv of s.inventories) {
        if (inv.status === 'HELD' && inv.reservedUntil && inv.reservedUntil < now) {
          await prisma.slotInventory.update({ where: { id: inv.id }, data: { status: 'AVAILABLE', reservedUntil: null } });
          (inv as any).status = 'AVAILABLE';
          (inv as any).reservedUntil = null;
        }
      }
    }
    return slots;
  },

  /**
   * 기간 겹침 중복판매 검사 (§19.1) — 충돌 시 ConflictError
   * excludeInventoryId: 자기 자신 제외 (갱신 케이스)
   */
  async assertNoSlotConflict(athleteSlotId: string, start: Date, end: Date, excludeInventoryId?: string) {
    const conflict = await prisma.slotInventory.findFirst({
      where: {
        athleteSlotId,
        status: { in: BLOCKING_STATUSES as any },
        startDate: { lte: end },
        endDate: { gte: start },
        ...(excludeInventoryId ? { id: { not: excludeInventoryId } } : {}),
        // HELD는 만료 전인 것만 차단으로 취급
        OR: [
          { status: { not: 'HELD' } },
          { status: 'HELD', reservedUntil: { gte: new Date() } },
          { status: 'HELD', reservedUntil: null },
        ],
      },
      select: { id: true, status: true, startDate: true, endDate: true },
    });
    if (conflict) {
      throw new ConflictError(
        `해당 기간에 이미 판매 중이거나 계약된 슬롯입니다 (${conflict.status}, ${conflict.startDate.toISOString().slice(0, 10)}~${conflict.endDate.toISOString().slice(0, 10)})`
      );
    }
  },

  /**
   * 슬롯 임시예약 (BUY-02, §13.2) — 결제 단계 진입 시 15분간 HELD
   * 이미 자기 예약이면 갱신(연장), 다른 브랜드 점유 중이면 ConflictError
   */
  async hold(slotInstanceId: string, brandId: string, minutes = HOLD_MINUTES) {
    const inv = await prisma.slotInventory.findFirst({ where: { slotInstanceId } });
    if (!inv) throw new NotFoundError('슬롯 재고 정보를 찾을 수 없습니다');

    const now = new Date();
    const heldByOther =
      inv.status === 'HELD' &&
      inv.heldByBrandId &&
      inv.heldByBrandId !== brandId &&
      (!inv.reservedUntil || inv.reservedUntil > now);
    if (heldByOther) {
      throw new ConflictError('다른 브랜드가 해당 슬롯을 먼저 예약했습니다');
    }
    if (['SOLD', 'RESTRICTED', 'PENDING_APPROVAL'].includes(inv.status)) {
      throw new ConflictError('현재 구매할 수 없는 슬롯입니다');
    }

    const reservedUntil = new Date(now.getTime() + minutes * 60_000);
    // 동시성 방어: 판매완료/타 브랜드 점유가 아닌 경우에만 조건부 갱신
    const updated = await prisma.slotInventory.updateMany({
      where: {
        id: inv.id,
        status: { notIn: ['SOLD', 'RESTRICTED', 'PENDING_APPROVAL'] },
        OR: [
          { heldByBrandId: null },
          { heldByBrandId: brandId },
          { reservedUntil: { lt: now } },
          { status: { not: 'HELD' } },
        ],
      },
      data: { status: 'HELD', heldByBrandId: brandId, reservedUntil },
    });
    if (updated.count === 0) throw new ConflictError('다른 브랜드가 해당 슬롯을 먼저 예약했습니다');

    return { inventoryId: inv.id, reservedUntil, expiresInSec: minutes * 60 };
  },

  /** 임시예약 해제 (주문 취소·이탈) */
  async release(slotInstanceId: string, brandId: string) {
    const res = await prisma.slotInventory.updateMany({
      where: { slotInstanceId, status: 'HELD', heldByBrandId: brandId },
      data: { status: 'AVAILABLE', heldByBrandId: null, reservedUntil: null },
    });
    return { released: res.count };
  },

  /** 현재 예약 상태 조회 (타이머 UI용) */
  async getHold(slotInstanceId: string, brandId: string) {
    const inv = await prisma.slotInventory.findFirst({ where: { slotInstanceId } });
    if (!inv) return null;
    const now = new Date();
    const mine = inv.status === 'HELD' && inv.heldByBrandId === brandId && !!inv.reservedUntil && inv.reservedUntil > now;
    return {
      status: inv.status,
      heldByMe: mine,
      reservedUntil: mine ? inv.reservedUntil : null,
      expiresInSec: mine ? Math.max(0, Math.floor((inv.reservedUntil!.getTime() - now.getTime()) / 1000)) : 0,
    };
  },

  /**
   * 구매 진행 가능 여부 (BUY-01) — 다른 브랜드의 유효한 예약이 있으면 차단
   */
  async assertPurchasableBy(slotInstanceId: string, brandId: string) {
    const inv = await prisma.slotInventory.findFirst({ where: { slotInstanceId } });
    if (!inv) return;
    const now = new Date();
    if (inv.status === 'SOLD') throw new ConflictError('이미 판매된 슬롯입니다');
    if (
      inv.status === 'HELD' &&
      inv.heldByBrandId &&
      inv.heldByBrandId !== brandId &&
      (!inv.reservedUntil || inv.reservedUntil > now)
    ) {
      throw new ConflictError('다른 브랜드가 해당 슬롯을 먼저 예약했습니다');
    }
  },

  /** 만료된 임시예약 일괄 해제 (스케줄러용) */
  async expireHolds() {
    const res = await prisma.slotInventory.updateMany({
      where: { status: 'HELD', contractId: null, reservedUntil: { lt: new Date() } },
      data: { status: 'AVAILABLE', heldByBrandId: null, reservedUntil: null },
    });
    if (res.count > 0) console.log(`[Inventory] 만료된 임시예약 ${res.count}건 해제`);
    return res.count;
  },

  /** 기존 SlotInstance 브릿지로 인벤토리 상태 동기화 (buy-now/낙찰/취소 훅) */
  async syncByInstance(slotInstanceId: string, status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'AUCTION_ACTIVE', extra?: { contractId?: string | null; reservedUntil?: Date | null }) {
    await prisma.slotInventory.updateMany({
      where: { slotInstanceId },
      data: {
        status: status as any,
        ...(extra?.contractId !== undefined ? { contractId: extra.contractId } : {}),
        ...(extra?.reservedUntil !== undefined ? { reservedUntil: extra.reservedUntil } : {}),
      },
    });
  },
};

export default inventoryService;
