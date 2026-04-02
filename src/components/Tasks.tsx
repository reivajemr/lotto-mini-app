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

interface Task {
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: number;
  action?: () => void;
  link?: string;
  daily?: boolean;
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

  const canClaimDaily = () => {
    if (!lastDailyBonus) return true;
    const last = new Date(lastDailyBonus);
    const now = new Date();
    const diffH = (now.getTime() - last.getTime()) / 3600000;
    return diffH >= 24;
  };

  const claimTask = async (task: Task) => {
    if (completedTasks.includes(task.id) && !task.daily) {
      showAlert('✅ Ya completaste esta tarea');
      return;
    }
    if (task.daily && !canClaimDaily()) {
      const last = new Date(lastDailyBonus!);
      const nextClaim = new Date(last.getTime() + 24 * 3600000);
      const diff = nextClaim.getTime() - Date.now();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      showAlert(`⏰ Próximo bono en ${h}h ${m}m`);
      return;
    }

    if (task.link) {
      window.open(task.link, '_blank');
      await new Promise(r => setTimeout(r, 3000));
    }

    haptic('medium');
    setLoading(task.id);
    try {
      const data = await apiCall({
        telegramId, username, action: 'task',
        taskId: task.id,
        reward: task.reward,
      }) as { success?: boolean; newBalance?: number; error?: string };

      if (data?.success) {
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        haptic('heavy');
        showAlert(`🎉 ¡+${task.reward.toLocaleString()} 🥬!\n${task.title}`);
        refreshUser();
      } else {
        showAlert('❌ ' + (data?.error || 'Error al reclamar'));
      }
    } catch {
      showAlert('❌ Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  const tasks: Task[] = [
    {
      id: 'daily',
      icon: '🌅',
      title: 'Bono diario',
      description: 'Recibe 100 🥬 cada 24 horas',
      reward: 100,
      daily: true,
    },
    {
      id: 'join_channel',
      icon: '📣',
      title: 'Unirse al canal',
      description: 'Únete al canal oficial de Animalito Lotto',
      reward: 500,
      link: 'https://t.me/animalitoLottoOficial',
    },
    {
      id: 'share_bot',
      icon: '🔗',
      title: 'Compartir el bot',
      description: 'Comparte el bot con un amigo',
      reward: 300,
      link: 'https://t.me/share/url?url=https://t.me/AnimalitoLottoBot',
    },
    {
      id: 'follow_twitter',
      icon: '🐦',
      title: 'Seguir en Twitter',
      description: 'Síguenos en Twitter/X',
      reward: 200,
      link: 'https://twitter.com',
    },
    {
      id: 'first_bet',
      icon: '🎯',
      title: 'Primera apuesta',
      description: 'Realiza tu primera apuesta',
      reward: 200,
    },
  ];

  const isCompleted = (task: Task) => {
    if (task.daily) return !canClaimDaily();
    return completedTasks.includes(task.id);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="text-center py-3">
        <p className="text-white font-bold text-lg">🏆 Tareas y recompensas</p>
        <p className="text-white/40 text-xs mt-1">Completa tareas para ganar 🥬 Lechugas</p>
      </div>

      {tasks.map(task => {
        const done = isCompleted(task);
        const isLoading = loading === task.id;

        return (
          <button
            key={task.id}
            onClick={() => claimTask(task)}
            disabled={done || isLoading}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] text-left ${
              done
                ? 'bg-white/3 border-white/5 opacity-60 cursor-not-allowed'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
              done ? 'bg-white/5' : 'bg-teal-500/10'
            }`}>
              {done ? '✅' : task.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${done ? 'text-white/40' : 'text-white'}`}>
                {task.title}
              </p>
              <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                {task.description}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {isLoading ? (
                <p className="text-teal-300 text-xs animate-pulse">...</p>
              ) : done ? (
                <p className="text-white/30 text-xs">Hecho</p>
              ) : (
                <div>
                  <p className="text-teal-400 font-bold text-sm">+{task.reward.toLocaleString()}</p>
                  <p className="text-teal-300/50 text-xs">🥬</p>
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Info saldo por tareas */}
      <div className="bg-white/3 rounded-xl p-4 text-xs text-white/40 mt-4">
        <p className="font-bold text-white/60 mb-1">💡 Sobre las recompensas:</p>
        <p>• Las lechugas 🥬 son créditos del juego</p>
        <p>• Tasa: 1,000 🥬 = 1 TON</p>
        <p>• Puede retirarse una vez acumulado saldo suficiente</p>
      </div>
    </div>
  );
}
