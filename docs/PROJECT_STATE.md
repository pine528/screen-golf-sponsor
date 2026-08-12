# PROJECT_STATE.md - 현재 구현 상태 요약

> 최종 업데이트: 2026-04-29 (SPONPIK 1차 론칭 보강 — 10개 미충족 항목 전부 구현)

---

## 0-A. SPONPIK 1차 론칭 보강 (2026-04-29) — NEW

### 0-A.1 Athlete 구조화 필드
- 기존 bio 텍스트만 있던 신장/지역/데뷔년/소속을 정식 컬럼으로 승격
- 신규 컬럼: `height`, `region`, `debut_year`, `affiliation`, `sport_type`, `sport_id`
- UI: `/athletes` 카드 + `/athletes/:id` Hero에 노출

### 0-A.2 Sport 모델
- 신규 테이블 `sports`: code/name/parent_code/display_order/is_active
- 1차 활성: GOLF, SCREEN_GOLF
- 2차 비활성 시드: BASEBALL, SOCCER, VOLLEYBALL, BASKETBALL
- API: `GET /api/sports`, `PATCH /api/sports/:id` (ADMIN)

### 0-A.3 Event 운영 필드 + 관리자 활성화
- `events` 신규 컬럼: `category`, `qualifying_date`, `display_order`, `is_active`, `active_days`, `sport_id`
- 화면: `/admin/tournament-activation` — 토글/N값/카테고리 인라인 편집
- 관리자 우선 정책: `Event.activeDays > query.days > 14`

### 0-A.4 SlotInstance 표시 보조
- `slot_instances` 신규 컬럼: `slot_name`, `slot_order`, `is_active`
- 비어있으면 SlotTemplate.name 사용

### 0-A.5 호가 리스트 (5단계 + 누적)
- `BidTierLadder` 컴포넌트 → SlotAuctionPanel 통합
- 클릭 시 즉시 입찰 (BRAND + LIVE)

### 0-A.6 납품 문서
- `docs/delivery/01_DATA_MAPPING.md` — 외부↔DB↔화면 매핑
- `docs/delivery/02_QA_REPORT.md` — QA 결과
- `docs/delivery/03_OPERATIONS_GUIDE.md` — 일일 운영 체크
- `docs/delivery/04_INTEGRATION_ISSUES.md` — 외부 연동 현황

---

## 0. 풀 퍼널 데이터 리포팅 (Full Funnel)

선수 연계형 프로모션 코드·트래킹 링크·브랜드 미니스토어 기반 매출 증명 시스템

### 0.1 모델 (8개 신규)
- `PromoCode`: 캠페인-선수 단위 코드 (KLPGA_KIM20 등)
- `TrackingLink`: 단축 URL + QR (nanoid 6자)
- `MiniStore` + `StoreProduct`: 브랜드 전용 미니스토어
- `FunnelEvent`: LANDING_VIEW ~ PURCHASE 모든 이벤트
- `FunnelOrder`: 구매 주문 (트랜잭션 + 멱등성)
- `SessionRollup`: 어트리뷰션용 세션 롤업
- `PixelInstall`: 외부몰 JS 픽셀 (HMAC 서명)
- `AttributionTouch`, `PerformanceSettlement`: Phase 3

### 0.2 핵심 API (15+)
- `POST /api/admin/campaigns/:id/tracking-assets/generate` (자산 일괄 생성)
- `POST /api/tracking/click` (단축링크 클릭)
- `POST /api/events/{landing-view,product-view,cta-click,add-to-cart,begin-checkout,promo-apply,purchase,refund,cancel}`
- `GET /api/reports/{campaign,brand,athlete}/:id`
- `POST /api/external/track` (Pixel JS, Phase 2)
- `POST /api/external/postback/{purchase,refund}` (S2S, HMAC)
- `GET /api/store/brand/:slug` (공개 미니스토어)

### 0.3 어트리뷰션 우선순위
1순위: promo_code → 2순위: 최근 클릭 트래킹 링크 → 3순위: 최근 세션

### 0.4 화면 (12+)
- ADM-01~04: 캠페인 목록/상세/코드·링크/미니스토어 설정
- BRD-01~03: 성과 대시보드/비교 분석/주문 상세 + Pixel/Attribution
- ATH-01: 선수 본인 성과 대시보드
- REP-01: 통합 ROI 리포트 (PDF 다운로드)
- STO-01~03: 미니스토어 랜딩/상품/체크아웃

### 0.5 Phase 3 자동화
- Cron `0 1 * * *` KST: CPA/CPS 캠페인 일일 정산
- Multi-touch attribution (5가지 모델)
- 이동평균 + 지수평활 예측

---

## 1. Admin 기능

### 1.1 원화 에스크로/정산
- **모델**: `Wallet`, `LedgerTx`, `Escrow`, `PayoutBatch`, `PayoutItem`
- **흐름**: 계약 서명 → 에스크로 홀드 → 검수 승인 → 선수 지급 + 플랫폼 수수료
- **환불**: 반려/취소/30일 만료 시 브랜드 환불
- **멱등성**: `safeEscrowOperation` + P2002 처리 + 상태 기반 업데이트

