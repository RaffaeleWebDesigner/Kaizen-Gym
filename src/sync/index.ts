import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import { SyncEngine, type Choice, type FirstSyncPlan } from './engine';
import { onLocalChange } from './middleware';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { activeDbName, dbForUser, dbNameForNewUser, isFreshDb, registerDb, switchDb } from './activeDb';

export type SyncPhase = 'loading' | 'signedOut' | 'notLinked' | 'ask' | 'syncing' | 'ok' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  email: string | null;
  lastSyncAt: number | null;
  pending: number;
  error: string | null;
  ask: Extract<FirstSyncPlan, { kind: 'ask' }> | null;
  backupAt: number | null; // copia interna fatta prima del primo collegamento
}

let status: SyncStatus = { phase: 'loading', email: null, lastSyncAt: null, pending: 0, error: null, ask: null, backupAt: null };
const subs = new Set<() => void>();
function set(p: Partial<SyncStatus>) {
  status = { ...status, ...p };
  subs.forEach((f) => f());
}
export function useSync(): SyncStatus {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => status);
}

let client: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce', detectSessionInUrl: true, storageKey: 'kaizen-auth' } }),
  );
  return client;
}
let engine: SyncEngine | null = null;
async function eng(): Promise<SyncEngine> {
  if (!engine) {
    const { SupabaseRemote } = await import('./supabaseRemote');
    engine = new SyncEngine(db, new SupabaseRemote(await sb()));
  }
  return engine;
}

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Invalid login credentials/i.test(m)) return 'Email o password sbagliate.';
  if (/Email not confirmed/i.test(m)) return 'Prima conferma l’email: apri il link che ti è arrivato, poi accedi qui.';
  if (/already registered|already exists/i.test(m)) return 'Esiste già un account con questa email: usa Accedi.';
  if (/Password should be|at least 6/i.test(m)) return 'La password deve avere almeno 6 caratteri.';
  if (/push_rows|kaizen_rows|schema cache|does not exist/i.test(m)) return 'Il database su Supabase non è ancora pronto: manca lo script SQL.';
  if (/rate limit/i.test(m)) return 'Troppi tentativi: riprova tra qualche minuto.';
  const name = e instanceof Error && e.name && e.name !== 'Error' ? e.name + ': ' : '';
  if (/^(Failed to fetch|NetworkError|Load failed)/i.test(m)) return `Cloud non raggiungibile: sei offline, oppure il progetto Supabase è in pausa. (Dettaglio: ${name}${m})`;
  return `Errore: ${name}${m}`;
}

async function refreshInfo() {
  const st = await db.syncState.bulkGet(['lastSyncAt', 'preSyncBackupAt']);
  set({ pending: await db.outbox.count(), lastSyncAt: (st[0]?.value as number) ?? null, backupAt: (st[1]?.value as number) ?? null });
}

async function currentUser() {
  const { data, error } = await (await sb()).auth.getSession();
  if (error) throw error; // per esempio offline mentre l'accesso va rinnovato: non è un'uscita dall'account
  return data.session?.user ?? null;
}

/** Stato dopo l'accesso: questo dispositivo è già collegato a questo account? */
async function evaluate() {
  const user = await currentUser();
  await refreshInfo();
  if (!user) return set({ phase: 'signedOut', email: null, ask: null });
  set({ email: user.email ?? null });
  const linkedTo = (await db.syncState.get('userId'))?.value as string | undefined;
  if (linkedTo === user.id) {
    registerDb(user.id);
    return syncNow();
  }
  const known = dbForUser(user.id);
  if (linkedTo || (known && known !== activeDbName())) {
    // questo archivio è di un altro account: passo all'archivio di questo account (nuovo e vuoto se non c'è)
    return openDbFor(user.id);
  }
  if (isFreshDb()) return link(); // archivio appena creato per questo account: collego subito
  set({ phase: status.ask ? 'ask' : 'notLinked' });
}

// ---------- sincronizzazione ----------
let running: Promise<void> | null = null;
let again = false;
let exclusive = false; // primo collegamento o azzeramento in corso: niente sincronizzazioni normali in mezzo

