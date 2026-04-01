import { useState } from 'react';
import { AppUser } from '../types';
import { API_BASE } from '../constants';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  onAlert: (msg: string) => void;
}

interface Task {
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: number;
  action: () => void;
  checkable: boolean;
}

export default function TasksTab({ user, onBalanceUpdate, onAlert }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const canClaimDaily = () => {
    if (!user.lastDailyBonus) return true;
    const last = new Date(user.lastDailyBonus);
    const now = new Date();
    const diffHours = (now.getTime() - last.getTime()) / 3600000;
    return diffHours >= 24;
  };

  const completeTask = async (taskId: string, reward: number) => {
    if (user.completedTasks?.includes(taskId) && taskId !== 'daily') {
      onAlert('✅ Ya completaste esta tarea');
      return;
    }
    if (taskId === 'daily' && !canClaimDaily()) {
      onAlert('⏰ Ya reclamaste tu bono hoy. Vuelve en 24 horas.');
      return;
    }

    setLoading(taskId);
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: 'task',
          taskId,
          reward,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onBalanceUpdate(data.newBalance);
        onAlert(`🎉 ¡+${reward.toLocaleString()} 🥬 ganadas!\n${taskId === 'daily' ? 'Bono diario reclamado.' : 'Tarea completada.'}`);
      } else {
        onAlert(`❌ ${data.error || 'Error al completar tarea'}`);
      }
    } catch {
      onAlert('❌ Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  const tasks: Task[] = [
    {
      id: 'daily',
      icon: '🎁',
      title: 'Bono Diario',
      description: 'Reclama 200 🥬 cada 24 horas',
      reward: 200,
      checkable: true,
      action: () => completeTask('daily', 200),
    },
    {
      id: 'join_channel',
      icon: '📢',
      title: 'Seguir Canal',
      description: 'Únete al canal oficial de Animalito Lotto',
      reward: 500,
      checkable: true,
      action: () => {
        window.open('https://t.me/animalito_lotto', '_blank');
        setTimeout(() => completeTask('join_channel', 500), 3000);
      },
    },
    {
      id: 'connect_wallet',
      icon: '💎',
      title: 'Conectar Wallet TON',
      description: 'Conecta tu wallet de TON testnet',
      reward: 300,
      checkable: true,
      action: () => completeTask('connect_wallet', 300),
    },
    {
      id: 'first_bet',
      icon: '🎰',
      title: 'Primera Apuesta',
      description: 'Realiza tu primera apuesta en cualquier sorteo',
      reward: 100,
      checkable: true,
      action: () => completeTask('first_bet', 100),
    },
    {
      id: 'share',
      icon: '🔗',
      title: 'Invitar Amigo',
      description: 'Comparte Animalito Lotto con un amigo',
      reward: 250,
      checkable: true,
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/AnimalitoLottoBot&text=🎰 ¡Juega Animalito Lotto y gana TON!`);
        }
        setTimeout(() => completeTask('share', 250), 2000);
      },
    },
    {
      id: 'follow_x',
      icon: '🐦',
      title: 'Seguir en X (Twitter)',
      description: 'Síguenos en Twitter / X',
      reward: 200,
      checkable: true,
      action: () => {
        window.open('https://twitter.com', '_blank');
        setTimeout(() => completeTask('follow_x', 200), 3000);
      },
    },
  ];

  const isDailyAvailable = canClaimDaily();

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-xl p-4 mb-5 border border-yellow-700/30">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">🏆 Tareas</div>
          <div className="text-sm text-gray-300 mt-1">Completa tareas para ganar 🥬 Lechugas</div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map(task => {
          const completed = task.id !== 'daily' && user.completedTasks?.includes(task.id);
          const isDaily = task.id === 'daily';
          const isAvailable = isDaily ? isDailyAvailable : !completed;
          const isLoading = loading === task.id;

          return (
            <div
              key={task.id}
              className={`bg-gray-900 rounded-xl p-4 border transition-all ${
                completed ? 'border-green-800/50 opacity-70' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{task.icon}</div>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{task.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{task.description}</div>
                  <div className="text-xs text-yellow-400 font-semibold mt-1">+{task.reward.toLocaleString()} 🥬</div>
                </div>
                <button
                  onClick={task.action}
                  disabled={isLoading || completed || (isDaily && !isDailyAvailable)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    completed
                      ? 'bg-green-900/50 text-green-400 cursor-default'
                      : isAvailable
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? '⏳' : completed ? '✅' : isDaily && !isDailyAvailable ? '⏰' : 'Reclamar'}
                </button>
              </div>
              {isDaily && !isDailyAvailable && user.lastDailyBonus && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Próximo bono disponible en 24h desde tu último reclamo
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-5 bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">📊 Tus Estadísticas</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-xl font-bold text-white">{user.totalBets || 0}</div>
            <div className="text-xs text-gray-500">Apuestas</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">{user.totalWins || 0}</div>
            <div className="text-xs text-gray-500">Ganadas</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-yellow-400">{user.completedTasks?.length || 0}</div>
            <div className="text-xs text-gray-500">Tareas</div>
          </div>
        </div>
      </div>
    </div>
  );
}
