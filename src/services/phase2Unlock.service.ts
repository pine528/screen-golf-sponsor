/**
 * Phase 2 자동 오픈 판정 로직 (v1.1)
 *
 * 핵심 규칙:
 * 1) Phase1은 항상 먼저 오픈(모자 5 + 상의 슬롯들)
 * 2) CHEST 그룹과 SLEEVE 그룹은 대회 설정에 따라 좌/우 중 1개만 경매 오픈될 수 있음
 * 3) Phase2(하의) 슬롯은 Phase1의 "유효 슬롯(effective slots)"이 모두 FILLED일 때만 개설 가능
 * 4) Phase2 오픈 모드: AUTO(조건 충족 즉시) / ADMIN_APPROVE(관리자 승인 필요)
 */

import prisma from '../models/prisma';
import { creativeApprovalService } from './creativeApproval.service';

// 슬롯 상태 타입
type SlotStatus = 'OPEN' | 'SOLD' | 'RESERVED' | 'DISABLED' | 'IN_AUCTION';
type ReservedSide = 'LEFT' | 'RIGHT' | 'NONE';

// 대회 규칙 인터페이스
export interface TournamentRules {
  chestReservedSide: ReservedSide;
  sleeveReservedSide: ReservedSide;
  reservedSlotCodes: string[];
  disabledSlotCodes: string[];
  phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED';
  phase2UnlockMode: 'AUTO' | 'ADMIN_APPROVE';
  phase2EligibleMinDaysBefore: number;
  creativeApprovalRequired: boolean;
  prohibitedCategories: string[];
  maxSlotsPerBrandPerPlayer: number;
}

// 기본 대회 규칙
const DEFAULT_TOURNAMENT_RULES: TournamentRules = {
  chestReservedSide: 'NONE',
  sleeveReservedSide: 'NONE',
  reservedSlotCodes: [],
  disabledSlotCodes: [],
  phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED',
  phase2UnlockMode: 'AUTO',
  phase2EligibleMinDaysBefore: 0,
  creativeApprovalRequired: true,
  prohibitedCategories: [],
  maxSlotsPerBrandPerPlayer: 2,
};

// 슬롯 카탈로그 아이템 인터페이스
interface SlotCatalogItem {
  code: string;
  phase: number;
  exclusivityGroup: string | null;
  tournamentReserved: boolean;
}

// 선수별 슬롯 상태
interface PlayerSlotStates {
  [slotCode: string]: SlotStatus;
}

export class Phase2UnlockService {
  /**
   * 대회 규칙 파싱
   */
  parseTournamentRules(rules: any): TournamentRules {
    if (!rules) return DEFAULT_TOURNAMENT_RULES;

    return {
      chestReservedSide: rules.chestReservedSide || 'NONE',
      sleeveReservedSide: rules.sleeveReservedSide || 'NONE',
      reservedSlotCodes: rules.reservedSlotCodes || [],
      disabledSlotCodes: rules.disabledSlotCodes || [],
      phase2UnlockPolicy: rules.phase2UnlockPolicy || 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED',
      phase2UnlockMode: rules.phase2UnlockMode || 'AUTO',
      phase2EligibleMinDaysBefore: rules.phase2EligibleMinDaysBefore || 0,
      creativeApprovalRequired: rules.creativeApprovalRequired !== false,
      prohibitedCategories: rules.prohibitedCategories || [],
      maxSlotsPerBrandPerPlayer: rules.maxSlotsPerBrandPerPlayer || 2,
    };
  }

  /**
   * Phase1 유효 슬롯 목록 반환
   * - phase === 1인 슬롯 중
   * - disabledSlotCodes에 포함되지 않은 슬롯
   */
  getEffectivePhase1Slots(
    catalogSlots: SlotCatalogItem[],
    rules: TournamentRules
  ): string[] {
    return catalogSlots
      .filter((s) => s.phase === 1)
      .filter((s) => !rules.disabledSlotCodes.includes(s.code))
      .map((s) => s.code);
  }

