import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRolePage } from "@/lib/auth";
import { displayEmailFor } from "@/lib/demo";
import TrainingEditor from "./training-editor";

export const dynamic = "force-dynamic";

export default async function PatientTrainingPage({
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

  const plan = await prisma.trainingPlan.findFirst({
    where: { patientId: params.patientId, psychologistId: user.id, status: "ACTIVE" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" } } },
      },
    },
  });

  const backToTimeline = `/psychologist/patients/${params.patientId}/timeline`;

  const days = (plan?.days ?? []).map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    warmup: d.warmup,
    cooldown: d.cooldown,
    notes: d.notes,
    exercises: d.exercises.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup,
      sets: e.sets,
      reps: e.reps,
      durationSeconds: e.durationSeconds,
      notes: e.notes,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={backToTimeline} className="text-sm text-pulso-soft underline">
          ← Timeline
        </Link>
        <h2 className="text-2xl font-semibold mt-2">Rutina</h2>
        <p className="text-pulso-soft text-sm">
          {profile.user.name} · {displayEmailFor(profile.user.email)}
        </p>
      </div>

      <TrainingEditor
        patientId={params.patientId}
        initialPlan={
          plan
            ? { title: plan.title, notes: plan.notes, daysPerWeek: plan.daysPerWeek }
            : null
        }
        initialDays={days}
      />
    </div>
  );
}
