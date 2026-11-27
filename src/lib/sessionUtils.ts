import { db, type Exercise, type ExerciseLog, type Session, type SessionKind, type Target, type TemplateRow } from '../db';
import { suggestTarget, type RowLike } from './progression';
import { getSettings, type AppSettings } from './settings';
import { plateTotals } from './plates';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function rowFor(ex: Exercise, row?: Partial<TemplateRow>): RowLike & { restSec: number } {
  const time = ex.type === 'time';
  return {
    sets: row?.sets ?? 2,
    repMin: row?.repMin ?? (time ? 30 : 8),
    repMax: row?.repMax ?? (time ? 60 : 12),
    startLoad: row?.startLoad ?? 0,
    restSec: row?.restSec ?? ex.restSec,
  };
}

export function makeLog(ex: Exercise, row: RowLike & { restSec: number }, target: Target | null, sets?: ExerciseLog['sets']): ExerciseLog {
  return {
    uid: uid(),
    exerciseId: ex.id!,
    name: ex.name,
    group: ex.group,
    type: ex.type,
    unit: ex.unit,
    bodyweight: ex.bodyweight,
    isBarbell: ex.isBarbell,
    barWeight: ex.barWeight,
    perHand: ex.perHand,
    increment: ex.increment,
    stackStep: ex.stackStep,
    repMin: row.repMin,
    repMax: row.repMax,
    restSec: row.restSec,
    cues: ex.cues,
    sets:
      sets ??
      Array.from({ length: target?.sets ?? row.sets }, () => ({
        reps: target?.reps ?? row.repMin,
        load: target?.load ?? row.startLoad,
        done: false,
      })),
    rir: null,
    pain: false,
    stopped: false,
    notes: '',
    target,
  };
}

/** Peso del bilanciere preso dall'inventario, se l'esercizio è collegato. */
export function withBar(ex: Exercise, settings: AppSettings): Exercise {
  if (!ex.isBarbell || !ex.barId) return ex;
  const bar = settings.bars.find((b) => b.id === ex.barId);
  return bar && bar.weight !== null ? { ...ex, barWeight: bar.weight } : ex;
}

export async function sessionHistory(): Promise<Session[]> {
  const all = await db.sessions.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt ?? 0) - (a.endedAt ?? 0));
}

/** Prepara il registro di un esercizio con l'obiettivo di oggi. */
export async function buildLog(ex: Exercise, date: string, row?: Partial<TemplateRow>, history?: Session[]): Promise<ExerciseLog> {
  const hist = history ?? (await sessionHistory());
  const prevLog = hist.find((s) => s.status === 'done' && s.exercises.some((e) => e.exerciseId === ex.id))?.exercises.find((e) => e.exerciseId === ex.id);
  const r = rowFor(ex, row ?? (prevLog ? { repMin: prevLog.repMin, repMax: prevLog.repMax, sets: prevLog.sets.length, startLoad: prevLog.sets[0]?.load ?? 0, restSec: prevLog.restSec } : undefined));
  const settings = await getSettings();
  const exx = withBar(ex, settings);
  const target = suggestTarget(r, exx, exx.id!, hist.filter((s) => s.date <= date), date, {
    plateTotals: exx.isBarbell && exx.unit === 'kg' ? plateTotals(settings.plates) : undefined,
  });
  return makeLog(exx, r, target);
}

/** Crea una nuova seduta (in corso o passata) dal modello. */
export async function createSession(kind: SessionKind, date: string, opts: { past?: boolean; skipLegs?: boolean } = {}): Promise<number> {
  const history = await sessionHistory();
  const exercises: ExerciseLog[] = [];
  if (kind !== 'FREE') {
    const tpl = await db.templates.where('code').equals(kind).first();
    for (const row of tpl?.rows ?? []) {
      const ex = await db.exercises.get(row.exerciseId);
      if (!ex || ex.archived) continue;
      if (opts.skipLegs && ex.group === 'gambe') continue;
      exercises.push(await buildLog(ex, date, row, history));
    }
  }
  const now = Date.now();
  return db.sessions.add({
    date,
    kind,
    status: 'in_progress',
    startedAt: opts.past ? null : now,
    endedAt: null,
    durationMin: null,
    feeling: null,
    notes: '',
    exercises,
  });
}
