const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA_RECEPTORA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// --- 1. GESTIÓN DE SECCIONES Y NAVEGACIÓN ---

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet') {
            initTonConnect(); // Inicializa la wallet al cargar su sección
        }
        actualizarMenuVisual(sectionId);
    } catch (e) {
        console.error("Error al cargar la sección:", e);
    }
}

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });
}

// --- 2. LÓGICA DE TONCONNECT (BILLETERA) ---

function initTonConnect() {
    const container = document.getElementById('ton-connect-button-container');
    
    // Verifica si el contenedor existe y si el SDK ya cargó
    if (container && typeof TON_CONNECT_UI !== 'undefined') {
        if (!tonConnectUI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button-container'
            });
        }
    } else {
        // Reintento automático si el elemento aún no está en el DOM
        setTimeout(initTonConnect, 500);
    }
}

// Globalizar funciones para que el HTML dinámico las encuentre
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

// --- 3. ACCIONES FINANCIERAS (DEPÓSITO Y RETIRO) ---

window.initPurchase = async function(lechugas, ton) {
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: MI_BILLETERA_RECEPTORA,
            amount: (ton * 1000000000).toString() // Conversión a Nanotons
        }]
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        tg.showAlert("✅ Pago enviado. Procesando tus lechugas...");
    } catch (e) {
        tg.showAlert("❌ Transacción cancelada.");
    }
};

window.requestWithdraw = async function() {
    // BLOQUEO: Verifica conexión real de la billetera
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Error: Debes conectar tu Wallet antes de retirar.");
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("Monto inválido (mínimo 5, máximo 20 TON).");
        return;
    }

    tg.showConfirm(`¿Confirmas el retiro de ${tonAmount} TON a tu wallet conectada?`, async (ok) => {
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
                        walletAddress: tonConnectUI.account.address // Dirección real para la notificación
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    balanceEl.innerText = data.newBalance; // Actualización visual del saldo
                    tg.showAlert("✅ Solicitud enviada con éxito.");
                } else {
                    const errorData = await res.json();
                    tg.showAlert(`❌ Error: ${errorData.error}`);
                }
            } catch (e) {
                tg.showAlert("❌ Error de conexión con el servidor.");
            }
        }
    });
};

// --- 4. DATOS DE USUARIO Y AVATAR ---

async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    document.getElementById('user-name').innerText = user.first_name || "Usuario";
    
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');

    // Manejo del avatar para evitar que se quede cargando
    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.onload = () => {
            photoEl.style.display = 'block';
            initialsEl.style.display = 'none';
        };
        photoEl.onerror = () => mostrarIniciales(user, photoEl, initialsEl);
    } else {
        mostrarIniciales(user, photoEl, initialsEl);
    }

    // Carga inicial de saldo desde MongoDB
    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: user.id.toString(), 
                username: user.username 
            })
        });
        const data = await res.json();
        if (data.coins !== undefined) {
            document.getElementById('balance').innerText = data.coins;
        }
    } catch (e) {
        console.error("Error al obtener datos del usuario");
    }
}

function mostrarIniciales(user, img, div) {
    img.style.display = 'none';
    div.style.display = 'flex';
    div.innerText = (user.first_name || "U").charAt(0).toUpperCase();
}

// --- 5. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
