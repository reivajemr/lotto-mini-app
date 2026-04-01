// api/user.mjs - VERSIÓN CORRECTA (eliminar api/user.js del repo)
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch {
      cachedClient = null;
    }
  }
  if (!uri) throw new Error('MONGODB_URI no configurado');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  await client.connect();
  cachedClient = client;
  return client;
}

async function notify(text) {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch { /* ignorar */ }
}

async function notifyUser(telegramId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'Markdown' }),
    });
  } catch { /* ignorar */ }
}

const BET_CONFIG = {
  minBet: 50,
  maxBetPerUser: 1000,
  maxBetGlobal: 10000,
  multiplier: 30,
};

const LECHUGAS_PER_TON = 10000;

function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}

function vzDateStr(d) {
  const vz = d || vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth() + 1).padStart(2, '0')}-${String(vz.getDate()).padStart(2, '0')}`;
}

const ANIMALS_MAP = {
  1: 'Carnero', 2: 'Toro', 3: 'Ciempiés', 4: 'Alacrán', 5: 'León', 6: 'Rana', 7: 'Perico',
  8: 'Ratón', 9: 'Águila', 10: 'Tigre', 11: 'Gato', 12: 'Caballo', 13: 'Mono', 14: 'Paloma',
  15: 'Zorro', 16: 'Oso', 17: 'Pavo', 18: 'Burro', 19: 'Chivo', 20: 'Cochino', 21: 'Gallo',
  22: 'Camello', 23: 'Zebra', 24: 'Iguana', 25: 'Gavilán', 26: 'Murciélago', 27: 'Perro',
  28: 'Venado', 29: 'Morrocoy', 30: 'Caimán', 31: 'Anteater', 32: 'Serpiente', 33: 'Lechuza',
  34: 'Loro', 35: 'Jirafa', 36: 'Culebra', 0: 'Ballena',
};

const DRAW_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

function getDrawSlot(drawId) {
  const parts = drawId.split('-');
  const timeStr = parts[parts.length - 1];
  const hour = parseInt(timeStr.slice(0, 2));
  const min = parseInt(timeStr.slice(2, 4));
  const now = vzNow();
  const drawTime = new Date(now);
  drawTime.setHours(hour, min, 0, 0);
  const closeTime = new Date(drawTime.getTime() - 10 * 60000);
  const resultTime = new Date(drawTime.getTime() + 5 * 60000);
  return { drawTime, closeTime, resultTime };
}

async function settleDrawBets(db, drawId, winnerNumber, winnerAnimal) {
  const transactions = db.collection('transactions');
  const tickets = db.collection('tickets');
  const users = db.collection('users');
  const drawLimits = db.collection('draw_limits');

  const bets = await transactions.find({ drawId, type: 'bet', status: 'pending' }).toArray();

  for (const bet of bets) {
    const isWinner = bet.animal === winnerAnimal || bet.animalNumber === winnerNumber;
    const prize = isWinner ? bet.amount * BET_CONFIG.multiplier : 0;
    await transactions.updateOne(
      { _id: bet._id },
      { $set: { status: 'settled', won: isWinner, prize, winnerNumber, winnerAnimal, settledAt: new Date() } }
    );
    if (isWinner) {
      await users.updateOne(
        { telegramId: bet.telegramId },
        { $inc: { balance: prize, totalWins: 1 } }
      );
    }
  }

  const pendingTickets = await tickets.find({ drawId, status: 'pending' }).toArray();
  for (const ticket of pendingTickets) {
    const updatedBets = ticket.bets.map(b => {
      const isW = b.animal === winnerAnimal || b.number === winnerNumber;
      return { ...b, won: isW, prize: isW ? b.amount * BET_CONFIG.multiplier : 0, status: 'settled' };
    });
    const totalPrize = updatedBets.reduce((s, b) => s + (b.prize || 0), 0);
    const won = totalPrize > 0;
    await tickets.updateOne(
      { _id: ticket._id },
      { $set: { bets: updatedBets, status: won ? 'won' : 'lost', totalPrize, settledAt: new Date() } }
    );
    if (won) {
      await notifyUser(
        ticket.telegramId,
        `🎉 *¡GANASTE!* — Sorteo ${drawId.split('-').slice(-1)[0].slice(0, 2)}:${drawId.split('-').slice(-1)[0].slice(2, 4)}\n\n` +
        `🐾 Salió: *${winnerAnimal}* \\#${winnerNumber}\n` +
        `💰 Premio: *+${totalPrize.toLocaleString()} 🥬*\n\n` +
        `¡Felicidades! 🏆`
      );
    }
  }

  await drawLimits.deleteMany({ drawId });
  return bets.length;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI no configurado' });

  let client;
  try {
    client = await getClient();
  } catch (err) {
    return res.status(500).json({ error: 'MongoDB: ' + err.message });
  }

  const db = client.db('animalito_db');
  const users = db.collection('users');
  const transactions = db.collection('transactions');
  const tickets = db.collection('tickets');
  const withdrawals = db.collection('withdrawals');
  const drawResults = db.collection('draw_results');
  const drawLimits = db.collection('draw_limits');

  const body = req.body || {};
  const { telegramId, username, action } = body;

  if (!telegramId) return res.status(400).json({ error: 'telegramId requerido' });

  const tid = String(telegramId);

  try {
    // ═══════════════════════════════════════
    // CARGAR o CREAR USUARIO
    // ═══════════════════════════════════════
    if (!action || action === 'load') {
      let user = await users.findOne({ telegramId: tid });
      if (!user) {
        const newUser = {
          telegramId: tid,
          username: username || 'Usuario',
          balance: 1000,
          completedTasks: [],
          lastDailyBonus: null,
          totalBets: 0,
          totalWins: 0,
          walletAddress: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await users.insertOne(newUser);
        await notify(`🆕 Nuevo usuario: @${username || 'sin\\_username'} (ID: ${tid})`);
        return res.status(200).json({ success: true, user: newUser, isNew: true });
      }
      return res.status(200).json({ success: true, user });
    }

    // ═══════════════════════════════════════
    // OBTENER WALLET DEL ADMIN
    // ═══════════════════════════════════════
    if (action === 'getAdminWallet') {
      const wallet = process.env.ADMIN_TON_WALLET || 'No configurada';
      return res.status(200).json({ success: true, wallet });
    }

    // ═══════════════════════════════════════
    // COMPLETAR TAREA
    // ═══════════════════════════════════════
    if (action === 'task') {
      const { taskId, reward } = body;
      if (!taskId || !reward) return res.status(400).json({ error: 'taskId y reward requeridos' });

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (taskId === 'daily') {
        const last = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
        const now = new Date();
        if (last && (now.getTime() - last.getTime()) < 24 * 3600000) {
          return res.status(400).json({ error: 'Bono diario ya reclamado. Espera 24h.' });
        }
        const result = await users.findOneAndUpdate(
          { telegramId: tid },
          { $inc: { balance: reward }, $set: { lastDailyBonus: now, updatedAt: now } },
          { returnDocument: 'after' }
        );
        return res.status(200).json({ success: true, newBalance: result.balance });
      }

      if (user.completedTasks?.includes(taskId)) {
        return res.status(400).json({ error: 'Tarea ya completada' });
      }

      const result = await users.findOneAndUpdate(
        { telegramId: tid },
        {
          $inc: { balance: reward },
          $push: { completedTasks: taskId },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      return res.status(200).json({ success: true, newBalance: result.balance });
    }

    // ═══════════════════════════════════════
    // APOSTAR
    // ═══════════════════════════════════════
    if (action === 'bet') {
      const { drawId, animal, animalNumber, amount } = body;
      if (!drawId || !animal || amount === undefined) {
        return res.status(400).json({ error: 'drawId, animal y amount requeridos' });
      }

      const betAmount = parseInt(amount);
      if (betAmount < BET_CONFIG.minBet) {
        return res.status(400).json({ error: `Apuesta mínima: ${BET_CONFIG.minBet} 🥬` });
      }
      if (betAmount > BET_CONFIG.maxBetPerUser) {
        return res.status(400).json({ error: `Apuesta máxima: ${BET_CONFIG.maxBetPerUser} 🥬 por apuesta` });
      }

      // Verificar que el sorteo está abierto
      const { closeTime, drawTime } = getDrawSlot(drawId);
      const nowVz = vzNow();
      if (nowVz >= closeTime) {
        return res.status(400).json({ error: 'El sorteo ya cerró (10 min antes del horario)' });
      }

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (user.balance < betAmount) {
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance} 🥬` });
      }

      // Verificar límite global del sorteo
      const drawLimit = await drawLimits.findOne({ drawId, animal });
      if (drawLimit && drawLimit.totalBet >= BET_CONFIG.maxBetGlobal) {
        return res.status(400).json({ error: `Cupo agotado para ${animal} en este sorteo` });
      }

      // Descontar saldo y registrar apuesta
      const updatedUser = await users.findOneAndUpdate(
        { telegramId: tid, balance: { $gte: betAmount } },
        {
          $inc: { balance: -betAmount, totalBets: 1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      if (!updatedUser) {
        return res.status(400).json({ error: 'Saldo insuficiente' });
      }

      // Registrar transacción
      await transactions.insertOne({
        telegramId: tid,
        drawId,
        animal,
        animalNumber: parseInt(animalNumber) || 0,
        amount: betAmount,
        type: 'bet',
        status: 'pending',
        createdAt: new Date(),
      });

      // Actualizar límite global
      await drawLimits.updateOne(
        { drawId, animal },
        { $inc: { totalBet: betAmount }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );

      await notify(
        `🎰 Apuesta: @${user.username || tid}\n` +
        `🐾 ${animal} — Sorteo ${drawId}\n` +
        `💰 ${betAmount} 🥬`
      );

      return res.status(200).json({ success: true, newBalance: updatedUser.balance });
    }

    // ═══════════════════════════════════════
    // DEPOSITAR TON
    // ═══════════════════════════════════════
    if (action === 'deposit') {
      const { tonAmount, lechugas, fromAddress } = body;
      if (!tonAmount || !lechugas) {
        return res.status(400).json({ error: 'tonAmount y lechugas requeridos' });
      }

      const lechugasInt = parseInt(lechugas);
      const updatedUser = await users.findOneAndUpdate(
        { telegramId: tid },
        {
          $inc: { balance: lechugasInt },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      if (!updatedUser) return res.status(404).json({ error: 'Usuario no encontrado' });

      await transactions.insertOne({
        telegramId: tid,
        type: 'deposit',
        tonAmount: parseFloat(tonAmount),
        lechugas: lechugasInt,
        fromAddress: fromAddress || '',
        status: 'confirmed',
        createdAt: new Date(),
      });

      await notify(
        `💰 Depósito: @${updatedUser.username || tid}\n` +
        `${tonAmount} TON → ${lechugasInt.toLocaleString()} 🥬\n` +
        `Wallet: ${fromAddress || 'N/A'}`
      );

      return res.status(200).json({ success: true, newBalance: updatedUser.balance });
    }

    // ═══════════════════════════════════════
    // SOLICITAR RETIRO
    // ═══════════════════════════════════════
    if (action === 'withdraw') {
      const { tonAmount, lechugas: lechugasBody, toAddress } = body;
      if (!tonAmount || !lechugasBody || !toAddress) {
        return res.status(400).json({ error: 'tonAmount, lechugas y toAddress requeridos' });
      }

      const lechugasInt = parseInt(lechugasBody);
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (user.balance < lechugasInt) {
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance} 🥬` });
      }

      const updatedUser = await users.findOneAndUpdate(
        { telegramId: tid, balance: { $gte: lechugasInt } },
        {
          $inc: { balance: -lechugasInt },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      if (!updatedUser) return res.status(400).json({ error: 'Saldo insuficiente' });

      await withdrawals.insertOne({
        telegramId: tid,
        username: user.username,
        tonAmount: parseFloat(tonAmount),
        lechugas: lechugasInt,
        toAddress,
        status: 'pending',
        requestedAt: new Date(),
      });

      await notify(
        `⬆️ *RETIRO PENDIENTE*\n` +
        `👤 @${user.username || tid} (ID: ${tid})\n` +
        `💰 ${tonAmount} TON (${lechugasInt.toLocaleString()} 🥬)\n` +
        `📬 Dirección: \`${toAddress}\`\n` +
        `⏳ Pendiente de aprobación`
      );

      return res.status(200).json({ success: true, newBalance: updatedUser.balance });
    }

    // ═══════════════════════════════════════
    // OBTENER RESULTADOS
    // ═══════════════════════════════════════
    if (action === 'getResults') {
      const results = await drawResults
        .find({})
        .sort({ drawnAt: -1 })
        .limit(20)
        .toArray();
      return res.status(200).json({ success: true, results });
    }

    // ═══════════════════════════════════════
    // REGISTRAR RESULTADO (admin/cron)
    // ═══════════════════════════════════════
    if (action === 'setResult') {
      const cronKey = process.env.CRON_SECRET;
      if (body.cronKey !== cronKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const { drawId, winnerNumber, winnerAnimal } = body;
      if (!drawId || winnerNumber === undefined || !winnerAnimal) {
        return res.status(400).json({ error: 'drawId, winnerNumber y winnerAnimal requeridos' });
      }

      // Verificar si ya existe
      const existing = await drawResults.findOne({ drawId });
      if (existing) {
        return res.status(400).json({ error: 'Resultado ya registrado para este sorteo' });
      }

      await drawResults.insertOne({
        drawId,
        winnerNumber: parseInt(winnerNumber),
        winnerAnimal,
        drawnAt: new Date(),
      });

      const settled = await settleDrawBets(db, drawId, parseInt(winnerNumber), winnerAnimal);

      await notify(
        `🎰 *RESULTADO SORTEO ${drawId}*\n` +
        `🐾 Ganador: *${winnerAnimal}* \\#${winnerNumber}\n` +
        `✅ ${settled} apuestas liquidadas`
      );

      return res.status(200).json({ success: true, settled });
    }

    // ═══════════════════════════════════════
    // SCRAPE RESULTADOS (llamado por cron)
    // ═══════════════════════════════════════
    if (action === 'scrapeResults') {
      const cronKey = process.env.CRON_SECRET;
      if (body.cronKey !== cronKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { targetHour } = body;
      if (targetHour === undefined) {
        return res.status(400).json({ error: 'targetHour requerido' });
      }

      const dateStr = vzDateStr();
      const hourStr = String(targetHour).padStart(2, '0');
      const drawId = `${dateStr}-${hourStr}00`;

      // Verificar si ya existe resultado
      const existing = await drawResults.findOne({ drawId });
      if (existing) {
        return res.status(200).json({ success: true, message: 'Resultado ya registrado', drawId });
      }

      // Generar resultado aleatorio (en producción aquí iría el scraping real)
      const animalNumbers = Object.keys(ANIMALS_MAP).map(Number);
      const winnerNumber = animalNumbers[Math.floor(Math.random() * animalNumbers.length)];
      const winnerAnimal = ANIMALS_MAP[winnerNumber];

      await drawResults.insertOne({
        drawId,
        winnerNumber,
        winnerAnimal,
        drawnAt: new Date(),
        source: 'auto',
      });

      const settled = await settleDrawBets(db, drawId, winnerNumber, winnerAnimal);

      return res.status(200).json({
        success: true,
        drawId,
        winnerNumber,
        winnerAnimal,
        settled,
        results: { lotto: { winnerAnimal, winnerNumber }, granja: null }
      });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
