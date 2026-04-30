# 데이터 매핑표 — SPONPIK 론칭

> 외부 소스(PDF/외부 API/관리자 입력) ↔ DB 필드 ↔ 화면 노출 위치
> 작성: 2026-04-29 / 대상: 1차 골프 + 스크린골프

---

## 1. Athlete (선수)

| 화면 표기 | DB 필드 | 출처 | 비고 |
|---|---|---|---|
| 선수명 | `athletes.name` | PDF "성명" / 회원가입 입력 | 필수 |
| 본명 | `athletes.real_name` | PDF "실명" / KYC 문서 | 화면에 다를 때만 표시 |
| 투어 | `athletes.tour` | PDF "투어 (KLPGA 등)" | KLPGA / KPGA / WGTOUR |
| 종목 | `athletes.sport_type` | 관리자 매핑 | `GOLF` / `SCREEN_GOLF` 등 (Sport.code) |
| 종목 카테고리 | `athletes.sport_id` → `sports.name` | Sport 모델 | 트리(상위/하위) |
| 신장 (cm) | `athletes.height` | PDF "신장 (176cm)" | 정수형 |
| 거주 지역 | `athletes.region` | PDF "거주지" | 자유 텍스트 (예: "경기도 성남시") |
| 데뷔 연도 | `athletes.debut_year` | PDF "정/준회원 일자" | 정수 (예: 2018) |
| 소속 | `athletes.affiliation` | PDF "소속사/계약" | 메인 스폰서/매니지먼트 |
| 프로필 사진 | `athletes.profile_image_url` | PDF 이미지 추출 → CDN | `/golfers/<slug>.jpeg` |
| 자기소개 | `athletes.bio` | PDF "한 줄 소개" | 짧은 텍스트 |
| 인스타 | `athletes.social_links.instagram` | PDF "SNS" | username 또는 URL |
| 메인 스폰서 | `athletes.primary_sponsors[]` | PDF "후원사" | string array |
| KYC 상태 | `athletes.kyc_status` | KYC 심사 | NOT_SUBMITTED / SUBMITTED / APPROVED / REJECTED |

**노출 위치**:
- `/athletes` 카드 리스트 — 사진/이름/투어/신장/지역/데뷔
- `/athletes/:id` 상세 Hero — 모든 필드 + 호가창

---

## 2. Sport (종목 카테고리)

| 화면 표기 | DB 필드 | 출처 | 비고 |
|---|---|---|---|
| 종목 코드 | `sports.code` | 관리자 입력 | 유니크 (GOLF, SCREEN_GOLF, BASEBALL...) |
| 종목명 | `sports.name` | 관리자 입력 | 한글명 |
| 상위 카테고리 | `sports.parent_code` | 관리자 입력 | null 또는 부모 code |
| 활성 여부 | `sports.is_active` | 관리자 토글 | 비활성 시 공개 API에서 제외 |
| 표시 순서 | `sports.display_order` | 관리자 입력 | 낮을수록 상단 |

**1차 시드 (운영 가능)**:
- `GOLF` (골프) — 활성
- `SCREEN_GOLF` (스크린골프, parent=GOLF) — 활성

**2차 확장 시드 (비활성 상태 등록)**:
- `BASEBALL` (야구), `SOCCER` (축구), `VOLLEYBALL` (배구), `BASKETBALL` (농구)

---

## 3. Event (대회)

| 화면 표기 | DB 필드 | 출처 | 비고 |
|---|---|---|---|
| 대회명 | `events.name` | 관리자 등록 / GTOUR API | 필수 |
| 투어 | `events.tour` | 관리자 / GTOUR | 자유 텍스트 |
| 카테고리 | `events.category` | **관리자 입력** | 정규투어 / 시드전 / 드림투어 / 점프투어 / 챔피언스 / 친선전 |
| 종목 | `events.sport_id` | 관리자 매핑 | Sport.id 참조 |
| 본선 시작일 | `events.date_start` | 관리자 / GTOUR | DateTime |
| 본선 종료일 | `events.date_end` | 관리자 / GTOUR | DateTime |
| 예선일 | `events.qualifying_date` | **관리자 입력** | nullable |
| 활성 여부 | `events.is_active` | **관리자 토글** | false 시 `/events/active`에서 제외 |
| 활성 일수(N) | `events.active_days` | **관리자 우선** | null 시 시스템 기본 14일 |
| 표시 순서 | `events.display_order` | **관리자 입력** | 낮을수록 상단 |
| 장소 | `events.venue` | 관리자 / GTOUR | 골프장명 등 |

