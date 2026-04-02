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
  { lechugas: 10_000, ton: 10,  label: 'Pro',      popular: false },
  { lechugas: 25_000, ton: 25,  label: 'VIP',      popular: false },
  { lechugas: 50_000, ton: 50,  label: 'Premium',  popular: false },
];

const toNano = (ton: number): string => String(Math.floor(ton * 1_000_000_000));

// Detectar entorno
const tg = (window as any).Telegram?.WebApp;
const isMobileTelegram = !!tg?.initData && /Android|iPhone|iPad/i.test(navigator.userAgent);
const isDesktop = !isMobileTelegram;

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

  // Desktop TonConnect state
  const [txPending, setTxPending] = useState(false);
  const [selectedPack, setSelectedPack] = useState<typeof PACKS[0] | null>(null);
  const [depositPending, setDepositPending] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);

  // Mobile manual deposit state
  const [mobileStep, setMobileStep] = useState<'select' | 'pending'>('select');
  const [mobileSelectedPack, setMobileSelectedPack] = useState<typeof PACKS[0] | null>(null);
  const [mobileDepositId, setMobileDepositId] = useState<string | null>(null);

  // TonConnect (desktop)
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const isConnected = !!wallet;
  const balanceTON = (balance / 1000).toFixed(3);

  // Auto-guardar wallet al conectar (desktop)
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
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      haptic('light');
      setTimeout(() => setCopied(null), 2500);
    }).catch(() => {
      // Fallback para móvil sin clipboard API
      showAlert(`Copia esta dirección:\n${text}`);
    });
  };

  // ════════════════════════════════════════════════════
  // DESKTOP: Depósito via TonConnect
  // ════════════════════════════════════════════════════
  const sendDepositDesktop = async (pack: typeof PACKS[0]) => {
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
          txBoc: result.boc, amountTon: pack.ton, amountLechugas: pack.lechugas,
          walletAddress: userFriendlyAddress,
          comment: `LOTTO_${telegramId}_${pack.lechugas}`,
        }) as { depositId?: string };

        if (regData?.depositId) {
          setDepositPending(true);
          haptic('heavy');
          showAlert(`✅ ¡TX enviada!\n\n💰 ${pack.ton} TON → ${pack.lechugas.toLocaleString()} 🥬\n\n⏳ Confirmando (~30 seg)...`);
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

  const startPolling = useCallback((depositId: string, expectedLechugas: number) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const data = await apiCall({ telegramId, action: 'checkDeposit', depositId }) as { confirmed?: boolean; newBalance?: number };
        if (data?.confirmed && data.newBalance !== undefined) {
          onBalanceUpdate(data.newBalance);
          setDepositConfirmed(true);
          setDepositPending(false);
          haptic('heavy');
          showAlert(`🎉 ¡Depósito confirmado!\n\n+${expectedLechugas.toLocaleString()} 🥬 en tu cuenta.`);
          return;
        }
      } catch { /* ignorar */ }
      if (attempts < 24) setTimeout(poll, 5000);
    };
    setTimeout(poll, 8000);
  }, [telegramId]);

  // ════════════════════════════════════════════════════
  // MÓVIL: Depósito manual con deep link a Tonkeeper
  // ════════════════════════════════════════════════════
  const selectPackMobile = async (pack: typeof PACKS[0]) => {
    if (!walletAddressInput.trim()) {
      showAlert('⚠️ Primero ingresa y guarda tu dirección TON wallet abajo.');
      return;
    }
    if (!adminWallet) {
      showAlert('⚠️ Error cargando wallet del admin. Recarga la app.');
      return;
    }

    haptic('medium');
    setMobileSelectedPack(pack);
    setMobileStep('pending');

    // Registrar depósito pendiente en backend
    try {
      const regData = await apiCall({
        telegramId, username, action: 'registerDeposit',
        amountTon: pack.ton, amountLechugas: pack.lechugas,
        walletAddress: walletAddressInput,
        comment: `LOTTO_${telegramId}_${pack.lechugas}`,
      }) as { depositId?: string };

      if (regData?.depositId) {
        setMobileDepositId(regData.depositId);
      }
    } catch { /* ignorar, el admin confirmará manualmente */ }
  };

  // Abrir Tonkeeper con deep link
  const openTonkeeper = () => {
    if (!adminWallet || !mobileSelectedPack) return;
    haptic('medium');
    const amount = toNano(mobileSelectedPack.ton);
    const comment = encodeURIComponent(`LOTTO ${telegramId} ${mobileSelectedPack.lechugas}`);
    // Deep link de Tonkeeper
    const deepLink = `tonkeeper://transfer/${adminWallet}?amount=${amount}&text=${comment}`;
    // Universal link como fallback
    const universalLink = `https://app.tonkeeper.com/transfer/${adminWallet}?amount=${amount}&text=${comment}`;

    // Intentar abrir deep link
    const a = document.createElement('a');
    a.href = deepLink;
    a.click();

    // Fallback tras 1.5s si no se abrió la app
    setTimeout(() => {
      window.open(universalLink, '_blank');
    }, 1500);
  };

  // Confirmar que el usuario ya pagó (inicia polling)
  const confirmMobilePayment = async () => {
    if (!mobileSelectedPack) return;
    haptic('medium');

    if (mobileDepositId) {
      showAlert(`⏳ Verificando tu pago...\n\nSi el admin no lo confirma en 24h, contáctanos.`);
      startPolling(mobileDepositId, mobileSelectedPack.lechugas);
    } else {
      showAlert(
        `✅ ¡Pago registrado!\n\n` +
        `El admin verificará tu pago de ${mobileSelectedPack.ton} TON y acreditará ${mobileSelectedPack.lechugas.toLocaleString()} 🥬 en máximo 24h.\n\n` +
        `📋 Memo usado: LOTTO ${telegramId} ${mobileSelectedPack.lechugas}`
      );
    }
    setMobileStep('select');
    setMobileSelectedPack(null);
  };

  // ════════════════════════════════════════════════════
  // RETIRO
  // ════════════════════════════════════════════════════
  const handleSaveWallet = async () => {
    if (!walletAddressInput.trim() || walletAddressInput.length < 10) {
      showAlert('⚠️ Ingresa una dirección TON válida');
      return;
    }
    haptic('medium');
    setLoading(true);
    try {
      const data = await apiCall({ telegramId, username, action: 'wallet', walletAddress: walletAddressInput.trim() }) as { success?: boolean; error?: string };
      if (data?.success) { setWalletSaved(true); haptic('heavy'); showAlert('✅ Wallet guardada.'); }
      else showAlert('❌ ' + (data?.error || 'Error'));
    } catch (err) { showAlert('❌ ' + (err instanceof Error ? err.message : 'Error')); }
    finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    haptic('medium');
    const finalWallet = (isDesktop && isConnected) ? userFriendlyAddress : walletAddressInput.trim();
    if (!finalWallet) { showAlert('⚠️ Ingresa tu dirección TON wallet.'); return; }
    if (!walletSaved && !(isDesktop && isConnected)) { showAlert('⚠️ Guarda tu dirección primero.'); return; }
    const amount = parseFloat(withdrawTon);
    if (isNaN(amount) || amount < 0.1) { showAlert('⚠️ Monto mínimo: 0.1 TON'); return; }
    if (amount * 1000 > balance) { showAlert(`⚠️ Saldo insuficiente.\nTienes ${balanceTON} TON`); return; }
    setLoading(true);
    try {
      const data = await apiCall({ telegramId, username, action: 'withdraw', withdrawAmount: amount, walletAddress: finalWallet }) as { success?: boolean; newBalance?: number; withdrawId?: string; error?: string };
      if (data?.success) {
        haptic('heavy');
        setWithdrawSent(data.withdrawId || 'OK');
        setWithdrawTon('');
        if (data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
        showAlert(`✅ Solicitud enviada!\n📋 ID: #${data.withdrawId}\n💰 ${amount} TON\n\n⏳ El admin procesará en 24-48h.`);
      } else showAlert('❌ ' + (data?.error || 'Error'));
    } catch (err) { showAlert('❌ ' + (err instanceof Error ? err.message : 'Error')); }
    finally { setLoading(false); }
  };

  const shortAddr = (addr: string) => addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <div className="p-4 space-y-4">

      {/* ── Balance Card ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/20 border border-teal-500/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs mb-1">Tu balance</p>
            <p className="text-white font-bold text-2xl">{balance.toLocaleString()} 🥬</p>
            <p className="text-teal-300 text-sm">≈ {balanceTON} TON</p>
          </div>
          <span className="text-5xl">💰</span>
        </div>

        {/* Desktop: TonConnect button */}
        {isDesktop && (
          isConnected ? (
            <div className="flex items-center justify-between bg-teal-500/20 rounded-xl px-3 py-2.5 border border-teal-500/40">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <div>
                  <p className="text-teal-200 text-xs font-mono">{shortAddr(userFriendlyAddress)}</p>
                  <p className="text-teal-300/50 text-[10px]">{wallet?.device?.appName || 'TON Wallet'}</p>
                </div>
              </div>
              <button onClick={() => tonConnectUI.disconnect()} className="text-white/30 hover:text-red-400 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10">✕</button>
            </div>
          ) : (
            <div className="flex justify-center">
              <TonConnectButton />
            </div>
          )
        )}

        {/* Mobile: mostrar wallet guardada */}
        {isMobileTelegram && walletSaved && walletAddressInput && (
          <div className="flex items-center gap-2 bg-teal-500/20 rounded-xl px-3 py-2.5 border border-teal-500/40">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-teal-200 text-xs font-mono flex-1 truncate">{shortAddr(walletAddressInput)}</p>
            <span className="text-teal-300/50 text-[10px]">Wallet guardada</span>
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw'] as const).map(tab => (
          <button key={tab} onClick={() => { haptic('light'); setActiveTab(tab); setMobileStep('select'); }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab === tab ? 'bg-teal-500 text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}>
            {tab === 'deposit' ? '📥 Depositar' : '📤 Retirar'}
          </button>
        ))}
      </div>

      {/* ══ DEPOSITAR ══════════════════════════════════════ */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">

          {/* ── DESKTOP: TonConnect automático ── */}
          {isDesktop && (
            <>
              {isConnected ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                  <p className="text-green-300 text-xs font-medium">Wallet conectada — elige un paquete</p>
                </div>
              ) : (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
                  <span>💎</span>
                  <p className="text-blue-200 text-xs">Conecta tu wallet TON para depósito automático.</p>
                </div>
              )}

              {depositConfirmed && (
                <div className="bg-green-500/15 border border-green-500/40 rounded-xl p-3 text-center">
                  <p className="text-green-300 font-bold">🎉 ¡Depósito confirmado!</p>
                </div>
              )}
              {depositPending && !depositConfirmed && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                  <p className="text-yellow-300 text-xs">Confirmando en blockchain... (~30 seg)</p>
                </div>
              )}

              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Elige un paquete</p>
              <div className="space-y-2">
                {PACKS.map(pack => {
                  const isPending = txPending && selectedPack?.lechugas === pack.lechugas;
                  return (
                    <div key={pack.lechugas} className={`rounded-xl border p-3.5 relative ${pack.popular ? 'bg-teal-500/15 border-teal-500/40' : 'bg-white/5 border-white/10'}`}>
                      {pack.popular && <div className="absolute -top-2 left-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ Popular</div>}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold">{pack.lechugas.toLocaleString()} 🥬</p>
                          <p className="text-white/40 text-xs">{pack.label} · 1,000🥬 = 1 TON</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-teal-300 font-bold">{pack.ton} TON</p>
                          {isConnected ? (
                            <button onClick={() => sendDepositDesktop(pack)} disabled={txPending || depositPending}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${isPending ? 'bg-white/10 text-white/40' : 'bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50'}`}>
                              {isPending ? '⏳' : 'Pagar →'}
                            </button>
                          ) : (
                            <button onClick={() => tonConnectUI.openModal()} className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              💎 Conectar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── MÓVIL: Flujo manual con Tonkeeper deep link ── */}
          {isMobileTelegram && (
            <>
              {mobileStep === 'select' && (
                <>
                  {/* Paso 1: necesita wallet guardada */}
                  {!walletSaved && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                      <p className="text-yellow-300 font-semibold text-sm mb-2">⚠️ Paso previo requerido</p>
                      <p className="text-white/60 text-xs">Ve a la pestaña <strong>Retirar</strong> e ingresa tu dirección TON wallet para poder recibir y enviar TON.</p>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                    <p className="text-blue-200 text-xs font-medium mb-1">📱 Depósito en móvil</p>
                    <p className="text-blue-200/70 text-xs">Elige un paquete → te abriremos Tonkeeper para pagar → confirma aquí cuando termines.</p>
                  </div>

                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Elige un paquete</p>
                  <div className="space-y-2">
                    {PACKS.map(pack => (
                      <div key={pack.lechugas} className={`rounded-xl border p-3.5 relative ${pack.popular ? 'bg-teal-500/15 border-teal-500/40' : 'bg-white/5 border-white/10'}`}>
                        {pack.popular && <div className="absolute -top-2 left-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ Popular</div>}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-bold">{pack.lechugas.toLocaleString()} 🥬</p>
                            <p className="text-white/40 text-xs">{pack.label} · 1,000🥬 = 1 TON</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-teal-300 font-bold">{pack.ton} TON</p>
                            <button
                              onClick={() => selectPackMobile(pack)}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-white active:scale-95 transition-all"
                            >
                              Pagar →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {mobileStep === 'pending' && mobileSelectedPack && adminWallet && (
                <div className="space-y-4">
                  {/* Instrucciones paso a paso */}
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4">
                    <p className="text-teal-300 font-bold text-sm mb-3">
                      💰 Pagar {mobileSelectedPack.ton} TON → {mobileSelectedPack.lechugas.toLocaleString()} 🥬
                    </p>

                    <div className="space-y-3">
                      {/* Dirección admin */}
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-white/40 text-xs mb-1">📬 Enviar a esta dirección:</p>
                        <p className="text-teal-200 text-xs font-mono break-all">{adminWallet}</p>
                        <button onClick={() => copy(adminWallet, 'adminMobile')} className="mt-2 bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg w-full">
                          {copied === 'adminMobile' ? '✅ Copiado' : '📋 Copiar dirección'}
                        </button>
                      </div>

                      {/* Monto */}
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-white/40 text-xs mb-1">💵 Monto exacto:</p>
                        <p className="text-white font-bold text-lg">{mobileSelectedPack.ton} TON</p>
                        <button onClick={() => copy(String(mobileSelectedPack.ton), 'amount')} className="mt-1 bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg w-full">
                          {copied === 'amount' ? '✅ Copiado' : '📋 Copiar monto'}
                        </button>
                      </div>

                      {/* Memo */}
                      <div className="bg-black/30 rounded-xl p-3">
                        <p className="text-white/40 text-xs mb-1">📝 Memo / Comentario (importante):</p>
                        <p className="text-yellow-300 font-mono text-xs break-all">LOTTO {telegramId} {mobileSelectedPack.lechugas}</p>
                        <button onClick={() => copy(`LOTTO ${telegramId} ${mobileSelectedPack.lechugas}`, 'memo')} className="mt-2 bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg w-full">
                          {copied === 'memo' ? '✅ Copiado' : '📋 Copiar memo'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Botón abrir Tonkeeper */}
                  <button
                    onClick={openTonkeeper}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">💎</span>
                    Abrir Tonkeeper y pagar
                  </button>

                  <p className="text-white/30 text-xs text-center">
                    Si no tienes Tonkeeper, copia la dirección y paga desde cualquier wallet TON.
                  </p>

                  {/* Confirmar pago */}
                  <button
                    onClick={confirmMobilePayment}
                    className="w-full bg-teal-500/20 border border-teal-500/40 text-teal-300 font-semibold py-3 rounded-xl transition-all active:scale-95"
                  >
                    ✅ Ya pagué, registrar depósito
                  </button>

                  <button
                    onClick={() => { setMobileStep('select'); setMobileSelectedPack(null); }}
                    className="w-full text-white/30 text-sm py-2"
                  >
                    ← Volver
                  </button>
                </div>
              )}
            </>
          )}

          {/* Depósito manual accordion (desktop) */}
          {isDesktop && (
            <details className="group">
              <summary className="cursor-pointer text-white/25 text-xs hover:text-white/45 transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">▶</span>
                Depósito manual (sin wallet conectada)
              </summary>
              <div className="mt-3 space-y-3 pl-3 border-l border-white/8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-2">📬 Wallet del admin:</p>
                  {adminWallet ? (
                    <div className="flex items-center gap-2">
                      <p className="text-teal-300 text-xs font-mono flex-1 break-all">{adminWallet}</p>
                      <button onClick={() => copy(adminWallet, 'admin')} className="bg-white/10 px-2 py-1 rounded text-xs text-white flex-shrink-0">{copied === 'admin' ? '✅' : '📋'}</button>
                    </div>
                  ) : <p className="text-white/30 text-xs">Cargando...</p>}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-2">🆔 Tu ID (memo):</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono font-bold text-sm flex-1">{telegramId}</p>
                    <button onClick={() => copy(telegramId, 'id')} className="bg-white/10 px-2 py-1 rounded text-xs text-white flex-shrink-0">{copied === 'id' ? '✅' : '📋'}</button>
                  </div>
                </div>
              </div>
            </details>
          )}

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 text-center">
            <p className="text-yellow-300 text-xs">⚠️ Red Testnet TON — Solo para pruebas</p>
          </div>
        </div>
      )}

      {/* ══ RETIRAR ════════════════════════════════════════ */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">
          {withdrawSent && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-bold">✅ Retiro en proceso #{withdrawSent}</p>
              <p className="text-white/40 text-xs mt-1">Recibirás notificación por Telegram.</p>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm">📤 Cómo funciona</p>
            {['1️⃣ Guarda tu dirección TON wallet', '2️⃣ Ingresa el monto en TON', '3️⃣ El admin envía en 24-48h ✅'].map((s, i) => (
              <p key={i} className="text-white/50 text-xs">{s}</p>
            ))}
            <p className="text-yellow-300/60 text-xs border-t border-white/5 pt-2">⚠️ Mín. 0.1 TON</p>
          </div>

          {/* Wallet destino */}
          <div className="space-y-2">
            <p className="text-white/70 text-sm">👛 Tu dirección TON wallet</p>
            {isDesktop && isConnected ? (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3 flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-teal-200 text-xs font-mono truncate flex-1">{userFriendlyAddress}</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={walletAddressInput}
                  onChange={e => { setWalletAddressInput(e.target.value); setWalletSaved(false); }}
                  placeholder="EQD... o UQ..."
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={handleSaveWallet}
                  disabled={loading || walletSaved}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${walletSaved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-teal-500 text-white'}`}
                >
                  {loading ? '⏳ Guardando...' : walletSaved ? '✅ Wallet guardada' : 'Guardar wallet'}
                </button>
                {walletSaved && (
                  <p className="text-white/30 text-xs text-center">Esta wallet se usará para recibir tus retiros</p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white/70 text-sm">💸 Monto (TON)</p>
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
              <button onClick={() => setWithdrawTon(balanceTON)} className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white/70 text-sm">MAX</button>
            </div>
            {withdrawTon && !isNaN(parseFloat(withdrawTon)) && (
              <p className="text-white/40 text-xs text-center">= {(parseFloat(withdrawTon) * 1000).toLocaleString()} 🥬 descontadas</p>
            )}
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || (!isConnected && !walletSaved)}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? '⏳ Procesando...' : '📤 Solicitar retiro'}
          </button>
        </div>
      )}
    </div>
  );
}
