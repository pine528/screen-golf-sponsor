-- 슬롯 판매 방식 3종 (경매 / 즉시구매 / 협의 문의)
DO $$ BEGIN
  CREATE TYPE "SlotSaleMode" AS ENUM ('AUCTION', 'DIRECT', 'INQUIRY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "slot_instances" ADD COLUMN IF NOT EXISTS "sale_mode" "SlotSaleMode" NOT NULL DEFAULT 'AUCTION';

-- 기존 데이터 정합화: 즉시구매 활성 슬롯은 DIRECT, 그 외 경매 활성은 AUCTION
UPDATE "slot_instances" SET "sale_mode" = 'DIRECT'
  WHERE "enable_direct_buy" = true AND "enable_auction" = false;
UPDATE "slot_instances" SET "sale_mode" = 'AUCTION'
  WHERE "enable_auction" = true;
