import type { DayMark, Session } from '../db';
import { addDays, mondayOf, isoRange } from './dates';
import { totalKg } from './units';

export interface WeekStat {
  monday: string;
  done: number;
  minima: number;
  sick: number;
  target: number;
  ok: boolean; // striscia mantenuta
  pct: number; // 0-100
  inProgress: boolean;
}

export function doneSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.status === 'done');
}

/** Regola concordata: ogni giorno di malattia toglie 1 seduta dal previsto. */
export function weekTarget(goal: number, sickDays: number): number {
  return Math.max(0, goal - sickDays);
}

export function weekOk(done: number, target: number): boolean {
  return done >= 2 || done >= target;
}

export function weekStats(sessions: Session[], marks: DayMark[], startDate: string, today: string, goal = 3): WeekStat[] {
  const done = doneSessions(sessions);
  const out: WeekStat[] = [];
  const currentMonday = mondayOf(today);
  for (let m = mondayOf(startDate); m <= currentMonday; m = addDays(m, 7)) {
    const end = addDays(m, 6);
    const inWeek = done.filter((s) => s.date >= m && s.date <= end);
    const sick = new Set(marks.filter((x) => x.type === 'sick' && x.date >= m && x.date <= end).map((x) => x.date)).size;
    const target = weekTarget(goal, sick);
    const n = inWeek.length;
    out.push({
      monday: m,
      done: n,
      minima: inWeek.filter((s) => s.kind === 'MIN').length,
      sick,
      target,
      ok: weekOk(n, target),
      pct: target === 0 ? 100 : Math.min(100, Math.round((n / target) * 100)),
      inProgress: m === currentMonday,
    });
  }
  return out;
}

/** Settimane consecutive con almeno 2 sedute (o previsto ridotto raggiunto). La settimana in corso conta solo se già raggiunta. */
export function streak(weeks: WeekStat[]): number {
  let n = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.inProgress && !w.ok) continue;
    if (w.ok) n++;
    else break;
  }
  return n;
}

export interface MonthStat {
  key: string; // YYYY-MM
  done: number;
  target: number;
  pct: number;
}

/** Mese = settimane il cui lunedì cade nel mese. */
export function monthStats(weeks: WeekStat[]): MonthStat[] {
  const map = new Map<string, MonthStat>();
  for (const w of weeks) {
    const key = w.monday.slice(0, 7);
    const m = map.get(key) ?? { key, done: 0, target: 0, pct: 0 };
    m.done += w.done;
    m.target += w.target;
    map.set(key, m);
  }
  return [...map.values()].map((m) => ({ ...m, pct: m.target === 0 ? 100 : Math.min(100, Math.round((m.done / m.target) * 100)) }));
}

export interface ExercisePoint {
  date: string;
  maxKg: number;
  volumeKg: number;
  maxReps: number;
  totalReps: number;
}

export function exerciseHistory(sessions: Session[], exerciseId: number): ExercisePoint[] {
  const pts: ExercisePoint[] = [];
  for (const s of [...doneSessions(sessions)].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const log of s.exercises.filter((e) => e.exerciseId === exerciseId)) {
      const sets = log.sets.filter((x) => x.done);
      if (!sets.length) continue;
      pts.push({
        date: s.date,
        maxKg: Math.max(...sets.map((x) => totalKg(log, x.load))),
        volumeKg: sets.reduce((a, x) => a + x.reps * totalKg(log, x.load), 0),
        maxReps: Math.max(...sets.map((x) => x.reps)),
        totalReps: sets.reduce((a, x) => a + x.reps, 0),
      });
    }
  }
  return pts;
}

export interface PR {
  exerciseId: number;
  name: string;
  type: 'reps' | 'time';
  bestLoadKg: number;
  bestLoadReps: number;
  bestLoadDate: string;
  bestReps: number;
  bestVolumeKg: number;
}

export function personalRecords(sessions: Session[]): PR[] {
  const map = new Map<number, PR>();
  for (const s of doneSessions(sessions)) {
    for (const log of s.exercises) {
      for (const set of log.sets.filter((x) => x.done)) {
        const kg = totalKg(log, set.load);
        const pr = map.get(log.exerciseId) ?? {
          exerciseId: log.exerciseId,
          name: log.name,
          type: log.type,
          bestLoadKg: -1,
          bestLoadReps: 0,
          bestLoadDate: s.date,
          bestReps: 0,
          bestVolumeKg: 0,
        };
        if (kg > pr.bestLoadKg || (kg === pr.bestLoadKg && set.reps > pr.bestLoadReps)) {
          pr.bestLoadKg = kg;
          pr.bestLoadReps = set.reps;
          pr.bestLoadDate = s.date;
        }
        pr.bestReps = Math.max(pr.bestReps, set.reps);
        map.set(log.exerciseId, pr);
      }
      const vol = log.sets.filter((x) => x.done).reduce((a, x) => a + x.reps * totalKg(log, x.load), 0);
      const pr = map.get(log.exerciseId);
      if (pr) pr.bestVolumeKg = Math.max(pr.bestVolumeKg, vol);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function daysRange(from: string, to: string) {
  return isoRange(from, to);
}
