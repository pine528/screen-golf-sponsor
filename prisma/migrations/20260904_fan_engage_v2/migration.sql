-- 팬 참여 v1.0 — 팬온도 스냅샷 · 팬 기여도 · 응원편지 · 연말 캠페인 · 포인트 원장 상태
-- (핸드오프 v1.0 2026-08-22 §6 · §7 · §9 · §12)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

-- 1) 포인트 원장 상태 머신 (§7.4)
ALTER TABLE "point_ledger_txs" ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "point_ledger_txs" ADD COLUMN IF NOT EXISTS "expires_at"      TIMESTAMP(3);
ALTER TABLE "point_ledger_txs" ADD COLUMN IF NOT EXISTS "confirmed_at"    TIMESTAMP(3);
ALTER TABLE "point_ledger_txs" ADD COLUMN IF NOT EXISTS "original_tx_id"  TEXT;
ALTER TABLE "point_ledger_txs" ADD COLUMN IF NOT EXISTS "athlete_id"      TEXT;
CREATE INDEX IF NOT EXISTS "point_ledger_txs_status_expires_at_idx"
  ON "point_ledger_txs" ("status", "expires_at");

-- 2) 팬 활동 원장 확장 (§5.5 유효성 · §15.1 위험도)
ALTER TABLE "fan_temperature_events" ADD COLUMN IF NOT EXISTS "validity"   TEXT NOT NULL DEFAULT 'VALID';
ALTER TABLE "fan_temperature_events" ADD COLUMN IF NOT EXISTS "risk_score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fan_temperature_events" ADD COLUMN IF NOT EXISTS "amount"     INTEGER;

