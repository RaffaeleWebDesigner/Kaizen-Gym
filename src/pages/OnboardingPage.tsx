import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, toast } from '../components/ui';
import { DEFAULT_THRESHOLDS, DEFAULT_THRESHOLDS_F, setSetting } from '../lib/settings';
import {
  ALL_EQUIP, EQUIP_LABEL, EXPERIENCE_LABEL, GOAL_LABEL, MACHINE_STEPS, PLACE_LABEL, PROGRAM_LABEL, SAFETY_QUESTIONS,
  applyOnboarding, buildPlan, equipmentFor, suggestedProgram,
  type Equip, type Experience, type Goal, type MachineStep, type Place, type Program,
} from '../lib/onboarding';
import type { Unit } from '../db';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
type Step = 'benvenuto' | 'obiettivo' | 'esperienza' | 'rank' | 'dove' | 'attrezzatura' | 'unita' | 'giorni' | 'sicurezza' | 'riepilogo';

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`w-full text-left rounded-2xl border px-4 py-3 min-h-[56px] transition ${selected ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
      <div className="font-semibold">{title}</div>
      {text && <div className="text-sm text-muted">{text}</div>}
    </button>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`w-full flex items-center gap-3 text-left rounded-2xl border px-4 min-h-[52px] ${on ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
      <span className={`w-6 h-6 rounded-md border grid place-items-center text-sm ${on ? 'bg-accent border-accent text-black' : 'border-muted'}`}>{on ? '✓' : ''}</span>
      <span>{label}</span>
    </button>
  );
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('benvenuto');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [equipment, setEquipment] = useState<Equip[]>([]);
  const [unit, setUnit] = useState<Unit>('kg');
  const [machineStep, setMachineStep] = useState<MachineStep>(MACHINE_STEPS[0]);
  const [days, setDays] = useState(3);
  const [gymDays, setGymDays] = useState<number[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const prog = program ?? suggestedProgram(experience, days);
  const [safety, setSafety] = useState<Record<string, boolean | undefined>>({});
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rank, setRank] = useState<'m' | 'f' | 'off' | null>(null);

  const usesMachines = place !== null && equipmentFor({ place, equipment }).some((e) => e === 'cavi' || e === 'macchine');
  const steps: Step[] = useMemo(() => {
    const s: Step[] = ['benvenuto', 'obiettivo', 'esperienza', 'rank', 'dove'];
    if (place === 'casa') s.push('attrezzatura');
    s.push('unita', 'giorni', 'sicurezza', 'riepilogo');
    return s;
  }, [place]);
  const idx = steps.indexOf(step);
  const next = () => setStep(steps[Math.min(idx + 1, steps.length - 1)]);
  const back = () => setStep(steps[Math.max(idx - 1, 0)]);

  const flags = SAFETY_QUESTIONS.filter((q) => safety[q.key]).map((q) => q.key);
  const allAnswered = SAFETY_QUESTIONS.every((q) => safety[q.key] !== undefined);
  const plan = goal && experience && place ? buildPlan({ goal, experience, place, equipment, program: prog }) : [];

  const finish = async () => {
    if (!goal || !experience || !place) return;
    setSaving(true);
    try {
      await setSetting('rankEnabled', rank !== 'off');
      if (rank === 'm' || rank === 'f') {
        await setSetting('sex', rank);
        await setSetting('rankThresholds', rank === 'f' ? DEFAULT_THRESHOLDS_F : DEFAULT_THRESHOLDS);
      }
      await applyOnboarding({ goal, experience, place, equipment, unit, machineStep, days, program: prog, gymDays, safetyFlags: flags, acceptedAt: Date.now() });
      nav('/lettera?primo=1', { replace: true });
    } catch {
      setSaving(false);
      toast('Qualcosa è andato storto, riprova');
    }
  };

  const haveAccount = async () => {
    await setSetting('onboarded', true);
    await setSetting('letterPrompted', true);
    nav('/account', { replace: true });
  };

  let body: ReactNode = null;
  let canNext = true;
  let nextLabel = 'Avanti';

  switch (step) {
    case 'benvenuto':
      body = (
        <div className="space-y-4 pt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-bold">Kaizen-Gym</div>
          <h1 className="text-3xl font-bold leading-tight">Piccoli passi, ogni settimana.</h1>
          <p className="text-muted">Ti faccio qualche domanda veloce per preparare le tue prime sedute. Ci vogliono due minuti, e puoi cambiare tutto dopo.</p>
        </div>
      );
      nextLabel = 'Iniziamo';
      break;
    case 'obiettivo':
      body = (
        <Q title="Cosa vuoi ottenere?">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <Choice key={g} selected={goal === g} title={GOAL_LABEL[g]} onClick={() => setGoal(g)} />)}
        </Q>
      );
      canNext = !!goal;
      break;
    case 'esperienza':
      body = (
        <Q title="Quanta esperienza hai con i pesi?">
          {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((e) => <Choice key={e} selected={experience === e} title={EXPERIENCE_LABEL[e].title} text={EXPERIENCE_LABEL[e].text} onClick={() => setExperience(e)} />)}
        </Q>
      );
      canNext = !!experience;
      break;
    case 'rank':
      body = (
        <Q title="Vuoi vedere il tuo livello di forza?" hint="Il rank confronta i tuoi carichi con il peso corporeo, con soglie diverse per uomini e donne. Si può spegnere quando vuoi.">
          <Choice selected={rank === 'm'} title="Sì, soglie da uomo" onClick={() => setRank('m')} />
          <Choice selected={rank === 'f'} title="Sì, soglie da donna" onClick={() => setRank('f')} />
          <Choice selected={rank === 'off'} title="No, grazie" text="Niente rank e niente promozioni" onClick={() => setRank('off')} />
        </Q>
      );
      canNext = !!rank;
      break;
    case 'dove':
      body = (
        <Q title="Dove ti alleni?">
          {(Object.keys(PLACE_LABEL) as Place[]).map((p) => <Choice key={p} selected={place === p} title={PLACE_LABEL[p].title} text={PLACE_LABEL[p].text} onClick={() => setPlace(p)} />)}
        </Q>
      );
      canNext = !!place;
      break;
    case 'attrezzatura':
      body = (
        <Q title="Cosa hai a casa?" hint="Segna tutto quello che hai. Se non hai niente va benissimo: le sedute saranno a corpo libero.">
          {ALL_EQUIP.map((e) => (
            <Toggle key={e} on={equipment.includes(e)} label={EQUIP_LABEL[e]}
              onClick={() => setEquipment(equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e])} />
          ))}
        </Q>
      );
      nextLabel = equipment.length ? 'Avanti' : 'Non ho attrezzi';
      break;
    case 'unita':
      body = (
        <Q title="Pesi in chilogrammi o in libbre?">
          <div className="grid grid-cols-2 gap-2">
            <Choice selected={unit === 'kg'} title="Chilogrammi" text="kg" onClick={() => setUnit('kg')} />
            <Choice selected={unit === 'lb'} title="Libbre" text="lb" onClick={() => setUnit('lb')} />
          </div>
          {usesMachines && (
            <>
              <h3 className="font-semibold pt-4">Macchine e cavi: quanto pesa ogni piastra del pacco?</h3>
              <p className="text-sm text-muted -mt-1">Di solito c’è scritto sulle piastre. Se non lo sai lascia 5 kg.</p>
              <div className="grid grid-cols-2 gap-2">
                {MACHINE_STEPS.map((m) => (
                  <Choice key={`${m.value}${m.unit}`} selected={machineStep.value === m.value && machineStep.unit === m.unit}
                    title={`${String(m.value).replace('.', ',')} ${m.unit}`} onClick={() => setMachineStep(m)} />
                ))}
              </div>
            </>
          )}
        </Q>
      );
      break;
    case 'giorni':
      body = (
        <Q title="Quante volte a settimana?" hint="Meglio poche sedute fatte sempre che tante saltate. Si parte da qui e si cresce.">
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((d) => <Choice key={d} selected={days === d} title={`${d} volte`} onClick={() => setDays(d)} />)}
          </div>
          <h3 className="font-semibold pt-4">Come vuoi dividere le sedute?</h3>
          {(Object.keys(PROGRAM_LABEL) as Program[]).map((k) => (
            <Choice key={k} selected={prog === k} title={PROGRAM_LABEL[k].title} text={PROGRAM_LABEL[k].text} onClick={() => setProgram(k)} />
          ))}
          <h3 className="font-semibold pt-4">In quali giorni? <span className="text-muted font-normal">(facoltativo)</span></h3>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => {
              const on = gymDays.includes(i);
              return (
                <button key={w} type="button" aria-pressed={on} onClick={() => setGymDays(on ? gymDays.filter((x) => x !== i) : [...gymDays, i].sort())}
                  className={`h-12 rounded-xl border text-sm ${on ? 'bg-accent text-black border-accent font-semibold' : 'bg-surface2 border-line'}`}>{w}</button>
              );
            })}
          </div>
        </Q>
      );
      break;
    case 'sicurezza':
      body = (
        <Q title="Prima di iniziare, la tua salute" hint="Rispondi con sincerità. Le risposte restano tue e servono solo a consigliarti prudenza.">
          {SAFETY_QUESTIONS.map((q) => (
            <Card key={q.key} className="p-3">
              <div className="text-sm mb-2">{q.text}</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={safety[q.key] === false} onClick={() => setSafety({ ...safety, [q.key]: false })}
                  className={`h-11 rounded-xl border ${safety[q.key] === false ? 'bg-accent text-black border-accent font-semibold' : 'bg-surface2 border-line'}`}>No</button>
                <button type="button" aria-pressed={safety[q.key] === true} onClick={() => setSafety({ ...safety, [q.key]: true })}
                  className={`h-11 rounded-xl border ${safety[q.key] === true ? 'bg-minima text-black border-minima font-semibold' : 'bg-surface2 border-line'}`}>Sì</button>
              </div>
            </Card>
          ))}
          {flags.length > 0 && (
            <Card className="border-minima/60 bg-minima/10 text-sm">
              Hai risposto sì ad almeno una domanda: <b>prima di allenarti parlane con il tuo medico</b> e chiedigli quali esercizi evitare. Puoi comunque preparare le sedute adesso.
            </Card>
          )}
          <Toggle on={accepted} onClick={() => setAccepted(!accepted)}
            label="Ho capito che Kaizen-Gym non sostituisce il parere di un medico o di un allenatore, e che mi fermo se sento dolore." />
        </Q>
      );
      canNext = allAnswered && accepted;
      break;
    case 'riepilogo':
      body = (
        <Q title="Ecco le tue sedute" hint={`${days} volte a settimana, alternando ${PROGRAM_LABEL[prog].names.join(', ').replace(/, ([^,]*)$/, ' e $1')}. Gli esercizi si possono cambiare quando vuoi da Altro → Modelli.`}>
          {plan.filter((t) => t.code !== 'MIN').map((t) => (
            <Card key={t.code} className="p-3">
              <div className="font-bold mb-1">{t.name}</div>
              {t.rows.map((r) => (
                <div key={r.name} className="flex justify-between text-sm py-0.5">
                  <span>{r.name}</span>
                  <span className="text-muted">{r.sets} × {r.repMin}-{r.repMax}{r.name.startsWith('Plank') ? ' s' : ''}</span>
                </div>
              ))}
            </Card>
          ))}
          <p className="text-sm text-muted">C’è anche una seduta minima da 15 minuti per i giorni storti. Alla prima seduta scegli pesi leggeri: l’app li fa salire da sola.</p>
        </Q>
      );
      nextLabel = saving ? 'Preparo…' : 'Inizia';
      canNext = !saving;
      break;
  }

  return (
    <div className="min-h-screen flex flex-col pt-safe">
      <div className="flex items-center gap-2 h-14 px-2">
        {idx > 0 ? (
          <button aria-label="Indietro" className="w-12 h-12 grid place-items-center text-2xl text-muted active:text-ink" onClick={back}>‹</button>
        ) : <div className="w-12" />}
        <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden" aria-hidden>
          <div className="h-full bg-accent transition-all" style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} />
        </div>
        <div className="w-12" />
      </div>
      <div className="flex-1 px-4 pb-4">{body}</div>
      <div className="sticky bottom-0 bg-bg/95 backdrop-blur px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <Button big variant="primary" className="w-full" disabled={!canNext} onClick={step === 'riepilogo' ? finish : next}>{nextLabel}</Button>
        {step === 'benvenuto' && <Button variant="ghost" className="w-full" onClick={haveAccount}>Ho già un account</Button>}
      </div>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 pt-2">
      <h2 className="text-2xl font-bold leading-tight">{title}</h2>
      {hint && <p className="text-sm text-muted pb-1">{hint}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
