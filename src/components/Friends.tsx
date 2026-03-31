import { useState, useEffect, useCallback } from 'react';
import { apiCall, haptic as globalHaptic } from '../App';

interface Referral {
  telegramId: string;
  username: string;
  joinedAt: string;
  earned: number;
  betsCount: number;
}

interface Props {
  telegramId: string;
  username: string;
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
  balance: number;
  onBalanceUpdate: (n: number) => void;
  showAlert: (msg: string) => void;
  haptic: typeof globalHaptic;
}

const REFERRAL_BONUS_INVITER = 500;  // 🥬 que gana quien invita
const REFERRAL_BONUS_INVITED = 200;  // 🥬 extra que gana el invitado
const REFERRAL_PERCENT = 5;          // % de comisión de apuestas del referido

export default function Friends({
  telegramId,
  // username,
  referralCode,
  referralCount,
  referralEarnings,
  onBalanceUpdate,
  showAlert,
  haptic,
}: Props) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pendingBonus, setPendingBonus] = useState(0);
  const [claiming, setClaiming] = useState(false);

  const botUsername = 'AnimalitoLottoBot'; // ← cambia esto a tu bot
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

  // ── Cargar referidos ────────────────────────────────────────
  const loadReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall({
        telegramId,
        action: 'getReferrals',
      }) as { success?: boolean; referrals?: Referral[]; pendingBonus?: number; error?: string };

      if (data?.success) {
        setReferrals(data.referrals || []);
        setPendingBonus(data.pendingBonus || 0);
      }
    } catch { /* ignorar */ }
    finally { setLoading(false); }
  }, [telegramId]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  // ── Copiar enlace ───────────────────────────────────────────
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      haptic('medium');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showAlert('Link: ' + referralLink);
    }
  };

  // ── Compartir en Telegram ───────────────────────────────────
  const shareOnTelegram = () => {
    haptic('medium');
    const msg = encodeURIComponent(
      `🎰 ¡Juega Animalito Lotto y gana TON!\n\n` +
      `🥬 Te regalo ${REFERRAL_BONUS_INVITED} lechugas de bienvenida\n` +
      `💰 Sorteos cada hora + Flash cada 5 min\n\n` +
      `👇 Entra aquí:`
    );
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${msg}`;
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  // ── Reclamar bonos pendientes ───────────────────────────────
  const claimBonus = async () => {
    if (pendingBonus <= 0 || claiming) return;
    haptic('heavy');
    setClaiming(true);
    try {
      const data = await apiCall({
        telegramId,
        action: 'claimReferralBonus',
      }) as { success?: boolean; newBalance?: number; claimed?: number; error?: string };

      if (data?.success && data.newBalance !== undefined) {
        onBalanceUpdate(data.newBalance);
        showAlert(`✅ ¡Reclamaste ${(data.claimed || 0).toLocaleString()} 🥬 de tus referidos!`);
        setPendingBonus(0);
        loadReferrals();
      } else {
        showAlert('❌ ' + (data?.error || 'Error al reclamar'));
      }
    } catch (err) {
      showAlert('❌ ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setClaiming(false);
    }
  };

  // ── Fecha legible ───────────────────────────────────────────
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return '—'; }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ── Título ── */}
      <div className="text-center pt-2">
        <p className="text-3xl mb-1">👥</p>
        <h2 className="text-white font-black text-xl">Invita Amigos</h2>
        <p className="text-white/50 text-xs mt-1">Gana 🥬 por cada amigo que juegue</p>
      </div>

      {/* ── Stats de referidos ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: '👤', label: 'Amigos', value: referralCount },
          { icon: '💰', label: 'Ganado', value: `${referralEarnings.toLocaleString()}🥬` },
          { icon: '⏳', label: 'Pendiente', value: `${pendingBonus.toLocaleString()}🥬` },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-xl mb-0.5">{stat.icon}</p>
            <p className="text-white font-black text-sm">{stat.value}</p>
            <p className="text-white/40 text-[10px]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Reclamar bonus pendiente ── */}
      {pendingBonus > 0 && (
        <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/40 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-300 font-bold text-sm">🎁 Bonus disponible</p>
              <p className="text-white font-black text-lg">{pendingBonus.toLocaleString()} 🥬</p>
              <p className="text-white/50 text-xs">Comisiones de tus referidos</p>
            </div>
            <button
              onClick={claimBonus}
              disabled={claiming}
              className="bg-teal-500 hover:bg-teal-400 text-white font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm"
            >
              {claiming ? '⏳...' : '✅ Reclamar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Cómo funciona ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <p className="text-white font-bold text-sm">💡 Cómo funciona el programa</p>
        {[
          { icon: '🔗', text: `Comparte tu enlace personal` },
          { icon: '🎁', text: `Tu amigo recibe ${REFERRAL_BONUS_INVITED} 🥬 de bienvenida` },
          { icon: '💰', text: `Tú ganas ${REFERRAL_BONUS_INVITER} 🥬 por cada amigo` },
          { icon: '📊', text: `+ ${REFERRAL_PERCENT}% de comisión de sus apuestas` },
          { icon: '♾️', text: `¡Sin límite de referidos!` },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg w-7 text-center flex-shrink-0">{item.icon}</span>
            <p className="text-white/70 text-xs leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      {/* ── Tu link de referido ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <p className="text-white font-bold text-sm">🔗 Tu enlace personal</p>
        <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-white/60 text-xs truncate flex-1">{referralLink}</p>
          <button
            onClick={copyLink}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${
              copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copied ? '✅ Copiado' : '📋 Copiar'}
          </button>
        </div>
        <p className="text-white/40 text-[10px] text-center">
          Código: <span className="text-teal-300 font-bold">{referralCode}</span>
        </p>
      </div>

      {/* ── Botón de compartir ── */}
      <button
        onClick={shareOnTelegram}
        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-base shadow-lg shadow-teal-500/25"
      >
        📤 Compartir en Telegram
      </button>

      {/* ── Lista de referidos ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-white font-bold text-sm">👥 Tus amigos ({referralCount})</p>
          <button onClick={loadReferrals} className="text-white/40 text-xs hover:text-white/70">
            🔄 Actualizar
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-white/40 text-sm">⏳ Cargando...</p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-4xl">🫂</p>
            <p className="text-white/50 text-sm">Aún no tienes referidos</p>
            <p className="text-white/30 text-xs">¡Comparte tu enlace y gana 🥬!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {referrals.map((ref, i) => (
              <div key={ref.telegramId} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-xs">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {ref.username || `Usuario ${ref.telegramId.slice(-4)}`}
                  </p>
                  <p className="text-white/40 text-[10px]">
                    Desde {formatDate(ref.joinedAt)} · {ref.betsCount || 0} apuestas
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-teal-300 font-bold text-xs">
                    +{(ref.earned || 0).toLocaleString()} 🥬
                  </p>
                  <p className="text-white/30 text-[10px]">ganado</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ranking / motivación ── */}
      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center space-y-1">
        <p className="text-2xl">🏆</p>
        <p className="text-white font-bold text-sm">¡Top Referidor!</p>
        <p className="text-white/50 text-xs">
          El referidor con más amigos activos cada mes<br/>
          recibirá un <span className="text-yellow-400 font-bold">premio especial en TON</span>
        </p>
      </div>

    </div>
  );
}
