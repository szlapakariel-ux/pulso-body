import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { groupByDay, formatDateTime } from "@/lib/dates";
import { displayEmailFor } from "@/lib/demo";
import EntryControls from "./entry-controls";
import VideoCard from "@/components/video-card";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import {
  MEASUREMENT_TYPE_LABEL,
  formatMeasurementValue,
  type MeasurementType,
} from "@/lib/measurements";
import {
  EXERCISE_INTENSITY_LABEL,
  EXERCISE_TYPE_LABEL,
  formatDuration,
  type ExerciseIntensity,
  type ExerciseType,
} from "@/lib/exercises";

export const dynamic = "force-dynamic";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default async function PatientTimelinePage({
  params,
  searchParams,
}: {
  params: { patientId: string };
  searchParams?: { filter?: string };
}) {
  const user = await requireRolePage("PSYCHOLOGIST");
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: params.patientId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile || profile.psychologistId !== user.id) notFound();

  const filter = searchParams?.filter === "meals" ? "meals" : "all";

  const entries = await prisma.timelineEntry.findMany({
    where: {
      patientId: params.patientId,
      psychologistId: user.id,
      ...(filter === "meals" ? { entryKind: "MEAL" as const } : {}),
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    include: { notes: true, transcription: true },
  });

  const now = new Date();
  const mealsToday = await prisma.timelineEntry.findMany({
    where: {
      patientId: params.patientId,
      psychologistId: user.id,
      entryKind: "MEAL",
      recordedAt: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
    },
    orderBy: { recordedAt: "desc" },
    select: { mealSlot: true, recordedAt: true },
  });

  const todayCount = mealsToday.length;
  const last = mealsToday[0];
  const lastLabel =
    last && last.recordedAt && last.mealSlot
      ? `${MEAL_SLOT_LABEL[last.mealSlot as MealSlot]} · ${formatHHMM(last.recordedAt)}`
      : null;
  const slotsToday = Array.from(
    new Set(mealsToday.map((m) => m.mealSlot).filter((s): s is MealSlot => Boolean(s))),
  );

  const recentMeasurements = await prisma.measurementEntry.findMany({
    where: { patientId: params.patientId, psychologistId: user.id },
    orderBy: { recordedAt: "desc" },
    take: 3,
    select: {
      id: true,
      type: true,
      value: true,
      unit: true,
      note: true,
      recordedAt: true,
    },
  });

  const recentExercises = await prisma.exerciseEntry.findMany({
    where: { patientId: params.patientId, psychologistId: user.id },
    orderBy: { recordedAt: "desc" },
    take: 3,
    select: {
      id: true,
      type: true,
      durationMinutes: true,
      intensity: true,
      note: true,
      recordedAt: true,
    },
  });

  const withUrls = await Promise.all(
    entries.map(async (e) => ({
      ...e,
      when: e.recordedAt ?? e.createdAt,
      mediaUrl: await presignDownload(e.mediaKey),
    })),
  );
  const groups = groupByDay(withUrls.map((e) => ({ ...e, createdAt: e.when })));

  const baseHref = `/psychologist/patients/${params.patientId}/timeline`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/psychologist/patients" className="text-sm text-pulso-soft underline">
          ← Pacientes
        </Link>
        <h2 className="text-2xl font-semibold mt-2">{profile.user.name}</h2>
        <p className="text-pulso-soft text-sm">{displayEmailFor(profile.user.email)}</p>
      </div>

      <section className="card space-y-2">
        <h3 className="text-sm font-semibold">Bitácora de comidas</h3>
        {todayCount === 0 ? (
          <p className="text-sm text-pulso-soft">
            Todavía no hay comidas registradas hoy.
          </p>
        ) : (
          <>
            <p className="text-sm">
              Hoy:{" "}
              <span className="font-medium">
                {todayCount} {todayCount === 1 ? "comida registrada" : "comidas registradas"}
              </span>
            </p>
            {lastLabel && (
              <p className="text-sm">
                Última comida registrada:{" "}
                <span className="font-medium">{lastLabel}</span>
              </p>
            )}
            {slotsToday.length > 0 && (
              <div className="text-sm">
                <p className="text-pulso-soft">Slots registrados hoy:</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {slotsToday.map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-pulso-mute px-2 py-0.5 text-xs font-medium"
                    >
                      {MEAL_SLOT_LABEL[s]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Peso y medidas</h3>
          <Link
            href={`/psychologist/patients/${params.patientId}/measurements`}
            className="text-xs text-pulso-soft underline"
          >
            Ver historial de mediciones
          </Link>
        </div>
        {recentMeasurements.length === 0 ? (
          <p className="text-sm text-pulso-soft">
            Todavía no hay peso o medidas registradas.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentMeasurements.map((m) => {
              const label = MEASUREMENT_TYPE_LABEL[m.type as MeasurementType];
              const valueLabel = formatMeasurementValue(
                m.type as MeasurementType,
                m.value,
                m.unit,
              );
              return (
                <li key={m.id}>
                  <span className="font-medium">{label}</span>
                  {valueLabel ? <> · {valueLabel}</> : null}
                  {" · "}
                  <span className="text-pulso-soft">{formatHHMM(m.recordedAt)}</span>
                  {m.note && (
                    <span className="text-pulso-soft italic"> · “{m.note}”</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Ejercicio</h3>
          <Link
            href={`/psychologist/patients/${params.patientId}/exercises`}
            className="text-xs text-pulso-soft underline"
          >
            Ver historial de ejercicio
          </Link>
        </div>
        {recentExercises.length === 0 ? (
          <p className="text-sm text-pulso-soft">
            Todavía no hay actividad física registrada.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentExercises.map((e) => {
              const label = EXERCISE_TYPE_LABEL[e.type as ExerciseType];
              const durationLabel = formatDuration(e.durationMinutes);
              const intensityLabel = e.intensity
                ? EXERCISE_INTENSITY_LABEL[e.intensity as ExerciseIntensity]
                : null;
              return (
                <li key={e.id}>
                  <span className="font-medium">{label}</span>
                  {durationLabel ? <> · {durationLabel}</> : null}
                  {intensityLabel ? <> · {intensityLabel}</> : null}
                  {" · "}
                  <span className="text-pulso-soft">{formatHHMM(e.recordedAt)}</span>
                  {e.note && (
                    <span className="text-pulso-soft italic"> · “{e.note}”</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="flex items-center gap-2 text-sm">
        <Link
          href={baseHref}
          className={filter === "all" ? "btn-primary" : "btn-ghost"}
        >
          Todas
        </Link>
        <Link
          href={`${baseHref}?filter=meals`}
          className={filter === "meals" ? "btn-primary" : "btn-ghost"}
        >
          Solo comidas
        </Link>
      </nav>

      {groups.length === 0 && (
        <div className="card text-pulso-soft">
          {filter === "meals"
            ? "Este paciente aún no tiene comidas registradas."
            : "Este paciente aún no tiene registros."}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.dayKey} className="space-y-3">
          <h3 className="text-sm uppercase tracking-wide text-pulso-soft">{g.label}</h3>
          <div className="space-y-4">
            {g.items.map((e) => (
              <article key={e.id} className="card space-y-3">
                <header>
                  <p className="text-sm text-pulso-soft">
                    {e.entryKind === "MEAL" ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-full bg-pulso-mute px-2 py-0.5 text-xs font-medium">
                          Comida
                        </span>
                        {e.mealSlot && (
                          <span>· {MEAL_SLOT_LABEL[e.mealSlot as MealSlot]}</span>
                        )}
                      </span>
                    ) : e.mediaType === "AUDIO" ? (
                      "Audio"
                    ) : e.mediaType === "VIDEO" ? (
                      "Video"
                    ) : (
                      "Foto"
                    )}{" "}
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
