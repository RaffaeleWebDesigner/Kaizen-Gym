// Tutte le date dell'app sono stringhe locali "YYYY-MM-DD".

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  // a - b in giorni
  const ms = fromISO(a).getTime() - fromISO(b).getTime();
  return Math.round(ms / 86400000);
}

/** 0 = lunedì ... 6 = domenica */
export function weekdayMon(s: string): number {
  return (fromISO(s).getDay() + 6) % 7;
}

export function mondayOf(s: string): string {
  return addDays(s, -weekdayMon(s));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const DAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export const dayName = (s: string) => DAYS[weekdayMon(s)];
export const dayShort = (s: string) => DAYS_SHORT[weekdayMon(s)];
export const DAY_SHORT_LIST = DAYS_SHORT;
export const monthName = (m: number) => MONTHS[m];

export function fmtDate(s: string): string {
  const d = fromISO(s);
  return `${DAYS_SHORT[weekdayMon(s)]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function fmtDateLong(s: string): string {
  const d = fromISO(s);
  return `${DAYS[weekdayMon(s)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateFull(s: string): string {
  const d = fromISO(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function isoRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
