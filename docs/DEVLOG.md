# DEVLOG - 개발 기록

> 이 파일은 작업 완료 시 append만 합니다. 자동 로드하지 마세요.
> 500줄 초과 시 `docs/archive/DEVLOG-YYYY-MM.md`로 이동합니다.

---

## 아카이브
- [DEVLOG-2026-05.md](archive/DEVLOG-2026-05.md) — 9개 엔트리
- [DEVLOG-2026-04.md](archive/DEVLOG-2026-04.md) — 16개 엔트리
- [DEVLOG-2026-03.md](archive/DEVLOG-2026-03.md) — 1개 엔트리
- [DEVLOG-2026-02.md](archive/DEVLOG-2026-02.md) — 6개 엔트리
- [DEVLOG-2026-01.md](archive/DEVLOG-2026-01.md) — 43개 엔트리
- [DEVLOG-2025-01.md](archive/DEVLOG-2025-01.md) — 14개 엔트리

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## [2026-06-10] 안준혁 프로 사진 추가 + 스폰서 반영 (후속)
- 사진 ahn-junhyuk.jpg (E:\안준혁.jpg) → 3:4 상반신 크롭(1200×1600) 후 프론트엔드 main 푸시
- 스폰서 '서인이앤씨'(사진 패치 확인) → primarySponsors + bio 반영, 운영 DB 갱신
- 영향: `src/frontend/public/golfers/ahn-junhyuk.jpg`, `src/backend/prisma/register-ahn-junhyuk.ts`

---

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

---

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

---

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

---

## [2026-06-10] 이정우 프로 선수 등록 (KPGA · 대전) + 김진아2 수정
- 이정우(KPGA 투어프로) 신규 등록: 공주대 교육대학원 석사·중등 정교사(체육)·대전체육고 출신·대전 / 입상 2건(대전시장배 준우승, KPGA 프론티어투어 4위). ※ 대회 연도 미상→추정(확인 필요)
  - `src/backend/prisma/register-lee-jungwoo.ts`, `src/frontend/public/golfers/lee-jungwoo.jpg`
- 김진아2 수정: 점프투어 10차전 T2·12차전 T6, 2026 정규투어 시드순위전 본선 추가 + 메인 스폰서 미즈노 (입상 6→9건)
- 운영 DB 선수 수: 28 → 29명

---

## [2026-06-10] 최서영 프로 통합 (자가가입 계정)
- 최서영: 기존 자가가입 계정(tjdud0213@naver.com)에 통합 — KLPGA 정회원·홍익대 산업스포츠학과 / 입상 5건(2021 호반 드림투어 3위, 2020 솔라고 점프투어 9차전 준우승, KYGA 볼빅배 국제대회 우승 등). 사진 3:4 크롭 후 main 푸시.
  - tour WGTOUR→KLPGA, kyc APPROVED. KYGA/경인일보 연도 추정(확인 필요). 전 소속(노랑통닭/골프앤요트/Callaway)·연락처는 미반영.
  - `src/backend/prisma/register-choi-seoyoung.ts`, `src/frontend/public/golfers/choi-seoyoung.jpg`
- 운영 DB 선수 수: 29명 유지 (최서영은 기존 계정 통합)

---

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

---

## [2026-06-10] 카카오 채널 연결 완료
- 스폰픽 카카오 채널 개설(_xmpxknX) → BrandInquiryButton 기본값에 반영(공개 ID, 하드코딩 안전)
- 채팅 URL https://pf.kakao.com/_xmpxknX/chat (HTTP 200 확인)
- 인스타 바이오/링크트리에 동일 링크 사용 가능
- TODO(운영자): 채널 관리자센터에서 채팅 사용 ON, 팀원은 관리자 초대로 각자 계정 운영

---

## [2026-06-12] 황지현·이하민 프로 선수 등록 (KLPGA)
- 황지현(KLPGA 정회원 2022.05·부산·단국대 골프전공): 2022 점프투어 상금랭킹 6위 등 입상 7건. 유튜브 '공치는 명훈이'·'골신골덕' 출연.
- 이하민(KLPGA 준회원·점프투어/WGTOUR 활동): 2019 FUTURE CHAMPIONS 우승, 2017 SCPGA Hansen Dam 3위, 2023 솔라고 점프투어 12차전 8위 / 입상 4건.
- 사진 2종 3:4 크롭 후 main 푸시. 연락처/개인 이메일 미반영.
- `register-hwang-jihyun.ts`, `register-lee-hamin.ts`, `public/golfers/hwang-jihyun.jpg`, `lee-hamin.jpg`
- 운영 DB 선수 수: 24(active) → 26명

---

## [2026-06-12] 요코야마 미즈카 통합 + 김하림 신규 등록 (KLPGA)
- 요코야마 미즈카: 자가가입 계정(hyj5299@naver.com)에 통합. PDF 이력서(전주예술고·원광대 경영학과·전북 익산·프로번호 01576·SNS골프스튜디오 소속·2026 WGTOUR) 반영, 입상 7건. tour WGTOUR→KLPGA, 이름 '요코야마미즈카'→'요코야마 미즈카'.
- 김하림: 신규 등록. KLPGA 정회원·중앙대 골프전공·2025 KCGF 전국대학 선수권 개인전 우승 등 입상 4건. (※ 사용자 확인: PDF는 요코야마 것, 인라인 불릿은 김하림 것)
- 사진 2종 3:4 크롭 후 main 푸시. 연락처/개인 이메일 미반영.
- `register-yokoyama-mizuka.ts`, `register-kim-harim.ts`, `public/golfers/yokoyama-mizuka.jpg`, `kim-harim.jpg`
- 운영 DB 선수 수: 26 → 27명 (요코야마는 기존 계정 통합, 김하림 신규)

---

## [2026-06-12] 메인 페이지 모바일 히어로 UI 개편
- 모바일 히어로를 디자인 시안에 맞게 개편: 4줄 헤드라인(당신의 브랜드 민트 강조) + SPONPIK FOUNDER PRO NO1/배진리 프로/Bae Jinri(스크립트) HTML 텍스트 + 골퍼 누끼(우측) + 장식 점 6개
- 누끼: bae-jinri-cutout.png의 박힌 텍스트 제거 → bae-jinri-hero.png 신규(모바일 전용)
- 데스크톱(lg+)은 기존 3컬럼(텍스트/누끼/경매카드) 유지. 모바일/데스크톱 분기는 CSS 반응형(lg:hidden / hidden lg:block)
- 검증: TS 통과, mobile(375)·desktop(1280) DOM 검증 통과, 콘솔 에러 0
- 영향: `src/frontend/src/pages/Home.tsx`, `src/frontend/public/golfers/bae-jinri-hero.png`

---

## [2026-06-17] 선수 프로필 구조화 — 소속/학력/수상/경력 분리
- 기존 `bio` 줄글 한 덩어리를 항목별 구조로 분리: 소속(affiliation, 기존) + 학력/수상/경력(신규 3필드)
- 공개 선수 상세 상단 프로필을 라벨 구조(소속/학력/수상/경력)로 렌더. 4필드 모두 비면 기존 bio 줄글 폴백(하위호환). 사진 좌상단 tour 배지(예: KPGA) 오버레이 추가, 중복되던 affiliation 배지는 제거
- 관리자 빠른 편집 패널에 학력/수상/경력 textarea 추가(각 500자), 표시 영역에도 3행 추가
- 스키마: Athlete에 `education`/`awards`/`career` nullable TEXT 추가. 마이그레이션 `20260617_add_athlete_profile_sections`
- 백엔드 반영: `/athletes/public/:id` select, `/athletes/admin/:id` PATCH(검증 500자), `athlete.service.update`(self-edit), `/admin/entities/athletes/:id` select
- 검증: Prisma generate OK, backend tsc --noEmit exit 0, frontend tsc 통과
- ⚠️ 운영 DB 마이그레이션 미적용(배포 시 `prisma migrate deploy`). 기존 선수는 데이터 입력 전까지 bio 폴백
- 영향: `prisma/schema.prisma`, `prisma/migrations/20260617_add_athlete_profile_sections/migration.sql`, `src/routes/athlete.routes.ts`, `src/routes/admin.entities.routes.ts`, `src/services/athlete.service.ts`, `src/frontend/src/pages/PublicAthleteDetail.tsx`, `src/frontend/src/pages/admin/AdminEntityDetail.tsx`

---

