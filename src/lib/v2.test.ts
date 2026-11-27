import { describe, expect, it } from 'vitest';
import type { ExerciseLog, Session } from '../db';
import { nextPlatesTotal, plateTotals, solveTotal } from './plates';
import { suggestTarget } from './progression';
import { stallInfo, exerciseLogs } from './stall';
import { estimate1RM, levelFromIndex, levelName, MAX_LEVEL } from './rank';
import { challengeDateProblem, challengeTextProblem, unlockStatus } from './challenges';
import { weekStats } from './stats';
import { buildIcs } from './ics';
import { DEFAULT_THRESHOLDS } from './settings';

const plates = [5, 2, 1, 0.75, 0.5].map((weight) => ({ weight, count: null }));

describe('calcolatore dischi', () => {
  it('carico esatto: dischi per lato', () => {
    const s = solveTotal(40, 10, plates);
    expect(s.exact).toBe(true);
    expect(s.perSide).toEqual([5, 5, 5]);
  });
  it('carico impossibile: il più vicino sotto e sopra', () => {
    const s = solveTotal(40.2, 10, plates);
    expect(s.exact).toBe(false);
    expect(s.below?.total).toBe(40);
    expect(s.above?.total).toBe(40.5);
  });
  it('quantità limitate: rispetta le coppie', () => {
    const s = solveTotal(30, 0, [{ weight: 5, count: 2 }]);
    expect(s.exact).toBe(false);
    expect(s.total).toBe(10);
  });
  it('il salto minimo è 0,5 kg (0,5 → 0,75 per lato)', () => {
    expect(nextPlatesTotal(30, plateTotals(plates))).toBe(30.5);
  });
});

function log(load: number, reps: number, rir: number | null, extra: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    uid: Math.random().toString(), exerciseId: 1, name: 'Panca', group: 'spinta', type: 'reps', unit: 'kg', bodyweight: false, isBarbell: true,
    barWeight: 10, perHand: false, increment: 1, stackStep: null, repMin: 8, repMax: 10, restSec: 90, cues: [],
    sets: [1, 2, 3].map(() => ({ reps, load, done: true })), rir, pain: false, stopped: false, notes: '', target: null, ...extra,
  };
}
const ses = (date: string, l: ExerciseLog): Session => ({ id: Math.random(), date, kind: 'A', status: 'done', startedAt: null, endedAt: null, durationMin: null, feeling: null, notes: '', exercises: [l] });
const row = { sets: 3, repMin: 8, repMax: 10, startLoad: 30 };
const ex = { type: 'reps' as const, increment: 1, stackStep: null, bodyweight: false, unit: 'kg' as const };

describe('stallo', () => {
  const h = [ses('2026-11-20', log(30, 8, 1)), ses('2026-11-18', log(30, 8, 1)), ses('2026-11-16', log(30, 8, 1))];
  it('3 sedute senza progressione = stallo, poi scarico -10%', () => {
    expect(stallInfo(exerciseLogs(h, 1)).stalled).toBe(true);
    const t = suggestTarget(row, ex, 1, h, '2026-11-22', { plateTotals: plateTotals(plates) });
    expect(t.kind).toBe('deload');
    expect(t.load).toBe(27);
  });
  it('dopo lo scarico si torna al carico di prima', () => {
    const h2 = [ses('2026-11-22', log(27, 8, 3, { target: { sets: 3, reps: 8, load: 27, kind: 'deload', message: '' } })), ...h];
    const t = suggestTarget(row, ex, 1, h2, '2026-11-24');
    expect(t).toMatchObject({ kind: 'after_deload', load: 30 });
  });
  it('stallo ripetuto dopo lo scarico: proponi variante', () => {
    const d = log(27, 8, 3, { target: { sets: 3, reps: 8, load: 27, kind: 'deload', message: '' } });
    const h3 = [ses('2026-11-30', log(30, 8, 1)), ses('2026-11-28', log(30, 8, 1)), ses('2026-11-26', log(30, 8, 1, { target: { sets: 3, reps: 8, load: 30, kind: 'after_deload', message: '' } })), ses('2026-11-22', d), ...h];
    const t = suggestTarget(row, ex, 1, h3, '2026-12-01');
    expect(t.advice).toBe('substitute');
  });
  it('dolore in 2 sedute di fila: sostituzione e medico', () => {
    const hp = [ses('2026-11-20', log(30, 8, 3, { pain: true })), ses('2026-11-18', log(30, 8, 3, { pain: true }))];
    expect(suggestTarget(row, ex, 1, hp, '2026-11-22').advice).toBe('doctor_substitute');
  });
});

describe('rank', () => {
  it('formula del massimale stimato', () => {
    expect(estimate1RM(60, 8, 2)).toBeCloseTo(80);
  });
  it('23 livelli e confini delle fasce', () => {
    expect(MAX_LEVEL).toBe(23);
    const th = DEFAULT_THRESHOLDS.panca;
    expect(levelName(levelFromIndex(0.1, th).level)).toBe('Rame 1');
    expect(levelName(levelFromIndex(0.5, th).level)).toBe('Bronzo 1');
    expect(levelName(levelFromIndex(1.0, th).level)).toBe('Oro 1');
    expect(levelName(levelFromIndex(1.25, th).level)).toBe('Platino 1');
    expect(levelName(levelFromIndex(2.0, th).level)).toBe('Grand Champion');
    expect(levelName(levelFromIndex(2.31, th).level)).toBe('Super Lega');
  });
});

describe('sfide', () => {
  const matches = [{ date: '2027-01-15', time: '21:00', venue: null }];
  it('mai nelle 48 ore prima né il giorno dopo la partita', () => {
    expect(challengeDateProblem('2027-01-13', 'day', matches, [])).toBeTruthy();
    expect(challengeDateProblem('2027-01-16', 'day', matches, [])).toBeTruthy();
    expect(challengeDateProblem('2027-01-12', 'day', matches, [])).toBeNull();
  });
  it('almeno 3 settimane tra una sfida e l’altra', () => {
    expect(challengeDateProblem('2027-01-25', 'day', [], [{ challengeId: 1, date: '2027-01-12', status: 'completed' }])).toBeTruthy();
  });
  it('rifiuta sfide al cedimento', () => {
    expect(challengeTextProblem('Panca fino al cedimento')).toBeTruthy();
    expect(challengeTextProblem('50 piegamenti in serie da 10 con margine')).toBeNull();
  });
  it('sblocco: 8 settimane e costanza ≥ 80%', () => {
    const weeks = weekStats([], [], '2026-11-16', '2026-11-26');
    expect(unlockStatus(weeks, '2026-11-16', '2026-11-26').unlocked).toBe(false);
  });
});

describe('ics', () => {
  it('evento ricorrente con avviso', () => {
    const ics = buildIcs([0, 3], '18:30', 45, 30, '2026-11-26');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TH');
    expect(ics).toContain('DTSTART:20261126T183000');
    expect(ics).toContain('TRIGGER:-PT30M');
  });
});
