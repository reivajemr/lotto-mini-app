// Usamos el objeto global para evitar conflictos
window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

// --- FUNCIÓN DE NAVEGACIÓN (Arregla el error "not defined") ---
window.showSection = function(sectionId) {
    console.log("Cambiando a sección:", sectionId);
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) {
            el.style.display = (id === sectionId) ? 'block' : 'none';
        }
    });
};

// --- INICIALIZACIÓN DE BILLETERA ---
function inicializarBilletera() {
    const TONLib = window.TONConnectUI;
    if (TONLib && TONLib.TonConnectUI) {
        try {
            if (!window.LottoApp.tonConnectUI) {
                window.LottoApp.tonConnectUI = new TONLib.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-button'
                });
                console.log("✅ Billetera lista");
            }
        } catch (e) {
            console.error("❌ Error en TON:", e);
        }
    } else {
        setTimeout(inicializarBilletera, 1000);
    }
}

// Arrancar todo al cargar la página
window.addEventListener('load', () => {
    inicializarBilletera();
    
    // Mostrar nombre del usuario
    const user = window.LottoApp.tg.initDataUnsafe.user;
    if (user) {
        const nameElement = document.getElementById('user-name');
        if (nameElement) nameElement.innerText = user.first_name;
    }
});
