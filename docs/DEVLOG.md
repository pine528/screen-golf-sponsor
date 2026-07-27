# DEVLOG - 개발 기록

> 이 파일은 작업 완료 시 append만 합니다. 자동 로드하지 마세요.
> 500줄 초과 시 `docs/archive/DEVLOG-YYYY-MM.md`로 이동합니다.

---

## 아카이브
- (아직 없음)

---

## [2026-05-08] ROI 대시보드 미구현 항목 자동·수동 수집 시스템 (docx §6 C-1, C-3 보강)

### 변경 사항
docx §6 C-1 (미디어노출) + C-3 (팬덤지수 증가율) 의 자동 수집 미구현 항목을
**자동 수집 + 관리자 수동 입력** 두 트랙으로 보강.

### Phase 1-3: Backend 자동·수동 수집 시스템
1. **신규 모델 3종** (Prisma schema)
   - `AthleteMediaExposure`: 방송/패치/하이라이트 등 수동 입력 (관리자 CRUD)
   - `AthleteFollowerSnapshot`: 일별 YouTube 구독자 스냅샷 (증가율 계산용)
   - `AthleteNewsArticle`: 네이버 뉴스 검색 자동 수집
2. **신규 서비스 3종**
   - `mediaExposure.service.ts`: 수동 입력 CRUD + 누적 합계 집계
   - `followerSnapshot.service.ts`: 스냅샷 캡처 + 7일 증가율 자동 계산
   - `naverNews.service.ts`: 네이버 검색 API + 90일 기사 카운트
3. **Cron 2종 추가**
   - 매일 04:30 KST: 모든 active 선수의 YouTube 구독자 스냅샷
   - 매일 05:00 KST: 모든 active 선수의 네이버 뉴스 자동 수집
     (NAVER_CLIENT_ID/SECRET 환경변수 설정 시 작동)
4. **ROI 대시보드 응답 통합**
   - mediaExposure 카드: 모든 항목이 실제 데이터로 채워짐
   - articleMentions = 수동 입력 합 + 자동 수집(네이버 뉴스 90일)
   - fandom.followerGrowthPct: 7일 전 vs 현재 자동 계산
5. **관리자 라우트 7종 신규**
   - GET/POST/PATCH/DELETE `/athletes/:id/media-exposures`
   - POST `/athletes/:id/sync-news` (단일 선수 즉시)
   - POST `/athletes/sync-followers-all` (전체 즉시)
   - POST `/athletes/sync-news-all` (전체 즉시)

### Phase 4: Frontend 관리자 UI
- 신규 페이지 `/admin/athletes/media-exposure`
  - 선수 선택 → 미디어 노출 기록 CRUD
  - 누적 합계 5장 카드 (현재 ROI 대시보드 반영값 즉시 확인)
  - 자동 수집 3종 즉시 트리거 (디버깅·긴급용)
- api.ts 7종 메서드, Layout 사이드바 메뉴, App.tsx 라우터 등록

### 마이그레이션
- `20260508_add_media_exposure_followers_news` (Railway 적용 완료)

### 영향 파일
- `src/backend/prisma/schema.prisma` (3개 모델 + relations)
- `src/backend/src/services/mediaExposure.service.ts` (신규)
- `src/backend/src/services/followerSnapshot.service.ts` (신규)
- `src/backend/src/services/naverNews.service.ts` (신규)
- `src/backend/src/cron/followerSnapshot.cron.ts` (신규)
- `src/backend/src/routes/athlete.routes.ts` (라우트 + ROI 통합)
- `src/backend/src/index.ts` (cron 등록)
- `src/backend/.env.example` (NAVER_CLIENT_ID/SECRET 추가)
- `src/frontend/src/services/api.ts` (7종 메서드)
- `src/frontend/src/pages/admin/AdminMediaExposure.tsx` (신규)
- `src/frontend/src/App.tsx`, `src/frontend/src/components/Layout.tsx` (라우트/메뉴)

### 후속 필요 작업
1. `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 환경변수 등록 (https://developers.naver.com/apps)
   - 무료, 일 25,000건. 미설정 시 cron skip + 수동 트리거 빈 결과
2. 운영 첫 cron 실행 시 (04:30/05:00 KST 다음 주기)
   - 팔로워 스냅샷부터 누적되어 7일 후부터 증가율 표시
3. 향후 Instagram Graph API / AI 영상 분석 등 추가 자동 수집 확장 가능

---

## [2026-05-07] 선수 상세 docx 8차 정밀 재검토 — 미세 형식 + hint + §7-2 표현

### 변경 사항 (docx 미세 형식 정합)
1. **RoiCard 영역 점수 표시 형식** (docx §4 B-1 '00 / 100' 공백 포함)
   - C-1~D-2 영역 점수의 '/100' → '/ 100' 공백 추가
   - B-1 메인 카드와 표시 형식 통일
2. **AuxStat 3) '최근 업데이트' hint 추가**
   - hint='점수 갱신 시각'
3. **AuxStat 4) '최근 성과' hint 추가**
   - hint='대회명 / 순위'
   - 4개 항목 모두 hint 일관성 확보
4. **§7-2 확장형 산정 기준 정확 표현** (docx §7-2 명시 그대로)
   - '확장형 종합점수는 아래 6개 축을 반영' → '확장형은 기본 4개 축에 추가로 아래 2개를 반영한다'

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-07] 선수 상세 docx 7차 정밀 재검토 — 영역 명칭 정확 일치 + 페이지 타이틀

### 변경 사항 (docx 정합 — 영역 명칭 단어 단위 일치)
1. **D 영역명 '구성' 단어 추가** (docx §6 D 정확 영역명)
   - '확장형 대시보드 추가 카드' → '확장형 대시보드 추가 카드 구성'
2. **E 영역명 'E. 운영 현황 카드 영역' 정확** (docx §8 정확)
   - '운영 현황' → 'E. 운영 현황 카드 영역'
3. **F 영역명 'F.' 영역 번호 추가** (docx §9)
   - '경기결과 / 분석' → 'F. 경기결과 / 분석'
4. **G 영역명 'G.' 영역 번호 추가** (docx §10)
   - '점수 산정 기준 안내 / 데이터 출처' → 'G. 점수 산정 기준 안내 / 데이터 출처'
5. **G-3 카드명 '카드' 단어 추가** (docx §10 G-3 정확 카드명)
   - '데이터 출처' → '데이터 출처 카드'
6. **A 영역 헤더 추가 - 일관성** (docx §3 #1, §4 A)
   - 다른 영역(B/C/D/E/F/G)과 동일하게 hero 상단에 'A. 선수 기본 정보 영역' 노출
7. **document.title 설정** (docx §13 화면명)
   - '{선수명} - 선수 상세 > ROI 대시보드 | SPONPIK'
   - 브라우저 탭 타이틀이 docx §13 명시 화면명과 일치

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-07] 선수 상세 docx 6차 정밀 재검토 — C-1 데이터 없을 때 정확 라벨

### 변경 사항 (docx §6 C-1 - 카드별 데이터 없을 때 상태 문구 정확 일치)
1. **C-1 미디어노출지수 카드 emptyLabel='데이터 수집 전'** (docx §6 C-1)
   - docx §6 C-1: "데이터 없을 때 / 값은 - / 상태 문구: 데이터 수집 전"
   - 이전: 모든 카드 일관 '수집 준비 중' 표시 (docx §11 매핑)
   - 변경: C-1만 docx §6 명시 'emptyLabel=데이터 수집 전' 적용
   - 다른 카드: docx §11 '수집 준비 중' fallback 유지
2. **RoiCard 컴포넌트에 emptyLabel prop 추가**
   - 카드별 docx 명시 데이터 없을 때 라벨을 개별 적용 가능

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

### 6차 재검토 결론
docx의 모든 명시 항목 (영역 헤더, 카드 목적, 표시 항목, 보조 문구, 데이터 상태,
점수 매핑 룰 등)이 frontend UI에 1:1 매핑되어 노출됨. 이번 라운드는 docx §6 C-1
의 매우 미세한 라벨 차이 ('데이터 수집 전' vs '수집 준비 중')만 검출되었으며,
6차에 걸친 누적 약 50개 항목의 정합성 작업이 완료되었습니다.

---

## [2026-05-07] 선수 상세 docx 5차 정밀 재검토 — 영역 헤더 + 기준 라벨 + 총 100점

### 변경 사항 (docx 정합 — §3/§4/§7/§10)
1. **B-1 메인 카드 '기본형 기준'/'확장형 기준' 헤더 배지 추가** (docx §4 B-1)
   - 카드 제목 옆에 명시적 기준 배지 표시 (이전: viewMode 토글로만 전달)
2. **산정 기준 '총 100점' 명시** (docx §7-1 / §7-2)
   - "📐 산정 기준 (총 100점)" 형식으로 명시
3. **G 영역명 '점수 산정 기준 안내' 정확 일치** (docx §10 G)
   - '점수 산정 기준 / 데이터 출처' → '점수 산정 기준 안내 / 데이터 출처'
4. **§3 화면 전체 구조 6개 영역 헤더 명확화** (docx §3, §4 B, §6 C, §6 D)
   - 'B. 종합 광고효과 요약 영역' 헤더 추가
   - 'C. 핵심 성과 카드 영역 (기본형 4종)' 헤더 추가
   - 'D. 확장형 대시보드 추가 카드' 헤더 추가 (확장형 모드)

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-07] 선수 상세 docx 4차 정밀 재검토 — 카드별 목적 + A 그룹 라벨 + 영역 의도

### 변경 사항 (docx 정합 — 영역/카드별 '목적' 설명문 추가)
1. **C-1~C-4 + D-1, D-2 카드별 '목적' 설명문 추가** (docx §6 매우 중요 누락)
   - RoiCard 컴포넌트에 `purpose` prop 추가
   - 카드 헤더 옆 ? 호버 툴팁 + 본문에 📌 목적 설명문 노출
   - 6개 카드 docx §6 명시 목적 텍스트 그대로 노출
2. **F 영역 '목적' 설명문 추가** (docx §9)
   - '선수의 최근 경기 흐름과 공식 성과를 연도별로 확인할 수 있게 구성'
3. **G 영역 의도 설명문 추가** (docx §10)
   - '브랜드가 점수를 신뢰하려면 무엇으로 계산된 점수인지를 알아야 합니다'
4. **B-2 1)~4) 번호 매기기** (docx §4 B-2)
   - AuxStat 에 `num` prop 추가
   - 1) 데이터 수집률 / 2) 신뢰도 / 3) 최근 업데이트 / 4) 최근 성과
5. **A '활동 상태:' 그룹 라벨** (docx §4 A)
6. **A '최근 참가 대회 요약:' 라벨 정확 일치** (docx §4 A)
7. **A '현재 열려 있는 슬롯 수:' 라벨 정확 일치** (docx §4 A)
8. **A '소속 배지:' 그룹 라벨** (docx §4 A)
9. **A '기본 프로필 요약:' 그룹 라벨** (docx §4 A)

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-07] 선수 상세 docx 3차 정밀 재검토 — 보조 안내문 + 매핑 룰 + 카드명

### 변경 사항 (docx 정합 — 보조 안내 / 매핑 룰 명시)
1. **B-1 종합 점수 라벨** (docx §4 B-1 '종합 점수: 00 / 100' 형식)
   - 점수 위에 "종합 점수" 라벨 명시
2. **B-1 등급 가능 옵션 안내** (docx §4 B-1 '등급: A / B / C / D / E')
   - 등급 아래 'A · B · C · D · E' 가능 옵션 노출
3. **B-1 산정 기준 안내문 추가** (docx §4 B-1 '기본형/확장형 종합점수는 아래 N개 축만 반영')
   - 가중치 라인 위에 docx 정확 안내 문구 추가
4. **B-1 두 번째 보조 문구 동시 노출** (docx §4 B-1 보조 문구 예시)
   - '기본 스폰서십 광고효과 종합지수' + '미디어·콘텐츠·팬덤·선수성과 기준 산정' 모두 표시
5. **B-2 카드명 헤더 추가** (docx §4 B-2 'B-2. 보조 정보 카드')
   - "📋 보조 정보 카드" 헤더 명시
6. **B-2 데이터 수집률·신뢰도 부연 설명** (docx §4 B-2 1)
   - AuxStat 에 hint 옵션 (title + 8px 보조 텍스트)
7. **F EventResultsByYear '분석 코멘트' 명시 라벨** (docx §9 F)
   - summary 앞에 '분석 코멘트' 배지 명시
8. **RoiCard '수집 준비 중' docx 정확 일치** (docx §11)
   - '데이터 수집 준비 중' → '수집 준비 중'
9. **E 운영 현황 카드 영역 그룹 헤더** (docx §8 E)
   - '운영 현황 — 슬롯 현황 / 최근 대회 / 예정 대회' 그룹 헤더 추가
10. **점수 상태값 매핑 룰 사용자 노출** (docx §11)
    - B-1 상태 배지 호버 툴팁 + G 섹션 매핑 룰 안내 카드
    - 사용자가 '왜 이 등급/상태인지' 즉시 이해 (docx 의도 '점수 신뢰도' 강화)

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-07] 선수 상세 docx 2차 정밀 재검토 — C/D/F 라벨 한 글자 일치 + A 8요소 분리

### 변경 사항 (docx 2026-05-04 정합 — 라벨 글자 단위)
1. **C-1 라벨 정확화** (docx §6 C-1)
   - '패치/로고 노출 추정' → '패치/로고 노출 추정 횟수'
   - '기사/외부 언급' → '기사/외부 언급 수'
   - '하이라이트 노출' → '하이라이트 노출 수'
2. **C-3 라벨 정확화** (docx §6 C-3)
   - '팬 댓글/멘션' → '팬 댓글/멘션 수'
   - '응원/이벤트' → '응원/참여 이벤트 수'
3. **C-4 라벨 정확화** (docx §6 C-4)
   - '최근 3개 평균' → '최근 3개 대회 평균 순위'
   - '최근 대회' → '최근 대회명'
   - '다음 참가 예정' → '다음 참가 예정 대회'
4. **D-1 라벨 정확화** (docx §6 D-1)
   - '신규 방문자' → '신규 방문자 수'
5. **A 기본 프로필 요약 순서** (docx §4 A)
   - '키 / 지역 / 프로 입회연도' → '키 / 프로 입회연도 / 지역' (docx 명시 순서)
6. **F 추가 권장 항목 라벨** (docx §9)
   - '최근 3개 평균' → '최근 3개 대회 평균순위'
   - '시즌 누적 평균' → '시즌 누적 성적'
7. **A 8개 구성 요소 분리 노출** (docx §4 A)
   - 활동 상태 배지: 활동중/슬롯 오픈/경매 진행중 3개로 한정
   - 최근 참가 대회 요약: 별도 라인으로 분리
   - 현재 열려 있는 슬롯 수: 별도 라인으로 분리 (N개 명시)
8. **A 우측 버튼 '경매 참여하기' 항상 노출** (docx §4 A)
   - LIVE 경매 없을 때도 버튼 노출 (disabled 상태 + 안내 툴팁)

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`

### 검증
- frontend `npx tsc --noEmit`: 0 errors
- 모든 변경 frontend repo 커밋 + push 완료

---

## [2026-05-06] 선수 상세 ROI 대시보드 docx 무한 재검토 9개 누락 보강

### 변경 사항 (docx "SPONPIK 선수 상세 페이지 수정개발_20260504" 정합)
1. **B-2 보조 정보 카드 예시 형식 정확화** (docx §4 B-2)
   - "최근 업데이트": 'YYYY.MM.DD HH:MM' 형식 (예: 2026.05.03 14:20)
   - "최근 성과": '대회명 / 순위' 형식 (예: 2026 WGTOUR 1차 / 2위)
2. **F. 경기결과 투어명 표시** (docx §9 F)
   - EventResultsByYear 에 투어명(KLPGA/WGTOUR) 배지 추가
   - r.tour 우선 → athlete.tour fallback
3. **AthleteEventResult.tour 컬럼 추가** (마이그레이션 20260506)
4. **G. ScoringAndDataSources viewMode 동기화**
   - 하드코딩 "BASIC" 제거 → PublicAthleteDetail 의 roiViewMode state 끌어올림
   - RoiDashboard 토글 ↔ G 가중치 표 즉시 동기화 (controlled mode)
5. **데이터 출처 6종 docx 정확 명칭** (docx §10 G-3)
   - 'SPONPIK 내부 슬롯' → 'SPONPIK 내부 슬롯 데이터'
   - '브랜드 트래킹' → '브랜드 전용 트래킹 데이터'
   - '관리자 수기 입력' → '관리자 수기 입력 데이터'
6. **ROI 대시보드 화면명 breadcrumb** (docx §13)
   - 섹션 상단에 "선수 상세 > ROI 대시보드" 노출
7. **A 기본 프로필 '프로 입회연도' 정확 표기** (docx §4 A)
   - "{year}년 데뷔" → "프로 입회 {year}년"
8. **산정중 보수적 등급 처리** (docx §11)
   - backend summary 응답에 basicGrade/extendedGrade 분리 노출
   - frontend 자체 score→grade 매핑 → backend grade 우선 사용
   - "산정중 → 보수적 처리(-15)" 규칙이 viewMode 토글 시에도 적용
9. **B-1 산정 기준 풀네임 + 헤더** (docx §4 B-1)
   - '미디어' → '미디어노출지수', '콘텐츠' → '콘텐츠 반응' 등
   - "📐 산정 기준" 헤더 추가

### 영향 파일
- `src/frontend/src/pages/PublicAthleteDetail.tsx`
- `src/backend/src/routes/athlete.routes.ts`
- `src/backend/prisma/schema.prisma`
- `src/backend/prisma/migrations/20260506_add_event_result_tour/migration.sql`

### 검증
- frontend `npx tsc --noEmit` 0 errors
- backend `npm run build` 성공
- frontend `npm run build` 성공

---

## [2026-04-24] Full Funnel: api_spec 형식 마지막 정합성 2개

### 변경
1. **purchase_event_id evt_ prefix** (api_spec TABLE 36):
   - 명세 예시: `"purchase_event_id": "evt_9801"`
   - 변경: UUID 첫 12자 + evt_ prefix → `evt_a71db97366ef`
   - internal_order_id 함께 노출 (디버깅·환불 호출용)
   - funnel.routes purchase + external.routes postback 모두 적용

2. **Admin 자산 조회 snake_case 변환** (api_spec TABLE 13):
   - 명세는 root level까지 snake_case
   - 추가: `?format=snake` 또는 `X-Response-Format: snake` 헤더로 변환
   - 기본은 camelCase (프론트 일관성)

### 결론
이번 라운드는 진짜 마이크로 디테일 (형식 차이만). 95+ 항목 누적 후 사실상 docx 모든 명시 항목 100% 반영.

### 검증
- TypeScript 빌드 0 에러

---

## [2026-04-24] Full Funnel: BRD-01 자동 해석 + BRD-03 선수/코드 필터

### BRD-01 (handoff 5조: 요약 코멘트 영역)
- 자동 해석 코멘트 영역 추가 (slate-900 다크 카드)
- 룰 기반 메시지 자동 생성:
  - 매출 전일 대비 ↑↓5% 이상 (positive/negative)
  - CVR 우수(≥3%) / 부족(<1%)
  - ROAS 우수(≥3x) / 손실(<1x)
  - TOP 선수 매출 기여 + TOP 코드 사용 횟수
- 최대 4개 메시지 표시

### BRD-03 (wireframe TABLE 24)
- 선수 드롭다운 필터 (orders에서 distinct athlete 옵션 자동)
- 코드 드롭다운 필터 (promoCode distinct)
- 필터 초기화 버튼

### 검증
- TypeScript 빌드 0 에러

---

## [2026-04-24] Full Funnel: 와이어프레임 ASCII 7개 보완

### Prisma
- StoreProduct.images Json (다중 이미지/썸네일 - wireframe TABLE 35)
- TrackingLink.contentType (INSTAGRAM/YOUTUBE/BLOG/TIKTOK/OTHER - wireframe TABLE 11)

### 백엔드
- promoCodeService.listByCampaign: 코드별 주문수+매출+적용률 자동 집계 (wireframe TABLE 11)

### 프론트
1. **STO-02 상품 썸네일 갤러리** (TABLE 35): 다중 이미지 가로 스크롤 + 활성 이미지 전환
2. **STO-02 장바구니 Drawer 할인 표시** (TABLE 35): 항목별 + 총 할인 라인
3. **ADM-02 할인정책 섹션** (TABLE 8 ASCII): 좌측 패널에 코드/타입/값/사용횟수
4. **ADM-03 좌측 선수 필터** (TABLE 11): 캠페인 매칭 선수 옵션 자동
5. **ADM-03 발급일 필터** (TABLE 11): 발급일 이후 date input
6. **ADM-03 코드 컬럼** (TABLE 11): 코드명/적용률/주문수/매출/할인/상태/발급일
7. **ADM-03 콘텐츠 유형 필터** (TABLE 11): Instagram/YouTube/TikTok/Blog/기타

### Cart 데이터 보강
- 상품 담기 시 originalPrice 함께 저장 → drawer 할인 계산

