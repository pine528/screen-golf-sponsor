# 외부 코드 검토 메모 — 하드코딩·검토 포인트 (2026-09-17)

검토 개발자에게 전달할 목록입니다. "숨겨야 할 것"이 아니라 "코드에 고정돼 있어 손봐야 할 것"을 모았습니다.
버전 기준: `docs/VERSIONS.md` (태그 `v1-current` / `v2-redesign`).

## 1. 환경·주소

| 위치 | 내용 | 권장 |
|---|---|---|
| 백엔드 `src/services/email.service.ts` (8곳) | 알림 메일 링크의 기본 도메인이 옛 주소 `https://screen-golf-sponsor.vercel.app` 로 고정 (`FRONTEND_URL` 미설정 시) | 기본값 제거, `FRONTEND_URL` 필수화 |
| 프론트 `.env.production` | `VITE_API_URL`이 Render 운영 API 고정 | Vercel 환경변수로 이동 |
| 백엔드 `render.yaml` | 빌드 시 `prisma db push` 실행 (마이그레이션 미사용) | 마이그레이션 기반으로 전환 검토 |

## 2. 정책 값이 코드 상수로 고정된 곳

| 위치 | 상수 | 내용 |
|---|---|---|
| `src/services/fanPoint.service.ts` | `EARN_RULES`, `SPEND_RULES`, `BADGES` | 팬포인트 적립/사용 규칙·배지 조건 |
| `src/services/fanHub.service.ts` | `VOTE_CREATE_RULES`, `AD_CRITERIA` | 팬 투표 생성 한도(하루 5개·마감 1h~30d), 응원 광고 기준 |
| `src/services/fanTemperature.service.ts` | `COMPONENTS` | 팬온도 구성 요소·가중치 |
| `src/services/aiMatch.service.ts` | `GROWTH_MARKET_ATHLETES`, `GOAL_WEIGHTS` | AI 매칭 성장시장 선수 목록·목표별 가중치 |
| `src/services/recommendPick.service.ts` | `SLOT_PREF` | 추천 PICK 슬롯 선호 |
| `src/services/donation.service.ts` | `PLATFORM_USER_ID = 'PLATFORM_SYSTEM'` | 플랫폼 지갑 계정 식별자 (시드와 일치해야 함) |
| `src/services/about.service.ts` | `VISIBILITY_LEVELS`, `OBJECTIVE_LABELS`, `MATCH_PROCESS` | 소개 화면 라벨 |
| `.env.example` | `PLATFORM_FEE_RATE=0.20`, 경매 기본값 | 환경변수지만 기본값 의존 |

이 값들은 관리자 화면에서 바꿀 수 없고 배포가 필요합니다. 운영 중 조정이 필요한 것은 DB 설정 테이블 또는 환경변수로 옮기는 것을 권합니다.

## 3. 배포 때마다 자동으로 들어가는 예시 데이터 (`prisma/seed.ts`)

- 기본 계정 5종(관리자·브랜드·선수·에이전시·팬) — 비밀번호는 `SEED_<ROLE>_PASSWORD` 또는 무작위. 이미 있는 계정은 건드리지 않음.
- 슬롯 템플릿(`SLOT_DISPLAY_COORDS`), 팬스토어 데모 3곳/22상품(`fanStoreDemo.service.ts`), 소개 파트너 브랜드 10·매칭사례 2(`aboutDemo.service.ts`).
- 오픈 전에 데모 데이터를 실제 데이터로 교체하거나 시드 훅에서 제외해야 합니다. `prisma/seed-about-demo.ts`는 로컬 검증용(운영 금지).

## 4. 구 화면·중복

- 프론트 `*-legacy` 라우트(구 화면)가 신규 화면과 함께 남아 있음 — `docs/REDESIGN_BACKLOG.md` C8~C11 참고.
- 프론트 `redesign` 브랜치가 최신이며 `main`은 리디자인 이전 UI. 확정 후 머지 예정.

## 5. 표시 수치 규칙 (LEG-06)

측정되지 않은 수치는 서버가 `null`로 내려주고 화면은 "집계 중"/"확인 필요"로 표기합니다. 추정치·임의 숫자를 넣지 않는 것이 규칙이므로, 검토 중 숫자 하드코딩을 발견하면 제거 대상입니다.

## 6. 이력(git history) 관련

- 2026-01-14 첫 커밋에 `.env`가 포함돼 있었고(옛 Supabase DB 주소·예시 JWT 키), 2026-09-17 이전 커밋에는 1회성 데이터 스크립트(선수 이메일·초기 비밀번호)가 있었습니다. HEAD에서는 모두 제거됐고 이력은 정리하지 않았습니다.
- 운영 DB는 Railway이며 Render 환경변수로만 연결합니다. 저장소에 운영 비밀값은 없습니다.
