import type { ExerciseLog, Session } from '../db';

export interface LogEntry {
  log: ExerciseLog;
  date: string;
}

/** Registri fatti di un esercizio, dal più vecchio al più recente. */
export function exerciseLogs(history: Session[], exerciseId: number, upTo?: string): LogEntry[] {
  return history
    .filter((s) => s.status === 'done' && (!upTo || s.date <= upTo))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId && e.sets.length > 0).map((log) => ({ log, date: s.date })));
}

export function levelOf(log: ExerciseLog) {
  const ref = log.sets.filter((s) => s.done).length ? log.sets.filter((s) => s.done) : log.sets;
  return { load: Math.max(...ref.map((s) => s.load)), reps: Math.min(...ref.map((s) => s.reps)) };
}

const isDeload = (l: ExerciseLog) => l.target?.kind === 'deload';

/** Progresso rispetto alla seduta precedente: più carico, oppure stesso carico e più ripetizioni. */
export function progressed(prev: ExerciseLog, cur: ExerciseLog): boolean {
  const a = levelOf(prev);
  const b = levelOf(cur);
  return b.load > a.load + 1e-9 || (Math.abs(b.load - a.load) < 1e-9 && b.reps > a.reps);
}

function noProgress(prev: ExerciseLog | null, cur: ExerciseLog): boolean {
  if (cur.rir !== null && cur.rir < 2) return true;
  if (!prev) return false;
  return !progressed(prev, cur);
}

export interface StallInfo {
  stalled: boolean;
  deloadDone: boolean; // scarico già fatto dall'ultimo progresso
  painStreak: boolean; // dolore nelle ultime 2 sedute di fila
  lastPain: boolean;
}

export function stallInfo(entries: LogEntry[]): StallInfo {
  const logs = entries.map((e) => e.log);
  const n = logs.length;
  const painStreak = n >= 2 && logs[n - 1].pain && logs[n - 2].pain;
  const lastPain = n >= 1 && logs[n - 1].pain;
  let stalled = false;
  if (n >= 3 && !logs.slice(-3).some(isDeload)) {
    // confronto saltando gli scarichi (che hanno il carico ridotto apposta)
    const plain = logs.filter((l) => !isDeload(l));
    const m = plain.length;
    stalled = [m - 3, m - 2, m - 1].every((i) => noProgress(i > 0 ? plain[i - 1] : null, plain[i]));
  }
  // c'è stato uno scarico dopo l'ultimo progresso reale?
  let deloadDone = false;
  const plain: ExerciseLog[] = [];
  for (const l of logs) {
    if (isDeload(l)) {
      deloadDone = true;
      continue;
    }
    if (plain.length && progressed(plain[plain.length - 1], l) && !(l.target?.kind === 'after_deload')) deloadDone = false;
    plain.push(l);
  }
  return { stalled, deloadDone, painStreak, lastPain };
}