### 1.2 Finance Console
| 기능 | 엔드포인트 |
|------|-----------|
| 에스크로 목록/상세 | GET /api/admin/finance/escrows |
| 지갑 목록 | GET /api/admin/finance/wallets |
| 원장 내역 | GET /api/admin/finance/ledger |
| 정산 배치 | GET /api/admin/finance/payouts |
| 강제 릴리즈/환불 | POST /api/admin/finance/escrows/:id/force-* |
| CSV 다운로드 | GET /api/admin/finance/*/csv |

### 1.3 선수 출금 (Withdrawal)
- **모델**: `WithdrawalRequest`, `WithdrawalBatch`, `WithdrawalStatus`, `WithdrawalBatchStatus` enum
- **상태**: REQUESTED → APPROVED/REJECTED → PAID
- **배치**: CREATED → EXPORTED → COMPLETED/CANCELED
- **frozenAmount 패턴**: 요청 시 동결, 거부 시 해제, 지급 시 balance/frozen 모두 차감
- **계좌 암호화**: AES-256-GCM (bankAccountEncrypted, iv, tag, last4)
- **권한**: ADMIN 또는 FINANCE 역할 필요 (CSV export 등)

| API | 설명 |
|-----|------|
| POST /api/withdrawals | 출금 요청 (X-Idempotency-Key) |
| GET /api/withdrawals/available-balance | 출금 가능 잔액 |
| GET /api/withdrawals/my | 내 요청 목록 |
| GET /api/admin/finance/withdrawals | 관리자 요청 목록 |
| POST /api/admin/finance/withdrawals/:id/approve | 승인 |
| POST /api/admin/finance/withdrawals/:id/reject | 거부 (사유 10자+) |
| POST /api/admin/finance/withdrawals/:id/paid | 지급완료 (payoutReference, proofUrl) |
| GET /api/admin/finance/withdrawals/metrics | 일별/대기 통계 |
| POST /api/admin/finance/withdrawals/batches | 배치 생성 (withdrawalIds[]) |
| GET /api/admin/finance/withdrawals/batches | 배치 목록 |
| GET /api/admin/finance/withdrawals/batches/:id | 배치 상세 |
| GET /api/admin/finance/withdrawals/batches/:id/export.csv | 은행이체 CSV |
| POST /api/admin/finance/withdrawals/batches/:id/complete | 일괄 지급완료 |

### 1.4 Reports
| 리포트 | 설명 |
|--------|------|
| KPI 대시보드 | 계약수/거래액/MAU 등 |
| 추이 분석 | 일별/주별/월별 트렌드 |
| 퍼널 분석 | 가입→입찰→계약→정산 전환율 |
| 이상 징후 | 5가지 규칙 기반 알림 |
| 출금 이상징후 | 5가지 출금 정합성 규칙 (09:10 KST 크론) |

**출금 메트릭** (GET /api/admin/finance/withdrawals/metrics):
- today: requested/approved/paid/rejected (건수, 금액)
- pending: requested/approved (건수, 금액)
- batch: todayCreated/todayCompleted/pendingExport/pendingComplete
- failed.last24h, totalFrozenAmount, avgApprovalDays

**출금 이상징후 규칙**:
| 규칙 | 조건 | 심각도 |
|------|------|--------|
| WITHDRAWAL_PENDING_HIGH | 지급 대기 > 50건 | medium/high |
| WITHDRAWAL_PAID_SPIKE | 오늘 지급 > 7일평균 × 2 | medium |
| WITHDRAWAL_BATCH_FAIL_RATE | 배치 실패율 > 10% | high |
| WITHDRAWAL_FROZEN_ANOMALY | frozen < 0 또는 > balance | critical |
| WITHDRAWAL_LONG_PENDING | 3일 이상 미승인 > 10건 | medium |

### 1.5 알림 시스템
- 계약/에셋/인증/정산/출금 이벤트 시 자동 알림 생성
- 프론트: 헤더 벨 아이콘 + 드롭다운 + 미읽음 뱃지

### 1.6 CI/배포
- GitHub Actions: typecheck, lint, migrations check, e2e
- docker-compose.prod.yml + smoke-test.sh
- Render(Backend) + Vercel(Frontend)

### 1.6.1 백업/복구 (DR) - Phase 11-2B

**스크립트**:
| 스크립트 | 위치 | 설명 |
|---------|------|------|
| backup.sh | scripts/db/ | PostgreSQL 일일 백업 (pg_dump + gzip + S3) |
| restore.sh | scripts/db/ | 복구 (S3/로컬, 확인 텍스트 필요) |
| verify-backup.sh | scripts/db/ | 백업 검증 (임시 컨테이너 복구) |
| preflight.sh | scripts/release/ | 배포 전 사전 점검 |
| rollback.sh | scripts/release/ | 롤백 절차 안내 |

**백업 정책**:
- 일일 03:30 KST 자동 백업 (GitHub Actions)
- 보관: 일일 14일, 주간 8주, 월간 12개월
- 검증: 매주 일요일 자동 실행

**핵심 테이블 (돈 데이터)**:
- `wallet`, `ledger_tx`, `escrow`, `topup_payments`, `refund_requests`, `withdrawal_requests`
- **LedgerTx**: 절대 DELETE/UPDATE 금지 (불변 원장)

**문서**: [DR_RUNBOOK.md](./DR_RUNBOOK.md) 참조

### 1.7 보안 정책 (계좌 암호화)
- **암호화**: AES-256-GCM (IV + Auth Tag)
- **키 관리**: `BANK_ACCOUNT_ENC_KEY` 환경변수 (32바이트 base64)
- **저장**: DB에 암호화된 값만 저장 (encrypted, iv, tag, last4, masked)
- **노출**: UI/API 응답에는 masked/last4만 반환
- **복호화**: CSV Export 시에만 ADMIN/FINANCE 권한으로 복호화
- **감사**: 모든 CSV export에 AuditLog 기록 (includesFullAccount: true)
- **부팅**: 프로덕션에서 키 없으면 서버 시작 실패

### 1.8 선수/브랜드 관리 (Entities)
| API | 설명 |
|-----|------|
| GET /api/admin/entities/athletes | 선수 목록 (필터: q, kycStatus, isActive, from, to) |
| GET /api/admin/entities/athletes/:id | 선수 상세 (확장) |
| PATCH /api/admin/entities/athletes/:id/toggle-active | 선수 활성화 토글 |
| GET /api/admin/entities/brands | 브랜드 목록 (필터: q, kycStatus, isActive, from, to) |
| GET /api/admin/entities/brands/:id | 브랜드 상세 (확장) |
| PATCH /api/admin/entities/brands/:id/toggle-active | 브랜드 활성화 토글 |

**선수 상세 API 응답 (Phase 8-Detail)**:
- 기본정보, KYC상태, 최근계약/슬롯 5건
- `wallet`: balance, frozenAmount, available, updatedAt
- `withdrawalStats`: REQUESTED/APPROVED/PAID/REJECTED 건수+금액
- `recentWithdrawals`: 최근 10건
- `recentLedger`: 최근 10건
- `contractStats`: total, active, completed, totalAmount

**브랜드 상세 API 응답 (Phase 8-Detail)**:
- 기본정보, KYC상태, 최근계약/캠페인 5건
- `wallet`: balance, frozenAmount, available, updatedAt
- `escrowStats`: HELD/RELEASED/REFUNDED 건수+총액
- `recentEscrows`: 최근 10건
- `recentLedger`: 최근 10건
- `bidStats`: total, won, totalSpent
- `kycDetail`: businessNumber(마스킹), businessStatus, verifiedAt

**민감정보 제외**: bankAccount 원문, taxInfo, kycDocuments 절대 반환X

### 1.9 슬롯 즉시구매 (Direct Buy) - Phase 9-1 + 9-1.1
- **SlotStatus enum**: OPEN, IN_AUCTION, **RESERVED**, SOLD, CLOSED
- **흐름**: 브랜드 즉시구매 → 금액 동결 → 계약 생성 → 선수 서명 → 에스크로 HOLD
- **상태 전환**: OPEN → RESERVED (buy-now) → SOLD (선수 서명) 또는 OPEN (만료)

| API | 설명 |
|-----|------|
| POST /api/slots/instances/:id/buy-now | 즉시구매 (BRAND 전용) |
| PATCH /api/slots/instances/:id/sale-mode | 판매 설정 (ATHLETE 전용) |

**Phase 9-1.1 예약 동결/만료 정책**:
1. **예약 시간**: buy-now 시 `reservedUntil = now + 24h`
2. **동결 시점**: buy-now 즉시 `frozenAmount += directBuyPrice`
3. **해제 시점 (정상)**: 선수 서명 완료 시 `frozenAmount -= price`
4. **해제 시점 (만료)**: 크론이 매 10분 체크, 만료 시 자동 해제
5. **원장 기록**: `DIRECT_BUY_RESERVE` (동결), `DIRECT_BUY_RESERVE_RELEASE` (해제)
6. **만료 시**: Contract → CANCELLED, Slot → OPEN, frozenAmount 해제

**processBuyNow 로직 (Phase 9-1.1)**:
1. Slot 검증 (OPEN, enableDirectBuy, directBuyPrice)
2. 브랜드 잔액 검증 (available >= directBuyPrice)
3. ★ `frozenAmount += directBuyPrice` (예약 동결)
4. ★ `LedgerTx` 기록 (DIRECT_BUY_RESERVE)
5. Slot → RESERVED (조건부 updateMany)
6. Contract 생성 (brandSignedAt=now, ★reservedUntil=now+24h)
7. 선수 알림 ("24시간 내 서명해주세요") + AuditLog

**만료 크론** (`*/10 * * * *`):
- PENDING_SIGNATURE + athleteSignedAt=null + reservedUntil < now 조건
- 자동으로 Contract 취소 + Slot OPEN + frozenAmount 해제 + 알림

**프론트엔드**:
- /auctions 페이지에 "즉시구매" 탭 추가
- OPEN 슬롯 중 enableDirectBuy=true인 항목 표시
- 즉시구매 확인 모달 → 계약 페이지로 이동

### 1.10 경매 입찰 동결 정책 - Phase 9-2
- **frozenAmount 패턴**: 최고 입찰자만 동결 (모든 입찰자 아님)
- **원장 타입**: `AUCTION_BID_RESERVE` (동결), `AUCTION_BID_RESERVE_RELEASE` (해제)
- **Bid.frozenAmount**: 최고 입찰자의 동결 금액 추적
- **상태 전환**: OPEN → IN_AUCTION → RESERVED (낙찰) → SOLD (선수 서명) 또는 OPEN (만료)

**placeBid() 로직**:
1. 브랜드 지갑 검증 (available >= maxBid)
2. 이전 최고 입찰자 frozenAmount 해제 (다른 브랜드인 경우)
3. 새 입찰자 frozenAmount 동결
4. `LedgerTx` 기록 (AUCTION_BID_RESERVE)
5. 2nd-price 계산 + anti-sniping 연장

**endAuction() 로직**:
1. Auction → ENDED, Slot → **RESERVED** (낙찰 시)
2. Contract 생성 (brandSignedAt=now, **reservedUntil=now+24h**)
3. winningBid.frozenAmount 유지 (계약 예약으로 전환)

**sign() - 선수 서명 시**:
1. 예약 만료 체크 (reservedUntil < now → BadRequestError)
2. Escrow HOLD
3. **경매**: winningBid.frozenAmount 해제 + LedgerTx
4. **Direct Buy**: priceFinal 기준 해제 (기존 로직)
5. Slot → SOLD

**processExpiredReservations() - 크론 (*/10)**:
- 경매 낙찰: winningBid.frozenAmount 해제
- Direct Buy: priceFinal 해제
- Contract → CANCELLED, Slot → OPEN, 알림 발송

**정책 요약 (10줄)**:
1. 최고 입찰자만 frozenAmount 동결 (모든 입찰자 아님)
2. Outbid 시 이전 최고 입찰자 자동 해제
3. 낙찰 시 Contract 예약 (reservedUntil=24h)
4. 선수 서명 시 Escrow HOLD + frozenAmount 해제
5. 만료 시 Contract CANCELLED + Slot OPEN + 해제
6. 잔액 검증: available (balance - frozenAmount) >= maxBid
7. 원장 기록: AUCTION_BID_RESERVE, AUCTION_BID_RESERVE_RELEASE
8. 동시성 방어: 트랜잭션 + wallet.version 낙관적 락
9. 기존 2nd-price/anti-sniping 로직 유지
10. Direct Buy와 경매 모두 동일한 만료 크론 사용

**Phase 9-2.1 정합성 수정**:
1. `holdFromContract()`: available 잔액 검증 추가 (balance - frozenAmount)
2. `sign()`: 예약 해제 → HOLD 순서 변경 (available 확보 후 HOLD)
3. 경매/Direct Buy 구분: `auction.status === 'ENDED'` 명시적 확인 (frozenAmount 유무 의존 제거)

### 1.11 UX 연결 및 Admin 운영 도구 - Phase 9-3

**Brand API**:
| API | 설명 |
|-----|------|
| GET /api/brands/me/reservations | 내 예약 목록 (Direct Buy + 경매 낙찰) |
| GET /api/brands/me/bids | 내 입찰 목록 + isHighest 상태 |
| GET /api/brands/me/wins | 낙찰 계약 목록 |

**Athlete API**:
| API | 설명 |
|-----|------|
| GET /api/athletes/me/pending-signatures | 서명 대기 계약 목록 (isUrgent: 60분 이하) |

**Auction API**:
| API | 설명 |
|-----|------|
| GET /api/auctions/:id/summary | 경매 요약 (폴링용, optionalAuth) |

**Admin Ops API** (분당 10회 Rate Limit):
| API | 설명 | 입력 |
|-----|------|------|
| GET /api/admin/ops/contracts/:id | 계약 조회 (Ops용) | - |
| POST /api/admin/ops/contracts/:id/release-reservation | 예약 강제 해제 | reason(10자+), confirmText("RELEASE") |
| GET /api/admin/ops/auctions/:id | 경매 조회 (Ops용) | - |
| POST /api/admin/ops/auctions/:id/force-close | 경매 강제 종료 | reason(10자+), confirmText("CLOSE") |

**release-reservation 로직**:
1. Contract → CANCELLED (PENDING_SIGNATURE만)
2. Slot → OPEN
3. frozenAmount 해제 (Direct Buy/Auction 구분)
4. LedgerTx + AdminActionLog 기록

**force-close 로직**:
1. 기존 endAuction() 재사용 (낙찰 처리/UNSOLD)
2. AdminActionLog 기록

**프론트엔드**:
| 라우트 | 컴포넌트 | 설명 |
|--------|----------|------|
| /auctions (탭 확장) | Auctions.tsx | Brand: [진행중][내 입찰][내 예약][즉시구매] |
| /athlete/pending-signatures | PendingSignatures.tsx | 서명 대기 계약 + 긴급 배지 |
| /admin/ops | AdminOps.tsx | 운영 도구 (예약 해제/경매 종료) |

### 1.12 브랜드 지갑 충전 (Topup) - Phase 10-1

**개요**: 브랜드가 Toss Payments / Stripe로 지갑을 충전할 수 있다.

**모델**:
- `TopupPayment`: 충전 결제 요청 (walletId, amount, provider, status 등)
- `TopupPaymentStatus`: CREATED → PENDING → PAID / FAILED / CANCELED
- `PaymentProvider`: TOSS, STRIPE
- `LedgerTxType` 확장: TOPUP_DEPOSIT, TOPUP_REFUND

**Payment Provider Adapter 패턴** (`src/payments/providers/`):
- `types.ts`: 공통 인터페이스 (CheckoutRequest, WebhookEvent 등)
- `toss.ts`: Toss Payments 어댑터
- `stripe.ts`: Stripe 어댑터
- `index.ts`: Provider 팩토리

| API | 설명 |
|-----|------|
| POST /api/brand/topups | 충전 생성 (checkoutUrl 반환) |
| POST /api/brand/topups/:id/confirm | 결제 확인 (Redirect 방식) |
| GET /api/brand/topups/my | 내 충전 내역 |
| GET /api/brand/topups/my/:id | 충전 상세 |
| GET /api/brands/me/wallet | 내 지갑 조회 |
| POST /api/payments/webhook/toss | Toss Webhook (서명 검증) |
| POST /api/payments/webhook/stripe | Stripe Webhook (서명 검증) |
| GET /api/admin/finance/topups | 전체 충전 목록 |
| GET /api/admin/finance/topups/stats | 충전 통계 |
| GET /api/admin/finance/topups/:id | 충전 상세 |

**멱등성 보장**:
1. `@@unique([walletId, idempotencyKey])` - 중복 충전 방지
2. `updateMany({ where: { status: IN [CREATED, PENDING] } })` - 조건부 업데이트
3. `@@unique([walletId, type, refType, refId])` - LedgerTx 중복 방지

**결제 플로우**:
1. POST /brand/topups → checkoutUrl 반환
2. 사용자 리다이렉트 → PG 결제 페이지
3. 결제 완료 → Webhook 수신
4. Webhook 처리: TopupPayment → PAID, Wallet += amount, LedgerTx 생성

**프론트엔드**: `/brand/wallet` (BrandWallet.tsx) - 잔액 조회, 충전 폼, 충전 내역

### 1.13 환불/차지백 (Refund) - Phase 10-2

**개요**: PAID 상태 충전에 대한 환불 요청 → 승인 → PG 환불 처리. 차지백은 Webhook으로 자동 처리.

**모델**:
- `RefundRequest`: 환불 요청 (topupPaymentId, amount, status 등)
- `RefundRequestStatus`: REQUESTED → APPROVED/REJECTED → PROCESSING → REFUNDED/FAILED
- `RefundStatus`: NONE, PARTIAL, FULL (TopupPayment 환불 상태)
- `TopupPayment` 확장: refundedAmount, refundStatus, lastRefundAt, chargebackAt

**환불 정책**:
- 잔액 검증: `available (balance - frozenAmount) >= refundAmount`
- 부분 환불: refundedAmount 누적, refundStatus = PARTIAL
- 전액 환불: refundStatus = FULL, topupPayment.status = REFUNDED
- 차지백: 강제 DEBIT (잔액 부족해도 진행, 음수 허용)

| API | 설명 |
|-----|------|
| POST /api/admin/finance/refunds | 환불 요청 생성 (Admin) |
| GET /api/admin/finance/refunds | 환불 요청 목록 |
| GET /api/admin/finance/refunds/stats | 환불 통계 |
| GET /api/admin/finance/refunds/:id | 환불 요청 상세 |
| POST /api/admin/finance/refunds/:id/approve | 환불 승인 |
| POST /api/admin/finance/refunds/:id/reject | 환불 거절 |
| POST /api/admin/finance/refunds/:id/process | PG 환불 실행 |

**Webhook 처리**:
- `charge.refunded` → processRefundWebhook (비동기 환불 완료)
- `charge.dispute.created` → processChargeback (차지백 자동 처리)

**멱등성 보장**:
1. `@@unique([topupPaymentId, idempotencyKey])` - 중복 환불 요청 방지
2. `updateMany({ where: { status } })` - 조건부 상태 전이
3. `@@unique([walletId, type, refType, refId])` - LedgerTx 중복 방지

### 1.14 결제/환불 대사 (Reconciliation) - Phase 10-3

**개요**: Webhook 로깅 + 정합성 자동 검사 + 이상 시 관리자 알림

**모델**:
- `WebhookEventLog`: Webhook 이벤트 기록 (provider, eventType, eventId, status)
- `WebhookEventStatus`: RECEIVED → PROCESSED / IGNORED / FAILED
- `ReconciliationRun`: 대사 실행 기록 (scope, fromDate, toDate, issuesFound)
- `ReconciliationIssue`: 발견된 이슈 (severity, issueType, status)

**Webhook 처리 개선**:
1. Webhook 수신 시 WebhookEventLog upsert (RECEIVED)
2. 이미 PROCESSED면 skip (멱등성)
3. 처리 완료 시 PROCESSED, 실패 시 FAILED + errorMessage

**대사 검사 규칙**:
| 규칙 | 심각도 | 설명 |
|------|--------|------|
| TOPUP_PAID_NO_LEDGER | CRITICAL | PAID인데 LedgerTx 없음 |
| LEDGER_TOPUP_NO_PAID | HIGH | LedgerTx 있는데 PAID 아님 |
| REFUND_REFUNDED_NO_LEDGER | CRITICAL | REFUNDED인데 LedgerTx 없음 |
| REFUNDED_AMOUNT_MISMATCH | MEDIUM | refundedAmount 불일치 |
| WALLET_NEGATIVE | CRITICAL | 잔액/동결 음수 |

**Cron Job**: 매일 09:20 KST Full Reconciliation → HIGH+ 이슈 시 관리자 알림

| API | 설명 |
|-----|------|
| GET /api/admin/reconciliation/runs | 대사 실행 목록 |
| POST /api/admin/reconciliation/runs | 수동 대사 실행 (분당 5회 제한) |
| GET /api/admin/reconciliation/issues | 이슈 목록 (severity, status 필터) |
| GET /api/admin/reconciliation/issues/summary | 이슈 요약 통계 |
| PATCH /api/admin/reconciliation/issues/:id/status | 이슈 상태 변경 (ACKED/RESOLVED/IGNORED) |
| GET /api/admin/reconciliation/issues.csv | CSV Export |

**프론트엔드**: `/admin/reconciliation` (AdminReconciliation.tsx) - KPI 카드, 이슈/실행기록 탭, 상태변경, CSV 내보내기

### 1.15 RBAC 세분화 - Phase 11-1

**새 역할 추가**:
- `SUPPORT`: 고객지원 (읽기 전용 - user/transaction/issue 조회)
- `AUDITOR`: 감사 (읽기 전용 - audit/report/reconciliation 조회)

**역할별 권한 매트릭스**:
| 기능 | ADMIN | FINANCE | SUPPORT | AUDITOR |
|------|-------|---------|---------|---------|
| 전체 관리 기능 | O | X | X | X |
| 환불 승인/정산 실행 | O | O | X | X |
| 감사로그 조회 | O | X | X | O |
| 리포트 조회 | O | O | X | O |
| 역할 변경 | O | X | X | X |

**관리자 관리 API**:
| API | 설명 |
|-----|------|
| GET /api/admin/admins | 관리자 목록 |
| PATCH /api/admin/admins/:id/role | 역할 변경 (Danger Zone) |
| PATCH /api/admin/admins/:id/permissions | 권한 변경 |

**Danger Zone 패턴**:
- confirmText: `CHANGE_ROLE_{email}` 형식 입력 필수
- reason: 최소 10자 이상 사유 입력 필수
- AdminActionLog + AuditLog 자동 기록

**ENV 필수값 검증**: 서버 시작 시 `DATABASE_URL`, `JWT_SECRET` 필수. 프로덕션에서 `PORTONE_*` 추가 필수.

**프론트엔드**: `/admin/users` (AdminUsers.tsx) - 관리자 목록, 역할 변경 모달 (Danger Zone)

### 1.16 브랜드 청구/명세서/세금계산서 - Phase 11-2A

**모델**:
- `BillingProfile`: 브랜드 사업자 정보 (세금계산서 발행용)
- `DocumentExportLog`: 문서 내보내기 감사 로그
- `TaxInvoiceRequest`: 세금계산서 발행 요청

**Brand API**:
| API | 설명 |
|-----|------|
| GET /api/brand/billing/profile | 청구 프로필 조회 |
| POST /api/brand/billing/profile | 청구 프로필 생성 |
| PATCH /api/brand/billing/profile | 청구 프로필 수정 |
| GET /api/brand/billing/statements/summary | 기간별 요약 (from, to) |
| GET /api/brand/billing/statements/items | 거래 내역 (페이지네이션) |
| GET /api/brand/billing/statements/export.csv | CSV 내보내기 |
| GET /api/brand/billing/statements/export.pdf | PDF 내보내기 |
| POST /api/brand/billing/tax-invoices/request | 세금계산서 발행 요청 |
| GET /api/brand/billing/tax-invoices/my | 내 세금계산서 요청 목록 |

**Admin Tax Invoice API**:
| API | 설명 |
|-----|------|
| GET /api/admin/finance/tax-invoices | 세금계산서 요청 목록 |
| GET /api/admin/finance/tax-invoices/stats | 세금계산서 통계 |
| POST /api/admin/finance/tax-invoices/:id/approve | 승인 |
| POST /api/admin/finance/tax-invoices/:id/reject | 거부 (reason 10자+) |
| POST /api/admin/finance/tax-invoices/:id/issue | 발행 (Danger Zone: confirmText="ISSUE") |

**세금계산서 상태**: REQUESTED → APPROVED → ISSUED (또는 REJECTED)

**요약 항목**: 총 충전, 총 환불, 에스크로 홀드/릴리즈/환불, 플랫폼 수수료, 순 지출

**CSV/PDF 내보내기**:
- 수식 주입 방어: `=`, `+`, `-`, `@` 시작 시 `'` 접두어
- UTF-8 BOM 추가
- DocumentExportLog에 감사 기록

