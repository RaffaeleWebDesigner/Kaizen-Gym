import Dexie, { type Table } from 'dexie';
import { syncMiddleware, type OutboxEntry } from './sync/middleware';
import { activeDbName } from './sync/activeDb';

export type MuscleGroup = 'gambe' | 'spinta' | 'tirata' | 'core';
export type Unit = 'kg' | 'lb';
export type ExerciseType = 'reps' | 'time';
export type SessionKind = 'A' | 'B' | 'C' | 'MIN' | 'FREE';

export interface Exercise {
  id?: number;
  name: string;
  group: MuscleGroup;
  type: ExerciseType; // 'time' = le "ripetizioni" sono secondi
  unit: Unit;
  bodyweight: boolean; // corpo libero: il carico è zavorra aggiuntiva
  isBarbell: boolean;
  barWeight: number | null; // nell'unità dell'esercizio, sommato ai dischi
  perHand: boolean; // carico indicato per mano/manubrio
  increment: number; // aumento minimo di carico (o secondi per gli esercizi a tempo)
  stackStep: number | null; // peso di un blocco del pacco (macchine)
  restSec: number;
  cues: string[]; // 1-2 indicazioni tecniche
  substituteIds: number[];
  archived?: boolean;
  barId?: string | null; // bilanciere dell'inventario
  rankKey?: RankKey | null; // esercizio che dà un rank
}

export type RankKey = 'panca' | 'squat' | 'stacco' | 'military' | 'trazioni' | 'dip';

export type SkipCategory = 'videogiochi' | 'sonno' | 'impegni' | 'lavoro' | 'pigrizia' | 'altro';

export const SKIP_CATEGORY_LABEL: Record<SkipCategory, string> = {
  videogiochi: 'Videogiochi',
  sonno: 'Sonno / stanchezza',
  impegni: 'Impegni',
  lavoro: 'Lavoro',
  pigrizia: 'Pigrizia',
  altro: 'Altro',
};

export interface TemplateRow {
  exerciseId: number;
  sets: number;
  repMin: number;
  repMax: number;
  startLoad: number;
  restSec: number;
}

export interface Template {
  id?: number;
  code: Exclude<SessionKind, 'FREE'>;
  name: string;
  rows: TemplateRow[];
}

export interface SetLog {
  reps: number; // secondi per esercizi a tempo
  load: number; // dischi/manubrio/pacco, senza bilanciere
  done: boolean;
}

export interface Target {
  sets: number;
  reps: number;
  load: number;
  message: string;
  advice?: 'substitute' | 'doctor_substitute';
  kind: 'first' | 'reps' | 'load' | 'same' | 'pain' | 'restart' | 'top' | 'deload' | 'after_deload';
}

export interface ExerciseLog {
  uid: string;
  exerciseId: number;
  name: string;
  group: MuscleGroup;
  type: ExerciseType;
  unit: Unit;
  bodyweight: boolean;
  isBarbell: boolean;
  barWeight: number | null;
  perHand: boolean;
  increment: number;
  stackStep: number | null;
  repMin: number;
  repMax: number;
  restSec: number;
  cues: string[];
  sets: SetLog[];
  rir: number | null;
  pain: boolean;
  stopped: boolean;
  notes: string;
  target: Target | null;
}

export interface Session {
  id?: number;
  date: string; // YYYY-MM-DD locale
  kind: SessionKind;
  status: 'in_progress' | 'done';
  startedAt: number | null;
  endedAt: number | null;
  durationMin: number | null;
  feeling: number | null; // 1-5
  notes: string;
  exercises: ExerciseLog[];
}

export type DayMarkType = 'skipped' | 'sick' | 'training_cancelled';

export interface DayMark {
  id?: number;
  date: string;
  type: DayMarkType;
  plannedKind?: SessionKind | null;
  reason?: string;
  category?: SkipCategory;
}

export interface Match {
  id?: number;
  date: string;
  time: string; // HH:MM
  venue: 'casa' | 'trasferta' | null;
  opponent?: string;
}

export interface Measurement {
  id?: number;
  date: string;
  weight?: number | null;
  bmi?: number | null;
  fatPct?: number | null;
  leanMass?: number | null;
  subcutFatPct?: number | null;
  visceralFat?: number | null;
  waterPct?: number | null;
  skeletalMusclePct?: number | null;
  muscleMass?: number | null;
  boneMass?: number | null;
  proteinPct?: number | null;
  bmr?: number | null;
  waist?: number | null;
  chest?: number | null;
  arm?: number | null;
  thigh?: number | null;
}

export interface Review {
  id?: number;
  type: 'weekly' | 'monthly';
  periodStart: string; // lunedì della settimana o inizio del blocco di 4 settimane
  createdAt: number;
  worked?: string;
  blocked?: string;
  difficulty?: 'facile' | 'giusta' | 'dura' | null;
  change?: string;
  note?: string;
}

export interface Photo {
  id?: number;
  date: string;
  pose: 'front' | 'side';
  data: ArrayBuffer; // JPEG compresso, lato lungo ~1080px
  mime: string;
  width: number;
  height: number;
  note?: string;
  createdAt: number;
}

