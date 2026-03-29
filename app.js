// 1. NAVEGACIÓN GLOBAL
window.showSection = function(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });
};

const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Sincronizar con MongoDB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            // Mostramos las lechugas que vienen de la DB
            document.getElementById('user-coins').innerText = data.coins || 0;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
        });
    }

    if (window.TON_CONNECT_UI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect',
            network: 'testnet' 
        });
    }
};

// --- SUMAR LECHUGAS (RECOMPENSA) ---
window.sumarRecompensa = function(cantidad) {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('user-coins').innerText = data.coins;
        tg.showAlert(`¡Has ganado ${cantidad} lechugas! 🥬`);
    });
};

// --- RETIRO MANUAL ---
window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText);
    const wallet = tonConnectUI.account?.address;

    if (!wallet) return tg.showAlert("Conecta tu wallet primero.");
    if (balance < 50000) return tg.showAlert("Mínimo 50,000 lechugas.");

    tg.showConfirm("¿Retirar 50,000 lechugas?", (ok) => {
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
                tg.showAlert("📩 Solicitud de retiro enviada.");
            });
        }
    });
};
