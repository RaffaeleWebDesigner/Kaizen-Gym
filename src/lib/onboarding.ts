import { db, type Exercise, type Template, type TemplateRow, type Unit } from '../db';
import { setSetting, type BarInv, type PlateInv } from './settings';

// ---------- risposte del percorso di benvenuto ----------

export type Goal = 'forza' | 'massa' | 'dimagrire' | 'salute';
export type Experience = 'principiante' | 'intermedio' | 'esperto';
export type Place = 'palestra' | 'casa' | 'entrambi';
export type Equip = 'manubri' | 'bilanciere' | 'rack' | 'panca' | 'sbarra' | 'parallele' | 'cavi' | 'macchine';
export type MachineStep = { value: number; unit: Unit };

export interface Profile {
  goal: Goal;
  experience: Experience;
  place: Place;
  equipment: Equip[]; // attrezzatura di casa (palestra = tutto)
  unit: Unit;
  machineStep: MachineStep;
  days: number;
  gymDays: number[]; // 0 = lunedì
  safetyFlags: string[];
  acceptedAt: number;
}

export const GOAL_LABEL: Record<Goal, string> = {
  forza: 'Diventare più forte',
  massa: 'Mettere muscoli',
  dimagrire: 'Dimagrire e tonificare',
  salute: 'Stare bene e in forma',
};

export const EXPERIENCE_LABEL: Record<Experience, { title: string; text: string }> = {
  principiante: { title: 'Principiante', text: 'Mai fatto pesi, o fermo da più di un anno' },
  intermedio: { title: 'Qualche mese', text: 'Conosco gli esercizi base, mi alleno da meno di un anno' },
  esperto: { title: 'Più di un anno', text: 'Mi alleno con costanza e so gestire i carichi' },
};

export const PLACE_LABEL: Record<Place, { title: string; text: string }> = {
  palestra: { title: 'In palestra', text: 'Palestra con macchine, bilancieri e manubri' },
  casa: { title: 'A casa', text: 'Con la mia attrezzatura, anche poca o nessuna' },
  entrambi: { title: 'Un po’ e un po’', text: 'Palestra di solito, casa quando non riesco' },
};

export const EQUIP_LABEL: Record<Equip, string> = {
  manubri: 'Manubri',
  bilanciere: 'Bilanciere e dischi',
  rack: 'Rack o gabbia per lo squat',
  panca: 'Panca',
  sbarra: 'Sbarra per trazioni',
  parallele: 'Parallele per dip',
  cavi: 'Cavi o lat machine',
  macchine: 'Macchine a pacco pesi (leg press, chest press…)',
};

export const ALL_EQUIP = Object.keys(EQUIP_LABEL) as Equip[];

export const MACHINE_STEPS: MachineStep[] = [
  { value: 5, unit: 'kg' },
  { value: 2.5, unit: 'kg' },
  { value: 10, unit: 'lb' },
  { value: 15, unit: 'lb' },
];

export const SAFETY_QUESTIONS: { key: string; text: string }[] = [
  { key: 'cuore', text: 'Un medico ti ha mai detto che hai un problema al cuore o alla pressione?' },
  { key: 'petto', text: 'Ti capita di sentire dolore al petto durante uno sforzo o a riposo?' },
  { key: 'svenimenti', text: 'Ti capita di avere capogiri forti o di perdere i sensi?' },
  { key: 'articolazioni', text: 'Hai un problema a ossa, articolazioni o schiena che peggiora con l’attività fisica?' },
  { key: 'farmaci', text: 'Prendi farmaci per il cuore o la pressione?' },
  { key: 'gravidanza', text: 'Sei in gravidanza o hai partorito da poco?' },
];

/** Attrezzatura usata per costruire le sedute. */
export function equipmentFor(p: Pick<Profile, 'place' | 'equipment'>): Equip[] {
  return p.place === 'casa' ? p.equipment : ALL_EQUIP;
}

// ---------- esercizi che servono ai programmi e non erano nel catalogo ----------

