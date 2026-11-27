import { Link } from 'react-router-dom';
import { Button, Card, Chips, Field, Header, NumInput, Stepper, Toggle, inputCls } from '../components/ui';
import { DEFAULT_THRESHOLDS, DEFAULT_THRESHOLDS_F, setSetting, useSettings } from '../lib/settings';
import { LB_TO_KG, fmtNum } from '../lib/units';
import { RANK_EXERCISE_LABEL } from '../lib/rank';
import type { RankKey } from '../db';

const TH_LABELS = ['Principiante', 'Novizio', 'Intermedio', 'Avanzato', 'Elite'];

export default function SettingsPage() {
  const s = useSettings();
  if (!s) return null;
  return (
    <div className="pb-nav">
      <Header title="Impostazioni" back="/altro" />
      <div className="p-4 space-y-3">
        <Card className="p-0 divide-y divide-line">
          <Link to="/attrezzatura" className="flex justify-between items-center px-4 min-h-[56px]"><span>🏋️ Attrezzatura e programma</span><span className="text-muted">›</span></Link>
          <Link to="/lettera" className="flex justify-between items-center px-4 min-h-[56px]"><span>✉️ Lettera del giorno 1</span><span className="text-muted">›</span></Link>
          <Link to="/promemoria" className="flex justify-between items-center px-4 min-h-[56px]"><span>⏰ Promemoria</span><span className="text-muted">›</span></Link>
        </Card>
        <Card>
          <Field label="Inizio progetto">
            <input type="date" className={inputCls} value={s.startDate} onChange={(e) => e.target.value && setSetting('startDate', e.target.value)} />
          </Field>
          <Field label="Altezza (cm)" hint="Serve per calcolare il BMI se la bilancia non lo dà.">
            <NumInput value={s.heightCm} onChange={(v) => v && setSetting('heightCm', v)} />
          </Field>
          <div className="flex justify-between items-center">
            <span>Sedute previste a settimana</span>
            <Stepper value={s.weeklyGoal} min={1} onChange={(v) => setSetting('weeklyGoal', v)} />
          </div>
        </Card>
        <Card>
          <Field label="Macchine in libbre: peso di ogni piastra (lb)" hint={`${fmtNum(s.lbPerBlock * LB_TO_KG)} kg. Usato quando crei un esercizio a pacco pesi in libbre.`}>
            <NumInput value={s.lbPerBlock} onChange={(v) => v && setSetting('lbPerBlock', v)} />
          </Field>
        </Card>
        <Card>
          <h2 className="font-bold mb-1">Rank</h2>
          <Toggle label="Mostra il rank (livello di forza)" checked={s.rankEnabled} onChange={(v) => setSetting('rankEnabled', v)} />
          {s.rankEnabled && (
            <div className="mb-3">
              <div className="text-sm mb-1">Soglie pensate per</div>
              <Chips options={[{ value: 'm', label: 'Uomo' }, { value: 'f', label: 'Donna' }]} value={s.sex} onChange={async (v) => {
                await setSetting('sex', v as 'm' | 'f');
                await setSetting('rankThresholds', v === 'f' ? DEFAULT_THRESHOLDS_F : DEFAULT_THRESHOLDS);
              }} />
            </div>
          )}
          {s.rankEnabled && <>
          <h3 className="font-semibold mb-1">Soglie</h3>
          <p className="text-xs text-muted mb-3">Indice di forza = massimale stimato / peso corporeo. {TH_LABELS.join(' / ')}.</p>
          {(Object.keys(RANK_EXERCISE_LABEL) as RankKey[]).map((k) => (
            <div key={k} className="mb-3">
              <div className="text-sm font-semibold mb-1">{RANK_EXERCISE_LABEL[k]}</div>
              <div className="grid grid-cols-5 gap-1">
                {s.rankThresholds[k].map((v, i) => (
                  <input key={`${k}-${i}-${v}`} aria-label={`${RANK_EXERCISE_LABEL[k]} ${TH_LABELS[i]}`} inputMode="decimal" defaultValue={String(v).replace('.', ',')}
                    className="bg-surface2 border border-line rounded-lg h-11 text-center text-sm w-full"
                    onBlur={(e) => {
                      const n = parseFloat(e.target.value.replace(',', '.'));
                      if (isNaN(n)) return;
                      const arr = [...s.rankThresholds[k]] as typeof s.rankThresholds[typeof k];
                      arr[i] = n;
                      setSetting('rankThresholds', { ...s.rankThresholds, [k]: arr });
                    }} />
                ))}
              </div>
            </div>
          ))}
          <Button variant="ghost" className="w-full" onClick={() => setSetting('rankThresholds', s.sex === 'f' ? DEFAULT_THRESHOLDS_F : DEFAULT_THRESHOLDS)}>Ripristina le soglie iniziali</Button>
          </>}
        </Card>
        <p className="text-xs text-muted text-center">Kaizen-Gym · i dati restano su questo dispositivo</p>
      </div>
    </div>
  );
}
