/** 의존성 없는 최소 xlsx 리더 — 셀참조 → 값 맵 */
const fs = require('fs'), zlib = require('zlib');

function unzip(buf) {
  const files = {};
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const nameLen = buf.readUInt16LE(i + 26), extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const method = buf.readUInt16LE(i + 8);
    let size = buf.readUInt32LE(i + 18);
    const start = i + 30 + nameLen + extraLen;
    if (size === 0) {
      let j = start;
      while (j < buf.length - 4 && buf.readUInt32LE(j) !== 0x08074b50) j++;
      size = j - start;
    }
    try {
      files[name] = method === 8 ? zlib.inflateRawSync(buf.slice(start, start + size)) : buf.slice(start, start + size);
    } catch (e) { /* 개별 엔트리 실패는 무시 */ }
  }
  return files;
}

// 일부 파일은 <x:si>처럼 네임스페이스 접두사가 붙고, 속성 순서도 제각각이다
const RE_SI = /<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g;
const RE_T = /<(?:\w+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:\w+:)?t>/g;
const RE_C = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
const RE_V = /<(?:\w+:)?v(?:\s[^>]*)?>([^<]*)<\/(?:\w+:)?v>/;

function shared(files) {
  const f = files['xl/sharedStrings.xml'];
  if (!f) return [];
  return [...f.toString('utf8').matchAll(RE_SI)].map((m) =>
    [...m[1].matchAll(new RegExp(RE_T.source, 'g'))].map((t) => t[1]).join('')
  );
}

/** 엑셀 날짜 일련번호 → YYYY.MM.DD */
function serialToDate(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

function cells(file, sst) {
  const xml = file.toString('utf8');
  const out = {};
  for (const m of xml.matchAll(RE_C)) {
    const attrs = m[1] || '', inner = m[2] || '';
    const rm = attrs.match(/\br="([A-Z]+\d+)"/);
    if (!rm) continue;
    const vm = inner.match(RE_V);
    const tm = new RegExp(RE_T.source).exec(inner);
    let val = vm ? vm[1] : (tm ? tm[1] : '');
    if (/\bt="s"/.test(attrs) && vm) val = sst[Number(vm[1])] ?? '';
    val = String(val).replace(/\s+/g, ' ').trim();
    // 날짜 서식으로 저장된 일련번호를 사람이 읽는 날짜로
    if (/^\d{5}$/.test(val) && Number(val) > 20000 && Number(val) < 60000) val = serialToDate(Number(val));
    if (val) out[rm[1]] = val;
  }
  return out;
}

function load(path) {
  const files = unzip(fs.readFileSync(path));
  const sst = shared(files);
  const sheet = files['xl/worksheets/sheet3.xml'] || files['xl/worksheets/sheet1.xml'];
  return cells(sheet, sst);
}

module.exports = { load, serialToDate };
