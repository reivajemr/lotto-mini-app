const tg = window.Telegram.WebApp;
tg.expand();
let tonConnectUI;

window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(id + '-section').style.display = 'block';
    if (id === 'wallet') document.getElementById('wallet-coins-display').innerText = document.getElementById('user-coins').innerText;
};

window.onload = function() {
    document.getElementById('loading-screen').style.display = 'none';
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id, username: user.first_name })
        })
        .then(res => res.json())
        .then(data => {
            // Evitamos el 'undefined' que viste en el celular
            const coins = data.coins ?? 0;
            document.getElementById('user-coins').innerText = coins;
        })
        .catch(() => console.log("Servidor lento, usando datos locales."));
    }

    setTimeout(() => {
        if (window.TON_CONNECT_UI) {
            tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                network: 'testnet' 
            });
        }
    }, 1000);
};

window.comprarLechugas = async function() {
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300, 
        messages: [{ address: "0QC_XSHRUMobPp6ZpHh3kkMxtM-15d75pVISwtRl7MSX_nLo", amount: "100000000" }]
    };
    try {
        const result = await tonConnectUI.sendTransaction(tx);
        if (result) {
            // ACTUALIZACIÓN INMEDIATA: No esperamos a la DB
            let current = parseInt(document.getElementById('user-coins').innerText) || 0;
            let total = current + 1000;
            document.getElementById('user-coins').innerText = total;
            document.getElementById('wallet-coins-display').innerText = total;
            
            // Intentamos guardar en DB en segundo plano
            fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: tg.initDataUnsafe.user.id, reward: 1000 })
            });
            tg.showAlert("✅ ¡1,000 lechugas sumadas!");
        }
    } catch (e) { tg.showAlert("Transacción fallida."); }
};
