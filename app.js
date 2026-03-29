const tg = window.Telegram.WebApp;
tg.expand();

// 1. FUNCIÓN DE NAVEGACIÓN (Cambio de secciones)
function showSection(sectionId) {
    console.log("Cambiando a:", sectionId);
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // Mostrar la sección seleccionada
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    } else {
        console.error("Error: La sección '" + sectionId + "' no existe en el HTML");
    }

    // Actualizar estilo visual de los botones de navegación
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });
}

// 2. FUNCIÓN DE CONEXIÓN DE WALLET
function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn');
    if (!btn) return;

    console.log("Iniciando proceso de conexión...");
    btn.innerText = "Conectando...";
    
    // Simulación de conexión (Aquí integrarás TonConnect luego)
    setTimeout(() => {
        btn.innerText = "0x...1234 ✅";
        btn.style.background = "linear-gradient(135deg, #28a745, #218838)";
        console.log("Wallet conectada con éxito");
        tg.HapticFeedback.notificationOccurred('success'); // Vibración táctil
    }, 1500);
}

// 3. CARGAR DATOS DEL USUARIO Y MONGODB
async function cargarApp() {
    const user = tg.initDataUnsafe.user;
    
    if (!user) {
        console.error("No se detectaron datos de Telegram");
        return;
    }

    // Mostrar nombre y foto de perfil en el Header
    document.getElementById('user-name').innerText = user.first_name || "Usuario";
    if (user.photo_url) {
        const photoEl = document.getElementById('user-photo');
        if (photoEl) photoEl.src = user.photo_url;
    }

    try {
        // Petición a tu API de Vercel para obtener las 1000 lechugas
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: user.id.toString() 
            })
        });

        const data = await response.json();
        console.log("Datos de la base de datos:", data);

        // Actualizar el saldo en pantalla
        const balanceEl = document.getElementById('balance');
        if (balanceEl && data.coins !== undefined) {
            balanceEl.innerText = data.coins;
        }

    } catch (error) {
        console.error("Error al sincronizar con MongoDB:", error);
    }
}

// 4. INICIALIZACIÓN AL CARGAR EL DOCUMENTO
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos de usuario y saldo
    cargarApp();

    // 2. Vincular el botón de Connect Wallet
    const walletBtn = document.getElementById('connect-wallet-btn');
    if (walletBtn) {
        walletBtn.addEventListener('click', connectWallet);
    }

    // 3. Iniciar en la sección Lobby por defecto
    showSection('lobby');
});
