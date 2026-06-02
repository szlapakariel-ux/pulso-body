import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import PhotoPreview from "@/components/photo-preview";
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
import {
  ADHERENCE_LABEL,
  scheduleAppliesToday,
} from "@/lib/meal-schedules";
import {
  resolveMealAdherence,
  type ScheduleForAdherence,
} from "@/lib/meal-adherence";

import {
  startOfLocalDay,
  endOfLocalDay,
  formatHHMM,
  formatDateAR,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

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

  const [meals, measurements, exercises, schedules] = await Promise.all([
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
    prisma.mealSchedule.findMany({
      where: {
        patientId: params.patientId,
        psychologistId: user.id,
        status: "ACTIVE",
      },
      orderBy: { targetTime: "asc" },
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

  const schedulesForToday: Array<
    ScheduleForAdherence & { label: string | null }
  > = schedules
    .filter((s) =>
      scheduleAppliesToday(
        {
          daysOfWeek: s.daysOfWeek,
          status: s.status,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        },
        now,
      ),
    )
    .map((s) => ({
      id: s.id,
      mealSlot: s.mealSlot as MealSlot,
      targetTime: s.targetTime,
      daysOfWeek: s.daysOfWeek,
      status: s.status,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      label: s.label,
    }));

  const mealsForAdherence = meals.map((m) => ({
    id: m.id,
    mealSlot: m.mealSlot as MealSlot | null,
    recordedAt: m.recordedAt,
  }));

  const adherenceRows = schedulesForToday.map((sched) => {
    const result = resolveMealAdherence(sched, mealsForAdherence, now);
    return {
      id: sched.id,
      targetTime: sched.targetTime,
      title: sched.label?.trim() || MEAL_SLOT_LABEL[sched.mealSlot],
      state: result.state,
    };
  });

  const adherenceCount = {
    expected: adherenceRows.length,
    registered: adherenceRows.filter((r) => r.state === "REGISTRADO").length,
    late: adherenceRows.filter((r) => r.state === "REGISTRADO_TARDE").length,
    pending: adherenceRows.filter((r) => r.state === "PENDIENTE").length,
    omitted: adherenceRows.filter((r) => r.state === "OMITIDO").length,
  };

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;
  const mealSchedulesHref = `/psychologist/patients/${params.patientId}/meal-schedules`;

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
        <p className="text-sm mt-1 capitalize">{formatDateAR(new Date())}</p>
      </div>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Adherencia de comidas</h3>
          <Link href={mealSchedulesHref} className="text-xs text-pulso-soft underline">
            Configurar comidas
          </Link>
        </div>
        {adherenceRows.length === 0 ? (
          <p className="text-sm text-pulso-soft">
            Este paciente todavía no tiene comidas programadas para hoy.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              Registradas:{" "}
              <span className="font-medium">
                {adherenceCount.registered}/{adherenceCount.expected}
              </span>
              {adherenceCount.late > 0 && (
                <span className="text-pulso-soft">
                  {" · Tarde: "}
                  {adherenceCount.late}
                </span>
              )}
              {adherenceCount.pending > 0 && (
                <span className="text-pulso-soft">
                  {" · Pendientes: "}
                  {adherenceCount.pending}
                </span>
              )}
              {adherenceCount.omitted > 0 && (
                <span className="text-pulso-soft">
                  {" · Omitidas: "}
                  {adherenceCount.omitted}
                </span>
              )}
            </p>
            <ul className="space-y-1">
              {adherenceRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-pulso-soft">{row.targetTime}</span>
                    {" · "}
                    <span className="font-medium">{row.title}</span>
                  </span>
                  <span className="text-xs text-pulso-soft">
                    {ADHERENCE_LABEL[row.state]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
                    <PhotoPreview src={m.mediaUrl} alt="Foto de comida" />
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
                    <PhotoPreview src={m.mediaUrl} alt="Foto de progreso" />
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
                    <PhotoPreview src={e.mediaUrl} alt="Foto del ejercicio" />
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
