import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Field, Header, Sheet, Stepper, inputCls } from '../components/ui';
import { db, GROUP_LABEL, type Template, type TemplateRow } from '../db';
import { useData } from '../lib/useData';
import { convert } from '../lib/units';

export default function TemplateEdit() {
  const { code } = useParams();
  const data = useData();
  const [picker, setPicker] = useState(false);
  if (!data) return null;
  const tpl = data.templates.find((t) => t.code === code);
  if (!tpl) return <Header title="Modello non trovato" back="/modelli" />;

  const save = (patch: Partial<Template>) => db.templates.update(tpl.id!, patch);
  const setRow = (i: number, patch: Partial<TemplateRow>) => {
    const rows = tpl.rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    save({ rows });
  };
  const move = (i: number, d: number) => {
    const rows = [...tpl.rows];
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    save({ rows });
  };
  const remove = (i: number) => save({ rows: tpl.rows.filter((_, j) => j !== i) });
  const add = (exerciseId: number) => {
    const ex = data.exById.get(exerciseId)!;
    const time = ex.type === 'time';
    save({ rows: [...tpl.rows, { exerciseId, sets: 2, repMin: time ? 30 : 8, repMax: time ? 60 : 12, startLoad: 0, restSec: ex.restSec }] });
    setPicker(false);
  };

  return (
    <div className="pb-nav">
      <Header title={tpl.name} back="/modelli" />
      <div className="p-4 space-y-3">
        <Field label="Nome del modello">
          <input className={inputCls} defaultValue={tpl.name} onBlur={(e) => save({ name: e.target.value || tpl.name })} />
        </Field>
        {tpl.code === 'MIN' && <p className="text-sm text-minima">La seduta minima deve stare in 10-15 minuti: tienila corta.</p>}

        {tpl.rows.map((r, i) => {
          const ex = data.exById.get(r.exerciseId);
          if (!ex) return null;
          const time = ex.type === 'time';
          return (
            <Card key={i}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold">{ex.name}</div>
                  <div className="text-xs text-muted">{GROUP_LABEL[ex.group]} · {time ? 'a tempo' : ex.unit}{ex.isBarbell ? ' · bilanciere' : ''}{ex.perHand ? ' · per mano' : ''}</div>
                </div>
                <Link to={`/esercizi/${ex.id}`} className="text-accent text-sm min-h-[44px] px-1">Esercizio ›</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 justify-items-center">
                <Stepper label="Serie" value={r.sets} min={1} onChange={(v) => setRow(i, { sets: v })} />
                <Stepper label="Recupero (s)" value={r.restSec} step={15} onChange={(v) => setRow(i, { restSec: v })} />
                <Stepper label={time ? 'Min (s)' : 'Rip. min'} value={r.repMin} step={time ? 5 : 1} min={1} onChange={(v) => setRow(i, { repMin: v, repMax: Math.max(v, r.repMax) })} />
                <Stepper label={time ? 'Max (s)' : 'Rip. max'} value={r.repMax} step={time ? 5 : 1} min={r.repMin} onChange={(v) => setRow(i, { repMax: v })} />
                {!time && (
                  <div className="col-span-2">
                    <Stepper
                      label={`Carico iniziale (${ex.unit}${ex.isBarbell ? ', solo dischi' : ''})`}
                      value={r.startLoad}
                      step={ex.stackStep || ex.increment || 1}
                      onChange={(v) => setRow(i, { startLoad: v })}
                      suffix={r.startLoad ? convert(r.startLoad, ex.unit) : ex.bodyweight ? 'corpo libero' : undefined}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Button className="flex-1" onClick={() => move(i, -1)} aria-label="Sposta su">↑</Button>
                <Button className="flex-1" onClick={() => move(i, 1)} aria-label="Sposta giù">↓</Button>
                <Button className="flex-1" variant="danger" onClick={() => remove(i)}>Togli</Button>
              </div>
            </Card>
          );
        })}

        <Button big className="w-full" onClick={() => setPicker(true)}>+ Aggiungi esercizio</Button>
      </div>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} />
    </div>
  );
}

export function ExercisePicker({ open, onClose, onPick, filter }: { open: boolean; onClose: () => void; onPick: (id: number) => void; filter?: (id: number) => boolean }) {
  const data = useData();
  if (!data) return null;
  const list = data.exercises.filter((e) => !e.archived && (!filter || filter(e.id!)));
  const groups = ['gambe', 'spinta', 'tirata', 'core'] as const;
  return (
    <Sheet open={open} onClose={onClose} title="Scegli un esercizio">
      {groups.map((g) => {
        const items = list.filter((e) => e.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="mb-3">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">{GROUP_LABEL[g]}</div>
            <div className="grid gap-2">
              {items.map((e) => (
                <Button key={e.id} className="text-left" onClick={() => onPick(e.id!)}>{e.name}</Button>
              ))}
            </div>
          </div>
        );
      })}
      <Link to="/esercizi/nuovo" className="block text-center text-accent min-h-[48px] leading-[48px]">+ Crea nuovo esercizio</Link>
    </Sheet>
  );
}
