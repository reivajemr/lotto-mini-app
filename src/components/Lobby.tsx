import { useState, useEffect, useCallback } from 'react';
import { ANIMALS, DRAW_TIMES, BET_CONFIG, API_BASE } from '../constants';
import { AppUser, DrawResult } from '../types';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  onAlert: (msg: string) => void;
}

function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}

function getDrawId(dateStr: string, time: string) {
  return `${dateStr}-${time.replace(':', '')}`;
}

function getVzDateStr() {
  const vz = vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth() + 1).padStart(2, '0')}-${String(vz.getDate()).padStart(2, '0')}`;
}

function getActiveDraws() {
  const now = vzNow();
  const dateStr = getVzDateStr();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return DRAW_TIMES.filter(time => {
    const [h, m] = time.split(':').map(Number);
    const drawMinutes = h * 60 + m;
    const closeMinutes = drawMinutes - 10;
    return currentMinutes < drawMinutes && currentMinutes >= (closeMinutes - 60);
  }).map(time => ({
    time,
    drawId: getDrawId(dateStr, time),
    isOpen: (() => {
      const [h, m] = time.split(':').map(Number);
      const drawMinutes = h * 60 + m;
      const closeMinutes = drawMinutes - 10;
      return currentMinutes < closeMinutes;
    })(),
  }));
}

function getTimeUntil(time: string) {
  const now = vzNow();
  const [h, m] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function Lobby({ user, onBalanceUpdate, onAlert }: Props) {
  const [activeDraws, setActiveDraws] = useState(getActiveDraws());
  const [selectedDraw, setSelectedDraw] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<typeof ANIMALS[0] | null>(null);
  const [betAmount, setBetAmount] = useState(BET_CONFIG.minBet);
  const [loading, setLoading] = useState(false);
  const [recentResults, setRecentResults] = useState<DrawResult[]>([]);
  const [timers, setTimers] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'apostar' | 'resultados'>('apostar');

  // Update draws & timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDraws(getActiveDraws());
      const newTimers: Record<string, string> = {};
      DRAW_TIMES.forEach(t => { newTimers[t] = getTimeUntil(t); });
      setTimers(newTimers);
    }, 1000);
    const newTimers: Record<string, string> = {};
    DRAW_TIMES.forEach(t => { newTimers[t] = getTimeUntil(t); });
    setTimers(newTimers);
    return () => clearInterval(interval);
  }, []);

  const loadResults = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.telegramId, action: 'getResults' }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setRecentResults(data.results.slice(0, 10));
      }
    } catch { /* silencioso */ }
  }, [user.telegramId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const placeBet = async () => {
    if (!selectedDraw || !selectedAnimal) {
      onAlert('⚠️ Selecciona un sorteo y un animalito');
      return;
    }
    if (betAmount < BET_CONFIG.minBet) {
      onAlert(`⚠️ Apuesta mínima: ${BET_CONFIG.minBet} 🥬`);
      return;
    }
    if (betAmount > BET_CONFIG.maxBetPerUser) {
      onAlert(`⚠️ Apuesta máxima: ${BET_CONFIG.maxBetPerUser} 🥬`);
      return;
    }
    if (user.balance < betAmount) {
      onAlert('❌ Saldo insuficiente');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: 'bet',
          drawId: selectedDraw,
          animal: selectedAnimal.name,
          animalNumber: selectedAnimal.number,
          amount: betAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onBalanceUpdate(data.newBalance);
        onAlert(`✅ ¡Apuesta registrada!\n${selectedAnimal.emoji} ${selectedAnimal.name} — Sorteo ${selectedDraw.split('-').slice(-1)[0].slice(0, 2)}:${selectedDraw.split('-').slice(-1)[0].slice(2, 4)}\n💰 ${betAmount} 🥬 apostados`);
        setSelectedAnimal(null);
        setBetAmount(BET_CONFIG.minBet);
      } else {
        onAlert(`❌ ${data.error || 'Error al apostar'}`);
      }
    } catch {
      onAlert('❌ Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const filteredAnimals = ANIMALS.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(a.number).includes(searchTerm)
  );

  const nextDraw = DRAW_TIMES.find(t => {
    const now = vzNow();
    const [h, m] = t.split(':').map(Number);
    const drawTime = new Date(now);
    drawTime.setHours(h, m, 0, 0);
    return drawTime.getTime() > now.getTime();
  });

  return (
    <div className="pb-6">
      {/* Tabs */}
      <div className="flex bg-gray-900 rounded-xl mb-4 p-1">
        <button
          onClick={() => setActiveTab('apostar')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'apostar' ? 'bg-green-500 text-black' : 'text-gray-400'}`}
        >
          🎰 Apostar
        </button>
        <button
          onClick={() => { setActiveTab('resultados'); loadResults(); }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'resultados' ? 'bg-green-500 text-black' : 'text-gray-400'}`}
        >
          📊 Resultados
        </button>
      </div>

      {activeTab === 'apostar' && (
        <>
          {/* Next draw countdown */}
          {nextDraw && (
            <div className="bg-gradient-to-r from-purple-900/60 to-blue-900/60 rounded-xl p-3 mb-4 border border-purple-500/30 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">Próximo sorteo</div>
                <div className="text-lg font-bold text-white">{nextDraw}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Cierra en</div>
                <div className="text-2xl font-mono font-bold text-yellow-400">{timers[nextDraw] || '--:--'}</div>
              </div>
            </div>
          )}

          {/* Select draw */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">📅 Selecciona Sorteo</h3>
            {activeDraws.length === 0 ? (
              <div className="bg-gray-900 rounded-xl p-4 text-center text-gray-500 text-sm">
                No hay sorteos activos en este momento.<br />
                Horario: 8AM – 7PM (Hora Venezuela)
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {activeDraws.map(draw => (
                  <button
                    key={draw.drawId}
                    onClick={() => draw.isOpen && setSelectedDraw(draw.drawId)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      selectedDraw === draw.drawId
                        ? 'bg-green-500 text-black border-green-400'
                        : draw.isOpen
                          ? 'bg-gray-800 text-white border-gray-700 hover:border-green-500'
                          : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                    }`}
                  >
                    {draw.time}
                    {!draw.isOpen && <span className="ml-1 text-xs">🔒</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Select animal */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">🐾 Selecciona Animalito</h3>
            <input
              type="text"
              placeholder="Buscar animalito..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-green-500"
            />
            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredAnimals.map(animal => (
                <button
                  key={animal.number}
                  onClick={() => setSelectedAnimal(animal)}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    selectedAnimal?.number === animal.number
                      ? 'bg-green-500/20 border-green-400 scale-105'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{animal.emoji}</span>
                  <span className="text-xs text-gray-300 mt-1 leading-tight text-center">{animal.name}</span>
                  <span className="text-xs text-gray-500">#{animal.number}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bet amount */}
          {selectedAnimal && (
            <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">💰 Monto de Apuesta</h3>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setBetAmount(Math.max(BET_CONFIG.minBet, betAmount - 50))}
                  className="w-10 h-10 bg-gray-700 rounded-lg text-white font-bold text-lg hover:bg-gray-600"
                >
                  −
                </button>
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(Math.max(BET_CONFIG.minBet, Math.min(BET_CONFIG.maxBetPerUser, Number(e.target.value))))}
                  className="flex-1 text-center bg-gray-800 rounded-lg py-2 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={() => setBetAmount(Math.min(BET_CONFIG.maxBetPerUser, betAmount + 50))}
                  className="w-10 h-10 bg-gray-700 rounded-lg text-white font-bold text-lg hover:bg-gray-600"
                >
                  +
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                {[50, 100, 200, 500].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${betAmount === v ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-gray-800 rounded-lg p-3 text-sm space-y-1 mb-4">
                <div className="flex justify-between text-gray-400">
                  <span>Animalito</span>
                  <span className="text-white">{selectedAnimal.emoji} {selectedAnimal.name} #{selectedAnimal.number}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Apuesta</span>
                  <span className="text-white">{betAmount.toLocaleString()} 🥬</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Premio x{BET_CONFIG.multiplier}</span>
                  <span className="text-green-400 font-bold">{(betAmount * BET_CONFIG.multiplier).toLocaleString()} 🥬</span>
                </div>
              </div>

              <button
                onClick={placeBet}
                disabled={loading || !selectedDraw}
                className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl transition-all text-base"
              >
                {loading ? '⏳ Procesando...' : !selectedDraw ? 'Selecciona un sorteo' : `🎰 ¡Apostar ${betAmount.toLocaleString()} 🥬!`}
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'resultados' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-400">Últimos Resultados</h3>
            <button onClick={loadResults} className="text-xs text-green-400 hover:text-green-300">
              🔄 Actualizar
            </button>
          </div>
          {recentResults.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-6 text-center text-gray-500 text-sm">
              No hay resultados disponibles aún
            </div>
          ) : (
            <div className="space-y-2">
              {recentResults.map((r, i) => {
                const drawTime = r.drawId?.split('-').slice(-1)[0] || '';
                const timeStr = drawTime ? `${drawTime.slice(0, 2)}:${drawTime.slice(2, 4)}` : r.drawId;
                const animal = ANIMALS.find(a => a.name === r.winnerAnimal || a.number === r.winnerNumber);
                return (
                  <div key={i} className="bg-gray-900 rounded-xl p-3 flex items-center justify-between border border-gray-800">
                    <div>
                      <div className="text-xs text-gray-500">{timeStr}</div>
                      <div className="text-sm text-white font-semibold">
                        {animal?.emoji || '🐾'} {r.winnerAnimal}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-yellow-400">#{r.winnerNumber}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
