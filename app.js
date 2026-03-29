/**
 * APP.JS - LOTTO ANIMALITO
 * Configurado para TON Testnet y Blindaje de Datos
 */

// 1. NAVEGACIÓN GLOBAL (Prioridad máxima)
window.showSection = function(sectionId) {
    console.log("Cambiando a sección:", sectionId);
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });

    // Sincronizar saldo de la billetera al entrar
    if (sectionId === 'wallet') {
        const coins = document.getElementById('user-coins').innerText;
        document.getElementById('wallet-coins-display').innerText = coins;
    }
};

const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI;

// 2. INICIO DE LA APLICACIÓN
window.onload = function() {
    console.log("Iniciando App...");
    const user = tg.initDataUnsafe.user;
    
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        // Cargar datos desde MongoDB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            // BLINDAJE: Si data.coins no existe, usamos 0 (Evita el "undefined")
            const safeCoins = (data.coins !== undefined) ? data.coins : 0;
            const safeGems = (data.gems !== undefined) ? data.gems : 0;
            
            document.getElementById('user-coins').innerText = safeCoins;
            document.getElementById('user-gems').innerText = parseFloat(safeGems).toFixed(2);
            
            // Actualizar también el display de la billetera
            if(document.getElementById('wallet-coins-display')) {
                document.getElementById('wallet-coins-display').innerText = safeCoins;
            }
        })
        .catch(err => console.error("Error cargando usuario:", err));
    }

    // Inicializar TON Connect en Testnet
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
        buttonRootId: 'ton-connect',
        network: 'testnet' 
    });
};

// 3. PUBLICIDAD
window.verAnuncio = function() {
    const AdController = window.Adsgram.init({ blockId: "27" }); // ID de pruebas
    AdController.show().then(() => {
        sumarLechugasDB(10);
        tg.showAlert("¡Has ganado 10 lechugas! 🥬");
    }).catch(() => {
        tg.showAlert("No se completó el anuncio.");
    });
};

// 4. COMPRA DE LECHUGAS (Depósito)
window.comprarLechugas = async function() {
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{
            address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", // Tu dirección corregida
            amount: "100000000", // 0.1 TON en nanoTON
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            tg.showAlert("✅ ¡Pago confirmado! Sumando 1,000 lechugas...");
            sumarLechugasDB(1000); 
        }
    } catch (e) {
        console.error(e);
        tg.showAlert("❌ Transacción cancelada o fallida.");
    }
};

// 5. FUNCIÓN PARA GUARDAR EN DB (Sin errores de undefined)
function sumarLechugasDB(cantidad) {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    // 1. Obtener saldo actual de pantalla de forma segura
    const currentCoins = parseInt(document.getElementById('user-coins').innerText) || 0;
    const nuevoTotal = currentCoins + cantidad;

    // 2. Actualizar visualmente de inmediato
    document.getElementById('user-coins').innerText = nuevoTotal;
    if (document.getElementById('wallet-coins-display')) {
        document.getElementById('wallet-coins-display').innerText = nuevoTotal;
    }

    // 3. Guardar en MongoDB
    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    })
    .catch(err => console.error("Error sincronizando DB:", err));
}

// 6. RETIRO MANUAL
window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText) || 0;
    const wallet = tonConnectUI.account?.address;

    if (!wallet) return tg.showAlert("Conecta tu wallet primero.");
    if (balance < 50000) return tg.showAlert("Necesitas al menos 50,000 lechugas.");

    tg.showConfirm("¿Enviar solicitud de retiro por 50,000 lechugas?", (confirmado) => {
        if (confirmado) {
            fetch('/api/withdraw-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    telegramId: tg.initDataUnsafe.user.id, 
                    amount: 50000, 
                    address: wallet 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('user-coins').innerText = data.newBalance;
                    if (document.getElementById('wallet-coins-display')) {
                        document.getElementById('wallet-coins-display').innerText = data.newBalance;
                    }
                    tg.showAlert("📩 Solicitud enviada con éxito.");
                }
            });
        }
    });
};
