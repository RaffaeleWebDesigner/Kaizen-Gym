import { useEffect, useState } from 'react';
import { Button, Card, Chips, Field, Header, NumInput, inputCls, toast } from '../components/ui';
import { db } from '../db';
import { setSetting, useSettings, type BarInv, type PlateInv } from '../lib/settings';
import { fmtNum } from '../lib/units';
import { plateTotals } from '../lib/plates';

/** Aggiorna il peso del bilanciere negli esercizi collegati e nelle sedute in corso. */
export async function propagateBars(bars: BarInv[]) {
  const exercises = await db.exercises.toArray();
  for (const e of exercises) {
    const bar = e.barId ? bars.find((b) => b.id === e.barId) : null;
    if (bar && bar.weight !== null && bar.weight !== e.barWeight) await db.exercises.update(e.id!, { barWeight: bar.weight });
  }
  const open = await db.sessions.where('status').equals('in_progress').toArray();
  for (const s of open) {
    const exs = s.exercises.map((l) => {
      const ex = exercises.find((e) => e.id === l.exerciseId);
      const bar = ex?.barId ? bars.find((b) => b.id === ex.barId) : null;
      return bar && bar.weight !== null ? { ...l, barWeight: bar.weight } : l;
    });
    await db.sessions.update(s.id!, { exercises: exs });
  }
}

export default function EquipmentPage() {
  const s = useSettings();
  const [plates, setPlates] = useState<PlateInv[] | null>(null);
  const [bars, setBars] = useState<BarInv[] | null>(null);
  useEffect(() => {
    if (s && !plates) {
      setPlates(s.plates);
      setBars(s.bars);
    }
  }, [s, plates]);
  if (!s || !plates || !bars) return null;

  const save = async () => {
    const p = plates.filter((x) => x.weight > 0).sort((a, b) => b.weight - a.weight);
    await setSetting('plates', p);
    await setSetting('bars', bars);
    await propagateBars(bars);
    toast('Attrezzatura salvata');
  };
  const totals = plateTotals(plates);
  const minJump = totals.length > 1 ? totals[1] - totals[0] : 0;

  return (
    <div className="pb-nav">
      <Header title="Attrezzatura" back="/impostazioni" />
      <div className="p-4 space-y-3">
        <Card>
          <h2 className="font-bold mb-1">Dischi</h2>
          <p className="text-sm text-muted mb-3">Peso e quantità totale. Se la quantità è vuota, considero che ne hai quanti ne servono.</p>
          {plates.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end mb-2">
              <Field label="Peso (kg)">
                <NumInput value={p.weight} onChange={(v) => setPlates(plates.map((x, j) => (j === i ? { ...x, weight: v ?? 0 } : x)))} />
              </Field>
              <Field label="Quantità">
                <NumInput value={p.count} placeholder="non so" onChange={(v) => setPlates(plates.map((x, j) => (j === i ? { ...x, count: v === null ? null : Math.round(v) } : x)))} />
              </Field>
              <button className="h-12 w-12 mb-3 text-muted text-xl" aria-label="Togli disco" onClick={() => setPlates(plates.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <Button className="w-full" onClick={() => setPlates([...plates, { weight: 0, count: null }])}>+ Aggiungi disco</Button>
          <p className="text-xs text-muted mt-2">Salto più piccolo possibile sul bilanciere: <b className="text-ink">{fmtNum(minJump, 2)} kg</b> (un disco per lato).</p>
        </Card>

        <Card>
          <h2 className="font-bold mb-1">Bilancieri</h2>
          {bars.map((b, i) => (
            <div key={b.id} className="border-t border-line pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
              <Field label="Nome">
                <input className={inputCls} value={b.name} onChange={(e) => setBars(bars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Peso (kg)">
                  <NumInput value={b.weight} placeholder="da inserire" onChange={(v) => setBars(bars.map((x, j) => (j === i ? { ...x, weight: v } : x)))} />
                </Field>
                <Field label="Tipo">
                  <Chips options={[{ value: 'dritto', label: 'Dritto' }, { value: 'ez', label: 'EZ' }]} value={b.kind} onChange={(k) => setBars(bars.map((x, j) => (j === i ? { ...x, kind: k as BarInv['kind'] } : x)))} />
                </Field>
              </div>
            </div>
          ))}
          <Button className="w-full mt-2" onClick={() => setBars([...bars, { id: `bar${Date.now()}`, name: 'Nuovo bilanciere', kind: 'dritto', weight: null }])}>+ Aggiungi bilanciere</Button>
        </Card>
        <Button big variant="primary" className="w-full" onClick={save}>Salva</Button>
      </div>
    </div>
  );
}
