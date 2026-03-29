const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

// 1. NAVEGACIÓN UNIFICADA
window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id + '-section');
    if (target) target.style.display = 'block';
    
    // Actualizar el display de la wallet si se entra ahí
    if (id === 'wallet') {
        const saldo = document.getElementById('user-coins').innerText;
        document.getElementById('wallet-coins-display').innerText = saldo;
    }
};

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Cargar saldo inicial desde la base de datos
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
        });
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

// 2. COMPRA CON GUARDADO PERMANENTE
window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            tg.showAlert("✅ Pago exitoso. Guardando en base de datos...");
            sumarLechugasDB(1000);
        }
    } catch (e) {
        tg.showAlert("Transacción fallida.");
    }
};

function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    const current = parseInt(document.getElementById('user-coins').innerText) || 0;
    const nuevoTotal = current + cantidad;

    // Actualización visual inmediata
    document.getElementById('user-coins').innerText = nuevoTotal;
    document.getElementById('wallet-coins-display').innerText = nuevoTotal;

    // PETICIÓN CRÍTICA: Guardar en MongoDB para que no se borre al recargar
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            telegramId: user.id, 
            reward: cantidad // Tu API debe sumar esto al saldo existente en MongoDB
        })
    })
    .then(res => {
        if(res.ok) console.log("Saldo guardado permanentemente");
        else throw new Error();
    })
    .catch(() => tg.showAlert("⚠️ Error al guardar. Verifica tu conexión."));
}
