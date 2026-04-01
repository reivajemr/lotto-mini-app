import { AppUser } from '../types';
import { LECHUGAS_PER_TON } from '../constants';

interface Props {
  user: AppUser;
}

const milestones = [
  { lechugas: 1000,   label: 'Aprendiz',    emoji: '🌱', ton: 0.1 },
  { lechugas: 5000,   label: 'Agricultor',  emoji: '🌿', ton: 0.5 },
  { lechugas: 10000,  label: 'Granjero',    emoji: '🌾', ton: 1.0 },
  { lechugas: 50000,  label: 'Cosechador',  emoji: '🌻', ton: 5.0 },
  { lechugas: 100000, label: 'Maestro',     emoji: '🏆', ton: 10.0 },
];

export default function FarmTab({ user }: Props) {
  const balance = user.balance;
  const balanceTon = (balance / LECHUGAS_PER_TON).toFixed(4);

  const currentMilestone = [...milestones].reverse().find((m: typeof milestones[0]) => balance >= m.lechugas) || null;
  const nextMilestone = milestones.find(m => balance < m.lechugas) || null;
  const progress = nextMilestone
    ? ((balance - (currentMilestone?.lechugas || 0)) / (nextMilestone.lechugas - (currentMilestone?.lechugas || 0))) * 100
    : 100;

  const tips = [
    { icon: '🎰', text: 'Apuesta en los sorteos para multiplicar tus lechugas x30' },
    { icon: '🎁', text: 'Reclama tu bono diario de 200 🥬 cada 24 horas' },
    { icon: '📢', text: 'Completa tareas para ganar lechugas gratis' },
    { icon: '💎', text: 'Conecta tu wallet TON para depositar y retirar' },
    { icon: '🏆', text: 'Acumula 100,000 🥬 para alcanzar el nivel Maestro' },
  ];

  return (
    <div className="pb-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-2xl p-5 mb-5 border border-green-700/40 text-center">
        <div className="text-5xl mb-2">🥬</div>
        <div className="text-3xl font-extrabold text-white">{balance.toLocaleString()}</div>
        <div className="text-green-400 text-sm mt-1">Lechugas acumuladas</div>
        <div className="text-gray-400 text-xs mt-1">≈ {balanceTon} TON</div>
      </div>

      {/* Level progress */}
      <div className="bg-gray-900 rounded-xl p-4 mb-5 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400">Nivel actual</div>
            <div className="text-lg font-bold text-white">
              {currentMilestone ? `${currentMilestone.emoji} ${currentMilestone.label}` : '🥬 Novato'}
            </div>
          </div>
          {nextMilestone && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Siguiente nivel</div>
              <div className="text-sm font-semibold text-yellow-400">
                {nextMilestone.emoji} {nextMilestone.label}
              </div>
              <div className="text-xs text-gray-500">{nextMilestone.lechugas.toLocaleString()} 🥬</div>
            </div>
          )}
        </div>

        {nextMilestone && (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{balance.toLocaleString()} 🥬</span>
              <span>{nextMilestone.lechugas.toLocaleString()} 🥬</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-center">
              Faltan {(nextMilestone.lechugas - balance).toLocaleString()} 🥬 para {nextMilestone.label}
            </div>
          </>
        )}

        {!nextMilestone && (
          <div className="text-center mt-2 text-yellow-400 font-bold text-sm">
            🏆 ¡Has alcanzado el nivel máximo!
          </div>
        )}
      </div>

      {/* All milestones */}
      <div className="bg-gray-900 rounded-xl p-4 mb-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">🏅 Niveles</h3>
        <div className="space-y-2">
          {milestones.map(m => (
            <div
              key={m.lechugas}
              className={`flex items-center justify-between p-2.5 rounded-lg ${balance >= m.lechugas ? 'bg-green-900/30 border border-green-700/30' : 'bg-gray-800/50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{m.emoji}</span>
                <span className={`text-sm font-semibold ${balance >= m.lechugas ? 'text-green-400' : 'text-gray-400'}`}>
                  {m.label}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">{m.lechugas.toLocaleString()} 🥬</div>
                <div className="text-xs text-blue-400">≈ {m.ton} TON</div>
              </div>
              {balance >= m.lechugas && (
                <span className="ml-2 text-green-400 text-sm">✅</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">💡 Consejos</h3>
        <div className="space-y-2">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span>{tip.icon}</span>
              <span className="text-gray-300">{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
