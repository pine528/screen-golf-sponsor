/**
 * Tracking Link Service
 *
 * - 단축 URL 발급 (nanoid 6자)
 * - QR 코드 자동 생성
 * - 캠페인-선수-콘텐츠 단위로 분리 발급 가능
 * - 클릭 시 redirect URL 반환 + sessionRollup 업데이트
 *
 * Refs:
 * - api_spec.docx > 5-1. 링크 클릭 기록
 * - handoff.docx > 어트리뷰션 우선순위 2순위 (최근 클릭된 트래킹 링크)
 */

import prisma from '../models/prisma';
import { Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { qrCodeService } from './qrCode.service';
import { NotFoundError } from '../utils/errors';

// nanoid: 영문대소문자+숫자 6자 (62^6 = 568억 조합 - 충돌 매우 낮음)
const generateShortCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 6);

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';

export interface CreateLinkParams {
  campaignId: string;
  brandId: string;
  athleteId: string;
  contentId?: string;
  miniStoreSlug?: string;
}

export interface ClickPayload {
  shortCode: string;
  campaignId?: string;
  athleteId?: string;
  contentId?: string;
  referrer?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  anonymousId?: string;
}

export class TrackingLinkService {
  /**
   * 충돌 없는 단축 코드 생성
   */
  private async newShortCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateShortCode();
      const exists = await prisma.trackingLink.findUnique({ where: { shortCode: code } });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique short code after 5 attempts');
  }

  /**
   * 트래킹 링크 발급 (idempotent: 같은 캠페인+선수+콘텐츠 조합은 ACTIVE 1개만)
   */
  async create(params: CreateLinkParams, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const { campaignId, brandId, athleteId, contentId = null, miniStoreSlug } = params;

    // 기존 ACTIVE 링크 있으면 반환 (멱등)
    const existing = await client.trackingLink.findFirst({
      where: { campaignId, athleteId, contentId, status: 'ACTIVE' },
    });
    if (existing) return existing;

    const shortCode = await this.newShortCode();
    const longUrl = `${PUBLIC_BASE}/store/${miniStoreSlug || campaignId}?utm_source=sponpik&utm_campaign=${campaignId}&utm_athlete=${athleteId}${contentId ? `&utm_content=${contentId}` : ''}`;

    // QR 생성 (실패해도 링크는 생성됨)
    let qrUrl: string | null = null;
    try {
      const shortUrl = `${PUBLIC_BASE}/s/${shortCode}`;
      qrUrl = await qrCodeService.generateAndStore(shortUrl, `qr_${shortCode}.png`);
    } catch (e) {
      console.error('[TrackingLink] QR generation failed:', e);
    }

    return client.trackingLink.create({
      data: {
        campaignId, brandId, athleteId, contentId,
        shortCode, longUrl, qrUrl,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 단축코드 → 링크 정보
   */
  async resolveShortCode(shortCode: string) {
    const link = await prisma.trackingLink.findUnique({ where: { shortCode } });
    if (!link) throw new NotFoundError('Short code not found');
    return link;
  }

  /**
   * 클릭 처리: 클릭 카운트 증가 + sessionRollup 업데이트 + 이벤트 적재 위임
   * Returns: redirect URL + click_id + session_id
   */
  async trackClick(payload: ClickPayload) {
    const link = await this.resolveShortCode(payload.shortCode);

    const sessionId = payload.sessionId || `sess_${generateShortCode()}${generateShortCode()}`;
    const clickId = `clk_${generateShortCode()}${generateShortCode()}`;

    await prisma.$transaction(async (tx) => {
      // 1) 링크 클릭 카운트 증가
      await tx.trackingLink.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 } },
      });

      // 2) 세션 롤업 upsert (어트리뷰션 우선순위 2순위)
      await tx.sessionRollup.upsert({
        where: { sessionId },
        create: {
          sessionId,
          anonymousId: payload.anonymousId,
          lastCampaignId: link.campaignId,
          lastAthleteId: link.athleteId,
          lastBrandId: link.brandId,
          lastClickId: clickId,
          lastShortCode: link.shortCode,
          lastClickAt: new Date(),
        },
        update: {
          anonymousId: payload.anonymousId,
          lastCampaignId: link.campaignId,
          lastAthleteId: link.athleteId,
          lastBrandId: link.brandId,
          lastClickId: clickId,
          lastShortCode: link.shortCode,
          lastClickAt: new Date(),
        },
      });

      // 3) FunnelEvent (LINK_CLICK) 적재
      await tx.funnelEvent.create({
        data: {
          eventName: 'LINK_CLICK',
          campaignId: link.campaignId,
          brandId: link.brandId,
          athleteId: link.athleteId,
          contentId: link.contentId,
          sessionId,
          anonymousId: payload.anonymousId,
          payload: { shortCode: link.shortCode, clickId },
          referrer: payload.referrer,
          deviceType: payload.deviceType,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      });
    });

    return {
      redirectUrl: link.longUrl,
      clickId,
      sessionId,
    };
  }

  /**
   * 캠페인별 링크 목록
   */
  async listByCampaign(campaignId: string) {
    return prisma.trackingLink.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 비활성화
   */
  async disable(id: string) {
    return prisma.trackingLink.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }
}

export const trackingLinkService = new TrackingLinkService();
