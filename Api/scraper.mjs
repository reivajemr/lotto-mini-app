// Api/scraper.mjs
// ══════════════════════════════════════════════════════════════
// SCRAPER INTELIGENTE DE RESULTADOS
//
// ¿CUÁNDO se activa?
//   → Vercel Cron lo llama SOLO en los minutos exactos donde
//     hay un resultado pendiente (5 min después de cada sorteo):
//     08:05, 09:05, 10:05, 11:05, 12:05, 13:05,
//     14:05, 15:05, 16:05, 17:05, 18:05, 19:05
//
// ¿QUÉ hace?
//   1. Raspa losanimalitos.net (fuente primaria - tiene AMBOS juegos)
//   2. Verifica con loteriadehoy.com/lottoactivo (fuente secundaria lotto)
//   3. Verifica con loteriadehoy.com/lagranjita  (fuente secundaria granja)
//   4. Solo guarda si AL MENOS 2 fuentes coinciden (o si solo hay 1 disponible)
//   5. Paga apuestas ganadoras automáticamente
//   6. Notifica ganadores por Telegram
//
// FUENTES:
//   Primaria (ambos):  losanimalitos.net/Resultados-Animalitos-LottoActivo
//     → HTML: img src="lottoactivo/imagenes/N.png"  por hora en orden
//     → HTML: img src="lagranjita/imagenes/N.png"   por hora en orden
//
//   Secundaria lotto:  loteriadehoy.com/animalito/lottoactivo/resultados/
//     → HTML: <h4>28 Zamuro</h4> <h5>Lotto Activo 08:00 AM</h5>
//
//   Secundaria granja: loteriadehoy.com/animalito/lagranjita/resultados/YYYY-MM-DD/
//     → HTML: <h4>2 Toro</h4> <h5>La Granjita 08:00 AM</h5>
//
// ══════════════════════════════════════════════════════════════

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) {
    try { await cachedClient.db('admin').command({ ping: 1 }); return cachedClient; }
    catch { cachedClient = null; }
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  await client.connect();
  cachedClient = client;
  return client;
}

// ── Mapa número → nombre animal ──────────────────────────────
const ANIMALS_MAP = {
  1:'Carnero', 2:'Toro',      3:'Ciempiés',   4:'Alacrán',   5:'León',
  6:'Rana',    7:'Perico',    8:'Ratón',       9:'Águila',   10:'Tigre',
  11:'Gato',  12:'Caballo',  13:'Mono',       14:'Paloma',   15:'Zorro',
  16:'Oso',   17:'Pavo',     18:'Burro',      19:'Chivo',    20:'Cochino',
  21:'Gallo', 22:'Camello',  23:'Zebra',      24:'Iguana',   25:'Gavilán',
  26:'Murciélago', 27:'Perro', 28:'Venado',   29:'Morrocoy', 30:'Caimán',
  31:'Anteater',32:'Serpiente',33:'Lechuza',  34:'Loro',     35:'Jirafa',
  36:'Culebra', 0:'Ballena',  37:'Zamuro',
};

// Nombres alternativos que usan las fuentes (normalizar)
const NAME_ALIASES = {
  'zamuro': 'Venado',   // loteriadehoy usa "Zamuro" para el 28 a veces — verificar
  'cebra': 'Zebra',
  'ballena': 'Ballena',
  'venado': 'Venado',
};

const DRAW_TIMES = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];
const MULTIPLIER = 30;

function vzNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
}
function vzToday() {
  const n = vzNow();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — llamado por Vercel Cron
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {

  // ── Seguridad: solo Vercel Cron o llamada manual con clave ──
  const authHeader = req.headers['authorization'] || '';
  const cronSecret = process.env.CRON_SECRET || '';

  const isVercelCron = authHeader === `Bearer ${cronSecret}`;
  const isManual = req.method === 'POST' && req.body?.cronKey === cronSecret;

  if (!isVercelCron && !isManual) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const now = vzNow();
  const today = vzToday();
  const currentHour = now.getHours();
  const currentMin  = now.getMinutes();

  // ── Determinar qué sorteos buscar ahora ─────────────────────
  // Solo buscamos sorteos cuyo resultado debería estar disponible:
  // → Resultado se publica 5 minutos DESPUÉS del sorteo
  // → El cron corre en minuto :05 de cada hora de sorteo
  // → Buscamos todos los sorteos ya pasados que aún no tienen resultado
  const targetDraws = [];

  for (const time of DRAW_TIMES) {
    const [h, m] = time.split(':').map(Number);
    const drawTime = new Date(now);
    drawTime.setHours(h, m, 0, 0);
    const resultAvailableAt = new Date(drawTime.getTime() + 5 * 60 * 1000); // +5 min

    // El resultado ya debería estar disponible Y el sorteo ya pasó
    if (now >= resultAvailableAt) {
      targetDraws.push({ time, drawHour: h, drawMin: m });
    }
  }

  if (targetDraws.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'Ningún sorteo con resultado disponible aún',
      vzTime: now.toLocaleString('es-VE'),
    });
  }

  // ── Conectar MongoDB ─────────────────────────────────────────
  let client;
  try { client = await getClient(); }
  catch (err) { return res.status(500).json({ error: 'MongoDB: ' + err.message }); }

  const db = client.db('animalito_db');
  const drawResults = db.collection('draw_results');

  // ── Fetch de las 3 fuentes en paralelo ──────────────────────
  const [primaryHtml, secondaryLottoHtml, secondaryGranjaHtml] = await Promise.allSettled([
    fetchHtml('https://losanimalitos.net/Resultados-Animalitos-LottoActivo'),
    fetchHtml('https://loteriadehoy.com/animalito/lottoactivo/resultados/'),
    fetchHtml(`https://loteriadehoy.com/animalito/lagranjita/resultados/${today}/`),
  ]);

  // ── Parsear cada fuente ──────────────────────────────────────
  const primary   = primaryHtml.status   === 'fulfilled' ? parsePrimary(primaryHtml.value)     : { lotto: [], granja: [] };
  const secLotto  = secondaryLottoHtml.status === 'fulfilled' ? parseSecondaryLotto(secondaryLottoHtml.value)   : [];
  const secGranja = secondaryGranjaHtml.status === 'fulfilled' ? parseSecondaryGranja(secondaryGranjaHtml.value) : [];

  const log = {
    vzTime:  now.toLocaleString('es-VE'),
    today,
    sources: {
      primary:       primaryHtml.status   === 'fulfilled' ? '✅ OK' : `❌ ${primaryHtml.reason?.message}`,
      secLotto:  secondaryLottoHtml.status === 'fulfilled' ? '✅ OK' : `❌ ${secondaryLottoHtml.reason?.message}`,
      secGranja: secondaryGranjaHtml.status === 'fulfilled' ? '✅ OK' : `❌ ${secondaryGranjaHtml.reason?.message}`,
    },
    primaryData:  primary,
    secLottoData: secLotto,
    secGranjaData:secGranja,
    processed: [],
    errors: [],
  };

  // ── Procesar cada sorteo pendiente ───────────────────────────
  for (const { time } of targetDraws) {
    const timeKey = time.replace(':', '');  // "08:00" → "0800"
    const drawIdLotto  = `lotto-${today}-${timeKey}`;
    const drawIdGranja = `granja-${today}-${timeKey}`;

    // Verificar si ya están guardados
    const [existsLotto, existsGranja] = await Promise.all([
      drawResults.findOne({ drawId: drawIdLotto }),
      drawResults.findOne({ drawId: drawIdGranja }),
    ]);

    // ── LOTTO ACTIVO ─────────────────────────────────────────
    if (!existsLotto) {
      const timeIndex = DRAW_TIMES.indexOf(time);
      const fromPrimary  = primary.lotto[timeIndex];           // { number, animal }
      const fromSecLotto = secLotto.find(r => r.time === time); // { number, animal, time }

      const verified = verifyResult(fromPrimary, fromSecLotto, drawIdLotto, log);

      if (verified) {
        try {
          await drawResults.insertOne({
            drawId: drawIdLotto,
            game: 'lotto',
            time,
            winnerNumber: verified.number,
            winnerAnimal: verified.animal,
            sources: verified.sources,
            publishedAt: new Date(),
          });

          const { winners, totalPaid } = await settleDrawBets(db, drawIdLotto, verified.number, verified.animal);
          log.processed.push({ drawId: drawIdLotto, ...verified, winners, totalPaid });

          if (winners > 0) {
            await notifyAdmin(
              `🎰 *Lotto Activo ${time}*\n` +
              `🏆 Ganador: *${verified.animal}* #${verified.number}\n` +
              `👥 Ganadores: ${winners} usuario(s)\n` +
              `💰 Total pagado: ${totalPaid.toLocaleString()} 🥬\n` +
              `📡 Fuentes: ${verified.sources.join(' + ')}`
            );
          }
        } catch (err) {
          log.errors.push({ drawId: drawIdLotto, error: err.message });
        }
      }
    }

    // ── LA GRANJA ────────────────────────────────────────────
    if (!existsGranja) {
      const timeIndex = DRAW_TIMES.indexOf(time);
      const fromPrimary   = primary.granja[timeIndex];
      const fromSecGranja = secGranja.find(r => r.time === time);

      const verified = verifyResult(fromPrimary, fromSecGranja, drawIdGranja, log);

      if (verified) {
        try {
          await drawResults.insertOne({
            drawId: drawIdGranja,
            game: 'granja',
            time,
            winnerNumber: verified.number,
            winnerAnimal: verified.animal,
            sources: verified.sources,
            publishedAt: new Date(),
          });

          const { winners, totalPaid } = await settleDrawBets(db, drawIdGranja, verified.number, verified.animal);
          log.processed.push({ drawId: drawIdGranja, ...verified, winners, totalPaid });

          if (winners > 0) {
            await notifyAdmin(
              `🐄 *La Granja ${time}*\n` +
              `🏆 Ganador: *${verified.animal}* #${verified.number}\n` +
              `👥 Ganadores: ${winners} usuario(s)\n` +
              `💰 Total pagado: ${totalPaid.toLocaleString()} 🥬\n` +
              `📡 Fuentes: ${verified.sources.join(' + ')}`
            );
          }
        } catch (err) {
          log.errors.push({ drawId: drawIdGranja, error: err.message });
        }
      }
    }
  }

  return res.status(200).json({ ok: true, ...log });
}

