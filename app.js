const tg = window.Telegram.WebApp;
tg.expand();

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
        console.log("Datos para mostrar:", data);

        // Si el elemento con id="balance" existe, ponemos las lechugas
        const balanceElement = document.getElementById('balance');
        if (balanceElement && data.coins !== undefined) {
            balanceElement.innerText = data.coins;
            console.log("¡Saldo actualizado en pantalla!");
        }

    } catch (e) {
        console.error("Error al pintar datos:", e);
    }
}

// Ejecutar cuando la página cargue
document.addEventListener('DOMContentLoaded', cargarDatos);
