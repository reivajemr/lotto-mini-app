// Usamos el objeto global para evitar errores de redifinicón
window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

// Navegación corregida
window.showSection = function(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });

    // Forzar la creación del botón específicamente cuando se abre la wallet
    if (sectionId === 'wallet') {
        renderizarBotonTON();
    }
};

function renderizarBotonTON() {
    const TonLib = window.TONConnectUI;
    const container = document.getElementById('ton-connect-button');
    
    if (container && TonLib && TonLib.TonConnectUI) {
        // Solo creamos la instancia si no existe ya
        if (!window.LottoApp.ui) {
            try {
                window.LottoApp.ui = new TonLib.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Interfaz de Wallet cargada.");
            } catch (e) {
                console.error("❌ Error inicializando TON:", e);
            }
        }
    } else {
        // Si la librería externa aún no baja, reintenta brevemente
        setTimeout(renderizarBotonTON, 500);
    }
}

// Inicializar al cargar la página
window.onload = renderizarBotonTON;
