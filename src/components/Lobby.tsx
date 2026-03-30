import { useState, useEffect, useCallback, useRef } from 'react';

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

const GAMES = [
  { id: 'lotto',  name: '🎰 Lotto Activo', colorFrom: 'from-blue-600',  colorTo: 'to-blue-800',  badge: 'bg-blue-500'  },
  { id: 'granja', name: '🐄 La Granja',    colorFrom: 'from-green-600', colorTo: 'to-green-800', badge: 'bg-green-500' },
];

type DrawStatus = 'open' | 'closed' | 'drawing' | 'done';
type View = 'list' | 'bet' | 'ticket' | 'history';

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

interface Selection {
  animal: typeof ANIMALS[0];
  amount: number;
}

interface Bet {
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
  bets: Bet[];
  betsCount: number;
  totalBet: number;
  totalPrize: number | null;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
}

interface LobbyProps {
  balance: number;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate: (n: number) => void;
}

// ── Reloj Venezuela en tiempo real ───────────────────────────
function useVzNow() {
  const [now, setNow] = useState(() =>
    new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' })));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── Componente cuenta regresiva ───────────────────────────────
function Countdown({ targetIso, className = '' }: { targetIso: string; className?: string }) {
  const now = useVzNow();
  const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - now.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={`font-mono font-bold tabular-nums ${className}`}>
      {h > 0 ? `${p(h)}:` : ''}{p(m)}:{p(s)}
    </span>
  );
}

// ── Badge de estado ───────────────────────────────────────────
function StatusBadge({ status }: { status: DrawStatus }) {
  const map: Record<DrawStatus, { bg: string; text: string; label: string }> = {
    open:    { bg: 'bg-green-500/20',  text: 'text-green-400',  label: '✅ Abierto'   },
    closed:  { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '🔒 Cerrando'  },
    drawing: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '🎰 Sorteando' },
    done:    { bg: 'bg-gray-500/20',   text: 'text-gray-400',   label: '✔ Finalizado' },
  };
  const s = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border border-current ${s.bg} ${s.text} ${status === 'drawing' ? 'animate-pulse' : ''}`}>
      {s.label}
    </span>
  );
}

export default function Lobby({ balance, telegramId, username, showAlert, haptic, onBalanceUpdate }: LobbyProps) {
  const [activeGame, setActiveGame]   = useState<'lotto' | 'granja'>('lotto');
  const [draws, setDraws]             = useState<DrawSlot[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [view, setView]               = useState<View>('list');
  const [selectedDraw, setSelectedDraw] = useState<DrawSlot | null>(null);
  const [selections, setSelections]   = useState<Selection[]>([]);
  const [editingAnimal, setEditingAnimal] = useState<typeof ANIMALS[0] | null>(null);
  const [tempAmount, setTempAmount]   = useState('100');
  const [drawLimits, setDrawLimits]   = useState<Record<string, { remaining: number; isFull: boolean }>>({});
  const [placingBet, setPlacingBet]   = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [myTickets, setMyTickets]     = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const now = useVzNow();

  // ── Cargar sorteos ──────────────────────────────────────────
  const loadDraws = useCallback(async () => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getDraws', game: activeGame }),
      });
      const data = await res.json();
      if (data.success) setDraws(data.draws);
    } catch { /* ignorar */ } finally {
      setLoadingDraws(false);
    }
  }, [telegramId, activeGame]);

  useEffect(() => {
    setLoadingDraws(true);
    setDraws([]);
    loadDraws();
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(loadDraws, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadDraws]);

  // ── Cargar límites del sorteo seleccionado ──────────────────
  const loadLimits = useCallback(async (drawId: string) => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getDrawLimits', drawId }),
      });
      const data = await res.json();
      if (data.success) setDrawLimits(data.limits || {});
    } catch { /* ignorar */ }
  }, [telegramId]);

  // ── Cargar tickets del usuario ──────────────────────────────
  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getTickets' }),
      });
      const data = await res.json();
      if (data.success) setMyTickets(data.tickets || []);
    } catch { /* ignorar */ } finally {
      setLoadingTickets(false);
    }
  }, [telegramId]);

  // ── Abrir vista de apuesta ─────────────────────────────────
  const openBetView = (draw: DrawSlot) => {
    setSelectedDraw(draw);
    setSelections([]);
    setEditingAnimal(null);
    setTempAmount('100');
    setDrawLimits({});
    loadLimits(draw.drawId);
    setView('bet');
    haptic('light');
  };

  // ── Seleccionar/quitar animal ──────────────────────────────
  const toggleAnimal = (animal: typeof ANIMALS[0]) => {
    if (!selectedDraw || selectedDraw.status !== 'open') return;
    const limit = drawLimits[animal.name];
    if (limit?.isFull) { showAlert(`⚠️ El límite global de apuestas para ${animal.name} está lleno.`); return; }
    const exists = selections.find(s => s.animal.number === animal.number);
    if (exists) {
      setSelections(prev => prev.filter(s => s.animal.number !== animal.number));
    } else {
      setEditingAnimal(animal);
      setTempAmount('100');
    }
    haptic('light');
  };

  // ── Confirmar monto para animal ────────────────────────────
  const confirmAmount = () => {
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
    const limit = drawLimits[editingAnimal.name];
    if (limit && amount > limit.remaining) {
      showAlert(`⚠️ Solo quedan ${limit.remaining.toLocaleString()} 🥬 disponibles para ${editingAnimal.name}`);
      return;
    }
    setSelections(prev => {
      const existing = prev.find(s => s.animal.number === editingAnimal.number);
      if (existing) return prev.map(s => s.animal.number === editingAnimal.number ? { ...s, amount } : s);
      return [...prev, { animal: editingAnimal, amount }];
    });
    setEditingAnimal(null);
  };

  const totalBet = selections.reduce((s, x) => s + x.amount, 0);
  const potentialPrize = selections.reduce((s, x) => s + x.amount * BET_CONFIG.multiplier, 0);

  // ── Confirmar apuesta ──────────────────────────────────────
  const confirmBet = async () => {
    if (!selectedDraw || selections.length === 0) return;
    if (selectedDraw.status !== 'open') { showAlert('⏰ Este sorteo ya cerró.'); return; }
    if (balance < totalBet) { showAlert(`⚠️ Saldo insuficiente.\nTienes ${balance.toLocaleString()} 🥬`); return; }
    haptic('medium');
    setPlacingBet(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId, username, action: 'placeBet',
          drawId: selectedDraw.drawId,
          drawGame: activeGame,
          bets: selections.map(s => ({ animal: s.animal.name, number: s.animal.number, amount: s.amount })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        haptic('heavy');
        onBalanceUpdate(data.newBalance);
        setCurrentTicket(data.ticket);
        setView('ticket');
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

  // ════════════════════════════════════════════════════════════
  // VISTA: LISTA DE SORTEOS
  // ════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Hero */}
      <div className={`bg-gradient-to-r ${gameInfo.colorFrom} ${gameInfo.colorTo} rounded-2xl p-5 text-center shadow-lg`}>
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

      {/* Botón historial */}
      <button onClick={() => { loadTickets(); setView('history'); haptic('light'); }}
        className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition">
        <span className="text-sm font-semibold text-white">🎫 Mis Tickets</span>
        <span className="text-xs text-teal-400">Ver historial →</span>
      </button>

      {/* Lista de sorteos */}
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
          Sorteos de hoy — {now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {loadingDraws ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl animate-spin mb-2">⏳</p>
            <p>Cargando sorteos...</p>
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      canBet ? 'bg-green-500/20' :
                      draw.status === 'drawing' ? 'bg-orange-500/20 animate-pulse' : 'bg-gray-500/20'
                    }`}>
                      {draw.status === 'done' && animalData ? animalData.emoji : '🕐'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {draw.time} {parseInt(draw.time) < 12 ? 'AM' : 'PM'}
                      </p>
                      {canBet && <p className="text-xs text-green-400">Cierra: <Countdown targetIso={draw.closeTime} /></p>}
                      {draw.status === 'drawing' && <p className="text-xs text-orange-400">Resultado en: <Countdown targetIso={draw.resultTime} /></p>}
                      {draw.status === 'done' && animalData && (
                        <p className="text-xs text-gray-400">{animalData.emoji} {draw.winnerAnimal} #{draw.winnerNumber}</p>
                      )}
                      {draw.status === 'done' && !draw.winnerAnimal && (
                        <p className="text-xs text-gray-500">Sin resultado aún</p>
                      )}
                      {draw.status === 'closed' && <p className="text-xs text-yellow-400">🔒 Apuestas cerradas</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={draw.status} />
                    {canBet && <span className="text-xs text-teal-400 font-semibold">Apostar →</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: '🔒', text: 'Cierra 10 min antes' },
          { icon: '📢', text: 'Resultado en 5 min'  },
          { icon: '🏆', text: `Premio x${BET_CONFIG.multiplier}`  },
          { icon: '📡', text: 'Resultados oficiales' },
          { icon: '💰', text: `Mín: ${BET_CONFIG.minBet}🥬`  },
          { icon: '💎', text: `Máx: ${BET_CONFIG.maxBetPerUser.toLocaleString()}🥬` },
        ].map((item, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-2 text-center">
            <p className="text-base">{item.icon}</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-1">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: APUESTA
  // ════════════════════════════════════════════════════════════
  if (view === 'bet') return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); setSelectedDraw(null); setSelections([]); haptic('light'); }}
          className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20">
          ←
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{gameInfo.name}</h2>
          <p className="text-xs text-gray-400">Sorteo {selectedDraw?.time} · x{BET_CONFIG.multiplier}</p>
        </div>
        {selectedDraw && <StatusBadge status={selectedDraw.status} />}
      </div>

      {/* Cuenta regresiva */}
      {selectedDraw?.status === 'open' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">⏱ Las apuestas cierran en:</p>
          <Countdown targetIso={selectedDraw.closeTime} className="text-green-400 text-2xl" />
        </div>
      )}
      {selectedDraw?.status !== 'open' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-red-400 font-semibold">🔒 Este sorteo ya cerró</p>
        </div>
      )}

      {/* Editor de monto inline */}
      {editingAnimal && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{editingAnimal.emoji}</span>
            <div>
              <p className="font-bold text-white">{editingAnimal.name} #{editingAnimal.number}</p>
              <p className="text-xs text-gray-400">
                {drawLimits[editingAnimal.name]
                  ? `Disponible globalmente: ${drawLimits[editingAnimal.name].remaining.toLocaleString()} 🥬`
                  : `Máx global: ${BET_CONFIG.maxBetGlobal.toLocaleString()} 🥬`}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-2">Monto a apostar (🥬):</p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {[50, 100, 250, 500, 1000].map(amt => (
              <button key={amt} onClick={() => setTempAmount(String(amt))}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  tempAmount === String(amt) ? 'bg-teal-500 text-white' : 'bg-white/10 text-gray-300'
                }`}>
                {amt}
              </button>
            ))}
          </div>

          <input
            type="number" min={BET_CONFIG.minBet} max={BET_CONFIG.maxBetPerUser}
            value={tempAmount}
            onChange={e => setTempAmount(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 mb-3"
            placeholder="Monto..."
          />

          {tempAmount && !isNaN(parseInt(tempAmount)) && (
            <p className="text-xs text-green-400 text-center mb-3">
              Premio si ganas: {(parseInt(tempAmount || '0') * BET_CONFIG.multiplier).toLocaleString()} 🥬
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setEditingAnimal(null)}
              className="flex-1 bg-white/10 text-gray-300 py-2.5 rounded-xl text-sm font-semibold">
              Cancelar
            </button>
            <button onClick={confirmAmount}
              className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-2.5 rounded-xl text-sm font-bold">
              ✅ Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Carrito de selecciones */}
      {selections.length > 0 && !editingAnimal && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">🎯 Tu apuesta</p>
            <p className="text-xs text-gray-400">{selections.length} animal{selections.length !== 1 ? 'es' : ''}</p>
          </div>

          <div className="space-y-2 mb-3">
            {selections.map(s => (
              <div key={s.animal.number} className="flex items-center gap-2">
                <span className="text-xl">{s.animal.emoji}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">{s.animal.name}</p>
                  <p className="text-xs text-gray-400">Premio: {(s.amount * BET_CONFIG.multiplier).toLocaleString()} 🥬</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-teal-400">{s.amount.toLocaleString()} 🥬</span>
                  <button onClick={() => { setEditingAnimal(s.animal); setTempAmount(String(s.amount)); }}
                    className="text-xs bg-white/10 px-2 py-1 rounded-lg text-gray-300">✏️</button>
                  <button onClick={() => setSelections(prev => prev.filter(x => x.animal.number !== s.animal.number))}
                    className="text-xs bg-red-500/20 px-2 py-1 rounded-lg text-red-400">✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-2 flex justify-between text-xs">
            <span className="text-gray-400">Total a descontar:</span>
            <span className="font-bold text-white">{totalBet.toLocaleString()} 🥬</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-400">Mayor premio posible:</span>
            <span className="font-bold text-green-400">{potentialPrize.toLocaleString()} 🥬</span>
          </div>

          <button onClick={confirmBet} disabled={placingBet || selectedDraw?.status !== 'open'}
            className="mt-3 w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all">
            {placingBet ? '⏳ Registrando...' : `🎯 Confirmar apuesta — ${totalBet.toLocaleString()} 🥬`}
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
              return (
                <button key={animal.number}
                  onClick={() => toggleAnimal(animal)}
                  disabled={isFull && !isSelected || selectedDraw?.status !== 'open'}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    isFull && !isSelected
                      ? 'bg-red-500/10 border-red-500/20 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-teal-500/30 border-teal-500 scale-105 shadow-lg shadow-teal-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/15'
                  }`}>
                  <span className="text-2xl leading-none">{animal.emoji}</span>
                  <span className="text-[9px] text-gray-300 mt-1 text-center font-medium leading-tight">{animal.name}</span>
                  <span className="text-[8px] text-gray-500">#{animal.number}</span>
                  {isFull && <span className="text-[8px] text-red-400 mt-0.5">LLENO</span>}
                  {isSelected && !isFull && (
                    <span className="text-[8px] text-teal-300">
                      {selections.find(s => s.animal.number === animal.number)?.amount}🥬
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selections.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              Toca un animalito para seleccionarlo. Puedes elegir varios.
            </p>
          )}
        </>
      )}

      {/* Balance */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
        <span className="text-sm text-gray-400">Tu saldo:</span>
        <span className="font-bold text-white">{balance.toLocaleString()} 🥬</span>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: TICKET
  // ════════════════════════════════════════════════════════════
  if (view === 'ticket' && currentTicket) {
    const drawParts = currentTicket.drawId.split('-');
    const timeStr = drawParts[drawParts.length - 1];
    const timeFormatted = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
    const gameName = currentTicket.drawGame === 'lotto' ? '🎰 Lotto Activo' : '🐄 La Granja';
    const draw = draws.find(d => d.drawId === currentTicket.drawId);
    const hasResult = draw?.winnerAnimal != null;

    return (
      <div className="flex flex-col gap-4 p-4 pb-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')}
            className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
          <div>
            <p className="text-sm font-bold text-white">🎫 Ticket de Apuesta</p>
            <p className="text-xs text-gray-400 font-mono">{currentTicket.ticketId}</p>
          </div>
        </div>

        {/* Ticket card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">

          {/* Cabecera */}
          <div className={`p-4 text-center ${
            currentTicket.status === 'won' ? 'bg-green-500/20' :
            currentTicket.status === 'lost' ? 'bg-red-500/10' : 'bg-blue-500/10'
          }`}>
            <p className="font-bold text-white">{gameName}</p>
            <p className="text-2xl font-bold text-teal-400">Sorteo {timeFormatted}</p>
            <p className="text-xs text-gray-400">
              {new Date(currentTicket.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
            </p>
            {currentTicket.status === 'won' && (
              <p className="text-green-400 font-bold text-lg mt-2">🎉 ¡GANASTE! +{currentTicket.totalPrize?.toLocaleString()} 🥬</p>
            )}
            {currentTicket.status === 'lost' && (
              <p className="text-red-400 font-semibold mt-2">😔 No ganaste esta vez</p>
            )}
            {currentTicket.status === 'pending' && (
              <p className="text-yellow-400 mt-2">⏳ Esperando resultado del sorteo...</p>
            )}
          </div>

          {/* Línea punteada */}
          <div className="flex items-center px-4 py-2">
            <div className="flex-1 border-t-2 border-dashed border-white/10" />
            <span className="mx-2 text-gray-600 text-xs">✂</span>
            <div className="flex-1 border-t-2 border-dashed border-white/10" />
          </div>

          {/* Resultado del sorteo */}
          {hasResult && draw && (
            <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-3">
              <span className="text-3xl">{ANIMALS.find(a => a.name === draw.winnerAnimal)?.emoji || '🐾'}</span>
              <div>
                <p className="text-xs text-gray-400">Animal ganador</p>
                <p className="font-bold text-white">{draw.winnerAnimal} #{draw.winnerNumber}</p>
              </div>
            </div>
          )}

          {/* Lista de apuestas */}
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-400 font-semibold mb-2">Tus apuestas ({currentTicket.betsCount})</p>
            <div className="space-y-2">
              {currentTicket.bets.map((bet, i) => {
                const animalData = ANIMALS.find(a => a.name === bet.animal);
                return (
                  <div key={i} className={`flex items-center justify-between rounded-xl p-2.5 ${
                    bet.won === true ? 'bg-green-500/15' :
                    bet.won === false ? 'bg-red-500/10' : 'bg-white/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{animalData?.emoji || '🐾'}</span>
                      <div>
                        <p className="text-xs font-semibold text-white">{bet.animal}</p>
                        <p className="text-[10px] text-gray-500">#{animalData?.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-white">{bet.amount.toLocaleString()} 🥬</p>
                      {bet.won === true && <p className="text-xs text-green-400">+{bet.prize?.toLocaleString()} 🥬</p>}
                      {bet.won === false && <p className="text-xs text-red-400">Perdiste</p>}
                      {bet.status === 'pending' && <p className="text-[10px] text-gray-500">≈{(bet.amount * BET_CONFIG.multiplier).toLocaleString()}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total apostado:</span>
                <span className="font-bold text-white">{currentTicket.totalBet.toLocaleString()} 🥬</span>
              </div>
              {currentTicket.status === 'pending' && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Premio máximo posible:</span>
                  <span className="font-bold text-green-400">
                    {(Math.max(...currentTicket.bets.map(b => b.amount)) * BET_CONFIG.multiplier).toLocaleString()} 🥬
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer ticket */}
          <div className="bg-white/3 px-4 py-3 text-center">
            <p className="text-[10px] font-mono text-gray-500">{currentTicket.ticketId}</p>
            <p className="text-[10px] text-gray-600">Animalito Lotto · Red Testnet TON</p>
          </div>
        </div>

        {/* Botones */}
        <button onClick={() => setView('list')}
          className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl transition">
          ← Volver a sorteos
        </button>
        <button onClick={() => { loadTickets(); setView('history'); }}
          className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition">
          🎫 Ver todos mis tickets
        </button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // VISTA: HISTORIAL
  // ════════════════════════════════════════════════════════════
  if (view === 'history') return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')}
          className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
        <div>
          <p className="text-lg font-bold text-white">🎫 Mis Tickets</p>
          <p className="text-xs text-gray-400">Historial de apuestas</p>
        </div>
      </div>

      {/* Stats */}
      {myTickets.length > 0 && (() => {
        const won     = myTickets.filter(t => t.status === 'won').length;
        const lost    = myTickets.filter(t => t.status === 'lost').length;
        const pending = myTickets.filter(t => t.status === 'pending').length;
        const totalPrize = myTickets.reduce((s, t) => s + (t.totalPrize || 0), 0);
        return (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '✅ Ganados',   val: won,                            color: 'text-green-400'  },
              { label: '❌ Perdidos',  val: lost,                           color: 'text-red-400'    },
              { label: '⏳ Pendientes', val: pending,                       color: 'text-yellow-400' },
              { label: '💰 Premios',   val: `${totalPrize.toLocaleString()}🥬`, color: 'text-teal-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-2 text-center">
                <p className={`text-base font-bold ${color}`}>{val}</p>
                <p className="text-[9px] text-gray-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Lista de tickets */}
      {loadingTickets ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl animate-spin mb-2">⏳</p>
          <p className="text-sm">Cargando tickets...</p>
        </div>
      ) : myTickets.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">🎫</p>
          <p className="text-white font-semibold">Aún no tienes tickets</p>
          <p className="text-gray-400 text-sm">¡Haz tu primera apuesta!</p>
          <button onClick={() => setView('list')}
            className="mt-4 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold">
            Ir a jugar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {myTickets.map(ticket => {
            const parts = ticket.drawId.split('-');
            const timeStr = parts[parts.length - 1];
            const timeFormatted = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
            const gameName = ticket.drawGame === 'lotto' ? '🎰 Lotto' : '🐄 Granja';
            return (
              <div key={ticket.ticketId}
                onClick={() => { setCurrentTicket(ticket); setView('ticket'); haptic('light'); }}
                className={`rounded-2xl border p-4 cursor-pointer hover:opacity-90 transition ${
                  ticket.status === 'won'  ? 'bg-green-500/10 border-green-500/30' :
                  ticket.status === 'lost' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{gameName} — {timeFormatted}</p>
                    <p className="text-xs text-gray-500 font-mono">{ticket.ticketId}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    ticket.status === 'won'  ? 'bg-green-500/20 text-green-400' :
                    ticket.status === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {ticket.status === 'won' ? '🏆 Ganado' : ticket.status === 'lost' ? '❌ Perdido' : '⏳ Pendiente'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ticket.bets.map((bet, i) => {
                    const a = ANIMALS.find(x => x.name === bet.animal);
                    return (
                      <span key={i} className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300">
                        {a?.emoji} {bet.animal} · {bet.amount}🥬
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Total: {ticket.totalBet.toLocaleString()} 🥬</span>
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
