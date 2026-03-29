// 1. ELIMINAMOS DUPLICADOS: Declaramos 'tg' de forma segura
if (typeof tg === 'undefined') {
    window.tg = window.Telegram.WebApp;
}
tg.expand();

// 2. INICIALIZACIÓN SEGURA DE TON CONNECT
let tonConnectUI;

function initTonConnect() {
    try {
        if (typeof TONConnectUI !== 'undefined') {
            tonConnectUI = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ TON Connect cargado");
            
            // Configurar el escucha de cambios de billetera
            tonConnectUI.onStatusChange(wallet => {
                const details = document.getElementById('wallet-details');
                if (wallet) {
                    details.style.display = 'block';
                    document.getElementById('wallet-address').innerText = 
                        wallet.account.address.substring(0, 6) + "..." + wallet.account.address.slice(-4);
                } else {
                    details.style.display = 'none';
                }
            });
        } else {
            console.error("❌ La librería TON no está presente en el HTML");
        }
    } catch (e) {
        console.error("❌ Error en initTonConnect:", e);
    }
}

// 3. NAVEGACIÓN (Lobby, Tareas, etc)
function showSection(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === sectionId) ? 'block' : 'none';
    });
}

// 4. FUNCIONES DE PRUEBA
let saldoLechugas = 0;
function mostrarAnuncio() {
    saldoLechugas += 10;
    document.getElementById('val-lechugas').innerText = saldoLechugas;
    tg.showAlert("¡Ganaste 10 🥬!");
}

// 5. ARRANCAR AL CARGAR
window.onload = () => {
    initTonConnect();
    // Cargar nombre de usuario
    if (tg.initDataUnsafe.user) {
        document.getElementById('user-name').innerText = tg.initDataUnsafe.user.first_name;
    }
};
