const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;

// 1. NAVEGACIÓN INSTANTÁNEA
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
    if (id === 'wallet') {
        document.getElementById('wallet-coins-display').innerText = document.getElementById('user-coins').innerText;
    }
};

// 2. CARGA ASÍNCRONA (No bloquea la pantalla)
window.onload = function() {
    // Quitamos la pantalla de carga de inmediato
    const loader = document.getElementById('loading-screen');
    if (loader) loader.style.display = 'none';

    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Llamada a DB sin esperar por ella para mostrar la app
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            const coins = data.coins ?? 0;
            document.getElementById('user-coins').innerText = coins;
            document.getElementById('user-gems').innerText = (data.gems ?? 0).toFixed(2);
        })
        .catch(() => {
            console.log("Error de red: Usando valores locales");
            document.getElementById('user-coins').innerText = "0";
        });
    }

    // Inicializar billetera con retardo para asegurar que el script cargó
    setTimeout(() => {
        if (window.TON_CONNECT_UI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                network: 'testnet' 
            });
        }
    }, 800);
};

// --- RESTO DE FUNCIONES (Comprar, Retirar, Sumar) ---
function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    const current = parseInt(document.getElementById('user-coins').innerText) || 0;
    const total = current + cantidad;
    
    document.getElementById('user-coins').innerText = total;
    if(document.getElementById('wallet-coins-display')) document.getElementById('wallet-coins-display').innerText = total;

    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    });
}

window.verAnuncio = function() {
    if(!window.Adsgram) return tg.showAlert("Cargando sistema de anuncios... intenta en 3 segundos.");
    const AdController = window.Adsgram.init({ blockId: "27" });
    AdController.show().then(() => {
        sumarLechugasDB(10);
        tg.showAlert("¡+10 🥬!");
    }).catch(() => tg.showAlert("Anuncio no completado."));
};

window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) sumarLechugasDB(1000);
    } catch (e) { tg.showAlert("Pago cancelado."); }
};

window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText) || 0;
    if (balance < 50000) return tg.showAlert("Mínimo 50,000 🥬");
    // Lógica de fetch a /api/withdraw-request aquí igual que antes...
};
