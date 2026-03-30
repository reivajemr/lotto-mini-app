import { useState } from 'react';

interface TareasProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
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
}

export default function Tareas({ balance, onBalanceChange, showAlert, haptic }: TareasProps) {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'canal',
      icon: '📢',
      title: 'Suscribirse al canal',
      description: 'Únete al canal oficial de Animalito Lotto',
      reward: 50,
      action: 'Suscribirse',
      completed: false,
      url: 'https://t.me/animalitolotto',
    },
    {
      id: 'invitar',
      icon: '👥',
      title: 'Invitar a un amigo',
      description: 'Comparte tu link con un amigo',
      reward: 100,
      action: 'Invitar',
      completed: false,
    },
    {
      id: 'twitter',
      icon: '🐦',
      title: 'Seguir en Twitter/X',
      description: 'Síguenos en nuestras redes sociales',
      reward: 50,
      action: 'Seguir',
      completed: false,
      url: '#',
    },
    {
      id: 'jugar',
      icon: '🎰',
      title: 'Jugar tu primera partida',
      description: 'Realiza tu primera apuesta en el Lobby',
      reward: 200,
      action: 'Jugar',
      completed: false,
    },
    {
      id: 'wallet_task',
      icon: '💳',
      title: 'Conectar Wallet',
      description: 'Conecta tu wallet TON para transacciones',
      reward: 150,
      action: 'Conectar',
      completed: false,
    },
    {
      id: 'daily',
      icon: '📅',
      title: 'Bonus Diario',
      description: 'Reclama tu bonus diario de lechugas',
      reward: 25,
      action: 'Reclamar',
      completed: false,
    },
  ]);

  const handleCompleteTask = (taskId: string) => {
    haptic('medium');
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.completed) return;

    if (task.url && task.url !== '#') {
      window.open(task.url, '_blank');
    }

    // Mark as completed and add reward
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t))
    );
    onBalanceChange(balance + task.reward);
    showAlert(`✅ +${task.reward} 🥬 recibidas!`);
  };

  const completedCount = tasks.filter((t) => t.completed).length;

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
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-xl border p-4 transition-all ${
              task.completed
                ? 'border-[#4caf50]/20 bg-[#4caf50]/5 opacity-70'
                : 'border-white/10 bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{task.icon}</span>
              <div className="flex-1">
                <h3 className={`text-sm font-bold ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {task.title}
                </h3>
                <p className="text-xs text-gray-400">{task.description}</p>
              </div>
              <div className="text-right">
                <span className="block text-xs font-bold text-[#4caf50]">
                  +{task.reward} 🥬
                </span>
                {task.completed ? (
                  <span className="mt-1 inline-block rounded-full bg-[#4caf50]/20 px-2 py-0.5 text-[10px] font-bold text-[#4caf50]">
                    ✅ Hecho
                  </span>
                ) : (
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="mt-1 rounded-lg bg-[#0088cc] px-3 py-1 text-[10px] font-bold text-white transition-transform active:scale-95"
                  >
                    {task.action}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