### 검증
- Prisma db push 성공
- TypeScript 빌드 0 에러

---

## [2026-04-24] Full Funnel: ASCII 컬럼 5개 누락 보완

### BRD-01 (TABLE 18: 기본 30일)
- 디폴트 필터를 30일 기간으로 자동 적용 (defaultThirtyDays 헬퍼)

### BRD-02 (TABLE 20: 비교 차트 6지표 + 테이블 9컬럼)
- 비교 차트: 클릭/유입/주문/매출/CVR/CAC 6개 지표 막대 추가 (이전: 주문/매출만)
- 상세 테이블: **노출/클릭/유입** 3개 컬럼 추가 (총 9컬럼: 이름/노출/클릭/유입/주문/순매출/CVR/CAC/ROAS)
- 추정값: 노출(클릭/0.02) → 클릭(유입/0.7) → 유입(주문×50)

### BRD-03 (TABLE 23: 주문 테이블 9컬럼)
- **결제금액(grossAmount)**, **할인(discountAmount)** 컬럼 추가
- 컬럼: 일시 | 주문번호 | 상품 | 선수 | 코드 | 결제금액 | 할인 | 순매출 | 귀속 | 상태

### ATH-01 (TABLE 26: 5개 KPI)
- 5번째 KPI: CTR → **"내 코드 사용 수"** (assets.codes usageCount 합산)
- hint: 발급된 코드 개수

### 검증
- TypeScript 빌드 0 에러

---

## [2026-04-24] Full Funnel: URL 일관성 + CTR 계산식 + 차트 보완 4개

### CRITICAL: CTR 계산식 명세 위반 수정 ⚠️
- 명세 (handoff TABLE 8): **CTR = 링크 클릭 수 ÷ 콘텐츠 노출 수**
- 이전: `landingViews / linkClicks` (분자/분모 모두 잘못)
- 수정: IMPRESSION_LOGGED 이벤트 payload.impressions 합산 → `linkClicks / impressions`
- FunnelSummary 인터페이스에 `impressions` 필드 추가

### URL 일관성 (api_spec TABLE 13)
- 명세: `mini_store.url = "https://sponpik.com/store/brand/orex"`
- 백엔드 trackingLink longUrl: `/store/${slug}` → `/store/brand/${slug}`
- 백엔드 campaignAssets brandMiniStoreUrl: 동일
- 프론트 라우트: `/store/brand/:slug` 신규 + `/store/:slug` legacy redirect
- 미니스토어 내 모든 Link/navigate 일괄 변경
- ADM-04 미리보기 새 탭 링크도

### 화면 보강
- **BRD-01 선수별 TOP**: 카드 + 막대차트 (gradient bar with width %) — wireframe TABLE 18 "카드+막대차트"
- **BRD-02 비교 차트**: 매출순/주문순/CVR순 정렬 토글 — wireframe TABLE 21 "정렬 기준 변경 가능"

### 검증
- TypeScript 빌드 0 에러 (backend + frontend)

---

## [2026-04-24] Full Funnel: 와이어프레임 "주요 상태" enum + 상태 배너 5개

### Prisma enum 보강
1. **CampaignStatus + EXPIRED, GENERATION_FAILED** (wireframe TABLE 4)
2. **FunnelOrderStatus + PENDING** (wireframe TABLE 22)

### 백엔드
- campaign.service.activate(): 자산 자동 생성 실패 시 GENERATION_FAILED 상태로 자동 마킹
- admin.funnel.routes status validation에 EXPIRED, GENERATION_FAILED 추가
- miniStore.getPublicBySlug: promoExpired, hasSoldOut, activePromoCode 응답 평탄화

### 프론트
3. **STO-01 Promo Expired 배너** (wireframe TABLE 31): 활성 코드 0개 시 amber 배너
4. **STO-01 Sold Out Mixed 배너**: 일부 품절 시 rose 배너
5. **STO-02 재고 상태 칩** (wireframe TABLE 34): In Stock(emerald) / Low Stock 5↓(amber) / Sold Out(rose)
6. **BRD-01 No Data 안내 배너** (wireframe TABLE 16): 클릭+구매가 모두 0일 때 sky 배너

### 검증
- Prisma db push 성공
- TypeScript 빌드 0 에러 (backend + frontend)

---

## [2026-04-24] Full Funnel: 테마 컬러 + 선수 추천 문구 (마지막 ASCII 디테일)

### Prisma
- MiniStore.themeColor (hex) 필드 추가 (wireframe TABLE 14)

### 백엔드
- miniStore.service: themeColor params + update 처리
- getPublicBySlug: campaign.contracts → athlete 정보 평탄화 반환

### 프론트
1. **ADM-04 컬러 선택 UI**: 6개 프리셋 색상 칩 + 커스텀 컬러 피커, hex 표시
2. **ADM-04 미리보기**: Hero 그라데이션 + CTA 버튼이 themeColor 반영
3. **STO-01 Hero**: themeColor 기반 동적 그라데이션 + Sticky CTA 컬러 적용
4. **STO-03 주문완료 선수 추천 문구** (wireframe TABLE 38):
   - 선수 프로필 이미지 + 투어 + 이름
   - "OO 선수가 추천한 상품을 구매해주셔서 감사해요" 문구

### 검증
- TypeScript 빌드 0 에러 (backend + frontend)
- Prisma db push 성공

---

## [2026-04-24] Full Funnel: BRD-01 퍼널 차트 + brandLogoUrl 전 영역 연결

### 추가
1. **BRD-01 매출 증명 퍼널 차트** (handoff 7조 본문):
   - 클릭→유입→상품조회→장바구니→결제시작→구매완료 6단계 FunnelChart
   - 개요 탭 추이 차트 위 배치
2. **ADM-04 brandLogoUrl 입력 필드**: 설정 폼에 추가 (wireframe TABLE 15)
3. **ADM-04 미리보기**: Hero 좌상단에 brandLogo 이미지 (반투명 흰 배경)
4. **STO-01 Hero brandLogo**: 좌상단 absolute positioning, 반응형 크기, shadow

→ brandLogoUrl이 모델만 있고 사용 안 되던 문제 해결

### 검증
- TypeScript 빌드 0 에러

---

## [2026-04-24] Full Funnel: 8개 핵심 누락 항목 보완

### Prisma 스키마
- `MiniStore.brandLogoUrl` 추가 (wireframe TABLE 14, 33)
- `StoreProduct.options` (Json) 추가 (wireframe TABLE 36 - 색상/사이즈 등)

### 백엔드 자동화
- **캠페인 ACTIVE 자동 자산 생성** (handoff 3-1):
  - `campaign.service.activate()`에서 status='ACTIVE' 변경 시 `campaignAssetsService.generate()` 자동 호출
  - admin/funnel/campaigns/:id/status PATCH도 동일 로직 (ACTIVE 전환 시만)
  - 매칭 선수 없으면 skip + warn 로그
- `campaignAssets.list()` 응답에 `long_url` 추가 (wireframe TABLE 9 "장/단축 링크")
- `GET /api/reports/brand/:id/orders/:orderId/events` (BRD-03 이벤트 로그)

### 프론트엔드
- **ADM-01 카드 재구성** (wireframe TABLE 6):
  - 전체/활성/만료 예정(7일↓)/발급 실패/이번 주 신규
- **ADM-02 장(long) URL 표시**: 단축 + UTM 포함 long URL 분리, 각각 복사 버튼
- **BRD-03 주문 테이블 "상품" 컬럼 추가**: items[0].product_id + 외 N건
- **BRD-03 상세 패널 이벤트 로그 타임라인**: 같은 세션의 LANDING_VIEW~PURCHASE 시간순
- **STO-02 상품 옵션 선택 UI**: 색상/사이즈 등 토글 버튼 → cart에 함께 저장
- **STO-03 재구매 유도 CTA** (wireframe TABLE 39):
  - 주문완료 화면에 "함께 보면 좋은 상품" 3개 그리드 + "전체 상품 보러가기" 링크

### 검증
- Prisma db push 성공
- TypeScript 빌드 0 에러 (backend + frontend)

---

## [2026-04-24] Full Funnel: API 호환성 + KPI delta + 필터 + 비활성화 4개 보완

### 백엔드
1. **snake_case 변환 유틸** (`utils/caseConvert.ts`):
   - 리포트 응답에 `?format=snake` 또는 `X-Response-Format: snake` 헤더 시 자동 변환
   - 기본은 camelCase (프론트 일관성), 외부 호출자만 snake_case (api_spec TABLE 45 호환)
2. **PATCH /api/admin/funnel/campaigns/:id/status**: 캠페인 활성화/일시중지 (ADM-01 액션)

### 프론트
3. **BRD-01 전일 대비 증감 KPI** (wireframe TABLE 18):
   - 어제~오늘 vs 그 이전 기간 자동 비교 (period-compare 활용)
   - SummaryCard에 ↑↓% 표시 (유입/주문/순매출/CVR)
4. **BRD-01 선수/채널/코드 필터** (wireframe TABLE 18):
   - 선수: report.breakdown.athletes 옵션 자동 채움
   - 채널: instagram/youtube/naver/kakao/direct 칩 토글
   - 코드: report.breakdown.codes 드롭다운
5. **ADM-01 캠페인 액션** (wireframe TABLE 6):
   - 자산 재발급 ✅ (기존)
   - 일시중지/재개 (Pause/Play 아이콘)
   - 정보 복사 (Copy 아이콘)

### 검증
- TypeScript 빌드 0 에러 (backend + frontend)

---

## [2026-04-23] Full Funnel: 최종 6개 마이크로 디테일 보완

### 프론트
1. **Cart attribution snapshot**: 상품 담기 시 cart에 `attribution: {campaignId, brandId, athleteId, addedAt}` 저장 → 결제 실패 재시도 시에도 동일 귀속 보장
2. **BRD-03 환불 사유**: 주문 상세 우측 패널에 `refundedAt` + `refundReason` 표시 (rose 뱃지)
3. **REP-01 인쇄 CSS**: `@media print` 규칙 추가 (사이드바/헤더/알림/버튼 숨김, 풀 너비, 차트 SVG 크기 보정)
4. **REP-01 기간 비교 선택 옵션**: 직전 동일 기간 / 전년 동기 / 비교 안 함 3-way 토글
5. **ADM-04 품절 배지**: 이미지 오버레이 + 우측 "품절" rose 배지, 저재고(5개↓)는 amber 배지

### 백엔드
6. **FunnelOrder.refundReason 필드**: Prisma 모델 + funnelOrder.service refundOrder()에 reason 저장
7. **campaignAssets status lowercase** (api_spec TABLE 13 호환): ACTIVE → active, PUBLISHED → published
8. **period-compare prev_from/prev_to 지원**: 사용자 지정 비교 기간 전달 시 우선 사용 (전년 동기 등)

### 검증
- TypeScript 빌드 0 에러 (backend + frontend)
- Prisma db push 성공 + client 재생성

---

## [2026-04-23] Full Funnel: API spec/handoff 마지막 11개 누락 항목 완전 보완

### Prisma 스키마
- `FunnelEventType`에 `IMPRESSION_LOGGED` enum 추가 (handoff TABLE 5)
- `FunnelEvent`에 UTM 필드 5개 추가: utm_source/medium/campaign/content/term + 인덱스 (handoff TABLE 6)
- `FunnelOrderAuditLog` 모델 신규 (orderId, adminUserId, action, before/after JSON, reason)

### 백엔드
- **UTM 자동 파싱**: funnel.routes에서 body/referer URL의 utm_* 자동 추출 → FunnelEvent 저장
- **운영자 주문 보정**: PATCH /api/admin/funnel/orders/:id (gross/discount/net/status 수정 + audit log)
- **운영자 귀속 수정**: POST /api/admin/funnel/orders/:id/reattribute (수동 attribution 변경 + audit log)
- **감사 로그 조회**: GET /api/admin/funnel/orders/:id/audit-logs
- **IMPRESSION_LOGGED**: POST /api/admin/funnel/impressions (ROI 시스템 연동용)
- **rankings 필드**: getBrandReport 응답에 `rankings.athletes/codes` 추가 (TOP 10 + rank)
- **응답 표준 보강**: 모든 정상/에러 응답에 `request_id` 포함 (api_spec TABLE 3)
- **409 CONFLICT**: P2002 → 409 + DUPLICATE_ENTRY 코드 (이미 처리됨, 검증 완료)
- **라우트 마운트 순서 수정**: alias 라우트가 다른 공개 라우트를 가로채던 버그 수정

### 프론트엔드
- ADM-01: 브랜드/선수 드롭다운 필터 추가 (검색창과 별도)
- ADM-03: 우측 패널에 일자별 클릭/유입 추이 LineChart (최근 14일)
- BRD-01: 체크아웃 완료율 KPI 카드 추가 (총 7개로 확장)

### 검증
- `curl /api/store/brand/9c5ua8` → 정상 200 + 표준 응답
- 에러 응답: `{"success":false,"data":null,"error":{...},"request_id":"..."}` 확인
- TypeScript 빌드 0 에러 (백엔드 + 프론트)

---

## [2026-04-23] Full Funnel: 마지막 11개 디테일 완전 보완

### 백엔드
- API spec 준수: `/api/campaigns/:id/tracking-assets/*` alias 추가 (기존 /admin/ 경로와 병존)
- **단축링크 302 + Set-Cookie**: spk_session_id (24h), spk_anonymous_id (1y), spk_click_id (1h) → 외부 도메인 → 미니스토어 이동 시 세션 유지
- 쿠키에서 기존 sessionId/anonymousId 읽어 재사용 (reattribution 안전)

### 프론트엔드
- **ADM-01**: 검색창(캠페인명/브랜드/선수) + 상태 칩(5) + 신규 캠페인 버튼
- **ADM-02**: 테스트 발급 로그 패널 + 자산 이력 + 관리자 메모 영역
- **ADM-03**: 좌측 필터 패널(상태/콘텐츠) + 우측 빠른 분석 패널(전체/TOP)
- **BRD-01**: hideCampaign/hideAthlete 제거, 콘텐츠/유입 채널별 성과 위젯 추가
- **BRD-02**: 비교 테이블에 CVR/CAC/ROAS 컬럼 (추정값, 실측 주문 기반)
- **BRD-03**: 주문 상태 칩(5) + 신규/재구매 필터 + XLSX 다운로드 추가
- **REP-01**: 범례 박스 + 퍼널 차트 측 실측 배지
- **STO-02**: FAQ 섹션 추가 (배송/교환/코드)
- **사이드바 grouping**: 기본 메뉴 vs "🔥 풀 퍼널" 섹션 분리 + 토글 (현재 경로가 funnel이면 자동 열림)

### 검증
- `curl -I /s/Q8fVzE` → 302 Found + Set-Cookie 3개 확인
- TypeScript 빌드 0 에러 (backend + frontend)

---

## [2026-04-23] Full Funnel: 와이어프레임 디테일 + TossPayments + E2E 검증

### 추가
- **백엔드 (8 신규 엔드포인트)**:
  - `/api/admin/promo-codes.csv`, `/api/admin/tracking-links.csv`
  - `/api/reports/brand/:id/compare.csv`
  - `/api/reports/athlete/:id/campaigns` (본인 참여 캠페인)
  - `/api/reports/brand/:id/period-compare` (이번 vs 지난 기간)
  - `/api/reports/share-link` (영업용 7일 토큰)
  - `/api/admin/funnel/settlements`, `/settlements/run` (Phase 3)
  - **GET /s/:shortCode**: Express 최상위에 302 redirect (SPA가 아닌 서버 redirect → SNS OG 크롤러 정상 처리)

- **프론트엔드 (전체 화면 디테일)**:
  - ADM-02: 재발급 옵션 폼 (기존 링크 유지 토글, 할인 정책 인라인 편집)
  - ADM-03: 코드/링크 CSV 다운로드 + 콘텐츠별 추가 링크 인라인 발급
  - ADM-04: 상품 순서 ↑↓ 버튼 + 모바일/PC 미리보기 토글
  - BRD-01: 최근 주문 테이블 (하단), 예측/세그먼트 탭
  - BRD-02: 비교 결과 CSV 다운로드
  - BRD-03: 선수명/코드/주문번호 검색창
  - ATH-01: 본인 캠페인 선택 + 브랜드 설득용 자동 요약 (복사 가능)
  - REP-01: 기간 비교 (4 KPI ↑↓), 영업용 공유 링크 발급
  - STO-01: FAQ 섹션 (4 Q&A details/summary)
  - STO-02: 고객 리뷰(mock) + 관련 상품 그리드
  - STO-03: **TossPayments SDK 연동 + 시뮬레이션 토글 + 결제 실패 화면 (세션 유지)**

### 검증
- 16개 화면 E2E 스크린샷 확인 완료 (puppeteer):
  - ADM-01~04, REP-01, ADM-Settlement (Admin)
  - BRD-01~03, BRD-Pixel, BRD-Attribution (Brand)
  - ATH-01 (Athlete)
  - STO-01~03 (Public Store)
- 단축링크 3xx redirect 동작 확인 (`curl -I /s/Q8fVzE` → 302)

### 영향 받는 파일
- `src/backend/src/index.ts` (302 redirect)
- `src/backend/src/routes/admin.funnel.routes.ts` (CSV)
- `src/backend/src/routes/funnelReport.routes.ts` (compare/share/period-compare/orders)
- `src/frontend/src/pages/{admin,brand,athlete,store}/*` (디테일 보강)
- `src/frontend/package.json` (+@tosspayments/payment-sdk)

---

## [2026-04-23] Full Funnel Data Reporting 전체 구축 (Phase 1+2+3)

