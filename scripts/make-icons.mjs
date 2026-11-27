// Genera le icone PNG della PWA dall'SVG usando Chromium (Playwright).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // usa quello installato (anche globale con NODE_PATH)
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
// variante maskable: sfondo pieno, simbolo dentro la zona sicura (80%)
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<path', '<g transform="translate(51 51) scale(0.8)"><path').replace('</svg>', '').replace(/(<circle[^>]*\/>)/, '$1</g>') + '</svg>';
const browser = await chromium.launch();
const page = await browser.newPage();
const out = [
  ['pwa-192.png', 192, svg], ['pwa-512.png', 512, svg], ['apple-touch-icon.png', 180, maskable], ['pwa-maskable-512.png', 512, maskable],
];
for (const [name, size, src] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icone create');
