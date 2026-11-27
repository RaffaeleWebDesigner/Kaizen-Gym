import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Confirm, Header, Sheet, toast } from '../components/ui';
import { useSettings, setSetting } from '../lib/settings';
import { coachSummary, copyText, download, downloadBackup, importAll, sessionsCSV } from '../lib/exportData';
import { todayISO } from '../lib/dates';
import { useSync } from '../sync';

export default function DataPage() {
  const settings = useSettings();
  const sync = useSync();
  const synced = sync.phase === 'ok' || sync.phase === 'syncing' || sync.phase === 'error';
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  if (!settings) return null;
  const last = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const old = !last || Date.now() - last.getTime() > 14 * 86400000;

  const copy = async (mode: 'last' | 'week') => {
    const text = await coachSummary(mode);
    if (await copyText(text)) toast('Copiato: incollalo nella chat col coach');
    else setPreview(text);
  };

  return (
    <div className="pb-nav">
      <Header title="Dati e backup" back="/altro" />
      <div className="p-4 space-y-3">
        <Card>
          <h2 className="font-bold mb-1">Riepilogo per il coach</h2>
          <p className="text-sm text-muted mb-3">Testo in markdown con esercizi, serie, carichi, RIR, note e sedute saltate.</p>
          <div className="grid gap-2">
            <Button big variant="primary" onClick={() => copy('last')}>Copia ultima seduta</Button>
            <Button big onClick={() => copy('week')}>Copia settimana</Button>
            <Button variant="ghost" onClick={async () => setPreview(await coachSummary('week'))}>Vedi anteprima</Button>
          </div>
        </Card>

        <Card className={old ? 'border-minima/50' : ''}>
          <h2 className="font-bold mb-1">Backup</h2>
          <p className="text-sm text-muted mb-3">
            {synced ? 'I dati sono anche nel cloud (foto escluse), ma il backup resta la tua copia personale.' : 'I dati stanno solo su questo dispositivo.'} Ultimo backup: <b className={old ? 'text-minima' : 'text-ink'}>{last ? last.toLocaleDateString('it-IT') : 'mai'}</b>.
            {old && ' Fanne uno adesso e salvalo su Drive, iCloud o mandalo a te stesso.'}
          </p>
          <div className="grid gap-2">
            <Button big variant="primary" onClick={async () => { await downloadBackup(); toast('Backup scaricato'); }}>Esporta tutto (JSON)</Button>
            <Button big onClick={() => fileRef.current?.click()}>Importa backup (JSON)</Button>
            <Button big onClick={async () => { download(`kaizen-allenamenti-${todayISO()}.csv`, '﻿' + (await sessionsCSV()), 'text/csv;charset=utf-8'); }}>Esporta allenamenti (CSV)</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setPending(await f.text());
            e.target.value = '';
          }} />
          <p className="text-xs text-muted mt-3">Le foto dei progressi hanno un backup ZIP separato, in <Link to="/foto" className="text-accent">Foto dei progressi</Link>.</p>
          {settings.lastBackupAt && <button className="text-xs text-muted mt-3" onClick={() => setSetting('lastBackupAt', Date.now())}>Ho già salvato una copia altrove</button>}
        </Card>
      </div>

      <Confirm open={!!pending} onClose={() => setPending(null)} danger title="Sostituire tutti i dati?" confirmLabel="Importa"
        text="I dati attuali su questo dispositivo verranno sostituiti con quelli del backup. Se hai dubbi, esporta prima un backup di quelli attuali."
        onConfirm={async () => {
          try { await importAll(pending!); toast('Backup importato'); } catch (err) { toast((err as Error).message || 'Importazione non riuscita'); }
        }} />
      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Riepilogo">
        <textarea readOnly className="w-full h-72 bg-surface2 border border-line rounded-xl p-3 text-sm font-mono" value={preview ?? ''} onFocus={(e) => e.target.select()} />
        <p className="text-xs text-muted mt-2">Se la copia automatica non funziona, tieni premuto sul testo e copialo.</p>
      </Sheet>
    </div>
  );
}
