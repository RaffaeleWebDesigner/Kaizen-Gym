import type { PlateInv } from './settings';

/** Quantità massima per lato quando la quantità dei dischi non è indicata. */
const UNKNOWN_PAIRS = 10;
const round = (n: number) => Math.round(n * 100) / 100;

export interface SideCombo {
  side: number; // kg per lato
  plates: number[]; // dischi per lato, dal più pesante
}

/** Tutte le combinazioni ottenibili per lato (i dischi vanno in coppia), con il minor numero di dischi. */
const cache = new Map<string, SideCombo[]>();

export function sideCombos(plates: PlateInv[]): SideCombo[] {
  const key = JSON.stringify(plates);
  const hit = cache.get(key);
  if (hit) return hit;
  const res = computeCombos(plates);
  cache.set(key, res);
  return res;
}

function computeCombos(plates: PlateInv[]): SideCombo[] {
  const kinds = [...plates]
    .filter((p) => p.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({ w: p.weight, max: p.count === null || p.count === undefined ? UNKNOWN_PAIRS : Math.floor(p.count / 2) }));
  const best = new Map<number, number[]>();
  const rec = (i: number, side: number, used: number[]) => {
    if (i === kinds.length) {
      const k = round(side);
      const cur = best.get(k);
      if (!cur || used.length < cur.length) best.set(k, used);
      return;
    }
    for (let n = 0; n <= kinds[i].max; n++) {
      rec(i + 1, side + n * kinds[i].w, n ? [...used, ...Array(n).fill(kinds[i].w)] : used);
      if (side + n * kinds[i].w > 200) break;
    }
  };
  rec(0, 0, []);
  return [...best.entries()].map(([side, p]) => ({ side, plates: p })).sort((a, b) => a.side - b.side);
}

/** Carichi di soli dischi (somma dei due lati) possibili, crescenti. */
export function plateTotals(plates: PlateInv[]): number[] {
  return sideCombos(plates).map((c) => round(c.side * 2));
}

export interface PlateSolution {
  exact: boolean;
  total: number; // carico totale con bilanciere
  perSide: number[];
  below?: { total: number; perSide: number[] };
  above?: { total: number; perSide: number[] };
}

/** Modalità 1: carico totale (bilanciere compreso) → dischi per lato. */
export function solveTotal(total: number, bar: number, plates: PlateInv[]): PlateSolution {
  const combos = sideCombos(plates);
  const target = round((total - bar) / 2);
  const exact = combos.find((c) => c.side === target);
  if (exact) return { exact: true, total: round(bar + exact.side * 2), perSide: exact.plates };
  const below = [...combos].reverse().find((c) => c.side < target);
  const above = combos.find((c) => c.side > target);
  const pick = below ?? above!;
  return {
    exact: false,
    total: round(bar + pick.side * 2),
    perSide: pick.plates,
    below: below && { total: round(bar + below.side * 2), perSide: below.plates },
    above: above && { total: round(bar + above.side * 2), perSide: above.plates },
  };
}

/** Il più piccolo carico di dischi possibile sopra quello attuale. */
export function nextPlatesTotal(current: number, totals: number[]): number | null {
  return totals.find((t) => t > current + 1e-9) ?? null;
}

/** Il carico di dischi possibile più vicino (senza superare max se indicato). */
export function nearestPlatesTotal(value: number, totals: number[], notAbove?: number): number {
  const pool = notAbove === undefined ? totals : totals.filter((t) => t <= notAbove + 1e-9);
  if (!pool.length) return 0;
  return pool.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
}
