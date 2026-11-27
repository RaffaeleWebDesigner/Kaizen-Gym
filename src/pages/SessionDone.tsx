import { Link, useParams } from 'react-router-dom';
import { Button, Card, toast } from '../components/ui';
import { KIND_LABEL } from '../db';
import { useData } from '../lib/useData';
import { doneSessions } from '../lib/stats';
import { DONE_LINES, pick } from '../lib/texts';
import { coachSummary, copyText } from '../lib/exportData';

export default function SessionDone() {
  const { id } = useParams();
  const data = useData();
  if (!data) return null;
  const s = data.sessions.find((x) => x.id === Number(id));
  const total = doneSessions(data.sessions).length;
  if (!s) return null;
  const sets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  return (
    <div className="pb-nav p-4 pt-safe">
      <div className="text-center pt-10 pb-6">
        <div className="text-xs uppercase tracking-widest text-muted">Barattolo</div>
        <div className="text-8xl font-black text-accent tabular my-2">{total}</div>
        <p className="text-xl font-semibold">{pick(DONE_LINES, total)}</p>
      </div>
      <Card className="mb-3">
        <div className="font-bold">{KIND_LABEL[s.kind]}</div>
        <div className="text-sm text-muted">
          {sets} serie fatte{s.durationMin ? ` · ${s.durationMin} min` : ''}{s.feeling ? ` · voto ${s.feeling}/5` : ''}
        </div>
        {s.exercises.some((e) => e.pain) && <p className="text-sm text-danger mt-2">Hai segnato dolore: se continua, senti un medico o un fisioterapista.</p>}
      </Card>
      <div className="grid gap-2">
        <Button big onClick={async () => (await copyText(await coachSummary('last'))) ? toast('Riepilogo copiato') : toast('Copia non riuscita')}>Copia riepilogo per il coach</Button>
        <Link to="/"><Button big variant="primary" className="w-full">Torna a Oggi</Button></Link>
      </div>
    </div>
  );
}
