/**
 * 성과보장프로그램 (핸드오프 v1.0 2026-08-22 §7 · §8)
 *
 * 표현 원칙 (§7.1)
 *  - "매출 보장"·"무조건 환급"으로 설명하지 않는다.
 *    계약서에 합의한 기준을 측정하고, 미달 시 약정된 보완 지원을 제공한다.
 *
 * 규칙
 *  - 계약 시점 정책을 스냅샷으로 복제하고, 이후 정책 변경을 소급하지 않는다 (§8.2).
 *  - 미수집 데이터를 0으로 간주하지 않는다. DATA_PENDING 으로 남긴다 (§7.4).
 *  - 최종 확정 후에는 수정할 수 없다. 정정은 reversal + 새 버전으로 한다 (§8.5).
 *  - 보완지원은 현금 환급·양도 불가이며 원장에 발급·사용·소멸을 기록한다 (§8.4 · §16.4).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86400_000;

/** 진행 흐름 (§7.2) */
export const FLOW_STEPS = [
  { step: 1, code: 'AGREE', label: '기준 합의', desc: '계약서에 성과 기준과 보완 지원 내용을 명확히 합의합니다.' },
  { step: 2, code: 'EXECUTE', label: '실행', desc: '선수(또는 구단)가 합의된 활동을 성실히 실행합니다.' },
  { step: 3, code: 'MEASURE', label: '측정', desc: '합의된 지표를 기준으로 데이터를 수집하고 성과를 측정합니다.' },
  { step: 4, code: 'JUDGE', label: '판정', desc: '계약서에 따른 기준 달성 여부를 객관적으로 판정합니다.' },
  { step: 5, code: 'REMEDY', label: '보완 지원', desc: '미달 시 계약에 약정된 보완 지원을 신속히 제공합니다.' },
] as const;

/** 판정 상태 (§8.3) */
export const JUDGE_STATUS = [
  { code: 'NOT_APPLICABLE', label: '비적용', desc: '성과보장이 적용되지 않는 상품입니다', tone: 'slate' },
  { code: 'ELIGIBLE', label: '적용 대상', desc: '자격을 충족했으며 계약 전 단계입니다', tone: 'slate' },
  { code: 'ACTIVE', label: '실행 중', desc: '계약이 집행되고 있습니다', tone: 'sky' },
  { code: 'MEASURING', label: '측정 중', desc: '집행이 끝나 데이터를 측정하고 있습니다', tone: 'sky' },
  { code: 'DATA_PENDING', label: '데이터 대기', desc: '필수 데이터 수집을 기다리는 중입니다', tone: 'amber' },
  { code: 'MET', label: '기준 달성', desc: '약정한 기준을 달성했습니다', tone: 'emerald' },
  { code: 'NOT_MET', label: '기준 미달', desc: '약정한 기준에 미치지 못했습니다', tone: 'rose' },
  { code: 'REMEDY_ELIGIBLE', label: '보완지원 대상', desc: '보완 지원을 받을 수 있습니다', tone: 'violet' },
  { code: 'REMEDY_ISSUED', label: '보완지원 발급', desc: '보완 지원이 발급되었습니다', tone: 'violet' },
  { code: 'APPEALED', label: '이의제기 중', desc: '이의제기가 접수되어 재검토 중입니다', tone: 'amber' },
  { code: 'FINAL', label: '최종 확정', desc: '결과가 최종 확정되었습니다', tone: 'slate' },
] as const;

/** 제외·면책 사유 (§7.2 6) */
export const EXCLUSIONS = [
  { code: 'ATHLETE_INJURY', label: '선수의 부상·질병·징계 등 불가항력적 사유' },
  { code: 'SCHEDULE_CHANGE', label: '구단·리그·방송사 사정으로 인한 경기/일정 변경 및 취소' },
  { code: 'BRAND_DELAY', label: '브랜드의 귀책 사유로 인한 실행 지연 또는 중단' },
  { code: 'FALSE_INFO', label: '부정확한 정보 제공 또는 계약 위반이 발생한 경우' },
  { code: 'FORCE_MAJEURE', label: '천재지변 등 불가항력' },
] as const;

