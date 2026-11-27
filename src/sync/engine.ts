import type { KaizenDB } from '../db';
import { keyOf, outboxKey, REMOTE, ridOf, stamp, SYNC_TABLES, type OutboxEntry } from './middleware';
import type { Remote, RemoteRow } from './remote';

const PAGE = 1000;

/** Confronto indipendente dall'ordine delle chiavi (il cloud le riordina). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v as object).filter((k) => (v as any)[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable((v as any)[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}
const PUSH_CHUNK = 300;
/** Sovrapposizione nella lettura dal cloud, per non perdere righe salvate in contemporanea. */
const OVERLAP_MS = 60_000;

export type FirstSyncPlan =
  | { kind: 'fresh' } // account nuovo (cloud vuoto) e qui solo dati iniziali: serve un archivio vuoto per l'account
  | { kind: 'upload'; replaceCloud: boolean } // il cloud è vuoto (o ha solo i dati iniziali): si carica questo dispositivo
  | { kind: 'download' } // questo dispositivo ha solo i dati iniziali: prende il cloud
  | { kind: 'ask'; reason: 'both' | 'otherAccount'; local: DataSummary; cloud: DataSummary };

export interface DataSummary {
  sessions: number;
  measurements: number;
  lastSession: string | null;
}

export type Choice = 'cloud' | 'device';

interface State {
  userId: string | null;
  cursor: string | null;
  lastSyncAt: number | null;
}

/** Ci sono dati oltre a quelli inseriti alla prima apertura dell'app? */
function hasOwnData(c: { sessions: number; measurements: number; dayMarks: number; matches: number; reviews: number; goals: number; challengeAttempts: number }) {
  return c.sessions > 1 || c.measurements > 1 || c.dayMarks > 3 || c.matches > 2 || c.reviews > 0 || c.goals > 0 || c.challengeAttempts > 0;
}

export class SyncEngine {
  constructor(private db: KaizenDB, private remote: Remote) {}

  // ---------- stato ----------
  async state(): Promise<State> {
    const rows = await this.db.syncState.bulkGet(['userId', 'cursor', 'lastSyncAt']);
    return { userId: (rows[0]?.value as string) ?? null, cursor: (rows[1]?.value as string) ?? null, lastSyncAt: (rows[2]?.value as number) ?? null };
  }
  private async setState(p: Partial<State>) {
    await this.db.syncState.bulkPut(Object.entries(p).map(([key, value]) => ({ key, value })));
  }
  async pendingCount() {
    return this.db.outbox.count();
  }

  // ---------- prima sincronizzazione ----------
  private async localCounts() {
    const d = this.db;
    const [sessions, measurements, dayMarks, matches, reviews, goals, challengeAttempts] = await Promise.all([
      d.sessions.count(), d.measurements.count(), d.dayMarks.count(), d.matches.count(), d.reviews.count(), d.goals.count(), d.challengeAttempts.count(),
    ]);
    return { sessions, measurements, dayMarks, matches, reviews, goals, challengeAttempts };
  }

  private async localSummary(): Promise<DataSummary> {
    const done = (await this.db.sessions.toArray()).filter((s) => s.status === 'done').map((s) => s.date).sort();
    return { sessions: done.length, measurements: await this.db.measurements.count(), lastSession: done[done.length - 1] ?? null };
  }

  private async pullAll(): Promise<RemoteRow[]> {
    const out: RemoteRow[] = [];
    let since: string | null = null;
    for (;;) {
      const page = await this.remote.pull(since, { after: since !== null, limit: PAGE });
      out.push(...page);
      if (page.length < PAGE) break;
      since = page[page.length - 1].server_ts!;
    }
    return out;
  }