### 변경 사항
- **Prisma 스키마 +8 모델 / +6 enum**: PromoCode, TrackingLink, MiniStore, StoreProduct, FunnelEvent, FunnelOrder, SessionRollup, PixelInstall, AttributionTouch, PerformanceSettlement
- **백엔드 서비스 9개**: promoCode, trackingLink, miniStore, funnelEvent, funnelOrder, funnelReport, qrCode, campaignAssets, funnelAttribution + Predict + Segment
- **백엔드 라우트 5개**: funnel(공개), funnelReport, admin.funnel, store, external(Pixel/Postback)
- **프론트 공통 컴포넌트 7개**: GlobalFilter, SummaryCard, FunnelChart, TimeSeriesChart, StatusBadge, DataSourceBadge, ActionBar, DetailTable
- **프론트 화면 12+**: ADM-01~04, BRD-01~03, BrandPixelInstall, BrandAttribution, ATH-01, REP-01, STO-01~03 (미니스토어), ShortLinkRedirect
- **Pixel JS** (`public/pixel/sponpik-pixel.js`): vanilla, sendBeacon 우선
- **Cron** (Phase 3): 매일 새벽 1시 CPA/CPS 캠페인 자동 정산
- **CLAUDE.md 불변식 준수**: 구매 트랜잭션 (orders + funnel_events 원자적 처리), 멱등성 (brandId+externalOrderId unique + P2002 graceful)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` (+250줄)
- `src/backend/src/services/{promoCode,trackingLink,miniStore,funnelEvent,funnelOrder,funnelReport,qrCode,campaignAssets,funnelAttribution,funnelPredict,funnelSegment}.service.ts`
- `src/backend/src/routes/{funnel,funnelReport,admin.funnel,store,external}.routes.ts`
- `src/backend/src/cron/funnelSettlement.cron.ts`
- `src/backend/src/index.ts` (라우트 + cron 등록)
- `src/frontend/src/components/funnel/*` (7개 컴포넌트)
- `src/frontend/src/hooks/useFunnelTracking.ts`
- `src/frontend/src/pages/{admin,brand,athlete,store}/*` (15개 화면)
- `src/frontend/src/App.tsx` (15+ 신규 라우트)
- `src/frontend/src/services/api.ts` (+30개 메서드)
- `src/frontend/public/pixel/sponpik-pixel.js`

### 참고
- 문서: `sponpik_full_funnel_{api_spec, handoff, wireframe_spec}.docx`
- 어트리뷰션 우선순위: promo_code → recent link click → recent session
- RBAC: BRAND 자사 데이터만, ATHLETE 본인만, ADMIN 전체

---

## 엔트리 템플릿

```markdown
## [YYYY-MM-DD] 작업 제목

### 변경 사항
- 항목 1
- 항목 2

### 영향받는 파일
- `path/to/file.ts`

### 참고
- 관련 링크
```

---

# 개발 기록

---

## [2026-01-20] 네비게이션 메뉴 누락 항목 추가

### 변경 사항
- Layout.tsx에 라우트는 존재하지만 네비게이션에 없던 메뉴 항목들 추가
- **ADMIN**: 재무콘솔, FAQ관리, 페널티, 분쟁관리, 시즌관리, 노출관리, 운영도구 (7개)
- **BRAND**: 후원투표, ROI리포트 (2개)
- **ATHLETE**: 서명대기, 출금관리 (2개)
- **FAN**: 내투표, 내뱃지 (2개)
- Home.tsx 푸터에 FAQ 링크 연결 (`/faq`)

### 영향받는 파일
- `src/frontend/src/components/Layout.tsx` - 10개 아이콘 import + 13개 nav 항목 추가
- `src/frontend/src/pages/Home.tsx` - FAQ 링크 `<a href="#">` → `<Link to="/faq">`

### 참고
- 상세 페이지 (`:id` 라우트)는 리스트에서 접근하므로 네비게이션에서 제외
- 기존 라우트와 페이지는 모두 구현되어 있었음 (메뉴 연결만 누락)

---

## [2026-01-20] Phase E-F Frontend - 캠페인 상세 & 노출/ROI 대시보드

### 변경 사항
- **Phase E-FE**: 캠페인 상세 페이지 (KPI 진행률, 연결된 계약, 추천 선수)
- **Phase F-FE**: AdminExposure (노출 기록 관리, 미디어밸류 요율, 리포트)
- **Phase F-FE**: BrandROIDashboard (브랜드 ROI 대시보드)
- **api.ts 확장**: getCampaignPerformance, getRecommendedAthletes, getBrandExposureReport 등

### Frontend 파일
- `src/frontend/src/services/api.ts` - Phase E, F API 메서드 추가
- `src/frontend/src/pages/brand/CampaignDetail.tsx` (신규) - 캠페인 상세
- `src/frontend/src/pages/admin/AdminExposure.tsx` (신규) - 노출 관리
- `src/frontend/src/pages/brand/BrandROIDashboard.tsx` (신규) - ROI 대시보드
- `src/frontend/src/App.tsx` - 라우트 등록

### 라우트 추가
- `/brand/campaigns/:id` → CampaignDetail
- `/admin/exposure` → AdminExposure
- `/brand/reports/roi` → BrandROIDashboard

### 참고
- Backend는 이미 구현됨 (Phase E, F 완료)
- DOCX 검증 후 누락된 Frontend 구현

---

## [2026-01-20] Phase H - 시즌 리워드

### 변경 사항
- **스키마 추가**: Season, SeasonParticipant, SeasonBadge, SeasonBadgeAward 모델
- **enum 추가**: SeasonStatus, BadgeType
- **season.service.ts 신규**: 시즌 CRUD, 리더보드, 참여 기록, 뱃지, 보상 배포
- **season.routes.ts 신규**: Public/Authenticated/Admin 라우트 분리
- **프론트엔드**: SeasonLeaderboard.tsx, MyBadges.tsx, AdminSeasons.tsx

### Backend 파일
- `src/backend/prisma/schema.prisma` - Season 관련 모델 추가
- `src/backend/src/services/season.service.ts` (신규) - 시즌 비즈니스 로직
- `src/backend/src/routes/season.routes.ts` (신규) - 시즌 API 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록

### Frontend 파일
- `src/frontend/src/services/api.ts` - 시즌 API 메서드 추가
- `src/frontend/src/pages/fan/SeasonLeaderboard.tsx` (신규)
- `src/frontend/src/pages/fan/MyBadges.tsx` (신규)
- `src/frontend/src/pages/admin/AdminSeasons.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 주요 기능
- 시즌 생명주기: DRAFT → UPCOMING → ACTIVE → ENDED → REWARDS_DISTRIBUTED
- 리더보드: 참여횟수, 적중횟수, 총 포인트 기준 순위
- 뱃지 시스템: SEASON_GOLD/SILVER/BRONZE, TOP10, TOP100 등
- 보상 배포: rewardTiers 기준 포인트 지급 + 뱃지 수여

---

## [2026-01-20] Phase G - 투표 스폰서십

### 변경 사항
- **스키마 확장**: FanVoteEvent에 sponsor 필드 추가, SponsorEngagement 모델 추가
- **fanVote.service.ts 확장**: sponsorVote, getSponsoredVotes, trackEngagement, getSponsorEngagementStats
- **fanVote.controller.ts 확장**: 스폰서 관련 컨트롤러 메서드
- **fanVote.routes.ts 확장**: POST /:id/sponsor, POST /:id/track-engagement
- **brand.routes.ts 확장**: GET /me/sponsored-votes, GET /me/sponsor-stats
- **프론트엔드**: SponsorBanner.tsx 컴포넌트, BrandSponsoredVotes.tsx 페이지

### Backend 파일
- `src/backend/prisma/schema.prisma` - sponsor 필드, SponsorEngagement 모델
- `src/backend/src/services/fanVote.service.ts` - 스폰서 메서드 추가
- `src/backend/src/controllers/fanVote.controller.ts` - 스폰서 컨트롤러
- `src/backend/src/routes/fanVote.routes.ts` - 스폰서 라우트
- `src/backend/src/routes/brand.routes.ts` - 브랜드 스폰서 조회 API

### Frontend 파일
- `src/frontend/src/services/api.ts` - 스폰서 API 메서드
- `src/frontend/src/components/SponsorBanner.tsx` (신규) - 스폰서 배너 + 노출 추적
- `src/frontend/src/pages/brand/BrandSponsoredVotes.tsx` (신규) - 브랜드 후원 관리
- `src/frontend/src/App.tsx` - 라우트 등록

### 주요 기능
- 브랜드가 투표 후원 (contributionAmount, bannerUrl, logoUrl, message, linkUrl)
- 스폰서 배너 노출/클릭 추적 (impressions, bannerClicks, linkClicks)
- 브랜드 후원 통계 집계

---

## [2026-01-20] Phase 10-3 - Reconciliation/Data Integrity Checking (결제/환불 대사)

### 변경 사항
- **스키마 추가**: WebhookEventLog, ReconciliationRun, ReconciliationIssue 모델
- **enum 추가**: WebhookEventStatus, ReconciliationScope, ReconciliationRunStatus, ReconciliationIssueSeverity, ReconciliationIssueType, ReconciliationIssueStatus
- **WebhookEvent 확장**: eventId 필드 추가 (멱등성용)
- **Webhook 처리 개선**: WebhookEventLog upsert로 중복 Webhook 감지/무시
- **ReconciliationService 신규**: 정합성 검사 로직 (checkTopups, checkRefunds, checkWalletSanity)
- **ReconciliationController 신규**: Admin API 컨트롤러
- **Admin Reconciliation Routes**: 대사 관리 API 6개 추가
- **Cron Job**: 매일 09:20 KST Full Reconciliation + 관리자 알림

### Backend 파일
- `src/backend/prisma/schema.prisma` - WebhookEventLog, ReconciliationRun, ReconciliationIssue 추가
- `src/backend/src/payments/providers/types.ts` - WebhookEvent.eventId 추가
- `src/backend/src/payments/providers/stripe.ts` - parseWebhookEvent에 eventId 추가
- `src/backend/src/payments/providers/toss.ts` - parseWebhookEvent에 eventId 추가
- `src/backend/src/controllers/topup.controller.ts` - WebhookEventLog 통합
- `src/backend/src/services/reconciliation.service.ts` (신규) - 대사 비즈니스 로직
- `src/backend/src/controllers/reconciliation.controller.ts` (신규) - 대사 컨트롤러
- `src/backend/src/routes/admin.reconciliation.routes.ts` (신규) - Admin 대사 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/backend/src/index.ts` - Cron Job 추가 (09:20 KST)

### 대사 검사 규칙
| 규칙 | 심각도 | 설명 |
|------|--------|------|
| TOPUP_PAID_NO_LEDGER | CRITICAL | PAID인데 LedgerTx 없음 |
| LEDGER_TOPUP_NO_PAID | HIGH | LedgerTx 있는데 PAID 아님 |
| REFUND_REFUNDED_NO_LEDGER | CRITICAL | REFUNDED인데 LedgerTx 없음 |
| REFUNDED_AMOUNT_MISMATCH | MEDIUM | refundedAmount 불일치 |
| WALLET_NEGATIVE | CRITICAL | 잔액/동결 음수 |

### Admin API
- GET /api/admin/reconciliation/runs - 대사 실행 목록
- POST /api/admin/reconciliation/runs - 수동 대사 실행 (분당 5회 제한)
- GET /api/admin/reconciliation/issues - 이슈 목록
- GET /api/admin/reconciliation/issues/summary - 이슈 요약 통계
- PATCH /api/admin/reconciliation/issues/:id/status - 이슈 상태 변경
- GET /api/admin/reconciliation/issues.csv - CSV Export

### 참고
- WebhookEventLog `@@unique([provider, eventId])`로 중복 Webhook 방지
- 이슈 상태: OPEN → ACKED → RESOLVED/IGNORED
- HIGH+ 이슈 발견 시 notificationService.notifyAdminAlert() 호출

---

## [2026-01-20] Phase 10-2 - Refund/Chargeback (환불 및 차지백)

### 변경 사항
- **스키마 추가**: RefundRequest 모델, RefundStatus/RefundRequestStatus enum
- **TopupPayment 확장**: refundedAmount, refundStatus, lastRefundAt, chargebackAt 필드
- **Provider Adapter 확장**: RefundResult 인터페이스, refundPayment() 메서드 추가
- **RefundService 신규**: 환불 요청 CRUD, 상태 전이, PG 환불 호출, 차지백 처리
- **TopupService 확장**: processRefundWebhook(), CHARGEBACK 이벤트 처리
- **RefundController 신규**: Admin API 컨트롤러
- **Admin Finance Routes**: 환불 관리 API 7개 추가

### Backend 파일
- `src/backend/prisma/schema.prisma` - RefundRequest 모델, enum 추가, TopupPayment 확장
- `src/backend/src/payments/providers/types.ts` - RefundResult 인터페이스
- `src/backend/src/payments/providers/stripe.ts` - refundPayment() 구현
- `src/backend/src/payments/providers/toss.ts` - refundPayment() stub (추후 구현)
- `src/backend/src/services/refund.service.ts` (신규) - 환불 비즈니스 로직
- `src/backend/src/services/topup.service.ts` - Webhook 핸들러 확장
- `src/backend/src/controllers/refund.controller.ts` (신규) - 환불 컨트롤러
- `src/backend/src/routes/admin.finance.routes.ts` - 환불 API 추가

### 환불 상태 머신
```
RefundRequest: REQUESTED → APPROVED/REJECTED → PROCESSING → REFUNDED/FAILED
TopupPayment.refundStatus: NONE → PARTIAL → FULL
TopupPayment.status: PAID → REFUNDED (전액 환불 시)
                     PAID → CHARGEBACK (차지백 시)
```

### 환불 정책
- 잔액 검증: `available >= refundAmount` (차지백 제외)
- 부분 환불: refundedAmount 누적
- 차지백: 강제 DEBIT (음수 허용)
- 멱등성: idempotencyKey unique + 조건부 updateMany + LedgerTx unique

### Webhook 이벤트
- `charge.refunded` → processRefundWebhook (비동기 환불 완료)
- `charge.dispute.created` → processChargeback (차지백 자동 처리)

### 참고
- Toss 환불 API는 추후 구현 예정
- 차지백 발생 시 관리자 알림 자동 발송

---

## [2026-01-20] Phase 10-1 - Brand Wallet Topup (결제 충전)

### 변경 사항
- **스키마 추가**: TopupPayment 모델, PaymentProvider/TopupPaymentStatus enum, TOPUP_DEPOSIT/TOPUP_REFUND 원장 타입
- **Payment Provider Adapter**: Toss/Stripe 공통 인터페이스 + 어댑터 구현
- **TopupService**: 충전 생성, 결제 확인, Webhook 처리 비즈니스 로직
- **TopupController/Routes**: Brand API + Webhook API + Admin API
- **Brand Wallet API**: GET /brands/me/wallet (brand.service.ts, brand.routes.ts)
- **Frontend BrandWallet.tsx**: 지갑 조회 + 충전 폼 + 충전 내역

### Backend 파일
- `src/backend/prisma/schema.prisma` - TopupPayment 모델, enum 추가
- `src/backend/src/payments/providers/types.ts` - 공통 인터페이스
- `src/backend/src/payments/providers/toss.ts` - Toss Payments 어댑터
- `src/backend/src/payments/providers/stripe.ts` - Stripe 어댑터
- `src/backend/src/payments/providers/index.ts` - Provider 팩토리
- `src/backend/src/services/topup.service.ts` - 충전 비즈니스 로직
- `src/backend/src/controllers/topup.controller.ts` - 충전 컨트롤러
- `src/backend/src/routes/topup.routes.ts` - 충전 라우트
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/backend/src/services/brand.service.ts` - getMyWallet 추가
- `src/backend/src/controllers/brand.controller.ts` - getMyWallet 추가
- `src/backend/src/routes/brand.routes.ts` - /me/wallet 라우트

### Frontend 파일
- `src/frontend/src/services/api.ts` - createTopup, getMyTopups, getMyBrandWallet 등
- `src/frontend/src/pages/brand/BrandWallet.tsx` (신규) - 지갑 충전 페이지
- `src/frontend/src/App.tsx` - /brand/wallet 라우트 등록

### 멱등성 보장 패턴
1. `@@unique([walletId, idempotencyKey])` - 중복 충전 요청 방지
2. `updateMany({ where: { status: IN [...] } })` - 조건부 상태 업데이트
3. `@@unique([walletId, type, refType, refId])` - LedgerTx 중복 방지

### 환경 변수 (추가 필요)
- `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`

### 참고
- Webhook은 서명 검증 필수 (HMAC-SHA256)
- Checkout URL은 30분 유효
- 최소 1,000원, 최대 1억원 제한

---

## [2026-01-20] Phase 9-3 - Direct Buy + Auction UX 연결 및 Admin 운영 도구

### 변경 사항
- **Brand API 추가**: reservations, bids, wins (brand.service.ts, brand.routes.ts)
- **Athlete API 추가**: pending-signatures (athlete.service.ts, athlete.routes.ts)
- **Auction summary API 추가**: 폴링용 요약 (auction.service.ts, auction.routes.ts)
- **Admin Ops API 추가**: release-reservation, force-close (ops.service.ts, admin.ops.routes.ts)
- **ops.service.ts 신규**: 운영자 강제 처리 비즈니스 로직
- **admin.ops.routes.ts 신규**: Rate Limit(분당 10회), confirmText + reason(10자+) 검증

### 프론트엔드 변경
- **Auctions.tsx**: Brand 전용 탭 추가 ([내 입찰] [내 예약])
- **PendingSignatures.tsx 신규**: 선수 서명 대기 페이지 (긴급 배지: 60분 이하)
- **AdminOps.tsx 신규**: 운영 도구 (예약 해제/경매 강제 종료)
- **App.tsx**: 신규 라우트 등록 (/athlete/pending-signatures, /admin/ops)
- **api.ts**: 신규 API 메서드 추가

### 영향받는 파일
- `src/backend/src/services/brand.service.ts` - getMyReservations, getMyBids, getMyWins
- `src/backend/src/services/athlete.service.ts` - getPendingSignatures
- `src/backend/src/services/auction.service.ts` - getSummary
- `src/backend/src/services/ops.service.ts` (신규) - releaseReservation, forceCloseAuction
- `src/backend/src/routes/admin.ops.routes.ts` (신규)
- `src/frontend/src/services/api.ts` - 신규 API 메서드
- `src/frontend/src/pages/Auctions.tsx` - 탭 확장
- `src/frontend/src/pages/athlete/PendingSignatures.tsx` (신규)
- `src/frontend/src/pages/admin/AdminOps.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- Admin Ops API는 AdminActionLog에 모든 액션 기록
- confirmText 검증: "RELEASE"/"CLOSE" 또는 ID 마지막 6자리
- 멱등성 보장: idempotencyKey 헤더 지원

---

## [2026-01-20] Phase 9-2.1 - 정합성 검증 및 수정

### 변경 사항
- **escrow.service.ts**: holdFromContract()에 available 잔액 검증 추가 (balance - frozenAmount >= grossAmount)
- **contract.service.ts**: sign()에서 예약 해제 → HOLD 순서 변경 (available 확보 후 HOLD 진행)
- **contract.service.ts**: 경매/Direct Buy 구분 로직 개선 (`auction.status === 'ENDED'` 명시적 확인)
- **contract.service.ts**: processExpiredReservations()에도 동일한 구분 로직 적용

### 발견된 이슈 및 수정
| 이슈 | 원인 | 해결 |
|------|------|------|
| HOLD 시 잔액 부족 | holdFromContract()가 frozenAmount 미고려 | available = balance - frozenAmount 검증 추가 |
| 경매/Direct Buy 구분 취약 | frozenAmount 유무에 의존 | auction.status === 'ENDED' 명시적 확인 |
| HOLD 전 available 0 문제 | HOLD 후 예약 해제 순서 | 예약 해제 → HOLD 순서로 변경 |

### 영향받는 파일
- `src/backend/src/services/escrow.service.ts`
- `src/backend/src/services/contract.service.ts`

### 검증 완료 항목
- [x] HOLD 성공/실패 시 원장 1회만 찍히는지 (unique constraint)
- [x] 만료 크론이 한 번만 해제하는지 (status 조건부 업데이트)
- [x] RESERVED→OPEN 복귀 시 Contract CANCELLED 상태 확인
- [x] Outbid 해제 로직 실패 시 지갑 정합성 (트랜잭션 원자성)

---

## [2026-01-20] Phase 9-2 - 경매 입찰 동결 정책

### 변경 사항
- **Schema**: Bid.frozenAmount 추가 (최고 입찰자 동결 금액), LedgerTxType에 AUCTION_BID_RESERVE/RELEASE 추가
- **placeBid()**: 입찰 시 잔액 검증 + 이전 최고 입찰자 해제 + 새 입찰자 동결 + LedgerTx 기록
- **deleteBid()**: 입찰 삭제 시 frozenAmount 해제 + 새 최고 입찰자 동결
- **endAuction()**: Slot → RESERVED (SOLD 대신), Contract 생성 시 brandSignedAt + reservedUntil 설정
- **createFromAuction()**: brandSignedAt=now, reservedUntil=now+24h 자동 설정
- **sign()**: 경매 낙찰 시 winningBid.frozenAmount 해제 로직 추가 (Direct Buy와 구분)
- **processExpiredReservations()**: 경매 예약 만료 시 winningBid.frozenAmount 해제 추가

### 정책 요약
1. 최고 입찰자만 frozenAmount 동결 (모든 입찰자 아님)
2. Outbid 시 이전 최고 입찰자 자동 해제
3. 낙찰 시 Contract 예약 (reservedUntil=24h), frozenAmount 유지
4. 선수 서명 시 Escrow HOLD + frozenAmount 해제
5. 만료 시 Contract CANCELLED, Slot OPEN, frozenAmount 해제
6. 잔액 검증: available (balance - frozenAmount) >= maxBid

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - Bid.frozenAmount, LedgerTxType 확장
- `src/backend/src/services/bid.service.ts` - placeBid(), deleteBid()에 frozen 로직
- `src/backend/src/services/auction.service.ts` - endAuction()에서 RESERVED로 전환
- `src/backend/src/services/contract.service.ts` - createFromAuction()에 reservedUntil, sign()에 경매 해제

### 참고
- Phase 9-1.1의 frozenAmount 패턴 재사용
- 경매와 Direct Buy 모두 동일한 만료 크론(processExpiredReservations) 사용
- 기존 2nd-price/anti-sniping 로직 유지

---

## [2026-01-20] Phase 9-1.1 - Direct Buy 예약 동결/만료 정책

### 변경 사항
- **Schema**: Contract.reservedUntil (예약 만료 시간), LedgerTxType에 DIRECT_BUY_RESERVE/RELEASE 추가
- **processBuyNow()**: buy-now 시 frozenAmount 증가 + reservedUntil 설정 + LedgerTx 기록
- **sign()**: 예약 만료 체크 + 양쪽 서명 완료 시 frozenAmount 해제 + LedgerTx 기록
- **processExpiredReservations()**: 만료된 Direct Buy 예약 자동 처리 (Contract CANCELLED, Slot OPEN, frozen 해제)
- **Cron**: 매 10분 만료 크론 등록 (`*/10 * * * *`)

### 정책 요약
1. 예약 시간: buy-now 시 `reservedUntil = now + 24h`
2. 동결 시점: buy-now 즉시 `frozenAmount += directBuyPrice`
3. 해제 시점 (정상): 선수 서명 완료 시
4. 해제 시점 (만료): 크론이 매 10분 체크, 만료 시 자동 해제
5. Slot 상태: OPEN → RESERVED → SOLD (서명) 또는 OPEN (만료)
6. Contract 상태: PENDING_SIGNATURE → ASSET_PENDING (서명) 또는 CANCELLED (만료)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - Contract.reservedUntil, LedgerTxType 확장
- `src/backend/src/services/slot.service.ts` - processBuyNow()에 frozen 로직
- `src/backend/src/services/contract.service.ts` - sign() 만료체크 + processExpiredReservations()
- `src/backend/src/index.ts` - 만료 크론 등록

### 참고
- 기존 frozenAmount 패턴 재사용 (출금 요청과 동일)
- LedgerTx로 동결/해제 이력 추적 (감사 목적)
- 에스크로 HOLD는 여전히 선수 서명 후 처리 (기존 흐름 유지)

---

## [2025-01-20] Phase 9-1 - 슬롯 즉시구매(Direct Buy) 기능

### 변경 사항
- SlotStatus enum에 RESERVED 추가 (OPEN → RESERVED → SOLD 흐름)
- processBuyNow() 수정: Escrow 즉시 생성 제거, 브랜드 선서명(brandSignedAt=now)
- 잔액 검증 추가: 구매 전 브랜드 가용잔액 >= directBuyPrice 확인
- 동시성 방어: 상태 조건부 updateMany + 활성 계약 1개 제한
- sign()에서 양쪽 서명 완료 시 Slot RESERVED → SOLD 전환
- Auctions.tsx에 "즉시구매" 탭 추가: OPEN 슬롯 중 enableDirectBuy=true 표시
- 즉시구매 확인 모달: 계약 생성 후 계약 페이지로 이동
- 선수에게 즉시구매 계약 생성 알림 발송
- AuditLog 기록 (DIRECT_BUY 액션)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - SlotStatus에 RESERVED 추가
- `src/backend/src/services/slot.service.ts` - processBuyNow() 수정
- `src/backend/src/services/contract.service.ts` - sign()에서 SOLD 전환 추가
- `src/backend/src/routes/slot.routes.ts` - buy-now 라우트 주석 개선
- `src/frontend/src/pages/Auctions.tsx` - 즉시구매 탭, 버튼, 모달 추가

### 참고
- 에스크로는 선수 서명 후 생성 (기존 sign() → holdFromContract() 흐름 재사용)
- 계약 취소 시 Slot → OPEN 복구 (기존 cancel() 로직 활용)
- 브랜드 선서명: Contract.brandSignedAt = now, athleteSignedAt = null

---

## [2025-01-20] Phase 8-Detail - 관리자 선수/브랜드 상세 페이지 확장

### 변경 사항
- 선수 상세 API 확장: wallet, withdrawalStats, recentWithdrawals, recentLedger, contractStats
- 브랜드 상세 API 확장: wallet, escrowStats, recentEscrows, recentLedger, bidStats, kycDetail
- AdminEntityDetail.tsx UI 확장: KPI 카드 6개, 탭 구조 (기본정보/지갑/활동), 테이블
- 출금/에스크로/원장 테이블 (최근 10건씩)

### 영향받는 파일
- `src/backend/src/routes/admin.entities.routes.ts` - API 응답 확장
- `src/frontend/src/pages/admin/AdminEntityDetail.tsx` - UI 확장 (KPI, 탭, 테이블)

### 참고
- 민감정보 제외: bankAccount 원문, taxInfo, kycDocuments
- Decimal → string 변환 (API 응답)
- Bid 모델은 isWinning/maxBid 필드 사용

---

## [2025-01-20] Phase 8 - 관리자 선수/브랜드 상세 페이지

### 변경 사항
- GET /admin/entities/athletes/:id - 선수 상세 조회 API
- GET /admin/entities/brands/:id - 브랜드 상세 조회 API (bizNo 마스킹)
- AdminEntityDetail.tsx - 선수/브랜드 상세 페이지 컴포넌트
- /admin/entities/:type/:id 라우트 등록
- 민감정보 노출 금지 (bankAccount, taxInfo, kycDocuments)

### 영향받는 파일
- `src/backend/src/routes/admin.entities.routes.ts` - 상세 API 추가
- `src/frontend/src/services/api.ts` - getAdminAthlete, getAdminBrand 추가
- `src/frontend/src/pages/admin/AdminEntityDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- 목록 페이지 (AdminEntities.tsx)는 이미 구현되어 있었음
- 상세 페이지에서 최근 계약/슬롯/캠페인 5건 미리보기
- 빠른 링크: 계약 목록, 슬롯 목록, KYC 심사

