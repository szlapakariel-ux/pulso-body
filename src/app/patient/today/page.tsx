import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import type { MealSlot } from "@/lib/meal-slots";

export const dynamic = "force-dynamic";

type AgendaKind = "MEAL" | "EXERCISE" | "MEASUREMENT";
type AgendaStatus = "PENDING" | "REGISTERED" | "OUT_OF_SCOPE";

type AgendaItem = {
  id: string;
  time: string;
  title: string;
  kind: AgendaKind;
  status: AgendaStatus;
  mealSlot?: MealSlot;
};

const AGENDA: AgendaItem[] = [
  { id: "breakfast", time: "08:00", title: "Desayuno", kind: "MEAL", status: "PENDING", mealSlot: "BREAKFAST" },
  { id: "weight", time: "08:00", title: "Peso / medidas", kind: "MEASUREMENT", status: "PENDING" },
  { id: "snack-am", time: "11:00", title: "Colación", kind: "MEAL", status: "PENDING", mealSlot: "SNACK_AM" },
  { id: "lunch", time: "13:30", title: "Almuerzo", kind: "MEAL", status: "PENDING", mealSlot: "LUNCH" },
  { id: "snack-pm", time: "17:00", title: "Merienda", kind: "MEAL", status: "PENDING", mealSlot: "SNACK_PM" },
  { id: "exercise", time: "19:00", title: "Ejercicio", kind: "EXERCISE", status: "PENDING" },
  { id: "dinner", time: "21:00", title: "Cena", kind: "MEAL", status: "PENDING", mealSlot: "DINNER" },
];

const KIND_LABEL: Record<AgendaKind, string> = {
  MEAL: "Comida",
  EXERCISE: "Ejercicio",
  MEASUREMENT: "Medición",
};

const STATUS_LABEL: Record<AgendaStatus, string> = {
  PENDING: "Pendiente",
  REGISTERED: "Registrado",
  OUT_OF_SCOPE: "Próximamente",
};

function formatToday(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

export default async function PatientTodayPage() {
  const user = await requireRolePage("PATIENT");
  const today = formatToday();

  const now = new Date();
  const mealsToday = await prisma.timelineEntry.findMany({
    where: {
      patientId: user.id,
      entryKind: "MEAL",
      recordedAt: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
    },
    select: { mealSlot: true },
  });
  const registeredSlots = new Set(
    mealsToday.map((e) => e.mealSlot).filter((s): s is MealSlot => Boolean(s)),
  );

  const measurementsTodayCount = await prisma.measurementEntry.count({
    where: {
      patientId: user.id,
      recordedAt: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
    },
  });
  const measurementRegistered = measurementsTodayCount > 0;

  const exercisesTodayCount = await prisma.exerciseEntry.count({
    where: {
      patientId: user.id,
      recordedAt: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
    },
  });
  const exerciseRegistered = exercisesTodayCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Hoy</h2>
        <p className="text-pulso-soft text-sm">Agenda diaria de Pulso Body</p>
        <p className="text-sm mt-1 capitalize">{today}</p>
      </div>

      <div className="card text-sm text-pulso-soft">
        Esta agenda es una primera versión interna. Los horarios reales serán
        configurables por el profesional en próximos microciclos.
      </div>

      <section className="space-y-3">
        {AGENDA.map((item) => {
          const isMeal = item.kind === "MEAL";
          const isMeasurement = item.kind === "MEASUREMENT";
          const isExercise = item.kind === "EXERCISE";
          const isRegistered =
            (isMeal && item.mealSlot && registeredSlots.has(item.mealSlot)) ||
            (isMeasurement && measurementRegistered) ||
            (isExercise && exerciseRegistered);
          const status: AgendaStatus = isRegistered ? "REGISTERED" : item.status;
          return (
            <article key={item.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-pulso-soft uppercase tracking-wide">
                    {item.time} · {KIND_LABEL[item.kind]}
                  </p>
                  <p className="text-base font-medium">{item.title}</p>
                </div>
                <span className="text-xs text-pulso-soft">
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <div>
                {isMeal && isRegistered ? (
                  <Link href="/patient/timeline" className="btn-ghost text-sm">
                    Ver en timeline
                  </Link>
                ) : isMeal ? (
                  <Link
                    href={`/patient/new-entry?intent=meal&slot=${item.id}`}
                    className="btn-primary text-sm"
                  >
                    Registrar con foto
                  </Link>
                ) : isMeasurement && measurementRegistered ? (
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : isMeasurement ? (
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : isExercise && exerciseRegistered ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href="/patient/exercises" className="btn-ghost text-sm">
                      Ver historial
                    </Link>
                    <Link
                      href="/patient/exercises/new"
                      className="btn-ghost text-sm"
                    >
                      Registrar otro
                    </Link>
                  </div>
                ) : isExercise ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/patient/exercises/new"
                      className="btn-primary text-sm"
                    >
                      Registrar
                    </Link>
                    <Link href="/patient/exercises" className="btn-ghost text-sm">
                      Ver historial
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn-ghost text-sm disabled:opacity-60"
                  >
                    Próximamente
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="text-xs text-pulso-soft">
        Por ahora las comidas se cargan desde el registro general con foto.
      </p>
    </div>
  );
}
