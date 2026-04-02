diff --git a/src/components/Wallet.tsx b/src/components/Wallet.tsx
index 16933926712014402861528b143325d237f17fd3..c8f5f01e4c7078742e535fabe126d5e3806d3d2f 100644
--- a/src/components/Wallet.tsx
+++ b/src/components/Wallet.tsx
@@ -1,58 +1,49 @@
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
 
 const toNano = (ton: number) => Math.floor(ton * 1_000_000_000).toString();
 
-function encodeComment(text: string): string {
-  const bytes = new TextEncoder().encode(text);
-  const prefix = new Uint8Array(4);
-  const full = new Uint8Array(prefix.length + bytes.length);
-  full.set(prefix);
-  full.set(bytes, 4);
-  return btoa(String.fromCharCode(...full));
-}
-
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
   const [txHash, setTxHash] = useState<string | null>(null);
   const [depositConfirmed, setDepositConfirmed] = useState(false);
 
   const [tonConnectUI] = useTonConnectUI();
   const wallet = useTonWallet();
   const userFriendlyAddress = useTonAddress();
@@ -88,51 +79,51 @@ export default function Wallet({
     } catch { /* ignorar */ }
   };
 
   const copy = (text: string, key: string) => {
     navigator.clipboard.writeText(text).then(() => {
       setCopied(key);
       haptic('light');
       setTimeout(() => setCopied(null), 2000);
     });
   };
 
   const sendDeposit = async (pack: typeof PACKS[0]) => {
     if (!isConnected) { showAlert('⚠️ Conecta tu wallet TON primero'); return; }
     if (!adminWallet) { showAlert('⚠️ Error: wallet del admin no disponible.'); return; }
 
     haptic('heavy');
     setTxPending(true);
     setSelectedPack(pack);
     setDepositConfirmed(false);
 
     try {
       const comment = `LOTTO_${telegramId}_${pack.lechugas}`;
       const transaction = {
         validUntil: Math.floor(Date.now() / 1000) + 600,
         messages: [
-          { address: adminWallet, amount: toNano(pack.ton), payload: encodeComment(comment) },
+          { address: adminWallet, amount: toNano(pack.ton) },
         ],
       };
 
       const result = await tonConnectUI.sendTransaction(transaction);
 
       if (result?.boc) {
         setTxHash(result.boc);
         await apiCall({
           telegramId, username, action: 'registerDeposit',
           txHash: result.boc, amountTon: pack.ton, amountLechugas: pack.lechugas,
           walletAddress: userFriendlyAddress, comment,
         });
         haptic('heavy');
         showAlert(
           `✅ ¡Transacción enviada!\n\n💰 ${pack.ton} TON → ${pack.lechugas.toLocaleString()} 🥬\n\n⏳ Confirmando (~30 seg en testnet)...`
         );
         startPolling(result.boc, pack.lechugas);
       }
     } catch (e: unknown) {
       const msg = e instanceof Error ? e.message : String(e);
       if (!msg.includes('User rejects') && !msg.includes('cancel') && !msg.includes('declined')) {
         showAlert('❌ Error: ' + msg);
       }
     } finally {
       setTxPending(false);
