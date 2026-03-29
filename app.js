// Usamos el objeto global window para evitar errores de redifinicón
window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

// Función de navegación
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
    // Intentar cargar la billetera si entramos a esa sección
    if (id === 'wallet') inicializarBilletera();
};

function inicializarBilletera() {
    // Verificamos si la clase existe en el objeto global 'window'
    const TonUI = window.TONConnectUI;

    if (TonUI && TonUI.TonConnectUI) {
        if (!window.LottoApp.tonInstance) {
            try {
                window.LottoApp.tonInstance = new TonUI.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Billetera renderizada con éxito");
            } catch (e) {
                console.error("❌ Error al crear instancia TON:", e);
            }
        }
    } else {
        // Si no está, esperamos medio segundo y reintentamos automáticamente
        setTimeout(inicializarBilletera, 500);
    }
}

// Iniciar proceso al cargar la página
window.onload = inicializarBilletera;
