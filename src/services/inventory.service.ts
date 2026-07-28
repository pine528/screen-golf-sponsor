/**
 * 개편 Phase 1 — 슬롯 인벤토리 서비스 (DATA-07/08)
 *  - 기간별 슬롯 상태 조회 (선수 상세 통합 구매화면의 데이터 소스)
 *  - 기간 겹침 중복판매 차단 (§19.1): 동일 선수·슬롯·기간에
 *    HELD/SOLD/AUCTION_ACTIVE/PENDING_APPROVAL 존재 시 신규 구매 차단
 */
import { PrismaClient } from '@prisma/client';
import { ConflictError } from '../utils/errors';

const prisma = new PrismaClient();

/** §19.1 차단 상태 */
const BLOCKING_STATUSES = ['HELD', 'SOLD', 'AUCTION_ACTIVE', 'PENDING_APPROVAL'] as const;

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
