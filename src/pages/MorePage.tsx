import { Link } from 'react-router-dom';
import { Card, Header } from '../components/ui';

const ITEMS = [
  { to: '/account', icon: '🔄', title: 'Account e sincronizzazione', text: 'Stessi progressi su iPhone e PC' },
  { to: '/modelli', icon: '📋', title: 'Modelli di seduta', text: 'A, B, C e Minima: esercizi, serie, fasce e carichi' },
  { to: '/foto', icon: '📷', title: 'Foto dei progressi', text: 'Frontale e laterale ogni 4 settimane, confronto prima/dopo' },
  { to: '/obiettivi', icon: '🎯', title: 'Obiettivi', text: 'Traguardi a tappe piccole, senza scadenze' },
  { to: '/sfide', icon: '🔥', title: 'Sfide dure', text: 'Dure ma sicure, si sbloccano con la costanza' },
  { to: '/successi', icon: '🫙', title: 'Barattolo dei successi', text: 'I tuoi successi, verificati con i dati' },
  { to: '/rank', icon: '💎', title: 'Rank', text: 'Livello di forza stimato, da Rame a Super Lega' },
  { to: '/promemoria', icon: '⏰', title: 'Promemoria', text: 'Giorni di palestra nel calendario del telefono (.ics)' },
  { to: '/calcio', icon: '⚽', title: 'Calcio e pianificazione', text: 'Partite, allenamenti e i 3 giorni migliori per la palestra' },
  { to: '/revisioni', icon: '🪞', title: 'Revisioni', text: 'Revisione settimanale e punto del mese' },
  { to: '/dati', icon: '💾', title: 'Dati e backup', text: 'Riepilogo per il coach, JSON, CSV' },
  { to: '/impostazioni', icon: '⚙️', title: 'Impostazioni', text: 'Attrezzatura, lettera del giorno 1, soglie rank' },
];

export default function MorePage() {
  return (
    <div className="pb-nav">
      <Header title="Altro" />
      <div className="p-4 space-y-2">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="block">
            <Card className="flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden>{i.icon}</span>
              <div className="flex-1">
                <div className="font-semibold">{i.title}</div>
                <div className="text-sm text-muted">{i.text}</div>
              </div>
              <span className="text-muted">›</span>
            </Card>
          </Link>
        ))}
        <Card className="mt-4">
          <p className="font-semibold mb-1">Le due regole</p>
          <p className="text-sm text-muted"><b className="text-ink">Kaizen decide quanto:</b> +1 ripetizione o il carico più piccolo possibile, sempre 2-3 ripetizioni di margine, 30-45 minuti.</p>
          <p className="text-sm text-muted mt-1"><b className="text-ink">Presentarsi decide se:</b> si va sempre. Nei giorni no c’è la seduta minima, e conta.</p>
        </Card>
      </div>
    </div>
  );
}
