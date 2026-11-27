/**
 * Codici unici per le righe nuove, così due dispositivi non creano mai lo stesso id.
 * Basati sul tempo (restano in ordine di creazione) e sempre più grandi degli id già esistenti.
 */
let last = 0;
export function newId(): number {
  let n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (n <= last) n = last + 1;
  last = n;
  return n;
}

/** Id fisso per le voci automatiche (stessa autoKey = stesso id su ogni dispositivo). */
export function idFromKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 4e15 + h * 1000;
}
