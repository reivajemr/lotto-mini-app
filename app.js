// Usamos un solo objeto global para evitar errores de duplicación
window.LottoApp = {
    tg: window.Telegram.WebApp,
    ton: null,
    intentos: 0
};

window.LottoApp.tg.expand();

function iniciarConexion() {
    // Si la librería ya está lista en el navegador
    if (typeof TONConnectUI !== 'undefined') {
        try {
            window.LottoApp.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ ¡Billetera vinculada correctamente!");
        } catch (e) {
            console.error("❌ Error al crear el objeto TON:", e);
        }
    } else {
        // Aumentamos los intentos y el tiempo de espera
        window.LottoApp.intentos++;
        if (window.LottoApp.intentos <= 20) {
            console.log("⏳ Esperando librería... Intento: " + window.LottoApp.intentos);
            setTimeout(iniciarConexion, 1000); // Espera 1 segundo entre intentos
        } else {
            console.error("❌ No se pudo cargar la librería después de 20 segundos.");
        }
    }
}

// Inicialización general
window.addEventListener('load', () => {
    console.log("🚀 Lobby iniciado...");
    iniciarConexion();

    const user = window.LottoApp.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
});

// Función de navegación
function showSection(id) {
    const secciones = ['home', 'tasks', 'wallet', 'referrals'];
    secciones.forEach(s => {
        const div = document.getElementById(s + '-section');
        if (div) div.style.display = (s === id) ? 'block' : 'none';
    });
}
