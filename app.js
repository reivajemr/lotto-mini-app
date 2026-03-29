// Variable global única
window.lottoApp = {
    tg: window.Telegram.WebApp,
    ton: null
};

function init() {
    console.log("🚀 Iniciando sistema local...");
    window.lottoApp.tg.expand();

    // Intentar crear el botón si la librería ya cargó
    if (typeof TONConnectUI !== 'undefined') {
        window.lottoApp.ton = new TONConnectUI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-button'
        });
        console.log("✅ Botón de Wallet creado");
    } else {
        console.error("❌ La librería tonconnect-ui.min.js no se encontró en tu GitHub");
    }

    // Cargar nombre
    const user = window.lottoApp.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
}

// Navegación simple
function showSection(id) {
    ['home', 'tasks', 'wallet', 'referrals'].forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
}

// Arrancar
window.addEventListener('DOMContentLoaded', init);
