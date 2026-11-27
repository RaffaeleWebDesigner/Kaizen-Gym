-- Kaizen-Gym: cancellazione completa dell'account (diritto all'oblio, art. 17 GDPR).
-- Da incollare una volta in Supabase → SQL Editor → New query → Run. Si può rieseguire.
--
-- Chi è collegato può cancellare solo sé stesso: righe sincronizzate e utente (email e password).
-- security definer serve per poter cancellare da auth.users; il controllo su auth.uid() impedisce
-- di toccare altri account.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Serve essere collegati';
  end if;
  delete from public.kaizen_rows where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Revoca del consenso ai dati sulla salute: toglie dal cloud le misure del corpo dell'account.
create or replace function public.forget_my_measurements()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Serve essere collegati';
  end if;
  delete from public.kaizen_rows where user_id = auth.uid() and tbl = 'measurements';
end;
$$;

revoke all on function public.forget_my_measurements() from public, anon;
grant execute on function public.forget_my_measurements() to authenticated;
