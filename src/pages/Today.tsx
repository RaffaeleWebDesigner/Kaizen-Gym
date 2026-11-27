import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Sheet } from '../components/ui';
import { db, KIND_LABEL, type SessionKind } from '../db';
import { useData } from '../lib/useData';
import { doneSessions, streak, weekStats } from '../lib/stats';
import { countdown, HEAVY_LEG_SETS, legWarning, matchTime, nextMatch, suggestWeek, templateLegSets, trainingDates } from '../lib/football';
import { addDays, dayShort, fmtDate, fmtDateLong, mondayOf, todayISO, weekDays, diffDays, weekdayMon } from '../lib/dates';
import { createSession } from '../lib/sessionUtils';
import { DAILY_LINES, JAR_LINE, MINIMA_LINE, pick } from '../lib/texts';
import { dueMonthly } from './MonthlyReview';
import { photoDue } from '../lib/photos';
import { unlockStatus } from '../lib/challenges';
import { Medal, UnlockCard } from './ChallengesPage';
import { GoalTodayCard } from './GoalsPage';
import RankBadge from '../components/RankBadge';
import { levelName } from '../lib/rank';
import { useRanks } from './RankPage';
import { LetterOverlay } from './LetterPage';
import { setSetting } from '../lib/settings';

export default function Today() {
  const data = useData();
  const nav = useNavigate();
  const [now, setNow] = useState(new Date());
  const [legAsk, setLegAsk] = useState<{ kind: SessionKind; reason: string } | null>(null);
  const [letterClosed, setLetterClosed] = useState(false);
  const photos = useLiveQuery(() => db.photos.toArray(), []);
  const attempts = useLiveQuery(() => db.challengeAttempts.toArray(), []);
  const challenges = useLiveQuery(() => db.challenges.toArray(), []);
  const successCount = useLiveQuery(() => db.successes.count(), []);
  const rank = useRanks();

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);

  if (!data || !photos || !attempts || !challenges || successCount === undefined) return null;
  if (!data.settings.onboarded) return <Navigate to="/benvenuto" replace />;
  if (!data.settings.letterPrompted) return <Navigate to="/lettera?primo=1" replace />;
  const today = todayISO();
  const { sessions, marks, matches, settings } = data;
  const done = doneSessions(sessions);
  const weeks = weekStats(sessions, marks, settings.startDate, today, settings.weeklyGoal);
  const cur = weeks[weeks.length - 1];
  const st = streak(weeks);
  const open = sessions.find((s) => s.status === 'in_progress');
  const match = nextMatch(matches, now);
  const monday = mondayOf(today);
  const trainings = trainingDates(monday, addDays(monday, 6), settings.trainingWeekday, settings.startDate, marks);
  const suggested = suggestWeek(monday, matches, trainings, today, Math.max(0, (cur?.target ?? 3) - (cur?.done ?? 0)));
  const doneToday = done.filter((s) => s.date === today);
  const lastABC = done.find((s) => ['A', 'B', 'C'].includes(s.kind));
  const nextKind: SessionKind = lastABC ? ({ A: 'B', B: 'C', C: 'A' } as Record<string, SessionKind>)[lastABC.kind] : 'A';
  const backupRef = settings.lastBackupAt ?? settings.createdAt;
  const backupDue = Date.now() - backupRef > 14 * 86400000;
  const prevMonday = addDays(monday, -7);
  const reviewDue = (diffDays(today, monday) === 0 || diffDays(today, monday) === 6) && prevMonday >= mondayOf(settings.startDate);
  const reviewWeek = diffDays(today, monday) === 6 ? monday : prevMonday;
  const monthlyN = dueMonthly(settings, today);
  const medals = attempts.filter((a) => a.status === 'completed');
  const unlock = unlockStatus(weeks, settings.startDate, today);
  const nextChallenge = attempts.filter((a) => a.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))[0];
  const gymDay = settings.gymDays.includes(weekdayMon(today));
  const marksToday = marks.some((m) => m.date === today);
  const nothingToday = !doneToday.length && !open && !marksToday;
  const late = now.getHours() >= 21 && nothingToday;
  const lastDate = done[0]?.date ?? settings.startDate;
  const sickSince = new Set(marks.filter((m) => m.type === 'sick' && m.date > lastDate && m.date <= today).map((m) => m.date)).size;
  const idleDays = diffDays(today, lastDate) - sickSince;
  const showLetter = !letterClosed && !!settings.letterCurrent && idleDays > 5 && settings.letterShownOn !== today && nothingToday;

  const start = async (kind: SessionKind, skipLegs = false) => {
    if (open) return nav(`/seduta/${open.id}`);
    const id = await createSession(kind, today, { skipLegs });
    nav(`/seduta/${id}`);
  };

  const tryStart = (kind: SessionKind) => {
    if (open) return nav(`/seduta/${open.id}`);
    const tpl = data.templates.find((t) => t.code === kind);
    const reason = legWarning(today, matches);
    if (reason && kind !== 'MIN' && tpl && templateLegSets(tpl.rows, data.exById) >= HEAVY_LEG_SETS) return setLegAsk({ kind, reason });
    start(kind);
  };

  return (
    <div className="pb-nav">
      <header className="px-4 pt-safe">
        <div className="pt-5 pb-2 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-accent font-bold">Kaizen-Gym</div>
            <h1 className="text-2xl font-bold capitalize">{fmtDateLong(today)}</h1>
          </div>
        </div>
        <p className="text-muted">{pick(DAILY_LINES)}</p>
      </header>

      <div className="p-4 space-y-3">
        {gymDay && nothingToday && (
          <Card className="bg-accent text-black border-accent">
            <div className="font-black text-lg">Oggi è giorno di palestra</div>
            <div className="text-sm">{late ? 'È tardi? Fai la minima: 10-15 minuti e conta.' : 'Presentati. Il resto si sistema.'}</div>
          </Card>
        )}
        {late && (
          <Button big variant="primary" className="w-full min-h-[80px] text-xl" onClick={() => tryStart('MIN')}>
            Seduta minima (10-15 min)
          </Button>
        )}
        {open && (
          <Link to={`/seduta/${open.id}`}>
            <Card className="border-accent bg-accent/10">
              <div className="font-bold text-accent">Seduta in corso: {KIND_LABEL[open.kind]}</div>
              <div className="text-sm text-muted">Tocca per riprendere da dove eri rimasto.</div>
            </Card>
          </Link>
        )}

        <Card className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted">Barattolo · sedute fatte</div>
          <div className="text-7xl font-black text-accent tabular leading-none my-2" data-testid="cookie-jar">{done.length}</div>
          <p className="text-sm text-muted">{JAR_LINE}</p>
          {medals.length > 0 && (
            <Link to="/sfide" className="flex flex-wrap justify-center gap-2 mt-3">
              {medals.map((m) => (
                <span key={m.id} className="flex flex-col items-center text-[10px] text-muted" title={challenges.find((c) => c.id === m.challengeId)?.name}>
                  <Medal size={30} />{fmtDate(m.date)}
                </span>
              ))}
            </Link>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/successi">
            <Card className="h-full">
              <div className="text-xs uppercase tracking-wide text-muted">Barattolo dei successi</div>
              <div className="text-3xl font-bold text-accent">{successCount}</div>
              <div className="text-xs text-muted">aprilo nei momenti di calo</div>
            </Card>
          </Link>
          <Link to="/rank">
            <Card className="h-full flex items-center gap-2">
              {rank?.overall ? <RankBadge level={rank.overall} size={44} /> : <span className="text-3xl">◇</span>}
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted">Rank</div>
                <div className="font-bold leading-tight">{rank?.overall ? levelName(rank.overall) : 'ancora nessuno'}</div>
              </div>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">Striscia</div>
            <div className="text-3xl font-bold">{st} <span className="text-base font-normal text-muted">{st === 1 ? 'settimana' : 'settimane'}</span></div>
            <div className="text-xs text-muted">di fila con almeno 2 sedute</div>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">Questa settimana</div>
            <div className="text-3xl font-bold">{cur?.done ?? 0}<span className="text-muted text-xl">/{cur?.target ?? 3}</span></div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: Math.max(cur?.target ?? 3, cur?.done ?? 0) }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < (cur?.done ?? 0) ? 'bg-accent' : 'bg-line'}`} />
              ))}
            </div>
            {cur && cur.sick > 0 && <div className="text-xs text-muted mt-1">previsto ridotto per malattia</div>}
          </Card>
        </div>

        {doneToday.length > 0 && !open && (
          <p className="text-center text-accent font-semibold">Oggi hai già fatto {doneToday.length === 1 ? 'una seduta' : `${doneToday.length} sedute`}. Ottimo così.</p>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          {(['A', 'B', 'C'] as const).map((k) => (
            <Button key={k} variant={k === nextKind ? 'primary' : 'secondary'} className="min-h-[88px] flex flex-col items-center justify-center" onClick={() => tryStart(k)}>
              <span className="text-xs font-normal opacity-80">Inizia seduta</span>
              <span className="text-3xl font-black">{k}</span>
              {k === nextKind && <span className="text-[10px] font-normal">la prossima</span>}
            </Button>
          ))}
        </div>
        {!late && (
          <Button big variant="minima" className="w-full" onClick={() => tryStart('MIN')}>
            Seduta minima (10-15 min)
          </Button>
        )}
        <p className="text-xs text-muted text-center -mt-1">{MINIMA_LINE}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button big variant="danger" onClick={() => nav('/salta')}>Segna seduta saltata</Button>
          <Button big onClick={() => start('FREE')}>Seduta libera</Button>
        </div>

        <GoalTodayCard />

        {match && (
          <Link to="/calcio" className="block">
            <Card className="flex items-center gap-3">
              <div className="text-3xl" aria-hidden>🏟️</div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wide text-muted">Prossima partita</div>
                <div className="font-semibold capitalize">{fmtDateLong(match.date)} · {match.time}{match.venue ? ` · ${match.venue}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-accent tabular">{countdown(matchTime(match), now)}</div>
              </div>
            </Card>
          </Link>
        )}

        {suggested.length > 0 && cur && cur.done < cur.target && (
          <Link to="/calcio" className="block">
            <Card>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Giorni consigliati per la palestra</div>
              <div className="flex gap-2">
                {weekDays(monday).map((d) => {
                  const sug = suggested.find((x) => x.date === d);
                  const isMatch = matches.some((m) => m.date === d);
                  const did = done.some((s) => s.date === d);
                  return (
                    <div key={d} className={`flex-1 text-center rounded-xl py-1.5 text-xs ${d === today ? 'ring-1 ring-ink' : ''} ${did ? 'bg-accent text-black font-bold' : sug ? (sug.legsOk ? 'bg-accent/20 text-accent' : 'bg-minima/20 text-minima') : 'bg-surface2 text-muted'}`}>
                      {dayShort(d)}
                      <div className="text-[10px]">{did ? '✓' : isMatch ? '🏟️' : trainings.includes(d) ? '⚽' : sug ? (sug.legsOk ? 'gym' : 'alto') : ''}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Link>
        )}

        {photoDue(photos, settings.startDate, today) && (
          <Link to="/foto" className="block">
            <Card>
              <div className="font-semibold">📷 Foto dei progressi</div>
              <div className="text-sm text-muted">Nuovo blocco di 4 settimane: due scatti, frontale e laterale.</div>
            </Card>
          </Link>
        )}
        {!unlock.unlocked ? (
          <Link to="/sfide" className="block"><UnlockCard u={unlock} compact /></Link>
        ) : nextChallenge ? (
          <Link to="/sfide" className="block">
            <Card className="border-accent/50">
              <div className="font-semibold">Prossima sfida: {challenges.find((c) => c.id === nextChallenge.challengeId)?.name}</div>
              <div className="text-sm text-muted capitalize">{fmtDateLong(nextChallenge.date)}</div>
            </Card>
          </Link>
        ) : (
          <Link to="/sfide" className="block"><Card><div className="font-semibold">Sfide sbloccate</div><div className="text-sm text-muted">Programmane una, nei giorni compatibili con il calcio.</div></Card></Link>
        )}
        {settings.gymDays.length === 0 && (
          <Link to="/promemoria" className="block">
            <Card><div className="font-semibold">Imposta i promemoria</div><div className="text-sm text-muted">Scegli i giorni di palestra e mettili nel calendario del telefono.</div></Card>
          </Link>
        )}
        {backupDue && (
          <Link to="/dati" className="block">
            <Card className="border-minima/50">
              <div className="font-semibold text-minima">Fai un backup</div>
              <div className="text-sm text-muted">{settings.lastBackupAt ? 'L’ultimo ha più di 14 giorni.' : 'Non hai ancora salvato una copia dei dati.'} I dati vivono solo su questo telefono.</div>
            </Card>
          </Link>
        )}
        {reviewDue && (
          <Link to={`/revisioni?settimana=${reviewWeek}`} className="block">
            <Card>
              <div className="font-semibold">Revisione della settimana</div>
              <div className="text-sm text-muted">Due minuti: cosa ha funzionato, cosa ti ha bloccato, cosa cambi.</div>
            </Card>
          </Link>
        )}
        {monthlyN !== null && (
          <Link to={`/revisioni/mese/${monthlyN}`} className="block">
            <Card className="border-accent/50">
              <div className="font-semibold text-accent">Punto del mese</div>
              <div className="text-sm text-muted">Sono passate altre 4 settimane: guarda peso, misure, carichi e costanza a confronto.</div>
            </Card>
          </Link>
        )}

      </div>

      {showLetter && settings.letterCurrent && (
        <LetterOverlay letter={settings.letterCurrent} reason={`Fermo da ${idleDays} giorni`} onClose={() => { setLetterClosed(true); setSetting('letterShownOn', today); }} />
      )}
      <Sheet open={!!legAsk} onClose={() => setLegAsk(null)} title="Gambe pesanti sconsigliate oggi">
        <p className="text-muted mb-4">{legAsk?.reason} Ti propongo di fare solo la parte alta e arrivare fresco in campo.</p>
        <div className="grid gap-2">
          <Button big variant="primary" onClick={() => { const k = legAsk!.kind; setLegAsk(null); start(k, true); }}>
            {legAsk ? KIND_LABEL[legAsk.kind] : ''} senza gambe
          </Button>
          {legAsk?.kind !== 'B' && <Button big onClick={() => { setLegAsk(null); start('B'); }}>Fai la Seduta B (parte alta)</Button>}
          <Button variant="ghost" onClick={() => { const k = legAsk!.kind; setLegAsk(null); start(k); }}>Inizia comunque</Button>
        </div>
      </Sheet>
    </div>
  );
}
