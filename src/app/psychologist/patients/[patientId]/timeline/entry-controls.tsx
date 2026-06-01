"use client";

import { useState } from "react";

type Note = { id: string; content: string; createdAt: string };
type Trans = {
  status: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | "FAILED";
  text: string | null;
} | null;

type AiStatus = "NOT_REQUESTED" | "PENDING" | "COMPLETED" | "FAILED";
type AiStage = null | "transcribing" | "summarizing";

type AiState = {
  status: AiStatus;
  title: string | null;
  summary: string | null;
};

export default function EntryControls({
  entryId,
  mediaType,
  initialNotes,
  initialTranscription,
  initialAi,
}: {
  entryId: string;
  mediaType: "AUDIO" | "VIDEO" | "PHOTO";
  initialNotes: Note[];
  initialTranscription: Trans;
  initialAi: AiState;
}) {
  const supportsAi = mediaType !== "PHOTO";
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [trans, setTrans] = useState<Trans>(initialTranscription);
  const [requestingTrans, setRequestingTrans] = useState(false);
  const [ai, setAi] = useState<AiState>(initialAi);
  const [aiStage, setAiStage] = useState<AiStage>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/psychologist/entries/${entryId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la nota");
      setNotes((prev) => [data.note, ...prev]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingNote(false);
    }
  }

  async function ensureTranscription(): Promise<string | null> {
    if (trans?.text && trans.text.trim().length > 0) return trans.text;
    setTrans((prev) => ({ status: "PENDING", text: prev?.text ?? null }));
    const res = await fetch(
      `/api/psychologist/entries/${entryId}/transcription-request`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTrans((prev) => ({ status: "FAILED", text: prev?.text ?? null }));
      throw new Error(data.error || "No se pudo transcribir el audio.");
    }
    setTrans({ status: data.status, text: data.text ?? null });
    if (!data.text || !String(data.text).trim()) {
      throw new Error("La transcripción quedó vacía.");
    }
    return data.text as string;
  }

  async function requestTrans() {
    setRequestingTrans(true);
    setError(null);
    try {
      await ensureTranscription();
      setShowTranscript(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setRequestingTrans(false);
    }
  }

  async function generateAi() {
    setError(null);
    setAi((p) => ({ ...p, status: "PENDING" }));
    try {
      if (!(trans?.text && trans.text.trim().length > 0)) {
        setAiStage("transcribing");
        await ensureTranscription();
      }
      setAiStage("summarizing");
      const res = await fetch(`/api/psychologist/entries/${entryId}/ai-summary`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAi((p) => ({ ...p, status: "FAILED" }));
        throw new Error(data.error || "No se pudo generar el resumen.");
      }
      setAi({
        status: data.aiStatus,
        title: data.aiTitle,
        summary: data.aiSummary,
      });
    } catch (err) {
      setAi((p) => ({ ...p, status: "FAILED" }));
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAiStage(null);
    }
  }

  const transLabel = (() => {
    if (!trans || trans.status === "NOT_REQUESTED") return "Sin solicitar";
    if (trans.status === "PENDING") return "Transcribiendo…";
    if (trans.status === "FAILED") return "Falló la transcripción";
    return "Completada";
  })();

  const hasTranscript = Boolean(trans?.text && trans.text.trim().length > 0);
  const aiBusy = aiStage !== null;

  return (
    <div className="space-y-4 border-t border-pulso-mute pt-3">
      <section>
        <h5 className="text-sm font-semibold mb-2">Notas privadas</h5>
        <p className="text-xs text-pulso-soft mb-2">Solo vos podés ver estas notas.</p>
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-pulso-bg p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-pulso-soft mt-1">
                {new Date(n.createdAt).toLocaleString("es-AR")}
              </p>
            </li>
          ))}
          {notes.length === 0 && <li className="text-sm text-pulso-soft">Sin notas todavía.</li>}
        </ul>
        <form onSubmit={saveNote} className="mt-2 flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribir una nota privada…"
            className="input min-h-[64px] flex-1"
          />
          <button type="submit" disabled={savingNote} className="btn-primary self-end">
            {savingNote ? "Guardando…" : "Agregar"}
          </button>
        </form>
      </section>

      {!supportsAi && (
        <p className="text-sm text-pulso-soft italic">
          Transcripción y resumen IA disponibles solo para audio/video.
        </p>
      )}

      {supportsAi && (
      <>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold">Transcripción</h5>
          <button
            type="button"
            onClick={requestTrans}
            disabled={
              requestingTrans ||
              trans?.status === "PENDING" ||
              trans?.status === "COMPLETED"
            }
            className="btn-ghost text-sm py-2"
          >
            {requestingTrans
              ? "Solicitando…"
              : trans?.status === "COMPLETED"
                ? "Solicitada"
                : "Solicitar transcripción"}
          </button>
        </div>
        <p className="text-sm text-pulso-soft mt-1">{transLabel}</p>
        {hasTranscript && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="btn-ghost text-sm py-1"
            >
              {showTranscript ? "Ocultar transcripción" : "Ver transcripción"}
            </button>
            {showTranscript && trans?.text && (
              <p className="mt-2 whitespace-pre-wrap text-sm rounded-lg bg-pulso-bg p-3">
                {trans.text}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold">Título y resumen sugeridos (IA)</h5>
          {(ai.status === "NOT_REQUESTED" || ai.status === "FAILED") && (
            <button
              type="button"
              onClick={generateAi}
              disabled={aiBusy}
              className="btn-ghost text-sm py-2"
            >
              {aiBusy ? "Generando…" : "Generar título y resumen IA"}
            </button>
          )}
          {ai.status === "COMPLETED" && (
            <button
              type="button"
              onClick={generateAi}
              disabled={aiBusy}
              className="btn-ghost text-sm py-2"
            >
              {aiBusy ? "Regenerando…" : "Regenerar"}
            </button>
          )}
        </div>

        {!hasTranscript && ai.status !== "COMPLETED" && !aiBusy && (
          <p className="text-sm text-pulso-soft mt-1">
            Pulso Body va a transcribir el audio antes de generar el resumen.
          </p>
        )}
        {aiStage === "transcribing" && (
          <p className="text-sm text-pulso-soft mt-1">Transcribiendo audio…</p>
        )}
        {aiStage === "summarizing" && (
          <p className="text-sm text-pulso-soft mt-1">Generando resumen…</p>
        )}
        {!aiBusy && ai.status === "FAILED" && (
          <p className="text-sm text-red-600 mt-1">
            No se pudo generar el resumen. Probá de nuevo.
          </p>
        )}
        {ai.status === "COMPLETED" && (ai.title || ai.summary) && (
          <div className="mt-2 space-y-2 rounded-lg bg-pulso-ai p-3 text-sm">
            {ai.title && (
              <p>
                <span className="text-pulso-soft">Título sugerido:</span>{" "}
                <span className="font-medium">{ai.title}</span>
              </p>
            )}
            {ai.summary && (
              <p>
                <span className="text-pulso-soft">Resumen de lo dicho:</span>{" "}
                <span className="whitespace-pre-wrap">{ai.summary}</span>
              </p>
            )}
            <p className="text-xs text-pulso-soft italic">
              Resumen descriptivo automático. No es interpretación clínica.
            </p>
          </div>
        )}
      </section>
      </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
