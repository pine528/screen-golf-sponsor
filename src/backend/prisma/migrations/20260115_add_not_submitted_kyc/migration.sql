-- Add NOT_SUBMITTED to KycStatus enum
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED' BEFORE 'PENDING';

-- Update default value for brands table
ALTER TABLE "brands" ALTER COLUMN "kyc_status" SET DEFAULT 'NOT_SUBMITTED';

-- Update default value for athletes table
ALTER TABLE "athletes" ALTER COLUMN "kyc_status" SET DEFAULT 'NOT_SUBMITTED';

-- Update existing brands where kycDocuments is null (never submitted) from PENDING to NOT_SUBMITTED
UPDATE "brands" SET "kyc_status" = 'NOT_SUBMITTED' WHERE "kyc_status" = 'PENDING' AND "kyc_documents" IS NULL;

-- Update existing athletes where kycDocuments is null (never submitted) from PENDING to NOT_SUBMITTED
UPDATE "athletes" SET "kyc_status" = 'NOT_SUBMITTED' WHERE "kyc_status" = 'PENDING' AND "kyc_documents" IS NULL;
