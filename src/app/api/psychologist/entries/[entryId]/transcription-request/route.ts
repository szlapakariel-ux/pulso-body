import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import {
  TranscriptionNotConfiguredError,
  transcribeFromMediaKey,
} from "@/lib/transcription";

export async function POST(_req: Request, { params }: { params: { entryId: string } }) {
  try {
    const user = await requireRole("PSYCHOLOGIST");
    const entry = await prisma.timelineEntry.findUnique({
      where: { id: params.entryId },
    });
    if (!entry || entry.psychologistId !== user.id) {
      throw new HttpError(403, "Registro no accesible");
    }
    if (!entry.mediaKey) {
      throw new HttpError(400, "Este registro no tiene audio para transcribir.");
    }

    await prisma.transcription.upsert({
      where: { entryId: entry.id },
      update: { status: "PENDING", requestedById: user.id },
      create: {
        entryId: entry.id,
        requestedById: user.id,
        status: "PENDING",
      },
    });

    try {
      const { text } = await transcribeFromMediaKey(entry.mediaKey);
      const trans = await prisma.transcription.update({
        where: { entryId: entry.id },
        data: { status: "COMPLETED", text },
      });
      return NextResponse.json({ status: trans.status, text: trans.text });
    } catch (err) {
      await prisma.transcription.update({
        where: { entryId: entry.id },
        data: { status: "FAILED" },
      });
      if (err instanceof TranscriptionNotConfiguredError) {
        throw new HttpError(503, "Transcripción no configurada en este entorno.");
      }
      throw new HttpError(
        502,
        err instanceof Error ? err.message : "Falló la transcripción",
      );
    }
  } catch (err) {
    return handle(err);
  }
}
