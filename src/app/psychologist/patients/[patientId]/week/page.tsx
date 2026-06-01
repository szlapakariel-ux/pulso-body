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
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
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

  const orderedBuckets = [...buckets].reverse();

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

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
        const empty =
          mealsCount === 0 && measurementsCount === 0 && exercisesCount === 0;

        return (
          <section key={b.key} className="card space-y-3">
            <h3 className="text-base font-semibold capitalize">{b.label}</h3>
            {empty ? (
              <p className="text-sm text-pulso-soft">Sin registros.</p>
            ) : (
              <div className="space-y-3 text-sm">
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