  /** Decide cosa fare al primo collegamento di questo dispositivo a un account. Non scrive niente. */
  async planFirstSync(userId: string): Promise<{ plan: FirstSyncPlan; cloudRows: RemoteRow[] }> {
    const st = await this.state();
    const cloudRows = (await this.pullAll()).filter((r) => !r.deleted);
    const count = (t: string) => cloudRows.filter((r) => r.tbl === t).length;
    const cloud = {
      sessions: count('sessions'), measurements: count('measurements'), dayMarks: count('dayMarks'), matches: count('matches'),
      reviews: count('reviews'), goals: count('goals'), challengeAttempts: count('challengeAttempts'),
    };
    const local = await this.localCounts();
    const cloudSummary = (): DataSummary => {
      const done = cloudRows.filter((r) => r.tbl === 'sessions' && (r.data as any)?.status === 'done').map((r) => (r.data as any).date as string).sort();
      return { sessions: done.length, measurements: cloud.measurements, lastSession: done[done.length - 1] ?? null };
    };

    if (st.userId && st.userId !== userId) {
      return { plan: { kind: 'ask', reason: 'otherAccount', local: await this.localSummary(), cloud: cloudSummary() }, cloudRows };
    }
    const cloudEmpty = cloudRows.length === 0;
    const localOwn = hasOwnData(local);
    const cloudOwn = hasOwnData(cloud);
    const freshLocal = !!(await this.db.settings.get('freshAccount'))?.value;
    if (cloudEmpty) return { plan: !localOwn && !freshLocal ? { kind: 'fresh' } : { kind: 'upload', replaceCloud: false }, cloudRows };
    if (!localOwn) return { plan: { kind: 'download' }, cloudRows };
    if (!cloudOwn) return { plan: { kind: 'upload', replaceCloud: true }, cloudRows };
    return { plan: { kind: 'ask', reason: 'both', local: await this.localSummary(), cloud: cloudSummary() }, cloudRows };
  }

  /** Esegue la prima sincronizzazione. `choice` serve solo quando il piano è 'ask'. */
  async firstSync(userId: string, choice?: Choice, force?: 'replaceCloud'): Promise<FirstSyncPlan> {
    const { plan, cloudRows } = await this.planFirstSync(userId);
    let mode: 'upload' | 'replaceCloud' | 'download';
    if (force) mode = force;
    else if (plan.kind === 'fresh') return plan;
    else if (plan.kind === 'ask') {
      if (!choice) return plan;
      mode = choice === 'cloud' ? 'download' : 'replaceCloud';
    } else if (plan.kind === 'download') mode = 'download';
    else mode = plan.replaceCloud ? 'replaceCloud' : 'upload';

    if (mode === 'download') {
      await this.replaceLocal(cloudRows);
    } else {
      const ts = stamp();
      const rows: RemoteRow[] = [];
      const localKeys = new Set<string>();
      for (const t of SYNC_TABLES) {
        const table = this.db.table(t);
        const pk = table.schema.primKey.keyPath as string;
        for (const obj of await table.toArray()) {
          const rid = ridOf(obj[pk]);
          localKeys.add(outboxKey(t, rid));
          rows.push({ tbl: t, rid, data: obj, deleted: false, updated_at: ts });
        }
      }
      if (mode === 'replaceCloud') {
        for (const r of cloudRows) if (!localKeys.has(outboxKey(r.tbl, r.rid))) rows.push({ tbl: r.tbl, rid: r.rid, data: null, deleted: true, updated_at: ts });
      }
      for (let i = 0; i < rows.length; i += PUSH_CHUNK) await this.remote.push(rows.slice(i, i + PUSH_CHUNK));
      await this.db.outbox.where('ts').belowOrEqual(ts).delete();
    }
    await this.setState({ userId, cursor: null, lastSyncAt: null });
    await this.pull();
    await this.setState({ lastSyncAt: Date.now() });
    return plan;
  }

  /** Svuota i dati sincronizzati di questo dispositivo, senza toccare il cloud (le foto restano). */
  async wipeLocal() {
    await this.replaceLocal([]);
  }

  /** Sostituisce i dati di questo dispositivo con quelli del cloud (le foto restano). */
  private async replaceLocal(rows: RemoteRow[]) {
    const tables = [...SYNC_TABLES.map((t) => this.db.table(t)), this.db.outbox];
    await this.db.transaction('rw', tables, async (tx) => {
      (tx as any).idbtrans[REMOTE] = true;
      for (const t of SYNC_TABLES) await this.db.table(t).clear();
      await this.db.outbox.clear();
      for (const t of SYNC_TABLES) {
        const data = rows.filter((r) => r.tbl === t && !r.deleted).map((r) => r.data);
        if (data.length) await this.db.table(t).bulkPut(data);
      }
    });
  }

