# CLAUDE.md - Claude Code 프로젝트 설정

## 프로젝트 개요
브랜드-선수 스폰서십 마켓플레이스 + 팬 유료 투표 + 포인트 시스템 + 포인트샵

---

## 자동 로드 규칙

### 항상 읽어야 하는 파일
```
docs/PROJECT_STATE.md  ← 작업 시작 전 반드시 읽을 것
```

### 기록만 하는 파일 (자동 로드 X)
```
docs/DEVLOG.md  ← 작업 완료 시 append만
```

---

## 불변식 (Invariants) - 절대 깨지면 안 됨

### 돈(원화) / 포인트 공통
1. 잔액 변동 = 원장(Ledger) 기록 + 트랜잭션으로 원자적 처리
2. 중복 처리 방지 = DB 유니크 제약 + P2002 graceful 처리
3. 잔액 < 0 차감 금지

### 팬 투표 정산 규칙
1. 정답자 중 랜덤 k명 당첨 (중복 없이)
2. 총 풀 A → 각자 floor(A/k) 지급
3. 잔여(remainder) → 플랫폼 지갑(PLATFORM_USER_ID)
4. 정답자 0명 → 전액 플랫폼 귀속

### 포인트샵 규칙
1. 주문 생성 = 재고 차감 + 포인트 차감 (같은 트랜잭션)
2. 주문 취소 = 재고 복구 + 포인트 환불 (같은 트랜잭션)
3. idempotencyKey로 중복 주문 방지

---

## Definition of Done (작업 완료 조건)

### 코드 변경 시
- [ ] TypeScript 빌드 성공 (backend + frontend)
- [ ] 기존 테스트 통과
- [ ] 돈/포인트 로직은 트랜잭션 + 멱등성 보장

### 문서 업데이트
- [ ] `docs/PROJECT_STATE.md` 업데이트 (기능/API 변경 시)
- [ ] `docs/DEVLOG.md`에 엔트리 추가

### 커밋/푸시
- [ ] Co-Authored-By 포함
- [ ] Frontend/Backend 분리 커밋 (필요 시)

---

## 역할(권한) 요약
| Role | 설명 |
|------|------|
| ADMIN | 운영자 (승인/정산/관리/리포트) |
| BRAND | 브랜드 (입찰/계약/에셋제출) |
| ATHLETE | 선수 (슬롯/계약/검수) |
| FAN | 팬 (투표/포인트/샵/즐겨찾기) |

---

## 저장소 구조
```
src/
├── backend/   → https://github.com/pine528/screen-golf-sponsor.git (Render)
└── frontend/  → https://github.com/pine528/screen-golf-sponsor-frontend.git (Vercel)
```

---

## 개발 명령어
```bash
# Backend
cd src/backend
npm run dev          # 개발 서버
npm run build        # TypeScript 빌드
npm run prisma:generate  # Prisma 클라이언트 생성

# Frontend
cd src/frontend
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
```
