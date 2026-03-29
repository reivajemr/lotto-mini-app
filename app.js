// --- CONFIGURACIÓN DE RED (TESTNET) ---
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
    buttonRootId: 'ton-connect',
    network: 'testnet' // <--- Obligatorio para pruebas
});

// --- FUNCIÓN DE DEPÓSITO (Automático para lechugas) ---
window.comprarLechugas = async function(montoTON, cantidadLechugas) {
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60, 
        messages: [
            {
                address: "TU_BILLETERA_TESTNET_AQUÍ", // Tu dirección de Tonkeeper Testnet
                amount: (montoTON * 1000000000).toString(), // Convierte TON a nanoTON
            }
        ]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        if (result) {
            // Si la red confirma el envío, sumamos en la base de datos
            sumarRecompensa(cantidadLechugas); 
            tg.showAlert(`¡Compra exitosa! +${cantidadLechugas} lechugas.`);
        }
    } catch (e) {
        tg.showAlert("Transacción cancelada o fallida.");
    }
};

// --- FUNCIÓN DE RETIRO (Solicitud Manual) ---
window.solicitarRetiro = function() {
    const lechugas = parseInt(document.getElementById('user-coins').innerText);
    const wallet = tonConnectUI.account?.address;

    if (!wallet) {
        tg.showAlert("Primero conecta tu billetera con el botón azul.");
        return;
    }

    if (lechugas < 50000) {
        tg.showAlert("Mínimo de retiro: 50,000 lechugas.");
        return;
    }

    tg.showConfirm(`¿Retirar 50,000 lechugas a esta cuenta: ${wallet.substring(0,6)}...?`, (confirmado) => {
        if (confirmado) {
            enviarSolicitudServidor(lechugas, wallet);
        }
    });
};

function enviarSolicitudServidor(cantidad, direccion) {
    const user = tg.initDataUnsafe.user;
    fetch('/api/withdraw-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            telegramId: user.id, 
            amount: cantidad, 
            address: direccion 
        })
    })
    .then(res => res.json())
    .then(data => {
        tg.showAlert("Solicitud enviada. Javier procesará tu pago pronto.");
        // Actualizar visualmente el saldo restado
        document.getElementById('user-coins').innerText = data.newBalance;
    });
}
