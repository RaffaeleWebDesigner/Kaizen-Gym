import { useEffect, useMemo, useRef, useState } from 'react';
import { availableEquip, substitutesFor } from '../lib/catalog';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Chips, Confirm, Field, Header, NumInput, Sheet, Stepper, inputCls, toast } from '../components/ui';
import PlateCalc from '../components/PlateCalc';
import { setSetting } from '../lib/settings';
import { syncDerived } from '../lib/derived';
import RestTimer, { primeAudio, type TimerState } from '../components/RestTimer';
import { ExercisePicker } from './TemplateEdit';
import { db, GROUP_LABEL, KIND_LABEL, type ExerciseLog, type Session } from '../db';
import { useData, type AppData } from '../lib/useData';
import { lastLogOf } from '../lib/progression';
import { buildLog } from '../lib/sessionUtils';
import { fmtLoad, fmtLoadFull, fmtNum, fmtReps } from '../lib/units';
import { fmtDate, fmtDateLong } from '../lib/dates';
import { HEAVY_LEG_SETS, legWarning, logLegSets } from '../lib/football';

export default function SessionPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useData();
  const [s, setS] = useState<Session | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [picker, setPicker] = useState(false);
  const [finish, setFinish] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [painFor, setPainFor] = useState<string | null>(null);
  const [legDismissed, setLegDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    db.sessions.get(Number(id)).then((x) => setS(x ?? null));
  }, [id]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  // schermo sempre acceso durante la seduta
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* non supportato */ }
    };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release?.(); };
  }, []);

  const persist = (next: Session) => {
    setS(next);
    db.sessions.put(next);
  };

  if (!data || !s) return null;
  const isLive = s.status === 'in_progress' && s.startedAt;
  const elapsedMin = s.startedAt ? Math.floor((now - s.startedAt) / 60000) : null;

  const updateLog = (uid: string, patch: Partial<ExerciseLog>) =>
    persist({ ...s, exercises: s.exercises.map((e) => (e.uid === uid ? { ...e, ...patch } : e)) });

  const history = data.sessions.filter((x) => x.id !== s.id && x.date <= s.date);
  const legReason = legWarning(s.date, data.matches);
  const showLeg = !legDismissed && legReason && s.kind !== 'MIN' && logLegSets(s.exercises) >= HEAVY_LEG_SETS && s.status === 'in_progress';

  const startRest = (log: ExerciseLog) => {
    primeAudio();
    setTimer({ endAt: Date.now() + log.restSec * 1000, total: log.restSec, label: log.name });
  };

  const addExercise = async (exId: number) => {
    setPicker(false);
    const ex = data.exById.get(exId)!;
    const log = await buildLog(ex, s.date, undefined, history);
    persist({ ...s, exercises: [...s.exercises, log] });
  };

  const substitute = async (uid: string, exId: number, forPain = true) => {
    const ex = data.exById.get(exId)!;
    const log = await buildLog(ex, s.date, undefined, history);
    const idx = s.exercises.findIndex((e) => e.uid === uid);
    const old = s.exercises[idx];
    const untouched = forPain ? false : old.sets.every((x) => !x.done);
    const exercises = untouched
      ? s.exercises.filter((e) => e.uid !== uid)
      : s.exercises.map((e) => (e.uid === uid ? { ...e, stopped: true, pain: forPain ? true : e.pain } : e));
    if (untouched) exercises.splice(idx, 0, log);
    else exercises.splice(idx + 1, 0, log);
    exercises.splice(idx + 1, 0, log);
    persist({ ...s, exercises });
    setPainFor(null);
    toast(`Sostituito con ${ex.name}`);
  };

  return (
    <div className="pb-40">
      <Header
        title={KIND_LABEL[s.kind]}
        back="/"
        right={
          <div className="text-right pr-2">
            {elapsedMin !== null && s.status === 'in_progress' ? (
              <div className="text-sm tabular"><span className="text-muted">tempo</span> <b>{elapsedMin}′</b></div>
            ) : (
              <div className="text-xs text-muted">{fmtDate(s.date)}</div>
            )}
          </div>
        }
      />
      <div className="p-4 space-y-3">
        {!isLive && <p className="text-sm text-muted">{s.status === 'done' ? 'Stai modificando una seduta salvata' : 'Seduta registrata a posteriori'} · {fmtDateLong(s.date)}</p>}
        {isLive && elapsedMin !== null && elapsedMin >= 45 && (
          <Card className="border-accent/50">
            <p className="text-sm">Sei a {elapsedMin} minuti. La seduta ideale sta sotto i 45: chiudi qui senza rimpianti, il resto è per la prossima volta.</p>
          </Card>
        )}
        {showLeg && (
          <Card className="border-minima/60">
            <p className="font-semibold text-minima mb-1">Gambe pesanti sconsigliate oggi</p>
            <p className="text-sm text-muted mb-3">{legReason} Meglio fare solo la parte alta e arrivare fresco in campo.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="minima" onClick={() => { persist({ ...s, exercises: s.exercises.filter((e) => e.group !== 'gambe') }); toast('Esercizi di gambe tolti'); }}>Togli le gambe</Button>
              <Button onClick={() => setLegDismissed(true)}>Tengo così</Button>
            </div>
          </Card>
        )}

        {s.exercises.length === 0 && (
          <Card><p className="text-muted">Nessun esercizio. Aggiungine uno qui sotto.</p></Card>
        )}

        {s.exercises.map((log) => (
          <ExerciseCard
            key={log.uid}
            log={log}
            data={data}
            history={history}
            sessionDate={s.date}
            onChange={(p) => updateLog(log.uid, p)}
            onRemove={() => persist({ ...s, exercises: s.exercises.filter((e) => e.uid !== log.uid) })}
            onRest={() => startRest(log)}
            onSetDone={() => startRest(log)}
            onPain={() => setPainFor(log.uid)}
            onSubstitute={(exId) => substitute(log.uid, exId, false)}
          />
        ))}

        <Button big className="w-full" onClick={() => setPicker(true)}>+ Aggiungi esercizio</Button>

        <Field label="Note generali sulla seduta">
          <NotesBox value={s.notes} onSave={(notes) => persist({ ...s, notes })} />
        </Field>

        <Button big variant="primary" className="w-full" onClick={() => setFinish(true)}>
          {s.status === 'done' ? 'Salva modifiche' : 'Fine seduta'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setDiscard(true)}>Elimina seduta</Button>
      </div>

      <RestTimer timer={timer} onChange={setTimer} />
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />
      <PainSheet log={s.exercises.find((e) => e.uid === painFor) ?? null} data={data} onClose={() => setPainFor(null)} onSubstitute={substitute}
        onStop={(uid) => { updateLog(uid, { stopped: true, pain: true }); setPainFor(null); }} />
      <FinishSheet open={finish} session={s} elapsedMin={elapsedMin} onClose={() => setFinish(false)}
        onSave={async (patch) => {
          const wasDone = s.status === 'done';
          const next: Session = { ...s, ...patch, status: 'done', endedAt: s.endedAt ?? Date.now() };
          await db.sessions.put(next);
          await syncDerived();
          setFinish(false);
          if (wasDone) { toast('Modifiche salvate'); nav(-1); } else nav(`/fatta/${s.id}`, { replace: true });
        }} />
      <Confirm open={discard} onClose={() => setDiscard(false)} danger title="Eliminare la seduta?" confirmLabel="Elimina"
        text="La seduta verrà cancellata e non conterà nel barattolo."
        onConfirm={async () => { await db.sessions.delete(s.id!); nav('/', { replace: true }); }} />
    </div>
  );
}

