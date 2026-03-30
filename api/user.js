import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

// Reutilizar conexión entre llamadas (patrón recomendado en Vercel)
let cachedClient = null;
async function getClient() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido. Use POST.' });

    try {
        const client = await getClient();
        const db = client.db('animalito_db');
        const users = db.collection('users');
        const transactions = db.collection('transactions');

        const {
            telegramId,
            username,
            action,
            // Compra
            purchaseAmount,
            purchasePrice,
            walletAddress,
            transactionHash,
            // Apuesta
            sorteo,
            animalSelected,
            animalResult,
            betAmount,
            won,
            prize,
            newBalance,
            // Tarea
            taskId,
            reward,
            // Retiro
            withdrawAmount,
        } = req.body;

        if (!telegramId) return res.status(400).json({ error: 'Falta telegramId' });

        const userIdStr = telegramId.toString();

        // ── Cargar o crear usuario ──────────────────────────────────────
        let user = await users.findOne({ telegramId: userIdStr });
        if (!user) {
            const newUser = {
                telegramId: userIdStr,
                username: username || 'Usuario',
                coins: 1000,
                tonBalance: 0,
                totalBets: 0,
                totalWins: 0,
                totalLost: 0,
                completedTasks: [],
                lastDailyBonus: null,
                createdAt: new Date(),
                lastActive: new Date(),
            };
            const result = await users.insertOne(newUser);
            user = { ...newUser, _id: result.insertedId };
            console.log('✅ Usuario creado:', userIdStr);
        }

        await users.updateOne({ telegramId: userIdStr }, { $set: { lastActive: new Date() } });

        // ── ACCIÓN: TAREA ───────────────────────────────────────────────
        if (action === 'task') {
            if (!taskId || !reward) return res.status(400).json({ error: 'Falta taskId o reward' });

            // Anti-spam: verificar que la tarea no esté ya completada en BD
            const alreadyDone = (user.completedTasks || []).includes(taskId);

            // Para el bonus diario verificar el cooldown de 24h en BD
            if (taskId === 'daily') {
                const last = user.lastDailyBonus ? new Date(user.lastDailyBonus).getTime() : 0;
                const elapsed = Date.now() - last;
                if (elapsed < 24 * 60 * 60 * 1000) {
                    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - elapsed) / 3600000);
                    return res.status(400).json({ error: `Ya reclamaste el bonus diario. Vuelve en ${hoursLeft}h` });
                }
                // Actualizar timestamp del bonus diario
                await users.updateOne(
                    { telegramId: userIdStr },
                    { $set: { lastDailyBonus: new Date() }, $inc: { coins: parseInt(reward) } }
                );
                console.log(`✅ Bonus diario para ${userIdStr}: +${reward} 🥬`);
                return res.status(200).json({ success: true, type: 'task', taskId, reward, message: `+${reward} 🥬 bonus diario` });
            }

            // Otras tareas: solo una vez
            if (alreadyDone) {
                return res.status(400).json({ error: 'Tarea ya completada' });
            }

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                {
                    $inc: { coins: parseInt(reward) },
                    $addToSet: { completedTasks: taskId },
                    $set: { lastActive: new Date() },
                },
                { returnDocument: 'after' }
            );

            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || 'Usuario',
                type: 'task',
                taskId,
                reward: parseInt(reward),
                date: new Date(),
            });

            console.log(`✅ Tarea ${taskId} completada por ${userIdStr}: +${reward} 🥬`);
            return res.status(200).json({
                success: true,
                type: 'task',
                taskId,
                reward,
                newBalance: updatedUser?.coins,
                message: `✅ +${reward} 🥬 recibidas`,
            });
        }

        // ── ACCIÓN: APUESTA ─────────────────────────────────────────────
        if (action === 'bet') {
            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || 'Usuario',
                type: 'bet',
                sorteo: sorteo || 'N/A',
                animalSelected: animalSelected || 'N/A',
                animalResult: animalResult || 'N/A',
                betAmount: betAmount || 0,
                won: won || false,
                prize: won ? (prize || betAmount * 35) : 0,
                status: 'completada',
                date: new Date(),
            });

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                {
                    $set: { coins: newBalance, lastActive: new Date() },
                    $inc: { totalBets: 1, totalWins: won ? 1 : 0, totalLost: won ? 0 : 1 },
                },
                { returnDocument: 'after' }
            );

            if (won) {
                await enviarNotificacion(`
🎉 *¡GANADOR!*
👤 @${username || 'Usuario'} (ID: ${userIdStr})
🎰 Sorteo: ${sorteo}
🐾 Eligió: ${animalSelected}
✅ Salió: ${animalResult}
💰 Apostó: ${betAmount} 🥬
🏆 Ganó: ${prize || betAmount * 35} 🥬
💾 Balance: ${newBalance} 🥬
⏰ ${new Date().toLocaleString('es-VE')}`);
            }

            return res.status(200).json({
                success: true,
                type: 'bet',
                newBalance: updatedUser?.coins || newBalance,
                message: won ? '🎉 ¡Ganaste!' : '😔 Sigue intentando',
            });
        }

        // ── ACCIÓN: COMPRA ──────────────────────────────────────────────
        if (action === 'purchase') {
            if (!purchaseAmount || !purchasePrice)
                return res.status(400).json({ error: 'Falta purchaseAmount o purchasePrice' });

            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || 'Usuario',
                type: 'purchase',
                lechugas: purchaseAmount,
                ton: purchasePrice,
                walletAddress: walletAddress || null,
                transactionHash: transactionHash || null,
                status: 'completada',
                date: new Date(),
            });

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { $inc: { coins: parseInt(purchaseAmount) }, $set: { lastActive: new Date() } },
                { returnDocument: 'after' }
            );

            await enviarNotificacion(`
🛍️ *NUEVA COMPRA*
👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 Compró ${purchaseAmount} 🥬
💵 Pagó ${purchasePrice} TON
🔗 Hash: \`${transactionHash || 'N/A'}\`
📊 Balance nuevo: ${updatedUser.coins} 🥬
⏰ ${new Date().toLocaleString('es-VE')}`);

            return res.status(200).json({
                success: true,
                type: 'purchase',
                newBalance: updatedUser.coins,
                message: `✅ ${purchaseAmount} lechugas agregadas`,
            });
        }

        // ── ACCIÓN: RETIRO ──────────────────────────────────────────────
        if (action === 'withdraw') {
            if (!walletAddress) return res.status(400).json({ error: 'Wallet no conectada' });
            if (!withdrawAmount || withdrawAmount < 5 || withdrawAmount > 20)
                return res.status(400).json({ error: 'Monto inválido (5–20 TON)' });

            const lechugasADescontar = withdrawAmount * 10000;
            if (user.coins < lechugasADescontar)
                return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.coins} 🥬, necesitas ${lechugasADescontar} 🥬` });

            await transactions.insertOne({
                telegramId: userIdStr,
                username: username || 'Usuario',
                type: 'withdraw',
                lechugas: lechugasADescontar,
                ton: withdrawAmount,
                walletAddress,
                status: 'pendiente',
                date: new Date(),
            });

            const updatedUser = await users.findOneAndUpdate(
                { telegramId: userIdStr },
                { $inc: { coins: -lechugasADescontar }, $set: { lastActive: new Date() } },
                { returnDocument: 'after' }
            );

            await enviarNotificacion(`