**프론트엔드**:
- `/brand/billing` (BrandBilling.tsx) - 거래명세서/청구정보/세금계산서 탭
- `/admin/finance/tax-invoices` (AdminTaxInvoices.tsx) - 관리자 세금계산서 관리

### 1.17 추천 경매 (Featured Auctions)

어드민이 유명 선수의 슬롯을 선택하여 전체 공개 경매로 설정하는 기능.

**모델 변경**:
- `Auction.isFeatured` (Boolean) - 추천 경매 여부

**API**:
| API | 설명 |
|-----|------|
| POST /api/admin/featured-auctions | 추천 경매 생성 (슬롯+경매 원자적 생성) |
| POST /api/admin/featured-auctions/bulk | 대량 추천 경매 생성 |
| GET /api/admin/featured-auctions | 추천 경매 목록 (Admin) |
| GET /api/auctions/featured | 추천 경매 목록 (Public) |

**프론트엔드**:
- `/admin/featured-auctions` (AdminFeaturedAuctions.tsx) - 추천 경매 관리
- `/auctions` - 상단에 추천 경매 섹션 노출

### 1.18 에이전시 (Agency)

바쁜 선수를 대신하여 슬롯 관리, 계약 서명 등을 수행하는 대리인 역할.

**모델**:
- `Agency`: 에이전시 정보 (name, bizNo, contactEmail, kycStatus 등)
- `Athlete.agencyId`: 에이전시 소속 여부

