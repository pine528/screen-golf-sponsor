# 소스 버전 안내 (2026-09-17 외부 검토용)

두 버전 모두 GitHub 태그로 고정돼 있습니다. 태그를 체크아웃하면 해당 시점의 전체 소스가 그대로 나옵니다.

| 버전 | 프론트엔드 (screen-golf-sponsor-frontend) | 백엔드 (screen-golf-sponsor) | 비고 |
|---|---|---|---|
| **1. 현재 버전** (운영 UI) | 브랜치 `main` · 태그 `v1-current` (`91a4640`, 2026-08-12) | 태그 `v1-current` (`b8d40b5`, 2026-08-12) | 리디자인 시작 직전 시점 |
| **2. 수정 버전** (리디자인) | 브랜치 `redesign` · 태그 `v2-redesign` (`7410233`, 2026-09-17) | 브랜치 `main` · 태그 `v2-redesign` (`5a9e32f`, 2026-09-17) | Vercel 프리뷰 + Render 운영 |

백엔드는 브랜치를 나누지 않고 `main`에 계속 반영했습니다. 운영(Render)은 항상 백엔드 `main` 최신을 배포하며, 현재 버전 프론트도 이 백엔드로 동작합니다.
리디자인 이후 백엔드 변경(2026-08-20 ~)은 기존 API를 유지한 채 추가된 것들입니다.

## 받는 방법

```bash
# 현재 버전
git clone https://github.com/pine528/screen-golf-sponsor-frontend.git && cd screen-golf-sponsor-frontend && git checkout v1-current
git clone https://github.com/pine528/screen-golf-sponsor.git && cd screen-golf-sponsor && git checkout v1-current

# 수정 버전
git checkout v2-redesign   # 두 저장소 모두
```

문서(`PROJECT_STATE.md`, `DEVLOG.md`, `REDESIGN_BACKLOG.md` 등)는 백엔드 저장소 `master` 브랜치 `docs/`에 있습니다.
