// Login demo por selector de perfil.
// Cada perfil tiene email interno único (constraint @unique en Prisma)
// y un displayEmail propio que se muestra en la UI.
export type DemoProfile = "psychologist" | "patient1" | "patient2";

export const DEMO_PROFILES: Record<
  DemoProfile,
  {
    name: string;
    internalEmail: string;
    displayEmail: string;
    role: "PSYCHOLOGIST" | "PATIENT";
    label: string;
  }
> = {
  psychologist: {
    name: "Psicóloga Demo",
    internalEmail: "demo-psicologa@pulso.local",
    displayEmail: "psicologa.demo@pulso.local",
    role: "PSYCHOLOGIST",
    label: "Entrar como profesional demo",
  },
  patient1: {
    name: "Paciente Demo 1",
    internalEmail: "demo-paciente1@pulso.local",
    displayEmail: "paciente1.demo@pulso.local",
    role: "PATIENT",
    label: "Entrar como paciente demo 1",
  },
  patient2: {
    name: "Paciente Demo 2",
    internalEmail: "demo-paciente2@pulso.local",
    displayEmail: "paciente2.demo@pulso.local",
    role: "PATIENT",
    label: "Entrar como paciente demo 2",
  },
};

// Mapa rápido internalEmail -> displayEmail para resolver desde el lado server.
export function displayEmailFor(internalEmail: string): string {
  for (const def of Object.values(DEMO_PROFILES)) {
    if (def.internalEmail === internalEmail) return def.displayEmail;
  }
  return internalEmail;
}
