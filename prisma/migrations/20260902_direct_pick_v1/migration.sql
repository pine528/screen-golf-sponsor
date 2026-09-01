-- 직접 선택 PICK v1.0 — 오퍼 · 견적함 · 홀드 (핸드오프 v1.0 §4 · §6 · §7 · §12)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

CREATE TABLE IF NOT EXISTS "athlete_offer_products" (
  "id"            TEXT PRIMARY KEY,
  "athlete_id"    TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "type"          TEXT NOT NULL DEFAULT 'ONLINE_ONLY',
  "description"   TEXT,
  "price"         INTEGER NOT NULL,
  "unit"          TEXT NOT NULL DEFAULT 'MONTH',
  "min_months"    INTEGER NOT NULL DEFAULT 1,
  "offline_use"   BOOLEAN NOT NULL DEFAULT false,
  "online_use"    BOOLEAN NOT NULL DEFAULT true,
  "print_use"     BOOLEAN NOT NULL DEFAULT false,
  "secondary_use" BOOLEAN NOT NULL DEFAULT false,
  "capacity"      INTEGER NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_offer_products_athlete_id_code_key"
  ON "athlete_offer_products" ("athlete_id", "code");
CREATE INDEX IF NOT EXISTS "athlete_offer_products_athlete_id_is_active_idx"
  ON "athlete_offer_products" ("athlete_id", "is_active");

CREATE TABLE IF NOT EXISTS "direct_pick_drafts" (
  "id"               TEXT PRIMARY KEY,
  "brand_user_id"    TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'CONFIGURING',
  "revision"         INTEGER NOT NULL DEFAULT 1,
  "title"            TEXT,
  "budget"           INTEGER,
  "note"             TEXT,
  "quote_version"    TEXT,
  "quote_expires_at" TIMESTAMP(3),
  "application_id"   TEXT,
  "submitted_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "direct_pick_drafts_brand_user_id_updated_at_idx"
  ON "direct_pick_drafts" ("brand_user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "direct_pick_items" (
  "id"               TEXT PRIMARY KEY,
  "draft_id"         TEXT NOT NULL,
  "athlete_id"       TEXT NOT NULL,
  "kind"             TEXT NOT NULL DEFAULT 'OFFLINE_SLOT',
  "athlete_slot_id"  TEXT,
  "slot_code"        TEXT,
  "slot_name"        TEXT,
  "offer_product_id" TEXT,
  "duration_code"    TEXT NOT NULL DEFAULT 'SINGLE_EVENT',
  "months"           INTEGER NOT NULL DEFAULT 1,
  "start_date"       TIMESTAMP(3),
  "sale_mode"        TEXT NOT NULL DEFAULT 'BUY_NOW',
  "add_ons"          JSONB,
  "scopes"           JSONB,
  "base_price"       INTEGER NOT NULL DEFAULT 0,
  "duration_amount"  INTEGER NOT NULL DEFAULT 0,
  "add_on_amount"    INTEGER NOT NULL DEFAULT 0,
  "subtotal"         INTEGER NOT NULL DEFAULT 0,
  "status"           TEXT NOT NULL DEFAULT 'OK',
  "conflict_code"    TEXT,
  "conflict_note"    TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "direct_pick_items_draft_id_idx" ON "direct_pick_items" ("draft_id");
CREATE INDEX IF NOT EXISTS "direct_pick_items_athlete_id_idx" ON "direct_pick_items" ("athlete_id");

-- 임시 점유 — 항목당 1건, idempotencyKey 로 중복 요청을 흡수한다
CREATE TABLE IF NOT EXISTS "inventory_holds" (
  "id"              TEXT PRIMARY KEY,
  "draft_item_id"   TEXT NOT NULL,
  "athlete_slot_id" TEXT,
  "brand_user_id"   TEXT NOT NULL,
  "qty"             INTEGER NOT NULL DEFAULT 1,
  "expires_at"      TIMESTAMP(3) NOT NULL,
  "extended_at"     TIMESTAMP(3),
  "released_at"     TIMESTAMP(3),
  "idempotency_key" TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_holds_draft_item_id_key" ON "inventory_holds" ("draft_item_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_holds_idempotency_key_key" ON "inventory_holds" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "inventory_holds_athlete_slot_id_expires_at_idx"
  ON "inventory_holds" ("athlete_slot_id", "expires_at");

-- 외래키
DO $$ BEGIN
  ALTER TABLE "athlete_offer_products"
    ADD CONSTRAINT "athlete_offer_products_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "direct_pick_items"
    ADD CONSTRAINT "direct_pick_items_draft_id_fkey"
    FOREIGN KEY ("draft_id") REFERENCES "direct_pick_drafts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "direct_pick_items"
    ADD CONSTRAINT "direct_pick_items_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "direct_pick_items"
    ADD CONSTRAINT "direct_pick_items_offer_product_id_fkey"
    FOREIGN KEY ("offer_product_id") REFERENCES "athlete_offer_products"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_holds"
    ADD CONSTRAINT "inventory_holds_draft_item_id_fkey"
    FOREIGN KEY ("draft_item_id") REFERENCES "direct_pick_items"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_holds"
    ADD CONSTRAINT "inventory_holds_athlete_slot_id_fkey"
    FOREIGN KEY ("athlete_slot_id") REFERENCES "athlete_slots"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
