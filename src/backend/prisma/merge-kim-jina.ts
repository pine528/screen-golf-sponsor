/**
 * 김진아2 중복 계정 통합
 * - KEEP: 본인 실계정 jina3564@naver.com (직접 가입, 프로필 비어있음)
 * - DROP: 우리가 만든 placeholder kimjina2@sponpik.com (프로필 + 입상 9건)
 * - DROP의 전체 프로필 + 입상내역을 KEEP으로 이전 후 DROP(Athlete+User) 삭제
 *
 * 실행:
 *   DRY-RUN: DATABASE_URL=<url> npx ts-node prisma/merge-kim-jina.ts
 *   적용:    APPLY=1 DATABASE_URL=<url> npx ts-node prisma/merge-kim-jina.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const KEEP_EMAIL = 'jina3564@naver.com';
const DROP_EMAIL = 'kimjina2@sponpik.com';

// DROP에서 KEEP으로 복사할 프로필 필드 (값 그대로 이전)
const COPY_FIELDS = [
  'name', 'tour', 'bio', 'profileImageUrl', 'socialLinks', 'primarySponsors',
  'blockedCategories', 'height', 'region', 'debutYear', 'affiliation',
  'education', 'awards', 'career', 'sportType', 'sportId',
] as const;

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY — 실제 통합 ###' : '### DRY-RUN — 쓰기 안 함 ###\n');

  const keep = await prisma.user.findUnique({ where: { email: KEEP_EMAIL }, include: { athlete: true } });
  const drop = await prisma.user.findUnique({ where: { email: DROP_EMAIL }, include: { athlete: true } });
  if (!keep?.athlete || !drop?.athlete) {
    console.log(`⚠️ 계정 누락 (keep=${!!keep?.athlete}, drop=${!!drop?.athlete}) — 중단`);
    return;
  }
  const keepId = keep.athlete.id;
  const dropId = drop.athlete.id;
  console.log('KEEP:', KEEP_EMAIL, keepId);
  console.log('DROP:', DROP_EMAIL, dropId, '\n');

  // 복사할 프로필 데이터 구성 (drop의 현재 값)
  const d: any = drop.athlete;
  const data: any = { kycStatus: 'APPROVED', isActive: true };
  for (const f of COPY_FIELDS) data[f] = d[f];

  console.log('복사할 프로필:');
  console.log('  소속:', data.affiliation || '-');
  console.log('  학력:', data.education || '-');
  console.log('  수상:', data.awards || '-');
  console.log('  경력:', data.career || '-');
  console.log('  키/입회:', data.height, '/', data.debutYear, '| 사진:', data.profileImageUrl);

  const resCount = await prisma.athleteEventResult.count({ where: { athleteId: dropId } });
  console.log(`\n이전할 입상내역: ${resCount}건`);

  if (!apply) {
    console.log('\n(dry-run 종료 — 적용하려면 APPLY=1)');
    return;
  }

  // 1) KEEP의 기존 MANUAL/GTOUR 결과 정리 후 DROP 결과 이전
  await prisma.athleteEventResult.deleteMany({ where: { athleteId: keepId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
  const moved = await prisma.athleteEventResult.updateMany({ where: { athleteId: dropId }, data: { athleteId: keepId } });
  console.log(`✅ 입상내역 ${moved.count}건 이전`);

  // 2) KEEP에 프로필 적용
  await prisma.athlete.update({ where: { id: keepId }, data });
  console.log('✅ 프로필 적용 + KYC 승인/활성화');

  // 3) DROP 삭제 (Athlete → User)
  await prisma.athlete.delete({ where: { id: dropId } });
  await prisma.user.delete({ where: { id: drop.id } });
  console.log(`✅ DROP 계정 삭제 (${DROP_EMAIL})`);

  const total = await prisma.athlete.count();
  console.log(`\n✨ 통합 완료. 현재 선수 수: ${total}명`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
