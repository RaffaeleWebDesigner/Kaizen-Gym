import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, Chips, Confirm, Field, Header, Sheet, inputCls, toast } from '../components/ui';
import { db, type Photo } from '../db';
import { fmtDateFull, todayISO } from '../lib/dates';
import { exportPhotosZip, fileToPhotoData, importPhotosZip, photoDue, photoUrl, POSE_LABEL } from '../lib/photos';
import { useSettings } from '../lib/settings';

export function usePhotoUrl(p: Photo | null | undefined) {
  const url = useMemo(() => (p ? photoUrl(p) : null), [p]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Thumb({ p, onClick }: { p: Photo; onClick: () => void }) {
  const url = usePhotoUrl(p);
  return (
    <button onClick={onClick} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-surface2 border border-line">
      {url && <img src={url} alt={`${POSE_LABEL[p.pose]} ${p.date}`} className="w-full h-full object-cover" />}
      <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 rounded px-1">{POSE_LABEL[p.pose]}</span>
    </button>
  );
}

export default function PhotosPage() {
  const nav = useNavigate();
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []);
  const settings = useSettings();
  const [view, setView] = useState<Photo | null>(null);
  const [del, setDel] = useState(false);
  const [manual, setManual] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);
  if (!photos || !settings) return null;
  const byDate = new Map<string, Photo[]>();
  for (const p of photos) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
  const due = photoDue(photos, settings.startDate);

  return (
    <div className="pb-nav">
      <Header title="Foto dei progressi" back="/altro" />
      <div className="p-4 space-y-3">
        {due && (
          <Card className="border-accent/50">
            <p className="font-semibold text-accent">È il momento delle foto di questo blocco di 4 settimane</p>
            <p className="text-sm text-muted">Due scatti: frontale e laterale.</p>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button big variant="primary" onClick={() => nav('/foto/scatta/front')}>📷 Frontale</Button>
          <Button big variant="primary" onClick={() => nav('/foto/scatta/side')}>📷 Laterale</Button>
        </div>
        <Card className="text-sm text-muted">Stessa luce, stessa ora, stesso posto. Le foto restano solo su questo telefono.</Card>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setManual(true)}>+ Aggiungi dalla galleria</Button>
          <Button disabled={photos.length < 2} onClick={() => nav('/foto/confronta')}>⇆ Confronta</Button>
        </div>

        {photos.length === 0 && <p className="text-muted text-sm text-center py-6">Ancora nessuna foto.</p>}
        {[...byDate.entries()].map(([date, list]) => (
          <div key={date}>
            <div className="text-sm font-semibold mb-1">{fmtDateFull(date)}</div>
            <div className="grid grid-cols-3 gap-2">
              {list.map((p) => <Thumb key={p.id} p={p} onClick={() => setView(p)} />)}
            </div>
          </div>
        ))}

        <Card>
          <h2 className="font-bold mb-1">Backup delle foto</h2>
          <p className="text-sm text-muted mb-2">Un file ZIP separato dal backup JSON, così quello resta leggero.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!photos.length} onClick={async () => { const z = await exportPhotosZip(); if (z) { const url = URL.createObjectURL(z); const a = document.createElement('a'); a.href = url; a.download = `kaizen-foto-${todayISO()}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); } }}>Esporta ZIP</Button>
            <Button onClick={() => zipRef.current?.click()}>Importa ZIP</Button>
          </div>
          <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try { const r = await importPhotosZip(await f.arrayBuffer()); toast(`${r.added} foto importate${r.skipped ? `, ${r.skipped} già presenti` : ''}`); } catch (err) { toast((err as Error).message); }
          }} />
        </Card>
      </div>

      {view && (
        <Sheet open onClose={() => setView(null)} title={`${POSE_LABEL[view.pose]} · ${fmtDateFull(view.date)}`}>
          <Big p={view} />
          {view.note && <p className="text-sm text-muted mt-2">{view.note}</p>}
          <Button variant="ghost" className="w-full mt-2" onClick={() => setDel(true)}>Elimina foto</Button>
          <Confirm open={del} onClose={() => setDel(false)} danger title="Eliminare la foto?" text="Non si può annullare (a meno che tu non abbia un backup ZIP)." confirmLabel="Elimina"
            onConfirm={async () => { await db.photos.delete(view.id!); setView(null); }} />
        </Sheet>
      )}
      {manual && <ManualAdd onClose={() => setManual(false)} />}
    </div>
  );
}

function Big({ p }: { p: Photo }) {
  const url = usePhotoUrl(p);
  return url ? <img src={url} alt="" className="w-full rounded-2xl" /> : null;
}

function ManualAdd({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [pose, setPose] = useState<Photo['pose']>('front');
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Sheet open onClose={onClose} title="Aggiungi foto">
      <Field label="Data">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Tipo">
        <Chips options={[{ value: 'front', label: 'Frontale' }, { value: 'side', label: 'Laterale' }]} value={pose} onChange={(v) => setPose(v as Photo['pose'])} />
      </Field>
      <Button big variant="primary" className="w-full" onClick={() => ref.current?.click()}>Scegli la foto</Button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const d = await fileToPhotoData(f);
        await db.photos.add({ date, pose, ...d, mime: 'image/jpeg', createdAt: Date.now() });
        toast('Foto salvata');
        onClose();
      }} />
    </Sheet>
  );
}