-- 3) 팬온도 일배치 스냅샷 (§6 · §12.1)
CREATE TABLE IF NOT EXISTS "fan_temperature_snapshots" (
  "id"              TEXT PRIMARY KEY,
  "athlete_id"      TEXT NOT NULL,
  "score"           DOUBLE PRECISION NOT NULL,
  "components"      JSONB NOT NULL,
  "sample_size"     INTEGER NOT NULL,
  "confidence"      DOUBLE PRECISION NOT NULL DEFAULT 1,
  "penalties"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "formula_version" TEXT NOT NULL,
  "date"            TIMESTAMP(3) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_temperature_snapshots_athlete_id_date_formula_version_key"
  ON "fan_temperature_snapshots" ("athlete_id", "date", "formula_version");
CREATE INDEX IF NOT EXISTS "fan_temperature_snapshots_athlete_id_date_idx"
  ON "fan_temperature_snapshots" ("athlete_id", "date");
DO $$ BEGIN
  ALTER TABLE "fan_temperature_snapshots"
    ADD CONSTRAINT "fan_temperature_snapshots_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) 팬 개인 기여도 (§12) — 구매액이 아니라 활동 다양성·지속성 중심
CREATE TABLE IF NOT EXISTS "fan_contributions" (
  "id"               TEXT PRIMARY KEY,
  "user_id"          TEXT NOT NULL,
  "athlete_id"       TEXT NOT NULL,
  "score"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "level"            INTEGER NOT NULL DEFAULT 1,
  "diversity"        INTEGER NOT NULL DEFAULT 0,
  "streak_weeks"     INTEGER NOT NULL DEFAULT 0,
  "letters"          INTEGER NOT NULL DEFAULT 0,
  "vote_count"       INTEGER NOT NULL DEFAULT 0,
  "post_count"       INTEGER NOT NULL DEFAULT 0,
  "store_count"      INTEGER NOT NULL DEFAULT 0,
  "recommend_count"  INTEGER NOT NULL DEFAULT 0,
  "first_active_at"  TIMESTAMP(3),
  "last_activity_at" TIMESTAMP(3),
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_contributions_user_id_athlete_id_key"
  ON "fan_contributions" ("user_id", "athlete_id");
CREATE INDEX IF NOT EXISTS "fan_contributions_athlete_id_score_idx"
  ON "fan_contributions" ("athlete_id", "score");
DO $$ BEGIN
  ALTER TABLE "fan_contributions"
    ADD CONSTRAINT "fan_contributions_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) 응원편지 (§9.2)
CREATE TABLE IF NOT EXISTS "fan_letters" (
  "id"              TEXT PRIMARY KEY,
  "athlete_id"      TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "title"           TEXT,
  "content"         TEXT NOT NULL,
  "image_url"       TEXT,
  "is_public"       BOOLEAN NOT NULL DEFAULT true,
  "status"          TEXT NOT NULL DEFAULT 'PUBLISHED',
  "moderation_note" TEXT,
  "thanks_at"       TIMESTAMP(3),
  "thanks_text"     TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fan_letters_athlete_id_created_at_idx" ON "fan_letters" ("athlete_id", "created_at");
CREATE INDEX IF NOT EXISTS "fan_letters_user_id_created_at_idx"    ON "fan_letters" ("user_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "fan_letters"
    ADD CONSTRAINT "fan_letters_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) 연말 팬 이름 광고 캠페인 (§9.3)
CREATE TABLE IF NOT EXISTS "fan_ad_campaigns" (
  "id"          TEXT PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "season"      TEXT NOT NULL,
  "start_at"    TIMESTAMP(3) NOT NULL,
  "end_at"      TIMESTAMP(3) NOT NULL,
  "criteria"    JSONB,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',
  "notice"      TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7) 브랜드 추천 파이프라인 (§9.1)
ALTER TABLE "fan_brand_suggestions" ADD COLUMN IF NOT EXISTS "interest"    TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "fan_brand_suggestions" ADD COLUMN IF NOT EXISTS "is_public"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fan_brand_suggestions" ADD COLUMN IF NOT EXISTS "status_note" TEXT;
ALTER TABLE "fan_brand_suggestions" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- 8) 팬스토어 v1.0 — 외부몰 연결형 (§8)
CREATE TABLE IF NOT EXISTS "fan_stores" (
  "id"             TEXT PRIMARY KEY,
  "athlete_id"     TEXT NOT NULL,
  "brand_id"       TEXT,
  "brand_name"     TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "summary"        TEXT,
  "story"          TEXT,
  "hero_image_url" TEXT,
  "benefit_label"  TEXT,
  "benefit_code"   TEXT,
  "benefit_desc"   TEXT,
  "responsible"    TEXT NOT NULL DEFAULT 'BRAND',
  "seller_name"    TEXT,
  "seller_contact" TEXT,
  "external_url"   TEXT,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "start_at"       TIMESTAMP(3),
  "end_at"         TIMESTAMP(3),
  "view_count"     INTEGER NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_stores_slug_key"       ON "fan_stores" ("slug");
CREATE INDEX IF NOT EXISTS "fan_stores_status_start_at_idx"   ON "fan_stores" ("status", "start_at");
CREATE INDEX IF NOT EXISTS "fan_stores_athlete_id_idx"        ON "fan_stores" ("athlete_id");
DO $$ BEGIN
  ALTER TABLE "fan_stores" ADD CONSTRAINT "fan_stores_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fan_store_products" (
  "id"             TEXT PRIMARY KEY,
  "store_id"       TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "image_url"      TEXT,
  "description"    TEXT,
  "price"          INTEGER NOT NULL,
  "original_price" INTEGER,
  "external_url"   TEXT NOT NULL,
  "shipping_info"  TEXT,
  "return_info"    TEXT,
  "seller_name"    TEXT,
  "stock_note"     TEXT,
  "is_sponsored"   BOOLEAN NOT NULL DEFAULT true,
  "point_rate"     DOUBLE PRECISION,
  "sort_order"     INTEGER NOT NULL DEFAULT 0,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fan_store_products_store_id_sort_order_idx"
  ON "fan_store_products" ("store_id", "sort_order");
DO $$ BEGIN
  ALTER TABLE "fan_store_products" ADD CONSTRAINT "fan_store_products_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "fan_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fan_store_clicks" (
  "id"           TEXT PRIMARY KEY,
  "click_id"     TEXT NOT NULL,
  "store_id"     TEXT NOT NULL,
  "product_id"   TEXT,
  "user_id"      TEXT,
  "utm"          TEXT,
  "confirmed_at" TIMESTAMP(3),
  "amount"       INTEGER,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_store_clicks_click_id_key"    ON "fan_store_clicks" ("click_id");
CREATE INDEX IF NOT EXISTS "fan_store_clicks_store_id_created_at_idx" ON "fan_store_clicks" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "fan_store_clicks_user_id_created_at_idx"  ON "fan_store_clicks" ("user_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "fan_store_clicks" ADD CONSTRAINT "fan_store_clicks_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "fan_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fan_store_clicks" ADD CONSTRAINT "fan_store_clicks_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "fan_store_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
