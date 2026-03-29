const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

// Función de navegación corregida
window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id + '-section');
    if (target) target.style.display = 'block';
};

// Función especial para Wallet para sincronizar el saldo
window.buttonWallet = function() {
    showSection('wallet');
    const saldo = document.getElementById('user-coins').innerText;
    document.getElementById('wallet-coins-display').innerText = saldo;
};

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Carga de DB con protección contra errores de red
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            // Si data.coins es null o undefined, ponemos 0 para que no se vea feo
            const coins = data.coins || 0;
            document.getElementById('user-coins').innerText = coins;
        })
        .catch(() => {
            console.log("Error de conexión con la DB");
            document.getElementById('user-coins').innerText = "0";
        });
    }

    // Retardamos la carga de la billetera para que el resto cargue rápido
    setTimeout(() => {
        if (window.TON_CONNECT_UI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                network: 'testnet' 
            });
        }
    }, 1500);
};

// Función para sumar lechugas blindada
function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    const current = parseInt(document.getElementById('user-coins').innerText) || 0;
    const nuevoTotal = current + cantidad;

    // Actualizamos visualmente al instante
    document.getElementById('user-coins').innerText = nuevoTotal;
    if(document.getElementById('wallet-coins-display')) {
        document.getElementById('wallet-coins-display').innerText = nuevoTotal;
    }

    // Enviamos a la DB (si falla, al menos el usuario ya vio su saldo subir)
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    });
}

window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            sumarLechugasDB(1000);
            tg.showAlert("✅ +1,000 lechugas añadidas.");
        }
    } catch (e) { tg.showAlert("Transacción cancelada."); }
};