## [2026-07-27] 선수화면 개편 1번 항목 — 엑셀 프로필 반영 + 3컬럼 상단 UI + 온도/가중치
- 엑셀 27개(선수 프로필 엑셀/) 일괄 파싱 → Athlete 확장필드 9종 추가(birthDate/birthplace/weight/tourQualification/activityFields/highlights/snsStats/sponsorSlots/sizes), 운영 26명 업데이트 + 김시윤 신규(위한이·홍지우는 기존 계정 재사용)
- 스폰픽 온도: 기본 30℃ 시작, 팬 관심등록·브랜드 계약·투표 개설/참여·구매/도네이션 반영, 최대 100℃ (커뮤니티 지수는 모델 미구현으로 0 — 구현 시 반영)
- 선수성과 점수 최신성 가중치: 1년내 100%/1-2년 90%/2-3년 80%/3-5년 70%/5년+ 50%
- 선수 상세 상단 3컬럼 개편: 좌(사진·온도카드[비로그인 잠금]·버튼3) / 중(기본정보·활동분야 6타일·이력/성적 테이블) / 우(Sponpik Index 오각 레이더[비로그인 잠금]·SNS 채널)
- 검증: 백/프론트 tsc 통과, 로컬 브라우저 DOM 12항목 전부 통과, 콘솔 에러 0
- sponsorSlots/sizes는 4번 항목(9월 대회 슬롯 경매)용으로 저장만 해둠
- 영향: `prisma/schema.prisma`, `prisma/ingest-excel-profiles.ts`, `prisma/data/athletes-excel-2026-07.json`, `src/routes/athlete.routes.ts`, `src/frontend/src/pages/PublicAthleteDetail.tsx`

---

## [2026-07-27] 선수화면 개편 2번 항목 — 추천/신규 선수 노출 + 개명/신규 등록
- 개명: 이서윤→이서윤3, 김다훈→김다훈2, 김수아→김수아2 (KLPGA 동명이인 구분)
- 김시윤 사진 등록(신규), 홍지우 사진(프로필 PDF에서 추출·정리) + KYC 승인 → 공개 노출
- Athlete.isRecommended/recommendOrder 추가. 추천 9명 지정: 배진리·김수아2·염돈웅·이성훈·장정우·장연주·이용희·강채린·홍지우(추천+신규 겸)
- 선수목록: 추천 캐러셀 = 지정 선수만, 신규 등록 선수 섹션(가입 60일 이내·최신순), 카드에 반짝(animate-pulse) ✨추천/NEW 뱃지
- 메인: 히어로~슬롯 사이 '스폰픽 추천선수 및 신규등록선수' — 좌(추천)/우(신규) 3명씩 4.5초 자동 롤링
- 검증: 양쪽 tsc 통과, 로컬 브라우저 메인/목록 DOM 체크 전부 통과, 콘솔 에러 0
- 영향: `prisma/apply-item2-changes.ts`, `src/routes/athlete.routes.ts`, `src/frontend/src/pages/PublicAthletes.tsx`, `Home.tsx`

---

## [2026-07-28] 선수화면 개편 4번 항목 — 슬롯 명세 v2.0 + 9월 대회 슬롯 오픈
- 슬롯 패치 명세서 v2.0 개정본 반영: 템플릿 17개 upsert (사이즈·재질·등급·기준단가·UI카피). 신규 SHOULDER_LINE_L/R(어깨라인·쇄골, A+ ₩900,000), enum(BodyPart·SlotGrade) 확장
- 9월 대회 생성: "2026 신한투자증권 GTOUR 7차" (9/12, 이름·날짜는 가칭 — 관리자에서 수정 가능)
- 엑셀 sponsorSlots(Y) 기준 26명 슬롯 347개 오픈:
  · 모자정면(CAP_FRONT) 21건 = 경매 LIVE (시작가 ₩2,500,000 · 최소단위 ₩100,000 · 9/9 18시 마감)
  · 나머지 326건 = 직접판매 (enableDirectBuy, 명세 기준단가)
  · 염돈웅(엑셀 슬롯 미표기)·모자뒷면(양식에 없음)은 미생성
- ⚠️ 사고/복구: Render 빌드의 prisma db push --accept-data-loss가 enum 순서 불일치(schema 중간삽입 vs DB 끝추가)로 SHOULDER_LINE 템플릿·슬롯 48건 삭제 → schema enum 순서를 DB와 정렬, render.yaml에서 --accept-data-loss 제거, 데이터 재생성으로 복구 완료
- 규칙: 앞으로 enum 새 값은 반드시 schema 맨 끝에 추가할 것
- 검증: 운영 API 김영민 16슬롯(어깨라인 A+ 포함)·LIVE 경매 21건·총 347 확인

---

## [2026-07-28] 전면 개편 착수 — Phase 0(법적 정비) + UI-01(메인 히어로)
- 재설계 PDF 3종(핸드오프/와이어프레임/우선순위표) 접수. Phase 0~6 로드맵 확정, 메모리(2026-07-full-redesign) 기록
- 메인 히어로: 카피 "선수를 선택하고, 후원방식을 고르고, 바로 시작하세요." / CTA [후원 가능한 선수 찾기][브랜드로 시작하기]+보조 2종 / 경매 둘러보기 메인 버튼 제거 / 통합 검색바
- LEG-06: 하드코딩 실적 수치(1,250+/3,400+/180+) 제거 → GET /athletes/public-stats 실데이터 (0이면 숨김)
- LEG-04/05: LegalNotice 면책문구 컴포넌트 → 선수상세·경매상세·주문확인 고정 노출
- CTA 표준화(§2.4): 즉시구매→'바로 구매' 전 화면 통일, 선수목록 페이지명 '후원 가능한 선수 찾기'
- LEG-01/03: 9월 판매 이벤트명 중립화 ("2026 신한투자증권 GTOUR 7차"→"2026년 9월 출전 경기 (단일 출전)")
- 다음 단계: Phase 1 데이터·인벤토리(SlotInventory 기간재고·SponsorshipProduct·업종충돌·중복판매) → Phase 2 선수상세 통합 구매화면(3열)

---

## [2026-07-28] 전면 개편 Phase 1 — 슬롯 인벤토리·후원상품 데이터 기반 (DATA-01~10)
- 신규 모델 4종 + enum 5종: AthleteSlot(선수×템플릿 판매설정) / SlotInventory(기간별 재고 = 중복판매 방지 단일 진실) / SponsorshipProduct(기간형 상품, 6/12개월 경매금지) / ProductSlot. 기존 SlotInstance와 slotInstanceId로 브릿지
- SlotTemplate.displayX/Y (Phase 2 착장 도식 좌표) 추가. 마이그레이션 `20260728_phase1_inventory` 운영·로컬 적용 (멱등 SQL)
- inventory.service.ts: GET /athletes/public/:id/inventory (기간별 상태, HELD 만료 lazy 복구), assertNoSlotConflict(§19.1 기간겹침 차단)
- buy-now에 기간겹침 검사 통합 + 동기화 훅(구매→HELD / 계약서명→SOLD / 계약취소→AVAILABLE). 업종충돌·대회규칙은 기존 conflictService/phase2UnlockService 재사용 확인
- 백필 backfill-phase1-inventory.ts (재실행 안전): AthleteSlot 347 / SlotInventory 347 / Product 47 / ProductSlot 347 (엑셀 sponsorSlots·9월 슬롯 기준. 단, 중복 이벤트 정리 전까지 인벤토리 694 — 정리 스크립트가 중복분 347 함께 삭제)
- 🔧 발견·복구: 지난 enum 사고 때 SHOULDER_LINE_L/R 템플릿 미복원 상태였음 → update-slot-templates-v2.ts 재실행(17개) + 9월 어깨 슬롯 48건 생성 (총 347)
- ⚠️ 사고1: open-sep-event-slots.ts가 Phase 0에서 중립화된 이벤트명("2026년 9월 출전 경기 (단일 출전)")을 옛 명칭으로 조회 → 중복 이벤트+슬롯 347+경매 21 생성. 스크립트 이벤트명 수정 + cleanup-duplicate-sep-event.ts로 삭제 완료 (입찰·계약 0건)
- 🔴 사고2 근본원인 규명: **어깨라인 슬롯 48건 2회 소실의 진짜 원인은 enum이 아니라 `prisma/seed.ts`였음.**
  seed.ts의 slotTemplates 목록(15개)에 SHOULDER_LINE_L/R이 없어 배포 시 seed가 이를 "legacy 템플릿"으로 판단 →
  연결된 슬롯 인스턴스·경매·입찰·계약을 삭제 → 템플릿 삭제는 athlete_slots FK에 막혀 실패하고 catch로 무시 → 인스턴스만 소실
  - 수정: seed.ts에 SHOULDER_LINE_L/R(A+ ₩900,000) 추가 + legacy 정리 로직을 "사용 중이면 경고만, 삭제 금지"로 안전화 (운영 데이터 삭제 코드 제거)
  - 교훈: 슬롯 템플릿을 추가할 때는 반드시 `prisma/seed.ts`의 slotTemplates 목록에도 함께 추가할 것
