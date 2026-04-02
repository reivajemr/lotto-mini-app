import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './index.css';

// The manifest must be hosted at a publicly accessible URL
// In production (Vercel), this file exists at /tonconnect-manifest.json
const MANIFEST_URL = 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/AnimalitoLottoBot/app',
      }}
    >
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
