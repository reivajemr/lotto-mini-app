import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCall } from '../App';

// ── Tipos ─────────────────────────────────────────────────────
interface LobbyProps {
  telegramId: string;
  username: string;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
}

interface Draw {
  drawId: string;
  game: string;
  time: string;
  status: 'open' | 'closed' | 'drawing' | 'done';
  closeTime: string;
  drawTime: string;
  resultTime: string;
  winnerNumber?: number;
  winnerAnimal?: string;
}

interface AnimalDef {
  number: number;
  name: string;
  emoji: string;
  image?: string;
}

interface Selection {
  animal: AnimalDef;
  amount: number;
}

interface DrawLimit {
  remaining: number;
  isFull: boolean;
}

interface Ticket {
  ticketId: string;
  telegramId: string;
  username: string;
  drawId: string;
  drawGame: string;
  bets: BetResult[];
  betsCount: number;
  totalBet: number;
  totalPrize: number | null;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
}

interface BetResult {
  animal: string;
  number: number;
  amount: number;
  won: boolean | null;
  prize: number | null;
  status: string;
}

type ViewType = 'list' | 'bet' | 'ticket' | 'history';

// ── Constantes ────────────────────────────────────────────────
const BET_CONFIG = {
  minBet: 50,
  maxBetPerUser: 1000,
  maxBetGlobal: 10000,
  multiplier: 30,
};

const GAMES = [
  { id: 'lotto', name: 'Lotto Activo', color: 'teal', logo: '/img/lottoactivo/logo_Lotto_Activo.webp' },
  { id: 'granja', name: 'La Granja', color: 'emerald', logo: '/img/granja/logo_lagranja.webp' },
];

const getGameInfo = (gameId: string) => GAMES.find(g => g.id === gameId) || GAMES[0];

const ANIMALS: AnimalDef[] = [
  { number: 0,  name: 'Delfín',    emoji: '🐋', image: '/img/lottoactivo/Delfin_2.webp' },
  { number: 1,  name: 'Carnero',   emoji: '🐏', image: '/img/lottoactivo/Carnero_2.webp' },
  { number: 2,  name: 'Toro',      emoji: '🐂', image: '/img/lottoactivo/Toro_2.webp' },
  { number: 3,  name: 'Ciempiés',  emoji: '🐛', image: '/img/lottoactivo/Ciempies_2.webp' },
  { number: 4,  name: 'Alacrán',   emoji: '🦂', image: '/img/lottoactivo/Alacran_2.webp' },
  { number: 5,  name: 'León',       emoji: '🦁', image: '/img/lottoactivo/Leon_2.webp' },
  { number: 6,  name: 'Rana',       emoji: '🐸', image: '/img/lottoactivo/Rana_2.webp' },
  { number: 7,  name: 'Perico',    emoji: '🦜', image: '/img/lottoactivo/Perico_2.webp' },
  { number: 8,  name: 'Ratón',      emoji: '🐭', image: '/img/lottoactivo/Raton_2.webp' },
  { number: 9,  name: 'Águila',     emoji: '🦅', image: '/img/lottoactivo/Aguila_2.webp' },
  { number: 10, name: 'Tigre',      emoji: '🐯', image: '/img/lottoactivo/Tigre_2.webp' },
  { number: 11, name: 'Gato',       emoji: '🐱', image: '/img/lottoactivo/Gato_2.webp' },
  { number: 12, name: 'Caballo',    emoji: '🐴', image: '/img/lottoactivo/Caballo_2.webp' },
  { number: 13, name: 'Mono',       emoji: '🐒', image: '/img/lottoactivo/Mono_2.webp' },
  { number: 14, name: 'Paloma',     emoji: '🕊️', image: '/img/lottoactivo/Paloma_2.webp' },
  { number: 15, name: 'Zorro',      emoji: '🦊', image: '/img/lottoactivo/Zorro_2.webp' },
  { number: 16, name: 'Oso',        emoji: '🐻', image: '/img/lottoactivo/Oso_2.webp' },
  { number: 17, name: 'Pavo',       emoji: '🦃', image: '/img/lottoactivo/Pavo_2.webp' },
  { number: 18, name: 'Burro',      emoji: '🫏', image: '/img/lottoactivo/Burro_2.webp' },
  { number: 19, name: 'Chivo',      emoji: '🐐', image: '/img/lottoactivo/Chivo_2.webp' },
  { number: 20, name: 'Cochino',    emoji: '🐷', image: '/img/lottoactivo/Cochino_2.webp' },
  { number: 21, name: 'Gallo',      emoji: '🐓', image: '/img/lottoactivo/Gallo_2.webp' },
  { number: 22, name: 'Camello',    emoji: '🐫', image: '/img/lottoactivo/Camello_2.webp' },
  { number: 23, name: 'Cebra',      emoji: '🦓', image: '/img/lottoactivo/Cebra_2.webp' },
  { number: 24, name: 'Iguana',     emoji: '🦎', image: '/img/lottoactivo/Iguana_2.webp' },
  { number: 25, name: 'Gallina',    emoji: '🐔', image: '/img/lottoactivo/Gallina_2.webp' },
  { number: 26, name: 'Vaca',       emoji: '🐄', image: '/img/lottoactivo/Vaca_2.webp' },
  { number: 27, name: 'Perro',      emoji: '🐶', image: '/img/lottoactivo/Perro_2.webp' },
  { number: 28, name: 'Zamuro',     emoji: '🦅', image: '/img/lottoactivo/Zamuro_2.webp' },
  { number: 29, name: 'Elefante',   emoji: '🐘', image: '/img/lottoactivo/Elefante_2.webp' },
  { number: 30, name: 'Caimán',     emoji: '🐊', image: '/img/lottoactivo/Caiman_2.webp' },
  { number: 31, name: 'Lapa',        emoji: '🐹', image: '/img/lottoactivo/Lapa_2.webp' },
  { number: 32, name: 'Ardilla',    emoji: '🐿️', image: '/img/lottoactivo/Ardilla_2.webp' },
  { number: 33, name: 'Pescado',    emoji: '🐟', image: '/img/lottoactivo/Pescado_2.webp' },
  { number: 34, name: 'Venado',     emoji: '🦌', image: '/img/lottoactivo/Venado_2.webp' },
  { number: 35, name: 'Jirafa',     emoji: '🦒', image: '/img/lottoactivo/Jirafa_2.webp' },
  { number: 36, name: 'Culebra',    emoji: '🐍', image: '/img/lottoactivo/Culebra_2.webp' },
  { number: 37, name: 'Ballena',   emoji: '🐋', image: '/img/lottoactivo/Ballena_2.webp' },
];

