# PROJECT_STATE.md - 현재 구현 상태 요약

> 최종 업데이트: 2026-09-02 (직접 선택 PICK v1.0 9단계 재구성)
> 보류 항목·미결정 값은 [docs/REDESIGN_BACKLOG.md](REDESIGN_BACKLOG.md)에 모아둔다.

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

## 리디자인 v2.0 — 후원 3경로 (2026-09-01)
IA: 후원하기 = **직접 PICK** / **추천 PICK** / **디지털 파트너 월 구독** 3경로. 모두 승인 선행(결제는 선수 승인 후).

### 직접 PICK — `/sponsor/pick`
- 화면: 선수 선택 → 슬롯 선택(`/:athleteId/slots`) → 후원 구성(`/:athleteId/configure`) → 기존 신청 상태·결제
- API `/direct-pick`: `options` · `athletes`(+`/:id`, `/:id/slots`) · `POST quote`
- 정책표는 `directPick.service.ts` 한 곳: 기간(대회1회/30일/6개월/12개월) · 유형(APPAREL/SNS/STORE/BUNDLE)
  · 추가활동 5종 · 구매방식(BUY_NOW/AUCTION/PROPOSAL). 6·12개월은 경매 금지
- 가격 = 슬롯 월 단가 × 개월수 + 추가 활동. 신청 시에도 서버가 같은 표로 재계산(§14.4) 후 snapshot 고정
- 신청은 `POST /applications` 재사용 (`sourceType=DIRECT_PICK`, `config`)

### 디지털 파트너 월 구독 — `/digital-partner`
- 화면: 소개 → 모집 선수(`/athletes`) → 상품 선택(`/athletes/:id`) → 승인·계약·결제(`/applications/:id`)
- API `/digital-partner`: `plans` · `athletes`(+`/:id`) · `applications`(생성/조회/`review`/`checkout`) · `subscriptions` · `athlete/requests`
- 플랜 START 49,000 / GROW 99,000 / PLUS 199,000 · 12개월 약정 · 최초 조회 시 자동 시딩
- 상태: SUBMITTED → ATHLETE_APPROVED → ACTIVE (승인 유효 72h, 승인 전 결제 차단, 브랜드 중복 신청 차단)
- **경기복·대회 현장 부착 미포함**을 전 화면에 고지(UX-02)

### 선수 승인함 — `/athlete/requests`
슬롯 신청(ApplicationItem)과 디지털 구독 신청을 한 화면에서 승인/조정/거절. 거절·조정은 사유 필수(BR-04).

### 표기 원칙 (LEG-06 유지)
산출 근거가 없는 지표는 화면에 넣지 않는다 — 시안의 '팬 온도'는 미표시.

## SPONPIK 소개 v1.0 (2026-09-01) — §소개 핸드오프 2026-08-22
소개 5개 메뉴를 계약·성과·권리 데이터에 연결한 신뢰 전환 시스템으로 구현.

- 사용자: `/about/service` `/about/cases`(+`/:slug`) `/about/performance-guarantee`
  `/about/my-guarantees`(+`/:id/appeal`) `/about/how-it-works` `/about/brands`(+`/:slug`)
- 관리자: `/admin/about` `pages` `cases` `policies` `judgements` `appeals` `brands`
  `rights` `analytics` `audit`
- API: 공개 `/api/about/*`, 관리자 `/api/admin/about/*` (ADMIN 전용)

**공개등급 6단계** (`about.service.ts` `shapeMetric`)
PUBLIC_EXACT(정확) / PUBLIC_RANGE(범위) / PUBLIC_LABEL(정성) /
MEMBER_ONLY(로그인) / PARTY_ONLY(계약 당사자) / PRIVATE(미표시).
볼 수 없는 값은 응답에서 아예 제거한다. 값을 뭉개도 출처·검증상태는 공개한다.

**게시 게이트** (`aboutAdmin.service.ts` `publishGate`) — 다음 중 하나라도 막히면 게시 불가.
계약 연결 / 지표 출처 / 초상·로고 권리 유효 / 인용문 승인 / 당사자 승인 / 공개범위 지정.

**성과보장**
- 정책은 버전으로 관리하고 ACTIVE는 수정 불가. 계약은 시점 스냅샷을 복제해 소급을 막는다.
- 판정: ALL / ANY / WEIGHTED. 필수 데이터 미수집은 0이 아니라 `DATA_PENDING`.
- 최종 확정 후 잠금. 정정은 reversal + 새 버전으로만.
- 보완지원은 현금 환급·양도 불가. 발급은 요청자와 다른 관리자 승인 필수.