const exBase = { type: 'reps' as const, unit: 'kg' as const, bodyweight: false, isBarbell: false, barWeight: null, perHand: false, stackStep: null, substituteIds: [], barId: null, rankKey: null };

export const EXTRA_EXERCISES: Omit<Exercise, 'id'>[] = [
  { ...exBase, name: 'Squat con bilanciere', group: 'gambe', isBarbell: true, increment: 2.5, restSec: 150, barId: 'olimpico', rankKey: 'squat',
    cues: ['Bilanciere sui trapezi, petto alto', 'Scendi con le ginocchia in linea con i piedi, risali spingendo coi talloni'] },
  { ...exBase, name: 'Leg press', group: 'gambe', increment: 5, stackStep: 5, restSec: 120,
    cues: ['Schiena e bacino sempre appoggiati', 'Scendi finché il bacino non si stacca, non bloccare le ginocchia in alto'] },
  { ...exBase, name: 'Squat a corpo libero', group: 'gambe', bodyweight: true, increment: 0, restSec: 60,
    cues: ['Piedi alla larghezza delle spalle, braccia avanti', 'Scendi come per sederti, talloni a terra'] },
  { ...exBase, name: 'Affondi a corpo libero', group: 'gambe', bodyweight: true, increment: 0, restSec: 60,
    cues: ['Passo lungo, busto dritto', 'Il ginocchio dietro sfiora il pavimento'] },
  { ...exBase, name: 'Ponte glutei', group: 'gambe', bodyweight: true, increment: 0, restSec: 60,
    cues: ['Piedi vicini al sedere, spingi coi talloni', 'Stringi i glutei in alto per un secondo'] },
  { ...exBase, name: 'Pike push-up', group: 'spinta', bodyweight: true, increment: 0, restSec: 75,
    cues: ['Bacino alto, corpo a V rovesciata', 'Porta la testa verso il pavimento tra le mani'] },
  { ...exBase, name: 'Rematore inverso', group: 'tirata', bodyweight: true, increment: 0, restSec: 75,
    cues: ['Sotto un tavolo robusto o una sbarra bassa, corpo dritto', 'Tira il petto verso il bordo, scendi lento'] },
  { ...exBase, name: 'Curl con manubri', group: 'tirata', perHand: true, increment: 1, restSec: 60,
    cues: ['Gomiti fermi ai fianchi', 'Sali e scendi lento, niente slancio'] },
];

// ---------- costruzione delle sedute ----------

type Cand = { name: string; needs: Equip[]; adv?: boolean };
type Slot = { cands: Cand[]; main?: boolean; optional?: boolean };
const c = (name: string, needs: Equip[] = [], adv = false): Cand => ({ name, needs, adv });

const LEGS: Cand[] = [c('Squat con bilanciere', ['bilanciere', 'rack']), c('Leg press', ['macchine']), c('Goblet squat', ['manubri']), c('Squat a corpo libero')];
const PUSH_H: Cand[] = [c('Panca piana con bilanciere', ['bilanciere', 'panca']), c('Panca inclinata con manubri', ['manubri', 'panca']), c('Chest press', ['macchine']), c('Piegamenti')];
const PULL_V_EASY: Cand[] = [c('Lat machine', ['cavi']), c('Trazioni alla sbarra', ['sbarra'], true), c('Rematore con manubrio', ['manubri']), c('Rematore inverso')];
const PUSH_V: Cand[] = [c('Shoulder press con manubri da seduto', ['manubri', 'panca']), c('Lento avanti con manubri in piedi', ['manubri']), c('Pike push-up')];
const PULL_V: Cand[] = [c('Trazioni alla sbarra', ['sbarra'], true), c('Lat machine', ['cavi']), c('Rematore inverso')];
const ROW: Cand[] = [c('Rematore con manubrio', ['manubri']), c('Pulley basso', ['cavi']), c('Rematore inverso')];
const PUSH_V2: Cand[] = [c('Military press con bilanciere', ['bilanciere'], true), c('Lento avanti con manubri in piedi', ['manubri']), c('Pike push-up')];
const ARMS: Cand[] = [c('Curl con bilanciere EZ', ['bilanciere']), c('Curl con manubri', ['manubri']), c('Curl al cavo basso', ['cavi'])];
const CORE_B: Cand[] = [c('Knee raise alla sbarra', ['sbarra']), c('Dead bug')];
const HINGE: Cand[] = [c('Stacco da terra', ['bilanciere'], true), c('Stacco rumeno con manubri', ['manubri']), c('Ponte glutei')];
const SINGLE_LEG: Cand[] = [c('Split squat con manubri', ['manubri']), c('Affondi a corpo libero')];
const PUSH_C: Cand[] = [c('Dip alle parallele', ['parallele'], true), c('Chest press', ['macchine']), c('Piegamenti')];
const ROW_C: Cand[] = [c('Pulley basso', ['cavi']), c('Rematore con manubrio', ['manubri']), c('Rematore inverso')];

