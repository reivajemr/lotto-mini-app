import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

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
            action,
            purchaseAmount,
            purchasePrice,
            withdrawAmount,
            walletAddress,
            transactionHash,
            // Campos de apuesta
            sorteo,
            animalSelected,
            animalResult,
            betAmount,
            won,
            prize,
            newBalance
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
                coins: 1000,
                tonBalance: 0,
                totalBets: 0,
                totalWins: 0,
                totalLost: 0,
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
        // 2. ACCIÓN: APUESTA (BET)
        // ============================================
        if (action === 'bet') {
            console.log("🎲 Procesar apuesta:", {
                userId: userIdStr,
                sorteo,
                animalSelected,
                animalResult,
                betAmount,
                won,
                prize
            });

            // Guardar transacción de apuesta
            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || "Usuario",
                type: 'bet',
                sorteo: sorteo || 'N/A',
                animalSelected: animalSelected || 'N/A',
                animalResult: animalResult || 'N/A',
                betAmount: betAmount || 0,
                won: won || false,
                prize: won ? (prize || betAmount * 35) : 0,
                status: 'completada',
                date: new Date(),
                timestamp: Date.now()
            });

            // Actualizar balance del usuario
            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { 
                    $set: { 
                        coins: newBalance,
                        lastActive: new Date()
                    },
                    $inc: {
                        totalBets: 1,
                        totalWins: won ? 1 : 0,
                        totalLost: won ? 0 : 1
                    }
                },
                { returnDocument: 'after' }
            );

            console.log("✅ Apuesta guardada. Balance:", newBalance);

            // Notificación solo si GANA (para no spamear)
            if (won) {
                const mensajeGanador = `
🎉 *¡GANADOR!*

👤 @${username || 'Usuario'} (ID: ${userIdStr})
🎰 Sorteo: ${sorteo}
🐾 Eligió: ${animalSelected}
✅ Salió: ${animalResult}
💰 Apostó: ${betAmount} 🥬
🏆 Ganó: ${prize || betAmount * 35} 🥬
💾 Balance: ${newBalance} 🥬

⏰ ${new Date().toLocaleString('es-VE')}
                `.trim();

                await enviarNotificacionTelegram(mensajeGanador);
            }

            return res.status(200).json({
                success: true,
                type: 'bet',
                newBalance: updatedUser?.coins || newBalance,
                message: won ? '🎉 ¡Ganaste!' : '😔 Sigue intentando'
            });
        }

        // ============================================
        // 3. ACCIÓN: COMPRA DE LECHUGAS
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

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { 
                    $inc: { coins: parseInt(purchaseAmount) },
                    $set: { lastActive: new Date() }
                },
                { returnDocument: 'after' }
            );

            console.log("✅ Compra procesada. Nuevo balance:", updatedUser.coins);

            const mensajeCompra = `
🛍️ *NUEVA COMPRA*

👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 Compró ${purchaseAmount} 🥬
💵 Pagó ${purchasePrice} TON
🔗 Hash: \`${transactionHash || 'N/A'}\`
💳 Wallet: \`${walletAddress || 'No registrada'}\`
📊 Balance nuevo: ${updatedUser.coins} 🥬

✅ *Estado: COMPLETADA*
⏰ ${new Date().toLocaleString('es-VE')}
            `.trim();

            await enviarNotificacionTelegram(mensajeCompra);

            return res.status(200).json({
                success: true,
                type: 'purchase',
                newBalance: updatedUser.coins,
                message: `✅ ${purchaseAmount} lechugas agregadas a tu cuenta`
            });
        }

        // ============================================
        // 4. ACCIÓN: RETIRO DE GANANCIAS
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

            const lechugasADescontar = withdrawAmount * 10000;

            if (user.coins < lechugasADescontar) {
                return res.status(400).json({ 
                    error: `Saldo insuficiente. Tienes ${user.coins} 🥬, necesitas ${lechugasADescontar} 🥬` 
                });
            }

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

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { 
                    $inc: { coins: -lechugasADescontar },
                    $set: { lastActive: new Date() }
                },
                { returnDocument: 'after' }
            );

            console.log("✅ Retiro creado. Nuevo balance:", updatedUser.coins);

            const mensajeRetiro = `
🚀 *SOLICITUD DE RETIRO (PENDIENTE)*

👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 ${withdrawAmount} TON
🏦 Wallet: \`${walletAddress}\`
📉 -${lechugasADescontar} 🥬
💾 Balance restante: ${updatedUser.coins} 🥬

⏱️ *Estado: PENDIENTE DE VERIFICACIÓN*
⏰ ${new Date().toLocaleString('es-VE')}

👉 *ACCIÓN REQUERIDA:* Verifica el pago a esta wallet en TonScan
https://tonscan.org/address/${walletAddress}
            `.trim();

            await enviarNotificacionTelegram(mensajeRetiro);

            return res.status(200).json({
                success: true,
                type: 'withdraw',
                newBalance: updatedUser.coins,
                message: `✅ Retiro de ${withdrawAmount} TON solicitado. Pendiente de verificación.`
            });
        }

        // ============================================
        // 5. SIN ACCIÓN: CARGAR DATOS DEL USUARIO
        // ============================================
        return res.status(200).json({
            success: true,
            user: {
                telegramId: user.telegramId,
                username: user.username,
                coins: user.coins || 0,
                tonBalance: user.tonBalance || 0,
                totalBets: user.totalBets || 0,
                totalWins: user.totalWins || 0,
                createdAt: user.createdAt,
                lastActive: user.lastActive
            }
        });

    } catch (error) {
        console.error("❌ Error en /api/user:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
}

// ============================================
// FUNCIÓN: NOTIFICACIÓN POR TELEGRAM
// ============================================
async function enviarNotificacionTelegram(mensaje) {
    const TOKEN = process.env.TOKEN_BOT;
    const CHAT_ID = process.env.ID_DE_CHAT;

    if (!TOKEN || !CHAT_ID) {
        console.log("⚠️ TOKEN_BOT o ID_DE_CHAT no configurados");
        return;
    }

    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: mensaje,
                parse_mode: 'Markdown'
            })
        });
    } catch (error) {
        console.error("❌ Error enviando notificación:", error);
    }
}