export function syncNow(): Promise<void> {
  if (exclusive) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const user = await currentUser();
        if (!user) return set({ phase: 'signedOut' });
        if ((await db.syncState.get('userId'))?.value !== user.id) return;
        set({ phase: 'syncing', error: null });
        const r = await (await eng()).sync();
        if (r.received) {
          const { syncDerived } = await import('../lib/derived');
          await syncDerived();
        }
        await refreshInfo();
        set({ phase: 'ok' });
      } while (again);
    } catch (e) {
      await refreshInfo();
      set({ phase: 'error', error: friendlyError(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

function openDbFor(userId: string) {
  const known = dbForUser(userId);
  switchDb(known ?? dbNameForNewUser(userId), !known);
  set({ phase: 'loading' });
  location.reload();
}

/** Copia interna di tutti i dati (foto escluse), da ripristinare se qualcosa va storto. */
async function internalBackup() {
  const { exportAll } = await import('../lib/exportData');
  await db.syncState.bulkPut([{ key: 'preSyncBackup', value: await exportAll() }, { key: 'preSyncBackupAt', value: Date.now() }]);
}

export async function restoreInternalBackup() {
  const json = (await db.syncState.get('preSyncBackup'))?.value as string | undefined;
  if (!json) throw new Error('Nessuna copia salvata.');
  const { importAll } = await import('../lib/exportData');
  await importAll(json);
}

/** Primo collegamento di questo dispositivo all'account. */
export async function link(choice?: Choice): Promise<void> {
  const user = await currentUser();
  if (!user) return set({ phase: 'signedOut' });
  set({ phase: 'syncing', error: null });
  await running;
  exclusive = true;
  try {
    await internalBackup();
    const plan = await (await eng()).firstSync(user.id, choice);
    if (plan.kind === 'fresh') return openDbFor(user.id); // account nuovo: parte da zero
    if (plan.kind === 'ask' && !choice) {
      await refreshInfo();
      return set({ phase: 'ask', ask: plan });
    }
    set({ ask: null });
    registerDb(user.id);
    const { syncDerived } = await import('../lib/derived');
    await syncDerived();
    exclusive = false;
    await syncNow();
  } catch (e) {
    await refreshInfo();
    set({ phase: 'error', error: friendlyError(e) });
  } finally {
    exclusive = false;
  }
}

/**
 * Ricomincia da zero: cancella tutti i dati di questo account (qui, nel cloud e quindi sugli altri dispositivi),
 * tenendo esercizi e modelli predefiniti. Le foto di questo dispositivo restano. Prima salva la copia interna.
 */
export async function resetAccount(): Promise<void> {
  const user = await currentUser();
  if (!user || (await db.syncState.get('userId'))?.value !== user.id) throw new Error('Accedi e collega prima il dispositivo.');
  set({ phase: 'syncing', error: null });
  await running;
  exclusive = true;
  try {
    await internalBackup();
    const e = await eng();
    await e.wipeLocal();
    const { seedIfEmpty } = await import('../seed');
    const { ensureV2, ensureV3, ensureMachines } = await import('../migrations');
    await seedIfEmpty(true);
    await ensureV2();
    await ensureV3();
    await ensureMachines();
    await e.firstSync(user.id, undefined, 'replaceCloud');
    const { syncDerived } = await import('../lib/derived');
    await syncDerived();
    exclusive = false;
    await syncNow();
  } catch (x) {
    await refreshInfo();
    set({ phase: 'error', error: friendlyError(x) });
  } finally {
    exclusive = false;
  }
}

// ---------- account ----------
export async function signIn(email: string, password: string) {
  const { error } = await (await sb()).auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyError(error));
  await evaluate();
}

/** Restituisce true se serve confermare l'email. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const redirect = location.origin + location.pathname;
  const { data, error } = await (await sb()).auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
  if (error) throw new Error(friendlyError(error));
  if (!data.session) return true;
  await evaluate();
  return false;
}

/** Esce dall'account: i dati restano su questo dispositivo. */
export async function signOut() {
  await (await sb()).auth.signOut();
  set({ phase: 'signedOut', email: null, ask: null, error: null });
}

// ---------- avvio ----------
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let infoTimer: ReturnType<typeof setTimeout> | undefined;

export function startSync() {
  if (started) return;
  started = true;
  // senza un accesso salvato non carico nemmeno la libreria di Supabase
  const hasSession = (() => {
    try {
      return !!localStorage.getItem('kaizen-auth') || /[?&]code=/.test(location.search);
    } catch {
      return false;
    }
  })();
  if (hasSession) evaluate().catch((e) => set({ phase: 'error', error: friendlyError(e) }));
  else set({ phase: 'signedOut' });

  onLocalChange(() => {
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => void refreshInfo(), 300);
    if (status.phase === 'signedOut' || status.phase === 'notLinked' || status.phase === 'ask' || status.phase === 'loading') return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 2500);
  });
  const kick = () => {
    if (status.phase === 'ok') void syncNow();
    else if (status.phase === 'error') evaluate().catch((e) => set({ phase: 'error', error: friendlyError(e) }));
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && kick());
  window.addEventListener('online', kick);
  setInterval(() => document.visibilityState === 'visible' && kick(), 60_000);
}
