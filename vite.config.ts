import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE: "/" per Netlify o sviluppo locale, "/Kaizen/" per GitHub Pages (impostato dal workflow).
const base = process.env.BASE ?? '/';

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(`${process.env.npm_package_version ?? '1.0.0'} (${stamp})`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kaizen-Gym',
        short_name: 'Kaizen-Gym',
        description: 'Registra le sedute in palestra e guarda crescere la continuità.',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: { output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom', 'dexie', 'dexie-react-hooks'] } } },
  },
  test: { environment: 'node' },
} as any);
