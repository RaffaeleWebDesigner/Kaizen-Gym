import type { ExerciseLog, Unit } from '../db';

export const LB_TO_KG = 0.45359237;

export function fmtNum(n: number, maxDec = 1): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: maxDec });
}

export function toKg(v: number, unit: Unit): number {
  return unit === 'lb' ? v * LB_TO_KG : v;
}

export function convert(v: number, unit: Unit): string {
  return unit === 'lb' ? `≈ ${fmtNum(v * LB_TO_KG)} kg` : `≈ ${fmtNum(v / LB_TO_KG)} lb`;
}

type LoadInfo = Pick<ExerciseLog, 'unit' | 'isBarbell' | 'barWeight' | 'stackStep' | 'perHand' | 'bodyweight' | 'type'>;

/** Carico totale nell'unità dell'esercizio (dischi + bilanciere). */
export function totalLoad(ex: LoadInfo, load: number): number {
  return load + (ex.isBarbell && ex.barWeight ? ex.barWeight : 0);
}

export function totalKg(ex: LoadInfo, load: number): number {
  return toKg(totalLoad(ex, load), ex.unit);
}

/** Testo breve del carico, es. "30 kg + bil." o "45 lb (3 blocchi)". */
export function fmtLoad(ex: LoadInfo, load: number): string {
  if (ex.type === 'time' && load === 0) return '';
  if (ex.bodyweight && load === 0) return 'corpo libero';
  let s = `${fmtNum(load, 2)} ${ex.unit}`;
  if (ex.stackStep) s += ` (${fmtNum(load / ex.stackStep, 1)} blocchi)`;
  if (ex.perHand) s += ' per mano';
  if (ex.bodyweight) s = `+${s}`;
  return s;
}

/** Descrizione completa con bilanciere e conversione. */
export function fmtLoadFull(ex: LoadInfo, load: number): string {
  if (ex.bodyweight && load === 0) return 'corpo libero';
  if (ex.type === 'time' && load === 0) return '';
  const parts = [fmtLoad(ex, load)];
  if (ex.isBarbell) {
    if (ex.barWeight) {
      const tot = totalLoad(ex, load);
      parts.push(`totale ${fmtNum(tot, 2)} ${ex.unit} con bilanciere`);
      parts.push(convert(tot, ex.unit));
    } else {
      parts.push('peso bilanciere da inserire');
      parts.push(convert(load, ex.unit));
    }
  } else {
    parts.push(convert(load, ex.unit));
  }
  return parts.join(' · ');
}

export function fmtReps(ex: Pick<ExerciseLog, 'type'>, reps: number): string {
  return ex.type === 'time' ? `${reps}"` : `${reps}`;
}

export function roundToStep(v: number, step: number): number {
  if (!step || step <= 0) return Math.round(v * 10) / 10;
  return Math.round(Math.round(v / step) * step * 100) / 100;
}
