// src/components/Wallet.tsx
import { useState, useEffect } from 'react';

interface WalletProps {
  balance: number;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

const PACKS = [
  { lechugas: 500,   ton: 0.5,  label: '🌱 Starter',  popular: false },
  { lechugas: 1000,  ton: 1.0,  label: '⭐ Popular',   popular: true  },
  { lechugas: 3000,  ton: 3.0,  label: '🔥 Pro',       popular: false },
  { lechugas: 5000,  ton: 5.0,  label: '👑 VIP',       popular: false },
];

export default function Wallet({ balance, telegramId, username, showAlert, haptic, onBalanceUpdate }: WalletProps) {
  const [activeTab, setActiveTab]         = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawTon, setWithdrawTon]     = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletSaved, setWalletSaved]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [copiedAdmin, setCopiedAdmin]     = useState(false);
  const [copiedId, setCopiedId]           = useState(false);
  const [withdrawSent, setWithdrawSent]   = useState<string | null>(null);

  // ── Wallet del admin desde variable de entorno (vía API) ──
  const [adminWallet, setAdminWallet] = useState<string>('Cargando...');

  useEffect(() => {
    // La wallet del admin se obtiene de la variable de entorno ADMIN_TON_WALLET
    // para poder cambiarla sin tocar el código (testnet → mainnet)
    fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, action: 'getAdminWallet' }),
    })
      .then(r => r.json())
      .then(d => { if (d.wallet) setAdminWallet(d.wallet); })
      .catch(() => setAdminWallet('Error al cargar wallet'));
  }, []);

  const balanceTON = (balance / 1000).toFixed(3);

  const copy = (text: string, which: 'admin' | 'id') => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'admin') { setCopiedAdmin(true); setTimeout(() => setCopiedAdmin(false), 2000); }
      else                   { setCopiedId(true);    setTimeout(() => setCopiedId(false), 2000); }
    });
  };

  // ── Guardar wallet del usuario ───────────────────────────
  const handleSaveWallet = async () => {
    if (!walletAddress.trim() || walletAddress.length < 10) {
      showAlert('⚠️ Ingresa una dirección TON válida (EQ... o UQ...)');
      return;
    }
    haptic('medium');
    setLoading(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, username, action: 'wallet', walletAddress }),
      });
      if (res.ok) {
        setWalletSaved(true);
        haptic('heavy');
        showAlert('✅ Wallet guardada correctamente en tu perfil.');
      } else {
        showAlert('❌ Error al guardar wallet. Intenta de nuevo.');
      }
    } catch {
      showAlert('❌ Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitar retiro ─────────────────────────────────────
  const handleWithdraw = async () => {
    haptic('medium');
    if (!walletAddress.trim()) {
      showAlert('⚠️ Ingresa y guarda tu dirección TON wallet primero.');
      return;
    }
    if (!walletSaved) {
      showAlert('⚠️ Primero presiona "Guardar wallet" para registrar tu dirección.');
      return;
    }
    const amount = parseFloat(withdrawTon);
    if (isNaN(amount) || amount < 0.1) {
      showAlert('⚠️ Monto mínimo de retiro: 0.1 TON');
      return;
    }
    const lechugas = Math.round(amount * 1000);
    if (lechugas > balance) {
      showAlert(`⚠️ Saldo insuficiente.\nTienes ${balance.toLocaleString()} 🥬 = ${balanceTON} TON`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId, username, action: 'withdraw',
          withdrawAmount: amount, walletAddress,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        haptic('heavy');
        setWithdrawSent(data.withdrawId);
        setWithdrawTon('');
        if (onBalanceUpdate) onBalanceUpdate(data.newBalance);
        showAlert(
          `✅ ¡Solicitud enviada!\n\n` +
          `📋 ID de retiro: #${data.withdrawId}\n` +
          `💰 Monto: ${amount} TON\n` +
          `👛 Destino: ${walletAddress.slice(0,10)}...${walletAddress.slice(-6)}\n\n` +
          `El administrador procesará tu retiro en 24-48h.\n` +
          `Te notificaremos por Telegram cuando esté listo.`
        );
      } else {
        showAlert('❌ ' + (data.error || 'Error al procesar retiro'));
      }
    } catch {
      showAlert('❌ Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ── Balance card ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-teal-200 text-xs font-medium">Tu balance</p>
          <p className="text-3xl font-bold text-white">{balance.toLocaleString()} <span className="text-green-300">🥬</span></p>
          <p className="text-teal-300 text-sm mt-1">≈ {balanceTON} TON</p>
        </div>
        <div className="text-5xl">💰</div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); haptic('light'); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-teal-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}>
            {tab === 'deposit' ? '💳 Depositar' : '💸 Retirar'}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          TAB: DEPOSITAR
      ════════════════════════════════════════════════════ */}
      {activeTab === 'deposit' && (
        <div className="flex flex-col gap-3">

          {/* Instrucciones */}
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4">
            <p className="text-teal-400 font-semibold text-sm mb-2">📋 Cómo depositar:</p>
            <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Elige el paquete de lechugas</li>
              <li>Envía el TON exacto a la wallet del admin</li>
              <li>Incluye tu <span className="text-yellow-400 font-semibold">Telegram ID</span> en el memo/comentario</li>
              <li>Tu balance se acreditará en menos de 24h</li>
            </ol>
          </div>

          {/* Wallet del admin (desde variable de entorno) */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400">📬 Wallet del administrador:</p>
              <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                ⚠️ Testnet
              </span>
            </div>
            <p className="text-yellow-400 font-mono text-xs break-all leading-relaxed">{adminWallet}</p>
            <button onClick={() => copy(adminWallet, 'admin')}
              className="mt-2 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg transition w-full font-semibold">
              {copiedAdmin ? '✅ ¡Copiado!' : '📋 Copiar dirección'}
            </button>
          </div>

          {/* Tu ID de Telegram */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">🆔 Tu Telegram ID (pónlo en el memo):</p>
            <div className="flex items-center gap-2">
              <p className="text-blue-400 font-mono text-base font-bold flex-1">{telegramId}</p>
              <button onClick={() => copy(String(telegramId), 'id')}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition font-semibold">
                {copiedId ? '✅' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Paquetes */}
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Paquetes disponibles</p>
          {PACKS.map(pack => (
            <div key={pack.lechugas}
              className={`relative border rounded-xl p-4 flex items-center justify-between ${
                pack.popular ? 'bg-teal-500/15 border-teal-500/50' : 'bg-white/5 border-white/10'
              }`}>
              {pack.popular && (
                <span className="absolute -top-2 right-3 text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  ⭐ Popular
                </span>
              )}
              <div>
                <p className="font-bold text-white text-base">{pack.lechugas.toLocaleString()} 🥬</p>
                <p className="text-xs text-gray-400">{pack.label}</p>
              </div>
              <div className="text-right">
                <p className="text-teal-400 font-bold text-xl">{pack.ton} TON</p>
                <p className="text-xs text-gray-500">1,000 🥬 = 1 TON</p>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-500 text-center py-1">
            ⚠️ Red Testnet — Solo para pruebas · No usar TON real
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB: RETIRAR
      ════════════════════════════════════════════════════ */}
      {activeTab === 'withdraw' && (
        <div className="flex flex-col gap-3">

          {/* Confirmación de retiro enviado */}
          {withdrawSent && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-400 font-bold text-sm">✅ Retiro solicitado — #{withdrawSent}</p>
              <p className="text-gray-300 text-xs mt-1">
                Tu solicitud está pendiente. El admin la verificará y te notificará por Telegram cuando se procese.
              </p>
              <button onClick={() => setWithdrawSent(null)} className="mt-2 text-xs text-gray-400 underline">
                Hacer otra solicitud
              </button>
            </div>
          )}

          {/* Cómo funciona */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <p className="text-orange-400 font-semibold text-sm mb-2">📤 Cómo funciona el retiro:</p>
            <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Registra tu dirección TON wallet abajo</li>
              <li>Ingresa el monto que quieres retirar</li>
              <li>El admin recibe notificación y verifica tu cuenta</li>
              <li>Recibes el TON en tu wallet en 24-48h</li>
              <li>Telegram te confirma cuando se procese</li>
            </ol>
            <div className="mt-2 bg-yellow-500/10 rounded-lg p-2">
              <p className="text-xs text-yellow-400">
                ⚠️ Tu balance se <strong>reserva</strong> al solicitar el retiro.
                Si se rechaza, se devuelve automáticamente.
              </p>
            </div>
          </div>

          {/* Input wallet del usuario */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-2">👛 Tu dirección TON Wallet</p>
            <input
              type="text"
              placeholder="EQ... o UQ... (tu wallet TON)"
              value={walletAddress}
              onChange={e => { setWalletAddress(e.target.value); setWalletSaved(false); }}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 font-mono"
            />
            <button onClick={handleSaveWallet}
              disabled={loading || !walletAddress.trim()}
              className={`mt-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                walletSaved
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-40'
              }`}>
              {loading ? '⏳ Guardando...' : walletSaved ? '✅ Wallet guardada' : '💾 Guardar wallet'}
            </button>
            {walletSaved && (
              <p className="text-xs text-green-400 mt-1 text-center">
                ✅ Wallet registrada en tu perfil
              </p>
            )}
          </div>

          {/* Monto a retirar */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">💸 Monto a retirar</p>
              <p className="text-xs text-gray-400">Tienes: {balanceTON} TON</p>
            </div>

            {/* Atajos de monto */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[0.5, 1, 2, 5].map(amt => (
                <button key={amt} onClick={() => setWithdrawTon(String(amt))}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    withdrawTon === String(amt) ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}>
                  {amt} TON
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number" min="0.1" step="0.1"
                placeholder="0.0 TON"
                value={withdrawTon}
                onChange={e => setWithdrawTon(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500 placeholder-gray-600"
              />
              <button onClick={() => setWithdrawTon(balanceTON)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition font-semibold">
                MAX
              </button>
            </div>

            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>= {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬</span>
                <span className={parseFloat(withdrawTon) * 1000 > balance ? 'text-red-400' : 'text-gray-400'}>
                  {parseFloat(withdrawTon) * 1000 > balance ? '⚠️ Insuficiente' : '✅ Disponible'}
                </span>
              </div>
            )}
          </div>

          {/* Botón de retiro */}
          <button onClick={handleWithdraw}
            disabled={loading || !walletSaved || !withdrawTon || !!withdrawSent}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all text-base shadow-lg">
            {loading ? '⏳ Enviando solicitud...' : '📤 Solicitar Retiro'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            🔒 Balance reservado hasta que el admin procese · Mínimo 0.1 TON
          </p>
        </div>
      )}
    </div>
  );
}
