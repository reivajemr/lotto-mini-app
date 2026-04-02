import { useState, useEffect, useCallback } from 'react';
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

// TON testnet config
const TON_TESTNET_EXPLORER = 'https://testnet.tonscan.org/tx/';
const TONCONNECT_MANIFEST = 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json';

// TonConnect SDK loading
declare global {
  interface Window {
    TonConnectUI?: any;
    tonConnectUI?: any;
  }
}

const PACKS = [
  { lechugas: 1_000,  ton: 1,   label: 'Básico',   popular: false },
  { lechugas: 5_000,  ton: 5,   label: 'Estándar', popular: true  },
  { lechugas: 10_000, ton: 10,  label: 'Pro',      popular: false },
  { lechugas: 25_000, ton: 25,  label: 'VIP',      popular: false },
  { lechugas: 50_000, ton: 50,  label: 'Premium',  popular: false },
];

// nanoTON helpers
const toNano = (ton: number) => Math.floor(ton * 1_000_000_000).toString();

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

  // TON Connect state
  const [tonConnectReady, setTonConnectReady] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<typeof PACKS[0] | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sdkLoading, setSdkLoading] = useState(true);

  const balanceTON = (balance / 1000).toFixed(3);

  // ── Cargar TonConnect SDK ───────────────────────────────
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
    script.async = true;
    script.onload = () => {
      setSdkLoading(false);
      initTonConnect();
    };
    script.onerror = () => {
      setSdkLoading(false);
      // Fallback: SDK no disponible, usar modo manual
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const initTonConnect = useCallback(() => {
    try {
      if (!window.TonConnectUI) return;
      const ui = new window.TonConnectUI({
        manifestUrl: TONCONNECT_MANIFEST,
        buttonRootId: 'ton-connect-button',
      });
      window.tonConnectUI = ui;
      setTonConnectReady(true);

      ui.onStatusChange((wallet: any) => {
        if (wallet?.account?.address) {
          const addr = wallet.account.address;
          setConnectedWallet(addr);
          // Auto-guardar wallet cuando se conecta
          autoSaveWallet(addr);
        } else {
          setConnectedWallet(null);
        }
      });
    } catch (e) {
      console.error('TonConnect init error:', e);
    }
  }, []);

  const autoSaveWallet = async (addr: string) => {
    try {
      await apiCall({
        telegramId,
        username,
        action: 'wallet',
        walletAddress: addr,
      });
      setWalletAddress(addr);
      setWalletSaved(true);
    } catch { /* ignorar */ }
  };

  // ── Cargar wallet del admin ─────────────────────────────
  const loadAdminWallet = async () => {
    if (adminWallet) return;
    try {
      const data = await apiCall({
        telegramId,
        action: 'getAdminWallet',
      }) as { success?: boolean; wallet?: string };
      if (data?.wallet) setAdminWallet(data.wallet);
    } catch { /* ignorar */ }
  };

  useEffect(() => {
    loadAdminWallet();
  }, []);

  // ── Copiar al portapapeles ──────────────────────────────
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      haptic('light');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Conectar / desconectar wallet TON ──────────────────
  const connectWallet = async () => {
    haptic('medium');
    if (!window.tonConnectUI) {
      showAlert('⚠️ SDK de TON cargando, intenta en unos segundos...');
      return;
    }
    try {
      if (connectedWallet) {
        await window.tonConnectUI.disconnect();
        setConnectedWallet(null);
      } else {
        await window.tonConnectUI.openModal();
      }
    } catch (e) {
      showAlert('❌ Error al conectar wallet');
    }
  };

  // ── Enviar transacción TON (depósito) ──────────────────
  const sendDeposit = async (pack: typeof PACKS[0]) => {
    if (!connectedWallet) {
      showAlert('⚠️ Conecta tu wallet TON primero');
      return;
    }
    if (!adminWallet) {
      showAlert('⚠️ Error: wallet del admin no disponible');
      return;
    }

    haptic('heavy');
    setTxPending(true);
    setSelectedPack(pack);

    try {
      const comment = `LOTTO_DEPOSIT_${telegramId}_${pack.lechugas}`;
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
        network: '-3', // testnet
        messages: [
          {
            address: adminWallet,
            amount: toNano(pack.ton),
            payload: btoa(comment), // base64 comment
          },
        ],
      };

      const result = await window.tonConnectUI.sendTransaction(transaction);

      if (result?.boc) {
        const hash = result.boc;
        setTxHash(hash);

        // Registrar depósito pendiente en backend
        await apiCall({
          telegramId,
          username,
          action: 'registerDeposit',
          txHash: hash,
          amountTon: pack.ton,
          amountLechugas: pack.lechugas,
          walletAddress: connectedWallet,
          comment,
        });

        haptic('heavy');
        showAlert(
          `✅ ¡Transacción enviada!\n\n` +
          `💰 ${pack.ton} TON → ${pack.lechugas.toLocaleString()} 🥬\n\n` +
          `⏳ Tu balance se acreditará automáticamente al confirmar en la blockchain.\n` +
          `Esto tarda ~30 segundos en testnet.`
        );

        // Polling para confirmar depósito
        pollDeposit(hash, pack.lechugas);
      }
    } catch (e: any) {
      if (e?.message?.includes('User rejects') || e?.message?.includes('cancel')) {
        // Usuario canceló
      } else {
        showAlert('❌ Error en la transacción: ' + (e?.message || 'Error desconocido'));
      }
    } finally {
      setTxPending(false);
      setSelectedPack(null);
    }
  };

  // ── Polling de confirmación de depósito ────────────────
  const pollDeposit = async (txHash: string, expectedLechugas: number) => {
    let attempts = 0;
    const maxAttempts = 20; // ~2 minutos

    const poll = async () => {
      attempts++;
      try {
        const data = await apiCall({
          telegramId,
          action: 'checkDeposit',
          txHash,
        }) as { success?: boolean; confirmed?: boolean; newBalance?: number };

        if (data?.confirmed && data.newBalance !== undefined) {
          onBalanceUpdate(data.newBalance);
          haptic('heavy');
          showAlert(`🎉 ¡Depósito confirmado!\n\n+${expectedLechugas.toLocaleString()} 🥬 añadidas a tu cuenta.`);
          return;
        }
      } catch { /* ignorar */ }

      if (attempts < maxAttempts) {
        setTimeout(poll, 6000);
      }
    };

    setTimeout(poll, 5000);
  };

  // ── Guardar wallet manualmente ─────────────────────────
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
        showAlert('❌ ' + (data?.error || 'Error desconocido'));
      }
    } catch (err) {
      showAlert('❌ ' + (err instanceof Error ? err.message : 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitar retiro ───────────────────────────────────
  const handleWithdraw = async () => {
    haptic('medium');
    if (!walletAddress.trim()) {
      showAlert('⚠️ Conecta tu TON Wallet o ingresa tu dirección primero.');
      return;
    }
    if (!walletSaved) {
      showAlert('⚠️ Guarda tu wallet antes de retirar.');
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
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        showAlert(
          `✅ Solicitud enviada!\n\n📋 ID: #${data.withdrawId}\n💰 ${amount} TON\n👛 ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\n\n⏳ El admin procesará tu retiro en 24-48h.`
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

  // ── Formato dirección corta ────────────────────────────
  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <div className="p-4 space-y-4">

      {/* ── Balance Card ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs mb-1">Tu balance</p>
            <p className="text-white font-bold text-2xl">{balance.toLocaleString()} 🥬</p>
            <p className="text-teal-300 text-sm">≈ {balanceTON} TON</p>
          </div>
          <span className="text-5xl">💰</span>
        </div>

        {/* TON Wallet Connect Button */}
        <div className="mt-2">
          {connectedWallet ? (
            <div className="flex items-center justify-between bg-teal-500/20 rounded-xl px-3 py-2.5 border border-teal-500/40">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-teal-200 text-xs font-mono">{shortAddr(connectedWallet)}</span>
              </div>
              <button
                onClick={connectWallet}
                className="text-white/40 hover:text-red-400 text-xs transition-colors"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={sdkLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 font-semibold text-sm py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="text-lg">💎</span>
              {sdkLoading ? 'Cargando SDK...' : 'Conectar TON Wallet'}
            </button>
          )}
          {/* Hidden button root for TonConnect UI */}
          <div id="ton-connect-button" className="hidden" />
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { haptic('light'); setActiveTab(tab); }}
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

      {/* ══ DEPOSITAR ══════════════════════════════════════ */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">

          {/* Modo automático vs manual */}
          {connectedWallet ? (
            // ── MODO AUTOMÁTICO (wallet conectada) ────────
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-green-300 font-semibold text-sm">Depósito automático activado</p>
              </div>
              <p className="text-white/50 text-xs">
                Elige un paquete y aprueba la transacción en tu wallet. El saldo se acredita solo.
              </p>
            </div>
          ) : (
            // ── MODO MANUAL (sin wallet conectada) ─────────
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-yellow-300 font-semibold text-xs">Conecta tu wallet para depósito automático</p>
                <p className="text-white/40 text-xs mt-0.5">O envía TON manualmente a la dirección del admin abajo.</p>
              </div>
            </div>
          )}

          {/* Paquetes */}
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Elige un paquete</p>
          <div className="space-y-2">
            {PACKS.map(pack => {
              const isPending = txPending && selectedPack?.lechugas === pack.lechugas;
              return (
                <div
                  key={pack.lechugas}
                  className={`rounded-xl border p-3.5 transition-all relative ${
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold">{pack.lechugas.toLocaleString()} 🥬</p>
                      <p className="text-white/50 text-xs">{pack.label} · 1,000🥬 = 1 TON</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-teal-300 font-bold">{pack.ton} TON</p>
                      {connectedWallet ? (
                        <button
                          onClick={() => sendDeposit(pack)}
                          disabled={txPending}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            isPending
                              ? 'bg-white/10 text-white/40'
                              : 'bg-teal-500 hover:bg-teal-400 text-white'
                          }`}
                        >
                          {isPending ? '⏳...' : 'Pagar'}
                        </button>
                      ) : (
                        <button
                          onClick={connectWallet}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all active:scale-95"
                        >
                          💎 Conectar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirmación TX */}
          {txHash && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <p className="text-green-300 font-bold text-sm mb-1">✅ TX enviada — Confirmando...</p>
              <button
                onClick={() => window.open(`${TON_TESTNET_EXPLORER}${txHash}`, '_blank')}
                className="text-teal-400 text-xs underline"
              >
                Ver en TonScan →
              </button>
            </div>
          )}

          {/* Depósito manual (siempre visible como respaldo) */}
          <details className="group">
            <summary className="cursor-pointer text-white/40 text-xs font-medium hover:text-white/60 transition-colors select-none">
              ▸ Ver opción de depósito manual
            </summary>
            <div className="mt-3 space-y-3">
              {/* Wallet del admin */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/60 text-xs mb-2">📬 Wallet del administrador:</p>
                {adminWallet ? (
                  <div className="flex items-center gap-2">
                    <p className="text-teal-300 text-xs font-mono flex-1 break-all">{adminWallet}</p>
                    <button
                      onClick={() => copy(adminWallet, 'admin')}
                      className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs text-white flex-shrink-0"
                    >
                      {copied === 'admin' ? '✅' : '📋'}
                    </button>
                  </div>
                ) : (
                  <p className="text-white/30 text-xs">Cargando...</p>
                )}
              </div>

              {/* ID Telegram para memo */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/60 text-xs mb-2">🆔 Tu Telegram ID (ponlo en el memo):</p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-mono font-bold flex-1">{telegramId}</p>
                  <button
                    onClick={() => copy(telegramId, 'id')}
                    className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs text-white flex-shrink-0"
                  >
                    {copied === 'id' ? '✅' : '📋'}
                  </button>
                </div>
              </div>

              <div className="bg-white/3 rounded-xl p-3">
                <p className="text-white/30 text-xs leading-relaxed">
                  Envía el TON exacto del paquete a la wallet del admin con tu Telegram ID en el memo. El admin acreditará tu saldo manualmente en 24h.
                </p>
              </div>
            </div>
          </details>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
            <p className="text-yellow-300 text-xs">⚠️ Red Testnet TON — Solo para pruebas</p>
          </div>
        </div>
      )}

      {/* ══ RETIRAR ════════════════════════════════════════ */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">

          {withdrawSent && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-bold">✅ Retiro pendiente #{withdrawSent}</p>
              <p className="text-white/50 text-xs mt-1">Recibirás una notificación cuando sea procesado.</p>
            </div>
          )}

          {/* Info retiro */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📤</span>
              <p className="text-white font-semibold text-sm">Cómo funciona el retiro</p>
            </div>
            <div className="space-y-2">
              {[
                { icon: '1️⃣', text: 'Ingresa el monto en TON que quieres retirar' },
                { icon: '2️⃣', text: 'El admin verifica y envía tu TON en 24-48h' },
                { icon: '3️⃣', text: 'Recibes confirmación por Telegram ✅' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-white/60 text-xs">
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
            <p className="text-yellow-300/70 text-xs mt-3 border-t border-white/5 pt-3">
              ⚠️ Mínimo: 0.1 TON · Tu saldo queda reservado hasta la confirmación
            </p>
          </div>

          {/* Wallet conectada o manual */}
          {connectedWallet ? (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs">Retiro a tu wallet conectada:</p>
                <p className="text-teal-200 text-xs font-mono truncate">{connectedWallet}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-white/70 text-sm">👛 Tu dirección TON Wallet</p>
              <input
                type="text"
                value={walletAddress}
                onChange={e => { setWalletAddress(e.target.value); setWalletSaved(false); }}
                placeholder="EQD... o UQ..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500"
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
          )}

          {/* Monto */}
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
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white text-center text-lg font-bold focus:outline-none focus:border-teal-500 placeholder-white/30"
              />
              <button
                onClick={() => setWithdrawTon(balanceTON)}
                className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white/70 text-sm transition-all"
              >
                MAX
              </button>
            </div>
            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <p className="text-white/50 text-xs text-center">
                = {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬 se descontarán de tu saldo
              </p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || (!connectedWallet && !walletSaved)}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Procesando...' : '📤 Solicitar retiro'}
          </button>

          {!connectedWallet && !walletSaved && (
            <p className="text-center text-white/30 text-xs">
              Conecta tu wallet o guarda una dirección primero
            </p>
          )}
        </div>
      )}
    </div>
  );
}
