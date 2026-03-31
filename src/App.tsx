import { useState, useEffect, useCallback } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Lobby from './components/Lobby';
import Wallet from './components/Wallet';
import Tasks from './components/Tasks';
import Friends from './components/Friends';

// ── TON Connect manifest URL ─────────────────────────────────
const MANIFEST_URL = 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json';

// ── API helper ───────────────────────────────────────────────
export async function apiCall(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 120));
  }
}

// ── Haptic feedback ──────────────────────────────────────────
export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch { /* ignorar */ }
}

interface User {
  telegramId: string;
  username: string;
  balance: number;
  completedTasks: string[];
  lastDailyBonus: string | null;
  walletAddress: string | null;
  tonWalletAddress: string | null;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  referralEarnings?: number;
}

type Tab = 'lobby' | 'wallet' | 'tasks' | 'friends';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('lobby');
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // ── Obtener datos del usuario de Telegram ──────────────────
  const getTelegramUser = () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        // Capturar referido si viene en start_param
        const refCode = tg.initDataUnsafe?.start_param || null;
        return {
          telegramId: String(u.id),
          username: u.username || u.first_name || 'Usuario',
          refCode,
        };
      }
    } catch { /* ignorar */ }
    return {
      telegramId: 'test_' + Math.floor(Math.random() * 100000),
      username: 'TestUser',
      refCode: null,
    };
  };

  const [tgUser] = useState(getTelegramUser);

  // ── Inicializar Telegram WebApp ────────────────────────────
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0f1923');
        tg.setBackgroundColor('#0f1923');
      }
    } catch { /* ignorar */ }
  }, []);

  // ── Cargar usuario ─────────────────────────────────────────
  const loadUser = useCallback(async () => {
    try {
      setError(null);
      const data = await apiCall({
        telegramId: tgUser.telegramId,
        username: tgUser.username,
        action: 'load',
        refCode: tgUser.refCode,
      }) as { success?: boolean; user?: User; isNew?: boolean; error?: string };

      if (data?.success && data.user) {
        setUser(data.user);
        setIsNew(data.isNew || false);
      } else {
        setError(data?.error || 'Error desconocido');
      }
    } catch (err) {
      setError('Error de conexión: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [tgUser.telegramId, tgUser.username, tgUser.refCode]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const showAlert = (msg: string) => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.showAlert) {
        tg.showAlert(msg);
        return;
      }
    } catch { /* ignorar */ }
    setAlertMsg(msg);
  };

  const onBalanceUpdate = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  const refreshUser = () => { loadUser(); };

  const displayName = tgUser.username.length > 12
    ? tgUser.username.slice(0, 12) + '…'
    : tgUser.username;

  // ── LOADING ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center gap-4">
      <div className="text-6xl animate-bounce">🎰</div>
      <p className="text-white/60 text-sm animate-pulse">Cargando Animalito Lotto...</p>
    </div>
  );

  // ── ERROR ──────────────────────────────────────────────────
  if (error || !user) return (
    <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">❌</div>
      <h2 className="text-white font-bold text-xl">Error al cargar</h2>
      <p className="text-white/50 text-sm leading-relaxed">{error || 'No se pudo cargar el usuario'}</p>
      <button
        onClick={() => { setLoading(true); loadUser(); }}
        className="bg-teal-500 hover:bg-teal-400 text-white font-bold px-8 py-3 rounded-xl transition-all active:scale-95"
      >
        Reintentar
      </button>
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'lobby',   icon: '🎰', label: 'Jugar'   },
    { id: 'wallet',  icon: '💎', label: 'Wallet'  },
    { id: 'tasks',   icon: '✅', label: 'Tareas'  },
    { id: 'friends', icon: '👥', label: 'Amigos'  },
  ];

  // ── MAIN APP ───────────────────────────────────────────────
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <div className="min-h-screen bg-[#0f1923] text-white overflow-hidden flex flex-col">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎰</span>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Animalito</p>
              <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-teal-300 font-black text-base">{user.balance.toLocaleString()} 🥬</p>
            <p className="text-white/30 text-[10px]">≈ {(user.balance / 1000).toFixed(3)} TON</p>
          </div>
        </div>

        {/* ── BIENVENIDA ── */}
        {isNew && (
          <div className="mx-4 mt-3 bg-teal-500/15 border border-teal-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <span className="text-xl">🎉</span>
            <p className="text-teal-300 text-xs font-semibold">¡Bienvenido! Te regalamos <strong className="text-white">1,000 🥬</strong> para empezar.</p>
          </div>
        )}

        {/* ── CONTENIDO ── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'lobby' && (
            <Lobby
              telegramId={tgUser.telegramId}
              username={tgUser.username}
              balance={user.balance}
              onBalanceUpdate={onBalanceUpdate}
              showAlert={showAlert}
              haptic={haptic}
            />
          )}
          {activeTab === 'wallet' && (
            <Wallet
              telegramId={tgUser.telegramId}
              username={tgUser.username}
              balance={user.balance}
              onBalanceUpdate={onBalanceUpdate}
              showAlert={showAlert}
              haptic={haptic}
            />
          )}
          {activeTab === 'tasks' && (
            <Tasks
              telegramId={tgUser.telegramId}
              username={tgUser.username}
              completedTasks={user.completedTasks}
              lastDailyBonus={user.lastDailyBonus}
              onBalanceUpdate={onBalanceUpdate}
              showAlert={showAlert}
              haptic={haptic}
              refreshUser={refreshUser}
            />
          )}
          {activeTab === 'friends' && (
            <Friends
              telegramId={tgUser.telegramId}
              username={tgUser.username}
              referralCode={user.referralCode || tgUser.telegramId}
              referralCount={user.referralCount || 0}
              referralEarnings={user.referralEarnings || 0}
              balance={user.balance}
              onBalanceUpdate={onBalanceUpdate}
              showAlert={showAlert}
              haptic={haptic}
            />
          )}
        </div>

        {/* ── NAVBAR INFERIOR ── */}
        <div className="flex gap-1 px-2 py-2 bg-black/40 backdrop-blur border-t border-white/5 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { haptic('light'); setActiveTab(tab.id); }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[9px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── MODAL ALERTA ── */}
        {alertMsg && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6" onClick={() => setAlertMsg(null)}>
            <div className="bg-[#1a2634] border border-white/15 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-white text-sm leading-relaxed whitespace-pre-line">{alertMsg}</p>
              <button onClick={() => setAlertMsg(null)} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl active:scale-95">OK</button>
            </div>
          </div>
        )}
      </div>
    </TonConnectUIProvider>
  );
}
