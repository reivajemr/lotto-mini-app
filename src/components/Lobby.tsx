import { useState } from 'react';
import { saveBetResult } from '../api';

const ANIMALS = [
  { name: 'Delfín', emoji: '🐬', number: '00' },
  { name: 'Carnero', emoji: '🐏', number: '01' },
  { name: 'Toro', emoji: '🐂', number: '02' },
  { name: 'Ciempiés', emoji: '🐛', number: '03' },
  { name: 'Alacrán', emoji: '🦂', number: '04' },
  { name: 'León', emoji: '🦁', number: '05' },
  { name: 'Rana', emoji: '🐸', number: '06' },
  { name: 'Perico', emoji: '🦜', number: '07' },
  { name: 'Ratón', emoji: '🐭', number: '08' },
  { name: 'Águila', emoji: '🦅', number: '09' },
  { name: 'Tigre', emoji: '🐅', number: '10' },
  { name: 'Gato', emoji: '🐱', number: '11' },
  { name: 'Caballo', emoji: '🐴', number: '12' },
  { name: 'Mono', emoji: '🐒', number: '13' },
  { name: 'Paloma', emoji: '🕊️', number: '14' },
  { name: 'Zorro', emoji: '🦊', number: '15' },
  { name: 'Oso', emoji: '🐻', number: '16' },
  { name: 'Pavo', emoji: '🦃', number: '17' },
  { name: 'Burro', emoji: '🫏', number: '18' },
  { name: 'Chivo', emoji: '🐐', number: '19' },
  { name: 'Cochino', emoji: '🐷', number: '20' },
  { name: 'Gallo', emoji: '🐓', number: '21' },
  { name: 'Camello', emoji: '🐪', number: '22' },
  { name: 'Cebra', emoji: '🦓', number: '23' },
  { name: 'Iguana', emoji: '🦎', number: '24' },
  { name: 'Gallina', emoji: '🐔', number: '25' },
  { name: 'Vaca', emoji: '🐄', number: '26' },
  { name: 'Perro', emoji: '🐕', number: '27' },
  { name: 'Zamuro', emoji: '🪶', number: '28' },
  { name: 'Elefante', emoji: '🐘', number: '29' },
  { name: 'Caimán', emoji: '🐊', number: '30' },
  { name: 'Lapa', emoji: '🐹', number: '31' },
  { name: 'Ardilla', emoji: '🐿️', number: '32' },
  { name: 'Pescado', emoji: '🐟', number: '33' },
  { name: 'Venado', emoji: '🦌', number: '34' },
  { name: 'Jirafa', emoji: '🦒', number: '35' },
  { name: 'Culebra', emoji: '🐍', number: '36' },
];

const SORTEOS = [
  { name: 'Lotto Activo', hora: '09:00 AM', color: 'from-blue-600 to-blue-800' },
  { name: 'La Granjita', hora: '10:00 AM', color: 'from-green-600 to-green-800' },
  { name: 'Lotto Rey', hora: '11:00 AM', color: 'from-purple-600 to-purple-800' },
  { name: 'Gran Animalito', hora: '12:00 PM', color: 'from-orange-600 to-orange-800' },
];

