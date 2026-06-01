"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MediaType = "AUDIO" | "VIDEO" | "PHOTO";
type RecordableType = "AUDIO" | "VIDEO";
type Mode = "choose" | "record-audio" | "record-video" | "attach";

const CONTEXT_OPTIONS = [
  "Casa",
  "Trabajo",
  "Tren",
  "Auto",
  "Calle",
  "Antes de dormir",
  "Otro",
] as const;
type ContextLabel = (typeof CONTEXT_OPTIONS)[number];

function pickMime(kind: RecordableType): string {
  const candidates =
    kind === "AUDIO"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"]
      : [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return kind === "AUDIO" ? "audio/webm" : "video/webm";
}

function baseMime(t: string): string {
  return t.split(";")[0].trim();
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

export default function NewEntryForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [contextLabel, setContextLabel] = useState<ContextLabel | "">("");
  const [contextNote, setContextNote] = useState("");

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetCapture() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setFile(null);
    setElapsed(0);
    setError(null);
    setProgress("");
  }

  function goChoose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    resetCapture();
    setMode("choose");
    setMediaType(null);
  }

  async function startRecording(kind: RecordableType) {
    setError(null);
    resetCapture();
    setMediaType(kind);
    setMode(kind === "AUDIO" ? "record-audio" : "record-video");

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "No se pudo abrir la grabación directa. Podés adjuntar un archivo existente.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "VIDEO" ? { facingMode: "user" } : false,
      });
      streamRef.current = stream;

      if (kind === "VIDEO") {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            if (liveVideoRef.current) {
              liveVideoRef.current.srcObject = stream;
              liveVideoRef.current.play().catch(() => {});
            }
            resolve();
          });
        });
      }

      const mimeType = pickMime(kind);
      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(finalBlob);
        setPreviewUrl(URL.createObjectURL(finalBlob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Permiso denegado";
      setError(
        `No se pudo acceder al ${kind === "VIDEO" ? "micrófono/cámara" : "micrófono"}: ${msg}`,
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    const detected: MediaType = f.type.startsWith("image/")
      ? "PHOTO"
      : f.type.startsWith("video/")
        ? "VIDEO"
        : "AUDIO";
    setMediaType(detected);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function save() {
    const blobOrFile: Blob | File | null = blob ?? file;
    if (!blobOrFile || !mediaType) return;
    setLoading(true);
    setError(null);
    const isDev = process.env.NODE_ENV !== "production";
    let stage: "init" | "upload" | "complete" = "init";
    try {
      const rawContentType =
        blobOrFile.type ||
        (mediaType === "AUDIO"
          ? "audio/webm"
          : mediaType === "VIDEO"
            ? "video/webm"
            : "image/jpeg");
      const contentType = baseMime(rawContentType);
      const recordedAt = new Date().toISOString();
      const ctxLabel = contextLabel || undefined;
      const ctxNote = contextNote.trim() || undefined;

      setProgress("Preparando subida…");
      let initRes: Response;
      try {
        initRes = await fetch("/api/patient/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            mediaType,
            contentType,
            sizeBytes: blobOrFile.size,
            recordedAt,
            contextLabel: ctxLabel,
            contextNote: ctxNote,
          }),
        });
      } catch {
        throw new Error("No se pudo contactar el servidor para iniciar la subida.");
      }
      if (isDev) console.debug("[upload] init status", initRes.status);
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "No se pudo iniciar la subida");

      stage = "upload";
      setProgress("Subiendo archivo…");
      let putRes: Response;
      try {
        putRes = await fetch(initData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blobOrFile,
        });
      } catch {
        throw new Error(
          "No se pudo subir el archivo al almacenamiento. Probable CORS del bucket R2/S3 o URL firmada inválida.",
        );
      }
      if (isDev) console.debug("[upload] PUT status", putRes.status);
      if (!putRes.ok) {
        throw new Error(
          `No se pudo subir el archivo al almacenamiento (HTTP ${putRes.status}). Probable CORS del bucket R2/S3 o URL firmada inválida.`,
        );
      }

      stage = "complete";
      setProgress("Guardando…");
      let doneRes: Response;
      try {
        doneRes = await fetch("/api/patient/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            mediaType,
            mediaKey: initData.key,
            recordedAt,
            contextLabel: ctxLabel,
            contextNote: ctxNote,
          }),
        });
      } catch {
        throw new Error("No se pudo confirmar el guardado con el servidor.");
      }
      if (isDev) console.debug("[upload] complete status", doneRes.status);
      const doneData = await doneRes.json();
      if (!doneRes.ok) throw new Error(doneData.error || "No se pudo guardar el registro");
      router.replace("/patient/timeline");
      router.refresh();
    } catch (err) {
      if (isDev) console.debug("[upload] failed at stage", stage);
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  const hasCapture = Boolean((blob && previewUrl) || file);

  function ContextFields() {
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Contexto</label>
          <div className="flex flex-wrap gap-2">
            {CONTEXT_OPTIONS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setContextLabel(contextLabel === c ? "" : c)}
                className={contextLabel === c ? "btn-primary" : "btn-ghost"}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ctxnote">
            Agregar contexto breve (opcional)
          </label>
          <input
            id="ctxnote"
            maxLength={280}
            className="input"
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            placeholder="Ej: volviendo del trabajo"
          />
        </div>
      </div>
    );
  }

  if (mode === "choose") {
    return (
      <div className="card space-y-4">
        <p className="text-sm text-pulso-soft">¿Qué querés registrar?</p>
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => startRecording("AUDIO")}
            className="btn-primary py-6 text-base"
          >
            Grabar audio
          </button>
          <button
            type="button"
            onClick={() => startRecording("VIDEO")}
            className="btn-primary py-6 text-base"
          >
            Grabar video
          </button>
          <button
            type="button"
            onClick={() => {
              resetCapture();
              setMediaType(null);
              setMode("attach");
            }}
            className="btn-ghost py-6 text-base"
          >
            Adjuntar archivo
          </button>
        </div>
      </div>
    );
  }

  if (mode === "attach") {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-pulso-soft">Adjuntar archivo existente</p>
          <button type="button" onClick={goChoose} className="btn-ghost text-sm">
            ← Volver
          </button>
        </div>

        <div>
          <label className="label" htmlFor="file">
            Foto, audio o video
          </label>
          <input
            id="file"
            type="file"
            accept="image/*,audio/*,video/*"
            onChange={onFileChange}
            className="input"
          />
          <p className="text-xs text-pulso-soft mt-1">
            Detectamos el tipo según el archivo.
          </p>
        </div>

        {hasCapture && mediaType && previewUrl && (
          <div className="space-y-2">
            <p className="text-xs text-pulso-soft">Vista previa:</p>
            {mediaType === "AUDIO" ? (
              <audio controls src={previewUrl} className="w-full" />
            ) : mediaType === "VIDEO" ? (
              <video controls playsInline src={previewUrl} className="w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Vista previa" className="w-full rounded-lg" />
            )}
          </div>
        )}

        <ContextFields />

        {progress && <p className="text-sm text-pulso-soft">{progress}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={loading || !hasCapture}
          className="btn-primary w-full disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Guardar registro"}
        </button>
      </div>
    );
  }

  // record-audio / record-video
  const kind: RecordableType =
    mediaType === "AUDIO" || mediaType === "VIDEO"
      ? mediaType
      : mode === "record-video"
        ? "VIDEO"
        : "AUDIO";

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-pulso-soft">
          Grabar {kind === "AUDIO" ? "audio" : "video"}
        </p>
        <button type="button" onClick={goChoose} className="btn-ghost text-sm">
          ← Volver
        </button>
      </div>

      {kind === "VIDEO" && recording && (
        <video
          ref={liveVideoRef}
          muted
          playsInline
          autoPlay
          className="w-full rounded-lg bg-black aspect-video"
        />
      )}

      {recording && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            Grabando · {fmtTime(elapsed)}
          </span>
          <button type="button" onClick={stopRecording} className="btn-primary">
            Detener
          </button>
        </div>
      )}

      {!recording && hasCapture && previewUrl && (
        <div className="space-y-2">
          <p className="text-xs text-pulso-soft">Escuchá/mirá antes de guardar:</p>
          {kind === "AUDIO" ? (
            <audio controls src={previewUrl} className="w-full" />
          ) : (
            <video controls playsInline src={previewUrl} className="w-full rounded-lg" />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => startRecording(kind)}
              className="btn-ghost"
            >
              Repetir
            </button>
          </div>
        </div>
      )}

      {!recording && !hasCapture && !error && (
        <p className="text-sm text-pulso-soft">
          Pidiendo permiso para acceder al {kind === "VIDEO" ? "micrófono y la cámara" : "micrófono"}…
        </p>
      )}

      {hasCapture && <ContextFields />}

      {progress && <p className="text-sm text-pulso-soft">{progress}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasCapture && (
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="btn-primary w-full disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Guardar registro"}
        </button>
      )}
    </div>
  );
}
