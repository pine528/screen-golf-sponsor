/**
 * Brand Analyzer (심층매칭 v3.0 §4·§11) — 규칙 기반 URL 분석
 *
 * 웹 페이지 요약이 아니라 선수 매칭 Feature 추출용 전처리다.
 * 현재는 LLM 없이 공개 메타데이터(title·og·meta description·가격 패턴)에서
 * 정형 추출한다 — 추출 실패 필드는 null로 두고 사용자가 직접 입력/수정한다.
 * AI 초안은 사용자가 승인(approve)해야만 매칭 Feature로 쓰인다 (AC-02).
 *
 * 보안 (§16): SSRF 방지 — http(s)만 허용, private IP/localhost 차단,
 * 리다이렉트 3회·본문 500KB·8초 제한.
 */
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as dns from 'dns/promises';

const MAX_BYTES = 500 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string): boolean {
  if (/^(::1|::ffff:)?(127\.|10\.|0\.)/.test(ip)) return true;
  if (/^(::ffff:)?192\.168\./.test(ip)) return true;
  if (/^(::ffff:)?172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^(::ffff:)?169\.254\./.test(ip)) return true;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('http/https URL만 분석할 수 있습니다');
  if (/localhost|\.local$/i.test(u.hostname)) throw new Error('허용되지 않는 호스트입니다');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error('호스트를 찾을 수 없습니다');
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('허용되지 않는 호스트입니다');
  return u;
}

function fetchPage(rawUrl: string, redirects = 0): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let u: URL;
    try { u = await assertSafeUrl(rawUrl); } catch (e) { return reject(e); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(
      u,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SponpikBrandAnalyzer/1.0)', Accept: 'text/html' }, timeout: TIMEOUT_MS },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) return reject(new Error('리다이렉트가 너무 많습니다'));
          const next = new URL(res.headers.location, u).toString();
          return fetchPage(next, redirects + 1).then(resolve, reject);
        }
        if (status !== 200) { res.resume(); return reject(new Error(`HTTP ${status}`)); }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) { req.destroy(); return resolve(Buffer.concat(chunks).toString('utf8')); }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    req.on('timeout', () => { req.destroy(new Error('응답 시간 초과')); });
    req.on('error', reject);
  });
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 300) : null;
}

function extractMeta(html: string) {
  const title = pick(html, /<title[^>]*>([^<]{2,120})<\/title>/i);
  const ogTitle = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const desc = pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const keywords = pick(html, /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  const siteName = pick(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  // 가격 패턴 (제품 페이지용): "12,900원" / "₩12,900"
  const prices = [...html.matchAll(/(?:₩\s?|)([1-9]\d{0,2}(?:,\d{3})+|\d{4,7})\s?원/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => n >= 1000 && n <= 5_000_000);
  return { title: ogTitle || title, description: desc, keywords, siteName, prices };
}

export interface AnalyzedUrl {
  url: string;
  type: string; // homepage | product | instagram | youtube | store
  status: 'OK' | 'FAILED';
  error?: string;
  title?: string | null;
  siteName?: string | null;
  description?: string | null;
  keywords?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

/**
 * URL 목록 분석 → Brand Feature 초안 (§4.1)
 * 실패한 URL은 status FAILED로 표기하고 전체 플로우는 유지한다 (AC-09).
 */
export async function analyzeBrandUrls(urls: { url: string; type: string }[]) {
  const results: AnalyzedUrl[] = [];
  for (const { url, type } of urls.slice(0, 6)) {
    try {
      // 인스타/유튜브는 로그인 없이 메타 접근이 제한적 — 존재 확인 수준으로만 기록
      const html = await fetchPage(url);
      const meta = extractMeta(html);
      results.push({
        url, type, status: 'OK',
        title: meta.title, siteName: meta.siteName, description: meta.description, keywords: meta.keywords,
        priceMin: meta.prices.length ? Math.min(...meta.prices) : null,
        priceMax: meta.prices.length ? Math.max(...meta.prices) : null,
      });
    } catch (e: any) {
      results.push({ url, type, status: 'FAILED', error: String(e.message || e).slice(0, 80) });
    }
  }

  const ok = results.filter((r) => r.status === 'OK');
  const home = ok.find((r) => r.type === 'homepage');
  const products = ok.filter((r) => r.type === 'product');
  const priceAll = ok.flatMap((r) => [r.priceMin, r.priceMax]).filter((n): n is number => n != null);
  const keywordSet = new Set<string>();
  for (const r of ok) {
    (r.keywords || '').split(/[,·|]/).map((k) => k.trim()).filter((k) => k.length >= 2 && k.length <= 12).slice(0, 6)
      .forEach((k) => keywordSet.add(k));
  }

  // 초안 Feature (§4) — 추출 실패 필드는 null. 사용자 확인/수정 후에만 승인값이 된다.
  const draft = {
    brandNameGuess: home?.siteName || home?.title || null,
    description: home?.description || null,
    brandKeywords: [...keywordSet].slice(0, 8),
    priceTier: priceAll.length
      ? (Math.max(...priceAll) >= 100000 ? '프리미엄' : Math.max(...priceAll) >= 30000 ? '중가~프리미엄' : '중저가')
      : null,
    priceRange: priceAll.length ? { min: Math.min(...priceAll), max: Math.max(...priceAll) } : null,
    productTitles: products.map((p) => p.title).filter(Boolean).slice(0, 3),
    analyzedChannels: results.map((r) => ({ type: r.type, status: r.status })),
    extractionMethod: 'RULE_BASED_METADATA', // LLM 미사용 — 공개 메타데이터 정형 추출
  };

  return { urls: results, draft, completeness: Math.round((ok.length / Math.max(1, results.length)) * 100) };
}
