-- 개편 Phase 5 — 장기 파트너십 제안 (핸드오프 §14, WF-10)
DO $$ BEGIN
  CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT','SUBMITTED','ADMIN_REVIEW','ATHLETE_REVIEW','REVISION_REQUESTED','BRAND_REVISING','APPROVED','REJECTED','EXPIRED','CONTRACTING','CONTRACTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "proposals" (
  "id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "duration_type" "ProductDurationType" NOT NULL,
  "desired_slots" JSONB,
  "allow_alternative" BOOLEAN NOT NULL DEFAULT true,
  "min_appearances" INTEGER,
  "sns_activity" JSONB,
  "store_visits" JSONB,
  "corporate_events" JSONB,
  "content_shoots" JSONB,
  "image_usage_scope" TEXT,
  "image_usage_months" INTEGER,
  "allow_secondary_edit" BOOLEAN NOT NULL DEFAULT false,
  "allow_paid_media" BOOLEAN NOT NULL DEFAULT false,
  "category_exclusive" BOOLEAN NOT NULL DEFAULT false,
  "total_budget" INTEGER NOT NULL,
  "installment_plan" JSONB,
  "additional_costs" JSONB,
  "brand_note" TEXT,
  "review_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "contract_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proposals_brand_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE,
  CONSTRAINT "proposals_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "proposals_brand_id_status_idx" ON "proposals"("brand_id","status");
CREATE INDEX IF NOT EXISTS "proposals_athlete_id_status_idx" ON "proposals"("athlete_id","status");

-- §14 장기 제안은 6개월·12개월만 허용
DO $$ BEGIN
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_long_term_only"
    CHECK (duration_type IN ('MONTHS_6','MONTHS_12'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "proposal_histories" (
  "id" TEXT NOT NULL,
  "proposal_id" TEXT NOT NULL,
  "from_status" "ProposalStatus",
  "to_status" "ProposalStatus" NOT NULL,
  "actor_id" TEXT,
  "actor_role" TEXT,
  "note" TEXT,
  "changes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proposal_histories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proposal_histories_proposal_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "proposal_histories_proposal_id_created_at_idx" ON "proposal_histories"("proposal_id","created_at");
