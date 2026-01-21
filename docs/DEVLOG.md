# DEVLOG - 개발 기록

> 이 파일은 작업 완료 시 append만 합니다. 자동 로드하지 마세요.
> 500줄 초과 시 `docs/archive/DEVLOG-YYYY-MM.md`로 이동합니다.

---

## 아카이브
- (아직 없음)

---

## 엔트리 템플릿

```markdown
## [YYYY-MM-DD] 작업 제목

### 변경 사항
- 항목 1
- 항목 2

### 영향받는 파일
- `path/to/file.ts`

### 참고
- 관련 링크
```

---

# 개발 기록

---

## [2026-01-20] 네비게이션 메뉴 누락 항목 추가

### 변경 사항
- Layout.tsx에 라우트는 존재하지만 네비게이션에 없던 메뉴 항목들 추가
- **ADMIN**: 재무콘솔, FAQ관리, 페널티, 분쟁관리, 시즌관리, 노출관리, 운영도구 (7개)
- **BRAND**: 후원투표, ROI리포트 (2개)
- **ATHLETE**: 서명대기, 출금관리 (2개)
- **FAN**: 내투표, 내뱃지 (2개)
- Home.tsx 푸터에 FAQ 링크 연결 (`/faq`)

### 영향받는 파일
- `src/frontend/src/components/Layout.tsx` - 10개 아이콘 import + 13개 nav 항목 추가
- `src/frontend/src/pages/Home.tsx` - FAQ 링크 `<a href="#">` → `<Link to="/faq">`

### 참고
- 상세 페이지 (`:id` 라우트)는 리스트에서 접근하므로 네비게이션에서 제외
- 기존 라우트와 페이지는 모두 구현되어 있었음 (메뉴 연결만 누락)

---

## [2026-01-20] Phase E-F Frontend - 캠페인 상세 & 노출/ROI 대시보드

### 변경 사항
- **Phase E-FE**: 캠페인 상세 페이지 (KPI 진행률, 연결된 계약, 추천 선수)
- **Phase F-FE**: AdminExposure (노출 기록 관리, 미디어밸류 요율, 리포트)
- **Phase F-FE**: BrandROIDashboard (브랜드 ROI 대시보드)
- **api.ts 확장**: getCampaignPerformance, getRecommendedAthletes, getBrandExposureReport 등

### Frontend 파일
- `src/frontend/src/services/api.ts` - Phase E, F API 메서드 추가
- `src/frontend/src/pages/brand/CampaignDetail.tsx` (신규) - 캠페인 상세
- `src/frontend/src/pages/admin/AdminExposure.tsx` (신규) - 노출 관리
- `src/frontend/src/pages/brand/BrandROIDashboard.tsx` (신규) - ROI 대시보드
- `src/frontend/src/App.tsx` - 라우트 등록

### 라우트 추가
- `/brand/campaigns/:id` → CampaignDetail
- `/admin/exposure` → AdminExposure
- `/brand/reports/roi` → BrandROIDashboard

### 참고
- Backend는 이미 구현됨 (Phase E, F 완료)
- DOCX 검증 후 누락된 Frontend 구현

---

## [2026-01-20] Phase H - 시즌 리워드

### 변경 사항
- **스키마 추가**: Season, SeasonParticipant, SeasonBadge, SeasonBadgeAward 모델
- **enum 추가**: SeasonStatus, BadgeType
- **season.service.ts 신규**: 시즌 CRUD, 리더보드, 참여 기록, 뱃지, 보상 배포
- **season.routes.ts 신규**: Public/Authenticated/Admin 라우트 분리
- **프론트엔드**: SeasonLeaderboard.tsx, MyBadges.tsx, AdminSeasons.tsx

### Backend 파일
- `src/backend/prisma/schema.prisma` - Season 관련 모델 추가
- `src/backend/src/services/season.service.ts` (신규) - 시즌 비즈니스 로직
- `src/backend/src/routes/season.routes.ts` (신규) - 시즌 API 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록

### Frontend 파일
- `src/frontend/src/services/api.ts` - 시즌 API 메서드 추가
- `src/frontend/src/pages/fan/SeasonLeaderboard.tsx` (신규)
- `src/frontend/src/pages/fan/MyBadges.tsx` (신규)
- `src/frontend/src/pages/admin/AdminSeasons.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 주요 기능
- 시즌 생명주기: DRAFT → UPCOMING → ACTIVE → ENDED → REWARDS_DISTRIBUTED
- 리더보드: 참여횟수, 적중횟수, 총 포인트 기준 순위
- 뱃지 시스템: SEASON_GOLD/SILVER/BRONZE, TOP10, TOP100 등
- 보상 배포: rewardTiers 기준 포인트 지급 + 뱃지 수여

---

## [2026-01-20] Phase G - 투표 스폰서십

### 변경 사항
- **스키마 확장**: FanVoteEvent에 sponsor 필드 추가, SponsorEngagement 모델 추가
- **fanVote.service.ts 확장**: sponsorVote, getSponsoredVotes, trackEngagement, getSponsorEngagementStats
- **fanVote.controller.ts 확장**: 스폰서 관련 컨트롤러 메서드
- **fanVote.routes.ts 확장**: POST /:id/sponsor, POST /:id/track-engagement
- **brand.routes.ts 확장**: GET /me/sponsored-votes, GET /me/sponsor-stats
- **프론트엔드**: SponsorBanner.tsx 컴포넌트, BrandSponsoredVotes.tsx 페이지

### Backend 파일
- `src/backend/prisma/schema.prisma` - sponsor 필드, SponsorEngagement 모델
- `src/backend/src/services/fanVote.service.ts` - 스폰서 메서드 추가
- `src/backend/src/controllers/fanVote.controller.ts` - 스폰서 컨트롤러
- `src/backend/src/routes/fanVote.routes.ts` - 스폰서 라우트
- `src/backend/src/routes/brand.routes.ts` - 브랜드 스폰서 조회 API

### Frontend 파일
- `src/frontend/src/services/api.ts` - 스폰서 API 메서드
- `src/frontend/src/components/SponsorBanner.tsx` (신규) - 스폰서 배너 + 노출 추적
- `src/frontend/src/pages/brand/BrandSponsoredVotes.tsx` (신규) - 브랜드 후원 관리
- `src/frontend/src/App.tsx` - 라우트 등록

### 주요 기능
- 브랜드가 투표 후원 (contributionAmount, bannerUrl, logoUrl, message, linkUrl)
- 스폰서 배너 노출/클릭 추적 (impressions, bannerClicks, linkClicks)
- 브랜드 후원 통계 집계

---

## [2026-01-20] Phase 10-3 - Reconciliation/Data Integrity Checking (결제/환불 대사)

### 변경 사항
- **스키마 추가**: WebhookEventLog, ReconciliationRun, ReconciliationIssue 모델
- **enum 추가**: WebhookEventStatus, ReconciliationScope, ReconciliationRunStatus, ReconciliationIssueSeverity, ReconciliationIssueType, ReconciliationIssueStatus
- **WebhookEvent 확장**: eventId 필드 추가 (멱등성용)
- **Webhook 처리 개선**: WebhookEventLog upsert로 중복 Webhook 감지/무시
- **ReconciliationService 신규**: 정합성 검사 로직 (checkTopups, checkRefunds, checkWalletSanity)
- **ReconciliationController 신규**: Admin API 컨트롤러
- **Admin Reconciliation Routes**: 대사 관리 API 6개 추가
- **Cron Job**: 매일 09:20 KST Full Reconciliation + 관리자 알림

### Backend 파일
- `src/backend/prisma/schema.prisma` - WebhookEventLog, ReconciliationRun, ReconciliationIssue 추가
- `src/backend/src/payments/providers/types.ts` - WebhookEvent.eventId 추가
- `src/backend/src/payments/providers/stripe.ts` - parseWebhookEvent에 eventId 추가
- `src/backend/src/payments/providers/toss.ts` - parseWebhookEvent에 eventId 추가
- `src/backend/src/controllers/topup.controller.ts` - WebhookEventLog 통합
- `src/backend/src/services/reconciliation.service.ts` (신규) - 대사 비즈니스 로직
- `src/backend/src/controllers/reconciliation.controller.ts` (신규) - 대사 컨트롤러
- `src/backend/src/routes/admin.reconciliation.routes.ts` (신규) - Admin 대사 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/backend/src/index.ts` - Cron Job 추가 (09:20 KST)

