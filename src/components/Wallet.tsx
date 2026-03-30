import { useState } from 'react';

interface WalletProps {
  balance: number;
  telegramId: string;
  username: string;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
  onBalanceUpdate: (newBalance: number) => void;
}

const PACKS = [
  { lechugas: 1000,  ton: 1.0,  label: '🌱 Starter',  popular: false },
  { lechugas: 3000,  ton: 3.0,  label: '⭐ Popular',   popular: true  },
  { lechugas: 5000,  ton: 5.0,  label: '🔥 Pro',       popular: false },
  { lechugas: 10000, ton: 10.0, label: '👑 VIP',       popular: false },
];

export default function Wallet({ balance, telegramId, username, showAlert, haptic, onBalanceUpdate }: WalletProps) {
  const [activeTab, setActiveTab]     = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawTon, setWithdrawTon] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletSaved, setWalletSaved] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);
  const [withdrawSent, setWithdrawSent] = useState<string | null>(null);

  const balanceTON = (balance / 1000).toFixed(3);

  // La wallet del admin viene de variable de entorno (backend)
  // En el frontend la pedimos al backend para no exponerla
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const loadAdminWallet = async () => {
    if (adminWallet) return;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, action: 'getAdminWallet' }),
      });
      const data = await res.json();
      if (data.wallet) setAdminWallet(data.wallet);
    } catch { /* ignorar */ }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Guardar wallet ──────────────────────────────────────────
  const handleSaveWallet = async () => {
    if (!walletAddress.trim() || walletAddress.length < 10) {
      showAlert('⚠️ Ingresa una dirección TON válida');
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
        showAlert('✅ Wallet guardada correctamente.');
      } else {
        showAlert('❌ Error al guardar wallet.');
      }
    } catch {
      showAlert('❌ Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitar retiro ────────────────────────────────────────
  const handleWithdraw = async () => {
    haptic('medium');
    if (!walletAddress.trim()) {
      showAlert('⚠️ Ingresa y guarda tu dirección TON wallet primero.');
      return;
    }
    if (!walletSaved) {
      showAlert('⚠️ Presiona "Guardar wallet" antes de retirar.');
      return;
    }
    const amount = parseFloat(withdrawTon);
    if (isNaN(amount) || amount < 0.1) {
      showAlert('⚠️ Monto mínimo de retiro: 0.1 TON');
      return;
    }
    if (amount * 1000 > balance) {
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
        onBalanceUpdate(data.newBalance);
        showAlert(
          `✅ Solicitud enviada!\n\n` +
          `📋 ID: #${data.withdrawId}\n` +
          `💰 Monto: ${amount} TON\n` +
          `👛 ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\n\n` +
          `El admin procesará tu retiro en 24-48h.\nTe notificaremos por Telegram.`
        );
      } else {
        showAlert('❌ ' + (data.error || 'Error al procesar retiro'));
      }
    } catch {
      showAlert('❌ Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-teal-200 text-xs font-medium">Tu balance</p>
          <p className="text-3xl font-bold text-white">
            {balance.toLocaleString()} <span className="text-green-300">🥬</span>
          </p>
          <p className="text-teal-300 text-sm mt-1">≈ {balanceTON} TON</p>
        </div>
        <div className="text-5xl">💰</div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button key={tab}
            onClick={() => { setActiveTab(tab); haptic('light'); if (tab === 'deposit') loadAdminWallet(); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? 'bg-teal-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}>
            {tab === 'deposit' ? '💳 Depositar' : '💸 Retirar'}
          </button>
        ))}
      </div>

      {/* ══ DEPOSITAR ══ */}
      {activeTab === 'deposit' && (
        <div className="flex flex-col gap-3">
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4">
            <p className="text-teal-400 font-semibold text-sm mb-2">📋 Cómo depositar:</p>
            <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Elige el paquete que quieres</li>
              <li>Envía el TON exacto a la wallet del admin</li>
              <li>Incluye tu Telegram ID en el <span className="text-yellow-400 font-semibold">memo/comentario</span></li>
              <li>Tu balance se acredita en menos de 24h</li>
            </ol>
          </div>

          {/* Wallet admin */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">📬 Wallet del administrador:</p>
            {adminWallet ? (
              <>
                <p className="text-yellow-400 font-mono text-xs break-all">{adminWallet}</p>
                <button onClick={() => copy(adminWallet, 'wallet')}
                  className="mt-2 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1 rounded-lg transition">
                  {copied === 'wallet' ? '✅ Copiado!' : '📋 Copiar dirección'}
                </button>
              </>
            ) : (
              <button onClick={loadAdminWallet}
                className="text-xs bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg">
                Ver dirección wallet →
              </button>
            )}
          </div>

          {/* Tu ID */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">🆔 Tu Telegram ID (ponlo en el memo):</p>
            <div className="flex items-center gap-2">
              <p className="text-blue-400 font-mono text-sm font-bold">{telegramId}</p>
              <button onClick={() => copy(String(telegramId), 'id')}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-2 py-1 rounded-lg transition">
                {copied === 'id' ? '✅' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Packs */}
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Paquetes disponibles</p>
          {PACKS.map(pack => (
            <div key={pack.lechugas}
              className={`relative border rounded-xl p-4 flex items-center justify-between ${
                pack.popular ? 'bg-teal-500/15 border-teal-500/50' : 'bg-white/5 border-white/10'
              }`}>
              {pack.popular && (
                <span className="absolute -top-2 right-3 text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full">
                  ⭐ Popular
                </span>
              )}
              <div>
                <p className="font-bold text-white">{pack.lechugas.toLocaleString()} 🥬</p>
                <p className="text-xs text-gray-400">{pack.label}</p>
              </div>
              <div className="text-right">
                <p className="text-teal-400 font-bold text-lg">{pack.ton} TON</p>
                <p className="text-xs text-gray-500">1,000🥬 = 1 TON</p>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-500 text-center">
            ⚠️ Red Testnet TON — Solo para pruebas
          </p>
        </div>
      )}

      {/* ══ RETIRAR ══ */}
      {activeTab === 'withdraw' && (
        <div className="flex flex-col gap-3">

          {withdrawSent && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-400 font-semibold text-sm">✅ Retiro pendiente #{withdrawSent}</p>
              <p className="text-gray-300 text-xs mt-1">
                Recibirás una notificación en Telegram cuando sea procesado.
              </p>
              <button onClick={() => setWithdrawSent(null)} className="mt-2 text-xs text-gray-400 underline">
                Nueva solicitud
              </button>
            </div>
          )}

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <p className="text-orange-400 font-semibold text-sm mb-2">📤 Cómo funciona el retiro:</p>
            <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Guarda tu dirección TON wallet</li>
              <li>Ingresa el monto que quieres retirar</li>
              <li>El admin verifica y envía tu TON en 24-48h</li>
              <li>Recibes confirmación por Telegram ✅</li>
            </ol>
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ Mínimo: 0.1 TON · Balance reservado hasta resolución
            </p>
          </div>

          {/* Wallet address */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-2">👛 Tu dirección TON Wallet</p>
            <input
              type="text"
              placeholder="EQ... o UQ... (tu wallet TON)"
              value={walletAddress}
              onChange={e => { setWalletAddress(e.target.value); setWalletSaved(false); }}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={handleSaveWallet}
              disabled={loading || !walletAddress.trim()}
              className={`mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                walletSaved
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-40'
              }`}>
              {loading ? '⏳...' : walletSaved ? '✅ Wallet guardada' : '💾 Guardar wallet'}
            </button>
          </div>

          {/* Monto */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">💸 Monto a retirar (TON)</p>
              <p className="text-xs text-gray-400">Disponible: {balanceTON} TON</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number" min="0.1" step="0.1"
                placeholder="0.0"
                value={withdrawTon}
                onChange={e => setWithdrawTon(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 placeholder-gray-600"
              />
              <button onClick={() => setWithdrawTon(balanceTON)}
                className="px-3 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition">
                MAX
              </button>
            </div>
            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                = {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬
              </p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || !walletSaved || !withdrawTon || !!withdrawSent}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all text-base shadow-lg">
            {loading ? '⏳ Enviando solicitud...' : '📤 Solicitar Retiro'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            🔒 Tu balance queda reservado hasta que el admin procese el retiro
          </p>
        </div>
      )}
    </div>
  );
}
