/**
 * 개편 Phase 6 — 이행·증빙 (OPS-01~08)
 *
 * 계약·제안에서 약속한 활동을 항목 단위로 추적한다.
 * 증빙은 항목마다 여러 건 제출할 수 있고, 관리자가 건별로 승인·반려한다.
 * 이행이 어려운 항목은 대체이행(이월·슬롯변경·SNS 대체·환불)을 요청할 수 있다 (§26.3).
 */
import { PrismaClient, DeliverableType, DeliverableStatus, SubstitutionType } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { notificationService } from './notification.service';

const prisma = new PrismaClient();

const TYPE_LABEL: Record<DeliverableType, string> = {
  APPAREL_WEAR: '착장 노출',
  APPEARANCE: '대회 출전',
  SNS_FEED: 'SNS 피드',
  SNS_STORY: 'SNS 스토리',
  SNS_REELS: '릴스·숏폼',
  STORE_VISIT: '매장 방문',
  CORPORATE_EVENT: '기업 행사',
  CONTENT_SHOOT: '콘텐츠 촬영',
};

export const deliverableService = {
  /**
   * 승인된 제안의 활동 약속을 이행 항목으로 펼친다 (OPS-01/03).
   * 이미 생성된 제안이면 아무것도 하지 않는다(재실행 안전).
   */
  async generateFromProposal(proposalId: string) {
    const p = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!p) throw new NotFoundError('제안을 찾을 수 없습니다');

    const exists = await prisma.deliverable.count({ where: { proposalId } });
    if (exists > 0) return { created: 0, skipped: exists };

    const sns: any = p.snsActivity || {};
    const specs: { type: DeliverableType; count: number }[] = ([
      { type: 'APPEARANCE', count: p.minAppearances ?? 0 },
      { type: 'SNS_FEED', count: Number(sns.feed ?? 0) },
      { type: 'SNS_STORY', count: Number(sns.story ?? 0) },
      { type: 'SNS_REELS', count: Number(sns.reels ?? 0) },
      { type: 'STORE_VISIT', count: Number((p.storeVisits as any)?.count ?? 0) },
      { type: 'CORPORATE_EVENT', count: Number((p.corporateEvents as any)?.count ?? 0) },
      { type: 'CONTENT_SHOOT', count: Number((p.contentShoots as any)?.count ?? 0) },
    ] as { type: DeliverableType; count: number }[]).filter((s) => s.count > 0);

    // 착장 노출은 계약 기간 전체에 걸친 기본 이행 항목
    specs.unshift({ type: 'APPAREL_WEAR', count: 1 });

    const created = await prisma.$transaction(
      specs.map((s) =>
        prisma.deliverable.create({
          data: {
            proposalId,
            athleteId: p.athleteId,
            brandId: p.brandId,
            type: s.type,
            title: TYPE_LABEL[s.type],
            targetCount: s.count,
            dueDate: p.endDate,
            status: 'PENDING',
          },
        })
      )
    );
    return { created: created.length, skipped: 0 };
  },

  /** 선수 증빙 등록 (OPS-04) */
  async submitEvidence(
    deliverableId: string,
    athleteId: string,
    data: { fileUrl: string; fileType?: string; linkUrl?: string; capturedAt?: string; note?: string }
  ) {
    const d = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
    if (!d) throw new NotFoundError('이행 항목을 찾을 수 없습니다');
    if (d.athleteId !== athleteId) throw new ForbiddenError('본인 이행 항목이 아닙니다');
    if (['CANCELLED', 'SUBSTITUTED'].includes(d.status)) {
      throw new BadRequestError('종료된 이행 항목에는 증빙을 등록할 수 없습니다');
    }
    if (!data.fileUrl) throw new BadRequestError('증빙 파일을 첨부해 주세요');

    const ev = await prisma.deliverableEvidence.create({
      data: {
        deliverableId,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        linkUrl: data.linkUrl,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : null,
        note: data.note,
      },
    });
    await prisma.deliverable.update({ where: { id: deliverableId }, data: { status: 'SUBMITTED' } });
    await this.notifyAdmins('증빙 검수 요청', `${d.title} 증빙이 등록되었습니다.`, deliverableId);
    return ev;
  },

  /** 관리자 증빙 검수 (OPS-05/06) — 승인 시 이행 횟수 1 증가 */
  async reviewEvidence(evidenceId: string, approve: boolean, reviewerId: string, note?: string) {
    const ev = await prisma.deliverableEvidence.findUnique({
      where: { id: evidenceId },
      include: { deliverable: true },
    });
    if (!ev) throw new NotFoundError('증빙을 찾을 수 없습니다');
    if (ev.status !== 'SUBMITTED') throw new BadRequestError('이미 검수된 증빙입니다');

    const d = ev.deliverable;
    await prisma.deliverableEvidence.update({
      where: { id: evidenceId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewNote: note,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    let status: DeliverableStatus;
    let completed = d.completedCount;
    if (approve) {
      completed = Math.min(d.targetCount, d.completedCount + 1);
      status = completed >= d.targetCount ? 'APPROVED' : 'IN_PROGRESS';
    } else {
      // 검수 대기 중인 다른 증빙이 남아 있으면 여전히 검수 대기
      const pending = await prisma.deliverableEvidence.count({
        where: { deliverableId: d.id, status: 'SUBMITTED' },
      });
      status = pending > 0 ? 'SUBMITTED' : 'REJECTED';
    }

    const updated = await prisma.deliverable.update({
      where: { id: d.id },
      data: { completedCount: completed, status },
    });

    await this.notifyAthlete(
      d.athleteId,
      approve ? '증빙 승인' : '증빙 반려',
      approve
        ? `${d.title} 증빙이 승인되었습니다. (${completed}/${d.targetCount})`
        : `${d.title} 증빙이 반려되었습니다.${note ? ` 사유: ${note}` : ' 다시 제출해 주세요.'}`,
      d.id
    );
    return updated;
  },

  /** 대체이행 요청 (OPS-07) — 선수 또는 브랜드가 요청 */
  async requestSubstitution(
    deliverableId: string,
    actor: { id: string; role: string; athleteId?: string; brandId?: string },
    type: SubstitutionType,
    note?: string
  ) {
    const d = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
    if (!d) throw new NotFoundError('이행 항목을 찾을 수 없습니다');
    if (actor.role === 'ATHLETE' && d.athleteId !== actor.athleteId) throw new ForbiddenError('본인 이행 항목이 아닙니다');
    if (actor.role === 'BRAND' && d.brandId !== actor.brandId) throw new ForbiddenError('본인 계약 항목이 아닙니다');
    if (d.status === 'APPROVED') throw new BadRequestError('이미 이행이 완료된 항목입니다');
    if (d.substitutionStatus === 'REQUESTED') throw new BadRequestError('이미 대체이행을 요청한 항목입니다');

    const updated = await prisma.deliverable.update({
      where: { id: deliverableId },
      data: { substitutionType: type, substitutionStatus: 'REQUESTED', substitutionNote: note },
    });
    await this.notifyAdmins('대체이행 요청', `${d.title} 항목에 대체이행이 요청되었습니다.`, deliverableId);
    return updated;
  },

  /** 대체이행 승인·거절 (OPS-08) — 관리자 */
  async reviewSubstitution(deliverableId: string, approve: boolean, reviewerId: string, note?: string) {
    const d = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
    if (!d) throw new NotFoundError('이행 항목을 찾을 수 없습니다');
    if (d.substitutionStatus !== 'REQUESTED') throw new BadRequestError('대체이행 요청이 없는 항목입니다');

    const updated = await prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        substitutionStatus: approve ? 'APPROVED' : 'REJECTED',
        substitutionNote: note ?? d.substitutionNote,
        status: approve ? 'SUBSTITUTED' : d.status,
      },
    });
    await this.notifyAthlete(
      d.athleteId,
      approve ? '대체이행 승인' : '대체이행 거절',
      `${d.title} 항목의 대체이행이 ${approve ? '승인' : '거절'}되었습니다.`,
      deliverableId
    );
    return updated;
  },

  async list(filter: { athleteId?: string; brandId?: string; proposalId?: string; status?: DeliverableStatus }) {
    return prisma.deliverable.findMany({
      where: {
        ...(filter.athleteId ? { athleteId: filter.athleteId } : {}),
        ...(filter.brandId ? { brandId: filter.brandId } : {}),
        ...(filter.proposalId ? { proposalId: filter.proposalId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: {
        evidence: { orderBy: { createdAt: 'desc' } },
        athlete: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /** 검수 대기 목록 (관리자) */
  async listPendingReview() {
    return prisma.deliverable.findMany({
      where: { OR: [{ status: 'SUBMITTED' }, { substitutionStatus: 'REQUESTED' }] },
      include: {
        evidence: { where: { status: 'SUBMITTED' }, orderBy: { createdAt: 'asc' } },
        athlete: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  },

  /**
   * 이행 현황 요약 (REP-01)
   * 검증된 수치와 미검증(제출만 된) 수치를 반드시 구분한다 (LEG-06).
   */
  async summary(filter: { athleteId?: string; brandId?: string; proposalId?: string }) {
    const items = await this.list(filter);
    const total = items.reduce((s, d) => s + d.targetCount, 0);
    const verified = items.reduce((s, d) => s + d.completedCount, 0);
    const pendingReview = items.reduce(
      (s, d) => s + d.evidence.filter((e) => e.status === 'SUBMITTED').length,
      0
    );
    const overdue = items.filter(
      (d) => d.dueDate && d.dueDate < new Date() && !['APPROVED', 'SUBSTITUTED', 'CANCELLED'].includes(d.status)
    ).length;

    return {
      totalTarget: total,
      verifiedCount: verified, // 검수 완료된 이행만 집계
      pendingReviewCount: pendingReview, // 제출됐지만 아직 검증되지 않음
      overdueCount: overdue,
      substitutedCount: items.filter((d) => d.status === 'SUBSTITUTED').length,
      progressRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      note: '진행률은 검수 완료된 이행만 반영합니다. 검수 대기 중인 증빙은 포함하지 않습니다.',
      byType: items.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        target: d.targetCount,
        verified: d.completedCount,
        status: d.status,
        dueDate: d.dueDate,
        substitutionStatus: d.substitutionStatus,
      })),
    };
  },

  /** 기한이 지난 미이행 항목 알림 (OPS-03) */
  async notifyOverdue() {
    const overdue = await prisma.deliverable.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ['PENDING', 'IN_PROGRESS', 'REJECTED'] },
      },
      select: { id: true, title: true, athleteId: true },
      take: 200,
    });
    for (const d of overdue) {
      await this.notifyAthlete(d.athleteId, '이행 기한 경과', `${d.title} 항목의 이행 기한이 지났습니다.`, d.id);
    }
    if (overdue.length > 0) console.log(`[Deliverable] 기한 경과 알림 ${overdue.length}건`);
    return overdue.length;
  },

  async notifyAthlete(athleteId: string, title: string, message: string, deliverableId: string) {
    try {
      const a = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { userId: true } });
      if (!a) return;
      await notificationService.create({
        userId: a.userId,
        type: 'ADMIN_ALERT',
        title,
        message,
        payload: { link: `/athlete/deliverables`, entityType: 'DELIVERABLE', entityId: deliverableId },
      });
    } catch (e) {
      console.error('[Deliverable] 선수 알림 실패:', e);
    }
  },

  async notifyAdmins(title: string, message: string, deliverableId: string) {
    try {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      for (const u of admins) {
        await notificationService.create({
          userId: u.id,
          type: 'ADMIN_ALERT',
          title,
          message,
          payload: { link: `/admin/deliverables`, entityType: 'DELIVERABLE', entityId: deliverableId },
        });
      }
    } catch (e) {
      console.error('[Deliverable] 관리자 알림 실패:', e);
    }
  },
};

export default deliverableService;
