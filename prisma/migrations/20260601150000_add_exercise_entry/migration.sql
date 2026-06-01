-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('WALK', 'RUN', 'BIKE', 'STRENGTH', 'MOBILITY', 'SPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExerciseIntensity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CUSTOM');

-- CreateTable
CREATE TABLE "ExerciseEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "durationMinutes" INTEGER,
    "intensity" "ExerciseIntensity",
    "note" TEXT,
    "mediaKey" TEXT,
    "mediaType" "MediaType",
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseEntry_patientId_recordedAt_idx" ON "ExerciseEntry"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "ExerciseEntry_psychologistId_recordedAt_idx" ON "ExerciseEntry"("psychologistId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ExerciseEntry" ADD CONSTRAINT "ExerciseEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEntry" ADD CONSTRAINT "ExerciseEntry_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
