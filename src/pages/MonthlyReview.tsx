import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Field, Header, inputCls, toast } from '../components/ui';
import { db, type Measurement } from '../db';
import { useData } from '../lib/useData';
import { addDays, diffDays, fmtDate, todayISO } from '../lib/dates';
import { exerciseHistory, weekStats } from '../lib/stats';
import { fmtNum } from '../lib/units';
import { METRICS } from '../lib/metrics';
import { setSetting, type AppSettings } from '../lib/settings';
import { stallReport } from '../lib/derived';

export const BLOCK_DAYS = 28;

export function blockRange(start: string, n: number) {
  const from = addDays(start, BLOCK_DAYS * (n - 1));
  return { from, to: addDays(from, BLOCK_DAYS - 1) };
}

/** Numero del blocco di 4 settimane appena chiuso e non ancora visto, oppure null. */
export function dueMonthly(settings: AppSettings, today: string): number | null {
  const k = Math.floor(diffDays(today, settings.startDate) / BLOCK_DAYS);
  if (k < 1) return null;
  return settings.dismissedMonthly.includes(k) ? null : k;
}

function measureAt(list: Measurement[], date: string): Measurement | null {
  const before = list.filter((m) => m.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  return before[before.length - 1] ?? null;
}

const delta = (a: number | null | undefined, b: number | null | undefined, unit = '') => {
  if (typeof a !== 'number' || typeof b !== 'number') return '—';
  const d = b - a;
  return `${fmtNum(a)} → ${fmtNum(b)}${unit ? ` ${unit}` : ''} (${d > 0 ? '+' : ''}${fmtNum(d)})`;
};

export default function MonthlyReview() {
  const n = Number(useParams().n);
  const data = useData();
  const measures = useLiveQuery(() => db.measurements.toArray(), []);
  const existing = useLiveQuery(() => db.reviews.where('type').equals('monthly').toArray(), []);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (data && !data.settings.dismissedMonthly.includes(n)) setSetting('dismissedMonthly', [...data.settings.dismissedMonthly, n]);
  }, [data, n]);

  if (!data || !measures || !existing) return null;
  const cur = blockRange(data.settings.startDate, n);
  const prev = n > 1 ? blockRange(data.settings.startDate, n - 1) : null;
  const saved = existing.find((r) => r.periodStart === cur.from);

  const weeks = weekStats(data.sessions, data.marks, data.settings.startDate, todayISO(), data.settings.weeklyGoal);
  const inRange = (r: { from: string; to: string } | null) => {
    if (!r) return null;
    const w = weeks.filter((x) => x.monday >= r.from && x.monday <= r.to);
    const done = w.reduce((a, x) => a + x.done, 0);
    const target = w.reduce((a, x) => a + x.target, 0);
    return { done, target, pct: target ? Math.round((Math.min(done, target) / target) * 100) : 100 };
  };
  const cNow = inRange(cur)!;
  const cPrev = inRange(prev);

  const mStart = measureAt(measures, prev ? prev.to : cur.from) ?? measures.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const mEnd = measureAt(measures, cur.to);

  const usedIds = [...new Set(data.sessions.filter((s) => s.status === 'done').flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const loads = usedIds.map((id) => {
    const h = exerciseHistory(data.sessions, id);
    const maxIn = (r: { from: string; to: string } | null) => {
      if (!r) return null;
      const pts = h.filter((p) => p.date >= r.from && p.date <= r.to);
      return pts.length ? Math.max(...pts.map((p) => (data.exById.get(id)?.type === 'time' ? p.maxReps : p.maxKg))) : null;
    };
    return { id, name: data.exById.get(id)?.name ?? '', type: data.exById.get(id)?.type, a: maxIn(prev), b: maxIn(cur) };
  }).filter((x) => x.b !== null || x.a !== null);

  const report = stallReport(data.sessions, data.exById, cur.to < todayISO() ? cur.to : todayISO());

  return (
    <div className="pb-nav">
      <Header title={`Punto del mese ${n}`} back="/revisioni" />
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted">Settimane {fmtDate(cur.from)} – {fmtDate(cur.to)}{prev ? `, a confronto con ${fmtDate(prev.from)} – ${fmtDate(prev.to)}` : ''}.</p>
        <Card>
          <h2 className="font-bold mb-1">Costanza</h2>
          <p className="text-sm">Questo blocco: <b>{cNow.done}</b>/{cNow.target} sedute ({cNow.pct}%)</p>
          {cPrev && <p className="text-sm text-muted">Blocco prima: {cPrev.done}/{cPrev.target} ({cPrev.pct}%)</p>}
        </Card>
        <Card>
          <h2 className="font-bold mb-1">Peso e misure</h2>
          {!mEnd ? <p className="text-sm text-muted">Nessuna misurazione.</p> : (
            <div className="text-sm space-y-0.5">
              {METRICS.filter((m) => typeof mEnd[m.key] === 'number').map((m) => (
                <div key={m.key} className="flex justify-between gap-2"><span className="text-muted">{m.label}</span><span className="tabular text-right">{delta(mStart?.[m.key] as number, mEnd[m.key] as number, m.unit)}</span></div>
              ))}
              {mStart && mStart.id === mEnd.id && <p className="text-xs text-minima pt-1">Una sola misurazione nel periodo: fanne una nuova per il confronto.</p>}
            </div>
          )}
          <p className="text-xs text-muted mt-2">Valori della bilancia = stime: guarda la direzione, non il numero.</p>
        </Card>
        <Card>
          <h2 className="font-bold mb-1">Carichi massimi</h2>
          {loads.length === 0 && <p className="text-sm text-muted">Nessuna seduta nel periodo.</p>}
          {loads.map((l) => (
            <div key={l.id} className="flex justify-between text-sm py-0.5 gap-2">
              <span className="text-muted">{l.name}</span>
              <span className="tabular text-right">{l.a !== null ? (l.type === 'time' ? `${l.a}"` : `${fmtNum(l.a)} kg`) : '—'} → {l.b !== null ? (l.type === 'time' ? `${l.b}"` : `${fmtNum(l.b)} kg`) : '—'}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="font-bold mb-1">In stallo</h2>
          {report.stalled.length === 0 ? <p className="text-sm text-muted">Nessun esercizio in stallo.</p> : report.stalled.map((x) => (
            <div key={x.name} className="text-sm flex justify-between gap-2"><span>{x.name}</span><span className="text-minima">{x.deloadDone ? 'valuta una variante' : 'scarico -10%'}</span></div>
          ))}
          <h2 className="font-bold mb-1 mt-3">Dolore segnalato (ultime 4 settimane)</h2>
          {report.pain.length === 0 ? <p className="text-sm text-muted">Nessuno.</p> : report.pain.map((x) => (
            <div key={x.name} className="text-sm flex justify-between gap-2"><span>{x.name}</span><span className="text-danger">{x.streak ? '2 sedute di fila: sostituisci e senti un medico o un fisioterapista' : `ultima volta ${fmtDate(x.date)}`}</span></div>
          ))}
          <p className="text-xs text-muted mt-2">L’app suggerisce soltanto: la scheda la cambi tu nei modelli.</p>
        </Card>
        <Field label="Una nota per il mese prossimo">
          <textarea className={`${inputCls} py-2 min-h-[80px]`} defaultValue={saved?.note ?? ''} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button big variant="primary" className="w-full" onClick={async () => {
          if (saved) await db.reviews.update(saved.id!, { note });
          else await db.reviews.add({ type: 'monthly', periodStart: cur.from, createdAt: Date.now(), note });
          toast('Punto del mese salvato');
        }}>Salva</Button>
      </div>
    </div>
  );
}
