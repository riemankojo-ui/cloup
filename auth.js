// Builds its own screen, so index.html only needs one script tag.
(function () {
  const SB_URL = 'https://wunxnpjpdcpvhvghgxxx.supabase.co';
  const SB_KEY = 'sb_publishable_mhKsiozlMOcwnI5IrH6EEg_aPnk3UVG';
  const SESSION_KEY = 'cloup_session';
  const DEEP_LINK = 'cloup://auth';

  const isNative = !!(window.Capacitor &&
    typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  const redirectTo = isNative ? DEEP_LINK : (location.origin + location.pathname);

  // ---------- session storage ----------
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(d) {
    const s = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)),
      user: d.user
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  // ---------- Supabase auth calls ----------
  function friendly(msg) {
    const m = String(msg || '');
    if (/invalid login/i.test(m)) return 'Wrong email or password.';
    if (/already registered|already been registered/i.test(m)) return 'This email already has an account. Try logging in.';
    if (/not confirmed/i.test(m)) return 'Please confirm your email first, then log in.';
    if (/password should be|at least 6/i.test(m)) return 'Password must be at least 6 characters.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Wait a minute and try again.';
    if (/valid email|invalid format/i.test(m)) return 'Enter a valid email address.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'Google login is not turned on yet.';
    return m || 'Something went wrong. Try again.';
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    let res;
    try {
      res = await fetch(SB_URL + '/auth/v1/' + path, {
        method: opts.method || 'POST',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      const err = new Error('No internet connection.');
      err.offline = true;
      throw err;
    }
    const txt = await res.text();
    let data = {};
    try { data = txt ? JSON.parse(txt) : {}; } catch (e) {}
    if (!res.ok) {
      const err = new Error(friendly(data.msg || data.error_description || data.message || data.error));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function getValidSession() {
    const s = getSession();
    if (!s || !s.access_token) return null;
    if (s.expires_at - 60 > Math.floor(Date.now() / 1000)) return s;
    try {
      const d = await api('token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } });
      return setSession(d);
    } catch (e) {
      if (e.offline) throw e;
      clearSession();
      return null;
    }
  }

  // ---------- screen ----------
  const CSS = `
  #cloup-auth{position:fixed;inset:0;z-index:9999;overflow-y:auto;color:#fff;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top,0px)) 24px calc(20px + env(safe-area-inset-bottom,0px));
    background:linear-gradient(180deg,#1C1C1E,#121212);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
  #cloup-auth.hidden{display:none}
  #cloup-auth .ca-wrap{min-height:100%;max-width:420px;margin:0 auto;box-sizing:border-box;display:flex;
    flex-direction:column;justify-content:center;
    padding:28px 24px;padding-top:calc(28px + env(safe-area-inset-top,0px));padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))}
  #cloup-auth .ca-logo{width:64px;height:64px;border-radius:20px;background:#2C2C2E;border:1px solid #3A3A3C;
    display:flex;align-items:center;justify-content:center;color:#34C759;margin:0 auto 16px}
  #cloup-auth h1{font-size:28px;font-weight:700;text-align:center;margin:0 0 6px}
  #cloup-auth .ca-sub{color:#98989D;text-align:center;font-size:15px;margin:0 0 24px}
  #cloup-auth .ca-seg{display:flex;background:#2C2C2E;border-radius:14px;padding:4px;margin-bottom:18px}
  #cloup-auth .ca-seg button{flex:1;height:44px;border:0;border-radius:11px;background:transparent;
    color:#98989D;font-size:15px;font-weight:600;font-family:inherit}
  #cloup-auth .ca-seg button.on{background:#3A3A3C;color:#fff}
  #cloup-auth .ca-field{position:relative;margin-bottom:12px}
  #cloup-auth .ca-field input{width:100%;box-sizing:border-box;height:52px;border-radius:14px;
    background:#2C2C2E;border:1px solid #3A3A3C;color:#fff;font-size:16px;font-family:inherit;
    padding:0 16px;outline:none;user-select:text;-webkit-user-select:text}
  #cloup-auth .ca-field input.pw{padding-right:52px}
  #cloup-auth .ca-field input:focus{border-color:#34C759}
  #cloup-auth .ca-field input::placeholder{color:#98989D}
  #cloup-auth .ca-eye{position:absolute;right:0;top:0;width:52px;height:52px;border:0;background:transparent;
    color:#98989D;display:flex;align-items:center;justify-content:center}
  #cloup-auth .ca-msg{min-height:20px;font-size:14px;margin:2px 2px 12px;line-height:1.35}
  #cloup-auth .ca-msg.err{color:#FF453A}
  #cloup-auth .ca-msg.ok{color:#34C759}
  #cloup-auth .ca-btn{width:100%;height:52px;border-radius:14px;border:0;font-size:16px;font-weight:600;
    font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px;
    transition:transform .08s}
  #cloup-auth .ca-btn:active{transform:scale(.97)}
  #cloup-auth .ca-btn:disabled{opacity:.7}
  #cloup-auth .ca-primary{background:#34C759;color:#fff}
  #cloup-auth .ca-google{background:#3A3A3C;color:#fff}
  #cloup-auth .ca-link{background:none;border:0;color:#98989D;font-size:14px;font-family:inherit;
    min-height:48px;width:100%}
  #cloup-auth .ca-or{display:flex;align-items:center;gap:12px;color:#98989D;font-size:13px;margin:14px 0}
  #cloup-auth .ca-or:before,#cloup-auth .ca-or:after{content:"";flex:1;height:1px;background:#3A3A3C}
  #cloup-auth .ca-spin{width:18px;height:18px;border-radius:50%;border:3px solid rgba(255,255,255,.3);
    border-top-color:#fff;animation:ca-rot .8s linear infinite}
  @keyframes ca-rot{to{transform:rotate(360deg)}}
  `;

  const ICON_CLOUD = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line></svg>';
  const ICON_EYE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_G = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  let root = null;
  let mode = 'login';
  let pending = [];
  let busy = false;

  function ensureRoot() {
    if (root) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    root = document.createElement('div');
    root.id = 'cloup-auth';
    root.className = 'hidden';
    document.body.appendChild(root);
  }

  function pwField(id, ph, auto) {
    return '<div class="ca-field"><input class="pw" id="' + id + '" type="password" placeholder="' + ph +
      '" autocomplete="' + auto + '"><button type="button" class="ca-eye" data-eye="' + id + '" aria-label="Show password">' +
      ICON_EYE + '</button></div>';
  }

  function render(m, keepMsg) {
    mode = m;
    ensureRoot();
    const titles = {
      login: ['Welcome back', 'Log in to restore your phone'],
      signup: ['Create account', 'Back up once. Restore on any phone.'],
      forgot: ['Reset password', 'We will email you a reset link'],
      reset: ['New password', 'Choose a new password for your account']
    };
    let h = '<img src="logo2.png" alt="Cloup" style="display:block;width:120px;height:120px;margin:0 auto 8px">' +
      '<h1>' + titles[m][0] + '</h1><p class="ca-sub">' + titles[m][1] + '</p>';
    if (m === 'login' || m === 'signup') {
      h += '<div class="ca-seg"><button data-mode="login" class="' + (m === 'login' ? 'on' : '') + '">Log in</button>' +
        '<button data-mode="signup" class="' + (m === 'signup' ? 'on' : '') + '">Create account</button></div>';
    }
    if (m !== 'reset') {
      h += '<div class="ca-field"><input id="ca-email" type="email" placeholder="Email" autocomplete="email" ' +
        'autocapitalize="none" inputmode="email"></div>';
    }
    if (m === 'login') h += pwField('ca-pass', 'Password', 'current-password');
    if (m === 'signup') h += pwField('ca-pass', 'Password (min 6 characters)', 'new-password') +
      pwField('ca-pass2', 'Confirm password', 'new-password');
    if (m === 'reset') h += pwField('ca-pass', 'New password (min 6 characters)', 'new-password') +
      pwField('ca-pass2', 'Confirm new password', 'new-password');
    h += '<div class="ca-msg" id="ca-msg"></div>';
    const labels = { login: 'LOG IN', signup: 'CREATE ACCOUNT', forgot: 'SEND RESET LINK', reset: 'SAVE PASSWORD' };
    h += '<button class="ca-btn ca-primary" id="ca-submit">' + labels[m] + '</button>';
    if (m === 'login') h += '<button class="ca-link" data-mode="forgot">Forgot password?</button>';
    if (m === 'forgot') h += '<button class="ca-link" data-mode="login">Back to log in</button>';
    if (m === 'login' || m === 'signup') {
      h += '<div class="ca-or">or</div><button class="ca-btn ca-google" id="ca-google">' + ICON_G +
        'Continue with Google</button>';
    }
    h += '</div>';
    root.innerHTML = h;
    root.classList.remove('hidden');
    var boot = document.getElementById('cloup-boot'); if (boot) boot.remove();
    root.scrollTop = 0;
    if (!keepMsg) setMsg('');

    root.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () { if (!busy) render(b.getAttribute('data-mode')); };
    });
    root.querySelectorAll('[data-eye]').forEach(function (b) {
      b.onclick = function () {
        const i = document.getElementById(b.getAttribute('data-eye'));
        i.type = i.type === 'password' ? 'text' : 'password';
      };
    });
    document.getElementById('ca-submit').onclick = submit;
    const g = document.getElementById('ca-google');
    if (g) g.onclick = nativeGoogleLogin;
    root.querySelectorAll('input').forEach(function (i) {
      i.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
    });
  }

  function setMsg(text, kind) {
    const el = document.getElementById('ca-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ca-msg' + (kind ? ' ' + kind : '');
  }

  function setBusy(on) {
    busy = on;
    ['ca-submit', 'ca-google'].forEach(function (id) {
      const b = document.getElementById(id);
      if (b) b.disabled = on;
    });
    const sb = document.getElementById('ca-submit');
    if (sb) {
      if (on) { sb.dataset.t = sb.textContent; sb.innerHTML = '<span class="ca-spin"></span>'; }
      else if (sb.dataset.t) sb.textContent = sb.dataset.t;
    }
  }

  function val(id) { const e = document.getElementById(id); return e ? e.value : ''; }

  async function submit() {
    if (busy) return;
    const email = val('ca-email').trim();
    const pass = val('ca-pass');
    try {
      if (mode === 'login') {
        if (!email || !pass) return setMsg('Enter your email and password.', 'err');
        setBusy(true);
        onSignedIn(setSession(await api('token?grant_type=password', { body: { email: email, password: pass } })));
      } else if (mode === 'signup') {
        if (!email) return setMsg('Enter your email.', 'err');
        if (pass.length < 6) return setMsg('Password must be at least 6 characters.', 'err');
        if (pass !== val('ca-pass2')) return setMsg('Passwords do not match.', 'err');
        setBusy(true);
        const d = await api('signup?redirect_to=' + encodeURIComponent(redirectTo), { body: { email: email, password: pass } });
        if (d.access_token) {
          onSignedIn(setSession(d));
        } else {
          setBusy(false);
          render('login');
          setMsg('Account created. Check your email to confirm it, then log in.', 'ok');
        }
      } else if (mode === 'forgot') {
        if (!email) return setMsg('Enter your email.', 'err');
        setBusy(true);
        await api('recover?redirect_to=' + encodeURIComponent(redirectTo), { body: { email: email } });
        setBusy(false);
        setMsg('Reset link sent. Check your email.', 'ok');
      } else if (mode === 'reset') {
        if (pass.length < 6) return setMsg('Password must be at least 6 characters.', 'err');
        if (pass !== val('ca-pass2')) return setMsg('Passwords do not match.', 'err');
        const s = getSession();
        if (!s) { render('login'); return setMsg('Link expired. Request a new one.', 'err'); }
        setBusy(true);
        await api('user', { method: 'PUT', token: s.access_token, body: { password: pass } });
        onSignedIn(s);
      }
    } catch (e) {
      setBusy(false);
      setMsg(e.message, 'err');
    }
  }

  const GOOGLE_WEB_CLIENT_ID = 'PASTE_WEB_CLIENT_ID_HERE';
  let socialReady = null;
  async function nativeGoogleLogin() {
    if (busy) return;
    const SL = isNative ? Capacitor.registerPlugin('SocialLogin') : null;
    if (!SL || GOOGLE_WEB_CLIENT_ID.indexOf('PASTE') === 0) return googleLogin();
    const gb = document.getElementById('ca-google');
    busy = true;
    if (gb) gb.disabled = true;
    setMsg('');
    try {
      if (!socialReady) socialReady = SL.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: 'online' } });
      await socialReady;
      const hex = function (a) { return Array.from(a, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); };
      const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
      const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const res = await SL.login({ provider: 'google', options: { nonce: hex(new Uint8Array(dig)) } });
      const idToken = res && res.result && res.result.idToken;
      if (!idToken) throw new Error('Google did not return a token.');
      const d = await api('token?grant_type=id_token', { body: { provider: 'google', id_token: idToken, nonce: raw } });
      onSignedIn(setSession(d));
    } catch (e) {
      busy = false;
      if (gb) gb.disabled = false;
      socialReady = null;
      const m = String((e && e.message) || e);
      if (/not implemented|not available|not registered/i.test(m)) return googleLogin();
      if (/cancel/i.test(m)) return;
      if (/28444|developer console/i.test(m)) return setMsg('Google setup is not finished (package name or SHA-1).', 'err');
      if (/no credential/i.test(m)) return setMsg('Add a Google account to this phone first.', 'err');
      setMsg(m, 'err');
    }
  }

  function googleLogin() {
    if (busy) return;
    const url = SB_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectTo);
    setMsg('Opening Google...', 'ok');
    if (isNative) window.open(url, '_blank');
    else window.location.href = url;
  }

  // ---------- after login ----------
  function onSignedIn(s) {
    busy = false;
    if (root) root.classList.add('hidden');
    updateSettings();
    const list = pending; pending = [];
    list.forEach(function (r) { r(s); });
    window.dispatchEvent(new Event('cloup:login'));
  }

  async function signOut() {
    const s = getSession();
    if (s) { try { await api('logout', { token: s.access_token }); } catch (e) {} }
    clearSession();
    location.reload();
  }

  function updateSettings() {
    const s = getSession();
    if (!s || !s.user) return;
    const rows = document.querySelectorAll('.list-item');
    let last = null;
    rows.forEach(function (r) {
      last = r;
      if (/^\s*Account/.test(r.textContent)) {
        const sp = r.querySelector('span');
        if (sp) sp.textContent = s.user.email || '';
      }
    });
    if (last && !document.querySelector('[data-cloup-logout]')) {
      const out = document.createElement('div');
      out.className = 'list-item';
      out.setAttribute('data-cloup-logout', '1');
      out.textContent = 'Log out';
      out.onclick = function () { if (confirm('Log out of Cloup?')) signOut(); };
      last.parentNode.insertBefore(out, last.nextSibling);
    }
  }

  // ---------- links coming back from Google / email ----------
  async function handleUrl(url) {
    if (!url || url.indexOf('access_token') === -1 && url.indexOf('error') === -1) return;
    const frag = url.indexOf('#') > -1 ? url.split('#')[1] : (url.split('?')[1] || '');
    const p = new URLSearchParams(frag);
    ensureRoot();
    if (p.get('error_description')) {
      if (root.classList.contains('hidden') || !document.getElementById('ca-msg')) render('login');
      setMsg(friendly(p.get('error_description').replace(/\+/g, ' ')), 'err');
      return;
    }
    const at = p.get('access_token');
    if (!at) return;
    try {
      const user = await api('user', { method: 'GET', token: at });
      const s = setSession({
        access_token: at,
        refresh_token: p.get('refresh_token'),
        expires_in: parseInt(p.get('expires_in'), 10) || 3600,
        user: user
      });
      if (p.get('type') === 'recovery') render('reset');
      else onSignedIn(s);
    } catch (e) {
      render('login');
      setMsg(e.message, 'err');
    }
  }

  // ---------- public ----------
  async function requireLogin() {
    const s = await getValidSession();
    if (s) return s;
    ensureRoot();
    return new Promise(function (resolve) {
      pending.push(resolve);
      render('login');
    });
  }

  window.CloupAuth = { require: requireLogin, getSession: getSession, signOut: signOut };

  async function start() {
    ensureRoot();
    if (isNative && Capacitor.Plugins && Capacitor.Plugins.App) {
      const App = Capacitor.Plugins.App;
      App.addListener('appUrlOpen', function (e) { handleUrl(e.url); });
      try {
        const l = await App.getLaunchUrl();
        if (l && l.url) handleUrl(l.url);
      } catch (e) {}
    }
    if (location.hash.indexOf('access_token') > -1) {
      await handleUrl(location.href);
      history.replaceState(null, '', location.pathname);
    }
    if (getSession()) updateSettings();
    else if (!root.innerHTML) render('login');
  }

  if (!getSession()) { ensureRoot(); render('login'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