const PLAN: { code: Template['code']; name: string; slots: Slot[] }[] = [
  { code: 'A', name: 'Seduta A', slots: [
    { cands: LEGS, main: true }, { cands: PUSH_H, main: true }, { cands: PULL_V_EASY, main: true }, { cands: PUSH_V }, { cands: [c('Plank')] },
  ] },
  { code: 'B', name: 'Seduta B', slots: [
    { cands: PULL_V, main: true }, { cands: ROW, main: true }, { cands: PUSH_V2, main: true }, { cands: ARMS, optional: true }, { cands: CORE_B },
  ] },
  { code: 'C', name: 'Seduta C', slots: [
    { cands: HINGE, main: true }, { cands: SINGLE_LEG, main: true }, { cands: PUSH_C, main: true }, { cands: ROW_C }, { cands: [c('Plank laterale')] },
  ] },
  { code: 'MIN', name: 'Seduta minima', slots: [
    { cands: LEGS.filter((x) => x.name !== 'Squat con bilanciere') }, { cands: [c('Piegamenti')] }, { cands: PULL_V_EASY.filter((x) => !x.adv) }, { cands: [c('Plank')] },
  ] },
];

export interface PlanRow { name: string; sets: number; repMin: number; repMax: number }
export interface PlanTemplate { code: Template['code']; name: string; rows: PlanRow[] }

const TIME_EX = new Set(['Plank', 'Plank laterale']);
const BW_RANGE: Record<string, [number, number]> = {
  'Trazioni alla sbarra': [3, 8], 'Dip alle parallele': [5, 10], 'Piegamenti': [6, 15], 'Rematore inverso': [6, 12],
  'Pike push-up': [5, 10], 'Knee raise alla sbarra': [8, 12], 'Dead bug': [8, 12], 'Squat a corpo libero': [12, 20],
  'Affondi a corpo libero': [8, 12], 'Ponte glutei': [12, 20],
};
const GOAL_RANGE: Record<Goal, [number, number]> = { forza: [5, 8], massa: [8, 12], dimagrire: [10, 15], salute: [10, 15] };

/** Sceglie gli esercizi e le fasce di ripetizioni dalle risposte. Funzione pura. */
export function buildPlan(p: Pick<Profile, 'goal' | 'experience' | 'place' | 'equipment'>): PlanTemplate[] {
  const have = new Set(equipmentFor(p));
  const beginner = p.experience === 'principiante';
  return PLAN.map((t) => {
    const used = new Set<string>();
    const rows: PlanRow[] = [];
    for (const slot of t.slots) {
      const pick = slot.cands.find((x) => !used.has(x.name) && !(beginner && x.adv) && x.needs.every((n) => have.has(n)));
      if (!pick) continue; // slot facoltativo senza attrezzatura (o tutto già usato)
      used.add(pick.name);
      const sets = t.code === 'MIN' ? (beginner ? 1 : 2) : beginner ? 2 : slot.main ? 3 : 2;
      let range: [number, number];
      if (TIME_EX.has(pick.name)) range = beginner ? [20, 40] : [30, 60];
      else if (BW_RANGE[pick.name]) range = BW_RANGE[pick.name];
      else if (slot.main) range = GOAL_RANGE[p.goal];
      else range = p.goal === 'forza' ? [8, 12] : [10, 15];
      rows.push({ name: pick.name, sets, repMin: range[0], repMax: range[1] });
    }
    return { code: t.code, name: t.name, rows };
  });
}

