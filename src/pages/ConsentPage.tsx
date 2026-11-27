import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import ConsentForm, { type ConsentState } from '../components/ConsentForm';
import { saveConsent } from '../lib/privacy';
import { useSettings } from '../lib/settings';

/** Chiede (di nuovo) il consenso: account aperto senza benvenuto, o informativa cambiata. */
export default function ConsentPage() {
  const s = useSettings();
  const nav = useNavigate();
  const [v, setV] = useState<ConsentState | null>(null);
  if (!s) return null;
  const val = v ?? { privacy: false, age: !!s.consent?.age, health: !!s.consent?.health };
  return (
    <div className="min-h-screen flex flex-col pt-safe">
      <div className="flex-1 p-4 space-y-3 pt-8">
        <h1 className="text-2xl font-bold">{s.consent ? 'L’informativa è cambiata' : 'Prima di continuare'}</h1>
        <p className="text-sm text-muted">Leggi come trattiamo i tuoi dati e conferma. Ci vuole un minuto.</p>
        <ConsentForm value={val} onChange={setV} />
      </div>
      <div className="sticky bottom-0 bg-bg/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button big variant="primary" className="w-full" disabled={!val.privacy || !val.age}
          onClick={async () => { await saveConsent({ age: val.age, health: val.health, cloud: s.consent?.cloud }); nav('/', { replace: true }); }}>Continua</Button>
      </div>
    </div>
  );
}
