-- 지금 가능한 후원 — 완성형 상품(Offer) · 진열 · 보관함 (핸드오프 v1.0 2026-08-22)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

CREATE TABLE IF NOT EXISTS "offers" (
  "id"                    TEXT PRIMARY KEY,
  "code"                  TEXT NOT NULL,
  "slug"                  TEXT NOT NULL,
  "title"                 TEXT NOT NULL,
  "subtitle"              TEXT,
  "summary"               TEXT,
  "type"                  TEXT NOT NULL DEFAULT 'EVENT_SLOT',
  "status"                TEXT NOT NULL DEFAULT 'DRAFT',
  "version"               INTEGER NOT NULL DEFAULT 1,
  "hero_image_url"        TEXT,
  "categories"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "channels"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "purposes"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sales_from"            TIMESTAMP(3),
  "sales_to"              TIMESTAMP(3),
  "execution_from"        TIMESTAMP(3),
  "execution_to"          TIMESTAMP(3),
  "event_id"              TEXT,
  "lead_time_days"        INTEGER NOT NULL DEFAULT 7,
  "duration_code"         TEXT NOT NULL DEFAULT 'SINGLE_EVENT',
  "months"                INTEGER NOT NULL DEFAULT 1,
  "price_type"            TEXT NOT NULL DEFAULT 'FIXED',
  "supply_amount"         INTEGER NOT NULL DEFAULT 0,
  "original_price"        INTEGER,
  "discount_reason"       TEXT,
  "cost_amount"           INTEGER NOT NULL DEFAULT 0,
  "platform_fee"          INTEGER NOT NULL DEFAULT 0,
  "stock_mode"            TEXT NOT NULL DEFAULT 'CAPACITY',
  "capacity"              INTEGER NOT NULL DEFAULT 1,
  "reserved_qty"          INTEGER NOT NULL DEFAULT 0,
  "sold_qty"              INTEGER NOT NULL DEFAULT 0,
  "hold_minutes"          INTEGER NOT NULL DEFAULT 15,
  "approval_mode"         TEXT NOT NULL DEFAULT 'ATHLETE_APPROVAL',
  "pre_approved_at"       TIMESTAMP(3),
  "pre_approval_to"       TIMESTAMP(3),
  "pre_approval_max_qty"  INTEGER,
  "offline_use"           BOOLEAN NOT NULL DEFAULT true,
  "online_use"            BOOLEAN NOT NULL DEFAULT true,
  "print_use"             BOOLEAN NOT NULL DEFAULT false,
  "secondary_use"         BOOLEAN NOT NULL DEFAULT false,
  "territory"             TEXT NOT NULL DEFAULT '국내',
  "rights_note"           TEXT,
  "restrictions"          JSONB,
  "expected_metrics"      JSONB,
  "methodology"           TEXT,
  "method_version"        TEXT,
  "confidence"            TEXT,
  "data_as_of"            TIMESTAMP(3),
  "guaranteed"            BOOLEAN NOT NULL DEFAULT false,
  "assumptions"           JSONB,
  "owner_name"            TEXT,
  "reviewer_name"         TEXT,
  "published_at"          TIMESTAMP(3),
  "scheduled_at"          TIMESTAMP(3),
  "change_reason"         TEXT,
  "pause_reason"          TEXT,
  "view_count"            INTEGER NOT NULL DEFAULT 0,
  "detail_count"          INTEGER NOT NULL DEFAULT 0,
  "save_count"            INTEGER NOT NULL DEFAULT 0,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "offers_code_key" ON "offers" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "offers_slug_key" ON "offers" ("slug");
CREATE INDEX IF NOT EXISTS "offers_status_sales_to_idx" ON "offers" ("status", "sales_to");
CREATE INDEX IF NOT EXISTS "offers_type_status_idx" ON "offers" ("type", "status");

CREATE TABLE IF NOT EXISTS "offer_athletes" (
  "id"         TEXT PRIMARY KEY,
  "offer_id"   TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "role"       TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "offer_athletes_offer_id_athlete_id_key" ON "offer_athletes" ("offer_id", "athlete_id");

CREATE TABLE IF NOT EXISTS "offer_components" (
  "id"               TEXT PRIMARY KEY,
  "offer_id"         TEXT NOT NULL,
  "component_type"   TEXT NOT NULL,
  "label"            TEXT NOT NULL,
  "athlete_id"       TEXT,
  "athlete_slot_id"  TEXT,
  "slot_code"        TEXT,
  "offer_product_id" TEXT,
  "required_qty"     INTEGER NOT NULL DEFAULT 1,
  "quantity"         INTEGER NOT NULL DEFAULT 1,
  "unit_price"       INTEGER NOT NULL DEFAULT 0,
  "note"             TEXT,
  "sort_order"       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "offer_components_offer_id_idx" ON "offer_components" ("offer_id");

CREATE TABLE IF NOT EXISTS "offer_options" (
  "id"         TEXT PRIMARY KEY,
  "offer_id"   TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "choices"    JSONB,
  "min_qty"    INTEGER,
  "max_qty"    INTEGER,
  "add_price"  INTEGER NOT NULL DEFAULT 0,
  "required"   BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "offer_options_offer_id_code_key" ON "offer_options" ("offer_id", "code");

CREATE TABLE IF NOT EXISTS "offer_placements" (
  "id"           TEXT PRIMARY KEY,
  "offer_id"     TEXT NOT NULL,
  "surface"      TEXT NOT NULL,
  "section_key"  TEXT NOT NULL,
  "rank"         INTEGER NOT NULL DEFAULT 100,
  "pinned"       BOOLEAN NOT NULL DEFAULT false,
  "active_from"  TIMESTAMP(3),
  "active_to"    TIMESTAMP(3),
  "audience"     JSONB,
  "badge"        TEXT,
  "reason"       TEXT,
  "is_sponsored" BOOLEAN NOT NULL DEFAULT false,
  "daily_cap"    INTEGER,
  "status"       TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "offer_placements_surface_section_key_rank_idx"
  ON "offer_placements" ("surface", "section_key", "rank");
CREATE INDEX IF NOT EXISTS "offer_placements_offer_id_idx" ON "offer_placements" ("offer_id");

CREATE TABLE IF NOT EXISTS "saved_offers" (
  "id"            TEXT PRIMARY KEY,
  "brand_user_id" TEXT NOT NULL,
  "offer_id"      TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_offers_brand_user_id_offer_id_key" ON "saved_offers" ("brand_user_id", "offer_id");
CREATE INDEX IF NOT EXISTS "saved_offers_brand_user_id_created_at_idx" ON "saved_offers" ("brand_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "offer_cart_items" (
  "id"            TEXT PRIMARY KEY,
  "brand_user_id" TEXT NOT NULL,
  "offer_id"      TEXT NOT NULL,
  "quantity"      INTEGER NOT NULL DEFAULT 1,
  "start_date"    TIMESTAMP(3),
  "options"       JSONB,
  "quoted_amount" INTEGER NOT NULL DEFAULT 0,
  "quoted_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "offer_cart_items_brand_user_id_created_at_idx" ON "offer_cart_items" ("brand_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "offer_audits" (
  "id"         TEXT PRIMARY KEY,
  "offer_id"   TEXT NOT NULL,
  "actor_id"   TEXT,
  "actor_name" TEXT,
  "action"     TEXT NOT NULL,
  "field"      TEXT,
  "before"     JSONB,
  "after"      JSONB,
  "reason"     TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "offer_audits_offer_id_created_at_idx" ON "offer_audits" ("offer_id", "created_at");

-- 외래키
DO $$ BEGIN
  ALTER TABLE "offer_athletes" ADD CONSTRAINT "offer_athletes_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_athletes" ADD CONSTRAINT "offer_athletes_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_components" ADD CONSTRAINT "offer_components_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_options" ADD CONSTRAINT "offer_options_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_placements" ADD CONSTRAINT "offer_placements_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "saved_offers" ADD CONSTRAINT "saved_offers_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_cart_items" ADD CONSTRAINT "offer_cart_items_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "offer_audits" ADD CONSTRAINT "offer_audits_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
