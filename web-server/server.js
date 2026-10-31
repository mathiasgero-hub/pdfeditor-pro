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

// ── Mode Ardoisia (ARDOISIA_MODE=1) ──────────────────────────────────────────────────────────
// L'application tourne derrière nginx, qui vérifie la connexion ET l'accès auprès de la plateforme Ardoisia puis transmet l'identité
// (X-User-Id, X-Plan, X-User-Email). Plus de connexion Google ici, plus de clés personnelles.
//  - compte du lycée (formule « institution » + adresse du lycée) : clés du lycée, jamais débité ;
//  - abonné individuel / crédits offerts (« free ») : clé Gemini de l'ÉDITEUR, débité en crédits avant chaque appel, remboursé si Google échoue ;
//  - autre établissement : SES clés (coffre de la plateforme) ;
//  - accès limité (« limited ») : l'éditeur PDF reste utilisable, aucune fonction IA.
const ARDOISIA = process.env.ARDOISIA_MODE === '1';
const INDIVIDUAL_GEMINI_KEY = process.env.INDIVIDUAL_GEMINI_API_KEY || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const PLATFORM_URL = (process.env.PLATFORM_INTERNAL_URL || 'http://127.0.0.1:4300').replace(/\/$/, '');
const PORTAL_URL = process.env.PORTAL_URL || 'https://compte.ardoisia.com';
const METERED = ARDOISIA && Boolean(INTERNAL_API_SECRET);

if (!ARDOISIA && (!SESSION_SECRET || SESSION_SECRET.length < 32)) {
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
const NONCE_COOKIE = 'pdfe_nonce';
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEADER_EMAIL_RE = /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,190}$/;
function ardoisiaUser(req) {
  const id = String(req.get('x-user-id') || ''), plan = String(req.get('x-plan') || ''), email = String(req.get('x-user-email') || '').toLowerCase();
  if (!UUID_RE.test(id) || !['individual', 'free', 'institution', 'limited'].includes(plan) || !HEADER_EMAIL_RE.test(email)) return null;
  const school = plan === 'institution' && email.endsWith('@' + SCHOOL);
  return {
    id, email, name: email, plan, school,
    limited: plan === 'limited',
    institutional: plan === 'institution' && !school,
    covered: plan === 'individual' || plan === 'free' ? Boolean(INDIVIDUAL_GEMINI_KEY) : false,
  };
}
// Navigateur : cookie. Application de bureau : le même jeton signé, en en-tête « Authorization: Bearer ».
const sessionOf = ARDOISIA ? ardoisiaUser : (req) => {
  const bearer = /^Bearer ([\w.-]+)$/.exec(req.get('authorization') || '');
  return readSession(bearer ? bearer[1] : parseCookies(req.headers.cookie)[SESSION_COOKIE]);
};

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
    res.status(504).json({ error: { message: `${SERVICES[service].label} ne répond pas. Réessayez.` } });
    return false;
  }
  if (!r.ok) {
    console.error(`${service} HTTP ${r.status}` + (k.personal ? ' (clé personnelle)' : ': ' + scrub(text, k.key).slice(0, 300)));
    if (k.personal && [400, 401, 403].includes(r.status) && /API[_ ]key|API_KEY|permission|SERVICE_DISABLED|billing/i.test(text)) {
      let msg = '';
      try { msg = JSON.parse(text).error?.message || ''; } catch {}
      res.status(401).json({ code: 'badKey', service, error: { message: `Google refuse votre clé ${SERVICES[service].label} : ${scrub(msg, k.key).slice(0, 200)}` } });
      return false;
    }
  }
  res.status(r.status).type('application/json').send(scrub(text, k.key));
  return r.ok;
}

const app = express();
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

app.get('/api/healthz', (_req, res) => res.json({ ok: true }));

if (ARDOISIA) {
  // La connexion est gérée par la plateforme ; toute l'API exige l'identité transmise par nginx.
  app.use(['/auth', '/api/desktop'], (_req, res) => res.status(404).end());
  app.use('/api', (req, res, next) => (ardoisiaUser(req) ? next() : res.status(401).json({ code: 'login', error: { message: 'Non connecté.' } })));
}

