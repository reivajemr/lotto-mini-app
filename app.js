const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA_RECEPTORA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// --- 1. GESTIÓN DE SECCIONES ---

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        // CORRECCIÓN: Siempre intentamos inicializar al entrar a wallet
        if (sectionId === 'wallet') {
            // Damos un respiro al DOM para que renderice el nuevo HTML
            setTimeout(() => {
                initTonConnect();
            }, 100); 
        }
        actualizarMenuVisual(sectionId);
    } catch (e) {
        console.error("Error al cargar la sección:", e);
    }
}

// --- 2. LÓGICA DE TONCONNECT ---

function initTonConnect() {
    const container = document.getElementById('ton-connect-button-container');
    
    if (container && typeof TON_CONNECT_UI !== 'undefined') {
        // Si ya existe una instancia previa, debemos "limpiarla" o simplemente reasignar el root
        // para que vuelva a inyectar el botón en el nuevo contenedor
        if (!tonConnectUI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button-container'
            });
        } else {
            // Forzamos al SDK a mirar el nuevo contenedor del DOM
            tonConnectUI.uiOptions = {
                buttonRootId: 'ton-connect-button-container'
            };
        }
    } else {
        // Si el contenedor aún no aparece, reintentamos brevemente
        setTimeout(initTonConnect, 300);
    }
}

// --- 3. FUNCIONES GLOBALES (SWITCH, COMPRA, RETIRO) ---

window.switchWalletTab = function(tab) {
    const deposit = document.getElementById('deposit-content');
    const withdraw = document.getElementById('withdraw-content');
    const btns = document.querySelectorAll('.tab-btn');

    if (!deposit || !withdraw) return;

    if (tab === 'deposit') {
        deposit.style.display = 'block';
        withdraw.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        deposit.style.display = 'none';
        withdraw.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
};

window.initPurchase = async function(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: MI_BILLETERA_RECEPTORA,
            amount: (ton * 1000000000).toString()
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("✅ Pago enviado.");
    } catch (e) {
        tg.showAlert("❌ Pago cancelado.");
    }
};

window.requestWithdraw = async function() {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("Monto inválido (5-20 TON).");
        return;
    }

    tg.showConfirm(`¿Retirar ${tonAmount} TON?`, async (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user;
            try {
                const res = await fetch('/api/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        telegramId: user.id.toString(),
                        withdrawAmount: tonAmount,
                        username: user.username,
                        walletAddress: tonConnectUI.account.address
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    balanceEl.innerText = data.newBalance;
                    tg.showAlert("✅ Solicitud enviada.");
                } else {
                    const err = await res.json();
                    tg.showAlert(`❌ ${err.error}`);
                }
            } catch (e) { console.error(e); }
        }
    });
};

// --- 4. INICIALIZACIÓN ---

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) item.classList.add('active');
    });
}

async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    document.getElementById('user-name').innerText = user.first_name || "Usuario";
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');

    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.onload = () => {
            photoEl.style.display = 'block';
            initialsEl.style.display = 'none';
        };
    } else {
        initialsEl.innerText = (user.first_name || "U").charAt(0).toUpperCase();
        initialsEl.style.display = 'flex';
    }

    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString(), username: user.username })
        });
        const data = await res.json();
        if (data.coins !== undefined) document.getElementById('balance').innerText = data.coins;
    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
