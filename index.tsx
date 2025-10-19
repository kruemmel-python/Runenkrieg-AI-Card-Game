import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ GPU-Präferenz vor App-Start setzen:
//    - mode: 'dgpu' erzwingt (wo möglich) die dedizierte GPU
//    - nameHint: optionaler Namens-Teilstring deiner Ziel-GPU
import { setGpuAdapterHint, getSelectedAdapterInfo } from './services/gpuAcceleration';

// dGPU bevorzugen; passe den Hint an deine Karte an (oder entferne ihn).
setGpuAdapterHint({ mode: 'dgpu', nameHint: 'RX 6500M' });

// Hinweis: getSelectedAdapterInfo() liefert erst NACH dem ersten GPU-Compute verlässliche Infos.
// Du kannst zur Kontrolle später im Training erneut auslesen (oder hier einfach schon mal loggen).
const info = getSelectedAdapterInfo();
if (info) {
  // Wenn schon verfügbar (z. B. nach Hot Reload), ins Log schreiben:
  // (In vielen Fällen ist das hier zunächst null und wird später beim ersten Compute gesetzt.)
  // eslint-disable-next-line no-console
  console.log('GPU aktiv (frühe Abfrage):', info);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
