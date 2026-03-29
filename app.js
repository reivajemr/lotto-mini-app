// Usamos el objeto global para evitar el error "already declared" que viste en consola
window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

function inicializarBilletera() {
    // Buscamos la librería directamente en el objeto window
    const TONLib = window.TONConnectUI;

    if (TONLib && TONLib.TonConnectUI) {
        try {
            if (!window.LottoApp.tonConnectUI) {
                window.LottoApp.tonConnectUI = new TONLib.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Billetera conectada exitosamente");
            }
        } catch (e) {
            console.error("❌ Error al configurar el botón:", e);
        }
    } else {
        // Si no está, esperamos y reintentamos
        setTimeout(inicializarBilletera, 1000);
    }
}

// Iniciar cuando el documento esté listo
if (document.readyState === 'complete') {
    inicializarBilletera();
} else {
    window.addEventListener('load', inicializarBilletera);
}
