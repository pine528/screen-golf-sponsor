import prisma from '../models/prisma';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors';
import { BodyPart, MaterialRule, SlotStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notification.service';
import { conflictService } from './conflict.service';
import { phase2UnlockService } from './phase2Unlock.service';

export class SlotTemplateService {
  async create(data: {
    code: string;
    name: string;
    bodyPart: BodyPart;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    recommendedWMm?: number;
    recommendedHMm?: number;
    forbiddenNotes?: string;
    materialRules?: MaterialRule;
    requiredAngles?: string[];
    categoryExclusivityGroup?: string;
    defaultReservePrice: number;
  }) {
    const existing = await prisma.slotTemplate.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictError('Slot template code already exists');
    }

    return prisma.slotTemplate.create({ data });
  }

  async findById(id: string) {
    const template = await prisma.slotTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    return template;
  }

  async findByCode(code: string) {
    const template = await prisma.slotTemplate.findUnique({
      where: { code },
    });

    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    return template;
  }

  async list(isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;

    return prisma.slotTemplate.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async update(id: string, data: Partial<{
    name: string;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    recommendedWMm: number;
    recommendedHMm: number;
    forbiddenNotes: string;
    materialRules: MaterialRule;
    requiredAngles: string[];
    categoryExclusivityGroup: string;
    defaultReservePrice: number;
    isActive: boolean;
  }>) {
    return prisma.slotTemplate.update({
      where: { id },
      data,
    });
  }
}

/**
 * 개편 Phase 4 (AUC-12, 핸드오프 §12.5) — 즉시구매 병행조건
 *  - 첫 유효입찰 이전: 즉시구매 가능
 *  - 첫 유효입찰 이후: 즉시구매 종료 (관리자가 병행 유지로 설정한 경우만 예외)
 */
async function assertBuyNowStillOpen(slotInstanceId: string) {
  const auction = await prisma.auction.findUnique({
    where: { slotInstanceId },
    select: { id: true, status: true, allowBuyNowAfterBid: true, _count: { select: { bids: true } } },
  });
  if (!auction) return;
  if (!['LIVE', 'SCHEDULED'].includes(auction.status)) return;
  if (auction._count.bids > 0 && !auction.allowBuyNowAfterBid) {
    throw new ConflictError('입찰이 시작되어 바로 구매가 종료되었습니다. 입찰로 참여해 주세요.');
  }
}

export class SlotInstanceService {
  async create(data: {
    eventId: string;
    athleteId: string;
    slotTemplateId: string;
    reservePrice?: number;
  }) {
    // Check if event exists (활성 검증 포함)
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      select: { id: true, isActive: true },
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    // SPONPIK docx 4 — 비활성 대회에 슬롯 생성 차단
    if (!event.isActive) {
      throw new BadRequestError('비활성 상태인 대회에는 슬롯을 생성할 수 없습니다');
    }

    // Check if athlete exists (활성 + KYC 검증)
    const athlete = await prisma.athlete.findUnique({
      where: { id: data.athleteId },
      select: { id: true, isActive: true, kycStatus: true },
    });
    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }
    if (!athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수에게 슬롯을 생성할 수 없습니다');
    }
    if (athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 승인이 완료된 선수만 슬롯 생성 가능합니다');
    }

    // Check if slot template exists
    const template = await prisma.slotTemplate.findUnique({
      where: { id: data.slotTemplateId },
    });
    if (!template) {
      throw new NotFoundError('Slot template not found');
    }

    // Check for duplicate
    const existing = await prisma.slotInstance.findUnique({
      where: {
        eventId_athleteId_slotTemplateId: {
          eventId: data.eventId,
          athleteId: data.athleteId,
          slotTemplateId: data.slotTemplateId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Slot instance already exists for this event/athlete/slot combination');
    }

    return prisma.slotInstance.create({
      data: {
        ...data,
        reservePrice: data.reservePrice || template.defaultReservePrice,
      },
      include: {
        event: true,
        athlete: true,
        slotTemplate: true,
      },
    });
  }

  async findById(id: string) {
    const instance = await prisma.slotInstance.findUnique({
      where: { id },
      include: {
        event: true,
        athlete: true,
        slotTemplate: true,
        auction: {
          include: {
            bids: {
              orderBy: { currentProxy: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Slot instance not found');
    }

    return instance;
  }

  async list(filters: {
    eventId?: string;
    athleteId?: string;
    slotCode?: string;
    status?: SlotStatus;
    enableDirectBuy?: boolean;
    page?: number;
    limit?: number;
    includeInactive?: boolean; // ADMIN 전용
  }) {
    const { eventId, athleteId, slotCode, status, enableDirectBuy, page = 1, limit = 20, includeInactive = false } = filters;

    const where: any = {};
    if (eventId) where.eventId = eventId;
    if (athleteId) where.athleteId = athleteId;
    if (status) where.status = status;
    if (enableDirectBuy !== undefined) where.enableDirectBuy = enableDirectBuy;
    if (slotCode) {
      where.slotTemplate = { code: slotCode };
    }
    // SPONPIK docx 4 — 공개 목록은 비활성 슬롯/선수/대회 제외
    if (!includeInactive) {
      where.isActive = true;
      where.athlete = { isActive: true, kycStatus: 'APPROVED' };
      where.event = { isActive: true };
    }

    const [instances, total] = await Promise.all([
      prisma.slotInstance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: true,
          athlete: {
            select: {
              id: true,
              name: true,
              tour: true,
              profileImageUrl: true,
              isRecommended: true, // 메인 노출 필터용 (추천 선수만)
            },
          },
          slotTemplate: true,
          auction: {
            select: {
              id: true,
              status: true,
              currentPrice: true,
              endAt: true,
            },
          },
        },
      }),
      prisma.slotInstance.count({ where }),
    ]);

    return { instances, total };
  }

  async update(id: string, data: Partial<{
    reservePrice: number;
    status: SlotStatus;
    overrideSpecs: any;
  }>) {
    return prisma.slotInstance.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: SlotStatus) {
    return prisma.slotInstance.update({
      where: { id },
      data: { status },
    });
  }

  async getAvailableForBidding(filters?: {
    eventId?: string;
    athleteId?: string;
    slotCode?: string;
    minPrice?: number;
    maxPrice?: number;
  }) {
    // ★ OPEN (즉시구매만/판매모드 미설정) + IN_AUCTION (경매 활성화) 모두 조회
    // SPONPIK docx 4 — 비활성 슬롯/선수/대회 제외
    const where: any = {
      status: { in: ['OPEN', 'IN_AUCTION'] },
      isActive: true,
      athlete: { isActive: true, kycStatus: 'APPROVED' },
      event: { isActive: true },
    };

    if (filters?.eventId) where.eventId = filters.eventId;
    if (filters?.athleteId) where.athleteId = filters.athleteId;
    if (filters?.slotCode) {
      where.slotTemplate = { code: filters.slotCode };
    }
    if (filters?.minPrice || filters?.maxPrice) {
      where.reservePrice = {};
      if (filters.minPrice) where.reservePrice.gte = filters.minPrice;
      if (filters.maxPrice) where.reservePrice.lte = filters.maxPrice;
    }

    return prisma.slotInstance.findMany({
      where,
      include: {
        event: true,
        athlete: {
          select: {
            id: true,
            name: true,
            tour: true,
            profileImageUrl: true,
            blockedCategories: true,
          },
        },
        slotTemplate: true,
        // ★ 경매 정보 포함 (인벤토리에서 현재가/입찰수 표시용)
        auction: {
          select: {
            id: true,
            status: true,
            currentPrice: true,
            startAt: true,
            endAt: true,
            _count: {
              select: { bids: true },
            },
          },
        },
      },
      orderBy: [
        { event: { dateStart: 'asc' } },
        { reservePrice: 'asc' },
      ],
    });
  }

  async bulkCreate(eventId: string, athleteId: string, templateIds: string[]) {
    const templates = await prisma.slotTemplate.findMany({
      where: { id: { in: templateIds }, isActive: true },
    });

    const results = await Promise.all(
      templates.map(async (template) => {
        try {
          const instance = await this.create({
            eventId,
            athleteId,
            slotTemplateId: template.id,
            reservePrice: template.defaultReservePrice,
          });
          return { success: true, data: instance, templateId: template.id, templateName: template.name };
        } catch (e: any) {
          return {
            success: false,
            error: e.message || 'Unknown error',
            templateId: template.id,
            templateName: template.name
          };
        }
      })
    );

    const created = results.filter((r) => r.success).map((r) => r.data);
    const failed = results.filter((r) => !r.success);

    return { created, failed, total: templates.length };
  }

  /**
   * Update sale mode for a slot (auction / direct buy options)
   * - enableAuction이 true이고 필요 필드가 모두 있으면 Auction 레코드 자동 생성
   */
  async updateSaleMode(
    slotId: string,
    athleteId: string,
    data: {
      enableAuction?: boolean;
      enableDirectBuy?: boolean;
      directBuyPrice?: number | null;
      auctionMinBid?: number | null;
      auctionEndAt?: Date | null;
      isPublic?: boolean;
      saleMode?: 'AUCTION' | 'DIRECT' | 'INQUIRY';
    }
  ) {
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: {
        auction: true,
        slotTemplate: true,
        athlete: { select: { isActive: true, kycStatus: true } },
        event: { select: { isActive: true } },
      },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (slot.athleteId !== athleteId) {
      throw new ForbiddenError('Not authorized to update this slot');
    }

    // SPONPIK docx 4 — 비활성 entity 위에서 판매모드 변경 차단
    if (!slot.isActive) {
      throw new BadRequestError('비활성 상태인 슬롯의 판매모드를 변경할 수 없습니다');
    }
    if (!slot.athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수의 슬롯 판매모드를 변경할 수 없습니다');
    }
    if (slot.athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 미승인 선수의 슬롯 판매모드를 변경할 수 없습니다');
    }
    if (!slot.event.isActive) {
      throw new BadRequestError('비활성 상태인 대회의 슬롯 판매모드를 변경할 수 없습니다');
    }

    if (slot.status !== 'OPEN' && slot.status !== 'IN_AUCTION') {
      throw new ConflictError('Cannot update sale mode for this slot status');
    }

    // Validation
    const enableDirectBuy = data.enableDirectBuy ?? slot.enableDirectBuy;
    const enableAuction = data.enableAuction ?? slot.enableAuction;
    const directBuyPrice = data.directBuyPrice !== undefined ? data.directBuyPrice : slot.directBuyPrice;
    const auctionMinBid = data.auctionMinBid !== undefined ? data.auctionMinBid : slot.auctionMinBid;
    const auctionEndAt = data.auctionEndAt !== undefined ? data.auctionEndAt : slot.auctionEndAt;

    // 판매 방식 (미지정 시 기존 플래그에서 파생)
    const saleMode: 'AUCTION' | 'DIRECT' | 'INQUIRY' =
      data.saleMode ?? (enableAuction ? 'AUCTION' : enableDirectBuy ? 'DIRECT' : (slot.saleMode as any) ?? 'INQUIRY');
    const isInquiry = saleMode === 'INQUIRY';

    // INQUIRY(협의 문의)는 경매·즉시구매 모두 비활성 상태가 정상
    if (!isInquiry && !enableAuction && !enableDirectBuy) {
      throw new BadRequestError('At least one sale mode must be enabled');
    }

    if (enableDirectBuy && (directBuyPrice === null || directBuyPrice === undefined || Number(directBuyPrice) <= 0)) {
      throw new BadRequestError('Direct buy price is required when direct buy is enabled');
    }

    if (enableAuction) {
      if (auctionMinBid === null || auctionMinBid === undefined || Number(auctionMinBid) <= 0) {
        throw new BadRequestError('Auction minimum bid is required when auction is enabled');
      }
      if (!auctionEndAt) {
        throw new BadRequestError('Auction end date is required when auction is enabled');
      }
      if (new Date(auctionEndAt) <= new Date()) {
        throw new BadRequestError('Auction end date must be in the future');
      }
    }

    // 트랜잭션으로 슬롯 업데이트 + 경매 생성/업데이트
    return prisma.$transaction(async (tx) => {
      // 슬롯 업데이트
      const updatedSlot = await tx.slotInstance.update({
        where: { id: slotId },
        data: {
          enableAuction,
          enableDirectBuy,
          saleMode,
          directBuyPrice: enableDirectBuy && directBuyPrice ? new Decimal(directBuyPrice) : null,
          auctionMinBid: enableAuction && auctionMinBid ? new Decimal(auctionMinBid) : null,
          auctionEndAt: enableAuction ? auctionEndAt : null,
          // 경매 활성화 시 상태 변경
          status: enableAuction ? 'IN_AUCTION' : 'OPEN',
        },
        include: {
          event: true,
          athlete: true,
          slotTemplate: true,
          auction: true,
        },
      });

      // 경매 활성화 시 Auction 레코드 생성/업데이트
      if (enableAuction && auctionMinBid && auctionEndAt) {
        const now = new Date();
        const startPrice = Number(auctionMinBid);

        if (slot.auction) {
          // 기존 경매가 있으면 항상 UPDATE (slotInstanceId가 UNIQUE이므로 새로 생성 불가)
          await tx.auction.update({
            where: { id: slot.auction.id },
            data: {
              startAt: now,
              endAt: new Date(auctionEndAt),
              originalEndAt: new Date(auctionEndAt),
              currentPrice: startPrice,
              status: 'LIVE',
              isFeatured: data.isPublic ?? slot.auction.isFeatured,
              // 종료/취소/유찰 상태에서 재활성화 시 초기화
              totalExtended: 0,
              winningBidId: null,
            },
          });
        } else {
          // 새 경매 생성 - 즉시 LIVE 상태로
          await tx.auction.create({
            data: {
              slotInstanceId: slotId,
              startAt: now,
              endAt: new Date(auctionEndAt),
              originalEndAt: new Date(auctionEndAt),
              currentPrice: startPrice,
              status: 'LIVE',
              softCloseSec: 120,
              maxExtensionSec: 600,
              minBidIncrement: 10000,
              isFeatured: data.isPublic ?? false,
            },
          });
        }
      } else if (!enableAuction && slot.auction) {
        // 경매 비활성화 시 기존 경매 취소 (SCHEDULED 또는 LIVE 상태일 때만)
        if (slot.auction.status === 'SCHEDULED' || slot.auction.status === 'LIVE') {
          await tx.auction.update({
            where: { id: slot.auction.id },
            data: { status: 'CANCELLED' },
          });
        }
      }

      // 최종 슬롯 정보 반환
      return tx.slotInstance.findUnique({
        where: { id: slotId },
        include: {
          event: true,
          athlete: true,
          slotTemplate: true,
          auction: true,
        },
      });
    });
  }

  /**
   * Process direct buy (즉시구매)
   * - 브랜드가 즉시구매 시 계약 생성 (브랜드 선서명)
   * - 선수 서명 후 에스크로 HOLD (기존 sign() 흐름 활용)
   */
  /**
   * 개편 Phase 3 (BUY-01, §13.1) — 직접구매 가능조건 검증
   * 임시예약(hold)과 실제 구매(processBuyNow)가 동일한 조건을 쓰도록 공유한다.
   */
  async assertDirectBuyEligible(slotId: string, brandId: string) {
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: { event: true, athlete: true, slotTemplate: true },
    });
    if (!slot) throw new NotFoundError('Slot not found');
    if (!slot.isActive) throw new BadRequestError('비활성 상태인 슬롯입니다');
    if (!slot.athlete.isActive) throw new BadRequestError('비활성 상태인 선수입니다');
    if (slot.athlete.kycStatus !== 'APPROVED') throw new BadRequestError('KYC 미승인 선수의 슬롯입니다');
    if (slot.event && (slot.event as any).isActive === false) throw new BadRequestError('비활성 상태인 대회입니다');
    if (!['OPEN', 'IN_AUCTION'].includes(slot.status)) throw new ConflictError('현재 구매할 수 없는 슬롯입니다');
    if (!slot.enableDirectBuy) throw new BadRequestError('바로 구매가 열려 있지 않은 슬롯입니다');

    // ★ 개편 Phase 4 (AUC-12, §12.5): 첫 유효입찰 이후에는 즉시구매를 종료한다
    //    (관리자가 allowBuyNowAfterBid로 병행 유지를 설정한 경우는 예외)
    await assertBuyNowStillOpen(slotId);

    const buyPrice = slot.directBuyPrice || slot.reservePrice;
    if (!buyPrice || Number(buyPrice) <= 0) throw new BadRequestError('판매 가격이 설정되지 않은 슬롯입니다');

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundError('Brand not found');

    // 업종 충돌 + 대회 규칙 (예약 단계에서도 미리 차단해 헛걸음을 막는다)
    await conflictService.checkCategoryConflict({
      eventId: slot.eventId,
      athleteId: slot.athleteId,
      brandId,
      brandCategory: brand.category,
      excludeSlotId: slotId,
    });
    const rules = await phase2UnlockService.validateTournamentRulesForBid(slot.eventId, slot.athleteId, brandId, brand.category);
    if (!rules.valid) throw new BadRequestError(rules.errors.join(' '));

    return { slot, brand, buyPrice };
  }

  /**
   * 개편 Phase 3 (BUY-05/06) — 주문확인 견적
   * 가격정책(부가세·플랫폼 이용료 포함 여부)이 확정되기 전까지 표시 금액은
   * 실제 결제 금액과 동일해야 한다 (우선순위표 §15 개발중단 기준).
   */
  async getQuote(slotId: string) {
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: {
        event: { select: { name: true, dateStart: true, dateEnd: true } },
        athlete: { select: { id: true, name: true, profileImageUrl: true, tourQualification: true } },
        slotTemplate: { select: { code: true, name: true, nameKr: true, grade: true, recommendedWMm: true, recommendedHMm: true, material: true, forbiddenNotes: true } },
      },
    });
    if (!slot) throw new NotFoundError('Slot not found');

    const base = Number(slot.directBuyPrice || slot.reservePrice || 0);
    return {
      slot: {
        id: slot.id,
        status: slot.status,
        enableDirectBuy: slot.enableDirectBuy,
        template: slot.slotTemplate,
      },
      athlete: slot.athlete,
      event: slot.event,
      price: {
        basePrice: base,
        // 정책 확정 전: 플랫폼 이용료·부가세는 표시가에 포함된 것으로 간주하고 별도 가산하지 않는다
        platformFee: 0,
        platformFeeIncluded: true,
        vat: 0,
        vatIncluded: true,
        total: base,
        policyPending: true,
        note: '부가세·플랫폼 이용료 정책 확정 전으로, 표시 금액이 실제 결제 금액입니다.',
      },
    };
  }

  async processBuyNow(slotId: string, brandId: string, brandUserId: string) {
    // 트랜잭션 외부에서 먼저 기본 검증 수행
    const slot = await prisma.slotInstance.findUnique({
      where: { id: slotId },
      include: {
        event: true,
        athlete: { include: { user: true } },
        slotTemplate: true,
      },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    // SPONPIK docx 4 — 운영 비활성 entity 차단 (서버 사이드 강제, bid와 동일)
    if (!slot.isActive) {
      throw new BadRequestError('비활성 상태인 슬롯입니다');
    }
    if (!slot.athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수입니다');
    }
    if (slot.athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 미승인 선수의 슬롯입니다');
    }
    if (slot.event && (slot.event as any).isActive === false) {
      throw new BadRequestError('비활성 상태인 대회입니다');
    }

    // ★ 즉시구매 가능 상태 확인: OPEN 또는 IN_AUCTION(경매+즉시구매 둘 다 설정된 경우)
    const validStatuses = ['OPEN', 'IN_AUCTION'];
    if (!validStatuses.includes(slot.status)) {
      throw new ConflictError('Slot is no longer available for purchase');
    }

    // 즉시구매 활성화 확인
    if (!slot.enableDirectBuy) {
      throw new BadRequestError('Direct buy is not enabled for this slot');
    }

    // 즉시구매 가격: directBuyPrice가 있으면 사용, 없으면 reservePrice 사용
    const buyPrice = slot.directBuyPrice || slot.reservePrice;
    if (!buyPrice || Number(buyPrice) <= 0) {
      throw new BadRequestError('No valid price set for this slot');
    }

    // Get brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // 잔액 검증: 가용 잔액 >= buyPrice
    const brandWallet = await prisma.wallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: 'BRAND',
          ownerId: brandId,
        },
      },
    });

    if (!brandWallet) {
      throw new BadRequestError('Wallet not found. Please deposit first.');
    }

    const available = new Decimal(brandWallet.balance).minus(brandWallet.frozenAmount);
    if (available.lt(buyPrice)) {
      throw new BadRequestError(
        `Insufficient balance. Available: ${available.toString()}, Required: ${buyPrice.toString()}`
      );
    }

    // ★ 충돌룰: 카테고리 충돌 전체 검사
    await conflictService.checkCategoryConflict({
      eventId: slot.eventId,
      athleteId: slot.athleteId,
      brandId,
      brandCategory: brand.category,
      excludeSlotId: slotId, // 현재 슬롯은 제외
    });

    // ★ v2: 대회 규칙 통합 검증 (maxSlotsPerBrandPerPlayer, prohibitedCategories, creativeApprovalRequired)
    const tournamentValidation = await phase2UnlockService.validateTournamentRulesForBid(
      slot.eventId,
      slot.athleteId,
      brandId,
      brand.category
    );
    if (!tournamentValidation.valid) {
      throw new BadRequestError(tournamentValidation.errors.join(' '));
    }

    // 활성 계약 존재 여부 확인 (슬롯당 1개 제한)
    const existingContract = await prisma.contract.findFirst({
      where: {
        auction: { slotInstanceId: slotId },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
    });
    if (existingContract) {
      throw new ConflictError('Slot already has an active contract');
    }

    // ★ 개편 Phase 3 (BUY-01): 다른 브랜드가 임시예약(HELD) 중이면 차단
    {
      const { inventoryService } = await import('./inventory.service');
      await inventoryService.assertPurchasableBy(slotId, brandId);
    }

    // ★ 개편 Phase 1 (§19.1): 신규 인벤토리 기준 기간 겹침 중복판매 차단
    //    (동일 선수·슬롯의 다른 인스턴스/상품이 같은 기간에 HELD/SOLD/AUCTION_ACTIVE면 차단)
    if (slot.event) {
      const athleteSlot = await prisma.athleteSlot.findUnique({
        where: { athleteId_slotTemplateId: { athleteId: slot.athleteId, slotTemplateId: slot.slotTemplateId } },
        select: { id: true },
      });
      if (athleteSlot) {
        const ownInventory = await prisma.slotInventory.findFirst({
          where: { slotInstanceId: slotId }, select: { id: true },
        });
        const { inventoryService } = await import('./inventory.service');
        await inventoryService.assertNoSlotConflict(
          athleteSlot.id, slot.event.dateStart, slot.event.dateEnd, ownInventory?.id
        );
      }
    }

    // 트랜잭션으로 원자적 처리
    const contract = await prisma.$transaction(async (tx) => {
      // 동시성 방어: 상태 조건부 업데이트 (OPEN 또는 IN_AUCTION 상태일 때만)
      const updateResult = await tx.slotInstance.updateMany({
        where: { id: slotId, status: { in: ['OPEN', 'IN_AUCTION'] } },
        data: { status: 'RESERVED' },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Slot already purchased by another buyer');
      }

      // ★ Phase 9-1.1: frozenAmount 증가 (예약 동결)
      await tx.wallet.update({
        where: { id: brandWallet.id },
        data: {
          frozenAmount: { increment: buyPrice },
          version: { increment: 1 },
        },
      });

      // ★ Phase 9-1.1: LedgerTx 기록 (감사 목적)
      // 먼저 Contract를 생성해야 refId로 사용 가능하므로 아래에서 처리

      const now = new Date();
      let auction;

      // ★ 경매+즉시구매 슬롯인 경우, 기존 경매를 ENDED로 변경하고 재사용
      if (slot.status === 'IN_AUCTION') {
        // 기존 LIVE 경매를 찾아서 ENDED로 변경
        const existingAuction = await tx.auction.findFirst({
          where: { slotInstanceId: slotId, status: 'LIVE' },
        });

        if (existingAuction) {
          auction = await tx.auction.update({
            where: { id: existingAuction.id },
            data: {
              status: 'ENDED',
              endAt: now,
              currentPrice: Number(buyPrice),
            },
          });
        } else {
          // LIVE 경매가 없으면 새로 생성
          auction = await tx.auction.create({
            data: {
              slotInstanceId: slotId,
              startAt: now,
              endAt: now,
              originalEndAt: now,
              status: 'ENDED',
              currentPrice: Number(buyPrice),
            },
          });
        }
      } else {
        // 즉시구매만 설정된 슬롯: 더미 경매 생성
        auction = await tx.auction.create({
          data: {
            slotInstanceId: slotId,
            startAt: now,
            endAt: now,
            originalEndAt: now,
            status: 'ENDED',
            currentPrice: Number(buyPrice),
          },
        });
      }

      // ★ Phase 9-1.1: reservedUntil = now + 24시간
      const reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create contract with brand pre-signed
      const createdContract = await tx.contract.create({
        data: {
          auctionId: auction.id,
          brandId,
          athleteId: slot.athleteId,
          priceFinal: Number(buyPrice),
          status: 'PENDING_SIGNATURE',
          brandSignedAt: now, // 브랜드 선서명
          reservedUntil, // ★ Phase 9-1.1: 예약 만료 시간
          assetDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          brand: true,
          athlete: true,
          auction: {
            include: {
              slotInstance: {
                include: {
                  event: true,
                  slotTemplate: true,
                },
              },
            },
          },
        },
      });

      // ★ Phase 9-1.1: LedgerTx 기록 (DIRECT_BUY_RESERVE)
      await tx.ledgerTx.create({
        data: {
          walletId: brandWallet.id,
          type: 'DIRECT_BUY_RESERVE',
          amount: buyPrice, // 동결 금액 (양수로 기록 - balance는 변경 없음)
          balanceAfter: brandWallet.balance, // balance는 그대로
          refType: 'CONTRACT',
          refId: createdContract.id,
          description: `Direct buy reserve for slot ${slotId}`,
        },
      });

      // AuditLog 기록
      await tx.auditLog.create({
        data: {
          userId: brandUserId,
          action: 'DIRECT_BUY_RESERVE',
          entityType: 'CONTRACT',
          entityId: createdContract.id,
          newValue: {
            slotId,
            brandId,
            athleteId: slot.athleteId,
            price: Number(buyPrice),
            reservedUntil: reservedUntil.toISOString(),
          },
        },
      });

      return createdContract;
    });

    // ★ 개편 Phase 1: 인벤토리 브릿지 동기화 (RESERVED → HELD + 계약 연결)
    try {
      const { inventoryService } = await import('./inventory.service');
      await inventoryService.syncByInstance(slotId, 'HELD', { contractId: contract.id, reservedUntil: null });
    } catch (e) {
      console.error('Failed to sync slot inventory (buy-now):', e);
    }

    // 선수에게 알림 발송 (트랜잭션 외부)
    try {
      await notificationService.create({
        userId: slot.athlete.user.id,
        type: 'CONTRACT_CREATED',
        title: '즉시구매 계약 생성',
        message: `${brand.name}님이 ${slot.slotTemplate.name} 슬롯을 즉시구매했습니다. 24시간 내 서명을 완료해주세요.`,
        data: {
          contractId: contract.id,
          slotName: slot.slotTemplate.name,
          eventName: slot.event.name,
          brandName: brand.name,
          price: Number(buyPrice),
        },
      });
    } catch (e) {
      console.error('Failed to send direct buy notification:', e);
    }

    return contract;
  }
}

export const slotTemplateService = new SlotTemplateService();
export const slotInstanceService = new SlotInstanceService();
