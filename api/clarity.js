/* Vercel serverless function: gives admin.html your Microsoft Clarity numbers, safely.
   Why a function? The Clarity API token must stay secret, and Clarity only allows 10 API calls per day,
   so this keeps the token on the server, checks that the caller is really YOU (Supabase login), and caches answers.
   Vercel -> Project -> Settings -> Environment Variables (then redeploy):
     CLARITY_API_TOKEN   Clarity -> Settings -> Data Export -> Generate new API token   (mark as Sensitive)
     SUPABASE_URL        your Project URL (same as config.js)
     SUPABASE_ANON_KEY   your anon/publishable key (same as config.js)
     OWNER_EMAIL         optional, defaults to work.austingarcia@gmail.com
     ALLOWED_ORIGINS     optional, comma-separated; defaults to the two site addresses below */

const DEFAULT_ORIGINS = 'https://pensiveaustin.github.io,https://austin-garcia-portfolio.vercel.app';
const CLARITY = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const TTL = 15 * 60 * 1000;                       // reuse an answer for 15 min -> protects the 10 calls/day quota
const cache = new Map();                          // key -> { at, body }
const DIMS = { device: 'Device', country: 'Country/Region', browser: 'Browser', source: 'Source', url: 'URL' };

module.exports = async (req, res) => {
  const allowed = String(process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
  /* Browsers don't send an Origin header on same-origin GET requests (admin.html and this function on the same Vercel address),
     so fall back to the Referer. The Supabase owner check below is the real lock; this is just an extra layer. */
  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) { try { origin = new URL(req.headers.referer).origin; } catch (e) {} }
  const ok = allowed.includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  if (req.method !== 'GET' || !ok) { return res.status(403).json({ error: 'not allowed' }); }

  const { CLARITY_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!CLARITY_API_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'not configured', hint: 'Set CLARITY_API_TOKEN, SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then redeploy.' });
  }

  /* 1. is the caller the site owner? ask Supabase who this login token belongs to */
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) { return res.status(401).json({ error: 'sign in first' }); }
  let email = '';
  try {
    const u = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + bearer } });
    if (!u.ok) { return res.status(401).json({ error: 'sign in again' }); }
    email = String((await u.json()).email || '').toLowerCase();
  } catch (e) { return res.status(502).json({ error: 'could not verify login' }); }
  const owner = String(process.env.OWNER_EMAIL || 'work.austingarcia@gmail.com').toLowerCase();
  if (email !== owner) { return res.status(403).json({ error: 'owner only' }); }

  /* 2. validated query -> Clarity (cached) */
  const days = ['1', '2', '3'].includes(String(req.query.days)) ? String(req.query.days) : '3';
  const dim = DIMS[String(req.query.by || '').toLowerCase()] || '';
  const key = days + '|' + dim;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) { return res.status(200).json({ cached: true, data: hit.body }); }

  const url = CLARITY + '?numOfDays=' + days + (dim ? '&dimension1=' + encodeURIComponent(dim) : '');
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + CLARITY_API_TOKEN, 'Content-Type': 'application/json' } });
    if (r.status === 429) {
      return res.status(hit ? 200 : 429).json(hit ? { cached: true, stale: true, data: hit.body } : { error: 'Clarity daily limit reached (10 calls/day). Try again tomorrow.' });
    }
    if (!r.ok) { return res.status(502).json({ error: 'Clarity said ' + r.status + (r.status === 401 ? ' — check CLARITY_API_TOKEN' : '') }); }
    const body = await r.json();
    cache.set(key, { at: Date.now(), body });
    return res.status(200).json({ cached: false, data: body });
  } catch (e) { return res.status(502).json({ error: 'Clarity unreachable' }); }
};
