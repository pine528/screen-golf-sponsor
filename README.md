# Screen Golf Micro Sponsor Marketplace

스크린골프 선수 의류/모자 광고 슬롯을 경매 방식으로 거래하는 B2B 마켓플레이스 플랫폼입니다.

## 폴더 구조

```
├── src/
│   ├── backend/         # Express.js API 서버 (Prisma + PostgreSQL)
│   └── frontend/        # React + Vite 프론트엔드
├── docs/                # API 문서 및 기획 문서
├── docker-compose.yml   # 로컬 PostgreSQL 컨테이너
└── README.md
```

## 로컬 개발 환경 설정

### 1. 사전 요구사항
- Node.js 18+
- Docker Desktop (PostgreSQL용)
- npm 또는 yarn

### 2. 데이터베이스 실행

```bash
# 프로젝트 루트에서
docker compose up -d
```

PostgreSQL이 `localhost:5432`에서 실행됩니다.
- DB: `screengolf`
- User: `postgres`
- Password: `postgres`

### 3. 백엔드 실행

```bash
cd src/backend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env

# Prisma 클라이언트 생성
npm run prisma:generate

# DB 마이그레이션 + 시드 데이터 (한 번에)
npm run db:reset

# 또는 개별 실행:
# npm run db:migrate   # 마이그레이션만
# npm run db:seed      # 시드만

# 개발 서버 실행
npm run dev
```

백엔드가 `http://localhost:3000`에서 실행됩니다.

헬스체크: `GET http://localhost:3000/api/health`

### 4. 프론트엔드 실행

```bash
cd src/frontend

# 의존성 설치
npm install

# 환경변수 설정 (선택)
cp .env.example .env

# 개발 서버 실행
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

## 데모 계정

시드 데이터로 생성되는 테스트 계정:

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@screengolf.com | admin123! |
| 브랜드 | brand@example.com | brand123! |
| 선수 | athlete@example.com | athlete123! |

## 시드 데이터 내용

`npm run db:seed` 실행 시 생성되는 데모 데이터:
- 3개 사용자 (관리자, 브랜드, 선수)
- 6개 슬롯 템플릿 (가슴, 소매, 모자 등)
- 7개 금지 카테고리 (담배, 주류 등)
- 1개 이벤트 (2026 GTOUR 1차 대회)
- **1개 LIVE 경매** (즉시 입찰 테스트 가능)

## API 문서

### Postman 컬렉션

`docs/postman/` 폴더의 컬렉션을 import하여 사용하세요.

**주의**: Base URL 설정 시 `/api`를 포함해야 합니다.
```
http://localhost:3000/api
```

### 주요 API 엔드포인트

```
POST   /api/auth/login          # 로그인
GET    /api/auctions            # 경매 목록
GET    /api/auctions/live       # 진행중인 경매
POST   /api/auctions/:id/bid    # 입찰하기
GET    /api/health              # 헬스체크
```

### OpenAPI 스펙

`docs/openapi_v0_9.yaml` 파일이 있으나, 현재 코드와 일부 불일치할 수 있습니다.
> **TODO**: OpenAPI 스펙과 실제 API 동기화 필요

## 검증 체크리스트

로컬 환경이 정상적으로 설정되었는지 확인:

1. [ ] `docker compose up -d` → PostgreSQL 컨테이너 실행됨
2. [ ] `npm run dev` (backend) → `/api/health` 응답 확인
3. [ ] `npm run db:reset` → 마이그레이션 + 시드 성공
4. [ ] `GET /api/auctions/live` → 경매 1개 이상 조회됨
5. [ ] `npm run dev` (frontend) → 로그인 가능
6. [ ] 경매 목록 페이지에서 LIVE 경매 카드 표시됨
7. [ ] 입찰 버튼 클릭 가능

## 문제 해결

### 프론트엔드 소스 파일이 없는 경우

```bash
cd src/frontend
git restore .
```

### 데이터베이스 초기화

```bash
cd src/backend
npm run db:reset   # drop → migrate → seed
```

### 포트 충돌

- 백엔드 기본 포트: 3000 (`.env`의 `PORT`로 변경 가능)
- 프론트엔드 기본 포트: 5173
- PostgreSQL: 5432

## 배포 환경

- **Backend**: Render (https://screen-golf-sponsor.onrender.com)
- **Frontend**: Vercel
- **Database**: Render PostgreSQL

## 라이선스

Private - All rights reserved