/** 이의제기 증빙 유형 (IU07) */
export const EVIDENCE_TYPES = [
  { code: 'CONTENT_LOG', label: '콘텐츠 및 업로드 내역' },
  { code: 'AD_PROOF', label: '광고 집행 및 노출 증빙' },
  { code: 'EXTERNAL_CAUSE', label: '외부 요인 증빙 (정책 변경, 계정 이슈 등)' },
  { code: 'ETC', label: '기타 (직접 입력)' },
] as const;

export const FAQ = [
  {
    q: '성과 기준은 누가, 어떻게 정하나요?',
    a: '브랜드 목표와 선수 활동을 바탕으로 SPONPIK이 기준안을 제안하고, 계약서에 브랜드·선수가 함께 합의한 값만 기준이 됩니다.',
  },
  {
    q: '성과는 어떻게 측정하고 판정하나요?',
    a: '계약에 명시된 데이터 출처(방송 모니터링, 공식 계정 인사이트 등)로 측정하며, 판정식(모든 KPI 충족 / 가중 합산)도 계약 시점에 고정됩니다.',
  },
  {
    q: '보완 지원은 어떤 방식으로 제공되나요?',
    a: '현금 환급이 아니라 차기 후원 진행 시 사용할 수 있는 지원입니다. 지원 비율·상한·사용기한은 계약서에 명시됩니다.',
  },
  {
    q: '모든 상품에 자동으로 적용되나요?',
    a: '아니요. 추천 PICK 패키지와 상세에 보장 적용 표시가 있는 상품에만 적용됩니다.',
  },
];

const statusMeta = (code: string) =>
  JUDGE_STATUS.find((s) => s.code === code) ?? JUDGE_STATUS[0];

/* ── 공개 정책 (§7.2 · IU05) ────────────────────────── */

export async function getPublicPolicy() {
  const policy = await prisma.guaranteePolicy.findFirst({
    where: { status: 'ACTIVE' }, orderBy: { effectiveFrom: 'desc' },
  });

  const eligibleOffers = await prisma.offer.count({
    where: { status: { in: ['PUBLISHED', 'LOW_STOCK'] } },
  }).catch(() => 0);

  return {
    hero: {
      title: '약속한 활동과 성과 기준을 확인하고, 미달 시 보완 지원까지.',
      desc: '매출을 보장하는 제도가 아니라, 계약서에 합의한 기준을 측정하고 약정된 보완 지원을 제공하는 프로그램입니다.',
    },
    policy: policy
      ? {
          version: policy.version,
          summary: policy.summary,
          eligibleProductTypes: policy.eligibleProductTypes,
          judgeMode: policy.judgeMode,
          minScore: policy.minScore,
          appealWindowDays: policy.appealWindowDays,
          remedyRules: policy.remedyRules,
          effectiveFrom: policy.effectiveFrom,
          /* KPI 예시는 정책의 metricRules 를 그대로 보여준다 */
          metricRules: policy.metricRules,
        }
      : null,
    policyMissing: !policy
      ? '공개된 성과보장 정책 버전이 아직 없습니다. 정책이 발행되면 이곳에 표시됩니다.'
      : null,
    flow: FLOW_STEPS,
    exclusions: EXCLUSIONS,
    faq: FAQ,
    eligibleOffers,
    disclaimers: [
      'KPI와 기준, 측정 방법과 출처는 계약 상품에 따라 다를 수 있으며, 모든 내용은 계약서에 명시됩니다.',
      '보완 지원은 현금 환급이 아니며, 차기 후원 시 사용할 수 있는 지원입니다.',
      '보완 지원은 계약 브랜드에 한해 사용 가능하며 타 브랜드로 양도할 수 없습니다.',
    ],
    cta: [
      { label: '적용 상품 확인', to: '/sponsor/available?guarantee=1' },
      { label: '내 계약 결과 보기', to: '/about/my-guarantees', requiresLogin: true },
    ],
  };
}

/* ── 브랜드: 내 보장 현황 (IU06 · §7.3) ─────────────── */

