const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_WALLET = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// Inicialización de Wallet con reintento
function initTonConnect() {
    if (typeof TON_CONNECT_UI !== 'undefined') {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'connect-wallet-btn-inner'
        });
    } else {
        setTimeout(initTonConnect, 500);
    }
}

// Navegación entre pestañas de Wallet
function switchWalletTab(tab) {
    const depositContent = document.getElementById('deposit-content');
    const withdrawContent = document.getElementById('withdraw-content');
    const btns = document.querySelectorAll('.tab-btn');

    if (tab === 'deposit') {
        depositContent.style.display = 'block';
        withdrawContent.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        depositContent.style.display = 'none';
        withdrawContent.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
}

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet') initTonConnect();
        actualizarMenuVisual(sectionId);
    } catch (e) { console.error(e); }
}

// PROCESAR COMPRA REAL
async function initPurchase(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.connected) {
        tg.showAlert("⚠️ Conecta tu Wallet primero.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: MI_WALLET,
            amount: (ton * 1000000000).toString()
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("✅ Pago enviado. Procesando tus lechugas...");
    } catch (e) {
        tg.showAlert("❌ Pago cancelado.");
    }
}

// PROCESAR RETIRO
async function requestWithdraw() {
    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("Monto inválido (mín 5, máx 20 TON).");
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
                balanceEl.innerText = data.newBalance; // Actualización inmediata
                tg.showAlert("✅ Solicitud enviada con éxito.");
            }
        }
    });
}

// Cargar Avatar y Saldo
async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    document.getElementById('user-name').innerText = user.first_name;
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');

    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.onload = () => {
            photoEl.style.display = 'block';
            if(initialsEl) initialsEl.style.display = 'none';
        };
        photoEl.onerror = () => mostrarIniciales(user, photoEl, initialsEl);
    } else {
        mostrarIniciales(user, photoEl, initialsEl);
    }

    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString(), username: user.username })
        });
        const data = await res.json();
        if (data.coins !== undefined) document.getElementById('balance').innerText = data.coins;
    } catch (e) { console.error("Error API"); }
}

function mostrarIniciales(user, img, div) {
    img.style.display = 'none';
    if(div) {
        div.style.display = 'flex';
        div.innerText = (user.first_name || "U").charAt(0).toUpperCase();
    }
}

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) item.classList.add('active');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
