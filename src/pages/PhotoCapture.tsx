import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, toast } from '../components/ui';
import { db, type Photo } from '../db';
import { todayISO, fmtDateFull } from '../lib/dates';
import { compressImage, fileToPhotoData, POSE_LABEL } from '../lib/photos';
import { usePhotoUrl } from './PhotosPage';

/** Scatto con la foto precedente in trasparenza, per ripetere posa e distanza. */
export default function PhotoCapture() {
  const pose = (useParams().pose === 'side' ? 'side' : 'front') as Photo['pose'];
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [opacity, setOpacity] = useState(0.35);
  const [timer, setTimer] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const prev = useLiveQuery(() => db.photos.where('pose').equals(pose).sortBy('date').then((l) => l[l.length - 1] ?? null), [pose]);
  const prevUrl = usePhotoUrl(prev ?? null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
          setErr(null);
        }
      } catch {
        setErr('La fotocamera non si apre dentro l’app. Usa il pulsante qui sotto per scattare con la fotocamera del telefono.');
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  const save = async (d: { data: ArrayBuffer; width: number; height: number }) => {
    await db.photos.add({ date: todayISO(), pose, ...d, mime: 'image/jpeg', createdAt: Date.now() });
    toast(`Foto ${POSE_LABEL[pose].toLowerCase()} salvata`);
    nav(pose === 'front' ? '/foto/scatta/side' : '/foto', { replace: true });
  };

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    navigator.vibrate?.(30);
    await save(await compressImage(v, v.videoWidth, v.videoHeight, facing === 'user'));
  };

  const startShoot = () => {
    if (!timer) return shoot();
    let n = timer;
    setCount(n);
    const i = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(i);
        setCount(null);
        shoot();
      } else setCount(n);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black z-40 flex flex-col">
      <div className="flex items-center justify-between p-3 pt-safe">
        <button className="h-12 px-3 text-muted" onClick={() => nav('/foto')}>✕ Chiudi</button>
        <div className="font-bold">{POSE_LABEL[pose]}</div>
        <button className="h-12 px-3 text-muted" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>⟲ Camera</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        {prevUrl && ready && <img src={prevUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ opacity }} />}
        {count !== null && <div className="absolute inset-0 grid place-items-center text-8xl font-black text-accent">{count}</div>}
        {err && <div className="absolute inset-0 grid place-items-center p-6 text-center text-muted">{err}</div>}
        <div className="absolute top-2 inset-x-2 bg-black/60 rounded-xl p-2 text-xs text-center">
          Stessa luce, stessa ora, stesso posto. {prev ? `In trasparenza: ${fmtDateFull(prev.date)}.` : 'È la prima foto di questo tipo.'}
        </div>
      </div>
      <div className="p-3 pb-safe space-y-2">
        {prevUrl && ready && (
          <label className="flex items-center gap-3 text-sm">
            <span className="text-muted w-24">Trasparenza</span>
            <input type="range" min={0} max={0.7} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1 accent-[#c6ff00]" />
          </label>
        )}
        <div className="flex items-center gap-2">
          <Button className="w-24" onClick={() => setTimer(timer === 0 ? 3 : timer === 3 ? 10 : 0)}>⏱ {timer ? `${timer}s` : 'no'}</Button>
          <Button big variant="primary" className="flex-1" disabled={!ready || count !== null} onClick={startShoot}>Scatta</Button>
        </div>
        <Button className="w-full" onClick={() => fileRef.current?.click()}>Usa la fotocamera del telefono</Button>
        <input ref={fileRef} type="file" accept="image/*" capture={facing} className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) await save(await fileToPhotoData(f));
        }} />
      </div>
    </div>
  );
}
