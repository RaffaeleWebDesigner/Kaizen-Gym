import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Chips, Confirm, Field, Header, NumInput, Sheet, inputCls, toast } from '../components/ui';
import { db, type Claim, type ClaimType, type Success } from '../db';
import { useData, type AppData } from '../lib/useData';
import { LABEL_TEXT, verifySuccess, type VerifyData } from '../lib/derived';
import { fmtDateFull, mondayOf, todayISO } from '../lib/dates';

const CAT_LABEL: Record<Success['category'], string> = { palestra: '🏋️ Palestra', calcio: '⚽ Calcio', vita: '🌱 Vita' };

export function useVerifyData(data: AppData | undefined): VerifyData | null {
  const attempts = useLiveQuery(() => db.challengeAttempts.toArray(), []);
  const challenges = useLiveQuery(() => db.challenges.toArray(), []);
  const measures = useLiveQuery(() => db.measurements.toArray(), []);
  if (!data || !attempts || !challenges || !measures) return null;
  return { sessions: data.sessions, marks: data.marks, attempts, challenges, exById: data.exById, settings: data.settings, measures };
}

export function SuccessCard({ s, vd, onClick }: { s: Success; vd: VerifyData; onClick?: () => void }) {
  const v = verifySuccess(s, vd);
  return (
    <button className="w-full text-left" onClick={onClick}>
      <Card className={v.label === 'unconfirmed' ? 'border-minima/50' : ''}>
        <div className="flex justify-between gap-2">
          <div className="font-semibold">{s.title}</div>
          <span className="text-xs text-muted shrink-0">{fmtDateFull(s.date)}</span>
        </div>
        {s.description && <p className="text-sm text-muted">{s.description}</p>}
        <div className="flex gap-2 items-center mt-1 text-xs">
          <span className={v.label === 'verified' ? 'text-accent' : v.label === 'unconfirmed' ? 'text-minima' : 'text-muted'}>{LABEL_TEXT[v.label]}</span>
          <span className="text-muted">· {CAT_LABEL[s.category]}</span>
        </div>
        {v.verdict && <p className="text-sm text-minima mt-1">{v.verdict}</p>}
      </Card>
    </button>
  );
}

export default function SuccessesPage() {
  const data = useData();
  const vd = useVerifyData(data);
  const list = useLiveQuery(() => db.successes.orderBy('date').reverse().toArray(), []);
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<Success | null>(null);
  const [del, setDel] = useState<Success | null>(null);
  if (!data || !vd || !list) return null;

  const openJar = () => {
    if (!list.length) return toast('Il barattolo è ancora vuoto');
    let pick = list[Math.floor(Math.random() * list.length)];
    if (open && list.length > 1) while (pick.id === open.id) pick = list[Math.floor(Math.random() * list.length)];
    setOpen(pick);
  };

  return (
    <div className="pb-nav">
      <Header title="Barattolo dei successi" back />
      <div className="p-4 space-y-3">
        <Card className="text-center">
          <div className="text-5xl font-black text-accent">{list.length}</div>
          <div className="text-sm text-muted">successi nel barattolo</div>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button big variant="primary" onClick={openJar}>Apri il barattolo</Button>
          <Button big onClick={() => setAdd(true)}>+ Aggiungi</Button>
        </div>
        <p className="text-xs text-muted">Onestà brutale: i successi di allenamento vengono confrontati con il registro. Record, sfide e promozioni entrano da soli, già verificati.</p>
        {list.map((s) => <SuccessCard key={s.id} s={s} vd={vd} onClick={() => s.source === 'manual' && setDel(s)} />)}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] bg-bg/95 flex flex-col items-center justify-center p-6" role="dialog">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-bold mb-3">Dal barattolo</div>
          <div className="w-full max-w-md"><SuccessCard s={open} vd={vd} /></div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-6">
            <Button big onClick={openJar}>Un altro</Button>
            <Button big variant="primary" onClick={() => setOpen(null)}>Chiudi</Button>
          </div>
        </div>
      )}
      {add && <AddSheet data={data} vd={vd} onClose={() => setAdd(false)} />}
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Eliminare questo successo?" text={del?.title} confirmLabel="Elimina" onConfirm={() => db.successes.delete(del!.id!)} />
    </div>
  );
}

