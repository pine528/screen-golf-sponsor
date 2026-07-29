-- 선수가 직접 프로필을 수정한 시각 (목록 UPDATE 뱃지 기준)
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "profile_updated_at" TIMESTAMP(3);
