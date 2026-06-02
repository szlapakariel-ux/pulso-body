import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PROFILES } from "../src/lib/demo";

const prisma = new PrismaClient();

async function main() {
  // Password de respaldo para que el login por email también funcione si se usa.
  // El flujo demo (selector de perfil) no usa password.
  const passwordHash = await bcrypt.hash("demo", 10);

  const psyDef = DEMO_PROFILES.psychologist;
  const p1Def = DEMO_PROFILES.patient1;
  const p2Def = DEMO_PROFILES.patient2;

  const psicologo = await prisma.user.upsert({
    where: { email: psyDef.internalEmail },
    update: { name: psyDef.name, role: psyDef.role },
    create: {
      name: psyDef.name,
      email: psyDef.internalEmail,
      passwordHash,
      role: psyDef.role,
    },
  });

  const paciente1 = await prisma.user.upsert({
    where: { email: p1Def.internalEmail },
    update: { name: p1Def.name, role: p1Def.role },
    create: {
      name: p1Def.name,
      email: p1Def.internalEmail,
      passwordHash,
      role: p1Def.role,
    },
  });

  const paciente2 = await prisma.user.upsert({
    where: { email: p2Def.internalEmail },
    update: { name: p2Def.name, role: p2Def.role },
    create: {
      name: p2Def.name,
      email: p2Def.internalEmail,
      passwordHash,
      role: p2Def.role,
    },
  });

  await prisma.patientProfile.upsert({
    where: { userId: paciente1.id },
    update: { psychologistId: psicologo.id },
    create: { userId: paciente1.id, psychologistId: psicologo.id },
  });
  await prisma.patientProfile.upsert({
    where: { userId: paciente2.id },
    update: { psychologistId: psicologo.id },
    create: { userId: paciente2.id, psychologistId: psicologo.id },
  });

  const existing = await prisma.timelineEntry.count();
  if (existing === 0) {
    const seedEntries = [
      {
        patientId: paciente1.id,
        title: "Ansiedad antes de la reunión",
        mediaType: "AUDIO" as const,
        mediaKey: `seed/${paciente1.id}/ansiedad.webm`,
      },
      {
        patientId: paciente1.id,
        title: "Logré dormir 7 horas",
        mediaType: "AUDIO" as const,
        mediaKey: `seed/${paciente1.id}/dormir.webm`,
      },
      {
        patientId: paciente2.id,
        title: "Discusión con mi hermana",
        mediaType: "VIDEO" as const,
        mediaKey: `seed/${paciente2.id}/discusion.webm`,
      },
      {
        patientId: paciente2.id,
        title: "Caminata en el parque",
        mediaType: "AUDIO" as const,
        mediaKey: `seed/${paciente2.id}/caminata.webm`,
      },
    ];
    for (const e of seedEntries) {
      const entry = await prisma.timelineEntry.create({
        data: { ...e, psychologistId: psicologo.id },
      });
      await prisma.privateNote.create({
        data: {
          entryId: entry.id,
          psychologistId: psicologo.id,
          content: "Nota privada de ejemplo — solo visible para el psicólogo.",
        },
      });
    }
  }

  // ---- Mini-seed Pulso Body (PB-12B) ----
  // Idempotente: cada upsert/findFirst evita duplicar entre corridas.
  // Solo para Paciente Demo 1, para que Paciente Demo 2 quede "en blanco"
  // y permita demos diferenciadas.
  const SEED_MARKER = "Seed demo PB-12B";

  const mealSchedulesSeed: Array<{
    mealSlot: "BREAKFAST" | "SNACK_AM" | "LUNCH" | "SNACK_PM" | "DINNER";
    targetTime: string;
    daysOfWeek: number[];
    label?: string;
  }> = [
    { mealSlot: "BREAKFAST", targetTime: "08:00", daysOfWeek: [1, 2, 3, 4, 5] },
    { mealSlot: "LUNCH",     targetTime: "13:30", daysOfWeek: [1, 2, 3, 4, 5] },
    { mealSlot: "SNACK_PM",  targetTime: "17:00", daysOfWeek: [1, 2, 3, 4, 5] },
    { mealSlot: "DINNER",    targetTime: "21:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
  ];

  for (const s of mealSchedulesSeed) {
    const existing = await prisma.mealSchedule.findFirst({
      where: {
        patientId: paciente1.id,
        mealSlot: s.mealSlot,
        targetTime: s.targetTime,
      },
    });
    if (!existing) {
      await prisma.mealSchedule.create({
        data: {
          patientId: paciente1.id,
          psychologistId: psicologo.id,
          mealSlot: s.mealSlot,
          targetTime: s.targetTime,
          daysOfWeek: s.daysOfWeek,
          label: s.label ?? null,
          note: SEED_MARKER,
        },
      });
    }
  }

  const measurementsSeed: Array<{
    type: "WEIGHT" | "WAIST";
    value: number;
    unit: string;
  }> = [
    { type: "WEIGHT", value: 84.5, unit: "kg" },
    { type: "WAIST",  value: 98,   unit: "cm" },
  ];

  for (const m of measurementsSeed) {
    const existing = await prisma.measurementEntry.findFirst({
      where: {
        patientId: paciente1.id,
        type: m.type,
        note: SEED_MARKER,
      },
    });
    if (!existing) {
      await prisma.measurementEntry.create({
        data: {
          patientId: paciente1.id,
          psychologistId: psicologo.id,
          type: m.type,
          value: m.value,
          unit: m.unit,
          note: SEED_MARKER,
          recordedAt: new Date(),
        },
      });
    }
  }

  const exerciseExisting = await prisma.exerciseEntry.findFirst({
    where: {
      patientId: paciente1.id,
      type: "WALK",
      note: SEED_MARKER,
    },
  });
  if (!exerciseExisting) {
    await prisma.exerciseEntry.create({
      data: {
        patientId: paciente1.id,
        psychologistId: psicologo.id,
        type: "WALK",
        durationMinutes: 30,
        intensity: "MEDIUM",
        note: SEED_MARKER,
        recordedAt: new Date(),
      },
    });
  }

  console.log("Seed listo. Perfiles demo (login por selector):");
  console.log("  - Psicóloga Demo (PSYCHOLOGIST)");
  console.log("  - Paciente Demo 1 (PATIENT) — con MealSchedule + peso/cintura + caminata (PB-12B)");
  console.log("  - Paciente Demo 2 (PATIENT) — sin datos demo, escenario en blanco");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
