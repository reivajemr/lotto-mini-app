// 1. Configuración Inicial de Telegram
const tg = window.Telegram.WebApp;
tg.expand();

// 2. Datos del Usuario (Header)
window.addEventListener('DOMContentLoaded', () => {
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-name').innerText = user.first_name;
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }
    }

    // Inicializar Billetera TON (Botón compacto en header)
    try {
      const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
    buttonRootId: 'ton-connect',
    uiOptions: {
        buttonConfiguration: {
            size: 'small', // Obligatorio para que sea chico
            borderRadius: 's'
        }
    }
});
    } catch (e) {
        console.error("Error al cargar la billetera:", e);
    }
});

// 3. Sistema de Navegación
window.showSection = function(id) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
};

// 4. Lógica del Juego (Lotto Activo)
const animalitos = [
    "00. Ballena", "0. Delfín", "1. Carnero", "2. Toro", "3. Chivo", "4. Alacrán", "5. León", "6. Rana", 
    "7. Perico", "8. Ratón", "9. Águila", "10. Tigre", "11. Gato", "12. Caballo", "13. Mono", "14. Paloma", 
    "15. Zorro", "16. Oso", "17. Pavo", "18. Burro", "19. Chivo", "20. Cochino", "21. Gallo", "22. Camello", 
    "23. Cebra", "24. Iguana", "25. Gallina", "26. Vaca", "27. Perro", "28. Zamuro", "29. Elefante", 
    "30. Caimán", "31. Lapa", "32. Ardilla", "33. Pescado", "34. Venado", "35. Jirafa", "36. Culebra"
];

window.generarTablero = function() {
    const grid = document.getElementById('grid-animalitos');
    const btnJugar = document.getElementById('btn-jugar');
    
    if (!grid) return;
    
    grid.innerHTML = ''; 
    btnJugar.style.display = 'none';

    animalitos.forEach((animal) => {
        const div = document.createElement('div');
        div.style.cssText = `
            background: #2a2a2a; 
            color: white; 
            padding: 12px 5px; 
            text-align: center; 
            border-radius: 10px; 
            font-size: 11px; 
            font-weight: bold;
            cursor: pointer; 
            border: 1px solid #444;
            transition: 0.2s;
        `;
        div.innerText = animal;
        
        div.onclick = () => {
            tg.HapticFeedback.impactOccurred('medium');
            alert("Has seleccionado: " + animal);
        };
        
        grid.appendChild(div);
    });
};
