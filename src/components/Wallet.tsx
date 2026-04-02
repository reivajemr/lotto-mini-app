import { useState, useEffect, useCallback } from 'react';
import { TonConnectButton, useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
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
  { lechugas: 1_000,  ton: 1,   label: 'Básico',   popular: false },
  { lechugas: 5_000,  ton: 5,   label: 'Estándar', popular: true  },
  { lechugas: 10_000, ton: 10,  label: 'Pro',       popular: false },
  { lechugas: 25_000, ton: 25,  label: 'VIP',       popular: false },
  { lechugas: 50_000, ton: 50,  label: 'Premium',   popular: false },
];

const toNano = (ton: number): string => String(Math.floor(ton * 1_000_000_000));

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
  const [walletAddressInput, setWalletAddressInput] = useState(initialWalletAddress || '');
  const [walletSaved, setWalletSaved] = useState(!!initialWalletAddress);
  const [withdrawTon, setWithdrawTon] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [withdrawSent, setWithdrawSent] = useState<string | null>(null);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [selectedPack, setSelectedPack] = useState<typeof PACKS[0] | null>(null);
  const [depositPending, setDepositPending] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const isConnected = !!wallet;
  const balanceTON = (balance / 1000).toFixed(3);

  // Auto-guardar wallet al conectar
  useEffect(() => {
    if (userFriendlyAddress && userFriendlyAddress !== initialWalletAddress) {
      autoSaveWallet(userFriendlyAddress);
    }
  }, [userFriendlyAddress]);

  const autoSaveWallet = async (addr: string) => {
    try {
      await apiCall({ telegramId, username, action: 'wallet', walletAddress: addr });
      setWalletAddressInput(addr);
      setWalletSaved(true);
    } catch { /* ignorar */ }
  };

  useEffect(() => { loadAdminWallet(); }, []);
  const loadAdminWallet = async () => {
    if (adminWallet) return;
    try {
      const data = await apiCall({ telegramId, action: 'getAdminWallet' }) as { wallet?: string };
      if (data?.wallet) setAdminWallet(data.wallet);
    } catch { /* ignorar */ }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      haptic('light');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Depósito via TonConnect ──────────────────────────────────────────
  const sendDeposit = async (pack: typeof PACKS[0]) => {
    if (!isConnected) { showAlert('⚠️ Conecta tu wallet TON primero'); return; }
    if (!adminWallet) { showAlert('⚠️ Error: wallet del admin no cargó. Recarga.'); return; }

    haptic('heavy');
    setTxPending(true);
    setSelectedPack(pack);
    setDepositConfirmed(false);
    setDepositPending(false);

    try {
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: adminWallet, amount: toNano(pack.ton) }],
      });

      if (result?.boc) {
        const regData = await apiCall({
          telegramId, username, action: 'registerDeposit',
          txBoc: result.boc,
          amountTon: pack.ton,
          amountLechugas: pack.lechugas,
          walletAddress: userFriendlyAddress,
          comment: `LOTTO_${telegramId}_${pack.lechugas}`,
        }) as { depositId?: string };

        if (regData?.depositId) {
          setDepositPending(true);
          haptic('heavy');
          showAlert(
            `✅ ¡Transacción enviada!\n\n` +
            `💰 ${pack.ton} TON → ${pack.lechugas.toLocaleString()} 🥬\n\n` +
            `🔄 Confirmando (~30 seg)...`
          );
          startPolling(regData.depositId, pack.lechugas);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const isCancel = ['rejects','cancel','declined','Reject','No enough','reconnect','SCW'].some(w => msg.includes(w));
      if (!isCancel) showAlert('❌ ' + msg.slice(0, 120));
    } finally {
      setTxPending(false);
      setSelectedPack(null);
    }
  };

  // ── Polling confirmación ─────────────────────────────────────────────
  const startPolling = useCallback((depositId: string, expectedLechugas: number) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const data = await apiCall({
          telegramId, action: 'checkDeposit', depositId,
        }) as { confirmed?: boolean; newBalance?: number };
        if (data?.confirmed && data.newBalance !== undefined) {
          onBalanceUpdate(data.newBalance);
          setDepositConfirmed(true);
          setDepositPending(false);
          haptic('heavy');
          showAlert(`🎉 ¡Depósito confirmado!\n\n+${expectedLechugas.toLocaleString()} 🥬 en tu cuenta.`);
          return;
        }
      } catch { /* ignorar */ }
      if (attempts < 20) setTimeout(poll, 5000);
    };
    setTimeout(poll, 5000);
  }, [telegramId, onBalanceUpdate, haptic, showAlert]);

  // ── Guardar wallet manual ────────────────────────────────────────────
  const saveWallet = async () => {
    if (!walletAddressInput.trim()) { showAlert('⚠️ Ingresa una dirección de wallet'); return; }
    setLoading(true);
    haptic('medium');
    try {
      await apiCall({ telegramId, username, action: 'wallet', walletAddress: walletAddressInput.trim() });
      setWalletSaved(true);
      showAlert('✅ Wallet guardada correctamente');
    } catch (err) {
      showAlert('❌ Error al guardar wallet');
    } finally {
      setLoading(false);
    }
  };

  // ── Retiro ───────────────────────────────────────────────────────────
  const sendWithdraw = async () => {
    const amount = parseFloat(withdrawTon);
    if (!amount || amount <= 0) { showAlert('⚠️ Ingresa la cantidad a retirar'); return; }
    const effectiveWallet = walletAddressInput.trim() || userFriendlyAddress;
    if (!effectiveWallet) { showAlert('⚠️ Guarda tu wallet primero'); return; }
    haptic('heavy');
    setLoading(true);
    try {
      const data = await apiCall({
        telegramId, username, action: 'withdraw',
        walletAddress: effectiveWallet,
        withdrawAmount: amount,
      }) as { success?: boolean; newBalance?: number; withdrawId?: string; error?: string };
      if (data?.success) {
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        setWithdrawSent(data.withdrawId || 'OK');
        showAlert(`✅ Solicitud enviada.\n\nID: #${data.withdrawId}\nSe procesará en 24h.`);
        setWithdrawTon('');
      } else {
        showAlert('❌ ' + (data?.error || 'Error al procesar retiro'));
      }
    } catch (err) {
      showAlert('❌ Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* ── Saldo ── */}
      <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/20 rounded-2xl p-5 text-center">
        <p className="text-white/50 text-xs mb-1 uppercase tracking-wider">Tu saldo</p>
        <p className="text-4xl font-black text-white">{balance.toLocaleString()}</p>
        <p className="text-teal-300 text-sm">🥬 Lechugas</p>
        <p className="text-white/40 text-xs mt-1">≈ {balanceTON} TON</p>
      </div>

      {/* ── Wallet TON Connect ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Wallet TON</p>
            <p className="text-white/40 text-xs">
              {isConnected ? `✅ Conectada` : 'Conecta para depositar'}
            </p>
          </div>
          <TonConnectButton />
        </div>
        {isConnected && userFriendlyAddress && (
          <div
            className="bg-white/5 rounded-xl p-3 cursor-pointer flex items-center gap-2"
            onClick={() => copy(userFriendlyAddress, 'addr')}
          >
            <span className="text-teal-400 text-xs font-mono flex-1 break-all">
              {userFriendlyAddress.slice(0, 8)}...{userFriendlyAddress.slice(-8)}
            </span>
            <span className="text-white/40 text-xs">{copied === 'addr' ? '✅' : '📋'}</span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white/5 rounded-xl p-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-teal-500 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab === 'deposit' ? '⬇️ Depositar' : '⬆️ Retirar'}
          </button>
        ))}
      </div>

      {/* ── Panel Depósito ── */}
      {activeTab === 'deposit' && (
        <div className="space-y-3">
          {!isConnected && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-yellow-300 text-sm font-bold mb-1">⚠️ Wallet no conectada</p>
              <p className="text-yellow-200/70 text-xs">
                Conecta tu wallet TON arriba para poder depositar
              </p>
            </div>
          )}

          {depositConfirmed && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 text-center">
              <p className="text-teal-300 font-bold text-sm">🎉 ¡Depósito confirmado!</p>
            </div>
          )}
          {depositPending && !depositConfirmed && (
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 text-center">
              <p className="text-blue-300 text-sm font-bold animate-pulse">🔄 Confirmando transacción...</p>
              <p className="text-blue-200/60 text-xs mt-1">Puede tomar hasta 1 minuto</p>
            </div>
          )}

          <p className="text-white/50 text-xs px-1">Selecciona un paquete:</p>
          <div className="grid grid-cols-1 gap-2">
            {PACKS.map(pack => (
              <button
                key={pack.ton}
                onClick={() => sendDeposit(pack)}
                disabled={txPending || !isConnected}
                className={`relative flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedPack?.ton === pack.ton
                    ? 'bg-teal-500/20 border-teal-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-teal-500/10 hover:border-teal-500/30'
                }`}
              >
                {pack.popular && (
                  <span className="absolute -top-2 left-4 bg-teal-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{pack.label}</p>
                  <p className="text-teal-300 text-xs">{pack.lechugas.toLocaleString()} 🥬</p>
                </div>
                <div className="text-right">
                  {selectedPack?.ton === pack.ton && txPending ? (
                    <span className="text-teal-400 text-xs animate-pulse">Procesando...</span>
                  ) : (
                    <p className="text-white font-bold">{pack.ton} TON</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Wallet admin para referencia */}
          {adminWallet && (
            <details className="bg-white/3 rounded-xl">
              <summary className="p-3 text-white/30 text-xs cursor-pointer">
                Dirección de depósito manual ▸
              </summary>
              <div className="px-3 pb-3">
                <div
                  className="bg-white/5 rounded-lg p-3 cursor-pointer flex items-center gap-2"
                  onClick={() => copy(adminWallet, 'admin')}
                >
                  <span className="text-white/50 text-xs font-mono flex-1 break-all">{adminWallet}</span>
                  <span className="text-xs">{copied === 'admin' ? '✅' : '📋'}</span>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Panel Retiro ── */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">
          {/* Wallet de destino */}
          <div className="space-y-2">
            <p className="text-white/50 text-xs">Wallet TON de destino</p>
            {isConnected && userFriendlyAddress ? (
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3">
                <p className="text-teal-300 text-xs">✅ Usando wallet conectada:</p>
                <p className="text-white/60 text-xs font-mono mt-1 break-all">{userFriendlyAddress}</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="UQA... o EQA... (dirección TON)"
                  value={walletAddressInput}
                  onChange={e => { setWalletAddressInput(e.target.value); setWalletSaved(false); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500 font-mono"
                />
                <button
                  onClick={saveWallet}
                  disabled={loading || walletSaved}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                    walletSaved
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'bg-teal-500 hover:bg-teal-400 text-white'
                  }`}
                >
                  {walletSaved ? '✅ Guardada' : loading ? 'Guardando...' : 'Guardar wallet'}
                </button>
              </>
            )}
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <p className="text-white/50 text-xs">Cantidad a retirar (TON)</p>
            <div className="relative">
              <input
                type="number"
                placeholder="0.1"
                min="0.1"
                step="0.1"
                value={withdrawTon}
                onChange={e => setWithdrawTon(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-xs">TON</span>
            </div>
            {withdrawTon && (
              <p className="text-teal-300/70 text-xs px-1">
                ≈ {Math.floor(parseFloat(withdrawTon || '0') * 1000).toLocaleString()} 🥬
              </p>
            )}
          </div>

          {/* Info tarifa */}
          <div className="bg-orange-300/10 border border-orange-300/20 rounded-xl p-3 text-xs text-orange-200/80 space-y-1">
            <p className="font-bold text-orange-300">⚠️ Mínimo: 0.5 TON</p>
            <p>Los retiros se procesan manualmente en 24h.</p>
            <p>Tasa: 1,000 🥬 = 1 TON</p>
          </div>

          {withdrawSent && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
              <p className="text-teal-300 font-bold text-sm">✅ Solicitud enviada</p>
              <p className="text-white/40 text-xs mt-1">ID: #{withdrawSent}</p>
            </div>
          )}

          <button
            onClick={sendWithdraw}
            disabled={loading || !withdrawTon || parseFloat(withdrawTon) <= 0}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Procesando...' : '⬆️ Solicitar retiro'}
          </button>
        </div>
      )}
    </div>
  );
}
