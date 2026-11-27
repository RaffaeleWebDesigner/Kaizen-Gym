import { db, type Exercise, type Template, type TemplateRow } from './db';
import { DEFAULT_SETTINGS } from './lib/settings';
import { todayISO } from './lib/dates';
import { isFreshDb } from './sync/activeDb';

type ExSeed = Omit<Exercise, 'id' | 'substituteIds'> & { key: string; subs: string[] };

const base = { bodyweight: false, isBarbell: false, barWeight: null, perHand: false, stackStep: null, type: 'reps' as const, unit: 'kg' as const };

const EXERCISES: ExSeed[] = [
  { ...base, key: 'goblet', name: 'Goblet squat', group: 'gambe', increment: 1, restSec: 90,
    cues: ['Petto alto, manubrio attaccato allo sterno', 'Scendi controllato, talloni sempre a terra'], subs: ['split', 'rdl'] },
  { ...base, key: 'panca', name: 'Panca piana con bilanciere', group: 'spinta', isBarbell: true, increment: 2.5, restSec: 120,
    cues: ['Scapole strette e piedi ben piantati', 'Polsi dritti sopra i gomiti, bilanciere sul palmo basso'], subs: ['panca_man', 'push', 'dip'] },
  { ...base, key: 'lat', name: 'Lat machine', group: 'tirata', unit: 'lb', stackStep: 15, increment: 15, restSec: 90,
    cues: ['Tira coi gomiti verso i fianchi', 'Petto alto, niente slancio col busto'], subs: ['rematore', 'trazioni'] },
  { ...base, key: 'shoulder', name: 'Shoulder press con manubri da seduto', group: 'spinta', perHand: true, increment: 1, restSec: 90,
    cues: ['Schiena appoggiata, addome attivo', 'Spingi in verticale senza inarcare'], subs: ['lento', 'panca_man'] },
  { ...base, key: 'plank', name: 'Plank', group: 'core', type: 'time', bodyweight: true, increment: 5, restSec: 60,
    cues: ['Linea dritta da testa a talloni', 'Glutei e addome stretti, respira'], subs: ['plank_lat', 'deadbug'] },
  { ...base, key: 'trazioni', name: 'Trazioni alla sbarra', group: 'tirata', bodyweight: true, increment: 0, restSec: 120,
    cues: ['Parti da braccia distese, spalle basse', 'Mento sopra la sbarra senza slanci'], subs: ['lat', 'rematore'] },
  { ...base, key: 'rematore', name: 'Rematore con manubrio', group: 'tirata', perHand: true, increment: 1, restSec: 90,
    cues: ['Mano e ginocchio sulla panca, schiena piatta', 'Porta il gomito verso il fianco'], subs: ['lat'] },
  { ...base, key: 'lento', name: 'Lento avanti con manubri in piedi', group: 'spinta', perHand: true, increment: 1, restSec: 90,
    cues: ['Glutei e addome stretti, niente schiena arcuata', 'Manubri sopra la testa in linea con le orecchie'], subs: ['shoulder'] },
  { ...base, key: 'curl', name: 'Curl con bilanciere EZ', group: 'tirata', isBarbell: true, increment: 2.5, restSec: 75,
    cues: ['Gomiti fermi lungo i fianchi', 'Scendi lento fino a braccia distese'], subs: ['rematore'] },
  { ...base, key: 'knee', name: 'Knee raise alla sbarra', group: 'core', bodyweight: true, increment: 0, restSec: 60,
    cues: ['Niente dondolio, spalle attive', 'Porta le ginocchia al petto e scendi piano'], subs: ['deadbug', 'plank'] },
  { ...base, key: 'rdl', name: 'Stacco rumeno con manubri', group: 'gambe', perHand: true, increment: 1, restSec: 90,
    cues: ['Schiena neutra, spingi il bacino indietro', 'Manubri vicini alle gambe, ginocchia morbide'], subs: ['goblet'] },
  { ...base, key: 'split', name: 'Split squat con manubri', group: 'gambe', perHand: true, increment: 1, restSec: 90,
    cues: ['Busto dritto, scendi in verticale', 'Ginocchio davanti in linea con il piede'], subs: ['goblet'] },
  { ...base, key: 'dip', name: 'Dip alle parallele', group: 'spinta', bodyweight: true, increment: 0, restSec: 120,
    cues: ['Scendi solo fin dove le spalle stanno bene', 'Busto leggermente avanti, gomiti indietro'], subs: ['push', 'panca_man'] },
  { ...base, key: 'plank_lat', name: 'Plank laterale', group: 'core', type: 'time', bodyweight: true, increment: 5, restSec: 45,
    cues: ['Gomito sotto la spalla', 'Bacino alto, corpo in linea'], subs: ['plank'] },
  { ...base, key: 'push', name: 'Piegamenti', group: 'spinta', bodyweight: true, increment: 0, restSec: 60,
    cues: ['Corpo rigido come una tavola', 'Gomiti a 45° dal busto'], subs: ['panca_man'] },
  { ...base, key: 'panca_man', name: 'Panca inclinata con manubri', group: 'spinta', perHand: true, increment: 1, restSec: 90,
    cues: ['Panca a 30°, scapole strette', 'Polsi neutri, scendi controllato'], subs: ['push'] },
  { ...base, key: 'deadbug', name: 'Dead bug', group: 'core', bodyweight: true, increment: 0, restSec: 45,
    cues: ['Zona lombare schiacciata a terra', 'Braccio e gamba opposti, lenti'], subs: ['plank'] },
];

