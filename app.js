const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;

// Inicialización segura de TonConnect
function initTonConnect() {
    if (typeof TON_CONNECT_UI !== 'undefined') {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'connect-wallet-btn-inner'
        });
    } else {
        console.error("TonConnect SDK no cargado aún.");
    }
}

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet' && !tonConnectUI) initTonConnect();
        actualizarMenuVisual(sectionId);
    } catch (e) { console.error("Error cargando sección", e); }
}

// COMPRA CON TON
async function initPurchase(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.connected) {
        tg.showAlert("❌ Conecta tu wallet primero.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", // REEMPLAZAR
            amount: (ton * 1000000000).toString()
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("¡Pago enviado!");
    } catch (e) { tg.showAlert("Pago cancelado."); }
}

// RETIRO CON DESCUENTO INMEDIATO
async function requestWithdraw() {
    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (tonAmount < 5 || tonAmount > 20 || isNaN(tonAmount)) {
        tg.showAlert("El monto debe estar entre 5 y 20 TON.");
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
                    username: user.username || user.first_name
                })
            });

            if (res.ok) {
                const data = await res.json();
                balanceEl.innerText = data.newBalance; // Actualiza sin recargar
                tg.showAlert("✅ Solicitud enviada con éxito.");
            }
        }
    });
}

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) item.classList.add('active');
    });
}

async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString(), username: user.username })
        });
        const data = await res.json();
        if (data.coins !== undefined) document.getElementById('balance').innerText = data.coins;
    } catch (e) { console.error("Error cargando usuario"); }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
