// api/scraper.mjs
// Ejecutado por los crons de Vercel 5 minutos después de cada sorteo
// Horarios UTC (Venezuela = UTC-4):
// 8AM VZ = 12PM UTC → schedule "5 12 * * *"
// ...etc

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Vercel Cron envía el header Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers['authorization'] || '';
  const cronKey = process.env.CRON_SECRET;

  // Permitir también llamadas POST directas con cronKey en el body (para pruebas)
  const bodyKey = req.body?.cronKey;

  if (authHeader !== `Bearer ${cronKey}` && bodyKey !== cronKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // Calcular qué hora corresponde en Venezuela (UTC-4)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
    const hour = now.getHours();

    // Solo procesar entre 8AM y 8PM Venezuela
    if (hour < 8 || hour > 19) {
      return res.status(200).json({ ok: true, message: `Fuera de horario (hora VZ: ${hour})` });
    }

    // URL base del propio proyecto
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
          targetHour: hour,
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
          targetHour: hour,
          targetGame: 'granja',
        }),
      }),
    ]);

    const [dataLotto, dataGranja] = await Promise.all([resLotto.json(), resGranja.json()]);

    return res.status(200).json({
      ok: true,
      hour,
      lotto: dataLotto?.results?.lotto || null,
      granja: dataGranja?.results?.granja || null,
      processedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Scraper error:', err);
    return res.status(500).json({ error: err.message });
  }
}
