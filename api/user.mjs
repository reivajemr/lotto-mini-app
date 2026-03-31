// api/user.mjs
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

// Notificar al ADMIN
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

// Notificar al USUARIO
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

// Límites de apuesta
const BET_CONFIG = {
  minBet: 50,
  maxBetPerUser: 1000,
  maxBetGlobal: 10000,
  multiplier: 30,
};

// Hora Venezuela
function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}

function vzDateStr(d) {
  const vz = d || vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth() + 1).padStart(2, '0')}-${String(vz.getDate()).padStart(2, '0')}`;
}

// 37 Animalitos
const ANIMALS_MAP = {
  1: 'Carnero', 2: 'Toro', 3: 'Ciempiés', 4: 'Alacrán', 5: 'León', 6: 'Rana', 7: 'Perico',
  8: 'Ratón', 9: 'Águila', 10: 'Tigre', 11: 'Gato', 12: 'Caballo', 13: 'Mono', 14: 'Paloma',
  15: 'Zorro', 16: 'Oso', 17: 'Pavo', 18: 'Burro', 19: 'Chivo', 20: 'Cochino', 21: 'Gallo',
  22: 'Camello', 23: 'Zebra', 24: 'Iguana', 25: 'Gavilán', 26: 'Murciélago', 27: 'Perro',
  28: 'Venado', 29: 'Morrocoy', 30: 'Caimán', 31: 'Anteater', 32: 'Serpiente', 33: 'Lechuza',
  34: 'Loro', 35: 'Jirafa', 36: 'Culebra', 0: 'Ballena',
};

// Horarios de sorteos
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

// Pagar apuestas ganadoras de un sorteo
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
  // CORS
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
    // ══════════════════════════════════════════════════════════
    // CARGAR o CREAR USUARIO
    // ══════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════
    // OBTENER WALLET DEL ADMIN
    // ══════════════════════════════════════════════════════════
    if (action === 'getAdminWallet') {
      const wallet = process.env.ADMIN_TON_WALLET || 'No configurada';
      return res.status(200).json({ success: true, wallet });
    }

    // ══════════════════════════════════════════════════════════
    // COMPLETAR TAREA
    // ══════════════════════════════════════════════════════════
    if (action === 'task') {
      const { taskId, reward } = body;
      if (!taskId || !reward) return res.status(400).json({ error: 'taskId y reward requeridos' });

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (taskId === 'daily') {
        const last = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
        const now = new Date();
        if (last && (now - last) < 24 * 60 * 60 * 1000) {
          const nextBonus = new Date(last.getTime() + 24 * 60 * 60 * 1000);
          const hoursLeft = Math.ceil((nextBonus - now) / (60 * 60 * 1000));
          return res.status(400).json({ error: `El bono diario estará disponible en ${hoursLeft}h` });
        }
        await users.updateOne(
          { telegramId: tid },
          { $inc: { balance: reward }, $set: { lastDailyBonus: now, updatedAt: now } }
        );
        const updatedUser = await users.findOne({ telegramId: tid });
        return res.status(200).json({ success: true, newBalance: updatedUser.balance });
      }

      // Otras tareas (solo una vez)
      if (user.completedTasks && user.completedTasks.includes(taskId)) {
        return res.status(400).json({ error: 'Tarea ya completada' });
      }
      await users.updateOne(
        { telegramId: tid },
        {
          $inc: { balance: reward },
          $push: { completedTasks: taskId },
          $set: { updatedAt: new Date() },
        }
      );
      const updatedUser = await users.findOne({ telegramId: tid });
      return res.status(200).json({ success: true, newBalance: updatedUser.balance });
    }

    // ══════════════════════════════════════════════════════════
    // OBTENER SORTEOS DEL DÍA
    // ══════════════════════════════════════════════════════════
    if (action === 'getDraws') {
      const game = body.game || 'lotto';
      const now = vzNow();
      const today = vzDateStr(now);

      const drawList = DRAW_TIMES.map(time => {
        const drawId = `${game}-${today}-${time.replace(':', '')}`;
        const [h, m] = time.split(':').map(Number);
        const drawTime = new Date(now);
        drawTime.setHours(h, m, 0, 0);
        const closeTime = new Date(drawTime.getTime() - 10 * 60000);
        const resultTime = new Date(drawTime.getTime() + 5 * 60000);

        let status;
        if (now < closeTime) status = 'open';
        else if (now >= closeTime && now < drawTime) status = 'closed';
        else if (now >= drawTime && now < resultTime) status = 'drawing';
        else status = 'done';

        return {
          drawId,
          game,
          time,
          status,
          closeTime: closeTime.toISOString(),
          drawTime: drawTime.toISOString(),
          resultTime: resultTime.toISOString(),
        };
      });

      // Obtener resultados de los sorteos terminados
      const doneDrawIds = drawList.filter(d => d.status === 'done').map(d => d.drawId);
      const results = doneDrawIds.length > 0
        ? await drawResults.find({ drawId: { $in: doneDrawIds } }).toArray()
        : [];

      const resultsMap = {};
      for (const r of results) {
        resultsMap[r.drawId] = r;
      }

      const enrichedDraws = drawList.map(d => {
        const result = resultsMap[d.drawId];
        return {
          ...d,
          winnerNumber: result?.winnerNumber ?? null,
          winnerAnimal: result?.winnerAnimal ?? null,
        };
      });

      return res.status(200).json({ success: true, draws: enrichedDraws });
    }

    // ══════════════════════════════════════════════════════════
    // OBTENER LÍMITES DE UN SORTEO
    // ══════════════════════════════════════════════════════════
    if (action === 'getDrawLimits') {
      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });

      const limitDocs = await drawLimits.find({ drawId }).toArray();
      const limits = {};
      for (const doc of limitDocs) {
        limits[doc.animal] = {
          remaining: Math.max(0, BET_CONFIG.maxBetGlobal - (doc.total || 0)),
          isFull: (doc.total || 0) >= BET_CONFIG.maxBetGlobal,
        };
      }
      return res.status(200).json({ success: true, limits });
    }

    // ══════════════════════════════════════════════════════════
    // REGISTRAR APUESTA CON TICKET
    // ══════════════════════════════════════════════════════════
    if (action === 'placeBet') {
      const { drawId, drawGame, bets: betList } = body;
      if (!drawId || !betList || !Array.isArray(betList) || betList.length === 0) {
        return res.status(400).json({ error: 'drawId y bets[] requeridos' });
      }

      const { closeTime } = getDrawSlot(drawId);
      const nowVz = vzNow();
      if (nowVz >= closeTime) {
        return res.status(400).json({ error: '⏰ Este sorteo ya cerró. Apuesta en el próximo.' });
      }

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const totalBet = betList.reduce((s, b) => s + (b.amount || 0), 0);

      for (const bet of betList) {
        if (bet.amount < BET_CONFIG.minBet) {
          return res.status(400).json({ error: `Mínimo ${BET_CONFIG.minBet} 🥬 por animal` });
        }
        if (bet.amount > BET_CONFIG.maxBetPerUser) {
          return res.status(400).json({ error: `Máximo ${BET_CONFIG.maxBetPerUser} 🥬 por animal (${bet.animal})` });
        }
      }

      if ((user.balance || 0) < totalBet) {
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬` });
      }

      // Verificar límites globales
      for (const bet of betList) {
        const limitDoc = await drawLimits.findOne({ drawId, animal: bet.animal });
        const currentTotal = limitDoc?.total || 0;
        if (currentTotal >= BET_CONFIG.maxBetGlobal) {
          return res.status(400).json({ error: `Límite de usuario alcanzado para ${bet.animal} (máx ${BET_CONFIG.maxBetPerUser} 🥬)` });
        }
        if (currentTotal + bet.amount > BET_CONFIG.maxBetGlobal) {
          return res.status(400).json({ error: `Límite global alcanzado para ${bet.animal}. Solo quedan ${(BET_CONFIG.maxBetGlobal - currentTotal).toLocaleString()} 🥬` });
        }
      }

      // Descontar balance
      await users.updateOne(
        { telegramId: tid },
        { $inc: { balance: -totalBet, totalBets: 1 }, $set: { updatedAt: new Date() } }
      );

      // Actualizar límites globales
      for (const bet of betList) {
        await drawLimits.updateOne(
          { drawId, animal: bet.animal },
          { $inc: { total: bet.amount }, $set: { game: drawGame || 'lotto', updatedAt: new Date() } },
          { upsert: true }
        );
      }

      // Crear registros de apuesta
      const betDocs = betList.map(bet => ({
        telegramId: tid,
        type: 'bet',
        animal: bet.animal,
        animalNumber: bet.number,
        amount: bet.amount,
        drawId,
        drawGame: drawGame || 'lotto',
        won: null,
        prize: null,
        status: 'pending',
        createdAt: new Date(),
      }));
      await transactions.insertMany(betDocs);

      // Crear TICKET
      const ticketId = `T-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).toUpperCase().slice(2, 5)}`;
      const ticketDoc = {
        ticketId,
        telegramId: tid,
        username: user.username || username,
        drawId,
        drawGame: drawGame || 'lotto',
        bets: betList.map(bet => ({
          animal: bet.animal,
          number: bet.number,
          amount: bet.amount,
          won: null,
          prize: null,
          status: 'pending',
        })),
        betsCount: betList.length,
        totalBet,
        totalPrize: null,
        status: 'pending',
        createdAt: new Date(),
      };
      await tickets.insertOne(ticketDoc);

      const newBalance = (user.balance || 0) - totalBet;
      return res.status(200).json({
        success: true,
        ticket: ticketDoc,
        newBalance,
        message: `✅ Ticket ${ticketId} registrado. ¡Buena suerte!`,
      });
    }

    // ══════════════════════════════════════════════════════════
    // OBTENER TICKETS DEL USUARIO
    // ══════════════════════════════════════════════════════════
    if (action === 'getTickets') {
      const userTickets = await tickets
        .find({ telegramId: tid })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json({ success: true, tickets: userTickets });
    }

    // ══════════════════════════════════════════════════════════
    // GUARDAR WALLET
    // ══════════════════════════════════════════════════════════
    if (action === 'wallet') {
      const { walletAddress } = body;
      await users.updateOne(
        { telegramId: tid },
        { $set: { walletAddress: walletAddress || null, updatedAt: new Date() } }
      );
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════════
    // SOLICITUD DE RETIRO
    // ══════════════════════════════════════════════════════════
    if (action === 'withdraw') {
      const { walletAddress, withdrawAmount } = body;
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const wallet = walletAddress || user.walletAddress;
      if (!wallet) return res.status(400).json({ error: 'Guarda tu wallet primero.' });

      const amount = Number(withdrawAmount);
      if (!amount || amount < 0.1) {
        return res.status(400).json({ error: 'Monto mínimo: 0.1 TON' });
      }

      const amountLechugas = Math.floor(amount * 1000);
      if (amountLechugas > (user.balance || 0)) {
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬` });
      }

      await users.updateOne(
        { telegramId: tid },
        { $inc: { balance: -amountLechugas }, $set: { updatedAt: new Date() } }
      );

      const withdrawal = {
        telegramId: tid,
        username: user.username || username,
        walletAddress: wallet,
        amountTON: amount,
        amountLechugas,
        status: 'pending',
        createdAt: new Date(),
      };
      const result = await withdrawals.insertOne(withdrawal);
      const withdrawId = result.insertedId.toString().slice(-6).toUpperCase();

      await notify(
        `💸 *Solicitud de retiro*\n\n` +
        `👤 @${user.username || 'sin\\_username'} (ID: ${tid})\n` +
        `💰 Monto: *${amount} TON* (${amountLechugas.toLocaleString()} 🥬)\n` +
        `👛 Wallet: \`${wallet}\`\n` +
        `📋 ID: #${withdrawId}`
      );

      const newBalance = (user.balance || 0) - amountLechugas;
      return res.status(200).json({ success: true, newBalance, withdrawId });
    }

    // ══════════════════════════════════════════════════════════
    // SCRAPE RESULTS (llamado por el cron vía scraper.mjs)
    // ══════════════════════════════════════════════════════════
    if (action === 'scrapeResults') {
      const { cronKey, targetHour, targetGame } = body;
      if (cronKey !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const now = vzNow();
      const today = vzDateStr(now);
      const hour = targetHour || now.getHours();
      const timeStr = `${String(hour).padStart(2, '0')}00`;
      const results = {};

      const gamesToProcess = targetGame ? [targetGame] : ['lotto', 'granja'];

      for (const game of gamesToProcess) {
        const drawId = `${game}-${today}-${timeStr}`;
        const existing = await drawResults.findOne({ drawId });
        if (existing) {
          results[game] = { status: 'already_exists', drawId };
          continue;
        }

        // Aquí iría el scraping real - por ahora retornamos pendiente
        results[game] = { status: 'scraping_pending', drawId };
      }

      return res.status(200).json({ success: true, results, processedAt: new Date().toISOString() });
    }

    return res.status(400).json({ error: 'Acción no reconocida: ' + action });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}