type RowSeed = [key: string, sets: number, repMin: number, repMax: number, startLoad: number];

const TEMPLATES: { code: Template['code']; name: string; rows: RowSeed[] }[] = [
  { code: 'A', name: 'Seduta A', rows: [
    ['goblet', 2, 8, 12, 12], ['panca', 3, 8, 10, 30], ['lat', 3, 10, 12, 45], ['shoulder', 2, 8, 12, 6], ['plank', 2, 30, 60, 0],
  ] },
  { code: 'B', name: 'Seduta B', rows: [
    ['trazioni', 3, 3, 8, 0], ['rematore', 3, 8, 12, 10], ['lento', 2, 8, 12, 6], ['curl', 2, 10, 12, 10], ['knee', 2, 8, 12, 0],
  ] },
  { code: 'C', name: 'Seduta C', rows: [
    ['rdl', 2, 10, 12, 10], ['split', 2, 8, 12, 6], ['dip', 2, 5, 10, 0], ['rematore', 2, 10, 12, 10], ['plank_lat', 2, 20, 40, 0],
  ] },
  { code: 'MIN', name: 'Seduta minima', rows: [
    ['goblet', 2, 8, 12, 12], ['push', 2, 8, 15, 0], ['lat', 2, 10, 12, 45], ['plank', 1, 30, 60, 0],
  ] },
];

/**
 * Primo avvio di un archivio. `fresh`: archivio di un account nuovo, che parte da zero
 * (solo catalogo di esercizi, modelli e impostazioni predefinite).
 */
export async function seedIfEmpty(fresh = isFreshDb()): Promise<void> {
  const seeded = await db.settings.get('seeded');
  if (seeded) return;
  await db.transaction('rw', [db.settings, db.exercises, db.templates, db.sessions, db.dayMarks, db.matches, db.measurements], async () => {
    if (await db.settings.get('seeded')) return;
    const ids: Record<string, number> = {};
    for (const e of EXERCISES) {
      const { key, subs: _subs, ...rest } = e;
      ids[key] = await db.exercises.add({ ...rest, substituteIds: [] });
    }
    for (const e of EXERCISES) await db.exercises.update(ids[e.key], { substituteIds: e.subs.map((k) => ids[k]) });

    const exById = new Map((await db.exercises.toArray()).map((x) => [x.id!, x]));
    for (const t of TEMPLATES) {
      const rows: TemplateRow[] = t.rows.map(([k, sets, repMin, repMax, startLoad]) => ({
        exerciseId: ids[k], sets, repMin, repMax, startLoad, restSec: exById.get(ids[k])!.restSec,
      }));
      await db.templates.add({ code: t.code, name: t.name, rows });
    }

    const s = { ...DEFAULT_SETTINGS, createdAt: Date.now(), ...(fresh ? { startDate: todayISO(), freshAccount: true } : {}) };
    await db.settings.bulkPut(Object.entries(s).map(([key, value]) => ({ key, value })));
    await db.settings.put({ key: 'seeded', value: true });
  });
}
