const tg = window.Telegram.WebApp;
tg.expand();

// FUNCIÓN PARA CARGAR SECCIONES DESDE ARCHIVOS EXTERNOS
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    
    // 1. Efecto visual de carga
    mainContent.innerHTML = '<div class="loader">Cargando...</div>';

    try {
        // 2. Intentar traer el archivo HTML de la carpeta /sections
        const response = await fetch(`sections/${sectionId}.html`);
        
        if (!response.ok) throw new Error("No se pudo encontrar la sección");

        const html = await response.text();
        
        // 3. Inyectar el contenido
        mainContent.innerHTML = html;

        // 4. Si entramos a la sección 'wallet', reactivar el botón azul
        if (sectionId === 'wallet') {
            const btn = document.getElementById('connect-wallet-btn-inner');
            if (btn) btn.addEventListener('click', connectWallet);
        }

        // 5. Actualizar botones del menú
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick').includes(sectionId)) {
                item.classList.add('active');
            }
        });

    } catch (error) {
        mainContent.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        console.error("Error cargando sección:", error);
    }
}

// CARGAR DATOS INICIALES (LECHUGAS)
async function cargarDatos() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    document.getElementById('user-name').innerText = user.first_name;
    
    try {
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });
        const data = await res.json();
        
        // Sincronizar tus 1000 lechugas
        if (data.coins !== undefined) {
            document.getElementById('balance').innerText = data.coins;
        }
    } catch (e) {
        console.log("Error de sincronización con MongoDB");
    }
}

function connectWallet() {
    alert("Conectando con Tonkeeper...");
}

// INICIO DE LA APP
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    showSection('lobby'); // Carga el lobby por defecto
});
