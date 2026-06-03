-- AlterEnum: agregar nuevos tipos de medición (aditivo, no destructivo)
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'NECK';
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'THIGH';
ALTER TYPE "MeasurementType" ADD VALUE IF NOT EXISTS 'BODY_FAT';

-- AlterTable: altura como dato de perfil (no medición recurrente)
ALTER TABLE "PatientProfile" ADD COLUMN "heightCm" DOUBLE PRECISION;
