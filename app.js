const tg = window.Telegram.WebApp;
tg.expand();

window.onload = function() {
    const user = tg.initDataUnsafe.user;
    
    if (user) {
        // 1. Mostrar nombre y avatar
        document.getElementById('user-name').innerText = user.first_name;
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }

        // 2. Sincronizar con MongoDB Atlas
        fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: user.id, 
                username: user.first_name 
            })
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('user-coins').innerText = data.coins || 500;
            document.getElementById('user-gems').innerText = (data.gems || 0).toFixed(2);
            console.log("✅ Datos sincronizados con Atlas");
        })
        .catch(err => console.error("❌ Error DB:", err));
    }

    iniciarBilleteraSegura();
};

// --- FUNCIÓN DE BILLETERA ---
function iniciarBilleteraSegura() {
    let intentos = 0;
    const interval = setInterval(() => {
        if (window.TON_CONNECT_UI) {
            clearInterval(interval);
            new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                buttonRootId: 'ton-connect',
                uiOptions: {
                    buttonConfiguration: { size: 'small', borderRadius: 's' }
                }
            });
            console.log("💎 Billetera lista");
        }
        if (intentos++ > 20) clearInterval(interval);
    }, 500);
}

// --- FUNCIÓN DE NAVEGACIÓN (Arregla el error de la consola) ---
window.showSection = function(sectionId) {
    console.log("Cambiando a:", sectionId);
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) {
            el.style.display = (id === sectionId) ? 'block' : 'none';
        }
    });
};

// --- LÓGICA DE ANIMALITOS ---
const animalitos = [
    "00. Ballena", "0. Delfín", "1. Carnero", "2. Toro", "3. Chivo", "4. Alacrán", "5. León", "6. Rana", 
    "7. Perico", "8. Ratón", "9. Águila", "10. Tigre", "11. Gato", "12. Caballo", "13. Mono", "14. Paloma", 
    "15. Zorro", "16. Oso", "17. Pavo", "18. Burro", "19. Chivo", "20. Cochino", "21. Gallo", "22. Camello", 
    "23. Cebra", "24. Iguana", "25. Gallina", "26. Vaca", "27. Perro", "28. Zamuro", "29. Elefante", 
    "30. Caimán", "31. Lapa", "32. Ardilla", "33. Pescado", "34. Venado", "35. Jirafa", "36. Culebra"
];

window.generarTablero = function() {
    const grid = document.getElementById('grid-animalitos');
    if (!grid) return;
    grid.innerHTML = ''; 

    animalitos.forEach((animal) => {
        const div = document.createElement('div');
        div.className = 'animal-card'; // Asegúrate de tener este estilo en tu CSS
        div.style.cssText = "background: #2a2a2a; color: white; padding: 10px; text-align: center; border-radius: 8px; font-size: 11px; cursor: pointer; border: 1px solid #444;";
        div.innerText = animal;
        div.onclick = () => {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            alert("Has seleccionado: " + animal);
        };
        grid.appendChild(div);
    });
};