- 고아 인벤토리(삭제된 slotInstance 참조) 96건 정리 — `prisma/repair-orphan-inventory.ts` (계약·판매완료 행은 보존)
- 영향: `prisma/schema.prisma`, `prisma/migrations/20260728_phase1_inventory/`, `prisma/backfill-phase1-inventory.ts`, `prisma/cleanup-duplicate-sep-event.ts`, `src/services/inventory.service.ts`, `slot.service.ts`, `contract.service.ts`, `src/routes/athlete.routes.ts`

---

## [2026-07-29] 전면 개편 Phase 2 — 선수 상세 통합 구매화면 (WF-04/05)
- 데스크톱 3열 구성: 좌 선수정보 요약(섹션 앵커) / 중 슬롯 인벤토리(착장 도식) / 우 후원상품 구성 패널
- `SlotDiagram`: 표준 착장 실루엣 SVG + slotTemplate.displayX/Y(%) 좌표 마커, 상태별 색상(구매가능/경매중/예약중/판매완료) + 범례
- `SlotDetailDrawer`(WF-05): 페이지 이탈 없이 권장크기·계약기간·거래방식·가격·등급·제한사항·대체 슬롯 확인 후 즉시 선택
- 구매 패널 5단계(기간 → 상품유형 → 슬롯 → 추가활동 → 가격) — 선택 결과가 패널·모바일 하단바에 실시간 반영
- CTA 표준화(§2.4): 경매=입찰하기(경매 상세 이동) / 직접구매=바로 구매(계약 생성) / 협의=파트너십 제안(카카오 상담)
- 모바일 1열 + 하단 고정 구매바(슬롯·기간·금액·CTA), 페이지 하단 pb-24로 가림 방지
- 가격 표시: 우선순위표 §14 가격정책(부가세·플랫폼 이용료) 미확정 상태이므로 **표시 금액 = 실제 결제 금액**으로 고정,
  추가활동은 협의 항목으로 금액 미포함 (§15 "가격과 실제 결제금액이 다르게 계산되는 경우" 중단기준 준수)
- 재고 없는 기간(30일/6개월/12개월)은 §24 빈화면 — [다른 기간 보기] [장기 파트너십 제안]
- 기존 경매 호가창은 하단 '슬롯별 경매 현황' 섹션으로 유지
- 백필 보강: 엑셀 sponsorSlots가 없어도 열려 있는 슬롯 인스턴스로부터 AthleteSlot 생성 (운영은 이미 347건 전량 매핑되어 변화 없음)
- 검증: 양쪽 tsc 통과 / 로컬 브라우저 — 3열(220·508·320px), 마커 좌표 정확, 슬롯 선택→패널·하단바 반영, 경매 슬롯 CTA '입찰하기', 기간 변경 빈화면, 드로어 개폐, 모바일 375px 가로 오버플로 0
- 영향: `src/components/purchase/{UnifiedPurchase,SlotDiagram,SlotDetailDrawer}.tsx`, `src/pages/PublicAthleteDetail.tsx`, `src/services/api.ts`, `prisma/backfill-phase1-inventory.ts`

---

## [2026-07-29] 전면 개편 Phase 3 — 직접구매 임시예약·주문확인 (BUY-01~06)
- **임시예약(§13.2)**: 브랜드가 구매를 시작하면 슬롯을 15분간 HELD로 점유. `SlotInventory.heldByBrandId` 추가
  - `inventory.service`: hold(연장 포함) / release / getHold / assertPurchasableBy / expireHolds
  - 다른 브랜드의 유효한 예약이 있으면 예약·바로구매 모두 차단 (§25 '슬롯 선점' 오류)
  - 매분 cron으로 만료 예약 자동 해제 (계약이 걸린 행은 제외)
- **구매 가능조건(BUY-01, §13.1)**: `assertDirectBuyEligible`로 예약과 구매가 동일 검증을 공유
  (슬롯 활성·선수 활성/KYC·대회 활성·판매상태·직접구매 활성·가격·업종충돌·대회규칙)
- **주문확인 화면(BUY-04, §13.3)**: `/checkout/slots/:slotId` — 선수/기간/슬롯/제공항목/추가활동/초상·콘텐츠 사용권/
  대체이행/금액/결제방법/계약당사자/환불기준 + 면책문구 + 동의 체크 후 계약 생성
- **예약 타이머(BUY-03)**: mm:ss 카운트다운, 만료·예약불가 상태를 구분해 표시하고 [다시 예약] 제공
- **견적 API(BUY-05/06)**: `GET /slots/instances/:id/quote` — 가격정책(§14) 확정 전이므로 플랫폼 이용료·부가세를
  '포함'으로 표기해 표시 금액 = 실제 결제 금액 유지 (§15 중단기준)
- 통합 구매화면의 '바로 구매'는 이제 즉시 계약이 아니라 예약 → 주문확인 경로로 연결
- 검증: 서비스 레벨 8개 시나리오 통과(예약/타브랜드 차단/구매검증 차단/연장/해제/만료 sweep/만료 후 재예약),
  브라우저 — 카운트다운 14:52 동작, DB HELD 기록 확인, 동의 후 CTA 활성화, 취소 시 AVAILABLE 복귀
- 🔧 `prisma/apply-sql.ts` 헬퍼 추가(psql 없이 마이그레이션 적용). 초기 버전이 `--` 주석으로 시작하는 문장을
  통째로 건너뛰어 ALTER TABLE이 누락되던 버그를 발견·수정
- 미착수(외부 의존): BUY-07~10 전자서명·PG 결제 연동(외부 솔루션 계약 필요) — 현재는 기존 지갑·에스크로 경로 사용
- 영향: `src/services/inventory.service.ts`, `slot.service.ts`, `src/routes/slot.routes.ts`, `src/index.ts`,
  `prisma/schema.prisma`, `prisma/migrations/20260729_slot_hold/`, `src/frontend/src/pages/SlotCheckout.tsx`, `App.tsx`, `api.ts`

---

## [2026-07-29] 전면 개편 Phase 4 — 경매 엔진 (AUC-12/13/15 + 자동입찰 결함 수정)
- 🔴 **자동입찰 과금 결함 수정 (§12.3)**: 단독 입찰 시 `processAutoBidCompetition`이 현재가를 곧바로
  입찰자의 최대입찰가로 올려, 첫 입찰자가 상한 전액을 지불하고 현재가만 봐도 상한이 노출됐다.
  이제 단독 입찰자는 '이기는 데 필요한 최소 금액'(시작가)만 지불하며, 상한은 경쟁이 붙을 때만 단계적으로 소진된다.
- **AUC-12 (§12.5) 즉시구매 병행조건**: 첫 유효입찰 이후 바로 구매 종료. 관리자 예외용 `Auction.allowBuyNowAfterBid` 추가.
  예약(hold)·구매 양쪽이 쓰는 `assertDirectBuyEligible`에 통합되어 예약 단계에서 이미 차단된다.
- **AUC-15 알림**: 최고입찰자 변경(추월) 알림이 정의만 되어 있고 호출되지 않던 것을 실제 발송 연결.
  자동입찰 상한 초과 알림 신규 추가. 경매 종료 24시간/1시간 전 알림 cron(5분 주기, 중복 발송 방지).
- **AUC-13**: 경매 종료 시 SlotInventory 동기화 (낙찰 → HELD, 유찰 → AVAILABLE)
- **§12.5**: 6·12개월 상품 경매 금지를 DB CHECK 제약으로 고정 (상품 API가 생겨도 우회 불가)
- **프론트 입찰 모달(§12.2)**: 다음 최소 입찰가·입찰 수 표시, 자동입찰 설명(입력값=최대 한도, 한도 비공개),
  마감 임박 자동연장·철회 불가 안내, 계약조건 동의 체크 전 입찰 불가
- 기존 구현 확인: 자동입찰 경쟁 로직·서버시간 기준 종료(cron)·소프트클로즈 연장·실시간 소켓은 이미 동작 중
- 검증(서비스 레벨): 단독입찰 시 시작가 유지 / B 600만 입찰 → 610만으로 A 자동방어 / B 900만 → 810만으로 역전 /
  첫 입찰 전 즉시구매 가능 → 입찰 후 차단 → 관리자 예외 시 허용 / 추월·상한초과 알림 발송 / 마감 1분 전 입찰 +120초 연장
  브라우저: 다음 최소 입찰가 ₩8,200,000, 입찰 수 2회, 동의 전 버튼 비활성 → 동의 후 활성
