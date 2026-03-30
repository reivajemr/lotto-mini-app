const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA_RECEPTORA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// --- CONFIGURACIÓN DEL MANIFEST ---
const MANIFEST_URL = 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json';

// --- 1. GESTIÓN DE SECCIONES ---

async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;

        // Inicializar TonConnect cuando llegues a wallet
        if (sectionId === 'wallet') {
            setTimeout(() => {
                initTonConnect();
            }, 200);
        }
        actualizarMenuVisual(sectionId);
    } catch (e) {
        console.error("Error al cargar la sección:", e);
        mainContent.innerHTML = `<div class="error-message">❌ Error cargando sección</div>`;
    }
}

// --- 2. INICIALIZACIÓN ROBUSTA DE TONCONNECT ---

async function initTonConnect() {
    const container = document.getElementById('ton-connect-button-container');
    
    if (!container) {
        console.warn("⚠️ Contenedor no encontrado. Reintentando...");
        setTimeout(initTonConnect, 300);
        return;
    }

    // Limpiar instancia anterior si existe
    if (tonConnectUI) {
        console.log("🔄 TonConnect ya existe, reutilizando...");
        return;
    }

    // Esperar a que TON_CONNECT_UI esté disponible
    if (typeof TON_CONNECT_UI === 'undefined') {
        console.warn("⚠️ TON_CONNECT_UI no cargado. Reintentando en 500ms...");
        setTimeout(initTonConnect, 500);
        return;
    }

    try {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: MANIFEST_URL,
            buttonRootId: 'ton-connect-button-container'
        });

        console.log("✅ TonConnect inicializado exitosamente");

        // Escuchar cambios de wallet
        tonConnectUI.onStatusChange((wallet) => {
            if (wallet) {
                console.log("✅ Wallet conectada:", wallet.account.address);
                mostrarWalletConectada(wallet.account.address);
            } else {
                console.log("❌ Wallet desconectada");
                limpiarWalletConectada();
            }
        });

        // Si ya hay un wallet conectado, lo mostramos
        if (tonConnectUI.account) {
            console.log("✅ Wallet ya estaba conectada:", tonConnectUI.account.address);
            mostrarWalletConectada(tonConnectUI.account.address);
        }

    } catch (error) {
        console.error("❌ Error inicializando TonConnect:", error);
        mostrarErrorTonConnect(error.message);
    }
}

function mostrarWalletConectada(address) {
    const container = document.getElementById('ton-connect-button-container');
    if (container) {
        const shortAddr = address.slice(0, 6) + "..." + address.slice(-6);
        const statusEl = document.getElementById('wallet-status');
        if (statusEl) {
            statusEl.innerHTML = `✅ Conectada: <code>${shortAddr}</code>`;
            statusEl.style.display = 'block';
        }
    }
}

function limpiarWalletConectada() {
    const statusEl = document.getElementById('wallet-status');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
}

function mostrarErrorTonConnect(error) {
    const container = document.getElementById('ton-connect-button-container');
    if (container) {
        container.innerHTML = `
            <div style="background: rgba(255, 107, 107, 0.2); 
                        border: 1px solid rgba(255, 107, 107, 0.5);
                        padding: 12px;
                        border-radius: 8px;
                        text-align: center;
                        font-size: 13px;
                        color: #ff6b6b;">
                ❌ Error al cargar TonConnect<br>
                <small>${error}</small>
            </div>
        `;
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

// ============================================
// COMPRA DE LECHUGAS
// ============================================
window.initPurchase = async function(lechugas, ton) {
    console.log("🛒 Iniciando compra:", lechugas, "lechugas por", ton, "TON");

    if (!tonConnectUI) {
        tg.showAlert("❌ TonConnect no está inicializado.");
        return;
    }

    if (!tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const walletAddress = tonConnectUI.account.address;
    const user = tg.initDataUnsafe.user;

    // Crear transacción
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutos
        messages: [
            {
                address: MI_BILLETERA_RECEPTORA,
                amount: (ton * 1e9).toString(), // Convertir a nanoTON
                payload: undefined
            }
        ]
    };

    try {
        // Enviar transacción
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log("✅ Transacción enviada:", result);

        // Extraer hash si está disponible
        const transactionHash = result?.boc || result?.hash || "hash_pendiente";

        // Registrar compra en el backend
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: user.id.toString(),
                username: user.username,
                action: 'purchase',
                purchaseAmount: lechugas,
                purchasePrice: ton,
                walletAddress: walletAddress,
                transactionHash: transactionHash
            })
        });

        if (res.ok) {
            const data = await res.json();
            // Actualizar balance en UI
            if (data.newBalance !== undefined) {
                document.getElementById('balance').innerText = data.newBalance;
            }
            tg.showAlert(`✅ ${lechugas} 🥬 añadidas a tu cuenta!\nNuevo balance: ${data.newBalance}`);
            console.log("✅ Compra registrada en backend");
        } else {
            const error = await res.json();
            console.error("❌ Error al registrar compra:", error);
            tg.showAlert(`⚠️ Pago completado pero error al registrar: ${error.error}`);
        }

    } catch (error) {
        console.error("❌ Error en transacción:", error);
        tg.showAlert("❌ Transacción cancelada o error: " + error.message);
    }
};

