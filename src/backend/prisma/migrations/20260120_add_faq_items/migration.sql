-- FAQ System (자주 묻는 질문)

-- FaqCategory Enum
DO $$ BEGIN
    CREATE TYPE "FaqCategory" AS ENUM ('GENERAL', 'ACCOUNT', 'BIDDING', 'CONTRACT', 'PAYMENT', 'POINTS', 'SHOP', 'ATHLETE', 'BRAND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- FaqItem Table
CREATE TABLE IF NOT EXISTS "faq_items" (
    "id" TEXT NOT NULL,
    "category" "FaqCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "faq_items_category_is_published_order_index_idx" ON "faq_items"("category", "is_published", "order_index");
CREATE INDEX IF NOT EXISTS "faq_items_is_published_idx" ON "faq_items"("is_published");
