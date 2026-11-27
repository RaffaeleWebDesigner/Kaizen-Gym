import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { useNavigate } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'minima';

export function Button({ variant = 'secondary', big, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-accent text-black font-bold active:brightness-90',
    secondary: 'bg-surface2 text-ink border border-line active:bg-line',
    ghost: 'bg-transparent text-muted active:text-ink',
    danger: 'bg-danger/15 text-danger border border-danger/40 active:bg-danger/25',
    minima: 'bg-minima/15 text-minima border border-minima/50 font-semibold active:bg-minima/25',
  };
  return (
    <button
      className={`rounded-2xl ${big ? 'min-h-[64px] text-lg px-5' : 'min-h-[48px] px-4'} select-none transition disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-3xl p-4 ${className}`}>{children}</div>;
}

export function Header({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-line pt-safe">
      <div className="flex items-center gap-2 h-14 px-2">
        {back ? (
          <button aria-label="Indietro" className="w-12 h-12 grid place-items-center text-2xl text-muted active:text-ink" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
            ‹
          </button>
        ) : (
          <div className="w-2" />
        )}
        <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
        {right}
      </div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border-t border-line rounded-t-3xl p-4 pb-safe max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-line rounded-full mx-auto mb-3" />
        {title && <h2 className="text-lg font-bold mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, confirmLabel = 'Conferma', danger, onConfirm, onClose }: {
  open: boolean; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="text-muted mb-4">{text}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onClose}>Annulla</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}

/** Campo numerico con − e + grandi. */
export function Stepper({ value, onChange, step = 1, min = 0, label, suffix, width = 'w-14' }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; label?: string; suffix?: string; width?: string;
}) {
  const [text, setText] = useState(String(value).replace('.', ','));
  useEffect(() => setText(String(value).replace('.', ',')), [value]);
  const commit = (t: string) => {
    const n = parseFloat(t.replace(',', '.'));
    if (!isNaN(n)) onChange(Math.max(min, Math.round(n * 100) / 100));
    else setText(String(value).replace('.', ','));
  };
  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-[11px] uppercase tracking-wide text-muted mb-1">{label}</span>}
      <div className="flex items-center bg-surface2 border border-line rounded-xl">
        <button type="button" aria-label={`Meno ${label ?? ''}`} className="w-10 h-11 text-xl text-muted active:text-ink" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>−</button>
        <input
          inputMode="decimal"
          aria-label={label}
          className={`${width} bg-transparent text-center text-lg font-semibold outline-none`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" aria-label={`Più ${label ?? ''}`} className="w-10 h-11 text-xl text-muted active:text-ink" onClick={() => onChange(Math.round((value + step) * 100) / 100)}>+</button>
      </div>
      {suffix && <span className="text-[11px] text-muted mt-1">{suffix}</span>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-muted mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-3 min-h-[48px] text-base outline-none focus:border-accent';

export function NumInput({ value, onChange, placeholder, step = 'any' }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; step?: string }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','));
  useEffect(() => setText(value === null || value === undefined ? '' : String(value).replace('.', ',')), [value]);
  return (
    <input
      inputMode="decimal"
      step={step}
      className={inputCls}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim().replace(',', '.');
        if (t === '') return onChange(null);
        const n = parseFloat(t);
        onChange(isNaN(n) ? null : n);
      }}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between w-full min-h-[48px] gap-3">
      <span className="text-left">{label}</span>
      <span className={`w-12 h-7 rounded-full relative transition shrink-0 ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-bg transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function Chips<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] px-4 rounded-full border ${value === o.value ? 'bg-accent text-black border-accent font-semibold' : 'bg-surface2 border-line text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

let toastSetter: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSetter?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => { toastSetter = null; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="fixed left-0 right-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="bg-ink text-black font-semibold rounded-2xl px-4 py-3 shadow-lg">{msg}</div>
    </div>
  );
}
