import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Chips, Field, Header, NumInput, Toggle, inputCls, toast } from '../components/ui';
import { db, GROUP_LABEL, type Exercise, type MuscleGroup } from '../db';
import { useData } from '../lib/useData';
import { convert } from '../lib/units';
import { RANK_EXERCISE_LABEL } from '../lib/rank';

const EMPTY: Exercise = {
  name: '', group: 'spinta', type: 'reps', unit: 'kg', bodyweight: false, isBarbell: false, barWeight: null,
  perHand: false, increment: 1, stackStep: null, restSec: 90, cues: ['', ''], substituteIds: [],
};

export default function ExerciseEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useData();
  const isNew = id === 'nuovo';
  const [ex, setEx] = useState<Exercise | null>(isNew ? EMPTY : null);

  useEffect(() => {
    if (!isNew && data && !ex) {
      const found = data.exById.get(Number(id));
      if (found) setEx({ ...found, cues: [found.cues[0] ?? '', found.cues[1] ?? ''] });
    }
  }, [data, id, isNew, ex]);

  if (!data || !ex) return null;
  const set = (p: Partial<Exercise>) => setEx({ ...ex, ...p });

  const save = async () => {
    if (!ex.name.trim()) return toast('Serve un nome');
    const clean = { ...ex, name: ex.name.trim(), cues: ex.cues.map((c) => c.trim()).filter(Boolean) };
    if (isNew) await db.exercises.add(clean);
    else {
      await db.exercises.put(clean);
      // aggiorna i dati tecnici nelle sedute in corso
      const open = await db.sessions.where('status').equals('in_progress').toArray();
      for (const s of open) {
        const exercises = s.exercises.map((l) =>
          l.exerciseId === clean.id ? { ...l, name: clean.name, unit: clean.unit, isBarbell: clean.isBarbell, barWeight: clean.barWeight, perHand: clean.perHand, stackStep: clean.stackStep, cues: clean.cues } : l,
        );
        await db.sessions.update(s.id!, { exercises });
      }
    }
    toast('Esercizio salvato');
    nav(-1);
  };

  const others = data.exercises.filter((e) => e.id !== ex.id && !e.archived);

  return (
    <div className="pb-nav">
      <Header title={isNew ? 'Nuovo esercizio' : ex.name} back />
      <div className="p-4 space-y-3">
        <Card>
          <Field label="Nome">
            <input className={inputCls} value={ex.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Gruppo muscolare">
            <Chips options={(Object.keys(GROUP_LABEL) as MuscleGroup[]).map((g) => ({ value: g, label: GROUP_LABEL[g] }))} value={ex.group} onChange={(g) => set({ group: g })} />
          </Field>
          <Field label="Tipo">
            <Chips options={[{ value: 'reps', label: 'Ripetizioni' }, { value: 'time', label: 'A tempo' }]} value={ex.type} onChange={(t) => set({ type: t as Exercise['type'], bodyweight: t === 'time' ? true : ex.bodyweight, increment: t === 'time' ? 5 : ex.increment })} />
          </Field>
          {ex.type === 'reps' && (
            <>
              <Field label="Unità">
                <Chips options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'libbre' }]} value={ex.unit} onChange={(u) => set({ unit: u as Exercise['unit'] })} />
              </Field>
              <Toggle label="Corpo libero (il carico è zavorra)" checked={ex.bodyweight} onChange={(v) => set({ bodyweight: v })} />
              <Toggle label="Con bilanciere" checked={ex.isBarbell} onChange={(v) => set({ isBarbell: v })} />
              {ex.isBarbell && (
                <Field label="Quale bilanciere?" hint="Il peso arriva dall’inventario (Impostazioni → Attrezzatura).">
                  <select className={inputCls} value={ex.barId ?? ''} onChange={(e) => {
                    const bar = data.settings.bars.find((b) => b.id === e.target.value);
                    set({ barId: e.target.value || null, barWeight: bar?.weight ?? ex.barWeight });
                  }}>
                    <option value="">Nessuno / peso a mano</option>
                    {data.settings.bars.map((b) => <option key={b.id} value={b.id}>{b.name}{b.weight !== null ? ` (${b.weight} kg)` : ''}</option>)}
                  </select>
                </Field>
              )}
              {ex.isBarbell && !ex.barId && (
                <Field label={`Peso del bilanciere (${ex.unit})`} hint="Si somma ai dischi. Lascia vuoto se non lo sai ancora.">
                  <NumInput value={ex.barWeight} onChange={(v) => set({ barWeight: v })} placeholder="es. 10" />
                </Field>
              )}
              <Toggle label="Carico per mano (manubri)" checked={ex.perHand} onChange={(v) => set({ perHand: v })} />
              <Toggle label="Macchina a pacco pesi (blocchi)" checked={!!ex.stackStep} onChange={(v) => set({ stackStep: v ? (ex.unit === 'lb' ? data.settings.lbPerBlock : 5) : null, increment: v ? (ex.unit === 'lb' ? data.settings.lbPerBlock : 5) : ex.increment })} />
              {ex.stackStep ? (
                <Field label={`Peso di un blocco (${ex.unit})`} hint={convert(ex.stackStep, ex.unit)}>
                  <NumInput value={ex.stackStep} onChange={(v) => set({ stackStep: v, increment: v ?? ex.increment })} />
                </Field>
              ) : (
                <Field label={`Aumento minimo di carico (${ex.unit})`} hint="Manubri 1 kg, bilanciere 2,5 kg. Metti 0 se non si aggiunge carico.">
                  <NumInput value={ex.increment} onChange={(v) => set({ increment: v ?? 0 })} />
                </Field>
              )}
            </>
          )}
          {ex.type === 'time' && (
            <Field label="Aumento in secondi quando completi la fascia">
              <NumInput value={ex.increment} onChange={(v) => set({ increment: v ?? 5 })} />
            </Field>
          )}
          <Field label="Rank" hint="Solo per gli esercizi base col bilanciere, trazioni e dip. Varianti e manubri non danno rank.">
            <select className={inputCls} value={ex.rankKey ?? ''} onChange={(e) => set({ rankKey: (e.target.value || null) as Exercise['rankKey'] })}>
              <option value="">Nessun rank</option>
              {Object.entries(RANK_EXERCISE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Recupero predefinito (secondi)">
            <NumInput value={ex.restSec} onChange={(v) => set({ restSec: v ?? 90 })} />
          </Field>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">Indicazioni tecniche (1-2)</h2>
          {[0, 1].map((i) => (
            <input key={i} className={`${inputCls} mb-2`} value={ex.cues[i] ?? ''} placeholder={`Indicazione ${i + 1}`}
              onChange={(e) => { const cues = [...ex.cues]; cues[i] = e.target.value; set({ cues }); }} />
          ))}
        </Card>

        <Card>
          <h2 className="font-semibold mb-1">Sostituti in caso di dolore</h2>
          <p className="text-sm text-muted mb-2">Proposti quando segni dolore su questo esercizio.</p>
          <div className="flex flex-wrap gap-2">
            {others.map((o) => {
              const on = ex.substituteIds.includes(o.id!);
              return (
                <button key={o.id} type="button" onClick={() => set({ substituteIds: on ? ex.substituteIds.filter((x) => x !== o.id) : [...ex.substituteIds, o.id!] })}
                  className={`min-h-[40px] px-3 rounded-full border text-sm ${on ? 'bg-accent text-black border-accent' : 'bg-surface2 border-line'}`}>
                  {o.name}
                </button>
              );
            })}
          </div>
        </Card>

        <Button big variant="primary" className="w-full" onClick={save}>Salva esercizio</Button>
        {!isNew && (
          <Button className="w-full" variant="ghost" onClick={async () => { await db.exercises.update(ex.id!, { archived: true }); toast('Esercizio archiviato'); nav(-1); }}>
            Archivia esercizio
          </Button>
        )}
      </div>
    </div>
  );
}
