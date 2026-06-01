-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "MealSchedule" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "mealSlot" "MealSlot" NOT NULL,
    "label" TEXT,
    "targetTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealSchedule_patientId_status_idx" ON "MealSchedule"("patientId", "status");

-- CreateIndex
CREATE INDEX "MealSchedule_psychologistId_status_idx" ON "MealSchedule"("psychologistId", "status");

-- AddForeignKey
ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSchedule" ADD CONSTRAINT "MealSchedule_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
