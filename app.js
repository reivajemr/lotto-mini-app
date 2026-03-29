// Configuración inicial de la WebApp de Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Expande la app para que ocupe toda la pantalla

// Función para cambiar entre secciones (Lobby, Tareas, Wallet, etc.)
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    // Mostrar la sección seleccionada
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }
}

// FUNCIÓN CRÍTICA: Cargar el saldo desde MongoDB
async function cargarSaldo() {
    // Obtenemos tu ID real directamente de Telegram
    const userData = tg.initDataUnsafe.user;
    
    if (!userData || !userData.id) {
        console.error("No se pudo obtener el ID de Telegram");
        return;
    }

    try {
        // Llamada a tu API en Vercel
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                telegramId: userData.id.toString(), // Enviamos el ID como string para asegurar coincidencia
                username: userData.username || userData.first_name
            })
        });

        if (!response.ok) {
            throw new Error(`Error en el servidor: ${response.status}`);
        }

        const data = await response.json();

        // Si el servidor responde con éxito, actualizamos la interfaz
        if (data && data.coins !== undefined) {
            // Actualiza el número de lechugas en el Lobby y en la Wallet
            const balanceElements = document.querySelectorAll('#balance, .lechugas-count');
            balanceElements.forEach(el => {
                el.innerText = data.coins.toLocaleString(); 
            });
            console.log("Saldo sincronizado:", data.coins);
        }
    } catch (error) {
        console.error("Error al sincronizar con MongoDB:", error);
        // Opcional: Mostrar la alerta de error que vimos antes
        // alert("Error al sincronizar. Si recargas podrías perder el saldo actual.");
    }
}

// Función para simular o procesar una compra (Ejemplo)
async function comprarLechugas(cantidad) {
    const userData = tg.initDataUnsafe.user;
    
    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: userData.id.toString(),
                username: userData.username || userData.first_name,
                reward: cantidad // Enviamos la recompensa para que la API la sume
            })
        });
        
        if (response.ok) {
            await cargarSaldo(); // Recargamos el saldo visualmente
            tg.HapticFeedback.notificationOccurred('success'); // Vibración de éxito
        }
    } catch (error) {
        console.error("Error en la compra:", error);
    }
}

// EJECUCIÓN AL CARGAR LA APP
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mostrar el nombre del usuario en la interfaz
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && tg.initDataUnsafe.user) {
        userNameElement.innerText = tg.initDataUnsafe.user.first_name;
    }

    // 2. Cargar el saldo inicial desde la base de datos
    cargarSaldo();
});
