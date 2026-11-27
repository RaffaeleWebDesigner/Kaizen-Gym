import { Link } from 'react-router-dom';
import { Card, Header } from '../components/ui';
import { GROUP_LABEL } from '../db';
import { useData } from '../lib/useData';
import { availableEquip, canDo, infoOf } from '../lib/catalog';
import { EQUIP_LABEL } from '../lib/onboarding';

const ORDER = ['A', 'B', 'C', 'MIN'];

export default function TemplatesPage() {
  const data = useData();
  if (!data) return null;
  const templates = [...data.templates].sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
  const have = availableEquip(data.settings);
  const all = data.exercises.filter((e) => !e.archived).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const catalog = all.filter((e) => canDo(e, have));
  const others = all.filter((e) => !canDo(e, have));
  return (
    <div className="pb-nav">
      <Header title="Modelli di seduta" back="/altro" />
      <div className="p-4 space-y-3">
        {templates.map((t) => (
          <Link key={t.id} to={`/modelli/${t.code}`} className="block">
            <Card>
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-lg">{t.name}</h2>
                <span className="text-accent text-sm">Modifica ›</span>
              </div>
              <ul className="text-sm text-muted space-y-0.5">
                {t.rows.map((r, i) => {
                  const ex = data.exById.get(r.exerciseId);
                  return (
                    <li key={i}>
                      {ex?.name ?? '—'} · {r.sets}×{r.repMin}-{r.repMax}{ex?.type === 'time' ? '"' : ''}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </Link>
        ))}

        <div className="flex items-center justify-between pt-4">
          <h2 className="font-bold text-lg">Catalogo esercizi</h2>
          <Link to="/esercizi/nuovo" className="text-accent min-h-[44px] grid place-items-center px-2">+ Nuovo</Link>
        </div>
        <p className="text-sm text-muted -mt-2">Gli esercizi che puoi fare con la tua attrezzatura. La cambi da Impostazioni → <Link to="/attrezzatura" className="text-accent">Attrezzatura e programma</Link>.</p>
        <Card className="p-0 divide-y divide-line">
          {catalog.map((e) => (
            <Link key={e.id} to={`/esercizi/${e.id}`} className="flex justify-between items-center px-4 min-h-[52px]">
              <span>{e.name}</span>
              <span className="text-xs text-muted">{GROUP_LABEL[e.group]} · {e.type === 'time' ? 'tempo' : e.unit}</span>
            </Link>
          ))}
        </Card>
        {others.length > 0 && (
          <>
            <h2 className="font-bold pt-2">Servono altri attrezzi</h2>
            <Card className="p-0 divide-y divide-line">
              {others.map((e) => (
                <Link key={e.id} to={`/esercizi/${e.id}`} className="flex justify-between items-center gap-3 px-4 min-h-[52px] text-muted">
                  <span>{e.name}</span>
                  <span className="text-xs text-right">{(infoOf(e)?.needs ?? []).filter((n) => !have?.has(n)).map((n) => EQUIP_LABEL[n].split(' (')[0]).join(', ')}</span>
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
