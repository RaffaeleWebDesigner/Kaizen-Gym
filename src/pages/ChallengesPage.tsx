import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Chips, Field, Header, Sheet, inputCls, toast } from '../components/ui';
import { db, type Challenge, type ChallengeAttempt } from '../db';
import { useData } from '../lib/useData';
import { weekStats } from '../lib/stats';
import { challengeDateProblem, challengeTextProblem, compatibleDates, unlockStatus, UNLOCK_PCT, UNLOCK_WEEKS } from '../lib/challenges';
import { addDays, fmtDate, fmtDateFull, fmtDateLong, todayISO } from '../lib/dates';
import { syncDerived } from '../lib/derived';

export function Medal({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M10 2h5l-3 9H7zM17 2h5l3 9h-5z" fill="#ffb020" />
      <circle cx="16" cy="20" r="10" fill="#c6ff00" />
      <circle cx="16" cy="20" r="6.5" fill="none" stroke="#0a0a0a" strokeWidth="2" />
      <path d="M16 15.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#0a0a0a" />
    </svg>
  );
}

export default function ChallengesPage() {
  const data = useData();
  const challenges = useLiveQuery(() => db.challenges.toArray(), []);
  const attempts = useLiveQuery(() => db.challengeAttempts.toArray(), []);
  const [plan, setPlan] = useState<Challenge | null>(null);
  const [close, setClose] = useState<ChallengeAttempt | null>(null);
  const [create, setCreate] = useState(false);
  if (!data || !challenges || !attempts) return null;
  const today = todayISO();
  const weeks = weekStats(data.sessions, data.marks, data.settings.startDate, today, data.settings.weeklyGoal);
  const u = unlockStatus(weeks, data.settings.startDate, today);
  const planned = attempts.filter((a) => a.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const closed = attempts.filter((a) => a.status !== 'planned').sort((a, b) => b.date.localeCompare(a.date));
  const nameOf = (id: number) => challenges.find((c) => c.id === id)?.name ?? 'Sfida';

  return (
    <div className="pb-nav">
      <Header title="Sfide dure" back="/altro" />
      <div className="p-4 space-y-3">
        <UnlockCard u={u} />
        <Card className="text-sm text-muted">
          Dure ma sicure: tecnica pulita, niente cedimento, ci si ferma col dolore. Massimo una ogni 3-4 settimane, mai nelle 48 ore prima di una partita né il giorno dopo.
        </Card>

        {planned.length > 0 && <h2 className="font-bold pt-1">In programma</h2>}
        {planned.map((a) => (
          <Card key={a.id} className="border-accent/50">
            <div className="font-semibold">{nameOf(a.challengeId)}</div>
            <div className="text-sm text-muted capitalize">{challenges.find((c) => c.id === a.challengeId)?.duration === 'week' ? `settimana del ${fmtDate(a.date)}` : fmtDateLong(a.date)}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button variant="primary" disabled={a.date > today} onClick={() => setClose(a)}>Com’è andata</Button>
              <Button variant="ghost" onClick={async () => { await db.challengeAttempts.delete(a.id!); toast('Sfida tolta dal programma'); }}>Annulla</Button>
            </div>
          </Card>
        ))}

        <div className="flex justify-between items-center pt-1">
          <h2 className="font-bold">Sfide</h2>
          <button className="text-accent min-h-[44px] px-2" onClick={() => setCreate(true)}>+ Crea la tua</button>
        </div>
        {challenges.filter((c) => !c.archived).map((c) => (
          <Card key={c.id}>
            <div className="flex justify-between gap-2">
              <div className="font-semibold">{c.name}</div>
              <span className="text-xs text-muted shrink-0">{c.duration === 'week' ? `${c.spanWeeks ?? 1} ${(c.spanWeeks ?? 1) > 1 ? 'settimane' : 'settimana'}` : '1 giorno'}</span>
            </div>
            <p className="text-sm text-muted mt-1">{c.description}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(() => {
                const early = !!c.minWeeks && u.weeksDone < c.minWeeks;
                return <Button disabled={!u.unlocked || early} onClick={() => setPlan(c)}>{!u.unlocked ? '🔒 Bloccata' : early ? `🔒 Dalla settimana ${c.minWeeks}` : 'Programma'}</Button>;
              })()}
              {!c.builtin && <Button variant="ghost" onClick={() => db.challenges.update(c.id!, { archived: true })}>Archivia</Button>}
            </div>
          </Card>
        ))}

        {closed.length > 0 && <h2 className="font-bold pt-1">Storico</h2>}
        {closed.map((a) => (
          <Card key={a.id} className="flex gap-3 items-start">
            {a.status === 'completed' ? <Medal /> : <span className="text-2xl">·</span>}
            <div className="flex-1">
              <div className="font-semibold">{nameOf(a.challengeId)}</div>
              <div className="text-xs text-muted">{fmtDateFull(a.date)} · {a.status === 'completed' ? 'completata' : 'non completata, nessuna penalità'}</div>
              {a.note && <p className="text-sm mt-1">{a.note}</p>}
            </div>
          </Card>
        ))}
      </div>

      {plan && <PlanSheet c={plan} attempts={attempts} matches={data.matches} onClose={() => setPlan(null)} />}
      {close && <CloseSheet a={close} name={nameOf(close.challengeId)} onClose={() => setClose(null)} />}
      {create && <CreateSheet onClose={() => setCreate(false)} />}
    </div>
  );
}

