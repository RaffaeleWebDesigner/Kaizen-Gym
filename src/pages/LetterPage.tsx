import { addLetterSuccess } from '../migrations';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Header, inputCls, toast } from '../components/ui';
import { setSetting, useSettings, type Letter } from '../lib/settings';
import { fmtDateFull, toISO } from '../lib/dates';

const PROMPTS = [
  'Perché ho iniziato?',
  'Cosa voglio poter fare tra un anno?',
  'Cosa mi dico nei giorni in cui non ho voglia?',
];

export default function LetterPage() {
  const s = useSettings();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const first = sp.get('primo') === '1';
  const [text, setText] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => {
    if (s && text === null) setText(s.letterCurrent?.text ?? '');
  }, [s, text]);
  if (!s || text === null) return null;

  const save = async () => {
    if (!text.trim()) return toast('Scrivi almeno qualche riga');
    const l: Letter = { text: text.trim(), at: Date.now() };
    if (!s.letterOriginal) {
      await setSetting('letterOriginal', l);
      await addLetterSuccess(l.at);
    }
    await setSetting('letterCurrent', l);
    await setSetting('letterPrompted', true);
    toast(s.letterOriginal ? 'Lettera aggiornata. L’originale resta salvata.' : 'Lettera salvata');
    nav(first ? '/' : -1 as never, { replace: first });
  };

  return (
    <div className="pb-nav">
      <Header title="Lettera del giorno 1" back={first ? undefined : true} />
      <div className="p-4 space-y-3">
        <p className="text-muted">{first ? 'Prima di tutto, una cosa sola: scrivi a te stesso perché hai iniziato. Te la rileggerai nei giorni no.' : 'Puoi aggiornarla quando vuoi. La versione originale resta sempre salvata.'}</p>
        <Card className="text-sm text-muted">
          {PROMPTS.map((p) => <div key={p}>› {p}</div>)}
        </Card>
        <textarea className={`${inputCls} py-3 min-h-[260px] text-base leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Caro me, …" />
        <Button big variant="primary" className="w-full" onClick={save}>Salva la lettera</Button>
        {first && (
          <Button variant="ghost" className="w-full" onClick={async () => { await setSetting('letterPrompted', true); nav('/', { replace: true }); }}>Più tardi</Button>
        )}
        {s.letterOriginal && (
          <>
            <Button className="w-full" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Nascondi' : 'Leggi'} la versione originale</Button>
            {showOriginal && (
              <Card>
                <div className="text-xs text-muted mb-2">Scritta il {fmtDateFull(toISO(new Date(s.letterOriginal.at)))}</div>
                <p className="whitespace-pre-wrap">{s.letterOriginal.text}</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** La lettera a schermo intero. */
export function LetterOverlay({ letter, reason, onClose }: { letter: Letter; reason: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-bg overflow-y-auto" role="dialog" aria-modal="true">
      <div className="max-w-lg mx-auto p-6 pt-safe min-h-full flex flex-col">
        <div className="pt-8 text-xs uppercase tracking-[0.2em] text-accent font-bold">{reason}</div>
        <h1 className="text-2xl font-bold mt-1 mb-6">La tua lettera del giorno 1</h1>
        <p className="whitespace-pre-wrap text-lg leading-relaxed flex-1">{letter.text}</p>
        <div className="py-8 space-y-2">
          <Button big variant="primary" className="w-full" onClick={onClose}>Ok. Si riparte.</Button>
        </div>
      </div>
    </div>
  );
}
