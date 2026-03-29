// --- 1. CONFIGURACIÓN INICIAL ---
const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;

// --- 2. NAVEGACIÓN GLOBAL ---
window.showSection = function(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });
    // Sincronizar saldo grande en Wallet
    if (sectionId === 'wallet') {
        document.getElementById('wallet-coins-display').innerText = document.getElementById('user-coins').innerText;
    }
};

// --- 3. CARGA DE USUARIO Y DB ---
window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('user-coins').innerText = data.coins || 0;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
        });
    }

    // Inicializar TON Connect en Testnet
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
        buttonRootId: 'ton-connect',
        network: 'testnet' 
    });
};

// --- 4. PUBLICIDAD (AdsGram) ---
window.verAnuncio = function() {
    // Usamos el ID 27 para Testing
    const AdController = window.Adsgram.init({ blockId: "27" });

    AdController.show().then(() => {
        sumarLechugasDB(10);
        tg.showAlert("¡Ganaste 10 lechugas! 🥬");
    }).catch(() => {
        tg.showAlert("Debes ver el video completo.");
    });
};

// --- 5. DEPÓSITO (Comprar) ---
window.comprarLechugas = async function() {
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{
            address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", // <--- IMPORTANTE: Pon tu billetera de prueba
            amount: "100000000", // 0.1 TON
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            sumarLechugasDB(1000);
            tg.showAlert("✅ Compra exitosa: +1000 🥬");
        }
    } catch (e) {
        tg.showAlert("Transacción cancelada.");
    }
};

// --- 6. RETIRO MANUAL ---
window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText);
    const wallet = tonConnectUI.account?.address;

    if (!wallet) return tg.showAlert("Conecta tu wallet primero.");
    if (balance < 50000) return tg.showAlert("Mínimo: 50,000 lechugas.");

    tg.showConfirm("¿Solicitar retiro de 50,000 lechugas?", (ok) => {
        if (ok) {
            fetch('/api/withdraw-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    telegramId: tg.initDataUnsafe.user.id, 
                    amount: 50000, 
                    address: wallet 
                })
            })
            .then(res => res.json())
            .then(data => {
                document.getElementById('user-coins').innerText = data.newBalance;
                tg.showAlert("📩 Solicitud enviada. Javier procesará el pago.");
            });
        }
    });
};

// Función auxiliar para actualizar saldo en MongoDB
function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('user-coins').innerText = data.coins;
    });
}
