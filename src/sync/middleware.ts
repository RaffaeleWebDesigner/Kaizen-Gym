import type { DBCore, DBCoreMutateRequest, DBCoreTable, Middleware } from 'dexie';
import { idFromKey, newId } from './ids';

/** Tabelle sincronizzate. Le foto restano solo sul dispositivo. */
export const SYNC_TABLES = [
  'settings', 'exercises', 'templates', 'sessions', 'dayMarks', 'matches', 'measurements', 'reviews',
  'challenges', 'challengeAttempts', 'successes', 'rankHistory', 'goals',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
const SYNCED = new Set<string>(SYNC_TABLES);

export interface OutboxEntry {
  k: string; // tbl + SEP + rid
  tbl: string;
  rid: string;
  ts: number; // momento della modifica (ms)
}
export const SEP = '\u0001';
export const outboxKey = (tbl: string, rid: string) => tbl + SEP + rid;
export const ridOf = (key: unknown) => String(key);
export const keyOf = (tbl: string, rid: string): string | number => (tbl === 'settings' ? rid : Number(rid));

/** Segna una transazione come "arriva dal cloud": le sue scritture non tornano nella coda. */
export const REMOTE = '__kzRemote';

let lastTs = 0;
export function stamp(): number {
  const n = Math.max(Date.now(), lastTs + 1);
  lastTs = n;
  return n;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function withIds(table: DBCoreTable, req: DBCoreMutateRequest): DBCoreMutateRequest {
  if (req.type !== 'add' && req.type !== 'put') return req;
  const pk = table.schema.primaryKey;
  if (!pk.autoIncrement || typeof pk.keyPath !== 'string' || req.keys) return req;
  const kp = pk.keyPath;
  let changed = false;
  const values = req.values.map((v) => {
    if (v == null || v[kp] != null) return v;
    changed = true;
    const id = table.name === 'successes' && typeof v.autoKey === 'string' && v.autoKey ? idFromKey(v.autoKey) : newId();
    return { ...v, [kp]: id };
  });
  return changed ? { ...req, values } : req;
}

/**
 * Ogni scrittura su una tabella sincronizzata lascia una voce nella coda "outbox",
 * dentro la stessa transazione: se l'app si chiude, la modifica non si perde.
 */
export const syncMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'kaizenSync',
  create(down) {
    return {
      ...down,
      transaction(stores, mode, options) {
        const s = mode === 'readwrite' && stores.some((x) => SYNCED.has(x)) && !stores.includes('outbox') ? [...stores, 'outbox'] : stores;
        return down.transaction(s, mode, options);
      },
      table(name) {
        const table = down.table(name);
        if (!SYNCED.has(name)) return table;
        return {
          ...table,
          async mutate(req0) {
            if ((req0.trans as any)[REMOTE]) return table.mutate(req0);
            const req = withIds(table, req0);
            let keys: unknown[] = [];
            if (req.type === 'deleteRange') {
              const r = await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } });
              keys = r.result as unknown[];
            } else if (req.type === 'delete') {
              keys = req.keys;
            }
            const res = await table.mutate(req);
            if (req.type === 'add' || req.type === 'put') {
              keys = (res.results ?? []).filter((_, i) => !(i in res.failures));
            }
            if (keys.length) {
              const ts = stamp();
              await down.table('outbox').mutate({
                type: 'put',
                trans: req.trans,
                values: keys.map((k) => ({ k: outboxKey(name, ridOf(k)), tbl: name, rid: ridOf(k), ts } satisfies OutboxEntry)),
              });
              queueMicrotask(() => listeners.forEach((fn) => fn()));
            }
            return res;
          },
        };
      },
    };
  },
};
