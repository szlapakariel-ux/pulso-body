import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { groupByDay, formatDateTime } from "@/lib/dates";
import { displayEmailFor } from "@/lib/demo";
import EntryControls from "./entry-controls";
import VideoCard from "@/components/video-card";

export const dynamic = "force-dynamic";

export default async function PatientTimelinePage({
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

  const entries = await prisma.timelineEntry.findMany({
    where: { patientId: params.patientId, psychologistId: user.id },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    include: { notes: true, transcription: true },
  });

  const withUrls = await Promise.all(
    entries.map(async (e) => ({
      ...e,
      when: e.recordedAt ?? e.createdAt,
      mediaUrl: await presignDownload(e.mediaKey),
    })),
  );
  const groups = groupByDay(withUrls.map((e) => ({ ...e, createdAt: e.when })));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/psychologist/patients" className="text-sm text-pulso-soft underline">
          ← Pacientes
        </Link>
        <h2 className="text-2xl font-semibold mt-2">{profile.user.name}</h2>
        <p className="text-pulso-soft text-sm">{displayEmailFor(profile.user.email)}</p>
      </div>

      {groups.length === 0 && (
        <div className="card text-pulso-soft">Este paciente aún no tiene registros.</div>
      )}

      {groups.map((g) => (
        <section key={g.dayKey} className="space-y-3">
          <h3 className="text-sm uppercase tracking-wide text-pulso-soft">{g.label}</h3>
          <div className="space-y-4">
            {g.items.map((e) => (
              <article key={e.id} className="card space-y-3">
                <header>
                  <p className="text-sm text-pulso-soft">
                    {e.mediaType === "AUDIO"
                      ? "Audio"
                      : e.mediaType === "VIDEO"
                        ? "Video"
                        : "Foto"}{" "}
                    · {formatDateTime(e.when)}
                  </p>
                  {e.contextLabel && (
                    <p className="text-sm mt-0.5">
                      Contexto:{" "}
                      <span className="font-medium">{e.contextLabel}</span>
                    </p>
                  )}
                  {e.contextNote && (
                    <p className="text-sm text-pulso-soft italic mt-0.5">
                      “{e.contextNote}”
                    </p>
                  )}
                </header>
                {!e.mediaUrl ? (
                  <p className="text-sm text-pulso-soft italic">
                    Almacenamiento no configurado todavía.
                  </p>
                ) : e.mediaType === "AUDIO" ? (
                  <audio controls preload="none" src={e.mediaUrl} className="w-full" />
                ) : e.mediaType === "VIDEO" ? (
                  <VideoCard src={e.mediaUrl} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.mediaUrl} alt="Foto registrada" className="w-full rounded-lg" />
                )}
                <EntryControls
                  entryId={e.id}
                  mediaType={e.mediaType}
                  initialNotes={e.notes.map((n) => ({
                    id: n.id,
                    content: n.content,
                    createdAt: n.createdAt.toISOString(),
                  }))}
                  initialTranscription={
                    e.transcription
                      ? { status: e.transcription.status, text: e.transcription.text }
                      : null
                  }
                  initialAi={{
                    status: e.aiStatus,
                    title: e.aiTitle,
                    summary: e.aiSummary,
                  }}
                />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