**역할**: `UserRole.AGENCY` 추가

**에이전시가 할 수 있는 일**:
- 소속 선수 등록 (KYC 승인 후)
- 소속 선수의 슬롯 판매 모드 설정
- 소속 선수의 계약 서명 (대리)
- 소속 선수의 프로필/KYC 관리

**에이전시가 할 수 없는 일**:
- 선수의 출금 요청 (금전 관련 보안)
- 브랜드 기능 (입찰, 즉시구매)
- 다른 에이전시 소속 선수 관리

| API | 설명 |
|-----|------|
| POST /api/auth/agency/register | 에이전시 회원가입 |
| GET /api/agencies/me | 내 에이전시 프로필 |
| PATCH /api/agencies/me | 프로필 수정 |
| POST /api/agencies/me/kyc | KYC 제출 |
| GET /api/agencies/stats | 에이전시 통계 |
| POST /api/agencies/athletes | 선수 등록 (KYC 승인 필수) |
| GET /api/agencies/athletes | 소속 선수 목록 |
| DELETE /api/agencies/athletes/:id | 선수 해제 |
| GET /api/agencies/athletes/:id/slots | 선수 슬롯 조회 |
| PATCH /api/agencies/athletes/:id/slots/:slotId/sale-mode | 판매모드 설정 |
| POST /api/agencies/athletes/:id/contracts/:contractId/sign | 대리 서명 |
| GET /api/agencies/pending-signatures | 서명 대기 계약 목록 |
| POST /api/admin/kyc/agencies/:id/review | Admin KYC 심사 |

