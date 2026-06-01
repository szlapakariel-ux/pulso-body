"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import {
  DEFAULT_DAYS_OF_WEEK,
  WEEKDAYS_MON_FIRST,
  WEEKDAY_LABEL,
} from "@/lib/meal-schedules";

const SLOTS: MealSlot[] = [
  "BREAKFAST",
  "SNACK_AM",
  "LUNCH",
  "SNACK_PM",
  "DINNER",
  "CUSTOM",
];

export default function MealScheduleForm({
  patientId,
}: {
  patientId: string;
}) {
  const router = useRouter();
  const [mealSlot, setMealSlot] = useState<MealSlot>("BREAKFAST");
  const [label, setLabel] = useState("");
  const [targetTime, setTargetTime] = useState("08:00");
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS_OF_WEEK);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  async function save() {
    setError(null);
    if (days.length === 0) {
      setError("Seleccioná al menos un día.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/psychologist/patients/${patientId}/meal-schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mealSlot,
            ...(label.trim() ? { label: label.trim() } : {}),
            targetTime,
            daysOfWeek: days,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setLabel("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Tipo de comida</label>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setMealSlot(s)}
              className={s === mealSlot ? "btn-primary" : "btn-ghost"}
            >
              {MEAL_SLOT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="label">
          Etiqueta (opcional)
        </label>
        <input
          id="label"
          maxLength={60}
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: post-entrenamiento"
        />
      </div>

      <div>
        <label className="label" htmlFor="targetTime">
          Hora target
        </label>
        <input
          id="targetTime"
          type="time"
          className="input"
          value={targetTime}
          onChange={(e) => setTargetTime(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label">Días de la semana</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS_MON_FIRST.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDay(d)}
              className={days.includes(d) ? "btn-primary" : "btn-ghost"}
            >
              {WEEKDAY_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          Nota privada (opcional)
        </label>
        <input
          id="note"
          maxLength={500}
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Solo visible para el profesional"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? "Guardando…" : "Agregar comida programada"}
      </button>
    </div>
  );
}
