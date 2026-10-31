/**
 * web-account.js — Compte Google et clés API (version web uniquement).
 * Chargé avant web-shim.js ; sans effet dans l'application de bureau (Electron fournit déjà window.electronAPI).
 *
 *  - compte @frenchschooljakarta.com : le serveur utilise automatiquement les clés du lycée ;
 *  - autre compte Google : la personne utilise SES clés (Gemini, et Google Vision si elle veut l'OCR Google).
 *    Elles restent dans ce navigateur (localStorage), sont jointes à chaque demande (en-têtes X-Gemini-Key / X-Vision-Key)
 *    et ne sont ni enregistrées ni journalisées par le serveur.
 * L'éditeur PDF lui-même ne demande aucun compte.
 */
(function () {
  if (window.electronAPI) return;

  const STORE = { gemini: 'pdfedit.geminiKey', vision: 'pdfedit.visionKey' };
  const HEADER = { gemini: 'X-Gemini-Key', vision: 'X-Vision-Key' };
  const LABEL = { gemini: 'Gemini', vision: 'Google Vision' };
  // Version Ardoisia (page servie derrière la passerelle de la plateforme) : pas de connexion Google ici, pas de clés personnelles.
  const ARD = document.documentElement.dataset.mode === 'ardoisia';
  const portalUrl = () => (acct.user && acct.user.portal) || 'https://compte.ardoisia.com';
  let acct = { user: null, known: false };
  let loading = null;

  // ─── Clés (navigateur uniquement) ───────────────────────────────────────────
  function getKey(service) {
    try { return localStorage.getItem(STORE[service]) || ''; } catch { return ''; }
  }
  function setKey(service, k) {
    try { localStorage.setItem(STORE[service], k); } catch {}
  }
  function clearKey(service) {
    try { localStorage.removeItem(STORE[service]); } catch {}
  }

  // Anciennes versions : les clés étaient dans les réglages. On les garde comme clés personnelles puis on les retire des réglages.
  (function migrateLegacyKeys() {
    try {
      const s = JSON.parse(localStorage.getItem('pdfeditor_settings') || 'null');
      if (!s) return;
      let changed = false;
      for (const [field, service] of [['geminiKey', 'gemini'], ['googleVisionKey', 'vision']]) {
        if (!(field in s)) continue;
        if (s[field] && !getKey(service)) setKey(service, String(s[field]).trim());
        delete s[field];
        changed = true;
      }
      if (changed) localStorage.setItem('pdfeditor_settings', JSON.stringify(s));
    } catch {}
  })();

  // ─── Pastille permanente : crédits (ou quota du mois d'un établissement) restants ───────────────
  const nf1 = (n) => new Intl.NumberFormat(window.PDFE_LOCALE || 'fr-FR', { maximumFractionDigits: 1 }).format(n);
  function renderChip() {
    if (!ARD) return;
    const u = acct.user;
    const c = u && u.credits;
    let chip = document.getElementById('ard-credits-chip');
    if (!c || u.limited) { if (chip) chip.style.display = 'none'; return; }
    if (!chip) {
      // Dans la barre du haut, à gauche du bouton Paramètres (la page n'est peut-être pas encore construite : on réessaie à son chargement)
      const right = document.getElementById('hdr-right');
      if (!right) { document.addEventListener('DOMContentLoaded', renderChip, { once: true }); return; }
      chip = document.createElement('a');
      chip.id = 'ard-credits-chip';
      chip.target = '_blank';
      chip.rel = 'noopener';
      chip.style.cssText = 'display:inline-flex;align-items:center;white-space:nowrap;padding:5px 12px;border-radius:14px;background:rgba(200,150,46,.12);border:1px solid rgba(200,150,46,.55);color:#EDD070;font-size:.8rem;letter-spacing:.03em;text-decoration:none';
      right.prepend(chip);
    }
    chip.href = portalUrl() + '/compte' + (c.quota ? '' : '#recharge');
    chip.textContent = '💳 ' + nf1(c.balance) + ' crédit' + (c.balance >= 2 ? 's' : '') + (c.quota ? ' restant' + (c.balance >= 2 ? 's' : '') + ' ce mois-ci' : '');
    const cost = u.prices ? ' Coûts : traduction, résumé, chat ≈ ' + nf1(u.prices.text) + ' crédit' + (u.prices.text >= 2 ? 's' : '') + ' par tranche de 4 000 caractères ; image IA : ' + nf1(u.prices.image) + ' crédits ; OCR intégré gratuit.' : '';
    chip.title = (c.quota ? 'Quota du mois fixé par votre établissement : ' + nf1(c.quota.used) + ' utilisés sur ' + nf1(c.quota.limit) + ' crédits (renouvelé le 1er du mois).' : 'Vos crédits.') + cost;
    chip.style.display = '';
    chip.style.color = c.balance <= 0 ? '#ff7b7b' : '#EDD070';
  }

  // ─── Compte ─────────────────────────────────────────────────────────────────
  function load(force) {
    if (loading && !force) return loading;
    loading = (async () => {
      try {
        const r = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(6000) });
        if (ARD && r.status === 401) { location.href = portalUrl() + '/login?next=' + encodeURIComponent(location.href); return acct; }
        const d = await r.json();
        acct = { user: d.user || null, known: true };
        renderChip();
      } catch {
        acct = { user: acct.user, known: false }; // hors ligne : on ne sait pas
      }
      return acct;
    })();
    return loading;
  }

  // 'ok' | 'login' (pas connecté) | 'key' (compte personnel sans clé pour ce service) | 'offline'
  function status(service) {
    if (!acct.known) return 'offline';
    if (!acct.user) return 'login';
    if (ARD) {
      const u = acct.user;
      if (u.limited) return 'limited';
      if (u.services && u.services[service]) return 'ok';
      return service === 'vision' ? 'novision' : 'unavailable';
    }
    if (acct.user.school) return 'ok';
    return getKey(service) ? 'ok' : 'key';
  }
  const ready = (service) => status(service) === 'ok';

  // La clé personnelle n'est jointe que pour les comptes qui n'ont pas droit aux clés du lycée.
  function headers(service) {
    const h = {};
    if (!ARD && acct.user && !acct.user.school) {
      const k = getKey(service);
      if (k) h[HEADER[service]] = k;
    }
    return h;
  }

  // Fenêtre de connexion : l'éditeur reste ouvert avec le PDF en cours. Repli : page entière si la fenêtre est bloquée.
  function login() {
    return new Promise((resolve) => {
      const w = window.open('/auth/login?popup=1', 'pdfedit-login', 'width=520,height=700');
      if (!w) { location.href = '/auth/login'; return; }
      let done = false;
      const finish = async (st) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMsg);
        clearInterval(iv);
        await load(true);
        resolve(st);
      };
      const onMsg = (e) => {
        if (e.origin === location.origin && e.data && e.data.type === 'pdfedit-login') finish(e.data.status);
      };
      window.addEventListener('message', onMsg);
      const iv = setInterval(() => { if (w.closed) setTimeout(() => finish('closed'), 600); }, 700);
    });
  }

  async function logout() {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
    // Ordinateur partagé : les clés personnelles ne restent pas après la déconnexion.
    clearKey('gemini');
    clearKey('vision');
    await load(true);
  }

  async function checkKey(service, k) {
    try {
      const r = await fetch('/api/key/check?service=' + service, { method: 'POST', credentials: 'same-origin', headers: { [HEADER[service]]: k } });
      const d = await r.json().catch(() => ({}));
      return r.ok ? { ok: true } : { ok: false, error: d.error || 'Clé refusée.' };
    } catch {
      return { ok: false, error: 'Pas de connexion à Internet : impossible de vérifier la clé.' };
    }
  }

  // Ouvre le panneau de connexion / clés (les réglages) quand une fonction IA ou OCR en a besoin.
  function gate() {
    if (typeof window.openOcrSettings === 'function') window.openOcrSettings();
  }

  // ─── Interface (bloc « Compte » des réglages) ───────────────────────────────
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) n.append(kid);
    return n;
  }
  const S = {
    title: "font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.12em;color:var(--gold);margin-bottom:10px;text-transform:uppercase",
    p: 'margin:0 0 8px;font-size:.82rem;line-height:1.5',
    muted: 'margin:6px 0;font-size:.74rem;opacity:.6;line-height:1.5',
    input: 'flex:1;min-width:0;padding:7px 10px;background:rgba(0,0,0,.35);border:1px solid rgba(200,150,46,.4);border-radius:3px;color:var(--txt);font-family:monospace;font-size:.82rem;box-sizing:border-box;outline:none',
    card: 'margin-top:12px;padding:10px 12px;background:rgba(0,0,0,.25);border:1px solid rgba(200,150,46,.3);border-radius:4px',
  };
  const mbtn = (label, onclick) => el('div', { class: 'mbtn', onclick }, label);

  function keyBlock(service, title, hint, refresh) {
    const has = !!getKey(service);
    const input = el('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Collez ici votre clé', 'aria-label': 'Clé API ' + LABEL[service], style: S.input });
    const msg = el('div', { role: 'status', style: 'margin-top:6px;font-size:.76rem;min-height:1em' });
    const save = async () => {
      const k = input.value.trim();
      if (!k) { msg.style.color = '#e67e73'; msg.textContent = 'Collez d’abord votre clé.'; return; }
      msg.style.color = ''; msg.textContent = 'Vérification…';
      const res = await checkKey(service, k);
      if (!res.ok) { msg.style.color = '#e67e73'; msg.textContent = res.error; return; }
      setKey(service, k);
      refresh();
    };
    const card = el('div', { style: S.card },
      el('div', { style: 'font-size:.84rem;font-weight:600;margin-bottom:4px' }, title,
        el('span', { style: 'margin-left:8px;font-size:.72rem;font-weight:400;color:' + (has ? '#2ecc71' : 'var(--txt2)') }, has ? '✓ enregistrée dans ce navigateur' : 'non enregistrée')),
      el('div', { style: S.muted }, hint));
    const help = el('div', {});
    help.innerHTML = typeof window._keyHelpHtml === 'function' ? window._keyHelpHtml(service, !has && service === 'gemini') : '';
    card.append(help,
      el('div', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px' }, input, mbtn(has ? 'Remplacer' : 'Vérifier et enregistrer', save)),
      msg);
    if (has) card.append(el('div', { style: 'margin-top:8px' }, mbtn('Supprimer ma clé', () => { clearKey(service); refresh(); })));
    return card;
  }

  function renderBox(container, onChange) {
    const refresh = () => { renderBox(container, onChange); if (onChange) onChange(); };
    renderBody(container, refresh);
    container.append(privacyLink());
  }

  // Version Ardoisia : type de compte, crédits, tarifs et liens vers le compte Ardoisia (aucune clé à saisir).
  function renderArdoisia(container) {
    const u = acct.user;
    const nb = (n) => new Intl.NumberFormat(window.PDFE_LOCALE || 'fr-FR').format(n);
    container.replaceChildren(el('div', { style: S.title }, 'Compte Ardoisia'));
    if (!acct.known || !u) {
      container.append(el('p', { style: S.muted }, 'Compte indisponible hors connexion. L’éditeur PDF fonctionne quand même ; seules les fonctions IA ont besoin du réseau.'));
      return;
    }
    container.append(el('p', { style: S.p }, el('strong', {}, u.name || u.email)));
    const note = (text, tone) => el('p', { style: 'margin:0 0 10px;padding:8px 10px;border:1px solid ' + (tone === 'bad' ? 'rgba(230,126,115,.4);background:rgba(230,126,115,.08)' : 'rgba(46,204,113,.3);background:rgba(46,204,113,.08)') + ';border-radius:4px;font-size:.8rem' }, text);
    if (u.limited) {
      container.append(note('Accès limité : l’éditeur PDF fonctionne, mais la traduction, le résumé, le chat avec le PDF et l’amélioration d’image par IA sont désactivés. L’OCR intégré reste disponible.', 'bad'));
    } else if (u.school) {
      container.append(note('Compte du lycée : les fonctions IA et l’OCR Google Vision sont incluses. Rien à configurer.'));
    } else if (u.institutional) {
      container.append(note(u.services && u.services.gemini
        ? 'Les clés d’IA de votre établissement sont utilisées : aucun crédit consommé.'
        : 'Les clés d’IA de votre établissement ne sont pas encore configurées : les fonctions IA sont indisponibles pour le moment.', u.services && u.services.gemini ? 'ok' : 'bad'));
    } else {
      const c = u.credits;
      container.append(note('Les fonctions IA sont incluses et consomment des crédits.'));
      if (c) container.append(el('p', { style: S.p }, c.balance > 0
        ? 'Il vous reste ' + nb(c.balance) + ' crédit' + (c.balance >= 2 ? 's' : '') + (c.nextExpiry ? ', valables jusqu’au ' + new Date(c.nextExpiry).toLocaleDateString(window.PDFE_LOCALE || 'fr-FR') + ' au plus tard' : '') + '.'
        : 'Vous n’avez plus de crédits.'));
      if (u.prices) container.append(el('p', { style: S.muted }, 'Traduction, résumé, chat : environ ' + nb(u.prices.text) + ' crédit' + (u.prices.text >= 2 ? 's' : '') + ' par tranche de 4 000 caractères envoyés. Amélioration d’image par IA : ' + nb(u.prices.image) + ' crédits. L’OCR intégré est gratuit.'));
    }
    if ((u.school || u.institutional) && u.credits && u.credits.quota) {
      const c = u.credits, q = c.quota;
      container.append(el('p', { style: S.p }, 'Il vous reste ' + nb(c.balance) + ' crédit' + (c.balance >= 2 ? 's' : '') + ' ce mois-ci (' + nb(q.used) + ' utilisés sur ' + nb(q.limit) + ', quota fixé par votre établissement ; renouvelé le 1er du mois).'));
      if (u.prices) container.append(el('p', { style: S.muted }, 'Traduction, résumé, chat : environ ' + nb(u.prices.text) + ' crédit' + (u.prices.text >= 2 ? 's' : '') + ' par tranche de 4 000 caractères envoyés. Amélioration d’image par IA : ' + nb(u.prices.image) + ' crédits. L’OCR intégré est gratuit.'));
    }
    const link = (href, label) => el('a', { href, target: '_blank', rel: 'noopener', style: 'color:var(--gold-l);margin-right:14px' }, label);
    container.append(el('p', { style: 'margin-top:10px;font-size:.82rem' },
      link(portalUrl() + '/compte', 'Mon compte Ardoisia'),
      u.institutional || u.school ? '' : link(portalUrl() + '/compte#recharge', 'Recharger mes crédits')));
  }

  function renderBody(container, refresh) {
    if (ARD) return renderArdoisia(container);
    container.replaceChildren();
    container.append(el('div', { style: S.title }, 'Compte Google'));
    if (!acct.known) {
      container.append(el('p', { style: S.muted }, 'Compte indisponible hors connexion. L’éditeur PDF fonctionne quand même ; seules les fonctions IA et l’OCR Google ont besoin du réseau.'),
        mbtn('↻ Réessayer', async () => { await load(true); refresh(); }));
      return;
    }
    const user = acct.user;
    if (!user) {
      container.append(
        el('p', { style: S.p }, 'Connectez-vous avec Google pour utiliser les fonctions IA (traduction, résumé, chat avec le PDF, amélioration d’image) et l’OCR Google Vision.'),
        el('p', { style: S.muted }, 'Compte @frenchschooljakarta.com : tout est automatique, rien d’autre à faire. Autre compte Google : vous utiliserez vos propres clés API (le mode d’emploi s’affiche après la connexion). L’éditeur PDF lui-même fonctionne sans compte.'),
        mbtn('Se connecter avec Google', async () => { await login(); refresh(); }));
      return;
    }
    container.append(el('p', { style: S.p }, el('strong', {}, user.name || user.email), el('br'), el('span', { style: 'opacity:.65;font-size:.76rem' }, user.email)));
    if (user.school) {
      container.append(el('p', { style: 'margin:0 0 10px;padding:8px 10px;border:1px solid rgba(46,204,113,.3);background:rgba(46,204,113,.08);border-radius:4px;font-size:.8rem' },
        'Compte du lycée : les fonctions IA et l’OCR Google Vision sont incluses. Rien à configurer.'));
    } else {
      container.append(
        el('p', { style: S.p }, 'Ce n’est pas un compte du lycée : pour les fonctions IA et l’OCR Google, ajoutez vos propres clés API.'),
        keyBlock('gemini', 'Clé Gemini', 'Nécessaire pour : traduction IA, résumé, chat avec le PDF, amélioration d’image IA.', refresh),
        keyBlock('vision', 'Clé Google Vision (facultative)', 'Seulement pour l’OCR « Google Vision ». L’OCR intégré (Tesseract) fonctionne sans clé.', refresh),
        el('p', { style: S.muted }, 'Vos clés restent dans ce navigateur. Elles sont jointes à chaque demande envoyée au serveur de PDFEdit, qui les transmet à Google sans les enregistrer ni les conserver dans ses journaux. L’utilisation est facturée par Google selon votre offre.'));
    }
    container.append(el('div', { style: 'margin-top:12px' }, mbtn('Se déconnecter', async () => { await logout(); refresh(); })),
      el('p', { style: S.muted }, 'La déconnexion supprime aussi vos clés personnelles de ce navigateur.'));
  }

  // Lien vers la politique de confidentialité (page commune aux applications du lycée) : affiché dans tous les cas.
  function privacyLink() {
    return el('p', { style: S.muted }, el('a', { href: 'https://a-vos-tables.artmonie.com/confidentialite.html#pdfedit-or', target: '_blank', rel: 'noopener', style: 'color:var(--gold-l)' }, 'Politique de confidentialité'));
  }

  // Retour d'une connexion par page entière (fenêtre bloquée) : prévenir en cas d'échec.
  window.addEventListener('load', () => {
    const q = new URLSearchParams(location.search);
    if (!q.has('login')) return;
    history.replaceState(null, '', location.pathname);
    if (typeof window.t === 'function') window.t('La connexion Google a échoué. Réessayez.');
  });

  // Message au premier plan (au-dessus de toutes les fenêtres, y compris celle de la fonction en cours) : accès limité, crédits épuisés…
  // Remplace l'ouverture des réglages, qui s'affichaient DERRIÈRE la fenêtre de la fonction. Texte inséré comme du texte.
  let noticeTimer = null;
  function notice(message, withRecharge) {
    if (!ARD) return;
    let box = document.getElementById('ard-notice');
    if (!box) {
      box = el('div', { id: 'ard-notice', role: 'alert', style: 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:30000;max-width:min(560px,92vw);padding:12px 40px 12px 16px;background:#1a1a2e;border:1px solid var(--gold,#c8962e);border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.5);color:var(--txt,#eee);font-size:.86rem;line-height:1.5' });
      document.body.append(box);
    }
    const close = el('span', { style: 'position:absolute;top:6px;right:12px;cursor:pointer;font-size:1.1rem;opacity:.7', title: 'Fermer', 'aria-label': 'Fermer', onclick: () => { box.style.display = 'none'; } }, '✕');
    const link = (href, label) => el('a', { href, target: '_blank', rel: 'noopener', style: 'color:var(--gold-l,#e6c46a);margin-right:14px' }, label);
    box.replaceChildren(close, el('div', {}, message),
      el('div', { style: 'margin-top:8px;font-size:.8rem' }, link(portalUrl() + '/compte', 'Mon compte Ardoisia'), withRecharge ? link(portalUrl() + '/compte#recharge', 'Recharger mes crédits') : ''));
    box.style.display = 'block';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { box.style.display = 'none'; }, 15000);
  }

  // Crédits restants (en-tête X-Credits-Left des réponses du serveur) : le bloc « Compte » les affiche à l'ouverture des réglages.
  function setCredits(n) {
    if (acct.user && acct.user.credits && Number.isFinite(n)) {
      acct.user.credits.balance = n;
      if (acct.user.credits.quota) acct.user.credits.quota.used = Math.max(0, acct.user.credits.quota.limit - n); // quota : « utilisés » suit le solde
      renderChip();
    }
  }

  window.webAccount = { load, status, ready, headers, login, logout, gate, renderBox, setCredits, notice, ardoisia: ARD, get: () => acct };
  load();
})();