  /**
   * 대회 설정에 의한 슬롯 점유 상태 적용
   * - reservedSlotCodes에 포함된 슬롯
   * - chestReservedSide에 의한 CHEST_L/CHEST_R 점유
   * - sleeveReservedSide에 의한 SLEEVE_L/SLEEVE_R 점유
   */
  applyTournamentReservation(
    slotCode: string,
    rules: TournamentRules
  ): SlotStatus | null {
    // 명시적으로 점유된 슬롯
    if (rules.reservedSlotCodes.includes(slotCode)) {
      return 'RESERVED';
    }

    // CHEST 그룹 좌/우 점유
    if (slotCode === 'CHEST_L' && rules.chestReservedSide === 'LEFT') {
      return 'RESERVED';
    }
    if (slotCode === 'CHEST_R' && rules.chestReservedSide === 'RIGHT') {
      return 'RESERVED';
    }

    // SLEEVE 그룹 좌/우 점유
    if (slotCode === 'SLEEVE_L' && rules.sleeveReservedSide === 'LEFT') {
      return 'RESERVED';
    }
    if (slotCode === 'SLEEVE_R' && rules.sleeveReservedSide === 'RIGHT') {
      return 'RESERVED';
    }

    return null;
  }

  /**
   * 슬롯의 최종 상태 계산
   * 우선순위: disabled > tournament reservation > player state > OPEN
   */
  computeSlotStatus(
    slotCode: string,
    rules: TournamentRules,
    playerSlotStates: PlayerSlotStates
  ): SlotStatus {
    // 1. 비활성화된 슬롯
    if (rules.disabledSlotCodes.includes(slotCode)) {
      return 'DISABLED';
    }

    // 2. 대회 점유
    const tournamentReservation = this.applyTournamentReservation(slotCode, rules);
    if (tournamentReservation) {
      return tournamentReservation;
    }

    // 3. 선수 상태 또는 기본 OPEN
    return playerSlotStates[slotCode] || 'OPEN';
  }

  /**
   * Phase2 오픈 가능 여부 판단
   * - Phase1의 모든 유효 슬롯이 SOLD 또는 RESERVED이면 Phase2 오픈 가능
   */
  isPhase2Eligible(
    catalogSlots: SlotCatalogItem[],
    rules: TournamentRules,
    playerSlotStates: PlayerSlotStates
  ): boolean {
    const phase1Slots = this.getEffectivePhase1Slots(catalogSlots, rules);

    return phase1Slots.every((code) => {
      const status = this.computeSlotStatus(code, rules, playerSlotStates);
      return status === 'SOLD' || status === 'RESERVED' || status === 'IN_AUCTION';
    });
  }

  /**
   * 선수에게 오픈 가능한 슬롯 목록 반환
   */
  getOpenSlotsForPlayer(
    catalogSlots: SlotCatalogItem[],
    rules: TournamentRules,
    playerSlotStates: PlayerSlotStates
  ): string[] {
    const openSlots: string[] = [];

    // Phase 1 슬롯 처리
    for (const slot of catalogSlots.filter((s) => s.phase === 1)) {
      const status = this.computeSlotStatus(slot.code, rules, playerSlotStates);
      if (status === 'OPEN') {
        openSlots.push(slot.code);
      }
    }

    // Phase 2 슬롯 처리 (조건 충족 시)
    const isPhase2Eligible = this.isPhase2Eligible(catalogSlots, rules, playerSlotStates);

    if (isPhase2Eligible && rules.phase2UnlockMode === 'AUTO') {
      for (const slot of catalogSlots.filter((s) => s.phase === 2)) {
        if (!rules.disabledSlotCodes.includes(slot.code)) {
          const status = playerSlotStates[slot.code] || 'OPEN';
          if (status === 'OPEN') {
            openSlots.push(slot.code);
          }
        }
      }
    }

    return openSlots;
  }

