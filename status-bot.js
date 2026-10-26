/* Shows the availability message as a small pop-up from the pixel bot next to the status chip.
   The text itself is filled in by status.js (textContent only), so nothing typed in admin can inject HTML. */
(function () {
  var wrap = document.getElementById('btWrap');
  if (!wrap) { return; }
  var btn = document.getElementById('btBtn'), bub = document.getElementById('btBubble'), closeBtn = document.getElementById('btX');
  var msgEl = bub.querySelector('[data-status-msg]');
  var root = document.documentElement, SEEN = 'ag_bot_seen_v1', row = wrap.parentNode;
  var autoTimer = null, hideTimer = null, kickTimer = null, userOpened = false;

  function sig() { return (root.getAttribute('data-status') || '') + '|' + (msgEl.textContent || ''); }
  function seen(v) { try { if (v === undefined) { return sessionStorage.getItem(SEEN); } sessionStorage.setItem(SEEN, v); } catch (e) {} return null; }
  function isOpen() { return bub.classList.contains('is-open'); }

  function place() {                       /* beside the bot if there is room, otherwise hanging below it */
    var rr = row.getBoundingClientRect(), br = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    bub.classList.remove('bt-side', 'bt-up'); bub.style.top = ''; bub.style.left = '0px';
    var w = bub.offsetWidth, h = bub.offsetHeight, cx = br.left + br.width / 2 - rr.left;
    if (br.right + 14 + w <= vw - 12) {
      bub.classList.add('bt-side');
      bub.style.left = (br.right - rr.left + 14) + 'px';
      var cy = br.top + br.height / 2 - rr.top;
      bub.style.top = Math.max(0, cy - 22) + 'px';
      bub.style.setProperty('--ty', (cy - Math.max(0, cy - 22)) + 'px');
      return;
    }
    var left = cx - 36;
    left = Math.max(12 - rr.left, Math.min(left, vw - 12 - w - rr.left));
    bub.style.left = left + 'px';
    bub.style.setProperty('--tx', Math.max(16, Math.min(cx - left, w - 26)) + 'px');
    var nav = document.getElementById('nav'), navB = nav ? nav.getBoundingClientRect().bottom : 72;
    if (br.top - h - 14 >= navB + 6) {      /* room above: sit over the banner, not the headline */
      bub.classList.add('bt-up');
      bub.style.top = (br.top - rr.top - h - 12) + 'px';
    }
  }
  function open(auto) {
    clearTimeout(hideTimer); clearTimeout(autoTimer);
    bub.hidden = false; place();
    requestAnimationFrame(function () { requestAnimationFrame(function () { bub.classList.add('is-open'); }); });
    btn.setAttribute('aria-expanded', 'true');
    if (auto) { autoTimer = setTimeout(close, 9000); }
  }
  function close() {
    clearTimeout(autoTimer);
    bub.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); seen(sig());
    hideTimer = setTimeout(function () { if (!isOpen()) { bub.hidden = true; } }, 260);
  }

  btn.addEventListener('click', function (e) { e.stopPropagation(); if (isOpen()) { close(); } else { userOpened = true; open(false); } });
  closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
  document.addEventListener('click', function (e) { if (isOpen() && !bub.contains(e.target)) { close(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { close(); btn.focus(); } });
  window.addEventListener('resize', function () { if (isOpen()) { place(); } });

  function maybeAutoOpen() {               /* pop up once per session per message, only if the chip is on screen */
    if (!root.getAttribute('data-status') || !msgEl.textContent || isOpen() || userOpened) { return; }
    if (seen() === sig()) { return; }
    var r = row.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { return; }
    open(true);
  }
  function schedule() { clearTimeout(kickTimer); kickTimer = setTimeout(maybeAutoOpen, 1600); }

  var mo = new MutationObserver(function () {
    schedule();
    if (isOpen() && !userOpened) { place(); }
  });
  mo.observe(root, { attributes: true, attributeFilter: ['data-status'] });
  mo.observe(msgEl, { childList: true, characterData: true, subtree: true });
  schedule();
})();