// ══════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════

// ── Fuente primaria: losanimalitos.net ───────────────────────
// HTML tiene bloques en este orden:
//   1° bloque lottoactivo  → img src="lottoactivo/imagenes/N.png"
//   2° bloque lagranjita   → img src="lagranjita/imagenes/N.png"
// Los ⏳ significan "aún sin resultado"
function parsePrimary(html) {
  const result = { lotto: [], granja: [] };

  // Extraer bloque de lotto activo (lottoactivo/imagenes/)
  // Patrón: <img src="lottoactivo/imagenes/N.png" alt="Resultado N">
  const lottoRegex = /src="lottoactivo\/imagenes\/(\d+)\.png"[^>]*alt="Resultado \d+"/g;
  let m;
  while ((m = lottoRegex.exec(html)) !== null) {
    const num = parseInt(m[1], 10);
    result.lotto.push({ number: num, animal: ANIMALS_MAP[num] || `#${num}` });
  }

  // Extraer bloque de la granjita (lagranjita/imagenes/)
  const granjaRegex = /src="lagranjita\/imagenes\/(\d+)\.png"[^>]*alt="Resultado \d+"/g;
  while ((m = granjaRegex.exec(html)) !== null) {
    const num = parseInt(m[1], 10);
    result.granja.push({ number: num, animal: ANIMALS_MAP[num] || `#${num}` });
  }

  return result;
}

// ── Fuente secundaria lotto: loteriadehoy.com ────────────────
// HTML: <h4>28 Zamuro</h4>\n<h5>Lotto Activo 08:00 AM</h5>
function parseSecondaryLotto(html) {
  const results = [];
  // Captura: número + nombre de animal + hora
  const regex = /<h4>(\d+)\s+([^<]+)<\/h4>\s*<h5>Lotto Activo\s+(\d+:\d+\s*[AP]M)<\/h5>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const num  = parseInt(m[1], 10);
    const name = normalizeName(m[2].trim());
    const time = parseTime12to24(m[3].trim()); // "08:00 AM" → "08:00"
    if (time) results.push({ number: num, animal: name, time });
  }
  return results;
}

