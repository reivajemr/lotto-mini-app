import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './index.css';

const configuredManifestUrl = import.meta.env.VITE_TONCONNECT_MANIFEST_URL?.trim();
const fallbackManifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

// En producción (Telegram + WalletBot) el manifest debe ser público y sin auth.
const MANIFEST_URL = configuredManifestUrl || fallbackManifestUrl;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