  // ---------- sincronizzazione normale ----------
  /** Invia le modifiche in coda. */
  async push(): Promise<number> {
    let sent = 0;
    for (;;) {
      const batch = await this.db.outbox.orderBy('ts').limit(PUSH_CHUNK).toArray();
      if (!batch.length) break;
      const rows: RemoteRow[] = [];
      for (const t of new Set(batch.map((b) => b.tbl))) {
        const entries = batch.filter((b) => b.tbl === t);
        const objs = await this.db.table(t).bulkGet(entries.map((e) => keyOf(t, e.rid)));
        entries.forEach((e, i) => rows.push({ tbl: t, rid: e.rid, data: objs[i] ?? null, deleted: !objs[i], updated_at: e.ts }));
      }
      await this.remote.push(rows);
      // tolgo dalla coda solo le voci non cambiate nel frattempo
      await this.db.transaction('rw', this.db.outbox, async () => {
        const now = await this.db.outbox.bulkGet(batch.map((b) => b.k));
        const done = batch.filter((b, i) => now[i] && now[i]!.ts === b.ts).map((b) => b.k);
        await this.db.outbox.bulkDelete(done);
      });
      sent += rows.length;
      if (batch.length < PUSH_CHUNK) break;
    }
    return sent;
  }

  /** Riceve le modifiche dal cloud. Restituisce quante righe sono cambiate davvero. */
  async pull(): Promise<number> {
    const st = await this.state();
    let since: string | null = st.cursor ? new Date(Date.parse(st.cursor) - OVERLAP_MS).toISOString() : null;
    let after = false;
    let cursor = st.cursor;
    let applied = 0;
    for (;;) {
      const page = await this.remote.pull(since, { after, limit: PAGE });
      if (page.length) {
        applied += await this.apply(page);
        const lastTs = page[page.length - 1].server_ts!;
        if (!cursor || Date.parse(lastTs) >= Date.parse(cursor)) cursor = lastTs;
      }
      if (page.length < PAGE) break;
      since = page[page.length - 1].server_ts!;
      after = true;
    }
    await this.setState({ cursor });
    return applied;
  }

  private async apply(rows: RemoteRow[]): Promise<number> {
    const tables = [...new Set(rows.map((r) => r.tbl))].filter((t) => (SYNC_TABLES as readonly string[]).includes(t));
    if (!tables.length) return 0;
    let changed = 0;
    await this.db.transaction('rw', [...tables.map((t) => this.db.table(t)), this.db.outbox], async (tx) => {
      (tx as any).idbtrans[REMOTE] = true;
      for (const r of rows) {
        if (!tables.includes(r.tbl)) continue;
        const k = outboxKey(r.tbl, r.rid);
        const pending = (await this.db.outbox.get(k)) as OutboxEntry | undefined;
        if (pending && pending.ts > r.updated_at) continue; // la modifica locale è più recente: vince e verrà inviata
        if (pending) await this.db.outbox.delete(k);
        const table = this.db.table(r.tbl);
        const key = keyOf(r.tbl, r.rid);
        const cur = await table.get(key);
        if (r.deleted) {
          if (cur !== undefined) {
            await table.delete(key);
            changed++;
          }
          continue;
        }
        if (cur !== undefined && stable(cur) === stable(r.data)) continue;
        if (r.tbl === 'templates') {
          // il codice del modello (A, B, C, MIN) è unico: tolgo un eventuale doppione con id diverso
          const code = (r.data as any)?.code;
          const dup = await table.where('code').equals(code).first();
          if (dup && dup.id !== key) await table.delete(dup.id);
        }
        await table.put(r.data);
        changed++;
      }
    });
    return changed;
  }

  /** Un giro completo: prima invia, poi riceve. */
  async sync(): Promise<{ sent: number; received: number }> {
    const sent = await this.push();
    const received = await this.pull();
    await this.setState({ lastSyncAt: Date.now() });
    return { sent, received };
  }
}

