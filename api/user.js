import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        await client.connect();
        const db = client.db('animalito_db');
        const users = db.collection('users');
        const withdrawals = db.collection('withdrawals'); // Nueva colección para tus reportes

        const { telegramId, username, reward, withdrawAmount } = req.body;

        if (!telegramId) return res.status(400).json({ error: 'Falta telegramId' });

        // ESCENARIO A: REGISTRAR SOLICITUD DE RETIRO
        if (withdrawAmount) {
            const lechugasADescontar = withdrawAmount * 10000;
            
            // 1. Verificamos saldo
            const user = await users.findOne({ telegramId: telegramId.toString() });
            if (!user || user.coins < lechugasADescontar) {
                return res.status(400).json({ error: 'Saldo insuficiente para el retiro' });
            }

            // 2. Guardamos la solicitud para que Javier la revise
            await withdrawals.insertOne({
                telegramId,
                username,
                amountTON: withdrawAmount,
                lechugasCost: lechugasADescontar,
                status: 'pendiente',
                date: new Date()
            });

            // 3. Descontamos las lechugas del usuario
            await users.updateOne(
                { telegramId: telegramId.toString() },
                { $inc: { coins: -lechugasADescontar } }
            );

            return res.status(200).json({ message: 'Retiro registrado' });
        }

        // ESCENARIO B: ACTUALIZAR RECOMPENSA O CREAR USUARIO NUEVO
        const updateData = reward ? { $inc: { coins: reward } } : { $setOnInsert: { coins: 1000 } };
        
        const result = await users.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            { ...updateData, $set: { username: username || "Sin nombre" } },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error de servidor' });
    }
}
