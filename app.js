const tg = window.Telegram.WebApp;
tg.expand();

// 1. MOTOR DE CARGA DINÁMICA DE SECCIONES
async function showSection(sectionId) {
    const mainContent = document.getElementById('main-content');
    
    // Efecto visual de carga inicial
    mainContent.innerHTML = '<div style="text-align:center; margin-top:50px;">Cargando...</div>';

    try {
        // Buscamos el archivo HTML en la carpeta /sections
        const response = await fetch(`sections/${sectionId}.html`);
        
        if (!response.ok) {
            throw new Error(`No se encontró la sección: ${sectionId}`);
        }

        const html = await response.text();
        mainContent.innerHTML = html;

        // VINCULACIÓN ESPECIAL PARA EL BOTÓN DE WALLET
        if (sectionId === 'wallet') {
            const walletBtn = document.getElementById('connect-wallet-btn-inner');
            if (walletBtn) {
                walletBtn.onclick = connectWallet;
                console.log("Botón de Wallet vinculado con éxito.");
            }
        }

        actualizarMenuVisual(sectionId);

    } catch (error) {
        mainContent.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
        console.error("Error al cargar sección:", error);
    }
}

// 2. ACTUALIZACIÓN VISUAL DEL MENÚ INFERIOR
function actualizarMenuVisual(sectionId) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        // Verificamos cuál botón coincide con la sección actual
        if (item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });
}

// 3. LÓGICA DE CONEXIÓN DE WALLET
function connectWallet() {
    const btn = document.getElementById('connect-wallet-btn-inner');
    if (!btn) return;

    tg.HapticFeedback.impactOccurred('medium'); // Vibración al presionar
    btn.innerText = "Conectando...";
    btn.disabled = true;

    // Simulación de conexión (Próximo paso: TonConnect)
    setTimeout(() => {
        btn.innerText = "Wallet: 0x...1234 ✅";
        btn.style.background = "linear-gradient(135deg, #28a745, #218838)";
        console.log("Wallet conectada exitosamente.");
    }, 1500);
}

// 4. CARGAR DATOS DEL USUARIO Y SALDO (MONGODB)
async function cargarDatosUsuario() {
    const user = tg.initDataUnsafe.user;
    
    if (!user) {
        console.log("No se detectó usuario de Telegram.");
        return;
    }

    // Mostrar nombre en el Header
    document.getElementById('user-name').innerText = user.first_name || "Usuario";
    
    // Intentar cargar la foto de perfil
    if (user.photo_url) {
        const photoEl = document.getElementById('user-photo');
        if (photoEl) photoEl.src = user.photo_url;
    }

    try {
        // Petición a tu API protegida en Vercel
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });

        const data = await response.json();
        
        // Sincronizar tus 1000 lechugas
        if (data && data.coins !== undefined) {
            document.getElementById('balance').innerText = data.coins;
        }

    } catch (error) {
        console.error("Error al conectar con la API de usuario:", error);
    }
}

// 5. INICIALIZACIÓN AL ABRIR LA APP
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    showSection('lobby'); // Carga el lobby automáticamente al entrar
});
