// 1. INICIALIZACIÓN DEL SDK DE TELEGRAM
const tg = window.Telegram.WebApp;
tg.expand(); // Abre la app a pantalla completa al iniciar

// 2. CONFIGURACIÓN DE TON CONNECT (Billetera)
// IMPORTANTE: Asegúrate de que el manifestUrl sea EXACTO al de tu Vercel
// Cambia el inicio de tu app.js por esto:
let tonConnectUI;

try {
    tonConnectUI = new TONConnectUI.TonConnectUI({
        manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
        buttonRootId: 'ton-connect-button'
    });
    console.log("TON Connect inicializado");
} catch (e) {
    console.error("Error al cargar TON Connect:", e);
}

// 3. VARIABLES DE ESTADO (Saldo local para pruebas)
let saldoLechugas = 0;
let saldoTon = 0.00;

// 4. LÓGICA DE NAVEGACIÓN ENTRE SECCIONES
function showSection(sectionId) {
    // Lista de todas las secciones disponibles
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) {
            el.style.display = (s === sectionId) ? 'block' : 'none';
        }
    });

    // Feedback táctil de Telegram al cambiar de pestaña
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// 5. ESCUCHA DE CAMBIOS EN LA BILLETERA (TON)
tonConnectUI.onStatusChange(wallet => {
    const details = document.getElementById('wallet-details');
    const addrText = document.getElementById('wallet-address');
    const tonBalanceText = document.getElementById('val-ton');

    if (wallet) {
        // Si el usuario conecta la billetera
        details.style.display = 'block';
        const rawAddr = wallet.account.address;
        // Acortar dirección para estética (ej: 0x123...abcd)
        const shortAddr = rawAddr.substring(0, 6) + "..." + rawAddr.substring(rawAddr.length - 4);
        addrText.innerText = shortAddr;
        
        // Aquí luego pediremos el saldo real a la blockchain
        // Por ahora simulamos que detecta la conexión
        console.log("Wallet conectada:", rawAddr);
    } else {
        // Si el usuario se desconecta
        details.style.display = 'none';
        tonBalanceText.innerText = "0.00";
    }
});

// 6. MÓDULO DE TAREAS (Ganar Lechugas)
function mostrarAnuncio() {
    // Aquí es donde iría el código de AdsGram en el futuro
    tg.showConfirm("¿Quieres ver un anuncio para ganar 10 🥬?", (confirm) => {
        if (confirm) {
            tg.showProgress(false); // Muestra círculo de carga
            
            setTimeout(() => {
                tg.hideProgress();
                saldoLechugas += 10;
                actualizarSaldosVisuales();
                
                // Notificación nativa de Telegram
                tg.showAlert("¡Felicidades! Ganaste 10 lechugas.");
            }, 2000); // Simulamos 2 segundos de anuncio
        }
    });
}

// 7. MÓDULO DE REFERIDOS
function copiarEnlace() {
    const userId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : "nuevo_user";
    const link = `https://t.me/TuBotName?start=${userId}`;
    
    // Usar la API de Telegram para copiar al portapapeles
    navigator.clipboard.writeText(link).then(() => {
        tg.showAlert("¡Enlace copiado! Envíalo a tus amigos.");
    });
}

// 8. UTILIDADES
function actualizarSaldosVisuales() {
    document.getElementById('val-lechugas').innerText = saldoLechugas;
    // El saldo de TON se actualizará mediante la lógica de la billetera
}

// 9. CONFIGURAR DATOS DEL USUARIO DESDE TELEGRAM
if (tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    document.getElementById('user-name').innerText = user.first_name;
    if (user.photo_url) {
        document.getElementById('user-photo').src = user.photo_url;
    }
}

// Mensaje inicial en consola para verificar que cargó
console.log("Lotto App Iniciada Correctamente");
