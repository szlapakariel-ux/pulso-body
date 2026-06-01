import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import DemoSelector from "./demo-selector";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Pulso Body</h1>
          <p className="mt-2 text-pulso-soft">Bitácora diaria de nutrición, ejercicio y medidas</p>
        </div>
        <div className="card space-y-3">
          <p className="text-sm text-pulso-soft">
            Demo · elegí un perfil para ingresar.
          </p>
          <DemoSelector />
        </div>
      </div>
    </main>
  );
}
