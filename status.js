/* Reads your availability from Supabase and lights up the green / red status light.
   Everything is written with textContent, so nothing typed in the admin can inject HTML. */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var root = document.documentElement;
  var KEY = 'ag_site_status_v1';
  var COPY = {
    available: { label: 'Available for projects', msg: 'Open to new projects \u2014 send me a message.' },
    busy:      { label: 'Currently busy', msg: "Fully booked right now \u2014 you can still send a message and I'll reply when I'm free." }
  };

  function each(sel, fn){ Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  function apply(s){
    if(!s || !COPY[s.state]){ return false; }
    var text = (typeof s.message === 'string' && s.message.trim()) ? s.message.trim().slice(0, 160) : COPY[s.state].msg;
    root.setAttribute('data-status', s.state);
    each('[data-status-label]', function(el){ el.textContent = COPY[s.state].label; });
    each('[data-status-msg]',   function(el){ el.textContent = text; });
    each('.status-chip, .avatar .led', function(el){ el.setAttribute('title', COPY[s.state].label + ' \u2014 ' + text); });
    return true;
  }

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
  if(cached){ apply(cached); }

  var url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  var key = String(cfg.supabaseAnonKey || '');
  if(!url || !key || /YOUR_SUPABASE/.test(url + key)){      /* backend not connected yet */
    if(!cached){ apply(cfg.fallback || { state: 'available' }); }
    return;
  }

  function load(){
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function(){ if(ctrl){ ctrl.abort(); } }, 6000);
    fetch(url + '/rest/v1/site_status?id=eq.1&select=state,message', {
      headers: { apikey: key, Accept: 'application/json' }, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined
    })
    .then(function(r){ if(!r.ok){ throw new Error('status ' + r.status); } return r.json(); })
    .then(function(rows){
      var s = rows && rows[0];
      if(apply(s)){ try { localStorage.setItem(KEY, JSON.stringify({ state: s.state, message: s.message })); } catch(e) {} }
    })
    .catch(function(){ /* offline or backend down: keep the cached value, or stay hidden */ })
    .then(function(){ clearTimeout(timer); });
  }
  load();
  document.addEventListener('visibilitychange', function(){ if(!document.hidden){ load(); } });
})();
