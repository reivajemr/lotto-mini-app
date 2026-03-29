window.addEventListener('DOMContentLoaded', () => {
    try {
        const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect',
            uiOptions: {
                buttonConfiguration: {
                    size: 'small' // Lo hace más pequeño para que quepa en el header
                }
            }
        });
        console.log("🚀 Billetera movida al header");
    } catch (e) {
        console.error("❌ Fallo al mover la billetera:", e);
    }
});
