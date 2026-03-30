import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        await client.connect();
        const db = client.db('animalito_db');
        const users = db.collection('users');
        const withdrawals = db.collection('withdrawals');

        const { telegramId, username, withdrawAmount } = req.body;

        if (!telegramId) return res.status(400).json({ error: 'Falta ID' });

        // PROCESAR RETIRO
        if (withdrawAmount) {
            const lechugasADescontar = withdrawAmount * 10000;
            const user = await users.findOne({ telegramId: telegramId.toString() });

            if (!user || user.coins < lechugasADescontar) {
                return res.status(400).json({ error: 'Saldo insuficiente' });
            }

            // Registrar en DB
            await withdrawals.insertOne({
                telegramId,
                username: username || "Usuario",
                amountTON: withdrawAmount,
                status: 'pendiente',
                date: new Date()
            });

            // Descontar saldo
            await users.updateOne(
                { telegramId: telegramId.toString() },
                { $inc: { coins: -lechugasADescontar } }
            );

            // NOTIFICACIÓN A JAVIER
            const mensaje = `🚀 *NUEVO RETIRO*\n\n👤 @${username || 'Sin_Username'}\n💰 ${withdrawAmount} TON\n📉 -${lechugasADescontar} 🥬`;
            await fetch(`https://api.telegram.org/bot${process.env.TOKEN_BOT}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.ID_DE_CHAT, text: mensaje, parse_mode: 'Markdown' })
            });

            return res.status(200).json({ success: true, newBalance: user.coins - lechugasADescontar });
        }

        // CARGA O REGISTRO INICIAL
        const userDoc = await users.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            { $setOnInsert: { coins: 1000, username: username || "Usuario" } },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json(userDoc);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await client.close();
    }
}
