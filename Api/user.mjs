// Api/user.mjs
import { MongoClient } from 'mongodb';

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

// ── Configuración global de límites ─────────────────────────
const BET_CONFIG = {
  minBet: 50,           // mínimo por animal por ticket
  maxBetPerUser: 1000,  // máximo que UN usuario puede apostar a un animal en un sorteo
  maxBetGlobal: 10000,  // máximo TOTAL de todos los usuarios a un animal en un sorteo
  multiplier: 30,
};

// ── Mapa número → animal ─────────────────────────────────────
const ANIMALS_MAP = {
  1:'Carnero',2:'Toro',3:'Ciempiés',4:'Alacrán',5:'León',6:'Rana',7:'Perico',
  8:'Ratón',9:'Águila',10:'Tigre',11:'Gato',12:'Caballo',13:'Mono',14:'Paloma',
  15:'Zorro',16:'Oso',17:'Pavo',18:'Burro',19:'Chivo',20:'Cochino',21:'Gallo',
  22:'Camello',23:'Zebra',24:'Iguana',25:'Gavilán',26:'Murciélago',27:'Perro',
  28:'Venado',29:'Morrocoy',30:'Caimán',31:'Anteater',32:'Serpiente',33:'Lechuza',
  34:'Loro',35:'Jirafa',36:'Culebra',0:'Ballena'
};

// ── Horarios de sorteos ──────────────────────────────────────
const DRAW_TIMES = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

