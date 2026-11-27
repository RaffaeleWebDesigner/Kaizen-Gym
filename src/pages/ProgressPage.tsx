import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Header } from '../components/ui';
import { useData } from '../lib/useData';
import { exerciseHistory, monthStats, personalRecords, streak, weekStats, doneSessions } from '../lib/stats';
import { fmtDate, monthName, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { chartTooltip } from './BodyPage';

export default function ProgressPage() {
  const data = useData();
  const [exId, setExId] = useState<number | null>(null);
  if (!data) return null;
  const today = todayISO();
  const weeks = weekStats(data.sessions, data.marks, data.settings.startDate, today, data.settings.weeklyGoal);
  const months = monthStats(weeks);
  const prs = personalRecords(data.sessions);
  const done = doneSessions(data.sessions);
  const usedIds = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const selected = exId ?? usedIds[0] ?? null;
  const hist = selected ? exerciseHistory(data.sessions, selected) : [];
  const selEx = selected ? data.exById.get(selected) : null;
  const isTime = selEx?.type === 'time';
  const totalDone = weeks.reduce((a, w) => a + w.done, 0);
  const totalTarget = weeks.reduce((a, w) => a + w.target, 0);
  const minima = done.filter((s) => s.kind === 'MIN').length;
  const skipped = data.marks.filter((m) => m.type === 'skipped').length;

  return (
    <div className="pb-nav">
      <Header title="Progressi" />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center"><div className="text-2xl font-bold text-accent">{totalTarget ? Math.round((Math.min(totalDone, totalTarget) / totalTarget) * 100) : 0}%</div><div className="text-[11px] text-muted">costanza totale</div></Card>
          <Card className="p-3 text-center"><div className="text-2xl font-bold">{streak(weeks)}</div><div className="text-[11px] text-muted">settimane di fila</div></Card>
          <Card className="p-3 text-center"><div className="text-2xl font-bold">{minima}</div><div className="text-[11px] text-muted">sedute minime</div></Card>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/saltate"><Card className="p-3"><div className="font-semibold">Sedute saltate</div><div className="text-xs text-muted">motivi e nemico n.1</div></Card></Link>
          <Link to="/rank"><Card className="p-3"><div className="font-semibold">Rank</div><div className="text-xs text-muted">forza stimata</div></Card></Link>
        </div>

        <Card>
          <h2 className="font-bold mb-2">Costanza per settimana</h2>
          <div className="space-y-2">
            {[...weeks].reverse().map((w) => (
              <div key={w.monday}>
                <div className="flex justify-between text-sm">
                  <span>Sett. {fmtDate(w.monday)}{w.inProgress ? ' (in corso)' : ''}</span>
                  <span className="tabular"><b>{w.done}</b>/{w.target} · {w.pct}%{w.sick ? ' 🤒' : ''}</span>
                </div>
                <div className="h-2 bg-line rounded-full overflow-hidden mt-1">
                  <div className={`h-full ${w.ok ? 'bg-accent' : 'bg-muted'}`} style={{ width: `${w.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Previsto: {data.settings.weeklyGoal} a settimana, meno 1 per ogni giorno di malattia. Barra verde = settimana che tiene la striscia. Sedute saltate in totale: {skipped}.</p>
        </Card>

        <Card>
          <h2 className="font-bold mb-2">Costanza per mese</h2>
          {months.map((m) => (
            <div key={m.key} className="flex justify-between text-sm py-1">
              <span className="capitalize">{monthName(Number(m.key.slice(5)) - 1)} {m.key.slice(0, 4)}</span>
              <span className="tabular"><b>{m.done}</b>/{m.target} · {m.pct}%</span>
            </div>
          ))}
        </Card>

        <Card>
          <h2 className="font-bold mb-2">Per esercizio</h2>
          {usedIds.length === 0 ? (
            <p className="text-sm text-muted">Ancora nessuna seduta registrata.</p>
          ) : (
            <>
              <select className="w-full bg-surface2 border border-line rounded-xl px-3 min-h-[48px] mb-3" value={selected ?? ''} onChange={(e) => setExId(Number(e.target.value))}>
                {usedIds.map((id) => <option key={id} value={id}>{data.exById.get(id)?.name ?? `#${id}`}</option>)}
              </select>
              {hist.length < 2 && <p className="text-sm text-muted mb-2">Con 2 o più sedute vedrai la linea dell’andamento.</p>}
              <div className="text-sm text-muted mb-1">{isTime ? 'Serie più lunga (secondi)' : 'Carico massimo (kg, bilanciere compreso)'}</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hist.map((h) => ({ date: fmtDate(h.date), v: isTime ? h.maxReps : Math.round(h.maxKg * 10) / 10 }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="date" stroke="#9a9a9a" fontSize={11} />
                    <YAxis stroke="#9a9a9a" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => [isTime ? `${v}"` : `${fmtNum(v)} kg`, isTime ? 'max' : 'carico']} />
                    <Line type="monotone" dataKey="v" stroke="#c6ff00" strokeWidth={3} dot={{ r: 4, fill: '#c6ff00' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-muted mt-3 mb-1">{isTime ? 'Tempo totale (secondi)' : 'Volume (serie × ripetizioni × kg)'}</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hist.map((h) => ({ date: fmtDate(h.date), v: isTime ? h.totalReps : Math.round(h.volumeKg) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="date" stroke="#9a9a9a" fontSize={11} />
                    <YAxis stroke="#9a9a9a" fontSize={11} />
                    <Tooltip {...chartTooltip} cursor={{ fill: '#ffffff10' }} formatter={(v: number) => [isTime ? `${v}"` : `${fmtNum(v, 0)} kg`, isTime ? 'totale' : 'volume']} />
                    <Bar dataKey="v" fill="#c6ff00" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {selEx?.isBarbell && !selEx.barWeight && <p className="text-xs text-minima mt-2">Peso del bilanciere non inserito: i carichi contano solo i dischi.</p>}
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-bold mb-2">Record personali</h2>
          {prs.length === 0 && <p className="text-sm text-muted">Nessun record ancora.</p>}
          <div className="divide-y divide-line">
            {prs.map((p) => (
              <div key={p.exerciseId} className="py-2">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted">
                  {p.type === 'time'
                    ? `Serie più lunga: ${p.bestReps}"`
                    : `${p.bestLoadKg > 0 ? `Carico max ${fmtNum(p.bestLoadKg)} kg × ${p.bestLoadReps} (${fmtDate(p.bestLoadDate)})` : `Max ${p.bestReps} ripetizioni`} · volume max ${fmtNum(p.bestVolumeKg, 0)} kg`}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">I record arrivano da soli, un passo alla volta. Nessun massimale da cercare.</p>
        </Card>
      </div>
    </div>
  );
}
