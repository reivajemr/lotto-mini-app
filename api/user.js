import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const MANIFEST_URL = 'https://lotto-mini-app.vercel.app/tonconnect-manifest.json';

export default async function handler(req, res) {
    // Permitir CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Use POST.' });
    }

    try {
        await client.connect();
        const db = client.db('animalito_db');
        const users = db.collection('users');
        const transactions = db.collection('transactions');

        const { 
            telegramId, 
            username, 
            action,           // 'deposit', 'withdraw', 'purchase'
            purchaseAmount,   // lechugas a comprar
            purchasePrice,    // TON a pagar
            withdrawAmount,   // TON a retirar
            walletAddress,
            transactionHash   // hash de la transacción TON
        } = req.body;

        if (!telegramId) {
            return res.status(400).json({ error: 'Falta telegramId' });
        }

        const userIdStr = telegramId.toString();

        // ============================================
        // 1. CARGAR O CREAR USUARIO
        // ============================================
        let user = await users.findOne({ telegramId: userIdStr });
        if (!user) {
            const newUser = {
                telegramId: userIdStr,
                username: username || "Usuario",
                coins: 1000, // 1000 lechugas iniciales
                tonBalance: 0,
                createdAt: new Date(),
                lastActive: new Date()
            };
            const result = await users.insertOne(newUser);
            user = newUser;
            user._id = result.insertedId;
            console.log("✅ Usuario creado:", userIdStr);
        }

        // Actualizar última actividad
        await users.updateOne(
            { telegramId: userIdStr },
            { $set: { lastActive: new Date() } }
        );

        // ============================================
        // 2. PROCESAR ACCIÓN: COMPRA DE LECHUGAS
        // ============================================
        if (action === 'purchase' || (purchaseAmount && purchasePrice)) {
            console.log("🛒 Procesar compra:", {
                userId: userIdStr,
                lechugas: purchaseAmount,
                ton: purchasePrice,
                hash: transactionHash
            });

            if (!purchaseAmount || !purchasePrice) {
                return res.status(400).json({ 
                    error: 'Falta purchaseAmount o purchasePrice' 
                });
            }

            // Guardar transacción de compra
            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || "Usuario",
                type: 'purchase',
                lechugas: purchaseAmount,
                ton: purchasePrice,
                walletAddress: walletAddress || null,
                transactionHash: transactionHash || null,
                status: 'completada',
                date: new Date(),
                timestamp: Date.now()
            });

            // Sumar lechugas al balance
            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { 
                    $inc: { coins: parseInt(purchaseAmount) },
                    $set: { lastActive: new Date() }
                },
                { returnDocument: 'after' }
            );

            console.log("✅ Compra procesada. Nuevo balance:", updatedUser.value.coins);

            // NOTIFICACIÓN AL BOT (COMPRA)
            const mensajeCompra = `
🛍️ *NUEVA COMPRA*

👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 Compró ${purchaseAmount} 🥬
💵 Pagó ${purchasePrice} TON
🔗 Hash: \`${transactionHash || 'N/A'}\`
💳 Wallet: \`${walletAddress || 'No registrada'}\`
📊 Balance nuevo: ${updatedUser.value.coins} 🥬

✅ *Estado: COMPLETADA*
⏰ ${new Date().toLocaleString('es-VE')}
            `.trim();

            await enviarNotificacionTelegram(mensajeCompra);

            return res.status(200).json({
                success: true,
                type: 'purchase',
                newBalance: updatedUser.value.coins,
                message: `✅ ${purchaseAmount} lechugas agregadas a tu cuenta`
            });
        }

        // ============================================
        // 3. PROCESAR ACCIÓN: RETIRO DE GANANCIAS
        // ============================================
        if (action === 'withdraw' || withdrawAmount) {
            console.log("💸 Procesar retiro:", {
                userId: userIdStr,
                ton: withdrawAmount,
                wallet: walletAddress
            });

            if (!walletAddress) {
                return res.status(400).json({ error: 'Wallet no conectada' });
            }

            if (!withdrawAmount || withdrawAmount < 5 || withdrawAmount > 20) {
                return res.status(400).json({ 
                    error: 'Monto inválido. Debe estar entre 5 y 20 TON.' 
                });
            }

            // Convertir TON a lechugas (1 TON = 10,000 lechugas)
            const lechugasADescontar = withdrawAmount * 10000;

            // Verificar que tenga suficiente saldo
            if (user.coins < lechugasADescontar) {
                return res.status(400).json({ 
                    error: `Saldo insuficiente. Tienes ${user.coins} 🥬, necesitas ${lechugasADescontar} 🥬` 
                });
            }

            // Crear transacción de retiro (PENDIENTE hasta que Javier la verifique)
            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || "Usuario",
                type: 'withdraw',
                lechugas: lechugasADescontar,
                ton: withdrawAmount,
                walletAddress: walletAddress,
                status: 'pendiente',
                verifiedBy: null,
                date: new Date(),
                timestamp: Date.now()
            });

            // Restar lechugas del balance
            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { 
                    $inc: { coins: -lechugasADescontar },
                    $set: { lastActive: new Date() }
                },
                { returnDocument: 'after' }
            );

            console.log("✅ Retiro creado. Nuevo balance:", updatedUser.value.coins);

            // NOTIFICACIÓN AL BOT (RETIRO PENDIENTE)
            const mensajeRetiro = `
🚀 *SOLICITUD DE RETIRO (PENDIENTE)*

👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 ${withdrawAmount} TON
🏦 Wallet: \`${walletAddress}\`
📉 -${lechugasADescontar} 🥬
💾 Balance restante: ${updatedUser.value.coins} 🥬

⏱️ *Estado: PENDIENTE DE VERIFICACIÓN*
⏰ ${new Date().toLocaleString('es-VE')}

👉 *ACCIÓN REQUERIDA:* Verifica el pago a esta wallet en TonScan
https://tonscan.org/address/${walletAddress}
            `.trim();

            await enviarNotificacionTelegram(mensajeRetiro);

            return res.status(200).json({
                success: true,
                type: 'withdraw',
                newBalance: updatedUser.value.coins,
                message: `✅ Retiro de ${withdrawAmount} TON solicitado. Pendiente de verificación.`
            });
        }

        // ============================================
        // 4. SI NO HAY ACCIÓN ESPECÍFICA: CARGAR DATOS
        // ============================================
        return res.status(200).json({
            success: true,
            user: {
                telegramId: user.telegramId,
                username: user.username,
                coins: user.coins,
                tonBalance: user.tonBalance || 0,
                createdAt: user.createdAt,
                lastActive: user.lastActive
            }
        });

    } catch (error) {
        console.error("❌ Error en API:", error.message);
        return res.status(500).json({ 
            error: error.message,
            type: 'server_error'
        });
    } finally {
        await client.close();
    }
}

// ============================================
// FUNCIÓN: ENVIAR NOTIFICACIÓN A TELEGRAM
// ============================================
async function enviarNotificacionTelegram(mensaje) {
    const TOKEN = process.env.TOKEN_BOT;
    const CHAT_ID = process.env.ID_DE_CHAT;

    if (!TOKEN || !CHAT_ID) {
        console.warn("⚠️ TOKEN_BOT o ID_DE_CHAT no configurados");
        return;
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: mensaje,
                    parse_mode: 'Markdown'
                })
            }
        );

        if (!response.ok) {
            console.error("❌ Error enviando notificación:", response.status);
            return;
        }

        console.log("✅ Notificación enviada a Telegram");
    } catch (error) {
        console.error("❌ Error con Telegram API:", error);
    }
}
