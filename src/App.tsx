import { useState, useEffect, useCallback } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AppUser, Tab } from './types';
import { API_BASE, TONCONNECT_MANIFEST_URL } from './constants';
import Lobby from './components/Lobby';
import WalletTab from './components/WalletTab';
import TasksTab from './components/TasksTab';
import FarmTab from './components/FarmTab';

const MANIFEST_URL = TONCONNECT_MANIFEST_URL;

function getTelegramUser() {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user;
  // Dev fallback
  return { id: 123456789, first_name: 'Dev', username: 'dev_user' };
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('lobby');
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tgUser = getTelegramUser();

  const loadUser = useCallback(async () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0f1117');
      tg.setBackgroundColor('#0f1117');
    }

    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: String(tgUser.id),
          username: tgUser.username || tgUser.first_name,
          action: 'load',
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setIsNew(data.isNew || false);
      } else {
        setError('Error al cargar usuario: ' + (data.error || 'desconocido'));
      }
    } catch (e) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }, [tgUser.id, tgUser.username, tgUser.first_name]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleBalanceUpdate = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  const handleAlert = (msg: string) => {
    setAlertMsg(msg);
  };

  const displayName = tgUser.first_name || tgUser.username || 'Usuario';

  const tabs = [
    { id: 'lobby' as Tab,  label: 'Sorteos', icon: '🎰' },
    { id: 'farm'  as Tab,  label: 'Granja',  icon: '🌱' },
    { id: 'tasks' as Tab,  label: 'Tareas',  icon: '🏆' },
    { id: 'wallet'as Tab,  label: 'Wallet',  icon: '💎' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <div className="text-white text-xl font-bold">Animalito Lotto</div>
        <div className="text-gray-400 text-sm">Cargando...</div>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">⚠️</div>
        <div className="text-white text-lg font-bold text-center">{error}</div>
        <button
          onClick={() => { setError(null); setLoading(true); loadUser(); }}
          className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400"
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <div className="min-h-screen bg-[#0f1117] text-white flex flex-col max-w-md mx-auto">

        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0f1117]/95 backdrop-blur border-b border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <div>
                <div className="text-xs text-gray-400">Hola,</div>
                <div className="font-bold text-white leading-tight">{displayName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Saldo</div>
              <div className="font-bold text-green-400">{user.balance.toLocaleString()} 🥬</div>
              <div className="text-xs text-gray-500">≈ {(user.balance / 10000).toFixed(4)} TON</div>
            </div>
          </div>
        </header>

        {/* New user banner */}
        {isNew && (
          <div className="mx-4 mt-3 bg-green-900/40 border border-green-600/40 rounded-xl p-3 flex items-center gap-3 text-sm">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-bold text-green-300">¡Bienvenido a Animalito Lotto!</div>
              <div className="text-green-400 text-xs mt-0.5">Te regalamos 1,000 🥬 para empezar. ¡Buena suerte!</div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 pt-4">
          {activeTab === 'lobby' && (
            <Lobby user={user} onBalanceUpdate={handleBalanceUpdate} onAlert={handleAlert} />
          )}
          {activeTab === 'wallet' && (
            <WalletTab user={user} onBalanceUpdate={handleBalanceUpdate} onAlert={handleAlert} />
          )}
          {activeTab === 'farm' && (
            <FarmTab user={user} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab user={user} onBalanceUpdate={handleBalanceUpdate} onAlert={handleAlert} />
          )}
        </main>

        {/* Bottom navbar */}
        <nav className="sticky bottom-0 z-10 bg-[#0f1117]/95 backdrop-blur border-t border-gray-800 px-2 py-2">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'text-green-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-xs font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="w-4 h-0.5 bg-green-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Alert modal */}
        {alertMsg && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
            onClick={() => setAlertMsg(null)}
          >
            <div
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-white text-sm leading-relaxed whitespace-pre-line text-center mb-5">
                {alertMsg}
              </p>
              <button
                onClick={() => setAlertMsg(null)}
                className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </TonConnectUIProvider>
  );
}
