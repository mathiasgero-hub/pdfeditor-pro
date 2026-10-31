// Mode ARDOISIA de PDFEdit Or : vrai serveur + FAUSSE plateforme (débit, remboursement, solde, tarifs, clés d'établissement) + FAUX Google.
//   node test/ardoisia.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 4972;
const FAKE_PORT = 4973;
const B = `http://127.0.0.1:${PORT}`;
const SECRET = 'secret-interne-de-test-0123456789-abcdef';
const SCHOOL_GEMINI = 'GEMINI-DU-LYCEE-SECRETE-0123456789';
const SCHOOL_VISION = 'VISION-DU-LYCEE-SECRETE-0123456789';
const PUB_GEMINI = 'GEMINI-EDITEUR-SECRETE-0123456789';
const INST_GEMINI = 'GEMINI-ETABLISSEMENT-SECRETE-0123456789';
const INST_CLOUD = 'CLOUD-ETABLISSEMENT-SECRETE-0123456789';
let n = 0;
const ident = (over = {}) => ({ 'X-User-Id': `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, 'X-Plan': 'free', 'X-User-Email': 'nouveau@example.org', ...over });
const school = { 'X-Plan': 'institution', 'X-User-Email': 'prof@frenchschooljakarta.com' };
const college = { 'X-Plan': 'institution', 'X-User-Email': 'prof@college-test.example' };
const GEN = { contents: [{ parts: [{ text: 'a'.repeat(9000) }] }] }; // 9000 caractères = 3 tranches de 4000
const IMG = { contents: [{ parts: [{ text: 'améliore' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] }] };

const state = { platform: 'ok', google: 'ok', keys: { gemini: INST_GEMINI, cloud: INST_CLOUD }, calls: [], googleCalls: [] };
const reset = (over = {}) => Object.assign(state, { platform: 'ok', google: 'ok', keys: { gemini: INST_GEMINI, cloud: INST_CLOUD }, calls: [], googleCalls: [] }, over);
const spends = () => state.calls.filter((c) => c.route === '/internal/credits/spend');
const refunds = () => state.calls.filter((c) => c.route === '/internal/credits/refund');

const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Content-Type', 'application/json');
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* corps vide */ }
    if (url.pathname.startsWith('/internal/')) {
      if (state.platform === 'down') return req.socket.destroy();
      state.calls.push({ route: url.pathname, auth: req.headers.authorization, body });
      if (url.pathname === '/internal/credits/spend') {
        if (state.platform === 'empty') return res.writeHead(402).end('{"error":"no_credits"}');
        return res.end(JSON.stringify({ ok: true, metered: true, usageId: 77, charged: 1, credits: 12 }));
      }
      if (url.pathname === '/internal/credits/refund') return res.end('{"ok":true}');
      if (url.pathname === '/internal/credits/balance') return res.end('{"metered":true,"credits":12,"nextExpiry":"2026-12-01T00:00:00.000Z"}');
      if (url.pathname === '/internal/credits/prices') return res.end('{"unitsPerCredit":10,"prices":{"pdf_text":15,"pdf_image":400}}');
      if (url.pathname === '/internal/institution/keys') return res.end(JSON.stringify({ keys: state.keys }));
      return res.writeHead(404).end('{}');
    }
    state.googleCalls.push({ path: url.pathname, key: req.headers['x-goog-api-key'] });
    if (state.google === 'fail') return res.writeHead(500).end('{"error":{"message":"panne simulée"}}');
    if (url.pathname.startsWith('/vision')) return res.end('{"responses":[{"textAnnotations":[{"description":"ok"}]}]}');
    res.end('{"candidates":[{"content":{"parts":[{"text":"réponse"}]}}]}');
  });
});
await new Promise((r) => fake.listen(FAKE_PORT, '127.0.0.1', r));

const server = spawn(process.execPath, ['server.js'], {
  env: {
    PATH: process.env.PATH, ARDOISIA_MODE: '1', PORT: String(PORT), BASE_URL: B, SCHOOL_DOMAIN: 'frenchschooljakarta.com',
    GEMINI_API_KEY: SCHOOL_GEMINI, GOOGLE_VISION_API_KEY: SCHOOL_VISION, INDIVIDUAL_GEMINI_API_KEY: PUB_GEMINI,
    INTERNAL_API_SECRET: SECRET, PLATFORM_INTERNAL_URL: `http://127.0.0.1:${FAKE_PORT}`,
    GEMINI_API_BASE: `http://127.0.0.1:${FAKE_PORT}`, VISION_API_URL: `http://127.0.0.1:${FAKE_PORT}/vision`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${B}/api/healthz`)).ok) break; } catch { /* pas encore prêt */ }
  await new Promise((r) => setTimeout(r, 100));
}

async function call(method, p, headers = {}, body) {
  const r = await fetch(B + p, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: r.status, json, text, headers: r.headers };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); // le remboursement part juste après la réponse
const TEXT = (h, body = GEN) => call('POST', '/api/gemini/gemini-3.8-flash', h, body);

try {
  // 1. Identité obligatoire, connexion Google supprimée
  for (const [m, p] of [['GET', '/api/me'], ['POST', '/api/gemini/gemini-3.8-flash'], ['POST', '/api/vision']]) assert.equal((await call(m, p, {}, m === 'POST' ? {} : undefined)).status, 401, `${m} ${p} sans identité`);
  assert.equal((await call('GET', '/api/me', ident({ 'X-User-Id': 'pas-un-uuid' }))).status, 401);
  assert.equal((await call('GET', '/api/me', ident({ 'X-Plan': 'admin' }))).status, 401);
  assert.equal((await call('GET', '/api/healthz')).status, 200);
  assert.equal((await call('GET', '/auth/login', ident())).status, 404);
  assert.equal((await call('POST', '/api/desktop/claim', ident(), { nonce: 'x'.repeat(40) })).status, 404);

  // 2. /api/me : compte à crédits
  reset();
  const me = (await call('GET', '/api/me', ident())).json.user;
  assert.equal(me.covered, true);
  assert.deepEqual(me.credits, { balance: 12, nextExpiry: '2026-12-01T00:00:00.000Z', quota: null });
  assert.deepEqual(me.services, { gemini: true, vision: false }, 'pas de Vision pour les comptes à crédits (OCR intégré)');
  assert.deepEqual(me.prices, { text: 1.5, image: 40 });
  const sc = (await call('GET', '/api/me', ident(school))).json.user;
  assert.deepEqual(sc.services, { gemini: true, vision: true });
  assert.equal(sc.credits.balance, 12);

  // 3. Texte : débit par tranches de 4000 caractères, clé de l'éditeur, remboursement si Google échoue
  reset();
  const ok = await TEXT(ident());
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('x-credits-left'), '12');
  assert.deepEqual(spends()[0].body.action, 'pdf_text');
  assert.equal(spends()[0].body.quantity, 3);
  assert.equal(spends()[0].body.app, 'pdfedit');
  assert.equal(state.googleCalls[0].key, PUB_GEMINI, 'clé de l’éditeur, jamais celle du lycée');
  assert.equal(refunds().length, 0);
  reset({ google: 'fail' });
  assert.notEqual((await TEXT(ident())).status, 200);
  await sleep(250);
  assert.equal(refunds().length, 1);
  assert.deepEqual(refunds()[0].body.usageId, 77);

  // 4. Image : un débit « pdf_image »
  reset();
  await call('POST', '/api/gemini/gemini-3.1-flash-image', ident(), IMG);
  assert.equal(spends()[0].body.action, 'pdf_image');
  assert.equal(spends()[0].body.quantity, 1);

  // 5. Plus de crédits : 402, Google non appelé ; plateforme en panne : 503, jamais de repli
  reset({ platform: 'empty' });
  const empty = await TEXT(ident());
  assert.equal(empty.status, 402);
  assert.equal(empty.json.code, 'credits');
  assert.equal(state.googleCalls.length, 0);
  reset({ platform: 'down' });
  assert.equal((await TEXT(ident())).status, 503);
  assert.equal(state.googleCalls.length, 0);

  // 6. Modèle non autorisé : rien n'est débité
  reset();
  assert.equal((await call('POST', '/api/gemini/gemini-pro-vision', ident(), GEN)).status, 400);
  assert.equal(spends().length, 0);

  // 7. Lycée : clés du lycée, jamais débité ; Vision du lycée
  reset();
  assert.equal((await TEXT(ident(school))).status, 200);
  assert.equal(state.googleCalls.at(-1).key, SCHOOL_GEMINI);
  assert.equal((await call('POST', '/api/vision', ident(school), { requests: [] })).status, 200);
  assert.equal(state.googleCalls.at(-1).key, SCHOOL_VISION);
  assert.ok(state.calls.every((c) => c.route === '/internal/credits/spend'), 'le lycée ne fait que décompter son quota (aucun crédit débité)');

  // 8. Compte à crédits : Vision refusée proprement (l'OCR intégré prend le relais côté page)
  reset();
  const noVision = await call('POST', '/api/vision', ident(), { requests: [] });
  assert.equal(noVision.status, 403);
  assert.equal(noVision.json.code, 'noVision');
  assert.equal(state.googleCalls.length, 0);

  // 9. Autre établissement : SES clés, aucun débit ; sans clés : message clair, jamais les clés de l'éditeur
  reset();
  assert.equal((await TEXT(ident(college))).status, 200);
  assert.equal(state.googleCalls.at(-1).key, INST_GEMINI);
  assert.equal((await call('POST', '/api/vision', ident(college), { requests: [] })).status, 200);
  assert.equal(state.googleCalls.at(-1).key, INST_CLOUD);
  assert.ok(spends().length > 0, 'le quota de l’établissement est décompté (sans débit de crédits)');
  const collegeMe = (await call('GET', '/api/me', ident(college))).json.user;
  assert.deepEqual(collegeMe.services, { gemini: true, vision: true });
  assert.equal(collegeMe.credits.balance, 12);
  reset({ keys: {} });
  const nokeys = await TEXT(ident(college));
  assert.equal(nokeys.status, 403);
  assert.equal(nokeys.json.code, 'institutionKey');
  assert.equal(state.googleCalls.length, 0);
  reset({ platform: 'down' });
  assert.equal((await TEXT(ident(college))).status, 503);

  // 10. Accès limité : aucune fonction IA, rien n'est débité
  reset();
  const lim = () => ident({ 'X-Plan': 'limited', 'X-User-Email': 'limite@example.org' });
  const limMe = (await call('GET', '/api/me', lim())).json.user;
  assert.equal(limMe.limited, true);
  assert.deepEqual(limMe.services, { gemini: false, vision: false });
  assert.equal(limMe.credits, null);
  for (const [p, body] of [['/api/gemini/gemini-3.8-flash', GEN], ['/api/gemini/gemini-3.1-flash-image', IMG], ['/api/vision', { requests: [] }]]) {
    const r = await call('POST', p, lim(), body);
    assert.equal(r.status, 403, p);
    assert.equal(r.json.code, 'limited', p);
    assert.match(r.json.error.message, /accès limité/, p);
  }
  assert.equal(state.googleCalls.length, 0);
  assert.equal(state.calls.filter((c) => c.route.includes('/credits/spend')).length, 0);

  // 11. Les clés personnelles du navigateur sont ignorées en mode Ardoisia
  reset();
  await TEXT(ident({ 'X-Gemini-Key': 'CLE-PERSONNELLE-0123456789-ABCDEFGHIJ' }));
  assert.equal(state.googleCalls.at(-1).key, PUB_GEMINI);

  // 12. Journal : aucune clé, aucun secret
  assert.ok(!/SECRETE|secret-interne/.test(log), log);
  console.log('ardoisia OK');
} finally {
  server.kill();
  fake.closeAllConnections?.();
  fake.close();
}
