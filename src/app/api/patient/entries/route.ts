import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { presignUpload, isS3Configured } from "@/lib/s3";
import { handle } from "@/lib/http";

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 100);
const ALLOWED_AUDIO = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"];
const ALLOWED_VIDEO = ["video/webm", "video/mp4", "video/quicktime", "video/ogg"];
const ALLOWED_PHOTO = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function allowedFor(mediaType: "AUDIO" | "VIDEO" | "PHOTO"): string[] {
  if (mediaType === "AUDIO") return ALLOWED_AUDIO;
  if (mediaType === "VIDEO") return ALLOWED_VIDEO;
  return ALLOWED_PHOTO;
}

const ContextLabel = z
  .enum(["Casa", "Trabajo", "Tren", "Auto", "Calle", "Antes de dormir", "Otro"])
  .optional();

const InitBody = z.object({
  action: z.literal("init"),
  mediaType: z.enum(["AUDIO", "VIDEO", "PHOTO"]),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  recordedAt: z.string().datetime().optional(),
  contextLabel: ContextLabel,
  contextNote: z.string().max(280).optional(),
});

const CompleteBody = z.object({
  action: z.literal("complete"),
  mediaType: z.enum(["AUDIO", "VIDEO", "PHOTO"]),
  mediaKey: z.string().min(1),
  recordedAt: z.string().datetime().optional(),
  contextLabel: ContextLabel,
  contextNote: z.string().max(280).optional(),
});

const Body = z.union([InitBody, CompleteBody]);

function buildInternalTitle(
  mediaType: "AUDIO" | "VIDEO" | "PHOTO",
  contextLabel: string | undefined,
  when: Date,
): string {
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const kind = mediaType === "AUDIO" ? "Audio" : mediaType === "VIDEO" ? "Video" : "Foto";
  const ctx = contextLabel ? ` · ${contextLabel}` : "";
  return `${kind}${ctx} · ${hh}:${mm}`;
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new HttpError(400, "Paciente sin psicólogo asignado");

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Datos inválidos");

    if (parsed.data.action === "init") {
      const { mediaType, contentType, sizeBytes } = parsed.data;
      const allowed = allowedFor(mediaType);
      if (!allowed.includes(contentType)) throw new HttpError(400, "Tipo de archivo no permitido");
      if (sizeBytes > MAX_MB * 1024 * 1024) {
        throw new HttpError(400, `Archivo excede ${MAX_MB} MB`);
      }
      if (!isS3Configured()) {
        throw new HttpError(503, "Almacenamiento no configurado. Definí variables S3_* en .env");
      }
      const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
      const key = `patients/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const uploadUrl = await presignUpload(key, contentType);
      return NextResponse.json({ uploadUrl, key });
    }

    const { mediaType, mediaKey, recordedAt, contextLabel, contextNote } = parsed.data;
    if (!mediaKey.startsWith(`patients/${user.id}/`)) {
      throw new HttpError(403, "Key inválida");
    }
    const when = recordedAt ? new Date(recordedAt) : new Date();
    const title = buildInternalTitle(mediaType, contextLabel, when);
    const entry = await prisma.timelineEntry.create({
      data: {
        patientId: user.id,
        psychologistId: profile.psychologistId,
        title,
        mediaType,
        mediaKey,
        recordedAt: when,
        contextLabel: contextLabel ?? null,
        contextNote: contextNote?.trim() || null,
      },
    });
    return NextResponse.json({ id: entry.id });
  } catch (err) {
    return handle(err);
  }
}
