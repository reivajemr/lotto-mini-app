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
  { id: 'lotto', name: '🎰 Lotto Activo', desc: '12 sorteos diarios · Premio x30 · Resultados oficiales', color: 'from-teal-500 to-emerald-600', badge: '' },
  { id: 'flash', name: '⚡ Flash Lotto', desc: 'Sorteos cada 5 min · Premio x30 · Resultado aleatorio', color: 'from-yellow-500 to-orange-500', badge: 'CADA 5 MIN' },
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

function vzDateStr(d?: Date) {
  const now = d || new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, day] = dateStr.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${day} ${months[parseInt(m)-1]} ${y}`;
}

const MAX_FUTURE_DAYS = 3;

export default function Lobby({ telegramId, balance, onBalanceUpdate, showAlert, haptic }: LobbyProps) {
  const today = vzDateStr();
  const [activeGame, setActiveGame] = useState<'lotto' | 'flash'>('lotto');
  const [selectedDate, setSelectedDate] = useState(today);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [betSelections, setBetSelections] = useState<BetSelection[]>([]);
  const [betAmount, setBetAmount] = useState(100);
  const [placing, setPlacing] = useState(false);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [showTickets, setShowTickets] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [showWeek, setShowWeek] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDraws = useCallback(async () => {
    setLoadingDraws(true);
    try {
      const data = await apiCall({ action: 'getDraws', telegramId, date: selectedDate, game: activeGame }) as any;
      if (data?.success) setDraws(data.draws || []);
    } catch { /* ignorar */ }
    setLoadingDraws(false);
  }, [telegramId, selectedDate, activeGame]);

  useEffect(() => {
    loadDraws();
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(loadDraws, activeGame === 'flash' ? 30000 : 60000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [loadDraws, activeGame]);

  // Auto-resolver Flash cuando ya pasó la hora
  useEffect(() => {
    if (activeGame !== 'flash') return;
    const check = async () => {
      const now = new Date();
      for (const draw of draws) {
        if (draw.status === 'closed' && !draw.winnerNumber) {
          const closeTime = new Date(draw.closeTime);
          if (now.getTime() - closeTime.getTime() > 2 * 60 * 1000) {
            if (resolving === draw.drawId) continue;
            setResolving(draw.drawId);
            try {
              await apiCall({ action: 'resolveFlash', telegramId, drawId: draw.drawId });
              loadDraws();
            } catch { /* ignorar */ }
            setResolving(null);
          }
        }
      }
    };
    const iv = setInterval(check, 15000);
    check();
    return () => clearInterval(iv);
  }, [draws, activeGame, telegramId, resolving, loadDraws]);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await apiCall({ action: 'getTickets', telegramId }) as any;
      if (data?.success) setMyTickets(data.tickets || []);
    } catch { /* ignorar */ }
    setLoadingTickets(false);
  };

  const loadWeekResults = async () => {
    setLoadingWeek(true);
    try {
      const data = await apiCall({ action: 'getWeekResults', telegramId, game: activeGame }) as any;
      if (data?.success) setWeekData(data.weekData || []);
    } catch { /* ignorar */ }
    setLoadingWeek(false);
  };

  const toggleAnimal = (animal: AnimalDef) => {
    haptic('light');
    setBetSelections(prev => {
      const exists = prev.find(s => s.animal.number === animal.number);
      if (exists) return prev.filter(s => s.animal.number !== animal.number);
      if (prev.length >= 5) { showAlert('Máximo 5 animales por ticket'); return prev; }
      return [...prev, { animal, amount: betAmount }];
    });
  };

  const updateBetAmount = (num: number, amount: number) => {
    setBetSelections(prev => prev.map(s =>
      s.animal.number === num ? { ...s, amount } : s
    ));
  };

  const totalBet = betSelections.reduce((s, b) => s + b.amount, 0);

  const placeBet = async () => {
    if (!selectedDraw) return;
    if (betSelections.length === 0) { showAlert('Selecciona al menos un animal'); return; }
    if (totalBet > balance) { showAlert('Saldo insuficiente 😥'); return; }
    haptic('medium');
    setPlacing(true);
    try {
      const data = await apiCall({
        action: 'bet',
        telegramId,
        drawId: selectedDraw.drawId,
        drawGame: activeGame,
        date: selectedDraw.date,
        bets: betSelections.map(s => ({ number: s.animal.number, amount: s.amount })),
      }) as any;

      if (data?.success) {
        onBalanceUpdate(data.newBalance);
        haptic('heavy');
        showAlert(`✅ ¡Apuesta realizada!\nTicket: ${data.ticketId}\nTotal: ${totalBet} 🥬\n\nBuena suerte! 🍀`);
        setBetSelections([]);
        setSelectedDraw(null);
        loadDraws();
      } else {
        showAlert('❌ ' + (data?.error || 'Error al apostar'));
      }
    } catch (err) {
      showAlert('❌ Error: ' + String(err));
    }
    setPlacing(false);
  };

  const canGoBack = selectedDate > today;
  const canGoForward = addDays(selectedDate, 1) <= addDays(today, MAX_FUTURE_DAYS);
  const isToday = selectedDate === today;

  const getDrawStatus = (draw: Draw) => {
    const now = new Date().toISOString();
    if (draw.winnerNumber !== undefined) return 'finished';
    if (draw.closeTime < now) return 'closed';
    return 'open';
  };

  return (
    <div className="flex flex-col pb-4">

      {/* Selector de juego */}
      <div className="px-4 pt-4 space-y-2">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => { haptic('light'); setActiveGame(g.id as any); setSelectedDraw(null); setBetSelections([]); }}
            className={`w-full rounded-2xl p-4 flex items-center gap-3 transition-all border-2 ${
              activeGame === g.id
                ? 'border-teal-400/60 bg-teal-500/10'
                : 'border-white/5 bg-white/5 opacity-60'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center text-2xl flex-shrink-0`}>
              {g.id === 'lotto' ? '🎰' : '⚡'}
            </div>
            <div className="text-left flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-sm">{g.name}</p>
                {g.badge && (
                  <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">{g.badge}</span>
                )}
              </div>
              <p className="text-white/40 text-[11px] mt-0.5">{g.desc}</p>
            </div>
            {activeGame === g.id && <span className="text-teal-400 text-lg">✓</span>}
          </button>
        ))}
      </div>

      {/* Navegación de fechas */}
      <div className="flex items-center justify-between px-4 mt-4 mb-2">
        <button
          onClick={() => { if (canGoBack) { haptic('light'); setSelectedDate(d => addDays(d, -1)); } }}
          disabled={!canGoBack}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${canGoBack ? 'bg-white/10 text-white active:bg-white/20' : 'opacity-20 cursor-not-allowed'}`}
        >‹</button>

        <div className="text-center">
          <p className="text-white font-bold text-sm">
            {isToday ? '📅 HOY' : selectedDate === addDays(today, 1) ? '📅 MAÑANA' : `📅 ${formatDateDisplay(selectedDate)}`}
          </p>
          <p className="text-white/40 text-[10px]">{formatDateDisplay(selectedDate)}</p>
        </div>

        <button
          onClick={() => { if (canGoForward) { haptic('light'); setSelectedDate(d => addDays(d, 1)); } }}
          disabled={!canGoForward}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${canGoForward ? 'bg-white/10 text-white active:bg-white/20' : 'opacity-20 cursor-not-allowed'}`}
        >›</button>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 px-4 mb-3">
        <button
          onClick={() => { haptic('light'); setShowTickets(!showTickets); if (!showTickets) { loadTickets(); setShowWeek(false); } }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${showTickets ? 'bg-teal-500 text-white' : 'bg-white/8 text-white/60'}`}
        >🎫 Mis tickets</button>
        <button
          onClick={() => { haptic('light'); setShowWeek(!showWeek); if (!showWeek) { loadWeekResults(); setShowTickets(false); } }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${showWeek ? 'bg-purple-500 text-white' : 'bg-white/8 text-white/60'}`}
        >📊 Semana</button>
        <button
          onClick={() => { haptic('light'); loadDraws(); }}
          className="w-9 h-9 rounded-xl bg-white/8 text-white/60 flex items-center justify-center text-sm"
        >🔄</button>
      </div>

      {/* PANEL: Mis Tickets */}
      {showTickets && (
        <div className="mx-4 mb-3 bg-black/30 rounded-2xl p-3">
          <p className="text-white/60 text-xs font-bold mb-2 uppercase tracking-wider">Mis últimos tickets</p>
          {loadingTickets ? (
            <p className="text-white/30 text-xs text-center py-4">Cargando...</p>
          ) : myTickets.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">No tienes tickets aún</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {myTickets.map(ticket => (
                <div key={ticket.ticketId} className="bg-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-[10px]">{ticket.ticketId}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ticket.status === 'resolved' && ticket.totalPrize > 0
                        ? 'bg-green-500/20 text-green-400'
                        : ticket.status === 'resolved'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {ticket.status === 'resolved' && ticket.totalPrize > 0 ? `+${ticket.totalPrize} 🥬` :
                       ticket.status === 'resolved' ? 'Sin premio' : '⏳ Pendiente'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ticket.bets.map((b, i) => (
                      <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded-lg ${
                        b.won === true ? 'bg-green-500/20 text-green-300' :
                        b.won === false ? 'bg-red-500/10 text-red-400' :
                        'bg-white/5 text-white/50'
                      }`}>
                        {b.animal} {b.won === true ? '✅' : b.won === false ? '❌' : ''} ({b.amount}🥬)
                      </span>
                    ))}
                  </div>
                  <p className="text-white/20 text-[9px] mt-1">
                    {ticket.drawGame === 'flash' ? '⚡' : '🎰'} {ticket.drawId} · Total: {ticket.totalBet} 🥬
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PANEL: Resultados de la semana */}
      {showWeek && (
        <div className="mx-4 mb-3 bg-black/30 rounded-2xl p-3">
          <p className="text-white/60 text-xs font-bold mb-2 uppercase tracking-wider">
            📊 Resultados — Últimos 7 días ({activeGame === 'flash' ? '⚡ Flash' : '🎰 Lotto'})
          </p>
          {loadingWeek ? (
            <p className="text-white/30 text-xs text-center py-4">Cargando...</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {weekData.map(day => (
                <div key={day.date}>
                  <p className="text-white/30 text-[10px] font-bold uppercase mb-1">{formatDateDisplay(day.date)}</p>
                  {day.results.length === 0 ? (
                    <p className="text-white/20 text-[10px] italic ml-2 mb-1">Sin resultados</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {day.results.map((r, i) => (
                        <div key={i} className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1">
                          {r.time && <span className="text-white/30 text-[9px]">{r.time}</span>}
                          <span className="text-teal-300 font-bold text-xs">{r.winnerAnimal}</span>
                          <span className="text-white/40 text-[10px]">#{r.winnerNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de sorteos */}
      <div className="px-4">
        <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">
          Sorteos — {isToday ? 'Hoy' : formatDateDisplay(selectedDate)} ({activeGame === 'flash' ? 'Flash' : 'Lotto'})
        </p>

        {loadingDraws ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No hay sorteos</div>
        ) : (
          <div className="space-y-2">
            {draws.map(draw => {
              const status = getDrawStatus(draw);
              const isSelected = selectedDraw?.drawId === draw.drawId;

              return (
                <div key={draw.drawId}>
                  <button
                    onClick={() => {
                      if (status === 'finished') return;
                      haptic('light');
                      if (isSelected) { setSelectedDraw(null); setBetSelections([]); }
                      else { setSelectedDraw(draw); setBetSelections([]); }
                    }}
                    className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 transition-all border ${
                      isSelected
                        ? 'border-teal-400/50 bg-teal-500/10'
                        : status === 'open'
                        ? 'border-white/8 bg-white/5 active:bg-white/10'
                        : 'border-white/3 bg-white/3 opacity-60 cursor-default'
                    }`}
                  >
                    {/* Ícono estado */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      status === 'finished' ? 'bg-green-500/20' :
                      status === 'closed' ? 'bg-gray-500/20' : 'bg-teal-500/20'
                    }`}>
                      {status === 'finished' ? '✅' : status === 'closed' ? '🔒' : activeGame === 'flash' ? '⚡' : '🎰'}
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm">{draw.time}</p>
                        {status === 'open' && activeGame === 'flash' && (
                          <CountdownBadge closeTime={draw.closeTime} />
                        )}
                      </div>
                      {status === 'finished' ? (
                        <p className="text-teal-300 text-xs font-semibold">
                          🏆 {draw.winnerAnimal} #{draw.winnerNumber}
                        </p>
                      ) : status === 'closed' ? (
                        <p className="text-white/30 text-xs">
                          {resolving === draw.drawId ? '⏳ Resolviendo...' : 'Apuestas cerradas'}
                        </p>
                      ) : (
                        <p className="text-white/40 text-xs">Abierto · x{30} premio</p>
                      )}
                    </div>

                    {status === 'open' && (
                      <span className={`text-xs px-2 py-1 rounded-lg ${isSelected ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/50'}`}>
                        {isSelected ? 'Apostar' : '›'}
                      </span>
                    )}
                  </button>

                  {/* Panel de apuesta */}
                  {isSelected && status === 'open' && (
                    <BetPanel
                      draw={draw}
                      betSelections={betSelections}
                      toggleAnimal={toggleAnimal}
                      updateBetAmount={updateBetAmount}
                      betAmount={betAmount}
                      setBetAmount={setBetAmount}
                      totalBet={totalBet}
                      balance={balance}
                      placing={placing}
                      placeBet={placeBet}
                      haptic={haptic}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Countdown badge ──────────────────────────────────────────
function CountdownBadge({ closeTime }: { closeTime: string }) {
  const txt = useCountdown(closeTime);
  if (!txt || txt === '00:00') return null;
  return (
    <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full font-mono">
      {txt}
    </span>
  );
}

// ── Panel de apuesta ─────────────────────────────────────────
function BetPanel({ betSelections, toggleAnimal, updateBetAmount, betAmount, setBetAmount, totalBet, balance, placing, placeBet, haptic }: {
  draw?: Draw;
  betSelections: BetSelection[];
  toggleAnimal: (a: AnimalDef) => void;
  updateBetAmount: (num: number, amount: number) => void;
  betAmount: number;
  setBetAmount: (n: number) => void;
  totalBet: number;
  balance: number;
  placing: boolean;
  placeBet: () => void;
  haptic: (t?: 'light'|'medium'|'heavy') => void;
}) {
  const AMOUNTS = [50, 100, 200, 500, 1000];

  return (
    <div className="mt-1 mb-1 bg-[#0a1520] border border-teal-500/20 rounded-2xl p-4">
      {/* Monto por defecto */}
      <div className="mb-3">
        <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Monto por animal</p>
        <div className="flex gap-1.5 flex-wrap">
          {AMOUNTS.map(a => (
            <button
              key={a}
              onClick={() => { haptic('light'); setBetAmount(a); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${betAmount === a ? 'bg-teal-500 text-white' : 'bg-white/8 text-white/50'}`}
            >{a}🥬</button>
          ))}
        </div>
      </div>

      {/* Grid de animales */}
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Selecciona animales (máx 5)</p>
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {ANIMALS.map(a => {
          const sel = betSelections.find(s => s.animal.number === a.number);
          return (
            <button
              key={a.number}
              onClick={() => toggleAnimal(a)}
              className={`flex flex-col items-center py-2 rounded-xl transition-all border ${
                sel ? 'border-teal-400/60 bg-teal-500/20' : 'border-white/5 bg-white/5 active:bg-white/10'
              }`}
            >
              <span className="text-xl leading-tight">{a.emoji}</span>
              <span className="text-[8px] text-white/50 mt-0.5 leading-tight">{a.number}</span>
            </button>
          );
        })}
      </div>

      {/* Selecciones actuales */}
      {betSelections.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Tu apuesta</p>
          {betSelections.map(sel => (
            <div key={sel.animal.number} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
              <span className="text-lg">{sel.animal.emoji}</span>
              <span className="text-white text-xs font-semibold flex-1">{sel.animal.name}</span>
              <div className="flex gap-1">
                {[50,100,200,500].map(a => (
                  <button
                    key={a}
                    onClick={() => { haptic('light'); updateBetAmount(sel.animal.number, a); }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${sel.amount === a ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/40'}`}
                  >{a}</button>
                ))}
              </div>
              <span className="text-teal-300 text-xs font-bold ml-1">{sel.amount}🥬</span>
            </div>
          ))}
        </div>
      )}

      {/* Resumen y botón */}
      {betSelections.length > 0 && (
        <div className="border-t border-white/8 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs">Total apuesta</span>
            <span className="text-white font-bold">{totalBet} 🥬</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/50 text-xs">Premio máximo</span>
            <span className="text-teal-300 font-bold">{totalBet * 30} 🥬</span>
          </div>
          <button
            onClick={placeBet}
            disabled={placing || totalBet > balance}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 bg-gradient-to-r from-teal-500 to-emerald-500 text-white"
          >
            {placing ? '⏳ Procesando...' : totalBet > balance ? '💸 Saldo insuficiente' : `🎯 Apostar ${totalBet} 🥬`}
          </button>
        </div>
      )}
    </div>
  );
}
