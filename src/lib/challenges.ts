import type { ChallengeAttempt, Match } from '../db';
import { addDays, diffDays, mondayOf } from './dates';
import type { WeekStat } from './stats';

export const UNLOCK_WEEKS = 8;
export const UNLOCK_PCT = 80;
export const MIN_GAP_DAYS = 21; // massimo 1 sfida ogni 3-4 settimane

export interface UnlockStatus {
  unlocked: boolean;
  weeksDone: number;
  pct: number;
  weeksOk: boolean;
  pctOk: boolean;
  unlockFrom: string;
}

/** Sblocco: almeno 8 settimane dall'inizio e costanza ≥ 80% nelle ultime 4 settimane complete. */
export function unlockStatus(weeks: WeekStat[], startDate: string, today: string): UnlockStatus {
  const weeksDone = Math.floor(diffDays(today, startDate) / 7);
  const closed = weeks.filter((w) => !w.inProgress).slice(-4);
  const done = closed.reduce((a, w) => a + Math.min(w.done, w.target), 0);
  const target = closed.reduce((a, w) => a + w.target, 0);
  const pct = target === 0 ? (closed.length ? 100 : 0) : Math.round((done / target) * 100);
  const weeksOk = weeksDone >= UNLOCK_WEEKS;
  const pctOk = closed.length >= 4 && pct >= UNLOCK_PCT;
  return { unlocked: weeksOk && pctOk, weeksDone, pct, weeksOk, pctOk, unlockFrom: addDays(startDate, UNLOCK_WEEKS * 7) };
}

/** Motivo per cui una data non va bene per una sfida, oppure null. */
export function challengeDateProblem(date: string, duration: 'day' | 'week', matches: Match[], attempts: ChallengeAttempt[], ignoreAttemptId?: number): string | null {
  const d = duration === 'week' ? mondayOf(date) : date;
  const others = ignoreAttemptId === undefined ? attempts : attempts.filter((a) => a.id !== ignoreAttemptId);
  if (others.some((a) => Math.abs(diffDays(a.date, d)) < MIN_GAP_DAYS)) return 'C’è già un’altra sfida a meno di 3 settimane.';
  if (duration === 'day') {
    const md = new Set(matches.map((m) => m.date));
    if (md.has(d)) return 'È il giorno della partita.';
    if (md.has(addDays(d, 1)) || md.has(addDays(d, 2))) return 'Mancano meno di 48 ore alla partita.';
    if (md.has(addDays(d, -1))) return 'È il giorno dopo la partita.';
  }
  return null;
}

/** Prossime date compatibili da proporre. */
export function compatibleDates(from: string, duration: 'day' | 'week', matches: Match[], attempts: ChallengeAttempt[], count = 6, horizonDays = 84): string[] {
  const out: string[] = [];
  let d = duration === 'week' ? mondayOf(from) : from;
  if (duration === 'week' && d < from) d = addDays(d, 7);
  for (let i = 0; i < horizonDays && out.length < count; i += duration === 'week' ? 7 : 1) {
    const day = addDays(d, i);
    if (!challengeDateProblem(day, duration, matches, attempts)) out.push(day);
  }
  return out;
}

const UNSAFE = [
  /cediment/i, /esauriment/i, /stremo/i, /massimal/i, /\b1\s?rm\b/i, /\bmax(imo)?\s+(test|carico)/i, /failure/i, /amrap/i,
  /più\s+che\s+(puoi|posso)/i, /fino\s+a(l)?\s+non\s+(farcela|riuscire)/i, /\bal\s+limite\b/i, /sfinimento/i, /vomit/i,
];

/** Le sfide personali devono rispettare le stesse regole: niente cedimento, niente massimali. */
export function challengeTextProblem(text: string): string | null {
  return UNSAFE.some((r) => r.test(text))
    ? 'Niente cedimento, massimali o "fino allo stremo": la sfida deve essere dura ma sicura, con 1-2 ripetizioni di margine.'
    : null;
}
