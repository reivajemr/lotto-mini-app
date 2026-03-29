// Usamos un objeto único para evitar conflictos de nombres
window.LottoApp = window.LottoApp || {
    tg: window.Telegram.WebApp,
    tonConnectUI: null
};

window.LottoApp.tg.expand();

function inicializarBilletera() {
    // Verificamos si la librería externa ya bajó de internet
    if (typeof TONConnectUI !== 'undefined') {
        try {
            if (!window.LottoApp.tonConnectUI) {
                window.LottoApp.tonConnectUI = new TONConnectUI.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Librería cargada y botón vinculado.");
            }
        } catch (e) {
            console.error("❌ Error al crear el botón:", e);
        }
    } else {
        // Si no ha cargado, reintenta cada segundo
        console.log("⏳ Reintentando carga de librería...");
        setTimeout(inicializarBilletera, 1000);
    }
}

// Iniciar proceso
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBilletera);
} else {
    inicializarBilletera();
}
