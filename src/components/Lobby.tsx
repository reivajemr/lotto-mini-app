import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCall } from '../App';

interface LobbyProps {
  telegramId: string;
  username: string;
  balance: number;
  onBalanceUpdate: (b: number) => void;
  showAlert: (msg: string) => void;
  haptic: (t?: 'light' | 'medium' | 'heavy') => void;
}

const BET_CONFIG = { minBet: 50, maxBetPerUser: 1000, maxBetGlobal: 10000, multiplier: 30 };

interface AnimalDef { number: number; name: string; emoji: string; }
interface Draw {
  drawId: string; time: string; game: string; status: string;
  closeTime: string; drawTime: string; resultTime: string;
  date: string; winnerNumber?: number; winnerAnimal?: string;
}
interface BetSelection { animal: AnimalDef; amount: number; }
interface TicketBet { animal: string; number: number; amount: number; won: boolean | null; prize: number | null; status: string; }
interface Ticket {
  ticketId: string; telegramId: string; drawId: string; drawGame: string;
  bets: TicketBet[]; totalBet: number; betsCount: number; status: string;
  totalPrize: number; createdAt: string;
}
interface WeekDay { date: string; results: Array<{ drawId: string; winnerNumber: number; winnerAnimal: string; time?: string }>; }

const GAMES = [
  { id: 'lotto', name: '🎰 Lotto Activo', desc: '12 sorteos diarios, resultados oficiales', color: 'from-teal-500 to-emerald-500' },
  { id: 'flash', name: '⚡ Flash Lotto', desc: 'Sorteos cada 5 min, aleatorio', color: 'from-yellow-500 to-orange-500' },
];

const ANIMALS: AnimalDef[] = [
  { number:1,  name:'Carnero',    emoji:'🐏' }, { number:2,  name:'Toro',       emoji:'🐂' },
  { number:3,  name:'Ciempiés',   emoji:'🐛' }, { number:4,  name:'Alacrán',    emoji:'🦂' },
  { number:5,  name:'León',       emoji:'🦁' }, { number:6,  name:'Rana',       emoji:'🐸' },
  { number:7,  name:'Perico',     emoji:'🦜' }, { number:8,  name:'Ratón',      emoji:'🐭' },
  { number:9,  name:'Águila',     emoji:'🦅' }, { number:10, name:'Tigre',      emoji:'🐯' },
  { number:11, name:'Gato',       emoji:'🐱' }, { number:12, name:'Caballo',    emoji:'🐴' },
  { number:13, name:'Mono',       emoji:'🐒' }, { number:14, name:'Paloma',     emoji:'🕊️' },
  { number:15, name:'Zorro',      emoji:'🦊' }, { number:16, name:'Oso',        emoji:'🐻' },
  { number:17, name:'Pavo',       emoji:'🦃' }, { number:18, name:'Burro',      emoji:'🫏' },
  { number:19, name:'Chivo',      emoji:'🐐' }, { number:20, name:'Cochino',    emoji:'🐷' },
  { number:21, name:'Gallo',      emoji:'🐓' }, { number:22, name:'Camello',    emoji:'🐪' },
  { number:23, name:'Zebra',      emoji:'🦓' }, { number:24, name:'Iguana',     emoji:'🦎' },
  { number:25, name:'Gavilán',    emoji:'🦅' }, { number:26, name:'Murciélago', emoji:'🦇' },
  { number:27, name:'Perro',      emoji:'🐶' }, { number:28, name:'Venado',     emoji:'🦌' },
  { number:29, name:'Morrocoy',   emoji:'🐢' }, { number:30, name:'Caimán',     emoji:'🐊' },
  { number:31, name:'Anteater',   emoji:'🐜' }, { number:32, name:'Serpiente',  emoji:'🐍' },
  { number:33, name:'Lechuza',    emoji:'🦉' }, { number:34, name:'Loro',       emoji:'🦜' },
  { number:35, name:'Jirafa',     emoji:'🦒' }, { number:36, name:'Culebra',    emoji:'🐍' },
  { number:0,  name:'Ballena',    emoji:'🐋' },
];

