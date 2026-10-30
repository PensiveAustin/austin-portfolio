/* Your own tiny analytics for the PUBLIC site (index.html). No cookies, no IP stored, no third parties.
   Sends: page view, time on page + how far they scrolled, which sections they reached, which buttons/links they click.
   Skips: your own browser once you've signed in to admin.html, Do Not Track visitors, automated browsers.
   Turn it off by setting trackUrl to '' in config.js. */
(function () {
  var url = String((window.SITE_CONFIG || {}).trackUrl || '');
  if (!/^https:\/\//.test(url)) { return; }
  try { if (localStorage.getItem('ag_no_track') === '1') { return; } } catch (e) {}
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.webdriver) { return; }

  function rid(n) {
    var s = '', a = [], i;
    try { a = crypto.getRandomValues(new Uint8Array(n)); } catch (e) { for (i = 0; i < n; i++) { a[i] = Math.floor(Math.random() * 256); } }
    for (i = 0; i < n; i++) { s += (a[i] % 36).toString(36); }
    return s;
  }
  function keep(store, key, n) {
    var v = '';
    try { v = store.getItem(key) || ''; if (!/^[a-z0-9]{8,40}$/.test(v)) { v = rid(n); store.setItem(key, v); } } catch (e) { v = v || rid(n); }
    return v;
  }
  var vid = keep(window.localStorage, 'ag_vid', 16);      /* same browser = same visitor */
  var sid = keep(window.sessionStorage, 'ag_sid', 12);    /* one per tab session */
  var pv = rid(10);                                       /* one per page load */
  var path = location.pathname || '/';

  function send(o) {
    o.v = vid; o.s = sid; o.pv = pv; o.p = path;
    try {
      fetch(url, { method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(o) }).catch(function () {});
    } catch (e) {}
  }

  /* where they came from: ?utm_source=... wins, else the referring site (not your own) */
  var ref = '';
  try {
    var q = new URLSearchParams(location.search).get('utm_source');
    if (q) { ref = 'utm:' + q.slice(0, 40); }
    else if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && h !== location.hostname.replace(/^www\./, '')) { ref = h; } }
  } catch (e) {}
  send({ t: 'view', r: ref });

  /* time on page (only while the tab is visible) + deepest scroll */
  var shown = document.visibilityState !== 'hidden' ? Date.now() : 0, secs = 0, maxScroll = 0, lastSent = '';
  function scrolled() {
    var de = document.documentElement, total = Math.max(de.scrollHeight, 1);
    var pct = Math.round(((window.pageYOffset || de.scrollTop || 0) + window.innerHeight) / total * 100);
    if (pct > maxScroll) { maxScroll = Math.min(100, pct); }
  }
  var raf = 0;
  window.addEventListener('scroll', function () { if (!raf) { raf = requestAnimationFrame(function () { raf = 0; scrolled(); }); } }, { passive: true });
  scrolled();
  function flush() {
    if (shown) { secs += (Date.now() - shown) / 1000; shown = 0; }
    var tot = Math.round(secs), sig = tot + '|' + maxScroll;
    if (tot >= 1 && sig !== lastSent) { lastSent = sig; send({ t: 'engage', sec: tot, sc: maxScroll }); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flush(); } else { shown = Date.now(); }
  });
  window.addEventListener('pagehide', flush);

  /* which sections of the page they actually reached */
  if ('IntersectionObserver' in window) {
    var done = {};
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting && id && !done[id]) { done[id] = 1; send({ t: 'section', tg: id }); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(document.querySelectorAll('section[id]'), function (s) { io.observe(s); });
  }

  /* what they click (button / link labels only, never form contents) */
  var clicks = 0;
  document.addEventListener('click', function (e) {
    if (clicks >= 30 || !e.target || !e.target.closest) { return; }
    var el = e.target.closest('a,button,[role=button]');
    if (!el) { return; }
    var label = (el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var tag = el.tagName === 'A' ? 'link' : 'button';
    if (!label && el.tagName === 'A') { label = (el.getAttribute('href') || '').slice(0, 40); }
    if (!label) { label = el.id || ''; }
    if (!label) { return; }
    var host = '';
    try { if (el.tagName === 'A' && el.hostname && el.hostname !== location.hostname) { host = ' → ' + el.hostname.replace(/^www\./, ''); } } catch (er) {}
    clicks++;
    send({ t: 'click', tg: (tag + ': ' + label + host).slice(0, 80) });
  }, true);
})();