- 🔧 `apply-sql.ts`: 달러 인용($$) 블록 안의 세미콜론에서 문장이 잘리던 버그 수정
- 영향: `src/services/bid.service.ts`, `auction.service.ts`, `notification.service.ts`, `slot.service.ts`,
  `src/index.ts`, `prisma/schema.prisma`, `prisma/migrations/20260729_auction_buynow_flag/`,
  `src/frontend/src/pages/AuctionDetail.tsx`

---

## [2026-07-29] 전면 개편 Phase 5 — 장기 파트너십 제안 (PROP-01~08)
- **모델**: `Proposal` + `ProposalHistory`. 6·12개월만 허용을 DB CHECK 제약으로 고정
  (경매가 금지된 기간이라 제안이 유일한 계약 경로)
- **상태머신(§14.2)** 11단계: DRAFT → SUBMITTED → ADMIN_REVIEW → ATHLETE_REVIEW → APPROVED → CONTRACTING → CONTRACTED
  (+ REVISION_REQUESTED / BRAND_REVISING / REJECTED / EXPIRED)
  - 허용 전이표와 전이 주체를 서버에서 강제 — 단계 건너뛰기·브랜드의 자기 제안 승인 등을 차단
- **입력항목(§14.1)**: 기간·희망슬롯(우선순위)·대체 허용·최소 출전·SNS/매장/행사/촬영·이미지 사용범위와 기간·
  2차편집·유료광고·업종 독점·총 예산·분할결제·요청사항
- **변경 이력(§14.3)**: 모든 상태 전이와 내용 수정을 필드 단위 before/after로 기록
- **PROP-07**: 제출 후 14일 내 검토가 끝나지 않으면 자동 만료 (매시 cron)
- **알림**: 선수 검토 전달 / 승인 / 거절 / 수정 요청 / 계약 완료 시 당사자에게 발송
- **화면(WF-10)**: 제안 작성 5단계 + 하단 고정(임시저장·미리보기·제출),
  목록/상세는 역할별로 브랜드(보낸 제안)·선수(받은 제안)·관리자(검토)를 한 화면에서 처리.
  상세에 상태 배지·검토 기한·진행 이력·면책문구 노출, 역할에 맞는 버튼만 표시
- 통합 구매화면의 '장기 파트너십 제안하기' 버튼을 실제 제안 폼으로 연결 (브랜드 외에는 카카오 상담)
- 검증(서비스 9종): 단일출전 차단 / 역순 기간 차단 / 생성·수정·제출 / 비정상 전이 차단 /
  브랜드의 자기 승인 차단 / 선수 승인 → 계약 진행 / 이력 7건 + 예산 변경 스냅샷 / 만료 처리
  브라우저: 5단계 폼 렌더 → 기간·예산 입력 → 제출 → 목록에 '관리자 검토'로 표시 → 상세·이력·기한 확인
- 미착수(외부 의존): 승인 후 실제 계약서 생성은 계약서 양식 확정 전이라 CONTRACTING 상태까지만 처리.
  분할결제(PROP-09)는 결제정책 확정 필요
- 영향: `prisma/schema.prisma`, `prisma/migrations/20260729_proposal/`, `src/services/proposal.service.ts`,
  `src/routes/proposal.routes.ts`, `src/index.ts`, `src/frontend/src/pages/{ProposalNew,Proposals}.tsx`, `App.tsx`, `api.ts`

---

## [2026-07-29] 전면 개편 Phase 6 — 이행·증빙 (OPS-01~08, REP-01)
- **모델**: `Deliverable`(계약·제안의 활동 약속을 항목 단위로) + `DeliverableEvidence`(항목당 증빙 다건)
  - 기존 `Verification`은 계약당 1건 구조라 항목별 추적이 불가능했음 → 별도 모델로 해결
- **자동 생성(OPS-01/03)**: 제안이 승인되면 약속한 활동(착장·출전·SNS 피드/스토리/릴스·매장·행사·촬영)을
  이행 항목으로 펼치고 계약 종료일을 기한으로 설정. 재실행해도 중복 생성되지 않음
- **증빙 검수(OPS-04/05/06)**: 선수가 항목마다 증빙 제출 → 관리자가 건별 승인·반려 →
  **승인된 건만** 이행 횟수 증가. 반려 시 재제출 가능하고, 검수 대기 증빙이 남아 있으면 상태를 유지
- **대체이행(OPS-07/08, §26.3)**: 차기 이월·동일 등급 슬롯 변경·SNS 콘텐츠 대체·부분/전액 환불을
  선수 또는 브랜드가 요청 → 관리자 승인 시 SUBSTITUTED로 갈음
- **현황 요약(REP-01)**: 검증 완료 / 검수 대기 / 대체이행 / 기한 경과를 분리 집계.
  **진행률은 검수 완료분만 반영**하고 그 사실을 화면에 명시 (LEG-06 미검증 수치 구분)
- **알림**: 증빙 제출·대체이행 요청 시 관리자에게, 승인·반려 결과는 선수에게. 기한 경과 항목은 매일 오전 10시 알림
- **화면**: `/deliverables` 하나로 역할별 처리 — 선수(증빙 등록·대체이행 요청) / 관리자(건별 승인·반려·대체 승인) /
  브랜드(진행 현황). 항목별 증빙 목록·반려 사유·기한 경과 배지 표시
- 검증(서비스 9종): 승인 시 6건 자동 생성 / 재생성 방지 / 제출→반려→재제출→승인 / 목표 달성 시 APPROVED /
  타인 항목 증빙 차단 / 대체이행 요청·승인 / 요약 집계(목표 9·검증 2·검수대기 1·대체 1·진행률 22%)
  브라우저: 선수 화면 6항목·증빙 등록 버튼 → 제출 시 검증 0/9·검수대기 1·진행률 0% (미검증이 진행률에 반영되지 않음 확인)
  → 관리자 화면에서 승인 → 검증 1/9·진행률 11%로 반영
- 미착수(외부 의존): 증빙 파일 업로드는 현재 URL 입력 방식(파일 스토리지 연동 시 교체),
  REP-02~05(SNS 성과 자동연동·PDF 내보내기·재계약 추천)는 외부 API·데이터 정책 확정 필요
- 영향: `prisma/schema.prisma`, `prisma/migrations/20260729_deliverable/`, `src/services/deliverable.service.ts`,
  `src/routes/deliverable.routes.ts`, `src/services/proposal.service.ts`, `src/index.ts`,
  `src/frontend/src/pages/Deliverables.tsx`, `App.tsx`, `api.ts`

---

## [2026-07-29] 투표 UI 개편 (메인 "진행 중인 투표" + /votes 목록)

### 변경 사항
- **집계 실값 노출(백엔드)**: `voteV2.service.ts`의 `list()`가 선택지별 득표수(`optionTally`)를 함께 반환.
  참여 기록의 `answer.optionId`(또는 `choice`/`value`)를 집계하며, 참여가 없으면 빈 객체 → 화면은 0%로 표시
  (LEG-06 — 임의 수치 노출 금지)
- **메인 섹션 재구성**: `HomeVoteSection.tsx` 신설로 기존 인라인 마크업 대체.
  필터(전체/진행중/마감임박/결과보기), 카드별 상태 배지·D-day·참여자 수·선택지별 비율 막대,
  정산 완료 건은 1위 선택지와 총 표수 카드, 우측 "투표는 어떻게 진행되나요?" 안내 카드, 하단 모니터링 고지
- **/votes 목록 개편**: 2열 카드 그리드 + 우측 고정 안내 사이드바(4단계 진행 절차 + 자주 묻는 질문).
  카드에 유형 배지(Yes/No·다지선다 등)·상태 배지·참여자·마감·선택지 수·선택지 칩·예상 보상 EP·
  상태별 액션(투표 참여/결과 보기/정산 보기) 표시. 키보드 접근(Enter/Space) 추가
- 마감 24시간 이내는 "마감임박"으로 구분해 색상(amber)과 필터를 분리

### 검증
- 로컬에 임시 투표 3건(OPEN 2·SETTLED 1, 참여 6명) 생성해 메인/목록 렌더 확인 후 삭제
  - 메인: 마감임박·진행중·결과보기 배지, 비율 33.3/33.3/16.7/16.7% 정상
  - 목록: 유형·상태 배지, 액션 버튼(투표 참여/정산 보기), 사이드바 4단계 정상
- 프로덕션 `/api/votes` 확인 — 진행 중 투표 2건 존재(참여 0명)이므로 배포 후 메인 섹션 노출됨
- backend/frontend `tsc --noEmit` 통과

### 영향받는 파일
- `src/backend/src/services/voteV2.service.ts`
- `src/frontend/src/components/HomeVoteSection.tsx` (신규)
- `src/frontend/src/pages/Home.tsx`
- `src/frontend/src/pages/fan/VoteV2List.tsx`

