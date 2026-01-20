# Memory Maintenance Rules

## 작업 시작 시
1. **반드시** `docs/PROJECT_STATE.md`를 읽고 현재 상태 파악
2. 기존 구현/패턴을 최대한 재사용

## 작업 완료 시 (필수)

### 1. PROJECT_STATE.md 업데이트
다음 변경 시 `docs/PROJECT_STATE.md` 수정:
- 새 기능 추가
- API 엔드포인트 변경
- 스키마 변경
- 불변식 영향

**규칙:**
- 200~300줄 내 요약 유지
- 상세 내용은 코드/DEVLOG에 위임
- 중복 제거, 간결하게

### 2. DEVLOG.md 엔트리 추가
모든 작업 완료 시 `docs/DEVLOG.md`에 append:

```markdown
## [YYYY-MM-DD] 작업 제목

### 변경 사항
- 항목 1
- 항목 2

### 영향받는 파일
- `path/to/file.ts`

### 참고
- 관련 이슈/PR 링크 등
```

## DEVLOG 아카이브 규칙
- DEVLOG.md가 500줄 초과 시:
  1. 오래된 엔트리를 `docs/archive/DEVLOG-YYYY-MM.md`로 이동
  2. DEVLOG.md에는 최근 3개월 내용만 유지
  3. 아카이브 파일 목록을 DEVLOG.md 상단에 링크

## 체크리스트 (Claude Code가 따를 것)
```
작업 완료 전:
[ ] docs/PROJECT_STATE.md 업데이트 (해당 시)
[ ] docs/DEVLOG.md 엔트리 추가
[ ] TypeScript 빌드 성공 확인
[ ] 커밋 메시지에 Co-Authored-By 포함
```

## 금지 사항
- PROJECT_STATE.md를 300줄 초과로 늘리지 말 것
- DEVLOG.md를 작업 시작 시 자동 로드하지 말 것 (기록 전용)
- 불변식 위반 코드 커밋 금지