**권리** — `RightsGrant` 만료 시 게시 자동 차단, 로고는 텍스트로 대체.
**분석** — 가명 ID만 저장하고 이메일·전화번호 형태는 서버에서 거부한다.

## 팬 참여 v1.0 (2026-09-01) — §팬참여 핸드오프 2026-08-22
IA: 팬 참여 = **Fan VOTE** / **팬온도** / **팬포인트** / **팬스토어** (4축), 진입은 `/fan`.

- 화면 16종: `/fan` · `/fan/vote`(+`/:id`) · `/fan/temperature/:athleteId` · `/fan/contributions`
  · `/fan/points`(+`/ledger`) · `/fan/community/:athleteId` · `/fan/letter/:athleteId`
  · `/fan/brand-suggest/:athleteId` · `/fan/store`(+`/:idOrSlug`, `/product/:id`)
  · `/fan/campaign` · `/fan/activity`  (구 화면은 `/fan/*-legacy`)
- API `/fan-hub`: `meta` · `/` · `votes`(+`/:id`, `/:id/ballot`) · `athletes/:id/temperature`
  · `me/contributions` · `me/points` · `me/point-ledger` · `me/letter-quota`
  · `athletes/:id/letters` · `brand-suggest/options` · `me/brand-suggestions`
  · `athletes/:id/brand-suggestions`(GET/POST) · `stores`(+`/:idOrSlug`, `/:id/exit`)
  · `store-products/:id` · `me/store-exits` · `store-postback` · `campaign` · `me/activity`

**팬온도** (`fanTemperature.service.ts`, 산식 `fan-temp-v1.0-2026-08-22`)
- 최근 30일 유효 활동을 0~100으로 환산한 **활성도 지표**. 선수의 실력·가치 점수가 아니다.
- 구성요소 6종 = 활동팬수 30 / VOTE 20 / 커뮤니티 20 / 스토어 15 / 지속성 10 / 선수응답 5.
  각 항목을 `cap`으로 정규화 후 가중합, 최근 7일 1.3배, 신뢰도 계수(표본/30, 하한 0.3), 무효표 감점(최대 15).
- 표본 30명 미만 = 점수 비공개("데이터 축적 중"). 관리자 수동 숫자 입력 금지 — 제외·재계산만 허용.
- 일배치 `FanTemperatureSnapshot`에 산식 버전과 함께 저장, 과거 스냅샷은 덮어쓰지 않는다.

**팬포인트** (`fanPoint.service.ts`)
- 원장 상태: PENDING → AVAILABLE → REVERSED / EXPIRED. 잔액 직접 수정 금지, 모든 변동이 거래로 남는다.
- 적립표 `EARN_RULES` 한 표: 관심선수 3P · VOTE 2P(일5) · 예측정답 5P · 댓글 1P(일5) ·
  게시글 3P(주3) · 브랜드추천 5P(월3) · 채택 30P(월1) · 구매 1%(월 5,000P).
- 유효기간 12개월. 회수·만료는 삭제가 아니라 원거래를 참조하는 역거래로 기록한다.

**Fan VOTE** (`fanHub.service.ts`) — 1계정 1표, 예측형만 마감 전 변경 가능,
개설 30분·30표 미만이면 결과 숨김, 미참여자에게 결과 비공개.

**응원편지** — 월 2통, AutoMod 위반 시 `PENDING`(팬온도·포인트 미반영), 선수 개별 답장 의무 없음.

**브랜드 추천** (`fanBrandSuggest.service.ts`) — 접수→검토→전달→관심→채택/보류/종료.
이해관계 자가표시 필수(NONE 외에는 검토 전 적립 보류), 이유 50~500자, 기본 비공개, 월 3건.

**팬스토어** (`fanStore.service.ts`) — 외부몰 연결형. 내부 결제 없음.
이동 시 익명 `click_id`+UTM 발급, 포인트는 브랜드 구매확정 회신(`store-postback`) 후 적립.
외부몰 이동 내역을 SPONPIK 주문처럼 표시하지 않는다. 책임주체를 모든 화면에 노출.

## 팬 운영 관리자 A01~A12 (2026-09-01)
전 구간 `/admin/fan/*` 화면 + `/api/admin/fan/*` API, ADMIN 역할 전용.
공용 셸 `FanAdminShell` (내비 4그룹: 팬 운영 / 정책 / 커머스 / 분석).