---

## [2026-07-29] 전 페이지 브레드크럼(현재 위치 표시) 적용

### 변경 사항
- `components/Breadcrumb.tsx` 신설 — 경로에서 자동으로 "홈 > 상위 > 현재" 표시를 만든다.
  - `PATH_LABELS`에 라우트별 한글 이름 정의(공개/브랜드/선수/팬/에이전시/관리자 전 영역)
  - UUID·숫자 ID 조각은 표시하지 않고, 페이지가 `useBreadcrumbTitle(name)`으로 지정한 이름
    (없으면 '상세')으로 대체 — 예: `/athletes/<uuid>` → 홈 > 선수 찾기 > 김프로
  - 라벨 조회는 ID를 제외한 경로 기준. `/seasons/123/leaderboard` → 홈 > 시즌 > 리더보드
  - 실제 라우트가 없는 묶음 경로(`/brand`, `/admin/roi` 등)는 링크가 아닌 글자로만 표시
  - 우측에 '뒤로' 버튼. 히스토리가 없으면(직접 링크 진입) 상위 경로로 이동
  - 최상위 화면(`/`, `/dashboard`, `/admin`, `/fan`, `/agency`, 로그인/회원가입)에서는 숨김
  - 컬러 헤더 위에 얹을 때는 `tone="onDark"`
- `Layout.tsx`에 `BreadcrumbProvider` + `<Breadcrumb />` 삽입 → **Layout을 쓰는 112개 페이지에 자동 적용**
- Layout을 쓰지 않는 페이지 11곳에 개별 삽입:
  Contact·Faq·Guide·Privacy·Terms(기존 "홈으로 돌아가기" 링크를 대체),
  PublicAthletes(컬러 헤더, onDark)·PublicAthleteDetail(선수명 포함)·Deliverables·Proposals·ProposalNew·SlotCheckout
- `AuctionDetail`의 자체 경로 표시는 제거하고 전역 브레드크럼 + `useBreadcrumbTitle(슬롯명)`으로 통일
- SlotCheckout의 '돌아가기' 버튼은 임시예약(hold) 해제 로직이 있어 그대로 유지

### 검증
- 브라우저: `/auctions`, `/athletes`, `/votes`, `/guide`, `/faq`, `/terms`, `/inventory`(사이드바 레이아웃) 정상 표시
- `/athletes/<uuid>` → "홈 > 선수 찾기 > 김프로" (UUID가 선수명으로 대체됨)
- `buildTrail` 직접 호출로 깊은 경로 9종 확인 — 관리자 재무 5단계·엔티티 상세·캠페인 증빙 등 모두 한글 라벨
- `tsc --noEmit` 및 프로덕션 빌드 통과

### 영향받는 파일
- `src/frontend/src/components/Breadcrumb.tsx` (신규)
- `src/frontend/src/components/Layout.tsx`
- `src/frontend/src/pages/AuctionDetail.tsx`, `Contact.tsx`, `Faq.tsx`, `Guide.tsx`, `Privacy.tsx`, `Terms.tsx`,
  `PublicAthletes.tsx`, `PublicAthleteDetail.tsx`, `Deliverables.tsx`, `Proposals.tsx`, `ProposalNew.tsx`, `SlotCheckout.tsx`

---

## [2026-07-29] 공개 페이지 공용 상단 메뉴바 적용

### 배경
메인의 메뉴(라이브 경매/투표/선수/이용방법)로 들어간 화면에는 메뉴바가 없어
다른 메뉴로 이동하거나 빠져나가기 어려웠다.

### 변경 사항
- `components/PublicHeader.tsx` 신설 — 메인에 인라인으로 있던 상단 메뉴를 공용 컴포넌트로 분리.
  로고·메뉴 4종(LIVE 뱃지 포함)·로그인/시작하기·모바일 햄버거 메뉴 포함.
  현재 보고 있는 메뉴는 배경으로 강조(`aria-current="page"`)
  - `fixed` prop: 메인·마케팅 페이지처럼 히어로 위에 겹치는 경우 (기본은 `sticky`)
- `Layout.tsx`의 비로그인 헤더(로고+로그인/시작하기만 있던 것)를 `PublicHeader`로 교체
  → Layout을 쓰는 페이지는 **로그아웃 상태에서 모두 동일한 메뉴바** 사용
- Layout을 쓰지 않는 페이지 14곳에 직접 삽입:
  PublicAthletes·PublicAthleteDetail·Guide·Faq·Terms·Privacy·Contact·Deliverables·Proposals·ProposalNew·SlotCheckout,
  그리고 자체 메뉴(기능/이용방법/대상)를 갖고 있던 Features·ForWho·HowItWorks는 기존 nav를 대체
- Features·ForWho·HowItWorks에는 브레드크럼도 추가하고 히어로 상단 여백을 `pt-32` → `pt-6`으로 조정
  (고정 헤더 아래 브레드크럼 줄이 들어가면서 여백이 중복되므로)

### 검증
- 로그아웃 상태로 11개 공개 경로 순회 — 모든 화면에 메뉴바 노출,
  `/auctions` `/votes` `/athletes` `/how-it-works`에서 해당 메뉴가 활성 표시됨
- `/how-it-works` `/for-who` `/features` 브레드크럼 추가 확인, 본문이 고정 헤더에 가리지 않음(h1 top 202 > nav 65)
- 메인 레이아웃 회귀 없음 — 히어로 시작 위치·라이브 경매 현황판 좌우 정렬(오차 0px) 유지
- `tsc --noEmit` 및 프로덕션 빌드 통과

### 영향받는 파일
- `src/frontend/src/components/PublicHeader.tsx` (신규)
- `src/frontend/src/components/Layout.tsx`, `src/frontend/src/pages/Home.tsx`
- `Features.tsx`, `ForWho.tsx`, `HowItWorks.tsx`, `Guide.tsx`, `Faq.tsx`, `Terms.tsx`, `Privacy.tsx`, `Contact.tsx`,
  `PublicAthletes.tsx`, `PublicAthleteDetail.tsx`, `Deliverables.tsx`, `Proposals.tsx`, `ProposalNew.tsx`, `SlotCheckout.tsx`

---

## [2026-07-29] 스폰서십 슬롯 전체 목록 페이지 신설 (/slots)

### 배경
메인 "진행중인 스폰서십 슬롯"의 전체보기가 라이브 경매 목록(`/auctions`)으로 가서
바로구매·협의 슬롯은 볼 수 없었다.

### 변경 사항
- `pages/SponsorshipSlots.tsx` 신설 (`/slots`) — 경매·바로구매·협의 슬롯을 한 화면에서 비교
  - 상단: 제목·설명 + "스폰서십 슬롯 유형 안내" 카드(라이브 경매/직접 구매/계약 가능 설명)
  - 요약 지표 5종: 전체 슬롯 수 · 라이브 경매 수 · 바로 구매 가능 · 계약 가능 수 · 마감 임박
  - 유형 탭(전체/라이브 경매/직접 구매/계약 가능/마감 임박) + 상세 필터
    (선수명 검색 · 슬롯 위치 · 종목/투어 · 상품 유형(모자/상의/하의) · 성별 · 가격대 · 정렬 · 초기화)
  - 카드 3열 그리드: 유형 배지, 선수별 슬롯 수, 선수 사진·이름·투어, 대표 슬롯명,
    유형별 가격 라벨(경매 시작가/바로 구매가/협의 시작가), 남은 시간, 상세 보기
  - 페이지네이션 12개 단위 (1 … 4 [5] 6 … 36 형태)
  - 필터 선택지는 실제 데이터에 존재하는 값만 노출. 성별은 선수 데이터에 필드가 없어 투어로 유추
    (KPGA→남자, KLPGA·WGTOUR·LPGA→여자)
- 메뉴바(`PublicHeader`)에 "스폰서십 슬롯" 추가 — 라이브 경매 다음 자리
- 메인 "전체보기" 링크를 `/auctions` → `/slots`로 변경
- 브레드크럼 라벨에 `/slots` 추가

### 함께 고친 것
- **목록 API 파라미터 이름 오류**: 경매/슬롯 목록은 `pageSize`가 아니라 `limit`을 받는다.
  메인의 `getAuctions({ pageSize: 30 })`은 무시되어 기본 20건에서 잘리고 있었다 → `limit: 100`으로 수정.
  새 페이지는 두 API 모두 `pagination.totalPages`를 보고 끝까지 순회한다(슬롯 총 337건 > 페이지당 200건)
