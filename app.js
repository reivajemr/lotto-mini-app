const tg = window.Telegram.WebApp;
tg.expand();

// Inicializar TON Connect
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
    buttonRootId: 'connect-wallet-btn-inner'
});

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div style="text-align:center; margin-top:50px;">Cargando...</div>';

    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet') {
            // El botón de conectar se maneja ahora por TonConnectUI automáticamente
        }
        actualizarMenuVisual(sectionId);
    } catch (e) { console.error(e); }
}

// COMPRA REAL CON TON CONNECT
async function initPurchase(lechugas, ton) {
    if (!tonConnectUI.connected) {
        tg.showAlert("❌ Primero conecta tu Wallet.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", // REEMPLAZA ESTO
            amount: (ton * 1000000000).toString(), 
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showPopup({ title: "¡Éxito!", message: "Pago enviado. Se acreditarán las lechugas pronto." });
    } catch (e) {
        tg.showAlert("Transacción cancelada.");
    }
}

// RETIRO CON ACTUALIZACIÓN VISUAL
async function requestWithdraw() {
    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    const lechugasNecesarias = tonAmount * 10000;

    if (tonAmount < 5 || tonAmount > 20 || isNaN(tonAmount)) {
        tg.showAlert("⚠️ Monto inválido (5 a 20 TON).");
        return;
    }

    tg.showConfirm(`¿Retirar ${tonAmount} TON?`, async (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user;
            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    telegramId: user.id.toString(),
                    withdrawAmount: tonAmount,
                    username: user.username
                })
            });

            if (res.ok) {
                const data = await res.json();
                balanceEl.innerText = data.newBalance; // ACTUALIZACIÓN SIN RECARGAR
                tg.showAlert("✅ Solicitud enviada. Saldo actualizado.");
            } else {
                tg.showAlert("❌ Error al procesar.");
            }
        }
    });
}

// ... Resto de tus funciones cargarDatosUsuario() y actualizarMenuVisual() ...

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