// ── Helper: fecha Venezuela ──────────────────────────────────
function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}
function vzToday() {
  const n = vzNow();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI no configurado en Vercel' });

  let client;
  try { client = await getClient(); }
  catch (err) { return res.status(500).json({ error: 'No se pudo conectar a MongoDB: ' + err.message }); }

  const db         = client.db('animalito_db');
  const users      = db.collection('users');
  const tickets    = db.collection('tickets');       // ← Tickets de apuesta
  const bets       = db.collection('bets');          // ← Apuestas individuales (para límites globales)
  const withdrawals = db.collection('withdrawals');
  const drawResults = db.collection('draw_results');
  const drawLimits  = db.collection('draw_limits');  // ← Control de límites por animal/sorteo

  const body = req.body || {};
  const { telegramId, username, action, taskId, reward,
          walletAddress, withdrawAmount, drawId, drawGame } = body;

  if (!telegramId) return res.status(400).json({ error: 'telegramId requerido' });
  const tid = String(telegramId);

  try {

    // ════════════════════════════════════════════════════════
    // CARGAR o CREAR USUARIO
    // ════════════════════════════════════════════════════════
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
        await notify(`🆕 Nuevo usuario: @${username || 'sin_username'} (ID: ${tid})\n🥬 Balance inicial: 1,000`);
        return res.status(200).json({ success: true, user: newUser, isNew: true });
      }
      return res.status(200).json({ success: true, user });
    }

    // ════════════════════════════════════════════════════════
    // COMPLETAR TAREA
    // ════════════════════════════════════════════════════════
    if (action === 'task') {
      if (!taskId || !reward) return res.status(400).json({ error: 'taskId y reward requeridos' });
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (taskId === 'daily') {
        const last = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
        const now = new Date();
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
      const newBalance = (user.balance || 0) + reward;
      await notify(`✅ @${user.username} completó "${taskId}" +${reward}🥬 → Balance: ${newBalance}`);
      return res.status(200).json({ success: true, newBalance });
    }

    // ════════════════════════════════════════════════════════
    // APOSTAR — MÚLTIPLES ANIMALES EN UN TICKET
    // body.bets = [{ animal: 'León', number: 5, amount: 200 }, ...]
    // ════════════════════════════════════════════════════════
    if (action === 'bet') {
      const betList = body.bets; // array de { animal, number, amount }
      if (!betList || !Array.isArray(betList) || betList.length === 0)
        return res.status(400).json({ error: 'Envía un array "bets" con al menos una apuesta' });
      if (!drawId || !drawGame)
        return res.status(400).json({ error: 'drawId y drawGame son requeridos' });

      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Verificar que el sorteo esté abierto
      const now = vzNow();
      const parts = drawId.split('-'); // ej: lotto-2026-04-01-0800
      const timeStr = parts[parts.length - 1]; // '0800'
      const hour = parseInt(timeStr.slice(0, 2));
      const min  = parseInt(timeStr.slice(2, 4));
      const drawTime  = new Date(now); drawTime.setHours(hour, min, 0, 0);
      const closeTime = new Date(drawTime.getTime() - 10 * 60000);
      if (now >= closeTime)
        return res.status(400).json({ error: '⏰ Este sorteo ya cerró. Las apuestas cierran 10 minutos antes.' });

      // Validar cada apuesta
      const errors = [];
      let totalDebit = 0;
      const validatedBets = [];

      for (const b of betList) {
        const amount = Number(b.amount);
        if (!b.animal) { errors.push(`Animal inválido`); continue; }
        if (amount < BET_CONFIG.minBet) { errors.push(`${b.animal}: mínimo ${BET_CONFIG.minBet}🥬`); continue; }
        if (amount > BET_CONFIG.maxBetPerUser) { errors.push(`${b.animal}: máximo ${BET_CONFIG.maxBetPerUser}🥬 por usuario`); continue; }

        // Verificar que el mismo usuario no exceda su límite para este animal en este sorteo
        const userBetTotal = await bets.aggregate([
          { $match: { drawId, telegramId: tid, animal: b.animal, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();
        const userSoFar = userBetTotal[0]?.total || 0;
        if (userSoFar + amount > BET_CONFIG.maxBetPerUser) {
          errors.push(`${b.animal}: ya apostaste ${userSoFar}🥬, límite por usuario es ${BET_CONFIG.maxBetPerUser}🥬`);
          continue;
        }

        // Verificar límite global del animal en este sorteo
        const globalTotal = await drawLimits.findOne({ drawId, animal: b.animal });
        const globalSoFar = globalTotal?.totalBet || 0;
        if (globalSoFar + amount > BET_CONFIG.maxBetGlobal) {
          const remaining = BET_CONFIG.maxBetGlobal - globalSoFar;
          errors.push(`${b.animal}: límite global casi lleno. Solo quedan ${remaining}🥬 disponibles`);
          continue;
        }

        validatedBets.push({ animal: b.animal, number: b.number, amount });
        totalDebit += amount;
      }

      if (errors.length > 0 && validatedBets.length === 0)
        return res.status(400).json({ error: errors.join('\n') });

      // Verificar saldo total
      if ((user.balance || 0) < totalDebit)
        return res.status(400).json({
          error: `Saldo insuficiente. Necesitas ${totalDebit.toLocaleString()}🥬 pero tienes ${user.balance.toLocaleString()}🥬`
        });

      // Generar ticket
      const ticketId = `T-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
      const newBalance = user.balance - totalDebit;

      // Descontar balance
      await users.updateOne({ telegramId: tid },
        { $inc: { balance: -totalDebit, totalBets: validatedBets.length }, $set: { updatedAt: new Date() } });

      // Insertar ticket
      await tickets.insertOne({
        ticketId, telegramId: tid, username: user.username,
        drawId, drawGame, totalBet: totalDebit,
        betsCount: validatedBets.length, status: 'pending',
        totalPrize: null, createdAt: new Date(),
      });

      // Insertar apuestas individuales + actualizar límites globales
      const betDocs = validatedBets.map(b => ({
        ticketId, drawId, drawGame,
        telegramId: tid, username: user.username,
        animal: b.animal, number: b.number, amount: b.amount,
        status: 'pending', won: null, prize: null, createdAt: new Date(),
      }));
      await bets.insertMany(betDocs);

      // Actualizar límites globales por animal
      for (const b of validatedBets) {
        await drawLimits.updateOne(
          { drawId, animal: b.animal },
          { $inc: { totalBet: b.amount }, $set: { updatedAt: new Date() } },
          { upsert: true }
        );
      }

      return res.status(200).json({
        success: true,
        ticketId,
        newBalance,
        totalBet: totalDebit,
        betsPlaced: validatedBets.length,
        warnings: errors.length > 0 ? errors : undefined,
        message: errors.length > 0
          ? `✅ Ticket ${ticketId} creado con ${validatedBets.length} apuesta(s). Algunas fueron omitidas.`
          : `✅ Ticket ${ticketId} creado con ${validatedBets.length} apuesta(s). ¡Buena suerte!`,
      });
    }

    // ════════════════════════════════════════════════════════
    // VER TICKET (por ticketId)
    // ════════════════════════════════════════════════════════
    if (action === 'getTicket') {
      const { ticketId: tId } = body;
      if (!tId) return res.status(400).json({ error: 'ticketId requerido' });
      const ticket = await tickets.findOne({ ticketId: tId });
      if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
      // Solo el dueño puede ver su ticket
      if (ticket.telegramId !== tid)
        return res.status(403).json({ error: 'No autorizado' });
      const ticketBets = await bets.find({ ticketId: tId }).toArray();
      return res.status(200).json({ success: true, ticket, bets: ticketBets });
    }

    // ════════════════════════════════════════════════════════
    // VER MIS TICKETS (historial del usuario)
    // ════════════════════════════════════════════════════════
    if (action === 'getMyTickets') {
      const limit = Math.min(body.limit || 20, 50);
      const skip  = body.skip || 0;
      const myTickets = await tickets.find({ telegramId: tid })
        .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();

      // Enriquecer con las apuestas de cada ticket
      const enriched = await Promise.all(myTickets.map(async t => {
        const ticketBets = await bets.find({ ticketId: t.ticketId }).toArray();
        return { ...t, bets: ticketBets };
      }));

      return res.status(200).json({ success: true, tickets: enriched });
    }

    // ════════════════════════════════════════════════════════
    // VER LÍMITES DE UN SORTEO (disponibilidad por animal)
    // ════════════════════════════════════════════════════════
    if (action === 'getDrawLimits') {
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });
      const limits = await drawLimits.find({ drawId }).toArray();
      const result = {};
      for (const l of limits) {
        result[l.animal] = {
          totalBet: l.totalBet,
          remaining: Math.max(0, BET_CONFIG.maxBetGlobal - l.totalBet),
          isFull: l.totalBet >= BET_CONFIG.maxBetGlobal,
        };
      }
      return res.status(200).json({ success: true, limits: result, config: BET_CONFIG });
    }

    // ════════════════════════════════════════════════════════
    // OBTENER SORTEOS DEL DÍA
    // ════════════════════════════════════════════════════════
    if (action === 'getDraws') {
      const game = body.game || 'lotto';
      const now = vzNow();
      const todayStr = vzToday();

      const draws = await Promise.all(DRAW_TIMES.map(async (time) => {
        const drawId = `${game}-${todayStr}-${time.replace(':','')}`;
        const [h, m] = time.split(':').map(Number);
        const drawTime  = new Date(now); drawTime.setHours(h, m, 0, 0);
        const closeTime = new Date(drawTime.getTime() - 10 * 60000);
        const resultTime = new Date(drawTime.getTime() + 5 * 60000);

        let status;
        if (now < closeTime)       status = 'open';
        else if (now < drawTime)   status = 'closed';
        else if (now < resultTime) status = 'drawing';
        else                       status = 'done';

        const result = await drawResults.findOne({ drawId });
        return {
          drawId, game, time, multiplier: BET_CONFIG.multiplier, status,
          winnerNumber: result?.winnerNumber || null,
          winnerAnimal: result?.winnerAnimal || null,
          publishedAt:  result?.publishedAt  || null,
          closeTime:    closeTime.toISOString(),
          drawTime:     drawTime.toISOString(),
          resultTime:   resultTime.toISOString(),
        };
      }));

      return res.status(200).json({ success: true, draws, today: todayStr });
    }

    // ════════════════════════════════════════════════════════
    // SCRAPING DE RESULTADOS — llamado por el cron cada 5 min
    // ════════════════════════════════════════════════════════
    if (action === 'scrapeResults') {
      if (body.cronKey !== process.env.CRON_SECRET)
        return res.status(403).json({ error: 'No autorizado' });

      const now = vzNow();
      const todayStr = vzToday();

      let newResults = { lotto: [], granja: [] };

      try {
        // ── Fuente 1: losanimalitos.net ──────────────────────
        const resp = await fetch('https://losanimalitos.net/Resultados-Animalitos-LottoActivo', {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnimalitoBot/2.0)' },
          signal: AbortSignal.timeout(10000),
        });
        const html = await resp.text();

        // Extraer números de imagen: /lottoactivo/imagenes/N.png o /lagranjita/imagenes/N.png
        const lottoNums  = [...html.matchAll(/lottoactivo[^"]*?imagenes\/(\d+)\.png/gi)].map(m => parseInt(m[1]));
        const granjaNums = [...html.matchAll(/lagranjita[^"]*?imagenes\/(\d+)\.png/gi)].map(m => parseInt(m[1]));

        // Determinar cuántos sorteos ya pasaron (comparar hora actual con horarios)
        const passedDraws = DRAW_TIMES.filter(t => {
          const [h, m] = t.split(':').map(Number);
          const dt = new Date(now); dt.setHours(h, m, 0, 0);
          const resultTime = new Date(dt.getTime() + 5 * 60000);
          return now >= resultTime; // solo los que ya tienen resultado
        });

        // Mapear resultados en orden a los sorteos pasados
        for (let i = 0; i < Math.min(lottoNums.length, passedDraws.length); i++) {
          const drawId = `lotto-${todayStr}-${passedDraws[i].replace(':','')}`;
          const existing = await drawResults.findOne({ drawId });
          if (!existing) {
            const num    = lottoNums[i];
            const animal = ANIMALS_MAP[num] || ANIMALS_MAP[num % 37] || 'Desconocido';
            await drawResults.updateOne({ drawId },
              { $set: { drawId, winnerNumber: num, winnerAnimal: animal, source: 'losanimalitos', publishedAt: new Date() } },
              { upsert: true }
            );
            await settleDrawBets(bets, tickets, users, drawId, num, animal, BET_CONFIG.multiplier, notify, notifyUser);
            newResults.lotto.push({ drawId, num, animal });
          }
        }

        for (let i = 0; i < Math.min(granjaNums.length, passedDraws.length); i++) {
          const drawId = `granja-${todayStr}-${passedDraws[i].replace(':','')}`;
          const existing = await drawResults.findOne({ drawId });
          if (!existing) {
            const num    = granjaNums[i];
            const animal = ANIMALS_MAP[num] || ANIMALS_MAP[num % 37] || 'Desconocido';
            await drawResults.updateOne({ drawId },
              { $set: { drawId, winnerNumber: num, winnerAnimal: animal, source: 'losanimalitos', publishedAt: new Date() } },
              { upsert: true }
            );
            await settleDrawBets(bets, tickets, users, drawId, num, animal, BET_CONFIG.multiplier, notify, notifyUser);
            newResults.granja.push({ drawId, num, animal });
          }
        }
      } catch (e) {
        console.error('Scraping error:', e.message);
      }

      return res.status(200).json({ success: true, newResults, scrapedAt: new Date().toISOString() });
    }

    // ════════════════════════════════════════════════════════
    // GUARDAR WALLET
    // ════════════════════════════════════════════════════════
    if (action === 'wallet') {
      await users.updateOne({ telegramId: tid },
        { $set: { walletAddress: walletAddress || null, updatedAt: new Date() } });
      return res.status(200).json({ success: true });
    }

    // ════════════════════════════════════════════════════════
    // OBTENER WALLET DEL ADMIN (desde variable de entorno)
    // ════════════════════════════════════════════════════════
    if (action === 'getAdminWallet') {
      const wallet = process.env.ADMIN_TON_WALLET || '';
      return res.status(200).json({ success: true, wallet });
    }

    // ════════════════════════════════════════════════════════
    // SOLICITUD DE RETIRO
    // ════════════════════════════════════════════════════════
    if (action === 'withdraw') {
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const wallet = walletAddress || user.walletAddress;
      if (!wallet) return res.status(400).json({ error: 'Guarda tu dirección TON wallet primero.' });

      const amount = Number(withdrawAmount);
      if (!amount || amount < 0.1) return res.status(400).json({ error: 'Monto mínimo de retiro: 0.1 TON' });

      const lechugas = Math.round(amount * 1000);
      if ((user.balance || 0) < lechugas)
        return res.status(400).json({
          error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()}🥬 = ${(user.balance/1000).toFixed(3)} TON`
        });

      // Solo 1 retiro pendiente a la vez
      const pendiente = await withdrawals.findOne({ telegramId: tid, status: 'pending' });
      if (pendiente)
        return res.status(400).json({ error: '⏳ Ya tienes un retiro pendiente. Espera que el admin lo procese.' });

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

      const wId = wResult.insertedId.toString().slice(-6).toUpperCase();
      const mongoId = wResult.insertedId.toString();

      // Notificación completa al admin con todos los datos para verificar
      await notify(
        `💸 *SOLICITUD DE RETIRO* #${wId}\n\n` +
        `👤 Usuario: @${user.username || 'sin\\_username'}\n` +
        `🆔 Telegram ID: \`${tid}\`\n` +
        `💰 Monto: *${amount} TON* (${lechugas.toLocaleString()} 🥬)\n` +
        `👛 Wallet destino:\n\`${wallet}\`\n\n` +
        `📊 Saldo antes: ${balanceBefore.toLocaleString()} 🥬\n` +
        `📊 Saldo después: ${balanceAfter.toLocaleString()} 🥬\n\n` +
        `🗓 ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}\n\n` +
        `🔑 MongoDB ID: \`${mongoId}\`\n\n` +
        `⚠️ *Verifica la cuenta antes de enviar.*`,
        true
      );

      return res.status(200).json({
        success: true, withdrawId: wId, newBalance: balanceAfter,
        message: `Solicitud #${wId} enviada. El admin la procesará en 24-48h. Te notificaremos por Telegram.`,
      });
    }

    // ════════════════════════════════════════════════════════
    // APROBAR / RECHAZAR RETIRO (solo admin)
    // ════════════════════════════════════════════════════════
    if (action === 'processWithdraw') {
      if (body.adminKey !== process.env.ADMIN_SECRET_KEY)
        return res.status(403).json({ error: 'No autorizado' });

      const { withdrawMongoId, approve, txHash, adminNote } = body;
      const { ObjectId } = await import('mongodb');

      let withdrawal;
      try { withdrawal = await withdrawals.findOne({ _id: new ObjectId(withdrawMongoId) }); }
      catch { return res.status(400).json({ error: 'ID de retiro inválido' }); }

      if (!withdrawal) return res.status(404).json({ error: 'Retiro no encontrado' });
      if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Este retiro ya fue procesado' });

      if (approve) {
        await withdrawals.updateOne({ _id: withdrawal._id },
          { $set: { status: 'approved', txHash: txHash || null, adminNote: adminNote || null, processedAt: new Date() } });
        await notifyUser(withdrawal.telegramId,
          `✅ *¡Tu retiro fue aprobado!*\n\n` +
          `💰 *${withdrawal.amountTON} TON* enviados a:\n\`${withdrawal.walletAddress}\`\n\n` +
          `${txHash ? `🔗 TX Hash: \`${txHash}\`` : ''}\n\n¡Gracias por usar Animalito Lotto! 🎰`
        );
      } else {
        await withdrawals.updateOne({ _id: withdrawal._id },
          { $set: { status: 'rejected', adminNote: adminNote || null, processedAt: new Date() } });
        await users.updateOne({ telegramId: withdrawal.telegramId },
          { $inc: { balance: withdrawal.amountLechugas } });
        await notifyUser(withdrawal.telegramId,
          `❌ *Tu retiro fue rechazado.*\n\n` +
          `💰 ${withdrawal.amountTON} TON (${withdrawal.amountLechugas.toLocaleString()} 🥬) *devueltos* a tu balance.\n\n` +
          `Motivo: ${adminNote || 'Sin especificar'}\n\n¿Dudas? Contacta al soporte.`
        );
      }
      return res.status(200).json({ success: true, action: approve ? 'approved' : 'rejected' });
    }

    return res.status(400).json({ error: 'Acción no reconocida: ' + action });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}

// ════════════════════════════════════════════════════════════
// LIQUIDAR APUESTAS GANADORAS DE UN SORTEO
// ════════════════════════════════════════════════════════════
async function settleDrawBets(bets, tickets, users, drawId, winnerNumber, winnerAnimal, multiplier, notify, notifyUser) {
  const drawBets = await bets.find({ drawId, status: 'pending' }).toArray();
  if (drawBets.length === 0) return;

  // Agrupar por ticket
  const byTicket = {};
  for (const bet of drawBets) {
    if (!byTicket[bet.ticketId]) byTicket[bet.ticketId] = { bets: [], telegramId: bet.telegramId, totalPrize: 0, won: false };
    const isWinner = bet.animal.toLowerCase() === winnerAnimal.toLowerCase();
    const prize = isWinner ? bet.amount * multiplier : 0;
    byTicket[bet.ticketId].bets.push({ ...bet, won: isWinner, prize });
    byTicket[bet.ticketId].totalPrize += prize;
    if (isWinner) byTicket[bet.ticketId].won = true;

    // Actualizar apuesta individual
    await bets.updateOne({ _id: bet._id },
      { $set: { status: 'settled', won: isWinner, prize, winnerNumber, winnerAnimal, settledAt: new Date() } });

    // Acreditar si ganó
    if (isWinner && prize > 0) {
      await users.updateOne({ telegramId: bet.telegramId },
        { $inc: { balance: prize, totalWins: 1 } });
    }
  }

  // Actualizar tickets y notificar
  for (const [ticketId, data] of Object.entries(byTicket)) {
    const status = data.won ? 'won' : 'lost';
    await tickets.updateOne({ ticketId },
      { $set: { status, totalPrize: data.totalPrize, settledAt: new Date() } });

    if (data.won && data.totalPrize > 0) {
      await notifyUser(data.telegramId,
        `🎉 *¡GANASTE!* Ticket \`${ticketId}\`\n\n` +
        `🏆 Sorteo: ${drawId.split('-').slice(-1)[0]}\n` +
        `🐾 Animal ganador: *${winnerAnimal}* (#${winnerNumber})\n` +
        `💰 Premio total: *+${data.totalPrize.toLocaleString()} 🥬*\n\n¡Felicidades! 🏆`
      );
    }
  }

  console.log(`Sorteo ${drawId} liquidado: ${drawBets.length} apuestas, ganador: ${winnerAnimal} #${winnerNumber}`);
}

// ════════════════════════════════════════════════════════════
// HELPERS TELEGRAM
// ════════════════════════════════════════════════════════════
async function notify(text, markdown = false) {
  const token  = process.env.TOKEN_BOT;
  const chatId = process.env.ID_DE_CHAT;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: markdown ? 'Markdown' : undefined }),
    });
  } catch { /* ignorar */ }
}

async function notifyUser(telegramId, text) {
  const token = process.env.TOKEN_BOT;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'Markdown' }),
    });
  } catch { /* ignorar */ }
}
