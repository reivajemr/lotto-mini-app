const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
let cachedClient = null;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    try {
        if (!cachedClient) {
            cachedClient = new MongoClient(uri);
            await cachedClient.connect();
        }
        const db = cachedClient.db('lotto_game');
        const users = db.collection('users');
        const { telegramId, username } = req.body;

        const result = await users.findOneAndUpdate(
            { telegramId: telegramId },
            { 
                $setOnInsert: { coins: 500, gems: 0.0, createdAt: new Date() },
                $set: { username: username, lastLogin: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );
        return res.status(200).json(result);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
