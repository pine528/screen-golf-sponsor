/**
 * 중복 선수 통합: 박현주 / 강채린
 * - 본인 실제 이메일 계정(KEEP)에 sponpik 계정(DROP)의 프로필+입상내역을 이전
 * - 기존 height 등 비-null 값은 보존 (height는 update에서 제외)
 * - DROP 계정(Athlete + User) 삭제
 *
 * 실행: DATABASE_URL=<railway_url> npx ts-node prisma/merge-duplicates.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MERGES = [
  {
    name: '박현주',
    keepEmail: 'eee4330@naver.com',
    dropEmail: 'parkhyunju@sponpik.com',
    profile: {
      tour: 'KLPGA',
      bio: '1996년생 · KLPGA 준회원(회원번호 1530) · GTOUR 입회 2012 · 레슨 11년차 · 2017 GTOUR 상금랭킹 2위 · 2017 롯데렌터카 WGTOUR 4차·챔피언십 우승. 골프 크리에이터/레슨프로(유튜브 박푸로)',
      profileImageUrl: '/golfers/park-hyunju.jpg',
      socialLinks: { instagram: 'hyun._.juuuu', youtube: '박푸로', tiktok: 'hjttgolf' },
      primarySponsors: [] as string[],
      region: '경기도 파주시 운정신도시',
      debutYear: 2012,
      affiliation: '파주 청해골프',
      sportType: 'GOLF',
    },
  },
  {
    name: '강채린',
    keepEmail: 'happycl001@naver.com',
    dropEmail: 'kangchaerin@sponpik.com',
    profile: {
      tour: 'KLPGA',
      bio: '2001년생 · 2022년 KLPGA 정회원(회원번호 1530) · WGTOUR 2026 루키 · 중앙대학교 골프전공 수석 졸업 · 미즈노/브리지스톤 계약, 탱크샤프트 후원',
      profileImageUrl: '/golfers/kang-chaerin.png',
      socialLinks: {} as Record<string, string>,
      primarySponsors: ['미즈노', '브리지스톤', '탱크샤프트'] as string[],
      region: null as string | null,
      debutYear: 2022,
      affiliation: null as string | null,
      sportType: 'GOLF',
    },
  },
];

async function main() {
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });

  for (const m of MERGES) {
    console.log(`\n=== ${m.name} 통합 ===`);
    const keepUser = await prisma.user.findUnique({ where: { email: m.keepEmail }, include: { athlete: true } });
    const dropUser = await prisma.user.findUnique({ where: { email: m.dropEmail }, include: { athlete: true } });
    if (!keepUser?.athlete || !dropUser?.athlete) {
      console.log(`  ⚠️ 계정 누락 (keep=${!!keepUser?.athlete}, drop=${!!dropUser?.athlete}) — 스킵`);
      continue;
    }
    const keepId = keepUser.athlete.id;
    const dropId = dropUser.athlete.id;

    // 1) 입상내역 이전 (drop → keep). 기존 keep의 MANUAL 결과는 정리 후 이전.
    await prisma.athleteEventResult.deleteMany({ where: { athleteId: keepId, source: { in: ['MANUAL', 'GTOUR_API'] } } });
    const moved = await prisma.athleteEventResult.updateMany({ where: { athleteId: dropId }, data: { athleteId: keepId } });
    console.log(`  입상내역 ${moved.count}건 이전`);

    // 2) keep 레코드에 프로필 적용 (height는 보존 위해 제외)
    await prisma.athlete.update({
      where: { id: keepId },
      data: {
        tour: m.profile.tour,
        bio: m.profile.bio,
        profileImageUrl: m.profile.profileImageUrl,
        socialLinks: m.profile.socialLinks as any,
        primarySponsors: m.profile.primarySponsors as any,
        region: m.profile.region,
        debutYear: m.profile.debutYear,
        affiliation: m.profile.affiliation,
        sportType: m.profile.sportType,
        sportId: golfSport?.id ?? null,
        kycStatus: 'APPROVED',
        isActive: true,
      },
    });
    console.log(`  프로필 적용 (keep id=${keepId.slice(0, 8)}, height 보존=${keepUser.athlete.height ?? '없음'})`);

    // 3) drop 계정 삭제 (Athlete 먼저 → User)
    await prisma.athlete.delete({ where: { id: dropId } });
    await prisma.user.delete({ where: { id: dropUser.id } });
    console.log(`  중복 계정 삭제 (drop id=${dropId.slice(0, 8)}, email=${m.dropEmail})`);
  }

  const total = await prisma.athlete.count();
  console.log(`\n✨ 통합 완료. 현재 선수 수: ${total}명`);
}

main()
  .catch((e) => { console.error('❌ 통합 실패:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
