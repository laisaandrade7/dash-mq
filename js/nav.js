(function () {
  /* ── Sidebar toggle ─────────────────────────────────────────────── */
  const KEY = 'sidebar-collapsed';
  const btn      = document.getElementById('sidebar-toggle-btn');
  const backdrop = document.getElementById('sidebar-backdrop');

  function isMobile() { return window.innerWidth <= 768; }

  if (!isMobile() && localStorage.getItem(KEY) === '1') {
    document.body.classList.add('sidebar-collapsed');
  }

  function closeMobile() { document.body.classList.remove('sidebar-open'); }

  if (btn) {
    btn.addEventListener('click', function () {
      if (isMobile()) {
        document.body.classList.toggle('sidebar-open');
      } else {
        var collapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(KEY, collapsed ? '1' : '0');
      }
    });
  }

  if (backdrop) backdrop.addEventListener('click', closeMobile);

  window.addEventListener('resize', function () {
    if (!isMobile()) closeMobile();
  });

  /* ── Sync button ────────────────────────────────────────────────── */
  const WORKER_URL = 'https://dash-mq-sync.laisa-andrade7.workers.dev';

  var syncButtons = [
    document.getElementById('sidebar-sync-btn'),
    document.getElementById('sync-now-btn'),
  ].filter(Boolean);

  function setSyncState(state, label) {
    syncButtons.forEach(function (b) {
      b.classList.remove('syncing', 'success', 'error');
      b.disabled = state !== 'idle';
      if (state !== 'idle') b.classList.add(state);

      var lbl = b.querySelector('.sidebar-sync-label, .sync-now-label');
      if (lbl) lbl.textContent = label;

      if (state === 'syncing') {
        b.classList.add('syncing');
      }
    });
  }

  function resetSyncState() {
    setSyncState('idle', 'Sincronizar');
  }

  syncButtons.forEach(function (b) {
    b.addEventListener('click', async function () {
      setSyncState('syncing', 'Sincronizando…');
      try {
        var res = await fetch(WORKER_URL, { method: 'POST' });
        var data = await res.json();
        if (data.ok) {
          setSyncState('success', 'Disparado!');
          setTimeout(resetSyncState, 4000);
        } else {
          throw new Error(data.error || 'Erro');
        }
      } catch (err) {
        setSyncState('error', 'Erro');
        setTimeout(resetSyncState, 4000);
      }
    });
  });

  /* ── Logout ─────────────────────────────────────────────────────── */
  var logoutBtn = document.getElementById('sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('mq_auth');
      location.replace('login.html');
    });
  }

  /* ── Último sync (carrega sales.json levemente) ─────────────────── */
  var timeEl = document.getElementById('sidebar-sync-time');
  if (timeEl) {
    fetch('data/sales.json?t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (sales) {
        if (!sales.generatedAt) return;
        var d = new Date(sales.generatedAt);
        var hh  = String(d.getUTCHours()).padStart(2, '0');
        var mm  = String(d.getUTCMinutes()).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        var mon = String(d.getUTCMonth() + 1).padStart(2, '0');
        timeEl.textContent = day + '/' + mon + ' ' + hh + ':' + mm;
      })
      .catch(function () {});
  }
})();
