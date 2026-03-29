import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    // 1. Solo permitimos peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        // 2. Intentamos conectar al clúster Zing
        await client.connect();
        const db = client.db('animalito_db');
        const collection = db.collection('users');

        const { telegramId, username, reward } = req.body;

        if (!telegramId) {
            return res.status(400).json({ error: 'Falta el telegramId en la petición' });
        }

        if (reward) {
            // 3. Si hay una recompensa (ej. compra), actualizamos
            await collection.updateOne(
                { telegramId: telegramId.toString() },
                { 
                    $inc: { coins: parseInt(reward) }, 
                    $set: { username: username || "Usuario" } 
                },
                { upsert: true }
            );
            return res.status(200).json({ success: true });
        } else {
            // 4. Si solo es abrir la app, buscamos al usuario
            const user = await collection.findOne({ telegramId: telegramId.toString() });
            
            if (!user) {
                // Si no existe, lo creamos con saldo 0 para que la app no se quede "muerta"
                return res.status(200).json({ coins: 0, nuevo: true });
            }
            
            return res.status(200).json(user);
        }

    } catch (error) {
        // 5. ESTO ES LO MÁS IMPORTANTE: Imprime el error real en los logs de Vercel
        console.error("ERROR CRÍTICO EN API:", error.message);
        return res.status(500).json({ 
            error: 'Fallo de conexión con la base de datos',
            detalle: error.message 
        });
    }
}
