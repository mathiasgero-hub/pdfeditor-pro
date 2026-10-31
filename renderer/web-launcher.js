// Ouverture automatique des fichiers envoyés par le lanceur Windows (dossier « lanceur/ » du dépôt).
// Le lanceur sert les fichiers sur 127.0.0.1 (secret aléatoire) et ouvre cette page avec « #ouvrir=PORT:SECRET:ID ».
// On récupère le fichier, puis on « écoute » le lanceur : les fichiers suivants arrivent dans cette même page, en nouvel onglet
// de l'éditeur, sans ouvrir de nouvel onglet de navigateur. Sans cette ancre, ce script ne fait rien (aucun accès au réseau local).
(function () {
  const m = /^#ouvrir=(\d{2,5}):([0-9a-f]{16,64}):([0-9a-f]{8,32})$/i.exec(location.hash);
  if (!m) return;
  const base = 'http://127.0.0.1:' + m[1];
  const secret = m[2];
  history.replaceState(null, '', location.pathname + location.search); // un rechargement de la page ne relance pas la récupération
  const say = (msg) => (typeof window.t === 'function' ? window.t(msg) : console.log(msg));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function get(path) {
    const opts = { mode: 'cors', cache: 'no-store' };
    let res;
    try { res = await fetch(base + path, { ...opts, targetAddressSpace: 'loopback' }); } // option réservée au « réseau local » des navigateurs récents
    catch (e) { res = await fetch(base + path, opts); }
    if (!res.ok) throw new Error('réponse ' + res.status);
    return res;
  }

  async function openItem(id, fallbackName) {
    const meta = await (await get('/m/' + secret + '/' + id)).json();
    const bytes = new Uint8Array(await (await get('/f/' + secret + '/' + id)).arrayBuffer());
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 8192) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    await window.__openLocalFile(meta.name || fallbackName, btoa(b64));
  }

  // Les ouvertures se font l'une après l'autre (l'éditeur ne gère pas deux ouvertures simultanées).
  let chain = Promise.resolve();
  function enqueue(id, name) {
    chain = chain.then(() => openItem(id, name)).catch((e) => {
      console.error('[web-launcher]', e);
      say("Le lanceur n'a pas pu transmettre « " + (name || 'le fichier') + " » (" + ((e && e.message) || e) + ").");
    });
  }

  async function listen() {
    let failures = 0;
    for (;;) {
      try {
        const list = await (await get('/attente/' + secret)).json();
        failures = 0;
        for (const it of list) { say('Ouverture de « ' + it.name + ' »…'); enqueue(it.id, it.name); }
      } catch (e) {
        // Le lanceur s'est arrêté (inactivité) ou est momentanément injoignable : on réessaie un moment, puis on laisse tomber.
        if (++failures > 6) { console.log('[web-launcher] lanceur arrêté, fin de l\'écoute'); return; }
        await wait(2000 * failures);
      }
    }
  }

  (async function run() {
    for (let i = 0; i < 200 && !(typeof window.handleOpenWith === 'function' && window.__openLocalFile); i++) await wait(100);
    say('Ouverture du fichier envoyé par le lanceur…');
    enqueue(m[3], '');
    await chain;
    listen();
  })();
})();
