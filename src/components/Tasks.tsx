import { useState } from 'react';
import { apiCall } from '../App';

interface TasksProps {
  telegramId: string;
  username: string;
  completedTasks: string[];
  lastDailyBonus: string | null;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  refreshUser: () => void;
}

interface TaskDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: number;
  type: 'daily' | 'once' | 'social';
  action?: () => void;
}

export default function Tasks({
  telegramId,
  username,
  completedTasks,
  lastDailyBonus,
  onBalanceUpdate,
  showAlert,
  haptic,
  refreshUser,
}: TasksProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // ── Verificar si el bono diario está disponible ─────────
  const isDailyAvailable = () => {
    if (!lastDailyBonus) return true;
    const last = new Date(lastDailyBonus);
    const now = new Date();
    const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  // ── Tiempo restante para el próximo bono diario ─────────
  const dailyTimeRemaining = () => {
    if (!lastDailyBonus) return null;
    const last = new Date(lastDailyBonus);
    const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    if (diff <= 0) return null;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  // ── Completar tarea ─────────────────────────────────────
  const completeTask = async (taskId: string, reward: number) => {
    if (loading) return;
    haptic('medium');
    setLoading(taskId);

    try {
      const data = await apiCall({
        telegramId,
        username,
        action: 'task',
        taskId,
        reward,
      }) as { success?: boolean; newBalance?: number; error?: string };

      if (data?.success) {
        haptic('heavy');
        onBalanceUpdate(data.newBalance ?? 0);
        refreshUser();
        showAlert(`✅ ¡Tarea completada!\n\n+${reward.toLocaleString()} 🥬 añadidas a tu balance.`);
      } else {
        showAlert('❌ ' + (data?.error || 'Error al completar tarea'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      showAlert('❌ ' + msg);
    } finally {
      setLoading(null);
    }
  };

  // ── Definición de tareas ────────────────────────────────
  const dailyAvailable = isDailyAvailable();
  const dailyRemaining = dailyTimeRemaining();

  const tasks: TaskDef[] = [
    {
      id: 'daily',
      icon: '🎁',
      title: 'Bono diario',
      description: 'Recibe 500 🥬 cada 24 horas',
      reward: 500,
      type: 'daily',
    },
    {
      id: 'share_app',
      icon: '📤',
      title: 'Compartir la app',
      description: 'Comparte Animalito Lotto con amigos',
      reward: 300,
      type: 'social',
    },
    {
      id: 'first_bet',
      icon: '🎯',
      title: 'Primera apuesta',
      description: 'Realiza tu primera apuesta',
      reward: 200,
      type: 'once',
    },
    {
      id: 'save_wallet',
      icon: '👛',
      title: 'Guarda tu wallet',
      description: 'Conecta tu dirección TON Wallet',
      reward: 250,
      type: 'once',
    },
    {
      id: 'play_3_days',
      icon: '🔥',
      title: 'Juega 3 días seguidos',
      description: 'Obtén el bono diario 3 veces',
      reward: 1000,
      type: 'once',
    },
  ];

  const isCompleted = (taskId: string) => {
    if (taskId === 'daily') return !dailyAvailable;
    return completedTasks.includes(taskId);
  };

  const totalEarnable = tasks
    .filter(t => !isCompleted(t.id))
    .reduce((sum, t) => sum + t.reward, 0);

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 rounded-2xl p-4 text-center">
        <p className="text-2xl mb-1">✅</p>
        <h2 className="text-white font-bold">Tareas y bonos</h2>
        <p className="text-teal-300 text-sm mt-1">
          Puedes ganar hasta <span className="font-bold">{totalEarnable.toLocaleString()} 🥬</span> más
        </p>
      </div>

      {/* Lista de tareas */}
      <div className="space-y-3">
        {tasks.map(task => {
          const completed = isCompleted(task.id);
          const isLoading = loading === task.id;
          const isDaily = task.id === 'daily';

          return (
            <div
              key={task.id}
              className={`rounded-2xl border p-4 transition-all ${
                completed
                  ? 'bg-white/3 border-white/5 opacity-60'
                  : 'bg-white/7 border-white/12 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  completed ? 'bg-white/5' : 'bg-teal-500/20'
                }`}>
                  {completed ? '✅' : task.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm truncate">{task.title}</p>
                    {task.type === 'daily' && (
                      <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        DIARIO
                      </span>
                    )}
                    {task.type === 'social' && (
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        SOCIAL
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-xs mt-0.5">{task.description}</p>
                  {isDaily && !dailyAvailable && dailyRemaining && (
                    <p className="text-yellow-400 text-xs mt-1">⏱ Disponible en: {dailyRemaining}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-teal-400 font-bold text-sm">+{task.reward.toLocaleString()}</p>
                  <p className="text-white/30 text-[10px]">🥬</p>
                </div>
              </div>

              {!completed && (
                <button
                  onClick={() => completeTask(task.id, task.reward)}
                  disabled={isLoading}
                  className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    isLoading
                      ? 'bg-white/10 text-white/40'
                      : 'bg-teal-500 hover:bg-teal-400 text-white'
                  }`}
                >
                  {isLoading ? '⏳ Procesando...' : '¡Reclamar!'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota */}
      <div className="bg-white/3 border border-white/5 rounded-xl p-4 text-center">
        <p className="text-white/40 text-xs leading-relaxed">
          🌿 Las lechugas (🥬) son la moneda interna de la app.<br/>
          1,000 🥬 = 1 TON (Testnet)
        </p>
      </div>
    </div>
  );
}
