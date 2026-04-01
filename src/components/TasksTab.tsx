import { useState } from 'react';
import type { AppUser } from '../types';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  action?: () => void;
  actionLabel?: string;
  completed?: boolean;
}

export default function TasksTab({ user, onBalanceUpdate, showAlert, haptic }: Props) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [loadingTask, setLoadingTask] = useState<string | null>(null);

  const claimTask = async (task: Task) => {
    if (completedTasks.has(task.id)) {
      showAlert('Ya completaste esta tarea');
      return;
    }

    setLoadingTask(task.id);
    haptic('medium');

    try {
      const res = await fetch('/api/claim-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.telegramId,
          taskId: task.id,
          reward: task.reward,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error?.includes('ya')) {
          setCompletedTasks(prev => new Set([...prev, task.id]));
          showAlert('Ya reclamaste esta tarea anteriormente');
          return;
        }
        showAlert(err.error || 'Error al reclamar tarea');
        return;
      }

      const data = await res.json();
      setCompletedTasks(prev => new Set([...prev, task.id]));
      onBalanceUpdate(data.newBalance);
      haptic('success');
      showAlert(`🎉 ¡Tarea completada!\n+${task.reward} 🥬 Lechugas`);

      if (task.action) task.action();
    } catch {
      showAlert('Error de conexión');
    } finally {
      setLoadingTask(null);
    }
  };

  const tasks: Task[] = [
    {
      id: 'join_channel',
      title: 'Unirse al Canal',
      description: 'Únete a nuestro canal oficial de Telegram',
      reward: 500,
      icon: '📣',
      action: () => window.open('https://t.me/animalito_lotto', '_blank'),
      actionLabel: 'Abrir Canal',
    },
    {
      id: 'share_bot',
      title: 'Compartir el Bot',
      description: 'Comparte el bot con 3 amigos',
      reward: 1000,
      icon: '🔗',
      action: () => window.open('https://t.me/share/url?url=https://t.me/AnimalitoLottoBot&text=¡Juega Animalito Lotto y gana TON!', '_blank'),
      actionLabel: 'Compartir',
    },
    {
      id: 'daily_login',
      title: 'Login Diario',
      description: 'Inicia sesión hoy para recibir tu bono',
      reward: 200,
      icon: '📅',
    },
    {
      id: 'connect_wallet',
      title: 'Conectar Billetera TON',
      description: 'Vincula tu wallet TON a tu cuenta',
      reward: 300,
      icon: '💎',
    },
    {
      id: 'first_ticket',
      title: 'Primer Ticket',
      description: 'Compra tu primer ticket de lotto',
      reward: 500,
      icon: '🎟',
    },
    {
      id: 'follow_twitter',
      title: 'Seguir en Twitter/X',
      description: 'Síguenos en Twitter para noticias',
      reward: 300,
      icon: '🐦',
      action: () => window.open('https://twitter.com/AnimalitoLotto', '_blank'),
      actionLabel: 'Abrir Twitter',
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="mx-4 bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-4 text-white shadow-lg">
        <div className="text-center">
          <div className="text-3xl mb-1">✅</div>
          <div className="font-bold text-lg">Tareas y Recompensas</div>
          <div className="text-purple-200 text-xs mt-1">
            Completa tareas para ganar 🥬 lechugas gratis
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-teal-600">{completedTasks.size}</div>
          <div className="text-xs text-gray-500">Tareas completadas</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-purple-600">{tasks.length}</div>
          <div className="text-xs text-gray-500">Total disponibles</div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="mx-4 space-y-3">
        <div className="text-sm font-semibold text-gray-600">Tareas disponibles:</div>
        {tasks.map(task => {
          const isDone = completedTasks.has(task.id);
          const isLoading = loadingTask === task.id;
          return (
            <div
              key={task.id}
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                isDone ? 'border-green-200 bg-green-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{task.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-800">{task.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      +{task.reward.toLocaleString()} 🥬
                    </span>
                    {isDone && (
                      <span className="text-xs text-green-600 font-medium">✓ Completada</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {task.action && !isDone && (
                    <button
                      onClick={task.action}
                      className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-all whitespace-nowrap"
                    >
                      {task.actionLabel || 'Ir'}
                    </button>
                  )}
                  <button
                    onClick={() => claimTask(task)}
                    disabled={isDone || isLoading}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                      isDone
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : isLoading
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-teal-500 text-white hover:bg-teal-600 active:scale-95'
                    }`}
                  >
                    {isDone ? '✓ Hecho' : isLoading ? '⏳' : 'Reclamar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Referral section */}
      <div className="mx-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
        <div className="font-bold text-amber-800 mb-2">🎁 Referidos</div>
        <div className="text-sm text-amber-700 mb-3">
          Invita amigos y gana <strong>500 🥬</strong> por cada uno que se registre
        </div>
        <button
          onClick={() => {
            const link = `https://t.me/AnimalitoLottoBot?start=${user.telegramId}`;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(link);
              showAlert('¡Enlace de referido copiado!');
            } else {
              showAlert(`Tu enlace de referido:\n${link}`);
            }
          }}
          className="w-full py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 active:scale-95 transition-all"
        >
          📋 Copiar Mi Enlace de Referido
        </button>
      </div>
    </div>
  );
}
