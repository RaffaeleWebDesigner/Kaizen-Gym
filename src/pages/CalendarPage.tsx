import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Header, Sheet, toast } from '../components/ui';
import { db, KIND_LABEL, type SessionKind } from '../db';
import { useData, type AppData } from '../lib/useData';
import { addDays, DAY_SHORT_LIST, fmtDateLong, mondayOf, monthName, todayISO, toISO } from '../lib/dates';
import { trainingDates } from '../lib/football';
import { createSession } from '../lib/sessionUtils';

function BigX({ small, color }: { small?: boolean; color: string }) {
  const s = small ? 22 : 38;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" className="absolute inset-0 m-auto pointer-events-none" aria-hidden>
      <path d="M7 7 L33 33 M33 7 L7 33" stroke={color} strokeWidth={small ? 5 : 6} strokeLinecap="round" />
    </svg>
  );
}

export function dayInfo(data: AppData, date: string) {
  const sessions = data.sessions.filter((s) => s.date === date && s.status === 'done');
  const marks = data.marks.filter((m) => m.date === date);
  const matches = data.matches.filter((m) => m.date === date);
  const training = trainingDates(date, date, data.settings.trainingWeekday, data.settings.startDate, data.marks).length > 0;
  const trainingCancelled = marks.some((m) => m.type === 'training_cancelled');
  return {
    sessions,
    normal: sessions.some((s) => s.kind !== 'MIN'),
    minima: sessions.some((s) => s.kind === 'MIN'),
    skipped: marks.filter((m) => m.type === 'skipped'),
    sick: marks.filter((m) => m.type === 'sick'),
    matches,
    training,
    trainingCancelled,
  };
}

