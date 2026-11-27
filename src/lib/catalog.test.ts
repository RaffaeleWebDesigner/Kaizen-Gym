import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../db';
import { canDo, substitutesFor } from './catalog';
import { buildPlan, type Equip } from './onboarding';

const ex = (id: number, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name, group: 'tirata', type: 'reps', unit: 'kg', bodyweight: false, isBarbell: false, barWeight: null, perHand: false,
  increment: 1, stackStep: null, restSec: 90, cues: [], substituteIds: [], ...extra,
});

describe('varianti in base all’attrezzatura', () => {
  const all = [ex(1, 'Lat machine'), ex(2, 'Trazioni alla sbarra'), ex(3, 'Rematore inverso'), ex(4, 'Rematore con manubrio'), ex(5, 'Pulley basso'), ex(6, 'Mio esercizio')];
  it('casa con sbarra: alla lat machine propone le trazioni, non altre macchine', () => {
    const have = new Set<Equip>(['sbarra']);
    expect(substitutesFor(all[0], all, have).map((e) => e.name)).toEqual(['Trazioni alla sbarra']);
    expect(substitutesFor(all[3], all, have).map((e) => e.name)).toEqual(['Rematore inverso']);
  });
  it('le varianti scelte a mano restano, gli esercizi creati da te si possono sempre fare', () => {
    const withManual = { ...all[0], substituteIds: [6] };
    expect(substitutesFor(withManual, all, new Set()).map((e) => e.name)).toEqual(['Mio esercizio']);
    expect(canDo(all[5], new Set())).toBe(true);
    expect(canDo(all[0], new Set())).toBe(false);
    expect(canDo(all[0], null)).toBe(true);
  });
});

describe('programma spinta, tirata, gambe', () => {
  it('palestra: tre sedute con nomi e distretti giusti', () => {
    const [a, b, c] = buildPlan({ goal: 'massa', experience: 'esperto', place: 'palestra', equipment: [], program: 'ppl' });
    expect([a.name, b.name, c.name]).toEqual(['Spinta', 'Tirata', 'Gambe']);
    expect(a.rows.map((r) => r.name)).toEqual(['Panca piana con bilanciere', 'Military press con bilanciere', 'Croci alla macchina', 'Alzate laterali con manubri', 'Pushdown al cavo alto']);
    expect(c.rows.map((r) => r.name)).toEqual(['Squat con bilanciere', 'Hip thrust con bilanciere', 'Leg press', 'Leg curl a una gamba', 'Calf raise in piedi']);
  });
  it('casa senza attrezzi: niente buchi, tutto a corpo libero', () => {
    const plan = buildPlan({ goal: 'salute', experience: 'intermedio', place: 'casa', equipment: [], program: 'ppl' });
    for (const t of plan) expect(t.rows.length).toBeGreaterThanOrEqual(3);
  });
});