| 화면 | 경로 | 핵심 |
|---|---|---|
| A01 대시보드 | `/admin/fan` | KPI 6 · 예외 큐 · 모듈 상태 · 배치 · 활동 로그 |
| A02·A03 VOTE | `/admin/fan/votes` | 목록·캘린더, 동일 선수 기간 중복 경고, 결과 확인 |
| A04 검수함 | `/admin/fan/moderation` | P0~P3, SLA, 조치 4종, P3만 일괄 승인 |
| A05 신고·제재 | `/admin/fan/reports` | 신고자 익명, 영구정지 2인 승인, 이의제기 |
| A06 팬온도 | `/admin/fan/formula` | 가중치 편집→버전 발행, 이상 징후, 배치 모니터 |
| A07 포인트 정책 | `/admin/fan/point-policy` | 적립·사용·만료·캠페인, 정책 검증 |
| A08 포인트 원장 | `/admin/fan/point-ledger` | 원장 대사, 수동 조정 요청→승인 |
| A09 팬스토어 | `/admin/fan/stores` | UTM·click_id 표시, 게시 전 책임고지 동의 |
| A10 주문·정산 | `/admin/fan/orders` | 외부몰 전환을 주문과 분리 표기 |
| A11 브랜드 추천 | `/admin/fan/brand-suggestions` | 6단계 칸반, 이해관계 건 전달 차단 |
| A12 통합 리포트 | `/admin/fan/report` | KPI 7 · 스토어 퍼널 · 선수 성과 |

**운영 불변식**
- 팬온도 점수와 포인트 잔액은 직접 수정할 수 없다.
  점수는 산식 버전 발행 또는 이벤트 제외 후 재계산, 잔액은 원장 거래로만 바뀐다.
- 영구 정지(`FanSanction.PERMANENT`)와 10,000P 초과 조정(`PointAdjustment`)은
  요청자와 다른 관리자가 승인해야 적용된다.
- 모든 조치는 `AdminActionLog`에 사유·조치자·시각을 남긴다.
- 분모가 0인 지표는 비율을 만들지 않고 null 로 돌려준다 (LEG-06).

## 직접 선택 PICK v1.0 (2026-09-02) — §리디자인 v2.0 전면 재구성
9단계: 선수 탐색 → 선수 확인 → 상품 PICK → 조건 구성 → 견적함 → 승인 요청 → 선수 승인 → 결제 → 완료

- 화면: `/sponsor/direct/athletes` · `/build/:athleteId` · `/build/:athleteId/configure`
  · `/cart` · `/request/:draftId` · `/approval/:requestId` · `/checkout/:applicationId` · `/complete/:applicationId`
- API `/direct-pick`: `options` · `athletes` · `athletes/:id/quick-profile` · `athletes/:id/offers`
  · `POST quote` · `drafts`(GET/POST, `:id`) · `drafts/:id/items` · `items/:id`(PATCH/DELETE)
  · `items/:id/alternatives` · `drafts/:id/{extend-hold,validate,submit}`
- **가격은 서버 quote가 단일 진실원천**(§5.6). 정책표는 `directPick.service.ts` 한 곳:
  기간 5종 · 판매유형 4종 · 추가활동 7종 · 사용범위 4종 · 슬롯 taxonomy 8그룹
- **재고**: 항목별 `InventoryHold` 15분(결제 진입 10분 1회 연장), 트랜잭션 + idempotencyKey.
  `validate`가 가격변경·홀드만료·충돌을 issue 코드로 반환하고 대체 위치 3개를 제안
- **ONLINE_ONLY**는 `offlineUse=false` 강제 — 오프라인 사용 범위를 서버가 제거(§12.3)
- 승인·결제는 기존 `SponsorshipApplication` 모듈 재사용(`sourceType=DIRECT_PICK`, `presetPrice`).
  승인은 **항목 단위**이며 한 선수가 복수 항목을 가질 수 있다
- 이전 `/sponsor/pick/*` 경로는 새 경로로 리다이렉트

## 지금 가능한 후원 (2026-09-03) — 완성형 상품 채널
후원하기 = **직접 선택 PICK** / **스폰픽 추천 PICK** 두 갈래 + **지금 가능한 후원** 섹션·독립 목록.

- 브랜드 화면: `/sponsor`(랜딩) · `/sponsor/available`(목록) · `/sponsor/available/:offerId`(상세)
  · `/sponsor/cart`(보관함·장바구니) · `/sponsor/available/orders/:applicationId`(완료)
- 관리자 화면: `/admin/offers`(A01) · `/admin/offers/new|:id`(A02~A06 빌더)
  · `/admin/offers/placements`(A07) · `/admin/offers/dashboard`(A08)
- API: `/available-offers`(options·sections·목록·상세·:id/quote·impressions)
  · `/offer-cart`(saved·items·checkout) · `/admin/offers`(templates·alerts·dashboard·placements·CRUD·validate·publish)