/** Appel à la plateforme (même machine). Retourne { status, body } ou null si elle ne répond pas. */
async function platformCall(method, route, body) {
  try {
    const r = await fetch(PLATFORM_URL + route, {
      method,
      headers: { Authorization: `Bearer ${INTERNAL_API_SECRET}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (err) {
    console.error('plateforme injoignable :', err.message);
    return null;
  }
}

// Clés d'un autre établissement : { gemini?, cloud? } ; {} sans clé ou sans licence ; null si la plateforme ne répond pas (60 s en mémoire).
const instKeyCache = new Map();
async function institutionKeys(user) {
  if (!METERED || !user.institutional) return undefined;
  const hit = instKeyCache.get(user.id);
  if (hit && Date.now() - hit.at < 60_000) return hit.keys;
  const r = await platformCall('GET', `/internal/institution/keys?userId=${encodeURIComponent(user.id)}`);
  let keys;
  if (r && r.status === 200) keys = r.body.keys || {};
  else if (r && r.status === 403) keys = {};
  else return null;
  if (instKeyCache.size > 200) instKeyCache.clear();
  instKeyCache.set(user.id, { at: Date.now(), keys });
  return keys;
}

// Tarifs affichés dans « Compte » (relus à la plateforme, 5 min en mémoire) : crédits par tranche de 4000 caractères / par image.
let pricesCache = { at: 0, value: null };
async function getPrices() {
  if (!METERED) return null;
  if (Date.now() - pricesCache.at < 5 * 60 * 1000) return pricesCache.value;
  const r = await platformCall('GET', '/internal/credits/prices');
  if (!r || r.status !== 200 || !r.body.prices) return pricesCache.value;
  const per = r.body.unitsPerCredit || 10;
  pricesCache = { at: Date.now(), value: { text: r.body.prices.pdf_text / per, image: r.body.prices.pdf_image / per } };
  return pricesCache.value;
}

const LIMITED_MESSAGE = 'Cette fonction IA est indisponible avec votre accès actuel (accès limité). Rechargez vos crédits ou abonnez-vous depuis « Mon compte Ardoisia ».';

/** Choix de la clé en mode Ardoisia. Retourne { key, publisher?, institution? } ou { status, code, error }. */
async function resolveArdoisiaKey(user, service) {
  if (user.limited) return { status: 403, code: 'limited', error: LIMITED_MESSAGE };
  if (user.school) {
    const k = SERVICES[service].school();
    return k ? { key: k } : { status: 503, error: `${SERVICES[service].label} n’est pas configuré sur le serveur.` };
  }
  if (user.institutional && METERED) {
    const ik = await institutionKeys(user);
    if (ik === null) return { status: 503, error: 'Les clés de votre établissement sont momentanément indisponibles. Réessayez dans un instant.' };
    const key = service === 'gemini' ? ik.gemini : ik.cloud;
    if (key) return { key, institution: true };
    if (service === 'vision') return { status: 403, code: 'noVision', error: 'L’OCR Google Vision n’est pas activé sur la clé Google Cloud de votre établissement. L’OCR intégré fonctionne sans clé.' };
    return { status: 403, code: 'institutionKey', error: 'Les clés d’IA de votre établissement ne sont pas encore configurées. Demandez à la personne qui gère Ardoisia dans votre établissement.' };
  }
  if (service === 'gemini' && user.covered) return { key: INDIVIDUAL_GEMINI_KEY, publisher: true };
  if (service === 'vision') return { status: 403, code: 'noVision', error: 'L’OCR Google Vision n’est pas inclus dans votre formule. L’OCR intégré fonctionne sans clé.' };
  return { status: 503, error: 'Ce service n’est pas configuré.' };
}

/** Débite les crédits (clé de l'éditeur seulement). Retourne { usageId } ({} si rien à débiter) ou null après avoir répondu (402 / 403 / 503). */
async function charge(res, user, k, action, quantity = 1) {
  if (!METERED || !(k.publisher || user.plan === 'institution')) return {}; // clé de l'éditeur, ou membre d'un établissement (décompte du quota, sans débit)
  const r = await platformCall('POST', '/internal/credits/spend', { userId: user.id, app: 'pdfedit', action, quantity });
  if (!r) { res.status(503).json({ error: { message: 'Le décompte des crédits est momentanément indisponible. Réessayez dans un instant.' } }); return null; }
  if (r.status === 402 && r.body?.error === 'member_cap') {
    res.status(402).json({ code: 'quota', error: { message: (r.body?.topup ? 'Votre quota du mois est atteint. Vous pouvez acheter des crédits personnels dans « Mon compte Ardoisia » (compte.ardoisia.com) pour continuer. Sinon, il sera renouvelé le 1er du mois prochain.' : 'Le quota du mois fixé par votre établissement est atteint. Il sera renouvelé le 1er du mois prochain.') } });
    return null;
  }
  if (r.status === 402) {
    res.status(402).json({ code: 'credits', error: { message: 'Vous n’avez plus assez de crédits pour cette fonction. Votre solde est visible dans « Mon compte Ardoisia ».' } });
    return null;
  }
  if (r.status !== 200) { res.status(403).json({ code: 'login', error: { message: 'Accès refusé.' } }); return null; }
  if (!r.body.metered) return r.body.usageId ? { usageId: r.body.usageId } : {}; // établissement : rien à débiter, mais un identifiant permet d'annuler le décompte du quota si l'appel d'IA échoue
  res.set('X-Credits-Left', String(r.body.credits));
  return { usageId: r.body.usageId };
}
const refundCharge = (user, paid) =>
  paid && paid.usageId ? platformCall('POST', '/internal/credits/refund', { userId: user.id, usageId: paid.usageId }) : null;

// Texte envoyé à Gemini : tranches de 4000 caractères (prix « pdf_text » par tranche)
function textBlocks(body) {
  let chars = 0;
  for (const c of body?.contents || []) for (const p of c?.parts || []) if (typeof p?.text === 'string') chars += [...p.text].length;
  for (const p of body?.systemInstruction?.parts || []) if (typeof p?.text === 'string') chars += [...p.text].length;
  return Math.min(100, Math.max(1, Math.ceil(chars / 4000)));
}

// ---------- Connexion Google (tous les comptes Google ; le domaine du lycée donne droit aux clés du lycée) ----------
// La connexion se fait dans une petite fenêtre : l'éditeur reste ouvert avec le PDF en cours.
// ---------- Connexion de l'application de bureau (sans cookie : jeton récupéré une seule fois) ----------
// Le navigateur système ouvre /auth/login?desktop=<nonce> ; après Google, le jeton de session est mis de côté 5 minutes
// sous ce nonce. L'application, qui connaît le nonce, vient le chercher une fois (/api/desktop/claim) puis il est effacé.
const DESKTOP_NONCE = /^[A-Za-z0-9_-]{32,64}$/;
const desktopClaims = new Map(); // nonce -> { token, exp }
setInterval(() => { const now = Date.now(); for (const [k, v] of desktopClaims) if (v.exp < now) desktopClaims.delete(k); }, 60_000).unref();

app.post('/api/desktop/claim', express.json({ limit: '1kb' }), (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!rateLimit(`claim:${req.ip}`, 400, 10 * 60 * 1000)) return res.status(429).json({ error: 'Trop de demandes.' });
  const nonce = String(req.body?.nonce || '');
  if (!DESKTOP_NONCE.test(nonce)) return res.status(400).json({ error: 'Code invalide.' });
  const claim = desktopClaims.get(nonce);
  if (!claim || claim.exp < Date.now()) return res.json({ pending: true });
  desktopClaims.delete(nonce); // à usage unique
  res.json({ token: claim.token });
});

function desktopPage(res, ok) {
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><meta charset="utf-8"><title>PDFEdit</title>
<body style="font-family:sans-serif;background:#1a1a2e;color:#eee;display:grid;place-items:center;height:100vh;margin:0;text-align:center">
<p>${ok ? 'Connexion réussie.<br>Vous pouvez fermer cette page et retourner dans PDFEdit.' : 'La connexion a échoué.<br>Fermez cette page et réessayez depuis PDFEdit.'}</p>`);
}

app.get('/auth/login', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send('Connexion Google non configurée.');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, cookieOpts(10 * 60 * 1000));
  // Application de bureau : le code (nonce) tiré au hasard par l'application relie cette connexion à sa demande.
  const nonce = String(req.query.desktop || '');
  const desktop = DESKTOP_NONCE.test(nonce);
  res.cookie(MODE_COOKIE, desktop ? 'desktop' : req.query.popup === '1' ? 'popup' : 'page', cookieOpts(10 * 60 * 1000));
  if (desktop) res.cookie(NONCE_COOKIE, nonce, cookieOpts(10 * 60 * 1000));
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
  const mode = ['popup', 'desktop'].includes(cookies[MODE_COOKIE]) ? cookies[MODE_COOKIE] : 'page';
  const nonce = cookies[NONCE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: '/' });
  res.clearCookie(MODE_COOKIE, { path: '/' });
  res.clearCookie(NONCE_COOKIE, { path: '/' });
  if (mode === 'desktop' && !DESKTOP_NONCE.test(nonce || '')) return desktopPage(res, false);
  if (!code || !state || state !== cookies[STATE_COOKIE]) return mode === 'desktop' ? desktopPage(res, false) : finish(res, mode, 'state');
  try {
    const { tokens } = await oauth.getToken(String(code));
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p.email || !p.email_verified) return mode === 'desktop' ? desktopPage(res, false) : finish(res, mode, 'email');
    // « Compte du lycée » = domaine Workspace (claim `hd`) ET adresse correspondante : un alias gmail ne suffit pas.
    const school = isSchool(p.hd, p.email);
    const token = createSession({ email: p.email, name: p.name || p.email, school });
    if (mode === 'desktop') {
      desktopClaims.set(nonce, { token, exp: Date.now() + 5 * 60 * 1000 });
      return desktopPage(res, true);
    }
    res.cookie(SESSION_COOKIE, token, cookieOpts(SESSION_TTL_S * 1000));
    finish(res, mode, 'ok');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    mode === 'desktop' ? desktopPage(res, false) : finish(res, mode, 'auth');
  }
});

