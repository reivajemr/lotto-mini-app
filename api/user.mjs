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

// Horarios de sorteos LOTTO ACTIVO (cada hora de 8AM a 7PM VZ)
const DRAW_TIMES = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

// ══════════════════════════════════════════════════════════
// FLASH LOTTO — sorteos cada 5 minutos
// ══════════════════════════════════════════════════════════
function getFlashDrawId(date, slotMinutes) {
  const dateStr = vzDateStr(date);
  const h = String(Math.floor(slotMinutes / 60)).padStart(2, '0');
  const m = String(slotMinutes % 60).padStart(2, '0');
  return `flash-${dateStr}-${h}${m}`;
}

// Genera lista de sorteos Flash para un día dado (8AM-8PM VZ, cada 5 min)
function generateFlashDraws(dateStr) {
  const draws = [];
  const now = vzNow();
  const nowDateStr = vzDateStr(now);
  const isToday = dateStr === nowDateStr;

  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 5) {
      const slotMinutes = h * 60 + m;
      const drawId = `flash-${dateStr}-${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}`;
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      
      // Calcular tiempos
      const drawTimestamp = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
      // Convertir a UTC (Venezuela es UTC-4)
      const drawTimeUTC = new Date(drawTimestamp.getTime() + 4 * 60 * 60 * 1000);
      const closeTimeUTC = new Date(drawTimeUTC.getTime() - 2 * 60 * 1000); // cierra 2 min antes
      const resultTimeUTC = new Date(drawTimeUTC.getTime() + 1 * 60 * 1000); // resultado 1 min después

      let status = 'upcoming';
      if (isToday) {
        const nowUTC = new Date();
        if (nowUTC > resultTimeUTC) status = 'done';
        else if (nowUTC > drawTimeUTC) status = 'drawing';
        else if (nowUTC > closeTimeUTC) status = 'closed';
        else if (nowUTC > new Date(drawTimeUTC.getTime() - 30 * 60 * 1000)) status = 'open';
        else status = 'upcoming';
      }

      draws.push({
        drawId,
        time,
        game: 'flash',
        status,
        closeTime: closeTimeUTC.toISOString(),
        drawTime: drawTimeUTC.toISOString(),
        resultTime: resultTimeUTC.toISOString(),
        date: dateStr,
      });
    }
  }
  return draws;
}

// ══════════════════════════════════════════════════════════
// LOTTO ACTIVO — genera sorteos para un día
// ══════════════════════════════════════════════════════════
function generateLottoDraws(dateStr) {
  const draws = [];
  const now = vzNow();
  const nowDateStr = vzDateStr(now);
  const isToday = dateStr === nowDateStr;
  const isFuture = dateStr > nowDateStr;

  for (const time of DRAW_TIMES) {
    const [h, m] = time.split(':').map(Number);
    const drawId = `lotto-${dateStr}-${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}`;
    
    const drawTimestamp = new Date(`${dateStr}T${time}:00`);
    const drawTimeUTC = new Date(drawTimestamp.getTime() + 4 * 60 * 60 * 1000);
    const closeTimeUTC = new Date(drawTimeUTC.getTime() - 10 * 60 * 1000);
    const resultTimeUTC = new Date(drawTimeUTC.getTime() + 5 * 60 * 1000);

    let status = 'upcoming';
    if (isFuture) {
      status = 'upcoming';
    } else if (isToday) {
      const nowUTC = new Date();
      if (nowUTC > resultTimeUTC) status = 'done';
      else if (nowUTC > drawTimeUTC) status = 'drawing';
      else if (nowUTC > closeTimeUTC) status = 'closed';
      else status = 'open';
    } else {
      // Día pasado
      status = 'done';
    }

    draws.push({
      drawId,
      time,
      game: 'lotto',
      status,
      closeTime: closeTimeUTC.toISOString(),
      drawTime: drawTimeUTC.toISOString(),
      resultTime: resultTimeUTC.toISOString(),
      date: dateStr,
    });
  }
  return draws;
}