**프론트엔드**:
- `/agency` (AgencyDashboard) - 에이전시 대시보드
- `/agency/athletes` (AgencyAthletes) - 소속 선수 목록
- `/agency/athletes/register` (AgencyAthleteRegister) - 선수 등록

### 1.19 Phase 2 슬롯 정책 (v2)

**개요**: 대회별 슬롯 운영 규칙과 Phase 2 자동/수동 오픈 시스템.

**슬롯 구조**:
- **Phase 1 (CAP+TOP)**: 16개 슬롯 중 14개 - 항상 먼저 오픈
- **Phase 2 (PANTS)**: 2개 슬롯 - Phase 1 유효 슬롯이 모두 SOLD/RESERVED일 때만 오픈
- **등급**: S/A/B (reserveMinKrw, reserveRecKrw로 권장 시작가 제공)

**TournamentRules (Event.tournamentRules JSON)**:
| 필드 | 설명 |
|------|------|
| chestReservedSide | CHEST 좌/우 대회 점유 (LEFT/RIGHT/NONE) |
| sleeveReservedSide | SLEEVE 좌/우 대회 점유 |
| reservedSlotCodes | 대회가 점유한 슬롯 코드 목록 |
| disabledSlotCodes | 비활성화된 슬롯 코드 목록 |
| phase2UnlockMode | AUTO(즉시) / ADMIN_APPROVE(수동) |

