const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(id + '-section').style.display = 'block';
};

window.irAWallet = function() {
    showSection('wallet');
    document.getElementById('wallet-coins-display').innerText = document.getElementById('user-coins').innerText;
};

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        cargarDatosDB(user.id, user.first_name);
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

// Función para cargar datos con protección contra fallos
async function cargarDatosDB(id, name) {
    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: id, username: name })
        });
        const data = await res.json();
        const coins = data.coins ?? 0;
        document.getElementById('user-coins').innerText = coins;
        document.getElementById('wallet-coins-display').innerText = coins;
    } catch (e) {
        console.error("Error cargando saldo:", e);
    }
}

window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            tg.showAlert("✅ ¡Pago confirmado!");
            guardarCompra(1000);
        }
    } catch (e) {
        tg.showAlert("Transacción cancelada.");
    }
};

// FUNCIÓN CLAVE: Guarda y actualiza la UI
async function guardarCompra(cantidad) {
    const user = tg.initDataUnsafe.user;
    
    // 1. Suma visual inmediata (para que el usuario vea el cambio)
    let actual = parseInt(document.getElementById('user-coins').innerText) || 0;
    let nuevoTotal = actual + cantidad;
    document.getElementById('user-coins').innerText = nuevoTotal;
    document.getElementById('wallet-coins-display').innerText = nuevoTotal;

    // 2. Intento de guardado en base de datos
    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, reward: cantidad })
        });
        
        if (!response.ok) throw new Error("Fallo en servidor");
        console.log("Guardado exitoso en DB");
    } catch (e) {
        tg.showAlert("⚠️ Error al sincronizar con el servidor. Tu saldo se actualizará en la próxima carga.");
    }
}
