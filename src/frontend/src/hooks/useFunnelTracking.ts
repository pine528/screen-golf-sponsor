/**
 * useFunnelTracking - 풀 퍼널 이벤트 트래킹 훅
 *
 * - sessionId / anonymousId 자동 관리 (localStorage)
 * - 단축링크 클릭 시 sessionRollup 갱신
 * - 모든 이벤트 호출에 공통 메타 자동 첨부
 */

import { useCallback } from 'react';
import { api } from '../services/api';

const SESSION_KEY = 'sponpik_session_id';
const ANON_KEY = 'sponpik_anonymous_id';

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getOrCreateAnonymousId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function useFunnelTracking() {
  const sessionId = getOrCreateSessionId();
  const anonymousId = getOrCreateAnonymousId();

  const trackEvent = useCallback(async (eventName: string, payload: Record<string, any>) => {
    try {
      const body = {
        ...payload,
        session_id: payload.session_id || sessionId,
        anonymous_id: payload.anonymous_id || anonymousId,
      };
      return await api.trackFunnelEvent(eventName, body);
    } catch (e) {
      console.error('[Funnel] tracking failed', e);
    }
  }, [sessionId, anonymousId]);

  const resolveShortCode = useCallback(async (shortCode: string) => {
    return api.resolveShortCode(shortCode, sessionId);
  }, [sessionId]);

  return { trackEvent, resolveShortCode, sessionId, anonymousId };
}
