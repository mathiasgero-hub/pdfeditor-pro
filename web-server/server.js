// PDFEdit Or (version web) — serveur des fonctions payantes : connexion Google + relais vers Gemini et Google Vision.
// L'éditeur lui-même est servi par nginx (fichiers statiques de renderer/) et fonctionne sans compte : les PDF ne quittent
// jamais le navigateur, sauf la page ou le texte envoyés volontairement à une fonction IA / OCR Google.
//  - compte @frenchschooljakarta.com : les clés du lycée (GEMINI_API_KEY, GOOGLE_VISION_API_KEY) sont utilisées automatiquement ;
//  - autre compte Google : la personne utilise SES clés (en-têtes X-Gemini-Key / X-Vision-Key), gardées dans son navigateur,
//    jamais enregistrées ni journalisées ici.
import express from 'express';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const {
  PORT = '4950',
  BASE_URL = `http://localhost:${process.env.PORT || '4950'}`,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  SCHOOL_DOMAIN = 'frenchschooljakarta.com',
  GEMINI_API_KEY,
  GOOGLE_VISION_API_KEY,
  // Surchargeables uniquement pour les tests (faux serveur Google local).
  GEMINI_API_BASE = 'https://generativelanguage.googleapis.com',
  VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate',
} = process.env;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET manquant ou trop court (32 caractères minimum).');
  process.exit(1);
}

// Seuls les modèles utilisés par l'éditeur sont relayés (la clé du lycée ne sert pas à autre chose).
const GEMINI_MODELS = new Set(['gemini-3.8-flash', 'gemini-3.1-flash-image']);

// ---------- Limitation de débit ----------
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(key, list);
  return true;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();

// ---------- Session (cookie signé HMAC, aucune base de données) ----------
const SECURE = BASE_URL.startsWith('https://');
const SESSION_COOKIE = 'pdfe_session';
const STATE_COOKIE = 'pdfe_state';
const MODE_COOKIE = 'pdfe_mode';
const SESSION_TTL_S = 30 * 24 * 3600;
const SCHOOL = SCHOOL_DOMAIN.toLowerCase();

const oauth = new OAuth2Client({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: `${BASE_URL}/auth/callback` });
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
const isSchool = (hd, email) => String(hd || '').toLowerCase() === SCHOOL && String(email || '').toLowerCase().endsWith(`@${SCHOOL}`);

function createSession(user) {
  const body = b64url(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }));
  return `${body}.${sign(body)}`;
}

function readSession(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookieOpts = (maxAgeMs) => ({ httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: maxAgeMs });
const sessionOf = (req) => readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);

// ---------- Quelle clé utiliser ? ----------
const KEY_FORMAT = /^[A-Za-z0-9._-]{20,200}$/;
const SERVICES = {
  gemini: { header: 'x-gemini-key', school: () => GEMINI_API_KEY, label: 'Gemini' },
  vision: { header: 'x-vision-key', school: () => GOOGLE_VISION_API_KEY, label: 'Google Vision' },
};

function resolveKey(req, user, service) {
  const s = SERVICES[service];
  if (user.school) return s.school() ? { key: s.school() } : { status: 503, error: `${s.label} n’est pas configuré sur le serveur.` };
  const k = String(req.get(s.header) || '').trim();
  if (!k) return { status: 403, code: 'key', service, error: `Il faut votre clé API ${s.label} personnelle pour cette fonction.` };
  if (!KEY_FORMAT.test(k)) return { status: 400, code: 'badKey', service, error: `Cette clé API ${s.label} n’a pas le bon format.` };
  return { key: k, personal: true };
}

// Le message d'erreur de Google peut citer la clé : on la masque toujours avant de le renvoyer.
const scrub = (text, key) => (key ? String(text).split(key).join('•••') : String(text));

