import { useState } from 'react';
import { Sheet } from './ui';
import { PrivacyText } from '../pages/PrivacyPage';
import { MIN_AGE } from '../lib/privacy';

export interface ConsentState {
  privacy: boolean;
  age: boolean;
  health: boolean;
}

function Check({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick}
      className={`w-full flex items-start gap-3 text-left rounded-2xl border px-4 py-3 min-h-[52px] ${on ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
      <span className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border grid place-items-center text-sm ${on ? 'bg-accent border-accent text-black' : 'border-muted'}`}>{on ? '✓' : ''}</span>
      <span className="text-sm">{children}</span>
    </button>
  );
}

/** Consensi: informativa e età obbligatori, dati sulla salute facoltativo e separato. */
export default function ConsentForm({ value, onChange }: { value: ConsentState; onChange: (v: ConsentState) => void }) {
  const [read, setRead] = useState(false);
  return (
    <div className="space-y-2">
      <Sheet open={read} onClose={() => setRead(false)} title="Privacy e termini"><PrivacyText /></Sheet>
      <Check on={value.privacy} onClick={() => onChange({ ...value, privacy: !value.privacy })}>
        Ho letto l’<span role="link" tabIndex={0} className="text-accent underline" onClick={(e) => { e.stopPropagation(); setRead(true); }}>informativa privacy e i termini d’uso</span>. <span className="text-muted">(obbligatorio)</span>
      </Check>
      <Check on={value.age} onClick={() => onChange({ ...value, age: !value.age })}>
        Ho almeno {MIN_AGE} anni. <span className="text-muted">(obbligatorio)</span>
      </Check>
      <Check on={value.health} onClick={() => onChange({ ...value, health: !value.health })}>
        Acconsento al salvataggio nel cloud dei miei dati sulla salute (peso e misure del corpo), per vederli su tutti i miei dispositivi. <span className="text-muted">(facoltativo: senza, restano solo su questo telefono)</span>
      </Check>
    </div>
  );
}
