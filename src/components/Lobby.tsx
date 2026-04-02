import { useState, useEffect } from 'react';
import { apiCall } from '../App';

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
  status: 'open' | 'closed' | 'done';
  winnerNumber?: number | null;
  winnerAnimal?: string | null;
}

interface Animal {
  name: string;
  number: number;
  emoji: string;
}

const ANIMALS: Animal[] = [
  { name: 'Carnero',   number: 1,  emoji: '🐑' },
  { name: 'Toro',      number: 2,  emoji: '🐂' },
  { name: 'Ciempiés',  number: 3,  emoji: '🐛' },
  { name: 'Alacran',   number: 4,  emoji: '🦂' },
  { name: 'Perico',    number: 5,  emoji: '🦜' },
  { name: 'Conejo',    number: 6,  emoji: '🐰' },
  { name: 'Burro',     number: 7,  emoji: '🫏' },
  { name: 'Cochino',   number: 8,  emoji: '🐷' },
  { name: 'Aguila',    number: 9,  emoji: '🦅' },
  { name: 'Tigre',     number: 10, emoji: '🐯' },
  { name: 'Elefante',  number: 11, emoji: '🐘' },
  { name: 'Camello',   number: 12, emoji: '🐪' },
  { name: 'Zorro',     number: 13, emoji: '🦊' },
  { name: 'Mono',      number: 14, emoji: '🐒' },
  { name: 'Gallina',   number: 15, emoji: '🐔' },
  { name: 'Gato',      number: 16, emoji: '🐱' },
  { name: 'Perro',     number: 17, emoji: '🐶' },
  { name: 'Paloma',    number: 18, emoji: '🕊️' },
  { name: 'Iguana',    number: 19, emoji: '🦎' },
  { name: 'Lapa',      number: 20, emoji: '🦀' },
  { name: 'León',      number: 21, emoji: '🦁' },
  { name: 'Delfin',    number: 22, emoji: '🐬' },
  { name: 'Ballena',   number: 23, emoji: '🐋' },
  { name: 'Ardilla',   number: 24, emoji: '🐿️' },
  { name: 'Cebra',     number: 25, emoji: '🦓' },
  { name: 'Jirafa',    number: 26, emoji: '🦒' },
  { name: 'Oso',       number: 27, emoji: '🐻' },
  { name: 'Culebra',   number: 28, emoji: '🐍' },
  { name: 'Caiman',    number: 29, emoji: '🐊' },
  { name: 'Pavo',      number: 30, emoji: '🦃' },
  { name: 'Caballo',   number: 31, emoji: '🐴' },
  { name: 'Chivo',     number: 32, emoji: '🐐' },
  { name: 'Gallo',     number: 33, emoji: '🐓' },
  { name: 'Toro negro', number: 34, emoji: '🦬' },
  { name: 'Oveja',     number: 35, emoji: '🐑' },
  { name: 'Conejo bl.',number: 36, emoji: '🐇' },
];

const GAMES = [
  { id: 'lotto', label: 'Lotto Venezuela', icon: '🎰' },
  { id: 'granja', label: 'La Granja', icon: '🌾' },
];