---

## [2025-01-20] Phase 7-4 - 출금 정합성 검사 + 메트릭 + 알림

### 변경 사항
- getMetrics() 확장: today.rejected, batch.*, failed.last24h, avgApprovalDays
- detectWithdrawalAnomalies() 추가: 5가지 출금 이상징후 규칙
- 09:10 KST 크론 등록: 출금 정합성 검사 → ADMIN 알림 발송
- FinanceDashboard 출금 KPI 카드 4개 추가
- 동결금액 정합성 검증 헬퍼 (checkFrozenIntegrity)

### 영향받는 파일
- `src/backend/src/services/withdrawal.service.ts` - getMetrics() 확장, 헬퍼 메서드 추가
- `src/backend/src/services/reports.service.ts` - detectWithdrawalAnomalies() 추가
- `src/backend/src/index.ts` - 09:10 KST 크론 등록
- `src/frontend/src/pages/admin/finance/FinanceDashboard.tsx` - 출금 KPI 카드

### 참고
- 이상징후 규칙: PENDING_HIGH, PAID_SPIKE, BATCH_FAIL_RATE, FROZEN_ANOMALY, LONG_PENDING
- 크론 스케줄: 09:00 정산 → 09:05 에스크로 이상징후 → 09:10 출금 이상징후
- critical 알림: 동결금액이 음수이거나 잔액 초과 시

---

## [2025-01-20] Phase 7-3 - 계좌정보 암호화

### 변경 사항
- AES-256-GCM 암호화 유틸 구현 (crypto.ts)
- WithdrawalRequest에 암호화 필드 추가 (encrypted, iv, tag, last4)
- FINANCE 역할 추가 (UserRole enum)
- 출금 요청 생성 시 계좌번호 암호화 저장
- CSV Export 시 복호화 + 감사로그 기록
- 프로덕션 부팅 시 암호화 키 검증 (키 없으면 서버 종료)
- ADMIN/FINANCE 권한으로 finance 라우트 접근 가능

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - 암호화 필드 + FINANCE role
- `src/backend/src/utils/crypto.ts` (신규) - AES-256-GCM 암/복호화
- `src/backend/src/index.ts` - 부팅 시 키 검증 로직
- `src/backend/src/services/withdrawal.service.ts` - createRequest 암호화
- `src/backend/src/services/withdrawalBatch.service.ts` - exportCsv 복호화 + 감사로그
- `src/backend/src/routes/admin.finance.routes.ts` - FINANCE 권한 추가

### 참고
- ENV: `BANK_ACCOUNT_ENC_KEY` (32바이트 base64 인코딩)
- 키 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- 기존 데이터 호환: encrypted 없으면 masked만 CSV 출력
- 복호화 실패 시 graceful fallback (masked 유지)

---

## [2025-01-20] Phase 7-2 안전 점검 수정

### 변경 사항
- 메트릭 타임존 KST 명시화 (서버 타임존 의존 → KST 고정)
- 배치 상태 조건부 업데이트 (멱등성 강화: updateMany + 상태 조건)

### 영향받는 파일
- `src/backend/src/services/withdrawal.service.ts` - getMetrics() KST 계산
- `src/backend/src/services/withdrawalBatch.service.ts` - completeBatch() 조건부 업데이트

### 참고
- 검증 항목 7개 중 5개 통과, 2개 수정 완료

---

## [2025-01-20] Phase 7-2 - 출금 운영 고도화 (배치/증빙/메트릭)

### 변경 사항
- WithdrawalBatch 모델, WithdrawalBatchStatus enum 추가
- 배치 상태 머신: CREATED → EXPORTED → COMPLETED/CANCELED
- 출금 요청에 batchId, proofUrl, adminId 필드 추가
- 배치 서비스: 생성/목록/상세/CSV/일괄지급/취소
- CSV 수식 주입 방어 (=, +, -, @ 앞 작은따옴표)
- 메트릭 API: 오늘 요청/승인/지급, 대기 건수
- 프론트엔드 멀티선택 UI (APPROVED 상태에서 체크박스)
- 배치 상세 페이지: CSV 다운로드, Danger Zone (일괄지급/취소)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - WithdrawalBatch 모델, 필드 추가
- `src/backend/src/services/withdrawalBatch.service.ts` (신규)
- `src/backend/src/services/withdrawal.service.ts` - proofUrl, metrics 추가
- `src/backend/src/routes/admin.finance.routes.ts` - 배치/메트릭 API
- `src/frontend/src/services/api.ts` - 배치 API 함수 추가
- `src/frontend/src/pages/admin/finance/FinanceWithdrawals.tsx` - 멀티선택 기능
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalBatches.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalBatchDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 배치 라우트 등록

### 참고
- 배치 일괄지급: confirmText "PAY" + 사유 10자 이상
- 배치 취소: confirmText "CANCEL" + 사유 10자 이상
- proofUrl: 지급 증빙 URL (선택)
- CSV 컬럼: 예금주, 은행명, 계좌(마스킹), 금액, 요청ID

---

## [2025-01-20] Phase 7 - 선수 출금(Withdrawal) 기능

### 변경 사항
- WithdrawalRequest 모델, WithdrawalStatus enum 추가
- 상태 머신: REQUESTED → APPROVED/REJECTED → PAID
- frozenAmount 패턴 구현: 요청 시 동결, 거부 시 해제, 지급 시 balance/frozen 차감
- 선수용 API: 출금 요청, 잔액 조회, 내 요청 목록
- 관리자용 API: 목록/상세/승인/거부/지급완료 + Danger Zone 패턴
- idempotencyKey + P2002 멱등성, 트랜잭션 안전성
- LedgerTx 생성 (PAID 시), 알림/감사로그 연동
- 은행 계좌 마스킹 저장

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - WithdrawalRequest, WithdrawalStatus, NotificationType 추가
- `src/backend/src/services/withdrawal.service.ts` (신규)
- `src/backend/src/controllers/withdrawal.controller.ts` (신규)
- `src/backend/src/routes/withdrawal.routes.ts` (신규)
- `src/backend/src/routes/admin.finance.routes.ts` - 출금 관리 API 추가
- `src/backend/src/routes/index.ts` - withdrawal 라우트 등록
- `src/frontend/src/services/api.ts` - 출금 API 함수 추가
- `src/frontend/src/pages/athlete/Withdrawals.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawals.tsx` (신규)
- `src/frontend/src/pages/admin/finance/FinanceWithdrawalDetail.tsx` (신규)
- `src/frontend/src/App.tsx` - 라우트 등록

### 참고
- Danger Zone 패턴: confirmText 검증 (ID 마지막 6자리 또는 "PAY")
- writeRateLimiter: 10 req/min
- 알림 타입: WITHDRAWAL_APPROVED, WITHDRAWAL_REJECTED, WITHDRAWAL_PAID

---

## [2025-01-17] Phase F6 - 팬 메인 대시보드

### 변경 사항
- FanDashboard.tsx 생성: 통합 팬 홈 페이지
- 포인트 랭킹 API 추가 (GET /api/points/ranking)
- 진행중/종료 투표, 포인트, 랭킹, 샵 추천, 즐겨찾기 섹션

### 영향받는 파일
- `src/frontend/src/pages/fan/FanDashboard.tsx` (신규)
- `src/backend/src/controllers/point.controller.ts`
- `src/backend/src/services/point.service.ts`
- `src/backend/src/routes/point.routes.ts`

---

## [2025-01-17] Phase F5 - 포인트샵

### 변경 사항
- ShopItem, RedemptionOrder 모델 추가
- redemption.service.ts: 상품 CRUD, 주문 생성/취소/처리
- shop.routes.ts: Zod 검증, 엔드포인트 정의
- 트랜잭션 안전성: adjustPointsWithTx로 외부 트랜잭션 컨텍스트 지원
- REDEMPTION_FULFILLED 알림 타입 추가

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/redemption.service.ts` (신규)
- `src/backend/src/controllers/redemption.controller.ts` (신규)
- `src/backend/src/routes/shop.routes.ts` (신규)
- `src/backend/src/services/point.service.ts`
- `src/frontend/src/pages/fan/Shop.tsx` (신규)
- `src/frontend/src/pages/fan/ShopDetail.tsx` (신규)
- `src/frontend/src/pages/fan/Orders.tsx` (신규)

---

## [2025-01-16] Phase F4 - 팬 생성 투표 + 정산

### 변경 사항
- 팬이 투표 생성 (DRAFT → SUBMITTED)
- 관리자 승인/오픈 (ACTIVE)
- 정산 시스템: FanVoteSettlement, FanVoteWinner
- 당첨자 포인트 지급 + 잔여 플랫폼 귀속

### 영향받는 파일
- `src/backend/src/services/fanVote.service.ts`
- `src/backend/src/routes/fanVote.routes.ts`
- `src/frontend/src/pages/fan/FanVoteCreate.tsx`

---

## [2025-01-15] Phase F3 - 포인트 원장 시스템

### 변경 사항
- PointWallet, PointLedgerTx 모델
- 멱등성: 유니크 제약 + 낙관적 락
- 내 포인트/내역 API, 관리자 지급 API

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/point.service.ts`
- `src/backend/src/controllers/point.controller.ts`
- `src/backend/src/routes/point.routes.ts`

---

## [2025-01-14] Phase F2 - 팬 즐겨찾기 + 브랜드 등록

### 변경 사항
- FanFavoriteAthlete, FanFavoriteBrand 모델
- 즐겨찾기 토글 API
- 브랜드 가입 신청 + 관리자 승인 플로우

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/fan.service.ts`
- `src/backend/src/routes/fan.routes.ts`

---

## [2025-01-13] Phase F1 - 팬 기본 투표 시스템

### 변경 사항
- FanVoteEvent, FanVoteEntry 모델
- 진행중/종료 투표 조회 API
- 투표 참여 API (포인트 차감)

### 영향받는 파일
- `src/backend/prisma/schema.prisma`
- `src/backend/src/services/fanVote.service.ts`
- `src/backend/src/routes/fanVote.routes.ts`

---

## [2026-01-20] 시스템 정합성 검증 및 확인

### 검증 항목
- [x] 프론트엔드 라우팅: 모든 페이지 라우트가 App.tsx에 올바르게 등록됨
- [x] 네비게이션 연결: Layout.tsx의 모든 네비게이션 항목이 실제 라우트와 연결됨
- [x] 페이지 컴포넌트: Guide, Contact, Terms, Privacy 등 모든 공개 페이지 존재 확인
- [x] API 엔드포인트: 백엔드 라우트 30개 모두 routes/index.ts에 등록됨
- [x] API 서비스: 프론트엔드 api.ts에서 호출하는 모든 메서드 구현 확인
- [x] TypeScript 빌드: Backend/Frontend 모두 에러 없이 빌드 성공
- [x] 라우트 정합성: 네비게이션에 있는 모든 경로가 App.tsx에 정의됨

### 검증 결과
- **Backend**: 30개 라우트 파일 모두 index.ts에 정상 등록
- **Frontend**:
  - 70+ 라우트 정의 (public, protected, admin, fan, brand, athlete)
  - 모든 네비게이션 링크가 유효한 라우트 경로
  - TypeScript 컴파일 에러 없음
- **API 호출**: 50+ API 메서드가 프론트엔드에서 정상 호출 가능

### 확인된 기능
1. **Public Routes**: Home, Features, HowItWorks, ForWho, FAQ, Guide, Contact, Terms, Privacy
2. **Auth Routes**: Login, Register, Fan Login/Register
3. **Brand Routes**: Dashboard, Inventory, Auctions, Contracts, Wallet, Campaigns, ROI Reports
4. **Athlete Routes**: Dashboard, My Slots, Contracts, Pending Signatures, Settlements, Withdrawals
5. **Fan Routes**: Home, Votes, Points, Shop, Ranking, Favorites, Badges, Seasons
6. **Admin Routes**: 19개 관리 페이지 (Events, Auctions, KYC, Finance, Reports, Entities, Ops 등)

### 참고
- 모든 시스템 구성 요소가 정상 작동
- 라우팅, API, 네비게이션 모두 정합성 확인 완료
- 빌드 에러 없음, 프로덕션 배포 준비 완료

---

## [2026-01-20] 팬 투표 Invalid Date 오류 수정 및 Stripe 제거

### 변경 사항
- **Stripe 결제 옵션 제거**: BrandWallet에서 TOSS만 유지
- **테스트 충전 기능 추가**: 데모용 모의 충전 버튼 (POST /api/brand/topups/mock)
- **팬 투표 Invalid Date 수정**:
  - FanVoteEvent 인터페이스를 백엔드 응답과 일치하도록 수정
  - `entryFee` → `entryFeePoints`, `prizePool` 동적 계산으로 변경
  - MyEntry 인터페이스 필드명 수정 (`optionIndex`, `eventId`)
  - FanVoteDetail: eventData.myEntry 직접 사용하도록 개선

### 영향받는 파일
- `src/frontend/src/pages/brand/BrandWallet.tsx` - Stripe 제거, 테스트 충전 버튼 추가
- `src/frontend/src/pages/fan/Votes.tsx` - FanVoteEvent 인터페이스 수정
- `src/frontend/src/pages/fan/FanVoteDetail.tsx` - 인터페이스 및 필드 매핑 수정
- `src/backend/src/controllers/topup.controller.ts` - mockTopup 메서드 추가
- `src/backend/src/routes/topup.routes.ts` - mock 라우트 추가
- `src/backend/src/index.ts` - 시작시 Wallet FK 제약조건 자동 제거

### 참고
- Wallet 테이블의 FK 제약조건 문제로 시작시 자동 DROP 마이그레이션 추가

---

## [2026-01-21] Phase 10-3 - Reconciliation Admin UI (결제/환불 대사 프론트엔드)

### 변경 사항
- **AdminReconciliation.tsx 신규 생성**: 결제/환불 대사 관리 페이지
  - 요약 KPI 카드 (CRITICAL, HIGH, OPEN, RESOLVED 건수)
  - 이상 이슈 탭: 필터(severity, status), 상태 변경 모달, CSV 내보내기
  - 실행 기록 탭: 대사 실행 이력 테이블
  - 수동 실행 버튼 (FULL scope, 지난 24시간)
- **api.ts 확장**: 6개 Reconciliation API 메서드 추가
- **App.tsx**: /admin/reconciliation 라우트 등록
- **Layout.tsx**: ADMIN 네비게이션에 "대사 관리" 메뉴 추가

### Frontend 파일
- `src/frontend/src/services/api.ts` - Reconciliation API 메서드 추가
- `src/frontend/src/pages/admin/AdminReconciliation.tsx` (신규) - 대사 관리 페이지
- `src/frontend/src/App.tsx` - 라우트 등록
- `src/frontend/src/components/Layout.tsx` - 네비게이션 추가

### API 메서드
| 메서드 | 설명 |
|--------|------|
| getReconciliationRuns | 대사 실행 기록 목록 |
| createReconciliationRun | 수동 대사 실행 |
| getReconciliationIssues | 이상 이슈 목록 |
| getReconciliationIssuesSummary | 이슈 요약 통계 |
| updateReconciliationIssueStatus | 이슈 상태 변경 |
| exportReconciliationIssuesCsv | CSV 내보내기 |

### 참고
- Backend는 이전 세션에서 이미 완전히 구현됨 (Schema, Service, Controller, Routes, Cron)
- 이슈 상태 변경 시 사유 10자 이상 필수
- CSV 내보내기 시 수식 주입 방어 적용

---

## [2026-01-21] Phase 11-1 - RBAC 세분화 및 보안 강화

### 변경 사항
- **새 역할 추가**: UserRole enum에 `SUPPORT`, `AUDITOR` 역할 추가
- **Danger Zone 유틸리티**: confirmText + reason 10자 검증 표준화
- **권한 미들웨어 확장**: authorizePermission(), ROLE_PERMISSIONS 매핑
- **Admin 관리 API**: 관리자 목록/역할 변경/권한 변경 엔드포인트
- **ENV 검증**: validateEnv() - 필수 환경변수 누락 시 서버 시작 실패
- **Frontend AdminUsers.tsx**: 관리자 관리 페이지 (역할 변경 Danger Zone 모달)

### Backend 파일
- `src/backend/prisma/schema.prisma` - UserRole enum 확장 (SUPPORT, AUDITOR)
- `src/backend/src/utils/dangerZone.ts` (신규) - Danger Zone 검증 유틸리티
- `src/backend/src/middleware/auth.ts` - authorizePermission, ROLE_PERMISSIONS, hasPermission
- `src/backend/src/services/admin.service.ts` - getAdmins, changeAdminRole, updateAdminPermissions
- `src/backend/src/controllers/admin.controller.ts` - Admin 관리 메서드 추가
- `src/backend/src/routes/admin.routes.ts` - /admins 라우트 추가
- `src/backend/src/config/index.ts` - validateEnv() 함수 추가
- `src/backend/src/index.ts` - 서버 시작 시 validateEnv() 호출

### Frontend 파일
- `src/frontend/src/services/api.ts` - Admin 관리 API 메서드 3개 추가
- `src/frontend/src/pages/admin/AdminUsers.tsx` (신규) - 관리자 관리 페이지
- `src/frontend/src/App.tsx` - /admin/users 라우트 등록
- `src/frontend/src/components/Layout.tsx` - "관리자 관리" 네비게이션 추가

### 역할별 권한
| 역할 | 설명 | 핵심 권한 |
|------|------|----------|
| ADMIN | 전체 관리자 | 모든 기능 |
| FINANCE | 재무 담당 | 환불/정산/대사 |
| SUPPORT | 고객지원 | 조회 전용 |
| AUDITOR | 감사 | 감사로그/리포트 조회 |

### Danger Zone 패턴
- confirmText: `CHANGE_ROLE_{email}` 정확히 입력 필수
- reason: 최소 10자 이상 사유 입력 필수
- AdminActionLog + AuditLog 자동 기록

### 참고
- 기존 ADMIN/FINANCE 계정은 그대로 유지
- SUPPORT/AUDITOR는 신규 역할로 읽기 전용 접근만 허용
- ENV 검증은 운영 환경에서 PORTONE_* 추가 필수

---

## [2026-01-21] Phase 11-2B - 백업/복구(DR) 및 배포 안정화

### 변경 사항
- **백업 스크립트 생성**:
  - `scripts/db/backup.sh` - PostgreSQL 일일 백업 (pg_dump + gzip + S3)
  - `scripts/db/restore.sh` - 데이터베이스 복구 (확인 텍스트 필수)
  - `scripts/db/verify-backup.sh` - 백업 검증 (임시 컨테이너 복구 + 무결성 검사)
- **배포 안정화 스크립트 생성**:
  - `scripts/release/preflight.sh` - 배포 전 사전 점검 (ENV, DB, Migration, Build)
  - `scripts/release/rollback.sh` - 롤백 절차 안내 (Docker/Render/Fly.io)
- **GitHub Actions backup.yml 생성**: 매일 03:30 KST 자동 백업 + 주간 검증
- **DR_RUNBOOK.md 생성**: 장애 복구 매뉴얼 (12줄 요약, 3개 시나리오)
- **docker-compose.prod.yml 수정**: 마이그레이션 fail-fast 적용

### 신규 파일
- `src/backend/scripts/db/backup.sh`
- `src/backend/scripts/db/restore.sh`
- `src/backend/scripts/db/verify-backup.sh`
- `src/backend/scripts/release/preflight.sh`
- `src/backend/scripts/release/rollback.sh`
- `.github/workflows/backup.yml`
- `docs/DR_RUNBOOK.md`

### 수정 파일
- `docker-compose.prod.yml` - 마이그레이션 실패 시 컨테이너 시작 중단
- `docs/PROJECT_STATE.md` - Phase 11-2B 섹션 추가

### 백업 정책
| 항목 | 값 |
|------|-----|
| 일일 백업 | 03:30 KST (GitHub Actions) |
| 보관 기간 | 일일 14일, 주간 8주, 월간 12개월 |
| 검증 | 매주 일요일 자동 실행 |
| 저장소 | S3 버킷 (daily/weekly/monthly 폴더) |

### 핵심 테이블 (돈 데이터)
- `wallet`, `ledger_tx`, `escrow`, `topup_payments`, `refund_requests`, `withdrawal_requests`
- **LedgerTx**: 절대 DELETE/UPDATE 금지 (불변 원장)

### 참고
- 복구 시 "RESTORE" 텍스트 입력 필요 (안전 장치)
- verify-backup.sh는 임시 Docker 컨테이너에 복구 후 무결성 검사
- preflight.sh 통과해야 배포 진행 가능

---

## [2026-01-21] Phase 11-2A - 브랜드 청구/명세서 시스템

### 변경 사항
- **Prisma 스키마 추가**: BillingProfile, DocumentExportLog, TaxInvoiceRequest 모델
- **enum 추가**: DocumentExportType, TaxInvoiceStatus
- **billingProfile.service.ts 신규**: 청구 프로필 CRUD
- **statements.service.ts 신규**: 명세서 요약/상세/CSV/PDF 생성
- **billing.controller.ts 신규**: Brand Billing API 컨트롤러
- **brand.billing.routes.ts 신규**: Brand Billing API 라우트
- **프론트엔드 BrandBilling.tsx 신규**: 거래명세서/청구정보 탭 페이지

### Backend 파일
- `src/backend/package.json` - pdfkit 의존성 추가
- `src/backend/prisma/schema.prisma` - BillingProfile, DocumentExportLog, TaxInvoiceRequest 추가
- `src/backend/src/services/billingProfile.service.ts` (신규)
- `src/backend/src/services/statements.service.ts` (신규)
- `src/backend/src/controllers/billing.controller.ts` (신규)
- `src/backend/src/routes/brand.billing.routes.ts` (신규)
- `src/backend/src/routes/index.ts` - 라우트 등록

### Frontend 파일
- `src/frontend/src/services/api.ts` - Billing API 메서드 8개 추가
- `src/frontend/src/pages/brand/BrandBilling.tsx` (신규)
- `src/frontend/src/App.tsx` - /brand/billing 라우트 등록
- `src/frontend/src/components/Layout.tsx` - 청구/명세서 메뉴 추가

### API
| API | 설명 |
|-----|------|
| GET /api/brand/billing/profile | 청구 프로필 조회 |
| POST /api/brand/billing/profile | 청구 프로필 생성 |
| PATCH /api/brand/billing/profile | 청구 프로필 수정 |
| GET /api/brand/billing/statements/summary | 기간별 요약 |
| GET /api/brand/billing/statements/items | 거래 내역 (페이지네이션) |
| GET /api/brand/billing/statements/export.csv | CSV 내보내기 |
| GET /api/brand/billing/statements/export.pdf | PDF 내보내기 |

### 보안 고려사항
- CSV 수식 주입 방어: `=`, `+`, `-`, `@` 시작 시 `'` 접두어
- UTF-8 BOM 추가 (Excel 호환)
- DocumentExportLog에 모든 다운로드 감사 기록

