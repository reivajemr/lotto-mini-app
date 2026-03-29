// api/user.js
import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('animalito_db');
  cachedDb = db;
  return db;
}

export default async function handler(req, res) {
  try {
    const db = await connectToDatabase();
    const { telegramId, username, reward } = req.body;

    if (reward) {
      // USAR $inc ES VITAL: Esto suma las lechugas, no las sobrescribe
      await db.collection('users').updateOne(
        { telegramId: telegramId },
        { $inc: { coins: reward } }, 
        { upsert: true }
      );
    } else {
      // Crear o buscar usuario al iniciar
      const user = await db.collection('users').findOne({ telegramId: telegramId });
      if (!user) {
        await db.collection('users').insertOne({ telegramId, username, coins: 0 });
        return res.status(200).json({ coins: 0 });
      }
      return res.status(200).json(user);
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error de servidor" });
  }
}
