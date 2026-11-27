import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Chips, Field, Header, inputCls, toast } from '../components/ui';
import { db, SKIP_CATEGORY_LABEL, type SessionKind, type SkipCategory } from '../db';
import { todayISO } from '../lib/dates';
import { SKIP_LINES, pick } from '../lib/texts';
import { setSetting, useSettings } from '../lib/settings';
import { LetterOverlay } from './LetterPage';

export default function SkipPage() {
  const nav = useNavigate();
  const settings = useSettings();
  const [sp] = useSearchParams();
  const [date, setDate] = useState(sp.get('data') ?? todayISO());
  const [kind, setKind] = useState<SessionKind | null>(null);
  const [category, setCategory] = useState<SkipCategory | null>(null);
  const [reason, setReason] = useState('');
  const [sick, setSick] = useState(false);
  const [letter, setLetter] = useState(false);

  const save = async () => {
    if (sick) {
      await db.dayMarks.add({ date, type: 'sick', reason: reason || 'Malattia' });
      toast('Stop per malattia segnato. Riposa.');
      return nav(-1);
    }
    if (!category) return toast('Scegli il motivo');
    if (category === 'altro' && !reason.trim()) return toast('Scrivi il motivo, anche in due parole');
    await db.dayMarks.add({ date, type: 'skipped', plannedKind: kind, category, reason: reason.trim() || SKIP_CATEGORY_LABEL[category] });
    toast('Segnata. Si riparte dalla prossima.');
    if (settings?.letterCurrent) {
      await setSetting('letterShownOn', todayISO());
      setLetter(true);
    } else nav(-1);
  };

  return (
    <div className="pb-nav">
      <Header title="Seduta saltata" back />
      <div className="p-4 space-y-3">
        <Card className="border-line">
          <p className="font-semibold">Accountability mirror</p>
          <p className="text-sm text-muted">{pick(SKIP_LINES)}</p>
        </Card>
        <Field label="Giorno">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Chips options={[{ value: 'skip', label: 'Saltata' }, { value: 'sick', label: '🤒 Malattia' }]} value={sick ? 'sick' : 'skip'} onChange={(v) => setSick(v === 'sick')} />
        {sick ? (
          <p className="text-sm text-muted">La malattia è giustificata: non conta come saltata e toglie una seduta dal previsto della settimana.</p>
        ) : (
          <>
            <Field label="Quale seduta era prevista?">
              <Chips options={(['A', 'B', 'C'] as const).map((k) => ({ value: k, label: k }))} value={kind} onChange={setKind} />
            </Field>
            <Field label="Motivo, detto onestamente">
              <Chips options={(Object.keys(SKIP_CATEGORY_LABEL) as SkipCategory[]).map((c) => ({ value: c, label: SKIP_CATEGORY_LABEL[c] }))} value={category} onChange={setCategory} />
            </Field>
            <Field label={category === 'altro' ? 'Cosa è successo?' : 'Dettagli (facoltativo)'}>
              <textarea className={`${inputCls} py-2 min-h-[72px]`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        )}
        <Button big variant="primary" className="w-full" onClick={save}>Salva</Button>
        {!sick && <p className="text-xs text-muted text-center">Niente recuperi forzati: la prossima seduta resta quella prevista.</p>}
      </div>
      {letter && settings?.letterCurrent && <LetterOverlay letter={settings.letterCurrent} reason="Seduta saltata" onClose={() => nav(-1)} />}
    </div>
  );
}
