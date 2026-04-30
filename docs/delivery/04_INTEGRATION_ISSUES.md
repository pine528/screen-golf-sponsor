# 연동 이슈 정리 — SPONPIK 1차 론칭

> 작성: 2026-04-29 / 외부 연동 현황 및 이슈

---

## 1. GTOUR (KLPGA/KPGA 결과 API)

| 항목 | 상태 | 비고 |
|---|---|---|
| 실 API 연동 | ❌ 미완료 | 공식 API 키 발급 미진행 |
| 운영 우회책 | ✅ 적용 | `/admin/athletes/event-results` 수동 입력 |
| 시드 데이터 | ✅ 16건 | 5명 선수의 PDF history + 가상 GTOUR 데이터 |
| 수동/API 구분 | ✅ | `source = MANUAL | GTOUR_API` 필드로 구분 |

**대응 계획**:
- Phase 2: GTOUR 사업개발팀 미팅 → API 키 발급
- Phase 2 후속: `/api/external/gtour/sync` 엔드포인트 구현 (cron 일 1회)
- 관리자 우선 정책: `MANUAL` 입력은 자동 동기화 시 덮어쓰지 않음

---

## 2. TossPayments

| 항목 | 상태 | 비고 |
|---|---|---|
| 테스트 키 | ✅ 적용 | `test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq` |
| 라이브 키 | ⏸ 대기 | 사업자등록증 + 정산계좌 등록 필요 |
| Webhook | ✅ 구현 | `/api/payments/webhook` (멱등성 OK) |
| 환불 | ✅ 구현 | `/api/payments/refund` |

**대응 계획**:
- 사업자등록 완료 → TossPayments 가맹 신청
- Render env에서 `TOSS_*` 키 교체 + 재배포
- 첫 결제 후 정산일정 모니터링 (T+2 정산)

---

## 3. 외부몰 픽셀 연동

| 항목 | 상태 | 비고 |
|---|---|---|
| JS 픽셀 빌드 | ✅ | `/public/pixel/sponpik-pixel.js` |
| Postback API | ✅ | `/api/external/track`, `/api/external/postback/*` |
| HMAC 서명 | ✅ | `X-Sponpik-Signature` (SHA-256) |
| 도메인 화이트리스트 | ✅ | `PixelInstall.domains[]` |
| 픽셀 관리 화면 | ✅ | `/admin/pixel-management` |

**알려진 제약**:
- iframe 내 측정 불가 (브라우저 보안 정책)
- ITP/Safari: 7일 후 1st-party 쿠키 만료 — `anonymousId` 재발급 가능성
- 광고 차단기(uBlock 등): 약 5~10% 미수집 가능 → 추정 보정 필요

---

## 4. CDN / 이미지

| 항목 | 상태 | 비고 |
|---|---|---|
| Cloudinary | ✅ 활용 | `getStorageService()` 헬퍼 |
| Local fallback | ✅ | Cloudinary 미설정 시 자동 |
| PDF 이미지 추출 | ✅ | PyMuPDF(`fitz`) — 5명 사진 추출 완료 |
| 영상 처리 | ⏸ | rembg 통합은 백오피스 도구 단독 |

---

## 5. WebSocket (실시간 입찰)

| 항목 | 상태 | 비고 |
|---|---|---|
| `useAuctionSocket` 훅 | ✅ | bid:placed / auction:extended / auction:status 이벤트 |
| 재연결 로직 | ✅ | exponential backoff |
| 부하 한계 | ⚠️ | 동시 1,000명 미테스트 |

**대응 계획**: 부하 테스트 (Phase 2) → Redis Pub/Sub 도입 검토

---

## 6. 카카오 / 네이버 검색량 (브랜드 ROI 보강)

| 항목 | 상태 |
|---|---|
| Kakao Search Trend | ❌ 미연동 |
| Naver Datalab | ❌ 미연동 |

**현재 운영**: ROI 대시보드의 "검색량 변동" 지표는 `-`로 표시 (DataSourceBadge: 미수집)
**Phase 2 계획**: SearchAd API 키 발급 → 일별 동기화 cron

---

## 7. KYC / 본인인증

| 항목 | 상태 |
|---|---|
| 자동 인증 (NICE/PASS) | ❌ 미연동 |
| 수동 검수 | ✅ | `/admin/kyc` |

**대응**: 1차 운영은 수동 KYC. 사용자 100명 이상 시 자동 인증 도입.

---

## 8. 영상 분석 (자동 노출 측정)

| 항목 | 상태 |
|---|---|
| 영상 업로드 | ✅ | `/admin/roi/vod` |
| 자동 검출 | ⏸ | vast.ai GPU 서버 (CLIP ViT-B/32) 준비됨 |
| 자동 반영 | ❌ | 검출 결과 → ROI 카운트 자동 반영 미완 |

**현재 운영**:
- 영상 업로드 → 수동 검출 트리거 → 검수자가 결과 확인 → 수동 반영
- ROI 노출 카운트는 `RoiExposure` 테이블에 수동 입력

**Phase 2 계획**: cron에서 자동 검출 → 신뢰도 0.85 이상 자동 반영

---

## 9. 알림 (Push / Slack)

| 항목 | 상태 |
|---|---|
| 인앱 알림 | ✅ | `Notification` 모델 + `/notifications` |
| 이메일 | ❌ | SMTP 미설정 |
| Slack 운영 알림 | ❌ | Webhook 미등록 |

**Phase 2**: SES + Slack incoming webhook 등록.

---

## 10. 결론 / 권고

### 1차 론칭에 영향 없음 (수동 운영 가능)
- GTOUR API
- 영상 자동 분석
- 검색량 데이터
- 자동 KYC

### 1차 론칭 전 반드시 정리 필요
- TossPayments 라이브 키 (사업자등록 후 즉시)
- Cloudinary 업로드 한도 모니터링
- Render/Vercel/Railway 결제 카드 등록 확인
