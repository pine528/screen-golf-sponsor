-- AI 간편 매칭 (핸드오프 v1.0) — 요청 + 추천 스냅샷
CREATE TABLE IF NOT EXISTS "ai_match_requests" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "input" JSONB NOT NULL,
  "results" JSONB,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_match_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_match_requests_user_id_created_at_idx" ON "ai_match_requests"("user_id", "created_at");
