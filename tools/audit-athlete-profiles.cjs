/**
 * 선수 프로필 대조 — `선수 프로필 엑셀/` 원본 vs 운영 DB
 *
 * 엑셀 제출본을 기준으로 생년월일·출신지역·출신학교·신장/체중·소속협회·자격·
 * 사이즈·SNS를 대조하고, 선수별 열린 슬롯 수를 함께 보여준다.
 *
 * 실행: node tools/audit-athlete-profiles.cjs
 */
const fs = require('fs'), path = require('path'), https = require('https');
const { load } = require('./xlsx-mini.cjs');
const DIR = 'E:/SPONPIK/선수 프로필 엑셀';

const post = (p, b) => new Promise((res, rej) => { const d = JSON.stringify(b);
  const r = https.request('https://screen-golf-sponsor.onrender.com/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), Origin: 'https://www.sponpik.com' } },
    x => { let s = ''; x.on('data', c => s += c); x.on('end', () => res(JSON.parse(s))); }); r.on('error', rej); r.write(d); r.end(); });
const get = (p, t) => new Promise((res, rej) => { https.get('https://screen-golf-sponsor.onrender.com/api' + p, { headers: { Authorization: 'Bearer ' + t, Origin: 'https://www.sponpik.com' } },
    r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { res(null) } }); }).on('error', rej); });

const norm = (v) => String(v ?? '').replace(/[\s\u00a0]/g, '').replace(/[·・]/g, '').toLowerCase();
const num = (v) => { const m = String(v ?? '').match(/\d+/); return m ? Number(m[0]) : null; };

/** 엑셀 → 비교용 구조 */
function fromExcel(file) {
  const c = load(file);
  return {
    name: c.B5,
    birthDate: c.F5,
    tour: c.B6,                 // 소속협회
    tourDetail: c.D6,           // 소속협회/투어 상세
    debutYear: num(c.F6),
    birthplace: c.H6,
    education: c.B7,
    bodySpec: c.D7,             // "168cm 55kg"
    qualification: c.F7,
    sizes: { hat: c.B29, top: c.D29, glove: c.F29, shoe: c.H29 },
    instagram: c.B33, igFollowers: c.D33, ytChannel: c.F33, ytSubs: c.H33,
    slots: { '모자 정면': c.B24, '모자 좌우': c.D24, '모자챙': c.F24, '상의 좌우측': c.H24,
             '어깨 좌우측': c.B25, '카라 좌우측': c.D25, '어깨/쇄골 좌우측': c.F25, '등어깨 상단 좌우측': c.H25 },
  };
}