**관리자 우선 정책 (3-7)**:
1. `Event.activeDays` (관리자 화면 직접 지정)
2. `?days=N` 쿼리 (외부 연동/클라이언트)
3. 시스템 기본 14일

---

## 4. SlotInstance (슬롯)

| 화면 표기 | DB 필드 | 출처 | 비고 |
|---|---|---|---|
| 슬롯명 (오버라이드) | `slot_instances.slot_name` | 관리자 입력 | 비어있으면 SlotTemplate.name 사용 |
| 슬롯 정렬 | `slot_instances.slot_order` | 관리자 입력 | 좌측 카드 정렬 (낮을수록 상단) |
| 활성 여부 | `slot_instances.is_active` | 관리자 토글 | 운영 비활성 시 노출 제외 |
| 현재가 | `auctions.current_price` | 시스템 (입찰 트리거) | KRW 정수 |
| 최소 단위 | `auctions.min_bid_increment` | SlotTemplate / 관리자 | 기본 10,000 |
| 호가 5단계 | (계산값) | `currentPrice + minIncrement * step` | UI에서 산출 |
| 5단계 누적 | (계산값) | sum(tier1..tier5) | UI에서 산출 |

---

## 5. AthleteEventResult (외부 경기결과)

| 화면 표기 | DB 필드 | 출처 | 비고 |
|---|---|---|---|
| 대회명 | `athlete_event_results.event_name` | GTOUR / 관리자 | |
| 일자 | `athlete_event_results.event_date` | GTOUR / 관리자 | |
| 순위 | `athlete_event_results.rank` | GTOUR / 관리자 | nullable |
| 상금 | `athlete_event_results.prize_amount` | GTOUR / 관리자 | KRW |
| 출처 | `athlete_event_results.source` | 시스템 | `MANUAL` / `GTOUR_API` |

**관리자 우선**: `MANUAL` 입력값은 `GTOUR_API` 자동 동기화 시 덮어쓰지 않음.

---

## 6. 외부 연동 ↔ 내부 매핑

| 외부 시스템 | 외부 필드 | 내부 매핑 |
|---|---|---|
| GTOUR API | `tournament.name` | `events.name` |
| GTOUR API | `tournament.start_date` | `events.date_start` |
| GTOUR API | `result.player_name` | `athletes.name` (이름 매칭) |
| GTOUR API | `result.rank` | `athlete_event_results.rank` |
| 외부몰 픽셀 | `order_id` | `funnel_orders.external_order_id` (멱등 키) |
| 외부몰 Postback | `gross_amount` | `funnel_orders.gross_amount` |
| TossPayments | `paymentKey` | `payments.payment_key` |
| TossPayments | `orderId` | `payments.order_id` |

---

## 7. 미수집 / 추정 필드 (DataSourceBadge)

| 필드 | 상태 | 사유 |
|---|---|---|
| ROI 노출 횟수 | **추정** (PDF 이미지 추출 + 영상 분석 미완) | 영상 분석 자동 반영 미구현 |
| ROI 시청자 도달 | **추정** | 외부 방송사 데이터 미연동 |
| 외부몰 매출 | **연동** (PixelInstall + Postback) | 브랜드별 픽셀 키 발급 시 |
| 카카오/네이버 검색량 | **미수집** | 차후 SearchAd API 연동 |

화면에서 `DataSourceBadge` 컴포넌트로 "실측 / 연동 / 추정"을 구분 표기.
