import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Chips, Field, Header, inputCls, toast } from '../components/ui';
import { db, type Review } from '../db';
import { useData } from '../lib/useData';
import { addDays, diffDays, fmtDate, mondayOf, todayISO } from '../lib/dates';
import { BLOCK_DAYS, blockRange } from './MonthlyReview';
import { weekStats } from '../lib/stats';

export default function ReviewsPage() {
  const data = useData();
  const [sp] = useSearchParams();
  const today = todayISO();
  const defaultWeek = sp.get('settimana') ?? (diffDays(today, mondayOf(today)) >= 5 ? mondayOf(today) : addDays(mondayOf(today), -7));
  const [week, setWeek] = useState(defaultWeek);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const [form, setForm] = useState<Review | null>(null);

  useEffect(() => {
    if (!reviews) return;
    const ex = reviews.find((r) => r.type === 'weekly' && r.periodStart === week);
    setForm(ex ?? { type: 'weekly', periodStart: week, createdAt: Date.now(), worked: '', blocked: '', difficulty: null, change: '' });
  }, [reviews, week]);

  if (!data || !reviews || !form) return null;
  const startMon = mondayOf(data.settings.startDate);
  const weeks = weekStats(data.sessions, data.marks, data.settings.startDate, today, data.settings.weeklyGoal);
  const ws = weeks.find((w) => w.monday === week);
  const blocks = Math.floor(diffDays(today, data.settings.startDate) / BLOCK_DAYS);
  const weekly = reviews.filter((r) => r.type === 'weekly').sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  const save = async () => {
    if (form.id) await db.reviews.put(form);
    else await db.reviews.add(form);
    toast('Revisione salvata');
  };

  return (
    <div className="pb-nav">
      <Header title="Revisioni" back="/altro" />
      <div className="p-4 space-y-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <button className="w-11 h-11 text-xl text-muted disabled:opacity-30" disabled={week <= startMon} onClick={() => setWeek(addDays(week, -7))} aria-label="Settimana precedente">‹</button>
            <div className="text-center">
              <div className="font-bold">Settimana {fmtDate(week)} – {fmtDate(addDays(week, 6))}</div>
              {ws && <div className="text-xs text-muted">{ws.done}/{ws.target} sedute</div>}
            </div>
            <button className="w-11 h-11 text-xl text-muted disabled:opacity-30" disabled={week >= mondayOf(today)} onClick={() => setWeek(addDays(week, 7))} aria-label="Settimana successiva">›</button>
          </div>
          <Field label="Cosa ha funzionato?">
            <textarea className={`${inputCls} py-2`} value={form.worked ?? ''} onChange={(e) => setForm({ ...form, worked: e.target.value })} />
          </Field>
          <Field label="Cosa mi ha bloccato?">
            <textarea className={`${inputCls} py-2`} value={form.blocked ?? ''} onChange={(e) => setForm({ ...form, blocked: e.target.value })} />
          </Field>
          <div className="mb-3">
            <span className="block text-sm text-muted mb-1">Le sedute erano…</span>
            <Chips options={[{ value: 'facile', label: 'Facili' }, { value: 'giusta', label: 'Giuste' }, { value: 'dura', label: 'Dure' }]} value={form.difficulty ?? null} onChange={(d) => setForm({ ...form, difficulty: d as Review['difficulty'] })} />
            {form.difficulty === 'dura' && <p className="text-xs text-minima mt-1">Se erano dure, la prossima settimana tieni più margine. Non serve stringere i denti.</p>}
          </div>
          <Field label="Cosa cambio la settimana prossima? (una cosa piccola)">
            <textarea className={`${inputCls} py-2`} value={form.change ?? ''} onChange={(e) => setForm({ ...form, change: e.target.value })} />
          </Field>
          <Button big variant="primary" className="w-full" onClick={save}>Salva revisione</Button>
        </Card>

        <h2 className="font-bold pt-2">Punto del mese</h2>
        {blocks < 1 ? (
          <p className="text-sm text-muted">Il primo arriva dopo 4 settimane, il {fmtDate(addDays(data.settings.startDate, BLOCK_DAYS))}.</p>
        ) : (
          Array.from({ length: blocks }, (_, i) => blocks - i).map((n) => {
            const r = blockRange(data.settings.startDate, n);
            return (
              <Link key={n} to={`/revisioni/mese/${n}`} className="block">
                <Card className="p-3 flex justify-between"><span>Mese {n}: {fmtDate(r.from)} – {fmtDate(r.to)}</span><span className="text-accent">›</span></Card>
              </Link>
            );
          })
        )}

        {weekly.length > 0 && <h2 className="font-bold pt-2">Revisioni passate</h2>}
        {weekly.map((r) => (
          <button key={r.id} className="w-full text-left" onClick={() => setWeek(r.periodStart)}>
            <Card className="p-3">
              <div className="font-semibold">Settimana {fmtDate(r.periodStart)}{r.difficulty ? ` · ${r.difficulty}` : ''}</div>
              {r.change && <div className="text-sm text-muted">Cambio: {r.change}</div>}
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
