/**
 * Campaign Assets Service
 *
 * - 캠페인 활성화 시 자산(코드+링크+QR+미니스토어) 일괄 생성
 * - api_spec.docx > 4-1. 트래킹 자산 생성: status=generated/exists 멱등 처리
 *
 * Refs:
 * - api_spec.docx > 4. 캠페인 자산 API
 * - handoff.docx > 핵심 기능 > 매칭 완료 즉시 코드·링크·QR·미니 스토어 생성
 */

import prisma from '../models/prisma';
import { promoCodeService } from './promoCode.service';
import { trackingLinkService } from './trackingLink.service';
import { miniStoreService } from './miniStore.service';
import { NotFoundError, BadRequestError } from '../utils/errors';

export interface GenerateAssetsParams {
  campaignId: string;
  brandId: string;
  athleteId: string;  // 캠페인 매칭된 선수 (단일)
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  validFrom?: Date;
  validTo?: Date;
}

export interface AssetsResult {
  campaignId: string;
  promoCode: string;
  shortUrl: string;
  brandMiniStoreUrl: string;
  qrUrl: string | null;
  status: 'generated' | 'exists';
}

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';

export class CampaignAssetsService {
  /**
   * 캠페인 자산 일괄 생성 (멱등)
   */
  async generate(params: GenerateAssetsParams): Promise<AssetsResult> {
    const { campaignId, brandId, athleteId } = params;

    // 캠페인 검증
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (campaign.brandId !== brandId) {
      throw new BadRequestError('Brand mismatch');
    }

    // SPONPIK docx 4 — 비활성/미승인 선수에 대한 자산 생성 차단
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { isActive: true, kycStatus: true },
    });
    if (!athlete) throw new NotFoundError('Athlete not found');
    if (!athlete.isActive) {
      throw new BadRequestError('비활성 상태인 선수에 대한 자산 생성은 불가합니다');
    }
    if (athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 승인이 완료된 선수만 자산 생성 가능합니다');
    }

    // 기존 자산 존재 여부 (멱등 검증)
    const [existingCode, existingLink, existingStore] = await Promise.all([
      prisma.promoCode.findFirst({ where: { campaignId, athleteId, status: 'ACTIVE' } }),
      prisma.trackingLink.findFirst({ where: { campaignId, athleteId, contentId: null, status: 'ACTIVE' } }),
      prisma.miniStore.findUnique({ where: { campaignId } }),
    ]);

    const allExist = existingCode && existingLink && existingStore;

    // 트랜잭션으로 자산 생성 (미니스토어 → 링크 → 코드 순)
    const result = await prisma.$transaction(async (tx) => {
      // 1) 미니스토어 (먼저 생성해야 링크의 longUrl이 slug 사용 가능)
      const store = existingStore || await miniStoreService.create({
        campaignId, brandId,
      }, tx);

      // 2) 트래킹 링크 (캠페인 기본 링크, contentId=null)
      const link = existingLink || await trackingLinkService.create({
        campaignId, brandId, athleteId,
        miniStoreSlug: store.slug,
      }, tx);

      // 3) 프로모션 코드
      const code = existingCode || await promoCodeService.generate({
        campaignId, brandId, athleteId,
        discountType: params.discountType ?? 'PERCENT',
        discountValue: params.discountValue ?? 10,
        validFrom: params.validFrom,
        validTo: params.validTo,
      }, tx);

      return { store, link, code };
    });

    return {
      campaignId,
      promoCode: result.code.code,
      shortUrl: `${PUBLIC_BASE}/s/${result.link.shortCode}`,
      brandMiniStoreUrl: `${PUBLIC_BASE}/store/brand/${result.store.slug}?campaign=${campaignId}`,
      qrUrl: result.link.qrUrl,
      status: allExist ? 'exists' : 'generated',
    };
  }

  /**
   * 캠페인 자산 조회
   */
  async list(campaignId: string) {
    const [promoCodes, trackingLinks, miniStore] = await Promise.all([
      prisma.promoCode.findMany({ where: { campaignId } }),
      prisma.trackingLink.findMany({ where: { campaignId } }),
      prisma.miniStore.findUnique({ where: { campaignId }, include: { products: true } }),
    ]);

    // api_spec TABLE 13 호환: status를 lowercase로 변환
    return {
      campaignId,
      promo_codes: promoCodes.map((c) => ({
        id: c.id,
        code: c.code,
        status: c.status.toLowerCase(),
        usage_count: c.usageCount,
      })),
      tracking_links: trackingLinks.map((l) => ({
        id: l.id,
        short_url: `${PUBLIC_BASE}/s/${l.shortCode}`,
        long_url: l.longUrl,  // wireframe TABLE 9: "장/단축 링크"
        content_id: l.contentId,
        click_count: l.clickCount,
        qr_url: l.qrUrl,
        status: l.status.toLowerCase(),
      })),
      mini_store: miniStore ? {
        id: miniStore.id,
        slug: miniStore.slug,
        // api_spec TABLE 13: /store/brand/:slug
        url: `${PUBLIC_BASE}/store/brand/${miniStore.slug}`,
        status: miniStore.status.toLowerCase(),
        product_count: miniStore.products.length,
      } : null,
    };
  }
}

export const campaignAssetsService = new CampaignAssetsService();
