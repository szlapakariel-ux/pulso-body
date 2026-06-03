import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { displayEmailFor } from "@/lib/demo";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import PlanEditor from "./plan-editor";

export const dynamic = "force-dynamic";

export default async function PatientPlanPage({
  params,
}: {
  params: { patientId: string };
}) {
  const user = await requireRolePage("PSYCHOLOGIST");
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: params.patientId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile || profile.psychologistId !== user.id) notFound();

  const [nutritionPlan, goalPlan] = await Promise.all([
    prisma.nutritionPlan.findFirst({
      where: { patientId: params.patientId, psychologistId: user.id, status: "ACTIVE" },
      include: { guidelines: { orderBy: { order: "asc" } } },
    }),
    prisma.goalPlan.findFirst({
      where: { patientId: params.patientId, psychologistId: user.id, status: "ACTIVE" },
      include: { weeklyGoals: { orderBy: { weekNumber: "asc" } } },
    }),
  ]);

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

  const guidelines = (nutritionPlan?.guidelines ?? []).map((g) => ({
    mealSlot: g.mealSlot as MealSlot,
    slotLabel: MEAL_SLOT_LABEL[g.mealSlot as MealSlot],
    title: g.title,
    description: g.description,
    exampleMenu: g.exampleMenu,
  }));

  const weeklyGoals = (goalPlan?.weeklyGoals ?? []).map((w) => ({
    weekNumber: w.weekNumber,
    what: w.what,
    why: w.why,
    how: w.how,
    comments: w.comments,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Plan</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
      </div>

      <PlanEditor
        patientId={params.patientId}
        initialNutrition={
          nutritionPlan
            ? {
                title: nutritionPlan.title,
                goal: nutritionPlan.goal,
                generalNotes: nutritionPlan.generalNotes,
              }
            : null
        }
        initialGuidelines={guidelines}
        initialGoalPlan={goalPlan ? { title: goalPlan.title } : null}
        initialWeeklyGoals={weeklyGoals}
      />
    </div>
  );
}
