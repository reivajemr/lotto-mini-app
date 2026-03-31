import { useState } from 'react';
import { apiCall } from '../App';

interface WalletProps {
  telegramId: string;
  username: string;
  balance: number;
  walletAddress: string | null;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
}

const PACKS = [
  { lechugas: 1_000,  ton: 1,   label: 'Básico',      popular: false },
  { lechugas: 5_000,  ton: 5,   label: 'Estándar',    popular: true  },
  { lechugas: 10_000, ton: 10,  label: 'Pro',          popular: false },
  { lechugas: 25_000, ton: 25,  label: 'VIP',          popular: false },
  { lechugas: 50_000, ton: 50,  label: 'Premium',      popular: false },
];

export default function Wallet({
  telegramId,
  username,
  balance,
  walletAddress: initialWalletAddress,
  onBalanceUpdate,
  showAlert,
  haptic,
}: WalletProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress || '');
  const [walletSaved, setWalletSaved] = useState(!!initialWalletAddress);
  const [withdrawTon, setWithdrawTon] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [withdrawSent, setWithdrawSent] = useState<string | null>(null);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);

  const balanceTON = (balance / 1000).toFixed(3);

  // ── Cargar wallet del admin ──────────────────────────────
  const loadAdminWallet = async () => {
    if (adminWallet) return;
    try {
      const data = await apiCall({
        telegramId,
        action: 'getAdminWallet',
      }) as { success?: boolean; wallet?: string };
      if (data?.wallet) setAdminWallet(data.wallet);
    } catch {
      /* ignorar */
    }
  };

  // ── Copiar al portapapeles ──────────────────────────────
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      haptic('light');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Guardar wallet ──────────────────────────────────────
  const handleSaveWallet = async () => {
    if (!walletAddress.trim() || walletAddress.length < 10) {
      showAlert('⚠️ Ingresa una dirección TON válida (mínimo 10 caracteres)');
      return;
    }
    haptic('medium');
    setLoading(true);
    try {
      const data = await apiCall({
        telegramId,
        username,
        action: 'wallet',
        walletAddress: walletAddress.trim(),
      }) as { success?: boolean; error?: string };

      if (data?.success) {
        setWalletSaved(true);
        haptic('heavy');
        showAlert('✅ Wallet guardada correctamente.');
      } else {
        showAlert('❌ Error al guardar wallet: ' + (data?.error || 'Error desconocido'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      showAlert('❌ ' + msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitar retiro ────────────────────────────────────
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
      const data = await apiCall({
        telegramId,
        username,
        action: 'withdraw',
        withdrawAmount: amount,
        walletAddress: walletAddress.trim(),
      }) as { success?: boolean; newBalance?: number; withdrawId?: string; error?: string };

      if (data?.success) {
        haptic('heavy');
        setWithdrawSent(data.withdrawId || 'OK');
        setWithdrawTon('');
        if (data.newBalance !== undefined) {
          onBalanceUpdate(data.newBalance);
        }
        showAlert(
          `✅ Solicitud enviada!\n\n` +
          `📋 ID: #${data.withdrawId}\n` +
          `💰 Monto: ${amount} TON\n` +
          `👛 ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\n\n` +
          `El admin procesará tu retiro en 24-48h.\nTe notificaremos por Telegram.`
        );
      } else {
        showAlert('❌ ' + (data?.error || 'Error al procesar retiro'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      showAlert('❌ ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/30 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs mb-1">Tu balance</p>
          <p className="text-white font-bold text-2xl">{balance.toLocaleString()} 🥬</p>
          <p className="text-teal-300 text-sm">≈ {balanceTON} TON</p>
        </div>
        <span className="text-5xl">💰</span>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              haptic('light');
              setActiveTab(tab);
              if (tab === 'deposit') loadAdminWallet();
            }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === tab
                ? 'bg-teal-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab === 'deposit' ? '📥 Depositar' : '📤 Retirar'}
          </button>
        ))}
      </div>

      {/* ══ DEPOSITAR ══ */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          {/* Instrucciones */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white font-semibold text-sm mb-3">📋 Cómo depositar:</p>
            <ol className="space-y-2">
              {[
                'Elige el paquete que quieres',
                'Envía el TON exacto a la wallet del admin',
                'Incluye tu Telegram ID en el memo/comentario',
                'Tu balance se acredita en menos de 24h',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-white/70 text-xs">
                  <span className="bg-teal-500/30 text-teal-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Wallet del admin */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/60 text-xs mb-2">📬 Wallet del administrador:</p>
            {adminWallet ? (
              <div className="flex items-center gap-2">
                <p className="text-teal-300 text-sm font-mono flex-1 break-all">{adminWallet}</p>
                <button
                  onClick={() => copy(adminWallet, 'admin')}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs text-white flex-shrink-0 transition-all"
                >
                  {copied === 'admin' ? '✅' : '📋'}
                </button>
              </div>
            ) : (
              <button
                onClick={loadAdminWallet}
                className="text-teal-400 text-sm underline"
              >
                Ver wallet →
              </button>
            )}
          </div>

          {/* Tu ID de Telegram */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/60 text-xs mb-2">🆔 Tu Telegram ID (ponlo en el memo):</p>
            <div className="flex items-center gap-2">
              <p className="text-white font-mono font-bold flex-1">{telegramId}</p>
              <button
                onClick={() => copy(telegramId, 'id')}
                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs text-white flex-shrink-0 transition-all"
              >
                {copied === 'id' ? '✅' : '📋'}
              </button>
            </div>
          </div>

          {/* Paquetes */}
          <p className="text-white font-semibold text-sm">Paquetes disponibles</p>
          <div className="space-y-2">
            {PACKS.map(pack => (
              <div
                key={pack.lechugas}
                className={`rounded-xl border p-3.5 flex items-center justify-between transition-all relative ${
                  pack.popular
                    ? 'bg-teal-500/15 border-teal-500/40'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-2 left-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ⭐ Popular
                  </div>
                )}
                <div>
                  <p className="text-white font-bold">{pack.lechugas.toLocaleString()} 🥬</p>
                  <p className="text-white/50 text-xs">{pack.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-teal-300 font-bold">{pack.ton} TON</p>
                  <p className="text-white/30 text-xs">1,000🥬 = 1 TON</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
            <p className="text-yellow-300 text-xs">⚠️ Red Testnet TON — Solo para pruebas</p>
          </div>
        </div>
      )}

      {/* ══ RETIRAR ══ */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">

          {withdrawSent && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-bold">✅ Retiro pendiente #{withdrawSent}</p>
              <p className="text-white/60 text-xs mt-1">
                Recibirás una notificación en Telegram cuando sea procesado.
              </p>
            </div>
          )}

          {/* Instrucciones */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white font-semibold text-sm mb-3">📤 Cómo funciona el retiro:</p>
            <ol className="space-y-2">
              {[
                'Guarda tu dirección TON wallet',
                'Ingresa el monto que quieres retirar',
                'El admin verifica y envía tu TON en 24-48h',
                'Recibes confirmación por Telegram ✅',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-white/70 text-xs">
                  <span className="bg-teal-500/30 text-teal-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-yellow-300/70 text-xs mt-3">
              ⚠️ Mínimo: 0.1 TON · Balance reservado hasta resolución
            </p>
          </div>

          {/* Wallet address */}
          <div className="space-y-2">
            <p className="text-white/70 text-sm">👛 Tu dirección TON Wallet</p>
            <input
              type="text"
              value={walletAddress}
              onChange={e => { setWalletAddress(e.target.value); setWalletSaved(false); }}
              placeholder="EQD... o UQ..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <button
              onClick={handleSaveWallet}
              disabled={loading || walletSaved}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                walletSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-teal-500 hover:bg-teal-400 text-white'
              }`}
            >
              {loading ? '⏳ Guardando...' : walletSaved ? '✅ Wallet guardada' : 'Guardar wallet'}
            </button>
          </div>

          {/* Monto a retirar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white/70 text-sm">💸 Monto a retirar (TON)</p>
              <p className="text-teal-300 text-xs">Disponible: {balanceTON} TON</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={withdrawTon}
                onChange={e => setWithdrawTon(e.target.value)}
                placeholder="0.1"
                min="0.1"
                step="0.1"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 placeholder-white/30 transition-colors"
              />
              <button
                onClick={() => setWithdrawTon(balanceTON)}
                className="bg-white/10 hover:bg-white/20 px-3 rounded-xl text-white/70 text-sm transition-all"
              >
                MAX
              </button>
            </div>
            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <p className="text-white/50 text-xs text-center">
                = {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬
              </p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? '⏳ Procesando...' : '📤 Solicitar retiro'}
          </button>

          <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
            <p className="text-white/40 text-xs">
              🔒 Tu balance queda reservado hasta que el admin procese el retiro
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
