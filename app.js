// Usamos un objeto global para evitar errores de "ya declarado"
window.LottoApp = {
    tg: window.Telegram.WebApp,
    tonConnect: null,
    saldoLechugas: 0
};

// Expandir la app
LottoApp.tg.expand();

// Función de inicialización
function iniciarSistema() {
    console.log("Iniciando componentes...");

    // 1. Inicializar TON Connect de forma segura
    try {
        if (typeof TONConnectUI !== 'undefined') {
            LottoApp.tonConnect = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Billetera lista");
        } else {
            console.error("❌ Error: La librería externa de TON no cargó.");
        }
    } catch (err) {
        console.error("❌ Error al crear objeto TON:", err);
    }

    // 2. Cargar nombre de usuario
    if (LottoApp.tg.initDataUnsafe.user) {
        document.getElementById('user-name').innerText = LottoApp.tg.initDataUnsafe.user.first_name;
    }
}

// Cambiar pestañas
function showSection(id) {
    const capsulas = ['home', 'tasks', 'wallet', 'referrals'];
    capsulas.forEach(c => {
        const div = document.getElementById(c + '-section');
        if (div) div.style.display = (c === id) ? 'block' : 'none';
    });
}

// Ganar lechugas (Prueba)
function mostrarAnuncio() {
    LottoApp.saldoLechugas += 10;
    document.getElementById('val-lechugas').innerText = LottoApp.saldoLechugas;
    LottoApp.tg.showAlert("¡Recibiste 10 🥬!");
}

// Ejecutar cuando la página cargue
window.addEventListener('load', iniciarSistema);
