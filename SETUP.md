# Status light — setup (10 minutes, free)

Your site now shows a green (available) or red (busy) light. You change it from a private
page, `admin.html`, and the live site updates for every visitor — no re-uploading files.

How it works: a tiny Supabase table holds your status. Everyone can *read* it; only *you*
(signed in) can change it.

## 1. Create the backend
1. Go to https://supabase.com → **New project** (free plan is fine). Pick any name/region (Singapore is closest).
2. Open **SQL Editor → New query**, paste everything from `supabase-setup.sql`, press **Run**.
   You should see "Success".

## 2. Create your admin login
1. **Authentication → Users → Add user → Create new user.**
   Use `work.austingarcia@gmail.com` (the email written in the SQL) and a **strong password**.
   Tick **Auto Confirm User**.
2. **Authentication → Sign In / Providers → Email** → turn **OFF** "Allow new users to sign up".
   (So nobody else can ever create an account.)

> Using a different email? Change it in the two `auth.jwt() ->> 'email'` lines in the SQL *before* running it.

## 3. Connect the site
1. **Project Settings → API** (or **API Keys**). Copy:
   - **Project URL**
   - the **anon / publishable** key  ← safe to be public
2. Open `config.js` and paste them in place of `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`.
3. Upload everything to GitHub as usual.

**Never** put the `service_role` / `secret` key anywhere in these files.

## 4. Use it
Open `https://pensiveaustin.github.io/austin-portfolio/admin.html`, sign in, tap
**Available** or **Busy**, optionally add a message, press **Save & go live**.
Bookmark the page — it isn't linked from your site and search engines are told to ignore it.

## What visitors see
- A glowing light on your logo in the nav (green pulses, red stays steady)
- A status chip under the banner: "Available for projects" / "Currently busy"
- A box above the contact form with your message
- Your pixel bot next to the status chip in the hero: it pops up a speech bubble with your message about 1.5 s after the page loads (once per visit for each message), closes itself after 9 s, and reopens when clicked. Busy shows the bot typing on a laptop; available shows the waving, jumping bot.

If Supabase is ever unreachable, the site shows the last status the visitor saw, or hides the
light — it never shows a wrong status or breaks the page.

## Files
- `admin.html` — your private control page
- `config.js` — your two Supabase values
- `status.js` — reads the status for the public site
- `status-bot.js` — the pop-up bubble behaviour (the bot art and styles live in `index.html`)
- `supabase-setup.sql` — run once in Supabase

## Discord DM alerts (optional)
`api/notify.js` is a Vercel function. When a visitor sends the contact form, your Discord bot DMs you the name, email and message.
Set `DISCORD_BOT_TOKEN` and `DISCORD_USER_ID` under Vercel > Project > Settings > Environment Variables, then **redeploy**.
`notifyUrl` in `config.js` points the form at it (blank = off).

## Visitor analytics — your own, inside admin.html (free)
`index.html` quietly logs each visit to your Supabase, and the **Visitors** card in `admin.html` shows it:
visitors, page views, time on site, scroll depth, which sections people reach, what they click, countries, devices, sources and the latest visits.
No third-party account, no cookies, no IP addresses saved.

1. **Supabase → SQL Editor → New query**: paste everything from `supabase-analytics.sql` → **Run**. (Same owner email as the status light.)
2. **Vercel → Project → Settings → Environment Variables**, add:
   - `SUPABASE_URL` — your Project URL (same as `config.js`)
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → the **service_role / secret** key. Mark it **Sensitive**.
   This key lives ONLY in Vercel. Never paste it into `config.js` or any uploaded file.
3. **Redeploy** on Vercel so `api/hit.js` picks the variables up.
4. Upload the updated files to GitHub as usual. `trackUrl` in `config.js` already points at `/api/hit`; set it to `''` to switch tracking off.
5. Open your site in a private window, scroll around, then open admin.html — your visit shows under **Latest visits**.

Notes
- Once you've signed in to admin.html in a browser, that browser's own visits are no longer counted. Visitors with Do Not Track, bots and crawlers are skipped.
- Country comes from Vercel, so it works for visitors who reach the site through Vercel's network. If a visit shows "Unknown", that's why.
- To keep the table small, run the commented `delete` line at the bottom of `supabase-analytics.sql` once in a while.
- Files: `track.js` (runs on your public site), `api/hit.js` (saves visits), `supabase-analytics.sql` (table + report), `admin.html` (the dashboard).
