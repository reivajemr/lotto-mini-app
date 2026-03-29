window.LottoProyecto = {
    tg: window.Telegram.WebApp,
    ton: null
};

LottoProyecto.tg.expand();

// Sistema de intentos para esperar la librería
let intentos = 0;

function intentarConectarWallet() {
    // Si la librería ya descargó y está lista
    if (typeof TONConnectUI !== 'undefined') {
        try {
            LottoProyecto.ton = new TONConnectUI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-button'
            });
            console.log("✅ Billetera conectada con éxito!");
        } catch (e) {
            console.error("❌ Error al crear objeto TON:", e);
        }
    } else {
        // Si no está lista, vuelve a intentar en medio segundo (máximo 10 intentos)
        intentos++;
        if (intentos <= 10) {
            console.log(`⏳ Esperando librería... (Intento ${intentos})`);
            setTimeout(intentarConectarWallet, 500);
        } else {
            console.error("❌ Internet muy lento, recarga la Mini App.");
        }
    }
}

function inicializarTodo() {
    console.log("🚀 Iniciando Lobby...");
    
    // Arrancar el buscador de la billetera
    intentarConectarWallet();

    // Cargar nombre
    const user = LottoProyecto.tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
    }
}

// Navegación
function showSection(id) {
    const capsulas = ['home', 'tasks', 'wallet', 'referrals'];
    capsulas.forEach(c => {
        const div = document.getElementById(c + '-section');
        if (div) div.style.display = (c === id) ? 'block' : 'none';
    });
}

window.onload = inicializarTodo;
