import type { Exercise } from '../db';
import type { AppSettings } from './settings';
import { equipmentFor, type Equip } from './onboarding';

/** Schema di movimento: esercizi con lo stesso schema si possono scambiare tra loro. */
export type Pattern =
  | 'squat' | 'cerniera' | 'gamba-singola' | 'gambe-macchina' | 'polpacci'
  | 'spinta-orizzontale' | 'spinta-verticale' | 'alzate' | 'tricipiti'
  | 'tirata-verticale' | 'rematore' | 'spalle-dietro' | 'bicipiti'
  | 'core';

export interface ExInfo { needs: Equip[]; pattern: Pattern }

/** Attrezzatura e schema di ogni esercizio del catalogo di base (per nome). */
export const EXERCISE_INFO: Record<string, ExInfo> = {
  'Squat con bilanciere': { needs: ['bilanciere', 'rack'], pattern: 'squat' },
  'Leg press': { needs: ['macchine'], pattern: 'squat' },
  'Goblet squat': { needs: ['manubri'], pattern: 'squat' },
  'Squat a corpo libero': { needs: [], pattern: 'squat' },
  'Stacco da terra': { needs: ['bilanciere'], pattern: 'cerniera' },
  'Stacco rumeno con manubri': { needs: ['manubri'], pattern: 'cerniera' },
  'Hip thrust con bilanciere': { needs: ['bilanciere', 'panca'], pattern: 'cerniera' },
  'Ponte glutei': { needs: [], pattern: 'cerniera' },
  'Split squat con manubri': { needs: ['manubri'], pattern: 'gamba-singola' },
  'Affondi a corpo libero': { needs: [], pattern: 'gamba-singola' },
  'Leg extension': { needs: ['macchine'], pattern: 'gambe-macchina' },
  'Leg curl a una gamba': { needs: ['macchine'], pattern: 'gambe-macchina' },
  'Calf raise in piedi': { needs: [], pattern: 'polpacci' },
  'Panca piana con bilanciere': { needs: ['bilanciere', 'panca'], pattern: 'spinta-orizzontale' },
  'Panca inclinata con manubri': { needs: ['manubri', 'panca'], pattern: 'spinta-orizzontale' },
  'Chest press': { needs: ['macchine'], pattern: 'spinta-orizzontale' },
  'Croci alla macchina': { needs: ['macchine'], pattern: 'spinta-orizzontale' },
  'Piegamenti': { needs: [], pattern: 'spinta-orizzontale' },
  'Piegamenti stretti': { needs: [], pattern: 'tricipiti' },
  'Dip su una sedia': { needs: [], pattern: 'tricipiti' },
  'Dip alle parallele': { needs: ['parallele'], pattern: 'tricipiti' },
  'Pushdown al cavo alto': { needs: ['cavi'], pattern: 'tricipiti' },
  'Military press con bilanciere': { needs: ['bilanciere'], pattern: 'spinta-verticale' },
  'Shoulder press con manubri da seduto': { needs: ['manubri', 'panca'], pattern: 'spinta-verticale' },
  'Lento avanti con manubri in piedi': { needs: ['manubri'], pattern: 'spinta-verticale' },
  'Pike push-up': { needs: [], pattern: 'spinta-verticale' },
  'Alzate laterali con manubri': { needs: ['manubri'], pattern: 'alzate' },
  'Trazioni alla sbarra': { needs: ['sbarra'], pattern: 'tirata-verticale' },
  'Lat machine': { needs: ['cavi'], pattern: 'tirata-verticale' },
  'Rematore con manubrio': { needs: ['manubri'], pattern: 'rematore' },
  'Pulley basso': { needs: ['cavi'], pattern: 'rematore' },
  'Rematore inverso': { needs: [], pattern: 'rematore' },
  'Face pull al cavo alto': { needs: ['cavi'], pattern: 'spalle-dietro' },
  'Superman': { needs: [], pattern: 'spalle-dietro' },
  'Curl con bilanciere EZ': { needs: ['bilanciere'], pattern: 'bicipiti' },
  'Curl con manubri': { needs: ['manubri'], pattern: 'bicipiti' },
  'Curl al cavo basso': { needs: ['cavi'], pattern: 'bicipiti' },
  'Plank': { needs: [], pattern: 'core' },
  'Plank laterale': { needs: [], pattern: 'core' },
  'Dead bug': { needs: [], pattern: 'core' },
  'Knee raise alla sbarra': { needs: ['sbarra'], pattern: 'core' },
};

/** Informazioni salvate sull'esercizio, o quelle del catalogo di base. Esercizi creati da te: nessuna. */
export function infoOf(ex: Pick<Exercise, 'name' | 'needs' | 'pattern'>): ExInfo | null {
  if (ex.pattern) return { needs: ex.needs ?? [], pattern: ex.pattern };
  return EXERCISE_INFO[ex.name] ?? null;
}

/** Attrezzi a disposizione secondo il profilo (senza profilo: tutto). */
export function availableEquip(settings: Pick<AppSettings, 'profile'>): Set<Equip> | null {
  const p = settings.profile;
  return p ? new Set(equipmentFor(p)) : null;
}

export function canDo(ex: Pick<Exercise, 'name' | 'needs' | 'pattern'>, have: Set<Equip> | null): boolean {
  if (!have) return true;
  const info = infoOf(ex);
  return !info || info.needs.every((n) => have.has(n));
}

/**
 * Varianti di un esercizio: quelle scelte a mano più quelle con lo stesso schema di movimento,
 * solo se si possono fare con l'attrezzatura che hai.
 */
export function substitutesFor(ex: Exercise, all: Exercise[], have: Set<Equip> | null): Exercise[] {
  const info = infoOf(ex);
  const manual = new Set(ex.substituteIds);
  return all
    .filter((o) => o.id !== ex.id && !o.archived && canDo(o, have))
    .filter((o) => manual.has(o.id!) || (info && infoOf(o)?.pattern === info.pattern))
    .sort((a, b) => Number(manual.has(b.id!)) - Number(manual.has(a.id!)) || a.name.localeCompare(b.name));
}
