-- 추천 선수 노출 플래그 (2026-07 항목2)
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "is_recommended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "recommend_order" INTEGER;