- **재고**: `availableQty` = 구성요소 가능 수량의 최솟값. 슬롯은 SlotInventory·InventoryHold까지 확인
- **사전승인**: 유효기간·최대수량이 살아 있을 때만 즉시구매(BUY) 허용. 만료 시 승인 흐름으로 전환
- **주문군**: A즉시 / B승인 / C협의 / D경매 / E구독. 다른 군은 함께 결제할 수 없다(CART_GROUP_MISMATCH)
- **hold**: 담기에는 걸지 않고 체크아웃 진입 시 15분 (`offer.service.ts` 상수)
- **예상성과**: 범위·근거·기준일·신뢰도와 "보장하지 않음"을 항상 함께 반환·표시 (LEG-06)
- 승인·계약·결제·완료는 기존 `SponsorshipApplication` 모듈 재사용

## 공개 IA v2.0 배선 (2026-09-02)
전체사이트개편 v2.0 §1.1 GNB = 후원하기 / 선수 / 팬 참여 / 스폰픽 소개 (+마이).
- `PublicHeader` 메가 메뉴가 신규 라우트만 가리킨다 (소개 `/about/service|how-it-works|performance-guarantee|brands|cases`,
  팬 `/fan|/fan/vote|/fan/community|/fan/points|/fan/store`).
- `MobileTabBar` 5탭: 홈 `/` · 후원하기 `/sponsor/available` · 선수 `/athletes` · 팬 참여 `/fan` · 마이.
- `/athletes`(PublicAthletes)는 §7.1 단일 목록: `GET /direct-pick/athletes` 하나로 검색·칩·정렬.
  미집계 팬온도 "집계 중", 미수집 성적 "확인 필요" (LEG-06).
- 로그인 셸 `Layout.tsx` 사이드바는 역할별 그룹(`brandNav`/`athleteNav`/`fanNav`/`adminNav`/`agencyNav`).
  `collapsed` 그룹은 활성 경로가 안에 있을 때만 자동 펼침.
- 구 IA 화면(`/auctions` `/ai-match` `/growth-market` `/features` `/how-it-works` `/for-who` `/guide` `/faq`)은
  라우트만 남고 공개 내비게이션에서 제외. 제거 결정은 `REDESIGN_BACKLOG.md` D.

## 메인 · 통합 핸드오프 v2.1 (2026-09-14)
- 기준 문서 우선순위: `리디자인/7` 통합 핸드오프 v2.1 > 기능별 상세 핸드오프 > 전체사이트 v2.0 > 이전 구현.
  UI는 같은 폴더의 UI/UX 통합 개발가이드 v1.0 §18 매트릭스로 화면별 점검 (미착수분은 `REDESIGN_BACKLOG.md` C8).
- 메인 `/` = 히어로(두 PICK + 슬롯 핫스폿 5종) → 4단계 → 브랜드 캐러셀 → 가치 4종 → CTA → 푸터. 데이터 fetch 없음.
- 히어로 실사는 `public/golfers/bae-jinri-hero.png`(캡션 제거본). 필기체 유틸 `font-script`(Great Vibes).
- 용어 고정(v2.1 Appendix B): 직접 PICK / 스폰픽 추천 PICK / 지금 가능한 후원 / 디지털 파트너 / 상의(가슴 금지) / 성과보장(매출·우승보장 금지).
- (2026-09-14 추가) `/dashboard`는 역할별 Action-first: 브랜드 = 승인/결제/진행/리포트 타일 → 이어서 하기 → 진행 중 → 성과 → 다음 제안,
  선수 = 요청/서명/슬롯/정산 타일 → 승인 목록 → 계약·팬·체크인 → 성과. 구 URL(`/about`, `/about/how`, `/about/guarantee`,
  `/sponsor/digital`, `/opportunities`)은 `App.tsx`에서 Navigate replace.
- (2026-09-14) 직접 PICK 구성은 `/sponsor/direct/build/:athleteId` 한 화면(위치·온라인 상품·기간·판매 방식·추가 활동·사용 범위·서버 견적·담기). `/configure` 경로는 build로 이동.
- (2026-09-14) 관리자 사이드바는 9도메인(선수운영·상품운영·거래운영·팬운영·Trust·CMS·성과보장·데이터품질·분석·감사), `/admin`은 처리할 일 → 콘솔 카드 → 수익.
- (2026-09-14) 선수 상세 `/athletes/:id?tab=profile|games|sponsor|fan|content` 5탭. 브랜드 기본 탭은 sponsor.
- (2026-09-14) 후원 신청 결제 완료(`checkoutApplication`) 시 Campaign 자동 생성·`campaignId` 연결. 계약 스냅샷 예상 범위는 `application.snapshot.plan.expected`.
