"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";

type Guideline = {
  mealSlot: MealSlot;
  slotLabel: string;
  title: string | null;
  description: string;
  exampleMenu: string | null;
};
type WeeklyGoalView = {
  weekNumber: number;
  what: string;
  why: string | null;
  how: string | null;
  comments: string | null;
};

const GUIDELINE_SLOTS: MealSlot[] = ["BREAKFAST", "LUNCH", "SNACK_PM", "DINNER"];

export default function PlanEditor({
  patientId,
  initialNutrition,
  initialGuidelines,
  initialGoalPlan,
  initialWeeklyGoals,
}: {
  patientId: string;
  initialNutrition: { title: string; goal: string | null; generalNotes: string | null } | null;
  initialGuidelines: Guideline[];
  initialGoalPlan: { title: string } | null;
  initialWeeklyGoals: WeeklyGoalView[];
}) {
  const router = useRouter();
  const base = `/api/psychologist/patients/${patientId}/plan`;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Nutrition header
  const [title, setTitle] = useState(initialNutrition?.title ?? "");
  const [goal, setGoal] = useState(initialNutrition?.goal ?? "");
  const [generalNotes, setGeneralNotes] = useState(initialNutrition?.generalNotes ?? "");

  // Guideline sub-form
  const [gSlot, setGSlot] = useState<MealSlot>("BREAKFAST");
  const [gTitle, setGTitle] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gMenu, setGMenu] = useState("");

  // Goal plan header
  const [goalTitle, setGoalTitle] = useState(initialGoalPlan?.title ?? "");

  // Weekly goal sub-form
  const [week, setWeek] = useState("1");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [how, setHow] = useState("");
  const [comments, setComments] = useState("");

  async function post(action: string, payload: Record<string, unknown>, tag: string) {
    setError(null);
    setBusy(tag);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const hasNutritionPlan = Boolean(initialNutrition);
  const hasGoalPlan = Boolean(initialGoalPlan);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Plan alimentario */}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold">Plan alimentario</h3>
        <div>
          <label className="label" htmlFor="title">Título</label>
          <input id="title" className="input" maxLength={120} value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Plan recomposición" />
        </div>
        <div>
          <label className="label" htmlFor="goal">Objetivo</label>
          <input id="goal" className="input" maxLength={500} value={goal}
            onChange={(e) => setGoal(e.target.value)} placeholder="Ej: recomposición corporal" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notas generales</label>
          <textarea id="notes" className="input min-h-24" maxLength={2000} value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Recomendaciones, suplementos, hoja de ruta…" />
        </div>
        <button type="button" disabled={busy !== null || !title.trim()}
          onClick={() => post("nutrition-plan", { title, goal: goal || undefined, generalNotes: generalNotes || undefined }, "np")}
          className="btn-primary w-full disabled:opacity-60">
          {busy === "np" ? "Guardando…" : hasNutritionPlan ? "Guardar plan" : "Crear plan"}
        </button>
      </section>

      {/* Guías por comida */}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold">Guías por comida</h3>
        {!hasNutritionPlan && (
          <p className="text-xs text-pulso-soft">Primero creá el plan alimentario.</p>
        )}
        {initialGuidelines.length > 0 && (
          <ul className="space-y-2">
            {initialGuidelines.map((g) => (
              <li key={g.mealSlot} className="rounded-lg bg-pulso-mute/40 p-2 text-sm">
                <span className="font-medium">{g.slotLabel}</span>
                {g.title ? ` · ${g.title}` : ""}
                <p className="text-pulso-soft">{g.description}</p>
                {g.exampleMenu && (
                  <p className="text-xs text-pulso-soft italic mt-0.5">Ej: {g.exampleMenu}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {hasNutritionPlan && (
          <div className="space-y-2 border-t border-pulso-mute pt-3">
            <label className="label">Agregar / actualizar guía</label>
            <div className="flex flex-wrap gap-2">
              {GUIDELINE_SLOTS.map((s) => (
                <button type="button" key={s} onClick={() => setGSlot(s)}
                  className={s === gSlot ? "btn-primary" : "btn-ghost"}>
                  {MEAL_SLOT_LABEL[s]}
                </button>
              ))}
            </div>
            <input className="input" maxLength={120} value={gTitle}
              onChange={(e) => setGTitle(e.target.value)} placeholder="Título (opcional)" />
            <textarea className="input min-h-20" maxLength={2000} value={gDesc}
              onChange={(e) => setGDesc(e.target.value)} placeholder="Descripción (ej: proteína + fruta)" />
            <textarea className="input min-h-16" maxLength={2000} value={gMenu}
              onChange={(e) => setGMenu(e.target.value)} placeholder="Menú orientativo (opcional)" />
            <button type="button" disabled={busy !== null || !gDesc.trim()}
              onClick={() =>
                post("guideline",
                  { mealSlot: gSlot, title: gTitle || undefined, description: gDesc, exampleMenu: gMenu || undefined },
                  "g").then(() => { setGTitle(""); setGDesc(""); setGMenu(""); })
              }
              className="btn-primary w-full disabled:opacity-60">
              {busy === "g" ? "Guardando…" : `Guardar guía de ${MEAL_SLOT_LABEL[gSlot]}`}
            </button>
          </div>
        )}
      </section>

      {/* Objetivos semanales */}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold">Objetivos semanales</h3>
        <div>
          <label className="label" htmlFor="goalTitle">Título del plan de objetivos</label>
          <input id="goalTitle" className="input" maxLength={120} value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)} placeholder="Ej: Objetivos mes 1" />
        </div>
        <button type="button" disabled={busy !== null || !goalTitle.trim()}
          onClick={() => post("goal-plan", { title: goalTitle }, "gp")}
          className="btn-primary w-full disabled:opacity-60">
          {busy === "gp" ? "Guardando…" : hasGoalPlan ? "Guardar plan de objetivos" : "Crear plan de objetivos"}
        </button>

        {initialWeeklyGoals.length > 0 && (
          <ul className="space-y-2 border-t border-pulso-mute pt-3">
            {initialWeeklyGoals.map((w) => (
              <li key={w.weekNumber} className="rounded-lg bg-pulso-mute/40 p-2 text-sm">
                <span className="font-medium">Semana {w.weekNumber}</span>
                <p>{w.what}</p>
                {w.why && <p className="text-xs text-pulso-soft">Para qué: {w.why}</p>}
                {w.how && <p className="text-xs text-pulso-soft">Cómo: {w.how}</p>}
                {w.comments && <p className="text-xs text-pulso-soft italic">{w.comments}</p>}
              </li>
            ))}
          </ul>
        )}

        {hasGoalPlan && (
          <div className="space-y-2 border-t border-pulso-mute pt-3">
            <label className="label">Agregar / actualizar objetivo de una semana</label>
            <input className="input" type="number" min="1" max="52" value={week}
              onChange={(e) => setWeek(e.target.value)} placeholder="Semana" />
            <textarea className="input min-h-16" maxLength={500} value={what}
              onChange={(e) => setWhat(e.target.value)} placeholder="Qué quiero lograr" />
            <textarea className="input min-h-16" maxLength={500} value={why}
              onChange={(e) => setWhy(e.target.value)} placeholder="Para qué (opcional)" />
            <textarea className="input min-h-16" maxLength={500} value={how}
              onChange={(e) => setHow(e.target.value)} placeholder="Cómo (opcional)" />
            <input className="input" maxLength={500} value={comments}
              onChange={(e) => setComments(e.target.value)} placeholder="Comentarios (opcional)" />
            <button type="button"
              disabled={busy !== null || !what.trim() || !week.trim()}
              onClick={() => {
                const n = Number(week);
                if (!Number.isInteger(n) || n < 1 || n > 52) { setError("Semana inválida (1–52)."); return; }
                post("weekly-goal",
                  { weekNumber: n, what, why: why || undefined, how: how || undefined, comments: comments || undefined },
                  "wg").then(() => { setWhat(""); setWhy(""); setHow(""); setComments(""); });
              }}
              className="btn-primary w-full disabled:opacity-60">
              {busy === "wg" ? "Guardando…" : "Guardar objetivo de la semana"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