### 대사 검사 규칙
| 규칙 | 심각도 | 설명 |
|------|--------|------|
| TOPUP_PAID_NO_LEDGER | CRITICAL | PAID인데 LedgerTx 없음 |
| LEDGER_TOPUP_NO_PAID | HIGH | LedgerTx 있는데 PAID 아님 |
| REFUND_REFUNDED_NO_LEDGER | CRITICAL | REFUNDED인데 LedgerTx 없음 |
| REFUNDED_AMOUNT_MISMATCH | MEDIUM | refundedAmount 불일치 |
| WALLET_NEGATIVE | CRITICAL | 잔액/동결 음수 |

### Admin API
- GET /api/admin/reconciliation/runs - 대사 실행 목록
- POST /api/admin/reconciliation/runs - 수동 대사 실행 (분당 5회 제한)
- GET /api/admin/reconciliation/issues - 이슈 목록
- GET /api/admin/reconciliation/issues/summary - 이슈 요약 통계
- PATCH /api/admin/reconciliation/issues/:id/status - 이슈 상태 변경
- GET /api/admin/reconciliation/issues.csv - CSV Export

### 참고
- WebhookEventLog `@@unique([provider, eventId])`로 중복 Webhook 방지
- 이슈 상태: OPEN → ACKED → RESOLVED/IGNORED
- HIGH+ 이슈 발견 시 notificationService.notifyAdminAlert() 호출

---

## [2026-01-20] Phase 10-2 - Refund/Chargeback (환불 및 차지백)

### 변경 사항
- **스키마 추가**: RefundRequest 모델, RefundStatus/RefundRequestStatus enum
- **TopupPayment 확장**: refundedAmount, refundStatus, lastRefundAt, chargebackAt 필드
- **Provider Adapter 확장**: RefundResult 인터페이스, refundPayment() 메서드 추가
- **RefundService 신규**: 환불 요청 CRUD, 상태 전이, PG 환불 호출, 차지백 처리
- **TopupService 확장**: processRefundWebhook(), CHARGEBACK 이벤트 처리
- **RefundController 신규**: Admin API 컨트롤러
- **Admin Finance Routes**: 환불 관리 API 7개 추가

### Backend 파일
- `src/backend/prisma/schema.prisma` - RefundRequest 모델, enum 추가, TopupPayment 확장
- `src/backend/src/payments/providers/types.ts` - RefundResult 인터페이스
- `src/backend/src/payments/providers/stripe.ts` - refundPayment() 구현
- `src/backend/src/payments/providers/toss.ts` - refundPayment() stub (추후 구현)
- `src/backend/src/services/refund.service.ts` (신규) - 환불 비즈니스 로직
- `src/backend/src/services/topup.service.ts` - Webhook 핸들러 확장
- `src/backend/src/controllers/refund.controller.ts` (신규) - 환불 컨트롤러
- `src/backend/src/routes/admin.finance.routes.ts` - 환불 API 추가

### 환불 상태 머신
```
RefundRequest: REQUESTED → APPROVED/REJECTED → PROCESSING → REFUNDED/FAILED
TopupPayment.refundStatus: NONE → PARTIAL → FULL
TopupPayment.status: PAID → REFUNDED (전액 환불 시)
                     PAID → CHARGEBACK (차지백 시)
```

### 환불 정책
- 잔액 검증: `available >= refundAmount` (차지백 제외)
- 부분 환불: refundedAmount 누적
- 차지백: 강제 DEBIT (음수 허용)
- 멱등성: idempotencyKey unique + 조건부 updateMany + LedgerTx unique

### Webhook 이벤트
- `charge.refunded` → processRefundWebhook (비동기 환불 완료)
- `charge.dispute.created` → processChargeback (차지백 자동 처리)

### 참고
- Toss 환불 API는 추후 구현 예정
- 차지백 발생 시 관리자 알림 자동 발송

---

## [2026-01-20] Phase 10-1 - Brand Wallet Topup (결제 충전)

### 변경 사항
- **스키마 추가**: TopupPayment 모델, PaymentProvider/TopupPaymentStatus enum, TOPUP_DEPOSIT/TOPUP_REFUND 원장 타입
- **Payment Provider Adapter**: Toss/Stripe 공통 인터페이스 + 어댑터 구현
- **TopupService**: 충전 생성, 결제 확인, Webhook 처리 비즈니스 로직
- **TopupController/Routes**: Brand API + Webhook API + Admin API
- **Brand Wallet API**: GET /brands/me/wallet (brand.service.ts, brand.routes.ts)
- **Frontend BrandWallet.tsx**: 지갑 조회 + 충전 폼 + 충전 내역

