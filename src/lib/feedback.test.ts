import { describe, expect, it } from 'vitest';
import { deviceInfo, feedbackMailto } from './feedback';
import { CONTACT_EMAIL } from './contact';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('segnalazioni', () => {
  it('riconosce telefono e browser', () => {
    expect(deviceInfo(IPHONE)).toBe('iOS 18.1, Safari');
    expect(deviceInfo(ANDROID)).toBe('Android 14, Chrome');
  });
  it('prepara un’email al contatto con versione e dispositivo', () => {
    const m = feedbackMailto('problema', { installed: true, ua: IPHONE });
    expect(m.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    const body = decodeURIComponent(m.split('body=')[1]);
    expect(body).toContain('Cosa è successo');
    expect(body).toContain('Dispositivo: iOS 18.1, Safari, app sulla schermata Home');
  });
});
