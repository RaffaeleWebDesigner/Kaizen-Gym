import { useState } from 'react';
import { Button, Card, Confirm, Header, Sheet, toast } from '../components/ui';
import { downloadBackup } from '../lib/exportData';
import { fmtDate } from '../lib/dates';
import { link, resetAccount, restoreInternalBackup, signIn, signOut, signUp, syncNow, useSync } from '../sync';

const input = 'w-full min-h-[48px] bg-surface2 border border-line rounded-xl px-3 text-base';

function ago(ts: number | null) {
  if (!ts) return 'mai';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  return new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function LoginForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'in') await signIn(email, pw);
      else if (await signUp(email, pw)) setSent(true);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <h2 className="font-bold mb-1">Controlla la posta</h2>
        <p className="text-sm text-muted">Ti è arrivata un’email da Supabase: apri il link per confermare l’account. Si aprirà nel browser: va bene così. Poi torna qui e accedi con email e password.</p>
        <Button className="w-full mt-3" onClick={() => { setSent(false); setMode('in'); }}>Ho confermato, accedo</Button>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-bold mb-1">{mode === 'in' ? 'Accedi' : 'Crea un account'}</h2>
      <p className="text-sm text-muted mb-3">Con lo stesso account su iPhone e PC vedi gli stessi progressi. Ogni account ha i suoi dati.</p>
      <form onSubmit={submit} className="space-y-2">
        <input className={input} type="email" autoComplete="email" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="Password (almeno 6 caratteri)" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button big variant="primary" className="w-full" disabled={busy}>{busy ? 'Un attimo…' : mode === 'in' ? 'Accedi' : 'Crea account'}</Button>
      </form>
      <button className="text-sm text-accent mt-3" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }}>
        {mode === 'in' ? 'Non hai un account? Creane uno' : 'Hai già un account? Accedi'}
      </button>
    </Card>
  );
}

