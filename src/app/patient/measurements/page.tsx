import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { presignDownload } from "@/lib/s3";
import { formatDateTime } from "@/lib/dates";
import PhotoPreview from "@/components/photo-preview";
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
  "NECK",
  "THIGH",
  "BODY_FAT",
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

export default async function PatientMeasurementsPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const user = await requireRolePage("PATIENT");
  const typeFilter = parseTypeFilter(searchParams?.type);

  const entries = await prisma.measurementEntry.findMany({
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

  const baseHref = "/patient/measurements";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Peso y medidas</h2>
          <p className="text-pulso-soft text-sm">
            Tu historial de mediciones (últimas 30).
          </p>
        </div>
        <Link
          href="/patient/measurements/new"
          className="btn-primary text-sm"
        >
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
            ? `Todavía no cargaste mediciones de tipo ${MEASUREMENT_TYPE_LABEL[typeFilter]}.`
            : "Todavía no cargaste peso o medidas."}
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
                  <PhotoPreview src={m.mediaUrl} alt="Foto de progreso" variant="thumb" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
