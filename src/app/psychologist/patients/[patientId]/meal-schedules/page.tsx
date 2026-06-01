import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { displayEmailFor } from "@/lib/demo";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/meal-slots";
import {
  formatDaysOfWeek,
  SCHEDULE_STATUS_LABEL,
  type ScheduleStatus,
} from "@/lib/meal-schedules";
import MealScheduleForm from "./meal-schedule-form";
import MealScheduleRowActions from "./row-actions";

export const dynamic = "force-dynamic";

export default async function MealSchedulesPage({
  params,
}: {
  params: { patientId: string };
}) {
  const user = await requireRolePage("PSYCHOLOGIST");
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: params.patientId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile || profile.psychologistId !== user.id) notFound();

  const schedules = await prisma.mealSchedule.findMany({
    where: {
      patientId: params.patientId,
      psychologistId: user.id,
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ targetTime: "asc" }, { createdAt: "asc" }],
  });

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Comidas programadas</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Agenda actual</h3>
        {schedules.length === 0 ? (
          <p className="card text-sm text-pulso-soft">
            Todavía no hay comidas programadas para este paciente.
          </p>
        ) : (
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li key={s.id} className="card space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">
                      {MEAL_SLOT_LABEL[s.mealSlot as MealSlot]}
                    </span>
                    {s.label ? <> · {s.label}</> : null}
                    {" · "}
                    <span className="text-pulso-soft">{s.targetTime}</span>
                  </p>
                  <span className="text-xs text-pulso-soft">
                    {SCHEDULE_STATUS_LABEL[s.status as ScheduleStatus]}
                  </span>
                </div>
                <p className="text-xs text-pulso-soft">
                  {formatDaysOfWeek(s.daysOfWeek)}
                </p>
                {s.note && (
                  <p className="text-xs text-pulso-soft italic">“{s.note}”</p>
                )}
                <MealScheduleRowActions
                  patientId={params.patientId}
                  scheduleId={s.id}
                  status={s.status as ScheduleStatus}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Agregar comida programada</h3>
        <MealScheduleForm patientId={params.patientId} />
      </section>
    </div>
  );
}
