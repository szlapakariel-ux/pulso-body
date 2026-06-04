import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

const PlanBody = z.object({
  action: z.literal("plan"),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
});

const DayBody = z.object({
  action: z.literal("day"),
  dayNumber: z.number().int().min(1).max(7),
  title: z.string().max(120).optional(),
  warmup: z.string().max(1000).optional(),
  cooldown: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

const ExerciseBody = z.object({
  action: z.literal("exercise"),
  dayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(120),
  muscleGroup: z.string().max(120).optional(),
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.number().int().min(1).max(1000).optional(),
  durationSeconds: z.number().int().min(1).max(36000).optional(),
  notes: z.string().max(500).optional(),
});

const Body = z.union([PlanBody, DayBody, ExerciseBody]);

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

async function activePlan(patientId: string, psychologistId: string) {
  return prisma.trainingPlan.findFirst({
    where: { patientId, psychologistId, status: "ACTIVE" },
  });
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

    if (data.action === "plan") {
      const existing = await activePlan(params.patientId, user.id);
      const payload = {
        title: data.title.trim(),
        notes: clean(data.notes) ?? null,
        daysPerWeek: data.daysPerWeek ?? null,
      };
      const plan = existing
        ? await prisma.trainingPlan.update({ where: { id: existing.id }, data: payload })
        : await prisma.trainingPlan.create({
            data: { patientId: params.patientId, psychologistId: user.id, ...payload },
          });
      return NextResponse.json({ id: plan.id });
    }

    // day y exercise requieren plan activo
    const plan = await activePlan(params.patientId, user.id);
    if (!plan) throw new HttpError(400, "Primero creá el plan de entrenamiento.");

    if (data.action === "day") {
      const existing = await prisma.trainingDay.findFirst({
        where: { trainingPlanId: plan.id, dayNumber: data.dayNumber },
      });
      const payload = {
        title: clean(data.title) ?? null,
        warmup: clean(data.warmup) ?? null,
        cooldown: clean(data.cooldown) ?? null,
        notes: clean(data.notes) ?? null,
        order: data.dayNumber,
      };
      const day = existing
        ? await prisma.trainingDay.update({ where: { id: existing.id }, data: payload })
        : await prisma.trainingDay.create({
            data: { trainingPlanId: plan.id, dayNumber: data.dayNumber, ...payload },
          });
      return NextResponse.json({ id: day.id });
    }

    // exercise: requiere que el día exista
    const day = await prisma.trainingDay.findFirst({
      where: { trainingPlanId: plan.id, dayNumber: data.dayNumber },
    });
    if (!day) throw new HttpError(400, `Primero creá el Día ${data.dayNumber}.`);

    const maxOrder = await prisma.exercisePrescription.aggregate({
      where: { trainingDayId: day.id },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const exercise = await prisma.exercisePrescription.create({
      data: {
        trainingDayId: day.id,
        name: data.name.trim(),
        muscleGroup: clean(data.muscleGroup) ?? null,
        sets: data.sets ?? null,
        reps: data.reps ?? null,
        durationSeconds: data.durationSeconds ?? null,
        notes: clean(data.notes) ?? null,
        order: nextOrder,
      },
    });
    return NextResponse.json({ id: exercise.id });
  } catch (err) {
    return handle(err);
  }
}
