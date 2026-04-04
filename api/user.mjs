// api/user.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, 'utf8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        let value = valueParts.join('=');
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

const localEnv = loadLocalEnv();
const uri = localEnv.MONGODB_URI || process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch { cachedClient = null; }
  }
  if (!uri) throw new Error('MONGODB_URI no configurado');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
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
  minBet: 50, maxBetPerUser: 1000, maxBetGlobal: 10000, multiplier: 30,
};

const TASK_REWARDS = {
  daily: 500,
  share_app: 300,
  first_bet: 200,
  save_wallet: 250,
  play_3_days: 1000,
};

const LECHUGAS_PER_TON = Number(
  process.env.LECHUGAS_PER_TON || process.env.VITE_LECHUGAS_PER_TON || 1000
);

function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}
function vzDateStr(d) {
  const vz = d || vzNow();
  return `${vz.getFullYear()}-${String(vz.getMonth()+1).padStart(2,'0')}-${String(vz.getDate()).padStart(2,'0')}`;
}

const DRAW_TIMES = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

function getDrawSlot(drawId) {
  const parts = drawId.split('-');
  const timeStr = parts[parts.length - 1];
  const hour = parseInt(timeStr.slice(0,2));
  const min = parseInt(timeStr.slice(2,4));
  const now = vzNow();
  const drawTime = new Date(now); drawTime.setHours(hour, min, 0, 0);
  const closeTime = new Date(drawTime.getTime() - 10*60000);
  const resultTime = new Date(drawTime.getTime() + 5*60000);
  return { drawTime, closeTime, resultTime };
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNonNegativeInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function validateBetPayload(bet, index) {
  const amount = parsePositiveNumber(bet.amount);
  if (amount === null) throw new Error(`Apuesta ${index + 1}: monto inválido`);
  const number = parseNonNegativeInteger(bet.number);
  if (number === null) throw new Error(`Apuesta ${index + 1}: número inválido`);
  const animal = typeof bet.animal === 'string' ? bet.animal.trim() : '';
  if (!animal) throw new Error(`Apuesta ${index + 1}: animal inválido`);
  return { animal, number, amount };
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
    await transactions.updateOne({ _id: bet._id }, { $set: { status: 'settled', won: isWinner, prize, winnerNumber, winnerAnimal, settledAt: new Date() } });
    if (isWinner) await users.updateOne({ telegramId: bet.telegramId }, { $inc: { balance: prize, totalWins: 1 } });
  }
  const pendingTickets = await tickets.find({ drawId, status: 'pending' }).toArray();
  for (const ticket of pendingTickets) {
    const updatedBets = ticket.bets.map(b => { const isW = b.animal===winnerAnimal||b.number===winnerNumber; return {...b, won:isW, prize:isW?b.amount*BET_CONFIG.multiplier:0, status:'settled'}; });
    const totalPrize = updatedBets.reduce((s,b)=>s+(b.prize||0),0);
    const won = totalPrize > 0;
    await tickets.updateOne({ _id: ticket._id }, { $set: { bets: updatedBets, status: won?'won':'lost', totalPrize, settledAt: new Date() } });
    if (won) await notifyUser(ticket.telegramId, `🎉 *¡GANASTE!* — Sorteo ${drawId.split('-').slice(-1)[0].slice(0,2)}:${drawId.split('-').slice(-1)[0].slice(2,4)}\n\n🐾 Salió: *${winnerAnimal}* \\#${winnerNumber}\n💰 Premio: *+${totalPrize.toLocaleString()} 🥬*\n\n¡Felicidades! 🏆`);
  }
  await drawLimits.deleteMany({ drawId });
  return bets.length;
}

