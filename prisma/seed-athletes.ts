/**
 * 실제 프로골퍼 5명 시드 (PDF: 2026년_프로골퍼_리스트_.pdf)
 *
 * - 배진리, 송유나, 오세희, 이예빈, 안예인
 * - User(ATHLETE) + Athlete 프로필 함께 생성 (idempotent: email upsert)
 *
 * 실행:
 *   로컬: npx ts-node prisma/seed-athletes.ts
 *   운영: DATABASE_URL=<railway_url> npx ts-node prisma/seed-athletes.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface AthleteSeed {
  email: string;
  password: string;
  name: string;
  tour: string;
  bio: string;
  profileImageUrl: string | null;
  socialLinks: Record<string, string>;
  primarySponsors: string[];
  // 추가 메타 (career)
  careerJson: any;
}

const ATHLETES: AthleteSeed[] = [
  {
    email: 'anyein@sponpik.com',
    password: 'anyein2026!',
    name: '안예인',
    tour: 'KLPGA',
    bio: '176cm · 1998년생 · 2018년 KLPGA 정회원 · SBSGOLF 골프클리닉 출연. 5.1만 인스타 팔로워',
    profileImageUrl: '/golfers/an-yein.jpeg',
    socialLinks: { instagram: 'yenisfree' },
    primarySponsors: ['SBSGOLF'],
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
    password: 'baejinri2026!',
    name: '배진리',
    tour: 'KLPGA',
    bio: '170cm · 2001년생 · 2020년 KLPGA 정회원 · WGTOUR 1차 2위. 인스타 @hjissiir',
    profileImageUrl: '/golfers/bae-jinri.jpeg',
    socialLinks: { instagram: 'hjissiir' },
    primarySponsors: [],
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
    password: 'songyuna2026!',
    name: '송유나',
    tour: 'KLPGA',
    bio: '165cm · 1998년생 · 2021년 KLPGA 정회원 · 르꼬끄 골프 앰버서더. 인스타 @_yuna_ssong',
    profileImageUrl: '/golfers/song-yuna.jpeg',
    socialLinks: { instagram: '_yuna_ssong' },
    primarySponsors: ['르꼬끄 골프'],
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
    password: 'ohsehee2026!',
    name: '오세희',
    tour: 'KLPGA',
    bio: '168cm · 1998년생 · 2020년 KLPGA 정회원 · 마스터바니 앰버서더 · 펀펀매치 우승. 인스타 1.9만',
    profileImageUrl: '/golfers/oh-sehee.jpeg',
    socialLinks: { instagram: 'oosshh_love' },
    primarySponsors: ['마스터바니', '휠라'],
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
    password: 'leeyebin2026!',
    name: '이예빈',
    tour: 'KLPGA',
    bio: '168cm · 2000년생 · 2021년 KLPGA 준회원 · SG 더매치 챔피언십 출전. 인스타 @yaeproda',
    profileImageUrl: '/golfers/lee-yebin.jpeg',
    socialLinks: { instagram: 'yaeproda' },
    primarySponsors: [],
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

async function main() {
  console.log(`🌱 5명 프로골퍼 시드 시작...\n`);

  for (const a of ATHLETES) {
    const passwordHash = await bcrypt.hash(a.password, 12);

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
          },
        },
      },
      include: { athlete: true },
    });

    console.log(`✅ ${a.name} (${a.tour}) - id: ${result.athlete?.id}`);
  }

  console.log(`\n✨ 완료. 총 ${ATHLETES.length}명 시드됨.`);
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
