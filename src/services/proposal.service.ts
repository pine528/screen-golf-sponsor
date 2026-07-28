/**
 * 개편 Phase 5 — 장기 파트너십 제안 (핸드오프 §14, WF-10)
 *
 * 6·12개월 상품은 경매가 금지되므로 제안이 유일한 계약 경로다.
 * 상태 전이는 아래 표를 벗어날 수 없으며 모든 변경은 ProposalHistory에 남는다 (§14.3).
 */
import { PrismaClient, ProposalStatus, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { notificationService } from './notification.service';

const prisma = new PrismaClient();

/** 제안 만료 기본 기간(일) — 제출 후 이 기간 내 검토가 끝나지 않으면 EXPIRED */
export const PROPOSAL_EXPIRY_DAYS = 14;

/** §14.2 허용된 상태 전이 */
const TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ADMIN_REVIEW', 'REJECTED', 'EXPIRED'],
  ADMIN_REVIEW: ['ATHLETE_REVIEW', 'REVISION_REQUESTED', 'REJECTED', 'EXPIRED'],
  ATHLETE_REVIEW: ['APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'EXPIRED'],
  REVISION_REQUESTED: ['BRAND_REVISING', 'EXPIRED'],
  BRAND_REVISING: ['SUBMITTED', 'EXPIRED'],
  APPROVED: ['CONTRACTING', 'EXPIRED'],
  CONTRACTING: ['CONTRACTED', 'REJECTED'],
  CONTRACTED: [],
  REJECTED: [],
  EXPIRED: [],
};

/** 상태를 바꿀 수 있는 주체 */
const ALLOWED_ACTORS: Partial<Record<ProposalStatus, string[]>> = {
  SUBMITTED: ['BRAND'],
  ADMIN_REVIEW: ['ADMIN'],
  ATHLETE_REVIEW: ['ADMIN'],
  APPROVED: ['ATHLETE', 'ADMIN'],
  REVISION_REQUESTED: ['ATHLETE', 'ADMIN'],
  REJECTED: ['ATHLETE', 'ADMIN'],
  BRAND_REVISING: ['BRAND'],
  CONTRACTING: ['ADMIN'],
  CONTRACTED: ['ADMIN'],
};

export const proposalService = {
  /** 제안 작성(임시저장 포함) — PROP-02/03 */
  async create(brandId: string, data: any) {
    assertLongTerm(data.durationType);
    assertPeriod(data.startDate, data.endDate);
    if (!data.totalBudget || Number(data.totalBudget) <= 0) {
      throw new BadRequestError('총 예산을 입력해 주세요');
    }

    const athlete = await prisma.athlete.findUnique({
      where: { id: data.athleteId },
      select: { id: true, isActive: true, kycStatus: true },
    });
    if (!athlete) throw new NotFoundError('선수를 찾을 수 없습니다');
    if (!athlete.isActive || athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('현재 제안할 수 없는 선수입니다');
    }

    const proposal = await prisma.proposal.create({
      data: { ...pickFields(data), brandId, athleteId: data.athleteId, status: 'DRAFT' },
    });
    await this.addHistory(proposal.id, null, 'DRAFT', { actorRole: 'BRAND', note: '제안 작성' });
    return proposal;
  },

  /** 임시저장 갱신 — DRAFT/BRAND_REVISING 상태에서만 */
  async update(id: string, brandId: string, data: any) {
    const p = await this.getOwned(id, brandId);
    if (!['DRAFT', 'BRAND_REVISING'].includes(p.status)) {
      throw new BadRequestError('지금은 제안을 수정할 수 없습니다');
    }
    if (data.durationType) assertLongTerm(data.durationType);
    if (data.startDate || data.endDate) {
      assertPeriod(data.startDate ?? p.startDate, data.endDate ?? p.endDate);
    }

    const changes = diffFields(p, data);
    const updated = await prisma.proposal.update({ where: { id }, data: pickFields(data) });
    if (Object.keys(changes).length > 0) {
      await this.addHistory(id, p.status, p.status, { actorRole: 'BRAND', note: '내용 수정', changes });
    }
    return updated;
  },

  /** 제출 — DRAFT/BRAND_REVISING → SUBMITTED → 관리자 검토 대기 */
  async submit(id: string, brandId: string, actorId: string) {
    const p = await this.getOwned(id, brandId);
    if (!['DRAFT', 'BRAND_REVISING'].includes(p.status)) {
      throw new BadRequestError('이미 제출된 제안입니다');
    }
    const expiresAt = new Date(Date.now() + PROPOSAL_EXPIRY_DAYS * 86400_000);
    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), expiresAt },
    });
    await this.addHistory(id, p.status, 'SUBMITTED', { actorId, actorRole: 'BRAND', note: '제안 제출' });

    // 관리자 검토 대기로 즉시 이동
    await prisma.proposal.update({ where: { id }, data: { status: 'ADMIN_REVIEW' } });
    await this.addHistory(id, 'SUBMITTED', 'ADMIN_REVIEW', { actorRole: 'SYSTEM', note: '관리자 검토 대기' });
    return updated;
  },

  /**
   * 상태 전이 (검토·승인·거절·수정요청) — PROP-04/05
   * role: ADMIN | ATHLETE | BRAND
   */
  async transition(
    id: string,
    to: ProposalStatus,
    actor: { id: string; role: string; athleteId?: string; brandId?: string },
    note?: string
  ) {
    const p = await prisma.proposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('제안을 찾을 수 없습니다');

    if (!TRANSITIONS[p.status].includes(to)) {
      throw new BadRequestError(`${statusLabel(p.status)} 상태에서는 ${statusLabel(to)}(으)로 변경할 수 없습니다`);
    }
    const allowed = ALLOWED_ACTORS[to];
    if (allowed && !allowed.includes(actor.role)) {
      throw new ForbiddenError('이 작업을 수행할 권한이 없습니다');
    }
    // 당사자 확인
    if (actor.role === 'ATHLETE' && p.athleteId !== actor.athleteId) throw new ForbiddenError('본인에게 온 제안이 아닙니다');
    if (actor.role === 'BRAND' && p.brandId !== actor.brandId) throw new ForbiddenError('본인 제안이 아닙니다');

    const updated = await prisma.proposal.update({
      where: { id },
      data: {
        status: to,
        reviewNote: note ?? p.reviewNote,
        reviewedBy: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(to) ? actor.id : p.reviewedBy,
        reviewedAt: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(to) ? new Date() : p.reviewedAt,
      },
    });
    await this.addHistory(id, p.status, to, { actorId: actor.id, actorRole: actor.role, note });
    await this.notifyTransition(updated, to);

    // 개편 Phase 6 (OPS-01): 승인 즉시 약속한 활동을 이행 항목으로 펼친다
    if (to === 'APPROVED') {
      try {
        const { deliverableService } = await import('./deliverable.service');
        const r = await deliverableService.generateFromProposal(id);
        if (r.created > 0) console.log(`[Proposal] 이행 항목 ${r.created}건 생성 (제안 ${id})`);
      } catch (e) {
        console.error('[Proposal] 이행 항목 생성 실패:', e);
      }
    }
    return updated;
  },

  /** 승인된 제안으로 계약 생성 — PROP-08 */
  async convertToContract(id: string, actorId: string) {
    const p = await prisma.proposal.findUnique({ where: { id }, include: { athlete: true, brand: true } });
    if (!p) throw new NotFoundError('제안을 찾을 수 없습니다');
    if (p.status !== 'APPROVED') throw new BadRequestError('승인된 제안만 계약으로 전환할 수 있습니다');
    if (p.contractId) throw new BadRequestError('이미 계약이 생성된 제안입니다');

    await prisma.proposal.update({ where: { id }, data: { status: 'CONTRACTING' } });
    await this.addHistory(id, 'APPROVED', 'CONTRACTING', { actorId, actorRole: 'ADMIN', note: '계약 생성 시작' });

    // 기존 Contract는 auctionId 필수 구조라 장기계약은 별도 처리가 필요하다.
    // 계약서 양식이 확정되기 전까지는 상태만 CONTRACTING으로 두고 운영에서 수기 처리한다.
    return prisma.proposal.findUnique({ where: { id } });
  },

  /** 만료 처리 — PROP-07 (검토 중인 제안만) */
  async expireOverdue() {
    const res = await prisma.proposal.updateMany({
      where: {
        status: { in: ['SUBMITTED', 'ADMIN_REVIEW', 'ATHLETE_REVIEW', 'REVISION_REQUESTED', 'BRAND_REVISING'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    if (res.count > 0) console.log(`[Proposal] 만료 처리 ${res.count}건`);
    return res.count;
  },

  async addHistory(
    proposalId: string,
    from: ProposalStatus | null,
    to: ProposalStatus,
    opts: { actorId?: string; actorRole?: string; note?: string; changes?: any } = {}
  ) {
    return prisma.proposalHistory.create({
      data: {
        proposalId,
        fromStatus: from,
        toStatus: to,
        actorId: opts.actorId,
        actorRole: opts.actorRole,
        note: opts.note,
        changes: opts.changes ?? Prisma.JsonNull,
      },
    });
  },

  async getOwned(id: string, brandId: string) {
    const p = await prisma.proposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('제안을 찾을 수 없습니다');
    if (p.brandId !== brandId) throw new ForbiddenError('본인 제안이 아닙니다');
    return p;
  },

  async listForBrand(brandId: string) {
    return prisma.proposal.findMany({
      where: { brandId },
      include: { athlete: { select: { id: true, name: true, profileImageUrl: true, tourQualification: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async listForAthlete(athleteId: string) {
    return prisma.proposal.findMany({
      // 선수에게는 관리자 검토를 통과한 제안부터 보인다
      where: { athleteId, status: { in: ['ATHLETE_REVIEW', 'REVISION_REQUESTED', 'BRAND_REVISING', 'APPROVED', 'CONTRACTING', 'CONTRACTED', 'REJECTED'] } },
      include: { brand: { select: { id: true, name: true, category: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async listForAdmin(status?: ProposalStatus) {
    return prisma.proposal.findMany({
      where: status ? { status } : {},
      include: {
        athlete: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true, category: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async detail(id: string) {
    const p = await prisma.proposal.findUnique({
      where: { id },
      include: {
        athlete: { select: { id: true, name: true, profileImageUrl: true, tourQualification: true } },
        brand: { select: { id: true, name: true, category: true } },
        history: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw new NotFoundError('제안을 찾을 수 없습니다');
    return p;
  },

  async notifyTransition(p: { id: string; brandId: string; athleteId: string }, to: ProposalStatus) {
    try {
      const [brand, athlete] = await Promise.all([
        prisma.brand.findUnique({ where: { id: p.brandId }, select: { userId: true, name: true } }),
        prisma.athlete.findUnique({ where: { id: p.athleteId }, select: { userId: true, name: true } }),
      ]);
      const link = `/proposals/${p.id}`;
      const toBrand = (title: string, message: string) =>
        brand && notificationService.create({ userId: brand.userId, type: 'ADMIN_ALERT', title, message, payload: { link, entityType: 'PROPOSAL', entityId: p.id } });
      const toAthlete = (title: string, message: string) =>
        athlete && notificationService.create({ userId: athlete.userId, type: 'ADMIN_ALERT', title, message, payload: { link, entityType: 'PROPOSAL', entityId: p.id } });

      switch (to) {
        case 'ATHLETE_REVIEW':
          await toAthlete('새 파트너십 제안', `${brand?.name}에서 장기 파트너십을 제안했습니다.`);
          break;
        case 'APPROVED':
          await toBrand('제안 승인', `${athlete?.name} 선수가 제안을 승인했습니다.`);
          break;
        case 'REJECTED':
          await toBrand('제안 거절', `제안이 거절되었습니다.`);
          break;
        case 'REVISION_REQUESTED':
          await toBrand('수정 요청', `제안에 대한 수정 요청이 도착했습니다.`);
          break;
        case 'CONTRACTED':
          await toBrand('계약 완료', `장기 파트너십 계약이 체결되었습니다.`);
          await toAthlete('계약 완료', `장기 파트너십 계약이 체결되었습니다.`);
          break;
      }
    } catch (e) {
      console.error('[Proposal] 알림 발송 실패:', e);
    }
  },
};

function assertLongTerm(durationType: string) {
  if (!['MONTHS_6', 'MONTHS_12'].includes(durationType)) {
    throw new BadRequestError('장기 파트너십 제안은 6개월 또는 12개월만 가능합니다');
  }
}

function assertPeriod(start: any, end: any) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new BadRequestError('계약 기간을 확인해 주세요');
  if (e <= s) throw new BadRequestError('종료일은 시작일보다 뒤여야 합니다');
}

const EDITABLE = [
  'startDate', 'endDate', 'durationType', 'desiredSlots', 'allowAlternative', 'minAppearances',
  'snsActivity', 'storeVisits', 'corporateEvents', 'contentShoots', 'imageUsageScope', 'imageUsageMonths',
  'allowSecondaryEdit', 'allowPaidMedia', 'categoryExclusive', 'totalBudget', 'installmentPlan',
  'additionalCosts', 'brandNote',
];

function pickFields(data: any) {
  const out: any = {};
  for (const k of EDITABLE) {
    if (data[k] === undefined) continue;
    out[k] = k === 'startDate' || k === 'endDate' ? new Date(data[k]) : data[k];
  }
  return out;
}

/** §14.3 수정 이력에 남길 변경 필드만 추린다 */
function diffFields(before: any, after: any) {
  const changes: Record<string, { from: any; to: any }> = {};
  for (const k of EDITABLE) {
    if (after[k] === undefined) continue;
    const b = before[k] instanceof Date ? before[k].toISOString() : before[k];
    const a = k === 'startDate' || k === 'endDate' ? new Date(after[k]).toISOString() : after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) changes[k] = { from: b, to: a };
  }
  return changes;
}

const LABELS: Record<string, string> = {
  DRAFT: '작성 중', SUBMITTED: '제안 완료', ADMIN_REVIEW: '관리자 검토', ATHLETE_REVIEW: '선수 검토',
  REVISION_REQUESTED: '수정 요청', BRAND_REVISING: '브랜드 수정 중', APPROVED: '승인', REJECTED: '거절',
  EXPIRED: '만료', CONTRACTING: '계약 진행', CONTRACTED: '계약 완료',
};
export function statusLabel(s: string) {
  return LABELS[s] || s;
}

export default proposalService;
