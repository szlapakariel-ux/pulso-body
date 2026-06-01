import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import {
  isValidTargetTime,
  normalizeDaysOfWeek,
} from "@/lib/meal-schedules";

const PatchBody = z.object({
  label: z.string().max(60).nullable().optional(),
  targetTime: z
    .string()
    .refine(isValidTargetTime, "targetTime debe ser HH:mm")
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

async function loadOwned(
  userId: string,
  patientId: string,
  scheduleId: string,
) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
  });
  if (!profile || profile.psychologistId !== userId) {
    throw new HttpError(404, "Paciente no encontrado");
  }
  const schedule = await prisma.mealSchedule.findUnique({
    where: { id: scheduleId },
  });
  if (
    !schedule ||
    schedule.patientId !== patientId ||
    schedule.psychologistId !== userId
  ) {
    throw new HttpError(404, "Schedule no encontrado");
  }
  return schedule;
}

export async function PATCH(
  req: Request,
  { params }: { params: { patientId: string; scheduleId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    await loadOwned(user.id, params.patientId, params.scheduleId);

    const json = await req.json().catch(() => null);
    const parsed = PatchBody.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Datos inválidos");

    const data: Record<string, unknown> = {};
    const p = parsed.data;
    if (p.label !== undefined) data.label = p.label?.trim() || null;
    if (p.targetTime !== undefined) data.targetTime = p.targetTime;
    if (p.daysOfWeek !== undefined) {
      const days = normalizeDaysOfWeek(p.daysOfWeek);
      if (days.length === 0) {
        throw new HttpError(400, "Seleccioná al menos un día");
      }
      data.daysOfWeek = days;
    }
    if (p.status !== undefined) data.status = p.status;
    if (p.startsAt !== undefined) {
      data.startsAt = p.startsAt ? new Date(p.startsAt) : null;
    }
    if (p.endsAt !== undefined) {
      data.endsAt = p.endsAt ? new Date(p.endsAt) : null;
    }
    if (p.note !== undefined) data.note = p.note?.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, "Nada para actualizar");
    }

    const updated = await prisma.mealSchedule.update({
      where: { id: params.scheduleId },
      data,
    });
    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { patientId: string; scheduleId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    await loadOwned(user.id, params.patientId, params.scheduleId);

    await prisma.mealSchedule.update({
      where: { id: params.scheduleId },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