function shapeObservation(o: any) {
  const pct = o.actual !== null && o.actual !== undefined && o.target > 0
    ? Math.round((o.actual / o.target) * 1000) / 10
    : null;
  return {
    metricCode: o.metricCode,
    label: o.label,
    target: o.target,
    actual: o.actual,
    unit: o.unit,
    weight: o.weight,
    required: o.required,
    /* 미수집을 0%로 만들지 않는다 (§7.4) */
    achievementRate: o.collectStatus === 'PENDING' ? null : pct,
    collectStatus: o.collectStatus,
    collectLabel: o.collectStatus === 'PENDING' ? '집계 중' : o.collectStatus === 'VERIFIED' ? '검증 완료' : '수집 완료',
    judgement: o.judgement,
    provisional: o.provisional,
    sourceName: o.sourceName,
    nextCheckAt: o.nextCheckAt,
    excludeReason: o.excludeReason,
  };
}

function shapeSnapshot(s: any) {
  const meta = statusMeta(s.status);
  const obs = (s.observations ?? []).map(shapeObservation);
  return {
    id: s.id,
    policyVersion: s.policyVersion,
    contractId: s.contractId,
    brandName: s.brandName,
    athleteName: s.athleteName,
    contractAmount: s.contractAmount,
    status: s.status,
    statusLabel: meta.label,
    statusDesc: meta.desc,
    statusTone: meta.tone,
    judgeMode: s.judgeMode,
    judgeModeLabel: s.judgeMode === 'ALL' ? '모든 필수 KPI 충족' : s.judgeMode === 'ANY' ? '하나만 충족' : '가중 합산',
    minScore: s.minScore,
    measureStart: s.measureStart,
    measureEnd: s.measureEnd,
    appealWindowDays: s.appealWindowDays,
    appealDueAt: s.finalizedAt ? new Date(+s.finalizedAt + s.appealWindowDays * DAY) : null,
    observations: obs,
    /* 잠정 수치가 하나라도 있으면 화면에서 배지로 알린다 (§7.4) */
    provisional: obs.some((o: any) => o.provisional),
    hasPending: obs.some((o: any) => o.collectStatus === 'PENDING'),
    remedyRules: s.remedyRules,
    finalizedAt: s.finalizedAt,
    locked: !!s.lockedAt,
  };
}

export async function getMyGuarantees(brandId: string) {
  const rows = await prisma.guaranteeSnapshot.findMany({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
    include: {
      observations: { orderBy: { metricCode: 'asc' } },
      appeals: { orderBy: { createdAt: 'desc' } },
      remedies: { orderBy: { createdAt: 'desc' } },
    },
  });

  const counts = {
    applied: rows.length,
    measuring: rows.filter((r) => ['ACTIVE', 'MEASURING', 'DATA_PENDING'].includes(r.status)).length,
    finalized: rows.filter((r) => ['MET', 'NOT_MET', 'FINAL', 'REMEDY_ISSUED'].includes(r.status)).length,
  };

  const remedies = rows.flatMap((r) => r.remedies);
  const usable = remedies.filter((g) => ['ISSUED', 'PARTIALLY_USED'].includes(g.status));

  return {
    counts,
    snapshots: rows.map((s) => ({
      ...shapeSnapshot(s),
      appeals: s.appeals.map((a) => ({
        id: a.id, code: a.code, status: a.status, createdAt: a.createdAt,
        decisionType: a.decisionType, decidedAt: a.decidedAt,
      })),
      remedies: s.remedies.map(shapeRemedy),
    })),
    remedySummary: {
      usableCount: usable.length,
      usableAmount: usable.reduce((sum, g) => sum + (g.issuedAmount - g.usedAmount), 0),
      notice: '보완지원은 현금 환급이 아닌, 차기 후원 시 사용할 수 있는 지원입니다.',
    },
    emptyGuide: rows.length === 0
      ? '성과보장이 적용된 계약이 아직 없습니다. 적용 상품에서 보장 표시를 확인해보세요.'
      : null,
  };
}

function shapeRemedy(g: any) {
  return {
    id: g.id, code: g.code, ratio: g.ratio,
    capAmount: g.capAmount, issuedAmount: g.issuedAmount, usedAmount: g.usedAmount,
    remainAmount: g.issuedAmount - g.usedAmount,
    status: g.status,
    statusLabel: ({
      RESERVED: '발급 예정', ISSUED: '사용 가능', PARTIALLY_USED: '일부 사용',
      USED: '사용 완료', EXPIRED: '기한 만료', CANCELLED: '취소',
    } as any)[g.status] ?? g.status,
    validFrom: g.validFrom, validTo: g.validTo,
    cashRefund: false,
    transferable: false,
  };
}

