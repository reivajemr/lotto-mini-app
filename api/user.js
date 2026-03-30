import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        await client.connect();
        const db = client.db('animalito_db'); // Clúster Zing
        const users = db.collection('users');
        const withdrawals = db.collection('withdrawals');

        const { telegramId, username, withdrawAmount } = req.body;

        if (!telegramId) return res.status(400).json({ error: 'Falta telegramId' });

        // ESCENARIO: PROCESAR RETIRO
        if (withdrawAmount) {
            const lechugasADescontar = withdrawAmount * 10000;
            const user = await users.findOne({ telegramId: telegramId.toString() });

            if (!user || user.coins < lechugasADescontar) {
                return res.status(400).json({ error: 'Saldo insuficiente' });
            }

            await withdrawals.insertOne({
                telegramId,
                username,
                amountTON: withdrawAmount,
                status: 'pendiente',
                date: new Date()
            });

            await users.updateOne(
                { telegramId: telegramId.toString() },
                { $inc: { coins: -lechugasADescontar } }
            );

            // NOTIFICACIÓN AL BOT DE JAVIER
            const mensaje = `🔔 *SOLICITUD DE RETIRO*\n\n👤 @${username || 'Usuario'}\n💰 ${withdrawAmount} TON\n📉 -${lechugasADescontar} 🥬`;
            await fetch(`https://api.telegram.org/bot${process.env.TOKEN_BOT}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.ID_DE_CHAT, text: mensaje, parse_mode: 'Markdown' })
            });

            return res.status(200).json({ success: true, newBalance: user.coins - lechugasADescontar });
        }

        // CARGA NORMAL DE USUARIO
        const userDoc = await users.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            { $setOnInsert: { coins: 1000, username: username || "Usuario" } },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json(userDoc);
    } catch (error) {
        res.status(500).json({ error: 'Error de servidor' });
    }
}
