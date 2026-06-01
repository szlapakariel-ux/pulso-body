import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { displayEmailFor } from "@/lib/demo";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import {
  MEASUREMENT_TYPE_LABEL,
  formatMeasurementValue,
  type MeasurementType,
} from "@/lib/measurements";
import {
  EXERCISE_TYPE_LABEL,
  formatDuration,
  type ExerciseType,
} from "@/lib/exercises";
import {
  ADHERENCE_LABEL,
  scheduleAppliesToday,
} from "@/lib/meal-schedules";
import {
  resolveMealAdherence,
  type ScheduleForAdherence,
  type AdherenceResult,
} from "@/lib/meal-adherence";

import { startOfLocalDay, endOfLocalDay, dayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
function formatRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export default async function PatientWeekForPsychologist({
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
  const end = endOfLocalDay(now);
  const startDay = new Date(now);
  startDay.setDate(startDay.getDate() - 6);
  const start = startOfLocalDay(startDay);

  const range = { gte: start, lte: end };

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
        mediaKey: true,
        recordedAt: true,
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
        mediaKey: true,
        recordedAt: true,
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

  type DayBucket = {
    key: string;
    label: string;
    date: Date;
    meals: typeof meals;
    measurements: typeof measurements;
    exercises: typeof exercises;
  };

  const buckets: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: dayKey(d),
      label: formatDayLabel(d),
      date: d,
      meals: [],
      measurements: [],
      exercises: [],
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const m of meals) {
    if (!m.recordedAt) continue;
    const k = dayKey(m.recordedAt);
    byKey.get(k)?.meals.push(m);
  }
  for (const m of measurements) {
    byKey.get(dayKey(m.recordedAt))?.measurements.push(m);
  }
  for (const e of exercises) {
    byKey.get(dayKey(e.recordedAt))?.exercises.push(e);
  }

  const todayKey = dayKey(now);

  type AdherenceRow = {
    id: string;
    targetTime: string;
    title: string;
    state: AdherenceResult["state"];
  };
  type AdherenceForDay = {
    expected: number;
    onTime: number;
    late: number;
    pending: number;
    omitted: number;
    rows: AdherenceRow[];
  };

  function adherenceForDay(b: (typeof buckets)[number]): AdherenceForDay {
    const referenceDate = b.key === todayKey ? now : endOfLocalDay(b.date);
    const applicable = schedules
      .filter((s) =>
        scheduleAppliesToday(
          {
            daysOfWeek: s.daysOfWeek,
            status: s.status,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          },
          b.date,
        ),
      )
      .map<ScheduleForAdherence>((s) => ({
        id: s.id,
        mealSlot: s.mealSlot as MealSlot,
        targetTime: s.targetTime,
        daysOfWeek: s.daysOfWeek,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      }));
    const mealsForDay = b.meals.map((m) => ({
      id: m.id,
      mealSlot: m.mealSlot as MealSlot | null,
      recordedAt: m.recordedAt,
    }));
    const rows: AdherenceRow[] = applicable.map((sched) => {
      const result = resolveMealAdherence(sched, mealsForDay, referenceDate);
      const orig = schedules.find((s) => s.id === sched.id);
      const title = orig?.label?.trim() || MEAL_SLOT_LABEL[sched.mealSlot];
      return {
        id: sched.id,
        targetTime: sched.targetTime,
        title,
        state: result.state,
      };
    });
    return {
      expected: rows.length,
      onTime: rows.filter((r) => r.state === "REGISTRADO").length,
      late: rows.filter((r) => r.state === "REGISTRADO_TARDE").length,
      pending: rows.filter((r) => r.state === "PENDIENTE").length,
      omitted: rows.filter((r) => r.state === "OMITIDO").length,
      rows,
    };
  }

  const adherenceByDay = new Map<string, AdherenceForDay>(
    buckets.map((b) => [b.key, adherenceForDay(b)]),
  );

  const weekTotals = {
    expected: 0,
    onTime: 0,
    late: 0,
    pending: 0,
    omitted: 0,
  };
  for (const a of adherenceByDay.values()) {
    weekTotals.expected += a.expected;
    weekTotals.onTime += a.onTime;
    weekTotals.late += a.late;
    weekTotals.pending += a.pending;
    weekTotals.omitted += a.omitted;
  }

  const orderedBuckets = [...buckets].reverse();

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;
  const mealSchedulesHref = `/psychologist/patients/${params.patientId}/meal-schedules`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Resumen semanal</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
        <p className="text-sm mt-1 capitalize">
          {formatRange(start, end)}
        </p>
      </div>

      <section className="card space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Adherencia semanal de comidas</h3>
          <Link href={mealSchedulesHref} className="text-xs text-pulso-soft underline">
            Configurar comidas
          </Link>
        </div>
        {weekTotals.expected === 0 ? (
          <p className="text-sm text-pulso-soft">
            Este paciente no tiene comidas programadas para esta semana.
          </p>
        ) : (
          <p className="text-sm">
            Registradas:{" "}
            <span className="font-medium">
              {weekTotals.onTime}/{weekTotals.expected}
            </span>
            {weekTotals.late > 0 && (
              <span className="text-pulso-soft">
                {" · Tarde: "}
                {weekTotals.late}
              </span>
            )}
            {weekTotals.pending > 0 && (
              <span className="text-pulso-soft">
                {" · Pendientes: "}
                {weekTotals.pending}
              </span>
            )}
            {weekTotals.omitted > 0 && (
              <span className="text-pulso-soft">
                {" · Omitidas: "}
                {weekTotals.omitted}
              </span>
            )}
          </p>
        )}
      </section>

      {orderedBuckets.map((b) => {
        const mealsCount = b.meals.length;
        const mealsWithPhoto = b.meals.filter((m) => Boolean(m.mediaKey)).length;
        const measurementsCount = b.measurements.length;
        const lastMeasurement = b.measurements[b.measurements.length - 1];
        const exercisesCount = b.exercises.length;
        const exerciseMinutes = b.exercises.reduce(
          (acc, e) => acc + (e.durationMinutes ?? 0),
          0,
        );
        const exerciseTotalLabel = formatDuration(exerciseMinutes);
        const a = adherenceByDay.get(b.key)!;
        const empty =
          mealsCount === 0 &&
          measurementsCount === 0 &&
          exercisesCount === 0 &&
          a.expected === 0;

        return (
          <section key={b.key} className="card space-y-3">
            <h3 className="text-base font-semibold capitalize">{b.label}</h3>
            {empty ? (
              <p className="text-sm text-pulso-soft">Sin registros.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  {a.expected === 0 ? (
                    <p className="text-pulso-soft">
                      <span className="font-medium text-pulso-fg">Adherencia comidas:</span>{" "}
                      Sin comidas programadas.
                    </p>
                  ) : (
                    <p>
                      <span className="font-medium">Adherencia comidas:</span>{" "}
                      {a.onTime}/{a.expected} registradas
                      {a.late > 0 && (
                        <span className="text-pulso-soft">
                          {" · "}
                          {a.late} tarde
                        </span>
                      )}
                      {a.pending > 0 && (
                        <span className="text-pulso-soft">
                          {" · "}
                          {a.pending} pendiente{a.pending === 1 ? "" : "s"}
                        </span>
                      )}
                      {a.omitted > 0 && (
                        <span className="text-pulso-soft">
                          {" · "}
                          {a.omitted} omitida{a.omitted === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  )}
                  {a.rows.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {a.rows.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-full bg-pulso-mute px-2 py-0.5 text-xs"
                        >
                          {row.targetTime} · {row.title} · {ADHERENCE_LABEL[row.state]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p>
                    <span className="font-medium">Comidas:</span> {mealsCount}
                    {mealsWithPhoto > 0 && (
                      <span className="text-pulso-soft">
                        {" · "}
                        {mealsWithPhoto}{" "}
                        {mealsWithPhoto === 1 ? "con foto" : "con foto"}
                      </span>
                    )}
                  </p>
                  {mealsCount > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {b.meals.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-full bg-pulso-mute px-2 py-0.5 text-xs"
                        >
                          {m.mealSlot
                            ? MEAL_SLOT_LABEL[m.mealSlot as MealSlot]
                            : "Comida"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p>
                    <span className="font-medium">Peso / medidas:</span>{" "}
                    {measurementsCount}
                    {lastMeasurement && (
                      <span className="text-pulso-soft">
                        {" — "}
                        {
                          MEASUREMENT_TYPE_LABEL[
                            lastMeasurement.type as MeasurementType
                          ]
                        }
                        {(() => {
                          const v = formatMeasurementValue(
                            lastMeasurement.type as MeasurementType,
                            lastMeasurement.value,
                            lastMeasurement.unit,
                          );
                          return v ? ` · ${v}` : "";
                        })()}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <p>
                    <span className="font-medium">Ejercicio:</span>{" "}
                    {exercisesCount}
                    {exerciseMinutes > 0 && exerciseTotalLabel ? (
                      <span className="text-pulso-soft">
                        {" — "}
                        {exerciseTotalLabel}
                      </span>
                    ) : null}
                  </p>
                  {exercisesCount > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {b.exercises.map((e) => (
                        <li
                          key={e.id}
                          className="rounded-full bg-pulso-mute px-2 py-0.5 text-xs"
                        >
                          {EXERCISE_TYPE_LABEL[e.type as ExerciseType]}
                          {e.durationMinutes
                            ? ` · ${formatDuration(e.durationMinutes)}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
