import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

const TypeEnum = z.enum([
  "WALK",
  "RUN",
  "BIKE",
  "STRENGTH",
  "MOBILITY",
  "SPORT",
  "CUSTOM",
]);

const IntensityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);

const Body = z.object({
  type: TypeEnum,
  durationMinutes: z.number().int().positive().max(600).optional(),
  intensity: IntensityEnum.optional(),
  note: z.string().max(500).optional(),
  mediaKey: z.string().min(1).optional(),
  mediaType: z.enum(["PHOTO"]).optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) throw new HttpError(400, "Paciente sin profesional asignado");

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Datos inválidos");

    const {
      type,
      durationMinutes,
      intensity,
      note,
      mediaKey,
      mediaType,
      recordedAt,
    } = parsed.data;
    const note$ = note?.trim() || undefined;

    if (type === "CUSTOM") {
      if (durationMinutes == null && !note$ && !mediaKey) {
        throw new HttpError(400, "Cargá al menos duración, nota o foto.");
      }
    } else {
      if (durationMinutes == null && !note$) {
        throw new HttpError(400, "Cargá la duración o una nota.");
      }
    }

    if (mediaKey && !mediaKey.startsWith(`patients/${user.id}/`)) {
      throw new HttpError(403, "Key inválida");
    }
    if (mediaKey && mediaType !== "PHOTO") {
      throw new HttpError(400, "Solo se admite foto adjunta.");
    }

    const when = recordedAt ? new Date(recordedAt) : new Date();

    const entry = await prisma.exerciseEntry.create({
      data: {
        patientId: user.id,
        psychologistId: profile.psychologistId,
        type,
        durationMinutes: durationMinutes ?? null,
        intensity: intensity ?? null,
        note: note$ ?? null,
        mediaKey: mediaKey ?? null,
        mediaType: mediaKey ? "PHOTO" : null,
        recordedAt: when,
      },
    });
    return NextResponse.json({ id: entry.id });
  } catch (err) {
    return handle(err);
  }
}