app.post('/auth/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', async (req, res, next) => {
  if (!ARDOISIA) return next();
  res.set('Cache-Control', 'no-store');
  const s = ardoisiaUser(req);
  if (!s) return res.status(401).json({ user: null });
  const ik = await institutionKeys(s);
  let credits = null;
  if (METERED && !s.limited) {
    const r = await platformCall('GET', `/internal/credits/balance?userId=${encodeURIComponent(s.id)}`);
    if (r && r.status === 200 && r.body.metered) credits = { balance: r.body.credits, nextExpiry: r.body.nextExpiry || null, quota: r.body.quota ? { used: r.body.used, limit: r.body.limit } : null };
  }
  const services = {
    gemini: !s.limited && (s.school || s.covered || Boolean(ik && ik.gemini)),
    vision: !s.limited && (s.school || Boolean(ik && ik.cloud)),
  };
  const prices = credits ? await getPrices() : null;
  res.json({ user: { email: s.email, name: s.name, school: s.school, covered: s.covered, limited: s.limited, institutional: s.institutional, ardoisia: true, portal: PORTAL_URL, credits, prices, services } });
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
  const k = ARDOISIA ? await resolveArdoisiaKey(user, 'gemini') : resolveKey(req, user, 'gemini');
  if (!k.key) return res.status(k.status).json({ code: k.code, service: k.service, error: { message: k.error } });
  const image = req.params.model.includes('image');
  const max = image ? (k.personal ? 30 : 60) : (k.personal ? 120 : 240);
  if (!rateLimit(`gemini:${user.email}:${image}`, max, 10 * 60 * 1000) || !rateLimit('gemini:all', 2000, 10 * 60 * 1000))
    return res.status(429).json({ error: { message: 'Trop de demandes. Réessayez dans quelques minutes.' } });
  const paid = await charge(res, user, k, image ? 'pdf_image' : 'pdf_text', image ? 1 : textBlocks(req.body));
  if (!paid) return;
  const ok = await relay(res, `${GEMINI_API_BASE}/v1beta/models/${req.params.model}:generateContent`, req.body, k, 'gemini', 240_000);
  if (!ok) await refundCharge(user, paid);
});

