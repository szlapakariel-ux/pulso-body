import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.role !== "PATIENT") redirect("/psychologist/patients");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-pulso-bg/90 backdrop-blur border-b border-pulso-mute">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/patient/timeline" className="text-xl font-semibold tracking-tight">
            Pulso Body
          </Link>
          <div className="flex items-center gap-3 text-sm text-pulso-soft">
            <span className="hidden sm:inline">{session.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