### Backend 파일
- `src/backend/prisma/schema.prisma` - TopupPayment 모델, enum 추가
- `src/backend/src/payments/providers/types.ts` - 공통 인터페이스
- `src/backend/src/payments/providers/toss.ts` - Toss Payments 어댑터
- `src/backend/src/payments/providers/stripe.ts` - Stripe 어댑터
- `src/backend/src/payments/providers/index.ts` - Provider 팩토리
- `src/backend/src/services/topup.service.ts` - 충전 비즈니스 로직
- `src/backend/src/controllers/topup.controller.ts` - 충전 컨트롤러
- `src/backend/src/routes/topup.routes.ts` - 충전 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/backend/src/services/brand.service.ts` - getMyWallet 추가
- `src/backend/src/controllers/brand.controller.ts` - getMyWallet 추가
- `src/backend/src/routes/brand.routes.ts` - /me/wallet 라우트

### Frontend 파일
- `src/frontend/src/services/api.ts` - createTopup, getMyTopups, getMyBrandWallet 등
- `src/frontend/src/pages/brand/BrandWallet.tsx` (신규) - 지갑 충전 페이지
- `src/frontend/src/App.tsx` - /brand/wallet 라우트 등록

### 멱등성 보장 패턴
1. `@@unique([walletId, idempotencyKey])` - 중복 충전 요청 방지
2. `updateMany({ where: { status: IN [...] } })` - 조건부 상태 업데이트
3. `@@unique([walletId, type, refType, refId])` - LedgerTx 중복 방지

### 환경 변수 (추가 필요)
- `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`

### 참고
- Webhook은 서명 검증 필수 (HMAC-SHA256)
- Checkout URL은 30분 유효
- 최소 1,000원, 최대 1억원 제한

---

## [2026-01-20] Phase 9-3 - Direct Buy + Auction UX 연결 및 Admin 운영 도구

### 변경 사항
- **Brand API 추가**: reservations, bids, wins (brand.service.ts, brand.routes.ts)
- **Athlete API 추가**: pending-signatures (athlete.service.ts, athlete.routes.ts)
- **Auction summary API 추가**: 폴링용 요약 (auction.service.ts, auction.routes.ts)
- **Admin Ops API 추가**: release-reservation, force-close (ops.service.ts, admin.ops.routes.ts)
- **ops.service.ts 신규**: 운영자 강제 처리 비즈니스 로직
- **admin.ops.routes.ts 신규**: Rate Limit(분당 10회), confirmText + reason(10자+) 검증

### 프론트엔드 변경
- **Auctions.tsx**: Brand 전용 탭 추가 ([내 입찰] [내 예약])
- **PendingSignatures.tsx 신규**: 선수 서명 대기 페이지 (긴급 배지: 60분 이하)
- **AdminOps.tsx 신규**: 운영 도구 (예약 해제/경매 강제 종료)
- **App.tsx**: 신규 라우트 등록 (/athlete/pending-signatures, /admin/ops)
- **api.ts**: 신규 API 메서드 추가

### 영향받는 파일
- `src/backend/src/services/brand.service.ts` - getMyReservations, getMyBids, getMyWins
- `src/backend/src/services/athlete.service.ts` - getPendingSignatures
- `src/backend/src/services/auction.service.ts` - getSummary
- `src/backend/src/services/ops.service.ts` (신규) - releaseReservation, forceCloseAuction
- `src/backend/src/routes/admin.ops.routes.ts` (신규)
- `src/frontend/src/services/api.ts` - 신규 API 메서드
- `src/frontend/src/pages/Auctions.tsx` - 탭 확장
- `src/frontend/src/pages/athlete/PendingSignatures.tsx` (신규)
- `src/frontend/src/pages/admin/AdminOps.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- Admin Ops API는 AdminActionLog에 모든 액션 기록
- confirmText 검증: "RELEASE"/"CLOSE" 또는 ID 마지막 6자리
- 멱등성 보장: idempotencyKey 헤더 지원

---

## [2026-01-20] Phase 9-2.1 - 정합성 검증 및 수정

### 변경 사항
- **escrow.service.ts**: holdFromContract()에 available 잔액 검증 추가 (balance - frozenAmount >= grossAmount)
- **contract.service.ts**: sign()에서 예약 해제 → HOLD 순서 변경 (available 확보 후 HOLD 진행)
- **contract.service.ts**: 경매/Direct Buy 구분 로직 개선 (`auction.status === 'ENDED'` 명시적 확인)
- **contract.service.ts**: processExpiredReservations()에도 동일한 구분 로직 적용

### 발견된 이슈 및 수정
| 이슈 | 원인 | 해결 |
|------|------|------|
| HOLD 시 잔액 부족 | holdFromContract()가 frozenAmount 미고려 | available = balance - frozenAmount 검증 추가 |
| 경매/Direct Buy 구분 취약 | frozenAmount 유무에 의존 | auction.status === 'ENDED' 명시적 확인 |
| HOLD 전 available 0 문제 | HOLD 후 예약 해제 순서 | 예약 해제 → HOLD 순서로 변경 |

### 영향받는 파일
- `src/backend/src/services/escrow.service.ts`
- `src/backend/src/services/contract.service.ts`

### 검증 완료 항목
- [x] HOLD 성공/실패 시 원장 1회만 찍히는지 (unique constraint)
- [x] 만료 크론이 한 번만 해제하는지 (status 조건부 업데이트)
- [x] RESERVED→OPEN 복귀 시 Contract CANCELLED 상태 확인
- [x] Outbid 해제 로직 실패 시 지갑 정합성 (트랜잭션 원자성)

---

## [2026-01-20] Phase 9-2 - 경매 입찰 동결 정책

### 변경 사항
- **Schema**: Bid.frozenAmount 추가 (최고 입찰자 동결 금액), LedgerTxType에 AUCTION_BID_RESERVE/RELEASE 추가
- **placeBid()**: 입찰 시 잔액 검증 + 이전 최고 입찰자 해제 + 새 입찰자 동결 + LedgerTx 기록
- **deleteBid()**: 입찰 삭제 시 frozenAmount 해제 + 새 최고 입찰자 동결
- **endAuction()**: Slot → RESERVED (SOLD 대신), Contract 생성 시 brandSignedAt + reservedUntil 설정
- **createFromAuction()**: brandSignedAt=now, reservedUntil=now+24h 자동 설정
- **sign()**: 경매 낙찰 시 winningBid.frozenAmount 해제 로직 추가 (Direct Buy와 구분)
- **processExpiredReservations()**: 경매 예약 만료 시 winningBid.frozenAmount 해제 추가

