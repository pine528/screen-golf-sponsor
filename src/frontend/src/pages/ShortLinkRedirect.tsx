/**
 * ShortLinkRedirect - 단축 URL 클릭 → 추적 + 미니스토어 redirect
 *
 * - /s/:shortCode 경로
 * - api.resolveShortCode() 호출 → server에서 클릭 카운트+sessionRollup 갱신
 * - 응답의 redirect_url로 이동
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFunnelTracking } from '../hooks/useFunnelTracking';

export function ShortLinkRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const { resolveShortCode } = useFunnelTracking();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) return;
    resolveShortCode(shortCode)
      .then((resp) => {
        const redirect = resp.data?.redirect_url;
        if (redirect) {
          // 외부/내부 URL 모두 처리
          window.location.replace(redirect);
        } else {
          setError('유효하지 않은 링크입니다');
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.error?.message || '링크를 찾을 수 없습니다');
      });
  }, [shortCode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-rose-500 text-lg font-bold mb-2">⚠️ {error}</div>
            <a href="/" className="text-sm text-emerald-600 hover:underline">홈으로</a>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-slate-500">이동 중...</div>
          </>
        )}
      </div>
    </div>
  );
}
