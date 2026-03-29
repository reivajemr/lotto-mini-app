window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

// Navegación fluida
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
    // Forzar renderizado al entrar a la sección
    if (id === 'wallet') renderizarBotonWallet();
};

function renderizarBotonWallet() {
    const TonLib = window.TONConnectUI;
    if (TonLib && TonLib.TonConnectUI) {
        if (!window.LottoApp.ui) {
            window.LottoApp.ui = new TonLib.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("💎 Botón UI instanciado correctamente");
        }
    } else {
        // Si la librería tarda, reintenta en medio segundo
        setTimeout(renderizarBotonWallet, 500);
    }
}

// Inicialización global
window.onload = renderizarBotonWallet;
