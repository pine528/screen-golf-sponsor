-- 추천 PICK 신청·승인 (핸드오프 v1.0 §9 · §14.2)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

DO $$ BEGIN
  CREATE TYPE "SponsorshipApplicationStatus" AS ENUM (
    'DRAFT','SUBMITTED','PARTIAL_APPROVAL','APPROVED','REJECTED','PAYMENT_PENDING','ACTIVE','EXPIRED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApplicationItemStatus" AS ENUM ('PENDING','APPROVED','NEEDS_REVISION','REJECTED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sponsorship_applications" (
  "id"              TEXT PRIMARY KEY,
  "brand_user_id"   TEXT NOT NULL,
  "brand_id"        TEXT,
  "source_type"     TEXT NOT NULL DEFAULT 'RECOMMEND_PICK',
  "source_id"       TEXT,
  "plan_key"        TEXT,
  "plan_name"       TEXT,
  "status"          "SponsorshipApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "total_amount"    INTEGER NOT NULL DEFAULT 0,
  "vat_amount"      INTEGER NOT NULL DEFAULT 0,
  "duration_months" INTEGER NOT NULL DEFAULT 1,
  "snapshot"        JSONB,
  "submitted_at"    TIMESTAMP(3),
  "approval_due_at" TIMESTAMP(3),
  "paid_at"         TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sponsorship_applications_brand_user_id_created_at_idx"
  ON "sponsorship_applications" ("brand_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "sponsorship_applications_status_idx"
  ON "sponsorship_applications" ("status");

CREATE TABLE IF NOT EXISTS "application_items" (
  "id"               TEXT PRIMARY KEY,
  "application_id"   TEXT NOT NULL,
  "athlete_id"       TEXT NOT NULL,
  "slot_instance_id" TEXT,
  "slot_code"        TEXT,
  "slot_name"        TEXT,
  "role"             TEXT,
  "price"            INTEGER NOT NULL DEFAULT 0,
  "status"           "ApplicationItemStatus" NOT NULL DEFAULT 'PENDING',
  "reason_code"      TEXT,
  "comment"          TEXT,
  "reviewed_at"      TIMESTAMP(3),
  "reviewed_by"      TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "application_items_application_id_idx"
  ON "application_items" ("application_id");
CREATE INDEX IF NOT EXISTS "application_items_athlete_id_status_idx"
  ON "application_items" ("athlete_id", "status");

CREATE TABLE IF NOT EXISTS "application_reviews" (
  "id"             TEXT PRIMARY KEY,
  "application_id" TEXT NOT NULL,
  "item_id"        TEXT,
  "actor_id"       TEXT,
  "actor_role"     TEXT,
  "action"         TEXT NOT NULL,
  "reason_code"    TEXT,
  "comment"        TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "application_reviews_application_id_created_at_idx"
  ON "application_reviews" ("application_id", "created_at");

-- 외래키 (중복 생성 방지)
DO $$ BEGIN
  ALTER TABLE "application_items"
    ADD CONSTRAINT "application_items_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "sponsorship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "application_items"
    ADD CONSTRAINT "application_items_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "application_reviews"
    ADD CONSTRAINT "application_reviews_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "sponsorship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
