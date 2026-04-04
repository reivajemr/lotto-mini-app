import { useEffect, useState, useCallback } from 'react';
import Lobby from './components/Lobby';
import Wallet from './components/Wallet';
import Tasks from './components/Tasks';

const LECHUGAS_PER_TON = Number(import.meta.env.VITE_LECHUGAS_PER_TON || 1000);

const formatTon = (lechugas: number) => {
  return Number(lechugas / LECHUGAS_PER_TON).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  });
};

// ── Tipos ────────────────────────────────────────────────────
export type Tab = 'lobby' | 'wallet' | 'tasks';

export interface User {
  telegramId: string;
  username: string;
  balance: number;
  completedTasks: string[];
  lastDailyBonus: string | null;
  totalBets: number;
  totalWins: number;
  walletAddress: string | null;
  createdAt: string;
}

// ── DEV fallback (cuando no corre dentro de Telegram) ────────
const DEV_USER = {
  id: 999999999,
  first_name: 'Jugador',
  username: 'dev_user',
};

// ── Helper para llamadas al API con manejo de errores robusto ─
export async function apiCall(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  // Intentar parsear como JSON
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Si no es JSON, es un error del servidor (HTML, etc.)
    console.error('Respuesta no-JSON del servidor:', text.slice(0, 200));
    throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 100)}`);
  }

  return data;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('lobby');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // ── Inicializar Telegram WebApp ───────────────────────────
  const tg = (window as Window & { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp;
  const tgUser = tg?.initDataUnsafe?.user || DEV_USER;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // Configurar botón atrás
      tg.BackButton?.hide();
    }
  }, [tg]);

  // ── Cargar usuario ────────────────────────────────────────
  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall({
        telegramId: String(tgUser.id),
        username: tgUser.username || tgUser.first_name || 'Usuario',
        action: 'load',
      }) as { success?: boolean; user?: User; isNew?: boolean; error?: string };

      if (data?.success && data.user) {
        setUser(data.user);
        setIsNew(!!data.isNew);
      } else {
        setError(data?.error || 'Error al cargar usuario');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      setError(`Error de conexión: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [tgUser.id, tgUser.username, tgUser.first_name]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ── Actualizar balance ────────────────────────────────────
  const handleBalanceUpdate = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  // ── Vibración háptica ─────────────────────────────────────
  const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    tg?.HapticFeedback?.impactOccurred(type);
  };

  // ── Mostrar alerta ────────────────────────────────────────
  const showAlert = (msg: string) => {
    if (tg && typeof tg.showAlert === 'function') {
      tg.showAlert(msg);
    } else {
      setAlertMsg(msg);
    }
  };

  // ── Pantalla de carga ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f1117]">
        <div className="text-5xl animate-bounce mb-4">🎰</div>
        <p className="text-white/60 text-sm animate-pulse">Cargando Animalito Lotto...</p>
      </div>
    );
  }

  // ── Pantalla de error ─────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f1117] p-6 text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-white text-xl font-bold mb-2">Error al cargar</h2>
        <p className="text-red-400 text-sm mb-6 max-w-xs leading-relaxed">{error}</p>
        <button
          onClick={loadUser}
          className="bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
        >
          Reintentar
        </button>
        {/* Info de diagnóstico */}
        <div className="mt-6 bg-white/5 rounded-xl p-4 text-left max-w-sm w-full">
          <p className="text-white/40 text-xs font-mono">
            TelegramID: {tgUser.id}<br/>
            Telegram: {tg ? '✅ Detectado' : '❌ No detectado (modo web)'}<br/>
            API: /api/user
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = tgUser.first_name || user.username;

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col max-w-md mx-auto relative">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-[#0f1117]/95 backdrop-blur-sm sticky top-0 z-40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎰</span>
          <div>
            <p className="text-white/50 text-xs leading-none">Hola,</p>
            <p className="text-white font-bold text-sm leading-tight">
              {displayName}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-teal-400 font-bold text-base leading-tight">
            {user.balance.toLocaleString()} 🥬
          </p>
          <p className="text-white/40 text-xs leading-none">
            ≈ {formatTon(user.balance)} TON
          </p>
        </div>
      </header>

      {/* ── BIENVENIDA NUEVO USUARIO ──────────────────────── */}
      {isNew && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-white font-bold text-sm">¡Bienvenido a Animalito Lotto!</p>
          <p className="text-teal-300 text-xs mt-1">Te regalamos 1,000 🥬 para empezar.</p>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ───────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'lobby' && (
          <Lobby
            telegramId={user.telegramId}
            username={user.username}
            balance={user.balance}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={showAlert}
            haptic={haptic}
          />
        )}
        {activeTab === 'wallet' && (
          <Wallet
            telegramId={user.telegramId}
            username={user.username}
            balance={user.balance}
            walletAddress={user.walletAddress}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={showAlert}
            haptic={haptic}
          />
        )}
        {activeTab === 'tasks' && (
          <Tasks
            telegramId={user.telegramId}
            username={user.username}
            completedTasks={user.completedTasks}
            lastDailyBonus={user.lastDailyBonus}
            onBalanceUpdate={handleBalanceUpdate}
            showAlert={showAlert}
            haptic={haptic}
            refreshUser={loadUser}
          />
        )}
      </main>

      {/* ── NAVBAR INFERIOR ──────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#16181f]/95 backdrop-blur-sm border-t border-white/10 flex z-40">
        {([
          { id: 'lobby',  icon: '🎰', label: 'Jugar'  },
          { id: 'wallet', icon: '💰', label: 'Wallet' },
          { id: 'tasks',  icon: '✅', label: 'Tareas' },
        ] as { id: Tab; icon: string; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { haptic('light'); setActiveTab(tab.id); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all ${
              activeTab === tab.id
                ? 'text-teal-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 w-8 h-0.5 bg-teal-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* ── MODAL ALERTA (fallback fuera de Telegram) ─────── */}
      {alertMsg && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setAlertMsg(null)}
        >
          <div
            className="bg-[#1e2130] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white text-sm leading-relaxed whitespace-pre-line">{alertMsg}</p>
            <button
              onClick={() => setAlertMsg(null)}
              className="mt-4 bg-teal-500 text-white font-bold px-6 py-2.5 rounded-xl w-full active:scale-95 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tipos de Telegram ────────────────────────────────────────
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      username?: string;
    };
  };
  HapticFeedback?: {
    impactOccurred: (type: 'light' | 'medium' | 'heavy') => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
  };
  showAlert?: (msg: string) => void;
}
