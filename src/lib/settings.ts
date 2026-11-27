import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RankKey } from '../db';
import type { Profile } from './onboarding';

export interface PlateInv {
  weight: number; // kg
  count: number | null; // dischi in totale; null = quantità non indicata
}

export interface BarInv {
  id: string;
  name: string;
  kind: 'dritto' | 'ez';
  weight: number | null; // kg
}

export interface Letter {
  text: string;
  at: number;
}

export interface Notice {
  id: string;
  kind: 'promotion' | 'demotion' | 'goal';
  title: string;
  text: string;
  level: number;
}

export type Thresholds = Record<RankKey, [number, number, number, number, number]>;

/** Soglie indicative per le donne (indice = massimale stimato / peso corporeo). */
export const DEFAULT_THRESHOLDS_F: Thresholds = {
  panca: [0.25, 0.5, 0.75, 1.0, 1.25],
  squat: [0.5, 0.75, 1.0, 1.5, 1.75],
  stacco: [0.6, 1.0, 1.25, 1.75, 2.25],
  military: [0.2, 0.35, 0.5, 0.7, 0.85],
  trazioni: [1.0, 1.05, 1.15, 1.3, 1.5],
  dip: [1.0, 1.1, 1.25, 1.45, 1.7],
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  panca: [0.5, 0.75, 1.0, 1.5, 2.0],
  squat: [0.75, 1.25, 1.5, 2.0, 2.5],
  stacco: [1.0, 1.5, 2.0, 2.5, 3.0],
  military: [0.35, 0.55, 0.75, 1.0, 1.25],
  trazioni: [1.0, 1.15, 1.3, 1.5, 1.75],
  dip: [1.0, 1.2, 1.4, 1.7, 2.0],
};

export interface AppSettings {
  startDate: string;
  heightCm: number;
  weeklyGoal: number;
  trainingWeekday: number; // 0 = lunedì
  lbPerBlock: number;
  lastBackupAt: number | null;
  createdAt: number;
  dismissedMonthly: number[]; // blocchi di 4 settimane già visti
  defaultRestSec: number;
  // v2
  plates: PlateInv[];
  bars: BarInv[];
  gymDays: number[]; // 0 = lunedì
  gymTime: string; // HH:MM
  gymDurationMin: number;
  alertMin: number;
  letterOriginal: Letter | null;
  letterCurrent: Letter | null;
  letterPrompted: boolean;
  letterShownOn: string | null;
  rankThresholds: Thresholds;
  notices: Notice[];
  // Kaizen-Gym: percorso di benvenuto
  onboarded: boolean;
  profile: Profile | null;
  sportEnabled: boolean; // modulo partite e allenamenti di un altro sport
  sportName: string;
  rankEnabled: boolean;
  sex: 'm' | 'f' | null; // solo per le soglie del rank
}

export const DEFAULT_SETTINGS: AppSettings = {
  startDate: '2026-11-16',
  heightCm: 170,
  weeklyGoal: 3,
  trainingWeekday: -1, // -1 = nessun allenamento ricorrente
  lbPerBlock: 15,
  lastBackupAt: null,
  createdAt: Date.now(),
  dismissedMonthly: [],
  defaultRestSec: 90,
  plates: [
    { weight: 5, count: null },
    { weight: 2, count: null },
    { weight: 1, count: null },
    { weight: 0.75, count: null },
    { weight: 0.5, count: null },
  ],
  bars: [
    { id: 'panca', name: 'Bilanciere da panca piana', kind: 'dritto', weight: null },
    { id: 'military', name: 'Bilanciere da military press', kind: 'dritto', weight: null },
    { id: 'stacchi', name: 'Bilanciere da stacchi', kind: 'dritto', weight: null },
    { id: 'ez', name: 'Bilanciere EZ', kind: 'ez', weight: null },
  ],
  gymDays: [],
  gymTime: '18:30',
  gymDurationMin: 45,
  alertMin: 30,
  letterOriginal: null,
  letterCurrent: null,
  letterPrompted: false,
  letterShownOn: null,
  rankThresholds: DEFAULT_THRESHOLDS,
  notices: [],
  onboarded: false,
  profile: null,
  sportEnabled: false,
  sportName: 'Calcio',
  rankEnabled: true,
  sex: null,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AppSettings;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), []);
}
