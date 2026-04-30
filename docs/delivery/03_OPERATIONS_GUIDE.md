# 운영 가이드 — SPONPIK 1차 론칭

> 작성: 2026-04-29 / 대상: 운영자(ADMIN) + 백오피스 담당자

---

## 1. 일일 운영 체크리스트

### 매일 09:00
- [ ] `/admin/tournament-activation` — 오늘부터 N일 내 시작 대회 점검
- [ ] `/admin/funnel/campaigns` — 어제 발생한 자산 생성 실패 케이스 재시도
- [ ] `/admin/finance/topups` — 결제 실패 / pending 토픕 검수
- [ ] `/admin/funnel/integrated-report` — 어제 ROI 변동률 ±20% 이상 캠페인 확인

### 매주 월요일
- [ ] `/admin/athletes/event-results` — GTOUR 자동 동기화 결과 검수
- [ ] `/admin/funnel/settlements` — 지난주 CPA/CPS 정산 LedgerTx 확인
- [ ] Railway DB 백업 상태 확인 (gondola.proxy.rlwy.net)

---

## 2. 대회 활성화 / N값 관리

### 화면: `/admin/tournament-activation`

**개념**:
- `isActive` (활성화 토글): false 시 공개 `/events/active` 응답에서 제외
- `activeDays` (N): 본선일 N일 전부터 활성. 미설정 시 시스템 기본 14일
- `displayOrder`: 낮을수록 상단 노출
- `category`: 정규투어 / 시드전 / 드림투어 / 점프투어 / 챔피언스 / 친선전

**관리자 우선 정책**:
1. `Event.activeDays` (이 화면)
2. `?days=N` 쿼리 (외부)
3. 시스템 기본 14

**예시 시나리오**:
- 대회 14일 전 자동 노출 → `activeDays=14` (기본)
- 7일만 노출하고 싶음 → `activeDays=7`
- 30일 미리 띄우고 싶음 → `activeDays=30`
- 대회 취소/연기 → `isActive=false` 즉시 반영

---

## 3. 종목 (Sport) 관리

### API: `GET /api/sports/admin/all` / `PATCH /api/sports/:id`

1차 론칭 활성: `GOLF`, `SCREEN_GOLF`
2차 확장 시 비활성 종목(`BASEBALL`, `SOCCER`, `VOLLEYBALL`, `BASKETBALL`)을 활성화하면 즉시 노출.

**신규 종목 추가**:
```bash
POST /api/sports
{ "code": "TENNIS", "name": "테니스", "displayOrder": 60 }
```

---

## 4. 선수 등록 / 수정

### 새 선수 등록
1. ATHLETE 회원가입 (이메일/비번)
2. `/admin/users` — 해당 유저 KYC 상태 `APPROVED`
3. `/admin/entities/athletes` — Athlete 프로필 입력
   - **필수**: name, tour, sportType
   - **권장**: height, region, debutYear, affiliation, profileImageUrl
4. PDF 사진 추출 → Cloudinary 업로드 → `profileImageUrl` 입력

### 시드 스크립트 (대량 등록)
```bash
cd src/backend
DATABASE_URL=<prod_url> npx ts-node prisma/seed-athletes.ts
```

---

## 5. 슬롯 운영

### 화면: `/admin/slots`

- **slotName** 비어있을 때: SlotTemplate.name 사용 (예: "모자 정면")
- **slotOrder**: 좌측 슬롯 카드 정렬
- **isActive=false**: 운영 중지 (공개 페이지 미노출)

### 호가 정책
- **minBidIncrement**: SlotTemplate 기본값 또는 슬롯별 오버라이드
- 호가 리스트 5단계: 자동 계산 (현재가 + N×increment)
- 5단계 누적: UI 안내용 (실제 입찰은 단계별)

---

## 6. 풀 퍼널 운영

### 캠페인 자산 자동 생성
1. ADMIN으로 캠페인 활성화 → 자동 생성
2. 실패 시 `/admin/funnel/campaigns` 재시도 버튼

### 픽셀 설치 (외부몰 연동)
1. `/admin/pixel-management` — 브랜드별 픽셀 키 발급
2. 브랜드에게 픽셀 키 + 도메인 화이트리스트 전달
3. 외부몰 HTML에 스크립트 삽입:
```html
<script src="https://cdn.sponpik.com/pixel/sponpik-pixel.js" data-pixel-key="pk_xxx"></script>
```

### 환불 처리
1. 외부몰에서 Postback 발사 (자동) — 또는
2. ADMIN이 `POST /api/events/refund` 수동 호출

---

## 7. 결제 / 정산

### TossPayments (현재: 테스트키)
- 환경변수: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- 운영 전환 시: Render env에서 라이브키로 교체 + 재배포

### 정산
- 자동 cron: `funnelSettlement.cron.ts` (매일 자정)
- 수동: `/admin/funnel/settlements`에서 강제 실행
- 모델: `Campaign.pricingModel` (FIXED / CPA / CPS / HYBRID)

---

## 8. 모니터링

### 로그
- Render: 백엔드 로그 (https://dashboard.render.com)
- Vercel: 프론트엔드 로그 (https://vercel.com/dashboard)

### DB
- Railway Studio: `npx prisma studio --schema prisma/schema.prisma`
- 수동 쿼리: `psql "<DATABASE_URL>"`

### 알림
- 정산 실패 / 환불 다발 발생 시 Slack #sponpik-ops 채널 (webhook 등록 예정)

---

## 9. 비상 절차

### 결제 장애
1. `/admin/finance/topups` — pending 건수 확인
2. TossPayments 콘솔에서 결제 상태 조회
3. 수동 보정: `/admin/finance/reconciliation`

### DB 장애
1. Railway 콘솔 — DB 상태 확인
2. 최근 백업 시점 확인 (`/docs/DR_RUNBOOK.md`)
3. 복구 수행 시 점검 페이지 안내

### 픽셀 / 외부몰 연동 장애
1. `/api/external/track` 엔드포인트 ping
2. 외부몰 도메인 화이트리스트 확인 (`PixelInstall.domains`)
3. CORS 헤더 점검

---

## 10. 자주 묻는 질문 (운영자용)

**Q1. 대회를 임시로 숨기고 싶어요.**
→ `/admin/tournament-activation`에서 `isActive` 토글 비활성.

**Q2. 호가 단위를 바꿀 수 있나요?**
→ 슬롯별 `auctionMinBid` 또는 SlotTemplate 기본값 수정. 변경 즉시 반영.

**Q3. 선수 사진을 다시 올리려면?**
→ Cloudinary 업로드 → `Athlete.profileImageUrl` 갱신 (admin/entities/athletes).

**Q4. GTOUR 데이터가 안 들어와요.**
→ 1차 론칭은 GTOUR 실 API 미연동. `/admin/athletes/event-results`에서 수동 입력.

**Q5. 종목을 추가하려면?**
→ `POST /api/sports` 호출 또는 향후 `/admin/sports` 화면(2차 추가 예정).
