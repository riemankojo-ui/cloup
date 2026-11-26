// Cloup cloud backup v2 (Supabase REST, no library needed)
(function () {
  const SB_URL = 'https://wunxnpjpdcpvhvghgxxx.supabase.co';
  const SB_KEY = 'sb_publishable_mhKsiozlMOcwnI5IrH6EEg_aPnk3UVG';
  const SESSION_KEY = 'cloup_session';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }

  async function authCall(path, body) {
    const res = await fetch(SB_URL + '/auth/v1/' + path, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'Login failed');
    return data;
  }

  async function ensureLogin() {
    let s = getSession();
    if (s && s.refresh_token) {
      try {
        s = await authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
        saveSession(s);
        return s;
      } catch (e) { /* fall through to login */ }
    }
    const email = prompt('Email for your Cloup account:');
    if (!email) throw new Error('Cancelled');
    const password = prompt('Password (min 6 characters):');
    if (!password) throw new Error('Cancelled');
    try {
      s = await authCall('token?grant_type=password', { email, password });
    } catch (e) {
      s = await authCall('signup', { email, password });
      if (!s.access_token) throw new Error('Check your email to confirm, then try again.');
    }
    saveSession(s);
    return s;
  }

  function headers(s, extra) {
    return Object.assign({
      apikey: SB_KEY,
      Authorization: 'Bearer ' + s.access_token,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  async function rest(s, path, opts) {
    const res = await fetch(SB_URL + '/rest/v1/' + path, Object.assign({ headers: headers(s) }, opts));
    if (!res.ok) throw new Error(await res.text());
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  // ---------- Home screen: storage meter + last backup ----------
  async function refreshHome(s) {
    try {
      const prof = (await rest(s, 'profiles?select=storage_used_bytes,storage_limit_bytes'))[0];
      if (prof) {
        const gb = n => (n / 1073741824).toFixed(1).replace(/\.0$/, '');
        const amount = document.querySelector('.storage-amount');
        if (amount) amount.textContent = gb(prof.storage_used_bytes) + ' / ' + gb(prof.storage_limit_bytes) + ' GB';
        const fill = document.querySelector('.progress-fill');
        if (fill) fill.style.width = Math.min(100, prof.storage_used_bytes / prof.storage_limit_bytes * 100) + '%';
      }
      const last = await rest(s, 'app_backups?select=updated_at&order=updated_at.desc&limit=1');
      const label = document.getElementById('last-backup');
      if (label && last && last.length) label.textContent = 'Last backup: ' + new Date(last[0].updated_at).toLocaleString();
    } catch (e) { console.error('Home refresh failed', e); }
  }

  // ---------- BACKUP ----------
  async function cloudBackup() {
    try {
      const s = await ensureLogin();
      const now = new Date().toISOString();
      const apps = (window.CLOUP_DEVICE_APPS || []).map(a => ({
        user_id: s.user.id,
        pkg: a.pkg,
        name: a.name,
        play_url: a.playUrl || ('https://play.google.com/store/apps/details?id=' + a.pkg),
        icon_b64: a.icon || null,
        updated_at: now
      }));
      for (let i = 0; i < apps.length; i += 25) {
        await rest(s, 'app_backups?on_conflict=user_id,pkg', {
          method: 'POST',
          headers: headers(s, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(apps.slice(i, i + 25))
        });
      }
      await refreshHome(s);
      alert('Backup done: ' + apps.length + ' apps saved.');
    } catch (e) {
      alert('Backup failed: ' + e.message);
    }
  }

  // ---------- RESTORE (DROP HERE) ----------
  async function cloudRestore() {
    try {
      const s = await ensureLogin();
      const rows = await rest(s, 'app_backups?select=pkg,name,play_url,icon_b64&order=name.asc');
      if (!rows.length) { alert('No backup found for this account.'); return; }
      const apps = rows.map(r => ({ pkg: r.pkg, name: r.name, playUrl: r.play_url, icon: r.icon_b64 }));
      window.CLOUP_RESTORED_APPS = apps;
      if (typeof renderMyPlayApps === 'function') renderMyPlayApps(apps);
      await rest(s, 'restore_history', {
        method: 'POST',
        headers: headers(s, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          user_id: s.user.id,
          device_name: (navigator.userAgent.match(/\(([^)]+)\)/) || [])[1] || 'Phone',
          apps_count: apps.length
        })
      });
      alert('Restored ' + apps.length + ' apps. Open My Play to reinstall them.');
    } catch (e) {
      alert('Restore failed: ' + e.message);
    }
  }

  window.cloudBackup = cloudBackup;
  window.cloudRestore = cloudRestore;

  // update the Home meter on launch if already logged in
  window.addEventListener('load', async function () {
    if (!getSession()) return;
    try { refreshHome(await ensureLogin()); } catch (e) {}
  });
})();