🚀 *SOLICITUD DE RETIRO*
👤 @${username || 'Usuario'} (ID: ${userIdStr})
💰 ${withdrawAmount} TON
🏦 Wallet: \`${walletAddress}\`
📉 -${lechugasADescontar} 🥬
💾 Balance restante: ${updatedUser.coins} 🥬
⏱️ *Estado: PENDIENTE*
⏰ ${new Date().toLocaleString('es-VE')}
https://tonscan.org/address/${walletAddress}`);

            return res.status(200).json({
                success: true,
                type: 'withdraw',
                newBalance: updatedUser.coins,
                message: `✅ Retiro de ${withdrawAmount} TON solicitado`,
            });
        }

        // ── SIN ACCIÓN: CARGAR USUARIO ──────────────────────────────────
        return res.status(200).json({
            success: true,
            user: {
                telegramId: user.telegramId,
                username: user.username,
                coins: user.coins || 0,
                tonBalance: user.tonBalance || 0,
                totalBets: user.totalBets || 0,
                totalWins: user.totalWins || 0,
                completedTasks: user.completedTasks || [],
                lastDailyBonus: user.lastDailyBonus || null,
                createdAt: user.createdAt,
                lastActive: user.lastActive,
            },
        });

    } catch (error) {
        console.error('❌ Error en /api/user:', error);
        return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
}

async function enviarNotificacion(mensaje) {
    const TOKEN = process.env.TOKEN_BOT;
    const CHAT_ID = process.env.ID_DE_CHAT;
    if (!TOKEN || !CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: mensaje.trim(), parse_mode: 'Markdown' }),
        });
    } catch (e) {
        console.error('❌ Error notificación Telegram:', e);
    }
}
