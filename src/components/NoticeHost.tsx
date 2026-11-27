import { useSettings, setSetting } from '../lib/settings';
import RankBadge from './RankBadge';
import { Button } from './ui';
import { tierOf } from '../lib/rank';

/** Promozioni (animazione a schermo intero) e retrocessioni (messaggio neutro). */
export default function NoticeHost() {
  const s = useSettings();
  const n = s?.notices[0];
  if (!s || !n) return null;
  const close = () => setSetting('notices', s.notices.slice(1));
  if (n.kind === 'goal') {
    return (
      <div className="fixed inset-0 z-[80] bg-bg flex flex-col items-center justify-center p-6 text-center overflow-hidden" role="dialog" aria-modal="true">
        <div className="relative kz-pop text-[120px] leading-none" aria-hidden>🎯</div>
        <div className="relative text-xs uppercase tracking-[0.3em] text-accent font-bold mt-6">{n.title}</div>
        <p className="relative text-xl font-bold mt-2 max-w-sm">{n.text}</p>
        <Button big variant="primary" className="relative mt-8 w-full max-w-sm" onClick={close}>Avanti così</Button>
      </div>
    );
  }
  const color = tierOf(Math.max(1, n.level)).tier.color;
  if (n.kind === 'promotion') {
    return (
      <div className="fixed inset-0 z-[80] bg-bg flex flex-col items-center justify-center p-6 text-center overflow-hidden" role="dialog" aria-modal="true">
        <div className="absolute w-[140vmax] h-[140vmax] rounded-full opacity-20 kz-spin" style={{ background: `conic-gradient(from 0deg, transparent, ${color}, transparent 30%, ${color}, transparent 60%, ${color}, transparent)` }} />
        <div className="relative kz-pop"><RankBadge level={n.level} size={160} /></div>
        <div className="relative text-xs uppercase tracking-[0.3em] text-accent font-bold mt-6">Promozione</div>
        <h1 className="relative text-3xl font-black mt-1" style={{ color }}>{n.title}</h1>
        <p className="relative text-muted mt-2 max-w-sm">{n.text}</p>
        <Button big variant="primary" className="relative mt-8 w-full max-w-sm" onClick={close}>Avanti così</Button>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 pb-safe" role="dialog">
      <div className="max-w-lg mx-auto bg-surface2 border border-line rounded-3xl p-4">
        <div className="flex gap-3 items-center">
          <RankBadge level={n.level} size={44} />
          <div className="font-semibold">{n.title}</div>
        </div>
        <p className="text-sm text-muted mt-2">{n.text}</p>
        <Button className="w-full mt-3" onClick={close}>Ok</Button>
      </div>
    </div>
  );
}