- 경매용 슬롯인데 진행 중인 경매가 없는 건은 아직 구매할 수 없는 예정 물량이므로 목록에서 제외
  (메인 캐러셀과 동일 규칙 — 이를 넣으면 "라이브 경매" 배지에 남은 시간이 없는 카드가 생김)

### 검증
- 로컬: 유형 탭 5종·정렬(가격 높은순 상위 8,100,000 → 8,000,000)·페이지 이동 동작 확인,
  카드의 배지/가격 라벨/하단 문구가 유형별로 일치
- 프로덕션 API 실측 — 슬롯 337건·라이브 경매 20건 전량 수집 확인
  (화면 예상: 전체 337 / 라이브경매 20 / 바로구매 317 / 계약가능 0 / 마감임박 0)
- `tsc --noEmit` 및 프로덕션 빌드 통과

### 영향받는 파일
- `src/frontend/src/pages/SponsorshipSlots.tsx` (신규)
- `src/frontend/src/App.tsx`, `src/components/PublicHeader.tsx`, `src/components/Breadcrumb.tsx`, `src/pages/Home.tsx`

---

## [2026-08-05] 성장마켓(프로 × 브랜드) 시안 기준 UI 재구성

### 변경 사항
- 팬스토어 카드 가로형 재구성 (메인: 텍스트 좌/사진 우 + 하단 상품 스트립, /growth-market: 사진 좌/정보 중/썸네일 우)
- 선수 사진 브랜드 패치 합성 제거 (원본 사용), 배진리 투명 PNG 흰 배경 flatten, 염돈웅 워터마크 크롭
- 호이베이커리 가로형 워드마크 로고 추가 (`brands/hoi-bakery-wordmark.png`)
- 시안 기준 전시용 상품 9종 (정가/판매가) — API 실상품 등록 시 자동 우선, 전시용은 구매 동선 없음

### 영향받는 파일
- `src/frontend/src/pages/GrowthMarket.tsx`, `src/data/growthMarket.ts`, `src/components/HomeGrowthMarket.tsx`
- `src/frontend/public/growth-market/*`, `public/brands/hoi-bakery-wordmark.png`

---

## [2026-08-05] OREX 팬스토어 4개 화면 신설 (시안 기준)

### 변경 사항
- `/fan-store/orex` 스토어 메인 (히어로 + 필터 + 랭킹 상품 그리드 8종)
- `/fan-store/orex/:productId` 상품 상세 (할인코드 복사, 팬포인트 조회, 결제방법, 예상 적립)
- `/fan-store/orex/ar` 선수 AR 보기 (photoar.elgrim.kr 링크 2종), `/ar/download` 이미지 다운로드
- 성장마켓 OREX 카드/인기상품 → 팬스토어로 연결. 구매·장바구니는 "오픈 준비 중" 안내(전시용)

### 영향받는 파일
- `src/frontend/src/data/orexStore.ts` (신규), `src/pages/store/FanStoreOrex*.tsx` (신규 3)
- `src/frontend/src/App.tsx`, `src/components/Breadcrumb.tsx`, `src/data/growthMarket.ts`, `src/pages/GrowthMarket.tsx`

---

## [2026-08-05] the GUYS 팬스토어 4개 화면 신설 (시안 기준)

### 변경 사항
- `/fan-store/the-guys` 메인 (그린 히어로 + 내 혜택 패널 + 협업 일정 + 상품 6종 + 구매 안내)
- `/fan-store/the-guys/:productId` 상세 (팬 할인가·사이즈·적립 1%·선수 응원 3% 타일·해시태그)
- `/fan-store/the-guys/ar` AR 뷰어 (촬영=이미지 저장, 공유/코드 복사 실동작)
- `/fan-store/the-guys/ar/download` AR 이미지팩 — 정사각/스토리/월페이퍼 3종 실파일 생성
  (`public/growth-market/ar/`), PNG·MP4는 준비중 표시
- 성장마켓 the GUYS 카드/인기상품 연결. 구매·장바구니는 "오픈 준비 중"(전시용)

### 영향받는 파일
- `src/frontend/src/data/guysStore.ts` (신규), `src/pages/store/FanStoreGuys*.tsx` (신규 3)
- `src/frontend/src/App.tsx`, `src/components/Breadcrumb.tsx`, `src/data/growthMarket.ts`

---

## [2026-08-06] 호이베이커리 팬스토어 5개 화면 신설 (시안 기준)

### 변경 사항
- `/fan-store/hoi-bakery` 메인 (히어로 + 나의 팬포인트 패널 + 상품 6종 + 구매 안내)
- `/fan-store/hoi-bakery/products` 전체 목록 (카테고리·가격·배송 유형 필터, 상품 8종)
- `/fan-store/hoi-bakery/:productId` 상세 (팬 코드 HOIFAN10 할인액, 구매 보호 문구)
- `/fan-store/hoi-bakery/ar` + `/ar/download` — AR 이미지 3종 실파일 생성·다운로드
- 성장마켓 호이 카드 연결 (OREX·the GUYS·호이 세 스토어 모두 오픈)
- 상품명 정정: 마카롱&마들렌 → 피낭시에&마들렌 (시안 확인). 구매·장바구니는 "오픈 준비 중"(전시용)

### 영향받는 파일
- `src/frontend/src/data/hoiStore.ts` (신규), `src/pages/store/FanStoreHoi*.tsx` (신규 4)
- `src/frontend/src/App.tsx`, `src/components/Breadcrumb.tsx`, `src/data/growthMarket.ts`
- `src/frontend/public/growth-market/ar/bae-jinri-*.jpg` (신규 3)

---

## [2026-08-06] 박은수 프로 대회 성적 추가 (운영 DB)

### 변경 사항
- 2026 제주삼다수 마스터스 — 1·2라운드 합계 +18, 124위 (KLPGA 정규투어, totalRounds 2)
- 관리자 API(`POST /athletes/:id/event-results`)로 운영 DB 직접 등록, 공개 API 노출 확인

### 참고
- 코드 변경 없음 (데이터만). eventDate는 2026-08-02로 기재

---

## [2026-08-10] AI 간편 매칭 신설 (핸드오프 v1.0 P0)

### 변경 사항
- Backend: `ai_match_requests` 테이블 + 규칙 기반 추천 엔진(`aiMatch.service.ts`) + API 3종
  - Hard Filter(판매 가능 슬롯·예산·SNS·경매 가용) → 가중치 점수(§3.2) → 패키지(§5.1 예산 배분) → reason code(§13.1)
  - 선호 선수 +5 보너스/탈락 사유 표기, 데이터 신뢰도 별도 표기, 추천 스냅샷 저장(재현성)
- Frontend: 4개 화면(입력/결과/비교/제안) + GNB 'AI 간편 매칭' + 브레드크럼
  - AC-01(필수 미완료 CTA 비활성), AC-04(score·confidence·reason·기준일), AC-06(비교 3명), AC-08(360px) 충족
  - 제안서 인쇄(print), 상담 요청(/contact 연결), 바로 계약(선수 상세 ?slot=CODE 딥링크)
- 임의 수치 금지: 예상 노출 등 미표기, 실측값만 사용
- vite proxy 타깃 env화(VITE_PROXY_TARGET) — 로컬에서 운영 API 검증용

### 영향받는 파일
- `src/backend/prisma/schema.prisma`, `prisma/migrations/20260810_ai_match/`, `src/services/aiMatch.service.ts`, `src/routes/aiMatch.routes.ts`, `src/routes/index.ts`
- `src/frontend/src/pages/aimatch/*` (신규 4), `src/App.tsx`, `src/components/PublicHeader.tsx`, `src/components/Breadcrumb.tsx`, `src/services/api.ts`, `vite.config.ts`

---

## [2026-08-10] 신한투자증권 GTOUR 6차 대회 성적 5건 추가 (운영 DB)

### 변경 사항
- 2026 신한투자증권 GTOUR 6차 대회 (2026-08-08, GTOUR 정규투어, 1·2라운드):
  염돈웅 공동 2위 -16 · 이성훈 공동 2위 -16 · 이용희 공동 14위 -13 · 금동호 공동 24위 -10 · 장정우 공동 39위 -7
- 관리자 API로 등록, 중복 확인 후 삽입, 공개 API 노출 확인. 코드 변경 없음

---

## [2026-08-10] 롯데렌터카 WGTOUR 6차 대회 성적 5건 추가 (운영 DB)

### 변경 사항
- 2026 롯데렌터카 WGTOUR 6차 대회 (2026-08-09, WGTOUR 정규투어, 1·2라운드):
  배진리 공동 9위 -12 · 강채린 공동 14위 -11 · 장연주 공동 21위 -10 · 김수아2 공동 29위 -8 · 홍지우 공동 29위 -8
- 관리자 API로 등록, 중복 확인 후 삽입, 공개 API 노출 확인. 코드 변경 없음

