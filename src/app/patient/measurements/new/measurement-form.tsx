"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MEASUREMENT_TYPE_LABEL,
  defaultUnitFor,
  isNumericType,
  type MeasurementType,
} from "@/lib/measurements";

const TYPE_OPTIONS: MeasurementType[] = [
  "WEIGHT",
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
  "PROGRESS_PHOTO",
  "CUSTOM",
];

function baseMime(t: string): string {
  return t.split(";")[0].trim();
}

export default function MeasurementForm({
  initialType = "WEIGHT",
}: {
  initialType?: MeasurementType;
}) {
  const router = useRouter();
  const [type, setType] = useState<MeasurementType>(initialType);
  const [valueStr, setValueStr] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const unit = useMemo(() => defaultUnitFor(type), [type]);
  const needsValue = isNumericType(type);
  const needsPhoto = type === "PROGRESS_PHOTO";
  const allowsPhoto = needsPhoto || type === "CUSTOM";

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

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

    if (needsValue && !valueStr.trim()) {
      setError("Ingresá un valor numérico.");
      return;
    }
    if (needsPhoto && !file) {
      setError("Adjuntá la foto de progreso.");
      return;
    }
    if (type === "CUSTOM" && !valueStr.trim() && !note.trim() && !file) {
      setError("Cargá al menos un valor, una nota o una foto.");
      return;
    }

    setLoading(true);
    try {
      let mediaKey: string | undefined;
      if (file) {
        mediaKey = await uploadPhoto(file);
      }

      const value = valueStr.trim() ? Number(valueStr.replace(",", ".")) : undefined;
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new Error("Valor numérico inválido.");
      }

      setProgress("Guardando…");
      const res = await fetch("/api/patient/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...(value !== undefined ? { value } : {}),
          ...(unit ? { unit } : {}),
          ...(mediaKey ? { mediaKey, mediaType: "PHOTO" as const } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
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
          {TYPE_OPTIONS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={t === type ? "btn-primary" : "btn-ghost"}
            >
              {MEASUREMENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {needsValue && (
        <div>
          <label className="label" htmlFor="value">
            Valor {unit ? `(${unit})` : ""}
          </label>
          <input
            id="value"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className="input"
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
            placeholder={unit === "kg" ? "Ej: 74.5" : "Ej: 82"}
          />
        </div>
      )}

      {type === "CUSTOM" && (
        <div>
          <label className="label" htmlFor="value">
            Valor numérico (opcional)
          </label>
          <input
            id="value"
            type="number"
            inputMode="decimal"
            step="0.1"
            className="input"
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
          />
        </div>
      )}

      {allowsPhoto && (
        <div>
          <label className="label" htmlFor="file">
            {needsPhoto ? "Foto de progreso" : "Foto (opcional)"}
          </label>
          <input
            id="file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="input"
          />
        </div>
      )}

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
          placeholder="Ej: en ayunas"
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
