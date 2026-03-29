const tg = window.Telegram.WebApp;
tg.expand();

// Función para cambiar entre secciones sin errores
function showSection(sectionId) {
    console.log("Cambiando a:", sectionId);
    document.querySelectorAll('.section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
}

// Carga de datos desde MongoDB y Telegram
async function cargarApp() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    // 1. Mostrar nombre y foto de Telegram
    document.getElementById('user-name').innerText = user.first_name;
    if (user.photo_url) {
        document.getElementById('user-photo').src = user.photo_url;
    }

    try {
        // 2. Obtener saldo real de MongoDB Zing
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });
        const data = await response.json();
        
        // 3. Actualizar el saldo (tus 1000 lechugas)
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.innerText = data.coins || 0;
        
    } catch (e) {
        console.error("Fallo al conectar con Zing:", e);
    }
}

// Inicialización segura
document.addEventListener('DOMContentLoaded', () => {
    cargarApp();
    showSection('lobby');
});
