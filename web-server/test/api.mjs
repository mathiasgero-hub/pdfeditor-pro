// Teste le serveur sans appeler le vrai Google : un faux « Google » local reçoit les requêtes relayées.
//  - qui a droit à quelle clé : lycée = clé du lycée (jamais celle envoyée par le client), autre compte = sa propre clé ;
//  - une clé personnelle n'apparaît jamais dans une réponse ni dans les journaux du serveur ;
//  - modèles autorisés, limites de taille, connexion Google, cookie falsifié.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 4970;
const FAKE_PORT = 4971;
const SECRET = 'test-secret-test-secret-test-secret-1234';
const SCHOOL_GEMINI = 'SCHOOL-GEMINI-KEY-SCHOOL-GEMINI-0001';
const SCHOOL_VISION = 'SCHOOL-VISION-KEY-SCHOOL-VISION-0002';
const PERSONAL = 'AIzaSyPERSONALPERSONALPERSONAL123456';
const BAD = 'AIzaSyBADBADBADBADBADBADBADBADBAD1234';
const base = `http://127.0.0.1:${PORT}`;

// ---------- faux Google ----------
const seen = []; // { path, key, body }
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const key = req.headers['x-goog-api-key'];
    const raw = Buffer.concat(chunks).toString();
    seen.push({ path: req.url, key, body: raw ? JSON.parse(raw) : null });
    res.setHeader('Content-Type', 'application/json');
    if (key === BAD) {
      res.statusCode = 400;
      // Google cite parfois la clé dans son message : le serveur ne doit pas la renvoyer telle quelle.
      return res.end(JSON.stringify({ error: { code: 400, message: `API key not valid (${key}). Please pass a valid API key.` } }));
    }
    if (req.url.startsWith('/v1beta/models?')) return res.end(JSON.stringify({ models: [] }));
    if (req.url.startsWith('/vision')) return res.end(JSON.stringify({ responses: [{ textAnnotations: [{ description: 'ok' }] }] }));
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'réponse' }] } }] }));
  });
});
await new Promise((r) => fake.listen(FAKE_PORT, '127.0.0.1', r));

const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env, PORT: String(PORT), SESSION_SECRET: SECRET, BASE_URL: base,
    GOOGLE_CLIENT_ID: 'dummy-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'dummy',
    GEMINI_API_KEY: SCHOOL_GEMINI, GOOGLE_VISION_API_KEY: SCHOOL_VISION,
    GEMINI_API_BASE: `http://127.0.0.1:${FAKE_PORT}`, VISION_API_URL: `http://127.0.0.1:${FAKE_PORT}/vision`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

