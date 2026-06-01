# Contrato de producto — Pulso Body

Microciclo: **PB-0**
Estado: documento inicial. No implica cambios de código.

Este contrato fija el alcance funcional, los roles y los límites de Pulso Body antes de cualquier modificación de código. Es la referencia base para los microciclos siguientes.

---

## 1. Qué es Pulso Body

Pulso Body es una **bitácora diaria de nutrición, ejercicio, peso y medidas corporales**, guiada por un profesional y registrada en tiempo real por el paciente.

- Bitácora diaria de nutrición, ejercicio, peso y medidas.
- Registro en tiempo real desde el dispositivo del paciente.
- Uso compartido entre paciente y profesional, con vistas distintas según rol.
- Permite comparar lo **programado** por el profesional con lo **realmente registrado** por el paciente.

---

## 2. Diferencia con Pulso original

- **Pulso original:** acompañamiento emocional/terapéutico entre sesiones (audio, video, contenido emocional).
- **Pulso Body:** seguimiento corporal, nutricional, actividad física y medidas.
- Se mantiene la **base técnica** (stack, autenticación, timeline, lógica profesional/paciente), pero cambia el **dominio funcional** completo: deja de centrarse en lo emocional y pasa a lo corporal.

Pulso Body es un producto **hermano**, no una copia ni una rama del original.

---

## 3. Roles

- **Paciente / cliente:** registra sus ingestas, ejercicios y medidas.
- **Profesional:** define el plan, observa la bitácora, agrega notas privadas.
  - El profesional puede ser **nutricionista, entrenador, coach de hábitos o profesional de salud**.
- Lenguaje neutro: evitar términos diagnósticos automáticos (no "patología", no "tratamiento", no "prescripción").

---

## 4. Ingestas programadas

El profesional define horarios de ingestas por paciente. Tipos base:

- desayuno
- colación
- almuerzo
- merienda
- cena
- otras ingestas personalizadas

Cada ingesta tiene **horario configurable** por el profesional.

El paciente registra cada ingesta con:

- foto de la comida
- horario automático del registro
- tipo de comida (según la programación)
- nota breve opcional
- estado del registro

### Estados sugeridos

- `programado`
- `registrado`
- `registrado_tarde`
- `omitido`
- `reprogramado`
- `cancelado_por_profesional`

---

## 5. Ejercicio programado

El profesional define ejercicios por día y horario para cada paciente.

El paciente registra:

- realizado / no realizado
- duración
- intensidad percibida
- nota breve
- foto opcional

---

## 6. Peso y medidas

El profesional define **qué** debe medir el paciente y con **qué frecuencia**.

### Frecuencias posibles

- diario
- cada 15 días
- mensual
- personalizado

### Ejemplos de medidas

- peso
- cintura
- cadera
- pecho
- brazo
- fotos de progreso

### Edición e historial

Los datos pueden ser editables, pero **toda edición debe dejar historial de corrección** (valor anterior, valor nuevo, autor, fecha).

---

## 7. Alertas y recordatorios

Implementación por etapas:

- **Etapa 1 (actual):** agenda interna dentro de la app.
- **Etapa 2 (futura):** notificaciones push PWA.
- **Etapa 3 (futura):** WhatsApp/email, solo con autorización separada del paciente.

**No se implementa WhatsApp en este microciclo.**

---

## 8. Vista del paciente

- Agenda diaria.
- Pendientes del día.
- Registrar comida con foto.
- Registrar ejercicio.
- Cargar peso / medidas cuando corresponda.
- Timeline propia (historial de registros).

---

## 9. Vista del profesional

- Bitácora diaria y semanal del paciente.
- Comidas **programadas vs registradas**.
- Ejercicios **programados vs realizados**.
- Peso y medidas según frecuencia definida.
- Notas privadas del profesional (no visibles para el paciente).

---

## 10. IA

La IA cumple un rol **descriptivo**, nunca prescriptivo.

### Puede

- Resumir adherencia semanal.
- Detectar patrones descriptivos:
  - comidas omitidas
  - horarios tardíos
  - falta de registros
  - ejercicios realizados / no realizados

### No puede

- Diagnóstico.
- Tratamiento.
- Generación de dieta automática.
- Juicio alimentario.
- Recomendaciones médicas.

---

## 11. Modelo de datos sugerido

Propuesta inicial de entidades (no implementación):

- `User`
- `ProfessionalProfile`
- `ClientProfile`
- `ClientPlan`
- `MealSchedule`
- `ExerciseSchedule`
- `MeasurementSchedule`
- `MealEntry`
- `ExerciseEntry`
- `MeasurementEntry`
- `Reminder`
- `ProfessionalNote`
- `WeeklySummary`
- `CorrectionHistory`

---

## 12. Qué se reutiliza de Pulso

- Next.js
- TypeScript
- Tailwind
- Prisma
- PostgreSQL
- S3 / R2
- Autenticación
- Timeline
- Subida de archivos
- Lógica profesional / paciente
- Resumen IA descriptivo

---

## 13. Qué debe cambiar

- Renombrar identidad de producto.
- Agregar soporte para **foto** (ingesta, ejercicio, medidas).
- Cambiar dominio de **audio/video emocional** a **nutrición / ejercicio / medidas**.
- Adaptar Prisma.
- Adaptar rutas.
- Adaptar textos.
- Adaptar seed demo.
- Adaptar README.

---

## 14. Fuera de alcance de PB-0

- No tocar código.
- No tocar Prisma.
- No hacer deploy.
- No conectar APIs reales.
- No usar secrets.
- No implementar notificaciones.
- No implementar WhatsApp.
- No modificar producción.
