import Link from "next/link";
import { requireRolePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AgendaKind = "MEAL" | "EXERCISE" | "MEASUREMENT";
type AgendaStatus = "PENDING" | "REGISTERED" | "OUT_OF_SCOPE";

type AgendaItem = {
  id: string;
  time: string;
  title: string;
  kind: AgendaKind;
  status: AgendaStatus;
};

const AGENDA: AgendaItem[] = [
  { id: "breakfast", time: "08:00", title: "Desayuno", kind: "MEAL", status: "PENDING" },
  { id: "weight", time: "08:00", title: "Peso / medidas", kind: "MEASUREMENT", status: "OUT_OF_SCOPE" },
  { id: "snack-am", time: "11:00", title: "Colación", kind: "MEAL", status: "PENDING" },
  { id: "lunch", time: "13:30", title: "Almuerzo", kind: "MEAL", status: "PENDING" },
  { id: "snack-pm", time: "17:00", title: "Merienda", kind: "MEAL", status: "PENDING" },
  { id: "exercise", time: "19:00", title: "Ejercicio", kind: "EXERCISE", status: "OUT_OF_SCOPE" },
  { id: "dinner", time: "21:00", title: "Cena", kind: "MEAL", status: "PENDING" },
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

export default async function PatientTodayPage() {
  await requireRolePage("PATIENT");
  const today = formatToday();

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
          const isOutOfScope = item.status === "OUT_OF_SCOPE";
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
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <div>
                {isMeal ? (
                  <Link
                    href={`/patient/new-entry?intent=meal&slot=${item.id}`}
                    className="btn-primary text-sm"
                  >
                    Registrar con foto
                  </Link>
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
