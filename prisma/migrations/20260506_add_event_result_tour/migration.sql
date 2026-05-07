-- docx §9 F (경기결과/분석) — 각 대회별 표시 항목에 '투어명' 필수
-- AthleteEventResult.tour 컬럼 추가 (KLPGA / WGTOUR / GTOUR 등)
ALTER TABLE "athlete_event_results" ADD COLUMN "tour" TEXT;
