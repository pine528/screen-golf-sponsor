import { PrismaClient } from '@prisma/client';
import { proposalService } from '../src/services/proposal.service';
const p = new PrismaClient();

async function main() {
  const brand = (await p.brand.findFirst({ include: { user: true } }))!;
  const athlete = (await p.athlete.findFirst({ where: { isActive: true, kycStatus: 'APPROVED' }, include: { user: true } }))!;
  console.log(`브랜드=${brand.name} 선수=${athlete.name}`);

  const base = {
    athleteId: athlete.id, durationType: 'MONTHS_12',
    startDate: '2026-10-01', endDate: '2027-09-30',
    totalBudget: 50000000, minAppearances: 12,
    imageUsageScope: '온라인·매장', imageUsageMonths: 12, categoryExclusive: true,
    brandNote: '연간 파트너십 희망',
  };

  // 1) 6/12개월 외 기간 차단
  try { await proposalService.create(brand.id, { ...base, durationType: 'SINGLE_EVENT' }); console.log('① ❌ 단일출전 제안이 생성됨'); }
  catch (e: any) { console.log('① ✅ 단일출전 제안 차단 —', e.message); }

  // 2) 잘못된 기간 차단
  try { await proposalService.create(brand.id, { ...base, startDate: '2027-01-01', endDate: '2026-01-01' }); console.log('② ❌ 역순 기간 허용됨'); }
  catch (e: any) { console.log('② ✅ 기간 검증 —', e.message); }

  // 3) 정상 생성 → 제출
  const prop = await proposalService.create(brand.id, base);
  console.log(`③ ✅ 제안 생성 (${prop.status})`);
  await proposalService.update(prop.id, brand.id, { totalBudget: 60000000 });
  await proposalService.submit(prop.id, brand.id, brand.userId);
  let cur = await p.proposal.findUnique({ where: { id: prop.id } });
  console.log(`④ ✅ 제출 → ${cur!.status} (만료 ${cur!.expiresAt?.toISOString().slice(0,10)})`);

  // 4) 잘못된 전이 차단 (관리자 검토 → 계약완료 점프)
  try {
    await proposalService.transition(prop.id, 'CONTRACTED', { id: 'admin', role: 'ADMIN' });
    console.log('⑤ ❌ 비정상 전이 허용됨');
  } catch (e: any) { console.log('⑤ ✅ 비정상 전이 차단 —', e.message); }

  // 5) 권한 차단 (브랜드가 스스로 승인)
  await proposalService.transition(prop.id, 'ATHLETE_REVIEW', { id: 'admin', role: 'ADMIN' });
  try {
    await proposalService.transition(prop.id, 'APPROVED', { id: brand.userId, role: 'BRAND', brandId: brand.id });
    console.log('⑥ ❌ 브랜드가 자기 제안을 승인함');
  } catch (e: any) { console.log('⑥ ✅ 권한 차단 —', e.message); }

  // 6) 선수 승인 → 계약 진행
  await proposalService.transition(prop.id, 'APPROVED', { id: athlete.userId, role: 'ATHLETE', athleteId: athlete.id }, '조건 동의');
  await proposalService.convertToContract(prop.id, 'admin');
  cur = await p.proposal.findUnique({ where: { id: prop.id } });
  console.log(`⑦ ✅ 선수 승인 → ${cur!.status}`);

  // 7) 이력 확인
  const hist = await p.proposalHistory.findMany({ where: { proposalId: prop.id }, orderBy: { createdAt: 'asc' } });
  console.log('⑧ 이력:', hist.map(h => `${h.fromStatus ?? '-'}→${h.toStatus}`).join(' / '));
  const changed = hist.find(h => h.changes);
  console.log('   변경기록:', changed ? JSON.stringify(changed.changes) : '없음');

  // 8) 만료 처리
  const p2 = await proposalService.create(brand.id, base);
  await proposalService.submit(p2.id, brand.id, brand.userId);
  await p.proposal.update({ where: { id: p2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const n = await proposalService.expireOverdue();
  const after = await p.proposal.findUnique({ where: { id: p2.id } });
  console.log(`⑨ ✅ 만료 처리 ${n}건 → ${after!.status}`);

  // 정리
  await p.proposal.deleteMany({ where: { id: { in: [prop.id, p2.id] } } });
  console.log('정리 완료');
}
main().catch(e => console.error('ERR', e.message)).finally(() => p.$disconnect());
