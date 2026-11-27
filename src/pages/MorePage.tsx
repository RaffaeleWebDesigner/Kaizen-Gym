import { Link } from 'react-router-dom';
import { Card, Header } from '../components/ui';
import { useSettings } from '../lib/settings';
import { APP_VERSION, feedbackMailto } from '../lib/feedback';

const ITEMS = [
  { to: '/account', icon: '🔄', title: 'Account e sincronizzazione', text: 'Stessi progressi su telefono e computer' },
  { to: '/modelli', icon: '📋', title: 'Modelli di seduta', text: 'A, B, C e Minima: esercizi, serie, fasce e carichi' },
  { to: '/foto', icon: '📷', title: 'Foto dei progressi', text: 'Frontale e laterale ogni 4 settimane, confronto prima/dopo' },
  { to: '/obiettivi', icon: '🎯', title: 'Obiettivi', text: 'Traguardi a tappe piccole, senza scadenze' },
  { to: '/sfide', icon: '🔥', title: 'Sfide dure', text: 'Dure ma sicure, si sbloccano con la costanza' },
  { to: '/successi', icon: '🫙', title: 'Barattolo dei successi', text: 'I tuoi successi, verificati con i dati' },
  { to: '/rank', icon: '💎', title: 'Rank', text: 'Livello di forza stimato, da Rame a Super Lega' },
  { to: '/promemoria', icon: '⏰', title: 'Promemoria', text: 'Giorni di palestra nel calendario del telefono (.ics)' },
  { to: '/calcio', icon: '⚽', title: 'Altro sport', text: 'Partite e allenamenti di un altro sport: scegli i giorni migliori per la palestra' },
  { to: '/revisioni', icon: '🪞', title: 'Revisioni', text: 'Revisione settimanale e punto del mese' },
  { to: '/dati', icon: '💾', title: 'Dati e backup', text: 'Riepilogo per il coach, JSON, CSV' },
  { to: '/impostazioni', icon: '⚙️', title: 'Impostazioni', text: 'Attrezzatura e programma, lettera del giorno 1, rank' },
];

export default function MorePage() {
  const s = useSettings();
  if (!s) return null;
  const installed = !!window.matchMedia?.('(display-mode: standalone)').matches;
  const items = ITEMS.filter((i) => i.to !== '/rank' || s.rankEnabled).map((i) => (i.to === '/calcio' && s.sportEnabled ? { ...i, title: `${s.sportName} e pianificazione` } : i));
  return (
    <div className="pb-nav">
      <Header title="Altro" />
      <div className="p-4 space-y-2">
        <Card className="border-accent/40">
          <p className="font-semibold mb-1">Stai provando la beta</p>
          <p className="text-sm text-muted mb-3">Qualcosa non va o ti manca qualcosa? Scrivimelo: si apre un’email già pronta.</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={feedbackMailto('problema', { installed })} className="min-h-[48px] grid place-items-center text-center px-2 rounded-xl bg-accent text-black font-semibold text-sm">🐞 Un problema</a>
            <a href={feedbackMailto('idea', { installed })} className="min-h-[48px] grid place-items-center text-center px-2 rounded-xl border border-line bg-surface2 font-semibold text-sm">💡 Un’idea</a>
          </div>
        </Card>
        {items.map((i) => (
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
        <p className="text-xs text-muted text-center pt-2">Kaizen-Gym {APP_VERSION}</p>
      </div>
    </div>
  );
}
