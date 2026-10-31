// Langue de l'interface de PDFEdit Or (version Ardoisia) : le portail mémorise le choix de la personne dans le cookie
// partagé « ard_lang » (fr, en ou id). Les textes de l'application sont écrits en français ; pour l'anglais et l'indonésien
// on les traduit au vol (dictionnaire i18n-en.js / i18n-id.js : texte français -> traduction, avec des motifs {x} pour les
// textes qui contiennent des valeurs). Le texte déjà présent est traduit au chargement, puis tout ce qui s'ajoute ensuite
// (menus, messages, fenêtres) est traduit par un observateur. Les titres ne sont jamais traduits.
(function () {
  var m = document.cookie.match(/(?:^|;\s*)ard_lang=(fr|en|id)/);
  var lang = m ? m[1] : 'fr';
  window.PDFE_LANG = lang;
  window.PDFE_LOCALE = lang === 'id' ? 'id-ID' : lang === 'en' ? 'en-GB' : 'fr-FR';
  window.pdfeTr = function (s) { return s; };
  if (lang === 'fr' || /[?&]noi18n/.test(location.search)) return; // ?noi18n : désactive la traduction au vol (diagnostic)
  var dict = (window.PDFE_DICT && window.PDFE_DICT[lang]) || {};
  document.documentElement.lang = lang;

  var NEVER = { 'PDFEdit': 1, 'PDFEdit Or': 1, 'PDFEdit - Édition Or': 1, 'PDFEditor Pro': 1 };
  var norm = function (t) { return t.replace(/\s+/g, ' ').trim(); };
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  // Motifs : les clés qui contiennent {x}
  var patterns = [];
  Object.keys(dict).forEach(function (key) {
    if (key.indexOf('{') < 0) return;
    var names = [];
    var re = '^' + key.split(/(\{\w+\})/).map(function (part) {
      var mm = part.match(/^\{(\w+)\}$/);
      if (mm) { names.push(mm[1]); return '([\\s\\S]*?)'; }
      // l'espace avant une valeur finale peut avoir été retiré par la mise en forme du texte
      return esc(part).replace(/ $/, '\\s*');
    }).join('') + '$';
    // Morceaux de texte fixes du motif : on les cherche d'abord (indexOf) pour ne lancer l'expression régulière que sur un texte plausible
    var lits = key.split(/\{\w+\}/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length >= 2; });
    patterns.push({ re: new RegExp(re), names: names, out: dict[key], len: key.length, lits: lits });
  });
  patterns.sort(function (a, b) { return b.len - a.len; }); // les plus précis d'abord

  var cache = {};
  function translate(text, depth) {
    var key = norm(text);
    if (!key || NEVER[key] || key.length > 800) return null; // les très longs textes ne sont jamais des messages à motif
    if (Object.prototype.hasOwnProperty.call(dict, key) && key.indexOf('{') < 0) return dict[key];
    if (key in cache) return cache[key];
    var res = null;
    for (var i = 0; i < patterns.length && !res; i++) {
      var lits = patterns[i].lits;
      var plausible = true;
      for (var j = 0; j < lits.length; j++) if (key.indexOf(lits[j]) < 0) { plausible = false; break; }
      if (!plausible) continue;
      var mm = patterns[i].re.exec(key);
      if (!mm) continue;
      var vals = {};
      patterns[i].names.forEach(function (n, k) {
        var v = mm[k + 1];
        vals[n] = depth > 2 ? v : (translate(v, (depth || 0) + 1) || v);
      });
      res = patterns[i].out.replace(/\{(\w+)\}/g, function (all, n) { return n in vals ? vals[n] : all; });
    }
    if (res && res.replace(/\s/g, '') === key.replace(/\s/g, '')) res = null;
    if (Object.keys(cache).length < 3000) cache[key] = res;
    return res;
  }
  window.pdfeTr = function (s) { return translate(String(s)) || s; };

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/;

  function fixText(node) {
    var d = node.data;
    var core = d.trim();
    if (!core) return;
    if (node.__out && norm(core) === node.__out) return; // c'est déjà notre traduction
    var t = translate(core);
    if (t && t !== core) {
      // garde-fou : un même nœud n'est jamais retraduit plus de 4 fois (évite toute boucle avec le script de l'application)
      node.__tn = (node.__tn || 0) + 1;
      if (node.__tn > 4) return;
      node.data = d.replace(core, function () { return t; });
      node.__out = norm(t);
    }
  }
  function fixAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (!v) continue;
      el.__ao = el.__ao || {};
      if (el.__ao[ATTRS[i]] && norm(v) === el.__ao[ATTRS[i]]) continue;
      var t = translate(v);
      if (t && t !== v) {
        el.__an = (el.__an || 0) + 1;
        if (el.__an > 12) continue;
        el.setAttribute(ATTRS[i], t);
        el.__ao[ATTRS[i]] = norm(t);
      }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!root.parentNode || !SKIP.test(root.parentNode.nodeName)) fixText(root); return; }
    if (root.nodeType !== 1) return;
    fixAttrs(root);
    if (SKIP.test(root.nodeName)) return;
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  // Fenêtres natives
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') args[0] = window.pdfeTr(msg);
      return orig.apply(window, args);
    };
  });

  function start() {
    var t = document.title && translate(document.title);
    if (t) document.title = t;
    walk(document.body);
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === 'childList') r.addedNodes.forEach(walk);
        else if (r.type === 'characterData') { if (r.target.parentNode && !SKIP.test(r.target.parentNode.nodeName)) fixText(r.target); }
        else if (r.type === 'attributes') fixAttrs(r.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
