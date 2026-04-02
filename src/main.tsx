import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './index.css';

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        returnStrategy: 'back',
      }}
      walletsListConfiguration={{
        // Excluir telegram-wallet (SCW) que causa el error en móvil
        // Solo mostrar wallets con bridge confiable
        excludeWallets: ['telegram-wallet'],
      }}
    >
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
