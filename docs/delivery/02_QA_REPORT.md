# QA 결과서 — SPONPIK 론칭

> 작성: 2026-04-29 / 환경: 로컬(localhost:5173/5050) + Railway 프로덕션

---

## 검수 범위

### 검수 항목 (handoff.docx 명시)

| # | 항목 | 결과 | 비고 |
|---|---|---|---|
| 1 | 자산 자동 생성 | ✅ Pass | 캠페인 활성화 시 코드/링크/QR/스토어 자동 생성 |
| 2 | 이벤트 수집 누락 | ✅ Pass | landing→product→cta→add_to_cart→begin_checkout→promo_apply→purchase 7건 적재 |
| 3 | 어트리뷰션 우선순위 | ✅ Pass | promo_code > last_click > session_campaign |
| 4 | 환불 동기화 | ✅ Pass | refund 호출 시 adjustedNetRevenue 즉시 보정 |
| 5 | 권한 제어 (BRAND) | ✅ Pass | 자사 데이터만 접근, 타 브랜드 403 |
| 6 | 권한 제어 (ATHLETE) | ✅ Pass | 본인 데이터만 표시 |
| 7 | 멱등성 (외부 주문) | ✅ Pass | (brandId, externalOrderId) 유니크 — P2002 graceful |
| 8 | 트랜잭션 (purchase) | ✅ Pass | FunnelOrder + FunnelEvent + PromoCode.usageCount 원자 |
| 9 | 개인정보 보호 | ✅ Pass | 주문 응답에 customerHash만, 실명/전화/주소 미노출 |

### SPONPIK 론칭 docx 1차 검수 항목

| # | 항목 | 결과 | 비고 |
|---|---|---|---|
| A | Athlete 구조화 필드 (height/region/debutYear/affiliation/sportType) | ✅ Pass | 5명 시드 재반영 |
| B | Event 카테고리/예선일/표시순서/N값 | ✅ Pass | `/admin/tournament-activation` 화면 |
| C | SlotInstance slotName/slotOrder/isActive | ✅ Pass | 기존 SlotTemplate.name fallback |
| D | Sport 모델 + 1차 골프/스크린골프 시드 | ✅ Pass | 6개 종목 (4개 비활성) |
| E | 호가 리스트 (5단계) + 5단계 누적 | ✅ Pass | `BidTierLadder` 컴포넌트 |
| F | 관리자 대회 활성화 토글 UI | ✅ Pass | `AdminTournamentActivation` |
| G | 관리자 N값 조정 UI | ✅ Pass | 동일 화면 |
| H | 관리자 세팅 우선 정책 | ✅ Pass | activeDays > query.days > 14 |
| I | 데이터 매핑표 / 운영 가이드 / 연동 이슈 | ✅ Pass | docs/delivery/ |
| J | 영상 분석 자동 반영 | ⏸ 보류 | Phase 후속 (수동 입력으로 운영 가능) |

---

## 회귀 테스트

### 시드 데이터
- 로컬: 5명 (안예인/배진리/송유나/오세희/이예빈) ✅
- Railway: 동일 5명 ✅
- Sport 6개 (GOLF, SCREEN_GOLF 활성 + 4종목 비활성) ✅

### 빌드
- backend `npm run build`: ✅ TypeScript 0 error
- frontend `npm run build`: ✅ TypeScript 0 error

### 시각 회귀 (preview_screenshot)
- `/athletes` (목록): ✅ 신장/지역 노출
- `/athletes/:id` (상세 Hero): ✅ 176cm · 성남시 · 2018년 데뷔 노출
- `/athletes/:id` (호가창): ✅ 5단계 호가 + 누적 표시
- `/admin/tournament-activation`: ✅ 토글/N값/카테고리 인라인 편집

---

## 알려진 이슈 / 제한

| 분류 | 이슈 | 우선순위 | 대응 |
|---|---|---|---|
| 영상 분석 | 미디어 추출 자동 반영 미구현 | P3 | 수동 입력으로 운영 (관리자 화면) |
| GTOUR | 실 API 미연동 | P2 | seed-event-results.ts에 가상 데이터 |
| 픽셀 도메인 검증 | CORS 화이트리스트 강제 | P2 | PixelInstall.domains 활용 |
| Sport 트리 깊이 | 1단계만 지원 | P3 | 2-depth (예: 골프 > 스크린/필드) |

---

## 수동 시나리오 결과

1. **자산 생성** → ✅ ADMIN으로 캠페인 활성화 시 4개 자산 자동 생성
2. **공개 미니스토어** → ✅ 비회원 단축 URL 클릭 → STO-01 랜딩 → 이벤트 적재
3. **구매 퍼널** → ✅ 7개 이벤트 + FunnelOrder 1건 생성
4. **브랜드 대시보드** → ✅ KPI 카드 + 주문 귀속 근거 표시
5. **선수 대시보드** → ✅ 본인 기여만 표시
6. **환불 동기화** → ✅ adjustedNetRevenue 즉시 반영
7. **호가 리스트 클릭 입찰** → ✅ 5단계 버튼 클릭으로 즉시 입찰
8. **대회 N값 변경** → ✅ activeDays=7로 변경 시 `/events/active` 응답 변동 확인
9. **종목 비활성화** → ✅ Sport.isActive=false 시 공개 API에서 제외

---

## 결론

**1차 론칭 가능 (Production-Ready)** — 보류 항목(영상 분석)은 수동 입력으로 우회 운영 가능.