const cookie = (user, exp = Math.floor(Date.now() / 1000) + 3600) => {
  const body = Buffer.from(JSON.stringify({ ...user, exp })).toString('base64url');
  return `pdfe_session=${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};
const school = cookie({ email: 'prof@frenchschooljakarta.com', name: 'Prof', school: true });
const personal = cookie({ email: 'parent@gmail.com', name: 'Parent', school: false });

const post = (path, headers, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) });
const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const GEN = { contents: [{ role: 'user', parts: [{ text: 'bonjour' }] }] };
const VIS = { requests: [{ image: { content: 'AAAA' }, features: [{ type: 'TEXT_DETECTION' }] }] };
const lastKey = () => seen.at(-1).key;

try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/api/healthz`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- /api/me ---
  assert.equal((await j(await fetch(`${base}/api/me`))).user, null);
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { cookie: school } }))).user.school, true);
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { cookie: personal } }))).user.school, false);
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { cookie: school.slice(0, -3) + 'xyz' } }))).user, null, 'signature falsifiée');
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { cookie: cookie({ email: 'a@b.c', school: true }, 1) } }))).user, null, 'session expirée');
  const forged = Buffer.from(JSON.stringify({ email: 'x@gmail.com', school: true, exp: 9999999999 })).toString('base64url');
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { cookie: `pdfe_session=${forged}.AAAA` } }))).user, null, 'cookie « school » forgé');

  // --- Gemini : accès ---
  const M = '/api/gemini/gemini-3.8-flash';
  let r = await j(await post(M, {}, GEN));
  assert.equal(r.status, 401); assert.equal(r.code, 'login');
  assert.equal(seen.length, 0, 'rien n\'est relayé sans compte');

  // compte du lycée : clé du lycée, JAMAIS celle envoyée par le client
  r = await j(await post(M, { cookie: school, 'x-gemini-key': PERSONAL }, GEN));
  assert.equal(r.status, 200);
  assert.equal(r.candidates[0].content.parts[0].text, 'réponse');
  assert.equal(lastKey(), SCHOOL_GEMINI);
  assert.equal(seen.at(-1).path, '/v1beta/models/gemini-3.8-flash:generateContent');
  assert.deepEqual(seen.at(-1).body, GEN, 'le corps est relayé tel quel');

  // autre compte : clé obligatoire, bien formée, puis utilisée
  const before = seen.length;
  r = await j(await post(M, { cookie: personal }, GEN));
  assert.equal(r.status, 403); assert.equal(r.code, 'key');
  r = await j(await post(M, { cookie: personal, 'x-gemini-key': 'trop court' }, GEN));
  assert.equal(r.status, 400); assert.equal(r.code, 'badKey');
  assert.equal(seen.length, before, 'sans clé valable, rien n\'est envoyé à Google (et la clé du lycée n\'est pas utilisée)');
  r = await j(await post(M, { cookie: personal, 'x-gemini-key': PERSONAL }, GEN));
  assert.equal(r.status, 200);
  assert.equal(lastKey(), PERSONAL);

  // clé personnelle refusée par Google : 401 « badKey », sans jamais renvoyer la clé
  const resp = await post(M, { cookie: personal, 'x-gemini-key': BAD }, GEN);
  const text = await resp.text();
  assert.equal(resp.status, 401);
  assert.equal(JSON.parse(text).code, 'badKey');
  assert.ok(!text.includes(BAD), 'la clé personnelle ne doit pas réapparaître dans la réponse');

  // modèles autorisés uniquement
  assert.equal((await post('/api/gemini/gemini-3.1-flash-image', { cookie: school }, GEN)).status, 200);
  assert.equal((await post('/api/gemini/gemini-3.1-pro-preview', { cookie: school }, GEN)).status, 400);
  assert.equal((await post('/api/gemini/..%2F..%2Fx', { cookie: school }, GEN)).status, 400);

  // --- Vision ---
  assert.equal((await post('/api/vision', {}, VIS)).status, 401);
  r = await j(await post('/api/vision', { cookie: school, 'x-vision-key': PERSONAL }, VIS));
  assert.equal(r.status, 200);
  assert.equal(lastKey(), SCHOOL_VISION);
  assert.equal(seen.at(-1).path, '/vision');
  // une clé Gemini ne tient pas lieu de clé Vision
  r = await j(await post('/api/vision', { cookie: personal, 'x-gemini-key': PERSONAL }, VIS));
  assert.equal(r.status, 403); assert.equal(r.service, 'vision');
  r = await j(await post('/api/vision', { cookie: personal, 'x-vision-key': PERSONAL }, VIS));
  assert.equal(r.status, 200);
  assert.equal(lastKey(), PERSONAL);
  // image trop lourde
  const big = await post('/api/vision', { cookie: school }, '{"x":"' + 'a'.repeat(26 * 1024 * 1024) + '"}');
  assert.equal(big.status, 413);

  // --- vérification de clé ---
  assert.equal((await post('/api/key/check', {})).status, 401);
  assert.equal((await j(await post('/api/key/check', { cookie: school }))).school, true);
  assert.equal((await post('/api/key/check', { cookie: personal, 'x-gemini-key': 'court' })).status, 400);
  assert.equal((await j(await post('/api/key/check', { cookie: personal, 'x-gemini-key': PERSONAL }))).ok, true);
  r = await j(await post('/api/key/check', { cookie: personal, 'x-gemini-key': BAD }));
  assert.equal(r.status, 400); assert.ok(!JSON.stringify(r).includes(BAD));
  assert.equal((await j(await post('/api/key/check?service=vision', { cookie: personal, 'x-vision-key': PERSONAL }))).ok, true);
  assert.equal(seen.at(-1).path, '/vision');

  // --- connexion Google : tous les comptes, fenêtre ou page ---
  const login = await fetch(`${base}/auth/login?popup=1`, { redirect: 'manual' });
  assert.equal(login.status, 302);
  const loc = new URL(login.headers.get('location'));
  assert.equal(loc.host, 'accounts.google.com');
  assert.equal(loc.searchParams.get('client_id'), 'dummy-client.apps.googleusercontent.com');
  assert.equal(loc.searchParams.get('hd'), null, 'pas de restriction de domaine');
  assert.equal(loc.searchParams.get('redirect_uri'), `${base}/auth/callback`);
  const cks = login.headers.getSetCookie().join(' ');
  assert.ok(cks.includes('pdfe_state=') && cks.includes('pdfe_mode=popup'));
  // retour avec un état invalide : la fenêtre prévient l'éditeur de l'échec (aucun compte créé)
  let cb = await fetch(`${base}/auth/callback?code=x&state=y`, { headers: { cookie: 'pdfe_state=abc; pdfe_mode=popup' }, redirect: 'manual' });
  let html = await cb.text();
  assert.ok(html.includes("type:'pdfedit-login'") && html.includes('"state"'));
  assert.ok(!cb.headers.getSetCookie().join(' ').includes('pdfe_session='), 'pas de session sur un état invalide');
  cb = await fetch(`${base}/auth/callback?code=x&state=y`, { headers: { cookie: 'pdfe_state=abc' }, redirect: 'manual' });
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get('location'), '/?login=state');

  // --- application de bureau : jeton Bearer (même jeton signé que le cookie) et connexion par le navigateur système ---
  const tokenOf = (c) => c.split('=')[1];
  const bearer = (c) => ({ authorization: `Bearer ${tokenOf(c)}` });
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: bearer(school) }))).user.school, true);
  assert.equal((await j(await fetch(`${base}/api/me`, { headers: { authorization: 'Bearer ' + tokenOf(school).slice(0, -3) + 'xyz' } }))).user, null, 'jeton falsifié');
  r = await j(await post(M, { ...bearer(school), 'x-gemini-key': PERSONAL }, GEN));
  assert.equal(r.status, 200); assert.equal(lastKey(), SCHOOL_GEMINI, 'jeton du lycée : clé du lycée');
  r = await j(await post(M, bearer(personal), GEN));
  assert.equal(r.status, 403); assert.equal(r.code, 'key');
  assert.equal((await post('/api/vision', bearer(school), VIS)).status, 200);

  const NONCE = 'a'.repeat(43);
  const dl = await fetch(`${base}/auth/login?desktop=${NONCE}`, { redirect: 'manual' });
  assert.equal(dl.status, 302);
  const dcks = dl.headers.getSetCookie().join(' ');
  assert.ok(dcks.includes('pdfe_mode=desktop') && dcks.includes(`pdfe_nonce=${NONCE}`));
  const badNonce = await fetch(`${base}/auth/login?desktop=court`, { redirect: 'manual' });
  assert.ok(badNonce.headers.getSetCookie().join(' ').includes('pdfe_mode=page'), 'nonce invalide : connexion normale');
  // retour avec un état invalide en mode bureau : page d'échec (pas de redirection, pas de jeton)
  cb = await fetch(`${base}/auth/callback?code=x&state=y`, { headers: { cookie: `pdfe_state=abc; pdfe_mode=desktop; pdfe_nonce=${NONCE}` }, redirect: 'manual' });
  assert.equal(cb.status, 200); assert.ok((await cb.text()).includes('a échoué'));
  // récupération du jeton : code invalide, rien en attente
  const claim = (body) => post('/api/desktop/claim', {}, body);
  assert.equal((await claim({ nonce: 'court' })).status, 400);
  assert.deepEqual(await (await claim({ nonce: NONCE })).json(), { pending: true });

  // --- les clés personnelles n'ont laissé aucune trace dans les journaux ---
  for (const k of [PERSONAL, BAD, SCHOOL_GEMINI, SCHOOL_VISION]) assert.ok(!log.includes(k), `clé présente dans les journaux : ${k.slice(0, 8)}…`);

  console.log('api OK');
} catch (e) {
  console.error(log);
  throw e;
} finally {
  server.kill();
  fake.close();
}
