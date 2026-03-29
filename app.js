const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

// 1. NAVEGACIÓN
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
};

// Función para entrar a Wallet y actualizar el número grande
window.btnWallet = function() {
    showSection('wallet');
    const saldo = document.getElementById('user-coins').innerText;
    document.getElementById('wallet-coins-display').innerText = saldo;
};

// 2. INICIO
window.onload = function() {
    // Quitamos la carga de inmediato
    const loader = document.getElementById('loading-screen');
    if (loader) loader.style.display = 'none';

    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Cargar saldo de la DB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            const coins = data.coins || 0;
            document.getElementById('user-coins').innerText = coins;
            if(document.getElementById('wallet-coins-display')) {
                document.getElementById('wallet-coins-display').innerText = coins;
            }
        })
        .catch(err => console.log("Error de conexión con base de datos"));
    }

    // Inicializar TonConnect con retraso
    setTimeout(() => {
        if (window.TON_CONNECT_UI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                network: 'testnet' 
            });
        }
    }, 1000);
};

// 3. COMPRA Y SALDO
window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            tg.showAlert("✅ Pago exitoso.");
            sumarLechugasDB(1000); 
        }
    } catch (e) {
        tg.showAlert("Transacción cancelada.");
    }
};

function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    // Capturamos el saldo actual para sumar (evitamos undefined)
    const saldoActual = parseInt(document.getElementById('user-coins').innerText) || 0;
    const nuevoTotal = saldoActual + cantidad;

    // Actualización visual inmediata
    document.getElementById('user-coins').innerText = nuevoTotal;
    if(document.getElementById('wallet-coins-display')) {
        document.getElementById('wallet-coins-display').innerText = nuevoTotal;
    }

    // Guardar en MongoDB
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    });
}

window.verAnuncio = function() {
    tg.showAlert("El sistema de anuncios está en mantenimiento.");
};

window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText) || 0;
    if (balance < 50000) return tg.showAlert("Mínimo 50,000 🥬 para retirar.");
    tg.showAlert("Solicitud enviada a revisión.");
};
