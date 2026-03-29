// Usamos un solo objeto para evitar errores de "already declared"
window.LottoApp = {
    tg: window.Telegram.WebApp,
    tonConnectUI: null
};

window.LottoApp.tg.expand();

function inicializarBilletera() {
    if (typeof TONConnectUI !== 'undefined') {
        try {
            window.LottoApp.tonConnectUI = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Billetera configurada correctamente");
        } catch (error) {
            console.error("❌ Error al inicializar TON Connect:", error);
        }
    } else {
        console.log("⏳ Reintentando carga de librería...");
        setTimeout(inicializarBilletera, 500);
    }
}

// Iniciar cuando cargue la página
window.addEventListener('load', () => {
    inicializarBilletera();
    
    // Cargar nombre de usuario
    const user = window.LottoApp.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
});

// Función para cambiar de sección
function showSection(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });
}