// ── Countdown hook ──────────────────────────────────────────
function useCountdown(targetISO: string | null): string {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    if (!targetISO) { setTxt(''); return; }
    const tick = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setTxt('00:00'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTxt(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [targetISO]);
  return txt;
}

// ── Formatear fecha VZ ──────────────────────────────────────
function vzDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return vzDateStr(d);
}
function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' });
}

type ViewType = 'list' | 'bet' | 'ticket' | 'history' | 'week';

export default function Lobby({ telegramId, username, balance, onBalanceUpdate, showAlert, haptic }: LobbyProps) {
  const [activeGame, setActiveGame] = useState<'lotto' | 'flash'>('lotto');
  const [view, setView] = useState<ViewType>('list');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [editingAnimal, setEditingAnimal] = useState<AnimalDef | null>(null);
  const [tempAmount, setTempAmount] = useState('');
  const [drawLimitsMap, setDrawLimitsMap] = useState<Record<string, { remaining: number; isFull: boolean }>>({});
  const [placingBet, setPlacingBet] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [weekHistory, setWeekHistory] = useState<WeekDay[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  // Navegación de fechas (para sorteos futuros/pasados)
  const todayStr = vzDateStr(vzNow());
  const [currentDate, setCurrentDate] = useState(todayStr);
  const maxFutureDays = 3; // cuántos días en el futuro se pueden ver

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gameInfo = GAMES.find(g => g.id === activeGame) || GAMES[0];
  const nextOpenDraw = draws.find(d => d.status === 'open');
  const currentDrawing = draws.find(d => d.status === 'drawing');
  const countdown = useCountdown(nextOpenDraw?.closeTime || null);
  const drawingCountdown = useCountdown(currentDrawing?.resultTime || null);

  // ── Cargar sorteos ─────────────────────────────────────────
  const loadDraws = useCallback(async (date?: string) => {
    try {
      const data = await apiCall({
        telegramId,
        action: 'getDraws',
        game: activeGame,
        date: date || currentDate,
      }) as { success?: boolean; draws?: Draw[] };
      if (data?.success && data.draws) setDraws(data.draws);
    } catch (err) {
      console.error('Error cargando sorteos:', err);
    } finally {
      setLoadingDraws(false);
    }
  }, [telegramId, activeGame, currentDate]);

  useEffect(() => {
    setLoadingDraws(true);
    loadDraws();
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => loadDraws(), activeGame === 'flash' ? 15000 : 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadDraws]);

  // ── Cambiar fecha ──────────────────────────────────────────
  const changeDate = (direction: -1 | 1) => {
    haptic('light');
    const newDate = addDays(currentDate, direction);
    const minDate = addDays(todayStr, -30);
    const maxDate = addDays(todayStr, maxFutureDays);
    if (newDate < minDate || newDate > maxDate) return;
    setCurrentDate(newDate);
    setLoadingDraws(true);
    loadDraws(newDate);
  };

  // ── Abrir sorteo ───────────────────────────────────────────
  const openBetView = async (draw: Draw) => {
    if (draw.status !== 'open' && draw.status !== 'upcoming') {
      if (draw.status === 'upcoming') {
        showAlert('⏳ Este sorteo aún no está abierto. Las apuestas se habilitan 30 min antes para Lotto Activo.');
        return;
      }
      return;
    }
    haptic('medium');
    setSelectedDraw(draw);
    setSelections([]);
    setEditingAnimal(null);
    setView('bet');
    try {
      const data = await apiCall({ telegramId, action: 'getDrawLimits', drawId: draw.drawId }) as {
        success?: boolean; limits?: Record<string, { remaining: number; isFull: boolean }>;
      };
      if (data?.success && data.limits) setDrawLimitsMap(data.limits);
    } catch { /* ignorar */ }
  };

  // ── Seleccionar animal ─────────────────────────────────────
  const toggleAnimal = (animal: AnimalDef) => {
    haptic('light');
    const existing = selections.find(s => s.animal.number === animal.number);
    if (existing) {
      setSelections(prev => prev.filter(s => s.animal.number !== animal.number));
    } else {
      setEditingAnimal(animal);
      setTempAmount('');
    }
  };

  const confirmAmount = () => {
    if (!editingAnimal) return;
    const amount = parseInt(tempAmount);
    if (isNaN(amount) || amount < BET_CONFIG.minBet) {
      showAlert(`⚠️ Monto mínimo: ${BET_CONFIG.minBet} 🥬`); return;
    }
    if (amount > BET_CONFIG.maxBetPerUser) {
      showAlert(`⚠️ Monto máximo: ${BET_CONFIG.maxBetPerUser.toLocaleString()} 🥬`); return;
    }
    haptic('medium');
    setSelections(prev => {
      const ex = prev.find(s => s.animal.number === editingAnimal.number);
      return ex ? prev.map(s => s.animal.number === editingAnimal.number ? { ...s, amount } : s)
                : [...prev, { animal: editingAnimal, amount }];
    });
    setEditingAnimal(null);
    setTempAmount('');
  };

  // ── Colocar apuesta ────────────────────────────────────────
  const placeBet = async () => {
    if (!selectedDraw || selections.length === 0 || placingBet) return;
    const totalBet = selections.reduce((s, sel) => s + sel.amount, 0);
    if (totalBet > balance) {
      showAlert(`⚠️ Saldo insuficiente.\nNecesitas ${totalBet.toLocaleString()} 🥬`); return;
    }
    haptic('heavy');
    setPlacingBet(true);
    try {
      const data = await apiCall({
        telegramId, username, action: 'placeBet',
        drawId: selectedDraw.drawId,
        drawGame: activeGame,
        bets: selections.map(s => ({ animal: s.animal.name, number: s.animal.number, amount: s.amount })),
      }) as { success?: boolean; ticket?: Ticket; newBalance?: number; error?: string };
      if (data?.success && data.ticket) {
        onBalanceUpdate(data.newBalance ?? balance - totalBet);
        setCurrentTicket(data.ticket);
        setView('ticket');
        haptic('heavy');
      } else {
        showAlert('❌ ' + (data?.error || 'Error al procesar apuesta'));
      }
    } catch (err) {
      showAlert('❌ ' + (err instanceof Error ? err.message : 'Error de conexión'));
    } finally {
      setPlacingBet(false);
    }
  };

  // ── Cargar mis tickets ─────────────────────────────────────
  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const data = await apiCall({ telegramId, action: 'getTickets', game: activeGame }) as {
        success?: boolean; tickets?: Ticket[];
      };
      if (data?.success && data.tickets) setMyTickets(data.tickets);
    } catch { /* ignorar */ }
    finally { setLoadingTickets(false); }
  }, [telegramId, activeGame]);

  // ── Cargar historial semanal ───────────────────────────────
  const loadWeekHistory = useCallback(async () => {
    setLoadingWeek(true);
    try {
      const data = await apiCall({ telegramId, action: 'getWeekHistory', game: activeGame }) as {
        success?: boolean; history?: WeekDay[];
      };
      if (data?.success && data.history) setWeekHistory(data.history);
    } catch { /* ignorar */ }
    finally { setLoadingWeek(false); }
  }, [telegramId, activeGame]);

  const totalBet = selections.reduce((s, sel) => s + sel.amount, 0);
  const potentialPrize = selections.length > 0
    ? Math.max(...selections.map(s => s.amount)) * BET_CONFIG.multiplier : 0;

  const isToday = currentDate === todayStr;
  const isFuture = currentDate > todayStr;
  const canGoPrev = currentDate > addDays(todayStr, -30);
  const canGoNext = currentDate < addDays(todayStr, maxFutureDays);

  // ════════════════════════════════════════════════════════════
  // VISTA: LISTA DE SORTEOS
  // ════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="p-4 space-y-4 pb-24">

      {/* Selector de juego */}
      <div className="grid grid-cols-2 gap-2">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => { haptic('medium'); setActiveGame(g.id as any); setCurrentDate(todayStr); }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeGame === g.id
                ? `bg-gradient-to-r ${g.color} bg-opacity-20 border-white/30`
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <p className="text-white font-bold text-sm">{g.name}</p>
            <p className="text-white/50 text-[10px] mt-0.5">{g.desc}</p>
          </button>
        ))}
      </div>

      {/* Hero con estado */}
      <div className={`bg-gradient-to-r ${gameInfo.color} bg-opacity-20 border border-white/20 rounded-2xl p-4 text-center`}
        style={{ background: activeGame === 'flash'
          ? 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(249,115,22,0.15))'
          : 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(16,185,129,0.15))' }}>
        <p className="text-4xl mb-1">{activeGame === 'flash' ? '⚡' : '🎰'}</p>
        <h2 className="text-white font-black text-lg">{gameInfo.name}</h2>
        {nextOpenDraw && isToday && (
          <div className="mt-2 bg-black/20 rounded-lg px-3 py-1.5">
            <p className="text-white/70 text-xs">⏱ Cierra en: <span className="text-yellow-400 font-bold text-sm">{countdown}</span></p>
          </div>
        )}
        {currentDrawing && isToday && !nextOpenDraw && (
          <div className="mt-2 bg-black/20 rounded-lg px-3 py-1.5">
            <p className="text-white/70 text-xs">🎰 Sorteando · Resultado en: <span className="text-orange-400 font-bold text-sm">{drawingCountdown}</span></p>
          </div>
        )}
        {isFuture && (
          <div className="mt-2 bg-black/20 rounded-lg px-3 py-1.5">
            <p className="text-yellow-300 text-xs">📅 Puedes apostar a sorteos futuros</p>
          </div>
        )}
      </div>

      {/* Navegador de fechas */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeDate(-1)}
          disabled={!canGoPrev}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
            canGoPrev ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/3 text-white/20 cursor-not-allowed'
          }`}
        >‹</button>
        <div className="flex-1 text-center bg-white/5 border border-white/10 rounded-xl py-2">
          <p className="text-white font-semibold text-sm">
            {isToday ? '📅 Hoy' : isFuture ? `📆 ${formatDate(currentDate)}` : `📋 ${formatDate(currentDate)}`}
          </p>
          <p className="text-white/40 text-xs">{currentDate}</p>
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={!canGoNext}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
            canGoNext ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/3 text-white/20 cursor-not-allowed'
          }`}
        >›</button>
      </div>

      {/* Botones historial */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { haptic('light'); loadTickets(); setView('history'); }}
          className="bg-white/5 border border-white/10 rounded-xl py-2.5 text-white/70 text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all"
        >
          🎫 Mis tickets
        </button>
        <button
          onClick={() => { haptic('light'); loadWeekHistory(); setView('week'); }}
          className="bg-white/5 border border-white/10 rounded-xl py-2.5 text-white/70 text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all"
        >
          📊 Semana pasada
        </button>
      </div>

      {/* Lista de sorteos */}
      <div className="space-y-2">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
          {activeGame === 'flash' ? 'Sorteos Flash (cada 5 min)' : 'Sorteos del día'}
          {' — '}{formatDate(currentDate)}
        </p>

        {loadingDraws ? (
          <div className="text-center py-8 text-white/50">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-sm">Cargando sorteos...</p>
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <p className="text-2xl mb-2">🕐</p>
            <p className="text-sm">No hay sorteos para este día</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {draws.map(draw => {
              const animalData = draw.winnerAnimal
                ? ANIMALS.find(a => a.name === draw.winnerAnimal) || { emoji: '🐾', name: draw.winnerAnimal }
                : null;
              const canBet = draw.status === 'open' || (draw.status === 'upcoming' && isFuture);

              return (
                <div
                  key={draw.drawId}
                  onClick={() => canBet ? openBetView(draw) : undefined}
                  className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                    canBet
                      ? 'bg-white/8 border-white/15 hover:bg-white/15 cursor-pointer active:scale-[0.98]'
                      : draw.status === 'drawing'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : draw.status === 'done' && draw.winnerAnimal
                      ? 'bg-green-500/5 border-green-500/10 opacity-80'
                      : draw.status === 'upcoming'
                      ? 'bg-blue-500/5 border-blue-500/10'
                      : 'bg-white/3 border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      draw.status === 'done' ? 'bg-green-500/20' :
                      draw.status === 'drawing' ? 'bg-orange-500/20 animate-pulse' :
                      canBet ? 'bg-teal-500/20' : 'bg-white/5'
                    }`}>
                      {draw.status === 'done' && animalData ? animalData.emoji :
                       draw.status === 'drawing' ? '🎰' :
                       canBet ? '🎯' : '🔒'}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{draw.time}</p>
                      {draw.status === 'done' && animalData ? (
                        <p className="text-green-400 text-xs">{animalData.emoji} {draw.winnerAnimal} #{draw.winnerNumber}</p>
                      ) : draw.status === 'drawing' ? (
                        <p className="text-orange-400 text-xs animate-pulse">🎰 Sorteando...</p>
                      ) : canBet ? (
                        <DrawCloseCountdown closeTime={draw.closeTime} />
                      ) : draw.status === 'done' ? (
                        <p className="text-white/30 text-xs">Sin resultado aún</p>
                      ) : draw.status === 'upcoming' ? (
                        <p className="text-blue-400 text-xs">📅 Próximo</p>
                      ) : (
                        <p className="text-white/30 text-xs">🔒 Cerrado</p>
                      )}
                    </div>
                  </div>
                  {canBet && (
                    <div className="bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      Apostar →
                    </div>
                  )}
                  {draw.status === 'drawing' && (
                    <div className="bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-lg">
                      🎰
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info del juego */}
      {(() => {
        const items = activeGame === 'flash' ? [
          { icon: '⚡', text: 'Cada 5 min' },
          { icon: '🔒', text: 'Cierra 2 min antes' },
          { icon: '🏆', text: `Premio x${BET_CONFIG.multiplier}` },
          { icon: '🎲', text: 'Aleatorio' },
          { icon: '💰', text: `Mín: ${BET_CONFIG.minBet}🥬` },
          { icon: '💎', text: `Máx: ${BET_CONFIG.maxBetPerUser}🥬` },
        ] : [
          { icon: '🔒', text: 'Cierra 10 min antes' },
          { icon: '📢', text: 'Resultado en 5 min' },
          { icon: '🏆', text: `Premio x${BET_CONFIG.multiplier}` },
          { icon: '📡', text: 'Resultados oficiales' },
          { icon: '💰', text: `Mín: ${BET_CONFIG.minBet}🥬` },
          { icon: '💎', text: `Máx: ${BET_CONFIG.maxBetPerUser}🥬` },
        ];
        return (
          <div className="grid grid-cols-3 gap-2">
            {items.map((item, i) => (
              <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-2 text-center">
                <p className="text-lg">{item.icon}</p>
                <p className="text-white/50 text-[10px] mt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: APUESTA
  // ════════════════════════════════════════════════════════════
  if (view === 'bet') return (
    <div className="p-4 space-y-4 pb-24">

      <div className="flex items-center gap-3">
        <button onClick={() => { haptic('light'); setView('list'); }} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
        <div>
          <p className="text-white font-bold">{gameInfo.name}</p>
          <p className="text-white/50 text-xs">Sorteo {selectedDraw?.time} · x{BET_CONFIG.multiplier}</p>
        </div>
      </div>

      {selectedDraw?.status === 'open' && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl px-4 py-2.5 text-center">
          <p className="text-teal-300 text-sm">⏱ Cierra en: <span className="font-bold text-white"><DrawCloseCountdown closeTime={selectedDraw.closeTime} /></span></p>
        </div>
      )}
      {(selectedDraw?.status === 'upcoming' && isFuture) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2.5 text-center">
          <p className="text-blue-300 text-sm">📅 Apuesta anticipada para {formatDate(selectedDraw.date)}</p>
        </div>
      )}

      {/* Editor de monto */}
      {editingAnimal && (
        <div className="bg-white/5 border border-white/15 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{editingAnimal.emoji}</span>
            <div>
              <p className="text-white font-bold">{editingAnimal.name} #{editingAnimal.number}</p>
              <p className="text-white/40 text-xs">
                {drawLimitsMap[editingAnimal.name]
                  ? `Disponible: ${drawLimitsMap[editingAnimal.name].remaining.toLocaleString()} 🥬`
                  : `Máx global: ${BET_CONFIG.maxBetGlobal.toLocaleString()} 🥬`}
              </p>
            </div>
          </div>

          <p className="text-white/60 text-xs">Monto a apostar (🥬):</p>
          <div className="flex flex-wrap gap-2">
            {[50, 100, 250, 500, 1000].map(amt => (
              <button
                key={amt}
                onClick={() => { setTempAmount(String(amt)); haptic('light'); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  tempAmount === String(amt) ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >{amt}</button>
            ))}
          </div>
          <input
            type="number"
            value={tempAmount}
            onChange={e => setTempAmount(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500"
            placeholder="Monto..."
          />
          {tempAmount && !isNaN(parseInt(tempAmount)) && (
            <p className="text-teal-400 text-xs text-center">
              Premio si ganas: {(parseInt(tempAmount || '0') * BET_CONFIG.multiplier).toLocaleString()} 🥬
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setEditingAnimal(null); haptic('light'); }} className="flex-1 py-2.5 bg-white/5 rounded-xl text-white/50 font-semibold text-sm">Cancelar</button>
            <button onClick={confirmAmount} className="flex-1 py-2.5 bg-teal-500 rounded-xl text-white font-bold text-sm active:scale-95">Confirmar</button>
          </div>
        </div>
      )}

      {/* Carrito */}
      {selections.length > 0 && !editingAnimal && (
        <div className="bg-white/5 border border-white/15 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">🎯 Tu apuesta</p>
            <p className="text-white/40 text-xs">{selections.length} animal{selections.length !== 1 ? 'es' : ''}</p>
          </div>
          <div className="space-y-2">
            {selections.map(s => (
              <div key={s.animal.number} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                <span className="text-xl">{s.animal.emoji}</span>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{s.animal.name}</p>
                  <p className="text-teal-400 text-xs">Premio: {(s.amount * BET_CONFIG.multiplier).toLocaleString()} 🥬</p>
                </div>
                <p className="text-white font-bold text-sm">{s.amount.toLocaleString()} 🥬</p>
                <button onClick={() => { setSelections(p => p.filter(x => x.animal.number !== s.animal.number)); haptic('light'); }} className="text-red-400/70 hover:text-red-400 text-sm ml-1">✕</button>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Total:</span>
              <span className="text-white font-bold">{totalBet.toLocaleString()} 🥬</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Mayor premio:</span>
              <span className="text-teal-400 font-bold">{potentialPrize.toLocaleString()} 🥬</span>
            </div>
          </div>
          <button
            onClick={placeBet}
            disabled={placingBet || totalBet > balance}
            className={`w-full py-3.5 rounded-xl font-black text-base transition-all active:scale-95 ${
              placingBet || totalBet > balance
                ? 'bg-white/10 text-white/30'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg'
            }`}
          >
            {placingBet ? '⏳ Procesando...' : `🎯 Apostar ${totalBet.toLocaleString()} 🥬`}
          </button>
        </div>
      )}

      {/* Grid de animales */}
      {!editingAnimal && (
        <>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">🐾 Elige uno o varios animalitos</p>
          <div className="grid grid-cols-4 gap-2">
            {ANIMALS.map(animal => {
              const isSelected = selections.some(s => s.animal.number === animal.number);
              const limit = drawLimitsMap[animal.name];
              const isFull = limit?.isFull;
              return (
                <div
                  key={animal.number}
                  onClick={() => !isFull && toggleAnimal(animal)}
                  className={`relative rounded-xl p-2 text-center transition-all cursor-pointer active:scale-95 border ${
                    isFull ? 'opacity-30 cursor-not-allowed bg-red-500/10 border-red-500/20' :
                    isSelected ? 'bg-teal-500/25 border-teal-500/50 shadow-lg shadow-teal-500/20' :
                    'bg-white/5 border-white/10 hover:bg-white/15'
                  }`}
                >
                  {isSelected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">✓</div>}
                  <p className="text-2xl">{animal.emoji}</p>
                  <p className="text-white text-[10px] font-semibold leading-tight mt-0.5 truncate">{animal.name}</p>
                  <p className="text-white/30 text-[9px]">#{animal.number}</p>
                </div>
              );
            })}
          </div>
          <p className="text-white/30 text-xs text-center">Saldo: {balance.toLocaleString()} 🥬</p>
        </>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: TICKET
  // ════════════════════════════════════════════════════════════
  if (view === 'ticket' && currentTicket) {
    const parts = currentTicket.drawId.split('-');
    const timeStr = parts[parts.length - 1];
    const timeFormatted = `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
    const gameName = currentTicket.drawGame === 'flash' ? '⚡ Flash Lotto' : '🎰 Lotto Activo';
    const draw = draws.find(d => d.drawId === currentTicket.drawId);
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => { haptic('light'); setView('list'); }} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
          <div>
            <p className="text-white font-bold">🎫 Ticket de Apuesta</p>
            <p className="text-white/40 text-xs">{currentTicket.ticketId}</p>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 space-y-3 ${
          currentTicket.status === 'won' ? 'bg-green-500/10 border-green-500/30' :
          currentTicket.status === 'lost' ? 'bg-red-500/10 border-red-500/20' :
          'bg-white/5 border-white/15'
        }`}>
          <div className="text-center pb-2 border-b border-white/10">
            <p className="text-white font-bold">{gameName}</p>
            <p className="text-white/60 text-sm">Sorteo {timeFormatted}</p>
            {currentTicket.status === 'won' && <p className="text-green-400 font-black text-lg mt-1">🎉 ¡GANASTE! +{currentTicket.totalPrize?.toLocaleString()} 🥬</p>}
            {currentTicket.status === 'lost' && <p className="text-red-400 font-semibold mt-1">😔 No ganaste esta vez</p>}
            {currentTicket.status === 'pending' && <p className="text-yellow-400 text-sm mt-1">⏳ Esperando resultado...</p>}
          </div>

          {draw?.winnerAnimal && (
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <span className="text-3xl">{ANIMALS.find(a => a.name === draw.winnerAnimal)?.emoji || '🐾'}</span>
              <div>
                <p className="text-white/60 text-xs">Animal ganador</p>
                <p className="text-white font-bold">{draw.winnerAnimal} #{draw.winnerNumber}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {currentTicket.bets.map((bet, i) => {
              const a = ANIMALS.find(x => x.name === bet.animal);
              return (
                <div key={i} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                  <span className="text-lg">{a?.emoji || '🐾'}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{bet.animal} <span className="text-white/40">#{a?.number}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-bold">{bet.amount.toLocaleString()} 🥬</p>
                    {bet.won === true && <p className="text-green-400 text-xs">+{bet.prize?.toLocaleString()} 🥬</p>}
                    {bet.won === false && <p className="text-red-400 text-xs">Perdiste</p>}
                    {bet.status === 'pending' && <p className="text-yellow-400/60 text-xs">≈{(bet.amount * BET_CONFIG.multiplier).toLocaleString()}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
            <span className="text-white/60">Total apostado:</span>
            <span className="text-white font-bold">{currentTicket.totalBet.toLocaleString()} 🥬</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { haptic('light'); setView('list'); }} className="flex-1 py-3 bg-white/10 rounded-xl text-white font-semibold active:scale-95">← Volver</button>
          <button onClick={() => { haptic('light'); setSelections([]); setView('list'); }} className="flex-1 py-3 bg-teal-500 rounded-xl text-white font-bold active:scale-95">🎯 Nueva apuesta</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // VISTA: HISTORIAL DE TICKETS
  // ════════════════════════════════════════════════════════════
  if (view === 'history') {
    const wonTickets = myTickets.filter(t => t.status === 'won').length;
    const totalPrize = myTickets.reduce((s, t) => s + (t.totalPrize || 0), 0);
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => { haptic('light'); setView('list'); }} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
          <div>
            <p className="text-white font-bold">🎫 Mis Tickets</p>
            <p className="text-white/40 text-xs">{gameInfo.name}</p>
          </div>
        </div>

        {myTickets.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '✅ Ganados', val: wonTickets, color: 'text-green-400' },
              { label: '💰 Premios', val: `${totalPrize.toLocaleString()}🥬`, color: 'text-teal-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className={`font-black text-lg ${color}`}>{val}</p>
                <p className="text-white/40 text-xs">{label}</p>
              </div>
            ))}
          </div>
        )}

        {loadingTickets ? (
          <div className="text-center py-8 text-white/50"><p>⏳ Cargando...</p></div>
        ) : myTickets.length === 0 ? (
          <div className="text-center py-12 text-white/50 space-y-2">
            <p className="text-3xl">🎫</p>
            <p className="font-semibold">Aún no tienes tickets</p>
            <button onClick={() => { haptic('medium'); setView('list'); }} className="mt-2 bg-teal-500 text-white px-6 py-2 rounded-xl font-bold text-sm">¡Apostar ahora!</button>
          </div>
        ) : (
          <div className="space-y-2">
            {myTickets.map(ticket => {
              const tparts = ticket.drawId.split('-');
              const ts = tparts[tparts.length - 1];
              const tf = `${ts.slice(0,2)}:${ts.slice(2,4)}`;
              const gn = ticket.drawGame === 'flash' ? '⚡' : '🎰';
              return (
                <div key={ticket.ticketId}
                  onClick={() => { haptic('light'); setCurrentTicket(ticket); setView('ticket'); }}
                  className={`rounded-xl border p-3.5 cursor-pointer active:scale-[0.98] transition-all ${
                    ticket.status === 'won' ? 'bg-green-500/10 border-green-500/30' :
                    ticket.status === 'lost' ? 'bg-red-500/10 border-red-500/20' :
                    'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold text-sm">{gn} {tf} — {ticket.ticketId}</p>
                      <p className="text-white/40 text-xs">{ticket.bets.map(b => b.animal).join(', ')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${ticket.status === 'won' ? 'text-green-400' : ticket.status === 'lost' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {ticket.status === 'won' ? '🏆 Ganado' : ticket.status === 'lost' ? '❌ Perdido' : '⏳ Pendiente'}
                      </p>
                      {ticket.status === 'won' && <p className="text-green-300 text-xs">+{ticket.totalPrize?.toLocaleString()} 🥬</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // VISTA: SEMANA PASADA
  // ════════════════════════════════════════════════════════════
  if (view === 'week') {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => { haptic('light'); setView('list'); }} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">←</button>
          <div>
            <p className="text-white font-bold">📊 Resultados — Semana Pasada</p>
            <p className="text-white/40 text-xs">{gameInfo.name}</p>
          </div>
        </div>

        {loadingWeek ? (
          <div className="text-center py-12 text-white/50"><p className="text-2xl mb-2">⏳</p><p>Cargando historial...</p></div>
        ) : weekHistory.length === 0 ? (
          <div className="text-center py-12 text-white/50 space-y-2">
            <p className="text-3xl">📊</p>
            <p className="font-semibold">No hay historial disponible</p>
          </div>
        ) : (
          <div className="space-y-4">
            {weekHistory.map(day => (
              <div key={day.date} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="bg-white/5 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-sm">📅</span>
                  <span className="text-white font-semibold text-sm">{formatDate(day.date)}</span>
                  <span className="text-white/40 text-xs ml-auto">{day.results.length} sorteos</span>
                </div>
                {day.results.length === 0 ? (
                  <div className="px-4 py-3 text-white/30 text-xs text-center">Sin resultados registrados</div>
                ) : (
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {day.results.map(r => {
                      const animal = ANIMALS.find(a => a.name === r.winnerAnimal);
                      const tStr = r.drawId.split('-').slice(-1)[0];
                      const tf = tStr ? `${tStr.slice(0,2)}:${tStr.slice(2,4)}` : r.drawId;
                      return (
                        <div key={r.drawId} className="bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                          <span className="text-lg">{animal?.emoji || '🐾'}</span>
                          <div>
                            <p className="text-white text-xs font-semibold">{tf}</p>
                            <p className="text-white/50 text-[10px]">{r.winnerAnimal} #{r.winnerNumber}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Sub-componente: cuenta regresiva inline ───────────────────
function DrawCloseCountdown({ closeTime }: { closeTime: string }) {
  const remaining = useCountdown(closeTime);
  return <p className="text-yellow-400 text-xs">⏱ Cierra en: <span className="font-bold">{remaining}</span></p>;
}
