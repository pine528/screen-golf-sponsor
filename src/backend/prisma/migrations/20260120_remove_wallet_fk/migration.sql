-- Remove incorrect foreign key constraints from wallets table
-- These FKs are causing issues because ownerId can reference either Brand OR Athlete, not both

-- Drop the athlete FK constraint
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallet_athlete_fk";

-- Drop the brand FK constraint
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallet_brand_fk";
