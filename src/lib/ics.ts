import { addDays, todayISO, weekdayMon } from './dates';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/**
 * File calendario con un evento ricorrente settimanale nei giorni scelti e un avviso integrato.
 * Orario "fluttuante" (senza fuso): resta l'ora locale del telefono.
 */
export function buildIcs(days: number[], time: string, durationMin: number, alertMin: number, from = todayISO()): string {
  const sorted = [...days].sort();
  let first = from;
  while (!sorted.includes(weekdayMon(first))) first = addDays(first, 1);
  const [h, m] = time.split(':').map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + durationMin * 60000);
  const d = first.replace(/-/g, '');
  const t = (x: Date) => `${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const endDay = end.getDate() !== start.getDate() ? addDays(first, 1).replace(/-/g, '') : d;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Metodo Kaizen//Promemoria//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Metodo Kaizen',
    'BEGIN:VEVENT',
    `UID:palestra-${sorted.join('')}-${time.replace(':', '')}@metodo-kaizen`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${d}T${t(start)}`,
    `DTEND:${endDay}T${t(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${sorted.map((x) => BYDAY[x]).join(',')}`,
    'SUMMARY:Palestra – Metodo Kaizen',
    'DESCRIPTION:Presentati. Nei giorni no c’è la seduta minima (10-15 min)\\, e conta.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Palestra tra poco',
    `TRIGGER:-PT${Math.max(0, alertMin)}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
