/* Vercel serverless function: saves one anonymous visit event for your own analytics (shown in admin.html).
   Stores NO IP address and sets NO cookies. Country comes from Vercel's edge header.
   Vercel -> Project -> Settings -> Environment Variables (then redeploy):
     SUPABASE_URL                your Project URL (same as config.js)
     SUPABASE_SERVICE_ROLE_KEY   Supabase -> Project Settings -> API -> service_role / secret key   (mark as Sensitive!)
                                 It lives ONLY here in Vercel. Never put it in config.js or any uploaded file.
     ALLOWED_ORIGINS             optional, comma-separated; defaults to the two site addresses below */

const DEFAULT_ORIGINS = 'https://pensiveaustin.github.io,https://austin-garcia-portfolio.vercel.app';
const TYPES = ['view', 'engage', 'click', 'section'];
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|facebookexternalhit|embedly|whatsapp|telegram|discord/i;
const seen = new Map();                                   // ip -> { n, t }   (kept in memory only, never stored)

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F<>]+/g, ' ').trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

function parseUA(ua) {
  const mobile = /Mobi|iPhone|iPod|Android.+Mobile/i.test(ua);
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const device = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
  let browser = 'Other';
  if (/FBAN|FBAV|Instagram|Line\/|LinkedInApp|Messenger/i.test(ua)) browser = 'In-app';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';
  let os = 'Other';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { device, browser, os };
}

module.exports = async (req, res) => {
  const allowed = String(process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const ok = allowed.includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  if (req.method !== 'POST' || !ok) { return res.status(403).json({ ok: false }); }

  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua)) { return res.status(204).end(); }            // crawlers and scripts are ignored

  /* gentle rate limit: 90 events / minute / visitor address */
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const rec = seen.get(ip);
  if (!rec || now - rec.t > 60000) { seen.set(ip, { n: 1, t: now }); } else if (++rec.n > 90) { return res.status(429).json({ ok: false }); }
  if (seen.size > 5000) { seen.clear(); }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || typeof d !== 'object') { return res.status(400).json({ ok: false }); }

  const id = /^[a-z0-9]{8,40}$/i;
  if (!TYPES.includes(d.t) || !id.test(String(d.v)) || !id.test(String(d.s)) || !id.test(String(d.pv || 'xxxxxx'))) { return res.status(400).json({ ok: false }); }

  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const row = {
    type: d.t, visitor_id: d.v, session_id: d.s, pv: d.pv || null,
    path: clean(d.p, 200).split(/[?#]/)[0] || '/',
    referrer: d.t === 'view' ? (clean(d.r, 100) || null) : null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    seconds: d.t === 'engage' ? int(d.sec, 0, 7200) : null,
    scroll: d.t === 'engage' ? int(d.sc, 0, 100) : null,
    target: (d.t === 'click' || d.t === 'section') ? (clean(d.tg, 80) || null) : null
  };
  if (d.t === 'view') { Object.assign(row, parseUA(ua)); }

  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) { console.error('hit: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); return res.status(503).json({ ok: false }); }

  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (key.startsWith('eyJ')) { headers.Authorization = 'Bearer ' + key; }   // legacy JWT-style keys need this; new sb_secret_ keys don't

  try {
    const r = await fetch(base + '/rest/v1/analytics_events', { method: 'POST', headers, body: JSON.stringify(row) });
    if (!r.ok) { console.error('hit: supabase said', r.status, (await r.text()).slice(0, 200)); return res.status(502).json({ ok: false }); }
  } catch (e) { console.error('hit: supabase unreachable'); return res.status(502).json({ ok: false }); }
  return res.status(204).end();
};
