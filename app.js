const tg = window.Telegram.WebApp;
tg.expand();

// 1. FUNCIÓN PARA CAMBIAR SECCIONES (Hace que los botones inferiores funcionen)
function showSection(sectionId) {
    console.log("Cambiando a:", sectionId);
    
    // Oculta todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.style.display = 'none');

    // Muestra la sección que tocaste
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
    } else {
        console.error("No se encontró la sección:", sectionId);
    }
}

// 2. CARGAR DATOS (Lo que ya funciona, pero mejorado)
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

        // Actualizar Saldo
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.innerText = data.coins || 0;

        // Actualizar Nombre
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.innerText = user.first_name;

    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

// 3. ASEGURAR QUE LOS BOTONES TENGAN VIDA
document.addEventListener('DOMContentLoaded', () => {
    // Forzar que el botón azul de Wallet aparezca
    const walletBtn = document.getElementById('connect-wallet-btn') || document.querySelector('.wallet-btn');
    if (walletBtn) {
        walletBtn.style.display = 'flex'; 
    }

    // Cargar los 1000 de saldo
    cargarDatos();
    
    // Mostrar el Lobby por defecto al abrir
    showSection('lobby');
});
