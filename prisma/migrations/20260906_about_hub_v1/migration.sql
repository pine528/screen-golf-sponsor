-- SPONPIK 소개 · 통합 콘텐츠 v1.0 (핸드오프 v1.0 2026-08-22)
-- 소개 CMS · 매칭사례 · 성과보장 · 파트너 브랜드 · 권리 관리
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

-- 1) 소개 페이지 CMS
CREATE TABLE IF NOT EXISTS "content_pages" (
  "id"           TEXT PRIMARY KEY,
  "slug"         TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "menu_label"   TEXT,
  "menu_desc"    TEXT,
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',
  "version"      INTEGER NOT NULL DEFAULT 1,
  "locale"       TEXT NOT NULL DEFAULT 'KO',
  "seo_title"    TEXT,
  "seo_desc"     TEXT,
  "og_image_url" TEXT,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "scheduled_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "published_by" TEXT,
  "updated_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_pages_slug_key" ON "content_pages" ("slug");
CREATE INDEX IF NOT EXISTS "content_pages_status_sort_order_idx" ON "content_pages" ("status", "sort_order");

CREATE TABLE IF NOT EXISTS "content_blocks" (
  "id"         TEXT PRIMARY KEY,
  "page_id"    TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "name"       TEXT,
  "payload"    JSONB NOT NULL,
  "visible"    BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "content_blocks_page_id_sort_order_idx" ON "content_blocks" ("page_id", "sort_order");
DO $$ BEGIN
  ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_page_id_fkey"
    FOREIGN KEY ("page_id") REFERENCES "content_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) 파트너 브랜드
CREATE TABLE IF NOT EXISTS "partner_brands" (
  "id"             TEXT PRIMARY KEY,
  "slug"           TEXT NOT NULL,
  "brand_id"       TEXT,
  "display_name"   TEXT NOT NULL,
  "legal_name"     TEXT,
  "category"       TEXT NOT NULL,
  "description"    TEXT,
  "website"        TEXT,
  "instagram"      TEXT,
  "store_url"      TEXT,
  "contact_email"  TEXT,
  "logo_light"     TEXT,
  "logo_dark"      TEXT,
  "hero_image_url" TEXT,
  "logo_alt"       TEXT,
  "status"         TEXT NOT NULL DEFAULT 'ONBOARDING',
  "featured"       BOOLEAN NOT NULL DEFAULT false,
  "sort_order"     INTEGER NOT NULL DEFAULT 0,
  "seo_title"      TEXT,
  "seo_desc"       TEXT,
  "published_at"   TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "partner_brands_slug_key" ON "partner_brands" ("slug");
CREATE INDEX IF NOT EXISTS "partner_brands_status_sort_order_idx" ON "partner_brands" ("status", "sort_order");

-- 3) 매칭사례
CREATE TABLE IF NOT EXISTS "matching_cases" (
  "id"               TEXT PRIMARY KEY,
  "slug"             TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "summary"          TEXT,
  "background"       TEXT,
  "partner_brand_id" TEXT,
  "athlete_id"       TEXT,
  "contract_id"      TEXT,
  "athlete_name"     TEXT,
  "brand_name"       TEXT,
  "sport"            TEXT,
  "tour"             TEXT,
  "sponsor_types"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "objective_codes"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "execution_blocks" JSONB,
  "timeline"         JSONB,
  "hero_image_url"   TEXT,
  "period_from"      TIMESTAMP(3),
  "period_to"        TIMESTAMP(3),
  "status"           TEXT NOT NULL DEFAULT 'DRAFT',
  "visibility"       TEXT NOT NULL DEFAULT 'PUBLIC_EXACT',
  "verified"         BOOLEAN NOT NULL DEFAULT false,
  "featured"         BOOLEAN NOT NULL DEFAULT false,
  "sort_order"       INTEGER NOT NULL DEFAULT 0,
  "assignee_id"      TEXT,
  "scheduled_at"     TIMESTAMP(3),
  "published_at"     TIMESTAMP(3),
  "archived_at"      TIMESTAMP(3),
  "hold_reason"      TEXT,
  "created_by"       TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "matching_cases_slug_key" ON "matching_cases" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "matching_cases_code_key" ON "matching_cases" ("code");
CREATE INDEX IF NOT EXISTS "matching_cases_status_published_at_idx" ON "matching_cases" ("status", "published_at");
CREATE INDEX IF NOT EXISTS "matching_cases_partner_brand_id_idx"    ON "matching_cases" ("partner_brand_id");
CREATE INDEX IF NOT EXISTS "matching_cases_athlete_id_idx"          ON "matching_cases" ("athlete_id");
DO $$ BEGIN
  ALTER TABLE "matching_cases" ADD CONSTRAINT "matching_cases_partner_brand_id_fkey"
    FOREIGN KEY ("partner_brand_id") REFERENCES "partner_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) 사례 성과 지표
CREATE TABLE IF NOT EXISTS "case_metrics" (
  "id"                  TEXT PRIMARY KEY,
  "case_id"             TEXT NOT NULL,
  "metric_code"         TEXT NOT NULL,
  "label"               TEXT NOT NULL,
  "definition"          TEXT,
  "definition_version"  TEXT,
  "value"               DOUBLE PRECISION NOT NULL,
  "unit"                TEXT NOT NULL,
  "display_value"       TEXT,
  "period_start"        TIMESTAMP(3),
  "period_end"          TIMESTAMP(3),
  "source_type"         TEXT NOT NULL,
  "source_name"         TEXT,
  "source_id"           TEXT,
  "evidence_uri"        TEXT,
  "aggregation_note"    TEXT,
  "verification_status" TEXT NOT NULL DEFAULT 'RAW',
  "verified_at"         TIMESTAMP(3),
  "verified_by"         TEXT,
  "visibility"          TEXT NOT NULL DEFAULT 'MEMBER_ONLY',
  "is_primary"          BOOLEAN NOT NULL DEFAULT false,
  "sort_order"          INTEGER NOT NULL DEFAULT 0,
  "observed_at"         TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "case_metrics_case_id_sort_order_idx" ON "case_metrics" ("case_id", "sort_order");
DO $$ BEGIN
  ALTER TABLE "case_metrics" ADD CONSTRAINT "case_metrics_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "matching_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) 사례 인용문 · 당사자 승인
CREATE TABLE IF NOT EXISTS "case_quotes" (
  "id"          TEXT PRIMARY KEY,
  "case_id"     TEXT NOT NULL,
  "speaker"     TEXT NOT NULL,
  "author_name" TEXT NOT NULL,
  "author_role" TEXT,
  "avatar_url"  TEXT,
  "content"     TEXT NOT NULL,
  "approved"    BOOLEAN NOT NULL DEFAULT false,
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "case_quotes_case_id_idx" ON "case_quotes" ("case_id");
DO $$ BEGIN
  ALTER TABLE "case_quotes" ADD CONSTRAINT "case_quotes_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "matching_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "case_approvals" (
  "id"           TEXT PRIMARY KEY,
  "case_id"      TEXT NOT NULL,
  "party"        TEXT NOT NULL,
  "party_id"     TEXT,
  "party_name"   TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "comment"      TEXT,
  "item_status"  JSONB,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewed_at"    TIMESTAMP(3),
  "responded_at" TIMESTAMP(3),
  "expires_at"   TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "case_approvals_case_id_party_key" ON "case_approvals" ("case_id", "party");
CREATE INDEX IF NOT EXISTS "case_approvals_status_expires_at_idx"    ON "case_approvals" ("status", "expires_at");
DO $$ BEGIN
  ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "matching_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) 권리 (초상·로고·인용)
CREATE TABLE IF NOT EXISTS "rights_grants" (
  "id"               TEXT PRIMARY KEY,
  "asset_type"       TEXT NOT NULL,
  "asset_name"       TEXT NOT NULL,
  "asset_url"        TEXT,
  "thumbnail_url"    TEXT,
  "holder_type"      TEXT NOT NULL,
  "holder_name"      TEXT NOT NULL,
  "athlete_id"       TEXT,
  "partner_brand_id" TEXT,
  "allowed_scopes"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowed_region"   TEXT,
  "evidence_url"     TEXT,
  "evidence_name"    TEXT,
  "valid_from"       TIMESTAMP(3),
  "valid_to"         TIMESTAMP(3),
  "status"           TEXT NOT NULL DEFAULT 'VALID',
  "owner_team"       TEXT,
  "manager_name"     TEXT,
  "manager_contact"  TEXT,
  "used_in"          JSONB,
  "note"             TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "rights_grants_status_valid_to_idx" ON "rights_grants" ("status", "valid_to");
CREATE INDEX IF NOT EXISTS "rights_grants_athlete_id_idx"      ON "rights_grants" ("athlete_id");
DO $$ BEGIN
  ALTER TABLE "rights_grants" ADD CONSTRAINT "rights_grants_partner_brand_id_fkey"
    FOREIGN KEY ("partner_brand_id") REFERENCES "partner_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7) 성과보장 정책 · 계약 스냅샷
CREATE TABLE IF NOT EXISTS "guarantee_policies" (
  "id"                     TEXT PRIMARY KEY,
  "version"                TEXT NOT NULL,
  "summary"                TEXT,
  "eligible_product_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "qualification_rules"    JSONB NOT NULL,
  "metric_rules"           JSONB NOT NULL,
  "judge_mode"             TEXT NOT NULL DEFAULT 'ALL',
  "min_score"              DOUBLE PRECISION,
  "remedy_rules"           JSONB NOT NULL,
  "exclusions"             JSONB,
  "appeal_window_days"     INTEGER NOT NULL DEFAULT 14,
  "status"                 TEXT NOT NULL DEFAULT 'DRAFT',
  "effective_from"         TIMESTAMP(3),
  "effective_to"           TIMESTAMP(3),
  "legal_approved_by"      TEXT,
  "legal_approved_at"      TIMESTAMP(3),
  "created_by"             TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "guarantee_policies_version_key" ON "guarantee_policies" ("version");
CREATE INDEX IF NOT EXISTS "guarantee_policies_status_effective_from_idx"
  ON "guarantee_policies" ("status", "effective_from");

CREATE TABLE IF NOT EXISTS "guarantee_snapshots" (
  "id"                 TEXT PRIMARY KEY,
  "policy_id"          TEXT NOT NULL,
  "policy_version"     TEXT NOT NULL,
  "contract_id"        TEXT,
  "application_id"     TEXT,
  "brand_id"           TEXT,
  "athlete_id"         TEXT,
  "brand_name"         TEXT,
  "athlete_name"       TEXT,
  "contract_amount"    INTEGER,
  "kpi_targets"        JSONB NOT NULL,
  "judge_mode"         TEXT NOT NULL DEFAULT 'ALL',
  "min_score"          DOUBLE PRECISION,
  "remedy_rules"       JSONB NOT NULL,
  "exclusions"         JSONB,
  "measure_start"      TIMESTAMP(3),
  "measure_end"        TIMESTAMP(3),
  "appeal_window_days" INTEGER NOT NULL DEFAULT 14,
  "status"             TEXT NOT NULL DEFAULT 'ELIGIBLE',
  "judged_at"          TIMESTAMP(3),
  "judged_by"          TEXT,
  "finalized_at"       TIMESTAMP(3),
  "final_snapshot"     JSONB,
  "locked_at"          TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "guarantee_snapshots_status_measure_end_idx" ON "guarantee_snapshots" ("status", "measure_end");
CREATE INDEX IF NOT EXISTS "guarantee_snapshots_brand_id_status_idx"    ON "guarantee_snapshots" ("brand_id", "status");
DO $$ BEGIN
  ALTER TABLE "guarantee_snapshots" ADD CONSTRAINT "guarantee_snapshots_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "guarantee_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) KPI 관측치
CREATE TABLE IF NOT EXISTS "guarantee_observations" (
  "id"                  TEXT PRIMARY KEY,
  "snapshot_id"         TEXT NOT NULL,
  "metric_code"         TEXT NOT NULL,
  "label"               TEXT NOT NULL,
  "target"              DOUBLE PRECISION NOT NULL,
  "actual"              DOUBLE PRECISION,
  "unit"                TEXT NOT NULL,
  "weight"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "required"            BOOLEAN NOT NULL DEFAULT true,
  "source_name"         TEXT,
  "evidence_uri"        TEXT,
  "collect_status"      TEXT NOT NULL DEFAULT 'PENDING',
  "judgement"           TEXT NOT NULL DEFAULT 'DATA_PENDING',
  "exclude_reason"      TEXT,
  "exclude_approved_by" TEXT,
  "provisional"         BOOLEAN NOT NULL DEFAULT true,
  "next_check_at"       TIMESTAMP(3),
  "observed_at"         TIMESTAMP(3),
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "guarantee_observations_snapshot_id_metric_code_key"
  ON "guarantee_observations" ("snapshot_id", "metric_code");
DO $$ BEGIN
  ALTER TABLE "guarantee_observations" ADD CONSTRAINT "guarantee_observations_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "guarantee_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9) 이의제기 · 보완지원
CREATE TABLE IF NOT EXISTS "guarantee_appeals" (
  "id"             TEXT PRIMARY KEY,
  "code"           TEXT NOT NULL,
  "snapshot_id"    TEXT NOT NULL,
  "brand_user_id"  TEXT,
  "reason"         TEXT NOT NULL,
  "evidence_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attachments"    JSONB,
  "attested"       BOOLEAN NOT NULL DEFAULT false,
  "status"         TEXT NOT NULL DEFAULT 'RECEIVED',
  "sla_due_at"     TIMESTAMP(3),
  "assignee_id"    TEXT,
  "decision_type"  TEXT,
  "decision_code"  TEXT,
  "decision_note"  TEXT,
  "decided_by"     TEXT,
  "decided_at"     TIMESTAMP(3),
  "approved_by"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "guarantee_appeals_code_key" ON "guarantee_appeals" ("code");
CREATE INDEX IF NOT EXISTS "guarantee_appeals_status_sla_due_at_idx" ON "guarantee_appeals" ("status", "sla_due_at");
DO $$ BEGIN
  ALTER TABLE "guarantee_appeals" ADD CONSTRAINT "guarantee_appeals_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "guarantee_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "remedy_grants" (
  "id"            TEXT PRIMARY KEY,
  "code"          TEXT NOT NULL,
  "snapshot_id"   TEXT NOT NULL,
  "brand_id"      TEXT,
  "ratio"         DOUBLE PRECISION NOT NULL,
  "cap_amount"    INTEGER NOT NULL,
  "issued_amount" INTEGER NOT NULL,
  "used_amount"   INTEGER NOT NULL DEFAULT 0,
  "status"        TEXT NOT NULL DEFAULT 'RESERVED',
  "valid_from"    TIMESTAMP(3),
  "valid_to"      TIMESTAMP(3),
  "reference_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "issued_by"     TEXT,
  "approved_by"   TEXT,
  "note"          TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "remedy_grants_code_key" ON "remedy_grants" ("code");
CREATE INDEX IF NOT EXISTS "remedy_grants_status_valid_to_idx"  ON "remedy_grants" ("status", "valid_to");
CREATE INDEX IF NOT EXISTS "remedy_grants_brand_id_status_idx"  ON "remedy_grants" ("brand_id", "status");
DO $$ BEGIN
  ALTER TABLE "remedy_grants" ADD CONSTRAINT "remedy_grants_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "guarantee_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10) 소개 분석 이벤트 (개인 식별자 저장 금지)
CREATE TABLE IF NOT EXISTS "about_analytics_events" (
  "id"          TEXT PRIMARY KEY,
  "event"       TEXT NOT NULL,
  "page_slug"   TEXT,
  "visitor_key" TEXT,
  "role"        TEXT,
  "params"      JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "about_analytics_events_event_created_at_idx"     ON "about_analytics_events" ("event", "created_at");
CREATE INDEX IF NOT EXISTS "about_analytics_events_page_slug_created_at_idx" ON "about_analytics_events" ("page_slug", "created_at");
