-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('WEIGHT', 'WAIST', 'HIP', 'CHEST', 'ARM', 'PROGRESS_PHOTO', 'CUSTOM');

-- CreateTable
CREATE TABLE "MeasurementEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "type" "MeasurementType" NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "mediaKey" TEXT,
    "mediaType" "MediaType",
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeasurementEntry_patientId_recordedAt_idx" ON "MeasurementEntry"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "MeasurementEntry_psychologistId_recordedAt_idx" ON "MeasurementEntry"("psychologistId", "recordedAt");

-- AddForeignKey
ALTER TABLE "MeasurementEntry" ADD CONSTRAINT "MeasurementEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementEntry" ADD CONSTRAINT "MeasurementEntry_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
