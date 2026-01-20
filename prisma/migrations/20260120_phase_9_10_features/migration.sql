-- Phase 9 & 10: Direct Buy, Auction Reserve, Topup, Refund, Reconciliation, Withdrawal

-- =============================================
-- Enum Extensions
-- =============================================

-- SlotStatus: Add RESERVED
ALTER TYPE "SlotStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

-- LedgerTxType: Add new types
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'DIRECT_BUY_RESERVE';
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'DIRECT_BUY_RESERVE_RELEASE';
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'AUCTION_BID_RESERVE';
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'AUCTION_BID_RESERVE_RELEASE';
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'TOPUP_DEPOSIT';
ALTER TYPE "LedgerTxType" ADD VALUE IF NOT EXISTS 'TOPUP_REFUND';

-- =============================================
-- New Enums for Phase 10
-- =============================================

-- PaymentProvider
DO $$ BEGIN
    CREATE TYPE "PaymentProvider" AS ENUM ('TOSS', 'STRIPE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TopupPaymentStatus
DO $$ BEGIN
    CREATE TYPE "TopupPaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED', 'CHARGEBACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RefundStatus
DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RefundRequestStatus
DO $$ BEGIN
    CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- WebhookEventStatus
DO $$ BEGIN
    CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ReconciliationScope
DO $$ BEGIN
    CREATE TYPE "ReconciliationScope" AS ENUM ('FULL', 'CRITICAL_ONLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ReconciliationRunStatus
DO $$ BEGIN
    CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ReconciliationIssueSeverity
DO $$ BEGIN
    CREATE TYPE "ReconciliationIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ReconciliationIssueType
DO $$ BEGIN
    CREATE TYPE "ReconciliationIssueType" AS ENUM ('TOPUP_PAID_NO_LEDGER', 'LEDGER_TOPUP_NO_PAID', 'REFUND_REFUNDED_NO_LEDGER', 'LEDGER_REFUND_NO_REQUEST', 'REFUNDED_AMOUNT_MISMATCH', 'WALLET_NEGATIVE', 'VERSION_CONFLICT_SPIKE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ReconciliationIssueStatus
DO $$ BEGIN
    CREATE TYPE "ReconciliationIssueStatus" AS ENUM ('OPEN', 'ACKED', 'RESOLVED', 'IGNORED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- WithdrawalStatus
DO $$ BEGIN
    CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- WithdrawalBatchStatus
DO $$ BEGIN
    CREATE TYPE "WithdrawalBatchStatus" AS ENUM ('CREATED', 'EXPORTED', 'COMPLETED', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Alter Existing Tables
-- =============================================

-- slot_instances: Add sale mode fields
ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "enable_auction" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "enable_direct_buy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "direct_buy_price" DECIMAL(18, 0);
ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "auction_min_bid" DECIMAL(18, 0);
ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "auction_end_at" TIMESTAMP(3);

-- bids: Add frozen amount for auction reserve
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "frozen_amount" DECIMAL(18, 0);

-- contracts: Add reserved_until for Direct Buy/Auction reserve expiry
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "reserved_until" TIMESTAMP(3);

-- =============================================
-- New Tables: Phase 10-1 (Topup)
-- =============================================

CREATE TABLE IF NOT EXISTS "topup_payments" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "brand_user_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "amount" DECIMAL(18, 0) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "status" "TopupPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "provider" "PaymentProvider" NOT NULL,
    "provider_payment_key" TEXT,
    "provider_order_id" TEXT,
    "checkout_url" TEXT,
    "checkout_expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "failure_code" TEXT,
    "raw_payload" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "refunded_amount" DECIMAL(18, 0) NOT NULL DEFAULT 0,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "last_refund_at" TIMESTAMP(3),
    "chargeback_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topup_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "topup_payments_provider_payment_key_key" ON "topup_payments"("provider_payment_key");
CREATE UNIQUE INDEX IF NOT EXISTS "topup_payments_provider_order_id_key" ON "topup_payments"("provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "topup_payments_wallet_id_idempotency_key_key" ON "topup_payments"("wallet_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "topup_payments_brand_user_id_status_created_at_idx" ON "topup_payments"("brand_user_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "topup_payments_provider_provider_payment_key_idx" ON "topup_payments"("provider", "provider_payment_key");

ALTER TABLE "topup_payments" DROP CONSTRAINT IF EXISTS "topup_payments_wallet_id_fkey";
ALTER TABLE "topup_payments" ADD CONSTRAINT "topup_payments_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- New Tables: Phase 10-2 (Refund)
-- =============================================

CREATE TABLE IF NOT EXISTS "refund_requests" (
    "id" TEXT NOT NULL,
    "topup_payment_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" DECIMAL(18, 0) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "provider_refund_id" TEXT,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "failure_reason" TEXT,
    "raw_payload" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refund_requests_provider_refund_id_key" ON "refund_requests"("provider_refund_id");
CREATE UNIQUE INDEX IF NOT EXISTS "refund_requests_topup_payment_id_idempotency_key_key" ON "refund_requests"("topup_payment_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "refund_requests_wallet_id_status_created_at_idx" ON "refund_requests"("wallet_id", "status", "created_at");

ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_topup_payment_id_fkey";
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_topup_payment_id_fkey" FOREIGN KEY ("topup_payment_id") REFERENCES "topup_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_wallet_id_fkey";
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- New Tables: Phase 10-3 (Reconciliation)
-- =============================================

CREATE TABLE IF NOT EXISTS "webhook_event_logs" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "provider_payment_key" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error_message" TEXT,
    "raw_payload" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_event_logs_provider_event_id_key" ON "webhook_event_logs"("provider", "event_id");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_provider_event_type_created_at_idx" ON "webhook_event_logs"("provider", "event_type", "created_at");
CREATE INDEX IF NOT EXISTS "webhook_event_logs_status_created_at_idx" ON "webhook_event_logs"("status", "created_at");

CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "scope" "ReconciliationScope" NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "total_checked" INTEGER NOT NULL DEFAULT 0,
    "issues_found" INTEGER NOT NULL DEFAULT 0,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reconciliation_runs_status_started_at_idx" ON "reconciliation_runs"("status", "started_at");

CREATE TABLE IF NOT EXISTS "reconciliation_issues" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "severity" "ReconciliationIssueSeverity" NOT NULL,
    "issue_type" "ReconciliationIssueType" NOT NULL,
    "related_topup_id" TEXT,
    "related_refund_id" TEXT,
    "related_wallet_id" TEXT,
    "detail" JSONB,
    "status" "ReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reconciliation_issues_run_id_severity_idx" ON "reconciliation_issues"("run_id", "severity");
CREATE INDEX IF NOT EXISTS "reconciliation_issues_issue_type_status_idx" ON "reconciliation_issues"("issue_type", "status");
CREATE INDEX IF NOT EXISTS "reconciliation_issues_status_created_at_idx" ON "reconciliation_issues"("status", "created_at");

ALTER TABLE "reconciliation_issues" DROP CONSTRAINT IF EXISTS "reconciliation_issues_run_id_fkey";
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- New Tables: Withdrawal System
-- =============================================

CREATE TABLE IF NOT EXISTS "withdrawal_batches" (
    "id" TEXT NOT NULL,
    "status" "WithdrawalBatchStatus" NOT NULL DEFAULT 'CREATED',
    "total_amount" DECIMAL(18, 0) NOT NULL,
    "item_count" INTEGER NOT NULL,
    "created_by_admin_id" TEXT NOT NULL,
    "exported_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "proof_url" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "withdrawal_batches_status_created_at_idx" ON "withdrawal_batches"("status", "created_at");

CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "amount" DECIMAL(18, 0) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "bank_name" TEXT NOT NULL,
    "bank_account_masked" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "bank_account_encrypted" TEXT,
    "bank_account_iv" TEXT,
    "bank_account_tag" TEXT,
    "bank_account_last4" TEXT,
    "requested_reason" TEXT,
    "admin_note" TEXT,
    "payout_reference" TEXT,
    "proof_url" TEXT,
    "proof_uploaded_at" TIMESTAMP(3),
    "approved_by_admin_id" TEXT,
    "rejected_by_admin_id" TEXT,
    "paid_by_admin_id" TEXT,
    "batch_id" TEXT,
    "idempotency_key" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_idempotency_key_key" ON "withdrawal_requests"("idempotency_key");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_wallet_id_status_created_at_idx" ON "withdrawal_requests"("wallet_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_athlete_id_status_idx" ON "withdrawal_requests"("athlete_id", "status");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_created_at_idx" ON "withdrawal_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_batch_id_idx" ON "withdrawal_requests"("batch_id");

ALTER TABLE "withdrawal_requests" DROP CONSTRAINT IF EXISTS "withdrawal_requests_wallet_id_fkey";
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "withdrawal_requests" DROP CONSTRAINT IF EXISTS "withdrawal_requests_athlete_id_fkey";
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "withdrawal_requests" DROP CONSTRAINT IF EXISTS "withdrawal_requests_batch_id_fkey";
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "withdrawal_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
