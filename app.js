const tg = window.Telegram.WebApp;
tg.expand();

window.onload = function() {
    // 1. Cargar datos del usuario
    const user = tg.initDataUnsafe.user;
    if (user) {
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }
    }

    // 2. Iniciar Billetera con detección forzada
    let intentos = 0;
    const interval = setInterval(() => {
        const TonLib = window.TON_CONNECT_UI;
        intentos++;

        if (TonLib && TonLib.TonConnectUI) {
            clearInterval(interval);
            try {
                new TonLib.TonConnectUI({
                    manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect',
                    uiOptions: {
                        buttonConfiguration: {
                            size: 'medium', // Probamos medium para asegurar visibilidad
                            borderRadius: 'm'
                        }
                    }
                });
                console.log("✅ Billetera renderizada");
            } catch (e) {
                console.error("Error TON:", e);
            }
        } 
        
        if (intentos > 20) { // Si después de 10 segundos no carga, detenemos
            clearInterval(interval);
            console.log("❌ Tiempo de espera agotado para la librería");
        }
    }, 500);
};

// Navegación
window.showSection = function(sectionId) {
    const sections = ['home', 'tasks', 'wallet', 'referrals'];
    sections.forEach(id => {
        const el = document.getElementById(id + '-section');
        if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });
};

// Generar Animalitos
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
    if (btnJugar) btnJugar.style.display = 'none';

    animalitos.forEach((animal) => {
        const div = document.createElement('div');
        div.style.cssText = "background: #2a2a2a; color: white; padding: 12px 5px; text-align: center; border-radius: 10px; font-size: 11px; font-weight: bold; cursor: pointer; border: 1px solid #444;";
        div.innerText = animal;
        div.onclick = () => {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            alert("Selección: " + animal);
        };
        grid.appendChild(div);
    });
};
