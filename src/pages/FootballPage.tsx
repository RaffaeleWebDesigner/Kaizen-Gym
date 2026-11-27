import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Chips, Field, Header, Sheet, inputCls, toast } from '../components/ui';
import { db, type Match } from '../db';
import { useData } from '../lib/useData';
import { addDays, dayName, DAY_SHORT_LIST, fmtDate, fmtDateLong, mondayOf, todayISO, weekdayMon } from '../lib/dates';
import { suggestWeek, trainingDates } from '../lib/football';
import { setSetting } from '../lib/settings';

const defaultTime = (date: string) => ({ 4: '21:00', 5: '14:00', 0: '21:00' } as Record<number, string>)[weekdayMon(date)] ?? '21:00';

function nextFriday(from: string) {
  let d = from;
  while (weekdayMon(d) !== 4) d = addDays(d, 1);
  return d;
}

export default function FootballPage() {
  const data = useData();
  const [sp] = useSearchParams();
  const [edit, setEdit] = useState<Match | null>(() => (sp.get('data') ? { date: sp.get('data')!, time: defaultTime(sp.get('data')!), venue: null } : null));
  if (!data) return null;
  const today = todayISO();
  const upcoming = data.matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = data.matches.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));

  const weeks = [mondayOf(today), addDays(mondayOf(today), 7)];

  return (
    <div className="pb-nav">
      <Header title="Calcio e pianificazione" back="/altro" />
      <div className="p-4 space-y-3">
        <Button big variant="primary" className="w-full" onClick={() => { const d = nextFriday(today); setEdit({ date: d, time: defaultTime(d), venue: null }); }}>+ Aggiungi partita</Button>

        {weeks.map((mon, i) => {
          const trainings = trainingDates(mon, addDays(mon, 6), data.settings.trainingWeekday, data.settings.startDate, data.marks);
          const sug = suggestWeek(mon, data.matches, trainings, i === 0 ? today : mon, 3);
          const weekMatches = data.matches.filter((m) => m.date >= mon && m.date <= addDays(mon, 6));
          return (
            <Card key={mon}>
              <div className="font-bold mb-1">{i === 0 ? 'Questa settimana' : 'Prossima settimana'} · {fmtDate(mon)}</div>
              <div className="text-sm text-muted mb-2">
                {weekMatches.length ? weekMatches.map((m) => `🏟️ ${dayName(m.date)} ${m.time}`).join(' · ') : 'Nessuna partita'}
                {trainings.length ? ` · ⚽ ${trainings.map(dayName).join(', ')}` : ''}
              </div>
              {sug.length ? (
                <ul className="space-y-1">
                  {sug.map((s) => (
                    <li key={s.date} className="flex justify-between text-sm">
                      <span className="capitalize font-semibold">{fmtDateLong(s.date)}</span>
                      <span className={s.legsOk ? 'text-accent' : 'text-minima'}>{s.note}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Non restano giorni in questa settimana.</p>
              )}
            </Card>
          );
        })}

        <Card>
          <div className="font-semibold mb-1">Avviso gambe pesanti</div>
          <p className="text-sm text-muted">Ti avviso se stai per fare gambe pesanti il giorno della partita, il giorno prima, oppure martedì o giovedì in una settimana con partita il venerdì. Ti propongo la parte alta.</p>
        </Card>

        <h2 className="font-bold pt-2">Partite in arrivo</h2>
        {upcoming.length === 0 && <p className="text-muted text-sm">Nessuna partita in programma.</p>}
        {upcoming.map((m) => <MatchRow key={m.id} m={m} onEdit={() => setEdit(m)} />)}

        <Card>
          <div className="font-semibold mb-2">Allenamento di squadra ricorrente</div>
          <Chips options={DAY_SHORT_LIST.map((d, i) => ({ value: i, label: d }))} value={data.settings.trainingWeekday} onChange={(v) => setSetting('trainingWeekday', v)} />
          <p className="text-xs text-muted mt-2">Si ripete ogni settimana. Per annullarne uno, toccalo nel calendario.</p>
        </Card>

        {past.length > 0 && (
          <>
            <h2 className="font-bold pt-2">Partite giocate</h2>
            {past.map((m) => <MatchRow key={m.id} m={m} onEdit={() => setEdit(m)} />)}
          </>
        )}
      </div>
      {edit && <MatchSheet match={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MatchRow({ m, onEdit }: { m: Match; onEdit: () => void }) {
  return (
    <button className="w-full text-left" onClick={onEdit}>
      <Card className="p-3 flex items-center gap-3">
        <span className="text-2xl">🏟️</span>
        <div className="flex-1">
          <div className="font-semibold capitalize">{fmtDateLong(m.date)} · {m.time}</div>
          <div className="text-sm text-muted">{m.venue ?? 'casa/trasferta da indicare'}{m.opponent ? ` · ${m.opponent}` : ''}</div>
        </div>
        <span className="text-muted">›</span>
      </Card>
    </button>
  );
}

function MatchSheet({ match, onClose }: { match: Match; onClose: () => void }) {
  const [m, setM] = useState<Match>(match);
  const save = async () => {
    if (m.id) await db.matches.put(m);
    else await db.matches.add(m);
    toast('Partita salvata');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={m.id ? 'Modifica partita' : 'Nuova partita'}>
      <Field label="Data">
        <input type="date" className={inputCls} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value, time: m.id ? m.time : defaultTime(e.target.value) })} />
      </Field>
      <Field label="Ora">
        <div className="flex gap-2 mb-2">
          <Chips options={[{ value: '21:00', label: '21:00' }, { value: '14:00', label: '14:00' }]} value={m.time} onChange={(t) => setM({ ...m, time: t })} />
        </div>
        <input type="time" className={inputCls} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
      </Field>
      <Field label="Dove">
        <Chips options={[{ value: 'casa', label: 'Casa' }, { value: 'trasferta', label: 'Trasferta' }]} value={m.venue} onChange={(v) => setM({ ...m, venue: v as Match['venue'] })} />
      </Field>
      <Field label="Avversario (facoltativo)">
        <input className={inputCls} value={m.opponent ?? ''} onChange={(e) => setM({ ...m, opponent: e.target.value })} />
      </Field>
      <Button big variant="primary" className="w-full mb-2" onClick={save}>Salva</Button>
      {m.id && <Button variant="danger" className="w-full" onClick={async () => { await db.matches.delete(m.id!); onClose(); }}>Elimina partita</Button>}
    </Sheet>
  );
}
