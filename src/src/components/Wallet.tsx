import { useState } from 'react';

interface WalletProps {
  balance: number;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
}

const PACKS = [
  { lechugas: 1000, ton: 0.1 },
  { lechugas: 5000, ton: 0.5 },
  { lechugas: 10000, ton: 1.0 },
  { lechugas: 50000, ton: 5.0 },
];

export default function Wallet({ balance, showAlert, haptic }: WalletProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawTon, setWithdrawTon] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const handleConnectWallet = () => {
    haptic('medium');
    // In production, this would initialize TonConnect
    // For demo purposes, simulate wallet connection
    showAlert('⚠️ TonConnect se activará en Telegram. Conecta desde la app de Telegram.');
    // Simulate for testing
    setWalletConnected(true);
    setWalletAddress('0QC_XSHRUMobPp6Z...nLo');
  };

  const handlePurchase = (lechugas: number, ton: number) => {
    haptic('medium');
    if (!walletConnected) {
      showAlert('❌ Conecta tu Wallet primero.');
      return;
    }
    showAlert(`🛒 Comprar ${lechugas.toLocaleString()} 🥬 por ${ton} TON\n\nEsta función requiere Telegram + TonConnect`);
  };

  const handleWithdraw = () => {
    haptic('medium');
    if (!walletConnected) {
      showAlert('❌ Conecta tu Wallet primero.');
      return;
    }
    const amount = parseFloat(withdrawTon);
    if (isNaN(amount) || amount < 5 || amount > 20) {
      showAlert('⚠️ Monto inválido. Debe estar entre 5 y 20 TON.');
      return;
    }
    const lechugasNeeded = amount * 10000;
    if (balance < lechugasNeeded) {
      showAlert(`❌ Saldo insuficiente. Tienes ${balance.toLocaleString()} 🥬, necesitas ${lechugasNeeded.toLocaleString()} 🥬`);
      return;
    }
    showAlert(`✅ Retiro de ${amount} TON solicitado.\n⏱️ Se procesará en 24-48 horas.`);
    setWithdrawTon('');
  };

  return (
    <div className="space-y-4">
      {/* Tab Selector */}
      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        <button
          onClick={() => { setActiveTab('deposit'); haptic('light'); }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
            activeTab === 'deposit'
              ? 'bg-[#0088cc] text-white shadow-lg'
              : 'text-gray-400'
          }`}
        >
          📥 Depositar
        </button>
        <button
          onClick={() => { setActiveTab('withdraw'); haptic('light'); }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
            activeTab === 'withdraw'
              ? 'bg-[#0088cc] text-white shadow-lg'
              : 'text-gray-400'
          }`}
        >
          📤 Retirar
        </button>
      </div>

      {/* DEPOSIT TAB */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          {/* Connect Wallet */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
            <h3 className="text-base font-bold text-white">🔐 Conectar Wallet</h3>
            <p className="mt-1 text-xs text-gray-400">
              Conecta tu wallet TON para realizar transacciones
            </p>

            {!walletConnected ? (
              <button
                onClick={handleConnectWallet}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#0088cc] to-[#00aaff] py-3 text-sm font-bold text-white shadow-lg shadow-[#0088cc]/30 transition-transform active:scale-95"
              >
                🔗 Conectar Wallet TON
              </button>
            ) : (
              <div className="mt-3 rounded-lg border border-[rgba(76,175,80,0.5)] bg-[rgba(76,175,80,0.2)] p-3 text-center">
                <p className="text-xs text-[#4caf50]">
                  ✅ Conectada: {walletAddress}
                </p>
              </div>
            )}
          </div>

          {/* Buy Lechugas */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
            <h3 className="text-base font-bold text-white">📥 Comprar Lechugas</h3>
            <p className="mt-1 text-xs text-gray-400">
              Tasa: 1.000 🥬 = 0.1 TON
            </p>

            <div className="mt-4 space-y-2">
              {PACKS.map((pack) => (
                <button
                  key={pack.lechugas}
                  onClick={() => handlePurchase(pack.lechugas, pack.ton)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all active:scale-[0.98] hover:border-[#0088cc]/30 hover:bg-[#0088cc]/10"
                >
                  <div>
                    <span className="text-sm font-bold text-white">
                      {pack.lechugas.toLocaleString()} 🥬
                    </span>
                  </div>
                  <span className="rounded-lg bg-[#0088cc]/20 px-3 py-1 text-xs font-bold text-[#0088cc]">
                    {pack.ton} TON
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW TAB */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] p-5">
            <h3 className="text-base font-bold text-white">📤 Retirar Ganancias (TON)</h3>
            <p className="mt-1 text-xs text-gray-400">
              Canjea tus lechugas por TON real
            </p>
            <p className="mt-0.5 text-xs font-bold text-gray-300">
              Mínimo: 5 TON | Máximo: 20 TON
            </p>

            {/* Conversion Rate */}
            <div className="mt-4 rounded-xl border border-[#0088cc]/30 bg-[#0088cc]/10 p-3">
              <p className="text-xs text-gray-300">
                <strong>Tasa de conversión:</strong>
                <br />
                1 TON = 10.000 🥬
              </p>
            </div>

            {/* Your Balance */}
            <div className="mt-3 rounded-xl border border-[#4caf50]/30 bg-[#4caf50]/10 p-3">
              <p className="text-xs text-gray-300">
                <strong>Tu saldo:</strong> {balance.toLocaleString()} 🥬
                <br />
                <strong>Equivalente:</strong> {(balance / 10000).toFixed(1)} TON
              </p>
            </div>

            {/* Input */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-bold text-gray-300">
                Monto en TON a retirar:
              </label>
              <input
                type="number"
                value={withdrawTon}
                onChange={(e) => setWithdrawTon(e.target.value)}
                placeholder="Ej: 5.0"
                step="0.1"
                min="5"
                max="20"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-[#0088cc]"
              />
            </div>

            <button
              onClick={handleWithdraw}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] py-3.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-transform active:scale-95"
            >
              Solicitar Retiro
            </button>

            <p className="mt-3 text-center text-[10px] text-gray-500">
              ⏱️ El retiro se procesará en 24-48 horas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
