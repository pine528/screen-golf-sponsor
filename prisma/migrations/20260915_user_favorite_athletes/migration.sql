-- 관심 선수(Watchlist) 계정 단위 저장 (선수 메뉴 핸드오프 v1.0 §7.1)
CREATE TABLE IF NOT EXISTS "user_favorite_athletes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_favorite_athletes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_favorite_athletes_user_id_athlete_id_key" ON "user_favorite_athletes"("user_id", "athlete_id");
CREATE INDEX IF NOT EXISTS "user_favorite_athletes_user_id_idx" ON "user_favorite_athletes"("user_id");
DO $$ BEGIN
  ALTER TABLE "user_favorite_athletes" ADD CONSTRAINT "user_favorite_athletes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "user_favorite_athletes" ADD CONSTRAINT "user_favorite_athletes_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 기존 팬 즐겨찾기를 계정 단위로 이관 (중복 무시)
INSERT INTO "user_favorite_athletes" ("id", "user_id", "athlete_id", "created_at")
SELECT gen_random_uuid()::text, f."user_id", fa."athlete_id", fa."created_at"
FROM "favorite_athletes" fa JOIN "fans" f ON f."id" = fa."fan_id"
ON CONFLICT ("user_id", "athlete_id") DO NOTHING;
