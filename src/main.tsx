import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { seedIfEmpty } from './seed';
import { ensureMachines, ensureV2, ensureV3 } from './migrations';
import { syncDerived } from './lib/derived';
import { startSync } from './sync';
import { syncConsentMirror } from './lib/privacy';

// Su iPhone l'app installata riprende dallo sfondo senza ricaricarsi: senza questo
// controllo resterebbe sulla versione vecchia anche dopo un aggiornamento.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
  },
});

seedIfEmpty()
  .then(() => ensureV2())
  .then(() => ensureV3())
  .then(() => ensureMachines())
  .then(() => syncConsentMirror())
  .then(() => syncDerived())
  .catch((e) => console.error('Seed fallito', e))
  .finally(() => {
    startSync();
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
