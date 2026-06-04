import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import {
  ADHERENCE_LABEL,
  scheduleAppliesToday,
  slotToSlug,
} from "@/lib/meal-schedules";
import {
  resolveMealAdherence,
  type ScheduleForAdherence,
} from "@/lib/meal-adherence";
import {
  startOfLocalDay,
  endOfLocalDay,
  formatDateAR,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

type MealItem = {
  key: string;
  time: string;
  title: string;
  state: ReturnType<typeof resolveMealAdherence>["state"];
  slug: string;
};

type MockMealItem = {
  id: string;
  time: string;
  title: string;
  mealSlot: MealSlot;
};

const MOCK_MEALS: MockMealItem[] = [
  { id: "breakfast", time: "08:00", title: "Desayuno", mealSlot: "BREAKFAST" },
  { id: "snack-am", time: "11:00", title: "Colación", mealSlot: "SNACK_AM" },
  { id: "lunch", time: "13:30", title: "Almuerzo", mealSlot: "LUNCH" },
  { id: "snack-pm", time: "17:00", title: "Merienda", mealSlot: "SNACK_PM" },
  { id: "dinner", time: "21:00", title: "Cena", mealSlot: "DINNER" },
];

export default async function PatientTodayPage() {
  const user = await requireRolePage("PATIENT");
  const today = formatDateAR(new Date());
  const now = new Date();
  const range = { gte: startOfLocalDay(now), lte: endOfLocalDay(now) };

  const [
    mealsToday,
    schedules,
    measurementsTodayCount,
    exercisesTodayCount,
    activePlanCount,
    activeTrainingCount,
  ] = await Promise.all([
      prisma.timelineEntry.findMany({
        where: {
          patientId: user.id,
          entryKind: "MEAL",
          recordedAt: range,
        },
        select: { id: true, mealSlot: true, recordedAt: true },
      }),
      prisma.mealSchedule.findMany({
        where: { patientId: user.id, status: "ACTIVE" },
        orderBy: { targetTime: "asc" },
      }),
      prisma.measurementEntry.count({
        where: { patientId: user.id, recordedAt: range },
      }),
      prisma.exerciseEntry.count({
        where: { patientId: user.id, recordedAt: range },
      }),
      prisma.nutritionPlan.count({
        where: { patientId: user.id, status: "ACTIVE" },
      }),
      prisma.trainingPlan.count({
        where: { patientId: user.id, status: "ACTIVE" },
      }),
    ]);

  const measurementRegistered = measurementsTodayCount > 0;
  const exerciseRegistered = exercisesTodayCount > 0;
  const hasActivePlan = activePlanCount > 0;
  const hasActiveTraining = activeTrainingCount > 0;

  const schedulesForToday: ScheduleForAdherence[] = schedules
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
    }));

  const registeredSlots = new Set(
    mealsToday
      .map((e) => e.mealSlot)
      .filter((s): s is MealSlot => Boolean(s)),
  );

  let mealItems: MealItem[];
  let scheduledFallback = false;
  if (schedulesForToday.length > 0) {
    mealItems = schedulesForToday
      .map((sched) => {
        const orig = schedules.find((s) => s.id === sched.id);
        const result = resolveMealAdherence(sched, mealsToday, now);
        const title =
          orig?.label?.trim() || MEAL_SLOT_LABEL[sched.mealSlot];
        return {
          key: sched.id,
          time: sched.targetTime,
          title,
          state: result.state,
          slug: slotToSlug(sched.mealSlot),
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  } else {
    scheduledFallback = true;
    mealItems = MOCK_MEALS.map((m) => ({
      key: m.id,
      time: m.time,
      title: m.title,
      state: registeredSlots.has(m.mealSlot) ? "REGISTRADO" : "PENDIENTE",
      slug: m.id,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Hoy</h2>
        <p className="text-pulso-soft text-sm">Agenda diaria de Pulso Body</p>
        <p className="text-sm mt-1 capitalize">{today}</p>
      </div>

      {hasActivePlan && (
        <Link href="/patient/plan" className="card flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Tu plan</p>
            <p className="text-xs text-pulso-soft">
              Objetivo, guías por comida y objetivos semanales.
            </p>
          </div>
          <span className="text-sm text-pulso-soft">Ver →</span>
        </Link>
      )}

      {hasActiveTraining && (
        <Link href="/patient/training" className="card flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Tu rutina</p>
            <p className="text-xs text-pulso-soft">
              Días de entrenamiento y ejercicios.
            </p>
          </div>
          <span className="text-sm text-pulso-soft">Ver →</span>
        </Link>
      )}

      {scheduledFallback && (
        <div className="card text-sm text-pulso-soft">
          Todavía no tenés comidas programadas. Mostramos la agenda interna por
          defecto.
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-pulso-soft uppercase tracking-wide">
          Comidas
        </h3>
        {mealItems.map((item) => {
          const isRegistered =
            item.state === "REGISTRADO" || item.state === "REGISTRADO_TARDE";
          const isOmitido = item.state === "OMITIDO";
          return (
            <article key={item.key} className="card space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-pulso-soft uppercase tracking-wide">
                    {item.time} · Comida
                  </p>
                  <p className="text-base font-medium">{item.title}</p>
                </div>
                <span className="text-xs text-pulso-soft">
                  {ADHERENCE_LABEL[item.state]}
                </span>
              </div>
              <div>
                {isRegistered ? (
                  <Link href="/patient/timeline" className="btn-ghost text-sm">
                    Ver en timeline
                  </Link>
                ) : isOmitido ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/patient/new-entry?intent=meal&slot=${item.slug}`}
                      className="btn-ghost text-sm"
                    >
                      Registrar igual
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={`/patient/new-entry?intent=meal&slot=${item.slug}`}
                    className="btn-primary text-sm"
                  >
                    Registrar con foto
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-pulso-soft uppercase tracking-wide">
          Peso / medidas
        </h3>
        <article className="card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-pulso-soft uppercase tracking-wide">
                08:00 · Medición
              </p>
              <p className="text-base font-medium">Peso / medidas</p>
            </div>
            <span className="text-xs text-pulso-soft">
              {measurementRegistered ? "Registrado" : "Pendiente"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {measurementRegistered ? (
              <>
                <Link
                  href="/patient/measurements"
                  className="btn-ghost text-sm"
                >
                  Ver historial
                </Link>
                <Link
                  href="/patient/measurements/new?type=weight"
                  className="btn-ghost text-sm"
                >
                  Registrar otra
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/patient/measurements/new?type=weight"
                  className="btn-primary text-sm"
                >
                  Registrar
                </Link>
                <Link
                  href="/patient/measurements"
                  className="btn-ghost text-sm"
                >
                  Ver historial
                </Link>
              </>
            )}
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-pulso-soft uppercase tracking-wide">
          Ejercicio
        </h3>
        <article className="card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-pulso-soft uppercase tracking-wide">
                19:00 · Ejercicio
              </p>
              <p className="text-base font-medium">Ejercicio</p>
            </div>
            <span className="text-xs text-pulso-soft">
              {exerciseRegistered ? "Registrado" : "Pendiente"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {exerciseRegistered ? (
              <>
                <Link href="/patient/exercises" className="btn-ghost text-sm">
                  Ver historial
                </Link>
                <Link
                  href="/patient/exercises/new"
                  className="btn-ghost text-sm"
                >
                  Registrar otro
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/patient/exercises/new"
                  className="btn-primary text-sm"
                >
                  Registrar
                </Link>
                <Link href="/patient/exercises" className="btn-ghost text-sm">
                  Ver historial
                </Link>
              </>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
