"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ExerciseView = {
  name: string;
  muscleGroup: string | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  notes: string | null;
};
type DayView = {
  dayNumber: number;
  title: string | null;
  warmup: string | null;
  cooldown: string | null;
  notes: string | null;
  exercises: ExerciseView[];
};

function fmtPrescription(e: ExerciseView): string {
  const bits: string[] = [];
  if (e.sets != null && e.reps != null) bits.push(`${e.sets}×${e.reps}`);
  else if (e.sets != null) bits.push(`${e.sets} series`);
  else if (e.reps != null) bits.push(`${e.reps} reps`);
  if (e.durationSeconds != null) bits.push(`${e.durationSeconds}s`);
  return bits.join(" · ");
}

export default function TrainingEditor({
  patientId,
  initialPlan,
  initialDays,
}: {
  patientId: string;
  initialPlan: { title: string; notes: string | null; daysPerWeek: number | null } | null;
  initialDays: DayView[];
}) {
  const router = useRouter();
  const base = `/api/psychologist/patients/${patientId}/training`;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Plan header
  const [title, setTitle] = useState(initialPlan?.title ?? "");
  const [notes, setNotes] = useState(initialPlan?.notes ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(
    initialPlan?.daysPerWeek != null ? String(initialPlan.daysPerWeek) : "3",
  );

  // Day sub-form
  const [dayNumber, setDayNumber] = useState("1");
  const [dayTitle, setDayTitle] = useState("");
  const [warmup, setWarmup] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [dayNotes, setDayNotes] = useState("");

  // Exercise sub-form
  const [exDay, setExDay] = useState("1");
  const [exName, setExName] = useState("");
  const [exMuscle, setExMuscle] = useState("");
  const [exSets, setExSets] = useState("");
  const [exReps, setExReps] = useState("");
  const [exDur, setExDur] = useState("");
  const [exNotes, setExNotes] = useState("");

  async function post(payload: Record<string, unknown>, tag: string, after?: () => void) {
    setError(null);
    setBusy(tag);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      after?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const hasPlan = Boolean(initialPlan);

  function numOr(v: string): number | undefined {
    const n = Number(v);
    return v.trim() && Number.isInteger(n) && n > 0 ? n : undefined;
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Plan header */}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold">Plan de entrenamiento</h3>
        <div>
          <label className="label" htmlFor="title">Título</label>
          <input id="title" className="input" maxLength={120} value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Rutina mes 1" />
        </div>
        <div>
          <label className="label" htmlFor="dpw">Días por semana</label>
          <input id="dpw" className="input" type="number" min="1" max="7" value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notas generales</label>
          <textarea id="notes" className="input min-h-20" maxLength={2000} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones generales…" />
        </div>
        <button type="button" disabled={busy !== null || !title.trim()}
          onClick={() => post(
            { action: "plan", title, notes: notes || undefined, daysPerWeek: numOr(daysPerWeek) },
            "plan")}
          className="btn-primary w-full disabled:opacity-60">
          {busy === "plan" ? "Guardando…" : hasPlan ? "Guardar plan" : "Crear plan"}
        </button>
      </section>

      {/* Días + ejercicios cargados */}
      {initialDays.length > 0 && (
        <section className="card space-y-3">
          <h3 className="text-sm font-semibold">Rutina actual</h3>
          {initialDays.map((d) => (
            <div key={d.dayNumber} className="rounded-lg bg-pulso-mute/40 p-2 space-y-1">
              <p className="text-sm font-medium">
                Día {d.dayNumber}{d.title ? ` · ${d.title}` : ""}
              </p>
              {d.warmup && <p className="text-xs text-pulso-soft">Entrada en calor: {d.warmup}</p>}
              {d.exercises.length > 0 && (
                <ul className="text-sm space-y-0.5">
                  {d.exercises.map((e, i) => (
                    <li key={i}>
                      • {e.name}
                      {e.muscleGroup ? ` (${e.muscleGroup})` : ""}
                      {fmtPrescription(e) ? ` — ${fmtPrescription(e)}` : ""}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {d.cooldown && <p className="text-xs text-pulso-soft">Cierre: {d.cooldown}</p>}
              {d.notes && <p className="text-xs text-pulso-soft italic">{d.notes}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Cargar día */}
      {hasPlan && (
        <section className="card space-y-2">
          <h3 className="text-sm font-semibold">Agregar / actualizar día</h3>
          <input className="input" type="number" min="1" max="7" value={dayNumber}
            onChange={(e) => setDayNumber(e.target.value)} placeholder="Número de día" />
          <input className="input" maxLength={120} value={dayTitle}
            onChange={(e) => setDayTitle(e.target.value)} placeholder="Título (ej: Pecho, hombros, tríceps)" />
          <input className="input" maxLength={1000} value={warmup}
            onChange={(e) => setWarmup(e.target.value)} placeholder="Entrada en calor (opcional)" />
          <input className="input" maxLength={1000} value={cooldown}
            onChange={(e) => setCooldown(e.target.value)} placeholder="Cardio / cierre (opcional)" />
          <input className="input" maxLength={1000} value={dayNotes}
            onChange={(e) => setDayNotes(e.target.value)} placeholder="Notas del día (opcional)" />
          <button type="button"
            disabled={busy !== null || !dayNumber.trim()}
            onClick={() => {
              const n = numOr(dayNumber);
              if (!n || n > 7) { setError("Día inválido (1–7)."); return; }
              post({ action: "day", dayNumber: n, title: dayTitle || undefined,
                warmup: warmup || undefined, cooldown: cooldown || undefined, notes: dayNotes || undefined },
                "day", () => { setDayTitle(""); setWarmup(""); setCooldown(""); setDayNotes(""); });
            }}
            className="btn-primary w-full disabled:opacity-60">
            {busy === "day" ? "Guardando…" : "Guardar día"}
          </button>
        </section>
      )}

      {/* Cargar ejercicio */}
      {hasPlan && (
        <section className="card space-y-2">
          <h3 className="text-sm font-semibold">Agregar ejercicio a un día</h3>
          <input className="input" type="number" min="1" max="7" value={exDay}
            onChange={(e) => setExDay(e.target.value)} placeholder="Día" />
          <input className="input" maxLength={120} value={exName}
            onChange={(e) => setExName(e.target.value)} placeholder="Nombre (ej: press banca)" />
          <input className="input" maxLength={120} value={exMuscle}
            onChange={(e) => setExMuscle(e.target.value)} placeholder="Grupo muscular (opcional)" />
          <div className="flex gap-2">
            <input className="input" type="number" min="1" value={exSets}
              onChange={(e) => setExSets(e.target.value)} placeholder="Series" />
            <input className="input" type="number" min="1" value={exReps}
              onChange={(e) => setExReps(e.target.value)} placeholder="Reps" />
            <input className="input" type="number" min="1" value={exDur}
              onChange={(e) => setExDur(e.target.value)} placeholder="Seg" />
          </div>
          <input className="input" maxLength={500} value={exNotes}
            onChange={(e) => setExNotes(e.target.value)} placeholder="Notas (opcional)" />
          <button type="button"
            disabled={busy !== null || !exName.trim() || !exDay.trim()}
            onClick={() => {
              const d = numOr(exDay);
              if (!d || d > 7) { setError("Día inválido (1–7)."); return; }
              post({ action: "exercise", dayNumber: d, name: exName,
                muscleGroup: exMuscle || undefined, sets: numOr(exSets), reps: numOr(exReps),
                durationSeconds: numOr(exDur), notes: exNotes || undefined },
                "ex", () => { setExName(""); setExMuscle(""); setExSets(""); setExReps(""); setExDur(""); setExNotes(""); });
            }}
            className="btn-primary w-full disabled:opacity-60">
            {busy === "ex" ? "Guardando…" : "Agregar ejercicio"}
          </button>
        </section>
      )}
    </div>
  );
}
