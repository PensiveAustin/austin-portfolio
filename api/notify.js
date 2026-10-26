/* Vercel serverless function: your Discord bot DMs you whenever someone sends your portfolio contact form.
   Vercel -> Project -> Settings -> Environment Variables:
     DISCORD_BOT_TOKEN   the bot's token         (mark as Sensitive)
     DISCORD_USER_ID     your own Discord user ID
     ALLOWED_ORIGINS     optional, comma-separated; defaults to the two site addresses below */

const API = 'https://discord.com/api/v10';
const DEFAULT_ORIGINS = 'https://pensiveaustin.github.io,https://austin-garcia-portfolio.vercel.app';
const oneLine = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, n);
const multiLine = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, n);

module.exports = async (req, res) => {
  const allowed = String(process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const ok = allowed.includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  if (req.method !== 'POST' || !ok) { return res.status(403).json({ ok: false, error: 'not allowed' }); }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || typeof d !== 'object') { return res.status(400).json({ ok: false, error: 'bad request' }); }
  if (d.botcheck) { return res.status(200).json({ ok: true }); }        // hidden spam checkbox was ticked: pretend success

  const name = oneLine(d.name, 80), email = oneLine(d.email, 120), message = multiLine(d.message, 1000);
  if (!name || !email || !message) { return res.status(400).json({ ok: false, error: 'missing fields' }); }

  const headers = {
    'Authorization': 'Bot ' + process.env.DISCORD_BOT_TOKEN,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://austin-garcia-portfolio.vercel.app, 1.0)'
  };
  let sent = false, why = '';
  try {
    const dm = await fetch(API + '/users/@me/channels', { method: 'POST', headers, body: JSON.stringify({ recipient_id: process.env.DISCORD_USER_ID }) });
    const ch = await dm.json().catch(() => ({}));
    if (!dm.ok || !ch.id) { why = 'open DM failed ' + dm.status; }
    else {
      const r = await fetch(API + '/channels/' + ch.id + '/messages', {
        method: 'POST', headers,
        body: JSON.stringify({
          content: '\u{1F4E9} New portfolio inquiry from ' + name,
          embeds: [{ color: 0x4A8FE0, fields: [
            { name: 'Name', value: name },
            { name: 'Email', value: email },
            { name: 'Message', value: message }
          ] }],
          allowed_mentions: { parse: [] }                               // visitor text can never ping @everyone
        })
      });
      sent = r.ok; if (!r.ok) { why = 'send failed ' + r.status; }
    }
  } catch (e) { why = 'discord unreachable'; }
  if (!sent) { console.error('notify failed:', why); }
  return res.status(sent ? 200 : 502).json({ ok: sent });
};
