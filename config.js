/* ──────────────────────────────────────────────────────────────
   Site settings. Fill these two values in AFTER you set up Supabase
   (see SETUP.md). Both are safe to be public — they're not secrets.
   ────────────────────────────────────────────────────────────── */
window.SITE_CONFIG = {
  // Supabase → Project Settings → API → "Project URL"
  supabaseUrl: 'YOUR_SUPABASE_URL',

  // Supabase → Project Settings → API → "anon public" key (or the "Publishable" key)
  // NEVER paste the "service_role" / "secret" key here.
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',

  // Shown until the backend is connected (so the site still works out of the box)
  fallback: { state: 'available', message: '' }
};