// ============================================
// RETIRO DE GANANCIAS
// ============================================
window.requestWithdraw = async function() {
    console.log("💸 Iniciando retiro...");

    if (!tonConnectUI) {
        tg.showAlert("❌ TonConnect no está inicializado.");
        return;
    }

    if (!tonConnectUI.account) {
        tg.showAlert("❌ Conecta tu Wallet primero.");
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const walletAddress = tonConnectUI.account.address;
    const user = tg.initDataUnsafe.user;

    // Validar monto
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("⚠️ Monto inválido. Debe estar entre 5 y 20 TON.");
        return;
    }

    // Confirmar retiro
    tg.showConfirm(
        `¿Retirar ${tonAmount} TON a ${walletAddress.slice(0, 10)}...?`,
        async (ok) => {
            if (!ok) return;

            try {
                const res = await fetch('/api/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegramId: user.id.toString(),
                        username: user.username,
                        action: 'withdraw',
                        withdrawAmount: tonAmount,
                        walletAddress: walletAddress
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.newBalance !== undefined) {
                        document.getElementById('balance').innerText = data.newBalance;
                    }
                    document.getElementById('withdraw-ton').value = '';
                    tg.showAlert("✅ Retiro solicitado. Javier lo verificará en 24-48 horas.");
                    console.log("✅ Retiro registrado:", data);
                } else {
                    const err = await res.json();
                    tg.showAlert(`❌ ${err.error || 'Error desconocido'}`);
                }
            } catch (error) {
                console.error("❌ Error en retiro:", error);
                tg.showAlert("❌ Error en la solicitud: " + error.message);
            }
        }
    );
};

// --- 4. FUNCIONES UTILITARIAS ---

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });
}

async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) {
        console.warn("⚠️ No hay datos de usuario de Telegram");
        return;
    }

    // Actualizar header
    document.getElementById('user-name').innerText = user.first_name || "Usuario";
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');

    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.onerror = () => {
            photoEl.style.display = 'none';
            initialsEl.style.display = 'flex';
        };
        photoEl.onload = () => {
            photoEl.style.display = 'block';
            initialsEl.style.display = 'none';
        };
    } else {
        initialsEl.innerText = (user.first_name || "U").charAt(0).toUpperCase();
        initialsEl.style.display = 'flex';
    }

    // Cargar datos del servidor
    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: user.id.toString(),
                username: user.username
            })
        });

        if (res.ok) {
            const data = await res.json();
            const coins = data.user?.coins || data.coins || 0;
            if (document.getElementById('balance')) {
                document.getElementById('balance').innerText = coins;
            }
            console.log("✅ Datos de usuario cargados:", coins, "🥬");
        } else {
            console.warn("⚠️ No se pudieron cargar datos del usuario");
        }
    } catch (error) {
        console.error("❌ Error cargando datos:", error);
    }
}

// --- 5. INICIALIZACIÓN PRINCIPAL ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Iniciando Lotto Mini App v2...");
    cargarDatosUsuario();
    showSection('lobby');
});

// Log para debugging
console.log("✅ app.js cargado");
