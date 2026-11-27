import { useEffect, useRef, useState } from 'react';

export interface TimerState {
  endAt: number;
  total: number;
  label: string;
}

let audioCtx: AudioContext | null = null;
export function primeAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* niente audio */
  }
}

function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, audioCtx!.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + t + 0.2);
      o.connect(g).connect(audioCtx!.destination);
      o.start(audioCtx!.currentTime + t);
      o.stop(audioCtx!.currentTime + t + 0.2);
    });
  } catch {
    /* niente audio */
  }
}

export default function RestTimer({ timer, onChange }: { timer: TimerState | null; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    if (!timer) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [timer]);

  useEffect(() => {
    if (timer && now >= timer.endAt && !fired.current) {
      fired.current = true;
      navigator.vibrate?.([300, 150, 300, 150, 300]);
      beep();
    }
  }, [now, timer]);

  if (!timer) return null;
  const left = Math.max(0, Math.ceil((timer.endAt - now) / 1000));
  const over = left === 0;
  const pct = Math.min(100, ((timer.total - left) / timer.total) * 100);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className={`max-w-lg mx-auto m-2 rounded-3xl border overflow-hidden ${over ? 'bg-accent text-black border-accent' : 'bg-surface2 border-line'}`}>
        {!over && <div className="h-1 bg-accent transition-all" style={{ width: `${pct}%` }} />}
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1 min-w-0">
            <div className={`text-xs ${over ? '' : 'text-muted'} truncate`}>{over ? 'Recupero finito: vai con la prossima serie' : `Recupero · ${timer.label}`}</div>
            <div className="text-3xl font-bold tabular">{mm}:{ss}</div>
          </div>
          {!over && (
            <button className="h-12 px-3 rounded-xl bg-bg/40 border border-line" onClick={() => onChange({ ...timer, endAt: timer.endAt + 15000, total: timer.total + 15 })}>+15"</button>
          )}
          <button className={`h-12 px-4 rounded-xl font-semibold ${over ? 'bg-black text-accent' : 'bg-bg/40 border border-line'}`} onClick={() => onChange(null)}>
            {over ? 'Ok' : 'Stop'}
          </button>
        </div>
      </div>
    </div>
  );
}