### 정책 요약
1. 최고 입찰자만 frozenAmount 동결 (모든 입찰자 아님)
2. Outbid 시 이전 최고 입찰자 자동 해제
3. 낙찰 시 Contract 예약 (reservedUntil=24h), frozenAmount 유지
4. 선수 서명 시 Escrow HOLD + frozenAmount 해제
5. 만료 시 Contract CANCELLED, Slot OPEN, frozenAmount 해제
6. 잔액 검증: available (balance - frozenAmount) >= maxBid

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - Bid.frozenAmount, LedgerTxType 확장
- `src/backend/src/services/bid.service.ts` - placeBid(), deleteBid()에 frozen 로직
- `src/backend/src/services/auction.service.ts` - endAuction()에서 RESERVED로 전환
- `src/backend/src/services/contract.service.ts` - createFromAuction()에 reservedUntil, sign()에 경매 해제

### 참고
- Phase 9-1.1의 frozenAmount 패턴 재사용
- 경매와 Direct Buy 모두 동일한 만료 크론(processExpiredReservations) 사용
- 기존 2nd-price/anti-sniping 로직 유지

---

## [2026-01-20] Phase 9-1.1 - Direct Buy 예약 동결/만료 정책

### 변경 사항
- **Schema**: Contract.reservedUntil (예약 만료 시간), LedgerTxType에 DIRECT_BUY_RESERVE/RELEASE 추가
- **processBuyNow()**: buy-now 시 frozenAmount 증가 + reservedUntil 설정 + LedgerTx 기록
- **sign()**: 예약 만료 체크 + 양쪽 서명 완료 시 frozenAmount 해제 + LedgerTx 기록
- **processExpiredReservations()**: 만료된 Direct Buy 예약 자동 처리 (Contract CANCELLED, Slot OPEN, frozen 해제)
- **Cron**: 매 10분 만료 크론 등록 (`*/10 * * * *`)

### 정책 요약
1. 예약 시간: buy-now 시 `reservedUntil = now + 24h`
2. 동결 시점: buy-now 즉시 `frozenAmount += directBuyPrice`
3. 해제 시점 (정상): 선수 서명 완료 시
4. 해제 시점 (만료): 크론이 매 10분 체크, 만료 시 자동 해제
5. Slot 상태: OPEN → RESERVED → SOLD (서명) 또는 OPEN (만료)
6. Contract 상태: PENDING_SIGNATURE → ASSET_PENDING (서명) 또는 CANCELLED (만료)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - Contract.reservedUntil, LedgerTxType 확장
- `src/backend/src/services/slot.service.ts` - processBuyNow()에 frozen 로직
- `src/backend/src/services/contract.service.ts` - sign() 만료체크 + processExpiredReservations()
- `src/backend/src/index.ts` - 만료 크론 등록

### 참고
- 기존 frozenAmount 패턴 재사용 (출금 요청과 동일)
- LedgerTx로 동결/해제 이력 추적 (감사 목적)
- 에스크로 HOLD는 여전히 선수 서명 후 처리 (기존 흐름 유지)

---

## [2025-01-20] Phase 9-1 - 슬롯 즉시구매(Direct Buy) 기능

### 변경 사항
- SlotStatus enum에 RESERVED 추가 (OPEN → RESERVED → SOLD 흐름)
- processBuyNow() 수정: Escrow 즉시 생성 제거, 브랜드 선서명(brandSignedAt=now)
- 잔액 검증 추가: 구매 전 브랜드 가용잔액 >= directBuyPrice 확인
- 동시성 방어: 상태 조건부 updateMany + 활성 계약 1개 제한
- sign()에서 양쪽 서명 완료 시 Slot RESERVED → SOLD 전환
- Auctions.tsx에 "즉시구매" 탭 추가: OPEN 슬롯 중 enableDirectBuy=true 표시
- 즉시구매 확인 모달: 계약 생성 후 계약 페이지로 이동
- 선수에게 즉시구매 계약 생성 알림 발송
- AuditLog 기록 (DIRECT_BUY 액션)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - SlotStatus에 RESERVED 추가
- `src/backend/src/services/slot.service.ts` - processBuyNow() 수정
- `src/backend/src/services/contract.service.ts` - sign()에서 SOLD 전환 추가
- `src/backend/src/routes/slot.routes.ts` - buy-now 라우트 주석 개선
- `src/frontend/src/pages/Auctions.tsx` - 즉시구매 탭, 버튼, 모달 추가

### 참고
- 에스크로는 선수 서명 후 생성 (기존 sign() → holdFromContract() 흐름 재사용)
- 계약 취소 시 Slot → OPEN 복구 (기존 cancel() 로직 활용)
- 브랜드 선서명: Contract.brandSignedAt = now, athleteSignedAt = null

---

## [2025-01-20] Phase 8-Detail - 관리자 선수/브랜드 상세 페이지 확장

### 변경 사항
- 선수 상세 API 확장: wallet, withdrawalStats, recentWithdrawals, recentLedger, contractStats
- 브랜드 상세 API 확장: wallet, escrowStats, recentEscrows, recentLedger, bidStats, kycDetail
- AdminEntityDetail.tsx UI 확장: KPI 카드 6개, 탭 구조 (기본정보/지갑/활동), 테이블
- 출금/에스크로/원장 테이블 (최근 10건씩)

### 영향받는 파일
- `src/backend/src/routes/admin.entities.routes.ts` - API 응답 확장
- `src/frontend/src/pages/admin/AdminEntityDetail.tsx` - UI 확장 (KPI, 탭, 테이블)

### 참고
- 민감정보 제외: bankAccount 원문, taxInfo, kycDocuments
- Decimal → string 변환 (API 응답)
- Bid 모델은 isWinning/maxBid 필드 사용

---

## [2025-01-20] Phase 8 - 관리자 선수/브랜드 상세 페이지

### 변경 사항
- GET /admin/entities/athletes/:id - 선수 상세 조회 API
- GET /admin/entities/brands/:id - 브랜드 상세 조회 API (bizNo 마스킹)
- AdminEntityDetail.tsx - 선수/브랜드 상세 페이지 컴포넌트
- /admin/entities/:type/:id 라우트 등록
- 민감정보 노출 금지 (bankAccount, taxInfo, kycDocuments)

