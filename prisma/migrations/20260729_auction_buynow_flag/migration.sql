-- 개편 Phase 4 (AUC-12, §12.5) — 첫 입찰 이후 즉시구매 병행 유지 여부 (관리자 예외)
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "allow_buy_now_after_bid" BOOLEAN NOT NULL DEFAULT false;

-- §12.5 6개월·12개월 상품에는 경매를 적용할 수 없다 (누가 쓰든 지켜지도록 DB 제약으로 고정)
DO $$ BEGIN
  ALTER TABLE "sponsorship_products"
    ADD CONSTRAINT "sponsorship_products_no_auction_for_long_term"
    CHECK (NOT (duration_type IN ('MONTHS_6','MONTHS_12') AND transaction_type = 'AUCTION'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
