import { db, SKIP_CATEGORY_LABEL, type Challenge, type ChallengeAttempt, type DayMark, type Exercise, type Session, type SkipCategory, type Success, type Measurement } from '../db';
import { addDays, fmtDate, todayISO } from './dates';
import { exerciseLogs, stallInfo } from './stall';
import { fmtNum, totalLoad } from './units';
import { weekStats } from './stats';
import { computeRanks, levelName } from './rank';
import { getSettings, setSetting, type AppSettings } from './settings';
import { goalProgress, loadGoalCtx } from './goals';

// ---------- verifica dei successi ----------

export type Label = 'verified' | 'unconfirmed' | 'declared';
export const LABEL_TEXT: Record<Label, string> = {
  verified: '✅ Verificato',
  unconfirmed: '⚠ Non confermato dai dati',
  declared: '📝 Dichiarato',
};

export interface VerifyData {
  sessions: Session[];
  marks: DayMark[];
  attempts: ChallengeAttempt[];
  challenges: Challenge[];
  exById: Map<number, Exercise>;
  settings: AppSettings;
  measures: Measurement[];
}

export function verifySuccess(s: Success, d: VerifyData): { label: Label; verdict: string | null } {
  const c = s.claim;
  if (s.source !== 'manual') return { label: 'verified', verdict: null };
  if (!c) return { label: 'declared', verdict: null };
  const done = d.sessions.filter((x) => x.status === 'done' && x.date <= s.date);

  if (c.type === 'record') {
    const ex = c.exerciseId ? d.exById.get(c.exerciseId) : null;
    let best: { load: number; reps: number; date: string } | null = null;
    let ok = false;
    for (const ses of done) {
      for (const log of ses.exercises.filter((l) => l.exerciseId === c.exerciseId)) {
        for (const set of log.sets.filter((x) => x.done)) {
          const tot = totalLoad(log, set.load);
          if (tot >= (c.load ?? 0) - 1e-9 && set.reps >= (c.reps ?? 0)) ok = true;
          if (!best || tot > best.load || (tot === best.load && set.reps > best.reps)) best = { load: tot, reps: set.reps, date: ses.date };
        }
      }
    }
    if (ok) return { label: 'verified', verdict: null };
    const unit = ex?.unit ?? 'kg';
    return {
      label: 'unconfirmed',
      verdict: best
        ? `Hai scritto ${fmtNum(c.load ?? 0)} ${unit} × ${c.reps}, ma il registro dice al massimo ${fmtNum(best.load)} ${unit} × ${best.reps} (${fmtDate(best.date)}).`
        : `Hai scritto ${fmtNum(c.load ?? 0)} ${unit} × ${c.reps}, ma nel registro non c’è nessuna serie fatta di ${ex?.name ?? 'questo esercizio'}.`,
    };
  }

  if (c.type === 'settimana' && c.weekStart) {
    const weeks = weekStats(d.sessions, d.marks, d.settings.startDate, s.date > c.weekStart ? s.date : c.weekStart, d.settings.weeklyGoal);
    const w = weeks.find((x) => x.monday === c.weekStart);
    const skipped = d.marks.filter((m) => m.type === 'skipped' && m.date >= c.weekStart! && m.date <= fmtEnd(c.weekStart!)).length;
    const n = w?.done ?? 0;
    const goal = d.settings.weeklyGoal;
    if (n >= goal && skipped === 0) return { label: 'verified', verdict: null };
    return {
      label: 'unconfirmed',
      verdict: `Hai scritto "settimana perfetta", ma il registro dice ${n}/${goal} sedute${skipped ? ` e ${skipped} ${skipped === 1 ? 'seduta saltata' : 'sedute saltate'}` : ''}.`,
    };
  }

  if (c.type === 'sfida' && c.challengeId) {
    const ch = d.challenges.find((x) => x.id === c.challengeId);
    const at = d.attempts.filter((a) => a.challengeId === c.challengeId);
    if (at.some((a) => a.status === 'completed')) return { label: 'verified', verdict: null };
    const st = at.length ? (at.some((a) => a.status === 'failed') ? 'non completata' : 'solo in programma') : 'mai registrata';
    return { label: 'unconfirmed', verdict: `Hai scritto di aver completato "${ch?.name ?? 'la sfida'}", ma nel registro risulta ${st}.` };
  }

  if (c.type === 'costanza' && c.weeks && c.pct !== undefined) {
    const weeks = weekStats(d.sessions, d.marks, d.settings.startDate, s.date, d.settings.weeklyGoal).slice(-c.weeks);
    const dn = weeks.reduce((a, w) => a + Math.min(w.done, w.target), 0);
    const tg = weeks.reduce((a, w) => a + w.target, 0);
    const pct = tg ? Math.round((dn / tg) * 100) : 100;
    if (pct >= c.pct) return { label: 'verified', verdict: null };
    return { label: 'unconfirmed', verdict: `Hai scritto ${c.pct}% di costanza in ${c.weeks} settimane, ma il registro dice ${pct}% (${dn}/${tg} sedute).` };
  }
  if (c.type === 'seduta' && c.date) {
    if (done.some((x) => x.date === c.date)) return { label: 'verified', verdict: null };
    return { label: 'unconfirmed', verdict: `Nel registro non c’è nessuna seduta fatta il ${fmtDate(c.date)}.` };
  }
  if (c.type === 'misura' && c.date) {
    if (d.measures.some((x) => x.date === c.date)) return { label: 'verified', verdict: null };
    return { label: 'unconfirmed', verdict: `Nel registro non c’è nessuna misura del ${fmtDate(c.date)}.` };
  }
  if (c.type === 'ripresa' && c.date) {
    const back = done.find((x) => x.date > c.date!);
    if (back) return { label: 'verified', verdict: null };
    return { label: 'unconfirmed', verdict: `Nel registro non c’è ancora una seduta dopo la malattia del ${fmtDate(c.date)}.` };
  }
  return { label: 'declared', verdict: null };
}

