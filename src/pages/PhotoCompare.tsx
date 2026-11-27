import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, Chips, Field, Header, inputCls } from '../components/ui';
import { db, type Photo } from '../db';
import { fmtDateFull } from '../lib/dates';
import { usePhotoUrl } from './PhotosPage';

export default function PhotoCompare() {
  const [pose, setPose] = useState<Photo['pose']>('front');
  const photos = useLiveQuery(() => db.photos.where('pose').equals(pose).sortBy('date'), [pose]);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [pos, setPos] = useState(50);
  const [mode, setMode] = useState<'slider' | 'side'>('slider');

  useEffect(() => {
    if (photos && photos.length) {
      setA(photos[0].id!);
      setB(photos[photos.length - 1].id!);
    } else {
      setA(null);
      setB(null);
    }
  }, [photos]);

  const pa = photos?.find((p) => p.id === a) ?? null;
  const pb = photos?.find((p) => p.id === b) ?? null;
  const ua = usePhotoUrl(pa);
  const ub = usePhotoUrl(pb);
  if (!photos) return null;

  return (
    <div className="pb-nav">
      <Header title="Confronta" back="/foto" />
      <div className="p-4 space-y-3">
        <Chips options={[{ value: 'front', label: 'Frontale' }, { value: 'side', label: 'Laterale' }]} value={pose} onChange={(v) => setPose(v as Photo['pose'])} />
        {photos.length < 2 ? (
          <Card><p className="text-muted text-sm">Servono almeno 2 foto di questo tipo.</p></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Prima">
                <select className={inputCls} value={a ?? ''} onChange={(e) => setA(Number(e.target.value))}>
                  {photos.map((p) => <option key={p.id} value={p.id}>{fmtDateFull(p.date)}</option>)}
                </select>
              </Field>
              <Field label="Dopo">
                <select className={inputCls} value={b ?? ''} onChange={(e) => setB(Number(e.target.value))}>
                  {photos.map((p) => <option key={p.id} value={p.id}>{fmtDateFull(p.date)}</option>)}
                </select>
              </Field>
            </div>
            <Chips options={[{ value: 'slider', label: 'Slider prima/dopo' }, { value: 'side', label: 'Affiancate' }]} value={mode} onChange={(v) => setMode(v as 'slider' | 'side')} />
            {mode === 'slider' && ua && ub && (
              <>
                <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-surface2 select-none">
                  <img src={ub} alt="dopo" className="absolute inset-0 w-full h-full object-cover" />
                  <img src={ua} alt="prima" className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-accent" style={{ left: `${pos}%` }} />
                  <span className="absolute top-2 left-2 text-xs bg-black/70 rounded px-2 py-1">Prima · {pa && fmtDateFull(pa.date)}</span>
                  <span className="absolute top-2 right-2 text-xs bg-black/70 rounded px-2 py-1">Dopo · {pb && fmtDateFull(pb.date)}</span>
                </div>
                <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[#c6ff00] h-10" aria-label="Slider prima e dopo" />
              </>
            )}
            {mode === 'side' && (
              <div className="grid grid-cols-2 gap-2">
                {[{ u: ua, p: pa, l: 'Prima' }, { u: ub, p: pb, l: 'Dopo' }].map((x) => (
                  <div key={x.l}>
                    {x.u && <img src={x.u} alt={x.l} className="w-full aspect-[3/4] object-cover rounded-2xl" />}
                    <div className="text-xs text-muted text-center mt-1">{x.l} · {x.p && fmtDateFull(x.p.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
