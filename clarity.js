/* Microsoft Clarity loader for the PUBLIC site (index.html). Not used on admin.html on purpose,
   so your own login page is never recorded. Turns itself off when:
   - clarityProjectId in config.js is empty
   - this browser has signed in to admin.html (so your own visits don't pollute the numbers)
   - the visitor has Do Not Track switched on */
(function () {
  var id = String((window.SITE_CONFIG || {}).clarityProjectId || '').trim();
  if (!/^[a-z0-9]{6,20}$/i.test(id)) { return; }
  try { if (localStorage.getItem('ag_no_track') === '1') { return; } } catch (e) {}
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') { return; }

  /* official Clarity snippet */
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
})();
