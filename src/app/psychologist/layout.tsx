import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

export default async function PsychologistLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.role !== "PSYCHOLOGIST") redirect("/patient/timeline");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-pulso-bg/90 backdrop-blur border-b border-pulso-mute">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/psychologist/patients" className="text-xl font-semibold tracking-tight">
            Pulso Body · Panel
          </Link>
          <div className="flex items-center gap-3 text-sm text-pulso-soft">
            <Link href="/psychologist/settings" className="hover:underline">
              Configuración
            </Link>
            <span className="hidden sm:inline">{session.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
