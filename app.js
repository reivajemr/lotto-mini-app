// Usamos el objeto global window para que no haya errores de "already declared"
window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;

// Expandir la app
window.LottoApp.tg.expand();

function inicializarBilletera() {
    console.log("🔍 Verificando librería TON...");

    // Comprobamos si la clase TONConnectUI ya existe en el navegador
    if (typeof TONConnectUI !== 'undefined') {
        try {
            if (!window.LottoApp.tonConnectUI) {
                window.LottoApp.tonConnectUI = new TONConnectUI.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ ¡Billetera vinculada y lista!");
            }
        } catch (e) {
            console.error("❌ Error al crear el botón:", e);
        }
    } else {
        // Si aún no carga, esperamos 1 segundo y reintentamos
        console.warn("⏳ Librería no detectada aún, reintentando...");
        setTimeout(inicializarBilletera, 1000);
    }
}

// Aseguramos que la navegación funcione siempre
window.showSection = function(id) {
    const secciones = ['home', 'tasks', 'wallet', 'referrals'];
    secciones.forEach(s => {
        const div = document.getElementById(s + '-section');
        if (div) div.style.display = (s === id) ? 'block' : 'none';
    });
};

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarBilletera);
