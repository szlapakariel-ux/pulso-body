import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import {
  isValidTargetTime,
  normalizeDaysOfWeek,
} from "@/lib/meal-schedules";

const MealSlotEnum = z.enum([
  "BREAKFAST",
  "SNACK_AM",
  "LUNCH",
  "SNACK_PM",
  "DINNER",
  "CUSTOM",
]);

const CreateBody = z.object({
  mealSlot: MealSlotEnum,
  label: z.string().max(60).optional(),
  targetTime: z.string().refine(isValidTargetTime, "targetTime debe ser HH:mm"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

async function assertOwnPatient(userId: string, patientId: string) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
  });
  if (!profile || profile.psychologistId !== userId) {
    throw new HttpError(404, "Paciente no encontrado");
  }
}

export async function GET(
  req: Request,
  { params }: { params: { patientId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    await assertOwnPatient(user.id, params.patientId);

    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const schedules = await prisma.mealSchedule.findMany({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
      },
      orderBy: [{ targetTime: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ schedules });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { patientId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    await assertOwnPatient(user.id, params.patientId);

    const json = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Datos inválidos");

    const days = normalizeDaysOfWeek(parsed.data.daysOfWeek);
    if (days.length === 0) {
      throw new HttpError(400, "Seleccioná al menos un día de la semana");
    }

    const note = parsed.data.note?.trim() || undefined;
    const label = parsed.data.label?.trim() || undefined;

    const created = await prisma.mealSchedule.create({
      data: {
        patientId: params.patientId,
        psychologistId: user.id,
        mealSlot: parsed.data.mealSlot,
        label: label ?? null,
        targetTime: parsed.data.targetTime,
        daysOfWeek: days,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        note: note ?? null,
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (err) {
    return handle(err);
  }
}
