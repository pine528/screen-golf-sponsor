-- 개편 Phase 3 (BUY-02) — 슬롯 임시예약 점유 브랜드
ALTER TABLE "slot_inventories" ADD COLUMN IF NOT EXISTS "held_by_brand_id" TEXT;
CREATE INDEX IF NOT EXISTS "slot_inventories_slot_instance_id_idx" ON "slot_inventories"("slot_instance_id");
