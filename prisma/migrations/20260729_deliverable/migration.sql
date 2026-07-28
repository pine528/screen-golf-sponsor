-- 개편 Phase 6 — 이행·증빙 (OPS-01~08)
DO $$ BEGIN
  CREATE TYPE "DeliverableType" AS ENUM ('APPAREL_WEAR','APPEARANCE','SNS_FEED','SNS_STORY','SNS_REELS','STORE_VISIT','CORPORATE_EVENT','CONTENT_SHOOT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING','IN_PROGRESS','SUBMITTED','APPROVED','REJECTED','SUBSTITUTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubstitutionType" AS ENUM ('CARRY_OVER','ALTERNATE_SLOT','SNS_CONTENT','PARTIAL_REFUND','FULL_REFUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubstitutionStatus" AS ENUM ('REQUESTED','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "deliverables" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT,
  "proposal_id" TEXT,
  "athlete_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "type" "DeliverableType" NOT NULL,
  "title" TEXT NOT NULL,
  "target_count" INTEGER NOT NULL DEFAULT 1,
  "completed_count" INTEGER NOT NULL DEFAULT 0,
  "due_date" TIMESTAMP(3),
  "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "substitution_type" "SubstitutionType",
  "substitution_status" "SubstitutionStatus",
  "substitution_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deliverables_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE,
  CONSTRAINT "deliverables_brand_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "deliverables_athlete_id_status_idx" ON "deliverables"("athlete_id","status");
CREATE INDEX IF NOT EXISTS "deliverables_brand_id_status_idx" ON "deliverables"("brand_id","status");
CREATE INDEX IF NOT EXISTS "deliverables_proposal_id_idx" ON "deliverables"("proposal_id");

CREATE TABLE IF NOT EXISTS "deliverable_evidence" (
  "id" TEXT NOT NULL,
  "deliverable_id" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" TEXT,
  "link_url" TEXT,
  "captured_at" TIMESTAMP(3),
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "review_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deliverable_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deliverable_evidence_deliverable_fk" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "deliverable_evidence_deliverable_id_status_idx" ON "deliverable_evidence"("deliverable_id","status");
