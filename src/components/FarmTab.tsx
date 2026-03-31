import { useState, useEffect, useRef } from 'react';
import type { AppUser } from '../types';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
}

const FARM_RATE = 10; // 10 lechugas per hour
const CLAIM_INTERVAL_HOURS = 8;
const CLAIM_INTERVAL_MS = CLAIM_INTERVAL_HOURS * 60 * 60 * 1000;

export default function FarmTab({ user, onBalanceUpdate, showAlert, haptic }: Props) {
  const [farmed, setFarmed] = useState(0);
  const [lastClaim, setLastClaim] = useState<Date | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Load last claim from localStorage
    const stored = localStorage.getItem(`farm_claim_${user.telegramId}`);
    if (stored) {
      const d = new Date(stored);
      setLastClaim(d);
    }
  }, [user.telegramId]);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = lastClaim ? lastClaim.getTime() : now - CLAIM_INTERVAL_MS;
      const elapsed = Math.min(now - start, CLAIM_INTERVAL_MS);
      const earned = Math.floor((elapsed / (1000 * 60 * 60)) * FARM_RATE);
      setFarmed(earned);
      setCanClaim(elapsed >= CLAIM_INTERVAL_MS);
    };
    update();
    intervalRef.current = setInterval(update, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [lastClaim]);

  const handleClaim = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    haptic('success');

    try {
      const res = await fetch('/api/farm-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.telegramId, amount: farmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert(err.error || 'Error al reclamar cosecha');
        return;
      }

      const data = await res.json();
      const now = new Date();
      setLastClaim(now);
      localStorage.setItem(`farm_claim_${user.telegramId}`, now.toISOString());
      onBalanceUpdate(data.newBalance);
      setFarmed(0);
      setCanClaim(false);
      showAlert(`🌾 ¡Cosecha reclamada!\n+${farmed} 🥬 Lechugas`);
    } catch {
      showAlert('Error de conexión');
    } finally {
      setClaiming(false);
    }
  };

  const nextClaimIn = () => {
    if (!lastClaim) return '¡Ahora!';
    const next = lastClaim.getTime() + CLAIM_INTERVAL_MS;
    const diff = next - Date.now();
    if (diff <= 0) return '¡Ahora!';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const progress = lastClaim
    ? Math.min(100, ((Date.now() - lastClaim.getTime()) / CLAIM_INTERVAL_MS) * 100)
    : 100;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="mx-4 bg-gradient-to-br from-green-700 to-green-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="text-center">
          <div className="text-4xl mb-1">🌾</div>
          <div className="font-bold text-lg">La Granja</div>
          <div className="text-green-200 text-xs mt-1">
            Produce {FARM_RATE} 🥬 por hora · Máx cada {CLAIM_INTERVAL_HOURS}h
          </div>
        </div>
      </div>

      {/* Farm card */}
      <div className="mx-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-2">{canClaim ? '🌿' : '🌱'}</div>
          <div className="text-3xl font-bold text-green-700">{farmed} 🥬</div>
          <div className="text-xs text-gray-500 mt-1">Lechugas acumuladas</div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progreso de cosecha</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-lg font-bold text-green-700">{FARM_RATE}</div>
            <div className="text-xs text-gray-500">🥬 / hora</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <div className="text-lg font-bold text-amber-700">{canClaim ? '¡Ya!' : nextClaimIn()}</div>
            <div className="text-xs text-gray-500">Próxima cosecha</div>
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            canClaim
              ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {claiming ? '⏳ Cosechando...' :
           canClaim ? `🌾 Cosechar ${farmed} 🥬` :
           `⏳ Disponible en ${nextClaimIn()}`}
        </button>
      </div>

      {/* Tips */}
      <div className="mx-4 bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
        <div className="font-bold text-green-800 text-sm">💡 Tips de la Granja</div>
        <div className="text-xs text-green-700 space-y-1">
          <div>🌱 Tu granja produce lechugas automáticamente</div>
          <div>⏰ Reclama cada {CLAIM_INTERVAL_HOURS} horas para no perder producción</div>
          <div>🎰 Usa las lechugas para jugar al Lotto</div>
          <div>💎 Deposita TON para obtener más lechugas</div>
        </div>
      </div>
    </div>
  );
}
