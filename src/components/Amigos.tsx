import { useState } from 'react';
import type { TelegramUser } from '../types';

interface AmigosProps {
  user: TelegramUser | null;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
}

export default function Amigos({ user, showAlert, haptic }: AmigosProps) {
  const [copied, setCopied] = useState(false);

  const referralLink = `https://t.me/AnimalitoLottoBot?start=ref_${user?.id || '123456'}`;

  const handleCopyLink = async () => {
    haptic('medium');
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      showAlert('✅ Link copiado al portapapeles!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      showAlert('✅ Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    haptic('medium');
    const text = encodeURIComponent('🎰 ¡Juega Animalito Lotto en Telegram y gana TON! Únete con mi link:');
    const url = encodeURIComponent(referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-white/5 bg-[rgba(45,45,45,0.8)] p-6 text-center">
        <span className="text-5xl">👥</span>
        <h1 className="mt-3 text-xl font-bold text-white">Invita a tus Amigos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Gana bonos por cada amigo que se una al juego
        </p>
      </div>

      {/* Rewards Info */}
      <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
        <h3 className="text-sm font-bold text-white">🎁 Recompensas por Referido</h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="text-xl">🥉</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Por cada amigo</p>
              <p className="text-xs text-gray-400">Que se una usando tu link</p>
            </div>
            <span className="text-sm font-bold text-[#4caf50]">+100 🥬</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="text-xl">🥈</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">5 amigos</p>
              <p className="text-xs text-gray-400">Bonus adicional</p>
            </div>
            <span className="text-sm font-bold text-[#4caf50]">+500 🥬</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="text-xl">🥇</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">10 amigos</p>
              <p className="text-xs text-gray-400">Gran bonus</p>
            </div>
            <span className="text-sm font-bold text-[#4caf50]">+2000 🥬</span>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
        <h3 className="mb-3 text-sm font-bold text-white">🔗 Tu Link de Referido</h3>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="truncate text-xs text-[#0088cc]">{referralLink}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleCopyLink}
            className={`rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-95 ${
              copied
                ? 'bg-[#4caf50] shadow-lg shadow-green-500/20'
                : 'bg-gradient-to-r from-[#0088cc] to-[#00aaff] shadow-lg shadow-[#0088cc]/20'
            }`}
          >
            {copied ? '✅ Copiado!' : '📋 Copiar Link'}
          </button>
          <button
            onClick={handleShareTelegram}
            className="rounded-xl bg-gradient-to-r from-[#0088cc] to-[#0066aa] py-3 text-sm font-bold text-white shadow-lg shadow-[#0088cc]/20 transition-transform active:scale-95"
          >
            📨 Compartir
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
        <h3 className="mb-3 text-sm font-bold text-white">📊 Tus Estadísticas</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-2xl font-bold text-[#0088cc]">0</p>
            <p className="text-[10px] text-gray-400">Invitados</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-2xl font-bold text-[#4caf50]">0</p>
            <p className="text-[10px] text-gray-400">Activos</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">0</p>
            <p className="text-[10px] text-gray-400">🥬 Ganadas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
