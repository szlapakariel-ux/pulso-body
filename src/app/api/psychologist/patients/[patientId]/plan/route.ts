import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

const MealSlotEnum = z.enum([
  "BREAKFAST",
  "SNACK_AM",
  "LUNCH",
  "SNACK_PM",
  "DINNER",
  "CUSTOM",
]);

const SLOT_ORDER: Record<z.infer<typeof MealSlotEnum>, number> = {
  BREAKFAST: 0,
  SNACK_AM: 1,
  LUNCH: 2,
  SNACK_PM: 3,
  DINNER: 4,
  CUSTOM: 5,
};

const NutritionPlanBody = z.object({
  action: z.literal("nutrition-plan"),
  title: z.string().min(1).max(120),
  goal: z.string().max(500).optional(),
  generalNotes: z.string().max(2000).optional(),
});

const GuidelineBody = z.object({
  action: z.literal("guideline"),
  mealSlot: MealSlotEnum,
  title: z.string().max(120).optional(),
  description: z.string().min(1).max(2000),
  exampleMenu: z.string().max(2000).optional(),
});

const GoalPlanBody = z.object({
  action: z.literal("goal-plan"),
  title: z.string().min(1).max(120),
});

const WeeklyGoalBody = z.object({
  action: z.literal("weekly-goal"),
  weekNumber: z.number().int().min(1).max(52),
  what: z.string().min(1).max(500),
  why: z.string().max(500).optional(),
  how: z.string().max(500).optional(),
  comments: z.string().max(500).optional(),
});

const Body = z.union([
  NutritionPlanBody,
  GuidelineBody,
  GoalPlanBody,
  WeeklyGoalBody,
]);

async function assertOwnPatient(userId: string, patientId: string) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
  });
  if (!profile || profile.psychologistId !== userId) {
    throw new HttpError(404, "Paciente no encontrado");
  }
}

function clean(s: string | undefined): string | undefined {
  return s?.trim() || undefined;
}

export async function POST(
  req: Request,
  { params }: { params: { patientId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    await assertOwnPatient(user.id, params.patientId);

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Datos inválidos");
    const data = parsed.data;

    if (data.action === "nutrition-plan") {
      const existing = await prisma.nutritionPlan.findFirst({
        where: {
          patientId: params.patientId,
          psychologistId: user.id,
          status: "ACTIVE",
        },
      });
      const plan = existing
        ? await prisma.nutritionPlan.update({
            where: { id: existing.id },
            data: {
              title: data.title.trim(),
              goal: clean(data.goal) ?? null,
              generalNotes: clean(data.generalNotes) ?? null,
            },
          })
        : await prisma.nutritionPlan.create({
            data: {
              patientId: params.patientId,
              psychologistId: user.id,
              title: data.title.trim(),
              goal: clean(data.goal) ?? null,
              generalNotes: clean(data.generalNotes) ?? null,
            },
          });
      return NextResponse.json({ id: plan.id });
    }

    if (data.action === "guideline") {
      const plan = await prisma.nutritionPlan.findFirst({
        where: {
          patientId: params.patientId,
          psychologistId: user.id,
          status: "ACTIVE",
        },
      });
      if (!plan) throw new HttpError(400, "Primero creá el plan alimentario.");
      const existing = await prisma.mealGuideline.findFirst({
        where: { nutritionPlanId: plan.id, mealSlot: data.mealSlot },
      });
      const payload = {
        title: clean(data.title) ?? null,
        description: data.description.trim(),
        exampleMenu: clean(data.exampleMenu) ?? null,
        order: SLOT_ORDER[data.mealSlot],
      };
      const guideline = existing
        ? await prisma.mealGuideline.update({ where: { id: existing.id }, data: payload })
        : await prisma.mealGuideline.create({
            data: { nutritionPlanId: plan.id, mealSlot: data.mealSlot, ...payload },
          });
      return NextResponse.json({ id: guideline.id });
    }

    if (data.action === "goal-plan") {
      const existing = await prisma.goalPlan.findFirst({
        where: {
          patientId: params.patientId,
          psychologistId: user.id,
          status: "ACTIVE",
        },
      });
      const plan = existing
        ? await prisma.goalPlan.update({
            where: { id: existing.id },
            data: { title: data.title.trim() },
          })
        : await prisma.goalPlan.create({
            data: {
              patientId: params.patientId,
              psychologistId: user.id,
              title: data.title.trim(),
            },
          });
      return NextResponse.json({ id: plan.id });
    }

    // weekly-goal
    const goalPlan = await prisma.goalPlan.findFirst({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        status: "ACTIVE",
      },
    });
    if (!goalPlan) throw new HttpError(400, "Primero creá el plan de objetivos.");
    const existing = await prisma.weeklyGoal.findFirst({
      where: { goalPlanId: goalPlan.id, weekNumber: data.weekNumber },
    });
    const payload = {
      what: data.what.trim(),
      why: clean(data.why) ?? null,
      how: clean(data.how) ?? null,
      comments: clean(data.comments) ?? null,
    };
    const goal = existing
      ? await prisma.weeklyGoal.update({ where: { id: existing.id }, data: payload })
      : await prisma.weeklyGoal.create({
          data: { goalPlanId: goalPlan.id, weekNumber: data.weekNumber, ...payload },
        });
    return NextResponse.json({ id: goal.id });
  } catch (err) {
    return handle(err);
  }
}
