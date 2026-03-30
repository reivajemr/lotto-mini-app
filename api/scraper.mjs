// Api/scraper.mjs
// Ejecutado por los crons de Vercel 5 minutos después de cada sorteo
// Horarios UTC (Venezuela = UTC-4):
// 8AM VZ  = 12PM UTC → schedule "5 12 * * *"
// 9AM VZ  = 1PM UTC  → schedule "5 13 * * *"
// ... etc.

export default async function handler(req, res) {
  // Vercel Cron envía el header Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers['authorization'] || '';
  const cronKey    = process.env.CRON_SECRET;

  // Permitir también llamadas POST directas con cronKey en el body (para pruebas)
  const bodyKey = req.body?.cronKey;

  if (authHeader !== `Bearer ${cronKey}` && bodyKey !== cronKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // Calcular qué hora de sorteo corresponde ahora en Venezuela (UTC-4)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
    const hour = now.getHours();

    // Solo procesar entre 8AM y 8PM Venezuela
    if (hour < 8 || hour > 19) {
      return res.status(200).json({ ok: true, message: `Fuera de horario (hora VZ: ${hour})` });
    }

    // El cron se ejecuta 5 min después del sorteo, así que la hora actual es la hora del sorteo
    const targetHour = hour;

    // URL base del propio proyecto (para llamar a /api/user)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL
      : 'https://lotto-mini-app-git-main-reivajemrs-projects.vercel.app';

    // Procesar ambos juegos en paralelo
    const [resLotto, resGranja] = await Promise.all([
      fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: 'system',
          action: 'scrapeResults',
          cronKey,
          targetHour,
          targetGame: 'lotto',
        }),
      }),
      fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: 'system',
          action: 'scrapeResults',
          cronKey,
          targetHour,
          targetGame: 'granja',
        }),
      }),
    ]);

    const [dataLotto, dataGranja] = await Promise.all([resLotto.json(), resGranja.json()]);

    return res.status(200).json({
      ok: true,
      hour: targetHour,
      lotto:  dataLotto.results?.lotto  || null,
      granja: dataGranja.results?.granja || null,
      processedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Scraper error:', err);
    return res.status(500).json({ error: err.message });
  }
}
