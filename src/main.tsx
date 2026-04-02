 import React from 'react';
 import ReactDOM from 'react-dom/client';
 import { TonConnectUIProvider } from '@tonconnect/ui-react';
 import App from './App';
 import './index.css';
 
-// El manifest debe estar en la raíz pública del proyecto
-const MANIFEST_URL = 'https://lotto-mini-e0tajf2wb-reivajemrs-projects.vercel.app/tonconnect-manifest.json';
+// Usa el mismo origen para evitar CORS/401 en TonConnect dentro de Telegram
+const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;
 
 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
     <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
       <App />
     </TonConnectUIProvider>
   </React.StrictMode>
 );
