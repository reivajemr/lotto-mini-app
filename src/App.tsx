import { useState, useEffect, useCallback } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { useTelegram } from './hooks/useTelegram';
import type { AppUser } from './types';
import LobbyTab from './components/LobbyTab';
import WalletTab from './components/WalletTab';
import TasksTab from './components/TasksTab';
import FarmTab from './components/FarmTab';

type Tab = 'lobby' | 'wallet' | 'farm' | 'tasks';

const MANIFEST_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/tonconnect-manifest.json`
    : 'https://lotto-mini-e0tajf2wb-reivajemrs-projects.vercel.app/tonconnect-manifest.json';

function AppContent() {
  const { tgUser, isReady, haptic } = useTelegram();
  const [user, setUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('lobby');
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Load or create user from backend
  const loadUser = useCallback(async () => {
    if (!tgUser) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgUser.id,
          name: `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`,
          username: tgUser.username,
        }),
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      setUser(data.user);
      setIsNew(data.isNew ?? false);
    } catch (e) {
      console.error('Error loading user:', e);
      // Offline / dev fallback
      setUser({
        telegramId: tgUser.id,
        name: tgUser.first_name,
        username: tgUser.username,
        balance: 1000,
      });
    } finally {
      setLoading(false);
    }
  }, [tgUser]);

  useEffect(() => {
    if (isReady && tgUser) {
      loadUser();
    } else if (isReady && !tgUser) {
      setLoading(false);
    }
  }, [isReady, tgUser, loadUser]);

  const handleShowAlert = useCallback((msg: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(msg);
    } else {
      setAlertMsg(msg);
    }
  }, []);

  const handleBalanceUpdate = useCallback((newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    haptic('light');
  };

  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 to-teal-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4 animate-bounce">🎰</div>
          <div className="text-xl font-bold">Animalito Lotto</div>
          <div className="text-teal-300 text-sm mt-2">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 to-teal-700 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🎰</div>
          <div className="text-xl font-bold mb-2">Animalito Lotto</div>
          <div className="text-teal-200 text-sm">
            Abre esta app desde el bot de Telegram
          </div>
          <div className="mt-3 text-xs text-teal-400">@AnimalitoLottoBot</div>
        </div>
      </div>
    );
  }

  const displayName = user.name.split(' ')[0];
  const tabs = [
    { id: 'lobby' as Tab, icon: '🎰', label: 'Jugar' },
    { id: 'wallet' as Tab, icon: '💰', label: 'Wallet' },
    { id: 'farm' as Tab, icon: '🌾', label: 'Granja' },
    { id: 'tasks' as Tab, icon: '✅', label: 'Tareas' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-teal-800 to-teal-900 text-white px-4 pt-3 pb-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🎰</div>
            <div>
              <div className="text-xs text-teal-300 leading-none">Hola,</div>
              <div className="font-bold text-base leading-tight">{displayName}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg leading-tight text-green-300">
              {user.balance.toLocaleString()} 🥬
            </div>
            <div className="text-xs text-teal-300 leading-none">
              ≈ {(user.balance / 10000).toFixed(4)} TON
            </div>
          </div>
        </div>
      </div>

      {/* New user banner */}
      {isNew && (
        <div className="mx-4 mt-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-center text-sm">
          <div className="text-2xl mb-1">🎉</div>
          <div className="font-bold text-yellow-800">¡Bienvenido a Animalito Lotto!</div>
          <div className="text-yellow-700 text-xs mt-1">
            Te regalamos 1,000 🥬 para empezar. ¡Buena suerte!
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto py-3">
        {activeTab === 'lobby' && (
          <LobbyTab
            user={user}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={handleShowAlert}
            haptic={haptic}
          />
        )}
        {activeTab === 'wallet' && (
          <WalletTab
            user={user}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={handleShowAlert}
            haptic={haptic}
          />
        )}
        {activeTab === 'farm' && (
          <FarmTab
            user={user}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={handleShowAlert}
            haptic={haptic}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab
            user={user}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={handleShowAlert}
            haptic={haptic}
          />
        )}
      </div>

      {/* Bottom navbar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all ${
                activeTab === tab.id
                  ? 'text-teal-600'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="w-1 h-1 rounded-full bg-teal-500 mt-0.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom alert modal */}
      {alertMsg && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setAlertMsg(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm text-gray-700 whitespace-pre-line text-center">{alertMsg}</div>
            <button
              onClick={() => setAlertMsg(null)}
              className="mt-4 w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <AppContent />
    </TonConnectUIProvider>
  );
}
