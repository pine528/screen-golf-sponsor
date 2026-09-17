/**
 * 실제 프로골퍼 5명 시드 (PDF: 2026년_프로골퍼_리스트_.pdf)
 *
 * - 배진리, 송유나, 오세희, 이예빈, 안예인
 * - User(ATHLETE) + Athlete 프로필 함께 생성 (idempotent: email upsert)
 * - SPONPIK 론칭 4. 권장 데이터 항목: height/region/debutYear/affiliation/sportType 구조화
 *
 * 실행:
 *   로컬: npx ts-node prisma/seed-athletes.ts
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/seed-athletes.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

interface AthleteSeed {
  email: string;
  name: string;
  tour: string;
  bio: string;
  profileImageUrl: string | null;
  socialLinks: Record<string, string>;
  primarySponsors: string[];
  // 구조화 필드 (SPONPIK 4. 권장 데이터 항목)
  height: number;        // cm
  region: string;        // 거주 지역
  debutYear: number;     // 데뷔 연도 (KLPGA 정/준회원)
  affiliation: string | null; // 소속팀/소속사
  sportType: string;     // GOLF / SCREEN_GOLF / ...
  // 추가 메타 (career)
  careerJson: any;
}

const ATHLETES: AthleteSeed[] = [
  {
    email: 'anyein@sponpik.com',
    name: '안예인',
    tour: 'KLPGA',
    bio: '176cm · 1998년생 · 2018년 KLPGA 정회원 · SBSGOLF 골프클리닉 출연. 5.1만 인스타 팔로워',
    profileImageUrl: '/golfers/an-yein.jpeg',
    socialLinks: { instagram: 'yenisfree' },
    primarySponsors: ['SBSGOLF'],
    height: 176,
    region: '경기도 성남시',
    debutYear: 2018,
    affiliation: 'SBSGOLF',
    sportType: 'GOLF',
    careerJson: {
      height: '176cm',
      birthDate: '1998-05-03',
      proSince: '2018년 7월 KLPGA 정회원',
      location: '경기도 성남시',
      followers: '5.1만',
      history: [
        '2026 SBSGOLF 골프클리닉',
        '2023~2025 다수 방송출연',
        '2024 미인큐 방송 진행',
        '2023 다수 유튜브 채널 출연',
        '2023 도레미파 방송 진행',
        '2022 슈퍼루키지 방송 진행',
        '2018 KLPGA 점프투어 4차전 3위',
        '2015 JGAA PHOENIX METRO JUNIOR CHAMPIONSHIP 우승',
        '2015 JGAA NEW YEAR SHOOTOUT 우승',
      ],
    },
  },
  {
    email: 'baejinri@sponpik.com',
    name: '배진리',
    tour: 'KLPGA',
    bio: '170cm · 2001년생 · 2020년 KLPGA 정회원 · WGTOUR 1차 2위. 인스타 @baeaee_',
    profileImageUrl: '/golfers/bae-jinri.jpeg',
    socialLinks: { instagram: 'baeaee_' },
    primarySponsors: [],
    height: 170,
    region: '경기도 하남시',
    debutYear: 2020,
    affiliation: null,
    sportType: 'GOLF',
    careerJson: {
      height: '170cm',
      birthDate: '2001-03-21',
      proSince: '2020년 6월 KLPGA 정회원',
      location: '경기도 하남시',
      followers: '2천',
      history: [
        '2025 WGTOUR 1차 2위',
        '2024 골프존방송 ‘뉴페이스’ 출연',
        '2023 ‘공치는명훈이’,‘심짱골프’ 유튜브 출연',
        '2023 KLPGA 드림투어 5차전 7위',
        '2023 KLPGA 드림투어 3차전 5위',
        '2022 KLPGA 정규투어 활동',
        '2021 KLPGA 톨비스트·휘닉스CC 드림투어 10차전 4위',
      ],
    },
  },
  {
    email: 'songyuna@sponpik.com',
    name: '송유나',
    tour: 'KLPGA',
    bio: '165cm · 1998년생 · 2021년 KLPGA 정회원 · 르꼬끄 골프 앰버서더. 인스타 @_yuna_ssong',
    profileImageUrl: '/golfers/song-yuna.jpeg',
    socialLinks: { instagram: '_yuna_ssong' },
    primarySponsors: ['르꼬끄 골프'],
    height: 165,
    region: '서울 성동구',
    debutYear: 2021,
    affiliation: '르꼬끄 골프',
    sportType: 'GOLF',
    careerJson: {
      height: '165cm',
      birthDate: '1998-03-13',
      proSince: '2021년 6월 KLPGA 정회원',
      location: '서울 성동구',
      followers: '7천',
      history: [
        '2026 르꼬끄 골프 앰버서더',
        '2024 ‘공치는명훈이’ ‘프로타골프’ 유튜브 촬영',
        '2020-2021 KLPGA 투어 활동',
        '2021 KLPGA 그랜드삼대인 점프투어 8차 2위',
        '2019 JDX 골프웨어 의류계약',
        '2016 용인대총장배 우승',
      ],
    },
  },
  {
    email: 'ohsehee@sponpik.com',
    name: '오세희',
    tour: 'KLPGA',
    bio: '168cm · 1998년생 · 2020년 KLPGA 정회원 · 마스터바니 앰버서더 · 펀펀매치 우승. 인스타 1.9만',
    profileImageUrl: '/golfers/oh-sehee.jpeg',
    socialLinks: { instagram: 'oosshh_love' },
    primarySponsors: ['마스터바니', '휠라'],
    height: 168,
    region: '경기도 화성시',
    debutYear: 2020,
    affiliation: '마스터바니',
    sportType: 'GOLF',
    careerJson: {
      height: '168cm',
      birthDate: '1998-07-09',
      proSince: '2020년 7월 KLPGA 정회원',
      location: '경기도 화성시',
      followers: '1.9만',
      history: [
        '2026 마스터바니 앰버서더',
        '2024 펀펀매치 우승',
        '2024 SBSGOLF 더매치 출연중',
        '2024 휠라 CF 모델',
        '2024 GCL 잡지 모델',
        '2016 Hurricane 미국 도시합 2위',
        '2016 Hurricane 미국 전국 시합 우승',
        '2015 JPGA 주니어 골프대회 1위',
        '2014 뉴시스 힐스 코리아 오픈 2위',
        '2013 볼빅 KYGA 전국 청소년골프대회 2위',
      ],
    },
  },
  {
    email: 'leeyebin@sponpik.com',
    name: '이예빈',
    tour: 'KLPGA',
    bio: '168cm · 2000년생 · 2021년 KLPGA 준회원 · SG 더매치 챔피언십 출전. 인스타 @yaeproda',
    profileImageUrl: '/golfers/lee-yebin.jpeg',
    socialLinks: { instagram: 'yaeproda' },
    primarySponsors: [],
    height: 168,
    region: '서울 구로구',
    debutYear: 2021,
    affiliation: null,
    sportType: 'GOLF',
    careerJson: {
      height: '168cm',
      birthDate: '2000-11-16',
      proSince: '2021년 7월 KLPGA 준회원',
      location: '서울 구로구',
      followers: '1천',
      history: [
        '2026 SG 펀펀매치 8차 출연',
        '2025 SG 더매치 챔피언십 출전',
        '2022 KLPGA 모아저축은행 점프투어 14차 5위',
        '2022 KLPGA 모아저축은행 점프투어 13위',
        '2022 KLPGA 솔라고 점프투어 3위',
        '2020 MFS 드림필드 미니투어 11차 2위',
      ],
    },
  },
];

async function ensureSports() {
  // SPONPIK 1차: 골프 + 스크린골프 (트리 구조)
  const sports = [
    { code: 'GOLF', name: '골프', parentCode: null, displayOrder: 10 },
    { code: 'SCREEN_GOLF', name: '스크린골프', parentCode: 'GOLF', displayOrder: 11 },
    // 향후 확장 (비활성화 상태로 시드)
    { code: 'BASEBALL', name: '야구', parentCode: null, displayOrder: 20, isActive: false },
    { code: 'SOCCER', name: '축구', parentCode: null, displayOrder: 30, isActive: false },
    { code: 'VOLLEYBALL', name: '배구', parentCode: null, displayOrder: 40, isActive: false },
    { code: 'BASKETBALL', name: '농구', parentCode: null, displayOrder: 50, isActive: false },
  ];
  for (const s of sports) {
    await prisma.sport.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        parentCode: s.parentCode,
        displayOrder: s.displayOrder,
        isActive: (s as any).isActive ?? true,
      },
      create: {
        code: s.code,
        name: s.name,
        parentCode: s.parentCode,
        displayOrder: s.displayOrder,
        isActive: (s as any).isActive ?? true,
      },
    });
  }
  console.log(`🏷️  Sport 카테고리 ${sports.length}개 시드/갱신 완료`);
}

async function main() {
  console.log(`🌱 5명 프로골퍼 시드 시작...\n`);

  await ensureSports();
  const golfSport = await prisma.sport.findUnique({ where: { code: 'GOLF' } });

  // SPONPIK 1차 론칭 정합성 — 구조화 필드(height) 누락 선수는 자동 비활성
  // (docx 4 권장 데이터 항목 미충족 시 공개 노출 차단)
  const cleaned = await prisma.athlete.updateMany({
    where: { height: null, isActive: true },
    data: { isActive: false },
  });
  if (cleaned.count > 0) {
    console.log(`🧹 구조화 필드 누락 선수 ${cleaned.count}명 자동 비활성화`);
  }

  for (const a of ATHLETES) {
    // 초기 비밀번호: SEED_ATHLETE_PASSWORD 환경변수 또는 실행마다 무작위 (신규 생성 시에만 사용, 기존 계정은 유지)
    const initialPassword = process.env.SEED_ATHLETE_PASSWORD || randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(initialPassword, 12);

    const result = await prisma.user.upsert({
      where: { email: a.email },
      update: {
        athlete: {
          update: {
            name: a.name,
            tour: a.tour,
            bio: a.bio,
            profileImageUrl: a.profileImageUrl,
            socialLinks: a.socialLinks,
            primarySponsors: a.primarySponsors as any,
            height: a.height,
            region: a.region,
            debutYear: a.debutYear,
            affiliation: a.affiliation,
            sportType: a.sportType,
            sportId: golfSport?.id ?? null,
          },
        },
      },
      create: {
        email: a.email,
        passwordHash,
        role: 'ATHLETE',
        athlete: {
          create: {
            name: a.name,
            tour: a.tour,
            bio: a.bio,
            profileImageUrl: a.profileImageUrl,
            socialLinks: a.socialLinks,
            primarySponsors: a.primarySponsors as any,
            kycStatus: 'APPROVED',
            height: a.height,
            region: a.region,
            debutYear: a.debutYear,
            affiliation: a.affiliation,
            sportType: a.sportType,
            sportId: golfSport?.id ?? null,
          },
        },
      },
      include: { athlete: true },
    });

    console.log(`✅ ${a.name} (${a.tour}) - id: ${result.athlete?.id} | ${a.height}cm · ${a.region} · ${a.debutYear}년 데뷔`);
  }

  console.log(`\n✨ 완료. 총 ${ATHLETES.length}명 시드됨.`);
  console.log(`🔐 신규 생성된 계정의 초기 비밀번호: ${process.env.SEED_ATHLETE_PASSWORD ? '(SEED_ATHLETE_PASSWORD)' : '실행마다 무작위 — 선수에게는 비밀번호 재설정으로 안내'}`);
  console.log(`👀 화면 확인: http://localhost:5173/athletes`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