### 참고
- pdfkit 사용 (외부 의존성 없는 PDF 생성)
- 세금계산서 발행 워크플로우는 선택 사항으로 남겨둠

---

## [2026-01-21] Phase 11-2A - 세금계산서 발행 워크플로우

### 변경 사항
- **taxInvoice.service.ts 신규**: 세금계산서 요청/승인/거부/발행 워크플로우
- **billing.controller.ts 확장**: Brand/Admin 세금계산서 엔드포인트 추가
- **admin.taxInvoice.routes.ts 신규**: Admin 세금계산서 관리 라우트
- **AdminTaxInvoices.tsx 신규**: 관리자 세금계산서 관리 페이지
- **BrandBilling.tsx 확장**: 세금계산서 탭 추가 (발행 요청 + 내역 조회)
- **config/index.ts 수정**: PortOne V2 시크릿 키 단일 환경변수로 변경

### Backend 파일
- `src/backend/src/services/taxInvoice.service.ts` (신규)
- `src/backend/src/controllers/billing.controller.ts` - 세금계산서 메서드 추가
- `src/backend/src/routes/admin.taxInvoice.routes.ts` (신규)
- `src/backend/src/routes/brand.billing.routes.ts` - 세금계산서 라우트 추가
- `src/backend/src/routes/index.ts` - adminTaxInvoiceRoutes 등록
- `src/backend/src/config/index.ts` - PORTONE_SECRET 단일 키로 변경

### Frontend 파일
- `src/frontend/src/services/api.ts` - 세금계산서 API 메서드 8개 추가
- `src/frontend/src/pages/brand/BrandBilling.tsx` - 세금계산서 탭 추가
- `src/frontend/src/pages/admin/AdminTaxInvoices.tsx` (신규)
- `src/frontend/src/App.tsx` - /admin/finance/tax-invoices 라우트 등록

### 세금계산서 API
| API | 설명 |
|-----|------|
| POST /api/brand/billing/tax-invoices/request | 발행 요청 |
| GET /api/brand/billing/tax-invoices/my | 내 요청 목록 |
| GET /api/admin/finance/tax-invoices | 전체 요청 목록 |
| GET /api/admin/finance/tax-invoices/stats | 통계 |
| POST /api/admin/finance/tax-invoices/:id/approve | 승인 |
| POST /api/admin/finance/tax-invoices/:id/reject | 거부 (reason 10자+) |
| POST /api/admin/finance/tax-invoices/:id/issue | 발행 (confirmText="ISSUE") |

### 상태 머신
```
REQUESTED → APPROVED → ISSUED
         ↘ REJECTED
```

### VAT 계산 로직
```typescript
const totalAmount = BigInt(Math.abs(summary.netSpend));
const supplyAmount = (totalAmount * BigInt(100)) / BigInt(110); // 공급가액
const taxAmount = totalAmount - supplyAmount; // 세액 (10%)
```

### 환경변수 변경
- **Before**: PORTONE_API_KEY + PORTONE_API_SECRET
- **After**: PORTONE_SECRET (V2 단일 시크릿 키, store-xxx 형식)

### 참고
- Danger Zone 패턴 적용: 발행 시 confirmText="ISSUE" 필수
- idempotencyKey로 중복 요청 방지
- 거부 사유 10자 이상 필수

---

## [2026-01-21] 환경변수 검증 체계 정리 - 서버 죽음 방지

### 변경 사항
- **validateEnv() 수정**: PORTONE_SECRET 필수 검증 제거
  - 실제 코드는 Toss/Stripe provider 사용 (PORTONE 미사용)
  - 결제 provider는 조건부 로드로 graceful degradation
  - secretKey 없으면 해당 provider가 비활성화됨 (서버 죽지 않음)
- **.env.example 업데이트**: 전체 환경변수 목록 정리
  - 결제 연동 (TOSS_*, STRIPE_*)
  - 프로덕션 필수 (BANK_ACCOUNT_ENC_KEY, CORS_ORIGIN 등)
  - 선택 설정 (경매, 파일 업로드, 외부 서비스)
- **docs/ENV_SETUP.md 신규 생성**: 환경변수 가이드 문서

### 영향받는 파일
- `src/backend/src/config/index.ts` - PORTONE_SECRET 검증 제거
- `src/backend/.env.example` - 환경변수 목록 업데이트
- `docs/ENV_SETUP.md` (신규) - 환경변수 설정 가이드

### 문제 해결
| 이슈 | 원인 | 해결 |
|------|------|------|
| 운영에서 서버 죽음 | validateEnv()가 PORTONE_SECRET 필수 요구 | 검증 제거, 주석으로 대체 |
| 불일치 | PORTONE 코드에서 미사용 | Toss/Stripe 조건부 로드 확인 |
| 문서 부재 | 환경변수 가이드 없음 | ENV_SETUP.md 생성 |

### 참고
- 결제 provider 키는 `payments/providers/index.ts`에서 조건부 로드
- Toss 사용 시: `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`
- Stripe 사용 시: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- 빌드 성공 확인, 서버 시작 시 죽지 않음 검증

---

## [2026-01-21] 팬 로그인/가입 후 인증 상태 갱신 수정

### 변경 사항
- **FanLogin.tsx**: 로그인 성공 후 `checkAuth()` 호출 추가
- **FanRegister.tsx**: 가입 성공 후 `checkAuth()` 호출 추가
- 토큰 저장 후 Zustand 상태 갱신으로 ProtectedRoute 통과

### 문제 해결
| 이슈 | 원인 | 해결 |
|------|------|------|
| 팬 로그인 후 /fan 튕김 | localStorage만 저장, useAuth 상태 미갱신 | checkAuth() 호출 추가 |

### 영향받는 파일
- `src/frontend/src/pages/fan/FanLogin.tsx` - useAuth import, checkAuth 호출
- `src/frontend/src/pages/fan/FanRegister.tsx` - useAuth import, checkAuth 호출

### 참고
- checkAuth()는 getMe API 호출하여 user 정보 + isAuthenticated 설정
- 기존 useAuth.ts 로직 재사용 (최소 변경)

---

## [2026-01-21] 결제 연동 PortOne V2 단일화 - 환경변수 정리

### 변경 사항
- **결제 연동 변경**: Toss 직접 연동 → PortOne V2 + TossPayments 채널
- **환경변수 정리**:
  - 백엔드: `PORTONE_V2_API_SECRET`, `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`
  - 프론트엔드: `VITE_PORTONE_STORE_ID`, `VITE_PORTONE_CHANNEL_KEY`
- **기존 TOSS_* 환경변수** 주석 처리 (비활성화)

### 영향받는 파일
- `src/backend/src/config/index.ts` - PortOne V2 환경변수 안내 주석
- `src/backend/.env.example` - PortOne V2 환경변수 추가
- `src/frontend/.env.example` - VITE_PORTONE_* 추가
- `docs/ENV_SETUP.md` - 결제 연동 섹션 PortOne V2로 변경

### 참고
- 현재는 환경변수 체계만 정리 (실제 어댑터 구현은 별도 작업)
- PortOne V2 설정 절차는 `docs/ENV_SETUP.md` 참조

---

## [2026-01-22] 디버깅/패칭 - 라우트 순서 및 링크 수정

### 변경 사항
- **A) 백엔드 Express 라우트 순서 수정** (치명적 버그)
  - `admin.finance.routes.ts`: `/withdrawals/batches`, `/withdrawals/metrics`를 `/:id` 위로 이동
  - `campaign.routes.ts`: `/recommended-athletes`를 `/:id` 위로 이동
  - `contract.routes.ts`: `/settlements`를 `/:id` 위로 이동
- **B) 프론트엔드 링크/라우트 불일치 수정**
  - `Auctions.tsx`: `/brand/contracts/` → `/contracts/`
  - `CampaignDetail.tsx`: `/brand/campaigns` → `/campaigns`
  - `FanVoteResult.tsx`: `/fan-votes` → `/votes`
  - `SeasonLeaderboard.tsx`: `/seasons` → `/ranking`
- **C) Admin Topups 페이지 추가**
  - `FinanceTopups.tsx` 신규 생성 (브랜드 충전 내역 조회)
  - App.tsx에 `/admin/finance/topups` 라우트 등록

### 영향받는 파일
- `src/backend/src/routes/admin.finance.routes.ts`
- `src/backend/src/routes/campaign.routes.ts`
- `src/backend/src/routes/contract.routes.ts`
- `src/frontend/src/pages/Auctions.tsx`
- `src/frontend/src/pages/brand/CampaignDetail.tsx`
- `src/frontend/src/pages/fan/FanVoteResult.tsx`
- `src/frontend/src/pages/fan/SeasonLeaderboard.tsx`
- `src/frontend/src/pages/admin/finance/FinanceTopups.tsx` (신규)
- `src/frontend/src/pages/admin/finance/index.ts`
- `src/frontend/src/App.tsx`

### 참고
- Express는 라우트 선언 순서대로 매칭 → 특정 경로가 `:id` 뒤에 있으면 404 발생
- 프론트엔드 링크가 존재하지 않는 라우트를 가리키면 빈 페이지/404
- 빌드 테스트 통과 확인 (Backend: tsc, Frontend: tsc + vite build)

---

## [2026-01-22] 디버깅/패칭 2차 - 깨진 링크 제거

### 변경 사항
- **Auctions.tsx**: 존재하지 않는 `/slots/${slot.id}` 링크 제거
  - 즉시구매 슬롯 목록의 "상세 보기" 버튼이 없는 라우트로 연결됨
  - 클릭 시 홈으로 리다이렉트되는 버그
  - 해결: Link 컴포넌트 삭제, BRAND 사용자는 "즉시구매" 버튼만 표시

### 영향받는 파일
- `src/frontend/src/pages/Auctions.tsx` - Line 516-524 삭제

### 검증
- TypeScript 빌드 통과
- Vite 프로덕션 빌드 통과 (2527 modules, 7.60s)

---

## [2026-01-22] 디버깅/패칭 3차 - 추가 링크 버그 수정

### 변경 사항
- **AuctionDetail.tsx**: `/contracts?highlight=...` → `/contracts/...`
  - highlight 쿼리파라미터가 지원되지 않아 계약 상세 페이지로 직접 연결
- **FinanceEscrowDetail.tsx**: `/contracts?highlight=...` → `/contracts/...`
  - 동일한 문제로 계약 상세 페이지로 직접 연결
- **AdminEntityDetail.tsx**: 존재하지 않는 라우트 링크 제거
  - `/admin/contracts` - 라우트 없음 → 링크 제거
  - `/admin/slots` - 라우트 없음 → 링크 제거
  - 출금 목록, 에스크로 목록 링크는 유지 (라우트 존재)

### 영향받는 파일
- `src/frontend/src/pages/AuctionDetail.tsx`
- `src/frontend/src/pages/admin/finance/FinanceEscrowDetail.tsx`
- `src/frontend/src/pages/admin/AdminEntityDetail.tsx`

### 검증
- TypeScript 빌드 통과
- Vite 프로덕션 빌드 통과 (2527 modules, 7.76s)

---

## [2026-01-22] 경매 최고가 갱신 버그 수정

### 변경 사항
- **brand.service.ts**: `getMyBids()` 메서드에서 `currentHighest` 계산 로직 수정
  - 기존: `auction.bids[0]?.currentProxy` (최고 입찰자의 프록시 금액)
  - 수정: `auction.currentPrice` (공식 현재 최고가 = 2차가 경매 공개가)
  - 이슈: 내 입찰 탭에서 "현재 최고가"가 갱신되지 않는 문제

### 원인 분석
- 입찰 시 `bid.service.ts`에서 `auction.currentPrice`를 정상 업데이트
- 그러나 `brand.service.ts`에서 `currentHighest`를 `bids[0].currentProxy`로 계산
- `currentProxy`는 각 입찰자의 프록시 금액이고, `currentPrice`가 공식 최고가

### 영향받는 파일
- `src/backend/src/services/brand.service.ts`

### 검증
- TypeScript 빌드 통과

---

## [2026-01-22] 입찰 P2002 중복 에러 수정

### 변경 사항
- **bid.service.ts**: `placeBid()` 메서드에서 기존 입찰 조회 방식 수정
  - 기존: `auction.bids.find()` (트랜잭션 외부에서 조회, stale data 가능)
  - 수정: `tx.bid.findUnique({ where: { auctionId_brandId: ... }})`
  - 트랜잭션 내에서 직접 조회하여 race condition 방지

### 원인 분석
- Bid 모델에 `@@unique([auctionId, brandId])` 제약 존재
- 기존 입찰이 있는데 `auction.bids` 배열에서 찾지 못하면 create 시도
- P2002 unique constraint violation → "Resource already exists" 409 에러

### 영향받는 파일
- `src/backend/src/services/bid.service.ts`

### 검증
- TypeScript 빌드 통과

---

## [2026-01-22] 추천 경매 (Featured Auctions) 기능 구현

### 변경 사항
- **Auction 모델**: `isFeatured` Boolean 필드 추가
- **Admin 서비스**: 추천 경매 생성 기능 (`createFeaturedAuction`, `bulkCreateFeaturedAuctions`)
  - 슬롯 인스턴스 + 경매를 원자적 트랜잭션으로 생성
  - 즉시 LIVE 상태로 시작 가능
- **Public API**: `/auctions/featured` 엔드포인트 (비로그인 조회 가능)
- **Admin UI**: 추천 경매 관리 페이지 (`/admin/featured-auctions`)
- **Auctions 페이지**: 상단에 추천 경매 섹션 노출 (황금색 배경)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - Auction.isFeatured 추가
- `src/backend/src/services/admin.service.ts` - 추천 경매 생성 메서드
- `src/backend/src/services/auction.service.ts` - getFeaturedAuctions 메서드
- `src/backend/src/controllers/admin.controller.ts` - 추천 경매 컨트롤러
- `src/backend/src/controllers/auction.controller.ts` - getFeatured 메서드
- `src/backend/src/routes/admin.routes.ts` - 추천 경매 라우트
- `src/backend/src/routes/auction.routes.ts` - /auctions/featured 라우트
- `src/frontend/src/services/api.ts` - API 메서드 추가
- `src/frontend/src/pages/admin/AdminFeaturedAuctions.tsx` - 신규 페이지
- `src/frontend/src/pages/Auctions.tsx` - 추천 경매 섹션 추가
- `src/frontend/src/components/Layout.tsx` - 네비게이션 메뉴 추가
- `src/frontend/src/App.tsx` - 라우트 등록

### 검증
- Backend TypeScript 빌드 통과
- Frontend TypeScript/Vite 빌드 통과

---

## [2026-01-22] 슬롯 3D 시각화 + 경매 등록 슬롯 표시 버그 수정

### 변경 사항
- **버그 수정**: 선수가 슬롯에 경매 설정 시 슬롯이 사라지는 문제 해결
  - `athleteService.getAvailableSlots`에서 `IN_AUCTION`, `RESERVED` 상태도 포함하도록 수정
  - `MySlots.tsx`에서 계약 정보 접근 경로 수정 (`slot.contract` → `slot.auction?.contract`)
- **3D 시각화**: Three.js 기반 슬롯 부착 위치 3D 시각화 컴포넌트 추가
  - 모자(Cap): 정면/측면 로고 위치 표시, 자동 회전
  - 셔츠(Shirt): 정면/등판/소매 로고 위치 표시
  - 2D/3D 토글 버튼으로 전환 가능

### 영향받는 파일
- `src/backend/src/services/athlete.service.ts` - getAvailableSlots 쿼리 수정
- `src/frontend/src/pages/MySlots.tsx` - contract 접근 경로 수정
- `src/frontend/src/components/SlotVisualization.tsx` - 3D 지원 추가
- `src/frontend/src/components/SlotVisualization3D.tsx` - 신규 (Three.js 3D 컴포넌트)
- `src/frontend/package.json` - three, @react-three/fiber, @react-three/drei 패키지 추가

