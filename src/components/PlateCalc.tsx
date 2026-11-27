import { useMemo, useState } from 'react';
import { Button, Chips, NumInput, Sheet } from './ui';
import type { AppSettings } from '../lib/settings';
import { solveTotal } from '../lib/plates';
import { fmtNum } from '../lib/units';

function PlateRow({ plates }: { plates: number[] }) {
  if (!plates.length) return <span className="text-muted">nessun disco</span>;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {plates.map((p, i) => (
        <span key={i} className="inline-grid place-items-center rounded-md bg-accent/15 border border-accent/40 text-accent font-bold text-sm"
          style={{ minWidth: Math.max(34, 22 + p * 5), height: 28 + p * 4, padding: "0 4px" }}>{fmtNum(p, 2)}</span>
      ))}
    </div>
  );
}

/** Calcolatore dischi: modalità 1 (totale → dischi) e modalità 2 (dischi → totale). */
export default function PlateCalc({ open, onClose, settings, barWeight, current, onUse }: {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  barWeight: number | null;
  current: number; // dischi attuali (somma dei due lati)
  onUse: (platesTotal: number) => void;
}) {
  const [mode, setMode] = useState<'total' | 'plates'>('total');
  const bar = barWeight ?? 0;
  const [total, setTotal] = useState<number | null>(bar + current);
  const [side, setSide] = useState<number[]>([]);
  const sol = useMemo(() => (total !== null ? solveTotal(total, bar, settings.plates) : null), [total, bar, settings.plates]);
  const sideSum = side.reduce((a, b) => a + b, 0);
  const counts = new Map(settings.plates.map((p) => [p.weight, p.count]));
  const usedOf = (w: number) => side.filter((x) => x === w).length;

  return (
    <Sheet open={open} onClose={onClose} title="Calcolatore dischi">
      {barWeight === null && <p className="text-sm text-minima mb-3">Peso del bilanciere non inserito: lo conto come 0. Inseriscilo in Impostazioni → Attrezzatura.</p>}
      <div className="mb-3">
        <Chips options={[{ value: 'total', label: 'Dal carico ai dischi' }, { value: 'plates', label: 'Dai dischi al carico' }]} value={mode} onChange={(m) => setMode(m as 'total' | 'plates')} />
      </div>
      {mode === 'total' ? (
        <>
          <span className="block text-sm text-muted mb-1">Carico totale, bilanciere compreso (kg)</span>
          <NumInput value={total} onChange={setTotal} />
          {sol && (
            <div className="mt-3 space-y-3">
              <div className="bg-surface2 rounded-2xl p-3">
                <div className="text-xs uppercase text-muted mb-1">{sol.exact ? 'Per lato' : 'Esatto non si può: il più vicino sotto'}</div>
                <PlateRow plates={sol.perSide} />
                <div className="text-sm mt-2">Totale <b>{fmtNum(sol.total, 2)} kg</b> (bilanciere {fmtNum(bar, 2)} + dischi {fmtNum(sol.total - bar, 2)})</div>
                <Button variant="primary" className="w-full mt-2" onClick={() => { onUse(Math.round((sol.total - bar) * 100) / 100); onClose(); }}>Inserisci nella serie</Button>
              </div>
              {!sol.exact && sol.above && (
                <div className="bg-surface2 rounded-2xl p-3">
                  <div className="text-xs uppercase text-muted mb-1">Il più vicino sopra</div>
                  <PlateRow plates={sol.above.perSide} />
                  <div className="text-sm mt-2">Totale <b>{fmtNum(sol.above.total, 2)} kg</b></div>
                  <Button className="w-full mt-2" onClick={() => { onUse(Math.round((sol.above!.total - bar) * 100) / 100); onClose(); }}>Inserisci questo</Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-2">Tocca i dischi montati su un lato (l’altro lato è uguale).</p>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {settings.plates.map((p) => {
              const c = counts.get(p.weight);
              const max = c === null || c === undefined ? Infinity : Math.floor(c / 2);
              return (
                <Button key={p.weight} className="px-0" disabled={usedOf(p.weight) >= max} onClick={() => setSide([...side, p.weight].sort((a, b) => b - a))}>
                  {fmtNum(p.weight, 2)}
                </Button>
              );
            })}
          </div>
          <div className="bg-surface2 rounded-2xl p-3">
            <PlateRow plates={side} />
            <div className="text-lg mt-2">Totale <b className="text-accent">{fmtNum(bar + sideSum * 2, 2)} kg</b></div>
            <div className="text-xs text-muted">bilanciere {fmtNum(bar, 2)} + dischi {fmtNum(sideSum * 2, 2)}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button onClick={() => setSide([])}>Svuota</Button>
              <Button onClick={() => setSide(side.slice(0, -1))}>Togli ultimo</Button>
            </div>
            <Button variant="primary" className="w-full mt-2" onClick={() => { onUse(Math.round(sideSum * 200) / 100); onClose(); }}>Inserisci nella serie</Button>
          </div>
        </>
      )}
      <p className="text-xs text-muted mt-3">Nella serie si inserisce il peso dei soli dischi: il bilanciere viene sommato in automatico.</p>
    </Sheet>
  );
}
