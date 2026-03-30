const tg = window.Telegram.WebApp;
tg.expand();

// 1. NAVEGACIÓN Y CARGA DE SECCIONES
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div style="text-align:center; margin-top:50px;">Cargando...</div>';

    try {
        const response = await fetch(`sections/${sectionId}.html`);
        if (!response.ok) throw new Error(`No se encontró: ${sectionId}`);
        const html = await response.text();
        mainContent.innerHTML = html;

        if (sectionId === 'wallet') {
            const walletBtn = document.getElementById('connect-wallet-btn-inner');
            if (walletBtn) walletBtn.onclick = connectWallet;
        }
        actualizarMenuVisual(sectionId);
    } catch (error) {
        mainContent.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
    }
}

function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) item.classList.add('active');
    });
}

// 2. LÓGICA DE WALLET (PESTAÑAS Y CONEXIÓN)
function switchWalletTab(tab) {
    tg.HapticFeedback.selectionChanged();
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

function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn-inner');
    tg.HapticFeedback.impactOccurred('medium');
    btn.innerText = "Conectando...";
    setTimeout(() => {
        btn.innerText = "Wallet: 0x...1234 ✅";
        btn.style.background = "linear-gradient(135deg, #28a745, #218838)";
    }, 1000);
}

// 3. COMPRAS Y RETIROS (LÍMITES SOLICITADOS)
function initPurchase(lechugas, ton) {
    tg.showConfirm(`¿Comprar ${lechugas} 🥬 por ${ton} TON?`, (ok) => {
        if (ok) tg.showAlert("Redirigiendo al pago en la red TON...");
    });
}

async function requestWithdraw() {
    const tonAmount = parseFloat(document.getElementById('withdraw-ton').value);
    const saldoActual = parseInt(document.getElementById('balance').innerText);
    const lechugasNecesarias = tonAmount * 10000; // 1 TON = 10,000 lechugas

    if (isNaN(tonAmount) || tonAmount < 5 || tonAmount > 20) {
        tg.showAlert("⚠️ El retiro debe ser entre 5 y 20 TON.");
        return;
    }

    if (saldoActual < lechugasNecesarias) {
        tg.showAlert(`❌ Saldo insuficiente. Necesitas ${lechugasNecesarias} 🥬.`);
        return;
    }

    tg.showConfirm(`¿Retirar ${tonAmount} TON? Se descontarán ${lechugasNecesarias} 🥬.`, async (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user;
            try {
                const res = await fetch('/api/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        telegramId: user.id.toString(),
                        withdrawAmount: tonAmount,
                        username: user.username || user.first_name
                    })
                });
                if (res.ok) tg.showPopup({ title: "Solicitud Enviada", message: "Revisaremos tu retiro pronto." });
            } catch (e) { tg.showAlert("Error en la solicitud."); }
        }
    });
}

// 4. DATOS DE USUARIO (AVATAR Y SALDO)
async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;
    document.getElementById('user-name').innerText = user.first_name;
    
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');
    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.style.display = 'block';
        if(initialsEl) initialsEl.style.display = 'none';
    } else if(initialsEl) {
        initialsEl.innerText = user.first_name.charAt(0);
    }

    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });
        const data = await res.json();
        if (data.coins !== undefined) document.getElementById('balance').innerText = data.coins;
    } catch (e) { console.error("Error saldo"); }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