export default function AccountPage() {
  const s = useSync();
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [choice, setChoice] = useState<'cloud' | 'device' | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');

  // Il download del file resta separato dal collegamento: su iPhone apre un'anteprima
  // che interrompe la pagina, quindi non va mai messo in fila prima di link().
  const saveFile = async () => {
    try {
      await downloadBackup();
    } catch {
      toast('Backup non scaricato: riprova da Dati e backup');
    }
  };

  return (
    <div className="pb-nav">
      <Header title="Account e sincronizzazione" back="/altro" />
      <div className="p-4 space-y-3">
        {s.phase === 'loading' && <Card><p className="text-muted">Caricamento…</p></Card>}

        {s.phase === 'signedOut' && <LoginForm />}

        {s.phase === 'notLinked' && (
          <Card>
            <h2 className="font-bold mb-1">Collega questo dispositivo</h2>
            <p className="text-sm text-muted mb-1">Account: <b className="text-ink">{s.email}</b></p>
            <ul className="text-sm text-muted list-disc pl-5 my-2 space-y-1">
              <li>Se il cloud è vuoto, i dati di questo dispositivo vengono caricati. Non si cancella niente.</li>
              <li>Se questo dispositivo ha solo i dati iniziali dell’app, prende quelli del cloud. Un account nuovo parte da zero.</li>
              <li>Se ci sono dati veri da entrambe le parti, ti chiedo quali tenere.</li>
              <li>Le foto restano solo su questo dispositivo.</li>
            </ul>
            <p className="text-sm text-muted mb-3">Prima di collegare l’app salva da sola una copia di sicurezza interna, che puoi ripristinare da qui. Se vuoi anche il file, scaricalo prima e poi torna qui.</p>
            <div className="grid gap-2">
              <Button big variant="primary" onClick={() => link()}>Collega questo dispositivo</Button>
              <Button variant="ghost" onClick={saveFile}>Scarica prima il file di backup</Button>
            </div>
          </Card>
        )}

        {s.phase === 'ask' && s.ask && (
          <Card className="border-minima/50">
            <h2 className="font-bold mb-1">Quali dati tengo?</h2>
            <p className="text-sm text-muted mb-3">
              {s.ask.reason === 'otherAccount'
                ? 'Su questo dispositivo ci sono i dati di un altro account.'
                : 'Ci sono dati veri sia su questo dispositivo sia nel cloud.'}{' '}
              Unirli creerebbe doppioni, quindi ne tengo una versione sola.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-surface2 rounded-xl p-3">
                <div className="font-semibold">Questo dispositivo</div>
                <div className="text-muted">{s.ask.local.sessions} sedute, {s.ask.local.measurements} misure</div>
                <div className="text-muted">Ultima: {s.ask.local.lastSession ? fmtDate(s.ask.local.lastSession) : '–'}</div>
              </div>
              <div className="bg-surface2 rounded-xl p-3">
                <div className="font-semibold">Cloud</div>
                <div className="text-muted">{s.ask.cloud.sessions} sedute, {s.ask.cloud.measurements} misure</div>
                <div className="text-muted">Ultima: {s.ask.cloud.lastSession ? fmtDate(s.ask.cloud.lastSession) : '–'}</div>
              </div>
            </div>
            <div className="grid gap-2">
              <Button big onClick={() => setChoice('cloud')}>Usa i dati del cloud</Button>
              <Button big onClick={() => setChoice('device')}>Usa i dati di questo dispositivo</Button>
            </div>
          </Card>
        )}

        {(s.phase === 'ok' || s.phase === 'syncing' || s.phase === 'error') && (
          <Card className={s.phase === 'error' ? 'border-danger/50' : ''}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${s.phase === 'error' ? 'bg-danger' : s.phase === 'syncing' ? 'bg-minima animate-pulse' : 'bg-accent'}`} />
              <h2 className="font-bold">{s.phase === 'error' ? 'Sincronizzazione non riuscita' : s.phase === 'syncing' ? 'Sincronizzo…' : 'Sincronizzato'}</h2>
            </div>
            <p className="text-sm text-muted">Account: <b className="text-ink">{s.email}</b></p>
            <p className="text-sm text-muted">Ultima sincronizzazione: <b className="text-ink">{ago(s.lastSyncAt)}</b></p>
            {s.pending > 0 && <p className="text-sm text-muted">Modifiche da inviare: <b className="text-ink">{s.pending}</b></p>}
            {s.error && <p className="text-sm text-danger mt-2">{s.error}</p>}
            {s.phase === 'error' && s.error?.includes('pausa') && (
              <p className="text-xs text-muted mt-1">Se il progetto è in pausa, riattivalo da supabase.com (Restore project). Intanto l’app funziona e invia tutto appena torna disponibile.</p>
            )}
            <Button big variant="primary" className="w-full mt-3" disabled={s.phase === 'syncing'} onClick={() => syncNow()}>Sincronizza ora</Button>
            <p className="text-xs text-muted mt-3">Si sincronizza da sola quando apri l’app, quando salvi qualcosa e quando torna la rete. Le foto restano solo su questo dispositivo.</p>
          </Card>
        )}

        {(s.phase === 'ok' || s.phase === 'error') && (
          <Card>
            <h2 className="font-bold mb-1">Ricomincia da zero</h2>
            <p className="text-sm text-muted mb-3">Cancella sedute, misure e tutto il resto di questo account, qui e su tutti i dispositivi collegati. Restano esercizi e modelli predefiniti e le foto di questo dispositivo.</p>
            <Button variant="danger" className="w-full" onClick={() => { setResetText(''); setResetOpen(true); }}>Ricomincia da zero…</Button>
          </Card>
        )}

        {s.email && (
          <Card>
            <Button className="w-full" onClick={() => setConfirmOut(true)}>Esci dall’account</Button>
            <p className="text-xs text-muted mt-2">I dati restano su questo dispositivo.</p>
          </Card>
        )}

        {s.backupAt && (
          <Card>
            <h2 className="font-bold mb-1">Copia di sicurezza</h2>
            <p className="text-sm text-muted mb-3">Fatta prima del collegamento, il {new Date(s.backupAt).toLocaleString('it-IT')}. Foto escluse.</p>
            <Button className="w-full" onClick={() => setConfirmRestore(true)}>Ripristina questa copia</Button>
          </Card>
        )}
      </div>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Ricominciare da zero?">
        <p className="text-muted mb-3">Account <b className="text-ink">{s.email}</b>: tutti i dati di questo account vengono cancellati qui, nel cloud e sugli altri dispositivi collegati. Su questo dispositivo resta una copia di sicurezza interna.</p>
        <p className="text-sm text-muted mb-2">Per confermare scrivi <b className="text-ink">AZZERA</b>.</p>
        <input className={input + ' mb-3'} value={resetText} onChange={(e) => setResetText(e.target.value)} autoCapitalize="characters" />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setResetOpen(false)}>Annulla</Button>
          <Button variant="danger" disabled={resetText.trim().toUpperCase() !== 'AZZERA'} onClick={async () => { setResetOpen(false); await resetAccount(); toast('Account azzerato'); }}>Azzera</Button>
        </div>
      </Sheet>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} title="Uscire dall’account?" confirmLabel="Esci"
        text="La sincronizzazione si ferma. I dati restano su questo dispositivo e nel cloud." onConfirm={() => signOut()} />
      <Confirm open={confirmRestore} onClose={() => setConfirmRestore(false)} danger title="Ripristinare la copia?" confirmLabel="Ripristina"
        text="I dati di questo dispositivo tornano com’erano prima del collegamento. Se sei collegato, la copia viene inviata anche al cloud."
        onConfirm={async () => { try { await restoreInternalBackup(); toast('Copia ripristinata'); } catch (e) { toast((e as Error).message); } }} />
      <Confirm open={!!choice} onClose={() => setChoice(null)} danger
        title={choice === 'cloud' ? 'Usare i dati del cloud?' : 'Usare i dati di questo dispositivo?'}
        confirmLabel="Continua"
        text={choice === 'cloud'
          ? 'I dati di questo dispositivo vengono sostituiti da quelli del cloud (le foto restano). La copia di sicurezza interna viene salvata prima.'
          : 'I dati nel cloud vengono sostituiti da quelli di questo dispositivo, anche sugli altri dispositivi collegati. La copia di sicurezza interna viene salvata prima.'}
        onConfirm={() => { void link(choice!); }} />
    </div>
  );
}
