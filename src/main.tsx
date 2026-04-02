import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './index.css';

// Manifest servido desde /public/ con CORS abierto
const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

// Detectar si estamos dentro de Telegram
const isTelegramWebApp = !!(window as any).Telegram?.WebApp?.initData;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        // En Telegram, volver a la mini-app después de la TX
        returnStrategy: isTelegramWebApp ? 'back' : 'none',
        twaReturnUrl: isTelegramWebApp
          ? 'https://t.me/AnimalitoLottoBot/lotto'  // ← pon tu bot username y app name
          : undefined,
      }}
      walletsListConfiguration={{
        // Incluir Telegram Wallet (wallet nativa en móvil Telegram)
        includeWallets: [
          {
            appName: 'telegram-wallet',
            name: 'Wallet',
            imageUrl: 'https://wallet.tg/images/logo-288.png',
            aboutUrl: 'https://wallet.tg/',
            universalLink: 'https://t.me/wallet?attach=wallet',
            bridgeUrl: 'https://bridge.tonapi.io/bridge',
            platforms: ['ios', 'android', 'macos', 'windows', 'linux'],
          },
        ],
      }}
    >
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
