-- 2026-07 선수화면 개편 — 엑셀 프로필 양식 기반 확장 필드
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "birth_date" TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "birthplace" TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "weight" INTEGER;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "tour_qualification" TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "activity_fields" JSONB;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "highlights" JSONB;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "sns_stats" JSONB;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "sponsor_slots" JSONB;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "sizes" JSONB;
