const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;
const MI_BILLETERA = "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo";

// 1. Funciones de Apoyo (Definidas antes de usarse)
function mostrarIniciales(user, img, div) {
    img.style.display = 'none';
    if(div) {
        div.style.display = 'flex';
        div.innerText = (user.first_name || "U").charAt(0).toUpperCase();
    }
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
    } catch (e) { console.error("Error cargando saldo"); }
}

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

// 2. Funciones de Acción
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    try {
        const response = await fetch(`sections/${sectionId}.html`);
        const html = await response.text();
        mainContent.innerHTML = html;
        if (sectionId === 'wallet') initTonConnect();
        actualizarMenuVisual(sectionId);
    } catch (e) { console.error("Error sección", e); }
}

async function requestWithdraw() {
    // VALIDACIÓN CRÍTICA: Requiere wallet para retirar
    if (!tonConnectUI || !tonConnectUI.account) {
        tg.showAlert("❌ Error: Debes conectar tu Wallet primero.");
        return;
    }

    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const balanceEl = document.getElementById('balance');
    
    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("Monto inválido (5 a 20 TON).");
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
                balanceEl.innerText = data.newBalance;
                tg.showAlert("✅ Solicitud enviada con éxito.");
            } else {
                const error = await res.json();
                tg.showAlert(`❌ ${error.error}`);
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

// 3. Inicialización Final
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
