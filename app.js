const tg = window.Telegram.WebApp;
tg.expand();

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }
}

async function cargarSaldo() {
    const userData = tg.initDataUnsafe.user;
    
    if (!userData || !userData.id) {
        console.error("No se detectó usuario de Telegram");
        return;
    }

    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: userData.id.toString(), 
                username: userData.username || userData.first_name
            })
        });

        const data = await response.json();
        console.log("Datos recibidos:", data);

        // ACTUALIZACIÓN SEGURA: Solo cambia el texto si el ID existe en el HTML
        const balanceEl = document.getElementById('balance');
        if (balanceEl && data.coins !== undefined) {
            balanceEl.innerText = data.coins;
        }

        const nameEl = document.getElementById('user-name');
        if (nameEl) {
            nameEl.innerText = userData.first_name || "Usuario";
        }

    } catch (error) {
        console.error("Error en cargarSaldo:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Forzamos la aparición de botones principales
    const walletBtn = document.querySelector('.wallet-btn') || document.querySelector('[onclick*="wallet"]');
    if (walletBtn) {
        walletBtn.style.display = 'flex';
    }
    
    cargarSaldo();
});
