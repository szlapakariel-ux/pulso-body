import type { MealSlot } from "./meal-slots";

export type ScheduleStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type AdherenceState =
  | "SIN_PROGRAMACION"
  | "PENDIENTE"
  | "REGISTRADO"
  | "REGISTRADO_TARDE"
  | "OMITIDO";

export const ADHERENCE_LABEL: Record<AdherenceState, string> = {
  SIN_PROGRAMACION: "Sin programación",
  PENDIENTE: "Pendiente",
  REGISTRADO: "Registrado",
  REGISTRADO_TARDE: "Registrado tarde",
  OMITIDO: "Omitido",
};

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
};

// JS Date.getDay(): 0 = domingo, 1 = lunes, …, 6 = sábado.
export const WEEKDAY_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

export const WEEKDAY_LABEL_FULL: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_DAYS_OF_WEEK = [1, 2, 3, 4, 5];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTargetTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function targetTimeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((s) => Number(s));
  return h * 60 + m;
}

export function minutesToHHMM(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDaysOfWeek(days: number[]): string {
  if (!days || days.length === 0) return "Sin días";
  if (days.length === 7) return "Todos los días";
  if (
    days.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => days.includes(d)) &&
    !days.includes(0) &&
    !days.includes(6)
  ) {
    return "Lun a Vie";
  }
  if (days.length === 2 && days.includes(0) && days.includes(6)) {
    return "Sáb y Dom";
  }
  return WEEKDAYS_MON_FIRST.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABEL[d])
    .join(", ");
}

export function normalizeDaysOfWeek(input: number[] | undefined | null): number[] {
  if (!input) return [];
  const set = new Set<number>();
  for (const n of input) {
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function scheduleAppliesToday(
  schedule: { daysOfWeek: number[]; status: ScheduleStatus; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): boolean {
  if (schedule.status !== "ACTIVE") return false;
  if (schedule.startsAt && now < schedule.startsAt) return false;
  if (schedule.endsAt && now > schedule.endsAt) return false;
  return schedule.daysOfWeek.includes(now.getDay());
}

export type MealSlotSlug =
  | "breakfast"
  | "snack-am"
  | "lunch"
  | "snack-pm"
  | "dinner"
  | "custom";

export function slotToSlug(slot: MealSlot): MealSlotSlug {
  switch (slot) {
    case "BREAKFAST":
      return "breakfast";
    case "SNACK_AM":
      return "snack-am";
    case "LUNCH":
      return "lunch";
    case "SNACK_PM":
      return "snack-pm";
    case "DINNER":
      return "dinner";
    default:
      return "custom";
  }
}
