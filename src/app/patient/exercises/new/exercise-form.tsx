"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EXERCISE_INTENSITIES,
  EXERCISE_INTENSITY_LABEL,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABEL,
  type ExerciseIntensity,
  type ExerciseType,
} from "@/lib/exercises";

function baseMime(t: string): string {
  return t.split(";")[0].trim();
}

export default function ExerciseForm({
  initialType = "WALK",
}: {
  initialType?: ExerciseType;
}) {
  const router = useRouter();
  const [type, setType] = useState<ExerciseType>(initialType);
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<ExerciseIntensity | "">("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  async function uploadPhoto(f: File): Promise<string> {
    const contentType = baseMime(f.type || "image/jpeg");
    setProgress("Preparando subida…");
    const initRes = await fetch("/api/patient/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "init",
        mediaType: "PHOTO",
        contentType,
        sizeBytes: f.size,
      }),
    });
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error || "No se pudo iniciar la subida");

    setProgress("Subiendo foto…");
    const putRes = await fetch(initData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: f,
    });
    if (!putRes.ok) {
      throw new Error(`No se pudo subir la foto (HTTP ${putRes.status}).`);
    }
    return initData.key as string;
  }

  async function save() {
    setError(null);

    const durationNum = duration.trim() ? Number(duration) : undefined;
    if (durationNum !== undefined) {
      if (!Number.isInteger(durationNum) || durationNum <= 0 || durationNum > 600) {
        setError("Duración inválida (1 a 600 minutos).");
        return;
      }
    }
    if (type !== "CUSTOM" && durationNum === undefined && !note.trim()) {
      setError("Cargá la duración o una nota.");
      return;
    }
    if (type === "CUSTOM" && durationNum === undefined && !note.trim() && !file) {
      setError("Cargá al menos duración, nota o foto.");
      return;
    }

    setLoading(true);
    try {
      let mediaKey: string | undefined;
      if (file) mediaKey = await uploadPhoto(file);

      setProgress("Guardando…");
      const res = await fetch("/api/patient/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...(durationNum !== undefined ? { durationMinutes: durationNum } : {}),
          ...(intensity ? { intensity } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(mediaKey ? { mediaKey, mediaType: "PHOTO" as const } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      router.replace("/patient/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Tipo</label>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={t === type ? "btn-primary" : "btn-ghost"}
            >
              {EXERCISE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="duration">
          Duración (min)
        </label>
        <input
          id="duration"
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          max="600"
          className="input"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Ej: 30"
        />
      </div>

      <div>
        <label className="label">Intensidad</label>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_INTENSITIES.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIntensity(intensity === i ? "" : i)}
              className={intensity === i ? "btn-primary" : "btn-ghost"}
            >
              {EXERCISE_INTENSITY_LABEL[i]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          Nota (opcional)
        </label>
        <input
          id="note"
          maxLength={500}
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: trote suave en el parque"
        />
      </div>

      <div>
        <label className="label" htmlFor="file">
          Foto (opcional)
        </label>
        <input
          id="file"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
      </div>

      {progress && <p className="text-sm text-pulso-soft">{progress}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
