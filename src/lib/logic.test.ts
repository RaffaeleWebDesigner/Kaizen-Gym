import { describe, expect, it } from 'vitest';
import type { ExerciseLog, Session } from '../db';
import { suggestTarget } from './progression';
import { streak, weekStats } from './stats';
import { legWarning, suggestWeek } from './football';

const ex = { type: 'reps' as const, increment: 1, stackStep: null, bodyweight: false, unit: 'kg' as const };
const row = { sets: 3, repMin: 8, repMax: 10, startLoad: 10 };

function log(sets: [number, number, boolean][], rir: number | null, pain = false, target: ExerciseLog['target'] = null): ExerciseLog {
  return {
    uid: 'x', exerciseId: 1, name: 'Test', group: 'spinta', type: 'reps', unit: 'kg', bodyweight: false, isBarbell: false,
    barWeight: null, perHand: false, increment: 1, stackStep: null, repMin: 8, repMax: 10, restSec: 90, cues: [],
    sets: sets.map(([reps, load, done]) => ({ reps, load, done })), rir, pain, stopped: false, notes: '', target,
  };
}
function session(date: string, l: ExerciseLog, kind: Session['kind'] = 'A'): Session {
  return { id: Math.random(), date, kind, status: 'done', startedAt: null, endedAt: null, durationMin: null, feeling: null, notes: '', exercises: [l] };
}

describe('progressione Kaizen', () => {
  it('prima volta: minimo della fascia e carico iniziale', () => {
    const t = suggestTarget(row, ex, 1, [], '2026-11-20');
    expect(t).toMatchObject({ reps: 8, load: 10, kind: 'first' });
  });
  it('tutte le serie con RIR ≥ 2: +1 ripetizione', () => {
    const h = [session('2026-11-18', log([[8, 10, true], [8, 10, true], [8, 10, true]], 2))];
    expect(suggestTarget(row, ex, 1, h, '2026-11-20')).toMatchObject({ reps: 9, load: 10, kind: 'reps' });
  });
  it('al limite della fascia: incremento minimo e si torna al minimo', () => {
    const h = [session('2026-11-18', log([[10, 10, true], [10, 10, true], [10, 10, true]], 3))];
    expect(suggestTarget(row, ex, 1, h, '2026-11-20')).toMatchObject({ reps: 8, load: 11, kind: 'load' });
  });
  it('macchina a blocchi: +1 blocco', () => {
    const h = [session('2026-11-18', log([[10, 45, true], [10, 45, true], [10, 45, true]], 2))];
    const t = suggestTarget(row, { ...ex, unit: 'lb', stackStep: 15, increment: 15 }, 1, h, '2026-11-20');
    expect(t).toMatchObject({ reps: 8, load: 60, kind: 'load' });
  });
  it('RIR sotto 2: stesso obiettivo', () => {
    const h = [session('2026-11-18', log([[9, 10, true], [9, 10, true], [9, 10, true]], 1))];
    expect(suggestTarget(row, ex, 1, h, '2026-11-20')).toMatchObject({ reps: 9, load: 10, kind: 'same' });
  });
  it('serie non completate: stesso obiettivo', () => {
    const h = [session('2026-11-18', log([[9, 10, true], [9, 10, true], [6, 10, false]], 3))];
    expect(suggestTarget(row, ex, 1, h, '2026-11-20').kind).toBe('same');
  });
  it('dolore: nessuna progressione', () => {
    const h = [session('2026-11-18', log([[8, 10, true], [8, 10, true], [8, 10, true]], 3, true))];
    expect(suggestTarget(row, ex, 1, h, '2026-11-20')).toMatchObject({ reps: 8, load: 10, kind: 'pain' });
  });
  it('fermo più di 7 giorni: circa -10% del carico', () => {
    const h = [session('2026-11-16', log([[8, 30, true], [8, 30, true], [8, 30, true]], 3))];
    const t = suggestTarget(row, { ...ex, increment: 2.5 }, 1, h, '2026-11-26');
    expect(t.kind).toBe('restart');
    expect(t.load).toBe(27.5);
  });
});

describe('costanza', () => {
  const s = (date: string, kind: Session['kind'] = 'A') => session(date, log([[8, 10, true]], 2), kind);
  it('malattia riduce il previsto e la striscia regge con 2 sedute', () => {
    const weeks = weekStats(
      [s('2026-11-16'), s('2026-11-18'), s('2026-11-24'), s('2026-11-25', 'MIN')],
      [{ date: '2026-11-23', type: 'sick' }],
      '2026-11-16', '2026-11-29', 3,
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[1]).toMatchObject({ target: 2, done: 2, ok: true });
    expect(streak(weeks)).toBe(2);
  });
  it('settimana in corso non ancora raggiunta non rompe la striscia', () => {
    const weeks = weekStats([s('2026-11-16'), s('2026-11-18')], [], '2026-11-16', '2026-11-24', 3);
    expect(streak(weeks)).toBe(1);
  });
  it('settimana chiusa con 1 seduta rompe la striscia', () => {
    const weeks = weekStats([s('2026-11-16')], [], '2026-11-16', '2026-11-30', 3);
    expect(streak(weeks)).toBe(0);
  });
});

describe('calcio', () => {
  const m = [{ date: '2026-11-27', time: '21:00', venue: null }];
  it('avvisa il giorno della partita e la vigilia', () => {
    expect(legWarning('2026-11-27', m)).toBeTruthy();
    expect(legWarning('2026-11-26', m)).toBeTruthy();
    expect(legWarning('2026-11-24', m)).toBeNull();
    expect(legWarning('2026-11-23', m)).toBeNull();
    expect(legWarning('2026-11-25', m)).toBeNull();
  });
  it('suggerisce 3 giorni senza partita né allenamento, non consecutivi', () => {
    const sug = suggestWeek('2026-11-23', m, ['2026-11-25'], '2026-11-23');
    const dates = sug.map((x) => x.date);
    expect(dates).toHaveLength(3);
    expect(dates).not.toContain('2026-11-27');
    expect(dates).not.toContain('2026-11-25');
  });
});

describe('sport spento', () => {
  it('nessun allenamento ricorrente se il giorno è -1', async () => {
    const { trainingDates } = await import('./football');
    expect(trainingDates('2026-11-23', '2026-12-31', -1, '2026-11-01', [])).toEqual([]);
  });
});