---

## [2026-08-10] 박지원 프로 활동분야 수정 (운영 DB)

### 변경 사항
- 본인 요청: 레슨 '활동 중'으로 변경, GTOUR는 활동 안 함으로 제외 (인스타그램은 유지)
- 관리자 API PATCH로 반영, 공개 API 확인. 코드 변경 없음

---

## [2026-08-11] SIE(선수 인텔리전스) 코어 적용 — AI 간편 매칭 엔진 v2 (핸드오프 v2.0)

### 변경 사항
- Backend `aiMatch.service.ts` 재작성 (scoringVersion sie-mvp-2026-08-11):
  - 역할별 서브 점수 6종(Patch/SNS/PR/Commerce/Fan/LongTerm) + HybridFit — cohort percentile 정규화, time-decay, 결측=confidence 감점
  - 목적별 가중치 매트릭스(§7.1)로 최종 점수 합성, 역할 분류 5종(§5.1)
  - reason마다 내부 실측 evidence 연결(AC-04), risks[]·alternative_plan·confidence 수치(§6.3)
  - sourceStatus로 뉴스/YouTube/Instagram 미연동 정직 표기 (P1/P4 예정)
- Frontend: 역할 배지·신뢰도 %·조사 소스 박스(결과), 채널 적합도 바·근거 보기·리스크·대안(제안), 단계별 분석 문구(입력)
- 운영 검증: TOP3 역할 분류·서브 점수·근거 3건·리스크 반환 확인, 구 스냅샷 하위호환

### 영향받는 파일
- `src/backend/src/services/aiMatch.service.ts`
- `src/frontend/src/pages/aimatch/AiMatch.tsx`, `AiMatchResults.tsx`, `AiMatchProposal.tsx`

---

## [2026-08-11] 이정우 프로 현재 소속 정정 (운영 DB)

### 변경 사항
- 본인 요청: 현재 소속 "KPGA 투어프로" → "KPGA 프로" (affiliation, 대전 계정 261641ad)
- 관리자 API PATCH, 공개 API 반영 확인. 코드 변경 없음

---

## [2026-08-11] 이정우 프로 중복 계정 통합

### 변경 사항
- 본인 가입 계정(rndwltkgkd@naver.com, 2026-08-11)에 기존 큐레이션 프로필(leejungwoo@sponpik.com) 연결
- 빈 중복 선수행 삭제, 플레이스홀더 유저 삭제 (seed mergeDuplicateAthleteAccounts 패턴, 멱등)
- 운영 확인: 이정우 계정 1개 · 본인 이메일 · 프로필(KPGA 프로/대전) 유지

### 영향받는 파일
- `src/backend/prisma/seed.ts`

---

## [2026-08-11] 모바일 전면 개편 — 앱형 탭 바 + 선택 즉시 반영 구매 동선

### 변경 사항
- 하단 탭 바(MobileTabBar) 신설 — 홈·경매·AI 매칭·마켓·마이, 공개 페이지 공용(lg 미만), body 여백 자동
- 통합 구매화면: 선수 요약 모바일 숨김, 기간·유형 퀵 선택 상단 배치, 하단 상시 요약 바(선택 즉시 반영), 구성 바텀시트
- 홈: 성장마켓·투표 카드 가로 스와이프, 경매 현황판 참여 지표 모바일 숨김
- AI 매칭: 비교 담기 모바일 피드백 바, CTA들 탭 바 위 오프셋
- 375px 전수 검증(가로 스크롤·바 정렬) + 1280px 회귀 없음 확인

### 영향받는 파일
- `src/frontend/src/components/MobileTabBar.tsx` (신규), `PublicHeader.tsx`, `purchase/UnifiedPurchase.tsx`, `LiveAuctionBoard.tsx`, `HomeGrowthMarket.tsx`, `HomeVoteSection.tsx`
- `src/pages/aimatch/AiMatch.tsx`, `AiMatchResults.tsx`, `src/pages/ProposalNew.tsx`, `src/index.css`

---

## [2026-08-11] 모바일 개편 2차 — 거래 화면 하단 고정 CTA 확대

### 변경 사항
- 전 페이지(28개 라우트) 375px 자동 진단(puppeteer): 가로 스크롤 0건 확인
- 경매 상세: LIVE 시 하단 고정 입찰 바(현재가·남은 시간·입찰/로그인 CTA)
- 팬스토어 상품 상세 3종: 하단 고정 구매 바(상품명·가격·팬 할인가 구매)
- 모든 바 탭 바 위(bottom-14) 정렬. 목록 페이지 1열은 모바일 표준 패턴으로 유지

### 영향받는 파일
- `src/frontend/src/pages/AuctionDetail.tsx`, `src/pages/store/FanStore{Orex,Guys,Hoi}Product.tsx`

---

## [2026-08-12] SIE 순위 고정 결함 수정 (sie-mvp-2026-08-12)

### 변경 사항
- HYBRID 상향 보정(hybrid×0.9 floor)이 목적별 가중치를 덮어써 TOP이 항상 동일하던 결함 제거
- 선호 방식 가용성 보너스 추가(경매 +4/직접 +3/월·연간 +3)
- 운영 검증: 노출→김수아2, 팬스토어·SNS→이용희, 장기→김다훈2, 대회테스트→김수아2 — 조합별 순위 분화 확인

---

## [2026-08-12] AI 간편 매칭 브랜드 전용 전환 + 브랜드 맞춤 1단계

### 변경 사항
- Backend: preview/requests 생성 BRAND 로그인 필수, 조회는 작성 브랜드/ADMIN만(403). GET /ai-match/brand-context 신설(업종→brandType 매핑·최근 요청·협업 선수 수). 브랜드-선수 계약 이력 +4 가점(PAST_COLLABORATION reason+evidence)
- Frontend: 4개 화면 브랜드 게이트(로그인/등록 CTA), 브랜드 컨텍스트 프리필 + 「브랜드명」 맞춤 배지
- 운영 검증: 비로그인 401/403, 브랜드 로그인 플로우·프리필·배지 확인 (brand@example.com)

---

## [2026-08-12] AI 심층매칭 v3 (핸드오프 v3.0 P0)

### 변경 사항
- Backend (deep-match-v3-2026-08-12):
  - brands.match_profile + brand_athlete_preferences 마이그레이션
  - Brand Analyzer: URL 공개 메타데이터 규칙 추출(LLM 미사용 명시), SSRF 가드(사설IP/localhost/file 차단·리다이렉트 3·500KB·8초), 승인값만 Feature(AC-02)
  - Diversity Re-ranker(§5.2): 반복노출 페널티(최근 5요청, 0~12)·디스커버리 보너스(무노출+상위 30퍼센타일)·추천 스타일 λ(0.15/0.35/0.55). penalties/bonuses 응답(AC-10)
  - 역할별 슬롯: BEST/PATCH/SOCIAL/HYBRID/DISCOVERY — 선수 중복 금지(AC-03), threshold 미달 시 '적합 후보 부족'(AC-05)
  - KPI·채널 gap 가중치 보정, 선호/제외 피드백 API(즉시 hard exclude, AC-06)
- Frontend: 입력 4섹션(브랜드·URL 분석·승인 카드·마케팅/KPI/스타일) + 브리프 준비도 %, 역할별 결과 카드 5종, '추천을 더 잘 맞춰주세요' 재추천 패널, '이 선수 제외'
- 운영 검증: 역할 5슬롯 전원 상이(김수아2/장정우/이용희/박은수/홍지우 — DISCOVERY 신규발견), 반복 페널티 -12 실동작, SSRF 3종 차단, E2E(로그인→준비도 90%→제출→5/5 배지), 375px 통과(AC-11)

### 영향받는 파일
- `src/backend/prisma/schema.prisma`, `migrations/20260812_deep_match_v3/`, `services/{aiMatch,brandAnalyzer}.service.ts`, `routes/aiMatch.routes.ts`
- `src/frontend/src/pages/aimatch/{AiMatch,AiMatchResults}.tsx`, `services/api.ts`

---

## [2026-08-12] 심층매칭 v3.1 — 슬롯별 판매방식 표기 + 멀티 선수 포트폴리오

### 변경 사항
- 판매방식 오표기 수정: 직접구매 슬롯(예: 김수아2 모자챙 상단 90만원)이 제안서에 '라이브 경매'로 표기되던 결함.
  원인은 패키지 방식을 선수 단위 경매 보유 여부로 결정한 것 — 슬롯마다 OPEN 인스턴스의 saleMode 기준
  saleModeLabel(라이브 경매/직접 구매/협의)을 부착하고, package.method/methodLabel은 선택된 슬롯들의
  실제 모드로 결정(혼합 시 '직접 구매 + 라이브 경매')