async function relay(res, url, body, k, service, timeoutMs) {
  let r, text;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await r.text();
  } catch (err) {
    console.error(`${service} relay failed:`, k.personal ? '(clé personnelle) ' + err.name : err.message);
    return res.status(504).json({ error: { message: `${SERVICES[service].label} ne répond pas. Réessayez.` } });
  }
  if (!r.ok) {
    console.error(`${service} HTTP ${r.status}` + (k.personal ? ' (clé personnelle)' : ': ' + scrub(text, k.key).slice(0, 300)));
    if (k.personal && [400, 401, 403].includes(r.status) && /API[_ ]key|API_KEY|permission|SERVICE_DISABLED|billing/i.test(text)) {
      let msg = '';
      try { msg = JSON.parse(text).error?.message || ''; } catch {}
      return res.status(401).json({ code: 'badKey', service, error: { message: `Google refuse votre clé ${SERVICES[service].label} : ${scrub(msg, k.key).slice(0, 200)}` } });
    }
  }
  res.status(r.status).type('application/json').send(scrub(text, k.key));
}

const app = express();
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

app.get('/api/healthz', (_req, res) => res.json({ ok: true }));

// ---------- Connexion Google (tous les comptes Google ; le domaine du lycée donne droit aux clés du lycée) ----------
// La connexion se fait dans une petite fenêtre : l'éditeur reste ouvert avec le PDF en cours.
app.get('/auth/login', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send('Connexion Google non configurée.');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, cookieOpts(10 * 60 * 1000));
  res.cookie(MODE_COOKIE, req.query.popup === '1' ? 'popup' : 'page', cookieOpts(10 * 60 * 1000));
  res.redirect(oauth.generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account', state }));
});

