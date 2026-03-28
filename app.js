// Inicializar la WebApp de Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Abre la app a pantalla completa

// Función para cambiar de sección
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.getElementById('home-section').style.display = 'none';
    document.getElementById('tasks-section').style.display = 'none';
    
    // Mostrar la seleccionada
    document.getElementById(sectionId + '-section').style.display = 'block';
}

// Simulación de ganar lechugas (Luego esto se conectará a tu Base de Datos)
let saldoLechugas = 0;

function mostrarAnuncio() {
    alert("Aquí se cargaría el video de AdsGram...");
    // Simulamos que vio el anuncio
    saldoLechugas += 10;
    document.getElementById('val-lechugas').innerText = saldoLechugas;
    tg.showScanQrPopup({ text: "¡Ganaste 10 lechugas!" }); // Efecto visual de Telegram
    setTimeout(() => tg.closeScanQrPopup(), 2000);
}
// Inicializar TON Connect UI
const tonConnectUI = new TONConnectUI.TonConnectUI({
    manifestUrl: 'https://tu-app.vercel.app/tonconnect-manifest.json', // Cambia esto por tu URL de Vercel
    buttonRootId: 'ton-connect'
});

// Detectar cuando se conecta la billetera
tonConnectUI.onStatusChange(wallet => {
    if (wallet) {
        const address = wallet.account.address;
        document.getElementById('wallet-details').style.display = 'block';
        document.getElementById('wallet-address').innerText = address.substring(0, 6) + "..." + address.substring(address.length - 4);
        console.log("Billetera conectada:", address);
    } else {
        document.getElementById('wallet-details').style.display = 'none';
    }
});
