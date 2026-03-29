// Usamos un objeto para organizar todo
const App = {
    tg: window.Telegram.WebApp,
    ton: null
};

// Expandir la app al iniciar
App.tg.expand();

// Función que arranca los componentes
function iniciarLobby() {
    console.log("🚀 Iniciando Lobby...");

    // 1. Inicializar Billetera
    if (typeof TONConnectUI !== 'undefined') {
        try {
            App.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Botón de Wallet listo");
        } catch (e) {
            console.error("❌ Error al crear objeto TON:", e);
        }
    } else {
        console.error("❌ La librería TON no cargó correctamente.");
    }

    // 2. Mostrar nombre de usuario
    if (App.tg.initDataUnsafe.user) {
        document.getElementById('user-name').innerText = App.tg.initDataUnsafe.user.first_name;
    }
}

// Navegación entre pestañas
function showSection(id) {
    const secciones = ['home', 'tasks', 'wallet', 'referrals'];
    secciones.forEach(s => {
        const div = document.getElementById(s + '-section');
        if (div) {
            div.style.display = (s === id) ? 'block' : 'none';
        }
    });
    
    // Feedback táctil
    if (App.tg.HapticFeedback) {
        App.tg.HapticFeedback.impactOccurred('light');
    }
}

// Iniciar cuando la ventana esté lista
window.onload = iniciarLobby;
