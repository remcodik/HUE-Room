/**
 * Vercel serverless function — Hue OAuth token exchange proxy
 *
 * Handles both:
 *   grant_type=authorization_code  (first login)
 *   grant_type=refresh_token       (token refresh)
 *
 * Required Vercel environment variables:
 *   HUE_CLIENT_ID      — from developers.meethue.com
 *   HUE_CLIENT_SECRET  — from developers.meethue.com
 */
export default async function handler(req, res) {
  const clientId = process.env.HUE_CLIENT_ID;
  const clientSecret = process.env.HUE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server niet geconfigureerd – voeg HUE_CLIENT_ID en HUE_CLIENT_SECRET toe als Vercel environment variables.' });
  }

  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { grant_type, code, refresh_token } = req.method === 'POST'
    ? req.body
    : req.query;

  if (!grant_type) {
    return res.status(400).json({ error: 'grant_type is verplicht' });
  }

  const body = new URLSearchParams({ grant_type });
  if (grant_type === 'authorization_code') {
    if (!code) return res.status(400).json({ error: 'code is verplicht' });
    body.append('code', code);
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token is verplicht' });
    body.append('refresh_token', refresh_token);
  } else {
    return res.status(400).json({ error: 'Ongeldig grant_type' });
  }

  try {
    const tokenRes = await fetch('https://api.meethue.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await tokenRes.json();
    return res.status(tokenRes.ok ? 200 : tokenRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Hue API niet bereikbaar', detail: err.message });
  }
}
