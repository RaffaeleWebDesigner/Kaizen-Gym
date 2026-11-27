/** Una riga come la salva il cloud. */
export interface RemoteRow {
  tbl: string;
  rid: string;
  data: unknown | null;
  deleted: boolean;
  updated_at: number;
  server_ts?: string;
}

export interface Remote {
  /** Salva le righe; sul server vince la modifica più recente (updated_at). */
  push(rows: RemoteRow[]): Promise<void>;
  /** Righe cambiate da `since` in poi (ISO), in ordine di server_ts. `after`: strettamente dopo. */
  pull(since: string | null, opts: { after?: boolean; limit: number }): Promise<RemoteRow[]>;
}

/** Cloud finto in memoria, per i test: stesse regole della funzione push_rows su Supabase. */
export class MemoryRemote implements Remote {
  rows = new Map<string, Required<RemoteRow>>();
  private clock = Date.parse('2026-11-27T00:00:00Z');
  failNext = false;

  private nextTs(): string {
    this.clock += 1;
    return new Date(this.clock).toISOString();
  }

  async push(rows: RemoteRow[]) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('rete assente');
    }
    for (const r of rows) {
      const k = r.tbl + '|' + r.rid;
      const cur = this.rows.get(k);
      if (cur && cur.updated_at > r.updated_at) continue;
      this.rows.set(k, { tbl: r.tbl, rid: r.rid, data: JSON.parse(JSON.stringify(r.data)), deleted: r.deleted, updated_at: r.updated_at, server_ts: this.nextTs() });
    }
  }

  async pull(since: string | null, opts: { after?: boolean; limit: number }) {
    return [...this.rows.values()]
      .filter((r) => !since || (opts.after ? r.server_ts > since : r.server_ts >= since))
      .sort((a, b) => a.server_ts.localeCompare(b.server_ts))
      .slice(0, opts.limit)
      .map((r) => JSON.parse(JSON.stringify(r)));
  }

  live() {
    return [...this.rows.values()].filter((r) => !r.deleted);
  }
}
