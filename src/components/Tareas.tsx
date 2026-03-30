import { useState, useEffect } from 'react';
import { completeTask } from '../api';

interface TareasProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  telegramId: string;
  username: string;
  completedTasksFromDB?: string[];
  lastDailyBonusFromDB?: string | null;
}

interface Task {
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: number;
  action: string;
  completed: boolean;
  url?: string;
  pendingVerify?: boolean; // esperando que el usuario haga la acción
}

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas

export default function Tareas({ balance, onBalanceChange, showAlert, haptic, telegramId, username, completedTasksFromDB = [], lastDailyBonusFromDB = null }: TareasProps) {
  const STORAGE_KEY = `tareas_${telegramId}`;
  const DAILY_KEY = `daily_${telegramId}`;

  // Cargar estado de tareas completadas — BD tiene prioridad sobre localStorage
  const loadInitialTasks = (): Task[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const localCompleted: string[] = saved ? JSON.parse(saved) : [];
      // Unir las completadas de BD y las locales
      const completed = Array.from(new Set([...completedTasksFromDB, ...localCompleted]));

      // Bonus diario: verificar en BD primero, luego localStorage
      const lastDailyDB = lastDailyBonusFromDB ? new Date(lastDailyBonusFromDB).getTime() : 0;
      const lastDailyLocal = localStorage.getItem(DAILY_KEY) ? parseInt(localStorage.getItem(DAILY_KEY)!) : 0;
      const lastDaily = Math.max(lastDailyDB, lastDailyLocal);
      const dailyAvailable = !lastDaily || Date.now() - lastDaily > DAILY_COOLDOWN_MS;

      return [
        {
          id: 'canal',
          icon: '📢',
          title: 'Suscribirse al canal',
          description: 'Únete al canal oficial de Animalito Lotto',
          reward: 50,
          action: 'Suscribirse',
          completed: completed.includes('canal'),
          url: 'https://t.me/animalitolotto',
        },
        {
          id: 'invitar',
          icon: '👥',
          title: 'Invitar a un amigo',
          description: 'Comparte tu link de referido en Amigos',
          reward: 100,
          action: 'Ir a Amigos',
          completed: completed.includes('invitar'),
        },
        {
          id: 'twitter',
          icon: '🐦',
          title: 'Seguir en Twitter/X',
          description: 'Síguenos en nuestras redes sociales',
          reward: 50,
          action: 'Seguir',
          completed: completed.includes('twitter'),
          url: 'https://x.com/animalitolotto',
        },
        {
          id: 'jugar',
          icon: '🎰',
          title: 'Jugar tu primera partida',
          description: 'Realiza tu primera apuesta en el Lobby',
          reward: 200,
          action: 'Ir al Lobby',
          completed: completed.includes('jugar'),
        },
        {
          id: 'daily',
          icon: '📅',
          title: 'Bonus Diario',
          description: dailyAvailable ? '¡Disponible! Reclama tus lechugas de hoy' : 'Ya reclamado — vuelve en 24h',
          reward: 25,
          action: dailyAvailable ? 'Reclamar' : '⏳ Espera 24h',
          completed: !dailyAvailable,
        },
      ];
    } catch {
      return [];
    }
  };

  const [tasks, setTasks] = useState<Task[]>(loadInitialTasks);
  const [pendingId, setPendingId] = useState<string | null>(null); // tarea esperando verificación
  const [loading, setLoading] = useState<string | null>(null);

  // Cuando el usuario vuelve a la pestaña, verificar tareas pendientes (canal, twitter)
  useEffect(() => {
    const handleFocus = () => {
      if (!pendingId) return;
      // El usuario salió y volvió → asumir que hizo la acción y dar reward
      handleGrantReward(pendingId);
      setPendingId(null);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && pendingId) {
        handleGrantReward(pendingId);
        setPendingId(null);
      }
    });
    return () => window.removeEventListener('focus', handleFocus);
  }, [pendingId]);

  const handleGrantReward = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.completed) return;

    setLoading(taskId);
    haptic('medium');

    try {
      // Guardar en backend
      if (telegramId && telegramId !== '123456789') {
        await completeTask(telegramId, username, taskId, task.reward);
      }
    } catch (err) {
      console.warn('Error syncing task:', err);
    }

    // Marcar como completada en localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const completed: string[] = saved ? JSON.parse(saved) : [];
      if (!completed.includes(taskId)) {
        completed.push(taskId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
      }
      // Si es el bonus diario, guardar timestamp
      if (taskId === 'daily') {
        localStorage.setItem(DAILY_KEY, Date.now().toString());
      }
    } catch {}

    // Actualizar UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed: true, action: taskId === 'daily' ? '⏳ Espera 24h' : t.action }
          : t
      )
    );
    onBalanceChange(balance + task.reward);
    showAlert(`✅ +${task.reward} 🥬 recibidas!`);
    setLoading(null);
  };

  const handleTaskClick = (task: Task) => {
    if (task.completed || loading) return;
    haptic('light');

    // Tareas que requieren salir de la app primero
    if (task.id === 'canal' || task.id === 'twitter') {
      if (task.url && task.url !== '#') {
        setPendingId(task.id); // marcar como pendiente
        window.open(task.url, '_blank');
        showAlert(`✅ Suscríbete y vuelve aquí para recibir tus ${task.reward} 🥬`);
      }
      return;
    }

    // Bonus diario — dar directamente
    if (task.id === 'daily') {
      handleGrantReward(task.id);
      return;
    }

    // Otras tareas — dar directamente (invitar, jugar, etc.)
    handleGrantReward(task.id);
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  // Calcular tiempo restante del bonus diario
  const getDailyTimeLeft = () => {
    const lastDaily = localStorage.getItem(DAILY_KEY);
    if (!lastDaily) return null;
    const elapsed = Date.now() - parseInt(lastDaily);
    const remaining = DAILY_COOLDOWN_MS - elapsed;
    if (remaining <= 0) return null;
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-2xl border border-white/5 bg-[rgba(45,45,45,0.8)] p-5 text-center">
        <span className="text-4xl">📋</span>
        <h1 className="mt-2 text-xl font-bold text-white">Tareas Disponibles</h1>
        <p className="mt-1 text-sm text-gray-400">
          Completa misiones para ganar más lechugas
        </p>

        {/* Progress */}
        <div className="mx-auto mt-4 max-w-[200px]">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Progreso</span>
            <span>{completedCount}/{tasks.length}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0088cc] to-[#4caf50] transition-all duration-500"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {tasks.map((task) => {
          const isLoading = loading === task.id;
          const isPending = pendingId === task.id;
          const dailyTimeLeft = task.id === 'daily' && task.completed ? getDailyTimeLeft() : null;

          return (
            <div
              key={task.id}
              className={`rounded-xl border p-4 transition-all ${
                task.completed
                  ? 'border-[#4caf50]/20 bg-[#4caf50]/5 opacity-70'
                  : isPending
                  ? 'border-yellow-500/30 bg-yellow-900/10'
                  : 'border-white/10 bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{task.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-bold truncate ${
                      task.completed ? 'text-gray-500 line-through' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isPending ? '⏳ Vuelve aquí después de hacer la acción' : task.description}
                  </p>
                  {dailyTimeLeft && (
                    <p className="text-xs text-yellow-400 mt-0.5">⏳ Próximo bonus en {dailyTimeLeft}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="block text-xs font-bold text-[#4caf50]">
                    +{task.reward} 🥬
                  </span>
                  {task.completed ? (
                    <span className="mt-1 inline-block rounded-full bg-[#4caf50]/20 px-2 py-0.5 text-[10px] font-bold text-[#4caf50]">
                      ✅ Hecho
                    </span>
                  ) : isPending ? (
                    <button
                      onClick={() => { handleGrantReward(task.id); setPendingId(null); }}
                      className="mt-1 rounded-lg bg-yellow-500 px-3 py-1 text-[10px] font-bold text-black transition-transform active:scale-95"
                    >
                      ✓ Confirmar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTaskClick(task)}
                      disabled={isLoading || task.id === 'daily' && task.completed}
                      className={`mt-1 rounded-lg px-3 py-1 text-[10px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50 ${
                        task.id === 'daily' && task.completed
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-[#0088cc]'
                      }`}
                    >
                      {isLoading ? '...' : task.action}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
        <p className="text-xs text-gray-500">
          🔒 Las tareas de canal y redes te redirigen — vuelve aquí para confirmar tu recompensa
        </p>
      </div>
    </div>
  );
}
