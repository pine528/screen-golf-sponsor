-- 팬 참여 — 커뮤니티 · 팬레터 · 브랜드 추천 · 팬온도 (리디자인 v2.0)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

-- 포인트 사유 추가 (팬 참여 적립)
DO $$ BEGIN
  ALTER TYPE "PointTxReason" ADD VALUE IF NOT EXISTS 'FAN_ENGAGE_REWARD';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "athlete_community_posts" (
  "id"             TEXT PRIMARY KEY,
  "athlete_id"     TEXT NOT NULL,
  "author_user_id" TEXT,
  "author_role"    TEXT NOT NULL DEFAULT 'FAN',
  "type"           TEXT NOT NULL DEFAULT 'CHEER',
  "content"        TEXT NOT NULL,
  "image_url"      TEXT,
  "is_private"     BOOLEAN NOT NULL DEFAULT false,
  "like_count"     INTEGER NOT NULL DEFAULT 0,
  "comment_count"  INTEGER NOT NULL DEFAULT 0,
  "is_hidden"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "athlete_community_posts_athlete_id_created_at_idx"
  ON "athlete_community_posts" ("athlete_id", "created_at");
CREATE INDEX IF NOT EXISTS "athlete_community_posts_author_user_id_created_at_idx"
  ON "athlete_community_posts" ("author_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "community_comments" (
  "id"             TEXT PRIMARY KEY,
  "post_id"        TEXT NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "is_hidden"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "community_comments_post_id_created_at_idx"
  ON "community_comments" ("post_id", "created_at");

CREATE TABLE IF NOT EXISTS "community_likes" (
  "id"         TEXT PRIMARY KEY,
  "post_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_likes_post_id_user_id_key"
  ON "community_likes" ("post_id", "user_id");

CREATE TABLE IF NOT EXISTS "fan_brand_suggestions" (
  "id"          TEXT PRIMARY KEY,
  "athlete_id"  TEXT NOT NULL,
  "fan_user_id" TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "brand_name"  TEXT,
  "reason"      TEXT,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fan_brand_suggestions_athlete_id_status_idx"
  ON "fan_brand_suggestions" ("athlete_id", "status");
CREATE INDEX IF NOT EXISTS "fan_brand_suggestions_fan_user_id_created_at_idx"
  ON "fan_brand_suggestions" ("fan_user_id", "created_at");

-- 팬온도 원장 — 활동 1건 = 1행, 유니크로 중복 적립 차단
CREATE TABLE IF NOT EXISTS "fan_temperature_events" (
  "id"          TEXT PRIMARY KEY,
  "athlete_id"  TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "delta_milli" INTEGER NOT NULL,
  "ref_type"    TEXT NOT NULL,
  "ref_id"      TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_temperature_events_unique"
  ON "fan_temperature_events" ("athlete_id", "user_id", "source", "ref_type", "ref_id");
CREATE INDEX IF NOT EXISTS "fan_temperature_events_athlete_id_created_at_idx"
  ON "fan_temperature_events" ("athlete_id", "created_at");
CREATE INDEX IF NOT EXISTS "fan_temperature_events_user_id_athlete_id_idx"
  ON "fan_temperature_events" ("user_id", "athlete_id");

-- 외래키 (이미 있으면 건너뜀)
DO $$ BEGIN
  ALTER TABLE "athlete_community_posts"
    ADD CONSTRAINT "athlete_community_posts_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "athlete_community_posts"
    ADD CONSTRAINT "athlete_community_posts_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "community_comments"
    ADD CONSTRAINT "community_comments_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "athlete_community_posts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "community_comments"
    ADD CONSTRAINT "community_comments_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "community_likes"
    ADD CONSTRAINT "community_likes_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "athlete_community_posts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "community_likes"
    ADD CONSTRAINT "community_likes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fan_brand_suggestions"
    ADD CONSTRAINT "fan_brand_suggestions_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fan_brand_suggestions"
    ADD CONSTRAINT "fan_brand_suggestions_fan_user_id_fkey"
    FOREIGN KEY ("fan_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fan_temperature_events"
    ADD CONSTRAINT "fan_temperature_events_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fan_temperature_events"
    ADD CONSTRAINT "fan_temperature_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
