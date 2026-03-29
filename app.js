// Asegurar que Telegram inicie
window.Telegram.WebApp.expand();

// Inyección directa sin retrasos
window.addEventListener('DOMContentLoaded', () => {
    try {
        const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect'
        });
        console.log("🚀 Billetera inyectada en el DOM");
    } catch (e) {
        console.error("❌ Fallo al inyectar TON:", e);
    }
});

// Mantén tu función de navegación igual
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
};
