const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// --- INICIALIZACIÓN DE WALLET ---
function initTonConnect() {
    // Buscamos el div donde se inyectará el botón oficial
    const container = document.getElementById('connect-wallet-btn-inner');
    
    if (container && typeof TON_CONNECT_UI !== 'undefined') {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'connect-wallet-btn-inner'
        });
        console.log("SDK de Wallet vinculado correctamente.");
    } else {
        // Si la sección aún no carga el div, reintentamos en breve
        setTimeout(initTonConnect, 300);
    }
}

// --- NAVEGACIÓN ENTRE PESTAÑAS (DEPOSITAR/RETIRAR) ---
// Definida globalmente para evitar ReferenceError
window.switchWalletTab = function(tab) {
    const depositContent = document.getElementById('deposit-content');
    const withdrawContent = document.getElementById('withdraw-content');
    const btns = document.querySelectorAll('.tab-btn');

    if (!depositContent || !withdrawContent) return;

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
};

// --- COMPRA DE LECHUGAS ---
window.initPurchase = async function(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: MI_BILLETERA,
            amount: (ton * 1000000000).toString() // Conversión a Nanotons
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("✅ Pago enviado. Procesando...");
    } catch (e) {
        tg.showAlert("❌ Transacción cancelada.");
    }
};

// --- SOLICITUD DE RETIRO ---
window.requestWithdraw = async function() {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Error: Conecta tu Wallet primero.");
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
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
                    username: user.username,
                    walletAddress: tonConnectUI.account.address
                })
            });

            if (res.ok) {
                const data = await res.json();
                document.getElementById('balance').innerText = data.newBalance;
                tg.showAlert("✅ Solicitud enviada. Recibirás un mensaje al bot.");
            }
        }
    });
};

// --- CARGA DE SECCIONES ---
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet') {
            initTonConnect(); // Lanzamos la inicialización al cargar la sección
        }
        actualizarMenuVisual(sectionId);
    } catch (e) {
        console.error("Error cargando sección:", e);
    }
}

// --- GESTIÓN DE USUARIO Y AVATAR ---
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
            initialsEl.style.display = 'none';
        };
    } else {
        initialsEl.innerText = user.first_name.charAt(0).toUpperCase();
        initialsEl.style.display = 'flex';
    }

    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString(), username: user.username })
        });
        const data = await res.json();
        if (data.coins !== undefined) {
            document.getElementById('balance').innerText = data.coins;
        }
    } catch (e) { console.error("Error API"); }
}

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) item.classList.add('active');
    });
}

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
