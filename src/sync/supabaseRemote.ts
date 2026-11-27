import type { SupabaseClient } from '@supabase/supabase-js';
import type { Remote, RemoteRow } from './remote';

export class SupabaseRemote implements Remote {
  constructor(private sb: SupabaseClient) {}

  async push(rows: RemoteRow[]) {
    if (!rows.length) return;
    const { error } = await this.sb.rpc('push_rows', { rows });
    if (error) throw new Error(error.message);
  }

  async pull(since: string | null, opts: { after?: boolean; limit: number }) {
    let q = this.sb.from('kaizen_rows').select('tbl,rid,data,deleted,updated_at,server_ts');
    if (since) q = opts.after ? q.gt('server_ts', since) : q.gte('server_ts', since);
    const { data, error } = await q.order('server_ts', { ascending: true }).limit(opts.limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as RemoteRow[];
  }
}
