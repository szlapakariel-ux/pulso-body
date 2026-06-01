import { requireRolePage } from "@/lib/auth";
import { typeFromSlug } from "@/lib/measurements";
import MeasurementForm from "./measurement-form";

export const dynamic = "force-dynamic";

export default async function NewMeasurementPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  await requireRolePage("PATIENT");
  const initialType = typeFromSlug(searchParams?.type);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Registrar peso / medidas</h2>
        <p className="text-pulso-soft text-sm">
          Cargá el dato del día. Para foto de progreso, sacá la foto desde la
          cámara o adjuntala.
        </p>
      </div>
      <MeasurementForm initialType={initialType} />
    </div>
  );
}