export default function Lobby({
  telegramId,
  username,
  balance,
  onBalanceUpdate,
  showAlert,
  haptic,
}: LobbyProps) {
  const [selectedGame, setSelectedGame] = useState('lotto');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [selectedAnimals, setSelectedAnimals] = useState<{ animal: Animal; amount: number }[]>([]);
  const [betAmount, setBetAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [ticketSent, setTicketSent] = useState<string | null>(null);

  useEffect(() => {
    loadDraws();
    const iv = setInterval(loadDraws, 30000);
    return () => clearInterval(iv);
  }, [selectedGame]);

  const loadDraws = async () => {
    setLoadingDraws(true);
    try {
      const data = await apiCall({
        telegramId, action: 'getDraws', game: selectedGame,
      }) as { draws?: Draw[] };
      if (data?.draws) {
        setDraws(data.draws);
        if (!selectedDraw && data.draws.length > 0) {
          const open = data.draws.find(d => d.status === 'open');
          setSelectedDraw(open || data.draws[0]);
        }
      }
    } catch { /* ignorar */ }
    finally { setLoadingDraws(false); }
  };

  const toggleAnimal = (animal: Animal) => {
    haptic('light');
    setSelectedAnimals(prev => {
      const exists = prev.find(a => a.animal.number === animal.number);
      if (exists) return prev.filter(a => a.animal.number !== animal.number);
      if (prev.length >= 5) { showAlert('Máximo 5 animales por ticket'); return prev; }
      return [...prev, { animal, amount: betAmount }];
    });
  };

  const isSelected = (animal: Animal) =>
    selectedAnimals.some(a => a.animal.number === animal.number);

  const totalBet = selectedAnimals.reduce((s, a) => s + a.amount, 0);

  const placeBet = async () => {
    if (!selectedDraw) { showAlert('⚠️ Selecciona un sorteo'); return; }
    if (selectedAnimals.length === 0) { showAlert('⚠️ Selecciona al menos un animal'); return; }
    if (totalBet > balance) { showAlert('⚠️ Saldo insuficiente'); return; }

    haptic('heavy');
    setLoading(true);
    try {
      const data = await apiCall({
        telegramId, username, action: 'placeBet',
        drawId: selectedDraw.drawId,
        drawGame: selectedGame,
        bets: selectedAnimals.map(a => ({
          animal: a.animal.name,
          number: a.animal.number,
          amount: a.amount,
        })),
      }) as { success?: boolean; ticket?: { ticketId: string }; newBalance?: number; error?: string; message?: string };

      if (data?.success) {
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        setTicketSent(data.ticket?.ticketId || 'OK');
        setSelectedAnimals([]);
        showAlert(data.message || '✅ ¡Ticket registrado!');
      } else {
        showAlert('❌ ' + (data?.error || 'Error al apostar'));
      }
    } catch (err) {
      showAlert('❌ Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (drawId: string) => {
    const parts = drawId.split('-');
    const timeStr = parts[parts.length - 1];
    if (timeStr && timeStr.length >= 4) {
      return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
    }
    return drawId;
  };

  return (
    <div className="p-4 space-y-4">
      {/* ── Selector de juego ── */}
      <div className="flex gap-2">
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => { setSelectedGame(g.id); setSelectedDraw(null); setSelectedAnimals([]); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              selectedGame === g.id
                ? 'bg-teal-500 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            <span>{g.icon}</span>
            <span className="text-xs">{g.label}</span>
          </button>
        ))}
      </div>

      {/* ── Selector de sorteo ── */}
      <div>
        <p className="text-white/50 text-xs mb-2">Sorteos disponibles:</p>
        {loadingDraws ? (
          <div className="text-center py-4 text-white/30 text-sm animate-pulse">Cargando sorteos...</div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draws.map(draw => (
              <button
                key={draw.drawId}
                onClick={() => setSelectedDraw(draw)}
                disabled={draw.status !== 'open'}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  selectedDraw?.drawId === draw.drawId
                    ? 'bg-teal-500 border-teal-400 text-white'
                    : draw.status === 'open'
                      ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <div className="font-mono">{formatTime(draw.drawId)}</div>
                <div className={`text-[9px] mt-0.5 ${
                  draw.status === 'open' ? 'text-teal-300' :
                  draw.status === 'done' ? 'text-white/30' : 'text-red-300'
                }`}>
                  {draw.status === 'open' ? '✅ Abierto' :
                   draw.status === 'done' ? `🏆 ${draw.winnerAnimal || '?'}` : '🔒 Cerrado'}
                </div>
              </button>
            ))}
            {draws.length === 0 && (
              <p className="text-white/30 text-sm py-2">No hay sorteos disponibles</p>
            )}
          </div>
        )}
      </div>

      {/* ── Configurar apuesta ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/50 text-xs">Apuesta por animal:</p>
          <p className="text-teal-400 font-bold text-sm">{betAmount} 🥬</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[50, 100, 200, 500, 1000].map(amt => (
            <button
              key={amt}
              onClick={() => { setBetAmount(amt); setSelectedAnimals(prev => prev.map(a => ({...a, amount: amt}))); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                betAmount === amt
                  ? 'bg-teal-500 text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              {amt}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de animales ── */}
      <div>
        <p className="text-white/50 text-xs mb-2">Selecciona animales ({selectedAnimals.length}/5):</p>
        <div className="grid grid-cols-4 gap-2">
          {ANIMALS.slice(0, 36).map(animal => (
            <button
              key={animal.number}
              onClick={() => toggleAnimal(animal)}
              disabled={!selectedDraw || selectedDraw.status !== 'open'}
              className={`flex flex-col items-center p-2 rounded-xl border transition-all active:scale-95 disabled:opacity-40 ${
                isSelected(animal)
                  ? 'bg-teal-500/20 border-teal-400/50 scale-[1.02]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-2xl">{animal.emoji}</span>
              <span className="text-[9px] text-white/50 mt-0.5 leading-none">{animal.name}</span>
              <span className="text-[9px] text-white/25">#{animal.number}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Selección activa ── */}
      {selectedAnimals.length > 0 && (
        <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-teal-300 font-bold text-sm">Tu selección</p>
            <button
              onClick={() => setSelectedAnimals([])}
              className="text-white/30 hover:text-red-400 text-xs transition-colors"
            >
              Limpiar ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedAnimals.map(({ animal }) => (
              <div key={animal.number} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                <span className="text-sm">{animal.emoji}</span>
                <span className="text-white/70 text-xs">{animal.name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div>
              <p className="text-white/50 text-xs">Total apuesta</p>
              <p className="text-white font-bold">{totalBet.toLocaleString()} 🥬</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">Premio potencial</p>
              <p className="text-teal-300 font-bold">{(betAmount * 30).toLocaleString()} 🥬</p>
            </div>
          </div>
          <button
            onClick={placeBet}
            disabled={loading || !selectedDraw || selectedDraw.status !== 'open' || totalBet > balance}
            className="w-full mt-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Procesando...' : `🎯 Apostar ${totalBet.toLocaleString()} 🥬`}
          </button>
        </div>
      )}

      {/* ── Último ticket ── */}
      {ticketSent && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
          <p className="text-teal-300 font-bold text-sm">🎫 Ticket enviado</p>
          <p className="text-white/40 text-xs font-mono mt-1">{ticketSent}</p>
        </div>
      )}

      {/* ── Info sorteo ── */}
      <div className="bg-white/3 rounded-xl p-4 text-xs text-white/40 space-y-1">
        <p className="font-bold text-white/60">ℹ️ Cómo jugar:</p>
        <p>• Sorteos cada hora, cierran 10 min antes</p>
        <p>• Acertá el animal ganador → x30 tu apuesta</p>
        <p>• Mínimo 50 🥬 / Máximo 1,000 🥬 por animal</p>
      </div>
    </div>
  );
}
