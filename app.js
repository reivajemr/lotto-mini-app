const tg = window.Telegram.WebApp;
tg.expand();

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    
    if (user) {
        // 1. Mostrar datos básicos de Telegram de inmediato
        document.getElementById('user-name').innerText = user.first_name;
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }

        // 2. CONEXIÓN A MONGODB: Pedir monedas y gemas reales
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: user.id, 
                username: user.first_name 
            })
        })
        .then(res => {
            if (!res.ok) throw new Error('Error en la red');
            return res.json();
        })
        .then(data => {
            // Reemplaza los ceros por los valores de la base de datos
            document.getElementById('user-coins').innerText = data.coins || 500;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
            console.log("✅ Datos cargados desde MongoDB Atlas");
        })
        .catch(err => console.error("❌ Error al conectar con la API:", err));
    }

    // 3. Iniciar Billetera (Botón compacto a la derecha)
    iniciarBilleteraSegura();
};

function iniciarBilleteraSegura() {
    let intentos = 0;
    const interval = setInterval(() => {
        if (window.TON_CONNECT_UI) {
            clearInterval(interval);
            new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                uiOptions: {
                    buttonConfiguration: {
                        size: 'small',
                        borderRadius: 's'
                    }
                }
            });
            console.log("💎 Billetera lista en el header");
        }
        if (intentos++ > 20) clearInterval(interval);
    }, 500);
}

// ... Mantén aquí abajo tus funciones de showSection y generarTablero
