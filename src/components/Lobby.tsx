// src/components/Lobby.tsx
import { useState, useEffect, useCallback, useRef } from 'react';

// ── 37 Animalitos venezolanos ────────────────────────────────
const ANIMALS = [
  { number: 1,  name: 'Carnero',    emoji: '🐑' },
  { number: 2,  name: 'Toro',       emoji: '🐂' },
  { number: 3,  name: 'Ciempiés',   emoji: '🐛' },
  { number: 4,  name: 'Alacrán',    emoji: '🦂' },
  { number: 5,  name: 'León',       emoji: '🦁' },
  { number: 6,  name: 'Rana',       emoji: '🐸' },
  { number: 7,  name: 'Perico',     emoji: '🦜' },
  { number: 8,  name: 'Ratón',      emoji: '🐭' },
  { number: 9,  name: 'Águila',     emoji: '🦅' },
  { number: 10, name: 'Tigre',      emoji: '🐯' },
  { number: 11, name: 'Gato',       emoji: '🐱' },
  { number: 12, name: 'Caballo',    emoji: '🐴' },
  { number: 13, name: 'Mono',       emoji: '🐒' },
  { number: 14, name: 'Paloma',     emoji: '🕊️' },
  { number: 15, name: 'Zorro',      emoji: '🦊' },
  { number: 16, name: 'Oso',        emoji: '🐻' },
  { number: 17, name: 'Pavo',       emoji: '🦃' },
  { number: 18, name: 'Burro',      emoji: '🫏' },
  { number: 19, name: 'Chivo',      emoji: '🐐' },
  { number: 20, name: 'Cochino',    emoji: '🐷' },
  { number: 21, name: 'Gallo',      emoji: '🐓' },
  { number: 22, name: 'Camello',    emoji: '🐫' },
  { number: 23, name: 'Zebra',      emoji: '🦓' },
  { number: 24, name: 'Iguana',     emoji: '🦎' },
  { number: 25, name: 'Gavilán',    emoji: '🦅' },
  { number: 26, name: 'Murciélago', emoji: '🦇' },
  { number: 27, name: 'Perro',      emoji: '🐶' },
  { number: 28, name: 'Venado',     emoji: '🦌' },
  { number: 29, name: 'Morrocoy',   emoji: '🐢' },
  { number: 30, name: 'Caimán',     emoji: '🐊' },
  { number: 31, name: 'Anteater',   emoji: '🐜' },
  { number: 32, name: 'Serpiente',  emoji: '🐍' },
  { number: 33, name: 'Lechuza',    emoji: '🦉' },
  { number: 34, name: 'Loro',       emoji: '🦜' },
  { number: 35, name: 'Jirafa',     emoji: '🦒' },
  { number: 36, name: 'Culebra',    emoji: '🐍' },
  { number: 0,  name: 'Ballena',    emoji: '🐋' },
];

const BET_CONFIG = {
  minBet: 50,
  maxBetPerUser: 1000,
  maxBetGlobal: 10000,
  multiplier: 30,
};

type DrawStatus = 'open' | 'closed' | 'drawing' | 'done';

interface DrawSlot {
  drawId: string;
  game: string;
  time: string;
  multiplier: number;
  status: DrawStatus;
  winnerNumber: number | null;
  winnerAnimal: string | null;
  publishedAt: string | null;
  closeTime: string;
  drawTime: string;
  resultTime: string;
}

interface AnimalSelection {
  animal: (typeof ANIMALS)[0];
  amount: number;
}

interface TicketBet {
  animal: string;
  number: number;
  amount: number;
  won: boolean | null;
  prize: number | null;
  status: string;
}

interface Ticket {
  ticketId: string;
  drawId: string;
  drawGame: string;
  totalBet: number;
  betsCount: number;
  status: 'pending' | 'won' | 'lost';
  totalPrize: number | null;
  createdAt: string;
  bets: TicketBet[];
}

interface LobbyProps {
  balance: number;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate: (newBalance: number) => void;
}

const GAMES = [
  { id: 'lotto',  name: '🎰 Lotto Activo', color: 'from-blue-600 to-blue-800',   badge: 'bg-blue-500'  },
  { id: 'granja', name: '🐄 La Granja',    color: 'from-green-600 to-green-800', badge: 'bg-green-500' },
];

