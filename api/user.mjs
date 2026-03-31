// api/user.mjs — Animalito Lotto Backend
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
  if (!token || !telegramId || telegramId.startsWith('test_')) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'Markdown' }),
    });
  } catch { /* ignorar */ }
}

const BET_CONFIG = { minBet: 50, maxBetPerUser: 1000, maxBetGlobal: 10000, multiplier: 30 };

function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}

function vzDateStr(d) {
  const vz = d || vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth()+1).padStart(2,'0')}-${String(vz.getDate()).padStart(2,'0')}`;
}

const ANIMALS_MAP = {
  1:'Carnero',2:'Toro',3:'Ciempiés',4:'Alacrán',5:'León',6:'Rana',7:'Perico',
  8:'Ratón',9:'Águila',10:'Tigre',11:'Gato',12:'Caballo',13:'Mono',14:'Paloma',
  15:'Zorro',16:'Oso',17:'Pavo',18:'Burro',19:'Chivo',20:'Cochino',21:'Gallo',
  22:'Camello',23:'Zebra',24:'Iguana',25:'Gavilán',26:'Murciélago',27:'Perro',
  28:'Venado',29:'Morrocoy',30:'Caimán',31:'Anteater',32:'Serpiente',33:'Lechuza',
  34:'Loro',35:'Jirafa',36:'Culebra',0:'Ballena',
};

// Sorteos oficiales de Lotto Activo
function getLottoDraw(hour, dateStr) {
  const drawTimes = [8,9,10,11,12,13,14,15,16,17,18,19];
  if (!drawTimes.includes(hour)) return null;
  const hh = String(hour).padStart(2,'0');
  return {
    drawId: `lotto-${dateStr}-${hh}`,
    game: 'lotto',
    time: `${hh}:00 AM`.replace('AM', hour < 12 ? 'AM' : 'PM').replace(/(\d+):00 [AP]M/, (_, h) => {
      const n = parseInt(h);
      const suffix = n < 12 ? 'AM' : 'PM';
      const display = n > 12 ? n - 12 : n;
      return `${display < 10 ? '0' : ''}${display}:00 ${suffix}`;
    }),
    date: dateStr,
    status: 'pending',
    closeTime: new Date(`${dateStr}T${hh}:00:00-04:00`).toISOString(),
    drawTime: new Date(`${dateStr}T${hh}:05:00-04:00`).toISOString(),
    resultTime: new Date(`${dateStr}T${hh}:10:00-04:00`).toISOString(),
  };
}

// Generar todos los sorteos de lotto para una fecha
function getLottoDrawsForDate(dateStr) {
  const draws = [];
  const drawHours = [8,9,10,11,12,13,14,15,16,17,18,19];
  for (const hour of drawHours) {
    const hh = String(hour).padStart(2,'0');
    const n = hour > 12 ? hour - 12 : hour;
    const suffix = hour < 12 ? 'AM' : 'PM';
    const timeStr = `${String(n).padStart(2,'0')}:00 ${suffix}`;
    draws.push({
      drawId: `lotto-${dateStr}-${hh}`,
      game: 'lotto',
      time: timeStr,
      date: dateStr,
      status: 'pending',
      closeTime: new Date(`${dateStr}T${hh}:00:00-04:00`).toISOString(),
      drawTime: new Date(`${dateStr}T${hh}:05:00-04:00`).toISOString(),
      resultTime: new Date(`${dateStr}T${hh}:10:00-04:00`).toISOString(),
    });
  }
  return draws;
}

// Generar sorteos Flash para hoy (cada 5 min de 08:00 a 20:00)
function getFlashDrawsForDate(dateStr) {
  const draws = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let min = 0; min < 60; min += 5) {
      const hh = String(hour).padStart(2,'0');
      const mm = String(min).padStart(2,'0');
      const n = hour > 12 ? hour - 12 : hour;
      const suffix = hour < 12 ? 'AM' : 'PM';
      const drawId = `flash-${dateStr}-${hh}${mm}`;
      const closeISO = new Date(`${dateStr}T${hh}:${mm}:00-04:00`).toISOString();
      const drawISO = new Date(`${dateStr}T${hh}:${String(min+2).padStart(2,'0')}:00-04:00`).toISOString();
      draws.push({
        drawId,
        game: 'flash',
        time: `${String(n).padStart(2,'0')}:${mm} ${suffix}`,
        date: dateStr,
        status: 'pending',
        closeTime: closeISO,
        drawTime: drawISO,
        resultTime: drawISO,
      });
    }
  }
  return draws;
}

// Código de referido aleatorio
function genRefCode(telegramId) {
  return 'REF' + telegramId.slice(-4).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
  }

  const { action, telegramId, username } = body || {};
  if (!action) return res.status(400).json({ error: 'Falta action' });

  let client, db;
  try {
    client = await getClient();
    db = client.db('animalito_db');
  } catch (err) {
    return res.status(500).json({ error: 'Error DB: ' + err.message });
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: load — Cargar o crear usuario
  // ══════════════════════════════════════════════════════════════
  if (action === 'load') {
    try {
      const { refCode } = body;
      const users = db.collection('users');
      let user = await users.findOne({ telegramId });
      let isNew = false;

      if (!user) {
        isNew = true;
        const myRefCode = genRefCode(telegramId);
        let referredBy = null;

        // Procesar referido
        if (refCode && refCode.startsWith('REF')) {
          const referrer = await users.findOne({ referralCode: refCode });
          if (referrer && referrer.telegramId !== telegramId) {
            referredBy = referrer.telegramId;
            // Bonus para el invitador
            await users.updateOne(
              { telegramId: referrer.telegramId },
              { $inc: { balance: 500, referralCount: 1 } }
            );
            await notifyUser(referrer.telegramId,
              `🎉 *¡Nuevo referido!* ${username || 'Alguien'} se unió con tu link.\n+500 🥬 acreditados!`);
          }
        }

        user = {
          telegramId,
          username: username || 'Usuario',
          balance: 1000 + (refCode && refCode.startsWith('REF') ? 200 : 0), // +200 si vino referido
          completedTasks: [],
          lastDailyBonus: null,
          walletAddress: null,
          tonWalletAddress: null,
          referralCode: myRefCode,
          referredBy,
          referralCount: 0,
          referralEarnings: 0,
          pendingReferralBonus: 0,
          createdAt: new Date().toISOString(),
        };
        await users.insertOne(user);
        await notify(`🆕 Nuevo usuario: *${username}* (${telegramId})`);
      } else {
        // Actualizar username si cambió
        if (username && user.username !== username) {
          await users.updateOne({ telegramId }, { $set: { username } });
          user.username = username;
        }
        // Asegurar que tenga referralCode
        if (!user.referralCode) {
          const myRefCode = genRefCode(telegramId);
          await users.updateOne({ telegramId }, { $set: { referralCode: myRefCode } });
          user.referralCode = myRefCode;
        }
      }

      return res.status(200).json({ success: true, user, isNew });
    } catch (err) {
      return res.status(500).json({ error: 'Error load: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: getDraws — Obtener sorteos por fecha y juego
  // ══════════════════════════════════════════════════════════════
  if (action === 'getDraws') {
    try {
      const { date, game } = body;
      const targetDate = date || vzDateStr();
      const gameType = game || 'lotto';

      const drawResults = db.collection('draw_results');

      if (gameType === 'flash') {
        // Generar todos los slots Flash del día
        const allFlash = getFlashDrawsForDate(targetDate);
        // Buscar resultados ya resueltos
        const resolved = await drawResults.find({
          date: targetDate, game: 'flash'
        }).toArray();
        const resolvedMap = {};
        resolved.forEach(r => { resolvedMap[r.drawId] = r; });

        // Marcar estado de cada sorteo
        const nowISO = new Date().toISOString();
        const draws = allFlash.map(d => {
          if (resolvedMap[d.drawId]) {
            return {
              ...d,
              status: 'finished',
              winnerNumber: resolvedMap[d.drawId].winnerNumber,
              winnerAnimal: resolvedMap[d.drawId].winnerAnimal,
            };
          }
          if (d.closeTime < nowISO) return { ...d, status: 'closed' };
          return d;
        });

        return res.status(200).json({ success: true, draws, date: targetDate });
      }

      // Lotto normal
      const allLotto = getLottoDrawsForDate(targetDate);
      const resolved = await drawResults.find({
        date: targetDate, game: { $ne: 'flash' }
      }).toArray();
      const resolvedMap = {};
      resolved.forEach(r => { resolvedMap[r.drawId] = r; });

      const nowISO = new Date().toISOString();
      const draws = allLotto.map(d => {
        if (resolvedMap[d.drawId]) {
          return {
            ...d,
            status: 'finished',
            winnerNumber: resolvedMap[d.drawId].winnerNumber,
            winnerAnimal: resolvedMap[d.drawId].winnerAnimal,
          };
        }
        if (d.closeTime < nowISO) return { ...d, status: 'closed' };
        return d;
      });

      return res.status(200).json({ success: true, draws, date: targetDate });
    } catch (err) {
      return res.status(500).json({ error: 'Error getDraws: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: getWeekResults — Últimos 7 días de resultados
  // ══════════════════════════════════════════════════════════════
  if (action === 'getWeekResults') {
    try {
      const { game } = body;
      const gameType = game || 'lotto';
      const drawResults = db.collection('draw_results');
      const days = [];
      const now = vzNow();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push(vzDateStr(d));
      }

      const results = await drawResults.find({
        date: { $in: days },
        game: gameType === 'flash' ? 'flash' : { $ne: 'flash' },
      }).sort({ date: 1, time: 1 }).toArray();

      const byDay = {};
      days.forEach(d => { byDay[d] = []; });
      results.forEach(r => {
        if (byDay[r.date]) {
          byDay[r.date].push({
            drawId: r.drawId,
            winnerNumber: r.winnerNumber,
            winnerAnimal: r.winnerAnimal,
            time: r.time,
          });
        }
      });

      const weekData = days.map(date => ({
        date,
        results: byDay[date],
      }));

      return res.status(200).json({ success: true, weekData });
    } catch (err) {
      return res.status(500).json({ error: 'Error getWeekResults: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: bet — Realizar apuesta
  // ══════════════════════════════════════════════════════════════
  if (action === 'bet') {
    try {
      const { drawId, drawGame, bets, date } = body;
      if (!drawId || !bets || !Array.isArray(bets) || bets.length === 0) {
        return res.status(400).json({ error: 'Datos de apuesta inválidos' });
      }

      // Verificar que el sorteo no esté cerrado
      const now = new Date();
      const gameType = drawGame || 'lotto';

      // Para lotto: verificar hora de cierre
      if (gameType === 'lotto') {
        const parts = drawId.split('-');
        const hourStr = parts[parts.length - 1];
        const drawHour = parseInt(hourStr, 10);
        const vzNowTime = vzNow();
        const vzDateTarget = parts.slice(1, 4).join('-');
        const todayVZ = vzDateStr(vzNowTime);

        if (vzDateTarget < todayVZ) {
          return res.status(400).json({ error: 'Este sorteo ya pasó' });
        }
        if (vzDateTarget === todayVZ && vzNowTime.getHours() >= drawHour) {
          return res.status(400).json({ error: 'Las apuestas para este sorteo ya están cerradas' });
        }
      }

      // Para flash: verificar que no esté cerrado
      if (gameType === 'flash') {
        // El drawId es flash-YYYY-MM-DD-HHmm
        const parts = drawId.split('-');
        const timeCode = parts[parts.length - 1]; // HHmm
        const dateCode = parts.slice(1, 4).join('-'); // YYYY-MM-DD
        const drawHour = parseInt(timeCode.slice(0, 2), 10);
        const drawMin = parseInt(timeCode.slice(2, 4), 10);
        const vzNowTime = vzNow();
        const todayVZ = vzDateStr(vzNowTime);

        if (dateCode < todayVZ) {
          return res.status(400).json({ error: 'Este sorteo Flash ya pasó' });
        }
        if (dateCode === todayVZ) {
          const nowMinutes = vzNowTime.getHours() * 60 + vzNowTime.getMinutes();
          const closeMinutes = drawHour * 60 + drawMin;
          if (nowMinutes >= closeMinutes) {
            return res.status(400).json({ error: 'Las apuestas para este Flash Lotto están cerradas' });
          }
        }
      }

      const users = db.collection('users');
      const tickets = db.collection('tickets');

      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const totalBet = bets.reduce((s, b) => s + (b.amount || 0), 0);
      if (totalBet < BET_CONFIG.minBet) {
        return res.status(400).json({ error: `Mínimo de apuesta: ${BET_CONFIG.minBet} 🥬` });
      }
      if (user.balance < totalBet) {
        return res.status(400).json({ error: 'Saldo insuficiente' });
      }

      // Validar montos individuales
      for (const b of bets) {
        if (!b.number && b.number !== 0) return res.status(400).json({ error: 'Número inválido en apuesta' });
        if (!b.amount || b.amount < 50) return res.status(400).json({ error: 'Monto mínimo 50 🥬 por animal' });
        if (b.amount > BET_CONFIG.maxBetPerUser) return res.status(400).json({ error: `Máximo ${BET_CONFIG.maxBetPerUser} 🥬 por animal` });
      }

      // Descontar saldo
      const newBalance = user.balance - totalBet;
      await users.updateOne({ telegramId }, { $set: { balance: newBalance } });

      // Comisión de referido (5%)
      if (user.referredBy) {
        const commission = Math.floor(totalBet * 0.05);
        if (commission > 0) {
          await users.updateOne(
            { telegramId: user.referredBy },
            { $inc: { referralEarnings: commission, balance: commission } }
          );
        }
      }

      // Crear ticket
      const ticketId = `TK-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      const ticket = {
        ticketId,
        telegramId,
        username: user.username,
        drawId,
        drawGame: gameType,
        date: date || vzDateStr(),
        bets: bets.map(b => ({
          number: b.number,
          animal: ANIMALS_MAP[b.number] || `Nº${b.number}`,
          amount: b.amount,
          won: null,
          prize: null,
          status: 'pending',
        })),
        totalBet,
        betsCount: bets.length,
        status: 'pending',
        totalPrize: 0,
        createdAt: new Date().toISOString(),
      };
      await tickets.insertOne(ticket);

      // Para Flash: auto-resolver cuando llegue la hora (se llama desde frontend)
      await notify(
        `🎫 *Nueva apuesta* (${gameType === 'flash' ? '⚡Flash' : '🎰Lotto'})\n` +
        `👤 ${user.username} | 💰 ${totalBet} 🥬\n` +
        `🎯 ${bets.map(b => `${ANIMALS_MAP[b.number]}(${b.amount})`).join(', ')}\n` +
        `🎲 Sorteo: ${drawId}`
      );

      return res.status(200).json({
        success: true,
        newBalance,
        ticketId,
        message: `✅ Apuesta registrada! Ticket: ${ticketId}`,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error bet: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: resolveFlash — Resolver un sorteo Flash (llamado desde frontend)
  // ══════════════════════════════════════════════════════════════
  if (action === 'resolveFlash') {
    try {
      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'Falta drawId' });

      const drawResults = db.collection('draw_results');
      const tickets = db.collection('tickets');
      const users = db.collection('users');

      // Verificar si ya está resuelto
      const existing = await drawResults.findOne({ drawId });
      if (existing) {
        return res.status(200).json({
          success: true,
          alreadyResolved: true,
          winnerNumber: existing.winnerNumber,
          winnerAnimal: existing.winnerAnimal,
        });
      }

      // Verificar que la hora ya pasó
      const parts = drawId.split('-');
      const timeCode = parts[parts.length - 1];
      const dateCode = parts.slice(1, 4).join('-');
      const drawHour = parseInt(timeCode.slice(0, 2), 10);
      const drawMin = parseInt(timeCode.slice(2, 4), 10);
      const vzNowTime = vzNow();
      const todayVZ = vzDateStr(vzNowTime);

      if (dateCode === todayVZ) {
        const nowMinutes = vzNowTime.getHours() * 60 + vzNowTime.getMinutes();
        const closeMinutes = drawHour * 60 + drawMin;
        if (nowMinutes < closeMinutes + 2) {
          return res.status(200).json({ success: false, message: 'Sorteo aún no cerrado' });
        }
      }

      // Resultado aleatorio
      const animalNumbers = Object.keys(ANIMALS_MAP).map(Number);
      const winnerNumber = animalNumbers[Math.floor(Math.random() * animalNumbers.length)];
      const winnerAnimal = ANIMALS_MAP[winnerNumber];
      const timeStr = `${String(drawHour > 12 ? drawHour - 12 : drawHour).padStart(2,'0')}:${String(drawMin).padStart(2,'0')} ${drawHour < 12 ? 'AM' : 'PM'}`;

      // Guardar resultado
      await drawResults.insertOne({
        drawId, date: dateCode, game: 'flash', time: timeStr,
        winnerNumber, winnerAnimal,
        resolvedAt: new Date().toISOString(),
      });

      // Resolver tickets
      const pendingTickets = await tickets.find({ drawId, status: 'pending' }).toArray();
      let totalWinners = 0;

      for (const ticket of pendingTickets) {
        let totalPrize = 0;
        const updatedBets = ticket.bets.map(b => {
          const won = b.number === winnerNumber;
          const prize = won ? b.amount * BET_CONFIG.multiplier : 0;
          totalPrize += prize;
          return { ...b, won, prize, status: 'resolved' };
        });

        await tickets.updateOne(
          { ticketId: ticket.ticketId },
          { $set: { bets: updatedBets, totalPrize, status: 'resolved' } }
        );

        if (totalPrize > 0) {
          totalWinners++;
          await users.updateOne(
            { telegramId: ticket.telegramId },
            { $inc: { balance: totalPrize } }
          );
          await notifyUser(ticket.telegramId,
            `⚡ *Flash Lotto ${timeStr}*\n🎉 ¡GANASTE! +${totalPrize} 🥬\nAnimal: ${winnerAnimal} (${winnerNumber})`
          );
        } else {
          await notifyUser(ticket.telegramId,
            `⚡ *Flash Lotto ${timeStr}*\nResultado: ${winnerAnimal} (${winnerNumber})\nNo ganaste esta vez 💪`
          );
        }
      }

      await notify(
        `⚡ *Flash Lotto resuelto*\n🎲 ${drawId}\n🏆 Ganador: ${winnerAnimal} (${winnerNumber})\n` +
        `🎫 Tickets: ${pendingTickets.length} | Ganadores: ${totalWinners}`
      );

      return res.status(200).json({
        success: true, drawId, winnerNumber, winnerAnimal,
        ticketsResolved: pendingTickets.length, winners: totalWinners,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error resolveFlash: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: getTickets — Tickets del usuario
  // ══════════════════════════════════════════════════════════════
  if (action === 'getTickets') {
    try {
      const { limit: lim } = body;
      const tickets = db.collection('tickets');
      const myTickets = await tickets
        .find({ telegramId })
        .sort({ createdAt: -1 })
        .limit(lim || 20)
        .toArray();
      return res.status(200).json({ success: true, tickets: myTickets });
    } catch (err) {
      return res.status(500).json({ error: 'Error getTickets: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: dailyBonus — Bono diario
  // ══════════════════════════════════════════════════════════════
  if (action === 'dailyBonus') {
    try {
      const users = db.collection('users');
      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const today = vzDateStr();
      if (user.lastDailyBonus === today) {
        return res.status(400).json({ error: 'Ya reclamaste el bono de hoy. Vuelve mañana 🌅' });
      }

      const bonus = 100;
      const newBalance = user.balance + bonus;
      await users.updateOne({ telegramId }, {
        $set: { lastDailyBonus: today, balance: newBalance }
      });

      return res.status(200).json({ success: true, newBalance, bonus });
    } catch (err) {
      return res.status(500).json({ error: 'Error dailyBonus: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: completeTask — Completar tarea
  // ══════════════════════════════════════════════════════════════
  if (action === 'completeTask') {
    try {
      const { taskId, reward } = body;
      const users = db.collection('users');
      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (user.completedTasks?.includes(taskId)) {
        return res.status(400).json({ error: 'Tarea ya completada' });
      }

      const newBalance = user.balance + (reward || 0);
      await users.updateOne({ telegramId }, {
        $set: { balance: newBalance },
        $push: { completedTasks: taskId },
      });

      return res.status(200).json({ success: true, newBalance });
    } catch (err) {
      return res.status(500).json({ error: 'Error completeTask: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: deposit — Registrar depósito TON
  // ══════════════════════════════════════════════════════════════
  if (action === 'deposit') {
    try {
      const { amount, tonAmount, txHash, walletAddress } = body;
      const users = db.collection('users');
      const transactions = db.collection('transactions');

      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Verificar que no sea tx duplicada
      if (txHash) {
        const existing = await transactions.findOne({ txHash });
        if (existing) return res.status(400).json({ error: 'Transacción ya procesada' });
      }

      const leafAmount = amount || Math.floor((tonAmount || 0) * 1000);
      const newBalance = user.balance + leafAmount;

      await users.updateOne({ telegramId }, {
        $set: { balance: newBalance, tonWalletAddress: walletAddress || user.tonWalletAddress }
      });

      await transactions.insertOne({
        telegramId, type: 'deposit',
        tonAmount: tonAmount || 0,
        leafAmount, txHash,
        walletAddress,
        createdAt: new Date().toISOString(),
      });

      await notify(
        `💰 *Depósito TON*\n👤 ${user.username}\n` +
        `💎 ${tonAmount || 0} TON → ${leafAmount} 🥬\n` +
        `🔗 ${txHash || 'sin hash'}`
      );

      return res.status(200).json({ success: true, newBalance, leafAmount });
    } catch (err) {
      return res.status(500).json({ error: 'Error deposit: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: withdraw — Solicitar retiro
  // ══════════════════════════════════════════════════════════════
  if (action === 'withdraw') {
    try {
      const { leafAmount, walletAddress } = body;
      const users = db.collection('users');
      const withdrawals = db.collection('withdrawals');

      if (!walletAddress) return res.status(400).json({ error: 'Falta dirección de wallet' });
      if (!leafAmount || leafAmount < 1000) return res.status(400).json({ error: 'Mínimo de retiro: 1,000 🥬' });

      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (user.balance < leafAmount) return res.status(400).json({ error: 'Saldo insuficiente' });

      const tonAmount = leafAmount / 1000;
      const newBalance = user.balance - leafAmount;

      await users.updateOne({ telegramId }, { $set: { balance: newBalance } });
      await withdrawals.insertOne({
        telegramId, username: user.username,
        leafAmount, tonAmount, walletAddress,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      await notify(
        `💸 *Solicitud de retiro*\n👤 ${user.username}\n` +
        `💎 ${leafAmount} 🥬 = ${tonAmount} TON\n` +
        `📬 ${walletAddress}`
      );

      return res.status(200).json({ success: true, newBalance, tonAmount });
    } catch (err) {
      return res.status(500).json({ error: 'Error withdraw: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: getReferrals — Info de referidos
  // ══════════════════════════════════════════════════════════════
  if (action === 'getReferrals') {
    try {
      const users = db.collection('users');
      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Obtener lista de referidos
      const referredUsers = await users
        .find({ referredBy: telegramId })
        .project({ username: 1, createdAt: 1, balance: 1 })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      return res.status(200).json({
        success: true,
        referralCode: user.referralCode || genRefCode(telegramId),
        referralCount: user.referralCount || 0,
        referralEarnings: user.referralEarnings || 0,
        pendingBonus: user.pendingReferralBonus || 0,
        referredUsers,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error getReferrals: ' + err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ACTION: claimReferralBonus — Reclamar bonus de referidos
  // ══════════════════════════════════════════════════════════════
  if (action === 'claimReferralBonus') {
    try {
      const users = db.collection('users');
      const user = await users.findOne({ telegramId });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const pending = user.pendingReferralBonus || 0;
      if (pending <= 0) return res.status(400).json({ error: 'No tienes bonus pendiente' });

      const newBalance = user.balance + pending;
      await users.updateOne({ telegramId }, {
        $set: { balance: newBalance, pendingReferralBonus: 0 }
      });

      return res.status(200).json({ success: true, newBalance, claimed: pending });
    } catch (err) {
      return res.status(500).json({ error: 'Error claimReferralBonus: ' + err.message });
    }
  }

  return res.status(400).json({ error: `Acción desconocida: ${action}` });
}
