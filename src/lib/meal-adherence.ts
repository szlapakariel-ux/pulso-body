import type { MealSlot } from "./meal-slots";
import {
  type AdherenceState,
  type ScheduleStatus,
  targetTimeToMinutes,
} from "./meal-schedules";

export const DEFAULT_TOLERANCE_MINUTES = 60;

export type ScheduleForAdherence = {
  id: string;
  mealSlot: MealSlot;
  targetTime: string;
  daysOfWeek: number[];
  status: ScheduleStatus;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type MealEntryForAdherence = {
  id: string;
  mealSlot: MealSlot | null;
  recordedAt: Date | null;
};

export type AdherenceResult = {
  state: AdherenceState;
  matchedEntryId: string | null;
};

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function resolveMealAdherence(
  schedule: ScheduleForAdherence,
  entriesToday: MealEntryForAdherence[],
  now: Date,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES,
): AdherenceResult {
  const target = targetTimeToMinutes(schedule.targetTime);
  const matching = entriesToday.filter(
    (e) => e.mealSlot === schedule.mealSlot && e.recordedAt != null,
  );

  if (matching.length === 0) {
    const nowM = minutesOf(now);
    if (nowM > target + toleranceMinutes) {
      return { state: "OMITIDO", matchedEntryId: null };
    }
    return { state: "PENDIENTE", matchedEntryId: null };
  }

  // hay registro; ¿alguno dentro de ventana?
  let withinId: string | null = null;
  for (const e of matching) {
    const m = minutesOf(e.recordedAt!);
    if (Math.abs(m - target) <= toleranceMinutes) {
      withinId = e.id;
      break;
    }
  }
  if (withinId) {
    return { state: "REGISTRADO", matchedEntryId: withinId };
  }
  return { state: "REGISTRADO_TARDE", matchedEntryId: matching[0].id };
}
