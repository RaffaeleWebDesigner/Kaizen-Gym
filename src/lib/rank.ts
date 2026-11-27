import type { Exercise, Measurement, RankKey, Session } from '../db';
import { addDays } from './dates';
import { LB_TO_KG, fmtNum, totalKg } from './units';
import type { Thresholds } from './settings';

export const RANK_EXERCISE_LABEL: Record<RankKey, string> = {
  panca: 'Panca piana con bilanciere',
  squat: 'Squat con bilanciere',
  stacco: 'Stacco da terra',
  military: 'Military press con bilanciere',
  trazioni: 'Trazioni (peso corporeo + zavorra)',
  dip: 'Dip (peso corporeo + zavorra)',
};

export const BODYWEIGHT_KEYS: RankKey[] = ['trazioni', 'dip'];

export interface Tier {
  name: string;
  divisions: number;
  color: string;
  color2: string;
}

// Colori originali, ispirati ai materiali.
export const TIERS: Tier[] = [
  { name: 'Rame', divisions: 3, color: '#c46a3c', color2: '#7a3a1c' },
  { name: 'Bronzo', divisions: 3, color: '#d39a52', color2: '#7d5527' },
  { name: 'Argento', divisions: 3, color: '#d6dde3', color2: '#7f8a94' },
  { name: 'Oro', divisions: 3, color: '#ffd23f', color2: '#b68a00' },
  { name: 'Platino', divisions: 3, color: '#7fe3d4', color2: '#2f8f84' },
  { name: 'Diamante', divisions: 3, color: '#8fb8ff', color2: '#3a5fc2' },
  { name: 'Champion', divisions: 3, color: '#c58bff', color2: '#6b2fb3' },
  { name: 'Grand Champion', divisions: 1, color: '#ff6b8b', color2: '#a3123a' },
  { name: 'Super Lega', divisions: 1, color: '#c6ff00', color2: '#5f8000' },
];

export const MAX_LEVEL = TIERS.reduce((a, t) => a + t.divisions, 0); // 23

export function tierOf(level: number): { tier: Tier; division: number | null } {
  let n = level;
  for (const t of TIERS) {
    if (n <= t.divisions) return { tier: t, division: t.divisions > 1 ? n : null };
    n -= t.divisions;
  }
  return { tier: TIERS[TIERS.length - 1], division: null };
}

export function levelName(level: number): string {
  const { tier, division } = tierOf(level);
  return division ? `${tier.name} ${division}` : tier.name;
}

/** Limite inferiore dell'indice per ogni livello (indice 0 = livello 1). */
export function levelLows(th: [number, number, number, number, number]): number[] {
  const [P, N, I, A, E] = th;
  const ranges: [number, number, number][] = [
    [0, P, 3], [P, N, 3], [N, I, 3], [I, (I + A) / 2, 3], [(I + A) / 2, A, 3], [A, (A + E) / 2, 3], [(A + E) / 2, E, 3], [E, E * 1.15, 1], [E * 1.15, Infinity, 1],
  ];
  const lows: number[] = [];
  for (const [lo, hi, d] of ranges) {
    for (let i = 0; i < d; i++) lows.push(hi === Infinity ? lo : lo + ((hi - lo) * i) / d);
  }
  return lows;
}

export function levelFromIndex(index: number, th: [number, number, number, number, number]) {
  const lows = levelLows(th);
  let i = 0;
  while (i + 1 < lows.length && index >= lows[i + 1] - 1e-12) i++;
  const low = lows[i];
  const high = i + 1 < lows.length ? lows[i + 1] : null;
  return { level: i + 1, low, high, progress: high === null ? 1 : Math.max(0, Math.min(1, (index - low) / (high - low))) };
}

/** Massimale stimato (mai test reali): carico × (1 + (ripetizioni + RIR) / 30). */
export function estimate1RM(loadKg: number, reps: number, rir: number | null): number {
  return loadKg * (1 + (reps + (rir ?? 0)) / 30);
}