  /**
   * 슬롯의 오픈 가능 여부 및 상태 반환
   */
  getSlotAvailability(
    slotCode: string,
    catalogSlots: SlotCatalogItem[],
    rules: TournamentRules,
    playerSlotStates: PlayerSlotStates
  ): {
    status: SlotStatus;
    canOpen: boolean;
    reason: string;
    phase: number;
  } {
    const slot = catalogSlots.find((s) => s.code === slotCode);
    if (!slot) {
      return {
        status: 'DISABLED',
        canOpen: false,
        reason: '존재하지 않는 슬롯입니다.',
        phase: 0,
      };
    }

    const status = this.computeSlotStatus(slotCode, rules, playerSlotStates);

    // Phase 2 슬롯의 경우 추가 검증
    if (slot.phase === 2) {
      const isEligible = this.isPhase2Eligible(catalogSlots, rules, playerSlotStates);

      if (!isEligible) {
        return {
          status,
          canOpen: false,
          reason: 'Phase 1 슬롯이 모두 판매/점유되어야 Phase 2 슬롯을 오픈할 수 있습니다.',
          phase: 2,
        };
      }

      if (rules.phase2UnlockMode === 'ADMIN_APPROVE') {
        return {
          status,
          canOpen: false,
          reason: 'Phase 2 슬롯은 관리자 승인이 필요합니다.',
          phase: 2,
        };
      }
    }

    // 대회 점유
    if (status === 'RESERVED') {
      const tournamentReservation = this.applyTournamentReservation(slotCode, rules);
      if (tournamentReservation) {
        return {
          status,
          canOpen: false,
          reason: '대회 설정에 의해 점유된 슬롯입니다.',
          phase: slot.phase,
        };
      }
      return {
        status,
        canOpen: false,
        reason: '이미 점유된 슬롯입니다.',
        phase: slot.phase,
      };
    }

    if (status === 'DISABLED') {
      return {
        status,
        canOpen: false,
        reason: '이 대회에서는 비활성화된 슬롯입니다.',
        phase: slot.phase,
      };
    }

    if (status === 'SOLD') {
      return {
        status,
        canOpen: false,
        reason: '이미 판매된 슬롯입니다.',
        phase: slot.phase,
      };
    }

    if (status === 'IN_AUCTION') {
      return {
        status,
        canOpen: false,
        reason: '경매가 진행 중인 슬롯입니다.',
        phase: slot.phase,
      };
    }

    return {
      status,
      canOpen: true,
      reason: '오픈 가능한 슬롯입니다.',
      phase: slot.phase,
    };
  }

