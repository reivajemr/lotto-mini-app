window.LottoApp = {
    tg: window.Telegram.WebApp,
    ton: null
};

window.LottoApp.tg.expand();

function iniciarConexion() {
    // Intentamos cargar de una vez porque el archivo es local
    if (typeof TONConnectUI !== 'undefined') {
        try {
            window.LottoApp.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ ¡Billetera local vinculada!");
        } catch (e) {
            console.error("❌ Error de configuración:", e);
        }
    } else {
        console.error("❌ El archivo tonconnect-ui.min.js no se cargó correctamente desde tu servidor.");
    }
}

window.addEventListener('load', () => {
    iniciarConexion();
    const user = window.LottoApp.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
});

function showSection(id) {
    const secciones = ['home', 'tasks', 'wallet', 'referrals'];
    secciones.forEach(s => {
        const div = document.getElementById(s + '-section');
        if (div) div.style.display = (s === id) ? 'block' : 'none';
    });
}
