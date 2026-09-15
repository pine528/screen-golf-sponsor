-- 시안 2026-09-15 F14 브랜드 추천: 홈페이지(선택) · 협업 형태(복수)
ALTER TABLE "fan_brand_suggestions"
  ADD COLUMN IF NOT EXISTS "brand_url" TEXT,
  ADD COLUMN IF NOT EXISTS "collab_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
