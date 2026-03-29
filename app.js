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

    // Si entramos a la wallet, forzamos la creación del botón si no existe
    if (sectionId === 'wallet') {
        inicializarBilletera();
    }
};

function inicializarBilletera() {
    const TONLib = window.TONConnectUI;
    const buttonContainer = document.getElementById('ton-connect-button');
    
    // Solo intentamos si el contenedor existe y la librería cargó
    if (buttonContainer && TONLib && TONLib.TonConnectUI) {
        if (!window.LottoApp.tonConnectUI) {
            try {
                window.LottoApp.tonConnectUI = new TONLib.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Botón de Wallet generado");
            } catch (e) {
                console.error("❌ Error al crear el botón:", e);
            }
        }
    } else if (!TONLib) {
        console.warn("⏳ Esperando librería externa...");
        setTimeout(inicializarBilletera, 1000);
    }
}

// Iniciar al cargar
window.addEventListener('load', () => {
    // Si la app arranca en la sección wallet, inicializar
    if (document.getElementById('wallet-section').style.display !== 'none') {
        inicializarBilletera();
    }
});