**API**:
| API | 설명 |
|-----|------|
| GET /api/slot-templates | v2 슬롯 템플릿 목록 |
| GET /api/events/:id/tournament-rules | 대회 규칙 조회 |
| GET /api/events/:id/athletes/:athleteId/slot-availability | 슬롯 가용성 조회 |
| PUT /api/admin/events/:id/tournament-rules | 대회 규칙 수정 (Admin) |
| POST /api/admin/events/:id/athletes/:athleteId/approve-phase2 | Phase 2 수동 승인 |
| GET /api/admin/events/:id/slot-summary | 대회 슬롯 요약 (Admin) |

**서비스**: `phase2UnlockService` (phase2Unlock.service.ts)
- `isPhase2Eligible()`: Phase 2 오픈 가능 여부 판단
- `getOpenSlotsForPlayer()`: 선수별 오픈 가능 슬롯 목록
- `approvePhase2Slots()`: 관리자 Phase 2 수동 승인
- `validateTournamentRulesForBid()`: 입찰/즉시구매 대회 규칙 통합 검증

**입찰/즉시구매 검증** (slot.service.ts, bid.service.ts):
| 검증 | 설명 |
|------|------|
| phase2EligibleMinDaysBefore | 대회 종료 N일 전부터만 Phase 2 오픈 가능 |
| maxSlotsPerBrandPerPlayer | 브랜드당 동일 선수 최대 슬롯 수 제한 |
| prohibitedCategories | 금지 카테고리 브랜드 차단 (tobacco, alcohol 등) |
| creativeApprovalRequired | 크리에이티브 사전 승인 필요 여부 |

**사전 크리에이티브 승인** (BrandEventCreativeApproval):
- **상태**: SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED
- Brand: POST /api/brand/creative-approvals (제출), GET .../events/:eventId (상태 조회)
- Admin: GET /api/admin/creative-approvals, POST .../:id/approve, POST .../:id/reject

### 1.20 전면 개편 Phase 1 — 슬롯 인벤토리·후원상품 (2026-07)

**모델** (기존 SlotInstance 체계와 `slotInventory.slotInstanceId`로 브릿지):
| 모델 | 역할 |
|------|------|
| AthleteSlot | 선수×슬롯템플릿 판매 설정 (basePrice, saleEnabled) — @@unique(athleteId, slotTemplateId) |
| SlotInventory | 기간별 재고 = 중복판매 방지의 단일 진실. 상태: AVAILABLE/AUCTION_ACTIVE/HELD/SOLD/RESTRICTED/PENDING_APPROVAL/UNAVAILABLE |
| SponsorshipProduct | 후원 상품 (SINGLE_EVENT/DAYS_30/MONTHS_6/MONTHS_12 · AUCTION/BUY_NOW/PROPOSAL) — 6/12개월은 경매 금지 |
| ProductSlot | 상품↔선수슬롯 구성 (isPrimary, additionalPrice) |

**API/로직** (`inventory.service.ts`):
- GET /api/athletes/public/:id/inventory?start&end — 기간별 슬롯 상태 (HELD 만료 lazy 복구 포함)
- `assertNoSlotConflict()` §19.1 기간 겹침 차단 — buy-now에 통합
- 동기화 훅: buy-now→HELD / 계약 서명→SOLD / 계약 취소→AVAILABLE
- 업종충돌·대회규칙은 기존 conflictService/phase2UnlockService 재사용
- SlotTemplate.displayX/Y — Phase 2 착장 도식 좌표(%)
- 백필: `prisma/backfill-phase1-inventory.ts` (재실행 안전)