function AddSheet({ data, vd, onClose }: { data: AppData; vd: VerifyData; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Success['category']>('palestra');
  const [type, setType] = useState<ClaimType | 'nessuno'>('nessuno');
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [load, setLoad] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<number | null>(4);
  const [pct, setPct] = useState<number | null>(100);

  const used = [...new Set(data.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const claim: Claim | null =
    category !== 'palestra' || type === 'nessuno' ? null
    : type === 'record' ? { type, exerciseId: exerciseId ?? used[0], load: load ?? 0, reps: reps ?? 0 }
    : type === 'settimana' ? { type, weekStart: mondayOf(weekStart) }
    : type === 'sfida' ? { type, challengeId: challengeId ?? vd.challenges[0]?.id }
    : { type, weeks: weeks ?? 4, pct: pct ?? 100 };
  const draft: Success = { date, title, description, category, claim, source: 'manual', createdAt: Date.now() };
  const preview = title.trim() ? verifySuccess(draft, vd) : null;

  return (
    <Sheet open onClose={onClose} title="Nuovo successo">
      <Field label="Titolo"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Descrizione"><textarea className={`${inputCls} py-2`} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Data"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Categoria">
        <Chips options={(Object.keys(CAT_LABEL) as Success['category'][]).map((c) => ({ value: c, label: CAT_LABEL[c] }))} value={category} onChange={setCategory} />
      </Field>
      {category === 'palestra' && (
        <Field label="Riguarda…" hint="Se scegli un tipo, l’app lo confronta con il registro.">
          <Chips options={[{ value: 'nessuno', label: 'Altro' }, { value: 'record', label: 'Record' }, { value: 'settimana', label: 'Settimana perfetta' }, { value: 'sfida', label: 'Sfida' }, { value: 'costanza', label: 'Costanza' }]} value={type} onChange={(v) => setType(v as ClaimType | 'nessuno')} />
        </Field>
      )}
      {category === 'palestra' && type === 'record' && (
        <>
          <Field label="Esercizio">
            <select className={inputCls} value={exerciseId ?? used[0] ?? ''} onChange={(e) => setExerciseId(Number(e.target.value))}>
              {used.map((id) => <option key={id} value={id}>{data.exById.get(id)?.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Carico totale (bilanciere compreso)"><NumInput value={load} onChange={setLoad} /></Field>
            <Field label="Ripetizioni / secondi"><NumInput value={reps} onChange={setReps} /></Field>
          </div>
        </>
      )}
      {category === 'palestra' && type === 'settimana' && (
        <Field label="Un giorno della settimana"><input type="date" className={inputCls} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></Field>
      )}
      {category === 'palestra' && type === 'sfida' && (
        <Field label="Sfida">
          <select className={inputCls} value={challengeId ?? vd.challenges[0]?.id ?? ''} onChange={(e) => setChallengeId(Number(e.target.value))}>
            {vd.challenges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {category === 'palestra' && type === 'costanza' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ultime N settimane"><NumInput value={weeks} onChange={setWeeks} /></Field>
          <Field label="Costanza (%)"><NumInput value={pct} onChange={setPct} /></Field>
        </div>
      )}
      {preview && (
        <p className={`text-sm mb-2 ${preview.label === 'unconfirmed' ? 'text-minima' : preview.label === 'verified' ? 'text-accent' : 'text-muted'}`}>
          {LABEL_TEXT[preview.label]}{preview.verdict ? `: ${preview.verdict}` : ''}
        </p>
      )}
      <Button big variant="primary" className="w-full" disabled={!title.trim()} onClick={async () => {
        await db.successes.add({ ...draft, title: title.trim(), createdAt: Date.now() });
        toast('Nel barattolo');
        onClose();
      }}>Metti nel barattolo</Button>
    </Sheet>
  );
}
