/**
 * 장연주 프로 중복 계정 통합 + 이력 오류 수정
 *
 * 계정 상황
 *  - jangyeonju@sponpik.com : 우리가 만든 계정. 프로필·입상 16건·슬롯 1개·추천 노출이 모두 여기 붙어 있음
 *  - jok2684@naver.com      : 본인이 직접 가입(2026-07-28). 프로필 비어 있음
 *
 * 통합 방식: 데이터가 붙어 있는 Athlete 행을 그대로 두고 소유 계정만 본인 계정으로 옮긴다.
 *   (입상·슬롯·경매·인벤토리 참조를 건드리지 않아 가장 안전)
 *   비어 있는 Athlete 행과 placeholder User는 삭제.
 *
 * 이력 수정 근거: 본인이 작성한 엑셀 양식(SPONPIK_선수프로필_정보수집_엑셀양식_장연주.xlsx)
 *   - 소속칸에 자격("2017년 KLPGA 정회원")이 들어가 있던 것을 실제 소속으로 교정
 *   - 대회명 오기 3건 교정: 레드네 투카 챌린시 → 레노마 루키 챌린지 / 셉토투어 → 점프투어
 *   - 소개글의 미검증 팔로워 수치 제거 (LEG-06)
 *
 * 실행: DRY-RUN 기본 / 적용 APPLY=1
 *   APPLY=1 DATABASE_URL=<url> npx ts-node prisma/merge-jang-yeonju.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const REAL_EMAIL = 'jok2684@naver.com'; // 본인 실계정 (유지)
const PLACEHOLDER_EMAIL = 'jangyeonju@sponpik.com'; // 우리가 만든 계정 (삭제)

// 엑셀 원본 기준 교정값
const PROFILE_FIX = {
  affiliation: '퍼스트골프',
  career: '2022 KLPGA 대의원 · 2023 대방건설 골프단 · 2025~ 퍼스트골프 소속 프로 · 짱가골프TV 운영',
  awards: '2017 KLPGA 점프투어 13차전 우승 · 2022 GTOUR 레노마 루키 챌린지 우승 · 2025 홍인규TV 프로는 프로다 제주 삼다수배 우승',
  bio: '168cm · 1998년생 · 2017년 KLPGA 정회원 · 2017 KLPGA 점프투어 13차전 우승 · 2022 GTOUR 레노마 루키 챌린지 우승',
};

// 경기결과 대회명 오기 → 정정 (엑셀 원본 표기 기준)
const EVENT_NAME_FIX: [string, string][] = [
  ['2022 GTOUR 레드네 투카 챌린시', '2022 GTOUR 레노마 루키 챌린지'],
  ['2017 KLPGA 셉토투어 13차전', '2017 KLPGA 점프투어 13차전'],
  ['2017 KLPGA 셉토투어 성공순위', '2017 KLPGA 점프투어 상금순위'],
];

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY — 실제 반영 ###\n' : '### DRY-RUN — 쓰기 안 함 ###\n');

  const real = await prisma.user.findUnique({ where: { email: REAL_EMAIL }, include: { athlete: true } });
  const ph = await prisma.user.findUnique({ where: { email: PLACEHOLDER_EMAIL }, include: { athlete: true } });
  if (!real || !ph?.athlete) {
    console.log(`⚠️ 계정 확인 실패 (real=${!!real}, placeholder=${!!ph?.athlete}) — 중단`);
    return;
  }

  const dataAthleteId = ph.athlete.id; // 데이터가 붙어 있는 행 (유지)
  const emptyAthlete = real.athlete; // 비어 있는 행 (삭제)

  // 안전 확인: 비어 있는 행에 실제 데이터가 없는지
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

  const [slots, results] = await Promise.all([
    prisma.slotInstance.count({ where: { athleteId: dataAthleteId } }),
    prisma.athleteEventResult.count({ where: { athleteId: dataAthleteId } }),
  ]);
  console.log(`유지할 선수행: ${dataAthleteId} (슬롯 ${slots} / 입상 ${results})`);
  console.log(`소유 계정: ${PLACEHOLDER_EMAIL} → ${REAL_EMAIL}\n`);

  console.log('프로필 교정:');
  console.log(`  소속  : ${ph.athlete.affiliation} → ${PROFILE_FIX.affiliation}`);
  console.log(`  경력  : ${ph.athlete.career} → ${PROFILE_FIX.career}`);
  console.log(`  수상  : ${ph.athlete.awards}\n        → ${PROFILE_FIX.awards}`);
  console.log(`  소개글: ${ph.athlete.bio}\n        → ${PROFILE_FIX.bio}\n`);

  console.log('경기결과 대회명 교정 대상:');
  for (const [from, to] of EVENT_NAME_FIX) {
    const n = await prisma.athleteEventResult.count({ where: { athleteId: dataAthleteId, eventName: { contains: from } } });
    console.log(`  ${n}건 | ${from} → ${to}`);
  }

  if (!apply) {
    console.log('\n(dry-run 종료 — 적용하려면 APPLY=1)');
    return;
  }

  // 1) 본인 계정에 붙어 있던 빈 선수행 삭제 (userId 유니크 제약 해제)
  if (emptyAthlete) {
    await prisma.athlete.delete({ where: { id: emptyAthlete.id } });
    console.log('✅ 빈 선수행 삭제');
  }

  // 2) 데이터 선수행의 소유 계정을 본인 계정으로 이전 + 프로필 교정
  await prisma.athlete.update({
    where: { id: dataAthleteId },
    data: { userId: real.id, ...PROFILE_FIX },
  });
  console.log('✅ 소유 계정 이전 + 프로필 교정 완료');

  // 3) 경기결과 대회명 교정
  for (const [from, to] of EVENT_NAME_FIX) {
    const rows = await prisma.athleteEventResult.findMany({
      where: { athleteId: dataAthleteId, eventName: { contains: from } },
      select: { id: true, eventName: true },
    });
    for (const r of rows) {
      await prisma.athleteEventResult.update({
        where: { id: r.id },
        data: { eventName: r.eventName.replace(from, to) },
      });
    }
    if (rows.length) console.log(`✅ 경기결과 ${rows.length}건 교정 — ${to}`);
  }

  // 4) placeholder 계정 삭제
  await prisma.user.delete({ where: { id: ph.id } });
  console.log(`✅ placeholder 계정 삭제 (${PLACEHOLDER_EMAIL})`);

  const check = await prisma.athlete.findMany({
    where: { name: { contains: '장연주' } },
    include: { user: { select: { email: true } } },
  });
  console.log(`\n✨ 통합 완료 — 장연주 선수행 ${check.length}개 / 계정 ${check.map((a: any) => a.user?.email).join(', ')}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
