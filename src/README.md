# 스크린골프 프로선수 마이크로 스폰서 마켓플레이스

스크린골프(GTOUR/WGTOUR) 프로선수의 추가 광고 슬롯을 경매 기반으로 거래하는 양면 마켓플레이스 시스템입니다.

## 프로젝트 구조

```
src/
├── backend/          # Node.js + Express + TypeScript 백엔드
│   ├── prisma/       # Prisma ORM 스키마 및 시드 데이터
│   ├── src/
│   │   ├── config/       # 환경설정
│   │   ├── controllers/  # API 컨트롤러
│   │   ├── middleware/   # Express 미들웨어
│   │   ├── models/       # Prisma 클라이언트
│   │   ├── routes/       # API 라우트
│   │   ├── services/     # 비즈니스 로직
│   │   ├── types/        # TypeScript 타입
│   │   └── utils/        # 유틸리티 함수
│   └── package.json
│
└── frontend/         # React + TypeScript + Tailwind CSS 프론트엔드
    ├── src/
    │   ├── components/   # React 컴포넌트
    │   ├── hooks/        # Custom React Hooks
    │   ├── pages/        # 페이지 컴포넌트
    │   ├── services/     # API 서비스
    │   ├── types/        # TypeScript 타입
    │   └── utils/        # 유틸리티 함수
    └── package.json
```

## 주요 기능

### 1. 슬롯 템플릿 (Top 6 슬롯)
- SG-01: 상의 가슴 좌측 (Chest-L)
- SG-02: 상의 가슴 우측 (Chest-R)
- SG-03: 상의 소매 우측 (Upper Sleeve-R)
- SG-04: 상의 소매 좌측 (Upper Sleeve-L)
- SG-05: 모자 측면 (Left Side Cap)
- SG-06: 모자 후면 (Back Cap)

### 2. 경매 시스템
- **비공개 프록시(Proxy) 입찰**: 최대 금액만 입력하면 시스템이 자동 경쟁
- **2nd-price 정산**: 차순위 + 최소증분으로 최종 가격 결정
- **스나이핑 방지 (Soft Close)**: 마감 직전 입찰 시 자동 연장 (최대 10분)
- **충돌룰**: 동일 이벤트/선수에서 경쟁 카테고리 동시 낙찰 방지

### 3. 사용자 역할
- **브랜드(광고주)**: 캠페인 생성, 입찰/오토비드, 소재 업로드, 리포트 확인
- **선수/매니지먼트**: 슬롯 가용성 설정, 계약 승인, 부착 인증, 정산 수령
- **Admin(운영)**: 투어/이벤트 관리, KYC 심사, 소재 검수, 정산 처리

### 4. 계약 및 정산 흐름
1. 경매 종료 → 낙찰
2. 계약 생성 → 전자서명
3. 소재 업로드 (T+24h 내) → 검수
4. 부착 인증 사진 업로드 → 검수
5. 정산 생성 (D+7 영업일) → 지급

## 백엔드 설정

### 요구사항
- Node.js 18+
- PostgreSQL 14+
- Redis (선택사항, 경매 락 용)

### 설치 및 실행

```bash
cd src/backend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 DATABASE_URL, JWT_SECRET 등 설정

# Prisma 클라이언트 생성
npm run prisma:generate

# 데이터베이스 마이그레이션
npm run prisma:migrate

# 시드 데이터 삽입
npm run prisma:seed

# 개발 서버 실행
npm run dev
```

### API 엔드포인트

| 구분 | Method | Path | 설명 |
|------|--------|------|------|
| Auth | POST | /api/auth/login | 로그인 |
| Auth | POST | /api/auth/register | 회원가입 |
| Auth | POST | /api/auth/refresh | 토큰 재발급 |
| Brand | GET | /api/brands/me | 내 브랜드 정보 |
| Athlete | GET | /api/athletes/me | 내 선수 정보 |
| Event | GET | /api/events | 이벤트 목록 |
| Slot | GET | /api/slots/instances | 슬롯 인스턴스 목록 |
| Auction | GET | /api/auctions | 경매 목록 |
| Auction | GET | /api/auctions/live | 진행 중인 경매 |
| Bid | POST | /api/auctions/:id/bids | 입찰 |
| Contract | GET | /api/contracts | 계약 목록 |
| Contract | POST | /api/contracts/:id/assets | 소재 업로드 |
| Contract | POST | /api/contracts/:id/verification | 부착 인증 |
| Admin | GET | /api/admin/dashboard | 관리자 대시보드 |

## 프론트엔드 설정

### 요구사항
- Node.js 18+

### 설치 및 실행

```bash
cd src/frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버는 http://localhost:5173 에서 실행됩니다.

## 데이터베이스 스키마 (주요 엔티티)

- **User**: 사용자 계정 (Brand/Athlete/Admin)
- **Brand**: 브랜드(광고주) 프로필
- **Athlete**: 선수 프로필
- **Event**: 대회/방송 이벤트
- **SlotTemplate**: 슬롯 템플릿 (규격, 금지영역 등)
- **SlotInstance**: 특정 이벤트/선수의 슬롯 인스턴스
- **Auction**: 경매
- **Bid**: 입찰
- **Contract**: 계약
- **CreativeAsset**: 광고 소재
- **Verification**: 부착 인증
- **Settlement**: 정산

## 비기능 요구사항

- **보안**: JWT + RBAC, 모든 상태변경 API는 audit log 기록
- **결제/정산**: PG 연동(카드/계좌), D+7 영업일 정산
- **검수**: 소재 자동검사 + 운영자 승인 워크플로우
- **알림**: 이메일/SMS/앱푸시 (입찰, 낙찰, 소재반려 등)

## 참고 문서

- [개발 핸드오프 패키지 v0.9](./스크린골프_비딩형_스폰서_매칭_개발핸드오프_v0_9.docx)
- [투자자용 사업계획서 v1.3](./투자자용_사업계획서_스크린골프_마이크로스폰서_마켓플레이스_v1_3.docx)
- [OpenAPI Spec v0.9](./openapi_v0_9.yaml)
