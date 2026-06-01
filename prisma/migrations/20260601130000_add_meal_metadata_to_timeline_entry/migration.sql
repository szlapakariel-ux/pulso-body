-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('GENERIC', 'MEAL');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'SNACK_AM', 'LUNCH', 'SNACK_PM', 'DINNER', 'CUSTOM');

-- AlterTable
ALTER TABLE "TimelineEntry"
  ADD COLUMN "entryKind" "EntryKind" NOT NULL DEFAULT 'GENERIC',
  ADD COLUMN "mealSlot"  "MealSlot";