export function bodyweightAt(measures: Measurement[], date: string): number | null {
  const m = measures.filter((x) => x.date <= date && typeof x.weight === 'number').sort((a, b) => a.date.localeCompare(b.date));
  return m.length ? (m[m.length - 1].weight as number) : null;
}

export interface RankResult {
  key: RankKey;
  name: string;
  level: number;
  index: number;
  e1rm: number;
  bw: number;
  progress: number;
  best: { loadKg: number; reps: number; rir: number | null; date: string; zavorraKg: number };
  toNext: string | null;
}

export function computeRanks(
  sessions: Session[],
  exById: Map<number, Exercise>,
  measures: Measurement[],
  thresholds: Thresholds,
  asOf: string,
): { ranks: RankResult[]; overall: number | null; bw: number | null } {
  const bw = bodyweightAt(measures, asOf);
  if (!bw) return { ranks: [], overall: null, bw: null };
  const from = addDays(asOf, -27);
  const best = new Map<RankKey, RankResult['best'] & { e1rm: number }>();
  for (const s of sessions) {
    if (s.status !== 'done' || s.date < from || s.date > asOf) continue;
    for (const log of s.exercises) {
      const key = exById.get(log.exerciseId)?.rankKey;
      if (!key || log.type !== 'reps') continue;
      const isBw = BODYWEIGHT_KEYS.includes(key);
      for (const set of log.sets) {
        if (!set.done || set.reps < 1 || set.reps > 10) continue;
        const zav = isBw ? (log.unit === 'lb' ? set.load * LB_TO_KG : set.load) : 0;
        const loadKg = isBw ? bw + zav : totalKg(log, set.load);
        if (loadKg <= 0) continue;
        const e = estimate1RM(loadKg, set.reps, log.rir);
        const cur = best.get(key);
        if (!cur || e > cur.e1rm) best.set(key, { loadKg, reps: set.reps, rir: log.rir, date: s.date, zavorraKg: zav, e1rm: e });
      }
    }
  }
  const ranks: RankResult[] = [];
  for (const [key, b] of best) {
    const th = thresholds[key];
    const index = b.e1rm / bw;
    const { level, high, progress } = levelFromIndex(index, th);
    let toNext: string | null = null;
    if (high !== null) {
      const need = high * bw * 1.0001;
      const f = 1 + (b.reps + (b.rir ?? 0)) / 30;
      const kgMore = Math.max(0.5, Math.ceil((need / f - b.loadKg) * 2) / 2);
      const repsAt = Math.ceil(30 * (need / b.loadKg - 1) - (b.rir ?? 0));
      const repsMore = repsAt <= 10 ? Math.max(1, repsAt - b.reps) : null;
      const isBw = BODYWEIGHT_KEYS.includes(key);
      const what = isBw ? 'di zavorra' : `di ${RANK_EXERCISE_LABEL[key].toLowerCase().split(' (')[0]}`;
      const at = isBw ? (b.zavorraKg ? `con +${fmtNum(b.zavorraKg)} kg` : 'a corpo libero') : `a ${fmtNum(b.loadKg)} kg`;
      toNext = `${levelName(level)} → ${levelName(level + 1)}: +${fmtNum(kgMore)} kg ${what}${repsMore ? ` o +${repsMore} ${repsMore === 1 ? 'ripetizione' : 'ripetizioni'} ${at}` : ''}`;
    }
    ranks.push({ key, name: RANK_EXERCISE_LABEL[key], level, index, e1rm: b.e1rm, bw, progress, best: { loadKg: b.loadKg, reps: b.reps, rir: b.rir, date: b.date, zavorraKg: b.zavorraKg }, toNext });
  }
  ranks.sort((a, b) => Object.keys(RANK_EXERCISE_LABEL).indexOf(a.key) - Object.keys(RANK_EXERCISE_LABEL).indexOf(b.key));
  const overall = ranks.length ? Math.floor(ranks.reduce((a, r) => a + r.level, 0) / ranks.length) : null;
  return { ranks, overall, bw };
}