export interface Challenge {
  id?: number;
  name: string;
  description: string;
  duration: 'day' | 'week';
  builtin: boolean;
  archived?: boolean;
  minWeeks?: number; // settimane di progetto necessarie oltre allo sblocco
  spanWeeks?: number; // durata in settimane per le sfide 'week' (default 1)
}

export interface ChallengeAttempt {
  id?: number;
  challengeId: number;
  date: string; // giorno, oppure lunedì per le sfide di una settimana
  status: 'planned' | 'completed' | 'failed';
  note?: string;
  closedAt?: number;
}

export type ClaimType = 'record' | 'settimana' | 'sfida' | 'costanza' | 'seduta' | 'misura' | 'ripresa' | 'obiettivo';

export interface Claim {
  type: ClaimType;
  exerciseId?: number;
  load?: number; // carico totale nell'unità dell'esercizio
  reps?: number;
  weekStart?: string;
  challengeId?: number;
  weeks?: number;
  pct?: number;
  date?: string; // seduta/misura: quel giorno; ripresa: giorno di malattia
  goalId?: number;
}

export interface Success {
  id?: number;
  date: string;
  title: string;
  description?: string;
  category: 'palestra' | 'calcio' | 'vita';
  claim?: Claim | null;
  source: 'manual' | 'pr' | 'challenge' | 'rank' | 'goal';
  autoKey?: string;
  createdAt: number;
}

export type GoalKind = 'streak' | 'exercise' | 'rank' | 'body' | 'habit';

export interface Goal {
  id?: number;
  kind: GoalKind;
  title: string;
  status: 'active' | 'done' | 'archived';
  createdAt: number;
  createdOn: string; // data di creazione
  doneOn?: string;
  /** streak: settimane; habit: settimane senza sedute saltate; rank: livello; body: valore; exercise: carico totale */
  target: number;
  /** exercise: ripetizioni da raggiungere a quel carico */
  targetReps?: number;
  exerciseId?: number;
  rankKey?: RankKey;
  metric?: 'weight' | 'waist';
  /** body: valore di partenza */
  baseline?: number;
  note?: string;
}

export interface RankSnap {
  id?: number;
  date: string;
  key: RankKey | 'overall';
  level: number; // 1-23
  index: number; // indice di forza (0 per overall)
  bw?: number | null; // peso corporeo usato
}

export interface SyncStateRow {
  key: string;
  value: unknown;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class KaizenDB extends Dexie {
  settings!: Table<Setting, string>;
  exercises!: Table<Exercise, number>;
  templates!: Table<Template, number>;
  sessions!: Table<Session, number>;
  dayMarks!: Table<DayMark, number>;
  matches!: Table<Match, number>;
  measurements!: Table<Measurement, number>;
  reviews!: Table<Review, number>;
  photos!: Table<Photo, number>;
  challenges!: Table<Challenge, number>;
  challengeAttempts!: Table<ChallengeAttempt, number>;
  successes!: Table<Success, number>;
  rankHistory!: Table<RankSnap, number>;
  goals!: Table<Goal, number>;
  outbox!: Table<OutboxEntry, string>;
  syncState!: Table<SyncStateRow, string>;

  constructor(name = 'kaizen') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      exercises: '++id, name, group',
      templates: '++id, &code',
      sessions: '++id, date, kind, status',
      dayMarks: '++id, date, type',
      matches: '++id, date',
      measurements: '++id, date',
      reviews: '++id, type, periodStart',
    });
    // v2: solo tabelle nuove. Le tabelle della v1 restano intatte; i valori predefiniti
    // mancanti vengono aggiunti da ensureV2() (src/migrations.ts) senza toccare i dati esistenti.
    this.version(2).stores({
      photos: '++id, date, pose',
      challenges: '++id',
      challengeAttempts: '++id, challengeId, date, status',
      successes: '++id, date, autoKey, source',
      rankHistory: '++id, date, key',
    });
    // v3: solo una tabella nuova, nessuna tabella esistente viene toccata
    this.version(3).stores({
      goals: '++id, status, kind',
    });
    // v4: sincronizzazione. Solo tabelle nuove (coda delle modifiche e stato), nessun dato toccato.
    this.version(4).stores({
      outbox: 'k, ts',
      syncState: 'key',
    });
    this.use(syncMiddleware);
  }
}

/** Archivio dell'account attivo su questo dispositivo (vedi src/sync/activeDb.ts). */
export const db = new KaizenDB(activeDbName());

export const TABLES = [
  'settings',
  'exercises',
  'templates',
  'sessions',
  'dayMarks',
  'matches',
  'measurements',
  'reviews',
  'challenges',
  'challengeAttempts',
  'successes',
  'rankHistory',
  'goals',
] as const; // le foto vanno nel backup ZIP separato

export const KIND_LABEL: Record<SessionKind, string> = {
  A: 'Seduta A',
  B: 'Seduta B',
  C: 'Seduta C',
  MIN: 'Seduta minima',
  FREE: 'Seduta libera',
};

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  gambe: 'Gambe',
  spinta: 'Spinta',
  tirata: 'Tirata',
  core: 'Core',
};