/* ── 이의제기 (IU07 · §7.3) ─────────────────────────── */

export async function getAppealContext(snapshotId: string, brandId: string) {
  const s = await prisma.guaranteeSnapshot.findFirst({
    where: { id: snapshotId, brandId },
    include: { observations: true, appeals: true, remedies: true, policy: true },
  });
  if (!s) return null;

  const shaped = shapeSnapshot(s);
  const failed = s.observations.filter((o) => o.judgement === 'NOT_MET');
  const rules: any = s.remedyRules ?? {};

  const dueAt = s.finalizedAt ? new Date(+s.finalizedAt + s.appealWindowDays * DAY) : null;
  const remainDays = dueAt ? Math.ceil((+dueAt - Date.now()) / DAY) : null;

  return {
    snapshot: shaped,
    /* 미달 사유를 그대로 보여준다. 추정하지 않는다 */
    failedMetrics: failed.map((o) => ({
      label: o.label, target: o.target, actual: o.actual, unit: o.unit,
      summary: o.actual !== null
        ? `${o.label} 목표 ${o.target}${o.unit} / 실적 ${o.actual}${o.unit}`
        : `${o.label} 실적 미수집`,
    })),
    canAppeal: !!dueAt && (remainDays ?? 0) > 0 && !s.appeals.some((a) => ['RECEIVED', 'UNDER_REVIEW'].includes(a.status)),
    appealDueAt: dueAt,
    appealRemainDays: remainDays,
    existingAppeals: s.appeals.map((a) => ({
      id: a.id, code: a.code, status: a.status, createdAt: a.createdAt,
      decisionType: a.decisionType, decisionNote: a.decisionNote,
    })),
    evidenceTypes: EVIDENCE_TYPES,
    /* 예상 보완지원 — 계약 스냅샷의 규칙으로만 계산한다 */
    remedyEstimate: s.status === 'NOT_MET' || s.status === 'REMEDY_ELIGIBLE'
      ? {
          ratio: rules.ratio ?? null,
          capAmount: rules.cap ?? null,
          validMonths: rules.validMonths ?? null,
          estimatedAmount: rules.ratio && s.contractAmount
            ? Math.min(Math.floor(s.contractAmount * (rules.ratio / 100)), rules.cap ?? Number.MAX_SAFE_INTEGER)
            : null,
          basis: '계약서상 성과보장 한도 내 · 계약금액 기준',
        }
      : null,
    process: [
      { code: 'RECEIVED', label: '접수', desc: '이의제기 접수' },
      { code: 'UNDER_REVIEW', label: '검토', desc: '내부 검토 (최대 7영업일)' },
      { code: 'DECIDED', label: '결정', desc: '결과 안내' },
      { code: 'SUPPORT_ISSUED', label: '지원 발급', desc: '보완지원 발급 및 안내' },
    ],
    notices: [
      '보완지원은 현금 환급이 아닌, 차기 후원 시 사용할 수 있는 지원입니다.',
      '보완지원은 계약 브랜드에 한해 사용 가능하며, 타 브랜드로 양도할 수 없습니다.',
      '허위 제출 시 서비스 이용 제한 및 법적 책임이 발생할 수 있습니다.',
    ],
  };
}

