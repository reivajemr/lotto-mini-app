// api/flash.mjs
// Cron que resuelve Flash Lotto cada 5 minutos
// Vercel Cron lo llama, también puede llamarse directamente

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const authHeader = req.headers['authorization'] || '';
  const cronKey = process.env.CRON_SECRET;
  const bodyKey = req.body?.cronKey;

  if (authHeader !== `Bearer ${cronKey}` && bodyKey !== cronKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Solo entre 8AM y 8PM Venezuela
    if (hour < 8 || hour >= 20) {
      return res.status(200).json({ ok: true, message: `Fuera de horario flash (${hour}:${minute} VZ)` });
    }

    // Calcular el slot de 5 minutos que ACABA de terminar
    // El cron se ejecuta en el minuto X, resolvemos el sorteo que era X - 1 min
    const resolvedMinute = Math.floor((minute - 1) / 5) * 5;
    const resolvedHour = resolvedMinute < 0 ? hour - 1 : hour;
    const finalMinute = resolvedMinute < 0 ? 55 : resolvedMinute;

    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const drawId = `flash-${dateStr}-${String(resolvedHour).padStart(2,'0')}${String(finalMinute).padStart(2,'0')}`;

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://lotto-mini-app.vercel.app';

    const resp = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId: 'system',
        action: 'resolveFlash',
        cronKey,
        drawId,
      }),
    });

    const data = await resp.json();

    return res.status(200).json({
      ok: true,
      drawId,
      time: `${resolvedHour}:${String(finalMinute).padStart(2,'0')}`,
      result: data,
    });

  } catch (err) {
    console.error('Flash cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
