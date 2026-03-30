// Api/user.mjs
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) {
    try { await cachedClient.db('admin').command({ ping: 1 }); return cachedClient; }
    catch { cachedClient = null; }
  }
  if (!uri) throw new Error('MONGODB_URI no configurado');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  await client.connect();
  cachedClient = client;
  return client;
}

// Notificar al ADMIN
async function notify(text) {
  const token  = process.env.BOT_TOKEN;
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
  minBet:        50,
  maxBetPerUser: 1000,
  maxBetGlobal:  10000,
  multiplier:    30,
};

// Hora Venezuela
function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}
function vzDateStr(d) {
  const vz = d || vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth()+1).padStart(2,'0')}-${String(vz.getDate()).padStart(2,'0')}`;
}

// 37 Animalitos
const ANIMALS_MAP = {
  1:'Carnero',2:'Toro',3:'Ciempiés',4:'Alacrán',5:'León',6:'Rana',7:'Perico',
  8:'Ratón',9:'Águila',10:'Tigre',11:'Gato',12:'Caballo',13:'Mono',14:'Paloma',
  15:'Zorro',16:'Oso',17:'Pavo',18:'Burro',19:'Chivo',20:'Cochino',21:'Gallo',
  22:'Camello',23:'Zebra',24:'Iguana',25:'Gavilán',26:'Murciélago',27:'Perro',
  28:'Venado',29:'Morrocoy',30:'Caimán',31:'Anteater',32:'Serpiente',33:'Lechuza',
  34:'Loro',35:'Jirafa',36:'Culebra',0:'Ballena',
};

// Horarios de sorteos
const DRAW_TIMES = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

function getDrawSlot(drawId) {
  const parts = drawId.split('-');
  const timeStr = parts[parts.length - 1];
  const hour = parseInt(timeStr.slice(0, 2));
  const min  = parseInt(timeStr.slice(2, 4));
  const now  = vzNow();
  const drawTime  = new Date(now); drawTime.setHours(hour, min, 0, 0);
  const closeTime = new Date(drawTime.getTime() - 10 * 60000);
  return { drawTime, closeTime };
}

// Pagar apuestas ganadoras de un sorteo
async function settleDrawBets(db, drawId, winnerNumber, winnerAnimal) {
  const transactions = db.collection('transactions');
  const tickets      = db.collection('tickets');
  const users        = db.collection('users');
  const drawLimits   = db.collection('draw_limits');

  const bets = await transactions.find({ drawId, type: 'bet', status: 'pending' }).toArray();
  for (const bet of bets) {
    const isWinner = bet.animal === winnerAnimal || bet.animalNumber === winnerNumber;
    const prize = isWinner ? bet.amount * BET_CONFIG.multiplier : 0;
    await transactions.updateOne(
      { _id: bet._id },
      { $set: { status: 'settled', won: isWinner, prize, winnerNumber, winnerAnimal, settledAt: new Date() } }
    );
    if (isWinner) {
      await users.updateOne({ telegramId: bet.telegramId }, { $inc: { balance: prize, totalWins: 1 } });
    }
  }

  // Actualizar tickets
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
      await notifyUser(ticket.telegramId,
        `🎉 *¡GANASTE!* — Sorteo ${drawId.split('-').slice(-1)[0].slice(0,2)}:${drawId.split('-').slice(-1)[0].slice(2,4)}\n\n` +
        `🐾 Salió: *${winnerAnimal}* \\#${winnerNumber}\n` +
        `💰 Premio: *+${totalPrize.toLocaleString()} 🥬*\n\n` +
        `¡Felicidades! 🏆 Ver tu ticket: ${ticket.ticketId}`
      );
    }
  }

  // Limpiar límites de ese sorteo (ya no los necesitamos)
  await drawLimits.deleteMany({ drawId });

  return bets.length;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI no configurado' });

  let client;
  try { client = await getClient(); }
  catch (err) { return res.status(500).json({ error: 'MongoDB: ' + err.message }); }

  const db           = client.db('animalito_db');
  const users        = db.collection('users');
  const transactions = db.collection('transactions');
  const tickets      = db.collection('tickets');
  const withdrawals  = db.collection('withdrawals');
  const drawResults  = db.collection('draw_results');
  const drawLimits   = db.collection('draw_limits');

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
          telegramId: tid, username: username || 'Usuario',
          balance: 1000, completedTasks: [], lastDailyBonus: null,
          totalBets: 0, totalWins: 0, walletAddress: null,
          createdAt: new Date(), updatedAt: new Date(),
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
        const now  = new Date();
        if (last && (now - last) < 24 * 60 * 60 * 1000) {
          const h = Math.ceil((24 * 60 * 60 * 1000 - (now - last)) / 3600000);
          return res.status(400).json({ error: `Bonus diario ya reclamado. Vuelve en ${h}h` });
        }
        await users.updateOne({ telegramId: tid },
          { $set: { lastDailyBonus: new Date(), updatedAt: new Date() }, $inc: { balance: reward } });
        return res.status(200).json({ success: true, newBalance: (user.balance || 0) + reward });
      }
      if (user.completedTasks?.includes(taskId))
        return res.status(400).json({ error: 'Tarea ya completada' });

      await users.updateOne({ telegramId: tid },
        { $addToSet: { completedTasks: taskId }, $inc: { balance: reward }, $set: { updatedAt: new Date() } });
      return res.status(200).json({ success: true, newBalance: (user.balance || 0) + reward });
    }

    // ══════════════════════════════════════════════════════════
    // OBTENER SORTEOS DEL DÍA
    // ══════════════════════════════════════════════════════════
    if (action === 'getDraws') {
      const game    = body.game || 'lotto';
      const now     = vzNow();
      const today   = vzDateStr(now);

      const draws = await Promise.all(DRAW_TIMES.map(async (time) => {
        const drawId = `${game}-${today}-${time.replace(':', '')}`;
        const [h, m] = time.split(':').map(Number);
        const drawTime  = new Date(now); drawTime.setHours(h, m, 0, 0);
        const closeTime = new Date(drawTime.getTime() - 10 * 60000);
        const resultTime= new Date(drawTime.getTime() + 5  * 60000);

        let status;
        if      (now < closeTime)  status = 'open';
        else if (now < drawTime)   status = 'closed';
        else if (now < resultTime) status = 'drawing';
        else                       status = 'done';

        const result = await drawResults.findOne({ drawId });
        return {
          drawId, game, time,
          multiplier: BET_CONFIG.multiplier,
          status,
          winnerNumber: result?.winnerNumber ?? null,
          winnerAnimal: result?.winnerAnimal ?? null,
          publishedAt:  result?.publishedAt  ?? null,
          closeTime:    closeTime.toISOString(),
          drawTime:     drawTime.toISOString(),
          resultTime:   resultTime.toISOString(),
        };
      }));

      return res.status(200).json({ success: true, draws, today });
    }

    // ══════════════════════════════════════════════════════════
    // OBTENER LÍMITES GLOBALES DE UN SORTEO
    // ══════════════════════════════════════════════════════════
    if (action === 'getDrawLimits') {
      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });

      const limitDocs = await drawLimits.find({ drawId }).toArray();
      const limits: Record<string, { remaining: number; isFull: boolean }> = {};
      for (const doc of limitDocs) {
        limits[doc.animal] = {
          remaining: Math.max(0, BET_CONFIG.maxBetGlobal - (doc.total || 0)),
          isFull:    (doc.total || 0) >= BET_CONFIG.maxBetGlobal,
        };
      }
      return res.status(200).json({ success: true, limits });
    }

    // ══════════════════════════════════════════════════════════
    // REGISTRAR APUESTA CON TICKET (múltiples animales)
    // ══════════════════════════════════════════════════════════
    if (action === 'placeBet') {
      const { drawId, drawGame, bets: betList } = body;

      if (!drawId || !betList || !Array.isArray(betList) || betList.length === 0)
        return res.status(400).json({ error: 'drawId y bets[] requeridos' });

      // Verificar sorteo abierto
      const { closeTime } = getDrawSlot(drawId);
      const nowVz = vzNow();
      if (nowVz >= closeTime)
        return res.status(400).json({ error: '⏰ Este sorteo ya cerró. Apuesta en el próximo.' });

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Validar montos
      const totalBet = betList.reduce((s: number, b: any) => s + (b.amount || 0), 0);
      for (const bet of betList) {
        if (bet.amount < BET_CONFIG.minBet)
          return res.status(400).json({ error: `Mínimo ${BET_CONFIG.minBet} 🥬 por animal (${bet.animal})` });
        if (bet.amount > BET_CONFIG.maxBetPerUser)
          return res.status(400).json({ error: `Máximo ${BET_CONFIG.maxBetPerUser} 🥬 por animal (${bet.animal})` });
      }
      if ((user.balance || 0) < totalBet)
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬` });

      // Verificar y actualizar límites globales
      for (const bet of betList) {
        const limitDoc = await drawLimits.findOne({ drawId, animal: bet.animal });
        const currentTotal = limitDoc?.total || 0;

        // Verificar que el usuario no supere su límite en ese animal en ese sorteo
        const userBetOnAnimal = await transactions.findOne({
          drawId, telegramId: tid, animal: bet.animal, type: 'bet', status: { $ne: 'cancelled' }
        });
        const userTotalOnAnimal = userBetOnAnimal?.amount || 0;
        if (userTotalOnAnimal + bet.amount > BET_CONFIG.maxBetPerUser)
          return res.status(400).json({ error: `Límite de usuario alcanzado para ${bet.animal} (máx ${BET_CONFIG.maxBetPerUser} 🥬)` });

        if (currentTotal + bet.amount > BET_CONFIG.maxBetGlobal)
          return res.status(400).json({ error: `Límite global alcanzado para ${bet.animal}. Solo quedan ${(BET_CONFIG.maxBetGlobal - currentTotal).toLocaleString()} 🥬` });
      }

      // Todo OK — descontar balance
      await users.updateOne({ telegramId: tid },
        { $inc: { balance: -totalBet, totalBets: 1 }, $set: { updatedAt: new Date() } });

      // Actualizar límites globales
      for (const bet of betList) {
        await drawLimits.updateOne(
          { drawId, animal: bet.animal },
          { $inc: { total: bet.amount }, $set: { game: drawGame || 'lotto', updatedAt: new Date() } },
          { upsert: true }
        );
      }

      // Crear registros individuales de apuesta
      const betDocs = betList.map((bet: any) => ({
        telegramId: tid, type: 'bet',
        animal: bet.animal, animalNumber: bet.number,
        amount: bet.amount, drawId, drawGame: drawGame || 'lotto',
        won: null, prize: null, status: 'pending',
        createdAt: new Date(),
      }));
      await transactions.insertMany(betDocs);

      // Crear TICKET
      const ticketId = `T-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).toUpperCase().slice(2,5)}`;
      const ticketDoc = {
        ticketId,
        telegramId: tid,
        username: user.username || username,
        drawId, drawGame: drawGame || 'lotto',
        bets: betList.map((bet: any) => ({
          animal: bet.animal, number: bet.number,
          amount: bet.amount, won: null, prize: null, status: 'pending',
        })),
        betsCount: betList.length,
        totalBet, totalPrize: null,
        status: 'pending',
        createdAt: new Date(),
      };
      await tickets.insertOne(ticketDoc);

      const newBalance = (user.balance || 0) - totalBet;
      return res.status(200).json({
        success: true,
        ticket: { ...ticketDoc, bets: ticketDoc.bets },
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
      await users.updateOne({ telegramId: tid },
        { $set: { walletAddress: walletAddress || null, updatedAt: new Date() } });
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

      const amount   = Number(withdrawAmount);
      if (!amount || amount < 0.1) return res.status(400).json({ error: 'Mínimo 0.1 TON' });

      const lechugas = Math.round(amount * 1000);
      if ((user.balance || 0) < lechugas)
        return res.status(400).json({ error: `Saldo insuficiente. Tienes ${(user.balance/1000).toFixed(2)} TON` });

      const pendiente = await withdrawals.findOne({ telegramId: tid, status: 'pending' });
      if (pendiente) return res.status(400).json({ error: '⏳ Ya tienes un retiro pendiente.' });

      const balanceBefore = user.balance;
      const balanceAfter  = balanceBefore - lechugas;

      await users.updateOne({ telegramId: tid },
        { $inc: { balance: -lechugas }, $set: { updatedAt: new Date() } });

      const wResult = await withdrawals.insertOne({
        telegramId: tid, username: user.username || username,
        amountTON: amount, amountLechugas: lechugas,
        walletAddress: wallet, status: 'pending',
        balanceBefore, balanceAfter,
        requestedAt: new Date(), processedAt: null, txHash: null, adminNote: null,
      });
      const mongoId = wResult.insertedId.toString();
      const wId     = mongoId.slice(-6).toUpperCase();

      await notify(
        `💸 *SOLICITUD DE RETIRO* \\#${wId}\n\n` +
        `👤 @${(user.username || username || 'sin\\_username').replace(/_/g, '\\_')}\n` +
        `🆔 ID: \`${tid}\`\n` +
        `💰 Monto: *${amount} TON* \\(${lechugas.toLocaleString()} 🥬\\)\n` +
        `👛 Wallet:\n\`${wallet}\`\n\n` +
        `📊 Saldo antes: ${balanceBefore.toLocaleString()} 🥬\n` +
        `📊 Saldo después: ${balanceAfter.toLocaleString()} 🥬\n\n` +
        `⏰ ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}\n` +
        `🔑 MongoDB ID: \`${mongoId}\`\n\n` +
        `⚠️ _Verifica la cuenta antes de enviar\\._`
      );

      return res.status(200).json({
        success: true, withdrawId: wId,
        newBalance: balanceAfter,
        message: `Solicitud #${wId} enviada. El admin la procesará en 24-48h.`,
      });
    }

    // ══════════════════════════════════════════════════════════
    // APROBAR / RECHAZAR RETIRO (admin)
    // ══════════════════════════════════════════════════════════
    if (action === 'processWithdraw') {
      if (body.adminKey !== process.env.ADMIN_SECRET_KEY)
        return res.status(403).json({ error: 'No autorizado' });

      const { withdrawMongoId, approve, txHash, adminNote } = body;
      let withdrawal;
      try {
        withdrawal = await withdrawals.findOne({ _id: new ObjectId(withdrawMongoId) });
      } catch { return res.status(400).json({ error: 'ID inválido' }); }

      if (!withdrawal) return res.status(404).json({ error: 'Retiro no encontrado' });
      if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Ya fue procesado' });

      if (approve) {
        await withdrawals.updateOne({ _id: withdrawal._id },
          { $set: { status: 'approved', txHash: txHash || null, adminNote: adminNote || null, processedAt: new Date() } });
        await notifyUser(withdrawal.telegramId,
          `✅ *¡Tu retiro fue aprobado\\!*\n\n` +
          `💰 *${withdrawal.amountTON} TON* enviados a:\n\`${withdrawal.walletAddress}\`\n\n` +
          `${txHash ? `🔗 TX: \`${txHash}\`` : ''}\n\n` +
          `¡Gracias por usar Animalito Lotto\\! 🎰`
        );
      } else {
        await withdrawals.updateOne({ _id: withdrawal._id },
          { $set: { status: 'rejected', adminNote: adminNote || null, processedAt: new Date() } });
        await users.updateOne({ telegramId: withdrawal.telegramId }, { $inc: { balance: withdrawal.amountLechugas } });
        await notifyUser(withdrawal.telegramId,
          `❌ *Tu retiro fue rechazado\\.*\n\n` +
          `💰 ${withdrawal.amountTON} TON \\(${withdrawal.amountLechugas.toLocaleString()} 🥬\\) *devueltos* a tu balance\\.\n\n` +
          `Motivo: ${adminNote || 'Sin especificar'}`
        );
      }
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════════
    // SCRAPING DE RESULTADOS (llamado por Api/scraper.mjs)
    // ══════════════════════════════════════════════════════════
    if (action === 'scrapeResults') {
      if (body.cronKey !== process.env.CRON_SECRET)
        return res.status(403).json({ error: 'No autorizado' });

      const { targetHour, targetGame } = body;
      const now    = vzNow();
      const today  = vzDateStr(now);
      const hour   = targetHour || now.getHours();
      const timeStr= String(hour).padStart(2, '0') + '00';
      const results: Record<string, any> = {};

      // ── FUENTE PRIMARIA: losanimalitos.net ──────────────────
      let primaryLotto: number | null  = null;
      let primaryGranja: number | null = null;

      try {
        const resp = await fetch('https://losanimalitos.net/Resultados-Animalitos-LottoActivo', {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
          signal: AbortSignal.timeout(10000),
        });
        const html = await resp.text();

        // Extraer números de Lotto Activo
        const lottoRe   = /lottoactivo[^"]*?\/(\d+)\.(?:png|jpg|webp)/gi;
        const granjaRe  = /lagranjita[^"]*?\/(\d+)\.(?:png|jpg|webp)/gi;

        const lottoMatches  = [...html.matchAll(lottoRe)];
        const granjaMatches = [...html.matchAll(granjaRe)];

        // Los resultados aparecen en orden, el más reciente primero
        // Mapeamos por hora (index 0 = 8AM, index 1 = 9AM, etc.)
        const hourIndex = hour - 8; // 8AM = index 0
        if (hourIndex >= 0) {
          if (lottoMatches[hourIndex])  primaryLotto  = parseInt(lottoMatches[hourIndex][1]);
          if (granjaMatches[hourIndex]) primaryGranja = parseInt(granjaMatches[hourIndex][1]);
        }
      } catch (e) {
        console.error('Error fuente primaria:', e.message);
      }

      // ── FUENTE SECUNDARIA: loteriadehoy.com ─────────────────
      let secondaryLotto: number | null  = null;
      let secondaryGranja: number | null = null;

      try {
        const [rLotto, rGranja] = await Promise.all([
          fetch(`https://loteriadehoy.com/animalito/lottoactivo/resultados/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
            signal: AbortSignal.timeout(10000),
          }),
          fetch(`https://loteriadehoy.com/animalito/lagranjita/resultados/${today}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
            signal: AbortSignal.timeout(10000),
          }),
        ]);

        const [htmlLotto, htmlGranja] = await Promise.all([rLotto.text(), rGranja.text()]);

        // Extraer por hora específica en loteriadehoy
        const timeLabel = `${String(hour).padStart(2,'0')}:00`;
        const timeLabel12 = hour > 12 ? `${hour-12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;

        // Buscar imagen cerca de la hora
        const lottoHourRe  = new RegExp(`${timeLabel}[\\s\\S]{0,200}?/(\\d+)\\.(?:png|jpg|webp)`, 'i');
        const granjaHourRe = new RegExp(`${timeLabel}[\\s\\S]{0,200}?/(\\d+)\\.(?:png|jpg|webp)`, 'i');

        const mLotto  = htmlLotto.match(lottoHourRe);
        const mGranja = htmlGranja.match(granjaHourRe);

        if (mLotto)  secondaryLotto  = parseInt(mLotto[1]);
        if (mGranja) secondaryGranja = parseInt(mGranja[1]);
      } catch (e) {
        console.error('Error fuente secundaria:', e.message);
      }

      // ── VERIFICACIÓN Y GUARDADO ─────────────────────────────
      const gamesToProcess = targetGame ? [targetGame] : ['lotto', 'granja'];

      for (const game of gamesToProcess) {
        const drawId = `${game}-${today}-${timeStr}`;
        const existing = await drawResults.findOne({ drawId });
        if (existing) { results[game] = { status: 'already_exists', drawId }; continue; }

        const primary   = game === 'lotto' ? primaryLotto   : primaryGranja;
        const secondary = game === 'lotto' ? secondaryLotto : secondaryGranja;

        let finalNumber: number | null = null;
        let confidence = 'none';

        if (primary !== null && secondary !== null) {
          if (primary === secondary) {
            finalNumber = primary;
            confidence  = 'high'; // ✅ Ambas fuentes coinciden
          } else {
            // ⚠️ Las fuentes no coinciden — notificar al admin sin guardar
            await notify(
              `⚠️ *DISCREPANCIA EN RESULTADO*\n\n` +
              `🎮 Juego: ${game === 'lotto' ? 'Lotto Activo' : 'La Granja'}\n` +
              `⏰ Sorteo: ${String(hour).padStart(2,'0')}:00\n\n` +
              `Fuente 1 \\(losanimalitos\\): *#${primary}* \\(${ANIMALS_MAP[primary] || '?'}\\)\n` +
              `Fuente 2 \\(loteriadehoy\\): *#${secondary}* \\(${ANIMALS_MAP[secondary] || '?'}\\)\n\n` +
              `_Resultado NO guardado\\. Verificar manualmente\\._`
            );
            results[game] = { status: 'discrepancy', primary, secondary, drawId };
            continue;
          }
        } else if (primary !== null) {
          finalNumber = primary;
          confidence  = 'medium'; // Solo fuente primaria
        } else if (secondary !== null) {
          finalNumber = secondary;
          confidence  = 'medium'; // Solo fuente secundaria
        }

        if (finalNumber === null) {
          results[game] = { status: 'not_available', drawId };
          continue;
        }

        const animalName = ANIMALS_MAP[finalNumber] || 'Desconocido';

        // Guardar resultado
        await drawResults.insertOne({
          drawId, game, winnerNumber: finalNumber, winnerAnimal: animalName,
          confidence, sources: { primary, secondary },
          publishedAt: new Date(),
        });

        // Pagar apuestas ganadoras
        const settled = await settleDrawBets(db, drawId, finalNumber, animalName);

        // Notificar al admin
        await notify(
          `📢 *Resultado ${game === 'lotto' ? 'Lotto Activo' : 'La Granja'}*\n` +
          `⏰ Sorteo ${String(hour).padStart(2,'0')}:00\n\n` +
          `🐾 *${animalName}* \\#${finalNumber}\n` +
          `✅ Confianza: ${confidence === 'high' ? 'ALTA \\(2 fuentes\\)' : 'MEDIA \\(1 fuente\\)'}\n` +
          `👥 Apuestas liquidadas: ${settled}`
        );

        results[game] = { status: 'saved', drawId, winnerNumber: finalNumber, winnerAnimal: animalName, confidence };
      }

      return res.status(200).json({ success: true, results, processedAt: new Date().toISOString() });
    }

    return res.status(400).json({ error: 'Acción no reconocida: ' + action });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}