---

## 2. FAN 기능

### 2.1 포인트 원장
- **모델**: `PointWallet`, `PointLedgerTx`
- **멱등성**: `@@unique([userId, reason, refType, refId])` + 낙관적 락(version)

| API | 설명 |
|-----|------|
| GET /api/points/me | 내 잔액 |
| GET /api/points/me/history | 내 포인트 내역 |
| GET /api/points/ranking | 포인트 TOP 랭킹 (공개) |
| POST /api/points/admin/grant | 관리자 포인트 지급 |

### 2.2 무료 투표 V2 (Vote V2 + RewardPool)
- **모델**: `VoteV2`, `VoteV2Participation`, `RewardPool`
- **상태**: OPEN → CLOSED → SETTLED / CANCELED
- **템플릿**: OX, MULTIPLE_CHOICE, PREDICT_SCORE, WINNER, CUSTOM

**리워드풀 시스템**:
- 중앙 리워드풀에서 보상 지급 (플랫폼 운영)
- **배수 M**: 풀 잔액에 따라 0.2~1.0 (가용액 1M~10M EP 기준 선형 보간)
- **마이크로 보상**: 참여 즉시 `BASE_MICRO_REWARD(15) × M` EP 지급
- **정답 보상**: 정산 시 1/n 균등 분배 (최대 50,000 EP)
- **일일 가용액**: `availableTodayEp` - 매일 리셋 (풀 가용액의 5%)

| API | 설명 |
|-----|------|
| GET /api/votes-v2/reward-pool/status | 리워드풀 상태 조회 (공개) |
| POST /api/votes-v2/reward-pool/deposit | 리워드풀 충전 (Admin) |
| POST /api/votes-v2/reward-pool/reset-daily | 일일 가용액 리셋 (Admin/Cron) |
| GET /api/votes-v2 | 투표 목록 |
| GET /api/votes-v2/:id | 투표 상세 (참여 정보 포함) |
| POST /api/votes-v2/:id/participate | 투표 참여 (무료, 마이크로 보상) |
| POST /api/votes-v2/user/create | 사용자 투표 생성 (본인 포인트 사용) |
| GET /api/votes-v2/user/my-votes | 내가 생성한 투표 |
| POST /api/votes-v2/:id/settle | 투표 정산 (Admin) |
| POST /api/votes-v2/cron/close-expired | 만료 투표 마감 (Cron) |

**프론트엔드**: `/votes` (VoteV2List), `/votes/:id` (VoteV2Detail), `/votes/create` (VoteCreate)

### 2.3 포인트샵
- **모델**: `ShopItem`, `RedemptionOrder`
- **상태**: REQUESTED → FULFILLED / CANCELED

| API | 설명 |
|-----|------|
| GET /api/shop/items | 상품 목록 |
| GET /api/shop/items/:id | 상품 상세 |
| POST /api/shop/orders | 교환 주문 (포인트 차감 + 재고 감소) |
| GET /api/shop/orders/my | 내 주문 목록 |
| POST /api/shop/orders/:id/cancel | 주문 취소 (환불 + 재고 복구) |
| POST /api/shop/admin/items | 상품 생성 |
| POST /api/shop/admin/orders/:id/fulfill | 주문 처리 완료 |

### 2.4 팬 대시보드 (/fan)
- 내 포인트 (로그인 시)
- 진행중 투표 목록
- 종료된 투표 + 결과/당첨 배지
- 포인트 TOP 10 랭킹
- 포인트샵 추천 상품
- 즐겨찾기 선수/브랜드 (로그인 시)

### 2.5 즐겨찾기
| API | 설명 |
|-----|------|
| POST /api/fan/favorites/athlete/:id | 선수 즐겨찾기 토글 |
| POST /api/fan/favorites/brand/:id | 브랜드 즐겨찾기 토글 |
| GET /api/fan/favorites | 내 즐겨찾기 목록 |

### 2.6 시즌 리워드 (Phase H)
- **모델**: `Season`, `SeasonParticipant`, `SeasonBadge`, `SeasonBadgeAward`
- **상태**: DRAFT → UPCOMING → ACTIVE → ENDED → REWARDS_DISTRIBUTED

| API | 설명 |
|-----|------|
| GET /api/seasons/current | 현재 활성 시즌 |
| GET /api/seasons | 시즌 목록 |
| GET /api/seasons/:id | 시즌 상세 |
| GET /api/seasons/:id/leaderboard | 리더보드 (순위, 참여, 적중, 포인트) |
| GET /api/seasons/my/participation | 내 시즌 참여 현황 |
| GET /api/seasons/my/badges | 내 뱃지 목록 |
| POST /api/admin/seasons | 시즌 생성 (rewardTiers, participationBonus) |
| PATCH /api/admin/seasons/:id | 시즌 수정 |
| POST /api/admin/seasons/:id/activate | 시즌 활성화 |
| POST /api/admin/seasons/:id/end | 시즌 종료 |
| POST /api/admin/seasons/:id/distribute-rewards | 보상 배포 |
| POST /api/admin/seasons/:id/update-rankings | 랭킹 수동 업데이트 |

**뱃지 타입**: SEASON_GOLD (1위), SEASON_SILVER (2위), SEASON_BRONZE (3위), SEASON_TOP10, SEASON_TOP100, PARTICIPATION, VOTE_MASTER, SHOP_VIP, STREAK

---

## 3. 불변식 체크리스트

### 돈/포인트
- [ ] 잔액 변동 시 원장 기록 동반
- [ ] 트랜잭션으로 원자성 보장
- [ ] 유니크 제약으로 멱등성 보장
- [ ] 잔액 음수 방지

### 팬 투표 정산
- [ ] 정답자 중 랜덤 k명 당첨
- [ ] 각자 floor(totalPool/k) 지급
- [ ] 잔여 → 플랫폼 지갑
- [ ] 정답자 0명 → 전액 플랫폼

### 포인트샵
- [ ] 주문 생성 = 재고 차감 + 포인트 차감 (같은 tx)
- [ ] 취소 = 재고 복구 + 포인트 환불 (같은 tx)
- [ ] idempotencyKey 중복 방지