### 참고
- Three.js React 18 호환 버전 사용: three@0.160, @react-three/fiber@8.15, @react-three/drei@9.88
- 3D 모델은 기하학적 메시로 직접 구성 (외부 모델 파일 없음)

---

## [2026-01-22] 경매+즉시구매 동시 설정 버그 수정

### 문제
- 슬롯에 경매와 즉시구매를 동시에 활성화하면 즉시구매 탭에서 해당 슬롯이 표시되지 않음
- 원인: 경매 활성화 시 슬롯 상태가 `IN_AUCTION`으로 변경되지만, 즉시구매 탭은 `status: 'OPEN'`만 조회

### 변경 사항
- **백엔드**: `slotInstanceService.list()`에 `enableDirectBuy` 필터 추가
- **백엔드**: `slotInstanceController.list()`에서 `enableDirectBuy` 쿼리 파라미터 처리
- **프론트엔드**: 즉시구매 탭 쿼리를 `status: 'OPEN'` → `enableDirectBuy: true`로 변경
- **프론트엔드**: RESERVED/SOLD 상태 슬롯은 목록에서 제외

### 영향받는 파일
- `src/backend/src/services/slot.service.ts` - list() 함수에 enableDirectBuy 필터 추가
- `src/backend/src/controllers/slot.controller.ts` - 쿼리 파라미터 추출 수정
- `src/frontend/src/pages/Auctions.tsx` - 즉시구매 슬롯 쿼리 로직 수정

### 검증
- Backend/Frontend TypeScript 빌드 통과

---

## [2026-01-22] 슬롯 생성 모달 중복 체크 버그 수정

### 문제
- 슬롯 생성 모달에서 이미 존재하는 슬롯이 선택 가능하게 표시됨
- 원인: 페이지의 이벤트 필터에 따라 `existingSlots`가 제한적으로 로드됨
- 모달에서 다른 이벤트를 선택하면 해당 이벤트의 기존 슬롯 정보가 없어서 중복 필터링 실패

### 변경 사항
- **CreateSlotModal**: 별도의 `useQuery`로 전체 슬롯 목록 조회
- `allExistingSlots`를 사용하여 모든 이벤트의 슬롯을 중복 체크

### 영향받는 파일
- `src/frontend/src/pages/MySlots.tsx` - CreateSlotModal 컴포넌트 수정

### 검증
- Frontend TypeScript 빌드 통과

---

## [2026-01-22] 3D 베이스볼 캡 LatheGeometry 기반 구현

### 변경 사항
- **크라운**: BufferGeometry → LatheGeometry + Bezier 프로파일 곡선으로 변경
- **챙**: ExtrudeGeometry + vertex bend로 아래로 휘어지는 곡면 구현
- **머티리얼**: MeshPhysicalMaterial (transmission:0, clearcoat:0, roughness:0.85)
- 사용하지 않는 import 정리 (useThree, useFrame, Line, useEffect)
- 미사용 유틸리티 파일 삭제 (createBaseballCap.ts)

### 영향받는 파일
- `src/frontend/src/components/SlotVisualization3D.tsx` - 캡 지오메트리 전면 재구성

### 검증
- Frontend TypeScript 빌드 통과
- Git push 완료 (commit: 8754812)

---

## [2026-01-22] 모자 측면 뷰 SVG 대폭 개선

### 변경 사항
- **챙 길이 대폭 증가**: x=25 → x=-50까지 연장 (실제 야구모자 비율)
- **챙 입체감**: 상면/하면/두께를 분리하여 3D 느낌 표현
- **스티칭 라인**: 점선 패스로 봉제선 표현
- **크라운 형태**: 앞이 낮고 뒤가 높은 실제 캡 실루엣
- **디테일 추가**: 패널 구분선, 아일릿(환기구멍), 탑 버튼
- **그라데이션 개선**: 4개 gradient로 입체감 향상
- **viewBox 확장**: 512x400 → 550x420

### 영향받는 파일
- `src/frontend/src/components/SlotVisualization.tsx` - CapSideView 전면 재구성

### 검증
- Frontend TypeScript 빌드 통과
- Git push 완료 (commit: 642cf7b)

---

## [2026-01-23] 팬 투표 페이지 버그 수정 (Timezone + 화이트스크린)

### 변경 사항
- **화이트스크린 수정**: VoteDetail.tsx에서 `stats.optionStats.sort()` 호출 시 undefined 체크 추가
  - `stats?.optionStats && Array.isArray(stats.optionStats)` 방어 코드 추가
- **Backend 필드명 수정**: vote.service.ts `getVoteEventStats()`에서 `options` → `optionStats`로 변경
- **Timezone 이슈 해결**: `listActiveVoteEvents()`에서 날짜 필터링 제거
  - 서버 UTC 시간과 사용자 KST 시간 불일치 문제
  - 이제 ACTIVE 상태만으로 투표 노출 여부 결정
  - 관리자가 activate/close 버튼으로 직접 관리
- **디버그 로그 정리**: Votes.tsx에서 개발용 console.log 제거

### 영향받는 파일
- `src/frontend/src/pages/fan/VoteDetail.tsx` - undefined 체크 추가
- `src/frontend/src/pages/fan/Votes.tsx` - 디버그 로그 제거
- `src/backend/src/services/vote.service.ts` - optionStats 필드명, 날짜 필터 제거

### 참고
- 관리자 투표 상태 플로우: DRAFT → ACTIVE (activate) → CLOSED (close) → SETTLED (settle)
- startAt/endAt은 팬에게 표시용 정보로만 사용 (실제 필터링에 사용하지 않음)

---

## [2026-01-23] 투표 시스템 버그 수정 및 포인트 배분 로직 개선

### 변경 사항
- **투표 제출 403 오류 수정**: `submitVote()`에서 날짜 검증 로직 제거
  - 서버 UTC와 클라이언트 KST 시간 불일치로 인한 오류
  - ACTIVE 상태 검사만으로 투표 가능 여부 판단
- **포인트 지급 시스템 수정**: vote.service.ts에서 `pointService.adjustPoints()` 사용
  - 기존: `User.pointBalance` + `PointLedger` (프론트엔드 미사용)
  - 수정: `PointWallet` + `PointLedgerTx` (프론트엔드 조회용)
- **관리자 포인트 지급 페이지 추가**: AdminPoints.tsx
  - 이메일로 팬 사용자 검색
  - 선택 사용자에게 포인트 지급 (사유 입력 가능)
- **투표 정산 n분의1 배분 방식 변경**:
  - 기존: 정답자 각자에게 `pointsPerCorrect` 고정 지급
  - 수정: 총 상금 풀(`pointsPerCorrect`)을 정답자 수로 나눠 균등 배분
  - 나머지(remainder)는 플랫폼 귀속

### 영향받는 파일
- `src/backend/src/services/vote.service.ts` - 날짜 검증 제거, PointWallet 사용, n분의1 배분
- `src/backend/src/routes/admin.entities.routes.ts` - GET /admin/entities/fans 추가
- `src/frontend/src/pages/admin/AdminPoints.tsx` - 신규 생성
- `src/frontend/src/services/api.ts` - getAdminFans() 메서드 추가
- `src/frontend/src/App.tsx` - AdminPoints 라우트 추가
- `src/frontend/src/components/Layout.tsx` - 포인트 관리 네비게이션 추가

### 참고
- 투표 정산 공식: `payoutEach = floor(totalPrizePool / correctCount)`
- 정답자 0명인 경우 전액 플랫폼 귀속

---

## [2026-01-23] 비로그인 경매/인벤토리 조회 버그 수정

### 변경 사항
- **비로그인 사용자 경매 조회 가능**: `/auctions`, `/auctions/live`, `/auctions/ending-soon`, `/auctions/:id`
- **비로그인 사용자 인벤토리 조회 가능**: `/slots/instances`, `/slots/instances/available`
- **비로그인 사용자 이벤트 조회 가능**: `/events`, `/events/upcoming`, `/events/:id`
- `authenticate` 미들웨어를 `optionalAuth`로 변경하여 비로그인도 데이터 조회 가능
- 입찰/구매 등 쓰기 작업은 여전히 인증 필수

### 영향받는 파일
- `src/backend/src/routes/auction.routes.ts` - GET 라우트 optionalAuth 적용
- `src/backend/src/routes/slot.routes.ts` - GET /instances, GET /instances/available optionalAuth 적용
- `src/backend/src/routes/event.routes.ts` - GET 라우트 optionalAuth 적용

### 참고
- 기존에 `/auctions/featured`만 optionalAuth로 비로그인 접근 가능했음
- 투표 조회와 마찬가지로 경매/인벤토리도 비로그인 사용자에게 열람 허용
- 실제 입찰/구매 행위는 프론트엔드에서 로그인 체크 후 진행

---

## [2026-01-23] 브랜드 투표 생성 기능 추가

### 변경 사항
- **Backend**: 브랜드가 투표를 생성할 수 있는 API 추가
  - `POST /fan-votes/brand/create` - 브랜드 투표 생성
  - `GET /fan-votes/brand/my/events` - 브랜드가 만든 투표 목록
  - `POST /fan-votes/brand/:id/submit` - 브랜드 투표 제출 (DRAFT → SUBMITTED)
- **Frontend**: 브랜드 투표 생성/관리 페이지 추가
  - `BrandVoteCreate.tsx` - 브랜드 투표 생성 폼 (스폰서 기여금, 배너, 로고, 메시지, 링크 입력 가능)
  - `BrandVotes.tsx` - 브랜드가 만든 투표 목록 및 관리
- **네비게이션**: 브랜드 메뉴에 "내 투표" 항목 추가

### 영향받는 파일
- `src/backend/src/services/fanVote.service.ts` - createByBrand, submitBrandVote, getBrandCreatedEvents 추가
- `src/backend/src/controllers/fanVote.controller.ts` - 브랜드 투표 컨트롤러 메서드 추가
- `src/backend/src/routes/fanVote.routes.ts` - 브랜드 투표 라우트 추가
- `src/frontend/src/services/api.ts` - createBrandVote, getBrandCreatedVotes, submitBrandVote 추가
- `src/frontend/src/pages/brand/BrandVoteCreate.tsx` - 신규 생성
- `src/frontend/src/pages/brand/BrandVotes.tsx` - 신규 생성
- `src/frontend/src/App.tsx` - 라우트 추가 (/brand/votes, /brand/votes/create)
- `src/frontend/src/components/Layout.tsx` - 브랜드 네비게이션에 "내 투표" 추가

### 참고
- 브랜드 투표도 팬 투표와 동일한 정산 로직 적용 (총 포인트 풀 → 정답자에게 배분)
- 브랜드 생성 투표는 자동으로 스폰서로 설정되며, 기여금이 상금 풀에 추가됨
- 관리자 승인 후 투표가 활성화됨

---

## [2026-01-23] 투표 생성/제출 시 역할(FAN/ATHLETE/BRAND) 구분 처리

### 변경 사항
- **문제**: 선수(ATHLETE)가 투표를 만들어도 `creatorRole`이 항상 'FAN'으로 저장됨
- **원인**: `/fan-votes/create` 엔드포인트가 모든 역할(FAN, ATHLETE, BRAND)에서 `createByFan` 서비스 메서드만 호출
- **해결**: 컨트롤러에서 사용자 역할에 따라 적절한 서비스 메서드 호출
  - ATHLETE → `createByAthlete` (creatorRole: 'ATHLETE')
  - BRAND → `createByBrand` (creatorRole: 'BRAND')
  - FAN → `createByFan` (creatorRole: 'FAN')
- `submitFanVote` 컨트롤러도 역할별 분기 처리 추가
- 알림 메시지에 역할 레이블 표시 ("선수 투표 승인 요청" 등)

### 영향받는 파일
- `src/backend/src/controllers/fanVote.controller.ts` - createByFan, submitFanVote 역할별 분기 처리
- `src/backend/src/services/fanVote.service.ts` - submitFanVote 알림 메시지에 역할 레이블 추가

### 참고
- 이제 관리자 투표 심사 페이지에서 "선수", "브랜드", "팬" 뱃지가 정확히 표시됨
- 기존에 생성된 투표는 이미 저장된 creatorRole 값을 유지 (마이그레이션 불필요)

---

## [2026-01-23] 관리자 투표 삭제 기능 확장 - 모든 상태 삭제 가능

### 변경 사항
- **Backend**: `adminDeleteEvent` 서비스 메서드 추가
  - DRAFT/SUBMITTED: 바로 삭제 (수수료 미청구 상태)
  - ACTIVE/CLOSED: Seed + 개설수수료 환불 후 삭제
  - SETTLED: 바로 삭제 (이미 정산 완료)
- `PointTxReason` enum에 `VOTE_REFUND` 추가
- `NotificationType` enum에 `FAN_VOTE_DELETED` 추가
- 삭제 시 개설자에게 알림 발송 (환불 금액 포함)
- **Frontend**: 관리자 투표 심사 페이지에서 모든 상태에 삭제 버튼 표시
  - ACTIVE/CLOSED 삭제 시 환불 경고 메시지
  - 삭제 완료 후 모든 탭 쿼리 무효화

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - VOTE_REFUND, FAN_VOTE_DELETED enum 값 추가
- `src/backend/src/services/fanVote.service.ts` - adminDeleteEvent 메서드 추가
- `src/backend/src/controllers/fanVote.controller.ts` - deleteSettledEvent 수정
- `src/frontend/src/pages/admin/AdminFanVotes.tsx` - 삭제 버튼 모든 상태에 추가

### 참고
- 기존 `deleteSettledEvent`는 레거시 호환을 위해 유지 (내부적으로 `adminDeleteEvent` 호출)
- 참여비 환불은 하지 않음 (이미 참여자에게서 차감됨, 개설자 리워드로 지급됨)

---

## [2026-01-28] 에이전시(Agency) 기능 구현

### 변경 사항
- **새 역할**: UserRole.AGENCY 추가 - 선수를 대신하여 슬롯/계약을 관리하는 대리인
- **스키마 추가**: Agency 모델, Athlete.agencyId 추가
- **Backend**: AgencyService, AgencyController, agency.routes.ts 신규 생성
- **Auth 확장**: 미들웨어에 agencyId 추가, canManageAthlete 헬퍼 함수
- **Admin KYC**: 에이전시 KYC 심사 기능 추가 (getPendingKyc, reviewAgencyKyc)
- **Frontend**: 에이전시 회원가입, 대시보드, 선수 등록/관리 페이지

### 에이전시 기능
- 회원가입 및 KYC 인증
- KYC 승인 후 선수 등록 가능
- 소속 선수 슬롯 판매모드 설정
- 소속 선수 대신 계약 서명
- 서명 대기 계약 목록 조회

### Backend 파일
- `src/backend/prisma/schema.prisma` - AGENCY enum, Agency 모델, Athlete.agencyId
- `src/backend/src/services/agency.service.ts` (신규)
- `src/backend/src/controllers/agency.controller.ts` (신규)
- `src/backend/src/routes/agency.routes.ts` (신규)
- `src/backend/src/middleware/auth.ts` - agencyId, canManageAthlete
- `src/backend/src/services/auth.service.ts` - AGENCY case 추가
- `src/backend/src/services/admin.service.ts` - 에이전시 KYC 심사
- `src/backend/src/services/email.service.ts` - KYC 알림에 AGENCY 지원
- `src/backend/src/types/index.ts` - agencyId 추가