// ---------- inventario predefinito in base a dove ti alleni ----------

export function defaultInventory(p: Pick<Profile, 'place' | 'equipment' | 'unit'>): { plates: PlateInv[]; bars: BarInv[] } {
  const gym = p.place !== 'casa';
  const lb = p.unit === 'lb';
  const plates = (lb ? (gym ? [45, 35, 25, 10, 5, 2.5] : [25, 10, 5, 2.5]) : gym ? [20, 15, 10, 5, 2.5, 1.25] : [10, 5, 2.5, 1.25])
    .map((w) => ({ weight: lb ? Math.round(w * 0.45359237 * 1000) / 1000 : w, count: null }));
  const bars: BarInv[] = gym
    ? [{ id: 'olimpico', name: 'Bilanciere olimpico', kind: 'dritto', weight: lb ? 20.4 : 20 }, { id: 'ez', name: 'Bilanciere EZ', kind: 'ez', weight: null }]
    : equipmentFor(p).includes('bilanciere')
      ? [{ id: 'olimpico', name: 'Bilanciere', kind: 'dritto', weight: null }, { id: 'ez', name: 'Bilanciere EZ', kind: 'ez', weight: null }]
      : [];
  return { plates, bars };
}

// ---------- applicazione al database ----------

/** Salva il profilo, aggiunge gli esercizi mancanti e riscrive le sedute A/B/C/minima. */
export async function applyOnboarding(p: Profile): Promise<void> {
  const plan = buildPlan(p);
  const inv = defaultInventory(p);
  await db.transaction('rw', [db.settings, db.exercises, db.templates], async () => {
    let all = await db.exercises.toArray();
    for (const e of EXTRA_EXERCISES) if (!all.some((x) => x.name === e.name)) await db.exercises.add(e);
    all = await db.exercises.toArray();

    // unità e pacchi pesi
    for (const e of all) {
      const patch: Partial<Exercise> = {};
      if (e.stackStep) Object.assign(patch, { unit: p.machineStep.unit, stackStep: p.machineStep.value, increment: p.machineStep.value });
      else if (!e.bodyweight && e.type === 'reps') {
        if (p.unit === 'lb') Object.assign(patch, { unit: 'lb', increment: e.isBarbell ? 5 : 2.5 });
        else Object.assign(patch, { unit: 'kg', increment: e.isBarbell ? 2.5 : 1 });
      }
      if (e.isBarbell && e.barId && e.barId !== 'ez') patch.barId = inv.bars.some((b) => b.id === 'olimpico') ? 'olimpico' : null;
      if (Object.keys(patch).length) await db.exercises.update(e.id!, patch);
    }

    const byName = new Map(all.map((e) => [e.name, e]));
    for (const t of plan) {
      const rows: TemplateRow[] = t.rows.map((r) => {
        const ex = byName.get(r.name)!;
        return { exerciseId: ex.id!, sets: r.sets, repMin: r.repMin, repMax: r.repMax, startLoad: 0, restSec: ex.restSec };
      });
      const existing = await db.templates.where('code').equals(t.code).first();
      if (existing) await db.templates.update(existing.id!, { name: t.name, rows });
      else await db.templates.add({ code: t.code, name: t.name, rows });
    }

    await setSetting('plates', inv.plates);
    await setSetting('bars', inv.bars);
    await setSetting('weeklyGoal', p.days);
    await setSetting('gymDays', p.gymDays);
    await setSetting('lbPerBlock', p.machineStep.unit === 'lb' ? p.machineStep.value : 15);
    await setSetting('profile', p);
    await setSetting('onboarded', true);
  });
}