// ══════════════════════════════════════════════════════════
// PAGAR APUESTAS DE UN SORTEO
// ══════════════════════════════════════════════════════════
async function settleDrawBets(db, drawId, winnerNumber, winnerAnimal) {
  const tickets = db.collection('tickets');
  const users = db.collection('users');

  const pendingTickets = await tickets.find({ drawId, status: 'pending' }).toArray();
  let totalSettled = 0;

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
      await users.updateOne(
        { telegramId: ticket.telegramId },
        { $inc: { balance: totalPrize, totalWins: 1 } }
      );
      const timeStr = drawId.split('-').slice(-1)[0];
      const gameName = drawId.startsWith('flash') ? '⚡ Flash Lotto' : '🎰 Lotto Activo';
      await notifyUser(
        ticket.telegramId,
        `🎉 *¡GANASTE!* — ${gameName} ${timeStr.slice(0,2)}:${timeStr.slice(2,4)}\n\n` +
        `🐾 Salió: *${winnerAnimal}* \\#${winnerNumber}\n` +
        `💰 Premio: *+${totalPrize.toLocaleString()} 🥬*\n\n` +
        `¡Felicidades! 🏆`
      );
    }
    totalSettled++;
  }

  await db.collection('draw_limits').deleteMany({ drawId });
  return totalSettled;
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════
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
  const tickets = db.collection('tickets');
  const withdrawals = db.collection('withdrawals');
  const drawResults = db.collection('draw_results');
  const drawLimits = db.collection('draw_limits');
  const flashResults = db.collection('flash_results');

  const body = req.body || {};
  const { telegramId, username, action } = body;

  if (!telegramId) return res.status(400).json({ error: 'telegramId requerido' });
  const tid = String(telegramId);

  try {
    // ══════════════════════════════════════════════════════
    // CARGAR o CREAR USUARIO
    // ══════════════════════════════════════════════════════
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
          tonWalletAddress: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await users.insertOne(newUser);
        await notify(`🆕 Nuevo usuario: @${username || 'sin\\_username'} (ID: ${tid})`);
        return res.status(200).json({ success: true, user: newUser, isNew: true });
      }
      return res.status(200).json({ success: true, user });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER WALLET DEL ADMIN
    // ══════════════════════════════════════════════════════
    if (action === 'getAdminWallet') {
      const wallet = process.env.ADMIN_TON_WALLET || 'No configurada';
      return res.status(200).json({ success: true, wallet });
    }

    // ══════════════════════════════════════════════════════
    // GUARDAR TON WALLET DEL USUARIO (desde TON Connect)
    // ══════════════════════════════════════════════════════
    if (action === 'saveTonWallet') {
      const { tonAddress } = body;
      if (!tonAddress) return res.status(400).json({ error: 'tonAddress requerido' });

      await users.updateOne(
        { telegramId: tid },
        { $set: { tonWalletAddress: tonAddress, updatedAt: new Date() } }
      );
      return res.status(200).json({ success: true, message: 'Wallet TON guardada' });
    }

    // ══════════════════════════════════════════════════════
    // DEPÓSITO TON — confirmar transacción
    // ══════════════════════════════════════════════════════
    if (action === 'confirmDeposit') {
      const { txHash, tonAmount, lechugas } = body;
      if (!txHash || !tonAmount || !lechugas) {
        return res.status(400).json({ error: 'txHash, tonAmount y lechugas requeridos' });
      }

      // Verificar que no se haya procesado ya
      const existing = await users.findOne({ 'deposits.txHash': txHash });
      if (existing) {
        return res.status(400).json({ error: 'Esta transacción ya fue procesada' });
      }

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const newBalance = (user.balance || 0) + Number(lechugas);
      await users.updateOne(
        { telegramId: tid },
        {
          $set: { balance: newBalance, updatedAt: new Date() },
          $push: {
            deposits: {
              txHash,
              tonAmount: Number(tonAmount),
              lechugas: Number(lechugas),
              createdAt: new Date(),
              status: 'confirmed',
            }
          }
        }
      );

      await notify(
        `💰 *Depósito confirmado*\n` +
        `👤 @${username || tid}\n` +
        `💎 ${tonAmount} TON → +${Number(lechugas).toLocaleString()} 🥬\n` +
        `🔗 TX: \`${txHash.slice(0,16)}...\``
      );

      return res.status(200).json({ success: true, newBalance });
    }

    // ══════════════════════════════════════════════════════
    // COMPLETAR TAREA
    // ══════════════════════════════════════════════════════
    if (action === 'task') {
      const { taskId, reward } = body;
      if (!taskId || !reward) return res.status(400).json({ error: 'taskId y reward requeridos' });

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (taskId === 'daily') {
        const last = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
        const now = new Date();
        if (last && (now - last) < 24 * 60 * 60 * 1000) {
          const remaining = Math.ceil((24 * 60 * 60 * 1000 - (now - last)) / (60 * 60 * 1000));
          return res.status(400).json({ error: `Bono disponible en ${remaining}h` });
        }
        const newBalance = (user.balance || 0) + Number(reward);
        await users.updateOne(
          { telegramId: tid },
          { $set: { balance: newBalance, lastDailyBonus: new Date(), updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true, newBalance });
      }

      if (user.completedTasks?.includes(taskId)) {
        return res.status(400).json({ error: 'Tarea ya completada' });
      }

      const newBalance = (user.balance || 0) + Number(reward);
      await users.updateOne(
        { telegramId: tid },
        {
          $set: { balance: newBalance, updatedAt: new Date() },
          $addToSet: { completedTasks: taskId },
        }
      );
      return res.status(200).json({ success: true, newBalance });
    }

    // ══════════════════════════════════════════════════════
    // GUARDAR WALLET (dirección manual)
    // ══════════════════════════════════════════════════════
    if (action === 'wallet') {
      const { walletAddress } = body;
      if (!walletAddress) return res.status(400).json({ error: 'walletAddress requerido' });
      await users.updateOne(
        { telegramId: tid },
        { $set: { walletAddress: walletAddress.trim(), updatedAt: new Date() } }
      );
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════
    // SOLICITAR RETIRO
    // ══════════════════════════════════════════════════════
    if (action === 'withdraw') {
      const { withdrawAmount, walletAddress } = body;
      if (!withdrawAmount || !walletAddress) {
        return res.status(400).json({ error: 'withdrawAmount y walletAddress requeridos' });
      }

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const lechugas = Math.round(withdrawAmount * 1000);
      if (user.balance < lechugas) {
        return res.status(400).json({ error: 'Saldo insuficiente' });
      }

      const newBalance = user.balance - lechugas;
      const withdrawId = `W${Date.now()}`;

      await users.updateOne(
        { telegramId: tid },
        { $set: { balance: newBalance, updatedAt: new Date() } }
      );

      await withdrawals.insertOne({
        withdrawId,
        telegramId: tid,
        username: username || 'usuario',
        tonAmount: withdrawAmount,
        lechugas,
        walletAddress: walletAddress.trim(),
        status: 'pending',
        createdAt: new Date(),
      });

      await notify(
        `💸 *Solicitud de retiro*\n` +
        `👤 @${username || tid}\n` +
        `💎 ${withdrawAmount} TON\n` +
        `👛 \`${walletAddress.trim()}\`\n` +
        `🆔 ${withdrawId}`
      );

      return res.status(200).json({ success: true, newBalance, withdrawId });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER SORTEOS (LOTTO o FLASH) — con soporte de días
    // ══════════════════════════════════════════════════════
    if (action === 'getDraws') {
      const { game, date } = body;
      const now = vzNow();
      const todayStr = vzDateStr(now);
      const targetDate = date || todayStr;

      let draws = [];

      if (game === 'flash') {
        draws = generateFlashDraws(targetDate);
        
        // Enriquecer con resultados de la BD
        const existingResults = await flashResults.find({ date: targetDate }).toArray();
        const resultsMap = {};
        for (const r of existingResults) {
          resultsMap[r.drawId] = r;
        }

        draws = draws.map(d => {
          const result = resultsMap[d.drawId];
          if (result) {
            return {
              ...d,
              status: 'done',
              winnerNumber: result.winnerNumber,
              winnerAnimal: result.winnerAnimal,
            };
          }
          // Si ya pasó el tiempo pero no hay resultado, generar automáticamente
          if (d.status === 'drawing' || (d.status === 'upcoming' && new Date() > new Date(d.resultTime))) {
            return { ...d, status: 'done' };
          }
          return d;
        });

        // Mostrar solo los últimos 12 sorteos pasados + los próximos 6
        const pastDraws = draws.filter(d => d.status === 'done').slice(-12);
        const activeDraws = draws.filter(d => ['open','closed','drawing'].includes(d.status));
        const upcomingDraws = draws.filter(d => d.status === 'upcoming').slice(0, 6);
        draws = [...pastDraws, ...activeDraws, ...upcomingDraws];

      } else {
        // Lotto Activo
        draws = generateLottoDraws(targetDate);

        // Enriquecer con resultados de la BD
        const existingResults = await drawResults.find({ date: targetDate, game: { $ne: 'flash' } }).toArray();
        const resultsMap = {};
        for (const r of existingResults) {
          resultsMap[r.drawId] = r;
        }

        draws = draws.map(d => {
          const result = resultsMap[d.drawId];
          if (result) {
            return {
              ...d,
              status: 'done',
              winnerNumber: result.winnerNumber,
              winnerAnimal: result.winnerAnimal,
            };
          }
          return d;
        });
      }

      return res.status(200).json({ success: true, draws, date: targetDate });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER SEMANA PASADA — resultados históricos
    // ══════════════════════════════════════════════════════
    if (action === 'getWeekHistory') {
      const { game } = body;
      const now = vzNow();
      const results = [];

      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = vzDateStr(d);

        if (game === 'flash') {
          const dayResults = await flashResults.find({ date: dateStr }).sort({ drawId: 1 }).toArray();
          results.push({ date: dateStr, results: dayResults });
        } else {
          const dayResults = await drawResults.find({ date: dateStr, game: { $ne: 'flash' } }).sort({ drawId: 1 }).toArray();
          results.push({ date: dateStr, results: dayResults });
        }
      }

      return res.status(200).json({ success: true, history: results });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER LÍMITES DE UN SORTEO
    // ══════════════════════════════════════════════════════
    if (action === 'getDrawLimits') {
      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });

      const limits = await drawLimits.find({ drawId }).toArray();
      const limitsMap = {};
      for (const l of limits) {
        limitsMap[l.animal] = {
          total: l.totalBet || 0,
          remaining: Math.max(0, BET_CONFIG.maxBetGlobal - (l.totalBet || 0)),
          isFull: (l.totalBet || 0) >= BET_CONFIG.maxBetGlobal,
        };
      }
      return res.status(200).json({ success: true, limits: limitsMap });
    }

    // ══════════════════════════════════════════════════════
    // COLOCAR APUESTA
    // ══════════════════════════════════════════════════════
    if (action === 'placeBet') {
      const { drawId, drawGame, bets } = body;
      if (!drawId || !bets?.length) {
        return res.status(400).json({ error: 'drawId y bets requeridos' });
      }

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const now = new Date();
      const totalBet = bets.reduce((s, b) => s + Number(b.amount), 0);

      // Verificar estado del sorteo
      const isFlash = drawGame === 'flash';
      let drawStatusOk = false;

      if (isFlash) {
        // Para flash: extraer hora del drawId y verificar tiempo
        const parts = drawId.split('-');
        const timeStr = parts[parts.length - 1];
        const h = parseInt(timeStr.slice(0, 2));
        const m = parseInt(timeStr.slice(2, 4));
        const dateStr = parts.slice(1, 4).join('-');
        const drawTime = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        const drawTimeUTC = new Date(drawTime.getTime() + 4 * 60 * 60 * 1000);
        const closeTimeUTC = new Date(drawTimeUTC.getTime() - 2 * 60 * 1000);
        drawStatusOk = now < closeTimeUTC;
      } else {
        // Para lotto: extraer hora y verificar
        const parts = drawId.split('-');
        const timeStr = parts[parts.length - 1];
        const h = parseInt(timeStr.slice(0, 2));
        const m = parseInt(timeStr.slice(2, 4));
        const dateStr = parts.slice(1, 4).join('-');
        const drawTime = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        const drawTimeUTC = new Date(drawTime.getTime() + 4 * 60 * 60 * 1000);
        const closeTimeUTC = new Date(drawTimeUTC.getTime() - 10 * 60 * 1000);
        drawStatusOk = now < closeTimeUTC;
      }

      if (!drawStatusOk) {
        return res.status(400).json({ error: 'Las apuestas para este sorteo están cerradas' });
      }

      if (user.balance < totalBet) {
        return res.status(400).json({ error: 'Saldo insuficiente' });
      }

      // Validar montos
      for (const bet of bets) {
        if (bet.amount < BET_CONFIG.minBet) {
          return res.status(400).json({ error: `Monto mínimo por animal: ${BET_CONFIG.minBet} 🥬` });
        }
        if (bet.amount > BET_CONFIG.maxBetPerUser) {
          return res.status(400).json({ error: `Monto máximo por animal: ${BET_CONFIG.maxBetPerUser} 🥬` });
        }

        // Verificar límites globales
        const limitDoc = await drawLimits.findOne({ drawId, animal: bet.animal });
        const currentTotal = limitDoc?.totalBet || 0;
        if (currentTotal + bet.amount > BET_CONFIG.maxBetGlobal) {
          return res.status(400).json({ error: `Límite global alcanzado para ${bet.animal}` });
        }

        await drawLimits.updateOne(
          { drawId, animal: bet.animal },
          { $inc: { totalBet: bet.amount } },
          { upsert: true }
        );
      }

      const newBalance = user.balance - totalBet;
      const ticketId = `T${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const ticket = {
        ticketId,
        telegramId: tid,
        username: username || 'usuario',
        drawId,
        drawGame: drawGame || 'lotto',
        bets: bets.map(b => ({
          animal: b.animal,
          number: b.number,
          amount: Number(b.amount),
          won: null,
          prize: null,
          status: 'pending',
        })),
        totalBet,
        betsCount: bets.length,
        status: 'pending',
        totalPrize: 0,
        createdAt: new Date(),
      };

      await tickets.insertOne(ticket);
      await users.updateOne(
        { telegramId: tid },
        { $set: { balance: newBalance, updatedAt: new Date() }, $inc: { totalBets: 1 } }
      );

      return res.status(200).json({ success: true, ticket, newBalance });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER MIS TICKETS
    // ══════════════════════════════════════════════════════
    if (action === 'getTickets') {
      const { game } = body;
      const query = { telegramId: tid };
      if (game) query.drawGame = game;

      const myTickets = await tickets
        .find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json({ success: true, tickets: myTickets });
    }

    // ══════════════════════════════════════════════════════
    // RESOLVER FLASH LOTTO — generar resultado aleatorio
    // ══════════════════════════════════════════════════════
    if (action === 'resolveFlash') {
      const cronKey = process.env.CRON_SECRET;
      if (body.cronKey !== cronKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });

      // Verificar que no se haya resuelto ya
      const existing = await flashResults.findOne({ drawId });
      if (existing) {
        return res.status(200).json({ success: true, already: true, result: existing });
      }

      // Generar resultado aleatorio
      const winnerNumber = Math.floor(Math.random() * 37); // 0-36
      const winnerAnimal = ANIMALS_MAP[winnerNumber];
      const parts = drawId.split('-');
      const dateStr = parts.slice(1, 4).join('-');

      const result = {
        drawId,
        game: 'flash',
        date: dateStr,
        winnerNumber,
        winnerAnimal,
        resolvedAt: new Date(),
        method: 'random',
      };

      await flashResults.insertOne(result);

      // Pagar ganadores
      const settled = await settleDrawBets(db, drawId, winnerNumber, winnerAnimal);

      await notify(
        `⚡ *Flash Lotto* — ${drawId}\n` +
        `🐾 Ganador: *${winnerAnimal}* \\#${winnerNumber}\n` +
        `🎫 Tickets resueltos: ${settled}`
      );

      return res.status(200).json({ success: true, result, settled });
    }

    // ══════════════════════════════════════════════════════
    // SCRAPE RESULTADOS LOTTO ACTIVO
    // ══════════════════════════════════════════════════════
    if (action === 'scrapeResults') {
      const cronKey = process.env.CRON_SECRET;
      if (body.cronKey !== cronKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { targetHour, targetGame } = body;
      const now = vzNow();
      const dateStr = vzDateStr(now);
      const hour = targetHour ?? now.getHours();

      const drawId = `lotto-${dateStr}-${String(hour).padStart(2,'0')}00`;

      // Verificar si ya existe resultado
      const existing = await drawResults.findOne({ drawId });
      if (existing) {
        return res.status(200).json({ success: true, already: true, results: { lotto: existing } });
      }

      // Intentar scrape de resultados oficiales
      let winnerNumber = null;
      let winnerAnimal = null;

      try {
        const resp = await fetch('https://animalitos.net/resultados', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const html = await resp.text();
          // Buscar patrón de número en resultados (simplificado)
          const match = html.match(/(\d{1,2})\s*[-–]\s*([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)/);
          if (match) {
            const num = parseInt(match[1]);
            if (num >= 0 && num <= 36 && ANIMALS_MAP[num]) {
              winnerNumber = num;
              winnerAnimal = ANIMALS_MAP[num];
            }
          }
        }
      } catch {
        // Si falla el scrape, no guardar resultado para que el admin lo ingrese manualmente
      }

      if (winnerNumber === null) {
        return res.status(200).json({
          success: false,
          message: 'No se pudo obtener resultado. Ingresarlo manualmente.',
          drawId,
        });
      }

      const result = {
        drawId,
        game: targetGame || 'lotto',
        date: dateStr,
        winnerNumber,
        winnerAnimal,
        resolvedAt: new Date(),
        method: 'scrape',
      };

      await drawResults.insertOne(result);
      const settled = await settleDrawBets(db, drawId, winnerNumber, winnerAnimal);

      return res.status(200).json({
        success: true,
        results: { lotto: result },
        settled,
      });
    }

    // ══════════════════════════════════════════════════════
    // ADMIN — Ingresar resultado manualmente
    // ══════════════════════════════════════════════════════
    if (action === 'adminSetResult') {
      const adminKey = process.env.ADMIN_SECRET_KEY;
      if (body.adminKey !== adminKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { drawId, winnerNumber, game } = body;
      if (!drawId || winnerNumber === undefined) {
        return res.status(400).json({ error: 'drawId y winnerNumber requeridos' });
      }

      const num = parseInt(winnerNumber);
      if (isNaN(num) || num < 0 || num > 36) {
        return res.status(400).json({ error: 'winnerNumber debe ser 0-36' });
      }

      const winnerAnimal = ANIMALS_MAP[num];
      const parts = drawId.split('-');
      const dateStr = parts.slice(1, 4).join('-');

      const isFlash = game === 'flash' || drawId.startsWith('flash');
      const collection = isFlash ? flashResults : drawResults;

      const existing = await collection.findOne({ drawId });
      if (existing) {
        return res.status(400).json({ error: 'Este sorteo ya tiene resultado' });
      }

      const result = {
        drawId,
        game: game || 'lotto',
        date: dateStr,
        winnerNumber: num,
        winnerAnimal,
        resolvedAt: new Date(),
        method: 'manual',
      };

      await collection.insertOne(result);
      const settled = await settleDrawBets(db, drawId, num, winnerAnimal);

      await notify(
        `✅ *Resultado manual ingresado*\n` +
        `🎮 Sorteo: ${drawId}\n` +
        `🐾 Ganador: *${winnerAnimal}* \\#${num}\n` +
        `🎫 Tickets resueltos: ${settled}`
      );

      return res.status(200).json({ success: true, result, settled });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
