const tg = window.Telegram.WebApp;
tg.expand();

// 1. MOTOR DE CARGA DINÁMICA DE SECCIONES
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div style="text-align:center; margin-top:50px;">Cargando...</div>';

    try {
        const response = await fetch(`sections/${sectionId}.html`);
        if (!response.ok) throw new Error(`No se encontró la sección: ${sectionId}`);
        
        const html = await response.text();
        mainContent.innerHTML = html;

        // Re-vincular eventos si entramos en la sección Wallet
        if (sectionId === 'wallet') {
            const walletBtn = document.getElementById('connect-wallet-btn-inner');
            if (walletBtn) walletBtn.onclick = connectWallet;
        }

        actualizarMenuVisual(sectionId);

    } catch (error) {
        mainContent.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
        console.error("Error al cargar sección:", error);
    }
}

// 2. LÓGICA DE PESTAÑAS DENTRO DE WALLET (Depósito / Retiro)
function switchWalletTab(tab) {
    // Feedback táctil de Telegram
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    
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

// 3. FUNCIONES DE TRANSACCIÓN (Simuladas)
function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn-inner');
    if (!btn) return;

    tg.HapticFeedback.impactOccurred('medium');
    btn.innerText = "Conectando...";
    btn.disabled = true;

    setTimeout(() => {
        btn.innerText = "Wallet: 0x...1234 ✅";
        btn.style.background = "linear-gradient(135deg, #28a745, #218838)";
    }, 1500);
}

function initPurchase(amount) {
    tg.showConfirm(`¿Deseas comprar ${amount} lechugas 🥬?`, (ok) => {
        if (ok) tg.showAlert("Redirigiendo al pago en la red TON...");
    });
}

function requestWithdraw() {
    const amount = document.getElementById('withdraw-amount').value;
    if (!amount || amount < 2000) {
        tg.showAlert("El mínimo de retiro es de 2000 lechugas 🥬");
    } else {
        tg.showConfirm(`¿Confirmas el retiro de ${amount} lechugas a tu wallet?`, (ok) => {
            if (ok) tg.showPopup({ message: "Solicitud enviada. Recibirás tus fondos pronto." });
        });
    }
}

// 4. CARGAR DATOS DE USUARIO Y MONGODB
async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    document.getElementById('user-name').innerText = user.first_name || "Usuario";

    // Manejo de avatar e iniciales
    const photoEl = document.getElementById('user-photo');
    const initialsEl = document.getElementById('user-initials');

    if (user.photo_url) {
        photoEl.src = user.photo_url;
        photoEl.style.display = 'block';
        if (initialsEl) initialsEl.style.display = 'none';
    } else if (initialsEl) {
        initialsEl.innerText = (user.first_name || "U").charAt(0).toUpperCase();
        photoEl.style.display = 'none';
    }

    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });
        const data = await response.json();
        if (data && data.coins !== undefined) {
            document.getElementById('balance').innerText = data.coins;
        }
    } catch (error) {
        console.error("Error al sincronizar con MongoDB:", error);
    }
}

// 5. NAVEGACIÓN PRINCIPAL (Menú inferior)
function actualizarMenuVisual(sectionId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });
}

// INICIO
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby');
});
