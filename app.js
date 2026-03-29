window.LottoApp = window.LottoApp || {};
window.LottoApp.tg = window.Telegram.WebApp;
window.LottoApp.tg.expand();

window.showSection = function(sectionId) {
    // 1. Ocultar todas las secciones primero
    ['home', 'tasks', 'wallet', 'referrals'].forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = 'none';
    });

    // 2. Mostrar la sección seleccionada
    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) activeSection.style.display = 'block';

    // 3. Si entramos a la billetera, dibujamos el botón DESPUÉS de mostrarla
    if (sectionId === 'wallet') {
        setTimeout(dibujarBotonTon, 100); // 100ms de gracia para que el DOM respire
    }
};

function dibujarBotonTon() {
    // Evitar duplicados si ya se dibujó antes
    if (window.LottoApp.billeteraActiva) return;

    const TonUI = window.TONConnectUI;
    if (TonUI && TonUI.TonConnectUI) {
        try {
            window.LottoApp.billeteraActiva = new TonUI.TonConnectUI({
                // Asegúrate de que este archivo exista en tu GitHub
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Botón dibujado exitosamente en pantalla visible");
        } catch (error) {
            console.error("❌ Error al dibujar:", error);
        }
    } else {
        // Reintentar si el internet está lento
        setTimeout(dibujarBotonTon, 500);
    }
}