### Frontend 파일
- `src/frontend/src/pages/Register.tsx` - AGENCY 역할 선택 추가
- `src/frontend/src/pages/agency/AgencyDashboard.tsx` (신규)
- `src/frontend/src/pages/agency/AgencyAthletes.tsx` (신규)
- `src/frontend/src/pages/agency/AgencyAthleteRegister.tsx` (신규)
- `src/frontend/src/pages/agency/index.ts` (신규)
- `src/frontend/src/components/Layout.tsx` - AGENCY 네비게이션 추가
- `src/frontend/src/App.tsx` - /agency/* 라우트 등록
- `src/frontend/src/types/index.ts` - UserRole에 AGENCY 추가

### 비즈니스 규칙
- 에이전시 KYC 승인 필수: 선수 등록 전 KYC가 APPROVED여야 함
- 선수 1명 = 1개 에이전시: 동시에 여러 에이전시 소속 불가
- 출금 권한 분리: 에이전시는 선수 출금 대리 불가 (보안)

---

## [2026-01-28] 에이전시 슬롯 판매모드 설정 시 409 Conflict 오류 수정

### 변경 사항
- `updateAthleteSlotSaleMode`에서 경매 재활성화 시 409 Conflict 오류 발생 버그 수정
- 원인: 기존 경매가 ENDED/CANCELLED/UNSOLD 상태일 때 새 경매를 CREATE 시도 → `slotInstanceId` UNIQUE 제약 위반
- 해결: 기존 경매가 있으면 항상 UPDATE, 없을 때만 CREATE
- 재활성화 시 `totalExtended`, `winningBidId` 초기화 추가

### 영향받는 파일
- `src/backend/src/services/agency.service.ts` - updateAthleteSlotSaleMode 메서드 수정

### 참고
- `slotInstanceId`는 Auction 테이블에서 UNIQUE 제약이 있어 슬롯당 1개 경매만 존재 가능
- 경매 종료/취소 후 재경매 시에도 기존 레코드를 재활용함

---

## [2026-01-29] Phase 2 슬롯 정책 시스템 구현 (v2)

### 변경 사항
- **Prisma 스키마 확장**: SlotTemplate에 v2 필드 추가 (phase, category, grade, nameKr, nameEn, uiHeadline, uiCopy, tags, openRule, exclusivityGroup, tournamentReserved, reserveMinKrw, reserveRecKrw)
- **Event.tournamentRules**: 대회별 슬롯 운영 규칙 JSON 필드 추가
- **phase2Unlock.service.ts 신규**: Phase 2 자동 오픈 판정 로직 구현
- **tournamentRules.controller.ts 신규**: 대회 규칙 및 슬롯 가용성 API
- **tournamentRules.routes.ts 신규**: Public/Auth/Admin 라우트 분리
- **seed.ts 업데이트**: 6개 → 16개 v2 슬롯 템플릿 (CAP 5, TOP 9, PANTS 2)
- **Frontend 타입 확장**: TournamentRules, SlotAvailability 인터페이스 추가
- **api.ts 확장**: getTournamentRules, getSlotAvailability, approvePhase2Slots 등

### 핵심 로직
- Phase 1 (CAP+TOP): 항상 먼저 오픈
- Phase 2 (PANTS): Phase 1 유효 슬롯이 모두 SOLD/RESERVED일 때만 오픈
- chestReservedSide, sleeveReservedSide: CHEST/SLEEVE 그룹 좌/우 대회 점유
- phase2UnlockMode: AUTO(즉시) / ADMIN_APPROVE(수동)

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - SlotTemplate v2 필드, Event.tournamentRules
- `src/backend/prisma/seed.ts` - 16개 슬롯 템플릿 데이터
- `src/backend/src/services/phase2Unlock.service.ts` (신규)
- `src/backend/src/controllers/tournamentRules.controller.ts` (신규)
- `src/backend/src/routes/tournamentRules.routes.ts` (신규)
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/frontend/src/types/index.ts` - v2 타입 추가
- `src/frontend/src/services/api.ts` - v2 API 메서드 추가

### 참고
- v2 폴더의 GTOUR_슬롯운영_브랜드카피_패키지_v1_1 문서 기반 구현
- TypeScript 빌드 성공 확인 (Backend + Frontend)

---

## [2026-01-29] v2 비즈니스 검증 로직 구현 (4가지)

### 변경 사항
- **phase2EligibleMinDaysBefore 검증**: 대회 종료 N일 전부터만 Phase 2 오픈 가능
- **maxSlotsPerBrandPerPlayer 검증**: 브랜드당 동일 선수 최대 슬롯 수 제한
- **prohibitedCategories 검증**: 금지 카테고리 브랜드 입찰/즉시구매 차단
- **creativeApprovalRequired 검증**: 크리에이티브 사전 승인 필요 여부 (향후 확장용 스텁)

### 구현 내용
1. `phase2Unlock.service.ts`에 4가지 검증 함수 추가:
   - `checkPhase2MinDaysBefore()` - 최소 선행일 검증
   - `validateMaxSlotsPerBrand()` - 브랜드당 최대 슬롯 수 검증
   - `validateProhibitedCategories()` - 금지 카테고리 검증
   - `validateCreativeApproval()` - 크리에이티브 승인 검증 (스텁)
   - `validateTournamentRulesForBid()` - 통합 검증 함수

2. `slot.service.ts` - processBuyNow()에 대회 규칙 검증 추가
3. `bid.service.ts` - placeBid()에 대회 규칙 검증 추가

### 영향받는 파일
- `src/backend/src/services/phase2Unlock.service.ts` - 검증 함수 추가
- `src/backend/src/services/slot.service.ts` - 즉시구매 검증 적용
- `src/backend/src/services/bid.service.ts` - 입찰 검증 적용

### 참고
- creativeApprovalRequired는 이제 BrandEventCreativeApproval 모델로 완전 구현됨

---

## [2026-01-29] BrandEventCreativeApproval 모델 및 API 구현

### 변경 사항
- **Prisma 모델**: `BrandEventCreativeApproval` 추가 (브랜드+대회별 사전 크리에이티브 승인)
- **PreApprovalStatus enum**: SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED
- **서비스**: `creativeApproval.service.ts` - 제출, 승인, 거부, 조회 로직
- **컨트롤러/라우트**: Brand API + Admin API 분리
- **validateCreativeApproval 연결**: 실제 DB 조회로 승인 상태 검증

### 모델 구조
```prisma
model BrandEventCreativeApproval {
  brandId, eventId  // @@unique
  fileUrl, fileName, fileType, fileSizeBytes
  status: PreApprovalStatus
  reviewNotes, reviewedBy, reviewedAt
}
```

### API 엔드포인트
| API | 설명 |
|-----|------|
| POST /api/brand/creative-approvals | 크리에이티브 승인 요청 제출 |
| GET /api/brand/creative-approvals | 내 요청 목록 |
| GET /api/brand/creative-approvals/events/:eventId | 특정 대회 승인 상태 |
| GET /api/admin/creative-approvals | 전체 요청 목록 (Admin) |
| GET /api/admin/creative-approvals/stats | 통계 (Admin) |
| POST /api/admin/creative-approvals/:id/approve | 승인 (Admin) |
| POST /api/admin/creative-approvals/:id/reject | 거부 (Admin) |

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - BrandEventCreativeApproval 모델, relations 추가
- `src/backend/src/services/creativeApproval.service.ts` (신규)
- `src/backend/src/controllers/creativeApproval.controller.ts` (신규)
- `src/backend/src/routes/creativeApproval.routes.ts` (신규)
- `src/backend/src/routes/index.ts` - 라우트 등록
- `src/backend/src/services/phase2Unlock.service.ts` - validateCreativeApproval 실제 구현

### 참고
- 입찰/즉시구매 시 대회에 creativeApprovalRequired=true면 사전 승인 필수
- REJECTED 상태에서 재제출 가능
- TypeScript 빌드 성공 확인 (Backend + Frontend)

---

## [2026-02-02] Vote V2 리워드풀 시스템 버그 수정

### 변경 사항
- **seed.ts**: rewardPool upsert 시 `update: {}` 비어있어 availableTodayEp가 리셋되지 않는 문제 수정
  - `update: { availableTodayEp: BigInt(500_000) }` 추가
- **voteV2.controller.ts**: getVoteById BigInt 직렬화 오류 수정
  - `participations`, `_count` 필드 스프레드에서 제외
  - userParticipation BigInt 필드 명시적 toString() 변환
- **voteV2.routes.ts**: 리워드풀 상태 조회 API 공개 (authenticate → optionalAuth)
- **VoteV2Detail.tsx**: 참여 후 페이지 새로고침 오류 수정 (await 추가, 에러 상태 관리 개선)
- **Layout.tsx**: Brand/Athlete 메뉴에 투표 생성/내가 만든 투표 추가
- **Home.tsx**: 메인 페이지 투표 링크 경로 수정 (`/votes/${id}`)

### 영향받는 파일
- `src/backend/prisma/seed.ts`
- `src/backend/src/controllers/voteV2.controller.ts`
- `src/backend/src/routes/voteV2.routes.ts`
- `src/frontend/src/pages/fan/VoteV2Detail.tsx`
- `src/frontend/src/components/Layout.tsx`
- `src/frontend/src/pages/Home.tsx`

### 참고
- 참여 보상 0 EP 문제 원인: availableTodayEp 부족 → seed 재실행으로 해결
- 리워드풀 상태: http://localhost:4000/api/votes-v2/reward-pool/status 에서 확인 가능
- BigInt 직렬화: Prisma에서 반환하는 BigInt는 JSON으로 직렬화 시 명시적 .toString() 필요

---

## [2026-02-02] Render 배포 오류 수정 및 UI 개선

### 변경 사항
- **schema.prisma**: PointTxReason enum에 레거시 값 복원
  - `VOTE_OPEN_FEE`, `VOTE_POT_REMAINDER`, `VOTE_CREATOR_PRIZE` 등 7개 값
  - Render 배포 시 기존 DB 데이터와 enum 불일치 오류 해결
- **AdminVoteV2.tsx**: Layout 컴포넌트 래핑 추가
  - 어드민 투표 관리 페이지에 사이드바가 표시되지 않던 문제 수정
- **seed.ts**: 레거시 슬롯 템플릿 v2 필드 업데이트 로직 추가
  - SG-01 ~ SG-06 템플릿에 category, grade, phase 필드 설정
  - 슬롯 목록에서 배지(상의/모자, S/A/B등급)가 표시되지 않던 문제 수정

### 영향받는 파일
- `src/backend/prisma/schema.prisma` - enum 레거시 값 추가
- `src/backend/prisma/seed.ts` - 레거시 템플릿 업데이트 로직
- `src/frontend/src/pages/admin/AdminVoteV2.tsx` - Layout 래핑

### 참고
- 배포 오류: `invalid input value for enum "PointTxReason_new": "VOTE_OPEN_FEE"`
- 레거시 enum 값은 기존 데이터 호환을 위해 삭제하면 안 됨
- 슬롯 템플릿은 slotInstances와 연결되어 있어 삭제 대신 업데이트 처리

---

## [2026-02-02] PortOne 본인인증 회원가입 연동

### 변경 사항
- **본인인증 필수 역할**: BRAND, ATHLETE, AGENCY (FAN은 선택)
- **Backend**
  - `certification.service.ts` 신규 생성 - PortOne API 연동, 인증 토큰 발급/검증
  - `auth.routes.ts`에 `/certification/verify`, `/certification/required` 엔드포인트 추가
  - `auth.service.ts` register()에 인증 토큰 검증 로직 추가
  - `config/index.ts`에 portone 환경변수 설정 추가
  - `prisma/schema.prisma` User 모델에 본인인증 필드 추가 (realName, phone, birthDate, certificationUniqueKey, certifiedAt)
- **Frontend**
  - `index.html`에 PortOne SDK 스크립트 추가
  - `useCertification.ts` 훅 신규 생성 - 본인인증 요청/결과 관리
  - `Register.tsx`에 본인인증 UI 추가 (역할별 조건부 표시)
  - `api.ts`에 verifyCertification, checkCertificationRequired 메서드 추가
  - `types/index.ts` RegisterData에 certificationToken 필드 추가

### 영향받는 파일
- `src/backend/src/services/certification.service.ts` (신규)
- `src/backend/src/services/auth.service.ts`
- `src/backend/src/controllers/auth.controller.ts`
- `src/backend/src/routes/auth.routes.ts`
- `src/backend/src/config/index.ts`
- `src/backend/src/types/index.ts`
- `src/backend/prisma/schema.prisma`
- `src/backend/.env.example`
- `src/frontend/index.html`
- `src/frontend/src/hooks/useCertification.ts` (신규)
- `src/frontend/src/pages/Register.tsx`
- `src/frontend/src/services/api.ts`
- `src/frontend/src/types/index.ts`
- `src/frontend/.env.example`

### 참고
- PortOne 테스트 환경에서는 실제 인증 없이 테스트 가능
- 프로덕션에서는 PG사(다날/KMC 등) 계약 필요
- CI(unique_key)로 중복 가입 방지
- 인증 토큰 유효기간: 10분 (환경변수로 조정 가능)

---

## [2026-02-02] PortOne → SMS 인증으로 변경

### 변경 사항
- **PortOne 본인인증 제거** → 간단한 SMS 인증번호 방식으로 변경
- **Backend**
  - `certification.service.ts` 전면 재작성 - SMS 인증번호 발송/검증
  - `auth.routes.ts` - `/sms/send`, `/sms/verify` 엔드포인트로 변경
  - `auth.controller.ts` - sendSmsCode, verifySmsCode 메서드 추가
  - `auth.service.ts` - SMS 인증 토큰 검증으로 단순화
- **Frontend**
  - `index.html` - PortOne SDK 제거
  - `useCertification.ts` - SMS 입력/검증 훅으로 재작성
  - `Register.tsx` - 전화번호 입력 + 인증번호 입력 UI로 변경
  - `api.ts` - sendSmsCode, verifySmsCode 메서드로 변경

### SMS 인증 플로우
```
1. 사용자가 휴대폰 번호 입력
2. "인증요청" 클릭 → 6자리 인증번호 발송 (개발환경: 콘솔 출력)
3. 인증번호 입력 (3분 유효, 5회 시도 제한)
4. "확인" 클릭 → certificationToken 발급 (10분 유효)
5. 회원가입 시 토큰 포함 → phone 필드에 저장
```

### 영향받는 파일
- `src/backend/src/services/certification.service.ts`
- `src/backend/src/controllers/auth.controller.ts`
- `src/backend/src/routes/auth.routes.ts`
- `src/backend/src/services/auth.service.ts`
- `src/frontend/index.html`
- `src/frontend/src/hooks/useCertification.ts`
- `src/frontend/src/pages/Register.tsx`
- `src/frontend/src/services/api.ts`

### 참고
- 개발 환경에서는 인증번호가 서버 콘솔에 출력됨
- 프로덕션에서는 알리고/NHN Cloud 등 SMS API 연동 필요
- PortOne 환경변수는 아직 config에 남아있음 (토큰 유효기간 설정용)

---

## [2026-02-05] ROI 파이프라인 로컬 스토리지 지원 + CLIP 로고 검출 완성

### 변경 사항
- VOD 인제스트: Cloudinary 없이 로컬 스토리지 폴백 추가
- 프레임 추출: 로컬 저장 지원 (uploads/frames/{vodId}/)
- 임베딩 서비스: sharp → jimp 변경 (Node v24 호환성)
- CLIP 임베딩: data URL → 임시 파일 방식으로 변경 (안정성)

### 성능 테스트 결과
| 단계 | 성능 |
|------|------|
| VOD 인제스트 | YouTube 13분 → 로컬 저장 |
| 프레임 추출 | 724프레임/22초 (1fps) |
| 로고 검출 | 3.6초/프레임 (CLIP 2단계) |

### 영향받는 파일
- `src/backend/src/services/vod.service.ts` - 로컬 저장 폴백
- `src/backend/src/services/frameExtract.service.ts` - 로컬 저장 지원
- `src/backend/src/services/embedding.service.ts` - sharp→jimp, 임시파일 방식

### 참고
- Windows에서 cross-drive 파일 이동 시 copyFile+unlink 사용 (EXDEV 에러 방지)
- Node v24에서 sharp 호환성 문제 있음 → jimp 사용
- 전체 VOD (724프레임) 로고 검출 예상 시간: 약 43분

---

*이 파일은 기록 전용입니다. 작업 시작 시 자동 로드하지 마세요.*

## [2026-02-09] ROI Phase 1 미구현 기능 완성

### 변경 사항
- **BE**: `roiReport.service.ts`에 `getSlotAnalytics()`, `getEventMetrics()` 메서드 추가
- **BE**: `roi.routes.ts`에 슬롯 분석/이벤트 메트릭/리포트 삭제/증빙 관리 API 5개 추가
- **FE**: `BrandSlotAnalytics.tsx` - 슬롯별 비교 차트 + 이벤트별 메트릭 테이블
- **FE**: `BrandROISettings.tsx` - 키워드/경쟁사/차단카테고리 관리
- **FE**: `AdminEvidenceManager.tsx` - 증빙 자료 조회/삭제 관리
- **FE**: `AdminReportTemplates.tsx` - 리포트 생성/조회/삭제
- **FE**: `AdminCampaignBuilder.tsx` - 4단계 ROI 캠페인 설정 위자드
- **FE**: `App.tsx` 라우팅 + `Layout.tsx` 네비게이션 메뉴 추가

### 영향받는 파일
- `src/backend/src/services/roiReport.service.ts`
- `src/backend/src/routes/roi.routes.ts`
- `src/frontend/src/pages/brand/BrandSlotAnalytics.tsx` (NEW)
- `src/frontend/src/pages/brand/BrandROISettings.tsx` (NEW)
- `src/frontend/src/pages/admin/AdminEvidenceManager.tsx` (NEW)
- `src/frontend/src/pages/admin/AdminReportTemplates.tsx` (NEW)
- `src/frontend/src/pages/admin/AdminCampaignBuilder.tsx` (NEW)
- `src/frontend/src/App.tsx`
- `src/frontend/src/components/Layout.tsx`

### 참고
- Backend commit: `aaa2c72`
- Frontend commit: `d6e6948`
- Phase 1 핸드오프 문서 대비 ~100% 구현 완료

## [2026-03-02] 투자·운영 회의자료 PPT 생성

### 변경 사항
- `docs/투자운영회의자료_slides.html` (신규) — 15슬라이드 HTML 투자 덱
  - PROJECT_STATE.md 기반 실제 개발 현황 표 (Done/Doing/To-Do)
  - 투자자 친화적 언어로 전면 재작성 (비즈니스 플랜 docx → 접근하기 쉬운 한국어)
  - Cover, Executive Summary, Problem, Solution, BizModel, Market, Fan Engine,
    Dev Status × 2, Tech Stack, Roadmap, Financials, Risk, Investment Ask, Closing
- `docs/capture_invest_slides.py` (신규) — Playwright 캡처 + python-pptx 조립 스크립트
- `docs/invest_images/` (신규) — 15슬라이드 PNG 캡처본 (1920×1080)
- `docs/스폰픽_투자운영회의자료_2026_PPT.pptx` (신규) — 최종 PPT 산출물

### 개발 현황 매핑 (PROJECT_STATE.md → PPT)
| 모듈 | 상태 |
|------|------|
| 회원·권한·인증 | ✅ 완료 |
| 선수·에이전시 시스템 | ✅ 완료 |
| 슬롯 인벤토리 (Phase 1/2) | ✅ 완료 |
| 경매 엔진 (Reserve/Auto-bid/Anti-sniping) | ✅ 완료 |
| 계약·크리에이티브 관리 | ✅ 완료 |
| 결제·정산·원장 (Toss+Stripe+에스크로) | ✅ 완료 |
| 팬 투표·포인트·시즌 | ✅ 완료 |
| 어드민·CS 콘솔 | ✅ 완료 |
| ROI 리포트 자동화 | 🔄 진행중 |
| 증빙팩 CV 자동화 | 🔄 진행중 |
| 본인인증 (PortOne) | 🔄 진행중 |
| UI/UX 리디자인 | 📋 예정 |
| 와디즈 운영지원 | 📋 예정 |

### 영향받는 파일
- `docs/투자운영회의자료_slides.html` (NEW)
- `docs/capture_invest_slides.py` (NEW)
- `docs/스폰픽_투자운영회의자료_2026_PPT.pptx` (NEW)

### 참고
- 투자자 지향 프레젠테이션 — 기존 사업계획서 docx를 기반으로 실제 개발 데이터 반영
- 15슬라이드 16:9 (1920×1080), 프리텐다드 폰트, 네이비/블루 컬러 스킴

---

## [2026-04-29] SPONPIK 론칭 보강 — 10개 미충족 항목 전부 구현

### 배경
SPONPIK 론칭 docx 1차 검수 결과 10개 누락 항목 식별 → 전부 보강.

### 1. Athlete 구조화 필드 (PDF → DB 분리)
- `athletes`에 `height`, `region`, `debut_year`, `affiliation`, `sport_type`, `sport_id` 추가
- bio 텍스트에만 있던 데이터를 정식 필드로 승격
- 5명 시드 재반영 (로컬 + Railway)

### 2. Event 운영 필드
- `events`에 `category`, `qualifying_date`, `display_order`, `is_active`, `active_days`, `sport_id` 추가
- 인덱스: `(is_active, display_order)`, `(sport_id, date_start)`

### 3. SlotInstance 표시 필드
- `slot_instances`에 `slot_name`, `slot_order`, `is_active` 추가
- SlotTemplate.name fallback 유지 (관리자 입력 시 우선)

### 4. Sport 모델 신규
- `sports` 테이블: code/name/parent_code/display_order/is_active
- 1차 활성: GOLF, SCREEN_GOLF
- 2차 비활성 시드: BASEBALL, SOCCER, VOLLEYBALL, BASKETBALL

### 5. 호가 리스트 (5단계 + 누적)
- `BidTierLadder` 컴포넌트 → SlotAuctionPanel에 통합
- 클릭 시 즉시 입찰 (BRAND 권한 + LIVE 상태에서만)

### 6. 관리자 대회 활성화 + N값 화면
- 신규: `/admin/tournament-activation` (`AdminTournamentActivation.tsx`)
- 인라인 편집: 카테고리 / 예선일 / N일 / 표시순서 / isActive 토글
- 신규 API: `PATCH /events/:id/activation`, `GET /events/admin/list`

### 7. 관리자 우선 정책 (3-7)
- `/events/active` 엔드포인트 갱신:
  1순위 `Event.activeDays` → 2순위 `?days=N` → 3순위 14일 기본
- `is_active=false` 대회는 공개 응답에서 제외
- `MANUAL` 입력은 `GTOUR_API` 자동 동기화 시 덮어쓰지 않음

### 8. Sport API
- 신규 라우트: `/api/sports` (공개), `/api/sports/admin/all`, `PATCH/POST` (ADMIN)

### 9. 납품 문서 4종
- `docs/delivery/01_DATA_MAPPING.md` — 외부↔DB↔화면 매핑표
- `docs/delivery/02_QA_REPORT.md` — 회귀 테스트 + 검수 결과
- `docs/delivery/03_OPERATIONS_GUIDE.md` — 일일 운영 체크리스트
- `docs/delivery/04_INTEGRATION_ISSUES.md` — 외부 연동 현황 + 우회책
- `docs/delivery/README.md` — 인덱스

### 10. UI 노출
- `/athletes` 카드: 신장 · 지역 · 데뷔 노출
- `/athletes/:id` Hero: 종목 배지 + 소속 배지 + 176cm · 성남시 · 2018년 데뷔

### 영향받는 파일 (요약)
- `src/backend/prisma/schema.prisma` — Athlete/Event/SlotInstance 확장 + Sport 신규
- `src/backend/prisma/seed-athletes.ts` — 구조화 필드 + Sport 시드
- `src/backend/src/routes/event.routes.ts` — 활성화 토글 + N값 우선 정책
- `src/backend/src/routes/sport.routes.ts` (NEW)
- `src/backend/src/routes/athlete.routes.ts` — public 응답에 신규 필드 포함
- `src/backend/src/routes/index.ts` — sport 라우트 등록
- `src/frontend/src/pages/PublicAthleteDetail.tsx` — Hero + BidTierLadder
- `src/frontend/src/pages/PublicAthletes.tsx` — 카드 신장/지역
- `src/frontend/src/pages/admin/AdminTournamentActivation.tsx` (NEW)
- `src/frontend/src/components/Layout.tsx` — 사이드바 entry
- `src/frontend/src/App.tsx` — 라우트
- `docs/delivery/*` (NEW × 5)

### 검증
- `npx prisma db push` — 로컬/Railway 모두 성공
- `npx prisma generate` — 클라이언트 갱신
- `cd src/backend && npm run build` — 0 error
- `cd src/frontend && npx tsc --noEmit` — 0 error
- 5명 선수 시드 재반영 (로컬 + Railway)

### 결론
SPONPIK 1차 론칭 가능. 영상 자동 분석은 Phase 후속(수동 입력 운영).

## [2026-06-05] 장정우 프로 선수 등록 (KPGA TOUR PRO)

### 변경 사항
- 장정우 프로(KPGA) 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 182cm · 1999.07.24생 · 분당그린피아골프연습장 소속 · 2021 KPGA 투어프로 수석합격
  - 2026 신한투자증권 GTOUR 2차 우승 / 2025 샤브올데이 GTOUR MIXED 2차 준우승
- 입상내역 8건 AthleteEventResult 등록 (MANUAL)
- 프로필 사진 추가 → 프론트엔드 main 푸시 (Vercel 배포)

### 영향받는 파일
- `src/backend/prisma/register-jang-jeongwoo.ts` (신규 등록 스크립트)
- `src/frontend/public/golfers/jang-jeongwoo.jpeg` (사진)

### 참고
- PDF 출처: TalkFile_장정우프로 프로필.pdf
- 운영 DB 선수 수: 20 → 21명

## [2026-06-05] 박현주 프로 선수 등록 (KLPGA 준회원 · GTOUR)

### 변경 사항
- 박현주 프로 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 1996.04.22생 · 경기 파주 운정신도시 · GTOUR 입회 2012 · 레슨 11년차 · 파주 청해골프 소속
  - SNS: 인스타 hyun._.juuuu / 유튜브 박푸로 / 틱톡 hjttgolf
  - 2017 롯데렌터카 WGTOUR 4차·CHAMPIONSHIP 우승 / 2017 GTOUR 상금랭킹 2위
- 입상내역 10건 AthleteEventResult 등록 (MANUAL)
- 프로필 사진 추가 → 프론트엔드 main 푸시 (Vercel 배포)
- ※ 연락처(개인 휴대폰)는 개인정보로 미등록

### 영향받는 파일
- `src/backend/prisma/register-park-hyunju.ts` (신규 등록 스크립트)
- `src/frontend/public/golfers/park-hyunju.jpg` (사진)

### 참고
- 출처: 박현주프로 프로필 이미지
- 운영 DB 선수 수: 21 → 22명

## [2026-06-05] 강채린 프로 선수 등록 (KLPGA 정회원 · WGTOUR 2026 루키)

### 변경 사항
- 강채린 프로 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 2001.03.20생 · 2022.06 KLPGA 정회원(회원번호 1530) · WGTOUR 2026 루키 · 중앙대 골프전공 수석 졸업
  - 계약/후원: 미즈노(2025)·브리지스톤(2024)·탱크샤프트(2022~) → primarySponsors 반영
  - 2026 WGTOUR 롯데렌터카 4차 29위 / 2022 점프투어 6차전 준우승·상금순위 5위
- 수상 이력 9건 AthleteEventResult 등록 (MANUAL)
- 프로필 사진(스윙 정면) 추가 → 프론트엔드 main 푸시 (Vercel 배포)

### 영향받는 파일
- `src/backend/prisma/register-kang-chaerin.ts` (신규 등록 스크립트)
- `src/frontend/public/golfers/kang-chaerin.png` (사진)

### 참고
- 출처: 강채린 프로필.pdf
- 운영 DB 선수 수: 22 → 23명

## [2026-06-09] 박은수(Taena Park) 프로 선수 등록 (KLPGA 정회원 · CLPGA 차이나투어)

### 변경 사항
- 박은수 프로 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 168cm · 1989.06.01생 · 2015.10 KLPGA 정회원(회원번호 1092) · 비거리 230m · 제주 출신 · Artisan Golf 소속
  - 협찬: 1879와인·조아제약·플렉스파워 → primarySponsors 반영
  - 2016 WGTOUR 루키상 / CLPGA 차이나투어(2013~2018) / 호주 골프유학 5년
- 입상내역 8건 AthleteEventResult 등록 (MANUAL)
- 프로필 사진(전신) 추가 → 프론트엔드 main 푸시 (Vercel 배포)

### 영향받는 파일
- `src/backend/prisma/register-park-eunsoo.ts` (신규 등록 스크립트)
- `src/frontend/public/golfers/park-eunsoo.jpg` (사진)

### 참고
- 출처: 뉴)박은수 프로필-1-1.pdf
- 운영 DB 선수 수: 23 → 24명

## [2026-06-09] 중복 선수 계정 통합 + 자가가입 계정 발견

### 변경 사항
- 박현주·강채린 중복 레코드 통합 (운영 DB 24명 → 22명)
  - 선수 본인 실제 이메일 계정(KEEP)에 사진·프로필·입상내역 이전 후 sponpik 중복 계정(DROP) 삭제
  - 박현주: eee4330@naver.com 유지 (입상 10건 이전)
  - 강채린: happycl001@naver.com 유지, 기존 height 163cm 보존 (입상 9건 이전)
- 원인: 두 선수가 **본인이 직접 가입**해둔 계정이 이미 있었으나, 이름 중복 확인 없이 새 sponpik 계정으로 등록 → 중복 발생

### 발견 (중요)
- 위한이·박종원·서관훈·요코야마미즈카·최서영·김다훈·강채린·박현주 = **선수 자가가입 실계정**
  - 근거: 개인 이메일(naver/gmail), 생성일 제각각(일괄 아님), bcrypt 비번, KYC 대부분 NOT_SUBMITTED
  - 대조: 관리자 시드 계정은 `*@sponpik.com` + KYC APPROVED 패턴
- **운영 규칙 추가**: 선수 등록 전 반드시 이름으로 기존(자가가입) 계정 존재 여부 확인 → 중복 방지

### 영향받는 파일
- `src/backend/prisma/merge-duplicates.ts` (통합 스크립트)

### 참고
- 자가가입 6명(위한이 등)은 사진·프로필 미입력(KYC 미완) 상태 — 자료 확보 시 보강 예정

## [2026-06-10] 문준혁(Jun Hyuk Moon) 프로 선수 등록 (KPGA 코리안투어 1부)

### 변경 사항
- 문준혁 프로 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 182cm · 1996.03.05생 · 제주 출신 · 경희대 골프산업학과 · 2016 KPGA 선발 수석 · 스릭슨 협찬
  - 2016 챌린지투어 우승 / 2023 스릭슨투어 우승 / 2026 KPGA 1부 활동 / JGTO Q-School 4위
- 입상내역 9건 AthleteEventResult 등록 (docx 수상경력 + KPGA 공식 시즌기록 통합)
- 프로필 사진 추가 → 프론트엔드 main 푸시 (Vercel 배포)

### KPGA 공식기록 연동 (memberId 00042826)
- KPGA API(api.kpga.co.kr/player/seasonRecord) 직접 호출로 시즌별 성적 반영
  - 2016 상금랭킹 11위·포인트랭킹 4위, 2023 상금랭킹 26위·TOP10 1회, 2024 12경기·TOP10 1회, 2026 상금랭킹 42위
- 참고: /player/gameResult(개별 대회) 엔드포인트는 빈 배열 반환 → 시즌 요약으로 대체

### 영향받는 파일
- `src/backend/prisma/register-moon-junhyuk.ts` (신규 등록 스크립트)
- `src/frontend/public/golfers/moon-junhyuk.jpg` (사진)

### 참고
- 출처: 문준혁 프로 프로필 요약.docx + KPGA 공식기록
- 운영 DB 선수 수: 22 → 23명

## [2026-06-10] 안준혁 프로 선수 등록 (2025 프로 입회 · NZ 주니어 대표 출신)

### 변경 사항
- 안준혁 프로 운영 DB(Railway) 등록: User(ATHLETE) + Athlete 프로필 upsert
  - 1999.02.25생 · 2025 프로 입회 · 뉴질랜드 캔터베리/크라이스트처치 주니어 대표 출신
  - Russley U18 2013·2014 우승, Terrace Down U16 우승, 2014 Christchurch Int'l 준우승
- 입상내역 9건 AthleteEventResult 등록 (NZ 주니어 아마추어)
- ※ 연락처(개인 휴대폰)는 개인정보로 미등록
- ⚠️ 사진(ahn-junhyuk.jpg) 파일 미확보 → profileImageUrl 경로만 설정, 추후 사진 추가+푸시 필요

### 영향받는 파일
- `src/backend/prisma/register-ahn-junhyuk.ts` (신규 등록 스크립트)

### 참고
- 출처: 안준혁 프로필 이미지
- 운영 DB 선수 수: 23 → 24명

## [2026-06-10] 안준혁 프로 사진 추가 + 스폰서 반영 (후속)
- 사진 ahn-junhyuk.jpg (E:\안준혁.jpg) → 3:4 상반신 크롭(1200×1600) 후 프론트엔드 main 푸시
- 스폰서 '서인이앤씨'(사진 패치 확인) → primarySponsors + bio 반영, 운영 DB 갱신
- 영향: `src/frontend/public/golfers/ahn-junhyuk.jpg`, `src/backend/prisma/register-ahn-junhyuk.ts`

## [2026-06-10] 김진아2 프로 선수 등록 (KLPGA 정회원 · 2025 루키)

### 변경 사항
- 김진아2 프로 운영 DB(Railway) 등록 (KLPGA 등록명 '김진아2', 동명이인 구분)
  - 2007년생 · 172cm · 2025.08 KLPGA 정회원(회원번호 01737) · 2025 프로 데뷔 루키
  - KLPGA 2025 드림투어 6개 대회(최고 T18, 컷통과 3) → AthleteEventResult 6건(score 포함)
- 프로필 사진(3:4 상반신) 추가 → 프론트엔드 main 푸시

### 영향받는 파일
- `src/backend/prisma/register-kim-jina.ts`
- `src/frontend/public/golfers/kim-jina.jpg`

### 참고
- 출처: 김진아2 프로필 카드 + KLPGA 2025 드림투어 성적표
- 운영 DB 선수 수: 24 → 25명

## [2026-06-10] 정윤경 프로 선수 등록 (KLPGA 정회원 · 드림투어 · 2025 루키)

### 변경 사항
- 정윤경 프로 운영 DB(Railway) 등록
  - 2006.07.21생 · 162cm · 2025.09 KLPGA 정회원(회원번호 01745) · 드림투어 활동
  - 2025 KLPGA 점프투어 15차전 우승 + 주니어/아마추어 성적 → AthleteEventResult 7건
- 프로필 사진(3:4 상반신) 추가 → 프론트엔드 main 푸시
- ※ 연락처/이메일(개인정보)는 미등록

### 영향받는 파일
- `src/backend/prisma/register-jeong-yunkyung.ts`
- `src/frontend/public/golfers/jeong-yunkyung.jpg`

### 참고
- 출처: 정윤경 후원 제안용 선수 프로필
- 운영 DB 선수 수: 25 → 26명

## [2026-06-10] 김은채·최우영 신규 등록 + 김다훈 통합

### 변경 사항
- 김은채(KIM EUN CHAE) 신규 등록: 2001년생 · 2019 KLPGA 정회원(01351) · 수원 · 광교 카카오프렌즈 소속 · 2026 WGTOUR · 루베로(LUVERO) 후원 / 입상 6건. 사진은 지원서 PDF 임베드 이미지 추출.
- 최우영(Wooyoung Choi) 신규 등록: KPGA 투어프로 · 미국 톨레도대 졸업/한체대 대학원 · NCAA Mountain West 단체전 우승 / 입상 5건. 인스타 heyimwy_cc_7, 유튜브 우영프로.
- 김다훈: 기존 자가가입 계정(dhk7422@naver.com)에 통합 — KPGA 투어프로, 2017 JTBC 파운더스컵 우승, GTOUR 활동중 / 입상 5건. (신규 계정 X)
- 사진 3종 3:4 상반신 크롭 후 프론트엔드 main 푸시
- ※ 연락처/개인 이메일은 미등록

### 영향받는 파일
- `src/backend/prisma/register-kim-eunchae.ts`, `register-choi-wooyoung.ts`, `register-kim-dahoon.ts`
- `src/frontend/public/golfers/kim-eunchae.jpg`, `kim-dahoon.jpg`, `choi-wooyoung.jpg`

### 참고
- 운영 DB 선수 수: 26 → 28명 (김은채·최우영 신규 2명, 김다훈은 기존 계정 통합)

## [2026-06-10] 이정우 프로 선수 등록 (KPGA · 대전) + 김진아2 수정
- 이정우(KPGA 투어프로) 신규 등록: 공주대 교육대학원 석사·중등 정교사(체육)·대전체육고 출신·대전 / 입상 2건(대전시장배 준우승, KPGA 프론티어투어 4위). ※ 대회 연도 미상→추정(확인 필요)
  - `src/backend/prisma/register-lee-jungwoo.ts`, `src/frontend/public/golfers/lee-jungwoo.jpg`
- 김진아2 수정: 점프투어 10차전 T2·12차전 T6, 2026 정규투어 시드순위전 본선 추가 + 메인 스폰서 미즈노 (입상 6→9건)
- 운영 DB 선수 수: 28 → 29명

## [2026-06-10] 최서영 프로 통합 (자가가입 계정)
- 최서영: 기존 자가가입 계정(tjdud0213@naver.com)에 통합 — KLPGA 정회원·홍익대 산업스포츠학과 / 입상 5건(2021 호반 드림투어 3위, 2020 솔라고 점프투어 9차전 준우승, KYGA 볼빅배 국제대회 우승 등). 사진 3:4 크롭 후 main 푸시.
  - tour WGTOUR→KLPGA, kyc APPROVED. KYGA/경인일보 연도 추정(확인 필요). 전 소속(노랑통닭/골프앤요트/Callaway)·연락처는 미반영.
  - `src/backend/prisma/register-choi-seoyoung.ts`, `src/frontend/public/golfers/choi-seoyoung.jpg`
- 운영 DB 선수 수: 29명 유지 (최서영은 기존 계정 통합)

## [2026-06-10] 브랜드 후원 문의 → 카카오톡 채널 연결 (수동 매칭 1차)

### 변경 사항
- 전역 플로팅 "브랜드 후원 문의" 버튼 + 팝업 추가 (모든 페이지)
- 카카오톡 채널(스폰픽 비즈니스) 1:1 채팅 URL 연결
  - 환경변수 `VITE_KAKAO_CHANNEL_ID=_xxxxx` 설정 시 `pf.kakao.com/_xxxxx/chat` 연결
  - 미설정 시 support@sponpik.com 이메일 폴백
- 목적: 선수슬롯-브랜드 자동매칭 도입 전, 수동 연결(상담) 채널 확보. 인스타 바이오에도 동일 채널 링크 사용 가능.

### 영향받는 파일
- `src/frontend/src/components/BrandInquiryButton.tsx` (신규)
- `src/frontend/src/App.tsx` (전역 마운트)

### 운영자 설정 필요 (TODO)
1. 카카오톡 채널 개설 → 채널 공개 ID(_xxxxx) 확보
2. Vercel 환경변수 `VITE_KAKAO_CHANNEL_ID` 등록 후 재배포

## [2026-06-10] 카카오 채널 연결 완료
- 스폰픽 카카오 채널 개설(_xmpxknX) → BrandInquiryButton 기본값에 반영(공개 ID, 하드코딩 안전)
- 채팅 URL https://pf.kakao.com/_xmpxknX/chat (HTTP 200 확인)
- 인스타 바이오/링크트리에 동일 링크 사용 가능
- TODO(운영자): 채널 관리자센터에서 채팅 사용 ON, 팀원은 관리자 초대로 각자 계정 운영

## [2026-06-12] 황지현·이하민 프로 선수 등록 (KLPGA)
- 황지현(KLPGA 정회원 2022.05·부산·단국대 골프전공): 2022 점프투어 상금랭킹 6위 등 입상 7건. 유튜브 '공치는 명훈이'·'골신골덕' 출연.
- 이하민(KLPGA 준회원·점프투어/WGTOUR 활동): 2019 FUTURE CHAMPIONS 우승, 2017 SCPGA Hansen Dam 3위, 2023 솔라고 점프투어 12차전 8위 / 입상 4건.
- 사진 2종 3:4 크롭 후 main 푸시. 연락처/개인 이메일 미반영.
- `register-hwang-jihyun.ts`, `register-lee-hamin.ts`, `public/golfers/hwang-jihyun.jpg`, `lee-hamin.jpg`
- 운영 DB 선수 수: 24(active) → 26명

## [2026-06-12] 요코야마 미즈카 통합 + 김하림 신규 등록 (KLPGA)
- 요코야마 미즈카: 자가가입 계정(hyj5299@naver.com)에 통합. PDF 이력서(전주예술고·원광대 경영학과·전북 익산·프로번호 01576·SNS골프스튜디오 소속·2026 WGTOUR) 반영, 입상 7건. tour WGTOUR→KLPGA, 이름 '요코야마미즈카'→'요코야마 미즈카'.
- 김하림: 신규 등록. KLPGA 정회원·중앙대 골프전공·2025 KCGF 전국대학 선수권 개인전 우승 등 입상 4건. (※ 사용자 확인: PDF는 요코야마 것, 인라인 불릿은 김하림 것)
- 사진 2종 3:4 크롭 후 main 푸시. 연락처/개인 이메일 미반영.
- `register-yokoyama-mizuka.ts`, `register-kim-harim.ts`, `public/golfers/yokoyama-mizuka.jpg`, `kim-harim.jpg`
- 운영 DB 선수 수: 26 → 27명 (요코야마는 기존 계정 통합, 김하림 신규)

## [2026-06-12] 메인 페이지 모바일 히어로 UI 개편
- 모바일 히어로를 디자인 시안에 맞게 개편: 4줄 헤드라인(당신의 브랜드 민트 강조) + SPONPIK FOUNDER PRO NO1/배진리 프로/Bae Jinri(스크립트) HTML 텍스트 + 골퍼 누끼(우측) + 장식 점 6개
- 누끼: bae-jinri-cutout.png의 박힌 텍스트 제거 → bae-jinri-hero.png 신규(모바일 전용)
- 데스크톱(lg+)은 기존 3컬럼(텍스트/누끼/경매카드) 유지. 모바일/데스크톱 분기는 CSS 반응형(lg:hidden / hidden lg:block)
- 검증: TS 통과, mobile(375)·desktop(1280) DOM 검증 통과, 콘솔 에러 0
- 영향: `src/frontend/src/pages/Home.tsx`, `src/frontend/public/golfers/bae-jinri-hero.png`

## [2026-06-17] 선수 프로필 구조화 — 소속/학력/수상/경력 분리
- 기존 `bio` 줄글 한 덩어리를 항목별 구조로 분리: 소속(affiliation, 기존) + 학력/수상/경력(신규 3필드)
- 공개 선수 상세 상단 프로필을 라벨 구조(소속/학력/수상/경력)로 렌더. 4필드 모두 비면 기존 bio 줄글 폴백(하위호환). 사진 좌상단 tour 배지(예: KPGA) 오버레이 추가, 중복되던 affiliation 배지는 제거
- 관리자 빠른 편집 패널에 학력/수상/경력 textarea 추가(각 500자), 표시 영역에도 3행 추가
- 스키마: Athlete에 `education`/`awards`/`career` nullable TEXT 추가. 마이그레이션 `20260617_add_athlete_profile_sections`
- 백엔드 반영: `/athletes/public/:id` select, `/athletes/admin/:id` PATCH(검증 500자), `athlete.service.update`(self-edit), `/admin/entities/athletes/:id` select
- 검증: Prisma generate OK, backend tsc --noEmit exit 0, frontend tsc 통과
- ⚠️ 운영 DB 마이그레이션 미적용(배포 시 `prisma migrate deploy`). 기존 선수는 데이터 입력 전까지 bio 폴백
- 영향: `prisma/schema.prisma`, `prisma/migrations/20260617_add_athlete_profile_sections/migration.sql`, `src/routes/athlete.routes.ts`, `src/routes/admin.entities.routes.ts`, `src/services/athlete.service.ts`, `src/frontend/src/pages/PublicAthleteDetail.tsx`, `src/frontend/src/pages/admin/AdminEntityDetail.tsx`

## [2026-07-27] 선수화면 개편 1번 항목 — 엑셀 프로필 반영 + 3컬럼 상단 UI + 온도/가중치
- 엑셀 27개(선수 프로필 엑셀/) 일괄 파싱 → Athlete 확장필드 9종 추가(birthDate/birthplace/weight/tourQualification/activityFields/highlights/snsStats/sponsorSlots/sizes), 운영 26명 업데이트 + 김시윤 신규(위한이·홍지우는 기존 계정 재사용)
- 스폰픽 온도: 기본 30℃ 시작, 팬 관심등록·브랜드 계약·투표 개설/참여·구매/도네이션 반영, 최대 100℃ (커뮤니티 지수는 모델 미구현으로 0 — 구현 시 반영)
- 선수성과 점수 최신성 가중치: 1년내 100%/1-2년 90%/2-3년 80%/3-5년 70%/5년+ 50%
- 선수 상세 상단 3컬럼 개편: 좌(사진·온도카드[비로그인 잠금]·버튼3) / 중(기본정보·활동분야 6타일·이력/성적 테이블) / 우(Sponpik Index 오각 레이더[비로그인 잠금]·SNS 채널)
- 검증: 백/프론트 tsc 통과, 로컬 브라우저 DOM 12항목 전부 통과, 콘솔 에러 0
- sponsorSlots/sizes는 4번 항목(9월 대회 슬롯 경매)용으로 저장만 해둠
- 영향: `prisma/schema.prisma`, `prisma/ingest-excel-profiles.ts`, `prisma/data/athletes-excel-2026-07.json`, `src/routes/athlete.routes.ts`, `src/frontend/src/pages/PublicAthleteDetail.tsx`

## [2026-07-27] 선수화면 개편 2번 항목 — 추천/신규 선수 노출 + 개명/신규 등록
- 개명: 이서윤→이서윤3, 김다훈→김다훈2, 김수아→김수아2 (KLPGA 동명이인 구분)
- 김시윤 사진 등록(신규), 홍지우 사진(프로필 PDF에서 추출·정리) + KYC 승인 → 공개 노출
- Athlete.isRecommended/recommendOrder 추가. 추천 9명 지정: 배진리·김수아2·염돈웅·이성훈·장정우·장연주·이용희·강채린·홍지우(추천+신규 겸)
- 선수목록: 추천 캐러셀 = 지정 선수만, 신규 등록 선수 섹션(가입 60일 이내·최신순), 카드에 반짝(animate-pulse) ✨추천/NEW 뱃지
- 메인: 히어로~슬롯 사이 '스폰픽 추천선수 및 신규등록선수' — 좌(추천)/우(신규) 3명씩 4.5초 자동 롤링
- 검증: 양쪽 tsc 통과, 로컬 브라우저 메인/목록 DOM 체크 전부 통과, 콘솔 에러 0
- 영향: `prisma/apply-item2-changes.ts`, `src/routes/athlete.routes.ts`, `src/frontend/src/pages/PublicAthletes.tsx`, `Home.tsx`
