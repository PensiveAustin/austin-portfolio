/* ──────────────────────────────────────────────────────────────
   Site settings. Both values below are PUBLIC by design (safe to upload).
   NEVER paste a "secret" or "service_role" key into this file.
   ────────────────────────────────────────────────────────────── */
window.SITE_CONFIG = {
  supabaseUrl: 'https://zpqujmxsqnezmopumuxf.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcXVqbXhzcW5lem1vcHVtdXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDUyNDEsImV4cCI6MjEwODU4MTI0MX0.SV-HV1uKszaMgdm29_p_XFkHRS6cczXmjOaSSMFvnS4',

  // Vercel function that DMs you on Discord when someone sends the contact form (leave '' to turn off)
  notifyUrl: 'https://austin-garcia-portfolio.vercel.app/api/notify',

  // Microsoft Clarity: paste your Project ID (clarity.microsoft.com -> your project -> Settings -> Overview). '' = tracking off
  clarityProjectId: '',

  // Vercel function that returns your Clarity numbers to admin.html (needs CLARITY_API_TOKEN, see SETUP.md). '' = just show dashboard links
  analyticsUrl: 'https://austin-garcia-portfolio.vercel.app/api/clarity',

  // Shown only if the backend can't be reached and nothing is cached
  fallback: { state: 'available', message: '' }
};
