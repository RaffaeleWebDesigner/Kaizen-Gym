import { useEffect, useState } from 'react';
import { Button, Card, Chips, Confirm, toast } from './ui';
import { useSettings } from '../lib/settings';
import {
  ALL_EQUIP, EQUIP_LABEL, MACHINE_STEPS, PLACE_LABEL, PROGRAM_LABEL, updateProfile,
  type Equip, type Place, type Profile, type Program,
} from '../lib/onboarding';

/** Dove ti alleni, attrezzi di casa e tipo di programma, modificabili dopo il benvenuto. */
export default function ProfileCard() {
  const s = useSettings();
  const [p, setP] = useState<Profile | null>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (s && !p) {
      setP(s.profile ?? {
        goal: 'salute', experience: 'intermedio', place: 'palestra', equipment: [], unit: 'kg', machineStep: MACHINE_STEPS[0],
        days: s.weeklyGoal, program: 'fullbody', gymDays: s.gymDays, safetyFlags: [], acceptedAt: 0,
      });
    }
  }, [s, p]);
  if (!s || !p) return null;
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const toggle = (e: Equip) => set({ equipment: p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] });

  const save = async (rebuild: boolean) => {
    await updateProfile(p, rebuild);
    toast(rebuild ? 'Sedute rifatte con la nuova attrezzatura' : 'Salvato');
  };

  return (
    <Card>
      <h2 className="font-bold mb-1">Dove ti alleni</h2>
      <p className="text-sm text-muted mb-3">Decide quali esercizi ti propongo come varianti e quando aggiungi un esercizio.</p>
      <Chips options={(Object.keys(PLACE_LABEL) as Place[]).map((k) => ({ value: k, label: PLACE_LABEL[k].title }))} value={p.place} onChange={(v) => set({ place: v })} />
      {p.place === 'casa' && (
        <div className="grid gap-2 mt-3">
          {ALL_EQUIP.map((e) => {
            const on = p.equipment.includes(e);
            return (
              <button key={e} type="button" aria-pressed={on} onClick={() => toggle(e)}
                className={`flex items-center gap-3 text-left rounded-xl border px-3 min-h-[48px] ${on ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
                <span className={`w-5 h-5 rounded border grid place-items-center text-xs ${on ? 'bg-accent border-accent text-black' : 'border-muted'}`}>{on ? '✓' : ''}</span>
                <span className="text-sm">{EQUIP_LABEL[e]}</span>
              </button>
            );
          })}
        </div>
      )}
      <h3 className="font-semibold mt-4 mb-2">Programma</h3>
      <Chips options={(Object.keys(PROGRAM_LABEL) as Program[]).map((k) => ({ value: k, label: PROGRAM_LABEL[k].title }))} value={p.program} onChange={(v) => set({ program: v })} />
      <p className="text-xs text-muted mt-1">{PROGRAM_LABEL[p.program].text}</p>
      <h3 className="font-semibold mt-4 mb-2">Volte a settimana</h3>
      <Chips options={[2, 3, 4].map((d) => ({ value: d, label: `${d}` }))} value={p.days} onChange={(v) => set({ days: v })} />
      <div className="grid gap-2 mt-4">
        <Button onClick={() => save(false)}>Salva</Button>
        <Button variant="primary" onClick={() => setAsk(true)}>Salva e rifai le sedute</Button>
      </div>
      <Confirm open={ask} title="Rifare le sedute?" confirmLabel="Rifai"
        text="Le sedute A, B, C e minima vengono riscritte con gli esercizi adatti alla tua attrezzatura. Le modifiche che hai fatto a mano ai modelli si perdono; le sedute già fatte restano."
        onConfirm={() => save(true)} onClose={() => setAsk(false)} />
    </Card>
  );
}