// ---------- Relais Google Vision (OCR) : POST /api/vision avec le corps images:annotate ----------
app.post('/api/vision', express.json({ limit: '25mb' }), async (req, res) => {
  const user = sessionOf(req);
  if (!user) return res.status(401).json({ code: 'login', error: { message: 'Connectez-vous avec Google pour utiliser l’OCR Google Vision.' } });
  const k = ARDOISIA ? await resolveArdoisiaKey(user, 'vision') : resolveKey(req, user, 'vision');
  if (!k.key) return res.status(k.status).json({ code: k.code, service: k.service, error: { message: k.error } });
  if (!rateLimit(`vision:${user.email}`, k.personal ? 120 : 300, 10 * 60 * 1000) || !rateLimit('vision:all', 2000, 10 * 60 * 1000))
    return res.status(429).json({ error: { message: 'Trop de demandes. Réessayez dans quelques minutes.' } });
  await relay(res, VISION_API_URL, req.body, k, 'vision', 60_000);
});

// ---------- Vérification d'une clé personnelle avant de la garder dans le navigateur (le serveur ne la conserve pas) ----------
// PNG blanc 1×1 : la requête Vision la moins chère possible pour savoir si la clé a accès à l'API.
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

app.post('/api/key/check', async (req, res) => {
  if (ARDOISIA) return res.json({ ok: true, covered: true });
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
