import { useState } from 'react';
import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { AppUser } from '../types';
import { API_BASE, LECHUGAS_PER_TON, MIN_DEPOSIT_TON, MIN_WITHDRAW_TON, TON_NETWORK } from '../constants';

interface Props {
  user: AppUser;
  onBalanceUpdate: (newBalance: number) => void;
  onAlert: (msg: string) => void;
}

export default function WalletTab({ user, onBalanceUpdate, onAlert }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const userFriendlyAddress = useTonAddress();
  const [depositTon, setDepositTon] = useState('0.1');
  const [withdrawTon, setWithdrawTon] = useState('0.5');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [adminWallet, setAdminWallet] = useState<string>('');

  const loadAdminWallet = async () => {
    if (adminWallet) return adminWallet;
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.telegramId, action: 'getAdminWallet' }),
      });
      const data = await res.json();
      if (data.success && data.wallet) {
        setAdminWallet(data.wallet);
        return data.wallet;
      }
    } catch { /* ignore */ }
    return null;
  };

  const handleDeposit = async () => {
    if (!userFriendlyAddress) {
      onAlert('⚠️ Conecta tu wallet TON primero');
      return;
    }
    const amount = parseFloat(depositTon);
    if (isNaN(amount) || amount < MIN_DEPOSIT_TON) {
      onAlert(`⚠️ Depósito mínimo: ${MIN_DEPOSIT_TON} TON`);
      return;
    }

    setLoading(true);
    try {
      const wallet = await loadAdminWallet();
      if (!wallet || wallet === 'No configurada') {
        onAlert('❌ Wallet del admin no configurada');
        setLoading(false);
        return;
      }

      const nanotons = Math.floor(amount * 1_000_000_000);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: wallet,
            amount: String(nanotons),
            payload: btoa(`deposit:${user.telegramId}`),
          },
        ],
      });

      // Register deposit
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: 'deposit',
          tonAmount: amount,
          lechugas: Math.floor(amount * LECHUGAS_PER_TON),
          fromAddress: userFriendlyAddress,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onBalanceUpdate(data.newBalance);
        onAlert(`✅ ¡Depósito confirmado!\n+${Math.floor(amount * LECHUGAS_PER_TON).toLocaleString()} 🥬 acreditados`);
      } else {
        onAlert(`❌ ${data.error || 'Error al registrar depósito'}`);
      }
    } catch (e: any) {
      if (!e?.message?.includes('User reject')) {
        onAlert('❌ Error en la transacción');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawTon);
    if (isNaN(amount) || amount < MIN_WITHDRAW_TON) {
      onAlert(`⚠️ Retiro mínimo: ${MIN_WITHDRAW_TON} TON`);
      return;
    }
    const lechugas = Math.floor(amount * LECHUGAS_PER_TON);
    if (user.balance < lechugas) {
      onAlert(`❌ Saldo insuficiente. Necesitas ${lechugas.toLocaleString()} 🥬`);
      return;
    }
    const addr = withdrawAddress || userFriendlyAddress;
    if (!addr) {
      onAlert('⚠️ Conecta tu wallet o ingresa una dirección TON');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: 'withdraw',
          tonAmount: amount,
          lechugas,
          toAddress: addr,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onBalanceUpdate(data.newBalance);
        onAlert(`✅ Solicitud de retiro enviada\n${amount} TON → ${addr.slice(0, 8)}...${addr.slice(-6)}\n⏳ Se procesará en 24h`);
        setWithdrawTon('0.5');
        setWithdrawAddress('');
      } else {
        onAlert(`❌ ${data.error || 'Error al solicitar retiro'}`);
      }
    } catch {
      onAlert('❌ Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const balanceTon = (user.balance / LECHUGAS_PER_TON).toFixed(4);

  return (
    <div className="pb-6">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl p-5 mb-5 border border-blue-700/40">
        <div className="text-center">
          <div className="text-gray-400 text-xs mb-1">Tu saldo</div>
          <div className="text-4xl font-extrabold text-white mb-1">
            {user.balance.toLocaleString()} 🥬
          </div>
          <div className="text-blue-300 text-sm">≈ {balanceTon} TON</div>
          <div className="mt-2 text-xs text-gray-400 bg-black/30 rounded-full px-3 py-1 inline-block">
            Red: {TON_NETWORK.toUpperCase()} 🧪
          </div>
        </div>
      </div>

      {/* TON Connect */}
      <div className="flex items-center justify-between bg-gray-900 rounded-xl p-3 mb-5 border border-gray-800">
        <div>
          <div className="text-xs text-gray-400">Wallet TON</div>
          {userFriendlyAddress ? (
            <div className="text-xs text-green-400 font-mono mt-0.5">
              {userFriendlyAddress.slice(0, 8)}...{userFriendlyAddress.slice(-6)}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-0.5">No conectada</div>
          )}
        </div>
        <TonConnectButton />
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 rounded-xl mb-4 p-1">
        {(['deposit', 'withdraw'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            {t === 'deposit' ? '⬇️ Depositar' : '⬆️ Retirar'}
          </button>
        ))}
      </div>

      {tab === 'deposit' && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="font-bold text-white mb-1">Depositar TON</h3>
          <p className="text-xs text-gray-400 mb-4">
            Envía TON desde tu wallet para obtener 🥬 Lechugas.<br />
            1 TON = {LECHUGAS_PER_TON.toLocaleString()} 🥬 | Mín: {MIN_DEPOSIT_TON} TON
          </p>

          <label className="text-xs text-gray-400 mb-1 block">Cantidad en TON</label>
          <input
            type="number"
            step="0.1"
            min={MIN_DEPOSIT_TON}
            value={depositTon}
            onChange={e => setDepositTon(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm mb-2 focus:outline-none focus:border-blue-500"
          />

          <div className="flex gap-2 mb-4">
            {[0.1, 0.5, 1, 5].map(v => (
              <button
                key={v}
                onClick={() => setDepositTon(String(v))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${depositTon === String(v) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {v} TON
              </button>
            ))}
          </div>

          <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Recibirás</span>
              <span className="text-green-400 font-bold">
                {Math.floor((parseFloat(depositTon) || 0) * LECHUGAS_PER_TON).toLocaleString()} 🥬
              </span>
            </div>
          </div>

          <button
            onClick={handleDeposit}
            disabled={loading || !userFriendlyAddress}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-all"
          >
            {loading ? '⏳ Procesando...' : !userFriendlyAddress ? 'Conecta tu wallet primero' : `⬇️ Depositar ${depositTon} TON`}
          </button>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="font-bold text-white mb-1">Retirar TON</h3>
          <p className="text-xs text-gray-400 mb-4">
            Convierte tus 🥬 en TON. Mín: {MIN_WITHDRAW_TON} TON. Procesado en 24h.
          </p>

          <label className="text-xs text-gray-400 mb-1 block">Cantidad en TON</label>
          <input
            type="number"
            step="0.5"
            min={MIN_WITHDRAW_TON}
            value={withdrawTon}
            onChange={e => setWithdrawTon(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm mb-2 focus:outline-none focus:border-blue-500"
          />

          <label className="text-xs text-gray-400 mb-1 block">Dirección TON destino</label>
          <input
            type="text"
            placeholder={userFriendlyAddress || 'EQ... o UQ...'}
            value={withdrawAddress}
            onChange={e => setWithdrawAddress(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm mb-4 focus:outline-none focus:border-blue-500 font-mono text-xs"
          />

          <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Lechugas a descontar</span>
              <span className="text-yellow-400 font-bold">
                -{Math.floor((parseFloat(withdrawTon) || 0) * LECHUGAS_PER_TON).toLocaleString()} 🥬
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Recibirás aprox.</span>
              <span className="text-blue-400 font-bold">{parseFloat(withdrawTon) || 0} TON</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-all"
          >
            {loading ? '⏳ Procesando...' : `⬆️ Solicitar Retiro`}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-xs text-yellow-400">
        ⚠️ <strong>Testnet activa.</strong> Usa TON testnet para pruebas. Los fondos son de prueba y no tienen valor real.
        <a href="https://t.me/testgiver_ton_bot" target="_blank" rel="noopener noreferrer" className="block mt-1 text-blue-400 underline">
          Obtener TON testnet gratis →
        </a>
      </div>
    </div>
  );
}
