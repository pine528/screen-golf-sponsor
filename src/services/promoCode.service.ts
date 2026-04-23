/**
 * Promo Code Service
 *
 * - 캠페인-선수 단위 고유 프로모션 코드 발급
 * - 코드 형식: {TOUR}_{ATHLETE_INITIAL}{DISCOUNT} (예: KLPGA_KIM20)
 * - 충돌 시 suffix 자동 부여
 * - 할인 계산 (PERCENT / AMOUNT)
 * - 유효성 검증 (기간, status, 사용횟수)
 *
 * Refs:
 * - api_spec.docx > 4-1. 트래킹 자산 생성
 * - api_spec.docx > 5-4. 프로모션 코드 적용
 * - handoff.docx > 핵심 기능 > 프로모션 코드 자동 발급
 */

import prisma from '../models/prisma';
import { Prisma, DiscountType, PromoCodeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

export interface GenerateCodeParams {
  campaignId: string;
  brandId: string;
  athleteId: string;
  discountType?: DiscountType;
  discountValue?: number;
  validFrom?: Date;
  validTo?: Date;
  maxUsage?: number;
  customCode?: string;
}

export interface ApplyCodeResult {
  applied: boolean;
  discountAmount: number;
  message: string;
  code?: {
    id: string;
    code: string;
    campaignId: string;
    athleteId: string;
    brandId: string;
  };
}

export class PromoCodeService {
  /**
   * 코드 자동 생성 (기본 패턴: TOUR_INITIAL+DISCOUNT)
   */
  private async buildCode(
    athleteId: string,
    discountValue: number,
    discountType: DiscountType,
    customCode?: string
  ): Promise<string> {
    if (customCode) return customCode.toUpperCase().trim();

    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { name: true, tour: true },
    });
    if (!athlete) throw new NotFoundError('Athlete not found');

    // 영문 이니셜 추출 (한글 이름 → ROMA 변환은 미지원, 첫 자/이니셜 처리)
    const initial = athlete.name.replace(/[^A-Za-z가-힣]/g, '').slice(0, 4).toUpperCase();
    const tour = (athlete.tour || 'PRO').toUpperCase().replace(/[^A-Z]/g, '');
    const value = discountType === 'PERCENT' ? `${Math.round(discountValue)}` : `${Math.round(discountValue / 1000)}K`;
    return `${tour}_${initial}${value}`;
  }

  /**
   * 코드 충돌 시 suffix(_2, _3...) 부여
   */
  private async resolveCollision(baseCode: string): Promise<string> {
    let candidate = baseCode;
    let suffix = 1;
    while (await prisma.promoCode.findUnique({ where: { code: candidate } })) {
      suffix++;
      candidate = `${baseCode}_${suffix}`;
    }
    return candidate;
  }

  /**
   * 코드 발급 (idempotent: 같은 캠페인+선수 조합은 ACTIVE 코드 1개만)
   */
  async generate(params: GenerateCodeParams, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const {
      campaignId, brandId, athleteId,
      discountType = 'PERCENT',
      discountValue = 10,
      validFrom, validTo, maxUsage, customCode,
    } = params;

    // 기존 ACTIVE 코드 있으면 반환 (멱등)
    const existing = await client.promoCode.findFirst({
      where: { campaignId, athleteId, status: 'ACTIVE' },
    });
    if (existing && !customCode) return existing;

    const baseCode = await this.buildCode(athleteId, discountValue, discountType, customCode);
    const finalCode = await this.resolveCollision(baseCode);

    return client.promoCode.create({
      data: {
        campaignId, brandId, athleteId,
        code: finalCode,
        discountType,
        discountValue: new Decimal(discountValue),
        validFrom, validTo, maxUsage,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 코드 적용 / 검증 + 할인액 계산
   */
  async applyCode(code: string, orderPreviewAmount: number): Promise<ApplyCodeResult> {
    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } });

    if (!promo) {
      return { applied: false, discountAmount: 0, message: 'promo_code_not_found' };
    }
    if (promo.status !== 'ACTIVE') {
      return { applied: false, discountAmount: 0, message: `promo_code_${promo.status.toLowerCase()}` };
    }
    const now = new Date();
    if (promo.validFrom && promo.validFrom > now) {
      return { applied: false, discountAmount: 0, message: 'promo_code_not_yet_valid' };
    }
    if (promo.validTo && promo.validTo < now) {
      return { applied: false, discountAmount: 0, message: 'promo_code_expired' };
    }
    if (promo.maxUsage && promo.usageCount >= promo.maxUsage) {
      return { applied: false, discountAmount: 0, message: 'promo_code_overused' };
    }

    const discountAmount = this.calculateDiscount(
      orderPreviewAmount,
      promo.discountType,
      promo.discountValue
    );

    return {
      applied: true,
      discountAmount,
      message: 'promo_code_applied',
      code: {
        id: promo.id,
        code: promo.code,
        campaignId: promo.campaignId,
        athleteId: promo.athleteId,
        brandId: promo.brandId,
      },
    };
  }

  /**
   * 할인 금액 계산 (정수 원화 단위)
   */
  calculateDiscount(amount: number, type: DiscountType, value: Decimal): number {
    if (type === 'PERCENT') {
      return Math.floor((amount * value.toNumber()) / 100);
    }
    return Math.min(amount, value.toNumber());
  }

  /**
   * 사용 횟수 증가 (구매 트랜잭션 내에서 호출)
   */
  async incrementUsage(code: string, tx: Prisma.TransactionClient) {
    return tx.promoCode.update({
      where: { code },
      data: { usageCount: { increment: 1 } },
    });
  }

  /**
   * 사용 횟수 차감 (환불 시)
   */
  async decrementUsage(code: string, tx: Prisma.TransactionClient) {
    const current = await tx.promoCode.findUnique({ where: { code } });
    if (!current || current.usageCount <= 0) return current;
    return tx.promoCode.update({
      where: { code },
      data: { usageCount: { decrement: 1 } },
    });
  }

  /**
   * 비활성화
   */
  async disable(id: string) {
    return prisma.promoCode.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }

  /**
   * 캠페인 코드 목록
   */
  async listByCampaign(campaignId: string) {
    return prisma.promoCode.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const promoCodeService = new PromoCodeService();
