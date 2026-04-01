import { useState, useEffect, useCallback } from 'react';
import type { AppUser, DrawResult, Ticket, Animal } from '../types';
import { ANIMALS, DRAW_TIMES, TICKET_PRICE } from '../constants';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
}

function getNextDrawTime(): { label: string; msLeft: number } {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const nowMins = h * 60 + m;

  for (const t of DRAW_TIMES) {
    const [th, tm] = t.split(':').map(Number);
    const tMins = th * 60 + (tm || 0);
    if (tMins > nowMins) {
      const diff = tMins - nowMins;
      const diffMs = diff * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
      return { label: t, msLeft: diffMs };
    }
  }
  // Next is 08:00 tomorrow
  const [th, tm] = DRAW_TIMES[0].split(':').map(Number);
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(th, tm || 0, 0, 0);
  return { label: DRAW_TIMES[0], msLeft: nextDay.getTime() - now.getTime() };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '¡Ya!';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LobbyTab({ user, onBalanceUpdate, showAlert, haptic }: Props) {
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [amount, setAmount] = useState(1);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [todayResults, setTodayResults] = useState<DrawResult[]>([]);
  const [countdown, setCountdown] = useState('');
  const [nextDraw, setNextDraw] = useState('');
  const [loadingBuy, setLoadingBuy] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const { label, msLeft } = getNextDrawTime();
      setNextDraw(label);
      setCountdown(formatCountdown(msLeft));
    };
    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, []);

  // Load today's results
  useEffect(() => {
    fetch(`/api/results?limit=12`)
      .then(r => r.json())
      .then(data => setTodayResults(Array.isArray(data) ? data : []))
      .catch(() => setTodayResults([]));
  }, []);

  const loadTickets = useCallback(async () => {
    if (!user.telegramId) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/tickets?userId=${user.telegramId}`);
      const data = await res.json();
      setMyTickets(Array.isArray(data) ? data : []);
    } catch {
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [user.telegramId]);

  const handleBuyTicket = async () => {
    if (!selectedAnimal) { showAlert('Selecciona un animal'); return; }
    const totalCost = TICKET_PRICE * amount;
    if (user.balance < totalCost) {
      showAlert(`Saldo insuficiente. Necesitas ${totalCost} 🥬 (tienes ${user.balance})`);
      return;
    }

    setLoadingBuy(true);
    haptic('medium');
    try {
      const res = await fetch('/api/buy-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.telegramId,
          animal: selectedAnimal.name,
          emoji: selectedAnimal.emoji,
          amount,
          drawTime: nextDraw,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showAlert(err.error || 'Error al comprar ticket');
        return;
      }
      const data = await res.json();
      onBalanceUpdate(data.newBalance);
      haptic('success');
      showAlert(`✅ Ticket comprado: ${selectedAnimal.emoji} ${selectedAnimal.name} x${amount}\nSorteo: ${nextDraw}\nCosto: ${totalCost} 🥬`);
      setSelectedAnimal(null);
      setAmount(1);
    } catch {
      showAlert('Error de conexión al comprar ticket');
    } finally {
      setLoadingBuy(false);
    }
  };

  const totalCost = TICKET_PRICE * amount;

  const todayDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();

  return (
    <div className="space-y-4 pb-4">
      {/* Lotto Active Card */}
      <div className="mx-4 bg-gradient-to-br from-teal-700 to-teal-900 rounded-2xl p-4 text-white shadow-lg">
        <div className="text-center mb-3">
          <div className="text-3xl mb-1">🎰</div>
          <div className="font-bold text-lg">Lotto Activo</div>
          <div className="text-teal-200 text-xs mt-1">
            {DRAW_TIMES.length} sorteos diarios · Premio x30 · Resultados oficiales
          </div>
        </div>
        <div className="bg-teal-800/60 rounded-xl px-4 py-2 text-center">
          <div className="text-teal-300 text-xs">⏱ Próximo sorteo ({nextDraw}) cierra en:</div>
          <div className="font-bold text-xl mt-1">{countdown}</div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="mx-4 flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setShowTickets(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            !showTickets ? 'bg-teal-600 text-white shadow' : 'text-gray-500'
          }`}
        >
          🎰 Lotto Activo
        </button>
        <button
          onClick={() => { setShowTickets(true); loadTickets(); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            showTickets ? 'bg-teal-600 text-white shadow' : 'text-gray-500'
          }`}
        >
          🎫 Mis Tickets
        </button>
      </div>

      {!showTickets ? (
        <>
          {/* Animal selector */}
          <div className="mx-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">Elige tu animal:</div>
            <div className="grid grid-cols-5 gap-2">
              {ANIMALS.map(a => (
                <button
                  key={a.number}
                  onClick={() => { setSelectedAnimal(a); haptic('light'); }}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all text-xs ${
                    selectedAnimal?.number === a.number
                      ? 'border-teal-500 bg-teal-50 shadow-md scale-105'
                      : 'border-gray-200 bg-white hover:border-teal-300'
                  }`}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="text-gray-600 leading-tight text-center mt-1" style={{fontSize: '9px'}}>{a.name}</span>
                  <span className="text-gray-400" style={{fontSize: '9px'}}>#{a.number}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount selector */}
          {selectedAnimal && (
            <div className="mx-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedAnimal.emoji}</span>
                <div>
                  <div className="font-bold text-gray-800">{selectedAnimal.name}</div>
                  <div className="text-xs text-gray-500">Animal #{selectedAnimal.number}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Cantidad de tickets:</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAmount(a => Math.max(1, a - 1))}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-700"
                  >−</button>
                  <span className="font-bold text-lg w-8 text-center">{amount}</span>
                  <button
                    onClick={() => setAmount(a => Math.min(10, a + 1))}
                    className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center font-bold text-white"
                  >+</button>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Precio por ticket:</span>
                <span className="font-medium">{TICKET_PRICE} 🥬</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Total:</span>
                <span className={totalCost > user.balance ? 'text-red-500' : 'text-teal-600'}>
                  {totalCost.toLocaleString()} 🥬
                </span>
              </div>

              <button
                onClick={handleBuyTicket}
                disabled={loadingBuy || totalCost > user.balance}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-700 active:scale-95 transition-all"
              >
                {loadingBuy ? '⏳ Comprando...' : `🎟 Comprar Ticket${amount > 1 ? 's' : ''} — ${totalCost.toLocaleString()} 🥬`}
              </button>
            </div>
          )}

          {/* Today's results */}
          <div className="mx-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">SORTEOS DE HOY — {todayDate}</div>
            <div className="space-y-2">
              {DRAW_TIMES.map(time => {
                const result = todayResults.find(r => r.drawTime === time);
                return (
                  <div key={time} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                    {result ? (
                      <>
                        <span className="text-2xl">{result.winnerEmoji}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{time}</div>
                          <div className="text-xs text-gray-500">{result.winnerAnimal}</div>
                        </div>
                        <span className="text-xs text-green-600 font-medium">✓ Resultado</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl text-gray-300">🕐</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{time}</div>
                          <div className="text-xs text-gray-400">Sin resultado aún</div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* My Tickets */
        <div className="mx-4">
          {loadingTickets ? (
            <div className="text-center py-8 text-gray-400">Cargando tickets...</div>
          ) : myTickets.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎟</div>
              <div className="text-gray-500 text-sm">No tienes tickets aún</div>
              <button
                onClick={() => setShowTickets(false)}
                className="mt-3 text-teal-600 text-sm font-medium"
              >Comprar tickets →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {myTickets.map(t => (
                <div key={t._id} className={`bg-white rounded-xl p-3 shadow-sm border ${
                  t.status === 'won' ? 'border-yellow-300' :
                  t.status === 'lost' ? 'border-red-200' : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{t.animal} · Sorteo {t.drawTime}</div>
                      <div className="text-xs text-gray-400">{t.amount} ticket{t.amount > 1 ? 's' : ''} · {TICKET_PRICE * t.amount} 🥬</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      t.status === 'won' ? 'bg-yellow-100 text-yellow-700' :
                      t.status === 'lost' ? 'bg-red-100 text-red-600' :
                      'bg-teal-100 text-teal-700'
                    }`}>
                      {t.status === 'won' ? `🏆 +${t.prize} 🥬` :
                       t.status === 'lost' ? '❌ Perdido' : '⏳ Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
