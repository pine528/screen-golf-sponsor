-- 경기결과 공개 승인 상태 — 선수 자가등록(PENDING) → 관리자 승인(APPROVED)
-- 기존 행은 전부 APPROVED 기본값(계속 공개)
ALTER TABLE "athlete_event_results" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';
