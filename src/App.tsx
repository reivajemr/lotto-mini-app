import { useState, useEffect, useCallback } from 'react';
import Lobby from './components/Lobby';
import Wallet from './components/Wallet';

declare global {
  interface Window { Telegram?: any; }
}

const tg = window.Telegram?.WebApp;

const DEV_USER = {
  id: 99999999,
  first_name: 'Dev',
  username: 'devuser',
};

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

interface TasksTabProps {
  user: User;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate: (n: number) => void;
}

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
      await new Promise(r => setTimeout(r, 2000));
    }
    haptic('medium');
    setClaiming(task.id);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, username, action: 'task', taskId: task.id, reward: task.reward }),
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
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-5 text-center shadow-lg">
        <p className="text-4xl mb-1">✅</p>
        <h2 className="text-xl font-bold text-white">Tareas & Bonos</h2>
        <p className="text-sm text-white/70 mt-1">Completa tareas para ganar 🥬 gratis</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-400">{user.completedTasks?.length || 0}</p>
          <p className="text-xs text-gray-400">Tareas completadas</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-teal-400">{user.totalBets || 0}</p>
          <p className="text-xs text-gray-400">Apuestas realizadas</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {TASKS.map(task => {
          const completed = !task.repeatable && user.completedTasks?.includes(task.id);
          const isDaily   = task.id === 'daily';
          const dailyReady = isDaily && canClaimDaily();
          const isClaiming = claiming === task.id;

          return (
            <div key={task.id}
              className={`flex items-center gap-3 rounded-xl p-4 border transition-all ${
                completed ? 'bg-white/3 border-white/5 opacity-60' : 'bg-white/5 border-white/10'
              }`}>
              <span className="text-3xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{task.title}</p>
                <p className="text-xs text-gray-400">{task.description}</p>
                {isDaily && !dailyReady && (
                  <p className="text-xs text-yellow-400 mt-0.5">⏰ Disponible en {hoursUntilDaily()}h</p>
                )}
                <p className="text-xs text-green-400 font-semibold mt-0.5">+{task.reward.toLocaleString()} 🥬</p>
              </div>
              <button
                onClick={() => claimTask(task)}
                disabled={isClaiming || completed || (isDaily && !dailyReady)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  completed ? 'bg-gray-700 text-gray-500 cursor-default' :
                  (isDaily && !dailyReady) ? 'bg-gray-700 text-gray-500 cursor-default' :
                  'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                }`}>
                {isClaiming ? '⏳' : completed ? '✅' : (isDaily && !dailyReady) ? '⏳' : 'Reclamar'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-xs font-bold text-white mb-2">ℹ️ Sobre las lechugas 🥬</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          1,000 🥬 = 1 TON. Las lechugas son tu balance en la app.
          Gánalas completando tareas o apostando en los sorteos.
          Conviértelas a TON en la sección Wallet.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('lobby');
  const [alertMsg, setAlertMsg]   = useState<string | null>(null);
  const [isNew, setIsNew]         = useState(false);

  useEffect(() => {
    if (tg) { tg.ready(); tg.expand(); }
  }, []);

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

  const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    tg?.HapticFeedback?.impactOccurred(type);
  };

  const showAlert = (msg: string) => {
    if (tg?.showAlert) tg.showAlert(msg);
    else setAlertMsg(msg);
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-5xl animate-bounce">🎰</p>
        <p className="text-white text-xl font-bold">Animalito Lotto</p>
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">❌</p>
        <p className="text-white text-xl font-bold">Error al cargar</p>
        <p className="text-gray-400 text-sm">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); loadUser(); }}
          className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold">
          Reintentar
        </button>
      </div>
    );
  }

  if (!user) return null;

  const tgUser = tg?.initDataUnsafe?.user || DEV_USER;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-md mx-auto">

      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-500/20 rounded-xl flex items-center justify-center text-lg">🎰</div>
          <div>
            <p className="text-xs text-gray-400">Hola,</p>
            <p className="text-sm font-bold text-white leading-none">{tgUser.first_name || user.username}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-yellow-400">{user.balance.toLocaleString()} 🥬</p>
          <p className="text-xs text-gray-400">≈ {(user.balance / 1000).toFixed(2)} TON</p>
        </div>
      </div>

      {/* BIENVENIDA USUARIO NUEVO */}
      {isNew && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-teal-600 to-green-600 rounded-2xl p-4 text-center">
          <p className="text-2xl">🎉</p>
          <p className="text-white font-bold">¡Bienvenido a Animalito Lotto!</p>
          <p className="text-white/80 text-sm">Te regalamos 1,000 🥬 para empezar.</p>
          <button onClick={() => setIsNew(false)}
            className="mt-2 text-xs text-white/60 underline">Cerrar</button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'lobby' && (
          <Lobby
            balance={user.balance}
            telegramId={user.telegramId}
            username={user.username}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
        {activeTab === 'wallet' && (
          <Wallet
            balance={user.balance}
            telegramId={user.telegramId}
            username={user.username}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab
            user={user}
            telegramId={user.telegramId}
            username={user.username}
            showAlert={showAlert}
            haptic={haptic}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}
      </div>

      {/* NAV BAR INFERIOR */}
      <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-white/10 grid grid-cols-3 gap-0">
        {([
          { id: 'lobby',  icon: '🎰', label: 'Jugar'  },
          { id: 'wallet', icon: '💰', label: 'Wallet' },
          { id: 'tasks',  icon: '✅', label: 'Tareas' },
        ] as { id: Tab; icon: string; label: string }[]).map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); haptic('light'); }}
            className={`flex flex-col items-center gap-1 py-3 transition-all ${
              activeTab === tab.id ? 'text-teal-400' : 'text-gray-500 hover:text-gray-300'
            }`}>
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
            {activeTab === tab.id && (
              <span className="w-1 h-1 bg-teal-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* MODAL ALERTA (fuera de Telegram) */}
      {alertMsg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setAlertMsg(null)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm whitespace-pre-line leading-relaxed">{alertMsg}</p>
            <button onClick={() => setAlertMsg(null)}
              className="mt-4 w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
