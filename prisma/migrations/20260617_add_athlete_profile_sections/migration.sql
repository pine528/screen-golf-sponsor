-- SPONPIK 선수 프로필 구조화 — bio 줄글을 항목별로 분리
-- 소속(affiliation, 기존) / 학력(education) / 수상(awards) / 경력(career)
-- 모두 nullable TEXT (기존 데이터는 bio 폴백으로 하위호환)

ALTER TABLE "athletes" ADD COLUMN "education" TEXT;
ALTER TABLE "athletes" ADD COLUMN "awards" TEXT;
ALTER TABLE "athletes" ADD COLUMN "career" TEXT;