---

## 4. 스키마 주요 모델

### 에이전시 관련
```
Agency (userId, name, bizNo, kycStatus), Athlete.agencyId
```

### 원화 관련
```
Wallet, LedgerTx, Escrow, PayoutBatch, PayoutItem, WithdrawalRequest, WithdrawalBatch, TopupPayment, RefundRequest, WebhookEventLog, ReconciliationRun, ReconciliationIssue
```

### 포인트 관련
```
PointWallet, PointLedgerTx
```

### 투표 V2 관련
```
VoteV2, VoteV2Participation, RewardPool
```

### 시즌 관련
```
Season, SeasonParticipant, SeasonBadge, SeasonBadgeAward
```

### 포인트샵 관련
```
ShopItem, RedemptionOrder
```

### 알림
```
Notification (NotificationType enum)
```

---

## 5. 프론트엔드 라우트

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| /fan | FanDashboard | 팬 메인 대시보드 |
| /votes | VoteV2List | 무료 투표 목록 (V2) |
| /votes/:id | VoteV2Detail | 투표 상세/참여 (리워드풀) |
| /votes/create | VoteCreate | 투표 생성 (본인 포인트) |
| /votes/my-created | MyCreatedVotes | 내가 만든 투표 |
| /points | FanPoints | 포인트 내역 |
| /shop | Shop | 포인트샵 |
| /shop/:id | ShopDetail | 상품 상세 |
| /orders | Orders | 내 주문 내역 |
| /athlete/withdrawals | AthleteWithdrawals | 선수 출금 관리 |
| /admin/finance/withdrawals | FinanceWithdrawals | 관리자 출금 목록 |
| /admin/finance/withdrawals/:id | FinanceWithdrawalDetail | 관리자 출금 상세 |
| /admin/finance/withdrawals/batches | FinanceWithdrawalBatches | 출금 배치 목록 |
| /admin/finance/withdrawals/batches/:id | FinanceWithdrawalBatchDetail | 배치 상세/CSV/일괄지급 |
| /admin/entities | AdminEntities | 선수/브랜드 목록 |
| /admin/entities/:type/:id | AdminEntityDetail | 선수/브랜드 상세 |
| /athlete/pending-signatures | PendingSignatures | 선수 서명 대기 계약 |
| /admin/ops | AdminOps | 운영 도구 (예약 해제/경매 종료) |
| /brand/wallet | BrandWallet | 브랜드 지갑 충전/조회 |
| /brand/sponsored-votes | BrandSponsoredVotes | 브랜드 후원 투표 관리 |
| /brand/campaigns/:id | CampaignDetail | 캠페인 상세 (KPI 진행률) |
| /brand/reports/roi | BrandROIDashboard | 브랜드 ROI 대시보드 |
| /brand/slot-analytics | BrandSlotAnalytics | 슬롯별 노출 성과 비교 |
| /brand/roi-settings | BrandROISettings | 키워드/경쟁사/차단카테고리 설정 |
| /admin/roi/campaign-builder | AdminCampaignBuilder | ROI 캠페인 설정 위자드 |
| /admin/roi/evidence | AdminEvidenceManager | 증빙 자료 관리 |
| /admin/roi/reports | AdminReportTemplates | 리포트 생성/관리 |
| /admin/exposure | AdminExposure | 노출 기록 관리 |
| /seasons/:id/leaderboard | SeasonLeaderboard | 시즌 리더보드 |
| /fan/badges | MyBadges | 내 뱃지 컬렉션 |
| /admin/seasons | AdminSeasons | 시즌 관리 |
| /admin/reconciliation | AdminReconciliation | 대사 관리 (결제/환불 정합성) |
| /admin/users | AdminUsers | 관리자 관리 (RBAC) |
| /admin/finance/tax-invoices | AdminTaxInvoices | 세금계산서 관리 |
| /brand/billing | BrandBilling | 브랜드 청구/명세서/세금계산서 |
| /agency | AgencyDashboard | 에이전시 대시보드 |
| /agency/athletes | AgencyAthletes | 소속 선수 목록 |
| /agency/athletes/register | AgencyAthleteRegister | 선수 등록 |

---

*이 문서는 200~300줄 내로 유지. 상세 내용은 코드 또는 DEVLOG 참고.*

## AI 간편 매칭 (2026-08-10, 핸드오프 v1.0 P0)
- 규칙 기반 추천 (LLM 순위 결정 없음): Hard Filter → 실데이터 피처 → 가중치 100점 → 패키지 → reason code
- API: `POST /ai-match/preview`(후보 수) · `POST /ai-match/requests`(추천 생성+스냅샷 저장) · `GET /ai-match/requests/:id`
- 테이블: `ai_match_requests` (input + results JSON 스냅샷, 재현성 보장)
- 화면: `/ai-match`(입력) → `/ai-match/:id`(TOP3 결과) → `/compare`(3명 비교) → `/proposal/:athleteId`(제안서·상담·계약 연결)
- 원칙: 임의 수치 미표기 — 팔로워·팬 관심·슬롯·가격 실측값만, 미수집은 null/'수집 중' + 신뢰도(HIGH/MEDIUM/LOW)
- 성장마켓 선수 목록은 `aiMatch.service.ts`의 GROWTH_MARKET_ATHLETES 상수 — 팬스토어 추가 시 갱신 필요
- 2026-08-12 심층매칭 v3: Brand Analyzer(URL 규칙 추출+승인)·역할별 5슬롯(BEST/PATCH/SOCIAL/HYBRID/DISCOVERY)·반복노출 페널티+다양성 λ·선호/제외 피드백
- 2026-08-12 v3.1: 슬롯별 saleModeLabel(라이브 경매/직접 구매/협의) + package.methodLabel(혼합 시 '직접 구매 + 라이브 경매') — 선수 단위 오표기 수정. portfolioMode(AUTO/SINGLE/MULTI) + 2~3명 역할 분산 portfolio 응답
- 2026-08-12 브랜드 전용 전환: BRAND 로그인 필수, brand-context 프리필, 협업 이력 가점(§10 1단계)
- 2026-08-11 SIE v2 적용: 역할별 점수(Patch/SNS/PR/Commerce/Fan/LongTerm) + 목적별 재가중 + 역할 분류 + evidence 연결 + risks/대안. 외부 커넥터(뉴스·YouTube·인스타)는 미연동 표기(P1/P4)
