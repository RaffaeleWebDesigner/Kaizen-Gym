import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getSettings } from './settings';

export function useData() {
  return useLiveQuery(async () => {
    const [sessions, marks, matches, settings, exercises, templates] = await Promise.all([
      db.sessions.toArray(),
      db.dayMarks.toArray(),
      db.matches.toArray(),
      getSettings(),
      db.exercises.toArray(),
      db.templates.toArray(),
    ]);
    sessions.sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt ?? Infinity) - (a.endedAt ?? Infinity));
    const sportOn = settings.sportEnabled;
    if (!sportOn) settings.trainingWeekday = -1;
    return { sessions, marks, matches: sportOn ? matches : [], settings, exercises, templates, exById: new Map(exercises.map((e) => [e.id!, e])) };
  }, []);
}

export type AppData = NonNullable<ReturnType<typeof useData>>;