- 멀티 선수 포트폴리오(§12.3): 입력 portfolioMode(AUTO/SINGLE/MULTI) + 역할 슬롯 기반 2~3명 조합
  (패치 노출·SNS 콘텐츠·보조 노출, 예산 상한 내) portfolio 응답. 프론트 입력 '선수 구성' 칩 +
  결과 '선수 구성 제안' 카드(1명 집중 vs 역할 분산 비교)
- 운영 검증: 김수아2 모자챙 상단 90만원 → '직접 구매' 정상, 고예산 혼합 패키지 → '직접 구매 + 라이브 경매',
  MULTI → 장정우+이용희 합계 180만(상한 200만 내), SINGLE → multi null

### 영향받는 파일
- `src/backend/src/services/aiMatch.service.ts` (deep-match-v3.1-2026-08-12), `routes/aiMatch.routes.ts`
- `src/frontend/src/pages/aimatch/{AiMatch,AiMatchResults,AiMatchProposal}.tsx`

---

## [2026-08-29] GTOUR/WGTOUR 6차 방송 노출 트래킹 + 선수·브랜드별 MEV 리포트

### 작업 과정
1. **영상 수집**: 골프존 공식 유튜브 중계 4편(8/8 GTOUR 1R·FR, 8/9 WGTOUR 1R·FR, 총 14시간 35분)
   yt-dlp 1080p 다운로드 + 한국어 자동자막(캐스터 언급 검색용)
2. **1차 스캔**: 10초 간격 5,250프레임 추출 → 12분할 몽타주 시트 434장 전량 육안 판독
   (선수 등장·리더보드·조편성·사이드바 그래픽 식별)
3. **정밀화**: 선수 등장 구간을 2fps~60fps로 재추출해 시작·종료 초 단위 확정.
   스코어카드 자막 프레임 344장 자동 검출(하단 검은 띠 휘도 분석)로 누락 구간 보완
4. **브랜드 판독**: 1080p로 소매·어깨 소형 패치 판독 불가 → 핵심 구간만 4K(3840×2160)
   구간 다운로드(--download-sections) 후 최대 14배 확대 판독. 선수마다 정면·좌우·등판 전 각도 확인.
   배진리 어깨 뒤는 세리머니 2.2초를 60fps 전수 추출 + 선명도(라플라시안) 랭킹으로 판독 성공
5. **MEV 산정**: 사용자 제공 'MEV 산정기준서 v1.0(2026.08)' 적용
   - MEV = (잠재도달수÷1,000) × CPM 5,000원 × (유효노출÷30초) × 품질계수(부위×화면×판독)
   - 미판독 0원 / 유효 2초 이상 연속 / TV(SBS GOLF2) 별도 미산정 / AVE→MEV, ROI→Media Value Multiple
6. **리포트 생성**: HTML 템플릿 + puppeteer 2400px PNG 렌더 파이프라인

### 확정 결과
- 노출 35건(착용 18건 370초 + 그래픽 17건) · 4선수 × 10브랜드 전수 화면 확인
- 브랜드별 노출 시간(로고 판독 기준)과 세그먼트×브랜드 MEV 기여액 산정
- 추정 총 MEV 1,031.8만원: 배진리 495.6만(엘렌실라 188.2 최고 단일) / 염돈웅 439.1만(애니포레 174.1)
  / 김수아 70.2만 / 장연주 26.9만

### 산출물 (E:/SPONPIK/roi-tracking-202608/)
- `report/index.html` 트래킹 리포트 아티팩트 · `report/roi.html` 통합 ROI 아티팩트
- `cards2/` 선수별 MEV 리포트 PNG 4종 · `cards3/` 브랜드×선수 단건 리포트 PNG 15종
- `mev_data.py`(산정 로직) · `cards2_render.py`/`cards3_render.py`(템플릿) — CPM·후원비 변경 시 전체 재생성
- `findings.md` 전 과정 기록 · `shots/` 노출 장면 캡처 27장 · `vod/` 원본 11GB(재검증용)

### 참고 / 한계
- Media Value Multiple(MEV÷후원비)은 브랜드별 후원비 미확인으로 '—' 표기
- TV 동시 송출 가치는 공식 시청자료 확보 전까지 미산정, 잠재 도달수는 8/29 기준 유튜브 조회수
- 판독 수준 구분 명시: 글자 판독 7개 브랜드 / 위치·형태 확인 3개(염돈웅 엘렌실라·시너스홀딩스, 배진리 엘그림)

## [2026-09-01] 리디자인 v2.0 — 디지털 파트너 월 구독 · 직접 PICK 전체 흐름

### 변경 사항

**디지털 파트너 월 구독 (핸드오프 v1.0 §5)**
- 백엔드: `DigitalPlan` / `AthleteDigitalInventory` / `DigitalApplication` 3모델 + `/api/digital-partner` 9엔드포인트
  - 플랜 START 49,000 / GROW 99,000 / PLUS 199,000 (12개월 약정, 최초 조회 시 자동 시딩)
  - 신청 → 선수 승인 → 계약·첫 결제(ACTIVE) 상태머신, 승인 유효기간 72h
  - 승인 전 결제 차단(UX-04) · 브랜드 중복 신청 차단 · 잔여 수량 차감
- 프론트 4화면: 모집 선수 목록 / 상품 선택 / 승인·계약·결제 / 선수 승인함 디지털 섹션
- 전 화면에 "경기복 · 대회 현장 부착 미포함" 고지(UX-02)

**직접 PICK (시안 img_12~14)**
- 백엔드 `directPick.service.ts` + `/api/direct-pick` 5엔드포인트
  - `options`: 기간(대회1회/30일/6개월/12개월) · 유형(착장/SNS/매장·방문/통합) ·
    추가활동 5종 · 구매방식(직접구매/경매/제안) 정책표를 한 곳에서 관리
  - `quote`: 슬롯 월 단가 × 기간(개월) + 추가 활동 — 서버 재계산(§14.4)
  - 6·12개월 장기 상품 경매 차단
- `submitApplication`에 `sourceType=DIRECT_PICK` + `config` 지원.
  신청 시에도 같은 정책표로 다시 계산하고 구성 내용을 snapshot에 고정(BR-05)
- 프론트 3화면(선수 선택 → 슬롯 선택 → 후원 구성) → 기존 신청 상태·결제 화면으로 연결
- 헤더 메가메뉴 · 모바일 드로어 · 메인 히어로의 "직접 PICK" CTA를 `/sponsor/pick`으로 연결

### 검증 (운영 API E2E)
- 디지털: 신청 SUBMITTED → 승인 전 결제 차단 OK → 중복 신청 차단 OK → 승인 → ACTIVE
  (2026-08-31~2027-08-31, 다음 결제 2026-10-01) → 중복 결제 차단 OK → 재고 GROW 9/10 차감
- 직접 PICK: 12개월 견적 = 월 900,000 × 12 검증 OK · 장기 경매 차단 OK ·
  신청 서버금액 1,200,000 = 견적 일치 OK · 승인 전 결제 차단 OK → 승인 → ACTIVE
- 브라우저: 3화면 렌더링 · 슬롯 선택 · 추가활동/기간 변경 시 서버 재견적 반영 확인

### 영향받는 파일
- `src/backend/src/services/{digitalPartner,directPick,application}.service.ts`
- `src/backend/src/routes/{digitalPartner,directPick,application,index}.routes.ts`
- `src/backend/prisma/schema.prisma`, `prisma/migrations/20260901_sponsorship_application/`
- `src/frontend/src/pages/digital/{DigitalAthletes,DigitalApply,DigitalApplicationStatus}.tsx`
- `src/frontend/src/pages/pick/{PickAthletes,PickSlots,PickConfigure}.tsx`
- `src/frontend/src/pages/athlete/AthleteRequests.tsx`, `src/pages/DigitalPartner.tsx`
- `src/frontend/src/{App.tsx,services/api.ts,components/PublicHeader.tsx,pages/Home.tsx}`

### 확인 필요 (운영 결정 대기)
- 기간 요금 규칙: 현재 "슬롯 월 단가 × 개월수"(대회 1회 = 1개월 단가 기준).
  장기 할인 등 다른 정책이면 `directPick.service.ts`의 `DURATIONS` 표만 고치면 된다.
- 추가 활동 요율은 시안 명시가(15만~70만) 그대로 적용. 선수별 차등이 필요하면 별도 테이블 필요.
- 시안의 '팬 온도'는 산출 근거가 없어 미표시(LEG-06). 도식 후면(등) 뷰는 후면 실루엣 이미지가
  없어 목록 필터('등' 탭)로만 제공.
