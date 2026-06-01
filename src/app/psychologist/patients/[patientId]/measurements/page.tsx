import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { formatDateTime } from "@/lib/dates";
import { displayEmailFor } from "@/lib/demo";
import {
  MEASUREMENT_TYPE_LABEL,
  formatMeasurementValue,
  type MeasurementType,
} from "@/lib/measurements";

export const dynamic = "force-dynamic";

const ALL_TYPES: MeasurementType[] = [
  "WEIGHT",
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
  "PROGRESS_PHOTO",
  "CUSTOM",
];

function parseTypeFilter(raw: string | undefined): MeasurementType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return ALL_TYPES.includes(upper as MeasurementType)
    ? (upper as MeasurementType)
    : null;
}

export default async function PatientMeasurementsForPsychologist({
  params,
  searchParams,
}: {
  params: { patientId: string };
  searchParams?: { type?: string };
}) {
  const user = await requireRolePage("PSYCHOLOGIST");
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: params.patientId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile || profile.psychologistId !== user.id) notFound();

  const typeFilter = parseTypeFilter(searchParams?.type);

  const entries = await prisma.measurementEntry.findMany({
    where: {
      patientId: params.patientId,
      psychologistId: user.id,
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

  const baseHref = `/psychologist/patients/${params.patientId}/measurements`;
  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Peso y medidas</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={baseHref}
          className={!typeFilter ? "btn-primary" : "btn-ghost"}
        >
          Todas
        </Link>
        {ALL_TYPES.map((t) => (
          <Link
            key={t}
            href={`${baseHref}?type=${t.toLowerCase()}`}
            className={typeFilter === t ? "btn-primary" : "btn-ghost"}
          >
            {MEASUREMENT_TYPE_LABEL[t]}
          </Link>
        ))}
      </nav>

      {withUrls.length === 0 ? (
        <div className="card text-pulso-soft">
          {typeFilter
            ? `Este paciente todavía no tiene mediciones de tipo ${MEASUREMENT_TYPE_LABEL[typeFilter]}.`
            : "Este paciente todavía no tiene peso o medidas registradas."}
        </div>
      ) : (
        <ul className="space-y-3">
          {withUrls.map((m) => {
            const label = MEASUREMENT_TYPE_LABEL[m.type as MeasurementType];
            const valueLabel = formatMeasurementValue(
              m.type as MeasurementType,
              m.value,
              m.unit,
            );
            return (
              <li key={m.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{label}</span>
                    {valueLabel ? <> · {valueLabel}</> : null}
                  </p>
                  <span className="text-xs text-pulso-soft">
                    {formatDateTime(m.recordedAt)}
                  </span>
                </div>
                {m.note && (
                  <p className="text-sm text-pulso-soft italic">“{m.note}”</p>
                )}
                {m.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.mediaUrl}
                    alt="Foto de progreso"
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