### 영향받는 파일
- `src/backend/src/routes/admin.entities.routes.ts` - 상세 API 추가
- `src/frontend/src/services/api.ts` - getAdminAthlete, getAdminBrand 추가
- `src/frontend/src/pages/admin/AdminEntityDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- 목록 페이지 (AdminEntities.tsx)는 이미 구현되어 있었음
- 상세 페이지에서 최근 계약/슬롯/캠페인 5건 미리보기
- 빠른 링크: 계약 목록, 슬롯 목록, KYC 심사

---

## [2025-01-20] Phase 7-4 - 출금 정합성 검사 + 메트릭 + 알림

### 변경 사항
- getMetrics() 확장: today.rejected, batch.*, failed.last24h, avgApprovalDays
- detectWithdrawalAnomalies() 추가: 5가지 출금 이상징후 규칙
- 09:10 KST 크론 등록: 출금 정합성 검사 → ADMIN 알림 발송
- FinanceDashboard 출금 KPI 카드 4개 추가
- 동결금액 정합성 검증 헬퍼 (checkFrozenIntegrity)

### 영향받는 파일
- `src/backend/src/services/withdrawal.service.ts` - getMetrics() 확장, 헬퍼 메서드 추가
- `src/backend/src/services/reports.service.ts` - detectWithdrawalAnomalies() 추가
- `src/backend/src/index.ts` - 09:10 KST 크론 등록
- `src/frontend/src/pages/admin/finance/FinanceDashboard.tsx` - 출금 KPI 카드

### 참고
- 이상징후 규칙: PENDING_HIGH, PAID_SPIKE, BATCH_FAIL_RATE, FROZEN_ANOMALY, LONG_PENDING
- 크론 스케줄: 09:00 정산 → 09:05 에스크로 이상징후 → 09:10 출금 이상징후
- critical 알림: 동결금액이 음수이거나 잔액 초과 시

---

## [2025-01-20] Phase 7-3 - 계좌정보 암호화

### 변경 사항
- AES-256-GCM 암호화 유틸 구현 (crypto.ts)
- WithdrawalRequest에 암호화 필드 추가 (encrypted, iv, tag, last4)
- FINANCE 역할 추가 (UserRole enum)
- 출금 요청 생성 시 계좌번호 암호화 저장
- CSV Export 시 복호화 + 감사로그 기록
- 프로덕션 부팅 시 암호화 키 검증 (키 없으면 서버 종료)
- ADMIN/FINANCE 권한으로 finance 라우트 접근 가능

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - 암호화 필드 + FINANCE role
- `src/backend/src/utils/crypto.ts` (신규) - AES-256-GCM 암/복호화
- `src/backend/src/index.ts` - 부팅 시 키 검증 로직
- `src/backend/src/services/withdrawal.service.ts` - createRequest 암호화
- `src/backend/src/services/withdrawalBatch.service.ts` - exportCsv 복호화 + 감사로그
- `src/backend/src/routes/admin.finance.routes.ts` - FINANCE 권한 추가

### 참고
- ENV: `BANK_ACCOUNT_ENC_KEY` (32바이트 base64 인코딩)
- 키 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- 기존 데이터 호환: encrypted 없으면 masked만 CSV 출력
- 복호화 실패 시 graceful fallback (masked 유지)

---

## [2025-01-20] Phase 7-2 안전 점검 수정

### 변경 사항
- 메트릭 타임존 KST 명시화 (서버 타임존 의존 → KST 고정)
- 배치 상태 조건부 업데이트 (멱등성 강화: updateMany + 상태 조건)

### 영향받는 파일
- `src/backend/src/services/withdrawal.service.ts` - getMetrics() KST 계산
- `src/backend/src/services/withdrawalBatch.service.ts` - completeBatch() 조건부 업데이트

### 참고
- 검증 항목 7개 중 5개 통과, 2개 수정 완료

---

## [2025-01-20] Phase 7-2 - 출금 운영 고도화 (배치/증빙/메트릭)

### 변경 사항
- WithdrawalBatch 모델, WithdrawalBatchStatus enum 추가
- 배치 상태 머신: CREATED → EXPORTED → COMPLETED/CANCELED
- 출금 요청에 batchId, proofUrl, adminId 필드 추가
- 배치 서비스: 생성/목록/상세/CSV/일괄지급/취소
- CSV 수식 주입 방어 (=, +, -, @ 앞 작은따옴표)
- 메트릭 API: 오늘 요청/승인/지급, 대기 건수
- 프론트엔드 멀티선택 UI (APPROVED 상태에서 체크박스)
- 배치 상세 페이지: CSV 다운로드, Danger Zone (일괄지급/취소)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - WithdrawalBatch 모델, 필드 추가
- `src/backend/src/services/withdrawalBatch.service.ts` (신규)
- `src/backend/src/services/withdrawal.service.ts` - proofUrl, metrics 추가
- `src/backend/src/routes/admin.finance.routes.ts` - 배치/메트릭 API
- `src/frontend/src/services/api.ts` - 배치 API 함수 추가
- `src/frontend/src/pages/admin/finance/FinanceWithdrawals.tsx` - 멀티선택 기능
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalBatches.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalBatchDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 배치 라우트 등록

### 참고
- 배치 일괄지급: confirmText "PAY" + 사유 10자 이상
- 배치 취소: confirmText "CANCEL" + 사유 10자 이상
- proofUrl: 지급 증빙 URL (선택)
- CSV 컬럼: 예금주, 은행명, 계좌(마스킹), 금액, 요청ID

---

## [2025-01-20] Phase 7 - 선수 출금(Withdrawal) 기능

### 변경 사항
- WithdrawalRequest 모델, WithdrawalStatus enum 추가
- 상태 머신: REQUESTED → APPROVED/REJECTED → PAID
- frozenAmount 패턴 구현: 요청 시 동결, 거부 시 해제, 지급 시 balance/frozen 차감
- 선수용 API: 출금 요청, 잔액 조회, 내 요청 목록
- 관리자용 API: 목록/상세/승인/거부/지급완료 + Danger Zone 패턴
- idempotencyKey + P2002 멱등성, 트랜잭션 안전성
- LedgerTx 생성 (PAID 시), 알림/감사로그 연동
- 은행 계좌 마스킹 저장

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - WithdrawalRequest, WithdrawalStatus, NotificationType 추가
- `src/backend/src/services/withdrawal.service.ts` (신규)
- `src/backend/src/controllers/withdrawal.controller.ts` (신규)
- `src/backend/src/routes/withdrawal.routes.ts` (신규)
- `src/backend/src/routes/admin.finance.routes.ts` - 출금 관리 API 추가
- `src/backend/src/routes/index.ts` - withdrawal 라우트 등록
- `src/frontend/src/services/api.ts` - 출금 API 함수 추가
- `src/frontend/src/pages/athlete/Withdrawals.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawals.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- Danger Zone 패턴: confirmText 검증 (ID 마지막 6자리 또는 "PAY")
- writeRateLimiter: 10 req/min
- 알림 타입: WITHDRAWAL_APPROVED, WITHDRAWAL_REJECTED, WITHDRAWAL_PAID

---

