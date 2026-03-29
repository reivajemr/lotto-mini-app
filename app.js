/**
 * APP.JS - LOTTO ANIMALITOS (Versión Final Economía)
 */

// 1. NAVEGACIÓN GLOBAL (Definir al principio para evitar errores de consola)
window.showSection = function(sectionId) {
    console.log("Navegando a:", sectionId);
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) {
            el.style.display = (id === sectionId) ? 'block' : 'none';
        }
    });
};

const tg = window.Telegram.WebApp;
tg.expand();

let tonConnectUI; // Variable global para la billetera

window.onload = function() {
    console.log("Iniciando App...");
    const user = tg.initDataUnsafe.user;
    
    if (user) {
        // Mostrar nombre y avatar
        document.getElementById('user-name').innerText = user.first_name;
        if (user.photo_url) document.getElementById('user-avatar').src = user.photo_url;

        // Cargar saldo real desde MongoDB
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('user-coins').innerText = data.coins || 0;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
        })
        .catch(err => console.log("Error al conectar con la base de datos"));
    }

    // Inicializar Billetera TON en TESTNET (Como acordamos)
    if (window.TON_CONNECT_UI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect',
            network: 'testnet' 
        });
    }
};

// --- FUNCIÓN DE DEPÓSITO (Comprar Lechugas) ---
window.comprarLechugas = async function() {
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [
            {
                address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", // <--- PON TU DIRECCIÓN DE TONKEEPER TESTNET AQUÍ
                amount: "100000000", // Ejemplo: 0.1 TON (en nanoTON)
            }
        ]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            tg.showAlert("✅ Pago enviado. Sumando 1,000 lechugas...");
            sumarRecompensa(1000); 
        }
    } catch (e) {
        tg.showAlert("❌ Transacción cancelada.");
    }
};

// --- FUNCIÓN DE RECOMPENSA (Suma monedas en DB) ---
window.sumarRecompensa = function(cantidad) {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user.id, reward: cantidad })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('user-coins').innerText = data.coins;
        console.log("Saldo actualizado:", data.coins);
    });
};

// --- FUNCIÓN DE RETIRO (Solicitud Manual Segura) ---
window.solicitarRetiro = function() {
    const balance = parseInt(document.getElementById('user-coins').innerText);
    const wallet = tonConnectUI.account?.address;

    if (!wallet) return tg.showAlert("Conecta tu wallet primero con el botón azul.");
    if (balance < 50000) return tg.showAlert("Mínimo de retiro: 50,000 lechugas.");

    tg.showConfirm(`¿Retirar 50,000 lechugas a esta cuenta?`, (confirmado) => {
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
                    tg.showAlert("📩 Solicitud enviada. Javier procesará tu pago.");
                } else {
                    tg.showAlert("Error: " + data.error);
                }
            });
        }
    });
};
