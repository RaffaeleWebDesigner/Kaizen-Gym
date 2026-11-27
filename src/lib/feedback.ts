import { CONTACT_EMAIL } from './contact';

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'sviluppo';

/** Dispositivo e browser in parole semplici, senza altri dati personali. */
export function deviceInfo(ua = navigator.userAgent): string {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? `iOS ${(/OS (\d+[_\d]*)/.exec(ua)?.[1] ?? '').replace(/_/g, '.')}`.trim()
    : /Android/.test(ua)
      ? `Android ${/Android ([\d.]+)/.exec(ua)?.[1] ?? ''}`.trim()
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'altro';
  const browser = /Edg/.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'altro';
  return `${os}, ${browser}`;
}

/** Email già pronta per il titolare, con versione e dispositivo in fondo. */
export function feedbackMailto(kind: 'problema' | 'idea', opts: { installed?: boolean; ua?: string } = {}): string {
  const subject = kind === 'problema' ? 'Kaizen-Gym: un problema' : 'Kaizen-Gym: un’idea';
  const ask = kind === 'problema'
    ? 'Cosa è successo:\n\n\nCosa stavi facendo (che pagina, che pulsante):\n\n\n'
    : 'La tua idea:\n\n\n';
  const body = `${ask}---\nVersione: ${APP_VERSION}\nDispositivo: ${deviceInfo(opts.ua)}${opts.installed ? ', app sulla schermata Home' : ''}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
