import NewEntryForm from "./new-entry-form";
import { slotFromSlug, slotLabel, type MealSlot } from "@/lib/meal-slots";

export default function NewEntryPage({
  searchParams,
}: {
  searchParams?: { intent?: string; slot?: string };
}) {
  const isMeal = searchParams?.intent === "meal";
  const mealSlot: MealSlot | null = isMeal ? slotFromSlug(searchParams?.slot) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">
          {isMeal ? "Registrar comida" : "Nuevo registro"}
        </h2>
        <p className="text-pulso-soft text-sm">
          {isMeal
            ? `${mealSlot ? slotLabel(mealSlot) : "Comida"} · sacá una foto para dejarla registrada.`
            : "Grabá, filmá o adjuntá un archivo."}
        </p>
      </div>
      <NewEntryForm intent={isMeal ? "meal" : "generic"} mealSlot={mealSlot} />
    </div>
  );
}
