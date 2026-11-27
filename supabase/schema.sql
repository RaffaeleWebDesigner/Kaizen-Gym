-- Kaizen-Gym: database per la sincronizzazione tra dispositivi.
-- Da incollare una volta in Supabase → SQL Editor → New query → Run.
-- Si può rieseguire senza problemi: non cancella dati.

create table if not exists public.kaizen_rows (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text        not null,            -- tabella dell'app (sessions, measurements, …)
  rid        text        not null,            -- id della riga nell'app
  data       jsonb,                           -- la riga com'è nell'app (null se cancellata)
  deleted    boolean     not null default false,
  updated_at bigint      not null,            -- quando è stata modificata sul dispositivo (ms)
  server_ts  timestamptz not null default clock_timestamp(), -- quando è arrivata qui
  primary key (user_id, tbl, rid)
);

create index if not exists kaizen_rows_user_ts on public.kaizen_rows (user_id, server_ts);

-- Ogni account vede e modifica solo le proprie righe.
alter table public.kaizen_rows enable row level security;

drop policy if exists "kaizen: leggo i miei dati" on public.kaizen_rows;
create policy "kaizen: leggo i miei dati" on public.kaizen_rows
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "kaizen: aggiungo i miei dati" on public.kaizen_rows;
create policy "kaizen: aggiungo i miei dati" on public.kaizen_rows
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "kaizen: modifico i miei dati" on public.kaizen_rows;
create policy "kaizen: modifico i miei dati" on public.kaizen_rows
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Salvataggio a gruppi: vince la modifica più recente (updated_at), quella più vecchia viene ignorata.
-- security invoker: valgono le regole qui sopra, ogni utente scrive solo le sue righe.
create or replace function public.push_rows(rows jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.kaizen_rows as k (user_id, tbl, rid, data, deleted, updated_at, server_ts)
  select auth.uid(), r->>'tbl', r->>'rid', r->'data', coalesce((r->>'deleted')::boolean, false), (r->>'updated_at')::bigint, clock_timestamp()
  from jsonb_array_elements(rows) as r
  on conflict (user_id, tbl, rid) do update
    set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, server_ts = clock_timestamp()
    where k.updated_at <= excluded.updated_at;
$$;

revoke all on function public.push_rows(jsonb) from public, anon;
grant execute on function public.push_rows(jsonb) to authenticated;

-- Per il controllo automatico anti-pausa (GitHub Actions): risponde "ok", non legge dati.
create or replace function public.ping()
returns text
language sql
stable
as $$ select 'ok'::text $$;

grant execute on function public.ping() to anon, authenticated;

-- La cancellazione completa dell'account è in 02-cancellazione-account.sql.
