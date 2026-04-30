# SPONPIK 1차 론칭 — 납품 문서 패키지

## 목차

| 파일 | 내용 |
|---|---|
| [01_DATA_MAPPING.md](01_DATA_MAPPING.md) | 외부 소스 ↔ DB 필드 ↔ 화면 매핑표 |
| [02_QA_REPORT.md](02_QA_REPORT.md) | QA 결과 / 회귀 테스트 / 알려진 이슈 |
| [03_OPERATIONS_GUIDE.md](03_OPERATIONS_GUIDE.md) | 일일 운영 체크리스트 / 화면별 가이드 |
| [04_INTEGRATION_ISSUES.md](04_INTEGRATION_ISSUES.md) | 외부 연동 현황 / 미완 항목 / 우회책 |

## 핵심 결정 사항

1. **관리자 세팅 우선 정책**:
   `Event.activeDays > query.days > 시스템 기본 14`
   `MANUAL 입력값 > GTOUR_API 자동 동기화`

2. **종목 카테고리**: 1차 골프/스크린골프 활성, 4종목(야구/축구/배구/농구)은 비활성 시드.

3. **호가 리스트**: 5단계 + 누적 합 — UI 산출, DB는 단계별 입찰 단일 트랜잭션.

4. **데이터 출처 표기**: `DataSourceBadge` (실측 / 연동 / 추정).

## 빠른 시작

```bash
# 백엔드 실행
cd src/backend && npm install && npx prisma generate && npm run dev

# 프론트엔드 실행
cd src/frontend && npm install && npm run dev

# 시드 (선수 5명 + 종목 6개)
cd src/backend && npx ts-node prisma/seed-athletes.ts
```

## 주요 화면

- **공개**: `/athletes` (선수 목록), `/athletes/:id` (상세 + 호가창)
- **관리자**: `/admin/tournament-activation` (대회 활성화/N값), `/admin/athletes/event-results`
- **브랜드**: `/admin/funnel/integrated-report`