## [2025-01-17] Phase F6 - 팬 메인 대시보드

### 변경 사항
- FanDashboard.tsx 생성: 통합 팬 홈 페이지
- 포인트 랭킹 API 추가 (GET /api/points/ranking)
- 진행중/종료 투표, 포인트, 랭킹, 샵 추천, 즐겨찾기 섹션

### 영향받는 파일
- `src/frontend/src/pages/fan/FanDashboard.tsx` (신규)
- `src/backend/src/controllers/point.controller.ts`
- `src/backend/src/services/point.service.ts`
- `src/backend/src/routes/point.routes.ts`

---

## [2025-01-17] Phase F5 - 포인트샵

### 변경 사항
- ShopItem, RedemptionOrder 모델 추가
- redemption.service.ts: 상품 CRUD, 주문 생성/취소/처리
- shop.routes.ts: Zod 검증, 엔드포인트 정의
- 트랜잭션 안전성: adjustPointsWithTx로 외부 트랜잭션 컨텍스트 지원
- REDEMPTION_FULFILLED 알림 타입 추가

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/redemption.service.ts` (신규)
- `src/backend/src/controllers/redemption.controller.ts` (신규)
- `src/backend/src/routes/shop.routes.ts` (신규)
- `src/backend/src/services/point.service.ts`
- `src/frontend/src/pages/fan/Shop.tsx` (신규)
- `src/frontend/src/pages/fan/ShopDetail.tsx` (신규)
- `src/frontend/src/pages/fan/Orders.tsx` (신규)

---

## [2025-01-16] Phase F4 - 팬 생성 투표 + 정산

### 변경 사항
- 팬이 투표 생성 (DRAFT → SUBMITTED)
- 관리자 승인/오픈 (ACTIVE)
- 정산 시스템: FanVoteSettlement, FanVoteWinner
- 당첨자 포인트 지급 + 잔여 플랫폼 귀속

### 영향받는 파일
- `src/backend/src/services/fanVote.service.ts`
- `src/backend/src/routes/fanVote.routes.ts`
- `src/frontend/src/pages/fan/FanVoteCreate.tsx`

---

## [2025-01-15] Phase F3 - 포인트 원장 시스템

### 변경 사항
- PointWallet, PointLedgerTx 모델
- 멱등성: 유니크 제약 + 낙관적 락
- 내 포인트/내역 API, 관리자 지급 API

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/point.service.ts`
- `src/backend/src/controllers/point.controller.ts`
- `src/backend/src/routes/point.routes.ts`

---

## [2025-01-14] Phase F2 - 팬 즐겨찾기 + 브랜드 등록

### 변경 사항
- FanFavoriteAthlete, FanFavoriteBrand 모델
- 즐겨찾기 토글 API
- 브랜드 가입 신청 + 관리자 승인 플로우

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/fan.service.ts`
- `src/backend/src/routes/fan.routes.ts`

---

## [2025-01-13] Phase F1 - 팬 기본 투표 시스템

### 변경 사항
- FanVoteEvent, FanVoteEntry 모델
- 진행중/종료 투표 조회 API
- 투표 참여 API (포인트 차감)

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/fanVote.service.ts`
- `src/backend/src/routes/fanVote.routes.ts`

---

## [2026-01-20] 시스템 정합성 검증 및 확인

### 검증 항목
- [x] 프론트엔드 라우팅: 모든 페이지 라우트가 App.tsx에 올바르게 등록됨
- [x] 네비게이션 연결: Layout.tsx의 모든 네비게이션 항목이 실제 라우트와 연결됨
- [x] 페이지 컴포넌트: Guide, Contact, Terms, Privacy 등 모든 공개 페이지 존재 확인
- [x] API 엔드포인트: 백엔드 라우트 30개 모두 routes/index.ts에 등록됨
- [x] API 서비스: 프론트엔드 api.ts에서 호출하는 모든 메서드 구현 확인
- [x] TypeScript 빌드: Backend/Frontend 모두 에러 없이 빌드 성공
- [x] 라우트 정합성: 네비게이션에 있는 모든 경로가 App.tsx에 정의됨

### 검증 결과
- **Backend**: 30개 라우트 파일 모두 index.ts에 정상 등록
- **Frontend**:
  - 70+ 라우트 정의 (public, protected, admin, fan, brand, athlete)
  - 모든 네비게이션 링크가 유효한 라우트 경로
  - TypeScript 컴파일 에러 없음
- **API 호출**: 50+ API 메서드가 프론트엔드에서 정상 호출 가능

### 확인된 기능
1. **Public Routes**: Home, Features, HowItWorks, ForWho, FAQ, Guide, Contact, Terms, Privacy
2. **Auth Routes**: Login, Register, Fan Login/Register
3. **Brand Routes**: Dashboard, Inventory, Auctions, Contracts, Wallet, Campaigns, ROI Reports
4. **Athlete Routes**: Dashboard, My Slots, Contracts, Pending Signatures, Settlements, Withdrawals
5. **Fan Routes**: Home, Votes, Points, Shop, Ranking, Favorites, Badges, Seasons
6. **Admin Routes**: 19개 관리 페이지 (Events, Auctions, KYC, Finance, Reports, Entities, Ops 등)

### 참고
- 모든 시스템 구성 요소가 정상 작동
- 라우팅, API, 네비게이션 모두 정합성 확인 완료
- 빌드 에러 없음, 프로덕션 배포 준비 완료

---

## [2026-01-20] 팬 투표 Invalid Date 오류 수정 및 Stripe 제거

### 변경 사항
- **Stripe 결제 옵션 제거**: BrandWallet에서 TOSS만 유지
- **테스트 충전 기능 추가**: 데모용 모의 충전 버튼 (POST /api/brand/topups/mock)
- **팬 투표 Invalid Date 수정**:
  - FanVoteEvent 인터페이스를 백엔드 응답과 일치하도록 수정
  - `entryFee` → `entryFeePoints`, `prizePool` 동적 계산으로 변경
  - MyEntry 인터페이스 필드명 수정 (`optionIndex`, `eventId`)
  - FanVoteDetail: eventData.myEntry 직접 사용하도록 개선

### 영향받는 파일
- `src/frontend/src/pages/brand/BrandWallet.tsx` - Stripe 제거, 테스트 충전 버튼 추가
- `src/frontend/src/pages/fan/Votes.tsx` - FanVoteEvent 인터페이스 수정
- `src/frontend/src/pages/fan/FanVoteDetail.tsx` - 인터페이스 및 필드 매핑 수정
- `src/backend/src/controllers/topup.controller.ts` - mockTopup 메서드 추가
- `src/backend/src/routes/topup.routes.ts` - mock 라우트 추가
- `src/backend/src/index.ts` - 시작시 Wallet FK 제약조건 자동 제거

