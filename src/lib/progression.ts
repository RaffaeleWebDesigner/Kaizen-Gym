import type { Exercise, ExerciseLog, Session, Target } from '../db';
import { diffDays } from './dates';
import { fmtNum, roundToStep } from './units';
import { exerciseLogs, levelOf, stallInfo } from './stall';
import { nearestPlatesTotal, nextPlatesTotal } from './plates';

export interface RowLike {
  sets: number;
  repMin: number;
  repMax: number;
  startLoad: number;
}

type ExLike = Pick<Exercise, 'type' | 'increment' | 'stackStep' | 'bodyweight' | 'unit'>;

export interface ProgressionOpts {
  /** Carichi di soli dischi possibili con l'inventario (per gli esercizi col bilanciere). */
  plateTotals?: number[];
}

/** Ultimo registro di un esercizio nelle sedute fatte (ordinate dalla più recente). */
export function lastLogOf(history: Session[], exerciseId: number, beforeDate?: string): { log: ExerciseLog; session: Session } | null {
  for (const s of history) {
    if (s.status !== 'done') continue;
    if (beforeDate && s.date >= beforeDate) continue;
    const log = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (log) return { log, session: s };
  }
  return null;
}

export const RESTART_GAP_DAYS = 7;

/**
 * Logica Kaizen: progressione minima, mai salti.
 * history: sedute (qualsiasi stato) ordinate dalla più recente.
 */
export function suggestTarget(row: RowLike, ex: ExLike, exerciseId: number, history: Session[], today: string, opts: ProgressionOpts = {}): Target {
  const done = history.filter((s) => s.status === 'done' && s.date <= today);
  const prev = lastLogOf(done, exerciseId, undefined);
  const sets = row.sets;
  const totals = opts.plateTotals && opts.plateTotals.length > 1 ? opts.plateTotals : null;
  const step = ex.stackStep || ex.increment;
  const unit = ex.type === 'time' ? 's' : ex.unit;

  const lighter = (load: number) => {
    if (totals) return nearestPlatesTotal(load * 0.9, totals, load);
    return Math.max(0, roundToStep(load * 0.9, step));
  };
  const heavier = (load: number) => {
    if (totals) return nextPlatesTotal(load, totals) ?? Math.round((load + step) * 100) / 100;
    return Math.round((load + step) * 100) / 100;
  };

  if (!prev) {
    return {
      sets,
      reps: row.repMin,
      load: row.startLoad,
      kind: 'first',
      message: row.startLoad === 0 && !ex.bodyweight && ex.type === 'reps'
        ? `Prima volta: scegli un peso con cui arrivi a ${row.repMin} ripetizioni lasciandone 2-3 di margine. Meglio leggero che troppo pesante.`
        : 'Prima volta: parti dal minimo della fascia e tieni 2-3 ripetizioni di margine.',
    };
  }

  const { log } = prev;
  const { load, reps: level } = levelOf(log);
  const lastGym = done[0]?.date ?? prev.session.date;
  const gap = diffDays(today, lastGym);
  const entries = exerciseLogs(done, exerciseId);
  const stall = stallInfo(entries);

  if (log.pain) {
    return {
      sets,
      reps: level,
      load,
      kind: 'pain',
      advice: stall.painStreak ? 'doctor_substitute' : undefined,
      message: stall.painStreak
        ? 'Dolore in 2 sedute di fila su questo esercizio: oggi sostituiscilo con una variante. Se continua, senti un medico o un fisioterapista.'
        : "Nessuna progressione: l'ultima volta hai segnato dolore. Se torna, fermati e sostituisci l'esercizio.",
    };
  }

  if (gap > RESTART_GAP_DAYS) {
    let newLoad = load;
    let newReps = level;
    if (ex.type === 'time') {
      newReps = Math.max(row.repMin, roundToStep(level * 0.9, 5));
    } else if (ex.bodyweight && load === 0) {
      newReps = Math.max(1, level - 1);
    } else {
      newLoad = lighter(load);
    }
    return {
      sets,
      reps: newReps,
      load: newLoad,
      kind: 'restart',
      message:
        newLoad === load && newReps === level
          ? `Bentornato. Sei stato fermo ${gap} giorni: ${ex.stackStep ? 'stesso carico (non si scende di meno di un blocco)' : 'stesso obiettivo, già al minimo della fascia'}, ma tieni 3 ripetizioni di margine.`
          : `Bentornato. Sei stato fermo ${gap} giorni, quindi oggi un po' più leggero (circa -10%). Contava presentarsi, e l'hai fatto.`,
    };
  }

  // dopo lo scarico si riparte dal livello di prima
  if (log.target?.kind === 'deload') {
    const before = entries.filter((e) => e.log !== log && e.log.target?.kind !== 'deload').pop();
    const lv = before ? levelOf(before.log) : { load, reps: level };
    return { sets, reps: lv.reps, load: lv.load, kind: 'after_deload', message: 'Scarico fatto: oggi si riparte dal carico di prima, con calma.' };
  }

  if (stall.stalled && !stall.deloadDone) {
    const dl = ex.type === 'time' ? load : lighter(load);
    const dr = ex.type === 'time' || (ex.bodyweight && load === 0) ? Math.max(1, Math.round(level * 0.9)) : level;
    return {
      sets,
      reps: dr,
      load: dl,
      kind: 'deload',
      message: 'In stallo da 3 sedute: oggi seduta di scarico (circa -10%). Serve a ripartire, non è un passo indietro.',
    };
  }
  if (stall.stalled && stall.deloadDone) {
    return {
      sets,
      reps: level,
      load,
      kind: 'same',
      advice: 'substitute',
      message: 'Ancora in stallo anche dopo lo scarico: valuta di sostituirlo con una variante. La scheda la cambi tu nei modelli.',
    };
  }

  const target = log.target;
  const completed =
    log.sets.length > 0 &&
    log.sets.every((s) => s.done) &&
    (!target || log.sets.every((s) => s.reps >= target.reps)) &&
    log.sets.length >= Math.min(sets, target?.sets ?? sets);

  if (!completed) {
    return { sets, reps: level, load, kind: 'same', message: 'Serie non tutte completate: stesso obiettivo della volta scorsa, senza fretta.' };
  }
  if (log.rir === null || log.rir === undefined) {
    return { sets, reps: level, load, kind: 'same', message: 'RIR non segnato la volta scorsa: stesso obiettivo. Segnalo oggi e la prossima si sale.' };
  }
  if (log.rir < 2) {
    return { sets, reps: level, load, kind: 'same', message: 'RIR sotto 2 la volta scorsa: stesso obiettivo, con più margine.' };
  }
  if (level < row.repMax) {
    return { sets, reps: level + 1, load, kind: 'reps', message: '+1 ripetizione per serie. Un passo piccolo, tutto qui.' };
  }
  if (ex.type === 'time' || (ex.bodyweight && ex.increment <= 0)) {
    return {
      sets,
      reps: row.repMax,
      load,
      kind: 'top',
      message: 'Sei in cima alla fascia: tieni così e valuta col coach una variante un filo più difficile.',
    };
  }
  const next = heavier(load);
  const jump = Math.round((next - load) * 100) / 100;
  return {
    sets,
    reps: row.repMin,
    load: next,
    kind: 'load',
    message: `Fascia completata: +${fmtNum(jump, 2)} ${unit}${ex.stackStep ? ' (1 blocco)' : totals ? ' (il salto più piccolo con i tuoi dischi)' : ''} e si riparte da ${row.repMin} ripetizioni.`,
  };
}
