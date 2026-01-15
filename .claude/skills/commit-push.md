# Commit and Push Skill

이 프로젝트의 Git 원격 저장소 정보:

## 저장소 URL (분리됨)
- **Frontend** (Vercel): https://github.com/pine528/screen-golf-sponsor-frontend.git
  - 경로: `src/frontend/`
  - 브랜치: `main`

- **Backend** (Render): https://github.com/pine528/screen-golf-sponsor.git
  - 경로: `src/backend/`
  - 브랜치: `main`

## 사용법
`/commit-push` 또는 "깃 푸시", "커밋해줘" 등의 명령으로 호출

## 수행 작업
### Frontend 변경시
```bash
cd src/frontend
git add -A
git commit -m "메시지

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main
```

### Backend 변경시
```bash
cd src/backend
git add -A
git commit -m "메시지

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main
```

### 둘 다 변경시
Frontend와 Backend 각각 별도로 커밋/푸시

## 주의사항
- 커밋 메시지는 한글로 작성
- Co-Authored-By 포함
- force push 금지 (명시적 요청 없이)
- 각 저장소 경로에서 git 명령 실행할 것
