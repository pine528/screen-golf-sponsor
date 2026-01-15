# Commit and Push Skill

이 프로젝트의 Git 원격 저장소 정보:

## 저장소 URL
- **Frontend**: https://github.com/pine528/screen-golf-sponsor-frontend.git
- **Backend (Main)**: https://github.com/pine528/screen-golf-sponsor.git

## 사용법
`/commit-push` 또는 "깃 푸시", "커밋해줘" 등의 명령으로 호출

## 수행 작업
1. 변경사항 확인 (git status, git diff)
2. 파일 스테이징 (git add)
3. 커밋 메시지 작성 및 커밋
4. 원격 저장소로 푸시

## 원격 저장소 설정 (필요시)
```bash
# Backend 저장소
git remote add origin https://github.com/pine528/screen-golf-sponsor.git

# 또는 Frontend 전용 저장소
git remote add frontend https://github.com/pine528/screen-golf-sponsor-frontend.git
```

## 주의사항
- 커밋 메시지는 한글로 작성
- Co-Authored-By 포함
- force push 금지 (명시적 요청 없이)
