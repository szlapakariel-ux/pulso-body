-- CreateTable
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "generalNotes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealGuideline" (
    "id" TEXT NOT NULL,
    "nutritionPlanId" TEXT NOT NULL,
    "mealSlot" "MealSlot" NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "exampleMenu" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyGoal" (
    "id" TEXT NOT NULL,
    "goalPlanId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "what" TEXT NOT NULL,
    "why" TEXT,
    "how" TEXT,
    "comments" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionPlan_patientId_status_idx" ON "NutritionPlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "NutritionPlan_psychologistId_status_idx" ON "NutritionPlan"("psychologistId", "status");

-- CreateIndex
CREATE INDEX "MealGuideline_nutritionPlanId_idx" ON "MealGuideline"("nutritionPlanId");

-- CreateIndex
CREATE INDEX "GoalPlan_patientId_status_idx" ON "GoalPlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "GoalPlan_psychologistId_status_idx" ON "GoalPlan"("psychologistId", "status");

-- CreateIndex
CREATE INDEX "WeeklyGoal_goalPlanId_idx" ON "WeeklyGoal"("goalPlanId");

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGuideline" ADD CONSTRAINT "MealGuideline_nutritionPlanId_fkey" FOREIGN KEY ("nutritionPlanId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPlan" ADD CONSTRAINT "GoalPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPlan" ADD CONSTRAINT "GoalPlan_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_goalPlanId_fkey" FOREIGN KEY ("goalPlanId") REFERENCES "GoalPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
