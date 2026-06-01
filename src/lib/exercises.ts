export type ExerciseType =
  | "WALK"
  | "RUN"
  | "BIKE"
  | "STRENGTH"
  | "MOBILITY"
  | "SPORT"
  | "CUSTOM";

export type ExerciseIntensity = "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";

export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  WALK: "Caminata",
  RUN: "Correr",
  BIKE: "Bicicleta",
  STRENGTH: "Fuerza",
  MOBILITY: "Movilidad",
  SPORT: "Deporte",
  CUSTOM: "Otro",
};

export const EXERCISE_INTENSITY_LABEL: Record<ExerciseIntensity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CUSTOM: "Personalizada",
};

export const EXERCISE_TYPES: ExerciseType[] = [
  "WALK",
  "RUN",
  "BIKE",
  "STRENGTH",
  "MOBILITY",
  "SPORT",
  "CUSTOM",
];

export const EXERCISE_INTENSITIES: ExerciseIntensity[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CUSTOM",
];

export function typeFromSlug(slug: string | undefined | null): ExerciseType {
  if (!slug) return "WALK";
  const upper = slug.toUpperCase();
  if (EXERCISE_TYPES.includes(upper as ExerciseType)) {
    return upper as ExerciseType;
  }
  return "WALK";
}

export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
