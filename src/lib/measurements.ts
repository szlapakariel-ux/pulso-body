export type MeasurementType =
  | "WEIGHT"
  | "WAIST"
  | "HIP"
  | "CHEST"
  | "ARM"
  | "PROGRESS_PHOTO"
  | "CUSTOM";

export const MEASUREMENT_TYPE_LABEL: Record<MeasurementType, string> = {
  WEIGHT: "Peso",
  WAIST: "Cintura",
  HIP: "Cadera",
  CHEST: "Pecho",
  ARM: "Brazo",
  PROGRESS_PHOTO: "Foto de progreso",
  CUSTOM: "Otro",
};

export const NUMERIC_TYPES: MeasurementType[] = [
  "WEIGHT",
  "WAIST",
  "HIP",
  "CHEST",
  "ARM",
];

export function defaultUnitFor(type: MeasurementType): string | null {
  if (type === "WEIGHT") return "kg";
  if (type === "WAIST" || type === "HIP" || type === "CHEST" || type === "ARM") {
    return "cm";
  }
  return null;
}

export function isNumericType(type: MeasurementType): boolean {
  return NUMERIC_TYPES.includes(type);
}

export function slugFromType(type: MeasurementType): string {
  return type.toLowerCase().replace(/_/g, "-");
}

export function typeFromSlug(slug: string | undefined | null): MeasurementType {
  if (!slug) return "CUSTOM";
  const upper = slug.toUpperCase().replace(/-/g, "_");
  if (
    upper === "WEIGHT" ||
    upper === "WAIST" ||
    upper === "HIP" ||
    upper === "CHEST" ||
    upper === "ARM" ||
    upper === "PROGRESS_PHOTO" ||
    upper === "CUSTOM"
  ) {
    return upper;
  }
  return "CUSTOM";
}

export function formatMeasurementValue(
  type: MeasurementType,
  value: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (value == null) return null;
  const u = unit ?? defaultUnitFor(type) ?? "";
  return u ? `${value} ${u}` : String(value);
}
