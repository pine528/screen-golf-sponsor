-- docx §6 C-1, C-3 미구현 항목 보강 — 3개 신규 테이블

-- AthleteMediaExposure: 방송/패치/하이라이트 등 미디어 노출 (관리자 수동 입력 우선, 자동 수집 후속)
CREATE TABLE "athlete_media_exposures" (
  "id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "broadcast_count" INTEGER NOT NULL DEFAULT 0,
  "broadcast_seconds" INTEGER NOT NULL DEFAULT 0,
  "patch_exposure_estimate" INTEGER NOT NULL DEFAULT 0,
  "article_mentions" INTEGER NOT NULL DEFAULT 0,
  "highlight_count" INTEGER NOT NULL DEFAULT 0,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "athlete_media_exposures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "athlete_media_exposures_athlete_id_period_end_idx" ON "athlete_media_exposures"("athlete_id", "period_end" DESC);
ALTER TABLE "athlete_media_exposures" ADD CONSTRAINT "athlete_media_exposures_athlete_id_fkey"
  FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AthleteFollowerSnapshot: 일별 팔로워 스냅샷 (증가율 계산용 cron)
CREATE TABLE "athlete_follower_snapshots" (
  "id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "follower_count" INTEGER NOT NULL,
  "total_views" BIGINT,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "athlete_follower_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "athlete_follower_snapshots_athlete_id_source_captured_at_key"
  ON "athlete_follower_snapshots"("athlete_id", "source", "captured_at");
CREATE INDEX "athlete_follower_snapshots_athlete_id_source_captured_at_idx"
  ON "athlete_follower_snapshots"("athlete_id", "source", "captured_at" DESC);
ALTER TABLE "athlete_follower_snapshots" ADD CONSTRAINT "athlete_follower_snapshots_athlete_id_fkey"
  FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AthleteNewsArticle: 네이버 뉴스 검색 API 자동 수집 결과
CREATE TABLE "athlete_news_articles" (
  "id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publisher" TEXT,
  "published_at" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "source" TEXT NOT NULL DEFAULT 'NAVER_NEWS',
  "language" TEXT DEFAULT 'ko',
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "athlete_news_articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "athlete_news_articles_athlete_id_url_key"
  ON "athlete_news_articles"("athlete_id", "url");
CREATE INDEX "athlete_news_articles_athlete_id_published_at_idx"
  ON "athlete_news_articles"("athlete_id", "published_at" DESC);
ALTER TABLE "athlete_news_articles" ADD CONSTRAINT "athlete_news_articles_athlete_id_fkey"
  FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
