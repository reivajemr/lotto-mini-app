const tg = window.Telegram.WebApp;
tg.expand();

window.onload = function() {
    // 1. Datos de Usuario
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        if (user.photo_url) document.getElementById('user-avatar').src = user.photo_url;

        // Sincronizar Monedas (Solo si ya creaste la carpeta /api/user.js)
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('user-coins').innerText = data.coins || 500;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
        })
        .catch(err => console.log("Usando valores por defecto (500)"));
    }

    // 2. Inicializar Billetera (Esto quita el círculo de carga)
    iniciarBilletera();
};

function iniciarBilletera() {
    const interval = setInterval(() => {
        if (window.TON_CONNECT_UI) {
            clearInterval(interval);
            const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect' // <--- DEBE coincidir con el ID en tu HTML
            });
        }
    }, 500);
}

// 3. Navegación Global
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
};
