const tg = window.Telegram.WebApp;
tg.expand();

// FUNCIÓN PARA DAR VIDA A LOS BOTONES
function showSection(sectionId) {
    console.log("Cambiando a sección:", sectionId);
    
    // 1. Ocultar todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // 2. Mostrar la sección solicitada
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    } else {
        // Esto corregirá el error rojo que veías en consola
        console.error("Error: La sección '" + sectionId + "' no existe en el HTML");
    }
}

// CARGAR LOS 1000 DESDE MONGODB
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
        console.log("Datos recibidos de la base de datos:", data);

        // Actualizar interfaz con los 1000 del servidor
        const balanceEl = document.getElementById('balance');
        if (balanceEl && data.coins !== undefined) {
            balanceEl.innerText = data.coins;
        }

        const nameEl = document.getElementById('user-name');
        if (nameEl) {
            nameEl.innerText = user.first_name || "Usuario";
        }
    } catch (e) {
        console.error("Error de conexión con la API:", e);
    }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    // Forzamos visibilidad inicial
    const walletBtn = document.getElementById('connect-wallet-btn');
    if (walletBtn) walletBtn.style.display = 'flex';

    // Cargamos tus lechugas
    cargarDatos();
    
    // Aseguramos que empiece en el Lobby
    showSection('lobby');
});