export async function submitAppeal(input: {
  snapshotId: string; brandId: string; brandUserId: string;
  reason: string; evidenceTypes?: string[]; attachments?: any; attested: boolean;
}) {
  if (!input.attested) {
    throw Object.assign(new Error('제출 내용이 사실임을 확인해주세요'), { status: 400 });
  }
  const reason = (input.reason || '').trim();
  if (reason.length < 10) throw Object.assign(new Error('이의 사유를 10자 이상 입력해주세요'), { status: 400 });
  if (reason.length > 1000) throw Object.assign(new Error('1,000자 이내로 입력해주세요'), { status: 400 });

  const s = await prisma.guaranteeSnapshot.findFirst({
    where: { id: input.snapshotId, brandId: input.brandId },
  });
  if (!s) throw Object.assign(new Error('대상 계약을 찾을 수 없습니다'), { status: 404 });
  if (!s.finalizedAt) {
    throw Object.assign(new Error('판정이 확정된 뒤에 이의제기를 할 수 있습니다'), { status: 400, code: 'NOT_FINALIZED' });
  }

  const dueAt = new Date(+s.finalizedAt + s.appealWindowDays * DAY);
  if (dueAt < new Date()) {
    throw Object.assign(new Error('이의제기 기간이 지났습니다'), { status: 400, code: 'WINDOW_CLOSED' });
  }

  const dup = await prisma.guaranteeAppeal.findFirst({
    where: { snapshotId: s.id, status: { in: ['RECEIVED', 'UNDER_REVIEW'] } },
  });
  if (dup) throw Object.assign(new Error('이미 접수된 이의제기가 처리 중입니다'), { status: 409, code: 'DUPLICATE' });

  const seq = await prisma.guaranteeAppeal.count();
  const appeal = await prisma.guaranteeAppeal.create({
    data: {
      code: `OB-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`,
      snapshotId: s.id,
      brandUserId: input.brandUserId,
      reason,
      evidenceTypes: input.evidenceTypes ?? [],
      attachments: input.attachments ?? undefined,
      attested: true,
      status: 'RECEIVED',
      /* 검토 SLA 7영업일 ≈ 달력 10일 */
      slaDueAt: new Date(Date.now() + 10 * DAY),
    },
  });

  await prisma.guaranteeSnapshot.update({ where: { id: s.id }, data: { status: 'APPEALED' } });

  return {
    appeal: { id: appeal.id, code: appeal.code, status: appeal.status, slaDueAt: appeal.slaDueAt },
    message: '이의제기가 접수되었습니다. 내부 검토 후 결과를 안내드립니다.',
  };
}

/* ── 판정 엔진 (§8.3 · §8.5) ────────────────────────── */

/**
 * 관측치로 자동 예비 판정을 만든다. 저장하지 않는다.
 * 필수 데이터가 하나라도 미수집이면 DATA_PENDING 이다 (§7.4 · QA G-03).
 */
export function evaluate(snapshot: {
  judgeMode: string; minScore?: number | null;
}, observations: any[]) {
  const active = observations.filter((o) => o.judgement !== 'EXCLUDED');
  const required = active.filter((o) => o.required);

  const pending = required.filter((o) => o.actual === null || o.actual === undefined || o.collectStatus === 'PENDING');
  if (pending.length) {
    return {
      status: 'DATA_PENDING' as const,
      reason: `필수 지표 ${pending.length}건의 데이터가 아직 수집되지 않았습니다`,
      pending: pending.map((o) => o.label),
      score: null,
    };
  }

  const met = (o: any) => (o.actual ?? 0) >= o.target;

  if (snapshot.judgeMode === 'ANY') {
    const ok = required.some(met);
    return { status: ok ? 'MET' as const : 'NOT_MET' as const, reason: ok ? '하나 이상의 필수 KPI를 달성했습니다' : '충족한 필수 KPI가 없습니다', score: null, pending: [] };
  }

  if (snapshot.judgeMode === 'WEIGHTED') {
    const totalWeight = active.reduce((s, o) => s + (o.weight ?? 0), 0);
    if (totalWeight <= 0) {
      return { status: 'DATA_PENDING' as const, reason: '가중치가 설정되지 않았습니다', score: null, pending: [] };
    }
    const score = active.reduce((s, o) => {
      const rate = o.target > 0 ? Math.min(1.5, (o.actual ?? 0) / o.target) : 0;
      return s + rate * (o.weight ?? 0);
    }, 0) / totalWeight * 100;
    const rounded = Math.round(score * 10) / 10;
    const min = snapshot.minScore ?? 80;
    return {
      status: rounded >= min ? 'MET' as const : 'NOT_MET' as const,
      reason: `가중 합산 달성 ${rounded}% / 최소 기준 ${min}%`,
      score: rounded,
      pending: [],
    };
  }

  /* ALL — 모든 필수 KPI 충족 */
  const failed = required.filter((o) => !met(o));
  return {
    status: failed.length === 0 ? 'MET' as const : 'NOT_MET' as const,
    reason: failed.length === 0
      ? '모든 필수 KPI를 달성했습니다'
      : `필수 KPI ${failed.length}건이 기준에 미달했습니다 (${failed.map((f) => f.label).join(', ')})`,
    score: null,
    pending: [],
  };
}
