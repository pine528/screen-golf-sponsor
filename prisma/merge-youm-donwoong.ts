/**
 * 염돈웅 프로 중복 계정 통합
 *
 * 계정 상황 (2026-07-29 운영 확인)
 *  - youmdonwoong@sponpik.com : 우리가 만든 계정. 프로필·이력·수상·사진·슬롯이 모두 여기 붙어 있음 (KYC 승인)
 *  - duaehsdnd@naver.com      : 본인이 직접 가입(2026-07-29). 프로필 비어 있음 (KYC 미제출, 투어 GTOUR)
 *
 * 통합 방식: 데이터가 붙어 있는 Athlete 행을 그대로 두고 소유 계정만 본인 계정으로 옮긴다.
 *   (슬롯·경매·입상·인벤토리 참조를 건드리지 않아 가장 안전)
 *   비어 있는 Athlete 행과 우리가 만든 placeholder User는 삭제.
 *
 * 안전장치: 본인 계정에 붙은 빈 선수행에 슬롯/입상/계약이 하나라도 있으면 자동 통합을 중단한다.
 *
 * 실행: DRY-RUN 기본 / 적용은 APPLY=1
 *   DATABASE_URL=<운영 URL> npx ts-node --transpile-only prisma/merge-youm-donwoong.ts
 *   APPLY=1 DATABASE_URL=<운영 URL> npx ts-node --transpile-only prisma/merge-youm-donwoong.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const REAL_EMAIL = 'duaehsdnd@naver.com';           // 본인 실계정 (유지)
const PLACEHOLDER_EMAIL = 'youmdonwoong@sponpik.com'; // 우리가 만든 계정 (삭제)
const NAME = '염돈웅';

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY — 실제 반영 ###\n' : '### DRY-RUN — 쓰기 안 함 ###\n');

  const real = await prisma.user.findUnique({ where: { email: REAL_EMAIL }, include: { athlete: true } });
  const ph = await prisma.user.findUnique({ where: { email: PLACEHOLDER_EMAIL }, include: { athlete: true } });
  if (!real || !ph?.athlete) {
    console.log(`⚠️ 계정 확인 실패 (본인계정=${!!real}, 데이터계정=${!!ph?.athlete}) — 중단`);
    return;
  }

  const dataAthleteId = ph.athlete.id; // 데이터가 붙어 있는 행 (유지)
  const emptyAthlete = real.athlete;   // 본인 가입으로 생긴 빈 행 (삭제)

  // 빈 행에 실제 데이터가 없는지 확인
  if (emptyAthlete) {
    const [slots, results, contracts] = await Promise.all([
      prisma.slotInstance.count({ where: { athleteId: emptyAthlete.id } }),
      prisma.athleteEventResult.count({ where: { athleteId: emptyAthlete.id } }),
      prisma.contract.count({ where: { athleteId: emptyAthlete.id } }),
    ]);
    console.log(`본인 계정에 붙은 빈 선수행: 슬롯 ${slots} / 입상 ${results} / 계약 ${contracts}`);
    if (slots + results + contracts > 0) {
      console.log('⛔ 빈 행에 데이터가 있어 자동 통합을 중단합니다 (수동 확인 필요)');
      return;
    }
  }

  const [slots, results, contracts] = await Promise.all([
    prisma.slotInstance.count({ where: { athleteId: dataAthleteId } }),
    prisma.athleteEventResult.count({ where: { athleteId: dataAthleteId } }),
    prisma.contract.count({ where: { athleteId: dataAthleteId } }),
  ]);
  console.log(`유지할 선수행: ${dataAthleteId}`);
  console.log(`  슬롯 ${slots} / 입상 ${results} / 계약 ${contracts}`);
  console.log(`  투어 ${ph.athlete.tour} · 소속 ${ph.athlete.affiliation ?? '-'} · KYC ${ph.athlete.kycStatus}`);
  console.log(`소유 계정 이전: ${PLACEHOLDER_EMAIL} → ${REAL_EMAIL}\n`);

  if (!apply) {
    console.log('(dry-run 종료 — 적용하려면 APPLY=1)');
    return;
  }

  // 1) 본인 계정에 붙어 있던 빈 선수행 삭제 (Athlete.userId 유니크 제약 해제)
  if (emptyAthlete) {
    await prisma.athlete.delete({ where: { id: emptyAthlete.id } });
    console.log('✅ 빈 선수행 삭제');
  }

  // 2) 데이터 선수행의 소유 계정을 본인 계정으로 이전
  await prisma.athlete.update({ where: { id: dataAthleteId }, data: { userId: real.id } });
  console.log('✅ 소유 계정 이전 완료');

  // 3) placeholder 계정 삭제
  await prisma.user.delete({ where: { id: ph.id } });
  console.log(`✅ placeholder 계정 삭제 (${PLACEHOLDER_EMAIL})`);

  const check = await prisma.athlete.findMany({
    where: { name: { contains: NAME } },
    include: { user: { select: { email: true } } },
  });
  console.log(`\n✨ 통합 완료 — ${NAME} 선수행 ${check.length}개 / 계정 ${check.map((a: any) => a.user?.email).join(', ')}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