  /**
   * 이벤트와 선수에 대한 슬롯 가용성 전체 조회
   */
  async getSlotAvailabilityForEvent(eventId: string, athleteId: string) {
    // 이벤트 조회
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // 대회 규칙 파싱
    const rules = this.parseTournamentRules(event.tournamentRules);

    // 슬롯 템플릿 카탈로그 조회
    const templates = await prisma.slotTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ phase: 'asc' }, { code: 'asc' }],
    });

    const catalogSlots: SlotCatalogItem[] = templates.map((t) => ({
      code: t.code,
      phase: t.phase,
      exclusivityGroup: t.exclusivityGroup,
      tournamentReserved: t.tournamentReserved,
    }));

    // 선수의 현재 슬롯 상태 조회
    const slotInstances = await prisma.slotInstance.findMany({
      where: { eventId, athleteId },
      include: { slotTemplate: true },
    });

    const playerSlotStates: PlayerSlotStates = {};
    for (const instance of slotInstances) {
      playerSlotStates[instance.slotTemplate.code] = instance.status as SlotStatus;
    }

    // 모든 슬롯에 대한 가용성 계산
    const availability = templates.map((template) => {
      const slotAvailability = this.getSlotAvailability(
        template.code,
        catalogSlots,
        rules,
        playerSlotStates
      );

      return {
        slotCode: template.code,
        slotName: template.name,
        nameKr: template.nameKr,
        nameEn: template.nameEn,
        grade: template.grade,
        uiHeadline: template.uiHeadline,
        uiCopy: template.uiCopy,
        tags: template.tags,
        exclusivityGroup: template.exclusivityGroup,
        reserveMinKrw: template.reserveMinKrw,
        reserveRecKrw: template.reserveRecKrw,
        ...slotAvailability,  // includes phase, status, canOpen, reason
        hasInstance: !!slotInstances.find((si) => si.slotTemplate.code === template.code),
        instanceId: slotInstances.find((si) => si.slotTemplate.code === template.code)?.id,
      };
    });

    // Phase 2 오픈 가능 여부
    const isPhase2Eligible = this.isPhase2Eligible(catalogSlots, rules, playerSlotStates);

    return {
      eventId,
      athleteId,
      tournamentRules: rules,
      isPhase2Eligible,
      phase2UnlockMode: rules.phase2UnlockMode,
      slots: availability,
      phase1Slots: availability.filter((s) => s.phase === 1),
      phase2Slots: availability.filter((s) => s.phase === 2),
      openableSlots: availability.filter((s) => s.canOpen),
      reservedSlots: availability.filter((s) => s.status === 'RESERVED'),
      soldSlots: availability.filter((s) => s.status === 'SOLD'),
      disabledSlots: availability.filter((s) => s.status === 'DISABLED'),
    };
  }

  /**
   * Phase 2 오픈 최소 선행일 검증
   * @param eventDateEnd 대회 종료일
   * @param minDaysBefore 최소 선행일 수
   * @returns true이면 검증 통과
   */
  checkPhase2MinDaysBefore(eventDateEnd: Date, minDaysBefore: number): { eligible: boolean; daysRemaining: number } {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((eventDateEnd.getTime() - now.getTime()) / msPerDay);
    return {
      eligible: daysRemaining >= minDaysBefore,
      daysRemaining,
    };
  }

  /**
   * Phase 2 수동 승인 (Admin용)
   */
  async approvePhase2Slots(eventId: string, athleteId: string, adminUserId: string) {
    // SPONPIK docx 4 — 비활성/미승인 선수 + 비활성 대회 차단
    const [athleteCheck, eventCheck] = await Promise.all([
      prisma.athlete.findUnique({
        where: { id: athleteId },
        select: { isActive: true, kycStatus: true },
      }),
      prisma.event.findUnique({
        where: { id: eventId },
        select: { isActive: true },
      }),
    ]);
    if (!athleteCheck) throw new Error('Athlete not found');
    if (!athleteCheck.isActive) throw new Error('비활성 상태인 선수에 대한 Phase 2 승인 불가');
    if (athleteCheck.kycStatus !== 'APPROVED') throw new Error('KYC 미승인 선수에 대한 Phase 2 승인 불가');
    if (!eventCheck) throw new Error('Event not found');
    if (!eventCheck.isActive) throw new Error('비활성 상태인 대회에 대한 Phase 2 승인 불가');

    const availability = await this.getSlotAvailabilityForEvent(eventId, athleteId);

    if (!availability.isPhase2Eligible) {
      throw new Error('Phase 1 슬롯이 모두 채워지지 않아 Phase 2를 승인할 수 없습니다.');
    }

    // ★ v2: phase2EligibleMinDaysBefore 검증
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (event && availability.tournamentRules.phase2EligibleMinDaysBefore > 0) {
      const { eligible, daysRemaining } = this.checkPhase2MinDaysBefore(
        event.dateEnd,
        availability.tournamentRules.phase2EligibleMinDaysBefore
      );
      if (!eligible) {
        throw new Error(
          `Phase 2 오픈까지 최소 ${availability.tournamentRules.phase2EligibleMinDaysBefore}일이 필요합니다. ` +
          `현재 대회 종료까지 ${daysRemaining}일 남음.`
        );
      }
    }

    // Phase 2 슬롯 인스턴스 생성
    const phase2Templates = await prisma.slotTemplate.findMany({
      where: {
        phase: 2,
        isActive: true,
        code: {
          notIn: availability.tournamentRules.disabledSlotCodes,
        },
      },
    });

    const createdInstances = [];
    for (const template of phase2Templates) {
      // 이미 인스턴스가 있는지 확인
      const existing = await prisma.slotInstance.findUnique({
        where: {
          eventId_athleteId_slotTemplateId: {
            eventId,
            athleteId,
            slotTemplateId: template.id,
          },
        },
      });

      if (!existing) {
        const instance = await prisma.slotInstance.create({
          data: {
            eventId,
            athleteId,
            slotTemplateId: template.id,
            reservePrice: template.reserveRecKrw || template.defaultReservePrice,
            status: 'OPEN',
          },
          include: { slotTemplate: true },
        });
        createdInstances.push(instance);
      }
    }

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_APPROVE_PHASE2_SLOTS',
        entityType: 'EVENT',
        entityId: eventId,
        newValue: {
          athleteId,
          approvedSlots: createdInstances.map((i) => i.slotTemplate.code),
        },
      },
    });

    return {
      approved: true,
      createdInstances,
    };
  }

  /**
   * ★ v2: 브랜드당 최대 슬롯 수 검증
   * @param eventId 대회 ID
   * @param athleteId 선수 ID
   * @param brandId 브랜드 ID
   * @param rules TournamentRules
   */
  async validateMaxSlotsPerBrand(
    eventId: string,
    athleteId: string,
    brandId: string,
    rules: TournamentRules
  ): Promise<{ valid: boolean; currentCount: number; maxAllowed: number }> {
    const maxAllowed = rules.maxSlotsPerBrandPerPlayer;

    // 해당 브랜드가 이 선수/대회에서 이미 계약 중인 슬롯 수 조회
    const existingContracts = await prisma.contract.count({
      where: {
        brandId,
        status: { notIn: ['CANCELLED'] },
        auction: {
          slotInstance: {
            eventId,
            athleteId,
          },
        },
      },
    });

    return {
      valid: existingContracts < maxAllowed,
      currentCount: existingContracts,
      maxAllowed,
    };
  }

  /**
   * ★ v2: 금지 카테고리 검증
   * @param brandCategory 브랜드 카테고리
   * @param rules TournamentRules
   */
  validateProhibitedCategories(
    brandCategory: string,
    rules: TournamentRules
  ): { valid: boolean; reason?: string } {
    if (rules.prohibitedCategories.length === 0) {
      return { valid: true };
    }

    const lowerCategory = brandCategory.toLowerCase();
    const prohibited = rules.prohibitedCategories.find(
      (cat) => lowerCategory.includes(cat.toLowerCase()) || cat.toLowerCase().includes(lowerCategory)
    );

    if (prohibited) {
      return {
        valid: false,
        reason: `'${brandCategory}' 카테고리는 이 대회에서 금지되어 있습니다. (금지 목록: ${rules.prohibitedCategories.join(', ')})`,
      };
    }

    return { valid: true };
  }

  /**
   * ★ v2: 크리에이티브 사전 승인 검증
   * BrandEventCreativeApproval 모델을 통해 브랜드의 사전 승인 상태 확인
   */
  async validateCreativeApproval(
    brandId: string,
    eventId: string,
    rules: TournamentRules
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!rules.creativeApprovalRequired) {
      return { valid: true };
    }

    // 크리에이티브 승인 상태 확인
    const isApproved = await creativeApprovalService.isApproved(brandId, eventId);
    if (!isApproved) {
      return {
        valid: false,
        reason: '이 대회는 크리에이티브 사전 승인이 필요합니다. 크리에이티브를 먼저 제출하고 승인을 받아주세요.',
      };
    }

    return { valid: true };
  }

  /**
   * ★ v2: 입찰/즉시구매 전 대회 규칙 통합 검증
   */
  async validateTournamentRulesForBid(
    eventId: string,
    athleteId: string,
    brandId: string,
    brandCategory: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 대회 조회 및 규칙 파싱
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return { valid: false, errors: ['대회를 찾을 수 없습니다.'] };
    }

    const rules = this.parseTournamentRules(event.tournamentRules);

    // 1. 금지 카테고리 검증
    const categoryCheck = this.validateProhibitedCategories(brandCategory, rules);
    if (!categoryCheck.valid && categoryCheck.reason) {
      errors.push(categoryCheck.reason);
    }

    // 2. 브랜드당 최대 슬롯 수 검증
    const maxSlotsCheck = await this.validateMaxSlotsPerBrand(eventId, athleteId, brandId, rules);
    if (!maxSlotsCheck.valid) {
      errors.push(
        `이 선수에게는 최대 ${maxSlotsCheck.maxAllowed}개 슬롯만 구매 가능합니다. ` +
        `(현재 ${maxSlotsCheck.currentCount}개 계약 중)`
      );
    }

    // 3. 크리에이티브 사전 승인 검증
    const creativeCheck = await this.validateCreativeApproval(brandId, eventId, rules);
    if (!creativeCheck.valid && creativeCheck.reason) {
      errors.push(creativeCheck.reason);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const phase2UnlockService = new Phase2UnlockService();
