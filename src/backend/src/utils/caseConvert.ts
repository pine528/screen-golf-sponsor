/**
 * camelCase → snake_case 응답 변환 (api_spec TABLE 45 호환)
 *
 * - 리포트 응답에만 적용 (외부 API 호출자가 snake_case 기대)
 * - 중첩 객체/배열 재귀
 * - Date/Decimal/null/Buffer는 그대로 (response.serializeDecimals 이후 호출)
 */

const CACHE = new Map<string, string>();

export function camelToSnake(s: string): string {
  if (CACHE.has(s)) return CACHE.get(s)!;
  // 'landingViews' → 'landing_views', 'CTR' → 'ctr'
  const out = s
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
  CACHE.set(s, out);
  return out;
}

export function toSnakeKeys<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => toSnakeKeys(v)) as any;
  if (typeof obj !== 'object') return obj;
  // Date / Buffer 등은 변환하지 않음
  if (obj instanceof Date) return obj as any;
  if (typeof (obj as any).getTime === 'function') return obj as any;

  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = toSnakeKeys(v);
  }
  return out;
}
