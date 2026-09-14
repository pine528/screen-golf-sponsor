-- 후원 신청 ↔ 캠페인 연결 (v2.1 §5 Payment → Campaign)
ALTER TABLE "sponsorship_applications" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;
CREATE INDEX IF NOT EXISTS "sponsorship_applications_campaign_id_idx" ON "sponsorship_applications"("campaign_id");
DO $$ BEGIN
  ALTER TABLE "sponsorship_applications"
    ADD CONSTRAINT "sponsorship_applications_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