// ── Verificar TX en TON Testnet ────────────────────────────
// Busca una TX entrante al admin por monto y tiempo reciente
async function verifyTonTx(adminWallet, amountTon, sinceTimestamp) {
  try {
    const tonApiKey = process.env.TON_API_KEY || '';
    const url = `https://testnet.toncenter.com/api/v2/getTransactions?address=${adminWallet}&limit=20&to_lt=0&archival=false`;
    const headers = tonApiKey ? { 'X-API-Key': tonApiKey } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.result)) return null;

    const expectedNano = Math.floor(amountTon * 1_000_000_000);
    const toleranceNano = 20_000_000; // ±0.02 TON de fees
    const sinceUnix = Math.floor(sinceTimestamp / 1000) - 120; // 2 min antes por si acaso

    const match = data.result.find(tx => {
      const inMsg = tx?.in_msg;
      if (!inMsg) return false;
      const value = parseInt(inMsg.value || '0');
      const utime = tx.utime || 0;
      const amountMatch = Math.abs(value - expectedNano) <= toleranceNano;
      const timeMatch = utime >= sinceUnix;
      return amountMatch && timeMatch;
    });

    return match || null;
  } catch (e) {
    console.error('verifyTonTx error:', e);
    return null;
  }
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
  try { client = await getClient(); }
  catch (err) { return res.status(500).json({ error: 'MongoDB: ' + err.message }); }

  const db = client.db('animalito_db');
  const users = db.collection('users');
  const transactions = db.collection('transactions');
  const tickets = db.collection('tickets');
  const withdrawals = db.collection('withdrawals');
  const drawResults = db.collection('draw_results');
  const drawLimits = db.collection('draw_limits');
  const deposits = db.collection('deposits');

  const body = req.body || {};
  const { telegramId, username, action } = body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId requerido' });
  const tid = String(telegramId);

  try {

    // ══════════════════════════════════════════════════════
    // CARGAR / CREAR USUARIO
    // ══════════════════════════════════════════════════════
    if (!action || action === 'load') {
      let user = await users.findOne({ telegramId: tid });
      if (!user) {
        const newUser = {
          telegramId: tid, username: username||'Usuario', balance: 1000,
          completedTasks: [], lastDailyBonus: null, totalBets: 0, totalWins: 0,
          walletAddress: null, createdAt: new Date(), updatedAt: new Date(),
        };
        await users.insertOne(newUser);
        await notify(`🆕 Nuevo usuario: @${username||'sin\\_username'} (ID: ${tid})`);
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
    // COMPLETAR TAREA
    // ══════════════════════════════════════════════════════
    if (action === 'task') {
      const { taskId } = body;
      if (!taskId || !(taskId in TASK_REWARDS)) return res.status(400).json({ error: 'taskId inválido' });
      const reward = TASK_REWARDS[taskId];
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (taskId === 'daily') {
        const last = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;
        const now = new Date();
        if (last && (now-last) < 24*60*60*1000) {
          const hoursLeft = Math.ceil((new Date(last.getTime()+24*60*60*1000)-now)/(60*60*1000));
          return res.status(400).json({ error: `El bono diario estará disponible en ${hoursLeft}h` });
        }
        await users.updateOne({ telegramId: tid }, { $inc: { balance: reward }, $set: { lastDailyBonus: now, updatedAt: now } });
        const u = await users.findOne({ telegramId: tid });
        return res.status(200).json({ success: true, newBalance: u.balance, reward });
      }
      if (user.completedTasks?.includes(taskId)) return res.status(400).json({ error: 'Tarea ya completada' });
      await users.updateOne({ telegramId: tid }, { $inc: { balance: reward }, $push: { completedTasks: taskId }, $set: { updatedAt: new Date() } });
      const u = await users.findOne({ telegramId: tid });
      return res.status(200).json({ success: true, newBalance: u.balance, reward });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER SORTEOS DEL DÍA
    // ══════════════════════════════════════════════════════
    if (action === 'getDraws') {
      const game = body.game || 'lotto';
      const now = vzNow();
      const today = vzDateStr(now);
      const drawList = DRAW_TIMES.map(time => {
        const drawId = `${game}-${today}-${time.replace(':','')}`;
        const [h,m] = time.split(':').map(Number);
        const drawTime = new Date(now); drawTime.setHours(h,m,0,0);
        const closeTime = new Date(drawTime.getTime()-10*60000);
        const resultTime = new Date(drawTime.getTime()+5*60000);
        let status;
        if (now<closeTime) status='open';
        else if (now>=closeTime&&now<drawTime) status='closed';
        else if (now>=drawTime&&now<resultTime) status='drawing';
        else status='done';
        return { drawId, game, time, status, closeTime:closeTime.toISOString(), drawTime:drawTime.toISOString(), resultTime:resultTime.toISOString() };
      });
      const doneDrawIds = drawList.filter(d=>d.status==='done').map(d=>d.drawId);
      const results = doneDrawIds.length>0 ? await drawResults.find({ drawId:{$in:doneDrawIds} }).toArray() : [];
      const resultsMap = {};
      for (const r of results) resultsMap[r.drawId] = r;
      const enrichedDraws = drawList.map(d => { const result=resultsMap[d.drawId]; return {...d, winnerNumber:result?.winnerNumber??null, winnerAnimal:result?.winnerAnimal??null}; });
      return res.status(200).json({ success: true, draws: enrichedDraws });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER LÍMITES DE UN SORTEO
    // ══════════════════════════════════════════════════════
    if (action === 'getDrawLimits') {
      const { drawId } = body;
      if (!drawId) return res.status(400).json({ error: 'drawId requerido' });
      const limitDocs = await drawLimits.find({ drawId }).toArray();
      const limits = {};
      for (const doc of limitDocs) limits[doc.animal] = { remaining: Math.max(0,BET_CONFIG.maxBetGlobal-(doc.total||0)), isFull:(doc.total||0)>=BET_CONFIG.maxBetGlobal };
      return res.status(200).json({ success: true, limits });
    }

    // ══════════════════════════════════════════════════════
    // REGISTRAR APUESTA
    // ══════════════════════════════════════════════════════
    if (action === 'placeBet') {
      const { drawId, drawGame, bets: betList } = body;
      if (!drawId||!betList||!Array.isArray(betList)||betList.length===0) return res.status(400).json({ error: 'drawId y bets[] requeridos' });
      const { closeTime } = getDrawSlot(drawId);
      if (vzNow()>=closeTime) return res.status(400).json({ error: '⏰ Este sorteo ya cerró.' });
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      let totalBet = 0;
      const normalizedBets = [];
      try {
        for (let i = 0; i < betList.length; i += 1) {
          const bet = validateBetPayload(betList[i], i);
          if (bet.amount < BET_CONFIG.minBet) return res.status(400).json({ error: `Mínimo ${BET_CONFIG.minBet} 🥬 por animal` });
          if (bet.amount > BET_CONFIG.maxBetPerUser) return res.status(400).json({ error: `Máximo ${BET_CONFIG.maxBetPerUser} 🥬 por animal` });
          totalBet += bet.amount;
          normalizedBets.push(bet);
        }
      } catch (err) {
        return res.status(400).json({ error: err.message || 'Apuesta inválida' });
      }

      if ((user.balance||0) < totalBet) return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬` });
      for (const bet of normalizedBets) {
        const limitDoc = await drawLimits.findOne({ drawId, animal: bet.animal });
        const currentTotal = limitDoc?.total||0;
        if (currentTotal >= BET_CONFIG.maxBetGlobal) return res.status(400).json({ error: `Límite alcanzado para ${bet.animal}` });
        if (currentTotal + bet.amount > BET_CONFIG.maxBetGlobal) return res.status(400).json({ error: `Límite global alcanzado para ${bet.animal}` });
      }

      await users.updateOne({ telegramId: tid }, { $inc: { balance: -totalBet, totalBets: 1 }, $set: { updatedAt: new Date() } });
      for (const bet of normalizedBets) await drawLimits.updateOne({ drawId, animal: bet.animal }, { $inc: { total: bet.amount }, $set: { game: drawGame||'lotto', updatedAt: new Date() } }, { upsert: true });
      const betDocs = normalizedBets.map(bet => ({ telegramId: tid, type:'bet', animal:bet.animal, animalNumber:bet.number, amount:bet.amount, drawId, drawGame:drawGame||'lotto', won:null, prize:null, status:'pending', createdAt:new Date() }));
      await transactions.insertMany(betDocs);
      const ticketId = `T-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).toUpperCase().slice(2,5)}`;
      const ticketDoc = { ticketId, telegramId:tid, username:username||'Usuario', drawId, drawGame:drawGame||'lotto', bets:normalizedBets.map(bet=>({animal:bet.animal,number:bet.number,amount:bet.amount,won:null,prize:null,status:'pending'})), betsCount:normalizedBets.length, totalBet, totalPrize:null, status:'pending', createdAt:new Date() };
      await tickets.insertOne(ticketDoc);
      return res.status(200).json({ success: true, ticket: ticketDoc, newBalance: (user.balance||0)-totalBet, message: `✅ Ticket ${ticketId} registrado. ¡Buena suerte!` });
    }

    // ══════════════════════════════════════════════════════
    // OBTENER TICKETS
    // ══════════════════════════════════════════════════════
    if (action === 'getTickets') {
      const userTickets = await tickets.find({ telegramId: tid }).sort({ createdAt: -1 }).limit(50).toArray();
      return res.status(200).json({ success: true, tickets: userTickets });
    }

    // ══════════════════════════════════════════════════════
    // GUARDAR WALLET
    // ══════════════════════════════════════════════════════
    if (action === 'wallet') {
      const { walletAddress } = body;
      await users.updateOne({ telegramId: tid }, { $set: { walletAddress: walletAddress||null, updatedAt: new Date() } });
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════
    // REGISTRAR DEPÓSITO TON (enviado por TonConnect)
    // ══════════════════════════════════════════════════════
    if (action === 'registerDeposit') {
      const { txBoc, amountTon, walletAddress: depWallet, comment } = body;
      if (!amountTon) return res.status(400).json({ error: 'amountTon requerido' });

      const amountTonNumber = Number(amountTon);
      if (isNaN(amountTonNumber) || amountTonNumber <= 0) return res.status(400).json({ error: 'amountTon inválido' });
      const amountLechugas = Math.floor(amountTonNumber * LECHUGAS_PER_TON);

      // Crear depósito pendiente con timestamp para búsqueda posterior
      const depositId = `DEP-${tid}-${Date.now()}`;
      const deposit = {
        depositId, telegramId: tid, username: username||'Usuario',
        txBoc: txBoc || null,
        amountTon: amountTonNumber,
        amountLechugas,
        walletAddress: depWallet || null,
        comment: comment || null,
        status: 'pending',
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        confirmedAt: null,
      };
      await deposits.insertOne(deposit);

      await notify(
        `💳 *Nuevo depósito TonConnect*\n\n` +
        `👤 @${username||'sin\\_username'} (ID: ${tid})\n` +
        `💰 *${amountTon} TON* → ${Number(amountLechugas).toLocaleString()} 🥬\n` +
        `🔑 ID: ${depositId}`
      );

      return res.status(200).json({ success: true, depositId, status: 'pending' });
    }

    // ══════════════════════════════════════════════════════
    // VERIFICAR DEPÓSITO EN BLOCKCHAIN
    // ══════════════════════════════════════════════════════
    if (action === 'checkDeposit') {
      const { depositId } = body;
      if (!depositId) return res.status(400).json({ error: 'depositId requerido' });

      const deposit = await deposits.findOne({ depositId, telegramId: tid });
      if (!deposit) return res.status(404).json({ error: 'Depósito no encontrado' });

      // Ya confirmado
      if (deposit.status === 'confirmed') {
        const user = await users.findOne({ telegramId: tid });
        return res.status(200).json({ success: true, confirmed: true, newBalance: user?.balance||0 });
      }

      // Buscar la TX en la blockchain
      const adminWallet = process.env.ADMIN_TON_WALLET;
      if (adminWallet) {
        const matchedTx = await verifyTonTx(adminWallet, deposit.amountTon, deposit.createdTimestamp);

        if (matchedTx) {
          // Confirmar depósito
          await deposits.updateOne(
            { depositId },
            { $set: { status:'confirmed', confirmedAt:new Date(), tonTxHash: matchedTx.transaction_id?.hash||null } }
          );
          await users.updateOne(
            { telegramId: tid },
            { $inc: { balance: deposit.amountLechugas }, $set: { updatedAt: new Date() } }
          );
          const updatedUser = await users.findOne({ telegramId: tid });

          await notify(
            `✅ *Depósito auto-confirmado*\n\n` +
            `👤 @${deposit.username||'sin\\_username'} (ID: ${tid})\n` +
            `💰 *+${deposit.amountLechugas.toLocaleString()} 🥬* acreditadas\n` +
            `💵 ${deposit.amountTon} TON`
          );
          await notifyUser(tid,
            `✅ *¡Depósito confirmado!*\n\n` +
            `💰 *+${deposit.amountLechugas.toLocaleString()} 🥬* en tu cuenta.\n` +
            `Nuevo saldo: *${updatedUser?.balance?.toLocaleString()} 🥬* 🎉`
          );

          return res.status(200).json({ success: true, confirmed: true, newBalance: updatedUser?.balance||0 });
        }
      }

      return res.status(200).json({ success: true, confirmed: false });
    }

    // ══════════════════════════════════════════════════════
    // CONFIRMAR DEPÓSITO MANUAL (admin)
    // ══════════════════════════════════════════════════════
    if (action === 'adminConfirmDeposit') {
      const { adminKey, depositId, targetTelegramId } = body;
      if (adminKey !== process.env.ADMIN_SECRET_KEY) return res.status(401).json({ error: 'No autorizado' });

      let deposit;
      if (depositId) deposit = await deposits.findOne({ depositId });
      else if (targetTelegramId) deposit = await deposits.findOne({ telegramId: String(targetTelegramId), status: 'pending' });
      if (!deposit) return res.status(404).json({ error: 'Depósito no encontrado' });
      if (deposit.status === 'confirmed') return res.status(400).json({ error: 'Ya confirmado' });

      await deposits.updateOne({ _id: deposit._id }, { $set: { status:'confirmed', confirmedAt:new Date(), confirmedBy:'admin' } });
      await users.updateOne({ telegramId: deposit.telegramId }, { $inc: { balance: deposit.amountLechugas }, $set: { updatedAt: new Date() } });
      const updatedUser = await users.findOne({ telegramId: deposit.telegramId });
      await notifyUser(deposit.telegramId, `✅ *¡Depósito confirmado!*\n\n💰 *+${deposit.amountLechugas.toLocaleString()} 🥬* en tu cuenta.\nNuevo saldo: *${updatedUser?.balance?.toLocaleString()} 🥬* 🎉`);
      return res.status(200).json({ success: true, amountLechugas: deposit.amountLechugas, newBalance: updatedUser?.balance||0 });
    }

    // ══════════════════════════════════════════════════════
    // LISTAR DEPÓSITOS (admin)
    // ══════════════════════════════════════════════════════
    if (action === 'adminListDeposits') {
      const { adminKey } = body;
      if (adminKey !== process.env.ADMIN_SECRET_KEY) return res.status(401).json({ error: 'No autorizado' });
      const pending = await deposits.find({ status:'pending' }).sort({ createdAt:-1 }).limit(50).toArray();
      const confirmed = await deposits.find({ status:'confirmed' }).sort({ confirmedAt:-1 }).limit(20).toArray();
      return res.status(200).json({ success: true, pending, confirmed });
    }

    // ══════════════════════════════════════════════════════
    // SOLICITUD DE RETIRO
    // ══════════════════════════════════════════════════════
    if (action === 'withdraw') {
      const { walletAddress, withdrawAmount } = body;
      const user = await users.findOne({ telegramId: tid });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      const wallet = walletAddress || user.walletAddress;
      if (!wallet) return res.status(400).json({ error: 'Guarda tu wallet primero.' });
      const amount = Number(withdrawAmount);
      if (!amount || amount < 0.1) return res.status(400).json({ error: 'Monto mínimo: 0.1 TON' });
      const amountLechugas = Math.floor(amount * LECHUGAS_PER_TON);
      if (amountLechugas > (user.balance||0)) return res.status(400).json({ error: `Saldo insuficiente. Tienes ${user.balance.toLocaleString()} 🥬` });
      await users.updateOne({ telegramId: tid }, { $inc: { balance: -amountLechugas }, $set: { updatedAt: new Date() } });
      const withdrawal = { telegramId:tid, username:username||'Usuario', walletAddress:wallet, amountTON:amount, amountLechugas, status:'pending', createdAt:new Date() };
      const result = await withdrawals.insertOne(withdrawal);
      const withdrawId = result.insertedId.toString().slice(-6).toUpperCase();
      await notify(`💸 *Solicitud de retiro*\n\n👤 @${username||'sin\\_username'} (ID: ${tid})\n💰 *${amount} TON* (${amountLechugas.toLocaleString()} 🥬)\n👛 \`${wallet}\`\n📋 ID: #${withdrawId}`);
      return res.status(200).json({ success: true, newBalance: (user.balance||0)-amountLechugas, withdrawId });
    }

    // ══════════════════════════════════════════════════════
    // CONFIRMAR RETIRO (admin)
    // ══════════════════════════════════════════════════════
    if (action === 'adminConfirmWithdrawal') {
      const { adminKey, withdrawalId } = body;
      if (adminKey !== process.env.ADMIN_SECRET_KEY) return res.status(401).json({ error: 'No autorizado' });
      const { ObjectId } = await import('mongodb');
      const withdrawal = await withdrawals.findOne({ _id: new ObjectId(withdrawalId) });
      if (!withdrawal) return res.status(404).json({ error: 'Retiro no encontrado' });
      if (withdrawal.status === 'completed') return res.status(400).json({ error: 'Ya procesado' });
      await withdrawals.updateOne({ _id: withdrawal._id }, { $set: { status:'completed', completedAt:new Date(), completedBy:'admin' } });
      await notifyUser(withdrawal.telegramId, `✅ *¡Retiro procesado!*\n\n💰 *${withdrawal.amountTON} TON* enviado.\n👛 ${withdrawal.walletAddress.slice(0,8)}...${withdrawal.walletAddress.slice(-6)}\n\n¡Gracias por jugar! 🎰`);
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════
    // SCRAPE RESULTS
    // ══════════════════════════════════════════════════════
    if (action === 'scrapeResults') {
      const { cronKey, targetHour, targetGame } = body;
      if (cronKey !== process.env.CRON_SECRET) return res.status(401).json({ error: 'No autorizado' });
      const now = vzNow();
      const today = vzDateStr(now);
      const hour = targetHour || now.getHours();
      const timeStr = `${String(hour).padStart(2,'0')}00`;
      const results = {};
      const gamesToProcess = targetGame ? [targetGame] : ['lotto','granja'];
      for (const game of gamesToProcess) {
        const drawId = `${game}-${today}-${timeStr}`;
        const existing = await drawResults.findOne({ drawId });
        results[game] = existing ? { status:'already_exists', drawId } : { status:'scraping_pending', drawId };
      }
      return res.status(200).json({ success: true, results, processedAt: new Date().toISOString() });
    }

    return res.status(400).json({ error: 'Acción no reconocida: ' + action });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}
