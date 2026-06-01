import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { displayEmailFor } from "@/lib/demo";
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
function formatToday(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PatientTodayForPsychologist({
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

  const now = new Date();
  const range = {
    gte: startOfLocalDay(now),
    lte: endOfLocalDay(now),
  };

  const [meals, measurements, exercises] = await Promise.all([
    prisma.timelineEntry.findMany({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        entryKind: "MEAL",
        recordedAt: range,
      },
      orderBy: { recordedAt: "asc" },
      select: {
        id: true,
        mealSlot: true,
        recordedAt: true,
        mediaKey: true,
        contextLabel: true,
        contextNote: true,
      },
    }),
    prisma.measurementEntry.findMany({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        recordedAt: range,
      },
      orderBy: { recordedAt: "asc" },
      select: {
        id: true,
        type: true,
        value: true,
        unit: true,
        note: true,
        recordedAt: true,
        mediaKey: true,
      },
    }),
    prisma.exerciseEntry.findMany({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        recordedAt: range,
      },
      orderBy: { recordedAt: "asc" },
      select: {
        id: true,
        type: true,
        durationMinutes: true,
        intensity: true,
        note: true,
        recordedAt: true,
        mediaKey: true,
      },
    }),
  ]);

  const mealsWithUrls = await Promise.all(
    meals.map(async (m) => ({
      ...m,
      mediaUrl: m.mediaKey ? await presignDownload(m.mediaKey) : null,
    })),
  );
  const measurementsWithUrls = await Promise.all(
    measurements.map(async (m) => ({
      ...m,
      mediaUrl: m.mediaKey ? await presignDownload(m.mediaKey) : null,
    })),
  );
  const exercisesWithUrls = await Promise.all(
    exercises.map(async (e) => ({
      ...e,
      mediaUrl: e.mediaKey ? await presignDownload(e.mediaKey) : null,
    })),
  );

  const totalExerciseMinutes = exercises.reduce(
    (acc, e) => acc + (e.durationMinutes ?? 0),
    0,
  );
  const totalLabel = formatDuration(totalExerciseMinutes);

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Resumen de hoy</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
        <p className="text-sm mt-1 capitalize">{formatToday()}</p>
      </div>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Comidas de hoy</h3>
          <span className="text-xs text-pulso-soft">
            {mealsWithUrls.length}{" "}
            {mealsWithUrls.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        {mealsWithUrls.length === 0 ? (
          <p className="text-sm text-pulso-soft">Sin registros hoy.</p>
        ) : (
          <ul className="space-y-3">
            {mealsWithUrls.map((m) => {
              const slotLabel = m.mealSlot
                ? MEAL_SLOT_LABEL[m.mealSlot as MealSlot]
                : "Comida";
              return (
                <li key={m.id} className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{slotLabel}</span>
                    {" · "}
                    <span className="text-pulso-soft">
                      {m.recordedAt ? formatHHMM(m.recordedAt) : ""}
                    </span>
                  </p>
                  {m.contextLabel && (
                    <p className="text-xs text-pulso-soft">
                      Contexto: {m.contextLabel}
                    </p>
                  )}
                  {m.contextNote && (
                    <p className="text-xs text-pulso-soft italic">
                      “{m.contextNote}”
                    </p>
                  )}
                  {m.mediaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.mediaUrl}
                      alt="Foto de comida"
                      className="w-full rounded-lg"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Peso y medidas de hoy</h3>
          <span className="text-xs text-pulso-soft">
            {measurementsWithUrls.length}{" "}
            {measurementsWithUrls.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        {measurementsWithUrls.length === 0 ? (
          <p className="text-sm text-pulso-soft">Sin registros hoy.</p>
        ) : (
          <ul className="space-y-3">
            {measurementsWithUrls.map((m) => {
              const label = MEASUREMENT_TYPE_LABEL[m.type as MeasurementType];
              const valueLabel = formatMeasurementValue(
                m.type as MeasurementType,
                m.value,
                m.unit,
              );
              return (
                <li key={m.id} className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{label}</span>
                    {valueLabel ? <> · {valueLabel}</> : null}
                    {" · "}
                    <span className="text-pulso-soft">
                      {formatHHMM(m.recordedAt)}
                    </span>
                  </p>
                  {m.note && (
                    <p className="text-xs text-pulso-soft italic">
                      “{m.note}”
                    </p>
                  )}
                  {m.mediaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.mediaUrl}
                      alt="Foto de progreso"
                      className="w-full rounded-lg"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Ejercicio de hoy</h3>
          <span className="text-xs text-pulso-soft">
            {exercisesWithUrls.length}{" "}
            {exercisesWithUrls.length === 1 ? "actividad" : "actividades"}
            {totalExerciseMinutes > 0 && totalLabel ? ` · ${totalLabel}` : ""}
          </span>
        </div>
        {exercisesWithUrls.length === 0 ? (
          <p className="text-sm text-pulso-soft">Sin registros hoy.</p>
        ) : (
          <ul className="space-y-3">
            {exercisesWithUrls.map((e) => {
              const label = EXERCISE_TYPE_LABEL[e.type as ExerciseType];
              const durationLabel = formatDuration(e.durationMinutes);
              const intensityLabel = e.intensity
                ? EXERCISE_INTENSITY_LABEL[e.intensity as ExerciseIntensity]
                : null;
              return (
                <li key={e.id} className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{label}</span>
                    {durationLabel ? <> · {durationLabel}</> : null}
                    {intensityLabel ? <> · {intensityLabel}</> : null}
                    {" · "}
                    <span className="text-pulso-soft">
                      {formatHHMM(e.recordedAt)}
                    </span>
                  </p>
                  {e.note && (
                    <p className="text-xs text-pulso-soft italic">
                      “{e.note}”
                    </p>
                  )}
                  {e.mediaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.mediaUrl}
                      alt="Foto del ejercicio"
                      className="w-full rounded-lg"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
