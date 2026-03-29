/* app.js - Funcionalidad Total */
const tg = window.Telegram.WebApp;
tg.expand();

// FUNCIÓN DE NAVEGACIÓN (Lo que ya tienes, pero mejorado)
function showSection(sectionId) {
    console.log("Cambiando a sección:", sectionId);
    
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    } else {
        console.error("No se encontró la sección:", sectionId);
    }
}

// CARGAR LAS 1000 LECHUGAS DESDE MONGODB
async function cargarDatos() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });
        const data = await response.json();
        
        // Actualizar el saldo de 1000
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.innerText = data.coins || 0;

        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.innerText = user.first_name || "Usuario";

    } catch (e) {
        console.error("Error de conexión:", e);
    }
}

// FUNCIÓN DE CONEXIÓN DE WALLET REAL (NUEVA FUNCIONALIDAD)
async function connectWallet() {
    console.log("Iniciando conexión de Wallet...");
    
    // Mostramos una alerta de carga de Telegram
    tg.MainButton.setText("Conectando Wallet...");
    tg.MainButton.show();
    tg.MainButton.enable();

    // Simulamos la conexión (Aquí iría la llamada a TonConnect o MetaMask)
    setTimeout(() => {
        const walletAddress = "0xExampleAddress...1234"; // Simulada
        localStorage.setItem('wallet', walletAddress);
        
        // Actualizamos la interfaz
        const walletBtn = document.getElementById('connect-wallet-btn');
        if (walletBtn) {
            walletBtn.innerText = "Wallet Conectada ✅";
            walletBtn.style.backgroundColor = "#28a745"; // Verde éxito
            walletBtn.onclick = null; // Desactivar el clic
        }
        
        tg.MainButton.hide();
        console.log("Wallet conectada:", walletAddress);
        tg.HapticFeedback.notificationOccurred('success'); // Vibración de éxito
    }, 2000); // 2 segundos de simulación
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    
    // Nos aseguramos de que el botón de Wallet esté listo para conectar
    const walletBtn = document.getElementById('connect-wallet-btn');
    if (walletBtn) {
        // Vinculamos la función connectWallet al clic
        walletBtn.onclick = connectWallet; 
    }

    // Empezamos en el Lobby
    showSection('lobby');
});
