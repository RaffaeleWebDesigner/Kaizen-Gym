import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, Field, Header, NumInput, Sheet, inputCls, toast, Confirm } from '../components/ui';
import { db, type Measurement } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../lib/settings';
import { fmtDate, fmtDateFull, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { METRICS, bmiOf, type MetricKey } from '../lib/metrics';
import { syncDerived } from '../lib/derived';

export const chartTooltip = {
  contentStyle: { background: '#1d1d1d', border: '1px solid #2a2a2a', borderRadius: 12, color: '#f4f4f4' },
  labelStyle: { color: '#9a9a9a' },
};

export default function BodyPage() {
  const list = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []);
  const settings = useSettings();
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [edit, setEdit] = useState<Measurement | null>(null);
  if (!list || !settings) return null;
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const m = METRICS.find((x) => x.key === metric)!;
  const series = list.filter((x) => typeof x[metric] === 'number').map((x) => ({ date: fmtDate(x.date), v: x[metric] as number }));

  return (
    <div className="pb-nav">
      <Header title="Misure corporee" />
      <div className="p-4 space-y-3">
        <Button big variant="primary" className="w-full" onClick={() => setEdit({ date: todayISO() })}>+ Nuova misurazione</Button>
        <Card className="border-minima/40">
          <p className="text-sm"><b className="text-minima">Nota:</b> i valori della bilancia (Fitdays, modalità atleta) sono stime. Contano solo come andamento nel tempo, non come numero assoluto.</p>
        </Card>

        {last && (
          <Card>
            <div className="flex justify-between mb-2">
              <span className="font-bold">Ultima: {fmtDateFull(last.date)}</span>
              <span className="text-xs text-muted">altezza {settings.heightCm} cm</span>
            </div>
            <div className="grid grid-cols-1 gap-y-1 text-sm">
              {METRICS.filter((x) => typeof last[x.key] === 'number').map((x) => {
                const v = last[x.key] as number;
                const p = prev?.[x.key];
                const d = typeof p === 'number' ? v - p : null;
                return (
                  <div key={x.key} className="flex justify-between">
                    <span className="text-muted">{x.label}</span>
                    <span className="font-semibold tabular whitespace-nowrap">
                      {fmtNum(v)}{x.unit && ` ${x.unit}`}
                      {d !== null && d !== 0 && <span className="text-xs text-muted"> {d > 0 ? '+' : ''}{fmtNum(d)}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {METRICS.map((x) => (
              <button key={x.key} onClick={() => setMetric(x.key)} className={`shrink-0 min-h-[40px] px-3 rounded-full border text-sm ${metric === x.key ? 'bg-accent text-black border-accent' : 'bg-surface2 border-line'}`}>{x.label}</button>
            ))}
          </div>
          {series.length < 2 ? (
            <p className="text-sm text-muted py-6 text-center">Servono almeno 2 misurazioni di {m.label.toLowerCase()} per vedere l’andamento.</p>
          ) : (
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="date" stroke="#9a9a9a" fontSize={11} />
                  <YAxis stroke="#9a9a9a" fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [`${fmtNum(v)} ${m.unit}`, m.label]} />
                  <Line type="monotone" dataKey="v" stroke="#c6ff00" strokeWidth={3} dot={{ r: 4, fill: '#c6ff00' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <h2 className="font-bold pt-2">Storico</h2>
        {[...list].reverse().map((x) => (
          <button key={x.id} className="w-full text-left" onClick={() => setEdit(x)}>
            <Card className="p-3 flex justify-between">
              <span>{fmtDateFull(x.date)}</span>
              <span className="text-muted text-sm">{x.weight ? `${fmtNum(x.weight)} kg` : ''}{x.waist ? ` · vita ${fmtNum(x.waist)}` : ''} ›</span>
            </Card>
          </button>
        ))}
      </div>
      {edit && <MeasureSheet m={edit} heightCm={settings.heightCm} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MeasureSheet({ m, heightCm, onClose }: { m: Measurement; heightCm: number; onClose: () => void }) {
  const [v, setV] = useState<Measurement>(m);
  const [del, setDel] = useState(false);
  const save = async () => {
    const out = { ...v };
    if (out.weight && !out.bmi) out.bmi = bmiOf(out.weight, heightCm);
    if (out.id) await db.measurements.put(out);
    else await db.measurements.add(out);
    syncDerived();
    toast('Misure salvate');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={m.id ? 'Modifica misurazione' : 'Nuova misurazione'}>
      <Field label="Data">
        <input type="date" className={inputCls} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
      </Field>
      <div className="text-xs uppercase tracking-wide text-muted mb-2">Bilancia</div>
      <div className="grid grid-cols-2 gap-x-3">
        {METRICS.filter((x) => x.scale).map((x) => (
          <Field key={x.key} label={`${x.label}${x.unit ? ` (${x.unit})` : ''}`} hint={x.key === 'bmi' ? 'Vuoto = calcolato' : undefined}>
            <NumInput value={v[x.key] as number | null | undefined} onChange={(n) => setV({ ...v, [x.key]: n })} />
          </Field>
        ))}
      </div>
      <div className="text-xs uppercase tracking-wide text-muted mb-2">Metro</div>
      <div className="grid grid-cols-2 gap-x-3">
        {METRICS.filter((x) => !x.scale).map((x) => (
          <Field key={x.key} label={`${x.label} (${x.unit})`}>
            <NumInput value={v[x.key] as number | null | undefined} onChange={(n) => setV({ ...v, [x.key]: n })} />
          </Field>
        ))}
      </div>
      <Button big variant="primary" className="w-full mb-2" onClick={save}>Salva</Button>
      {m.id && <Button variant="ghost" className="w-full" onClick={() => setDel(true)}>Elimina</Button>}
      <Confirm open={del} onClose={() => setDel(false)} danger title="Eliminare la misurazione?" text="Non si può annullare." confirmLabel="Elimina"
        onConfirm={async () => { await db.measurements.delete(m.id!); onClose(); }} />
    </Sheet>
  );
}
