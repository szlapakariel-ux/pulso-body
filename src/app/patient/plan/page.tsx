import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";

export const dynamic = "force-dynamic";

export default async function PatientPlanPage() {
  const user = await requireRolePage("PATIENT");

  const [nutritionPlan, goalPlan] = await Promise.all([
    prisma.nutritionPlan.findFirst({
      where: { patientId: user.id, status: "ACTIVE" },
      include: { guidelines: { orderBy: { order: "asc" } } },
    }),
    prisma.goalPlan.findFirst({
      where: { patientId: user.id, status: "ACTIVE" },
      include: { weeklyGoals: { orderBy: { weekNumber: "asc" } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Tu plan</h2>
        <p className="text-pulso-soft text-sm">Definido por tu profesional.</p>
      </div>

      {!nutritionPlan && !goalPlan && (
        <div className="card text-pulso-soft">
          Todavía no hay un plan cargado. Tu profesional lo va a publicar acá.
        </div>
      )}

      {nutritionPlan && (
        <section className="card space-y-3">
          <h3 className="text-sm font-semibold">{nutritionPlan.title}</h3>
          {nutritionPlan.goal && (
            <p className="text-sm">
              <span className="text-pulso-soft">Objetivo: </span>
              {nutritionPlan.goal}
            </p>
          )}
          {nutritionPlan.generalNotes && (
            <p className="text-sm whitespace-pre-line">{nutritionPlan.generalNotes}</p>
          )}
          {nutritionPlan.guidelines.length > 0 && (
            <ul className="space-y-2 border-t border-pulso-mute pt-3">
              {nutritionPlan.guidelines.map((g) => (
                <li key={g.id} className="text-sm">
                  <span className="font-medium">
                    {MEAL_SLOT_LABEL[g.mealSlot as MealSlot]}
                  </span>
                  {g.title ? ` · ${g.title}` : ""}
                  <p className="text-pulso-soft whitespace-pre-line">{g.description}</p>
                  {g.exampleMenu && (
                    <p className="text-xs text-pulso-soft italic mt-0.5 whitespace-pre-line">
                      Ej: {g.exampleMenu}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {goalPlan && (
        <section className="card space-y-3">
          <h3 className="text-sm font-semibold">{goalPlan.title}</h3>
          {goalPlan.weeklyGoals.length === 0 ? (
            <p className="text-sm text-pulso-soft">Sin objetivos cargados todavía.</p>
          ) : (
            <ul className="space-y-2">
              {goalPlan.weeklyGoals.map((w) => (
                <li key={w.id} className="text-sm">
                  <span className="font-medium">Semana {w.weekNumber}</span>
                  <p>{w.what}</p>
                  {w.why && <p className="text-xs text-pulso-soft">Para qué: {w.why}</p>}
                  {w.how && <p className="text-xs text-pulso-soft">Cómo: {w.how}</p>}
                  {w.comments && (
                    <p className="text-xs text-pulso-soft italic">{w.comments}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link href="/patient/today" className="btn-ghost inline-flex text-sm">
        ← Volver a Hoy
      </Link>
    </div>
  );
}