// ── Hook: hora Venezuela actualizada cada segundo ─────────────
function useVzTime() {
  const [now, setNow] = useState(() =>
    new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }))
  );
  useEffect(() => {
    const iv = setInterval(() =>
      setNow(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }))), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

// ── Cuenta regresiva ─────────────────────────────────────────
function Countdown({ targetIso, className = '' }: { targetIso: string; className?: string }) {
  const now = useVzTime();
  const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - now.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const fmt = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={`font-mono font-bold tabular-nums ${className}`}>
      {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </span>
  );
}

// ── Badge de estado ──────────────────────────────────────────
function StatusBadge({ status }: { status: DrawStatus }) {
  const map = {
    open:    { label: '✅ Abierto',   cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    closed:  { label: '🔒 Cerrando', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    drawing: { label: '🎰 Sorteando', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse' },
    done:    { label: '✔ Finalizado', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Lobby({ balance, telegramId, username, showAlert, haptic, onBalanceUpdate }: LobbyProps) {
  const now = useVzTime();

  // ── Estado principal ─────────────────────────────────────
  const [activeGame, setActiveGame]         = useState<'lotto' | 'granja'>('lotto');
  const [view, setView]                     = useState<'list' | 'bet' | 'ticket' | 'history'>('list');
  const [draws, setDraws]                   = useState<DrawSlot[]>([]);
  const [loadingDraws, setLoadingDraws]     = useState(true);
  const [selectedDraw, setSelectedDraw]     = useState<DrawSlot | null>(null);

  // ── Estado de selección de animales ─────────────────────
  const [selections, setSelections]         = useState<AnimalSelection[]>([]); // animales seleccionados
  const [editingAnimal, setEditingAnimal]   = useState<(typeof ANIMALS)[0] | null>(null);
  const [tempAmount, setTempAmount]         = useState<string>('100');
  const [drawLimits, setDrawLimits]         = useState<Record<string, { remaining: number; isFull: boolean }>>({});
  const [placingBet, setPlacingBet]         = useState(false);

  // ── Estado de tickets ───────────────────────────────────
  const [currentTicket, setCurrentTicket]  = useState<Ticket | null>(null);
  const [myTickets, setMyTickets]           = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const refreshRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Cargar sorteos ───────────────────────────────────────
  const loadDraws = useCallback(async () => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getDraws', game: activeGame }),
      });
      const data = await res.json();
      if (data.success) {
        setDraws(data.draws);
        // Actualizar selectedDraw si está abierta
        if (selectedDraw) {
          const updated = data.draws.find((d: DrawSlot) => d.drawId === selectedDraw.drawId);
          if (updated) setSelectedDraw(updated);
        }
      }
    } catch { /* ignorar */ }
    finally { setLoadingDraws(false); }
  }, [telegramId, activeGame, selectedDraw?.drawId]);

  useEffect(() => {
    setLoadingDraws(true);
    setDraws([]);
    loadDraws();
    clearInterval(refreshRef.current);
    refreshRef.current = setInterval(loadDraws, 30000);
    return () => clearInterval(refreshRef.current);
  }, [activeGame, telegramId]);

  // ── Cargar límites cuando se selecciona un sorteo ────────
  const loadLimits = useCallback(async (dId: string) => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getDrawLimits', drawId: dId }),
      });
      const data = await res.json();
      if (data.success) setDrawLimits(data.limits || {});
    } catch { /* ignorar */ }
  }, [telegramId]);

  // ── Cargar historial ─────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getMyTickets', limit: 20 }),
      });
      const data = await res.json();
      if (data.success) setMyTickets(data.tickets || []);
    } catch { /* ignorar */ }
    finally { setLoadingTickets(false); }
  }, [telegramId]);

  // ── Abrir vista de apuesta ───────────────────────────────
  const openBetView = (draw: DrawSlot) => {
    setSelectedDraw(draw);
    setSelections([]);
    setEditingAnimal(null);
    setTempAmount('100');
    loadLimits(draw.drawId);
    setView('bet');
    haptic('light');
  };

  // ── Seleccionar/deseleccionar animal ─────────────────────
  const toggleAnimal = (animal: (typeof ANIMALS)[0]) => {
    haptic('light');
    const existing = selections.find(s => s.animal.number === animal.number);
    if (existing) {
      // Si ya está, abre editor de monto
      setEditingAnimal(animal);
      setTempAmount(String(existing.amount));
    } else {
      // Nuevo animal — revisar límites
      const limit = drawLimits[animal.name];
      if (limit?.isFull) {
        showAlert(`⚠️ ${animal.emoji} ${animal.name}\n\nEste animal ya alcanzó el límite global de apuestas para este sorteo.`);
        return;
      }
      setEditingAnimal(animal);
      setTempAmount('100');
    }
  };

  // ── Confirmar monto para un animal ──────────────────────
  const confirmAnimalBet = () => {
    if (!editingAnimal) return;
    const amount = parseInt(tempAmount);

    if (isNaN(amount) || amount < BET_CONFIG.minBet) {
      showAlert(`⚠️ Monto mínimo: ${BET_CONFIG.minBet} 🥬`);
      return;
    }
    if (amount > BET_CONFIG.maxBetPerUser) {
      showAlert(`⚠️ Monto máximo por animal: ${BET_CONFIG.maxBetPerUser.toLocaleString()} 🥬`);
      return;
    }

    // Verificar límite global
    const limit = drawLimits[editingAnimal.name];
    if (limit && amount > limit.remaining) {
      showAlert(`⚠️ Solo quedan ${limit.remaining.toLocaleString()} 🥬 disponibles para ${editingAnimal.name} en este sorteo.`);
      return;
    }

    setSelections(prev => {
      const exists = prev.find(s => s.animal.number === editingAnimal.number);
      if (exists) return prev.map(s => s.animal.number === editingAnimal.number ? { ...s, amount } : s);
      return [...prev, { animal: editingAnimal, amount }];
    });
    setEditingAnimal(null);
    haptic('medium');
  };

  // ── Quitar animal de la selección ────────────────────────
  const removeAnimal = (number: number) => {
    setSelections(prev => prev.filter(s => s.animal.number !== number));
    if (editingAnimal?.number === number) setEditingAnimal(null);
    haptic('light');
  };

  const totalBet = selections.reduce((sum, s) => sum + s.amount, 0);
  const potentialPrize = Math.max(...selections.map(s => s.amount)) * BET_CONFIG.multiplier;

  // ── Confirmar y enviar ticket ───────────────────────────
  const handlePlaceBet = async () => {
    if (selections.length === 0) { showAlert('⚠️ Selecciona al menos un animalito.'); return; }
    if (!selectedDraw || selectedDraw.status !== 'open') {
      showAlert('⏰ Este sorteo ya cerró. Selecciona otro.'); return;
    }
    if (balance < totalBet) {
      showAlert(`⚠️ Saldo insuficiente.\nNecesitas: ${totalBet.toLocaleString()} 🥬\nTienes: ${balance.toLocaleString()} 🥬`);
      return;
    }

    haptic('medium');
    setPlacingBet(true);

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId, username, action: 'bet',
          drawId: selectedDraw.drawId,
          drawGame: activeGame,
          bets: selections.map(s => ({
            animal: s.animal.name,
            number: s.animal.number,
            amount: s.amount,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        haptic('heavy');
        onBalanceUpdate(data.newBalance);

        // Construir ticket local para mostrarlo de inmediato
        const localTicket: Ticket = {
          ticketId:   data.ticketId,
          drawId:     selectedDraw.drawId,
          drawGame:   activeGame,
          totalBet:   data.totalBet,
          betsCount:  data.betsPlaced,
          status:     'pending',
          totalPrize: null,
          createdAt:  new Date().toISOString(),
          bets: selections.slice(0, data.betsPlaced).map(s => ({
            animal: s.animal.name,
            number: s.animal.number,
            amount: s.amount,
            won:    null,
            prize:  null,
            status: 'pending',
          })),
        };

        setCurrentTicket(localTicket);
        setSelections([]);
        setView('ticket');

        if (data.warnings?.length) {
          setTimeout(() => showAlert('⚠️ Algunas apuestas omitidas:\n\n' + data.warnings.join('\n')), 500);
        }
      } else {
        showAlert('❌ ' + (data.error || 'Error al registrar apuesta'));
      }
    } catch {
      showAlert('❌ Error de conexión.');
    } finally {
      setPlacingBet(false);
    }
  };

  const gameInfo = GAMES.find(g => g.id === activeGame)!;
  const nextOpen = draws.find(d => d.status === 'open');
  const currentDrawing = draws.find(d => d.status === 'drawing');

  // ════════════════════════════════════════════════════════
  // VISTA: LISTA DE SORTEOS
  // ════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Hero */}
      <div className={`bg-gradient-to-r ${gameInfo.color} rounded-2xl p-5 text-center shadow-lg`}>
        <p className="text-4xl mb-1">{activeGame === 'lotto' ? '🎰' : '🐄'}</p>
        <h2 className="text-xl font-bold text-white">{gameInfo.name}</h2>
        <p className="text-sm text-white/70 mt-1">12 sorteos diarios · Premio x{BET_CONFIG.multiplier} · Resultados oficiales</p>

        {nextOpen && (
          <div className="mt-3 bg-black/20 rounded-xl p-3">
            <p className="text-xs text-white/60 mb-1">⏱ Próximo sorteo ({nextOpen.time}) cierra en:</p>
            <Countdown targetIso={nextOpen.closeTime} className="text-yellow-300 text-xl" />
          </div>
        )}
        {currentDrawing && !nextOpen && (
          <div className="mt-3 bg-orange-500/30 rounded-xl p-3 animate-pulse">
            <p className="text-white font-bold">🎰 Sorteando ahora — {currentDrawing.time}</p>
            <p className="text-white/70 text-xs">Resultado disponible en:</p>
            <Countdown targetIso={currentDrawing.resultTime} className="text-orange-200 text-lg" />
          </div>
        )}
      </div>

      {/* Selector de juego */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {GAMES.map(g => (
          <button key={g.id} onClick={() => { setActiveGame(g.id as any); haptic('light'); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeGame === g.id ? `${g.badge} text-white shadow` : 'text-gray-400 hover:text-white'
            }`}>
            {g.name}
          </button>
        ))}
      </div>

      {/* Historial */}
      <button onClick={() => { loadHistory(); setView('history'); haptic('light'); }}
        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 transition">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎫</span>
          <span className="text-sm font-semibold text-white">Mis Tickets</span>
        </div>
        <span className="text-gray-400 text-sm">Ver historial →</span>
      </button>

      {/* Lista de sorteos */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
          Sorteos de hoy — {now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {loadingDraws ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl animate-spin mb-2">⏳</div>
            Cargando sorteos...
          </div>
        ) : (
          <div className="space-y-2">
            {draws.map(draw => {
              const animalData = draw.winnerAnimal
                ? ANIMALS.find(a => a.name === draw.winnerAnimal) || { emoji: '🐾', name: draw.winnerAnimal }
                : null;
              const canBet = draw.status === 'open';

              return (
                <div key={draw.drawId}
                  onClick={() => canBet ? openBetView(draw) : undefined}
                  className={`flex items-center justify-between rounded-xl p-3.5 border transition-all ${
                    canBet
                      ? 'bg-white/8 border-white/15 hover:bg-white/15 cursor-pointer active:scale-[0.98]'
                      : draw.status === 'drawing'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-white/3 border-white/5 opacity-60'
                  }`}>
                  <div className="flex items-center gap-3">
                    {/* Icono / resultado */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${
                      canBet ? 'bg-green-500/20' :
                      draw.status === 'drawing' ? 'bg-orange-500/20 animate-pulse' :
                      draw.status === 'done' && animalData ? 'bg-white/10' : 'bg-white/5'
                    }`}>
                      {draw.status === 'done' && animalData ? animalData.emoji : '🕐'}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {draw.time} {parseInt(draw.time) < 12 ? 'AM' : 'PM'}
                      </p>
                      {canBet && (
                        <div className="text-xs text-green-400">
                          Cierra: <Countdown targetIso={draw.closeTime} className="text-green-300" />
                        </div>
                      )}
                      {draw.status === 'drawing' && (
                        <div className="text-xs text-orange-400">
                          Resultado en: <Countdown targetIso={draw.resultTime} className="text-orange-300" />
                        </div>
                      )}
                      {draw.status === 'done' && animalData && (
                        <p className="text-xs text-gray-400">{animalData.emoji} {draw.winnerAnimal} #{draw.winnerNumber}</p>
                      )}
                      {draw.status === 'done' && !draw.winnerAnimal && (
                        <p className="text-xs text-gray-500">Sin resultado aún</p>
                      )}
                      {draw.status === 'closed' && (
                        <p className="text-xs text-yellow-500">🔒 Apuestas cerradas</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={draw.status} />
                    {canBet && <span className="text-xs text-teal-400 font-bold">Apostar →</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-white/5 rounded-xl p-4 text-xs text-gray-400 grid grid-cols-2 gap-2">
        <div>🔒 Cierra 10 min antes</div>
        <div>📢 Resultado en 5 min</div>
        <div>🏆 Premio x{BET_CONFIG.multiplier}</div>
        <div>📡 Resultados oficiales</div>
        <div>💰 Mín: {BET_CONFIG.minBet}🥬</div>
        <div>💰 Máx: {BET_CONFIG.maxBetPerUser.toLocaleString()}🥬/animal</div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // VISTA: SELECCIONAR ANIMALES Y APOSTAR
  // ════════════════════════════════════════════════════════
  if (view === 'bet') return (
    <div className="flex flex-col gap-3 p-4 pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); setSelectedDraw(null); haptic('light'); }}
          className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white">{gameInfo.name}</h2>
          <p className="text-xs text-gray-400 truncate">Sorteo {selectedDraw?.time} · x{BET_CONFIG.multiplier}</p>
        </div>
        {selectedDraw && <StatusBadge status={selectedDraw.status} />}
      </div>

      {/* Cuenta regresiva */}
      {selectedDraw?.status === 'open' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">⏱ Las apuestas cierran en:</p>
          <Countdown targetIso={selectedDraw.closeTime} className="text-green-400 text-2xl" />
        </div>
      )}
      {selectedDraw?.status !== 'open' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-red-400 font-bold text-sm">🔒 Este sorteo ya cerró</p>
          <button onClick={() => { setView('list'); haptic('light'); }} className="text-xs text-gray-400 underline mt-1">
            Volver a la lista
          </button>
        </div>
      )}

      {/* Editor de monto — modal inline */}
      {editingAnimal && (
        <div className="bg-gray-800 border border-teal-500/40 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{editingAnimal.emoji}</span>
            <div>
              <p className="font-bold text-white">{editingAnimal.name} #{editingAnimal.number}</p>
              <p className="text-xs text-gray-400">
                {drawLimits[editingAnimal.name]
                  ? `Disponible: ${drawLimits[editingAnimal.name].remaining.toLocaleString()} 🥬`
                  : `Máx global: ${BET_CONFIG.maxBetGlobal.toLocaleString()} 🥬`}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-2">Monto a apostar (🥬):</p>

          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {[50, 100, 250, 500, 1000].map(amt => (
              <button key={amt} onClick={() => setTempAmount(String(amt))}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  tempAmount === String(amt) ? 'bg-teal-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}>
                {amt >= 1000 ? '1K' : amt}
              </button>
            ))}
          </div>

          {/* Input manual */}
          <input
            type="number"
            min={BET_CONFIG.minBet}
            max={BET_CONFIG.maxBetPerUser}
            value={tempAmount}
            onChange={e => setTempAmount(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 mb-3"
            placeholder="Monto..."
          />

          {tempAmount && !isNaN(parseInt(tempAmount)) && (
            <p className="text-xs text-gray-400 text-center mb-3">
              Premio si ganas: <span className="text-green-400 font-bold">{(parseInt(tempAmount || '0') * BET_CONFIG.multiplier).toLocaleString()} 🥬</span>
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setEditingAnimal(null)}
              className="flex-1 py-2.5 bg-white/10 text-gray-300 rounded-xl text-sm font-semibold hover:bg-white/20 transition">
              Cancelar
            </button>
            <button onClick={confirmAnimalBet}
              className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-bold transition">
              {selections.find(s => s.animal.number === editingAnimal.number) ? '✏️ Actualizar' : '✅ Agregar'}
            </button>
          </div>
        </div>
      )}

      {/* Carrito de selecciones */}
      {selections.length > 0 && !editingAnimal && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">🎯 Tu apuesta</p>
            <p className="text-xs text-gray-400">{selections.length} animal{selections.length !== 1 ? 'es' : ''}</p>
          </div>

          <div className="space-y-2 mb-3">
            {selections.map(s => (
              <div key={s.animal.number} className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{s.animal.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.animal.name}</p>
                    <p className="text-xs text-green-400">Premio: {(s.amount * BET_CONFIG.multiplier).toLocaleString()} 🥬</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-yellow-400">{s.amount.toLocaleString()} 🥬</span>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => toggleAnimal(s.animal)}
                      className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/40">✏️</button>
                    <button onClick={() => removeAnimal(s.animal.number)}
                      className="w-6 h-6 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/40">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between text-sm mb-3">
            <span className="text-gray-400">Total a descontar:</span>
            <span className="font-bold text-white">{totalBet.toLocaleString()} 🥬</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-gray-400">Mayor premio posible:</span>
            <span className="font-bold text-green-400">{potentialPrize.toLocaleString()} 🥬</span>
          </div>

          <button onClick={handlePlaceBet}
            disabled={placingBet || selectedDraw?.status !== 'open'}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base shadow-lg transition-all">
            {placingBet ? '⏳ Registrando ticket...' : `🎫 Confirmar ticket — ${totalBet.toLocaleString()} 🥬`}
          </button>
        </div>
      )}

      {/* Grid de animales */}
      {!editingAnimal && (
        <>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            🐾 Elige uno o varios animalitos
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ANIMALS.map(animal => {
              const isSelected = selections.some(s => s.animal.number === animal.number);
              const limit = drawLimits[animal.name];
              const isFull = limit?.isFull;
              const selData = selections.find(s => s.animal.number === animal.number);

              return (
                <button key={animal.number}
                  onClick={() => !isFull ? toggleAnimal(animal) : showAlert(`❌ ${animal.name} ya no tiene cupo en este sorteo.`)}
                  className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                    isFull
                      ? 'bg-red-500/5 border-red-500/20 opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-teal-500/25 border-teal-500 shadow-lg shadow-teal-500/20 scale-105'
                      : 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-white/25 active:scale-95'
                  }`}>
                  {isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-teal-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold shadow">
                      ✓
                    </span>
                  )}
                  <span className="text-2xl leading-none">{animal.emoji}</span>
                  <span className="text-[9px] text-gray-300 mt-1 leading-tight text-center font-medium line-clamp-1">{animal.name}</span>
                  <span className="text-[8px] text-gray-500">#{animal.number}</span>
                  {isSelected && selData && (
                    <span className="text-[9px] text-yellow-400 font-bold mt-0.5">{selData.amount}🥬</span>
                  )}
                  {isFull && <span className="text-[8px] text-red-400">LLENO</span>}
                </button>
              );
            })}
          </div>

          {selections.length === 0 && (
            <p className="text-center text-xs text-gray-500 py-2">
              Toca un animalito para seleccionarlo. Puedes elegir varios.
            </p>
          )}
        </>
      )}

      {/* Balance */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 text-sm">
        <span className="text-gray-400">Tu saldo:</span>
        <span className="font-bold text-white">{balance.toLocaleString()} 🥬</span>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // VISTA: TICKET GENERADO
  // ════════════════════════════════════════════════════════
  if (view === 'ticket' && currentTicket) {
    const drawParts = currentTicket.drawId.split('-');
    const timeStr = drawParts[drawParts.length - 1];
    const timeFormatted = `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
    const gameName = currentTicket.drawGame === 'lotto' ? '🎰 Lotto Activo' : '🐄 La Granja';

    // Buscar resultado del sorteo
    const draw = draws.find(d => d.drawId === currentTicket.drawId);
    const hasResult = draw?.winnerAnimal;

    return (
      <div className="flex flex-col gap-4 p-4 pb-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); haptic('light'); }}
            className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20">
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-white">🎫 Ticket de Apuesta</h2>
            <p className="text-xs text-gray-400">{currentTicket.ticketId}</p>
          </div>
        </div>

        {/* Ticket card */}
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl border border-white/10 overflow-hidden shadow-xl">

          {/* Encabezado del ticket */}
          <div className={`p-4 text-center ${
            currentTicket.status === 'won'  ? 'bg-green-600/30' :
            currentTicket.status === 'lost' ? 'bg-red-600/20' :
            'bg-teal-500/20'
          }`}>
            <p className="text-xs text-gray-400 mb-1">{gameName}</p>
            <p className="text-2xl font-bold text-white">Sorteo {timeFormatted}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(currentTicket.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
            </p>
            {currentTicket.status === 'won' && (
              <div className="mt-2 text-green-400 font-bold text-lg animate-pulse">
                🎉 ¡GANASTE! +{currentTicket.totalPrize?.toLocaleString()} 🥬
              </div>
            )}
            {currentTicket.status === 'lost' && (
              <div className="mt-2 text-red-400 font-semibold">😔 No ganaste esta vez</div>
            )}
            {currentTicket.status === 'pending' && (
              <div className="mt-2 text-yellow-400 text-sm">⏳ Esperando resultado del sorteo...</div>
            )}
          </div>

          {/* Línea punteada */}
          <div className="flex items-center px-4 py-2">
            <div className="w-4 h-4 bg-gray-900 rounded-full -ml-6 border-r border-white/10" />
            <div className="flex-1 border-t border-dashed border-white/10 mx-2" />
            <div className="w-4 h-4 bg-gray-900 rounded-full -mr-6 border-l border-white/10" />
          </div>

          {/* Resultado del sorteo si existe */}
          {hasResult && draw && (
            <div className="mx-4 mb-3 bg-white/5 rounded-xl p-3 flex items-center gap-3">
              <span className="text-3xl">
                {ANIMALS.find(a => a.name === draw.winnerAnimal)?.emoji || '🐾'}
              </span>
              <div>
                <p className="text-xs text-gray-400">Animal ganador</p>
                <p className="font-bold text-white">{draw.winnerAnimal} #{draw.winnerNumber}</p>
              </div>
            </div>
          )}

          {/* Lista de apuestas del ticket */}
          <div className="px-4 pb-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Tus apuestas ({currentTicket.betsCount})
            </p>
            {currentTicket.bets.map((bet, i) => {
              const animalData = ANIMALS.find(a => a.name === bet.animal);
              const isWinner = bet.won === true;
              const isLoser  = bet.won === false;
              return (
                <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
                  isWinner ? 'bg-green-500/15 border-green-500/30' :
                  isLoser  ? 'bg-red-500/10 border-red-500/20' :
                             'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{animalData?.emoji || '🐾'}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{bet.animal}</p>
                      <p className="text-xs text-gray-400">#{bet.number || animalData?.number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{bet.amount.toLocaleString()} 🥬</p>
                    {isWinner && <p className="text-xs text-green-400 font-bold">+{bet.prize?.toLocaleString()} 🥬</p>}
                    {isLoser  && <p className="text-xs text-red-400">Perdiste</p>}
                    {bet.status === 'pending' && (
                      <p className="text-xs text-gray-500">Premio posible: {(bet.amount * BET_CONFIG.multiplier).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-sm text-gray-400">Total apostado:</span>
              <span className="font-bold text-white">{currentTicket.totalBet.toLocaleString()} 🥬</span>
            </div>
            {currentTicket.status === 'pending' && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Premio máximo posible:</span>
                <span className="font-bold text-green-400">
                  {(Math.max(...currentTicket.bets.map(b => b.amount)) * BET_CONFIG.multiplier).toLocaleString()} 🥬
                </span>
              </div>
            )}
          </div>

          {/* Footer ticket */}
          <div className="bg-black/20 px-4 py-3 text-center">
            <p className="text-[10px] text-gray-500 font-mono">{currentTicket.ticketId}</p>
            <p className="text-[10px] text-gray-600">Animalito Lotto · Red Testnet TON</p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <button onClick={() => { selectedDraw && openBetView(selectedDraw); }}
            className="flex-1 bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 rounded-xl text-sm transition">
            🎰 Apostar de nuevo
          </button>
          <button onClick={() => { loadHistory(); setView('history'); haptic('light'); }}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl text-sm transition">
            🎫 Ver todos
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // VISTA: HISTORIAL DE TICKETS
  // ════════════════════════════════════════════════════════
  if (view === 'history') return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); haptic('light'); }}
          className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20">
          ←
        </button>
        <div>
          <h2 className="text-base font-bold text-white">🎫 Mis Tickets</h2>
          <p className="text-xs text-gray-400">Historial de apuestas</p>
        </div>
        <button onClick={loadHistory} className="ml-auto text-xs text-teal-400 hover:text-teal-300">
          🔄 Actualizar
        </button>
      </div>

      {/* Stats rápidas */}
      {myTickets.length > 0 && (() => {
        const won    = myTickets.filter(t => t.status === 'won').length;
        const lost   = myTickets.filter(t => t.status === 'lost').length;
        const pending = myTickets.filter(t => t.status === 'pending').length;
        const totalPrize = myTickets.reduce((s, t) => s + (t.totalPrize || 0), 0);
        return (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '✅ Ganados', val: won, color: 'text-green-400' },
              { label: '❌ Perdidos', val: lost, color: 'text-red-400' },
              { label: '⏳ Pendientes', val: pending, color: 'text-yellow-400' },
              { label: '💰 Premio', val: `${totalPrize.toLocaleString()}🥬`, color: 'text-teal-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-2 text-center">
                <p className={`font-bold text-sm ${color}`}>{val}</p>
                <p className="text-[9px] text-gray-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Lista de tickets */}
      {loadingTickets ? (
        <div className="text-center py-10 text-gray-400">
          <div className="text-3xl animate-spin mb-2">⏳</div>Cargando tickets...
        </div>
      ) : myTickets.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p className="text-4xl mb-3">🎫</p>
          <p className="font-semibold">Aún no tienes tickets</p>
          <p className="text-xs mt-1">¡Haz tu primera apuesta!</p>
          <button onClick={() => setView('list')}
            className="mt-4 bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-bold">
            Ir a Jugar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {myTickets.map(ticket => {
            const drawParts = ticket.drawId.split('-');
            const timeStr   = drawParts[drawParts.length - 1];
            const timeFormatted = `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
            const gameName = ticket.drawGame === 'lotto' ? '🎰 Lotto' : '🐄 Granja';
            return (
              <div key={ticket.ticketId}
                onClick={() => { setCurrentTicket(ticket); setView('ticket'); haptic('light'); }}
                className={`rounded-2xl border p-4 cursor-pointer hover:opacity-90 transition ${
                  ticket.status === 'won'     ? 'bg-green-500/10 border-green-500/30' :
                  ticket.status === 'lost'    ? 'bg-red-500/10 border-red-500/20' :
                  ticket.status === 'pending' ? 'bg-white/5 border-white/10' :
                  'bg-white/3 border-white/5'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-white text-sm">{gameName} — {timeFormatted}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{ticket.ticketId}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                    ticket.status === 'won'     ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    ticket.status === 'lost'    ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    ticket.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {ticket.status === 'won' ? '🏆 Ganado' : ticket.status === 'lost' ? '❌ Perdido' : '⏳ Pendiente'}
                  </span>
                </div>

                {/* Animales del ticket */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ticket.bets.map((bet, i) => {
                    const a = ANIMALS.find(x => x.name === bet.animal);
                    return (
                      <span key={i} className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                        bet.won === true  ? 'bg-green-500/20 text-green-400' :
                        bet.won === false ? 'bg-red-500/10 text-red-400' :
                        'bg-white/10 text-gray-300'
                      }`}>
                        {a?.emoji} {bet.animal}
                        <span className="text-gray-500">·{bet.amount}</span>
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Total: <span className="text-white font-semibold">{ticket.totalBet.toLocaleString()} 🥬</span>
                  </span>
                  {ticket.status === 'won' && ticket.totalPrize && (
                    <span className="text-green-400 font-bold">+{ticket.totalPrize.toLocaleString()} 🥬</span>
                  )}
                  {ticket.status === 'pending' && (
                    <span className="text-gray-500">
                      {new Date(ticket.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return null;
}
