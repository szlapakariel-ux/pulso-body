import { requireRolePage } from "@/lib/auth";
import { typeFromSlug } from "@/lib/exercises";
import ExerciseForm from "./exercise-form";

export const dynamic = "force-dynamic";

export default async function NewExercisePage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  await requireRolePage("PATIENT");
  const initialType = typeFromSlug(searchParams?.type);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Registrar ejercicio</h2>
        <p className="text-pulso-soft text-sm">
          Cargá la actividad del día. Foto opcional.
        </p>
      </div>
      <ExerciseForm initialType={initialType} />
    </div>
  );
}