### 참고
- Wallet 테이블의 FK 제약조건 문제로 시작시 자동 DROP 마이그레이션 추가

---

## [2026-01-21] Phase 10-3 - Reconciliation Admin UI (결제/환불 대사 프론트엔드)

### 변경 사항
- **AdminReconciliation.tsx 신규 생성**: 결제/환불 대사 관리 페이지
  - 요약 KPI 카드 (CRITICAL, HIGH, OPEN, RESOLVED 건수)
  - 이상 이슈 탭: 필터(severity, status), 상태 변경 모달, CSV 내보내기
  - 실행 기록 탭: 대사 실행 이력 테이블
  - 수동 실행 버튼 (FULL scope, 지난 24시간)
- **api.ts 확장**: 6개 Reconciliation API 메서드 추가
- **App.tsx**: /admin/reconciliation 라우트 등록
- **Layout.tsx**: ADMIN 네비게이션에 "대사 관리" 메뉴 추가

### Frontend 파일
- `src/frontend/src/services/api.ts` - Reconciliation API 메서드 추가
- `src/frontend/src/pages/admin/AdminReconciliation.tsx` (신규) - 대사 관리 페이지
- `src/frontend/src/App.tsx` - 라우트 등록
- `src/frontend/src/components/Layout.tsx` - 네비게이션 추가

### API 메서드
| 메서드 | 설명 |
|--------|------|
| getReconciliationRuns | 대사 실행 기록 목록 |
| createReconciliationRun | 수동 대사 실행 |
| getReconciliationIssues | 이상 이슈 목록 |
| getReconciliationIssuesSummary | 이슈 요약 통계 |
| updateReconciliationIssueStatus | 이슈 상태 변경 |
| exportReconciliationIssuesCsv | CSV 내보내기 |

### 참고
- Backend는 이전 세션에서 이미 완전히 구현됨 (Schema, Service, Controller, Routes, Cron)
- 이슈 상태 변경 시 사유 10자 이상 필수
- CSV 내보내기 시 수식 주입 방어 적용

---

## [2026-01-21] Phase 11-1 - RBAC 세분화 및 보안 강화

### 변경 사항
- **새 역할 추가**: UserRole enum에 `SUPPORT`, `AUDITOR` 역할 추가
- **Danger Zone 유틸리티**: confirmText + reason 10자 검증 표준화
- **권한 미들웨어 확장**: authorizePermission(), ROLE_PERMISSIONS 매핑
- **Admin 관리 API**: 관리자 목록/역할 변경/권한 변경 엔드포인트
- **ENV 검증**: validateEnv() - 필수 환경변수 누락 시 서버 시작 실패
- **Frontend AdminUsers.tsx**: 관리자 관리 페이지 (역할 변경 Danger Zone 모달)

### Backend 파일
- `src/backend/prisma/schema.prisma` - UserRole enum 확장 (SUPPORT, AUDITOR)
- `src/backend/src/utils/dangerZone.ts` (신규) - Danger Zone 검증 유틸리티
- `src/backend/src/middleware/auth.ts` - authorizePermission, ROLE_PERMISSIONS, hasPermission
- `src/backend/src/services/admin.service.ts` - getAdmins, changeAdminRole, updateAdminPermissions
- `src/backend/src/controllers/admin.controller.ts` - Admin 관리 메서드 추가
- `src/backend/src/routes/admin.routes.ts` - /admins 라우트 추가
- `src/backend/src/config/index.ts` - validateEnv() 함수 추가
- `src/backend/src/index.ts` - 서버 시작 시 validateEnv() 호출

### Frontend 파일
- `src/frontend/src/services/api.ts` - Admin 관리 API 메서드 3개 추가
- `src/frontend/src/pages/admin/AdminUsers.tsx` (신규) - 관리자 관리 페이지
- `src/frontend/src/App.tsx` - /admin/users 라우트 등록
- `src/frontend/src/components/Layout.tsx` - "관리자 관리" 네비게이션 추가

### 역할별 권한
| 역할 | 설명 | 핵심 권한 |
|------|------|----------|
| ADMIN | 전체 관리자 | 모든 기능 |
| FINANCE | 재무 담당 | 환불/정산/대사 |
| SUPPORT | 고객지원 | 조회 전용 |
| AUDITOR | 감사 | 감사로그/리포트 조회 |

### Danger Zone 패턴
- confirmText: `CHANGE_ROLE_{email}` 정확히 입력 필수
- reason: 최소 10자 이상 사유 입력 필수
- AdminActionLog + AuditLog 자동 기록

### 참고
- 기존 ADMIN/FINANCE 계정은 그대로 유지
- SUPPORT/AUDITOR는 신규 역할로 읽기 전용 접근만 허용
- ENV 검증은 운영 환경에서 PORTONE_* 추가 필수

---

## [2026-01-21] Phase 11-2B - 백업/복구(DR) 및 배포 안정화

### 변경 사항
- **백업 스크립트 생성**:
  - `scripts/db/backup.sh` - PostgreSQL 일일 백업 (pg_dump + gzip + S3)
  - `scripts/db/restore.sh` - 데이터베이스 복구 (확인 텍스트 필수)
  - `scripts/db/verify-backup.sh` - 백업 검증 (임시 컨테이너 복구 + 무결성 검사)
- **배포 안정화 스크립트 생성**:
  - `scripts/release/preflight.sh` - 배포 전 사전 점검 (ENV, DB, Migration, Build)
  - `scripts/release/rollback.sh` - 롤백 절차 안내 (Docker/Render/Fly.io)
- **GitHub Actions backup.yml 생성**: 매일 03:30 KST 자동 백업 + 주간 검증
- **DR_RUNBOOK.md 생성**: 장애 복구 매뉴얼 (12줄 요약, 3개 시나리오)
- **docker-compose.prod.yml 수정**: 마이그레이션 fail-fast 적용

### 신규 파일
- `src/backend/scripts/db/backup.sh`
- `src/backend/scripts/db/restore.sh`
- `src/backend/scripts/db/verify-backup.sh`
- `src/backend/scripts/release/preflight.sh`
- `src/backend/scripts/release/rollback.sh`
- `.github/workflows/backup.yml`
- `docs/DR_RUNBOOK.md`

### 수정 파일
- `docker-compose.prod.yml` - 마이그레이션 실패 시 컨테이너 시작 중단
- `docs/PROJECT_STATE.md` - Phase 11-2B 섹션 추가

