import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmtPrescription(e: {
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
}): string {
  const bits: string[] = [];
  if (e.sets != null && e.reps != null) bits.push(`${e.sets}×${e.reps}`);
  else if (e.sets != null) bits.push(`${e.sets} series`);
  else if (e.reps != null) bits.push(`${e.reps} reps`);
  if (e.durationSeconds != null) bits.push(`${e.durationSeconds}s`);
  return bits.join(" · ");
}

export default async function PatientTrainingPage() {
  const user = await requireRolePage("PATIENT");

  const plan = await prisma.trainingPlan.findFirst({
    where: { patientId: user.id, status: "ACTIVE" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Tu rutina</h2>
        <p className="text-pulso-soft text-sm">Definida por tu profesional.</p>
      </div>

      {!plan ? (
        <div className="card text-pulso-soft">
          Todavía no hay una rutina cargada. Tu profesional la va a publicar acá.
        </div>
      ) : (
        <section className="card space-y-3">
          <h3 className="text-sm font-semibold">{plan.title}</h3>
          {plan.daysPerWeek != null && (
            <p className="text-sm text-pulso-soft">{plan.daysPerWeek} días por semana</p>
          )}
          {plan.notes && <p className="text-sm whitespace-pre-line">{plan.notes}</p>}

          {plan.days.length === 0 ? (
            <p className="text-sm text-pulso-soft">Sin días cargados todavía.</p>
          ) : (
            <div className="space-y-3 border-t border-pulso-mute pt-3">
              {plan.days.map((d) => (
                <div key={d.id} className="space-y-1">
                  <p className="text-sm font-medium">
                    Día {d.dayNumber}{d.title ? ` · ${d.title}` : ""}
                  </p>
                  {d.warmup && (
                    <p className="text-xs text-pulso-soft">Entrada en calor: {d.warmup}</p>
                  )}
                  {d.exercises.length > 0 && (
                    <ul className="text-sm space-y-0.5">
                      {d.exercises.map((e) => (
                        <li key={e.id}>
                          • {e.name}
                          {e.muscleGroup ? ` (${e.muscleGroup})` : ""}
                          {fmtPrescription(e) ? ` — ${fmtPrescription(e)}` : ""}
                          {e.notes ? ` · ${e.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {d.cooldown && (
                    <p className="text-xs text-pulso-soft">Cierre: {d.cooldown}</p>
                  )}
                  {d.notes && <p className="text-xs text-pulso-soft italic">{d.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Link href="/patient/today" className="btn-ghost inline-flex text-sm">
        ← Volver a Hoy
      </Link>
    </div>
  );
}
