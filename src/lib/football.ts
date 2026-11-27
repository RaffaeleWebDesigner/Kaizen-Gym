import type { DayMark, ExerciseLog, Match, TemplateRow, Exercise } from '../db';
import { addDays, weekDays, weekdayMon, dayName } from './dates';

export interface FootballEvent {
  date: string;
  kind: 'training' | 'match';
  time?: string;
  match?: Match;
}

/** Allenamenti ricorrenti (giorno della settimana) dalla data di inizio, meno quelli annullati. */
export function trainingDates(from: string, to: string, weekday: number, startDate: string, marks: DayMark[]): string[] {
  if (weekday < 0 || weekday > 6) return [];
  const cancelled = new Set(marks.filter((m) => m.type === 'training_cancelled').map((m) => m.date));
  const out: string[] = [];
  let d = from < startDate ? startDate : from;
  while (weekdayMon(d) !== weekday) d = addDays(d, 1);
  for (; d <= to; d = addDays(d, 7)) if (!cancelled.has(d)) out.push(d);
  return out;
}

export function nextMatch(matches: Match[], now: Date): Match | null {
  const list = [...matches]
    .map((m) => ({ m, t: matchTime(m).getTime() }))
    .filter((x) => x.t + 2 * 3600_000 > now.getTime()) // in corso conta ancora per 2 ore
    .sort((a, b) => a.t - b.t);
  return list[0]?.m ?? null;
}

export function matchTime(m: Match): Date {
  const [y, mo, d] = m.date.split('-').map(Number);
  const [h, mi] = (m.time || '00:00').split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

export function countdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return 'in corso';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} g ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

/** Serie di gambe (da quante in su) per cui una seduta è "gambe pesanti". */
export const HEAVY_LEG_SETS = 2;

export function legSets(items: { group: string; sets: number }[]): number {
  return items.filter((i) => i.group === 'gambe').reduce((a, i) => a + i.sets, 0);
}

export function templateLegSets(rows: TemplateRow[], exById: Map<number, Exercise>): number {
  return legSets(rows.map((r) => ({ group: exById.get(r.exerciseId)?.group ?? '', sets: r.sets })));
}

export function logLegSets(logs: ExerciseLog[]): number {
  return legSets(logs.filter((l) => !l.stopped).map((l) => ({ group: l.group, sets: l.sets.length })));
}

/**
 * Motivo per cui oggi le gambe pesanti sono sconsigliate, oppure null.
 * Regole: giorno della partita e giorno prima.
 */
export function legWarning(date: string, matches: Match[]): string | null {
  const matchDates = new Set(matches.map((m) => m.date));
  if (matchDates.has(date)) return 'Oggi hai la partita.';
  if (matchDates.has(addDays(date, 1))) return `Domani (${dayName(addDays(date, 1))}) hai la partita.`;
  return null;
}

export interface DaySuggestion {
  date: string;
  legsOk: boolean;
  note: string;
}

/**
 * Sceglie i 3 giorni migliori della settimana per la palestra.
 * Evita partita e allenamento, distanzia le sedute e mette le gambe lontano dalla partita.
 */
export function suggestWeek(monday: string, matches: Match[], trainings: string[], fromDate: string, count = 3): DaySuggestion[] {
  const days = weekDays(monday).filter((d) => d >= fromDate);
  const matchDates = new Set(matches.map((m) => m.date));
  const training = new Set(trainings);
  const n = Math.min(count, days.length);
  if (n === 0) return [];

  const penalty = (d: string) => {
    let p = 0;
    if (matchDates.has(d)) p += 100;
    if (training.has(d)) p += 25;
    if (matchDates.has(addDays(d, 1))) p += 12; // vigilia: si può, ma solo parte alta
    if (matchDates.has(addDays(d, -1))) p += 10; // recupero dopo la partita
    return p;
  };

  let best: string[] = [];
  let bestScore = Infinity;
  const combo = (start: number, chosen: string[]) => {
    if (chosen.length === n) {
      let score = chosen.reduce((a, d) => a + penalty(d), 0);
      for (let i = 1; i < chosen.length; i++) {
        const gap = weekdayMon(chosen[i]) - weekdayMon(chosen[i - 1]);
        if (gap === 1) score += 20;
      }
      if (score < bestScore) {
        bestScore = score;
        best = [...chosen];
      }
      return;
    }
    for (let i = start; i < days.length; i++) combo(i + 1, [...chosen, days[i]]);
  };
  combo(0, []);

  return best.map((d) => {
    const warn = legWarning(d, matches);
    let note = warn ? 'solo parte alta' : 'gambe ok';
    if (training.has(d)) note += ', c’è anche l’allenamento';
    if (matchDates.has(addDays(d, -1))) note += ', dopo la partita: leggero';
    return { date: d, legsOk: !warn, note };
  });
}