(async () => {
  const login = await post('/auth/login', { email: 'admin@screengolf.com', password: 'admin123!' });
  const tok = login.data.accessToken;
  const all = (await get('/athletes?limit=200', tok)).data || [];

  let slots = [];
  for (const pg of [1, 2]) { const d = await get('/slots/instances?page=' + pg + '&limit=200', tok); slots = slots.concat(d.data || []); }
  const slotCount = {};
  slots.forEach(s => { const id = (s.athlete && s.athlete.id) || s.athleteId; slotCount[id] = (slotCount[id] || 0) + 1; });

  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx'));
  const report = [];
  for (const f of files) {
    let ex;
    try { ex = fromExcel(path.join(DIR, f)); } catch (e) { report.push({ file: f, error: '엑셀 파싱 실패: ' + e.message }); continue; }
    if (!ex.name) { report.push({ file: f, error: '엑셀에 이름 없음' }); continue; }

    // 이름으로 매칭 (동명이인 접미 숫자 허용)
    const cand = all.filter(a => a.name && (a.name === ex.name || a.name.replace(/\d+$/, '') === ex.name));
    if (cand.length === 0) { report.push({ name: ex.name, file: f, error: 'DB에 없음' }); continue; }
    const a = cand[0];
    const det = (await get('/athletes/' + a.id, tok));
    const p = (det && det.data) || a;

    const diffs = [];
    const cmp = (label, exVal, dbVal, opt = {}) => {
      if (!exVal) return;
      const e = norm(exVal), d = norm(dbVal);
      if (!d) return diffs.push(`${label}: 엑셀 "${exVal}" → DB 비어있음`);
      if (opt.contains ? !d.includes(e) && !e.includes(d) : e !== d) diffs.push(`${label}: 엑셀 "${exVal}" ≠ DB "${dbVal}"`);
    };
    cmp('생년월일', ex.birthDate, p.birthDate);
    cmp('출신지역', ex.birthplace, p.birthplace);
    cmp('출신학교', ex.education, p.education, { contains: true });
    cmp('자격', ex.qualification, p.tourQualification, { contains: true });
    if (ex.debutYear && p.debutYear !== ex.debutYear) diffs.push(`프로입회연도: 엑셀 ${ex.debutYear} ≠ DB ${p.debutYear ?? '비어있음'}`);
    const h = num((ex.bodySpec || '').split(/cm/)[0]);
    const w = num((ex.bodySpec || '').split(/cm/)[1] || '');
    if (h && p.height !== h) diffs.push(`신장: 엑셀 ${h} ≠ DB ${p.height ?? '비어있음'}`);
    if (w && p.weight !== w) diffs.push(`체중: 엑셀 ${w} ≠ DB ${p.weight ?? '비어있음'}`);
    // 소속협회: 엑셀이 복수(A / B)면 DB tour가 그 중 하나만 담고 있는지
    if (ex.tour) {
      const parts = ex.tour.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
      const missing = parts.filter(x => !norm(p.tour).includes(norm(x)) && !norm(p.tourQualification).includes(norm(x)));
      if (missing.length) diffs.push(`소속협회: 엑셀 "${ex.tour}" 중 [${missing.join(', ')}] 누락 (DB tour="${p.tour}")`);
    }
    const s = p.sizes || {};
    [['모자', ex.sizes.hat, s.hat], ['상의', ex.sizes.top, s.top], ['장갑', ex.sizes.glove, s.glove], ['신발', ex.sizes.shoe, s.shoe]]
      .forEach(([l, e2, d2]) => cmp('사이즈-' + l, e2, d2, { contains: true }));
    const sl = p.socialLinks || {}, st = p.snsStats || {};
    cmp('인스타 ID', ex.instagram, sl.instagram, { contains: true });
    cmp('인스타 팔로워', ex.igFollowers, st.instagramFollowers, { contains: true });
    cmp('유튜브 채널', ex.ytChannel, sl.youtube || st.youtubeChannel, { contains: true });
    cmp('유튜브 구독자', ex.ytSubs, st.youtubeSubs, { contains: true });

    // 슬롯: 엑셀에서 명시적으로 N(불가)인데 열려 있는지 / 가능인데 0개인지
    const openable = Object.entries(ex.slots).filter(([, v]) => v && norm(v) !== 'n');
    const blocked = Object.entries(ex.slots).filter(([, v]) => v && norm(v) === 'n').map(([k]) => k);
    const cnt = slotCount[a.id] || 0;
    report.push({ name: p.name, file: f, id: a.id, diffs, slotCount: cnt, openable: openable.length, blocked });
  }
  fs.writeFileSync(__dirname + '/audit-result.json', JSON.stringify(report, null, 1));

  const bad = report.filter(r => r.error || (r.diffs && r.diffs.length));
  console.log(`대조 ${report.length}명 / 불일치 있는 선수 ${bad.length}명\n`);
  bad.forEach(r => {
    console.log('■ ' + (r.name || r.file));
    if (r.error) { console.log('   ! ' + r.error); return; }
    r.diffs.forEach(d => console.log('   - ' + d));
  });
  console.log('\n[슬롯 오픈 상태]');
  report.filter(r => !r.error).forEach(r => {
    const flag = r.slotCount === 0 ? ' ← 0개' : (r.slotCount <= 2 ? ' ← 적음' : '');
    console.log(`   ${String(r.slotCount).padStart(2)}개 | 엑셀 가능 ${r.openable}종 | ${r.name}${flag}`);
  });
})();
