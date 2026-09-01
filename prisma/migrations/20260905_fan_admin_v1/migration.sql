-- 팬 운영 관리자 v1.0 (핸드오프 v1.0 2026-08-22 §18.2 A01~A12)
-- 운영 DB에 수기 적용 가능하도록 IF NOT EXISTS / DO 블록으로 멱등 처리한다.

-- 1) 콘텐츠 검수 큐 (A04)
CREATE TABLE IF NOT EXISTS "fan_moderation_items" (
  "id"             TEXT PRIMARY KEY,
  "target_type"    TEXT NOT NULL,
  "target_id"      TEXT NOT NULL,
  "author_user_id" TEXT,
  "athlete_id"     TEXT,
  "excerpt"        TEXT,
  "risk"           TEXT NOT NULL DEFAULT 'P2',
  "ai_score"       INTEGER,
  "policies"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "auto_result"    TEXT NOT NULL DEFAULT 'PENDING',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "sla_due_at"     TIMESTAMP(3),
  "decided_by"     TEXT,
  "decided_at"     TIMESTAMP(3),
  "decision_code"  TEXT,
  "decision_note"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_moderation_items_target_type_target_id_key"
  ON "fan_moderation_items" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "fan_moderation_items_status_risk_created_at_idx"
  ON "fan_moderation_items" ("status", "risk", "created_at");
CREATE INDEX IF NOT EXISTS "fan_moderation_items_sla_due_at_idx"
  ON "fan_moderation_items" ("sla_due_at");

-- 2) 신고 (A05)
CREATE TABLE IF NOT EXISTS "fan_reports" (
  "id"             TEXT PRIMARY KEY,
  "code"           TEXT NOT NULL,
  "reporter_id"    TEXT NOT NULL,
  "target_type"    TEXT NOT NULL,
  "target_id"      TEXT NOT NULL,
  "target_user_id" TEXT,
  "reason"         TEXT NOT NULL,
  "detail"         TEXT,
  "evidence_urls"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "risk"           TEXT NOT NULL DEFAULT 'P2',
  "status"         TEXT NOT NULL DEFAULT 'RECEIVED',
  "sla_due_at"     TIMESTAMP(3),
  "assigned_to"    TEXT,
  "memo"           TEXT,
  "closed_at"      TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_reports_code_key" ON "fan_reports" ("code");
CREATE INDEX IF NOT EXISTS "fan_reports_status_risk_created_at_idx"
  ON "fan_reports" ("status", "risk", "created_at");
CREATE INDEX IF NOT EXISTS "fan_reports_target_user_id_created_at_idx"
  ON "fan_reports" ("target_user_id", "created_at");

-- 3) 제재 (A05)
CREATE TABLE IF NOT EXISTS "fan_sanctions" (
  "id"          TEXT PRIMARY KEY,
  "report_id"   TEXT,
  "user_id"     TEXT NOT NULL,
  "level"       TEXT NOT NULL,
  "days"        INTEGER,
  "reason"      TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by"  TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "expires_at"  TIMESTAMP(3),
  "lifted_by"   TEXT,
  "lifted_at"   TIMESTAMP(3),
  "lift_reason" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fan_sanctions_user_id_status_idx"     ON "fan_sanctions" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "fan_sanctions_status_expires_at_idx"  ON "fan_sanctions" ("status", "expires_at");
DO $$ BEGIN
  ALTER TABLE "fan_sanctions" ADD CONSTRAINT "fan_sanctions_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "fan_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) 이의제기 (A05)
