// Objeto Global Único
window.LottoApp = {
    tg: window.Telegram.WebApp,
    ton: null,
    saldoLechugas: 0
};

// Configuración inicial de Telegram
LottoApp.tg.expand();

function inicializarApp() {
    console.log("🚀 Iniciando sistema...");

    // 1. Cargar TON Connect
    if (typeof TONConnectUI !== 'undefined') {
        try {
            LottoApp.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Billetera conectada al botón");
        } catch (err) {
            console.error("❌ Error al crear objeto TON:", err);
        }
    } else {
        console.error("❌ La librería TON aún no carga. Revisa la ruta en el HTML.");
    }

    // 2. Mostrar nombre de usuario
    const user = LottoApp.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
}

// Navegación entre pestañas
function showSection(id) {
    const secciones = ['home', 'tasks', 'wallet', 'referrals'];
    secciones.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) {
            el.style.display = (s === id) ? 'block' : 'none';
        }
    });
    
    // Feedback táctil
    if (LottoApp.tg.HapticFeedback) {
        LottoApp.tg.HapticFeedback.impactOccurred('light');
    }
}

// Función para el botón de tareas
function mostrarAnuncio() {
    LottoApp.saldoLechugas += 10;
    document.getElementById('val-lechugas').innerText = LottoApp.saldoLechugas;
    LottoApp.tg.showAlert("¡Recibiste 10 🥬!");
}

// Ejecutar cuando todo cargue
window.addEventListener('load', inicializarApp);
 
