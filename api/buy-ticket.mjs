import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('lotto');
}

const TICKET_PRICE = 100;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, animal, emoji, amount, drawTime } = req.body;
  if (!userId || !animal || !emoji || !drawTime) {
    return res.status(400).json({ error: 'Faltan datos del ticket' });
  }

  const ticketAmount = Math.max(1, Math.min(10, parseInt(amount) || 1));
  const totalCost = TICKET_PRICE * ticketAmount;

  try {
    const db = await getDb();
    const users = db.collection('users');
    const tickets = db.collection('tickets');

    const user = await users.findOne({ telegramId: userId });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.balance < totalCost) {
      return res.status(400).json({ error: `Saldo insuficiente. Necesitas ${totalCost} 🥬` });
    }

    // Deduct balance
    const updateResult = await users.findOneAndUpdate(
      { telegramId: userId, balance: { $gte: totalCost } },
      { $inc: { balance: -totalCost }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Create ticket
    const ticket = {
      userId,
      animal,
      emoji,
      drawTime,
      amount: ticketAmount,
      cost: totalCost,
      status: 'pending',
      createdAt: new Date(),
    };
    await tickets.insertOne(ticket);

    return res.status(200).json({
      success: true,
      newBalance: updateResult.balance,
      ticket,
    });
  } catch (e) {
    console.error('buy-ticket error:', e);
    return res.status(500).json({ error: 'Error al comprar ticket' });
  }
}