export default function CalendarPage() {
  const data = useData();
  const today = todayISO();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null);
  if (!data) return null;

  const first = toISO(month);
  const gridStart = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastRowNeeded = days.findIndex((d, i) => i % 7 === 0 && d.slice(0, 7) > first.slice(0, 7));
  const shown = lastRowNeeded > 0 ? days.slice(0, lastRowNeeded) : days;

  const monthDone = data.sessions.filter((s) => s.status === 'done' && s.date.slice(0, 7) === first.slice(0, 7));

  return (
    <div className="pb-nav">
      <Header title="Calendario" />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <button className="w-12 h-12 text-2xl text-muted" aria-label="Mese precedente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <div className="text-center">
            <div className="text-lg font-bold capitalize">{monthName(month.getMonth())} {month.getFullYear()}</div>
            <div className="text-xs text-muted">{monthDone.length} sedute nel mese</div>
          </div>
          <button className="w-12 h-12 text-2xl text-muted" aria-label="Mese successivo" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted mb-1">
          {DAY_SHORT_LIST.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {shown.map((d) => {
            const inMonth = d.slice(0, 7) === first.slice(0, 7);
            const info = dayInfo(data, d);
            return (
              <button
                key={d}
                onClick={() => setSel(d)}
                data-date={d}
                className={`relative aspect-[4/5] rounded-xl border text-left p-1 ${inMonth ? 'bg-surface border-line' : 'bg-transparent border-transparent opacity-40'} ${d === today ? 'ring-2 ring-accent' : ''}`}
              >
                <span className={`text-xs ${d === today ? 'text-accent font-bold' : 'text-muted'}`}>{Number(d.slice(8))}</span>
                {info.normal && <BigX color="#c6ff00" />}
                {!info.normal && info.minima && <BigX small color="#ffb020" />}
                <span className="absolute bottom-0.5 inset-x-0 text-center text-[11px] leading-none">
                  {info.training && '⚽'}
                  {info.matches.length > 0 && '🏟️'}
                  {info.skipped.length > 0 && '❌'}
                  {info.sick.length > 0 && '🤒'}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-y-2">
            <div className="flex items-center gap-2"><span className="text-accent font-black text-lg">✕</span> seduta</div>
            <div className="flex items-center gap-2"><span className="text-minima font-black">✕</span> seduta minima</div>
            {data.settings.sportEnabled && <><div>⚽ allenamento {data.settings.sportName.toLowerCase()}</div><div>🏟️ partita</div></>}
            <div>❌ seduta saltata</div>
            <div>🤒 malattia (giustificata)</div>
          </div>
        </Card>
      </div>
      {sel && <DaySheet date={sel} data={data} onClose={() => setSel(null)} />}
    </div>
  );
}

function DaySheet({ date, data, onClose }: { date: string; data: AppData; onClose: () => void }) {
  const nav = useNavigate();
  const info = dayInfo(data, date);
  const future = date > todayISO();
  const addSession = async (k: SessionKind) => {
    const id = await createSession(k, date, { past: date !== todayISO() });
    nav(`/seduta/${id}`);
  };
  const cancelMark = data.marks.find((m) => m.date === date && m.type === 'training_cancelled');
  return (
    <Sheet open onClose={onClose} title={fmtDateLong(date)}>
      <div className="space-y-2 mb-4">
        {info.sessions.map((s) => (
          <Link key={s.id} to={`/seduta/${s.id}`} className="block">
            <Card className="p-3">
              <div className="flex justify-between">
                <b className={s.kind === 'MIN' ? 'text-minima' : 'text-accent'}>{KIND_LABEL[s.kind]}</b>
                <span className="text-sm text-muted">Dettaglio ›</span>
              </div>
              <div className="text-sm text-muted">
                {s.exercises.map((e) => `${e.name} ${e.sets.filter((x) => x.done).length}×`).join(' · ')}
              </div>
              {(s.durationMin || s.feeling) && <div className="text-xs text-muted mt-1">{s.durationMin ? `${s.durationMin} min` : ''}{s.feeling ? ` · voto ${s.feeling}/5` : ''}</div>}
            </Card>
          </Link>
        ))}
        {info.skipped.map((m) => (
          <Card key={m.id} className="p-3 flex items-start gap-2">
            <span>❌</span>
            <div className="flex-1">
              <div className="font-semibold">Saltata{m.plannedKind ? ` (${KIND_LABEL[m.plannedKind]})` : ''}</div>
              <div className="text-sm text-muted">{m.reason}</div>
            </div>
            <button className="text-muted text-sm min-h-[40px] px-2" onClick={() => db.dayMarks.delete(m.id!)}>Togli</button>
          </Card>
        ))}
        {info.sick.map((m) => (
          <Card key={m.id} className="p-3 flex items-center gap-2">
            <span>🤒</span><div className="flex-1 font-semibold">Stop per malattia</div>
            <button className="text-muted text-sm min-h-[40px] px-2" onClick={() => db.dayMarks.delete(m.id!)}>Togli</button>
          </Card>
        ))}
        {info.matches.map((m) => (
          <Card key={m.id} className="p-3 flex items-center gap-2">
            <span>🏟️</span>
            <div className="flex-1 font-semibold">Partita ore {m.time}{m.venue ? `, ${m.venue}` : ''}{m.opponent ? ` · ${m.opponent}` : ''}</div>
            <Link to="/calcio" className="text-accent text-sm">Modifica</Link>
          </Card>
        ))}
        {(info.training || cancelMark) && (
          <Card className="p-3 flex items-center gap-2">
            <span>⚽</span>
            <div className="flex-1 font-semibold">{cancelMark ? 'Allenamento annullato' : 'Allenamento di squadra'}</div>
            <button className="text-muted text-sm min-h-[40px] px-2" onClick={() => (cancelMark ? db.dayMarks.delete(cancelMark.id!) : db.dayMarks.add({ date, type: 'training_cancelled' }))}>
              {cancelMark ? 'Ripristina' : 'Annulla'}
            </button>
          </Card>
        )}
        {!info.sessions.length && !info.skipped.length && !info.sick.length && !info.matches.length && !info.training && !cancelMark && (
          <p className="text-muted text-sm">Niente segnato in questo giorno.</p>
        )}
      </div>

      {!future && (
        <>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Aggiungi seduta fatta</div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {(['A', 'B', 'C', 'MIN', 'FREE'] as const).map((k) => (
              <Button key={k} variant={k === 'MIN' ? 'minima' : 'secondary'} className="px-1 text-sm" onClick={() => addSession(k)}>
                {k === 'MIN' ? 'Min' : k === 'FREE' ? 'Libera' : k}
              </Button>
            ))}
          </div>
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        {!future && <Button variant="danger" className="text-sm" onClick={() => nav(`/salta?data=${date}`)}>❌ Saltata</Button>}
        <Button className="text-sm" onClick={async () => { await db.dayMarks.add({ date, type: 'sick', reason: 'Malattia' }); toast('Malattia segnata'); }}>🤒 Malattia</Button>
        {data.settings.sportEnabled && <Button className="text-sm" onClick={() => nav(`/calcio?data=${date}`)}>🏟️ Partita</Button>}
      </div>
    </Sheet>
  );
}