function NotesBox({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value]);
  return <textarea className={`${inputCls} py-2 min-h-[72px]`} value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={() => t !== value && onSave(t)} />;
}

function ExerciseCard({ log, data, history, sessionDate, onChange, onRemove, onRest, onSetDone, onPain, onSubstitute }: {
  log: ExerciseLog; data: AppData; history: Session[]; sessionDate: string;
  onChange: (p: Partial<ExerciseLog>) => void; onRemove: () => void; onRest: () => void; onSetDone: () => void; onPain: () => void;
  onSubstitute: (exId: number) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [plates, setPlates] = useState(false);
  const subEx = data.exById.get(log.exerciseId);
  const subs = subEx ? substitutesFor(subEx, data.exercises, availableEquip(data.settings)) : [];
  const stalled = log.target?.kind === 'deload' || log.target?.advice === 'substitute';
  const prev = useMemo(() => lastLogOf(history.filter((h) => h.date <= sessionDate), log.exerciseId), [history, sessionDate, log.exerciseId]);
  const allDone = log.sets.length > 0 && log.sets.every((x) => x.done);
  const [open, setOpen] = useState(!allDone);
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) setOpen(false);
    wasDone.current = allDone;
  }, [allDone]);

  const step = log.stackStep || log.increment || 1;
  const t = log.target;
  const setSet = (i: number, patch: Partial<ExerciseLog['sets'][number]>) => onChange({ sets: log.sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const summary = (sets: ExerciseLog['sets'], ex: Pick<ExerciseLog, 'type' | 'unit' | 'isBarbell' | 'barWeight' | 'stackStep' | 'perHand' | 'bodyweight'>) => {
    if (!sets.length) return '—';
    const same = sets.every((x) => x.reps === sets[0].reps && x.load === sets[0].load);
    if (same) return `${sets.length}×${fmtReps(ex, sets[0].reps)}${fmtLoad(ex, sets[0].load) ? ` · ${fmtLoad(ex, sets[0].load)}` : ''}`;
    return sets.map((x) => `${fmtReps(ex, x.reps)}${x.load ? `@${fmtNum(x.load, 2)}` : ''}`).join(', ') + ` ${ex.type === 'time' ? '' : ex.unit}`;
  };

  return (
    <Card className={`${log.pain ? 'border-danger/60' : allDone ? 'border-accent/40' : ''} ${log.stopped ? 'opacity-70' : ''}`}>
      <button className="w-full text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 mt-0.5 ${allDone ? 'bg-accent text-black' : 'border-2 border-line'}`}>{allDone ? '✓' : ''}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg leading-tight">{log.name}</div>
            <div className="text-xs text-muted">{GROUP_LABEL[log.group]} · fascia {log.repMin}-{log.repMax}{log.type === 'time' ? '"' : ''} · recupero {log.restSec}"</div>
            {log.stopped && <div className="text-xs text-danger mt-1">Interrotto per dolore</div>}
          </div>
          <span className="text-muted text-xl">{open ? '–' : '+'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="bg-surface2 rounded-xl p-2">
              <div className="text-[11px] uppercase text-muted">Ultima volta</div>
              <div className="font-semibold">{prev ? summary(prev.log.sets, prev.log) : 'mai fatto'}</div>
              {prev && <div className="text-[11px] text-muted">{fmtDate(prev.session.date)}{prev.log.rir !== null ? ` · RIR ${prev.log.rir}` : ''}{prev.log.pain ? ' · dolore' : ''}</div>}
            </div>
            <div className="bg-accent/10 border border-accent/30 rounded-xl p-2">
              <div className="text-[11px] uppercase text-accent">Obiettivo oggi</div>
              <div className="font-semibold">{t ? summary(Array.from({ length: t.sets }, () => ({ reps: t.reps, load: t.load, done: false })), log) : '—'}</div>
            </div>
          </div>
          {stalled && <span className="inline-block text-xs font-bold uppercase tracking-wide bg-minima/20 text-minima rounded-full px-2 py-1 mb-2">In stallo</span>}
          {t && <p className={`text-sm mb-3 ${t.advice ? 'text-minima' : 'text-muted'}`}>{t.message}</p>}
          {t?.advice && subs.length > 0 && !log.sets.some((x) => x.done) && (
            <div className="mb-3">
              <div className="text-xs text-muted mb-1">Varianti fattibili con la tua attrezzatura (solo per oggi):</div>
              <div className="flex flex-wrap gap-2">
                {subs.map((x) => <Button key={x!.id} className="text-sm" onClick={() => onSubstitute(x!.id!)}>{x!.name}</Button>)}
              </div>
            </div>
          )}
          {log.cues.length > 0 && (
            <ul className="text-sm mb-3 space-y-1">
              {log.cues.map((c, i) => <li key={i} className="flex gap-2"><span className="text-accent">›</span>{c}</li>)}
            </ul>
          )}

          {log.isBarbell && (
            <div className="mb-3">
              <Field label={`Peso bilanciere (${log.unit}), si somma ai dischi`} hint={log.barWeight ? undefined : 'Inseriscilo una volta: viene salvato nell’esercizio.'}>
                <NumInput value={log.barWeight} placeholder="da inserire" onChange={(v) => {
                  onChange({ barWeight: v });
                  db.exercises.update(log.exerciseId, { barWeight: v });
                  const barId = data.exById.get(log.exerciseId)?.barId;
                  if (barId) setSetting('bars', data.settings.bars.map((b) => (b.id === barId ? { ...b, weight: v } : b)));
                }} />
              </Field>
              {log.unit === 'kg' && <Button className="w-full -mt-1" onClick={() => setPlates(true)}>🏋️ Calcolatore dischi</Button>}
            </div>
          )}
          {plates && (
            <PlateCalc open onClose={() => setPlates(false)} settings={data.settings} barWeight={log.barWeight}
              current={(log.sets.find((x) => !x.done) ?? log.sets[log.sets.length - 1])?.load ?? 0}
              onUse={(v) => { onChange({ sets: log.sets.map((x) => (x.done ? x : { ...x, load: v })) }); toast('Carico inserito nelle serie da fare'); }} />
          )}

          <div className="space-y-2">
            {log.sets.map((set, i) => (
              <div key={i} className={`flex items-center gap-1.5 rounded-2xl p-1.5 ${set.done ? 'bg-accent/10' : 'bg-bg'}`}>
                <div className="w-5 text-center text-muted text-sm">{i + 1}</div>
                <Stepper value={set.reps} step={log.type === 'time' ? 5 : 1} label={log.type === 'time' ? 'sec' : 'rip'} width="w-10" onChange={(v) => setSet(i, { reps: v })} />
                {!(log.type === 'time') && (
                  <Stepper value={set.load} step={step} label={log.unit} width="w-12" onChange={(v) => setSet(i, { load: v })} />
                )}
                <button
                  aria-label={`Serie ${i + 1} fatta`}
                  className={`ml-auto w-14 h-14 rounded-2xl text-2xl font-bold shrink-0 ${set.done ? 'bg-accent text-black' : 'bg-surface2 border border-line text-muted'}`}
                  onClick={() => {
                    const done = !set.done;
                    setSet(i, { done });
                    if (done) onSetDone();
                  }}
                >✓</button>
              </div>
            ))}
          </div>
          {log.type !== 'time' && log.sets[0] && (
            <p className="text-xs text-muted mt-2">{fmtLoadFull(log, log.sets[log.sets.length - 1].load)}</p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button onClick={() => onChange({ sets: [...log.sets, { ...(log.sets[log.sets.length - 1] ?? { reps: log.repMin, load: 0 }), done: false }] })}>+ Serie</Button>
            <Button disabled={!log.sets.length} onClick={() => onChange({ sets: log.sets.slice(0, -1) })}>− Serie</Button>
            <Button onClick={onRest}>⏱ {log.restSec}"</Button>
          </div>

          <div className="mt-4">
            <div className="text-sm text-muted mb-1">RIR: ripetizioni che avevi ancora in canna</div>
            <Chips options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={log.rir} onChange={(v) => onChange({ rir: v === log.rir ? null : v })} />
            {log.rir !== null && log.rir < 2 && <p className="text-xs text-minima mt-1">Sotto 2 sei vicino al limite: la prossima volta stesso obiettivo, con più margine.</p>}
          </div>

          <button
            className={`mt-4 w-full min-h-[52px] rounded-2xl border font-semibold ${log.pain ? 'bg-danger text-black border-danger' : 'border-danger/40 text-danger'}`}
            onClick={() => (log.pain ? onChange({ pain: false, stopped: false }) : (onChange({ pain: true }), onPain()))}
          >
            {log.pain ? 'Dolore segnato (tocca per togliere)' : 'Sento dolore (non indolenzimento)'}
          </button>

          <div className="mt-3">
            <NotesBox value={log.notes} placeholder="Note sull’esercizio" onSave={(notes) => onChange({ notes })} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="primary" onClick={() => { onChange({ sets: log.sets.map((x) => ({ ...x, done: true })) }); }}>Esercizio fatto</Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>Togli esercizio</Button>
          </div>
        </div>
      )}
      <Confirm open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Togliere l’esercizio?" text={`${log.name} verrà tolto da questa seduta.`} confirmLabel="Togli" danger onConfirm={onRemove} />
    </Card>
  );
}

function PainSheet({ log, data, onClose, onSubstitute, onStop }: {
  log: ExerciseLog | null; data: AppData; onClose: () => void; onSubstitute: (uid: string, exId: number) => void; onStop: (uid: string) => void;
}) {
  if (!log) return null;
  const ex = data.exById.get(log.exerciseId);
  const subs = ex ? substitutesFor(ex, data.exercises, availableEquip(data.settings)) : [];
  return (
    <Sheet open onClose={onClose} title="Ferma questo esercizio">
      <p className="mb-3">Il dolore è un segnale, non un ostacolo da superare. Oggi <b>{log.name}</b> finisce qui, e la prossima volta non ci sarà progressione.</p>
      {subs.length > 0 && (
        <>
          <p className="text-sm text-muted mb-2">Puoi sostituirlo con un esercizio che non ti dia fastidio:</p>
          <div className="grid gap-2 mb-3">
            {subs.map((x) => <Button key={x!.id} onClick={() => onSubstitute(log.uid, x!.id!)}>{x!.name}</Button>)}
          </div>
        </>
      )}
      <Button variant="danger" className="w-full mb-3" onClick={() => onStop(log.uid)}>Lo fermo e basta</Button>
      <p className="text-sm text-muted">Se il dolore continua nei prossimi giorni o ritorna ogni volta, senti un medico o un fisioterapista.</p>
    </Sheet>
  );
}

function FinishSheet({ open, session, elapsedMin, onClose, onSave }: {
  open: boolean; session: Session; elapsedMin: number | null; onClose: () => void; onSave: (p: Partial<Session>) => void;
}) {
  const [dur, setDur] = useState<number | null>(session.durationMin ?? elapsedMin);
  const [feeling, setFeeling] = useState<number | null>(session.feeling);
  const [notes, setNotes] = useState(session.notes);
  useEffect(() => {
    if (open) {
      setDur(session.durationMin ?? (elapsedMin !== null ? Math.max(1, elapsedMin) : null));
      setFeeling(session.feeling);
      setNotes(session.notes);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = session.exercises.reduce((a, e) => a + e.sets.filter((x) => !x.done).length, 0);
  return (
    <Sheet open={open} onClose={onClose} title="Fine seduta">
      {pending > 0 && <p className="text-sm text-muted mb-3">{pending} serie non spuntate: restano segnate come non fatte. Va bene così, conta esserci stato.</p>}
      <Field label="Durata (minuti)">
        <NumInput value={dur} onChange={setDur} placeholder="es. 35" />
      </Field>
      <div className="mb-3">
        <span className="block text-sm text-muted mb-1">Come ti sentivi? (1 = a pezzi, 5 = alla grande)</span>
        <Chips options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={feeling} onChange={setFeeling} />
      </div>
      <Field label="Note generali">
        <textarea className={`${inputCls} py-2 min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button big variant="primary" className="w-full" onClick={() => onSave({ durationMin: dur, feeling, notes })}>Salva seduta</Button>
    </Sheet>
  );
}