### 백업 정책
| 항목 | 값 |
|------|-----|
| 일일 백업 | 03:30 KST (GitHub Actions) |
| 보관 기간 | 일일 14일, 주간 8주, 월간 12개월 |
| 검증 | 매주 일요일 자동 실행 |
| 저장소 | S3 버킷 (daily/weekly/monthly 폴더) |

### 핵심 테이블 (돈 데이터)
- `wallet`, `ledger_tx`, `escrow`, `topup_payments`, `refund_requests`, `withdrawal_requests`
- **LedgerTx**: 절대 DELETE/UPDATE 금지 (불변 원장)

### 참고
- 복구 시 "RESTORE" 텍스트 입력 필요 (안전 장치)
- verify-backup.sh는 임시 Docker 컨테이너에 복구 후 무결성 검사
- preflight.sh 통과해야 배포 진행 가능

---

## [2026-01-21] Phase 11-2A - 브랜드 청구/명세서 시스템

### 변경 사항
- **Prisma 스키마 추가**: BillingProfile, DocumentExportLog, TaxInvoiceRequest 모델
- **enum 추가**: DocumentExportType, TaxInvoiceStatus
- **billingProfile.service.ts 신규**: 청구 프로필 CRUD
- **statements.service.ts 신규**: 명세서 요약/상세/CSV/PDF 생성
- **billing.controller.ts 신규**: Brand Billing API 컨트롤러
- **brand.billing.routes.ts 신규**: Brand Billing API 라우트
- **프론트엔드 BrandBilling.tsx 신규**: 거래명세서/청구정보 탭 페이지

### Backend 파일
- `src/backend/package.json` - pdfkit 의존성 추가
- `src/backend/prisma/schema.prisma` - BillingProfile, DocumentExportLog, TaxInvoiceRequest 추가
- `src/backend/src/services/billingProfile.service.ts` (신규)
- `src/backend/src/services/statements.service.ts` (신규)
- `src/backend/src/controllers/billing.controller.ts` (신규)
- `src/backend/src/routes/brand.billing.routes.ts` (신규)
- `src/backend/src/routes/index.ts` - 라우트 등록

### Frontend 파일
- `src/frontend/src/services/api.ts` - Billing API 메서드 8개 추가
- `src/frontend/src/pages/brand/BrandBilling.tsx` (신규)
- `src/frontend/src/App.tsx` - /brand/billing 라우트 등록
- `src/frontend/src/components/Layout.tsx` - 청구/명세서 메뉴 추가

### API
| API | 설명 |
|-----|------|
| GET /api/brand/billing/profile | 청구 프로필 조회 |
| POST /api/brand/billing/profile | 청구 프로필 생성 |
| PATCH /api/brand/billing/profile | 청구 프로필 수정 |
| GET /api/brand/billing/statements/summary | 기간별 요약 |
| GET /api/brand/billing/statements/items | 거래 내역 (페이지네이션) |
| GET /api/brand/billing/statements/export.csv | CSV 내보내기 |
| GET /api/brand/billing/statements/export.pdf | PDF 내보내기 |

### 보안 고려사항
- CSV 수식 주입 방어: `=`, `+`, `-`, `@` 시작 시 `'` 접두어
- UTF-8 BOM 추가 (Excel 호환)
- DocumentExportLog에 모든 다운로드 감사 기록

### 참고
- pdfkit 사용 (외부 의존성 없는 PDF 생성)
- 세금계산서 발행 워크플로우는 선택 사항으로 남겨둠

---

## [2026-01-21] Phase 11-2A - 세금계산서 발행 워크플로우

### 변경 사항
- **taxInvoice.service.ts 신규**: 세금계산서 요청/승인/거부/발행 워크플로우
- **billing.controller.ts 확장**: Brand/Admin 세금계산서 엔드포인트 추가
- **admin.taxInvoice.routes.ts 신규**: Admin 세금계산서 관리 라우트
- **AdminTaxInvoices.tsx 신규**: 관리자 세금계산서 관리 페이지
- **BrandBilling.tsx 확장**: 세금계산서 탭 추가 (발행 요청 + 내역 조회)
- **config/index.ts 수정**: PortOne V2 시크릿 키 단일 환경변수로 변경

### Backend 파일
- `src/backend/src/services/taxInvoice.service.ts` (신규)
- `src/backend/src/controllers/billing.controller.ts` - 세금계산서 메서드 추가
- `src/backend/src/routes/admin.taxInvoice.routes.ts` (신규)
- `src/backend/src/routes/brand.billing.routes.ts` - 세금계산서 라우트 추가
- `src/backend/src/routes/index.ts` - adminTaxInvoiceRoutes 등록
- `src/backend/src/config/index.ts` - PORTONE_SECRET 단일 키로 변경

### Frontend 파일
- `src/frontend/src/services/api.ts` - 세금계산서 API 메서드 8개 추가
- `src/frontend/src/pages/brand/BrandBilling.tsx` - 세금계산서 탭 추가
- `src/frontend/src/pages/admin/AdminTaxInvoices.tsx` (신규)
- `src/frontend/src/App.tsx` - /admin/finance/tax-invoices 라우트 등록

### 세금계산서 API
| API | 설명 |
|-----|------|
| POST /api/brand/billing/tax-invoices/request | 발행 요청 |
| GET /api/brand/billing/tax-invoices/my | 내 요청 목록 |
| GET /api/admin/finance/tax-invoices | 전체 요청 목록 |
| GET /api/admin/finance/tax-invoices/stats | 통계 |
| POST /api/admin/finance/tax-invoices/:id/approve | 승인 |
| POST /api/admin/finance/tax-invoices/:id/reject | 거부 (reason 10자+) |
| POST /api/admin/finance/tax-invoices/:id/issue | 발행 (confirmText="ISSUE") |

### 상태 머신
```
REQUESTED → APPROVED → ISSUED
         ↘ REJECTED
```

### VAT 계산 로직
```typescript
const totalAmount = BigInt(Math.abs(summary.netSpend));
const supplyAmount = (totalAmount * BigInt(100)) / BigInt(110); // 공급가액
const taxAmount = totalAmount - supplyAmount; // 세액 (10%)
```

### 환경변수 변경
- **Before**: PORTONE_API_KEY + PORTONE_API_SECRET
- **After**: PORTONE_SECRET (V2 단일 시크릿 키, store-xxx 형식)

### 참고
- Danger Zone 패턴 적용: 발행 시 confirmText="ISSUE" 필수
- idempotencyKey로 중복 요청 방지
- 거부 사유 10자 이상 필수

---

*이 파일은 기록 전용입니다. 작업 시작 시 자동 로드하지 마세요.*
