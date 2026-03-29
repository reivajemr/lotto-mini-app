const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

// 1. NAVEGACIÓN UNIFICADA (Elimina el error 'irAWallet is not defined')
window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id + '-section');
    if (target) {
        target.style.display = 'block';
        // Sincronizamos el número grande de la wallet
        if (id === 'wallet') {
            document.getElementById('wallet-coins-display').innerText = document.getElementById('user-coins').innerText;
        }
    }
};

// 2. CARGA INICIAL
window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Cargar saldo real desde MongoDB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            const coins = data.coins || 0;
            document.getElementById('user-coins').innerText = coins;
            document.getElementById('wallet-coins-display').innerText = coins;
        })
        .catch(err => console.log("Error de conexión al cargar saldo"));
    }

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

// 3. COMPRA Y GUARDADO PERMANENTE
window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            tg.showConfirm("✅ Pago confirmado. ¿Deseas sumar tus 1,000 lechugas?", (ok) => {
                if(ok) guardarEnBaseDeDatos(1000);
            });
        }
    } catch (e) {
        tg.showAlert("Transacción cancelada.");
    }
};

function guardarEnBaseDeDatos(cantidad) {
    const user = tg.initDataUnsafe.user;
    
    // Suma visual inmediata
    let actual = parseInt(document.getElementById('user-coins').innerText) || 0;
    let nuevoTotal = actual + cantidad;
    document.getElementById('user-coins').innerText = nuevoTotal;
    document.getElementById('wallet-coins-display').innerText = nuevoTotal;

    // GUARDADO REAL EN MONGODB
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    })
    .then(res => {
        if(res.ok) tg.showAlert("¡Saldo guardado permanentemente!");
        else throw new Error();
    })
    .catch(() => {
        tg.showAlert("⚠️ Error al sincronizar. Si recargas podrías perder el saldo actual.");
    });
}
