import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { db, type Photo } from '../db';
import { addDays, diffDays, todayISO } from './dates';

export const MAX_SIDE = 1080;
export const POSE_LABEL: Record<Photo['pose'], string> = { front: 'Frontale', side: 'Laterale' };

/** Ridimensiona a ~1080px sul lato lungo e comprime in JPEG. */
export async function compressImage(source: CanvasImageSource, w: number, h: number, mirror = false): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Compressione non riuscita'))), 'image/jpeg', 0.82));
  return { data: await blob.arrayBuffer(), width, height };
}

export async function fileToPhotoData(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await compressImage(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function photoUrl(p: Photo): string {
  return URL.createObjectURL(new Blob([p.data], { type: p.mime }));
}

/** Le foto si propongono ogni 4 settimane, in linea con il punto del mese. */
export function photoDue(photos: Photo[], startDate: string, today = todayISO()): boolean {
  const k = Math.max(0, Math.floor(diffDays(today, startDate) / 28));
  const blockStart = addDays(startDate, k * 28);
  return !photos.some((p) => p.date >= blockStart);
}

export async function exportPhotosZip(): Promise<Blob | null> {
  const photos = await db.photos.toArray();
  if (!photos.length) return null;
  const files: Record<string, Uint8Array> = {};
  const index = photos.map((p, i) => {
    const name = `foto/${p.date}_${p.pose === 'front' ? 'frontale' : 'laterale'}_${i + 1}.jpg`;
    files[name] = new Uint8Array(p.data);
    return { file: name, date: p.date, pose: p.pose, note: p.note ?? '', width: p.width, height: p.height, createdAt: p.createdAt };
  });
  files['indice.json'] = strToU8(JSON.stringify({ app: 'metodo-kaizen-foto', version: 1, photos: index }, null, 2));
  const zipped = zipSync(files, { level: 0 }); // i JPEG sono già compressi
  return new Blob([zipped], { type: 'application/zip' });
}

/** Importa le foto da uno ZIP. Salta quelle già presenti (stessa data, tipo e dimensione). */
export async function importPhotosZip(buf: ArrayBuffer): Promise<{ added: number; skipped: number }> {
  const files = unzipSync(new Uint8Array(buf));
  const idx = files['indice.json'];
  if (!idx) throw new Error('Lo ZIP non contiene indice.json: non sembra un backup delle foto di Metodo Kaizen.');
  const parsed = JSON.parse(strFromU8(idx));
  if (parsed?.app !== 'metodo-kaizen-foto') throw new Error('Lo ZIP non è un backup delle foto di Metodo Kaizen.');
  const existing = await db.photos.toArray();
  let added = 0;
  let skipped = 0;
  for (const p of parsed.photos as { file: string; date: string; pose: Photo['pose']; note: string; width: number; height: number; createdAt: number }[]) {
    const bytes = files[p.file];
    if (!bytes) continue;
    if (existing.some((e) => e.date === p.date && e.pose === p.pose && e.data.byteLength === bytes.byteLength)) {
      skipped++;
      continue;
    }
    const copy = bytes.slice().buffer;
    await db.photos.add({ date: p.date, pose: p.pose, note: p.note, width: p.width, height: p.height, createdAt: p.createdAt ?? Date.now(), mime: 'image/jpeg', data: copy });
    added++;
  }
  return { added, skipped };
}
