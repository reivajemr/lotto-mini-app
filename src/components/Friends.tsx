import { useState, useEffect } from 'react';
import { apiCall } from '../App';

interface FriendsProps {
  telegramId: string;
  username: string;
  referralCode: string;
  referralCount: number;
  referralEarnings: number;
  balance: number;
  onBalanceUpdate: (b: number) => void;
  showAlert: (msg: string) => void;
  haptic: (t?: 'light' | 'medium' | 'heavy') => void;
}

interface ReferredUser { username: string; createdAt: string; }

export default function Friends({
  telegramId, referralCode: initialCode, referralCount: initialCount,
  referralEarnings: initialEarnings, onBalanceUpdate, showAlert, haptic
}: FriendsProps) {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [refCode, setRefCode] = useState(initialCode);
  const [refCount, setRefCount] = useState(initialCount);
  const [refEarnings, setRefEarnings] = useState(initialEarnings);
  const [pendingBonus, setPendingBonus] = useState(0);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const data = await apiCall({ action: 'getReferrals', telegramId }) as any;
      if (data?.success) {
        setRefCode(data.referralCode || initialCode);
        setRefCount(data.referralCount || 0);
        setRefEarnings(data.referralEarnings || 0);
        setPendingBonus(data.pendingBonus || 0);
        setReferredUsers(data.referredUsers || []);
      }
    } catch { /* ignorar */ }
    setLoading(false);
  };

  const botUsername = 'AnimalitoLottoBot'; // ← Cambia por tu bot
  const refLink = `https://t.me/${botUsername}?start=${refCode}`;

  const shareLink = () => {
    haptic('medium');
    const tg = (window as any).Telegram?.WebApp;
    const text = `🎰 ¡Juega Animalito Lotto conmigo!\n\n🎁 Recibes 1,200 🥬 de bienvenida\n💰 Gana hasta x30 tu apuesta\n\n👇 Únete aquí:`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard?.writeText(refLink).then(() => showAlert('✅ Link copiado al portapapeles'));
    }
  };

  const copyLink = () => {
    haptic('light');
    navigator.clipboard?.writeText(refLink)
      .then(() => showAlert('✅ Link copiado!'))
      .catch(() => showAlert('Link: ' + refLink));
  };

  const claimBonus = async () => {
    if (pendingBonus <= 0) { showAlert('No tienes bonus pendiente 😅'); return; }
    haptic('medium');
    setClaiming(true);
    try {
      const data = await apiCall({ action: 'claimReferralBonus', telegramId }) as any;
      if (data?.success) {
        onBalanceUpdate(data.newBalance);
        showAlert(`✅ ¡Reclamaste ${data.claimed} 🥬!\nNuevo saldo: ${data.newBalance} 🥬`);
        setPendingBonus(0);
        haptic('heavy');
      } else {
        showAlert('❌ ' + (data?.error || 'Error al reclamar'));
      }
    } catch { showAlert('❌ Error de conexión'); }
    setClaiming(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="text-4xl animate-bounce">👥</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="text-center py-2">
        <div className="text-5xl mb-2">👥</div>
        <h2 className="text-white font-black text-xl">Invita Amigos</h2>
        <p className="text-white/40 text-xs mt-1">Gana recompensas por cada amigo que se una</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-teal-300">{refCount}</p>
          <p className="text-white/40 text-[10px] mt-0.5">Amigos</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
          <p className="text-xl font-black text-yellow-300">{refEarnings.toLocaleString()}</p>
          <p className="text-white/40 text-[10px] mt-0.5">🥬 Ganadas</p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
          <p className="text-xl font-black text-green-300">5%</p>
          <p className="text-white/40 text-[10px] mt-0.5">Comisión</p>
        </div>
      </div>

      {/* Bonus pendiente */}
      {pendingBonus > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-green-300 font-bold text-sm">🎁 Bonus disponible</p>
            <p className="text-green-400 font-black text-xl">{pendingBonus} 🥬</p>
          </div>
          <button
            onClick={claimBonus}
            disabled={claiming}
            className="bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {claiming ? '⏳...' : '¡Reclamar!'}
          </button>
        </div>
      )}

      {/* Como funciona */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">¿Cómo funciona?</p>
        <div className="space-y-2.5">
          {[
            { icon: '🔗', title: 'Comparte tu link', desc: 'Envía tu link único a tus amigos' },
            { icon: '🎁', title: 'Ellos reciben +200 🥬', desc: 'Bonus extra al registrarse contigo' },
            { icon: '💰', title: 'Tú recibes +500 🥬', desc: 'Por cada amigo que se une' },
            { icon: '📊', title: '5% de comisión', desc: 'De cada apuesta que hagan tus referidos' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-white text-xs font-semibold">{item.title}</p>
                <p className="text-white/40 text-[11px]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tu link de referido */}
      <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4">
        <p className="text-teal-300/70 text-[10px] uppercase tracking-wider mb-2">Tu link de referido</p>
        <div className="bg-black/30 rounded-xl px-3 py-2.5 mb-3 break-all">
          <p className="text-white/70 text-xs font-mono">{refLink}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copyLink}
            className="py-3 rounded-xl bg-white/10 text-white font-bold text-sm transition-all active:scale-95 active:bg-white/20"
          >
            📋 Copiar
          </button>
          <button
            onClick={shareLink}
            className="py-3 rounded-xl bg-teal-500 text-white font-bold text-sm transition-all active:scale-95 active:bg-teal-400"
          >
            📤 Compartir
          </button>
        </div>
      </div>

      {/* Tu código */}
      <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Tu código</p>
          <p className="text-white font-black text-lg tracking-widest">{refCode}</p>
        </div>
        <button
          onClick={copyLink}
          className="text-teal-400 text-sm bg-teal-500/10 px-3 py-1.5 rounded-xl"
        >Copiar</button>
      </div>

      {/* Lista de referidos */}
      {referredUsers.length > 0 && (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
            👥 Tus {refCount} amigos
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {referredUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-300">
                    {u.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-white text-xs">{u.username || 'Usuario'}</span>
                </div>
                <span className="text-white/30 text-[10px]">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-VE') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {referredUsers.length === 0 && (
        <div className="text-center py-4 text-white/20 text-sm">
          <p className="text-3xl mb-2">🤝</p>
          <p>¡Aún no tienes referidos!</p>
          <p className="text-xs mt-1">Comparte tu link y empieza a ganar</p>
        </div>
      )}
    </div>
  );
}
