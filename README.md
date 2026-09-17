# SPONPIK — 작업 루트 (문서 · 인프라 설정)

스크린골프 선수 × 브랜드 스폰서십 마켓플레이스 **SPONPIK**의 작업 루트입니다.
이 저장소(`master` 브랜치)에는 **기획·상태 문서와 로컬 인프라 설정만** 있습니다. 소스 코드는 아래 두 저장소가 원본입니다.

| 구성 | 저장소 · 브랜치 | 배포 |
|---|---|---|
| 백엔드 API (Express · Prisma · PostgreSQL) | https://github.com/pine528/screen-golf-sponsor — `main` | Render |
| 프론트엔드 (React · Vite · Tailwind) | https://github.com/pine528/screen-golf-sponsor-frontend — `redesign`(프리뷰) / `main` | Vercel |
| 데이터베이스 | — | Railway PostgreSQL |
| 문서 | 이 저장소 `master` — `docs/` | — |

로컬에서는 `src/backend`, `src/frontend`가 각각 위 저장소를 클론한 폴더이며, 이 루트 저장소는 `src/`를 추적하지 않습니다.

## 문서 (`docs/`)

- `PROJECT_STATE.md` — 현재 기능·API·화면·불변식 요약 (작업 전 반드시 읽음)
- `DEVLOG.md` — 작업 기록 (append only)
- `REDESIGN_BACKLOG.md` — 시안 대비 보류·미결정 항목 (C8~C11)
- `ENV_SETUP.md` — 환경변수·외부 서비스 설정
- `DR_RUNBOOK.md` — 백업·복구 절차
- `DEMO_GUIDE.md` — 데모 시나리오
- `CLAUDE.md` — 개발 규칙(불변식·Definition of Done)

## 로컬 개발

```bash
docker compose up -d            # PostgreSQL localhost:5432 (screengolf / postgres / postgres)
cd src/backend && npm install && cp .env.example .env && npm run prisma:generate && npx prisma db push && npm run seed && npm run dev
cd src/frontend && npm install && cp .env.example .env && npm run dev
```

자세한 절차와 스크립트는 각 저장소의 README를 참고하세요.

## 시드 기본 계정 (로컬 전용)

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | admin@screengolf.com | admin123! |
| 브랜드 | brand@example.com | brand123! |
| 선수 | athlete@example.com | athlete123! |
| 팬 | fan@example.com | test123! |

운영 환경에서는 반드시 변경합니다.
