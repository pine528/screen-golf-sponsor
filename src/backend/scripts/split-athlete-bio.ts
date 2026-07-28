/**
 * 선수 bio 줄글 → 소속/학력/수상/경력 구조 필드 일괄 분배
 *
 * - 각 선수 bio를 사람이 직접 읽고 분류한 매핑(BELOW)을 적용
 * - 신체정보(cm/년생)·SNS(인스타/유튜브/팔로워)는 구조 필드에서 제외 (별도 표기/요약행에 이미 노출)
 * - 기존 affiliation(소속팀/소속사)이 bio에 없으면 경력에 보존하여 데이터 손실 방지
 * - bio 원문은 그대로 보존(삭제 안 함) — 4필드 비면 폴백으로 계속 사용 가능
 *
 * 실행:
 *   DRY-RUN(기본, 쓰기 안 함):  ts-node scripts/split-athlete-bio.ts
 *   실제 적용:                  APPLY=1 ts-node scripts/split-athlete-bio.ts
 *
 * 대상 DB는 DATABASE_URL 환경변수로 결정됨 (.env). 운영 적용 시 운영 DATABASE_URL 사용.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Split = { affiliation?: string; education?: string; awards?: string; career?: string };

// 이름(고유) → 구조화 분류. 빈 값은 건드리지 않음.
const MAP: Record<string, Split> = {
  '김하림': {
    affiliation: 'KLPGA 정회원',
    education: '중앙대학교 골프전공 재학',
    awards: '2025 KCGF 전국대학 선수권 개인전 우승 · 2020 파워풀엑스·모아저축은행 점프투어 준우승',
  },
  '이하민': {
    affiliation: 'KLPGA 준회원',
    awards: '2019 FUTURE CHAMPIONS 우승 · 2017 SCPGA Hansen Dam Spring Classic 3위 · 2023 KLPGA 솔라고 점프투어 12차전 8위',
    career: '현 점프투어·WGTOUR 활동중',
  },
  '황지현': {
    affiliation: 'KLPGA 정회원(2022.05)',
    education: '단국대 국제스포츠학부 골프전공 · 부산진여고 골프부',
    awards: '2022 점프투어 상금랭킹 6위',
    career: "유튜브 '공치는 명훈이'·'골신골덕' 출연",
  },
  '이정우': {
    affiliation: 'KPGA 투어프로',
    education: '공주대 교육대학원 석사 · 중등 2급 정교사(체육) · 대전체육고 골프부 출신',
    awards: '대전광역시장배 준우승 · KPGA 프론티어투어 4위',
    career: '전 GDR아카데미 대전스마트시티점 프로',
  },
  '최우영': {
    affiliation: 'KPGA 투어프로',
    education: '미국 톨레도대 졸업 / 한국체대 대학원 · 미국 뉴멕시코·톨레도대 골프팀 장학생',
    awards: '2017 LA 매치플레이 우승 · 2019 NCAA Mountain West 단체전 우승',
    career: '미국PGA Class A 준비 중 · 영어 레슨 가능(우영프로)',
  },
  '김은채': {
    affiliation: '2019 KLPGA 정회원(회원번호 01351) · 광교 카카오프렌즈 소속',
    education: '홍익대 산업스포츠학과 졸업',
    career: '2026 WGTOUR 선수 · 영어 가능',
  },
  '정윤경': {
    affiliation: '2025.09 KLPGA 정회원(회원번호 01745)',
    awards: '2025 KLPGA 점프투어 15차전 우승',
    career: '현재 KLPGA 드림투어 활동 · 안정적인 드라이버 샷과 침착한 경기 운영',
  },
  '김진아2': {
    affiliation: '2025.08 KLPGA 정회원(회원번호 01737)',
    awards: '2026 정규투어 시드순위전 본선 진출',
    career: '2025 프로 데뷔 루키 · 미즈노 메인 스폰서 · 끝까지 포기하지 않는 스윙',
  },
  '안준혁': {
    affiliation: '2025년 프로 입회',
    education: '뉴질랜드 캔터베리/크라이스트처치 주니어 대표 출신',
    awards: 'Russley U18 2013·2014 우승 · Terrace Down U16 챔피언십 우승',
    career: '서인이앤씨 후원',
  },
  '문준혁': {
    affiliation: 'KPGA 정회원(2016 선발전 수석)',
    education: '경희대 골프산업학과',
    awards: '2016 챌린지투어 우승 · 2023 스릭슨투어 우승 · JGTO Q-School 4위 · 주니어 통산 30회 우승',
    career: '2026 KPGA 코리안투어(1부) 활동',
  },
  '박은수': {
    affiliation: '2015년 KLPGA 정회원(회원번호 1092)',
    education: '호주 골프유학 5년 · 골프/운동 자격증 12개 보유',
    awards: '2016 WGTOUR 루키상',
    career: '비거리 평균 230m · CLPGA 차이나투어(2013~2018) · VVIP 필드레슨 전문 · Artisan Golf 소속',
  },
  '장정우': {
    affiliation: '2021년 KPGA 투어프로 수석합격',
    awards: '2026 신한투자증권 GTOUR 2차 우승',
    career: '스릭슨투어(2021~2024) · 분당그린피아골프연습장 소속',
  },
  '박현주': {
    affiliation: 'KLPGA 준회원(회원번호 1530)',
    awards: '2017 GTOUR 상금랭킹 2위 · 2017 롯데렌터카 WGTOUR 4차·챔피언십 우승',
    career: 'GTOUR 입회 2012 · 레슨 11년차 · 골프 크리에이터/레슨프로(유튜브 박푸로) · 파주 청해골프 소속',
  },
  '금동호': {
    affiliation: 'KPGA TOUR PRO (NO.1209)',
    awards: 'GTOUR 통산 3승 · 2022 GTOUR 대상',
    career: '2023 코리안투어 멤버',
  },
  '이용희': {
    affiliation: 'KPGA TOUR PRO (TP2210) · 2020년 7월 입회',
    awards: '2025 GTOUR 대상·상금왕',
  },
  '이성훈': {
    affiliation: 'KPGA TOUR PRO (2540) · 정회원 수석합격',
    awards: '2026 신한투자증권 GTOUR 3차 메이저 우승',
  },
  '김다훈': {
    affiliation: 'KPGA 투어프로',
    awards: '2017 JTBC 파운더스 컵 우승',
    career: '2016 KPGA 투어프로 자격 취득 · 2017 코리안투어 활동 · 현재 GTOUR 활동중',
  },
  '강채린': {
    affiliation: '2022년 KLPGA 정회원(회원번호 1530)',
    education: '중앙대학교 골프전공 수석 졸업',
    career: 'WGTOUR 2026 루키 · 미즈노/브리지스톤 계약, 탱크샤프트 후원',
  },
  '최서영': {
    affiliation: 'KLPGA 정회원',
    education: '홍익대 산업스포츠학과',
    awards: 'KYGA 볼빅배 국제대회 우승 · 2020 솔라고 점프투어 9차전 준우승 · 2021 호반 드림투어 3위',
  },
  '요코야마 미즈카': {
    affiliation: 'KLPGA 정회원(프로번호 01576) · SNS골프스튜디오 소속 프로',
    education: '전주예술고 · 원광대 경영학과',
    career: '2026 WGTOUR 활동',
  },
  '장연주': {
    affiliation: '2017년 KLPGA 정회원',
    awards: 'KLPGA 셉토투어 13차전 우승 · GTOUR 레드네 투카 챌린지 우승',
    career: '더골프컴퍼니 소속',
  },
  '김수아': {
    affiliation: 'KLPGA 정회원 #1517 · 아라니아 소속',
    education: '중앙대 골프전공',
    awards: 'WGTOUR 신인포인트 5위',
  },
  '염돈웅': {
    affiliation: '2012년 KPGA 입회',
    awards: 'GTOUR 3회 우승',
    career: '돈워리골프 유튜브',
  },
  '이예빈': {
    affiliation: '2021년 KLPGA 준회원',
    career: 'SG 더매치 챔피언십 출전',
  },
  '오세희': {
    affiliation: '2020년 KLPGA 정회원',
    awards: '펀펀매치 우승',
    career: '마스터바니 앰버서더',
  },
  '송유나': {
    affiliation: '2021년 KLPGA 정회원',
    career: '르꼬끄 골프 앰버서더',
  },
  '배진리': {
    affiliation: '2020년 KLPGA 정회원',
    awards: 'WGTOUR 1차 2위',
  },
  '안예인': {
    affiliation: '2018년 KLPGA 정회원',
    career: 'SBSGOLF 골프클리닉 출연',
  },
};

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY 모드 — 실제 DB 업데이트 ###' : '### DRY-RUN — 쓰기 안 함 (적용하려면 APPLY=1) ###');
  console.log('대상 DB:', (process.env.DATABASE_URL || '').replace(/:\/\/[^@]*@/, '://****@').split('?')[0], '\n');

  const names = Object.keys(MAP);
  let matched = 0, updated = 0;
  const missing: string[] = [];

  for (const name of names) {
    const a = await prisma.athlete.findFirst({ where: { name } });
    if (!a) { missing.push(name); continue; }
    matched++;
    const m = MAP[name];
    const data: Split = {};
    (['affiliation', 'education', 'awards', 'career'] as const).forEach((k) => {
      if (m[k] && m[k]!.trim()) data[k] = m[k];
    });
    console.log(`• ${name}`);
    console.log(`   소속: ${data.affiliation || '-'}`);
    console.log(`   학력: ${data.education || '-'}`);
    console.log(`   수상: ${data.awards || '-'}`);
    console.log(`   경력: ${data.career || '-'}`);
    if (apply) {
      await prisma.athlete.update({ where: { id: a.id }, data });
      updated++;
    }
  }

  console.log(`\n매칭: ${matched}/${names.length}  업데이트: ${apply ? updated : '(dry-run)'}`);
  if (missing.length) console.log('⚠️ DB에서 못 찾은 이름:', missing.join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