function fmtEnd(monday: string) {
  const [y, m, d] = monday.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 6);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ---------- analisi sedute saltate ----------

export function skipStats(marks: DayMark[], month: string) {
  const counts = new Map<SkipCategory, number>();
  for (const m of marks) {
    if (m.type !== 'skipped' || m.date.slice(0, 7) !== month) continue;
    const c = m.category ?? 'altro';
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((a, [, n]) => a + n, 0);
  return { counts, sorted, total };
}

export function enemySentence(marks: DayMark[], month: string, label = 'questo mese'): string {
  const { sorted, total } = skipStats(marks, month);
  if (!total) return `Nessuna seduta saltata ${label}.`;
  const [cat, n] = sorted[0];
  const tie = sorted.filter(([, k]) => k === n).length > 1;
  const name = SKIP_CATEGORY_LABEL[cat].toLowerCase();
  return tie
    ? `Il tuo nemico n.1 ${label}: pari merito tra ${sorted.filter(([, k]) => k === n).map(([c]) => SKIP_CATEGORY_LABEL[c].toLowerCase()).join(' e ')} – ${n} ${n === 1 ? 'seduta' : 'sedute'} ciascuno.`
    : `Il tuo nemico n.1 ${label}: ${name} – ${n} ${n === 1 ? 'seduta' : 'sedute'}.`;
}

// ---------- voci automatiche: record, sfide, rank ----------

async function addAuto(s: Omit<Success, 'id' | 'createdAt'>) {
  if (!s.autoKey) return false;
  const exists = await db.successes.where('autoKey').equals(s.autoKey).count();
  if (exists) return false;
  await db.successes.add({ ...s, createdAt: Date.now() });
  return true;
}

let running: Promise<void> = Promise.resolve();

/** Aggiorna record, sfide e rank. Le chiamate vengono messe in fila. */
export function syncDerived(): Promise<void> {
  running = running.then(doSync).catch((e) => console.error('syncDerived', e));
  return running;
}

async function doSync(): Promise<void> {
  const [sessions, exercises, attempts, challenges, measures, settings] = await Promise.all([
    db.sessions.toArray(), db.exercises.toArray(), db.challengeAttempts.toArray(), db.challenges.toArray(), db.measurements.toArray(), getSettings(),
  ]);
  const exById = new Map(exercises.map((e) => [e.id!, e]));

  // record personali (dopo la prima seduta di ogni esercizio)
  const chrono = sessions.filter((s) => s.status === 'done').sort((a, b) => a.date.localeCompare(b.date) || (a.endedAt ?? 0) - (b.endedAt ?? 0));
  const best = new Map<number, { load: number; reps: number }>();
  for (const s of chrono) {
    for (const log of s.exercises) {
      const sets = log.sets.filter((x) => x.done);
      if (!sets.length) continue;
      const top = sets.reduce((a, x) => {
        const t = totalLoad(log, x.load);
        return t > a.load || (t === a.load && x.reps > a.reps) ? { load: t, reps: x.reps } : a;
      }, { load: -1, reps: 0 });
      const prev = best.get(log.exerciseId);
      if (prev && (top.load > prev.load + 1e-9 || (Math.abs(top.load - prev.load) < 1e-9 && top.reps > prev.reps))) {
        const what = log.type === 'time' ? `${top.reps}"` : top.load > 0 ? `${fmtNum(top.load)} ${log.unit} × ${top.reps}` : `${top.reps} ripetizioni`;
        await addAuto({
          date: s.date, title: `Record: ${log.name}`, description: what, category: 'palestra', source: 'pr', autoKey: `pr:${log.exerciseId}:${s.id}`,
          claim: { type: 'record', exerciseId: log.exerciseId, load: top.load, reps: top.reps },
        });
      }
      if (!prev || top.load > prev.load || (top.load === prev.load && top.reps > prev.reps)) best.set(log.exerciseId, top);
    }
  }

  // sfide completate
  for (const a of attempts.filter((x) => x.status === 'completed')) {
    const ch = challenges.find((c) => c.id === a.challengeId);
    await addAuto({
      date: a.date, title: `Sfida completata: ${ch?.name ?? ''}`, description: a.note, category: 'palestra', source: 'challenge', autoKey: `challenge:${a.id}`,
      claim: { type: 'sfida', challengeId: a.challengeId },
    });
  }

  // rank: storico, promozioni e retrocessioni
  const today = todayISO();
  const { ranks, overall, bw } = settings.rankEnabled
    ? computeRanks(sessions, exById, measures, settings.rankThresholds, today)
    : { ranks: [] as ReturnType<typeof computeRanks>['ranks'], overall: null, bw: null };
  const history = await db.rankHistory.toArray();
  const lastOf = (key: string) => history.filter((h) => h.key === key).sort((a, b) => a.date.localeCompare(b.date) || a.id! - b.id!).pop();
  const notices = [...settings.notices];
  const items: { key: string; level: number; index: number; label: string }[] = ranks.map((r) => ({ key: r.key, level: r.level, index: r.index, label: r.name }));
  if (overall !== null) items.push({ key: 'overall', level: overall, index: 0, label: 'Rank generale' });
  for (const it of items) {
    const last = lastOf(it.key);
    if (last && last.level === it.level) continue;
    await db.rankHistory.add({ date: today, key: it.key as never, level: it.level, index: it.index, bw });
    if (!last) continue;
    if (it.level > last.level) {
      await addAuto({ date: today, title: `Promozione: ${levelName(it.level)}`, description: it.label, category: 'palestra', source: 'rank', autoKey: `rank:${it.key}:${it.level}:${today}` });
      notices.push({ id: `p-${it.key}-${it.level}-${today}`, kind: 'promotion', level: it.level, title: `${it.label}: ${levelName(it.level)}`, text: `Da ${levelName(last.level)} a ${levelName(it.level)}. Arrivata con la progressione normale, un passo alla volta.` });
    } else {
      const bwUp = last.bw && bw && bw > last.bw + 0.05;
      notices.push({
        id: `d-${it.key}-${it.level}-${today}`, kind: 'demotion', level: it.level, title: `${it.label}: ${levelName(it.level)}`,
        text: bwUp
          ? `Sei passato da ${levelName(last.level)} a ${levelName(it.level)} perché il peso corporeo è salito (${fmtNum(last.bw!)} → ${fmtNum(bw!)} kg) a parità di carichi. L’indice è carico diviso peso: niente di grave.`
          : `Sei passato da ${levelName(last.level)} a ${levelName(it.level)} perché il rank usa solo le ultime 4 settimane e le serie migliori sono uscite dalla finestra. Basta tornare ai carichi soliti.`,
      });
    }
  }
  // obiettivi: tappe e traguardi nel barattolo
  const goals = await db.goals.where('status').equals('active').toArray();
  if (goals.length) {
    const ctx = await loadGoalCtx(today);
    for (const g of goals) {
      const p = goalProgress(g, ctx);
      for (const m of p.milestones.filter((x) => x.reached)) {
        await addAuto({ date: today, title: `Tappa: ${g.title}`, description: m.label, category: 'palestra', source: 'goal', autoKey: `goal:${g.id}:${m.key}`, claim: { type: 'obiettivo', goalId: g.id } });
      }
      if (p.done) {
        await db.goals.update(g.id!, { status: 'done', doneOn: today });
        await addAuto({ date: today, title: `Obiettivo raggiunto: ${g.title}`, description: 'Un passo piccolo alla volta.', category: 'palestra', source: 'goal', autoKey: `goal:${g.id}:done`, claim: { type: 'obiettivo', goalId: g.id } });
        notices.push({ id: `g-${g.id}`, kind: 'goal', level: 0, title: 'Obiettivo raggiunto', text: `${g.title}. Arrivato a tappe piccole, senza salti. Scegli il prossimo quando vuoi.` });
      }
    }
  }

  if (notices.length !== settings.notices.length) await setSetting('notices', notices);
}

// ---------- stallo e dolore (punto del mese e riepilogo coach) ----------

export function stallReport(sessions: Session[], exById: Map<number, Exercise>, upTo = todayISO()) {
  const ids = [...new Set(sessions.filter((s) => s.status === 'done').flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const stalled: { name: string; deloadDone: boolean }[] = [];
  const pain: { name: string; streak: boolean; date: string }[] = [];
  for (const id of ids) {
    const entries = exerciseLogs(sessions, id, upTo);
    if (!entries.length) continue;
    const info = stallInfo(entries);
    const name = exById.get(id)?.name ?? entries[entries.length - 1].log.name;
    if (info.stalled) stalled.push({ name, deloadDone: info.deloadDone });
    const lastPainEntry = [...entries].reverse().find((e) => e.log.pain);
    if (lastPainEntry && lastPainEntry.date >= addDays(upTo, -28)) pain.push({ name, streak: info.painStreak, date: lastPainEntry.date });
  }
  return { stalled, pain };
}