function finish(res, mode, status) {
  if (mode !== 'popup') return res.redirect(status === 'ok' ? '/' : `/?login=${status}`);
  // Fenêtre de connexion : prévenir l'éditeur puis se fermer.
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><meta charset="utf-8"><title>Connexion</title>
<body style="font-family:sans-serif;background:#1a1a2e;color:#eee;display:grid;place-items:center;height:100vh;margin:0">
<p>${status === 'ok' ? 'Connexion réussie — vous pouvez fermer cette fenêtre.' : 'La connexion a échoué. Fermez cette fenêtre et réessayez.'}</p>
<script>try{window.opener&&window.opener.postMessage({type:'pdfedit-login',status:${JSON.stringify(status)}},location.origin)}catch(e){}setTimeout(function(){window.close()},${status === 'ok' ? 300 : 4000})</script>`);
}

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const cookies = parseCookies(req.headers.cookie);
  const mode = cookies[MODE_COOKIE] === 'popup' ? 'popup' : 'page';
  res.clearCookie(STATE_COOKIE, { path: '/' });
  res.clearCookie(MODE_COOKIE, { path: '/' });
  if (!code || !state || state !== cookies[STATE_COOKIE]) return finish(res, mode, 'state');
  try {
    const { tokens } = await oauth.getToken(String(code));
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p.email || !p.email_verified) return finish(res, mode, 'email');
    // « Compte du lycée » = domaine Workspace (claim `hd`) ET adresse correspondante : un alias gmail ne suffit pas.
    const school = isSchool(p.hd, p.email);
    res.cookie(SESSION_COOKIE, createSession({ email: p.email, name: p.name || p.email, school }), cookieOpts(SESSION_TTL_S * 1000));
    finish(res, mode, 'ok');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    finish(res, mode, 'auth');
  }
});

app.post('/auth/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const s = sessionOf(req);
  res.set('Cache-Control', 'no-store').json({ user: s ? { email: s.email, name: s.name, school: !!s.school } : null });
});

// ---------- Relais Gemini : POST /api/gemini/<modèle> avec le corps generateContent ----------
app.post('/api/gemini/:model', express.json({ limit: '40mb' }), async (req, res) => {
  const user = sessionOf(req);
  if (!user) return res.status(401).json({ code: 'login', error: { message: 'Connectez-vous avec Google pour utiliser les fonctions IA.' } });
  if (!GEMINI_MODELS.has(req.params.model)) return res.status(400).json({ error: { message: 'Modèle non autorisé.' } });
  const k = resolveKey(req, user, 'gemini');
  if (!k.key) return res.status(k.status).json({ code: k.code, service: k.service, error: { message: k.error } });
  const image = req.params.model.includes('image');
  const max = image ? (k.personal ? 30 : 60) : (k.personal ? 120 : 240);
  if (!rateLimit(`gemini:${user.email}:${image}`, max, 10 * 60 * 1000) || !rateLimit('gemini:all', 2000, 10 * 60 * 1000))
    return res.status(429).json({ error: { message: 'Trop de demandes. Réessayez dans quelques minutes.' } });
  await relay(res, `${GEMINI_API_BASE}/v1beta/models/${req.params.model}:generateContent`, req.body, k, 'gemini', 240_000);
});

// ---------- Relais Google Vision (OCR) : POST /api/vision avec le corps images:annotate ----------
app.post('/api/vision', express.json({ limit: '25mb' }), async (req, res) => {
  const user = sessionOf(req);
  if (!user) return res.status(401).json({ code: 'login', error: { message: 'Connectez-vous avec Google pour utiliser l’OCR Google Vision.' } });
  const k = resolveKey(req, user, 'vision');
  if (!k.key) return res.status(k.status).json({ code: k.code, service: k.service, error: { message: k.error } });
  if (!rateLimit(`vision:${user.email}`, k.personal ? 120 : 300, 10 * 60 * 1000) || !rateLimit('vision:all', 2000, 10 * 60 * 1000))
    return res.status(429).json({ error: { message: 'Trop de demandes. Réessayez dans quelques minutes.' } });
  await relay(res, VISION_API_URL, req.body, k, 'vision', 60_000);
});

// ---------- Vérification d'une clé personnelle avant de la garder dans le navigateur (le serveur ne la conserve pas) ----------
// PNG blanc 1×1 : la requête Vision la moins chère possible pour savoir si la clé a accès à l'API.
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

app.post('/api/key/check', async (req, res) => {
  const user = sessionOf(req);
  if (!user) return res.status(401).json({ ok: false, code: 'login', error: 'Connectez-vous avec Google.' });
  const service = req.query.service === 'vision' ? 'vision' : 'gemini';
  if (user.school) return res.json({ ok: true, school: true });
  const k = String(req.get(SERVICES[service].header) || '').trim();
  if (!KEY_FORMAT.test(k)) return res.status(400).json({ ok: false, error: 'Cette clé API n’a pas le bon format.' });
  if (!rateLimit(`keycheck:${user.email}`, 20, 10 * 60 * 1000)) return res.status(429).json({ ok: false, error: 'Trop d’essais. Réessayez dans quelques minutes.' });
  try {
    const r = service === 'gemini'
      ? await fetch(`${GEMINI_API_BASE}/v1beta/models?pageSize=1`, { headers: { 'x-goog-api-key': k }, signal: AbortSignal.timeout(15_000) })
      : await fetch(VISION_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
          body: JSON.stringify({ requests: [{ image: { content: TINY_PNG }, features: [{ type: 'TEXT_DETECTION' }] }] }),
          signal: AbortSignal.timeout(15_000),
        });
    if (r.ok) return res.json({ ok: true });
    const text = await r.text();
    const hint = /SERVICE_DISABLED|has not been used|is disabled/i.test(text)
      ? 'L’API n’est pas activée sur le projet Google Cloud de cette clé (voir l’étape « Activer »).'
      : /billing/i.test(text)
        ? 'La facturation n’est pas activée sur le projet Google Cloud de cette clé.'
        : 'Google refuse cette clé. Vérifiez que vous l’avez copiée en entier.';
    res.status(400).json({ ok: false, error: hint });
  } catch {
    res.status(502).json({ ok: false, error: 'Impossible de vérifier la clé pour le moment. Réessayez.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Image trop lourde.' } });
  console.error(err);
  res.status(500).json({ error: { message: 'Erreur serveur.' } });
});

app.listen(Number(PORT), '127.0.0.1', () => console.log(`PDFEdit (API) sur http://127.0.0.1:${PORT}`));
