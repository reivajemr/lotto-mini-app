import { useState, useEffect, useCallback } from 'react';
import {
  useTonConnectUI,
  useTonWallet,
  useTonAddress,
  CHAIN,
} from '@tonconnect/ui-react';
import type { AppUser, PendingWithdrawal } from '../types';
import { LECHUGAS_PER_TON, NANO_TON, MIN_DEPOSIT_TON, MIN_WITHDRAW_TON, ADMIN_TON_WALLET } from '../constants';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  showAlert: (msg: string) => void;
  haptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
}

export default function WalletTab({ user, onBalanceUpdate, showAlert, haptic }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const userAddress = useTonAddress();

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [depositAmount, setDepositAmount] = useState('0.5');
  const [activeSection, setActiveSection] = useState<'deposit' | 'withdraw' | 'history'>('deposit');

  // Auto-fill withdraw address from connected wallet
  useEffect(() => {
    if (userAddress && !withdrawAddress) {
      setWithdrawAddress(userAddress);
    }
  }, [userAddress, withdrawAddress]);

  const loadPendingWithdrawals = useCallback(async () => {
    try {
      const res = await fetch(`/api/withdrawals?userId=${user.telegramId}`);
      const data = await res.json();
      setPendingWithdrawals(Array.isArray(data) ? data : []);
    } catch {
      setPendingWithdrawals([]);
    }
  }, [user.telegramId]);

  useEffect(() => {
    loadPendingWithdrawals();
  }, [loadPendingWithdrawals]);

  // TON deposit: user sends TON to admin wallet
  const handleDeposit = async () => {
    if (!wallet) {
      showAlert('Primero conecta tu billetera TON');
      return;
    }
    const tonAmt = parseFloat(depositAmount);
    if (isNaN(tonAmt) || tonAmt < MIN_DEPOSIT_TON) {
      showAlert(`Mínimo de depósito: ${MIN_DEPOSIT_TON} TON`);
      return;
    }

    setLoadingDeposit(true);
    haptic('medium');

    try {
      const nanoAmount = Math.floor(tonAmt * NANO_TON).toString();
      const comment = `deposit:${user.telegramId}`;
      // Build payload with comment
      const payload = buildCommentPayload(comment);

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: CHAIN.TESTNET,
        messages: [
          {
            address: ADMIN_TON_WALLET,
            amount: nanoAmount,
            payload: payload,
          },
        ],
      });

      // Notify backend of the pending deposit
      await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.telegramId,
          tonAmount: tonAmt,
          walletAddress: userAddress,
          comment: `deposit:${user.telegramId}`,
        }),
      });

      const lechugasGained = Math.floor(tonAmt * LECHUGAS_PER_TON);
      onBalanceUpdate(user.balance + lechugasGained);
      haptic('success');
      showAlert(`✅ Depósito enviado!\n${tonAmt} TON = ${lechugasGained.toLocaleString()} 🥬\n\nSe acreditará en breve tras confirmación en la red TON.`);
      setDepositAmount('0.5');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('User rejects') && !msg.includes('declined')) {
        showAlert(`Error en el depósito: ${msg}`);
      }
    } finally {
      setLoadingDeposit(false);
    }
  };

  // Request withdrawal (manual confirmation by admin)
  const handleWithdraw = async () => {
    if (!withdrawAddress.trim()) {
      showAlert('Ingresa la dirección TON de destino');
      return;
    }
    const lechugas = parseInt(withdrawAmount);
    if (isNaN(lechugas) || lechugas <= 0) {
      showAlert('Ingresa una cantidad válida de 🥬');
      return;
    }
    const tonAmt = lechugas / LECHUGAS_PER_TON;
    if (tonAmt < MIN_WITHDRAW_TON) {
      showAlert(`Mínimo de retiro: ${MIN_WITHDRAW_TON} TON (${MIN_WITHDRAW_TON * LECHUGAS_PER_TON} 🥬)`);
      return;
    }
    if (lechugas > user.balance) {
      showAlert(`Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬`);
      return;
    }

    setLoadingWithdraw(true);
    haptic('medium');

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.telegramId,
          amount: lechugas,
          tonAmount: tonAmt,
          toAddress: withdrawAddress.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert(err.error || 'Error al solicitar retiro');
        return;
      }

      const data = await res.json();
      onBalanceUpdate(data.newBalance ?? user.balance - lechugas);
      haptic('success');
      showAlert(`✅ Solicitud de retiro enviada!\n${lechugas.toLocaleString()} 🥬 = ${tonAmt.toFixed(4)} TON\n\nSe procesará manualmente en 24-48h.\nDestino: ${withdrawAddress.slice(0, 10)}...`);
      setWithdrawAmount('');
      await loadPendingWithdrawals();
    } catch {
      showAlert('Error de conexión al solicitar retiro');
    } finally {
      setLoadingWithdraw(false);
    }
  };

  const lechugasToTon = (l: number) => (l / LECHUGAS_PER_TON).toFixed(4);
  const depositLechugas = Math.floor(parseFloat(depositAmount || '0') * LECHUGAS_PER_TON);
  const withdrawTon = parseInt(withdrawAmount || '0') / LECHUGAS_PER_TON;

  return (
    <div className="space-y-4 pb-4">
      {/* Balance Card */}
      <div className="mx-4 bg-gradient-to-br from-teal-700 to-teal-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="text-teal-300 text-xs font-medium mb-1">Tu saldo</div>
        <div className="text-3xl font-bold">{user.balance.toLocaleString()} 🥬</div>
        <div className="text-teal-300 text-sm mt-1">≈ {lechugasToTon(user.balance)} TON</div>
        <div className="mt-3 pt-3 border-t border-teal-600 text-xs text-teal-200">
          💱 1 TON = {LECHUGAS_PER_TON.toLocaleString()} 🥬 lechugas
        </div>
      </div>

      {/* TON Wallet Connection */}
      <div className="mx-4">
        {!wallet ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <div className="text-center">
              <div className="text-4xl mb-2">💎</div>
              <div className="font-bold text-gray-800">Conectar Billetera TON</div>
              <div className="text-sm text-gray-500 mt-1">
                Conecta tu wallet para depositar TON y ganar 🥬 lechugas
              </div>
            </div>
            <button
              onClick={() => tonConnectUI.openModal()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              💎 Conectar Billetera TON (Testnet)
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="text-2xl">💎</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-600 font-medium">Wallet conectada (Testnet)</div>
              <div className="text-xs text-gray-700 font-mono truncate">{userAddress}</div>
            </div>
            <button
              onClick={() => tonConnectUI.disconnect()}
              className="text-xs text-red-500 shrink-0"
            >
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="mx-4 flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['deposit', 'withdraw', 'history'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setActiveSection(s); if (s === 'history') loadPendingWithdrawals(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === s ? 'bg-teal-600 text-white shadow' : 'text-gray-500'
            }`}
          >
            {s === 'deposit' ? '📥 Depósito' : s === 'withdraw' ? '📤 Retiro' : '📋 Historial'}
          </button>
        ))}
      </div>

      {/* Deposit Section */}
      {activeSection === 'deposit' && (
        <div className="mx-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <div className="font-bold text-gray-800 mb-1">📥 Depositar TON</div>
            <div className="text-xs text-gray-500">
              Envía TON desde tu wallet → recibe 🥬 automáticamente (Red Testnet)
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Cantidad de TON a depositar:</label>
            <input
              type="number"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              min={MIN_DEPOSIT_TON}
              step="0.1"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400"
              placeholder={`Mínimo ${MIN_DEPOSIT_TON} TON`}
            />
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Recibirás:</span>
              <span className="font-bold text-teal-700">{isNaN(depositLechugas) ? 0 : depositLechugas.toLocaleString()} 🥬</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">Destino:</span>
              <span className="text-xs text-gray-600 font-mono">{ADMIN_TON_WALLET.slice(0, 12)}...</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            ⚠️ <strong>Testnet:</strong> Usa TON de prueba. Obtén en @testgiver_ton_bot en Telegram.
          </div>

          {wallet ? (
            <button
              onClick={handleDeposit}
              disabled={loadingDeposit || !depositAmount || parseFloat(depositAmount) < MIN_DEPOSIT_TON}
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-teal-700 active:scale-95 transition-all"
            >
              {loadingDeposit ? '⏳ Procesando...' : `📥 Depositar ${depositAmount || '0'} TON`}
            </button>
          ) : (
            <button
              onClick={() => tonConnectUI.openModal()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              💎 Conectar Wallet para Depositar
            </button>
          )}
        </div>
      )}

      {/* Withdraw Section */}
      {activeSection === 'withdraw' && (
        <div className="mx-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <div className="font-bold text-gray-800 mb-1">📤 Retirar TON</div>
            <div className="text-xs text-gray-500">
              Los retiros se procesan manualmente en 24-48 horas hábiles
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Cantidad en 🥬 Lechugas:</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              min={MIN_WITHDRAW_TON * LECHUGAS_PER_TON}
              step="100"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400"
              placeholder={`Mínimo ${MIN_WITHDRAW_TON * LECHUGAS_PER_TON} 🥬`}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Dirección TON de destino:</label>
            <input
              type="text"
              value={withdrawAddress}
              onChange={e => setWithdrawAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-teal-400"
              placeholder="EQ..."
            />
            {wallet && (
              <button
                onClick={() => setWithdrawAddress(userAddress)}
                className="text-xs text-teal-600 mt-1"
              >
                Usar wallet conectada
              </button>
            )}
          </div>

          {withdrawAmount && parseInt(withdrawAmount) > 0 && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Recibirás:</span>
                <span className="font-bold text-teal-700">≈ {withdrawTon.toFixed(4)} TON</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Tu saldo restante:</span>
                <span className={parseInt(withdrawAmount) > user.balance ? 'text-red-500 font-bold' : 'text-gray-700'}>
                  {(user.balance - parseInt(withdrawAmount)).toLocaleString()} 🥬
                </span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
            🔒 Los retiros requieren aprobación manual del administrador por seguridad.
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loadingWithdraw || !withdrawAmount || !withdrawAddress || parseInt(withdrawAmount || '0') > user.balance}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-orange-600 active:scale-95 transition-all"
          >
            {loadingWithdraw ? '⏳ Enviando solicitud...' : '📤 Solicitar Retiro'}
          </button>
        </div>
      )}

      {/* History Section */}
      {activeSection === 'history' && (
        <div className="mx-4 space-y-2">
          {pendingWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <div className="text-gray-500 text-sm">Sin historial de retiros</div>
            </div>
          ) : (
            pendingWithdrawals.map(w => (
              <div key={w.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{w.amount.toLocaleString()} 🥬</div>
                    <div className="text-xs text-gray-500">≈ {w.tonAmount.toFixed(4)} TON</div>
                    <div className="text-xs text-gray-400 font-mono">{w.toAddress.slice(0, 16)}...</div>
                    <div className="text-xs text-gray-400">{new Date(w.requestedAt).toLocaleString('es-ES')}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    w.status === 'approved' ? 'bg-green-100 text-green-700' :
                    w.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {w.status === 'approved' ? '✅ Aprobado' :
                     w.status === 'rejected' ? '❌ Rechazado' : '⏳ Pendiente'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info card */}
      <div className="mx-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs text-gray-500 space-y-1">
        <div className="font-medium text-gray-700 mb-2">ℹ️ Información</div>
        <div>💱 1 TON = {LECHUGAS_PER_TON.toLocaleString()} 🥬</div>
        <div>📥 Depósitos: automáticos al recibir TON</div>
        <div>📤 Retiros: confirmación manual por admin</div>
        <div>⚡ Red: TON Testnet</div>
        <div>🔗 Explorer: testnet.tonscan.org</div>
      </div>
    </div>
  );
}

// Build a simple comment payload for TON transaction (TL-B cell with text comment)
function buildCommentPayload(text: string): string {
  try {
    const bytes = new TextEncoder().encode(text);
    // op code 0 (4 bytes) + text
    const buf = new Uint8Array(4 + bytes.length);
    buf.set([0, 0, 0, 0], 0);
    buf.set(bytes, 4);
    return btoa(String.fromCharCode(...buf));
  } catch {
    return '';
  }
}
