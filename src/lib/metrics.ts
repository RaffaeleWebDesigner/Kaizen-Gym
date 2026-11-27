import type { Measurement } from '../db';

export type MetricKey = Exclude<keyof Measurement, 'id' | 'date'>;

export const METRICS: { key: MetricKey; label: string; unit: string; scale: boolean }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', scale: true },
  { key: 'bmi', label: 'BMI', unit: '', scale: true },
  { key: 'fatPct', label: 'Grasso corporeo', unit: '%', scale: true },
  { key: 'leanMass', label: 'Massa magra', unit: 'kg', scale: true },
  { key: 'subcutFatPct', label: 'Grasso sottocutaneo', unit: '%', scale: true },
  { key: 'visceralFat', label: 'Grasso viscerale', unit: '', scale: true },
  { key: 'waterPct', label: 'Acqua', unit: '%', scale: true },
  { key: 'skeletalMusclePct', label: 'Muscolo scheletrico', unit: '%', scale: true },
  { key: 'muscleMass', label: 'Massa muscolare', unit: 'kg', scale: true },
  { key: 'boneMass', label: 'Massa ossea', unit: 'kg', scale: true },
  { key: 'proteinPct', label: 'Proteine', unit: '%', scale: true },
  { key: 'bmr', label: 'BMR', unit: 'kcal', scale: true },
  { key: 'waist', label: 'Vita', unit: 'cm', scale: false },
  { key: 'chest', label: 'Petto', unit: 'cm', scale: false },
  { key: 'arm', label: 'Braccio', unit: 'cm', scale: false },
  { key: 'thigh', label: 'Coscia', unit: 'cm', scale: false },
];

export function bmiOf(weight: number, heightCm: number) {
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}
