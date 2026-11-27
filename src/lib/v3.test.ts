import { describe, expect, it } from 'vitest';
import type { DayMark, Exercise, ExerciseLog, Goal, Session } from '../db';
import { goalProgress, makeGoal, suggestGoals, type GoalCtx } from './goals';
import { verifySuccess } from './derived';
import { DEFAULT_SETTINGS } from './settings';

const plates = [5, 2, 1, 0.75, 0.5].map((weight) => ({ weight, count: null }));
const settings = { ...DEFAULT_SETTINGS, startDate: '2026-11-16', plates, bars: [{ id: 'panca', name: 'Panca', kind: 'olimpico', weight: 10 }] } as unknown as typeof DEFAULT_SETTINGS;

const panca: Exercise = { id: 1, name: 'Panca piana con bilanciere', group: 'spinta', type: 'reps', unit: 'kg', bodyweight: false, isBarbell: true, barWeight: null, perHand: false, increment: 1, stackStep: null, restSec: 120, cues: [], substituteIds: [], barId: 'panca', rankKey: 'panca' };
const traz: Exercise = { id: 2, name: 'Trazioni alla sbarra', group: 'tirata', type: 'reps', unit: 'kg', bodyweight: true, isBarbell: false, barWeight: null, perHand: false, increment: 0, stackStep: null, restSec: 120, cues: [], substituteIds: [], rankKey: 'trazioni' };

function log(ex: Exercise, load: number, reps: number): ExerciseLog {
  return {
    uid: Math.random().toString(), exerciseId: ex.id!, name: ex.name, group: ex.group, type: ex.type, unit: ex.unit, bodyweight: ex.bodyweight, isBarbell: ex.isBarbell,
    barWeight: ex.isBarbell ? 10 : null, perHand: false, increment: ex.increment, stackStep: null, repMin: 8, repMax: 10, restSec: 90, cues: [],
    sets: [1, 2, 3].map(() => ({ reps, load, done: true })), rir: 2, pain: false, stopped: false, notes: '', target: null,
  };
}
const ses = (date: string, logs: ExerciseLog[]): Session => ({ id: Math.random(), date, kind: 'A', status: 'done', startedAt: null, endedAt: null, durationMin: null, feeling: null, notes: '', exercises: logs });

function ctx(sessions: Session[], marks: DayMark[] = [], today = '2026-11-27'): GoalCtx {
  return {
    sessions, marks, today, settings, ranks: [],
    exById: new Map([[1, panca], [2, traz]]),
    templates: [{ id: 1, code: 'A', name: 'A', rows: [{ exerciseId: 1, sets: 3, repMin: 8, repMax: 10, startLoad: 20, restSec: 120 }, { exerciseId: 2, sets: 3, repMin: 3, repMax: 8, startLoad: 0, restSec: 120 }] }] as never,
    measures: [{ id: 1, date: '2026-11-16', weight: 60, waist: 80 } as never],
  };
}

