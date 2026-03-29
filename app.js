// 1. Definir funciones de navegación PRIMERO para evitar el error de la captura
window.showSection = function(id) {
    console.log("Navegando a:", id);
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
};

const tg = window.Telegram.WebApp;
tg.expand();

// 2. Configuración de TON Connect (Testnet)
let tonConnectUI;

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        // Sincronizar con DB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('user-coins').innerText = data.coins || 0;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
        });
    }

    // Inicializar Billetera en TESTNET
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
        buttonRootId: 'ton-connect',
        network: 'testnet' 
    });
};

// --- FUNCIÓN DE DEPÓSITO (Para que tú recibas TON de prueba) ---
window.comprarLechugas = async function() {
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [
            {
                address: "TU_BILLETERA_TESTNET_AQUÍ", // <--- PEGA TU DIRECCIÓN DE TESTNET AQUÍ
                amount: "100000000", // 0.1 TON en nanoTON
            }
        ]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            tg.showAlert("✅ Transacción enviada. Procesando tus lechugas...");
            // Llamar a tu API para sumar 1000 lechugas tras confirmar
            sumarRecompensa(1000); 
        }
    } catch (e) {
        console.error(e);
        tg.showAlert("❌ Pago cancelado.");
    }
};

// --- FUNCIÓN DE RETIRO (Solicitud Manual) ---
window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText);
    const wallet = tonConnectUI.account?.address;

    if (!wallet) return tg.showAlert("Conecta tu wallet primero.");
    if (balance < 50000) return tg.showAlert("Mínimo 50,000 lechugas.");

    tg.showConfirm("¿Retirar 50,000 lechugas?", (ok) => {
        if (ok) {
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
                document.getElementById('user-coins').innerText = data.newBalance;
                tg.showAlert("📩 Solicitud enviada a Javier.");
            });
        }
    });
};
