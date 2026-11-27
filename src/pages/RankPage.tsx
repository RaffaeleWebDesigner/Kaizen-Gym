import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Header } from '../components/ui';
import RankBadge from '../components/RankBadge';
import { db } from '../db';
import { useData } from '../lib/useData';
import { computeRanks, levelName, MAX_LEVEL, RANK_EXERCISE_LABEL, tierOf, BODYWEIGHT_KEYS } from '../lib/rank';
import { fmtDate, fmtDateFull, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { chartTooltip } from './BodyPage';

export function useRanks() {
  const data = useData();
  const measures = useLiveQuery(() => db.measurements.toArray(), []);
  if (!data || !measures) return null;
  return { data, ...computeRanks(data.sessions, data.exById, measures, data.settings.rankThresholds, todayISO()) };
}

export default function RankPage() {
  const r = useRanks();
  const history = useLiveQuery(() => db.rankHistory.orderBy('date').toArray(), []);
  const [key, setKey] = useState<string>('overall');
  if (!r || !history) return null;
  const { ranks, overall, bw } = r;
  const keys = ['overall', ...new Set(history.map((h) => h.key).filter((k) => k !== 'overall'))];
  const series = history.filter((h) => h.key === key).map((h) => ({ date: fmtDate(h.date), level: h.level }));

  return (
    <div className="pb-nav">
      <Header title="Rank" back />
      <div className="p-4 space-y-3">
        <Card className="text-sm text-muted border-accent/40">
          Il rank cresce solo con la progressione normale: +1 ripetizione, il disco più piccolo, 2-3 ripetizioni di margine. Niente test di massimale e niente serie al cedimento: il massimale è sempre stimato.
        </Card>
        {!bw && <Card><p className="text-sm">Serve almeno una pesata in <b>Corpo</b> per calcolare l’indice di forza.</p></Card>}
        {overall !== null && (
          <Card className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted">Rank generale</div>
            <div className="flex justify-center my-2"><RankBadge level={overall} size={96} /></div>
            <div className="text-2xl font-black" style={{ color: tierOf(overall).tier.color }}>{levelName(overall)}</div>
            <div className="text-xs text-muted">livello {overall} di {MAX_LEVEL} · media dei rank per esercizio, per difetto</div>
          </Card>
        )}
        {bw && ranks.length === 0 && <Card><p className="text-sm text-muted">Nessun esercizio con rank nelle ultime 4 settimane. Contano panca piana con bilanciere, stacco da terra, military press con bilanciere, trazioni e dip (e lo squat con bilanciere, se lo aggiungi).</p></Card>}
        {ranks.map((x) => {
          const t = tierOf(x.level).tier;
          return (
            <Card key={x.key}>
              <div className="flex items-center gap-3">
                <RankBadge level={x.level} size={60} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted truncate">{RANK_EXERCISE_LABEL[x.key]}</div>
                  <div className="text-xl font-bold" style={{ color: t.color }}>{levelName(x.level)}</div>
                  <div className="text-xs text-muted">indice {fmtNum(x.index, 2)} · massimale stimato {fmtNum(x.e1rm)} kg · peso {fmtNum(x.bw)} kg</div>
                </div>
              </div>
              <div className="h-2 bg-line rounded-full overflow-hidden mt-3">
                <div className="h-full" style={{ width: `${Math.round(x.progress * 100)}%`, background: t.color }} />
              </div>
              {x.toNext && <p className="text-sm mt-2">{x.toNext}</p>}
              <p className="text-xs text-muted mt-1">
                Serie migliore: {BODYWEIGHT_KEYS.includes(x.key) ? (x.best.zavorraKg ? `+${fmtNum(x.best.zavorraKg)} kg` : 'corpo libero') : `${fmtNum(x.best.loadKg)} kg`} × {x.best.reps}{x.best.rir !== null ? `, RIR ${x.best.rir}` : ', RIR non segnato (conta 0)'} · {fmtDateFull(x.best.date)}
              </p>
            </Card>
          );
        })}

        {history.length > 0 && (
          <Card>
            <h2 className="font-bold mb-2">Storico</h2>
            <select className="w-full bg-surface2 border border-line rounded-xl px-3 min-h-[44px] mb-2" value={key} onChange={(e) => setKey(e.target.value)}>
              {keys.map((k) => <option key={k} value={k}>{k === 'overall' ? 'Rank generale' : RANK_EXERCISE_LABEL[k as keyof typeof RANK_EXERCISE_LABEL]}</option>)}
            </select>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="date" stroke="#9a9a9a" fontSize={11} />
                  <YAxis stroke="#9a9a9a" fontSize={11} domain={[1, 'dataMax + 1']} allowDecimals={false} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [levelName(v), 'rank']} />
                  <Legend formatter={() => <span style={{ color: '#9a9a9a', fontSize: 11 }}>livello (1-23)</span>} />
                  <Line type="stepAfter" dataKey="level" stroke="#c6ff00" strokeWidth={3} dot={{ r: 4, fill: '#c6ff00' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        <p className="text-xs text-muted text-center">Formula: carico × (1 + (ripetizioni + RIR) / 30), serie migliore delle ultime 4 settimane, 1-10 ripetizioni. Indice = massimale stimato / peso corporeo. Soglie modificabili in Impostazioni.</p>
      </div>
    </div>
  );
}
