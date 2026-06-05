/* auth.js — Google OAuth client-side auth com whitelist de e-mails */

const AUTH_ALLOWED = ["laisa.andrade7@gmail.com", "alinedamoura@gmail.com"];
const AUTH_KEY = "mq_auth";
const AUTH_TTL = 8 * 60 * 60 * 1000; // 8 horas

function authCheck() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return redirect();
  try {
    const { email, exp } = JSON.parse(raw);
    if (Date.now() > exp) { localStorage.removeItem(AUTH_KEY); return redirect(); }
    if (!AUTH_ALLOWED.includes(email)) { localStorage.removeItem(AUTH_KEY); return redirect(); }
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return redirect();
  }
}

function redirect() {
  const dest = encodeURIComponent(location.href);
  location.replace("login.html?next=" + dest);
}

function authSave(email) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email, exp: Date.now() + AUTH_TTL }));
}

function authLogout() {
  localStorage.removeItem(AUTH_KEY);
  location.replace("login.html");
}

function authEmail() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)).email; } catch { return null; }
}

authCheck();
