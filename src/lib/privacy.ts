import { activeDbName } from '../sync/activeDb';
import { db } from '../db';
import { setSetting } from './settings';

/** Versione dell'informativa: se cambia, chiediamo di nuovo il consenso. */
export const PRIVACY_VERSION = '2026-11-27';
/** Età minima in Italia per il consenso ai servizi online (art. 2-quinquies Codice privacy). */
export const MIN_AGE = 14;

export interface Consent {
  version: string;
  acceptedAt: number;
  age: boolean; // ha confermato di avere almeno MIN_AGE anni
  health: boolean; // misure del corpo nel cloud (consenso esplicito, art. 9 GDPR)
  cloud?: boolean; // consenso al cloud dato alla creazione dell'account
}

const key = () => `kaizen-health-consent:${activeDbName()}`;

/**
 * I dati sulla salute (misure del corpo) vanno nel cloud solo con il consenso.
 * Letto in modo sincrono dalla sincronizzazione, quindi sta anche in localStorage.
 */
export function healthSyncAllowed(): boolean {
  try {
    return localStorage.getItem(key()) === '1';
  } catch {
    return false;
  }
}

function mirror(health: boolean) {
  try {
    localStorage.setItem(key(), health ? '1' : '0');
  } catch {
    /* niente */
  }
}

export async function saveConsent(c: Omit<Consent, 'version' | 'acceptedAt'>) {
  mirror(c.health);
  await setSetting('consent', { ...c, version: PRIVACY_VERSION, acceptedAt: Date.now() });
}

/**
 * Cambia il consenso alle misure nel cloud. Acceso: le misure già presenti partono per il cloud.
 * Spento: le misure restano qui e vengono tolte dal cloud (serve essere collegati).
 */
export async function setHealthConsent(on: boolean, current: Consent, forgetRemote: () => Promise<void>) {
  if (!on) await forgetRemote();
  await saveConsent({ age: current.age, cloud: current.cloud, health: on });
  if (on) {
    const all = await db.measurements.toArray();
    if (all.length) await db.measurements.bulkPut(all);
  }
}

/** All'avvio: allinea la copia locale al consenso salvato (che può arrivare da un altro dispositivo). */
export async function syncConsentMirror() {
  const c = (await db.settings.get('consent'))?.value as Consent | null | undefined;
  mirror(!!c?.health);
}

export const consentValid = (c: Consent | null | undefined) => !!c && c.version === PRIVACY_VERSION && c.age;
