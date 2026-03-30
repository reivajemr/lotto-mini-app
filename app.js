const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA_RECEPTORA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

function initTonConnect() {
    if (typeof TON_CONNECT_UI !== 'undefined') {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'connect-wallet-btn-inner'
        });
    } else {
        setTimeout(initTonConnect, 500); // Reintento por error de carga
    }
}

// CORRECCIÓN: RETIRO SOLO SI HAY WALLET
async function requestWithdraw() {
    // 1. Verificar Wallet conectada primero
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Error: Debes conectar tu Wallet antes de solicitar un retiro.");
        showSection('wallet'); // Redirigir a la pestaña de conexión
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("Monto inválido (mín 5, máx 20 TON).");
        return;
    }

    tg.showConfirm(`¿Confirmas el retiro de ${tonAmount} TON a tu wallet conectada?`, async (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user;
            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    telegramId: user.id.toString(),
                    withdrawAmount: tonAmount,
                    username: user.username,
                    walletAddress: tonConnectUI.account.address // Enviamos la dirección real
                })
            });

            if (res.ok) {
                const data = await res.json();
                balanceEl.innerText = data.newBalance;
                tg.showAlert("✅ Solicitud enviada. El bot te notificará el proceso.");
            } else {
                const err = await res.json();
                tg.showAlert(`❌ Error: ${err.error}`);
            }
        }
    });
}

// Función para el botón de compra
async function initPurchase(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{ address: MI_BILLETERA_RECEPTORA, amount: (ton * 1000000000).toString() }]
    };
    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("¡Pago en camino!");
    } catch (e) { tg.showAlert("Transacción cancelada."); }
}

// ... Mantén tus funciones cargarDatosUsuario y showSection ...

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
