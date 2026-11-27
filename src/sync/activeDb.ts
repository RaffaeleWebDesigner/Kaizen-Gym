/**
 * Ogni account ha il suo archivio locale (database IndexedDB) su questo dispositivo.
 * L'archivio "kaizen" è quello originale; gli altri si chiamano "kaizen-<id account>".
 */
const ACTIVE = 'kaizen-active-db';
const REGISTRY = 'kaizen-db-registry'; // { userId: nome archivio }
const FRESH = 'kaizen-fresh-dbs'; // archivi creati per un account nuovo: partono da zero

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* niente */
  }
}

export function activeDbName(): string {
  return read<string>(ACTIVE, 'kaizen');
}
export function isFreshDb(name = activeDbName()): boolean {
  return read<string[]>(FRESH, []).includes(name);
}
export function dbForUser(userId: string): string | undefined {
  return read<Record<string, string>>(REGISTRY, {})[userId];
}
export function registerDb(userId: string, name = activeDbName()) {
  const reg = read<Record<string, string>>(REGISTRY, {});
  if (reg[userId] !== name) write(REGISTRY, { ...reg, [userId]: name });
}
/** Cambia archivio. Serve ricaricare la pagina. */
export function switchDb(name: string, fresh: boolean) {
  if (fresh) write(FRESH, [...new Set([...read<string[]>(FRESH, []), name])]);
  write(ACTIVE, name);
}
export const dbNameForNewUser = (userId: string) => `kaizen-${userId}`;
