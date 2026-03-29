// 1. Configuración de Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// 2. Función para cambiar entre secciones
function showSection(sectionId) {
    console.log("Cambiando a sección:", sectionId);
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }
}

// 3. Función para cargar el saldo desde MongoDB
async function cargarSaldo() {
    const userData = tg.initDataUnsafe.user;
    
    // Si no hay datos de usuario (ej. abriendo fuera de Telegram), mostramos error
    if (!userData || !userData.id) {
        console.error("No se detectó usuario de Telegram");
        document.getElementById('balance').innerText = "Error ID";
        return;
    }

    console.log("Intentando sincronizar ID:", userData.id);

    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: userData.id.toString(), // Enviamos como string para coincidir con Atlas
                username: userData.username || userData.first_name
            })
        });

        if (!response.ok) throw new Error("Error en respuesta de API");

        const data = await response.json();
        console.log("Datos recibidos de MongoDB:", data);

        // Actualizamos el saldo en pantalla
        if (data && data.coins !== undefined) {
            const displayBalance = data.coins;
            document.getElementById('balance').innerText = displayBalance;
            
            // Si tienes un elemento para el nombre del usuario
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.innerText = userData.first_name;

            console.log("Saldo sincronizado con éxito:", displayBalance);
        }
    } catch (error) {
        console.error("Fallo al conectar con la API:", error);
    }
}

// 4. Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    console.log("App cargada, iniciando componentes...");
    
    // Aseguramos que el botón de Wallet y el nombre sean visibles
    const walletBtn = document.querySelector('.wallet-btn') || document.getElementById('connect-wallet-btn');
    if (walletBtn) {
        walletBtn.style.display = 'flex'; // Forzamos que aparezca el botón azul
    }

    // Cargamos los datos reales de la base de datos Zing
    cargarSaldo();
});

// 5. Función para ir a la Wallet (asignar al botón azul en el HTML)
function irAWallet() {
    showSection('wallet');
}
