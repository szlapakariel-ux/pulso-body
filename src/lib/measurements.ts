export type MeasurementType =
  | "WEIGHT"
  | "WAIST"
  | "HIP"
  | "CHEST"
  | "ARM"
  | "NECK"
  | "THIGH"
  | "BODY_FAT"
  | "PROGRESS_PHOTO"
  | "CUSTOM";

export const MEASUREMENT_TYPE_LABEL: Record<MeasurementType, string> = {
  WEIGHT: "Peso",
  WAIST: "Cintura",
  HIP: "Cadera",
  CHEST: "Pecho",
  ARM: "Brazo",
  NECK: "Cuello",
  THIGH: "Muslo",
  BODY_FAT: "Grasa corporal",
  PROGRESS_PHOTO: "Foto de progreso",
  CUSTOM: "Otro",
};

const CM_TYPES: MeasurementType[] = ["WAIST", "HIP", "CHEST", "ARM", "NECK", "THIGH"];

export const NUMERIC_TYPES: MeasurementType[] = [
  "WEIGHT",
  ...CM_TYPES,
  "BODY_FAT",
];

const KNOWN_TYPES: MeasurementType[] = [
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

export function defaultUnitFor(type: MeasurementType): string | null {
  if (type === "WEIGHT") return "kg";
  if (type === "BODY_FAT") return "%";
  if (CM_TYPES.includes(type)) return "cm";
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
  const upper = slug.toUpperCase().replace(/-/g, "_") as MeasurementType;
  return KNOWN_TYPES.includes(upper) ? upper : "CUSTOM";
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
