import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import LoginForm from "./login-form";
import DemoSelector from "./demo-selector";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Pulso Body</h1>
          <p className="mt-2 text-pulso-soft">
            Bitácora diaria de nutrición, ejercicio y medidas
          </p>
        </div>

        <div className="card space-y-3">
          <p className="text-sm font-medium">Iniciar sesión</p>
          <LoginForm />
        </div>

        <div className="card space-y-3">
          <p className="text-sm font-medium">Solo demo local</p>
          <p className="text-xs text-pulso-soft">
            Perfiles precargados por el seed para mostrar el flujo. No usar en
            beta privada ni con usuarios reales.
          </p>
          <DemoSelector />
        </div>
      </div>
    </main>
  );
}
