// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import Lobby   from './components/Lobby';
import Wallet  from './components/Wallet';

// ── Tipos ────────────────────────────────────────────────────
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}
interface User {
  telegramId: string;
  username: string;
  balance: number;
  completedTasks: string[];
  lastDailyBonus: string | null;
  totalBets: number;
  totalWins: number;
  walletAddress: string | null;
}

type Tab = 'lobby' | 'wallet' | 'tasks';

// ── Telegram WebApp helper ───────────────────────────────────
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
        };
        showAlert: (msg: string, cb?: () => void) => void;
        initDataUnsafe?: { user?: TelegramUser };
        colorScheme?: 'dark' | 'light';
        themeParams?: { bg_color?: string };
        MainButton?: {
          setText: (t: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
      };
    };
  }
}

// ── Datos de desarrollo (cuando no hay Telegram) ─────────────
const DEV_USER: TelegramUser = {
  id: 123456789,
  first_name: 'Demo',
  username: 'demo_user',
};

export default function App() {
  const tg = window.Telegram?.WebApp;

  // ── Estado global ─────────────────────────────────────────
  const [user,        setUser]        = useState<User | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<Tab>('lobby');
  const [alertMsg,    setAlertMsg]    = useState<string | null>(null);
  const [isNew,       setIsNew]       = useState(false);

  // ── Inicializar Telegram WebApp ───────────────────────────
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  // ── Obtener o crear usuario ───────────────────────────────
  const loadUser = useCallback(async () => {
    const tgUser = tg?.initDataUnsafe?.user || DEV_USER;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: String(tgUser.id),
          username:   tgUser.username || tgUser.first_name,
          action:     'load',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        if (data.isNew) setIsNew(true);
      } else {
        setError(data.error || 'No se pudo cargar tu cuenta');
      }
    } catch (err: any) {
      setError('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  // ── Haptic feedback ───────────────────────────────────────
  const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    tg?.HapticFeedback?.impactOccurred(type);
  };

  // ── Mostrar alerta ────────────────────────────────────────
  const showAlert = (msg: string) => {
    if (tg?.showAlert) {
      tg.showAlert(msg);
    } else {
      setAlertMsg(msg);
    }
  };

  // ── Actualizar balance ────────────────────────────────────
  const handleBalanceUpdate = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  // ── PANTALLA DE CARGA ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <p className="text-white font-bold text-xl">Animalito Lotto</p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── PANTALLA DE ERROR ─────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 gap-4">
        <div className="text-5xl">❌</div>
        <p className="text-red-400 font-bold text-lg text-center">Error al cargar</p>
        <p className="text-gray-400 text-sm text-center">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); loadUser(); }}
          className="bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 px-8 rounded-xl mt-2">
          🔄 Reintentar
        </button>
      </div>
    );
  }

  if (!user) return null;

  const tgUser = tg?.initDataUnsafe?.user || DEV_USER;

  // ── APP PRINCIPAL ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-md mx-auto">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="bg-gray-800 border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center text-lg">
            🎰
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Hola,</p>
            <p className="text-sm font-bold leading-tight">
              {tgUser.first_name || user.username}
            </p>
          </div>
        </div>
        {/* Balance en el header */}
        <div className="bg-teal-500/15 border border-teal-500/30 rounded-xl px-3 py-1.5 text-right">
          <p className="text-teal-400 font-bold text-sm leading-none">
            {user.balance.toLocaleString()} 🥬
          </p>
          <p className="text-gray-500 text-[10px] leading-none mt-0.5">
            ≈ {(user.balance / 1000).toFixed(2)} TON
          </p>
        </div>
      </header>

      {/* ── BIENVENIDA USUARIO NUEVO ────────────────────────── */}
      {isNew && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-teal-600 to-blue-600 rounded-2xl p-4 text-center">
          <p className="text-2xl">🎉</p>
          <p className="font-bold text-white">¡Bienvenido a Animalito Lotto!</p>
          <p className="text-white/80 text-sm mt-1">
            Te regalamos <span className="font-bold text-yellow-300">1,000 🥬</span> para empezar.
          </p>
          <button onClick={() => setIsNew(false)}
            className="mt-3 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-2 px-6 rounded-xl transition">
            ¡Empezar a jugar! →
          </button>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'lobby' && (
          <Lobby
            balance={user.balance}
            telegramId={String(tgUser.id)}
            username={tgUser.username || tgUser.first_name}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
        {activeTab === 'wallet' && (
          <Wallet
            balance={user.balance}
            telegramId={String(tgUser.id)}
            username={tgUser.username || tgUser.first_name}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab
            user={user}
            telegramId={String(tgUser.id)}
            username={tgUser.username || tgUser.first_name}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
      </main>

      {/* ── NAV BAR INFERIOR ────────────────────────────────── */}
      <nav className="bg-gray-800 border-t border-white/10 flex sticky bottom-0 z-40">
        {([ 
          { id: 'lobby',  icon: '🎰', label: 'Jugar'  },
          { id: 'wallet', icon: '💰', label: 'Wallet' },
          { id: 'tasks',  icon: '✅', label: 'Tareas' },
        ] as { id: Tab; icon: string; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); haptic('light'); }}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
              activeTab === tab.id
                ? 'text-teal-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className={`text-[10px] font-semibold ${activeTab === tab.id ? 'text-teal-400' : 'text-gray-500'}`}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="w-1 h-1 bg-teal-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* ── MODAL DE ALERTA (fuera de Telegram) ─────────────── */}
      {alertMsg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4"
          onClick={() => setAlertMsg(null)}>
          <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-sm border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{alertMsg}</p>
            <button onClick={() => setAlertMsg(null)}
              className="mt-4 w-full bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 rounded-xl transition">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE: Pestaña de Tareas
// ════════════════════════════════════════════════════════════
interface TasksTabProps {
  user: User;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate: (n: number) => void;
}

const TASKS = [
  {
    id: 'daily',
    icon: '🎁',
    title: 'Bonus diario',
    description: 'Recibe 500 🥬 gratis cada 24 horas',
    reward: 500,
    repeatable: true,
  },
  {
    id: 'join_channel',
    icon: '📢',
    title: 'Unirse al canal',
    description: 'Síguenos en Telegram para recibir resultados',
    reward: 300,
    repeatable: false,
    link: 'https://t.me/Animalitos_lotto_bot',
  },
  {
    id: 'first_bet',
    icon: '🎯',
    title: 'Primera apuesta',
    description: 'Haz tu primera apuesta en cualquier sorteo',
    reward: 200,
    repeatable: false,
  },
  {
    id: 'share',
    icon: '🔗',
    title: 'Compartir la app',
    description: 'Invita a un amigo a jugar',
    reward: 500,
    repeatable: false,
  },
];

function TasksTab({ user, telegramId, username, showAlert, haptic, onBalanceUpdate }: TasksTabProps) {
  const [claiming, setClaiming] = useState<string | null>(null);

  const canClaimDaily = () => {
    if (!user.lastDailyBonus) return true;
    const last = new Date(user.lastDailyBonus);
    return (Date.now() - last.getTime()) >= 24 * 60 * 60 * 1000;
  };

  const hoursUntilDaily = () => {
    if (!user.lastDailyBonus) return 0;
    const last = new Date(user.lastDailyBonus);
    const remaining = 24 * 60 * 60 * 1000 - (Date.now() - last.getTime());
    return Math.max(0, Math.ceil(remaining / 3600000));
  };

  const claimTask = async (task: typeof TASKS[0]) => {
    if (task.id === 'daily' && !canClaimDaily()) {
      showAlert(`⏰ Vuelve en ${hoursUntilDaily()}h para reclamar tu bonus diario.`);
      return;
    }
    if (!task.repeatable && user.completedTasks?.includes(task.id)) {
      showAlert('✅ Esta tarea ya fue completada.');
      return;
    }
    if (task.link) {
      window.open(task.link, '_blank');
      await new Promise(r => setTimeout(r, 2000)); // pequeña espera
    }
    haptic('medium');
    setClaiming(task.id);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId, username, action: 'task',
          taskId: task.id, reward: task.reward,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        haptic('heavy');
        onBalanceUpdate(data.newBalance);
        showAlert(`🎉 ¡Tarea completada!\n\n+${task.reward.toLocaleString()} 🥬 acreditados.\n\nNuevo balance: ${data.newBalance.toLocaleString()} 🥬`);
      } else {
        showAlert('❌ ' + (data.error || 'Error al reclamar tarea'));
      }
    } catch {
      showAlert('❌ Error de conexión.');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-center">
        <p className="text-4xl mb-1">✅</p>
        <h2 className="text-xl font-bold text-white">Tareas & Bonos</h2>
        <p className="text-sm text-white/70 mt-1">Completa tareas para ganar 🥬 gratis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-400">{user.completedTasks?.length || 0}</p>
          <p className="text-xs text-gray-400">Tareas completadas</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{user.totalBets || 0}</p>
          <p className="text-xs text-gray-400">Apuestas realizadas</p>
        </div>
      </div>

      {/* Lista de tareas */}
      <div className="space-y-3">
        {TASKS.map(task => {
          const completed = !task.repeatable && user.completedTasks?.includes(task.id);
          const isDaily   = task.id === 'daily';
          const dailyReady = isDaily && canClaimDaily();
          const isClaiming = claiming === task.id;

          return (
            <div key={task.id}
              className={`rounded-xl p-4 border flex items-center gap-4 transition-all ${
                completed
                  ? 'bg-white/3 border-white/5 opacity-60'
                  : isDaily && !dailyReady
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white/8 border-white/15'
              }`}
            >
              <span className="text-3xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                  {task.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                {isDaily && !dailyReady && (
                  <p className="text-xs text-yellow-400 mt-0.5">⏰ Disponible en {hoursUntilDaily()}h</p>
                )}
                <p className="text-xs text-green-400 font-bold mt-1">+{task.reward.toLocaleString()} 🥬</p>
              </div>
              <button
                onClick={() => claimTask(task)}
                disabled={isClaiming || completed || (isDaily && !dailyReady)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  completed
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : isDaily && !dailyReady
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-500 hover:bg-teal-400 text-white'
                }`}
              >
                {isClaiming ? '⏳' : completed ? '✅' : 'Reclamar'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-400 mb-1">ℹ️ Sobre las lechugas 🥬</p>
        <p className="text-xs text-gray-400">
          1,000 🥬 = 1 TON. Las lechugas son tu balance en la app.
          Puedes ganarlas completando tareas o apostando en los sorteos.
          Conviértelas a TON cuando quieras en la sección Wallet.
        </p>
      </div>
    </div>
  );
}
