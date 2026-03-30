import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Variables para el bot de notificaciones
const botToken = process.env.TOKEN_BOT;
const chatID = process.env.ID_DE_CHAT;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        await client.connect();
        const db = client.db('animalito_db');
        const users = db.collection('users');
        const withdrawals = db.collection('withdrawals');

        const { telegramId, username, withdrawAmount } = req.body;

        if (!telegramId) return res.status(400).json({ error: 'Falta telegramId' });

        // ESCENARIO: SOLICITUD DE RETIRO
        if (withdrawAmount) {
            const lechugasADescontar = withdrawAmount * 10000; // 1 TON = 10k lechugas
            
            const user = await users.findOne({ telegramId: telegramId.toString() });
            if (!user || user.coins < lechugasADescontar) {
                return res.status(400).json({ error: 'Saldo insuficiente' });
            }

            // 1. Guardar en DB
            await withdrawals.insertOne({
                telegramId,
                username,
                amountTON: withdrawAmount,
                status: 'pendiente',
                date: new Date()
            });

            // 2. Descontar saldo
            await users.updateOne(
                { telegramId: telegramId.toString() },
                { $inc: { coins: -lechugasADescontar } }
            );

            // 3. ENVIAR NOTIFICACIÓN A JAVIER
            const mensaje = `🔔 *NUEVO RETIRO SOLICITADO*\n\n👤 Usuario: @${username || 'Sin Username'}\n🆔 ID: ${telegramId}\n💰 Monto: ${withdrawAmount} TON\n📉 Descuento: ${lechugasADescontar} 🥬`;
            
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: chatID, 
                    text: mensaje, 
                    parse_mode: 'Markdown' 
                })
            });

            return res.status(200).json({ success: true, newBalance: user.coins - lechugasADescontar });
        }

        // ESCENARIO: CARGA INICIAL / REGISTRO
        const result = await users.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            { $setOnInsert: { coins: 1000, username: username || "Usuario" } },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
}
