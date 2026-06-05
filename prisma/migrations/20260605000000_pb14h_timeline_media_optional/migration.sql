-- PB-14H: allow TimelineEntry without media (manual meal logging).
ALTER TABLE "TimelineEntry" ALTER COLUMN "mediaType" DROP NOT NULL;
ALTER TABLE "TimelineEntry" ALTER COLUMN "mediaKey" DROP NOT NULL;
