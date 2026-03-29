// Usamos un nombre único para evitar el error de "Already declared"
window.LottoProyecto = {
    tg: window.Telegram.WebApp,
    ton: null
};

// Expandir la aplicación
LottoProyecto.tg.expand();

function inicializarTodo() {
    console.log("🚀 Iniciando componentes del Lobby...");

    // 1. Intentar cargar la billetera
    if (typeof TONConnectUI !== 'undefined') {
        try {
            LottoProyecto.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Botón de Wallet vinculado");
        } catch (e) {
            console.error("❌ Error al crear objeto TON:", e);
        }
    } else {
        console.error("❌ La librería TON no cargó. Verifica tu conexión a internet.");
    }

    // 2. Nombre de usuario
    const user = LottoProyecto.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
}

// Función de navegación
function showSection(id) {
    const capsulas = ['home', 'tasks', 'wallet', 'referrals'];
    capsulas.forEach(c => {
        const div = document.getElementById(c + '-section');
        if (div) div.style.display = (c === id) ? 'block' : 'none';
    });
}

// Iniciar cuando la página esté lista
window.onload = inicializarTodo;
