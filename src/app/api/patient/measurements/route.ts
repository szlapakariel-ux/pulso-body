import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

const TypeEnum = z.enum([
  "WEIGHT",
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
  "NECK",
  "THIGH",
  "BODY_FAT",
  "PROGRESS_PHOTO",
  "CUSTOM",
]);

const VALUE_REQUIRED: ReadonlyArray<z.infer<typeof TypeEnum>> = [
  "WEIGHT",
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
  "NECK",
  "THIGH",
  "BODY_FAT",
];

const CM_TYPES: ReadonlyArray<z.infer<typeof TypeEnum>> = [
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
  "NECK",
  "THIGH",
];

const Body = z.object({
  type: TypeEnum,
  value: z.number().finite().positive().lt(1000).optional(),
  unit: z.string().min(1).max(8).optional(),
  mediaKey: z.string().min(1).optional(),
  mediaType: z.enum(["PHOTO"]).optional(),
  note: z.string().max(500).optional(),
  recordedAt: z.string().datetime().optional(),
});

function normalizeUnit(
  type: z.infer<typeof TypeEnum>,
  unit: string | undefined,
): string | undefined {
  if (type === "WEIGHT") return "kg";
  if (type === "BODY_FAT") return "%";
  if (CM_TYPES.includes(type)) return "cm";
  return unit;
}

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

    const { type, value, mediaKey, mediaType, note, recordedAt } = parsed.data;
    const note$ = note?.trim() || undefined;

    if (type === "WEIGHT") {
      if (value == null) throw new HttpError(400, "El peso requiere un valor numérico.");
    } else if (type === "BODY_FAT") {
      if (value == null) throw new HttpError(400, "La grasa corporal requiere un valor numérico.");
    } else if (VALUE_REQUIRED.includes(type)) {
      if (value == null) throw new HttpError(400, "La medida requiere un valor numérico.");
    } else if (type === "PROGRESS_PHOTO") {
      if (!mediaKey) throw new HttpError(400, "La foto de progreso requiere un archivo.");
      if (mediaType !== "PHOTO") {
        throw new HttpError(400, "La foto de progreso debe ser una imagen.");
      }
    } else if (type === "CUSTOM") {
      if (value == null && !note$ && !mediaKey) {
        throw new HttpError(400, "Cargá al menos un valor, una nota o una foto.");
      }
    }

    if (mediaKey && !mediaKey.startsWith(`patients/${user.id}/`)) {
      throw new HttpError(403, "Key inválida");
    }
    if (mediaKey && mediaType !== "PHOTO") {
      throw new HttpError(400, "Solo se admite foto adjunta.");
    }

    const unit = normalizeUnit(type, parsed.data.unit);
    const when = recordedAt ? new Date(recordedAt) : new Date();

    const entry = await prisma.measurementEntry.create({
      data: {
        patientId: user.id,
        psychologistId: profile.psychologistId,
        type,
        value: value ?? null,
        unit: unit ?? null,
        mediaKey: mediaKey ?? null,
        mediaType: mediaKey ? "PHOTO" : null,
        note: note$ ?? null,
        recordedAt: when,
      },
    });
    return NextResponse.json({ id: entry.id });
  } catch (err) {
    return handle(err);
  }
}