describe('obiettivi', () => {
  it('esercizio: tappe da +1 ripetizione e dal disco più piccolo', () => {
    const c = ctx([ses('2026-11-26', [log(panca, 30, 9)])]);
    const g = { ...makeGoal({ kind: 'exercise', title: '', exerciseId: 1, target: 41, targetReps: 8 }, c), id: 1 } as Goal;
    // traguardo 41 kg totali = 31 di dischi + bilanciere da 10
    const p = goalProgress(g, c);
    expect(p.next).toContain('3×10 × 40 kg');
    expect(g.baseline).toBe(5); // 30×10, 30,5×8, 30,5×9, 30,5×10, 31×8
    expect(p.done).toBe(false);
  });
  it('esercizio raggiunto quando il registro arriva al traguardo', () => {
    const c = ctx([ses('2026-11-26', [log(panca, 31, 8)])]);
    const g = { kind: 'exercise', title: '', exerciseId: 1, target: 41, targetReps: 8, status: 'active', createdAt: 0, createdOn: '2026-11-20', baseline: 3, id: 1 } as Goal;
    expect(goalProgress(g, c)).toMatchObject({ done: true, pct: 100 });
  });
  it('trazioni a corpo libero: solo ripetizioni', () => {
    const c = ctx([ses('2026-11-26', [log(traz, 0, 5)])]);
    const g = { ...makeGoal({ kind: 'exercise', title: '', exerciseId: 2, target: 0, targetReps: 8 }, c), id: 2 } as Goal;
    expect(g.baseline).toBe(3);
    expect(goalProgress(g, c).next).toContain('3×6 a corpo libero');
  });
  it('costanza: striscia e tappe', () => {
    const s = ['2026-11-16', '2026-11-18', '2026-11-24', '2026-11-26'].map((d) => ses(d, []));
    const c = ctx(s);
    const g = { kind: 'streak', title: '', target: 8, status: 'active', createdAt: 0, createdOn: '2026-11-27', id: 3 } as Goal;
    const p = goalProgress(g, c);
    expect(p.currentText).toContain('2 settimane');
    expect(p.milestones.map((m) => m.label)).toEqual(['4 settimane di fila']);
  });
  it('abitudine: una seduta saltata azzera le settimane', () => {
    const s = ['2026-11-17', '2026-11-24', '2026-12-01'].map((d) => ses(d, []));
    const g = { kind: 'habit', title: '', target: 4, status: 'active', createdAt: 0, createdOn: '2026-11-16', id: 4 } as Goal;
    expect(goalProgress(g, ctx(s, [], '2026-12-08')).currentText).toContain('3 settimane');
    const marks = [{ id: 1, date: '2026-11-26', type: 'skipped' } as DayMark];
    expect(goalProgress(g, ctx(s, marks, '2026-12-08')).currentText).toContain('1 settimana');
  });
  it('corpo: percentuale verso il traguardo e ritmo sano', () => {
    const c = ctx([]);
    c.measures.push({ id: 2, date: '2026-12-20', weight: 59, waist: 79 } as never);
    const g = { kind: 'body', metric: 'weight', title: '', target: 58, baseline: 60, status: 'active', createdAt: 0, createdOn: '2026-11-16', id: 5 } as Goal;
    const p = goalProgress(g, c);
    expect(p.pct).toBe(50);
    expect(p.eta).toContain('almeno 2 settimane');
  });
  it('proposte: niente doppioni degli obiettivi attivi', () => {
    const c = ctx([ses('2026-11-26', [log(traz, 0, 5)])]);
    const all = suggestGoals(c, []);
    expect(all.map((d) => d.kind)).toEqual(['streak', 'exercise']);
    expect(all[1].targetReps).toBe(6);
    const act = [{ kind: 'streak', status: 'active' } as Goal];
    expect(suggestGoals(c, act).map((d) => d.kind)).toEqual(['exercise']);
  });
});

describe('primi successi verificati', () => {
  const vd = (sessions: Session[]) => ({ sessions, marks: [], attempts: [], challenges: [], exById: new Map(), settings, measures: [{ id: 1, date: '2026-11-16' } as never] });
  const s = (claim: object) => ({ date: '2026-11-27', title: '', category: 'palestra' as const, source: 'manual' as const, createdAt: 0, claim: claim as never });
  it('seduta, misura e ripresa dopo la malattia', () => {
    const h = [ses('2026-11-16', []), ses('2026-11-26', [])];
    expect(verifySuccess(s({ type: 'seduta', date: '2026-11-16' }), vd(h)).label).toBe('verified');
    expect(verifySuccess(s({ type: 'misura', date: '2026-11-16' }), vd(h)).label).toBe('verified');
    expect(verifySuccess(s({ type: 'ripresa', date: '2026-11-23' }), vd(h)).label).toBe('verified');
    expect(verifySuccess(s({ type: 'ripresa', date: '2026-11-23' }), vd([h[0]])).label).toBe('unconfirmed');
  });
});
