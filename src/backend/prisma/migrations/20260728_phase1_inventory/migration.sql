-- 2026-07 전면 개편 Phase 1 — 슬롯 인벤토리·후원상품 (핸드오프 §18)
DO $$ BEGIN CREATE TYPE "SlotInventoryStatus" AS ENUM ('AVAILABLE','AUCTION_ACTIVE','HELD','SOLD','RESTRICTED','PENDING_APPROVAL','UNAVAILABLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductDurationType" AS ENUM ('SINGLE_EVENT','DAYS_30','MONTHS_6','MONTHS_12'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductType" AS ENUM ('APPAREL','SNS','STORE','EVENT_CONTENT','BUNDLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductTransactionType" AS ENUM ('AUCTION','BUY_NOW','PROPOSAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductApprovalStatus" AS ENUM ('DRAFT','PENDING_ATHLETE','PENDING_ADMIN','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "slot_templates" ADD COLUMN IF NOT EXISTS "display_x" DOUBLE PRECISION;
ALTER TABLE "slot_templates" ADD COLUMN IF NOT EXISTS "display_y" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "athlete_slots" (
  "id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "slot_template_id" TEXT NOT NULL,
  "custom_name" TEXT,
  "base_price" INTEGER NOT NULL,
  "base_grade" TEXT,
  "sale_enabled" BOOLEAN NOT NULL DEFAULT true,
  "approval_required" BOOLEAN NOT NULL DEFAULT false,
  "restriction_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "athlete_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "athlete_slots_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE,
  CONSTRAINT "athlete_slots_template_fk" FOREIGN KEY ("slot_template_id") REFERENCES "slot_templates"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_slots_athlete_id_slot_template_id_key" ON "athlete_slots"("athlete_id","slot_template_id");

CREATE TABLE IF NOT EXISTS "sponsorship_products" (
  "id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "duration_type" "ProductDurationType" NOT NULL,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "product_type" "ProductType" NOT NULL DEFAULT 'APPAREL',
  "transaction_type" "ProductTransactionType" NOT NULL DEFAULT 'BUY_NOW',
  "base_price" INTEGER NOT NULL DEFAULT 0,
  "buy_now_price" INTEGER,
  "auction_start_price" INTEGER,
  "min_bid_increment" INTEGER,
  "reserve_price" INTEGER,
  "min_appearance_count" INTEGER,
  "sns_deliverables" JSONB,
  "store_deliverables" JSONB,
  "event_deliverables" JSONB,
  "content_usage_rights" JSONB,
  "category_exclusivity" TEXT,
  "replacement_policy" TEXT,
  "approval_status" "ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "publication_status" TEXT NOT NULL DEFAULT 'PUBLIC',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sponsorship_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsorship_products_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "sponsorship_products_athlete_id_publication_status_idx" ON "sponsorship_products"("athlete_id","publication_status");

CREATE TABLE IF NOT EXISTS "slot_inventories" (
  "id" TEXT NOT NULL,
  "athlete_slot_id" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "status" "SlotInventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
  "reserved_until" TIMESTAMP(3),
  "contract_id" TEXT,
  "auction_id" TEXT,
  "product_id" TEXT,
  "slot_instance_id" TEXT,
  "restriction_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slot_inventories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "slot_inventories_athlete_slot_fk" FOREIGN KEY ("athlete_slot_id") REFERENCES "athlete_slots"("id") ON DELETE CASCADE,
  CONSTRAINT "slot_inventories_product_fk" FOREIGN KEY ("product_id") REFERENCES "sponsorship_products"("id")
);
CREATE INDEX IF NOT EXISTS "slot_inventories_athlete_slot_id_start_date_end_date_idx" ON "slot_inventories"("athlete_slot_id","start_date","end_date");
CREATE INDEX IF NOT EXISTS "slot_inventories_status_idx" ON "slot_inventories"("status");

CREATE TABLE IF NOT EXISTS "product_slots" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "athlete_slot_id" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "additional_price" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_slots_product_fk" FOREIGN KEY ("product_id") REFERENCES "sponsorship_products"("id") ON DELETE CASCADE,
  CONSTRAINT "product_slots_athlete_slot_fk" FOREIGN KEY ("athlete_slot_id") REFERENCES "athlete_slots"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_slots_product_id_athlete_slot_id_key" ON "product_slots"("product_id","athlete_slot_id");
