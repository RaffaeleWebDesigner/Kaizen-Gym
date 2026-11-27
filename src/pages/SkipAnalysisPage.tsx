import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Header } from '../components/ui';
import { SKIP_CATEGORY_LABEL, type SkipCategory } from '../db';
import { useData } from '../lib/useData';
import { enemySentence, skipStats } from '../lib/derived';
import { fmtDate, monthName, todayISO } from '../lib/dates';
import { chartTooltip } from './BodyPage';

export const SKIP_COLORS: Record<SkipCategory, string> = {
  videogiochi: '#ff5a5f',
  sonno: '#8fb8ff',
  impegni: '#ffb020',
  lavoro: '#7fe3d4',
  pigrizia: '#c58bff',
  altro: '#9a9a9a',
};

export default function SkipAnalysisPage() {
  const data = useData();
  if (!data) return null;
  const skipped = data.marks.filter((m) => m.type === 'skipped');
  const months = [...new Set([...skipped.map((m) => m.date.slice(0, 7)), todayISO().slice(0, 7)])].sort();
  const cats = Object.keys(SKIP_CATEGORY_LABEL) as SkipCategory[];
  const chart = months.map((mo) => {
    const { counts } = skipStats(data.marks, mo);
    const row: Record<string, string | number> = { mese: `${monthName(Number(mo.slice(5)) - 1).slice(0, 3)} ${mo.slice(2, 4)}` };
    for (const c of cats) row[c] = counts.get(c) ?? 0;
    return row;
  });
  const cur = todayISO().slice(0, 7);
  const sick = data.marks.filter((m) => m.type === 'sick').length;

  return (
    <div className="pb-nav">
      <Header title="Sedute saltate" back="/progressi" />
      <div className="p-4 space-y-3">
        <Card className="border-danger/40">
          <p className="text-lg font-bold">{enemySentence(data.marks, cur)}</p>
          <p className="text-sm text-muted mt-1">Saperlo è metà del lavoro: la prossima volta che arriva, lo riconosci.</p>
        </Card>
        <Card>
          <h2 className="font-bold mb-2">Motivi per mese</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="mese" stroke="#9a9a9a" fontSize={11} />
                <YAxis stroke="#9a9a9a" fontSize={11} allowDecimals={false} />
                <Tooltip {...chartTooltip} cursor={{ fill: '#ffffff10' }} formatter={(v: number, k: string) => [v, SKIP_CATEGORY_LABEL[k as SkipCategory]]} />
                <Legend formatter={(k: string) => <span style={{ color: '#9a9a9a', fontSize: 11 }}>{SKIP_CATEGORY_LABEL[k as SkipCategory]}</span>} />
                {cats.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={SKIP_COLORS[c]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {[...months].reverse().map((mo) => {
          const { sorted, total } = skipStats(data.marks, mo);
          if (!total) return null;
          return (
            <Card key={mo}>
              <div className="font-semibold capitalize">{monthName(Number(mo.slice(5)) - 1)} {mo.slice(0, 4)} · {total} saltate</div>
              <p className="text-sm text-muted mb-2">{enemySentence(data.marks, mo, 'del mese')}</p>
              {sorted.map(([c, n]) => (
                <div key={c} className="flex justify-between text-sm"><span style={{ color: SKIP_COLORS[c] }}>{SKIP_CATEGORY_LABEL[c]}</span><b>{n}</b></div>
              ))}
              <div className="mt-2 space-y-1">
                {skipped.filter((m) => m.date.slice(0, 7) === mo).sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
                  <div key={m.id} className="text-xs text-muted">{fmtDate(m.date)}: {m.reason}</div>
                ))}
              </div>
            </Card>
          );
        })}
        <p className="text-xs text-muted text-center">Lo stop per malattia è separato e non conta come saltata ({sick} {sick === 1 ? 'giorno' : 'giorni'} finora).</p>
      </div>
    </div>
  );
}
