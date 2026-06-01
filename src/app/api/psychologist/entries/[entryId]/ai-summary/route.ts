import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import {
  AiNotConfiguredError,
  generateDescriptiveSummary,
} from "@/lib/ai-summary";

export async function POST(
  _req: Request,
  { params }: { params: { entryId: string } },
) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    const entry = await prisma.timelineEntry.findUnique({
      where: { id: params.entryId },
      include: { transcription: true },
    });
    if (!entry || entry.psychologistId !== user.id) {
      throw new HttpError(403, "Registro no accesible");
    }
    if (entry.mediaType !== "AUDIO" && entry.mediaType !== "VIDEO") {
      throw new HttpError(400, "Resumen IA disponible solo para audio/video.");
    }

    const text = entry.transcription?.text?.trim();
    if (!text) {
      throw new HttpError(
        400,
        "Primero pedí la transcripción para generar el resumen.",
      );
    }

    await prisma.timelineEntry.update({
      where: { id: entry.id },
      data: { aiStatus: "PENDING" },
    });

    try {
      const { aiTitle, aiSummary } = await generateDescriptiveSummary({
        transcriptText: text,
        mediaType: entry.mediaType,
        contextLabel: entry.contextLabel,
        contextNote: entry.contextNote,
        recordedAt: entry.recordedAt,
      });

      const updated = await prisma.timelineEntry.update({
        where: { id: entry.id },
        data: { aiTitle, aiSummary, aiStatus: "COMPLETED" },
      });

      return NextResponse.json({
        aiTitle: updated.aiTitle,
        aiSummary: updated.aiSummary,
        aiStatus: updated.aiStatus,
      });
    } catch (err) {
      await prisma.timelineEntry.update({
        where: { id: entry.id },
        data: { aiStatus: "FAILED" },
      });
      if (err instanceof AiNotConfiguredError) {
        throw new HttpError(503, "IA no configurada en este entorno.");
      }
      throw new HttpError(
        502,
        err instanceof Error ? err.message : "Falló la generación IA",
      );
    }
  } catch (err) {
    return handle(err);
  }
}
