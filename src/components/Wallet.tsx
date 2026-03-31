import { useState, useEffect, useCallback } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { apiCall } from '../App';

interface WalletProps {
  telegramId: string;
  username: string;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy') => void;
}

// 1 TON = 1,000 🥬
const PACKS = [
  { ton: 0.1, lechugas: 100,  label: 'Starter',  popular: false },
  { ton: 0.5, lechugas: 500,  label: 'Normal',   popular: false },
  { ton: 1,   lechugas: 1000, label: 'Popular',  popular: true  },
  { ton: 2,   lechugas: 2000, label: 'Pro',       popular: false },
  { ton: 5,   lechugas: 5000, label: 'VIP',       popular: false },
];

type TabType = 'deposit' | 'withdraw';

export default function Wallet({
  telegramId,
  username,
  balance,
  onBalanceUpdate,
  showAlert,
  haptic,
}: WalletProps) {
  const [activeTab, setActiveTab] = useState<TabType>('deposit');
  const [withdrawTon, setWithdrawTon] = useState('');
  const [withdrawSent, setWithdrawSent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<typeof PACKS[0] | null>(null);
  const [sendingTx, setSendingTx] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'sending' | 'confirming' | 'done' | 'error'>('idle');
  const [walletAddressManual, setWalletAddressManual] = useState('');
  const [walletSaved, setWalletSaved] = useState(false);

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const balanceTON = (balance / 1000).toFixed(3);

  // ── Cargar wallet del admin ──────────────────────────────
  const loadAdminWallet = useCallback(async () => {
    if (adminWallet) return;
    try {
      const data = await apiCall({ telegramId, action: 'getAdminWallet' }) as { wallet?: string };
      if (data?.wallet) setAdminWallet(data.wallet);
    } catch { /* ignorar */ }
  }, [telegramId, adminWallet]);

  useEffect(() => {
    loadAdminWallet();
  }, [loadAdminWallet]);

  // ── Guardar dirección TON cuando se conecta wallet ──────
  useEffect(() => {
    if (wallet?.account?.address) {
      apiCall({
        telegramId,
        action: 'saveTonWallet',
        tonAddress: wallet.account.address,
      }).catch(() => {});
    }
  }, [wallet?.account?.address, telegramId]);

  // ── Copiar al portapapeles ──────────────────────────────
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      haptic('light');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── DEPÓSITO CON TON CONNECT ────────────────────────────
  const handleTonDeposit = async (pack: typeof PACKS[0]) => {
    if (!wallet) {
      showAlert('⚠️ Primero conecta tu wallet TON con el botón de arriba');
      return;
    }
    if (!adminWallet) {
      showAlert('⚠️ No se pudo cargar la wallet del admin. Intenta de nuevo.');
      return;
    }

    haptic('heavy');
    setSelectedPack(pack);
    setSendingTx(true);
    setTxStatus('sending');

    try {
      // Convertir TON a nanoTON (1 TON = 1,000,000,000 nanoTON)
      const nanoTon = BigInt(Math.round(pack.ton * 1_000_000_000)).toString();

      // Mensaje con el ID del usuario para identificar el pago
      const memo = `Animalito Lotto - ${telegramId}`;

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // válido 10 min
        messages: [
          {
            address: adminWallet,
            amount: nanoTon,
            payload: btoa(memo), // payload en base64
          },
        ],
      };

      setTxStatus('confirming');
      const result = await tonConnectUI.sendTransaction(transaction);

      // Transacción enviada exitosamente
      setTxStatus('done');
      haptic('heavy');

      // Confirmar en backend y acreditar lechugas automáticamente
      const txHash = result.boc || `tx_${Date.now()}`;
      
      setLoading(true);
      const confirmData = await apiCall({
        telegramId,
        username,
        action: 'confirmDeposit',
        txHash,
        tonAmount: pack.ton,
        lechugas: pack.lechugas,
      }) as { success?: boolean; newBalance?: number; error?: string };

      if (confirmData?.success && confirmData.newBalance !== undefined) {
        onBalanceUpdate(confirmData.newBalance);
        showAlert(
          `✅ ¡Depósito confirmado!\n\n` +
          `💎 ${pack.ton} TON enviados\n` +
          `🥬 +${pack.lechugas.toLocaleString()} lechugas acreditadas\n` +
          `🏦 Nuevo balance: ${confirmData.newBalance.toLocaleString()} 🥬`
        );
      } else {
        showAlert(
          `✅ Transacción enviada!\n\n` +
          `💎 ${pack.ton} TON → ${pack.lechugas.toLocaleString()} 🥬\n` +
          `⏳ El admin acreditará tu saldo en menos de 24h.\n` +
          `📋 Guarda tu ID: ${telegramId}`
        );
      }

    } catch (err: any) {
      setTxStatus('error');
      if (err?.message?.includes('User rejects')) {
        showAlert('❌ Transacción cancelada por el usuario');
      } else {
        showAlert('❌ Error al enviar: ' + (err?.message || 'Error desconocido'));
      }
    } finally {
      setSendingTx(false);
      setLoading(false);
      setSelectedPack(null);
      setTimeout(() => setTxStatus('idle'), 3000);
    }
  };

  // ── Guardar wallet manual ───────────────────────────────
  const handleSaveWallet = async () => {
    if (!walletAddressManual.trim() || walletAddressManual.length < 10) {
      showAlert('⚠️ Ingresa una dirección TON válida');
      return;
    }
    haptic('medium');
    setLoading(true);
    try {
      const data = await apiCall({
        telegramId,
        username,
        action: 'wallet',
        walletAddress: walletAddressManual.trim(),
      }) as { success?: boolean; error?: string };
      if (data?.success) {
        setWalletSaved(true);
        haptic('heavy');
        showAlert('✅ Wallet guardada correctamente.');
      } else {
        showAlert('❌ Error al guardar wallet: ' + (data?.error || 'desconocido'));
      }
    } catch (err) {
      showAlert('❌ ' + (err instanceof Error ? err.message : 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitar retiro ────────────────────────────────────
  const handleWithdraw = async () => {
    haptic('medium');
    const withdrawAddr = wallet?.account?.address || walletAddressManual.trim();
    if (!withdrawAddr) {
      showAlert('⚠️ Conecta tu wallet TON o ingresa una dirección manualmente.');
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
        walletAddress: withdrawAddr,
      }) as { success?: boolean; newBalance?: number; withdrawId?: string; error?: string };

      if (data?.success) {
        haptic('heavy');
        setWithdrawSent(data.withdrawId || 'OK');
        setWithdrawTon('');
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        showAlert(
          `✅ Solicitud enviada!\n\n` +
          `📋 ID: #${data.withdrawId}\n` +
          `💰 Monto: ${amount} TON\n` +
          `👛 ${withdrawAddr.slice(0, 8)}...${withdrawAddr.slice(-6)}\n\n` +
          `El admin procesará tu retiro en 24-48h.\nTe notificaremos por Telegram.`
        );
      } else {
        showAlert('❌ ' + (data?.error || 'Error al procesar retiro'));
      }
    } catch (err) {
      showAlert('❌ ' + (err instanceof Error ? err.message : 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  const isWalletConnected = !!wallet?.account?.address;
  const connectedAddress = wallet?.account?.address || '';

  return (
    <div className="p-4 space-y-4 pb-24">

      {/* ── Balance Card ── */}
      <div className="relative bg-gradient-to-br from-teal-500/20 to-emerald-600/20 border border-teal-500/30 rounded-2xl p-5 overflow-hidden">
        <div className="absolute top-3 right-4 text-4xl opacity-30">💎</div>
        <p className="text-white/60 text-xs mb-1">Tu balance</p>
        <p className="text-3xl font-black text-white">{balance.toLocaleString()} <span className="text-xl">🥬</span></p>
        <p className="text-teal-300 text-sm mt-1">≈ {balanceTON} TON</p>
      </div>

      {/* ── TON Connect Button ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-white/70 text-xs mb-3 font-semibold uppercase tracking-wider">🔗 Conectar Wallet TON</p>
        {isWalletConnected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-xl px-3 py-2.5">
              <span className="text-green-400 text-lg">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-teal-300 text-xs font-semibold">Wallet conectada</p>
                <p className="text-white/60 text-[10px] font-mono truncate">
                  {connectedAddress.slice(0, 16)}...{connectedAddress.slice(-8)}
                </p>
              </div>
              <button
                onClick={() => copy(connectedAddress, 'addr')}
                className="text-white/40 hover:text-white text-xs px-2 py-1 rounded-lg bg-white/5"
              >
                {copied === 'addr' ? '✅' : '📋'}
              </button>
            </div>
            <button
              onClick={() => tonConnectUI.disconnect()}
              className="w-full py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Desconectar wallet
            </button>
          </div>
        ) : (
          <button
            onClick={() => { haptic('medium'); tonConnectUI.openModal(); }}
            className="w-full bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <span>💎</span>
            <span>Conectar Wallet TON</span>
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); haptic('light'); }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === tab
                ? 'bg-teal-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab === 'deposit' ? '⬇️ Depositar' : '⬆️ Retirar'}
          </button>
        ))}
      </div>

      {/* ══ DEPOSITAR ══ */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">

          {/* Instrucciones */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
            <p className="text-blue-300 font-semibold text-sm">📋 Cómo depositar:</p>
            {isWalletConnected ? (
              <p className="text-white/70 text-xs">
                ✅ Tu wallet está conectada. Elige un paquete y pulsa <strong className="text-white">Comprar</strong> para enviar TON automáticamente. ¡Las lechugas se acreditarán al instante!
              </p>
            ) : (
              <p className="text-white/70 text-xs">
                🔗 Conecta tu wallet TON arriba para depósitos automáticos, o envía manualmente con tu ID en el memo.
              </p>
            )}
          </div>

          {/* Wallet del admin (para depósito manual) */}
          {!isWalletConnected && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-white/70 text-xs font-semibold">📬 Wallet del administrador (depósito manual):</p>
              {adminWallet ? (
                <div className="flex items-center gap-2">
                  <p className="text-white text-xs font-mono break-all flex-1">{adminWallet}</p>
                  <button
                    onClick={() => copy(adminWallet, 'admin')}
                    className="bg-teal-500/20 border border-teal-500/30 text-teal-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                  >
                    {copied === 'admin' ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
              ) : (
                <div className="h-6 bg-white/10 rounded animate-pulse" />
              )}

              <div className="flex items-center gap-2 bg-white/3 rounded-lg p-2">
                <p className="text-white/50 text-xs flex-1">🆔 Tu ID (ponlo en el memo):</p>
                <p className="text-white font-mono text-xs font-bold">{telegramId}</p>
                <button onClick={() => copy(telegramId, 'tid')} className="text-white/40 text-xs">
                  {copied === 'tid' ? '✅' : '📋'}
                </button>
              </div>
            </div>
          )}

          {/* Paquetes */}
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Paquetes disponibles</p>
          <div className="grid grid-cols-1 gap-3">
            {PACKS.map(pack => {
              const isSending = sendingTx && selectedPack?.ton === pack.ton;
              return (
                <div
                  key={pack.ton}
                  onClick={() => !sendingTx && handleTonDeposit(pack)}
                  className={`relative rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.98] ${
                    pack.popular
                      ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-teal-500/40'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  } ${sendingTx ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2 right-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ⭐ Popular
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-lg">{pack.lechugas.toLocaleString()} 🥬</p>
                      <p className="text-white/40 text-xs">{pack.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-teal-300 font-black text-xl">{pack.ton} TON</p>
                      {isSending ? (
                        <p className="text-yellow-400 text-xs animate-pulse">
                          {txStatus === 'sending' ? '⏳ Abriendo wallet...' :
                           txStatus === 'confirming' ? '📤 Confirmando...' :
                           txStatus === 'done' ? '✅ Enviado!' :
                           txStatus === 'error' ? '❌ Error' : '...'}
                        </p>
                      ) : (
                        <p className="text-white/40 text-xs">
                          {isWalletConnected ? '↗ Tap para comprar' : '↗ Tap para info'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
            <p className="text-orange-300 text-xs">⚠️ Red Testnet TON — Solo para pruebas</p>
          </div>
        </div>
      )}

      {/* ══ RETIRAR ══ */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">

          {withdrawSent && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-green-400 font-bold">✅ Retiro pendiente #{withdrawSent}</p>
              <p className="text-white/50 text-xs mt-1">
                Recibirás una notificación en Telegram cuando sea procesado.
              </p>
            </div>
          )}

          {/* Instrucciones */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-white/70 text-sm font-semibold">📤 Cómo funciona el retiro:</p>
            {[
              'Conecta tu wallet TON (arriba) o ingresa la dirección',
              'Ingresa el monto que quieres retirar',
              'El admin verifica y envía tu TON en 24-48h',
              'Recibes confirmación por Telegram ✅',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-teal-500/30 text-teal-300 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-white/60 text-xs">{step}</p>
              </div>
            ))}
            <p className="text-yellow-400 text-xs pt-1">⚠️ Mínimo: 0.1 TON</p>
          </div>

          {/* Dirección de retiro */}
          <div className="space-y-2">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">👛 Dirección de retiro</p>
            {isWalletConnected ? (
              <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-xl px-3 py-3">
                <span className="text-green-400">✅</span>
                <p className="text-white text-xs font-mono truncate flex-1">
                  {connectedAddress.slice(0, 20)}...{connectedAddress.slice(-10)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={walletAddressManual}
                  onChange={e => { setWalletAddressManual(e.target.value); setWalletSaved(false); }}
                  placeholder="EQD... o UQ..."
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button
                  onClick={handleSaveWallet}
                  disabled={loading}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-xl text-sm transition-all"
                >
                  {walletSaved ? '✅ Guardada' : '💾 Guardar wallet'}
                </button>
              </div>
            )}
          </div>

          {/* Monto */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">💸 Monto (TON)</p>
              <p className="text-white/40 text-xs">Disponible: {balanceTON} TON</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={withdrawTon}
                onChange={e => setWithdrawTon(e.target.value)}
                placeholder="0.1"
                min="0.1"
                step="0.1"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 placeholder-white/30"
              />
              <button
                onClick={() => setWithdrawTon(balanceTON)}
                className="bg-white/10 text-white/60 px-3 rounded-xl text-xs font-semibold hover:bg-white/20"
              >
                MAX
              </button>
            </div>
            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <p className="text-teal-300 text-xs text-center">
                = {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬
              </p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || !withdrawTon}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95 ${
              loading || !withdrawTon
                ? 'bg-white/10 text-white/30'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg'
            }`}
          >
            {loading ? '⏳ Procesando...' : '📤 Solicitar Retiro'}
          </button>

          <p className="text-white/30 text-xs text-center">
            🔒 Tu balance queda reservado hasta que el admin procese el retiro
          </p>
        </div>
      )}
    </div>
  );
}