interface LobbyProps {
  balance: number;
  onBalanceChange: (newBalance: number) => void;
  showAlert: (message: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  telegramId: string;
  username: string;
}

export default function Lobby({ balance, onBalanceChange, showAlert, haptic, telegramId, username }: LobbyProps) {
  const [selectedSorteo, setSelectedSorteo] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<typeof ANIMALS[0] | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [showResult, setShowResult] = useState(false);
  const [resultAnimal, setResultAnimal] = useState<typeof ANIMALS[0] | null>(null);
  const [won, setWon] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  const handleSelectSorteo = (name: string) => {
    haptic('light');
    setSelectedSorteo(name);
    setSelectedAnimal(null);
    setShowResult(false);
  };

  const handleSelectAnimal = (animal: typeof ANIMALS[0]) => {
    haptic('light');
    setSelectedAnimal(animal);
  };

  const handleBet = () => {
    if (!selectedAnimal || !selectedSorteo) {
      showAlert('Selecciona un sorteo y un animalito');
      return;
    }
    if (balance < betAmount) {
      showAlert(`❌ Saldo insuficiente. Tienes ${balance} 🥬`);
      return;
    }

    haptic('heavy');
    setIsSpinning(true);
    setShowResult(false);

    // Simulate lottery
    setTimeout(async () => {
      const winnerIndex = Math.floor(Math.random() * ANIMALS.length);
      const winner = ANIMALS[winnerIndex];
      const didWin = winner.number === selectedAnimal.number;

      let newBalance: number;
      if (didWin) {
        const prize = betAmount * 35;
        newBalance = balance - betAmount + prize;
      } else {
        newBalance = balance - betAmount;
      }

      setResultAnimal(winner);
      setWon(didWin);
      setShowResult(true);
      setIsSpinning(false);
      onBalanceChange(newBalance);

      if (didWin) {
        haptic('heavy');
      } else {
        haptic('light');
      }

      // Sincronizar resultado con MongoDB
      try {
        await saveBetResult(
          telegramId,
          username,
          selectedSorteo,
          `${selectedAnimal.emoji} ${selectedAnimal.name} (${selectedAnimal.number})`,
          `${winner.emoji} ${winner.name} (${winner.number})`,
          betAmount,
          didWin,
          newBalance
        );
      } catch (err) {
        console.error('Error syncing bet:', err);
      }
    }, 2000);
  };

  const handleBack = () => {
    haptic('light');
    setSelectedSorteo(null);
    setSelectedAnimal(null);
    setShowResult(false);
  };

  // ---- SORTEO SELECTION VIEW ----
  if (!selectedSorteo) {
    return (
      <div className="space-y-4">
        {/* Hero */}
        <div className="rounded-2xl border border-white/5 bg-[rgba(45,45,45,0.8)] p-6 text-center">
          <span className="text-5xl">🎰</span>
          <h1 className="mt-3 text-xl font-bold text-white">Lobby de Animalitos</h1>
          <p className="mt-1 text-sm text-gray-400">
            ¡Selecciona tu sorteo favorito y prueba tu suerte!
          </p>
        </div>

        {/* Sorteos Grid */}
        <div className="grid grid-cols-2 gap-3">
          {SORTEOS.map((s) => (
            <button
              key={s.name}
              onClick={() => handleSelectSorteo(s.name)}
              className={`rounded-xl bg-gradient-to-br ${s.color} p-4 text-left shadow-lg transition-transform active:scale-95`}
            >
              <span className="text-2xl">🎲</span>
              <h3 className="mt-2 text-sm font-bold text-white">{s.name}</h3>
              <p className="mt-0.5 text-xs text-white/60">Próximo: {s.hora}</p>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-white/5 bg-[rgba(45,45,45,0.8)] p-4">
          <h3 className="mb-3 text-sm font-bold text-white">📊 Estadísticas</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-[#0088cc]">37</p>
              <p className="text-[10px] text-gray-400">Animalitos</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-[#4caf50]">x35</p>
              <p className="text-[10px] text-gray-400">Premio</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-yellow-400">24/7</p>
              <p className="text-[10px] text-gray-400">Sorteos</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- ANIMAL SELECTION + BETTING VIEW ----
  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          ←
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{selectedSorteo}</h2>
          <p className="text-xs text-gray-400">Selecciona tu animalito</p>
        </div>
      </div>

      {/* Result Modal */}
      {showResult && resultAnimal && (
        <div className={`rounded-2xl border p-5 text-center ${
          won
            ? 'border-green-500/30 bg-green-900/30'
            : 'border-red-500/30 bg-red-900/30'
        }`}>
          <span className="text-5xl">{resultAnimal.emoji}</span>
          <h3 className={`mt-2 text-lg font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
            {won ? '🎉 ¡GANASTE!' : '😔 No ganaste'}
          </h3>
          <p className="text-sm text-gray-300">
            Salió: {resultAnimal.emoji} {resultAnimal.name} ({resultAnimal.number})
          </p>
          {won && (
            <p className="mt-1 text-lg font-bold text-green-400">
              +{(betAmount * 35).toLocaleString()} 🥬
            </p>
          )}
          {!won && (
            <p className="mt-1 text-sm text-red-400">
              -{betAmount.toLocaleString()} 🥬
            </p>
          )}
        </div>
      )}

      {/* Spinning Animation */}
      {isSpinning && (
        <div className="flex flex-col items-center rounded-2xl border border-yellow-500/30 bg-yellow-900/20 p-6">
          <div className="animate-bounce text-5xl">🎰</div>
          <p className="mt-2 animate-pulse text-sm font-bold text-yellow-400">
            Sorteando...
          </p>
        </div>
      )}

      {/* Selected Animal + Bet */}
      {selectedAnimal && !isSpinning && (
        <div className="rounded-2xl border border-[#0088cc]/30 bg-[#0088cc]/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedAnimal.emoji}</span>
              <div>
                <p className="font-bold text-white">
                  {selectedAnimal.name} ({selectedAnimal.number})
                </p>
                <p className="text-xs text-gray-400">Tu selección</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-gray-400">Apuesta:</label>
            <div className="flex gap-1.5">
              {[50, 100, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setBetAmount(amt); haptic('light'); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    betAmount === amt
                      ? 'bg-[#0088cc] text-white'
                      : 'bg-white/10 text-gray-300'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleBet}
            disabled={isSpinning}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#0088cc] to-[#00aaff] py-3 text-sm font-bold text-white shadow-lg shadow-[#0088cc]/30 transition-transform active:scale-95 disabled:opacity-50"
          >
            🎲 Apostar {betAmount.toLocaleString()} 🥬
          </button>
        </div>
      )}

      {/* Animals Grid */}
      <div className="grid grid-cols-4 gap-2">
        {ANIMALS.map((animal) => (
          <button
            key={animal.number}
            onClick={() => handleSelectAnimal(animal)}
            className={`flex flex-col items-center rounded-xl border p-2 transition-all active:scale-95 ${
              selectedAnimal?.number === animal.number
                ? 'border-[#0088cc] bg-[#0088cc]/20 shadow-lg shadow-[#0088cc]/20'
                : 'border-white/5 bg-[rgba(45,45,45,0.6)] hover:border-white/20'
            }`}
          >
            <span className="text-xl">{animal.emoji}</span>
            <span className="mt-0.5 text-[10px] font-medium text-gray-300">{animal.name}</span>
            <span className="text-[9px] text-gray-500">{animal.number}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