export function UnlockCard({ u, compact }: { u: ReturnType<typeof unlockStatus>; compact?: boolean }) {
  if (u.unlocked) return compact ? null : <Card className="border-accent/50"><p className="font-semibold text-accent">Sfide sbloccate</p><p className="text-sm text-muted">Te le sei guadagnate con la costanza.</p></Card>;
  const wPct = Math.min(100, (u.weeksDone / UNLOCK_WEEKS) * 100);
  const cPct = Math.min(100, (u.pct / UNLOCK_PCT) * 100);
  return (
    <Card>
      <div className="font-semibold mb-2">🔒 Sfide dure: a che punto sei</div>
      <div className="text-sm flex justify-between"><span>Settimane dall’inizio</span><b>{Math.min(u.weeksDone, UNLOCK_WEEKS)}/{UNLOCK_WEEKS}</b></div>
      <div className="h-2 bg-line rounded-full overflow-hidden mb-2"><div className={`h-full ${u.weeksOk ? 'bg-accent' : 'bg-muted'}`} style={{ width: `${wPct}%` }} /></div>
      <div className="text-sm flex justify-between"><span>Costanza ultime 4 settimane</span><b>{u.pct}% / {UNLOCK_PCT}%</b></div>
      <div className="h-2 bg-line rounded-full overflow-hidden"><div className={`h-full ${u.pctOk ? 'bg-accent' : 'bg-muted'}`} style={{ width: `${cPct}%` }} /></div>
      {!compact && <p className="text-xs text-muted mt-2">Si sbloccano dal {fmtDateFull(u.unlockFrom)} in poi, se nelle 4 settimane precedenti hai fatto almeno l’80% delle sedute previste.</p>}
    </Card>
  );
}

function PlanSheet({ c, attempts, matches, onClose }: { c: Challenge; attempts: ChallengeAttempt[]; matches: Parameters<typeof compatibleDates>[2]; onClose: () => void }) {
  const today = todayISO();
  const options = compatibleDates(today, c.duration, matches, attempts, 8);
  const [date, setDate] = useState(options[0] ?? today);
  const problem = challengeDateProblem(date, c.duration, matches, attempts);
  return (
    <Sheet open onClose={onClose} title={`Programma: ${c.name}`}>
      <p className="text-sm text-muted mb-2">Date compatibili con partite e allenamenti:</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map((d) => (
          <button key={d} onClick={() => setDate(d)} className={`min-h-[44px] px-3 rounded-full border text-sm ${d === date ? 'bg-accent text-black border-accent font-semibold' : 'bg-surface2 border-line'}`}>
            {c.duration === 'week' ? `sett. ${fmtDate(d)}` : fmtDate(d)}
          </button>
        ))}
        {!options.length && <span className="text-sm text-muted">Nessuna data libera nelle prossime settimane.</span>}
      </div>
      <Field label="Oppure scegli tu">
        <input type="date" min={today} max={addDays(today, 120)} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {problem && <p className="text-sm text-danger mb-2">{problem}</p>}
      <Button big variant="primary" className="w-full" disabled={!!problem} onClick={async () => {
        await db.challengeAttempts.add({ challengeId: c.id!, date, status: 'planned' });
        toast('Sfida in programma');
        onClose();
      }}>Conferma</Button>
    </Sheet>
  );
}

function CloseSheet({ a, name, onClose }: { a: ChallengeAttempt; name: string; onClose: () => void }) {
  const [status, setStatus] = useState<'completed' | 'failed'>('completed');
  const [note, setNote] = useState('');
  return (
    <Sheet open onClose={onClose} title={name}>
      <Chips options={[{ value: 'completed', label: 'Completata' }, { value: 'failed', label: 'Non completata' }]} value={status} onChange={(v) => setStatus(v as 'completed' | 'failed')} />
      <Field label={status === 'completed' ? 'Una nota sulla medaglia' : 'Com’è andata, detto onestamente'}>
        <textarea className={`${inputCls} py-2 mt-2 min-h-[80px]`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {status === 'failed' && <p className="text-sm text-muted mb-2">Nessuna penalità: si registra com’è andata e si va avanti.</p>}
      <Button big variant="primary" className="w-full" onClick={async () => {
        await db.challengeAttempts.update(a.id!, { status, note, closedAt: Date.now() });
        await syncDerived();
        toast(status === 'completed' ? 'Medaglia nel barattolo' : 'Registrata. Avanti.');
        onClose();
      }}>Salva</Button>
    </Sheet>
  );
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<'day' | 'week'>('day');
  const problem = challengeTextProblem(`${name} ${description}`);
  return (
    <Sheet open onClose={onClose} title="Nuova sfida">
      <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Cosa si fa" hint="Dura ma sicura: tecnica pulita, 1-2 ripetizioni di margine, stop col dolore.">
        <textarea className={`${inputCls} py-2 min-h-[90px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Durata">
        <Chips options={[{ value: 'day', label: '1 giorno' }, { value: 'week', label: '1 settimana' }]} value={duration} onChange={(v) => setDuration(v as 'day' | 'week')} />
      </Field>
      {problem && <p className="text-sm text-danger mb-2">{problem}</p>}
      <Button big variant="primary" className="w-full" disabled={!name.trim() || !description.trim() || !!problem} onClick={async () => {
        await db.challenges.add({ name: name.trim(), description: description.trim(), duration, builtin: false });
        toast('Sfida creata');
        onClose();
      }}>Crea sfida</Button>
      <p className="text-xs text-muted mt-2">Le date si scelgono solo tra quelle compatibili con il calcio, come per le altre.</p>
    </Sheet>
  );
}
