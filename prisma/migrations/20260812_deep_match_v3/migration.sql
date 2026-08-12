-- AI 심층매칭 v3 (핸드오프 v3.0 §9)
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "match_profile" JSONB;

CREATE TABLE IF NOT EXISTS "brand_athlete_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "preference" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_athlete_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brand_athlete_preferences_user_id_athlete_id_key" ON "brand_athlete_preferences"("user_id", "athlete_id");
