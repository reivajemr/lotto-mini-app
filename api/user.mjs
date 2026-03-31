import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('lotto');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { telegramId, name, username } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'Missing telegramId' });

  try {
    const db = await getDb();
    const users = db.collection('users');

    let user = await users.findOne({ telegramId });
    let isNew = false;

    if (!user) {
      isNew = true;
      user = {
        telegramId,
        name: name || 'Usuario',
        username: username || null,
        balance: 1000, // Welcome bonus
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await users.insertOne(user);
    } else {
      // Update name if changed
      await users.updateOne(
        { telegramId },
        {
          $set: {
            name: name || user.name,
            username: username || user.username,
            updatedAt: new Date(),
          }
        }
      );
      user = await users.findOne({ telegramId });
    }

    return res.status(200).json({ user, isNew });
  } catch (e) {
    console.error('User API error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