// ── Fuente secundaria granja: loteriadehoy.com ───────────────
// HTML: <h4>2 Toro</h4>\n<h5>La Granjita 08:00 AM</h5>
function parseSecondaryGranja(html) {
  const results = [];
  const regex = /<h4>(\d+)\s+([^<]+)<\/h4>\s*<h5>(?:La Granjita|La Granja)\s+(\d+:\d+\s*[AP]M)<\/h5>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const num  = parseInt(m[1], 10);
    const name = normalizeName(m[2].trim());
    const time = parseTime12to24(m[3].trim());
    if (time) results.push({ number: num, animal: name, time });
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// VERIFICACIÓN CRUZADA
// ══════════════════════════════════════════════════════════════
// Reglas:
//   - Si ambas fuentes coinciden → ✅ Guardar con confianza alta
//   - Si solo hay una fuente disponible → ✅ Guardar (marcado como 1 fuente)
//   - Si ambas fuentes tienen resultado pero NO coinciden → ❌ NO guardar (alerta al admin)
//   - Si ninguna fuente tiene resultado → skip (aún no disponible)
function verifyResult(fromPrimary, fromSecondary, drawId, log) {

  const hasPrimary   = fromPrimary   && fromPrimary.animal;
  const hasSecondary = fromSecondary && fromSecondary.animal;

  if (!hasPrimary && !hasSecondary) {
    // Aún no hay resultado en ninguna fuente
    log.errors.push({ drawId, warning: 'Sin resultado en ninguna fuente aún' });
    return null;
  }

  if (hasPrimary && hasSecondary) {
    // Ambas tienen resultado → verificar coincidencia
    const numMatch  = fromPrimary.number === fromSecondary.number;
    const nameMatch = normalizeName(fromPrimary.animal) === normalizeName(fromSecondary.animal);

    if (numMatch || nameMatch) {
      // ✅ Coinciden → alta confianza
      return {
        number: fromPrimary.number,
        animal: fromPrimary.animal,
        sources: ['losanimalitos.net', 'loteriadehoy.com'],
        confidence: 'HIGH',
      };
    } else {
      // ❌ NO coinciden → alertar admin y NO guardar
      notifyAdmin(
        `⚠️ *CONFLICTO DE RESULTADOS* en ${drawId}\n\n` +
        `📡 losanimalitos.net: #${fromPrimary.number} ${fromPrimary.animal}\n` +
        `📡 loteriadehoy.com: #${fromSecondary.number} ${fromSecondary.animal}\n\n` +
        `❌ NO se guardó automáticamente. Verifica manualmente.`
      );
      log.errors.push({
        drawId,
        error: 'CONFLICTO',
        primary: fromPrimary,
        secondary: fromSecondary,
      });
      return null;
    }
  }

  // Solo una fuente disponible → guardar con confianza media
  const source = hasPrimary ? fromPrimary : fromSecondary;
  const sourceName = hasPrimary ? 'losanimalitos.net' : 'loteriadehoy.com';

  return {
    number: source.number,
    animal: source.animal,
    sources: [sourceName],
    confidence: 'MEDIUM',
  };
}

// ══════════════════════════════════════════════════════════════
// LIQUIDAR APUESTAS GANADORAS
// ══════════════════════════════════════════════════════════════
async function settleDrawBets(db, drawId, winnerNumber, winnerAnimal) {
  const tickets = db.collection('tickets');
  const users   = db.collection('users');

  // Buscar todos los tickets pendientes de este sorteo
  const allTickets = await tickets.find({
    drawId,
    status: 'pending',
  }).toArray();

  let winners   = 0;
  let totalPaid = 0;

  for (const ticket of allTickets) {
    let ticketWon   = false;
    let ticketPrize = 0;
    const updatedBets = [];

    // Verificar cada apuesta del ticket
    for (const bet of ticket.bets) {
      const isWinner = normalizeAnimalName(bet.animal) === normalizeAnimalName(winnerAnimal)
                    || bet.animalNumber === winnerNumber;
      const prize = isWinner ? bet.amount * MULTIPLIER : 0;

      updatedBets.push({ ...bet, won: isWinner, prize });

      if (isWinner) {
        ticketWon   = true;
        ticketPrize += prize;
      }
    }

    // Actualizar ticket
    await tickets.updateOne(
      { _id: ticket._id },
      {
        $set: {
          status: 'settled',
          bets: updatedBets,
          won: ticketWon,
          totalPrize: ticketPrize,
          winnerNumber,
          winnerAnimal,
          settledAt: new Date(),
        },
      }
    );

    // Acreditar premio si ganó
    if (ticketWon && ticketPrize > 0) {
      await users.updateOne(
        { telegramId: ticket.telegramId },
        { $inc: { balance: ticketPrize, totalWins: 1 } }
      );
      winners++;
      totalPaid += ticketPrize;

      // Notificar al ganador
      const betSummary = updatedBets
        .filter(b => b.won)
        .map(b => `  ${b.emoji || '🐾'} ${b.animal}: +${b.prize.toLocaleString()} 🥬`)
        .join('\n');

      await notifyUser(
        ticket.telegramId,
        `🎉 *¡GANASTE!*\n\n` +
        `🎰 Sorteo: ${ticket.game === 'lotto' ? 'Lotto Activo' : 'La Granja'} ${ticket.time}\n` +
        `🏆 Salió: *${winnerAnimal}* #${winnerNumber}\n\n` +
        `*Tus animales ganadores:*\n${betSummary}\n\n` +
        `💰 *Total ganado: +${ticketPrize.toLocaleString()} 🥬*\n\n` +
        `🎟️ Ticket: \`${ticket.ticketId}\``
      );
    }
  }

  // Marcar tickets perdedores
  await tickets.updateMany(
    { drawId, status: 'pending' },
    { $set: { status: 'settled', won: false, totalPrize: 0, winnerNumber, winnerAnimal, settledAt: new Date() } }
  );

  return { winners, totalPaid };
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15000), // timeout 15s
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} en ${url}`);
  return await resp.text();
}

// "08:00 AM" → "08:00" | "01:00 PM" → "13:00"
function parseTime12to24(timeStr) {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2].padStart(2,'0');
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${min}`;
}

function normalizeName(name) {
  const lower = name.toLowerCase().trim();
  return NAME_ALIASES[lower] || (name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
}

function normalizeAnimalName(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar tildes
}

async function notifyAdmin(text) {
  const token  = process.env.TOKEN_BOT;
  const chatId = process.env.ID_DE_CHAT;
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