CREATE TABLE IF NOT EXISTS "fan_appeals" (
  "id"          TEXT PRIMARY KEY,
  "code"        TEXT NOT NULL,
  "report_id"   TEXT,
  "sanction_id" TEXT,
  "user_id"     TEXT NOT NULL,
  "statement"   TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'RECEIVED',
  "decided_by"  TEXT,
  "decided_at"  TIMESTAMP(3),
  "decision"    TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_appeals_code_key" ON "fan_appeals" ("code");
CREATE INDEX IF NOT EXISTS "fan_appeals_status_created_at_idx" ON "fan_appeals" ("status", "created_at");
DO $$ BEGIN
  ALTER TABLE "fan_appeals" ADD CONSTRAINT "fan_appeals_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "fan_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) 배치 실행 로그 (A01 · A06)
CREATE TABLE IF NOT EXISTS "fan_batch_runs" (
  "id"          TEXT PRIMARY KEY,
  "job"         TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'RUNNING',
  "started_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "processed"   INTEGER NOT NULL DEFAULT 0,
  "succeeded"   INTEGER NOT NULL DEFAULT 0,
  "failed"      INTEGER NOT NULL DEFAULT 0,
  "next_run_at" TIMESTAMP(3),
  "message"     TEXT
);
CREATE INDEX IF NOT EXISTS "fan_batch_runs_job_started_at_idx" ON "fan_batch_runs" ("job", "started_at");

-- 6) 팬온도 산식 버전 (A06)
CREATE TABLE IF NOT EXISTS "fan_temp_formulas" (
  "id"           TEXT PRIMARY KEY,
  "version"      TEXT NOT NULL,
  "weights"      JSONB NOT NULL,
  "min_sample"   INTEGER NOT NULL DEFAULT 30,
  "window_days"  INTEGER NOT NULL DEFAULT 30,
  "recent_boost" DOUBLE PRECISION NOT NULL DEFAULT 1.3,
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',
  "note"         TEXT,
  "effective_at" TIMESTAMP(3),
  "retired_at"   TIMESTAMP(3),
  "created_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fan_temp_formulas_version_key" ON "fan_temp_formulas" ("version");
CREATE INDEX IF NOT EXISTS "fan_temp_formulas_status_effective_at_idx"
  ON "fan_temp_formulas" ("status", "effective_at");

-- 7) 포인트 정책 버전 (A07)
CREATE TABLE IF NOT EXISTS "point_policy_versions" (
  "id"           TEXT PRIMARY KEY,
  "version"      TEXT NOT NULL,
  "earn_rules"   JSONB NOT NULL,
  "spend_rules"  JSONB NOT NULL,
  "expiry"       JSONB NOT NULL,
  "summary"      TEXT,
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "point_policy_versions_version_key" ON "point_policy_versions" ("version");
CREATE INDEX IF NOT EXISTS "point_policy_versions_status_published_at_idx"
  ON "point_policy_versions" ("status", "published_at");

-- 8) 포인트 캠페인 (A07)
CREATE TABLE IF NOT EXISTS "point_campaigns" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "total_budget" INTEGER NOT NULL,
  "per_user_cap" INTEGER NOT NULL,
  "spent"        INTEGER NOT NULL DEFAULT 0,
  "start_at"     TIMESTAMP(3) NOT NULL,
  "end_at"       TIMESTAMP(3) NOT NULL,
  "target"       TEXT NOT NULL DEFAULT 'ALL',
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',
  "created_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "point_campaigns_status_start_at_idx" ON "point_campaigns" ("status", "start_at");

-- 9) 수동 포인트 조정 (A08)
CREATE TABLE IF NOT EXISTS "point_adjustments" (
  "id"            TEXT PRIMARY KEY,
  "user_id"       TEXT NOT NULL,
  "delta"         INTEGER NOT NULL,
  "reason"        TEXT NOT NULL,
  "case_id"       TEXT NOT NULL,
  "evidence_url"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "requested_by"  TEXT NOT NULL,
  "approved_by"   TEXT,
  "approved_at"   TIMESTAMP(3),
  "applied_tx_id" TEXT,
  "reject_reason" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "point_adjustments_status_created_at_idx" ON "point_adjustments" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "point_adjustments_user_id_created_at_idx" ON "point_adjustments" ("user_id", "created_at");
