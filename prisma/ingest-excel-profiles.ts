/**
 * 2026-07 선수화면 개편 — 엑셀 프로필 27명 일괄 인제스트
 * - 입력: prisma/data/athletes-excel-2026-07.json (엑셀 27개 파싱 결과)
 * - 기존 26명: 이름(공백무시) 매칭 → 확장 필드 업데이트 (엑셀 값 있을 때만 덮어씀)
 * - 신규 1명(김시윤): placeholder 계정 생성 (사진은 2번 항목에서 추가 예정)
 * - tour/affiliation/awards/career 등 기존 큐레이션 필드는 유지 (엑셀이 더 정확한 항목만 갱신)
 *
 * 실행:
 *   DRY-RUN: DATABASE_URL=<url> npx ts-node prisma/ingest-excel-profiles.ts
 *   적용:    APPLY=1 DATABASE_URL=<url> npx ts-node prisma/ingest-excel-profiles.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/athletes-excel-2026-07.json'), 'utf8'));

// 수동 정규화 (엑셀 오타/비정형)
const BIRTH_FIX: Record<string, string> = {
  '이성훈': '1987.10.12', // "87년10월12일"
  '최우영': '2000.12.28', // "200.12.28"
  '염돈웅': '1994.02.22',
  '정윤경': '2006.07.21',
};

const nul = (v: any) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' || /^[NnXx]$/.test(s) ? null : s;
};

function normBirth(name: string, raw: string | null): string | null {
  if (BIRTH_FIX[name]) return BIRTH_FIX[name];
  if (!raw) return null;
  const m = raw.match(/(\d{4})[.\s년-]+(\d{1,2})[.\s월-]+(\d{1,2})/);
  if (m) return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
  return raw;
}

function normYear(raw: string | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function normHW(raw: string | null): { height: number | null; weight: number | null } {
  if (!raw) return { height: null, weight: null };
  const nums = [...String(raw).matchAll(/\d{2,3}/g)].map((m) => Number(m[0]));
  const height = nums.find((n) => n >= 140 && n <= 220) ?? null;
  const weight = nums.find((n) => n >= 40 && n <= 130 && n !== height) ?? null;
  return { height, weight };
}

// 활동분야 → 표준 키
function normActivity(act: Record<string, boolean>): Record<string, boolean> | null {
  if (!act || Object.keys(act).length === 0) return null;
  return {
    tour1: !!(act['KPGA 투어'] || act['KLPGA 투어']),
    gtour: !!act['GTOUR'],
    lesson: !!act['레슨'],
    proAm: !!act['프로암'],
    sns: !!act['SNS 콘텐츠'],
    youtube: !!act['유튜브 방송'],
    tour2: !!act['2부투어'],
    etc: !!act['기타'],
  };
}

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(apply ? '### APPLY ###' : '### DRY-RUN (적용: APPLY=1) ###');

  const all = await prisma.athlete.findMany({ select: { id: true, name: true, height: true, region: true, user: { select: { email: true } } } });
  const byName = (n: string) => all.find((a) => a.name.replace(/\s/g, '') === n.replace(/\s/g, ''));
  const golf = await prisma.sport.findUnique({ where: { code: 'GOLF' } });

  let updated = 0, created = 0;
  for (const x of DATA) {
    if (x.error) { console.log('⚠️ 스킵(파싱실패):', x.file); continue; }
    const name = x.fileName;
    const hw = normHW(x.heightWeight);
    const insta = nul(x.instagram)?.toLowerCase().replace(/^@/, '') ?? null;
    const data: any = {};

    const birth = normBirth(name, nul(x.birth));
    if (birth) data.birthDate = birth;
    const bp = nul(x.birthplace); if (bp) data.birthplace = bp;
    const school = nul(x.school); if (school) data.education = school;
    const dy = normYear(nul(x.debutYear)); if (dy) data.debutYear = dy;
    const qual = nul(x.qualification) || nul(x.assocDetail); if (qual) data.tourQualification = qual;
    const res = nul(x.residence); if (res) data.region = res;
    if (hw.height) data.height = hw.height;
    if (hw.weight) data.weight = hw.weight;
    const act = normActivity(x.activity); if (act) data.activityFields = act;
    if (x.highlights?.length) data.highlights = x.highlights;
    const snsStats: any = {};
    if (nul(x.instaFollowers)) snsStats.instagramFollowers = nul(x.instaFollowers);
    if (nul(x.youtubeChannel)) snsStats.youtubeChannel = nul(x.youtubeChannel);
    if (nul(x.youtubeSubs)) snsStats.youtubeSubs = nul(x.youtubeSubs);
    if (Object.keys(snsStats).length) data.snsStats = snsStats;
    if (x.slots && Object.keys(x.slots).length) data.sponsorSlots = x.slots;
    const sizes: any = {};
    for (const k of ['hat', 'top', 'glove', 'shoe'] as const) if (nul(x.sizes?.[k])) sizes[k] = nul(x.sizes[k]);
    if (Object.keys(sizes).length) data.sizes = sizes;

    const existing = byName(name);
    if (existing) {
      // socialLinks 병합 (instagram/youtube)
      const cur = await prisma.athlete.findUnique({ where: { id: existing.id }, select: { socialLinks: true } });
      const links: any = Object.assign({}, (cur?.socialLinks as any) || {});
      if (insta) links.instagram = insta;
      if (nul(x.youtubeChannel)) links.youtube = links.youtube || nul(x.youtubeChannel);
      if (Object.keys(links).length) data.socialLinks = links;

      console.log(`↻ ${name} (${existing.user?.email}) ← ${Object.keys(data).join(',')}`);
      if (apply) { await prisma.athlete.update({ where: { id: existing.id }, data }); updated++; }
    } else {
      // 신규 (김시윤 예상) — placeholder 계정
      const email = 'kimsiyoon@sponpik.com';
      const links: any = {}; if (insta) links.instagram = insta; if (nul(x.youtubeChannel)) links.youtube = nul(x.youtubeChannel);
      console.log(`＋ 신규 ${name} (${email}) ← ${Object.keys(data).join(',')}`);
      if (apply) {
        await prisma.user.upsert({
          where: { email },
          update: { athlete: { update: { ...data, socialLinks: links } } },
          create: {
            email, passwordHash: await bcrypt.hash('kimsiyoon2026!', 12), role: 'ATHLETE',
            athlete: {
              create: {
                name, tour: 'KLPGA',
                bio: `KLPGA 프로 ${name}. 부산 출신 · 부산진여고.`,
                affiliation: nul(x.assocDetail) || 'KLPGA',
                socialLinks: links, primarySponsors: [],
                sportType: 'GOLF', sportId: golf?.id ?? null,
                isActive: true, kycStatus: 'APPROVED',
                ...data,
              },
            },
          },
        });
        created++;
      }
    }
  }
  console.log(`\n완료 — 업데이트 ${apply ? updated : '(dry)'} / 신규 ${apply ? created : '(dry)'}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
