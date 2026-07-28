/**
 * Sponpik Pixel JS (Phase 2)
 *
 * - 외부 자사몰 페이지에 삽입하여 풀 퍼널 이벤트 전송
 * - 사용법:
 *   <script async src="https://sponpik.com/pixel/sponpik-pixel.js" data-pixel-key="pk_xxx"></script>
 *   <script>sponpik('purchase', { order_id, gross_amount, items });</script>
 *
 * - sessionId / anonymousId 자동 관리 (쿠키)
 * - 도메인 화이트리스트는 서버에서 검증
 */

(function () {
  'use strict';

  // 픽셀 키 추출 (스크립트 태그에서)
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('sponpik-pixel.js') !== -1) return scripts[i];
    }
    return null;
  })();

  var pixelKey = scriptTag ? scriptTag.getAttribute('data-pixel-key') : null;
  var endpoint = (scriptTag && scriptTag.getAttribute('data-endpoint'))
    || ((scriptTag && scriptTag.src.split('/pixel/')[0]) + '/api/external/track');

  if (!pixelKey) {
    console.error('[Sponpik Pixel] data-pixel-key not provided');
    return;
  }

  // 쿠키 헬퍼
  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m[2]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function newId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }

  var sessionId = getCookie('spk_session_id') || newId('sess');
  var anonId = getCookie('spk_anonymous_id') || newId('anon');
  setCookie('spk_session_id', sessionId, 1);   // 1일
  setCookie('spk_anonymous_id', anonId, 365);  // 1년

  // URL 파라미터에서 utm_campaign / utm_athlete 추출
  function getQueryParam(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  var queueCampaignId = getQueryParam('utm_campaign');
  var queueAthleteId = getQueryParam('utm_athlete');

  function track(eventName, payload) {
    payload = payload || {};
    payload.pixel_key = pixelKey;
    payload.event_name = eventName;
    payload.session_id = payload.session_id || sessionId;
    payload.anonymous_id = payload.anonymous_id || anonId;
    payload.campaign_id = payload.campaign_id || queueCampaignId;
    payload.athlete_id = payload.athlete_id || queueAthleteId;
    payload.referrer = payload.referrer || document.referrer;
    payload.url = location.href;
    payload.device_type = /Mobile|Android|iP(hone|od)/.test(navigator.userAgent) ? 'mobile' : 'desktop';

    // sendBeacon 우선 (페이지 unload 안전)
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      } catch (e) {}
    }

    // fallback: fetch
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
      mode: 'cors',
    }).catch(function (e) { console.error('[Sponpik Pixel]', e); });
  }

  // 글로벌 함수 노출
  window.sponpik = function (eventName, payload) {
    try {
      track(eventName, payload);
    } catch (e) {
      console.error('[Sponpik Pixel]', e);
    }
  };

  // 자동 페이지뷰
  setTimeout(function () {
    track('landing_view', { auto: true });
  }, 100);

  console.log('[Sponpik Pixel] loaded with key', pixelKey.slice(0, 8) + '...');
})();
