/**
 * Category Conflict Service
 *
 * 충돌룰(Conflict & Exclusivity) 검사:
 * 1. 선수 blockedCategories 체크
 * 2. 선수 primarySponsors 카테고리 체크
 * 3. 동일 이벤트/동일 선수에서 같은 카테고리 브랜드 동시 계약 방지
 * 4. RESERVED 상태 슬롯 (Direct Buy/Auction 낙찰 대기) 체크
 * 5. LIVE 경매 최고 입찰자 체크
 */

import prisma from '../models/prisma';
import { ConflictError } from '../utils/errors';

interface ConflictCheckParams {
  eventId: string;
  athleteId: string;
  brandId: string;
  brandCategory: string;
  excludeSlotId?: string;  // 현재 슬롯 제외 (자기 자신)
  excludeAuctionId?: string;  // 현재 경매 제외 (자기 자신)
}

interface PrimarySponsor {
  category: string;
  brandName?: string;
}

export class ConflictService {
  /**
   * 전체 충돌 검사 (입찰/즉시구매 전 호출)
   */
  async checkCategoryConflict(params: ConflictCheckParams): Promise<void> {
    const { eventId, athleteId, brandId, brandCategory, excludeSlotId, excludeAuctionId } = params;

    // 1. 선수 정보 조회 (blockedCategories, primarySponsors)
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        blockedCategories: true,
        primarySponsors: true,
      },
    });

    if (!athlete) {
      return; // 선수 없으면 검사 스킵
    }

    // 2. blockedCategories 체크
    if (athlete.blockedCategories.includes(brandCategory)) {
      throw new ConflictError(
        `선수가 '${brandCategory}' 카테고리를 차단했습니다`,
        'CATEGORY_BLOCKED'
      );
    }

    // 3. primarySponsors 체크 (JSON 배열)
    const primarySponsors = athlete.primarySponsors as PrimarySponsor[] | null;
    if (primarySponsors && Array.isArray(primarySponsors)) {
      const primaryCategories = primarySponsors.map(s => s.category?.toLowerCase());
      if (primaryCategories.includes(brandCategory.toLowerCase())) {
        throw new ConflictError(
          `선수의 메인 스폰서 카테고리('${brandCategory}')와 충돌합니다`,
          'PRIMARY_SPONSOR_CONFLICT'
        );
      }
    }

    // 4. 동일 이벤트/선수에서 같은 카테고리 브랜드의 기존 계약 체크
    // (PENDING_SIGNATURE, ACTIVE, COMPLETED 상태)
    const existingContracts = await prisma.contract.findMany({
      where: {
        brand: {
          category: brandCategory,
          id: { not: brandId },
        },
        status: { in: ['PENDING_SIGNATURE', 'ACTIVE', 'COMPLETED'] },
        OR: [
          // 경매를 통한 계약
          {
            auction: {
              slotInstance: {
                eventId,
                athleteId,
                ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
              },
            },
          },
          // Direct Buy를 통한 계약 (auction.slotInstance로 연결)
          {
            auction: {
              slotInstance: {
                eventId,
                athleteId,
                ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
              },
            },
          },
        ],
      },
      include: {
        brand: { select: { name: true, category: true } },
      },
    });

    if (existingContracts.length > 0) {
      const conflictBrand = existingContracts[0].brand;
      throw new ConflictError(
        `동일 카테고리('${brandCategory}') 브랜드 '${conflictBrand.name}'가 이미 이 선수의 슬롯을 계약했습니다`,
        'EXCLUSIVITY_CONFLICT'
      );
    }

    // 5. RESERVED 상태 슬롯 체크 (Direct Buy 또는 Auction 낙찰 후 서명 대기)
    const reservedSlots = await prisma.slotInstance.findMany({
      where: {
        eventId,
        athleteId,
        status: 'RESERVED',
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
        auction: {
          contract: {
            brand: {
              category: brandCategory,
              id: { not: brandId },
            },
            status: 'PENDING_SIGNATURE',
          },
        },
      },
      include: {
        auction: {
          include: {
            contract: {
              include: {
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (reservedSlots.length > 0) {
      const conflictBrand = reservedSlots[0].auction?.contract?.brand;
      throw new ConflictError(
        `동일 카테고리('${brandCategory}') 브랜드 '${conflictBrand?.name || '?'}'가 이미 예약 중입니다 (서명 대기)`,
        'RESERVATION_CONFLICT'
      );
    }

    // 6. LIVE 경매에서 같은 카테고리 브랜드가 최고 입찰자인 경우 체크
    const liveAuctionsWithSameCategoryWinner = await prisma.auction.findMany({
      where: {
        status: 'LIVE',
        slotInstance: {
          eventId,
          athleteId,
          ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
        },
        ...(excludeAuctionId ? { id: { not: excludeAuctionId } } : {}),
        bids: {
          some: {
            isWinning: true,
            brand: {
              category: brandCategory,
              id: { not: brandId },
            },
          },
        },
      },
      include: {
        bids: {
          where: {
            isWinning: true,
            brand: {
              category: brandCategory,
              id: { not: brandId },
            },
          },
          include: {
            brand: { select: { name: true } },
          },
        },
        slotInstance: {
          include: { slotTemplate: true },
        },
      },
    });

    if (liveAuctionsWithSameCategoryWinner.length > 0) {
      const winningBid = liveAuctionsWithSameCategoryWinner[0].bids[0];
      const slotName = liveAuctionsWithSameCategoryWinner[0].slotInstance.slotTemplate?.name;
      throw new ConflictError(
        `동일 카테고리('${brandCategory}') 브랜드 '${winningBid?.brand?.name || '?'}'가 '${slotName}' 경매에서 최고 입찰 중입니다`,
        'LIVE_AUCTION_CONFLICT'
      );
    }
  }

  /**
   * 간단한 blockedCategories만 체크 (빠른 검사용)
   */
  async checkBlockedCategory(athleteId: string, brandCategory: string): Promise<void> {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { blockedCategories: true },
    });

    if (athlete?.blockedCategories.includes(brandCategory)) {
      throw new ConflictError(
        `선수가 '${brandCategory}' 카테고리를 차단했습니다`,
        'CATEGORY_BLOCKED'
      );
    }
  }
}

export const conflictService = new ConflictService();