// ── Hora Venezuela ─────────────────────────────────────────────
function getVenezuelaNow(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' })).getTime();
}

// ── Countdown hook ────────────────────────────────────────────
function useCountdown(targetTime: string | null) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetTime) { setRemaining(''); return; }

    const update = () => {
      const targetMs = new Date(targetTime).getTime();
      const nowVz = getVenezuelaNow();
      const diff = targetMs - nowVz;
      if (diff <= 0) { setRemaining('¡Ya!'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s.toString().padStart(2, '0')}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return remaining;
}

// ── Componente principal ──────────────────────────────────────
export default function Lobby({
  telegramId,
  username,
  balance,
  onBalanceUpdate,
  showAlert,
  haptic,
}: LobbyProps) {
  const [view, setView] = useState<ViewType>('list');
  const [activeGame, setActiveGame] = useState<'lotto' | 'granja'>('lotto');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [editingAnimal, setEditingAnimal] = useState<AnimalDef | null>(null);
  const [tempAmount, setTempAmount] = useState('');
  const [drawLimits, setDrawLimits] = useState<Record<string, DrawLimit>>({});
  const [placingBet, setPlacingBet] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gameInfo = GAMES.find(g => g.id === activeGame) || GAMES[0];

  // Countdown para próximo sorteo abierto
  const nextOpenDraw = draws.find(d => d.status === 'open');
  const currentDrawing = draws.find(d => d.status === 'drawing');
  const countdown = useCountdown(nextOpenDraw?.closeTime || null);
  const drawingCountdown = useCountdown(currentDrawing?.resultTime || null);

  // ── Cargar sorteos ─────────────────────────────────────────
  const loadDraws = useCallback(async () => {
    try {
      const data = await apiCall({
        telegramId,
        action: 'getDraws',
        game: activeGame,
      }) as { success?: boolean; draws?: Draw[]; error?: string };

      if (data?.success && data.draws) {
        setDraws(data.draws);
      }
    } catch (err) {
      console.error('Error cargando sorteos:', err);
    } finally {
      setLoadingDraws(false);
    }
  }, [telegramId, activeGame]);

  useEffect(() => {
    setLoadingDraws(true);
    loadDraws();

    // Refrescar sorteos cada 30 segundos
    refreshRef.current = setInterval(loadDraws, 30000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [loadDraws]);

  // ── Abrir vista de apuesta ─────────────────────────────────
  const openBetView = async (draw: Draw) => {
    haptic('medium');
    setSelectedDraw(draw);
    setSelections([]);
    setEditingAnimal(null);
    setView('bet');

    // Cargar límites
    try {
      const data = await apiCall({
        telegramId,
        action: 'getDrawLimits',
        drawId: draw.drawId,
      }) as { success?: boolean; limits?: Record<string, DrawLimit>; error?: string };

      if (data?.success && data.limits) {
        setDrawLimits(data.limits);
      }
    } catch {
      /* ignorar */
    }
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

  // ── Confirmar monto para un animal ────────────────────────
  const confirmAmount = () => {
    if (!editingAnimal) return;
    const amount = parseInt(tempAmount);
    if (isNaN(amount) || amount < BET_CONFIG.minBet) {
      showAlert(`⚠️ Monto mínimo: ${BET_CONFIG.minBet} 🥬`);
      return;
    }
    if (amount > BET_CONFIG.maxBetPerUser) {
      showAlert(`⚠️ Monto máximo: ${BET_CONFIG.maxBetPerUser.toLocaleString()} 🥬`);
      return;
    }
    haptic('medium');
    setSelections(prev => {
      const existing = prev.find(s => s.animal.number === editingAnimal.number);
      if (existing) {
        return prev.map(s => s.animal.number === editingAnimal.number ? { ...s, amount } : s);
      }
      return [...prev, { animal: editingAnimal, amount }];
    });
    setEditingAnimal(null);
    setTempAmount('');
  };

  // ── Colocar apuesta ────────────────────────────────────────
  const placeBet = async () => {
    if (!selectedDraw || selections.length === 0 || placingBet) return;

    const totalBet = selections.reduce((s, sel) => s + sel.amount, 0);
    if (totalBet > balance) {
      showAlert(`⚠️ Saldo insuficiente.\nNecesitas ${totalBet.toLocaleString()} 🥬 pero tienes ${balance.toLocaleString()} 🥬`);
      return;
    }

    haptic('heavy');
    setPlacingBet(true);

    try {
      const data = await apiCall({
        telegramId,
        username,
        action: 'placeBet',
        drawId: selectedDraw.drawId,
        drawGame: activeGame,
        bets: selections.map(s => ({
          animal: s.animal.name,
          number: s.animal.number,
          amount: s.amount,
        })),
      }) as { success?: boolean; ticket?: Ticket; newBalance?: number; message?: string; error?: string };

      if (data?.success && data.ticket) {
        onBalanceUpdate(data.newBalance ?? balance - totalBet);
        setCurrentTicket(data.ticket);
        setView('ticket');
        haptic('heavy');
      } else {
        showAlert('❌ ' + (data?.error || 'Error al procesar apuesta'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      showAlert('❌ ' + msg);
    } finally {
      setPlacingBet(false);
    }
  };

  // ── Cargar mis tickets ─────────────────────────────────────
  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const data = await apiCall({
        telegramId,
        action: 'getTickets',
      }) as { success?: boolean; tickets?: Ticket[]; error?: string };

      if (data?.success && data.tickets) {
        setMyTickets(data.tickets);
      }
    } catch {
      /* ignorar */
    } finally {
      setLoadingTickets(false);
    }
  }, [telegramId]);

  const totalBet = selections.reduce((s, sel) => s + sel.amount, 0);
  const potentialPrize = selections.length > 0
    ? Math.max(...selections.map(s => s.amount)) * BET_CONFIG.multiplier
    : 0;

  // ════════════════════════════════════════════════════════════
  // VISTA: LISTA DE SORTEOS
  // ════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="p-4 space-y-4">

      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/30 rounded-2xl p-5 text-center">
        <img src={gameInfo.logo} alt={gameInfo.name} className="w-24 h-24 mx-auto mb-2 object-contain" />
        <h2 className="text-white font-bold text-lg">{gameInfo.name}</h2>
        <p className="text-white/50 text-xs mt-1">
          12 sorteos diarios · Premio x{BET_CONFIG.multiplier} · Resultados oficiales
        </p>

        {nextOpenDraw && (
          <div className="mt-3 bg-teal-500/20 rounded-xl px-3 py-2">
            <p className="text-teal-200 text-xs">⏱ Próximo sorteo ({nextOpenDraw.time}) cierra en:</p>
            <p className="text-white font-bold text-lg">{countdown}</p>
          </div>
        )}
        {currentDrawing && !nextOpenDraw && (
          <div className="mt-3 bg-orange-500/20 rounded-xl px-3 py-2">
            <p className="text-orange-200 text-xs">Sorteando ahora — {currentDrawing.time}</p>
            <p className="text-white font-bold text-lg">{drawingCountdown}</p>
          </div>
        )}
      </div>

      {/* Selector de juego */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => { haptic('light'); setActiveGame(g.id as 'lotto' | 'granja'); }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeGame === g.id
                ? 'bg-teal-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <img src={g.logo} alt={g.name} className="w-8 h-8 mx-auto object-contain" />
          </button>
        ))}
      </div>

      {/* Botón historial */}
      <button
        onClick={() => { haptic('light'); loadTickets(); setView('history'); }}
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-white/70 text-sm font-medium transition-all flex items-center justify-center gap-2"
      >
        🎫 Ver mis tickets
      </button>

      {/* Lista de sorteos */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">
          Sorteos de hoy — {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {loadingDraws ? (
          <div className="text-center py-8">
            <p className="text-3xl animate-bounce">⏳</p>
            <p className="text-white/50 text-sm mt-2">Cargando sorteos...</p>
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-8 bg-white/3 rounded-2xl">
            <p className="text-3xl mb-2">🕐</p>
            <p className="text-white/60 text-sm">No hay sorteos disponibles</p>
            <button onClick={loadDraws} className="mt-3 text-teal-400 text-sm underline">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {draws.map(draw => {
              const foundAnimal = draw.winnerAnimal
                ? ANIMALS.find(a => a.name === draw.winnerAnimal)
                : null;
              const animalData = foundAnimal || (draw.winnerAnimal ? { emoji: '🐾', name: draw.winnerAnimal, image: '' } : null);
              const canBet = draw.status === 'open';
              const winnerImage = foundAnimal?.image && draw.status === 'done' 
                ? (activeGame === 'granja' ? foundAnimal.image.replace('lottoactivo', 'granja').replace('_2', '_3') : foundAnimal.image)
                : null;

              return (
                <div
                  key={draw.drawId}
                  onClick={() => canBet ? openBetView(draw) : undefined}
                  className={`flex items-center justify-between rounded-xl p-3.5 border transition-all ${
                    canBet
                      ? 'bg-white/8 border-white/15 hover:bg-white/15 cursor-pointer active:scale-[0.98]'
                      : draw.status === 'drawing'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-white/3 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                      canBet ? 'bg-teal-500/20' : 'bg-white/5'
                    }`}>
                      {draw.status === 'done' && winnerImage ? (
                        <img src={winnerImage} alt={draw.winnerAnimal} className="w-8 h-8 object-contain" />
                      ) : draw.status === 'done' && animalData ? (
                        animalData.emoji
                      ) : '🕐'}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {draw.time.replace(/^(\d):/, '0$1:')} {parseInt(draw.time.split(':')[0]) < 12 ? 'AM' : 'PM'}
                      </p>
                      {canBet && (
                        <p className="text-teal-300 text-xs">
                          Cierra: <DrawCloseCountdown closeTime={draw.closeTime} />
                        </p>
                      )}
                      {draw.status === 'drawing' && (
                        <p className="text-orange-300 text-xs">
                          Resultado en: <DrawCloseCountdown closeTime={draw.resultTime} />
                        </p>
                      )}
                      {draw.status === 'done' && animalData && (
                        <p className="text-green-400 text-xs flex items-center gap-1">
                          {winnerImage ? (
                            <img src={winnerImage} alt={draw.winnerAnimal} className="w-4 h-4 object-contain inline" />
                          ) : animalData.emoji}
                          {draw.winnerAnimal} #{draw.winnerNumber}
                        </p>
                      )}
                      {draw.status === 'done' && !draw.winnerAnimal && (
                        <p className="text-white/40 text-xs">Sin resultado aún</p>
                      )}
                      {draw.status === 'closed' && (
                        <p className="text-white/40 text-xs">🔒 Apuestas cerradas</p>
                      )}
                    </div>
                  </div>
                  <div>
                    {canBet && (
                      <span className="bg-teal-500/20 text-teal-300 text-xs px-2.5 py-1 rounded-lg font-medium">
                        Apostar →
                      </span>
                    )}
                    {draw.status === 'drawing' && (
                      <span className="bg-orange-500/20 text-orange-300 text-xs px-2.5 py-1 rounded-lg">
                        Sorteando
                      </span>
                    )}
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
          { icon: '📢', text: 'Resultado en 5 min' },
          { icon: '🏆', text: `Premio x${BET_CONFIG.multiplier}` },
          { icon: '📡', text: 'Resultados oficiales' },
          { icon: '💰', text: `Mín: ${BET_CONFIG.minBet}🥬` },
          { icon: '💎', text: `Máx: ${BET_CONFIG.maxBetPerUser.toLocaleString()}🥬` },
        ].map((item, i) => (
          <div key={i} className="bg-white/3 rounded-xl p-2.5 text-center">
            <p className="text-lg">{item.icon}</p>
            <p className="text-white/50 text-[10px] mt-0.5 leading-tight">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: APUESTA
  // ════════════════════════════════════════════════════════════
  if (view === 'bet') return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold">{gameInfo.name}</h3>
          <p className="text-white/50 text-xs">
            Sorteo {selectedDraw?.time} · x{BET_CONFIG.multiplier}
          </p>
        </div>
        <button
          onClick={() => { haptic('light'); setView('list'); }}
          className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-white/70 text-sm transition-all"
        >
          ← Volver
        </button>
      </div>

      {/* Estado del sorteo */}
      {selectedDraw?.status === 'open' && (
        <div className="bg-teal-500/15 border border-teal-500/30 rounded-xl p-3 text-center">
          <p className="text-teal-300 text-xs">
            ⏱ Las apuestas cierran en: <span className="font-bold">
              <DrawCloseCountdown closeTime={selectedDraw.closeTime} />
            </span>
          </p>
        </div>
      )}
      {selectedDraw?.status !== 'open' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-red-300 text-xs">🔒 Este sorteo ya cerró</p>
        </div>
      )}

      {/* Editor de monto */}
      {editingAnimal && (
        <div className="bg-white/5 border border-white/15 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            {editingAnimal.image ? (
              <img src={activeGame === 'granja' ? editingAnimal.image.replace('lottoactivo', 'granja').replace('_2', '_3') : editingAnimal.image} alt={editingAnimal.name} className="w-12 h-12 object-contain" />
            ) : (
              <span className="text-3xl">{editingAnimal.emoji}</span>
            )}
            <div>
              <p className="text-white font-bold">{editingAnimal.name} #{editingAnimal.number}</p>
              <p className="text-white/40 text-xs">
                {drawLimits[editingAnimal.name]
                  ? `Disponible: ${drawLimits[editingAnimal.name].remaining.toLocaleString()} 🥬`
                  : `Máx global: ${BET_CONFIG.maxBetGlobal.toLocaleString()} 🥬`}
              </p>
            </div>
          </div>

          <p className="text-white/60 text-sm">Monto a apostar (🥬):</p>
          <div className="flex gap-2 flex-wrap">
            {[50, 100, 250, 500, 1000].map(amt => (
              <button
                key={amt}
                onClick={() => setTempAmount(String(amt))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tempAmount === String(amt)
                    ? 'bg-teal-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {amt}
              </button>
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
            <p className="text-teal-300 text-center text-sm">
              Premio si ganas: {(parseInt(tempAmount || '0') * BET_CONFIG.multiplier).toLocaleString()} 🥬
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setEditingAnimal(null); setTempAmount(''); }}
              className="flex-1 bg-white/10 text-white/60 py-2.5 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={confirmAmount}
              className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-2.5 rounded-xl font-bold transition-all active:scale-95"
            >
              ✅ Agregar
            </button>
          </div>
        </div>
      )}

      {/* Carrito */}
      {selections.length > 0 && !editingAnimal && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">🎯 Tu apuesta</p>
            <p className="text-teal-300 text-xs">{selections.length} animal{selections.length !== 1 ? 'es' : ''}</p>
          </div>

          <div className="space-y-2">
            {selections.map(s => {
              const selImage = s.animal.image 
                ? (activeGame === 'granja' ? s.animal.image.replace('lottoactivo', 'granja').replace('_2', '_3') : s.animal.image)
                : null;
              return (
                <div key={s.animal.number} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5">
                  {selImage ? (
                    <img src={selImage} alt={s.animal.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <span className="text-xl">{s.animal.emoji}</span>
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{s.animal.name}</p>
                    <p className="text-white/40 text-xs">Premio: {(s.amount * BET_CONFIG.multiplier).toLocaleString()} 🥬</p>
                  </div>
                  <p className="text-teal-300 font-bold text-sm">{s.amount.toLocaleString()} 🥬</p>
                  <button
                    onClick={() => setSelections(prev => prev.filter(x => x.animal.number !== s.animal.number))}
                    className="text-white/30 hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-white/60 text-sm">Total a descontar:</span>
              <span className="text-white font-bold">{totalBet.toLocaleString()} 🥬</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60 text-sm">Mayor premio posible:</span>
              <span className="text-teal-400 font-bold">{potentialPrize.toLocaleString()} 🥬</span>
            </div>
          </div>

          <button
            onClick={placeBet}
            disabled={placingBet || selectedDraw?.status !== 'open'}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {placingBet ? '⏳ Procesando...' : `🎯 Apostar ${totalBet.toLocaleString()} 🥬`}
          </button>
        </div>
      )}

      {/* Grid de animales */}
      {!editingAnimal && (
        <>
          <p className="text-white/60 text-sm text-center">🐾 Elige uno o varios animalitos</p>
          <div className="grid grid-cols-4 gap-2">
            {ANIMALS.map(animal => {
              const isSelected = selections.some(s => s.animal.number === animal.number);
              const limit = drawLimits[animal.name];
              const isFull = limit?.isFull;

              return (
                <button
                  key={animal.number}
                  onClick={() => !isFull && selectedDraw?.status === 'open' && toggleAnimal(animal)}
                  disabled={isFull || selectedDraw?.status !== 'open'}
                  className={`relative rounded-xl p-2 text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-teal-500/30 border-2 border-teal-400 scale-[0.97]'
                      : isFull
                      ? 'bg-white/3 border border-white/5 opacity-40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {animal.image ? (
                    <img src={activeGame === 'granja' ? animal.image.replace('lottoactivo', 'granja').replace('_2', '_3') : animal.image} alt={animal.name} className="w-8 h-8 mx-auto object-contain" />
                  ) : (
                    <p className="text-2xl">{animal.emoji}</p>
                  )}
                  <p className="text-white/70 text-[9px] mt-0.5 leading-tight">{animal.name}</p>
                  <p className="text-white/40 text-[9px]">#{animal.number}</p>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-teal-500 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                      ✓
                    </div>
                  )}
                  {isFull && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                      <span className="text-xs">🔒</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selections.length === 0 && (
            <p className="text-white/30 text-xs text-center">
              Toca un animalito para seleccionarlo. Puedes elegir varios.
            </p>
          )}
        </>
      )}

      {/* Balance */}
      <div className="bg-white/3 rounded-xl p-3 text-center">
        <span className="text-white/50 text-xs">Tu saldo: </span>
        <span className="text-teal-400 font-bold">{balance.toLocaleString()} 🥬</span>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // VISTA: TICKET
  // ════════════════════════════════════════════════════════════
  if (view === 'ticket' && currentTicket) {
    const parts = currentTicket.drawId.split('-');
    const timeStr = parts[parts.length - 1];
    const timeFormatted = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
    const gameInfoTicket = getGameInfo(currentTicket.drawGame);
    const draw = draws.find(d => d.drawId === currentTicket.drawId);
    const hasResult = draw?.status === 'done' && draw.winnerAnimal;

    return (
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">🎫 Ticket de Apuesta</h3>
            <p className="text-teal-300 text-xs font-mono">{currentTicket.ticketId}</p>
          </div>
          <button
            onClick={() => { haptic('light'); setView('list'); }}
            className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-white/70 text-sm transition-all"
          >
            ← Volver
          </button>
        </div>

        {/* Ticket card */}
        <div className="bg-white/5 border border-white/15 rounded-2xl overflow-hidden">

          {/* Cabecera del ticket */}
          <div className="bg-gradient-to-r from-teal-600/40 to-emerald-600/30 p-4 text-center">
            <img src={gameInfoTicket.logo} alt={gameInfoTicket.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
            <p className="text-white font-bold">{gameInfoTicket.name}</p>
            <p className="text-teal-200 text-sm">Sorteo {timeFormatted}</p>
            <p className="text-white/50 text-xs mt-1">
              {new Date(currentTicket.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
            </p>
            {currentTicket.status === 'won' && (
              <p className="text-green-400 font-bold mt-2">🎉 ¡GANASTE! +{currentTicket.totalPrize?.toLocaleString()} 🥬</p>
            )}
            {currentTicket.status === 'lost' && (
              <p className="text-red-400 text-sm mt-2">😔 No ganaste esta vez</p>
            )}
            {currentTicket.status === 'pending' && (
              <p className="text-yellow-300 text-sm mt-2">⏳ Esperando resultado del sorteo...</p>
            )}
          </div>

          {/* Resultado del sorteo */}
          {hasResult && draw && (() => {
            const winnerAnimal = ANIMALS.find(a => a.name === draw.winnerAnimal);
            const winnerImg = winnerAnimal?.image && activeGame === 'granja'
              ? winnerAnimal.image.replace('lottoactivo', 'granja').replace('_2', '_3')
              : winnerAnimal?.image;
            return (
              <div className="bg-green-500/10 border-b border-white/5 p-4 flex items-center gap-3">
                {winnerImg ? (
                  <img src={winnerImg} alt={draw.winnerAnimal} className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-3xl">
                    {ANIMALS.find(a => a.name === draw.winnerAnimal)?.emoji || '🐾'}
                  </span>
                )}
                <div>
                  <p className="text-white/50 text-xs">Animal ganador</p>
                  <p className="text-green-300 font-bold">{draw.winnerAnimal} #{draw.winnerNumber}</p>
                </div>
              </div>
            );
          })()}

          {/* Lista de apuestas */}
          <div className="p-4 space-y-3">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
              Tus apuestas ({currentTicket.betsCount})
            </p>

            <div className="space-y-2">
              {currentTicket.bets.map((bet, i) => {
                const animalData = ANIMALS.find(a => a.name === bet.animal);
                const betImage = animalData?.image && activeGame === 'granja'
                  ? animalData.image.replace('lottoactivo', 'granja').replace('_2', '_3')
                  : animalData?.image;
                return (
                  <div key={i} className="flex items-center gap-3 bg-white/3 rounded-xl p-3">
                    <div className="flex items-center gap-2 flex-1">
                      {betImage ? (
                        <img src={betImage} alt={bet.animal} className="w-8 h-8 object-contain" />
                      ) : (
                        <span className="text-xl">{animalData?.emoji || '🐾'}</span>
                      )}
                      <div>
                        <p className="text-white text-sm font-medium">{bet.animal}</p>
                        <p className="text-white/40 text-xs">#{animalData?.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm">{bet.amount.toLocaleString()} 🥬</p>
                      {bet.won === true && (
                        <p className="text-green-400 text-xs font-bold">+{bet.prize?.toLocaleString()} 🥬</p>
                      )}
                      {bet.won === false && (
                        <p className="text-red-400 text-xs">Perdiste</p>
                      )}
                      {bet.status === 'pending' && (
                        <p className="text-yellow-300/50 text-xs">≈{(bet.amount * BET_CONFIG.multiplier).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-white/60 text-sm">Total apostado:</span>
                <span className="text-white font-bold">{currentTicket.totalBet.toLocaleString()} 🥬</span>
              </div>
              {currentTicket.status === 'pending' && (
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Premio máximo posible:</span>
                  <span className="text-teal-400 font-bold">
                    {(Math.max(...currentTicket.bets.map(b => b.amount)) * BET_CONFIG.multiplier).toLocaleString()} 🥬
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer del ticket */}
          <div className="bg-black/20 p-3 text-center">
            <p className="text-white/30 text-xs font-mono">{currentTicket.ticketId}</p>
            <p className="text-white/20 text-[10px] mt-0.5">Animalito Lotto · Red Testnet TON</p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={() => { haptic('light'); setView('list'); }}
            className="flex-1 bg-white/10 hover:bg-white/15 text-white py-3 rounded-xl font-medium transition-all"
          >
            Seguir apostando
          </button>
          <button
            onClick={() => { haptic('light'); loadTickets(); setView('history'); }}
            className="flex-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 py-3 rounded-xl font-medium transition-all border border-teal-500/30"
          >
            🎫 Mis tickets
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // VISTA: HISTORIAL
  // ════════════════════════════════════════════════════════════
  if (view === 'history') {
    const wonTickets = myTickets.filter(t => t.status === 'won').length;
    const lostTickets = myTickets.filter(t => t.status === 'lost').length;
    const pendingTickets = myTickets.filter(t => t.status === 'pending').length;
    const totalPrize = myTickets.reduce((s, t) => s + (t.totalPrize || 0), 0);

    return (
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">🎫 Mis Tickets</h3>
            <p className="text-white/50 text-xs">Historial de apuestas</p>
          </div>
          <button
            onClick={() => { haptic('light'); setView('list'); }}
            className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-white/70 text-sm transition-all"
          >
            ← Volver
          </button>
        </div>

        {/* Stats */}
        {myTickets.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '✅ Ganados',    val: wonTickets,                       color: 'text-green-400' },
              { label: '❌ Perdidos',   val: lostTickets,                      color: 'text-red-400' },
              { label: '⏳ Pendientes', val: pendingTickets,                   color: 'text-yellow-400' },
              { label: '💰 Premios',    val: `${totalPrize.toLocaleString()}🥬`, color: 'text-teal-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-2.5 text-center">
                <p className={`font-bold text-sm ${color}`}>{val}</p>
                <p className="text-white/40 text-[9px] mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista */}
        {loadingTickets ? (
          <div className="text-center py-8">
            <p className="text-3xl animate-bounce">⏳</p>
            <p className="text-white/50 text-sm mt-2">Cargando tickets...</p>
          </div>
        ) : myTickets.length === 0 ? (
          <div className="text-center py-10 bg-white/3 rounded-2xl">
            <p className="text-4xl mb-3">🎫</p>
            <p className="text-white/70 font-semibold">Aún no tienes tickets</p>
            <p className="text-white/40 text-sm mt-1">¡Haz tu primera apuesta!</p>
            <button
              onClick={() => { haptic('light'); setView('list'); }}
              className="mt-4 bg-teal-500 text-white px-5 py-2.5 rounded-xl font-medium active:scale-95 transition-all"
            >
              Ir a jugar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map(ticket => {
              const parts = ticket.drawId.split('-');
              const timeStr = parts[parts.length - 1];
              const timeFormatted = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
              const gameInfoHist = getGameInfo(ticket.drawGame);

              return (
                <div
                  key={ticket.ticketId}
                  onClick={() => { haptic('light'); setCurrentTicket(ticket); setView('ticket'); }}
                  className={`rounded-2xl border p-4 cursor-pointer hover:opacity-90 transition active:scale-[0.98] ${
                    ticket.status === 'won'
                      ? 'bg-green-500/10 border-green-500/30'
                      : ticket.status === 'lost'
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img src={gameInfoHist.logo} alt={gameInfoHist.name} className="w-8 h-8 object-contain" />
                      <div>
                        <p className="text-white font-semibold text-sm">{gameInfoHist.name} — {timeFormatted}</p>
                        <p className="text-white/40 text-xs font-mono">{ticket.ticketId}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                      ticket.status === 'won'
                        ? 'bg-green-500/20 text-green-400'
                        : ticket.status === 'lost'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {ticket.status === 'won' ? '🏆 Ganado' : ticket.status === 'lost' ? '❌ Perdido' : '⏳ Pendiente'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ticket.bets.map((bet, i) => {
                      const a = ANIMALS.find(x => x.name === bet.animal);
                      const histImage = a?.image && ticket.drawGame === 'granja'
                        ? a.image.replace('lottoactivo', 'granja').replace('_2', '_3')
                        : a?.image;
                      return (
                        <span key={i} className="bg-white/8 text-white/60 text-[10px] px-2 py-1 rounded-lg flex items-center gap-1">
                          {histImage ? (
                            <img src={histImage} alt={bet.animal} className="w-4 h-4 object-contain" />
                          ) : (
                            <span>{a?.emoji}</span>
                          )}
                          {bet.animal} · {bet.amount}🥬
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs">
                      Total: {ticket.totalBet.toLocaleString()} 🥬
                    </span>
                    {ticket.status === 'won' && ticket.totalPrize && (
                      <span className="text-green-400 font-bold text-sm">
                        +{ticket.totalPrize.toLocaleString()} 🥬
                      </span>
                    )}
                    {ticket.status === 'pending' && (
                      <span className="text-white/30 text-xs">
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
  }

  return null;
}

// ── Sub-componente: cuenta regresiva en línea ─────────────────
function DrawCloseCountdown({ closeTime }: { closeTime: string }) {
  const remaining = useCountdown(closeTime);
  return <>{remaining}</>;
}
