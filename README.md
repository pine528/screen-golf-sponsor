# SPONPIK Backend

스크린골프 선수 × 브랜드 스폰서십 마켓플레이스 **SPONPIK**의 API 서버입니다.
Express + TypeScript + Prisma(PostgreSQL). 배포는 Render, DB는 Railway PostgreSQL.

- 프론트엔드 저장소: https://github.com/pine528/screen-golf-sponsor-frontend (Vercel, 브랜치 `redesign` → 프리뷰 / `main`)
- 기획·상태 문서: 이 저장소 `master` 브랜치의 [`docs/`](https://github.com/pine528/screen-golf-sponsor/tree/master/docs)
  (`PROJECT_STATE.md` 현재 기능·API 요약, `DEVLOG.md` 작업 기록, `REDESIGN_BACKLOG.md` 보류 항목, `ENV_SETUP.md`, `DR_RUNBOOK.md`)

## 실행

```bash
npm install
cp .env.example .env          # DATABASE_URL, JWT_SECRET 등 (ENV_SETUP.md 참고)
npm run prisma:generate
npx prisma db push            # 스키마 반영 (migrations/ 는 참고용 SQL)
npm run seed                  # 기본 계정·슬롯 템플릿·데모 스토어/파트너 브랜드 (멱등)
npm run dev                   # http://localhost:3000/api
```

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | ts-node 개발 서버 (파일 감시 없음, 수정 후 재시작) |
| `npm run build` / `npm start` | tsc 빌드 후 `dist/index.js` 실행 (Render) |
| `npm run seed` | `prisma/seed.ts` — 관리자/브랜드/선수/팬 계정, 슬롯 템플릿, 팬스토어·소개 파트너 시드 |
| `npm test` | Jest e2e (`tests/`) |

시드 기본 계정: `admin@screengolf.com`(관리자) · `brand@example.com`(브랜드) · `athlete@example.com`(선수) · `fan@example.com`(팬). 비밀번호는 `.env`의 `SEED_<ROLE>_PASSWORD`로 지정하며, 비워 두면 시드 실행 시 무작위로 만들어 콘솔에 출력한다. 이미 있는 계정의 비밀번호는 시드가 바꾸지 않는다.

## 구조

```
src/
├── index.ts            # Express 앱 · CORS · 라우터 마운트
├── routes/             # 도메인별 라우터 (/api/<도메인>)
├── services/           # 비즈니스 로직 (Prisma 접근은 여기서만)
├── middleware/         # authenticate / optionalAuth / 역할 가드
└── utils/
prisma/
├── schema.prisma       # 단일 스키마
├── migrations/         # 변경 이력 SQL (배포는 `prisma db push`)
├── seed.ts             # 멱등 시드 진입점
└── seed-about-demo.ts  # 로컬 검증용 데모 (운영 금지)
scripts/                # DB 백업·복구·릴리스 프리플라이트
tests/                  # e2e (escrow · admin finance 불변식)
```

주요 도메인: 인증/역할(ADMIN·BRAND·ATHLETE·FAN·AGENCY) · 선수/슬롯/오퍼 · 직접 PICK/추천 PICK · 계약/결제/정산 · 팬 참여(VOTE·팬온도·팬포인트·팬스토어) · 스폰픽 소개(매칭사례·성과보장) · 관리자 콘솔.

## 지켜야 하는 불변식

- 돈·포인트 잔액 변동은 원장(Ledger) 기록과 같은 트랜잭션에서만 일어난다. 잔액 < 0 차감 금지, 멱등키/유니크 제약으로 중복 처리 차단.
- 팬 투표 정산: 정답자 중 무작위 k명, `floor(A/k)` 지급, 잔여는 플랫폼 지갑.
- 측정되지 않은 수치는 0이 아니라 `null`/"집계 중"으로 내려준다 (LEG-06).
- 성과보장 정책은 버전으로 관리하고 ACTIVE 버전은 수정하지 않는다.

## 배포

`render.yaml` — build: `npm ci && prisma generate && prisma db push && npm run build`, start: `npm start`.
환경변수는 Render 대시보드에서 관리한다 (`.env`는 커밋하지 않음).
