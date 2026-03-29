import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Solo POST');

    try {
        await client.connect();
        const db = client.db('animalito_db'); // Asegúrate que este sea el nombre de tu DB
        const collection = db.collection('users');
        const { telegramId, username, reward } = req.body;

        if (reward) {
            // Esto suma las lechugas al saldo que ya existe
            await collection.updateOne(
                { telegramId: telegramId },
                { $inc: { coins: reward }, $set: { username: username } },
                { upsert: true }
            );
            return res.status(200).json({ success: true });
        } else {
            // Esto es para cuando el usuario abre la app
            const user = await collection.findOne({ telegramId: telegramId });
            return res.status(200).json(user || { coins: 0 });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Fallo de conexión con MongoDB" });
    }
}
