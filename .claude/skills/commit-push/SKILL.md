---
name: commit-push
description: Git 저장소에 변경사항을 커밋하고 푸시합니다. Frontend와 Backend 저장소를 자동으로 구분하여 처리합니다. "깃 푸시", "커밋해줘", "변경사항 저장" 등의 요청에 사용됩니다.
---

# Commit and Push Skill

이 프로젝트의 Git 원격 저장소 정보:

## 저장소 URL (분리됨)
- **Frontend** (Vercel): https://github.com/pine528/screen-golf-sponsor-frontend.git
  - 경로: `src/frontend/`
  - 브랜치: `main`

- **Backend** (Render): https://github.com/pine528/screen-golf-sponsor.git
  - 경로: `src/backend/`
  - 브랜치: `main`

## 수행 작업

### 1. 먼저 변경된 파일 확인
각 저장소 폴더에서 `git status` 실행하여 변경사항 확인

### 2. Frontend 변경시
```bash
cd src/frontend
git add -A
git commit -m "메시지

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main
```

### 3. Backend 변경시
```bash
cd src/backend
git add -A
git commit -m "메시지

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main
```

### 4. 둘 다 변경시
Frontend와 Backend 각각 별도로 커밋/푸시

## 주의사항
- 커밋 메시지는 한글로 작성
- Co-Authored-By 포함
- force push 금지 (명시적 요청 없이)
- 각 저장소 경로에서 git 명령 실행할 것
