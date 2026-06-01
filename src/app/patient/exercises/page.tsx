import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { formatDateTime } from "@/lib/dates";
import {
  EXERCISE_INTENSITY_LABEL,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABEL,
  formatDuration,
  type ExerciseIntensity,
  type ExerciseType,
} from "@/lib/exercises";

export const dynamic = "force-dynamic";

function parseTypeFilter(raw: string | undefined): ExerciseType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return EXERCISE_TYPES.includes(upper as ExerciseType)
    ? (upper as ExerciseType)
    : null;
}

export default async function PatientExercisesPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const user = await requireRolePage("PATIENT");
  const typeFilter = parseTypeFilter(searchParams?.type);

  const entries = await prisma.exerciseEntry.findMany({
    where: {
      patientId: user.id,
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { recordedAt: "desc" },
    take: 30,
  });

  const withUrls = await Promise.all(
    entries.map(async (e) => ({
      ...e,
      mediaUrl: e.mediaKey ? await presignDownload(e.mediaKey) : null,
    })),
  );

  const baseHref = "/patient/exercises";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ejercicio</h2>
          <p className="text-pulso-soft text-sm">
            Tu historial de actividad (últimas 30).
          </p>
        </div>
        <Link href="/patient/exercises/new" className="btn-primary text-sm">
          + Registrar
        </Link>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={baseHref}
          className={!typeFilter ? "btn-primary" : "btn-ghost"}
        >
          Todas
        </Link>
        {EXERCISE_TYPES.map((t) => (
          <Link
            key={t}
            href={`${baseHref}?type=${t.toLowerCase()}`}
            className={typeFilter === t ? "btn-primary" : "btn-ghost"}
          >
            {EXERCISE_TYPE_LABEL[t]}
          </Link>
        ))}
      </nav>

      {withUrls.length === 0 ? (
        <div className="card text-pulso-soft">
          {typeFilter
            ? `Todavía no cargaste actividad de tipo ${EXERCISE_TYPE_LABEL[typeFilter]}.`
            : "Todavía no cargaste ejercicio."}
        </div>
      ) : (
        <ul className="space-y-3">
          {withUrls.map((e) => {
            const label = EXERCISE_TYPE_LABEL[e.type as ExerciseType];
            const durationLabel = formatDuration(e.durationMinutes);
            const intensityLabel = e.intensity
              ? EXERCISE_INTENSITY_LABEL[e.intensity as ExerciseIntensity]
              : null;
            return (
              <li key={e.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{label}</span>
                    {durationLabel ? <> · {durationLabel}</> : null}
                    {intensityLabel ? <> · {intensityLabel}</> : null}
                  </p>
                  <span className="text-xs text-pulso-soft">
                    {formatDateTime(e.recordedAt)}
                  </span>
                </div>
                {e.note && (
                  <p className="text-sm text-pulso-soft italic">“{e.note}”</p>
                )}
                {e.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.mediaUrl}
                    alt="Foto del ejercicio"
                    className="w-full rounded-lg"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
