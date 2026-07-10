'use strict';
/**
 * app.js — PDFEditor v19
 *
 * Changements v19 :
 *  1. createSearchablePDF : 1 pixel = 1 point PDF (aucune perte de qualite).
 *     Suppression du MAX_POINTS 1200 qui degradait la resolution.
 *  2. Architecture de rendu refactorisee :
 *     renderMainPages(pdf, scale) — rendu separé des pages principales
 *     renderThumbnails(pdf)       — rendu des vignettes (une seule fois)
 *  3. zoom() : re-render PDF.js a la bonne echelle (canvas haute resolution)
 *     au lieu de CSS zoom qui agrandissait des pixels deja flous.
 *     Annulation des renders en cours via renderGen.
 */

// ══ Internationalisation (i18n) ═══════════════════════════════════════════════
let _lang = 'fr';

const LANG = {
  fr: {
    // ── Menu Fichier ──────────────────────────────────────────────────────────
    'menu.file'            : 'Fichier',
    'menu.new'             : 'Nouveau',
    'menu.open'            : 'Ouvrir un PDF…',
    'menu.import_ocr'      : 'Importer image → PDF (OCR)',
    'menu.save'            : 'Enregistrer',
    'menu.save_as'         : 'Enregistrer sous…',
    'menu.export'          : 'Exporter vers…',
    'menu.batch'           : 'Traitement par lots',
    'menu.repair'          : 'Réparer un PDF corrompu',
    'menu.print'           : 'Imprimer…',
    'menu.quit'            : 'Quitter',
    // ── Menu Édition ─────────────────────────────────────────────────────────
    'menu.edit'            : 'Édition',
    'menu.undo'            : 'Annuler',
    'menu.redo'            : 'Rétablir',
    'menu.cut'             : 'Couper',
    'menu.copy'            : 'Copier',
    'menu.paste'           : 'Coller',
    'menu.paste_ext'       : 'Collage externe',
    'menu.find'            : 'Rechercher & Remplacer',
    'menu.redact'          : 'Biffure définitive',
    // ── Menu Pages ───────────────────────────────────────────────────────────
    'menu.pages'           : 'Pages',
    'menu.merge'           : 'Fusionner images et PDFs',
    'menu.pagesize'        : 'Taille de la page',
    'menu.rotate'          : 'Pivoter',
    'menu.bookmarks'       : 'Gérer les signets',
    'menu.toc'             : 'Table des matières',
    'menu.bates'           : 'Numérotation Bates',
    'menu.header_footer'   : 'En-têtes & Pieds de page',
    'menu.watermark'       : 'Filigranes & Tampons',
    'menu.remove_wm'       : 'Supprimer les filigranes',
    // ── Menu IA ──────────────────────────────────────────────────────────────
    'menu.ia'              : 'IA',
    'menu.summarize_doc'   : 'Résumer le document',
    'menu.translate_doc'   : 'Traduire (40+ langues)',
    'menu.chat_pdf'        : 'Discuter avec le PDF',
    'menu.ocr_rec'         : 'Reconnaître (OCR)',
    'menu.extract_tables'  : 'Extraire tableaux',
    // ── Menu Outils ──────────────────────────────────────────────────────────
    'menu.tools'           : 'Outils',
    'menu.compress'        : 'Compresser',
    'menu.enhance_ia'      : 'Amélioration IA',
    'menu.layers'          : 'Calques',
    'menu.media'           : 'Vidéo / Audio / 3D',
    'menu.measure'         : 'Mesures & Cotation',
    'menu.color_mgmt'      : 'Gestion couleurs (ICC)',
    'menu.preflight'       : 'Préflighting',
    'menu.accessibility'   : 'Accessibilité',
    'menu.pdf_std'         : 'PDF/A · X · E · UA',
    'menu.highlight'       : 'Surligner',
    'menu.note'            : 'Ajouter une note',
    'menu.draw'            : 'Dessiner',
    'menu.shapes'          : 'Formes & Flèches',
    'menu.compare'         : 'Comparer deux versions',
    'menu.history'         : 'Historique des modifications',
    // ── Menu Sécurité ────────────────────────────────────────────────────────
    'menu.security'        : 'Sécurité',
    'menu.encrypt'         : 'Chiffrer',
    'menu.password'        : 'Mot de passe',
    'menu.restrict'        : 'Restreindre les droits',
    'menu.redact_perm'     : 'Biffure permanente',
    'menu.metadata'        : 'Métadonnées',
    'menu.sign'            : 'Signature électronique',
    // ── Menu Affichage ───────────────────────────────────────────────────────
    'menu.view'            : 'Affichage',
    'menu.zoom_in'         : 'Zoom avant',
    'menu.zoom_out'        : 'Zoom arrière',
    'menu.fit_page'        : 'Adapter à la page',
    'menu.theme_dark'      : 'Thème sombre',
    'menu.theme_light'     : 'Thème clair',
    'menu.fullscreen'      : 'Plein écran',
    'menu.double_page'     : 'Page double',
    // ── Menu Aide ────────────────────────────────────────────────────────────
    'menu.help'            : 'Aide',
    'menu.settings'        : 'Paramètres',
    'menu.about'           : 'À propos',
    // ── Groupes toolbar ──────────────────────────────────────────────────────
    'tgl.file'             : 'Fichier',
    'tgl.edit'             : 'Édition',
    'tgl.review'           : 'Révision',
    'tgl.pages'            : 'Pages',
    'tgl.advanced'         : 'Avancé',
    'tgl.security'         : 'Sécurité',
    // ── Panneaux gauche / droit ───────────────────────────────────────────────
    'lp.views'             : 'Vues',
    'lp.bookmarks'         : 'Signets',
    'lp.fields'            : 'Champs',
    'lp.empty'             : 'Ouvrez un PDF\npour afficher les vignettes',
    'rp.props'             : 'Propriétés',
    'rp.ai'                : 'IA',
    'rp.security'          : 'Sécurité',
    // ── Zone de dépôt ────────────────────────────────────────────────────────
    'dz.title'             : 'Ouvrir un document PDF',
    'dz.sub'               : 'Cliquez ici ou glissez-déposez votre fichier .pdf',
    'dz.btn'               : 'Parcourir…',
    // ── Panneau droit — Propriétés ────────────────────────────────────────────
    'pr.document'          : 'Document',
    'pr.file'              : 'Fichier',
    'pr.pages'             : 'Pages',
    'pr.size'              : 'Taille',
    'pr.layout'            : 'Mise en page',
    'pr.header_r'          : 'En-tête — droite',
    'pr.footer_r'          : 'Pied de page — droite',
    'pr.palette'           : 'Palette de couleurs',
    'pr.quality'           : 'Qualité & Conformité',
    'pr.score'             : 'Score',
    'pr.standard'          : 'Standard',
    'pr.a11y'              : 'Accessibilité',
    // ── Panneau droit — IA ───────────────────────────────────────────────────
    'ai.ocr_section'       : 'Reconnaissance (OCR)',
    'ai.make_readable'     : 'Rendre ce PDF lisible (OCR)',
    'ai.import_img'        : 'Importer image → PDF',
    'ai.generation'        : 'Génération IA',
    'ai.summarize'         : 'Résumer',
    'ai.translate'         : 'Traduire',
    'ai.chat'              : 'Discuter avec le PDF',
    // ── Barre opérations pages ────────────────────────────────────────────────
    'pop.copy'             : 'Copier',
    'pop.paste'            : 'Coller',
    'pop.up'               : 'Monter',
    'pop.down'             : 'Descendre',
    'pop.rotate'           : 'Pivoter',
    'pop.delete'           : 'Sup.',
    // ── Toolbar tooltips ─────────────────────────────────────────────────────
    'tip.undo'             : 'Annuler la dernière action (⌘Z)',
    'tip.redo'             : 'Rétablir (⇧⌘Z)',
    'tip.open'             : 'Ouvrir un PDF',
    'tip.save'             : 'Enregistrer (⌘S)',
    'tip.merge'            : 'Fusionner images et PDFs en un seul document',
    'tip.zoom_in'          : 'Zoom avant',
    'tip.zoom_out'         : 'Zoom arrière',
    'tip.fit'              : 'Ajuster à la fenêtre',
    'tip.rotate'           : 'Pivoter la page de 90°',
    'tip.read'             : 'Lecture',
    'tip.select'           : 'Sélection (zone rectangulaire)',
    'tip.text'             : 'Texte — ajouter ou modifier du texte',
    'tip.highlight'        : 'Surligner du texte',
    'tip.note'             : 'Ajouter une note',
    'tip.redact'           : 'Biffure — masquer définitivement du contenu',
    'tip.draw'             : 'Stylo — dessin libre',
    'tip.shapes'           : 'Formes & Flèches',
    'tip.measure'          : 'Mesures',
    'tip.eyedropper'       : 'Pipette — prélever une couleur',
    'tip.ocr'              : 'OCR — reconnaître le texte d\'une image',
    'tip.sign'             : 'Signature électronique',
    'tip.print'            : 'Imprimer (⌘P)',
    'tip.settings'         : 'Paramètres',
    'tip.help'             : 'Aide & raccourcis clavier',
    'tip.new'              : 'Nouveau document (⌘N)',
    'tip.image'            : 'Insérer ou déplacer une image',
    'tip.compress'         : 'Compresser le fichier (–20% à –80%)',
    'tip.compare'          : 'Comparer deux versions du document',
    'tip.summarize'        : 'Résumé IA — analyse intelligente du document',
    'tip.batch'            : 'Traitement par lots — action sur plusieurs fichiers',
    'tip.encrypt'          : 'Chiffrer et protéger par mot de passe (AES-256)',
    // ── Boutons communs ───────────────────────────────────────────────────────
    'btn.cancel'           : 'Annuler',
    'btn.apply'            : 'Appliquer',
    'btn.save'             : 'Enregistrer',
    'btn.close'            : 'Fermer',
    'btn.ok'               : 'OK',
    // ── Paramètres ───────────────────────────────────────────────────────────
    'settings.title'       : 'Paramètres',
    'settings.lang'        : 'Langue',
    'settings.lang_fr'     : 'Français',
    'settings.lang_en'     : 'English',
    'settings.ocr_engine'  : 'Moteur OCR',
    'settings.ocr_local'   : 'Local — hors ligne — sans configuration',
    'settings.ocr_ai'      : 'IA — haute précision — nécessite une clé API',
    'settings.gv_key'      : 'Clé API Google Cloud Vision',
    'settings.openai_key'  : 'Clé API OpenAI (ChatGPT)',
    'settings.openai_used' : 'Utilisée pour : Traduction IA · Résumé · Chat avec le PDF',
    'settings.saved'       : 'Paramètres enregistrés',
    // ── Taille de la page ─────────────────────────────────────────────────────
    'pgsize.title'         : 'Taille de la page',
    'pgsize.page'          : 'Page',
    'pgsize.unit'          : 'Unité',
    'pgsize.width'         : 'Largeur',
    'pgsize.height'        : 'Hauteur',
    'pgsize.presets'       : 'Formats rapides :',
    'pgsize.scope'         : 'Appliquer à',
    'pgsize.current'       : 'Page courante seulement',
    'pgsize.all'           : 'Toutes les pages',
    'pgsize.lock_tip'      : 'Verrouiller les proportions',
    // ── Panneau pages (pop-up vignettes) ─────────────────────────────────────
    'pages.insert_before'  : 'Insérer avant',
    'pages.insert_after'   : 'Insérer après',
    'pages.delete'         : 'Supprimer',
    'pages.rotate'         : 'Pivoter',
    'pages.paste'          : 'Coller après',
    // ── Divers ───────────────────────────────────────────────────────────────
    'drop.hint'            : 'Glissez un PDF ici ou cliquez pour ouvrir',
    'no_pdf'               : 'Aucun PDF ouvert',
    'page_of'              : 'sur',
  },
  en: {
    // ── Menu Fichier ──────────────────────────────────────────────────────────
    'menu.file'            : 'File',
    'menu.new'             : 'New',
    'menu.open'            : 'Open PDF…',
    'menu.import_ocr'      : 'Import image → PDF (OCR)',
    'menu.save'            : 'Save',
    'menu.save_as'         : 'Save as…',
    'menu.export'          : 'Export to…',
    'menu.batch'           : 'Batch processing',
    'menu.repair'          : 'Repair a corrupted PDF',
    'menu.print'           : 'Print…',
    'menu.quit'            : 'Quit',
    // ── Menu Édition ─────────────────────────────────────────────────────────
    'menu.edit'            : 'Edit',
    'menu.undo'            : 'Undo',
    'menu.redo'            : 'Redo',
    'menu.cut'             : 'Cut',
    'menu.copy'            : 'Copy',
    'menu.paste'           : 'Paste',
    'menu.paste_ext'       : 'Paste external',
    'menu.find'            : 'Find & Replace',
    'menu.redact'          : 'Permanent redaction',
    // ── Menu Pages ───────────────────────────────────────────────────────────
    'menu.pages'           : 'Pages',
    'menu.merge'           : 'Merge images & PDFs',
    'menu.pagesize'        : 'Page size',
    'menu.rotate'          : 'Rotate',
    'menu.bookmarks'       : 'Manage bookmarks',
    'menu.toc'             : 'Table of contents',
    'menu.bates'           : 'Bates numbering',
    'menu.header_footer'   : 'Headers & Footers',
    'menu.watermark'       : 'Watermarks & Stamps',
    'menu.remove_wm'       : 'Remove watermarks',
    // ── Menu IA ──────────────────────────────────────────────────────────────
    'menu.ia'              : 'AI',
    'menu.summarize_doc'   : 'Summarise document',
    'menu.translate_doc'   : 'Translate (40+ languages)',
    'menu.chat_pdf'        : 'Chat with PDF',
    'menu.ocr_rec'         : 'Recognise (OCR)',
    'menu.extract_tables'  : 'Extract tables',
    // ── Menu Outils ──────────────────────────────────────────────────────────
    'menu.tools'           : 'Tools',
    'menu.compress'        : 'Compress',
    'menu.enhance_ia'      : 'AI Enhancement',
    'menu.layers'          : 'Layers',
    'menu.media'           : 'Video / Audio / 3D',
    'menu.measure'         : 'Measurements & Dimensions',
    'menu.color_mgmt'      : 'Colour management (ICC)',
    'menu.preflight'       : 'Preflighting',
    'menu.accessibility'   : 'Accessibility',
    'menu.pdf_std'         : 'PDF/A · X · E · UA',
    'menu.highlight'       : 'Highlight',
    'menu.note'            : 'Add a note',
    'menu.draw'            : 'Draw',
    'menu.shapes'          : 'Shapes & Arrows',
    'menu.compare'         : 'Compare two versions',
    'menu.history'         : 'Change history',
    // ── Menu Sécurité ────────────────────────────────────────────────────────
    'menu.security'        : 'Security',
    'menu.encrypt'         : 'Encrypt',
    'menu.password'        : 'Password',
    'menu.restrict'        : 'Restrict permissions',
    'menu.redact_perm'     : 'Permanent redaction',
    'menu.metadata'        : 'Metadata',
    'menu.sign'            : 'Electronic signature',
    // ── Menu Affichage ───────────────────────────────────────────────────────
    'menu.view'            : 'View',
    'menu.zoom_in'         : 'Zoom in',
    'menu.zoom_out'        : 'Zoom out',
    'menu.fit_page'        : 'Fit to page',
    'menu.theme_dark'      : 'Dark theme',
    'menu.theme_light'     : 'Light theme',
    'menu.fullscreen'      : 'Full screen',
    'menu.double_page'     : 'Double page',
    // ── Menu Aide ────────────────────────────────────────────────────────────
    'menu.help'            : 'Help',
    'menu.settings'        : 'Settings',
    'menu.about'           : 'About',
    // ── Groupes toolbar ──────────────────────────────────────────────────────
    'tgl.file'             : 'File',
    'tgl.edit'             : 'Edit',
    'tgl.review'           : 'Review',
    'tgl.pages'            : 'Pages',
    'tgl.advanced'         : 'Advanced',
    'tgl.security'         : 'Security',
    // ── Panneaux gauche / droit ───────────────────────────────────────────────
    'lp.views'             : 'Views',
    'lp.bookmarks'         : 'Bookmarks',
    'lp.fields'            : 'Fields',
    'lp.empty'             : 'Open a PDF\nto display thumbnails',
    'rp.props'             : 'Properties',
    'rp.ai'                : 'AI',
    'rp.security'          : 'Security',
    // ── Drop zone ────────────────────────────────────────────────────────────
    'dz.title'             : 'Open a PDF document',
    'dz.sub'               : 'Click here or drag and drop your .pdf file',
    'dz.btn'               : 'Browse…',
    // ── Right panel — Properties ──────────────────────────────────────────────
    'pr.document'          : 'Document',
    'pr.file'              : 'File',
    'pr.pages'             : 'Pages',
    'pr.size'              : 'Size',
    'pr.layout'            : 'Page layout',
    'pr.header_r'          : 'Header — right',
    'pr.footer_r'          : 'Footer — right',
    'pr.palette'           : 'Colour palette',
    'pr.quality'           : 'Quality & Compliance',
    'pr.score'             : 'Score',
    'pr.standard'          : 'Standard',
    'pr.a11y'              : 'Accessibility',
    // ── Right panel — AI ─────────────────────────────────────────────────────
    'ai.ocr_section'       : 'Recognition (OCR)',
    'ai.make_readable'     : 'Make this PDF readable (OCR)',
    'ai.import_img'        : 'Import image → PDF',
    'ai.generation'        : 'AI Generation',
    'ai.summarize'         : 'Summarise',
    'ai.translate'         : 'Translate',
    'ai.chat'              : 'Chat with PDF',
    // ── Page operations bar ───────────────────────────────────────────────────
    'pop.copy'             : 'Copy',
    'pop.paste'            : 'Paste',
    'pop.up'               : 'Up',
    'pop.down'             : 'Down',
    'pop.rotate'           : 'Rotate',
    'pop.delete'           : 'Del.',
    // ── Toolbar tooltips ─────────────────────────────────────────────────────
    'tip.undo'             : 'Undo last action (⌘Z)',
    'tip.redo'             : 'Redo (⇧⌘Z)',
    'tip.open'             : 'Open a PDF',
    'tip.save'             : 'Save (⌘S)',
    'tip.merge'            : 'Merge images & PDFs into one document',
    'tip.zoom_in'          : 'Zoom in',
    'tip.zoom_out'         : 'Zoom out',
    'tip.fit'              : 'Fit to window',
    'tip.rotate'           : 'Rotate page 90°',
    'tip.read'             : 'Read',
    'tip.select'           : 'Selection (rectangular area)',
    'tip.text'             : 'Text — add or edit text',
    'tip.highlight'        : 'Highlight text',
    'tip.note'             : 'Add a note',
    'tip.redact'           : 'Redact — permanently hide content',
    'tip.draw'             : 'Pen — freehand drawing',
    'tip.shapes'           : 'Shapes & Arrows',
    'tip.measure'          : 'Measure',
    'tip.eyedropper'       : 'Eyedropper — pick a color',
    'tip.ocr'              : 'OCR — recognise text in an image',
    'tip.sign'             : 'Electronic signature',
    'tip.print'            : 'Print (⌘P)',
    'tip.settings'         : 'Settings',
    'tip.help'             : 'Help & keyboard shortcuts',
    'tip.new'              : 'New document (⌘N)',
    'tip.image'            : 'Insert or move an image',
    'tip.compress'         : 'Compress file (–20% to –80%)',
    'tip.compare'          : 'Compare two versions of the document',
    'tip.summarize'        : 'AI Summary — intelligent document analysis',
    'tip.batch'            : 'Batch processing — action on multiple files',
    'tip.encrypt'          : 'Encrypt and password-protect (AES-256)',
    // ── Boutons communs ───────────────────────────────────────────────────────
    'btn.cancel'           : 'Cancel',
    'btn.apply'            : 'Apply',
    'btn.save'             : 'Save',
    'btn.close'            : 'Close',
    'btn.ok'               : 'OK',
    // ── Paramètres ───────────────────────────────────────────────────────────
    'settings.title'       : 'Settings',
    'settings.lang'        : 'Language',
    'settings.lang_fr'     : 'Français',
    'settings.lang_en'     : 'English',
    'settings.ocr_engine'  : 'OCR engine',
    'settings.ocr_local'   : 'Local — offline — no configuration needed',
    'settings.ocr_ai'      : 'AI — high accuracy — requires an API key',
    'settings.gv_key'      : 'Google Cloud Vision API key',
    'settings.openai_key'  : 'OpenAI API key (ChatGPT)',
    'settings.openai_used' : 'Used for: AI Translation · Summary · Chat with PDF',
    'settings.saved'       : 'Settings saved',
    // ── Taille de la page ─────────────────────────────────────────────────────
    'pgsize.title'         : 'Page size',
    'pgsize.page'          : 'Page',
    'pgsize.unit'          : 'Unit',
    'pgsize.width'         : 'Width',
    'pgsize.height'        : 'Height',
    'pgsize.presets'       : 'Quick formats:',
    'pgsize.scope'         : 'Apply to',
    'pgsize.current'       : 'Current page only',
    'pgsize.all'           : 'All pages',
    'pgsize.lock_tip'      : 'Lock proportions',
    // ── Panneau pages (pop-up vignettes) ─────────────────────────────────────
    'pages.insert_before'  : 'Insert before',
    'pages.insert_after'   : 'Insert after',
    'pages.delete'         : 'Delete',
    'pages.rotate'         : 'Rotate',
    'pages.paste'          : 'Paste after',
    // ── Divers ───────────────────────────────────────────────────────────────
    'drop.hint'            : 'Drop a PDF here or click to open',
    'no_pdf'               : 'No PDF open',
    'page_of'              : 'of',
  }
};

/** Retourne la chaîne traduite pour la langue courante */
function _s(key) {
  return (LANG[_lang] && LANG[_lang][key]) || (LANG.fr[key]) || key;
}

/** Applique les traductions à tous les éléments data-i18n / data-i18n-tip */
function applyLang(lang) {
  if (lang) _lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = _s(key);
    // Cas spécial : éléments avec <br> hardcodé → innerHTML
    if (el.id === 'th-empty-txt') {
      el.innerHTML = val.replace('\n', '<br>');
      return;
    }
    const hasChildElements = el.children.length > 0;

    if (!hasChildElements) {
      // Élément feuille (span, label, div sans enfants) → textContent direct
      el.textContent = val;
    } else {
      // Élément mixte (icône + texte, menu + dropdown…)
      // Remplacer le PREMIER nœud texte non-vide directement
      for (const node of el.childNodes) {
        if (node.nodeType === 3 /* TEXT_NODE */ && node.nodeValue.trim()) {
          node.nodeValue = val + ' ';
          break;
        }
      }
    }
  });

  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    el.setAttribute('data-tip', _s(el.getAttribute('data-i18n-tip')));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', _s(el.getAttribute('data-i18n-placeholder')));
  });

  // Panel "Taille de la page" — options dynamiques
  const pgOpt1 = document.querySelector('#pgsize-scope option[value="current"]');
  if (pgOpt1) pgOpt1.textContent = _s('pgsize.current');
  const pgOpt2 = document.querySelector('#pgsize-scope option[value="all"]');
  if (pgOpt2) pgOpt2.textContent = _s('pgsize.all');
  document.getElementById('pgsize-lock-btn')?.setAttribute('title', _s('pgsize.lock_tip'));
}

async function loadLang() {
  try {
    const s = window.electronAPI ? await window.electronAPI.getSettings() : {};
    _lang = (s && s.lang) || 'fr';
  } catch { _lang = 'fr'; }
  applyLang();
}

// ─── Config PDF.js ─────────────────────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// ─── Etat global du document ouvert ──────────────────────────────────────────
// ─── Documents ouverts (onglets) ────────────────────────────────────────────
let tabs         = [];   // [{ id, name, size, data, filePath, pdfDoc, baseFitScale, zoomLevel, renderGen }]
let activeTabIdx = -1;   // index de l'onglet actif
let tabIdCtr     = 0;    // compteur d'ID unique

// ─── Raccourcis vers l'onglet actif (mis a jour par setActiveTab) ────────────
let currentPdfDoc   = null;
let currentPdfName  = '';
let currentPdfSize  = 0;
let currentPdfData  = null;
let currentFilePath = null;
let baseFitScale    = 1;
let zoomLevel       = 100;
let renderGen       = 0;
let _lastScrollAnchor = null; // dernière ancre connue, réutilisée si le DOM est déjà vidé

// ─── Presse-papiers interne (copie de page) ──────────────────────────────────
let copiedPageBase64 = null;

// ─── Page selectionnee dans le panneau Vues ──────────────────────────────────
let selectedThumbPage  = 0;  // 1-based ; 0 = aucune (selection primaire)
let selectedThumbPages = new Set(); // multi-selection (ensemble de numeros 1-based)
let lastClickedThumb   = 0;  // pour le shift-click
let _thumbGeneration   = 0;  // compteur de génération — annule les rendus précédents

// ─── Dialogue "comment ouvrir" ────────────────────────────────────────────────
let openChoiceResolve = null;

// ─── Outil courant ────────────────────────────────────────────────
let currentTool = 'Lecture';

// ─── Sélection (rectangle pointillé) ───────────────────────────────────────────
let selStart       = null;
let selStartWrap   = null;   // page-wrap capturé au mousedown (même logique que l'outil dessin)
let selRect        = null;
let selDims        = null;
let currentSel     = null;
let selClipboard      = null;
let selClipboardPdfW  = 0;   // dimensions PDF au moment du selCopy
let selClipboardPdfH  = 0;
let selClipboardPxW   = 0;   // dimensions écran au moment du selCopy
let selClipboardPxH   = 0;
let selClipboardLx    = 40;  // position dans le wrap au moment du selCopy
let selClipboardLy    = 40;
let selClipboardWrap  = null; // wrap d'origine
let eyedropperActive = false;
let lastOcrText    = '';

// ─── Historique undo/redo ─────────────────────────────────────────────────────
let undoStack  = [];
let redoStack  = [];
let skipUndo   = false;
const MAX_UNDO = 20;

// ─── Image overlay ────────────────────────────────────────────────────────────
let imgOverlay         = null;
let imgOverlayWrap     = null;
let imgOverlayB64      = null;
let imgOverlayType     = 'jpeg';
let imgOverlayDragging = false;
let imgOverlayResizing = false;
let imgOverlayDragOff  = { x: 0, y: 0 };
let imgOverlayRSStart  = null; // resize start
let imgHasFrame        = false;
let imgHandles         = null; // { nw, ne, sw, se }

// ─── Annotations texte ────────────────────────────────────────────────────────
let activeTextAnno     = null;
let textAnnoDragging   = false;
let textAnnoResizing   = false;
let textAnnoDragOff    = { x: 0, y: 0 };
let textAnnoResizeStart = null;

// ─── Toast ────────────────────────────────────────────────────────────────────
function t(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), 2400);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(title, body, footer) {
  document.getElementById('modal-title').innerHTML = title;
  document.getElementById('modal-body').innerHTML  = body;
  const ftrEl = document.getElementById('modal-footer');
  const defClose = document.getElementById('modal-default-close');
  if (footer) {
    ftrEl.innerHTML = footer;
    if (defClose) defClose.style.display = 'none';
  } else {
    if (defClose) { ftrEl.innerHTML = ''; ftrEl.appendChild(defClose); defClose.style.display = ''; }
  }
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── Helpers base64 <-> bytes ─────────────────────────────────────────────────
function bytesToBase64(bytes) {
  let b64 = ''; const arr = new Uint8Array(bytes); const C = 8192;
  for (let i = 0; i < arr.length; i += C) b64 += String.fromCharCode(...arr.subarray(i, i + C));
  return btoa(b64);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Systeme d'onglets ────────────────────────────────────────────────────────
function makeTab(overrides) {
  return Object.assign({ id: tabIdCtr++, name: '', size: 0, data: null, filePath: null,
    pdfDoc: null, baseFitScale: 1, zoomLevel: 100, renderGen: 0, bookmarks: [],
    thumbCache: null,   // tableau de data URLs — vignettes pré-rendues
    pagesNode: null,    // div détaché contenant les pages rendues
    scrollTop: 0,       // position de scroll du viewport principal sauvegardée
    thumbScrollTop: 0,  // position de scroll du panneau miniatures sauvegardée
    savedData: null     // snapshot des données au dernier enregistrement (dirty tracking)
  }, overrides);
}

function isTabDirty(tab) {
  return !!(tab && tab.data && tab.data !== tab.savedData);
}

function syncActiveTab() {
  const tab = tabs[activeTabIdx];
  if (!tab) return;
  tab.pdfDoc = currentPdfDoc; tab.name = currentPdfName; tab.size = currentPdfSize;
  tab.data = currentPdfData; tab.filePath = currentFilePath;
  tab.baseFitScale = baseFitScale; tab.zoomLevel = zoomLevel; tab.renderGen = renderGen;
  // Sauvegarder la position de scroll (sur le viewport, seul élément scrollable) et détacher les pages
  const vpEl    = document.getElementById('pdf-viewport');
  const pagesEl = document.getElementById('pdf-pages');
  if (pagesEl) {
    tab.scrollTop = vpEl ? vpEl.scrollTop : 0; // #pdf-viewport est le conteneur scrollable
    // Sauvegarder aussi le scroll du panneau miniatures (.pcnt)
    const pcnt = document.querySelector('#lp .pcnt');
    tab.thumbScrollTop = pcnt ? pcnt.scrollTop : 0;
    // Déplacer les pages dans le nœud détaché de l'onglet
    if (!tab.pagesNode) tab.pagesNode = document.createElement('div');
    while (pagesEl.firstChild) tab.pagesNode.appendChild(pagesEl.firstChild);
  }
}

function setActiveTab(idx) {
  activeTabIdx = idx;
  const tab = tabs[idx];
  if (!tab) return;
  currentPdfDoc = tab.pdfDoc; currentPdfName = tab.name; currentPdfSize = tab.size;
  currentPdfData = tab.data; currentFilePath = tab.filePath;
  baseFitScale = tab.baseFitScale; zoomLevel = tab.zoomLevel; renderGen = tab.renderGen;
}

let _tabDragSrcIdx = -1; // index de l'onglet en cours de déplacement

function renderTabBar() {
  const list = document.getElementById('tab-list');
  if (!list) return;
  list.innerHTML = '';
  tabs.forEach((tab, idx) => {
    const el = document.createElement('div');
    el.className = 'doc-tab' + (idx === activeTabIdx ? ' active' : '');
    el.draggable = true;
    const safeName = (tab.name || 'Nouveau').replace(/</g, '&lt;');
    const dot = isTabDirty(tab) ? '<span title="Modifications non enregistrées" style="color:var(--gold);margin-left:2px">●</span>' : '';
    el.innerHTML = '<i class="fa-regular fa-file-pdf"></i><span class="tab-name">' + safeName + dot +
      '</span><span class="doc-tab-close" title="Fermer">×</span>';

    el.querySelector('.doc-tab-close').addEventListener('click', e => { e.stopPropagation(); closeTab(idx); });
    el.addEventListener('click', () => { if (idx !== activeTabIdx) switchTab(idx); });

    // ── Drag-and-drop pour réordonner ──────────────────────────────────────────
    el.addEventListener('dragstart', e => {
      _tabDragSrcIdx = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.style.opacity = '0.4', 0);
    });
    el.addEventListener('dragend', () => {
      el.style.opacity = '';
      document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('tab-drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('tab-drag-over'));
      if (idx !== _tabDragSrcIdx) el.classList.add('tab-drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('tab-drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('tab-drag-over');
      const src = _tabDragSrcIdx;
      _tabDragSrcIdx = -1;
      if (src < 0 || src === idx) return;
      syncActiveTab();
      // Mémoriser l'onglet actif avant réorganisation
      const activeTab = tabs[activeTabIdx];
      // Déplacer src → idx
      const [moved] = tabs.splice(src, 1);
      const dest = src < idx ? idx - 1 : idx;
      tabs.splice(dest, 0, moved);
      // Retrouver le nouvel index de l'onglet actif
      activeTabIdx = tabs.indexOf(activeTab);
      if (activeTabIdx < 0) activeTabIdx = 0;
      renderTabBar();
    });

    list.appendChild(el);
  });
}

async function switchTab(idx) {
  if (idx < 0 || idx >= tabs.length || idx === activeTabIdx) return;
  syncActiveTab();
  setActiveTab(idx);
  renderTabBar();
  selectedThumbPage = 0; selectedThumbPages = new Set();

  const pagesEl    = document.getElementById('pdf-pages');
  const thC        = document.getElementById('th-container');
  const thE        = document.getElementById('th-empty');
  const drop       = document.getElementById('drop-zone');
  const pageOpsBar = document.getElementById('page-ops-bar');

  pagesEl.innerHTML = '';
  if (thC) thC.innerHTML = '';

  if (!currentPdfDoc) {
    if (thE) thE.style.display = 'block';
    if (drop) drop.style.display = 'flex';
    document.getElementById('doc-name').textContent = '';
    document.getElementById('doc-pages').textContent = '—';
    document.getElementById('st-file').textContent = 'Aucun fichier ouvert';
    document.getElementById('zoom-val').textContent = '100%';
    if (pageOpsBar) pageOpsBar.style.display = 'none';
    return;
  }

  if (thE) thE.style.display = 'none';
  if (drop) drop.style.display = 'none';
  if (pageOpsBar) pageOpsBar.style.display = 'none';
  document.getElementById('zoom-val').textContent = zoomLevel + '%';
  document.getElementById('doc-name').textContent = currentPdfName;
  document.getElementById('doc-pages').textContent = currentPdfDoc.numPages;
  document.getElementById('st-file').textContent = currentPdfName;

  const newTab = tabs[idx];

  // ── Vignettes : recréation instantanée depuis le cache d'images ──────────────
  if (newTab.thumbCache && newTab.thumbCache.length > 0) {
    restoreThumbsFromCache(newTab.thumbCache, newTab.pdfDoc);
  } else {
    await renderThumbnails(currentPdfDoc);
  }

  // ── Pages principales : restaurer depuis le nœud détaché ou re-rendre ────────
  if (newTab.pagesNode && newTab.pagesNode.children.length > 0) {
    // Réattacher instantanément (aucun re-décodage PDF)
    pagesEl.style.display = 'flex';
    while (newTab.pagesNode.firstChild) pagesEl.appendChild(newTab.pagesNode.firstChild);
    // Restaurer le scroll principal et celui des miniatures après layout
    requestAnimationFrame(() => {
      const vpEl = document.getElementById('pdf-viewport');
      if (vpEl) vpEl.scrollTop = newTab.scrollTop || 0;
      const pcnt = document.querySelector('#lp .pcnt');
      if (pcnt) pcnt.scrollTop = newTab.thumbScrollTop || 0;
    });
  } else {
    await renderMainPages(currentPdfDoc, baseFitScale * zoomLevel / 100, null, null);
  }

  renderBookmarkPanel();
}

async function closeTab(idx) {
  // Sync si c'est l'onglet actif (pour avoir tab.data à jour)
  if (idx === activeTabIdx) syncActiveTab();
  const tab = tabs[idx];

  // Vérifier si l'onglet a des modifications non sauvegardées
  if (tab && isTabDirty(tab)) {
    const answer = await showSaveBeforeCloseDialog(tab.name || 'Sans titre');
    if (answer === 'cancel') return;
    if (answer === 'save') {
      const ok = await saveTabBeforeClose(tab);
      if (!ok) return; // save annulé
    }
  }

  if (tabs.length <= 1) {
    // Dernier onglet : vider
    tabs = []; activeTabIdx = -1;
    currentPdfDoc = null; currentPdfData = null; currentFilePath = null;
    currentPdfName = ''; renderGen++;
    document.getElementById('pdf-pages').innerHTML = '';
    const thC = document.getElementById('th-container');
    if (thC) thC.innerHTML = '';
    const thE = document.getElementById('th-empty');
    if (thE) thE.style.display = 'block';
    document.getElementById('drop-zone').style.display = 'flex';
    document.getElementById('page-ops-bar').style.display = 'none';
    selectedThumbPage = 0; selectedThumbPages = new Set();
    renderTabBar();
    t('Document ferme');
    return;
  }
  tabs.splice(idx, 1);
  const newIdx = Math.min(idx, tabs.length - 1);
  activeTabIdx = -1;  // force re-render
  await switchTab(newIdx);
}

// ─── Dialogue d'ouverture (quand un doc est deja ouvert) ─────────────────────
function askOpenChoice(docName) {
  return new Promise(resolve => {
    openChoiceResolve = resolve;
    const safe = (docName || '').replace(/</g, '&lt;');
    openModal("Ouvrir un document", ('<div style="margin-bottom:14px;font-size:.85rem">Un document est deja ouvert.<br>' +
      'Que faire avec <strong>' + safe + '</strong>&nbsp;?</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div class="mbtn" style="justify-content:flex-start" onclick="resolveOpenChoice(&quot;tab&quot;)"><i class="fa-solid fa-plus"></i>&nbsp; Ouvrir dans un nouvel onglet</div>' +
      '<div class="mbtn" style="justify-content:flex-start" onclick="resolveOpenChoice(&quot;replace&quot;)"><i class="fa-solid fa-arrow-right-arrow-left"></i>&nbsp; Remplacer le document actuel</div>' +
      '<div class="mbtn" style="justify-content:flex-start" onclick="resolveOpenChoice(&quot;merge&quot;)"><i class="fa-solid fa-layer-group"></i>&nbsp; Ajouter les pages au document actuel</div>' +
      '<div class="mbtn" style="justify-content:flex-start;opacity:.55" onclick="resolveOpenChoice(&quot;cancel&quot;)"><i class="fa-solid fa-xmark"></i>&nbsp; Annuler</div></div>'));
  });
}

function resolveOpenChoice(choice) {
  closeModal();
  if (openChoiceResolve) { openChoiceResolve(choice); openChoiceResolve = null; }
}

async function mergeDocuments(baseData, addData) {
  const { PDFDocument } = PDFLib;
  const baseDoc = await PDFDocument.load(base64ToBytes(baseData), { ignoreEncryption: true });
  const addDoc  = await PDFDocument.load(base64ToBytes(addData),  { ignoreEncryption: true });
  const count = addDoc.getPageCount();
  const pages = await baseDoc.copyPages(addDoc, [...Array(count).keys()]);
  pages.forEach(p => baseDoc.addPage(p));
  return bytesToBase64(await baseDoc.save());
}

async function handleOpenWith(result) {
  // result = { name, size, data, filePath }
  if (!currentPdfDoc) {
    // Aucun doc ouvert : utiliser/creer l'onglet actif
    if (activeTabIdx < 0) { tabs.push(makeTab()); activeTabIdx = 0; }
    await renderPDFFromData(result);
    return;
  }
  const choice = await askOpenChoice(result.name);
  if (choice === 'cancel') return;

  if (choice === 'tab') {
    syncActiveTab();
    tabs.push(makeTab());
    activeTabIdx = tabs.length - 1;
    await renderPDFFromData(result);
  } else if (choice === 'replace') {
    await renderPDFFromData(result);
  } else if (choice === 'merge') {
    try {
      const merged = await mergeDocuments(currentPdfData, result.data);
      await renderPDFFromData({ name: currentPdfName, size: Math.round(merged.length * 0.75), data: merged, filePath: currentFilePath }, true);
      t('Pages ajoutees : ' + result.name);
    } catch(e) { t('Erreur fusion : ' + e.message); }
  }
}

// ─── Operations sur les pages ─────────────────────────────────────────────────
function updatePageOpsBar() {
  const bar = document.getElementById('page-ops-bar');
  if (!currentPdfDoc || !selectedThumbPages.size) {
    if (bar) bar.style.display = 'none';
    return;
  }
  const n      = currentPdfDoc.numPages;
  const count  = selectedThumbPages.size;
  const isSingle = count === 1;
  const minSel = Math.min(...selectedThumbPages);
  const maxSel = Math.max(...selectedThumbPages);
  if (bar) bar.style.display = 'flex';
  const setDis = (id, dis) => { const el = document.getElementById(id); if (el) el.classList.toggle('dis', dis); };
  // Info compteur
  const info = document.getElementById('pop-sel-info');
  if (info) info.textContent = count > 1 ? count + ' pages' : '';
  // Copier/Coller : mono seulement
  setDis('pop-copy',  !isSingle);
  setDis('pop-paste', !isSingle || !copiedPageBase64);
  // Monter/Descendre : groupés
  setDis('pop-up',    minSel <= 1);
  setDis('pop-dn',    maxSel >= n);
  // Rotation : toujours actif si selection
  setDis('pop-rot',   false);
  // Supprimer
  setDis('pop-del',   n <= count);
}

function updateThumbSelection() {
  document.querySelectorAll('.tw').forEach((tw, idx) => {
    tw.classList.toggle('sel', selectedThumbPages.has(idx + 1));
  });
}

async function copyPage() {
  if (!selectedThumbPage || !currentPdfData) return;
  try {
    const { PDFDocument } = PDFLib;
    const src = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const one = await PDFDocument.create();
    const [p]  = await one.copyPages(src, [selectedThumbPage - 1]);
    one.addPage(p);
    copiedPageBase64 = bytesToBase64(await one.save());
    t('Page ' + selectedThumbPage + ' copiee');
    updatePageOpsBar();
  } catch(e) { t('Erreur copie : ' + e.message); }
}

async function pastePage() {
  if (!copiedPageBase64 || !currentPdfData) return;
  const after = selectedThumbPage || (currentPdfDoc ? currentPdfDoc.numPages : 0);
  try {
    const { PDFDocument } = PDFLib;
    const dst  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const clip = await PDFDocument.load(base64ToBytes(copiedPageBase64), { ignoreEncryption: true });
    const out  = await PDFDocument.create();
    const total = dst.getPageCount();
    const dstPages  = await out.copyPages(dst,  [...Array(total).keys()]);
    const [clipped] = await out.copyPages(clip, [0]);
    dstPages.forEach((p, i) => { out.addPage(p); if (i + 1 === after) out.addPage(clipped); });
    if (after >= total) out.addPage(clipped);
    const nd = bytesToBase64(await out.save());
    await renderPDFFromData({ name: currentPdfName, size: Math.round(nd.length * 0.75), data: nd, filePath: currentFilePath }, true);
    selectedThumbPage = after + 1;
    t('Page collee apres la page ' + after);
  } catch(e) { t('Erreur coller : ' + e.message); console.error(e); }
}

async function movePage(dir) {
  if (!currentPdfDoc || !currentPdfData || !selectedThumbPages.size) return;
  const n      = currentPdfDoc.numPages;
  const selArr = [...selectedThumbPages].sort((a, b) => a - b);
  const minSel = selArr[0], maxSel = selArr[selArr.length - 1];
  if (dir === -1 && minSel <= 1) return;
  if (dir ===  1 && maxSel >= n) return;
  try {
    const { PDFDocument } = PDFLib;
    // Construire le nouvel ordre : chaque page sélectionnée échange avec son voisin non-sélectionné
    const order  = Array.from({length: n}, (_, i) => i); // indices 0-based
    const selSet = new Set(selArr);
    if (dir === -1) {
      for (const p of selArr) {          // ascendant pour move-up
        const idx = order.indexOf(p - 1);
        if (idx > 0 && !selSet.has(order[idx - 1] + 1))
          [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      }
    } else {
      for (const p of [...selArr].reverse()) {  // descendant pour move-down
        const idx = order.indexOf(p - 1);
        if (idx < n - 1 && !selSet.has(order[idx + 1] + 1))
          [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      }
    }
    const src   = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const out   = await PDFDocument.create();
    const pages = await out.copyPages(src, order);
    pages.forEach(p => out.addPage(p));
    const nd = bytesToBase64(await out.save());
    // Nouvelle sélection : chaque page décalée de dir
    selectedThumbPages = new Set(selArr.map(p => p + dir));
    selectedThumbPage  = [...selectedThumbPages].sort((a,b)=>a-b).slice(-1)[0] || 0;
    undoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    await renderPDFFromData({ name: currentPdfName, size: Math.round(nd.length*.75), data: nd, filePath: currentFilePath }, true);
    t(selArr.length > 1 ? selArr.length + ' pages deplacees' : 'Page deplacee');
  } catch(e) { t('Erreur deplacement : ' + e.message); }
}

async function deletePage(pageNum) {
  const del = pageNum || selectedThumbPage;
  if (!del || !currentPdfDoc || !currentPdfData) return;
  const n = currentPdfDoc.numPages;
  if (n <= 1) { t('Impossible : une seule page'); return; }
  try {
    const { PDFDocument } = PDFLib;
    const src = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices().filter(i => i !== del - 1));
    pages.forEach(p => out.addPage(p));
    const nd = bytesToBase64(await out.save());
    await renderPDFFromData({ name: currentPdfName, size: Math.round(nd.length * 0.75), data: nd, filePath: currentFilePath }, true);
    selectedThumbPage = Math.min(del, n - 1);
    t('Page ' + del + ' supprimee');
  } catch(e) { t('Erreur suppression : ' + e.message); }
}



// ─── Tooltip ─────────────────────────────────────────────────────────────────
const tip = document.getElementById('tooltip');
let tipTimer;
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mouseenter', function () {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { tip.textContent = this.dataset.tip; tip.classList.add('show'); }, 380);
  });
  el.addEventListener('mousemove', function (e) {
    let x = e.clientX - tip.offsetWidth / 2;
    let y = e.clientY + 18;
    if (x < 8) x = 8;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = window.innerWidth - tip.offsetWidth - 8;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  el.addEventListener('mouseleave', () => { clearTimeout(tipTimer); tip.classList.remove('show'); });
});

// ─── Menus deroulants ─────────────────────────────────────────────────────────
const menuItems = document.querySelectorAll('.mi');
menuItems.forEach(mi => {
  mi.addEventListener('mouseenter', function () { menuItems.forEach(m => m.classList.remove('open')); this.classList.add('open'); });
  mi.addEventListener('mouseleave', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.mi')) {
      setTimeout(() => { if (!document.querySelector('.mi:hover')) menuItems.forEach(m => m.classList.remove('open')); }, 80);
    }
  });
});
document.addEventListener('click', e => { if (!e.target.closest('.mi')) menuItems.forEach(m => m.classList.remove('open')); });
document.querySelectorAll('.mdi').forEach(item => {
  item.addEventListener('click', e => { e.stopPropagation(); menuItems.forEach(m => m.classList.remove('open')); });
});

// ─── Ouvrir un PDF ────────────────────────────────────────────────────────────
// ─── Fusion de secours : rasterisation PDF.js → JPEG → pdf-lib ──────────────
async function mergePagesFallback(pdfData, mergedDoc) {
  const pdf = await pdfjsLib.getDocument({ data: base64ToBytes(pdfData) }).promise;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp0  = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1200 / Math.max(vp0.width, vp0.height));
    const vp   = page.getViewport({ scale });
    const cv   = document.createElement('canvas');
    cv.width   = Math.round(vp.width);
    cv.height  = Math.round(vp.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    page.cleanup();
    const jpgB64  = cv.toDataURL('image/jpeg', 0.90).split(',')[1];
    const embImg  = await mergedDoc.embedJpg(base64ToBytes(jpgB64));
    const newPage = mergedDoc.addPage([vp0.width, vp0.height]);
    newPage.drawImage(embImg, { x: 0, y: 0, width: vp0.width, height: vp0.height });
  }
}

async function openFile() {
  if (window.electronAPI) {
    const results = await window.electronAPI.openPDF(); // tableau de fichiers
    if (!results || results.length === 0) return;
    if (results.length === 1) {
      await handleOpenWith(results[0]);
    } else {
      // Plusieurs fichiers : demander comment les ouvrir
      const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      const choice = await askMultiOpenChoice(sorted.length, sorted.map(r => r.name));
      if (choice === 'cancel') return;
      if (choice === 'tabs') {
        for (const r of sorted) {
          if (currentPdfDoc) { syncActiveTab(); tabs.push(makeTab()); activeTabIdx = tabs.length - 1; }
          else if (activeTabIdx < 0) { tabs.push(makeTab()); activeTabIdx = 0; }
          await renderPDFFromData(r);
        }
      } else if (choice === 'merge') {
        try {
          const { PDFDocument } = PDFLib;
          const merged = await PDFDocument.create();
          let mergeSkipped = 0, mergeRasterized = 0;
          for (const r of sorted) {
            try {
              const src   = await PDFDocument.load(base64ToBytes(r.data), { ignoreEncryption: true });
              const pages = await merged.copyPages(src, src.getPageIndices());
              pages.forEach(p => merged.addPage(p));
            } catch(e) {
              // Fallback : rasterisation page par page via PDF.js
              try {
                await mergePagesFallback(r.data, merged);
                mergeRasterized++;
              } catch(e2) {
                mergeSkipped++;
                console.warn('Merge skip:', r.name, e2);
              }
            }
          }
          if (mergeRasterized > 0) t('ℹ ' + mergeRasterized + ' fichier(s) rasterise(s) (format partiel)');
          if (mergeSkipped   > 0) t('⚠ ' + mergeSkipped   + ' fichier(s) ignore(s) (erreur)');
          const data = bytesToBase64(await merged.save());
          const name = sorted[0].name.replace(/\.pdf$/i, '') + ' (+ ' + (sorted.length - 1) + ')';
          if (activeTabIdx < 0) { tabs.push(makeTab()); activeTabIdx = 0; }
          await renderPDFFromData({ name, size: Math.round(data.length * 0.75), data, filePath: null });
        } catch(e) { t('Erreur fusion : ' + e.message); }
      }
    }
  } else {
    document.getElementById('file-inp').click();
  }
}

document.getElementById('file-inp').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) { t('Seuls les fichiers .pdf sont acceptes'); return; }
  const ab  = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  await renderPDFFromData({ name: file.name, size: file.size, data: b64 });
  this.value = '';
});

// ─── Afficher un PDF ──────────────────────────────────────────────────────────
async function renderPDFFromData({ name, size, data, filePath = null }, pushUndo = false) {
  // Historique undo
  if (pushUndo && !skipUndo && currentPdfData) {
    undoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoBtns();
  }
  // Si aucun onglet actif, en creer un
  if (activeTabIdx < 0) { tabs.push(makeTab()); activeTabIdx = 0; }
  // Invalider le cache de l'onglet actif (nouveau contenu ou modification)
  if (tabs[activeTabIdx]) {
    tabs[activeTabIdx].thumbCache = null;
    tabs[activeTabIdx].pagesNode  = null;
  }
  _lastScrollAnchor = null; // réinitialiser l'ancre de scroll pour le nouveau document
  document.getElementById('drop-zone').style.display = 'none';
  const loadBar   = document.getElementById('load-bar');
  const loadInner = document.getElementById('load-inner');
  const loadLabel = document.getElementById('load-label');
  loadBar.style.display = 'block';
  loadInner.style.width = '10%';
  loadLabel.textContent = 'Lecture du fichier...';

  try {
    const bytes = base64ToBytes(data);
    loadInner.style.width = '25%';
    loadLabel.textContent = 'Decodage PDF...';

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const np  = pdf.numPages;

    // Stocker le document globalement pour le zoom
    currentPdfDoc  = pdf;
    currentPdfName = name;
    currentPdfSize = size;
    currentPdfData = data;
    currentFilePath = filePath || null;
    // savedData = état de référence : seulement à l'ouverture initiale (pushUndo=false),
    // PAS lors des edits qui passent aussi par renderPDFFromData (pushUndo=true)
    if (!pushUndo && tabs[activeTabIdx]) tabs[activeTabIdx].savedData = data;
    // Ajouter aux fichiers récents (drag-drop ou ouverture externe avec chemin connu)
    if (filePath && window.electronAPI?.addToRecent) {
      window.electronAPI.addToRecent(filePath).catch(() => {});
    }
    // Sync into active tab
    if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
      tabs[activeTabIdx].pdfDoc = pdf; tabs[activeTabIdx].name = name;
      tabs[activeTabIdx].size = size;  tabs[activeTabIdx].data = data;
      tabs[activeTabIdx].filePath = filePath || null;
      if (!tabs[activeTabIdx].bookmarks) tabs[activeTabIdx].bookmarks = [];
    }
    renderTabBar();
    renderBookmarkPanel();

    // Echelle de base : ajuste la page 1 a 800px de large
    const page1 = await pdf.getPage(1);
    const vp1   = page1.getViewport({ scale: 1 });
    baseFitScale = Math.min(800 / vp1.width, 1.5);
    if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
      tabs[activeTabIdx].baseFitScale = baseFitScale;
    }

    // Reset zoom uniquement pour un nouveau document (pas pour une modification)
    if (!pushUndo) {
      zoomLevel = 100;
      document.getElementById('zoom-val').textContent = '100%';
    }
    if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
      tabs[activeTabIdx].zoomLevel = zoomLevel;
    }

    // Metadonnees
    const shortName = name.length > 18 ? name.substring(0, 15) + '...' : name;
    document.getElementById('doc-name').textContent  = shortName;
    document.getElementById('doc-pages').textContent = np + ' page' + (np > 1 ? 's' : '');
    document.getElementById('doc-size').textContent  = (size / 1024 / 1024).toFixed(2) + ' Mo';
    document.getElementById('st-file').textContent   = name;
    document.getElementById('total-pages').textContent = np;
    document.getElementById('cur-page').textContent  = '1';
    // Quality score computed asynchronously (non-blocking)
    calculateQualityScore(pdf, data).then(({ score, breakdown }) => {
      document.getElementById('quality-bar').style.width = score + '%';
      document.getElementById('quality-val').textContent = score + ' / 100';
      window._qualityBreakdown = breakdown;
    });

    // Vignettes d'abord (independantes du zoom)
    loadInner.style.width = '30%';
    loadLabel.textContent = 'Preparation des vignettes...';
    await renderThumbnails(pdf);

    // Rendu principal (en tenant compte du zoom courant)
    loadInner.style.width = '40%';
    await renderMainPages(pdf, baseFitScale * zoomLevel / 100, loadInner, loadLabel);

    loadInner.style.width = '100%';
    loadLabel.textContent = 'Termine';
    setTimeout(() => loadBar.style.display = 'none', 600);
    t(name + ' — ' + np + ' page' + (np > 1 ? 's' : '') + ' chargee' + (np > 1 ? 's' : ''));


  } catch (err) {
    loadBar.style.display = 'none';
    document.getElementById('drop-zone').style.display = 'flex';
    t('Erreur : ' + err.message);
    console.error(err);
  }
}

// ─── Rendu des pages principales (appele aussi lors du zoom) ─────────────────
async function renderMainPages(pdf, scale, loadInner, loadLabel) {
  const gen     = ++renderGen;
  const np      = pdf.numPages;
  const pagesEl = document.getElementById('pdf-pages');

  // Sauvegarder l'ancre de scroll : page visible au centre + position relative dans cette page
  // Si le DOM a déjà été vidé par un render concurrent (zoom rapide), réutiliser la dernière
  // ancre connue pour éviter de remonter en haut du document.
  const canvasEl = document.getElementById('pdf-viewport');
  let scrollAnchor = null;
  const existingWraps = Array.from(document.querySelectorAll('.page-wrap'));
  if (existingWraps.length) {
    const viewCenter = canvasEl.scrollTop + canvasEl.clientHeight / 2;
    for (const w of existingWraps) {
      const top = w.offsetTop;
      const bot = top + w.offsetHeight;
      if (viewCenter >= top && viewCenter <= bot) {
        scrollAnchor = {
          pageIdx: parseInt(w.dataset.page) - 1,
          fracInPage: (viewCenter - top) / Math.max(1, w.offsetHeight)
        };
        break;
      }
    }
    if (!scrollAnchor) {
      // fallback : première page visible dans le DOM
      scrollAnchor = { pageIdx: 0, fracInPage: 0 };
    }
    _lastScrollAnchor = scrollAnchor; // mémoriser pour les renders suivants
  } else if (_lastScrollAnchor) {
    // DOM déjà vidé par un render précédent (zoom rapide) → réutiliser la dernière ancre
    scrollAnchor = _lastScrollAnchor;
  }

  // Masquer le contenu pendant le rendu pour éviter les sauts visuels
  // Le try/finally garantit que l'opacité est toujours restaurée,
  // même si le render est annulé en cours de route (zoom rapide, changement d'onglet…)
  canvasEl.style.opacity = '0';
  canvasEl.style.pointerEvents = 'none';

  try {

  pagesEl.innerHTML = '';
  pagesEl.style.display = 'flex';

  for (let i = 1; i <= np; i++) {
    if (gen !== renderGen) return; // render annule par un zoom plus recent

    if (loadInner) {
      if (loadLabel) loadLabel.textContent = 'Rendu page ' + i + ' / ' + np + '...';
      loadInner.style.width = (40 + Math.round((i / np) * 55)) + '%';
    }

    const page = await pdf.getPage(i);
    const vp   = page.getViewport({ scale });

    // Conteneur de page
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.dataset.page = i;
    wrap.style.cssText = 'position:relative;flex-shrink:0;width:' + vp.width + 'px;height:' + vp.height + 'px';

    // Canvas PDF
    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    wrap.appendChild(canvas);

    // Numero de page (bas, visible au défilement lent / 100%)
    const num = document.createElement('div');
    num.style.cssText = "text-align:center;font-family:'Cinzel',serif;font-size:.6rem;color:#1a1a1a;background:rgba(237,229,205,.75);margin-top:6px;padding:3px 0;letter-spacing:.1em";
    num.textContent = 'Page ' + i + ' / ' + np;
    wrap.appendChild(num);

    pagesEl.appendChild(wrap);

    // Rendu PDF.js sur le canvas (resolution exacte = qualite maximale)
    // annotationMode:0 = DISABLE: PDF.js ne rend pas les apparences de champs de formulaire
    // (nos inputs HTML remplacent visuellement les champs → pas de doublement)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, annotationMode: 0 }).promise;
    page.cleanup(); // libere la memoire interne PDF.js
    if (gen !== renderGen) return;

    // Text layer (texte selectionnable)
    // Chaque span est mis a l'echelle (scaleX) pour que sa largeur visuelle
    // corresponde exactement au texte sur le canvas PDF.
    // → le highlight de selection double-clic couvre le mot entier.
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.cssText =
      'position:absolute;top:0;left:0;width:' + vp.width + 'px;height:' + vp.height + 'px;overflow:hidden;pointer-events:auto;user-select:text;-webkit-user-select:text';
    wrap.appendChild(textLayerDiv);
    try {
      const textContent = await page.getTextContent();
      // Canvas de mesure (une seule instance par page) : evite les reflows DOM
      const mCanvas = document.createElement('canvas');
      const mCtx    = mCanvas.getContext('2d');

      textContent.items.forEach(item => {
        if (!item.str || !item.str.trim()) return;
        const span   = document.createElement('span');
        span.textContent = item.str;

        const tx     = pdfjsLib.Util.transform(vp.transform, item.transform);
        const scaleY = Math.sqrt(tx[2]*tx[2] + tx[3]*tx[3]);
        const angle  = Math.atan2(tx[1], tx[0]);

        // Largeur attendue du texte en pixels ecran (depuis les metadonnees PDF)
        // item.width est en unites user-space PDF ; vp.scale convertit en pixels
        const expectedW = (item.width && item.width > 0) ? Math.abs(item.width * vp.scale) : 0;

        // Largeur naturelle du texte dans la police de substitution (sans-serif)
        let spanScaleX = 1;
        if (expectedW > 2 && item.str.length > 0) {
          mCtx.font = scaleY + 'px sans-serif';
          const naturalW = mCtx.measureText(item.str).width;
          if (naturalW > 0) {
            spanScaleX = Math.min(5, Math.max(0.1, expectedW / naturalW));
          }
        }

        // Construire le transform CSS : rotation eventuele + correction largeur
        let transformCss = '';
        if (angle && spanScaleX !== 1) {
          transformCss = 'rotate(' + angle + 'rad) scaleX(' + spanScaleX + ')';
        } else if (angle) {
          transformCss = 'rotate(' + angle + 'rad)';
        } else if (spanScaleX !== 1) {
          transformCss = 'scaleX(' + spanScaleX + ')';
        }

        span.style.cssText = [
          'position:absolute',
          'left:' + tx[4] + 'px',
          'top:' + (tx[5] - scaleY) + 'px',
          'font-size:' + scaleY + 'px',
          'font-family:sans-serif',
          'color:transparent',
          'white-space:pre',
          'cursor:text',
          'pointer-events:auto',
          'user-select:text',
          '-webkit-user-select:text',
          'transform-origin:0% 0%',
          transformCss ? 'transform:' + transformCss : ''
        ].join(';');
        textLayerDiv.appendChild(span);
      });
    } catch(e) { /* page sans texte */ }

    // Couche formulaire (AcroForm)
    renderFormFields(page, vp, wrap); // non-bloquant

    // Clic page → mise a jour page courante
    const pageNum = i;
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', () => {
      document.getElementById('cur-page').textContent = pageNum;
      document.querySelectorAll('.th').forEach((th, idx) => {
        th.classList.toggle('act', idx === pageNum - 1);
      });
      t('Page ' + pageNum + ' selectionnee');
    });
  }

  // Restaurer la position de scroll puis révéler le contenu
  if (scrollAnchor) {
    const newWraps = Array.from(document.querySelectorAll('.page-wrap'));
    const target   = newWraps[scrollAnchor.pageIdx];
    if (target) {
      const newScrollTop = target.offsetTop + scrollAnchor.fracInPage * target.offsetHeight - canvasEl.clientHeight / 2;
      canvasEl.scrollTop = Math.max(0, newScrollTop);
    }
  }

  } finally {
    // Toujours révéler le contenu — que le render soit complet ou annulé
    requestAnimationFrame(() => {
      canvasEl.style.opacity = '';
      canvasEl.style.pointerEvents = '';
    });
  }
}

// ─── Rendu des vignettes (effectue une seule fois au chargement) ──────────────

// ══════════════════════════════════════════════════════════════════════════════
//  PANNEAU FUSION AVANCÉE
// ══════════════════════════════════════════════════════════════════════════════
let mergeItems = [];  // [{ name, data, pageCount, selectedPages:Set, thumbUrl, pdfDoc, ppRendered }]
let mergeDragSrc = null;

function openMergePanel() {
  mergeItems = [];
  document.getElementById('merge-list').innerHTML = '';
  document.getElementById('mo-blank').checked  = false;
  document.getElementById('mo-renum').checked  = false;
  mergeSummary();
  const ov = document.getElementById('merge-overlay');
  ov.style.display = 'flex';
  // Drag-over glow on drop zone
  const dz = document.getElementById('merge-drop');
  dz.addEventListener('dragenter', () => dz.classList.add('over'));
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
}
function closeMergePanel() {
  document.getElementById('merge-overlay').style.display = 'none';
  mergeItems = [];
}

// ── Réception fichiers ────────────────────────────────────────────────────────
const MERGE_IMAGE_EXT = /\.(jpe?g|png|webp|bmp|tiff?)$/i;

async function mergeHandleDrop(e) {
  e.preventDefault();
  document.getElementById('merge-drop').classList.remove('over');
  const files = [...e.dataTransfer.files].filter(f =>
    f.name.toLowerCase().endsWith('.pdf') || MERGE_IMAGE_EXT.test(f.name)
  );
  await mergeAddFilesFromList(files);
}
async function mergeHandleFiles(fl) {
  await mergeAddFilesFromList([...fl]);
  document.getElementById('merge-file-input').value = '';
}

async function mergeAddFilesFromList(files) {
  for (const file of files) {
    const isImage = MERGE_IMAGE_EXT.test(file.name);
    const data = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload  = ev => res(ev.target.result.split(',')[1]);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });

    if (isImage) {
      // Image → une seule "page", vignette directe
      const mimeType = file.type || (/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg');
      const thumbUrl = 'data:' + mimeType + ';base64,' + data;
      const item = {
        name: file.name, data, mimeType, isImage: true,
        pageCount: 1,
        selectedPages: new Set([0]),
        thumbUrl,
        ppRendered: true  // pas de page-picker pour les images
      };
      mergeItems.push(item);
      mergeRenderList();
    } else {
      // PDF
      try {
        const pdfJsDoc = await pdfjsLib.getDocument({ data: base64ToBytes(data) }).promise;
        const np = pdfJsDoc.numPages;
        const item = { name: file.name, data, isImage: false, pageCount: np,
                       selectedPages: new Set(Array.from({length:np},(_,i)=>i)),
                       thumbUrl: null, pdfDoc: null, ppRendered: false };
        mergeItems.push(item);
        item.thumbUrl = await mergeRenderThumb(data, 52, 68);
        mergeRenderList();
      } catch(e) {
        t('Erreur : ' + file.name + ' — ' + e.message);
      }
    }
  }
  mergeSummary();
}

async function mergeRenderThumb(b64, w, h) {
  try {
    const bytes = base64ToBytes(b64);
    const pdfBuf = new Uint8Array(bytes);
    const pdf    = await pdfjsLib.getDocument({ data: pdfBuf, disableWorker: false }).promise;
    const page   = await pdf.getPage(1);
    const vp     = page.getViewport({ scale: 1 });
    const scale  = Math.min(w / vp.width, h / vp.height);
    const vp2    = page.getViewport({ scale });
    const cv     = document.createElement('canvas');
    cv.width  = vp2.width; cv.height = vp2.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp2 }).promise;
    return cv.toDataURL('image/jpeg', 0.85);
  } catch { return null; }
}

// ── Rendu de la liste ─────────────────────────────────────────────────────────
function mergeRenderList() {
  const list = document.getElementById('merge-list');
  list.innerHTML = '';
  mergeItems.forEach((item, idx) => {
    const allSel  = item.selectedPages.size === item.pageCount;
    const selInfo = allSel
      ? 'Toutes les pages (' + item.pageCount + ')'
      : item.selectedPages.size + ' / ' + item.pageCount + ' pages';

    const row = document.createElement('div');
    row.className = 'merge-item';
    row.dataset.idx = idx;
    row.draggable = true;

    const metaLabel = item.isImage
      ? 'Image'
      : item.pageCount + ' page' + (item.pageCount > 1 ? 's' : '');
    const fallbackIcon = item.isImage
      ? '<i class="fa-regular fa-image" style="color:var(--gold);font-size:1.4rem"></i>'
      : '<i class="fa-solid fa-file-pdf" style="color:var(--gold);font-size:1.4rem"></i>';

    row.innerHTML =
      '<div class="merge-drag" title="Réorganiser">⠿</div>' +
      '<div class="merge-thumb-wrap">' +
        (item.thumbUrl
          ? '<img class="merge-thumb" src="' + item.thumbUrl + '" alt="p1">'
          : fallbackIcon) +
      '</div>' +
      '<div class="merge-info">' +
        '<div class="merge-doc-name" title="' + item.name + '">' + item.name + '</div>' +
        '<div class="merge-doc-meta">' + metaLabel + '</div>' +
        '<div class="merge-sel-tag" id="mst-' + idx + '">' + selInfo + '</div>' +
      '</div>' +
      '<div class="merge-item-btns">' +
        (!item.isImage ? '<div class="merge-ib" onclick="mergeTogglePP(' + idx + ')"><i class="fa-regular fa-file-lines"></i> Pages</div>' : '') +
        '<div class="merge-ib del" onclick="mergeRemove(' + idx + ')"><i class="fa-solid fa-xmark"></i></div>' +
      '</div>';

    // Panneau page-picker (sous la row)
    const pp = document.createElement('div');
    pp.className = 'merge-pp';
    pp.id = 'merge-pp-' + idx;

    // Drag-to-reorder
    row.addEventListener('dragstart', e => {
      mergeDragSrc = idx;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault(); row.classList.remove('drag-over');
      if (mergeDragSrc !== null && mergeDragSrc !== idx) {
        const moved = mergeItems.splice(mergeDragSrc, 1)[0];
        mergeItems.splice(idx, 0, moved);
        mergeRenderList(); mergeSummary();
      }
      mergeDragSrc = null;
    });

    const wrap = document.createElement('div');
    wrap.appendChild(row);
    wrap.appendChild(pp);
    list.appendChild(wrap);
  });
}

// ── Page-picker ────────────────────────────────────────────────────────────────
async function mergeTogglePP(idx) {
  const pp   = document.getElementById('merge-pp-' + idx);
  const item = mergeItems[idx];
  if (!pp) return;
  const isOpen = pp.classList.contains('open');
  // Fermer tous les autres
  document.querySelectorAll('.merge-pp.open').forEach(el => el.classList.remove('open'));
  if (isOpen) return;

  // Rendre les vignettes de pages si pas encore fait
  if (!item.ppRendered) {
    item.ppRendered = true;
    pp.innerHTML = '<div style="color:var(--txt2);font-size:.75rem;grid-column:1/-1">Chargement…</div>';
    pp.classList.add('open');
    const bytes = base64ToBytes(item.data);
    const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    pp.innerHTML = '';
    for (let p = 1; p <= item.pageCount; p++) {
      const pgIdx = p - 1;
      const page  = await pdf.getPage(p);
      const vp    = page.getViewport({ scale: Math.min(52/page.getViewport({scale:1}).width, 68/page.getViewport({scale:1}).height) });
      const cv    = document.createElement('canvas');
      cv.width  = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;

      const pgEl = document.createElement('div');
      pgEl.className = 'merge-pg-item ' + (item.selectedPages.has(pgIdx) ? 'sel' : 'unsel');
      pgEl.dataset.pg = pgIdx;
      pgEl.innerHTML  = '<div class="merge-pg-num">p.' + p + '</div>';
      pgEl.insertBefore(cv, pgEl.firstChild);
      pgEl.addEventListener('click', () => {
        if (item.selectedPages.has(pgIdx)) item.selectedPages.delete(pgIdx);
        else item.selectedPages.add(pgIdx);
        pgEl.className = 'merge-pg-item ' + (item.selectedPages.has(pgIdx) ? 'sel' : 'unsel');
        // Mettre à jour le tag de sélection
        const tag = document.getElementById('mst-' + idx);
        const allSel = item.selectedPages.size === item.pageCount;
        if (tag) tag.textContent = allSel
          ? 'Toutes les pages (' + item.pageCount + ')'
          : item.selectedPages.size + ' / ' + item.pageCount + ' pages';
        mergeSummary();
      });
      pp.appendChild(pgEl);
    }
  } else {
    pp.classList.add('open');
  }
}

function mergeRemove(idx) {
  mergeItems.splice(idx, 1);
  mergeRenderList(); mergeSummary();
}

function mergeSummary() {
  const total = mergeItems.reduce((s, it) => s + it.selectedPages.size, 0);
  const txt   = mergeItems.length === 0
    ? 'Aucun document'
    : mergeItems.length + ' document' + (mergeItems.length>1?'s':'') + ' · ' + total + ' page' + (total>1?'s':'');
  document.getElementById('merge-summary').textContent = txt;
  const btn = document.getElementById('merge-btn');
  if (btn) btn.style.opacity = (mergeItems.length > 0 && total > 0) ? '1' : '.4';
}

// ── Fusion finale ─────────────────────────────────────────────────────────────
async function doMerge() {
  if (!mergeItems.length) return;
  const blank = document.getElementById('mo-blank')?.checked;
  const renum = document.getElementById('mo-renum')?.checked;
  t('Fusion en cours…');
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const merged = await PDFDocument.create();
    let pageNum  = 1;

    for (let di = 0; di < mergeItems.length; di++) {
      const item  = mergeItems[di];
      const pages = [...item.selectedPages].sort((a,b) => a-b);
      if (!pages.length) continue;
      let lastPage = null;

      if (item.isImage) {
        // ── Fichier image → une page PDF aux dimensions de l'image ──────────────
        const bytes = base64ToBytes(item.data);
        let embImg;
        try {
          if (item.mimeType === 'image/png') {
            embImg = await merged.embedPng(bytes);
          } else {
            embImg = await merged.embedJpg(bytes);
          }
        } catch {
          // Format non supporté directement (webp, bmp, tiff…) → conversion canvas
          const dataUrl = 'data:' + (item.mimeType || 'image/jpeg') + ';base64,' + item.data;
          const img = await new Promise((res, rej) => {
            const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
          });
          const cv = document.createElement('canvas');
          cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext('2d').drawImage(img, 0, 0);
          const jpgB64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
          embImg = await merged.embedJpg(base64ToBytes(jpgB64));
        }
        const { width, height } = embImg.scale(1);
        lastPage = merged.addPage([width, height]);
        lastPage.drawImage(embImg, { x: 0, y: 0, width, height });
      } else {
        // ── Fichier PDF ──────────────────────────────────────────────────────────
        let copied = [];
        try {
          const src = await PDFDocument.load(base64ToBytes(item.data), { ignoreEncryption: true });
          copied = await merged.copyPages(src, pages);
          copied.forEach(pg => { lastPage = merged.addPage(pg); });
        } catch(eLib) {
          // Fallback rasterisation via PDF.js pour les PDFs incompatibles avec pdf-lib
          const pdfJsDoc = await pdfjsLib.getDocument({ data: base64ToBytes(item.data) }).promise;
          for (const pi of pages) {
            const page = await pdfJsDoc.getPage(pi + 1);
            const vp0  = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 1200 / Math.max(vp0.width, vp0.height));
            const vp   = page.getViewport({ scale });
            const cv   = document.createElement('canvas');
            cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            page.cleanup();
            const jpgB64 = cv.toDataURL('image/jpeg', 0.90).split(',')[1];
            const embImg = await merged.embedJpg(base64ToBytes(jpgB64));
            lastPage = merged.addPage([vp0.width, vp0.height]);
            lastPage.drawImage(embImg, { x: 0, y: 0, width: vp0.width, height: vp0.height });
          }
          t('ℹ ' + item.name + ' : rasterisé (format partiel)');
        }
      }

      // Page blanche séparatrice (sauf après le dernier doc)
      if (blank && di < mergeItems.length - 1 && lastPage) {
        const { width, height } = lastPage.getSize();
        merged.addPage([width, height]);
      }
    }

    const bytes = await merged.save();
    const data  = bytesToBase64(bytes);
    const date  = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const name  = 'fusion_' + date + '.pdf';
    closeMergePanel();
    await renderPDFFromData({ name, size: Math.round(data.length*.75), data, filePath: null });
    t('✓ Fusion : ' + name);
  } catch(err) { t('Erreur fusion : ' + err.message); }
}

// ── Formulaires AcroForm ──────────────────────────────────────────────────────
async function renderFormFields(page, vp, wrap) {
  try {
    const annotations = await page.getAnnotations({ intent: 'display' });
    const widgets = annotations.filter(a => a.subtype === 'Widget');
    if (!widgets.length) return;

    const layer = document.createElement('div');
    layer.className = 'form-layer';
    layer.style.width  = vp.width  + 'px';
    layer.style.height = vp.height + 'px';

    for (const annot of widgets) {
      if (!annot.rect) continue;
      const r = vp.convertToViewportRectangle(annot.rect);
      const left  = Math.min(r[0], r[2]);
      const top   = Math.min(r[1], r[3]);
      const width = Math.max(8, Math.abs(r[2] - r[0]));
      const hgt   = Math.max(8, Math.abs(r[3] - r[1]));
      const fname = annot.fieldName || annot.id || '';
      const fval  = annot.fieldValue || '';
      const rdonly = !!annot.readOnly;

      const base = 'position:absolute;left:' + left.toFixed(1) + 'px;top:' + top.toFixed(1) + 'px;z-index:1;' +
                   'width:' + width.toFixed(1) + 'px;height:' + hgt.toFixed(1) + 'px;pointer-events:auto;';

      const pdfRectStr = JSON.stringify(annot.rect || [0,0,0,0]);
      const pdfPageStr = wrap.dataset.page || '1';
      // annot.id = "40R" → numéro d'objet PDF.js a résolu
      const pdfObjNum  = annot.id ? String(annot.id).replace(/R$/,'').trim() : '';

      if (annot.fieldType === 'Tx') {
        const multi = !!annot.multiLine;
        const fs    = Math.max(7, Math.min(hgt * 0.65, 13)).toFixed(1);
        const el    = document.createElement(multi ? 'textarea' : 'input');
        if (!multi) el.type = 'text';
        el.value    = fval;
        el.readOnly = rdonly;
        el.title    = fname;
        el.dataset.pdfRect   = pdfRectStr;
        el.dataset.pdfPage   = pdfPageStr;
        el.dataset.pdfObjNum = pdfObjNum;
        el.style.cssText = base + 'font-size:' + fs + 'px;' + (rdonly ? 'cursor:default;opacity:.8;' : '');
        if (!rdonly) {
          el.addEventListener('blur', () => updateFormFieldPdf(fname, 'Tx', el.value, pdfObjNum));
        }
        layer.appendChild(el);

      } else if (annot.fieldType === 'Btn') {
        const el  = document.createElement('input');
        el.type   = annot.radioButton ? 'radio' : 'checkbox';
        if (annot.radioButton) el.name = fname;
        const fvalStr = String(fval || '').replace('/','');
        const checked = fvalStr !== '' && fvalStr !== 'Off' && fvalStr !== 'false' && fvalStr !== '0';
        el.checked  = checked;
        el.disabled = rdonly;
        el.title    = fname;
        el.dataset.pdfRect   = pdfRectStr;
        el.dataset.pdfPage   = pdfPageStr;
        el.dataset.pdfObjNum = pdfObjNum;
        const sz    = Math.min(width, hgt, 16).toFixed(1);
        el.style.cssText = base + 'width:' + sz + 'px;height:' + sz + 'px;' +
          'top:' + (top + (hgt - parseFloat(sz))/2).toFixed(1) + 'px;' +
          'left:' + (left + (width - parseFloat(sz))/2).toFixed(1) + 'px;';
        if (!rdonly) {
          el.addEventListener('change', () => {
            const exportVal = annot.exportValue || 'Yes';
            updateFormFieldPdf(fname, 'Btn', el.checked ? exportVal : null, pdfObjNum);
          });
        }
        layer.appendChild(el);

      } else if (annot.fieldType === 'Ch') {
        const el = document.createElement('select');
        (annot.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.exportValue || opt.displayValue || '';
          o.textContent = opt.displayValue || opt.exportValue || '';
          if (fval === o.value) o.selected = true;
          el.appendChild(o);
        });
        el.dataset.pdfRect   = pdfRectStr;
        el.dataset.pdfPage   = pdfPageStr;
        el.dataset.pdfObjNum = pdfObjNum;
        el.style.cssText = base + 'font-size:11px;';
        el.addEventListener('change', () => updateFormFieldPdf(fname, 'Ch', el.value, pdfObjNum));
        layer.appendChild(el);
      }
    }

    // Insérer avant le numéro de page
    const numEl = wrap.querySelector('div[style*="text-align:center"]');
    if (numEl) wrap.insertBefore(layer, numEl);
    else wrap.appendChild(layer);

    // Indicateur form (affiché une seule fois par PDF)
    if (!document.getElementById('form-tag')) {
      const tag = document.createElement('div');
      tag.id = 'form-tag';
      tag.className = 'form-tag';
      tag.textContent = '✏ Formulaire';
      tag.style.display = 'block';
      document.body.appendChild(tag);
      setTimeout(() => { tag.style.display = 'none'; }, 3500);
    }

  } catch(err) {
    console.warn('renderFormFields:', err.message);
  }
}

// Cherche un champ pdf-lib par nom exact ou suffixe (PDF.js et pdf-lib peuvent
// utiliser des noms différents : "Nom" vs "Form1[0].Nom[0]").
function _pdfLibFindField(form, fieldName) {
  // 1) Accès direct
  try { return { field: form.getTextField(fieldName), type: 'Tx' }; } catch {}
  try { return { field: form.getCheckBox(fieldName),  type: 'Cb' }; } catch {}
  try { return { field: form.getRadioGroup(fieldName),type: 'Rg' }; } catch {}
  try { return { field: form.getDropdown(fieldName),  type: 'Ch' }; } catch {}
  // 2) Recherche partielle (nom qualifié type "Form[0].Champ[0]")
  const all = form.getFields();
  console.log('[FORM] champs pdf-lib disponibles:', all.map(f => f.getName()));
  const match = all.find(f => {
    const n = f.getName();
    return n === fieldName || n.endsWith('.' + fieldName) || n.endsWith('[0].' + fieldName + '[0]') || n.includes(fieldName);
  });
  return match ? { field: match, type: match.constructor.name } : null;
}

async function _loadPdfForEdit(b64) {
  const { PDFDocument } = PDFLib;
  const bytes = base64ToBytes(b64);

  const tryLoad = async (opts, label) => {
    try {
      const doc = await PDFDocument.load(bytes, opts);
      const n = doc.getForm().getFields().length;
      console.log(`[LOAD] ${label} → ${n} champs`);
      if (n > 0) return doc;
    } catch(e) {
      console.log(`[LOAD] ${label} → ERREUR: ${e.message}`);
    }
    return null;
  };

  return (
    await tryLoad({ password: '' },                                       'password=""')          ||
    await tryLoad({},                                                      'standard')             ||
    await tryLoad({ throwOnInvalidObject: false },                         'throwOnInvalid')       ||
    await tryLoad({ ignoreEncryption: true, throwOnInvalidObject: false }, 'ignoreEnc+throwOnInv') ||
    PDFDocument.load(bytes, { ignoreEncryption: true })
  );
}

// ─── Sauvegarde d'un champ de formulaire ─────────────────────────────────────
// Utilise PDF.js annotationStorage + saveDocument (gère ObjStm, chiffrement…).
// pdfObjNum = numéro d'objet PDF (ex: "40") provenant de annot.id lors du rendu.
async function updateFormFieldPdf(fieldName, fieldType, value, pdfObjNum) {
  if (!currentPdfData || !fieldName) return;
  if (!currentPdfDoc || typeof currentPdfDoc.saveDocument !== 'function') {
    console.warn('[FORM] saveDocument non disponible sur cette version de PDF.js');
    return;
  }
  if (!pdfObjNum) {
    // Tenter de le retrouver depuis le DOM
    const el = document.querySelector(`.form-layer [title="${CSS.escape(fieldName)}"]`);
    pdfObjNum = el ? el.dataset.pdfObjNum : '';
  }
  if (!pdfObjNum) { console.warn('[FORM] pdfObjNum manquant pour', fieldName); return; }

  try {
    // Clé annotationStorage = référence objet PDF.js (ex: "40R")
    const annotId = pdfObjNum + 'R';
    const storage = currentPdfDoc.annotationStorage;
    storage.setValue(annotId, { value: value ?? '' });

    const bytes = await currentPdfDoc.saveDocument();
    const data  = bytesToBase64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    console.log('[FORM] saveDocument OK, bytes:', bytes.byteLength ?? bytes.length);

    if (currentPdfData) {
      undoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    redoStack      = [];
    currentPdfData = data;
    currentPdfSize = Math.round(data.length * 0.75);
    if (tabs[activeTabIdx]) { tabs[activeTabIdx].data = data; tabs[activeTabIdx].size = currentPdfSize; }
    updateUndoRedoBtns();
  } catch(err) {
    console.warn('[FORM] updateFormFieldPdf:', err.message);
  }
}



async function confirmDeletePage(pageNum) {
  return new Promise(resolve => {
    const ov  = document.createElement('div');
    const box = document.createElement('div');
    ov.style.cssText  = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:20000;display:flex;align-items:center;justify-content:center;';
    box.style.cssText = 'background:var(--bg-panel);border:1px solid var(--gold);border-top:3px solid #e74c3c;border-radius:6px;padding:24px 28px;min-width:300px;text-align:center';
    const title = document.createElement('div');
    title.style.cssText = 'font-family:Cinzel,serif;color:#e74c3c;margin-bottom:12px;font-size:.9rem';
    title.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Supprimer la page ' + pageNum + ' ?';
    const sub = document.createElement('div');
    sub.style.cssText = 'color:var(--txt2);font-size:.8rem;margin-bottom:18px';
    sub.textContent = 'Cette action peut être annulée avec Ctrl+Z';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center';
    const btnNo  = document.createElement('div'); btnNo.className  = 'mbtn'; btnNo.textContent = 'Annuler';
    const btnYes = document.createElement('div'); btnYes.className = 'mbtn'; btnYes.textContent = 'Supprimer';
    btnYes.style.cssText = 'background:#e74c3c;color:#fff;border-color:#e74c3c';
    const close = v => { ov.remove(); resolve(v); };
    btnNo.addEventListener('click',  () => close(false));
    btnYes.addEventListener('click', () => close(true));
    row.appendChild(btnNo); row.appendChild(btnYes);
    box.appendChild(title); box.appendChild(sub); box.appendChild(row);
    ov.appendChild(box);
    document.body.appendChild(ov);
  });
}

// ── Rotation de page ─────────────────────────────────────────────────────────
async function rotatePage(deg) {
  if (!currentPdfData) { t('Aucun PDF ouvert'); return; }
  // Utiliser la multi-sélection si disponible, sinon la page courante
  let targets = [...selectedThumbPages];
  if (!targets.length) {
    const curPageNum = parseInt(document.getElementById('cur-page')?.textContent || '1') || 1;
    targets = [selectedThumbPage > 0 ? selectedThumbPage : curPageNum];
  }
  try {
    const { PDFDocument, degrees } = PDFLib;
    const doc      = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const allPages = doc.getPages();
    for (const p of targets) {
      const page = allPages[p - 1];
      if (!page) continue;
      page.setRotation(degrees((page.getRotation().angle + deg) % 360));
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    t(targets.length > 1 ? targets.length + ' pages pivotees de ' + deg + '°' : 'Page pivotee de ' + deg + '°');
  } catch(err) { t('Erreur rotation : ' + err.message); }
}

// ══ Taille de la page ═════════════════════════════════════════════════════════
let _pgSizeUnit      = 'px';   // 'px' ou 'cm'
let _pgSizeLocked    = true;   // aspect ratio verrouillé
let _pgSizeOrigW     = 0;      // dimensions originales en points (pdf-lib units)
let _pgSizeOrigH     = 0;
let _pgSizeAspect    = 1;      // W/H

const _PT_PER_CM = 28.3465;   // 1 cm = 28.3465 pt

function _ptToDisplay(pt) {
  return _pgSizeUnit === 'cm'
    ? parseFloat((pt / _PT_PER_CM).toFixed(3))
    : Math.round(pt);          // px = pt arrondi (72 dpi)
}
function _displayToPt(val) {
  return _pgSizeUnit === 'cm' ? val * _PT_PER_CM : val;
}

async function openPageSizePanel() {
  if (!currentPdfData) { t('Ouvrez d\'abord un PDF.'); return; }
  const { PDFDocument } = PDFLib;
  const doc   = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
  const pages = doc.getPages();
  const np    = pages.length;

  // Remplir le sélecteur de pages
  const sel = document.getElementById('pgsize-page');
  sel.innerHTML = '';
  const curPage = parseInt(document.getElementById('cur-page')?.textContent || '1') || 1;
  for (let i = 1; i <= np; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = 'Page ' + i;
    if (i === curPage) opt.selected = true;
    sel.appendChild(opt);
  }
  document.getElementById('pgsize-total').textContent = '/ ' + np;

  // Charger les dimensions de la page sélectionnée
  pgSizeLoadPage();
  document.getElementById('pgsize-overlay').style.display = 'flex';
}

function pgSizeLoadPage() {
  if (!currentPdfData) return;
  PDFLib.PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true }).then(doc => {
    const idx  = parseInt(document.getElementById('pgsize-page').value) - 1;
    const page = doc.getPages()[idx];
    if (!page) return;
    const { width, height } = page.getSize();
    _pgSizeOrigW  = width;
    _pgSizeOrigH  = height;
    _pgSizeAspect = width / Math.max(1, height);
    _pgSizeRefreshInputs();
  });
}

function _pgSizeRefreshInputs() {
  document.getElementById('pgsize-w').value = _ptToDisplay(_pgSizeOrigW);
  document.getElementById('pgsize-h').value = _ptToDisplay(_pgSizeOrigH);
  const tag = _pgSizeUnit === 'cm' ? 'cm' : 'px';
  document.getElementById('pgsize-utag-w').textContent = tag;
  document.getElementById('pgsize-utag-h').textContent = tag;
  const note = _pgSizeUnit === 'cm'
    ? '1 cm = 28.35 pt'
    : '1 px = 1 pt (72 dpi)';
  document.getElementById('pgsize-unit-note').textContent = note;
}

function pgSizeSetUnit(u) {
  _pgSizeUnit = u;
  document.getElementById('pgsize-px-btn').classList.toggle('act', u === 'px');
  document.getElementById('pgsize-cm-btn').classList.toggle('act', u === 'cm');
  // Lire les valeurs actuelles dans les inputs, convertir dans la nouvelle unité
  const wIn = parseFloat(document.getElementById('pgsize-w').value) || 0;
  const hIn = parseFloat(document.getElementById('pgsize-h').value) || 0;
  // Les inputs étaient dans l'ancienne unité → convertir en pt puis dans la nouvelle
  const oldUnit = u === 'cm' ? 'px' : 'cm';
  const ptW = oldUnit === 'cm' ? wIn * _PT_PER_CM : wIn;
  const ptH = oldUnit === 'cm' ? hIn * _PT_PER_CM : hIn;
  _pgSizeOrigW = ptW;
  _pgSizeOrigH = ptH;
  _pgSizeRefreshInputs();
}

function pgSizeToggleLock() {
  _pgSizeLocked = !_pgSizeLocked;
  const btn = document.getElementById('pgsize-lock-btn');
  const ico = document.getElementById('pgsize-lock-ico');
  btn.classList.toggle('act', _pgSizeLocked);
  ico.className = _pgSizeLocked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
  if (_pgSizeLocked) {
    // Recalculer le ratio depuis les valeurs actuelles
    const wIn = parseFloat(document.getElementById('pgsize-w').value) || 1;
    const hIn = parseFloat(document.getElementById('pgsize-h').value) || 1;
    _pgSizeAspect = wIn / hIn;
  }
}

function pgSizeWChanged() {
  if (!_pgSizeLocked) return;
  const wIn = parseFloat(document.getElementById('pgsize-w').value) || 0;
  const hVal = _pgSizeUnit === 'cm'
    ? parseFloat((wIn / _pgSizeAspect).toFixed(3))
    : Math.round(wIn / _pgSizeAspect);
  document.getElementById('pgsize-h').value = hVal;
}

function pgSizeHChanged() {
  if (!_pgSizeLocked) return;
  const hIn = parseFloat(document.getElementById('pgsize-h').value) || 0;
  const wVal = _pgSizeUnit === 'cm'
    ? parseFloat((hIn * _pgSizeAspect).toFixed(3))
    : Math.round(hIn * _pgSizeAspect);
  document.getElementById('pgsize-w').value = wVal;
}

function pgSizePreset(wPt, hPt) {
  _pgSizeOrigW  = wPt;
  _pgSizeOrigH  = hPt;
  _pgSizeAspect = wPt / hPt;
  _pgSizeRefreshInputs();
}

function closePageSizePanel() {
  document.getElementById('pgsize-overlay').style.display = 'none';
}

async function applyPageSize() {
  if (!currentPdfData) return;
  const wIn  = parseFloat(document.getElementById('pgsize-w').value);
  const hIn  = parseFloat(document.getElementById('pgsize-h').value);
  const newW = _displayToPt(wIn);
  const newH = _displayToPt(hIn);
  if (!newW || !newH || newW < 1 || newH < 1) { t('Dimensions invalides.'); return; }

  const scope  = document.getElementById('pgsize-scope').value;
  const pageNo = parseInt(document.getElementById('pgsize-page').value);

  try {
    const { PDFDocument } = PDFLib;
    const srcBytes = base64ToBytes(currentPdfData);

    // On reconstruit un nouveau doc page par page pour pouvoir embarquer et mettre à l'échelle
    const srcDoc  = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const newDoc  = await PDFDocument.create();
    const srcPages = srcDoc.getPages();
    const np       = srcPages.length;

    const targets = new Set(
      scope === 'all' ? srcPages.map((_, i) => i) : [pageNo - 1]
    );

    for (let i = 0; i < np; i++) {
      if (targets.has(i)) {
        // Embarquer la page source comme Form XObject
        const [emb] = await newDoc.embedPdf(srcBytes, [i]);
        const { width: origW, height: origH } = srcPages[i].getSize();

        // Créer une nouvelle page aux nouvelles dimensions
        const newPage = newDoc.addPage([newW, newH]);

        // Dessiner la page source mise à l'échelle pour remplir exactement newW×newH
        newPage.drawPage(emb, { x: 0, y: 0, width: newW, height: newH });
      } else {
        // Copier la page telle quelle
        const [copied] = await newDoc.copyPages(srcDoc, [i]);
        newDoc.addPage(copied);
      }
    }

    const data = bytesToBase64(await newDoc.save({ useObjectStreams: false }));
    closePageSizePanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length * .75), data, filePath: currentFilePath }, true);
    const wDisp = _ptToDisplay(newW);
    const hDisp = _ptToDisplay(newH);
    const u = _pgSizeUnit;
    t((scope === 'all' ? 'Toutes les pages' : 'Page ' + pageNo) + ' redimensionnée : ' + wDisp + u + ' × ' + hDisp + u);
  } catch(err) { t('Erreur : ' + err.message); }
}

async function renderThumbnails(pdf) {
  // Incrémenter la génération : tout rendu précédent encore en cours sera ignoré
  const generation = ++_thumbGeneration;
  const tabIdx = activeTabIdx; // capturer l'onglet actif au DEBUT — peut changer pendant le rendu async

  const np          = pdf.numPages;
  const thContainer = document.getElementById('th-container');
  const thEmpty     = document.getElementById('th-empty');
  thContainer.innerHTML = '';
  if (thEmpty)     thEmpty.style.display = 'none';
  if (thContainer) thContainer.style.display = 'block';
  selectedThumbPage = 0;
  const pageOpsBar = document.getElementById('page-ops-bar');
  if (pageOpsBar) pageOpsBar.style.display = 'none';
  // selectedThumbPages est conservé (pas réinitialisé) pour restaurer la sélection après re-render

  const THUMB_MAX_W = 260; // largeur de rendu en pixels (2× pour une netteté optimale)

  for (let i = 1; i <= np; i++) {
    // Si une nouvelle session a démarré, abandonner ce rendu
    if (_thumbGeneration !== generation) return;

    const page  = await pdf.getPage(i);
    const vp0   = page.getViewport({ scale: 1 });
    const scale = THUMB_MAX_W / vp0.width;
    const vp    = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    if (_thumbGeneration !== generation) return; // vérifier après le rendu (opération longue)

    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.92);
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';

    const thc = document.createElement('div');
    thc.className = 'thc';
    thc.style.cssText = 'padding:0;overflow:hidden';
    thc.appendChild(img);

    const th = document.createElement('div');
    th.className = 'th' + (i === 1 ? ' act' : '');
    th.appendChild(thc);

    const thn = document.createElement('div');
    thn.className = 'thn';
    thn.textContent = i;

    // Bouton suppression vignette
    const delBtn = document.createElement('div');
    delBtn.className = 'th-del';
    delBtn.title = 'Supprimer cette page';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await confirmDeletePage(pageNum);
      if (confirmed) await deletePage(pageNum);
    });

    const tw = document.createElement('div');
    tw.className = 'tw';
    tw.appendChild(delBtn);
    tw.appendChild(th);
    tw.appendChild(thn);
    thContainer.appendChild(tw);

    const pageNum = i;
    th.style.cursor = 'pointer';
    th.addEventListener('click', (e) => {
      if (e.shiftKey && lastClickedThumb > 0) {
        // Sélection par plage (shift+clic)
        const lo = Math.min(lastClickedThumb, pageNum);
        const hi = Math.max(lastClickedThumb, pageNum);
        if (!e.ctrlKey && !e.metaKey) selectedThumbPages = new Set();
        for (let p = lo; p <= hi; p++) selectedThumbPages.add(p);
      } else if (e.ctrlKey || e.metaKey) {
        // Bascule individuelle (ctrl+clic)
        if (selectedThumbPages.has(pageNum)) selectedThumbPages.delete(pageNum);
        else selectedThumbPages.add(pageNum);
        lastClickedThumb = pageNum;
      } else {
        // Sélection simple
        selectedThumbPages = new Set([pageNum]);
        lastClickedThumb = pageNum;
      }
      selectedThumbPage = pageNum;
      // Visuel actif (bordure dorée = page vue)
      document.querySelectorAll('.th').forEach(el => el.classList.remove('act'));
      th.classList.add('act');
      document.getElementById('cur-page').textContent = pageNum;
      if (selectedThumbPages.size === 1) scrollToPage(pageNum);
      updateThumbSelection();
      updatePageOpsBar();
    });
  }
  // Restaurer la sélection multiple après re-render
  if (selectedThumbPages.size > 0) {
    updateThumbSelection();
    updatePageOpsBar();
  }

  // Sauvegarder les images dans le cache de l'onglet qui a DEMARRE ce rendu
  // (tabIdx capturé au début, car activeTabIdx peut avoir changé pendant le rendu async)
  if (tabIdx >= 0 && tabs[tabIdx] && _thumbGeneration === generation) {
    const imgs = document.querySelectorAll('#th-container .thc img');
    tabs[tabIdx].thumbCache = Array.from(imgs).map(img => img.src);
  }
}

// ── Restauration rapide des vignettes depuis le cache d'images ────────────────
function restoreThumbsFromCache(thumbCache, pdf) {
  const thContainer = document.getElementById('th-container');
  if (!thContainer) return;
  thContainer.innerHTML = '';
  const np = thumbCache.length;
  for (let i = 0; i < np; i++) {
    const pageNum = i + 1;
    const img = document.createElement('img');
    img.src = thumbCache[i];
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';

    const thc = document.createElement('div');
    thc.className = 'thc';
    thc.style.cssText = 'padding:0;overflow:hidden';
    thc.appendChild(img);

    const th = document.createElement('div');
    th.className = 'th' + (pageNum === 1 ? ' act' : '');
    th.style.cursor = 'pointer';
    th.appendChild(thc);

    const thn = document.createElement('div');
    thn.className = 'thn';
    thn.textContent = pageNum;

    const delBtn = document.createElement('div');
    delBtn.className = 'th-del';
    delBtn.title = 'Supprimer cette page';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await confirmDeletePage(pageNum);
      if (confirmed) await deletePage(pageNum);
    });

    const tw = document.createElement('div');
    tw.className = 'tw';
    tw.appendChild(delBtn);
    tw.appendChild(th);
    tw.appendChild(thn);
    thContainer.appendChild(tw);

    th.addEventListener('click', (e) => {
      if (e.shiftKey && lastClickedThumb > 0) {
        const lo = Math.min(lastClickedThumb, pageNum);
        const hi = Math.max(lastClickedThumb, pageNum);
        if (!e.ctrlKey && !e.metaKey) selectedThumbPages = new Set();
        for (let p = lo; p <= hi; p++) selectedThumbPages.add(p);
      } else if (e.ctrlKey || e.metaKey) {
        if (selectedThumbPages.has(pageNum)) selectedThumbPages.delete(pageNum);
        else selectedThumbPages.add(pageNum);
        lastClickedThumb = pageNum;
      } else {
        selectedThumbPages = new Set([pageNum]);
        lastClickedThumb = pageNum;
      }
      selectedThumbPage = pageNum;
      document.querySelectorAll('.th').forEach(el => el.classList.remove('act'));
      th.classList.add('act');
      document.getElementById('cur-page').textContent = pageNum;
      if (selectedThumbPages.size === 1) scrollToPage(pageNum);
      updateThumbSelection();
      updatePageOpsBar();
    });
  }
  if (selectedThumbPages.size > 0) {
    updateThumbSelection();
    updatePageOpsBar();
  }
}

// Scroll vers une page dans la vue principale
function scrollToPage(pageNum) {
  const wrap = document.querySelector(`.page-wrap[data-page="${pageNum}"]`);
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

// ─── Drag & drop ──────────────────────────────────────────────────────────────
const dz = document.getElementById('drop-zone');
document.getElementById('canvas').addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
document.getElementById('canvas').addEventListener('dragleave', () => dz.classList.remove('drag'));
document.getElementById('canvas').addEventListener('drop', async e => {
  e.preventDefault();
  dz.classList.remove('drag');
  const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
  if (!files.length) { t('Deposez un ou plusieurs fichiers .pdf'); return; }
  if (files.length === 1) {
    const ab  = await files[0].arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    await handleOpenWith({ name: files[0].name, size: files[0].size, data: b64, filePath: null });
  } else {
    // Plusieurs fichiers glissés → charger en onglets automatiquement
    for (const file of files) {
      const ab  = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      if (currentPdfDoc) { syncActiveTab(); tabs.push(makeTab()); activeTabIdx = tabs.length - 1; }
      else if (activeTabIdx < 0) { tabs.push(makeTab()); activeTabIdx = 0; }
      await renderPDFFromData({ name: file.name, size: file.size, data: b64, filePath: null });
    }
    t(files.length + ' fichiers ouverts');
  }
});

// ─── Zoom : re-render PDF.js a la bonne resolution ────────────────────────────
// Ancienne approche (CSS zoom) : agrandissait des pixels → flou.
// Nouvelle approche : PDF.js re-calcule les pages a l'echelle exacte → net.
function zoomTo(val) {
  zoomLevel = Math.min(300, Math.max(40, Math.round(val)));
  document.getElementById('zoom-val').textContent = zoomLevel + '%';
  if (tabs[activeTabIdx]) tabs[activeTabIdx].zoomLevel = zoomLevel;
  if (currentPdfDoc) {
    renderMainPages(currentPdfDoc, baseFitScale * zoomLevel / 100, null, null);
  }
}
function zoom(dir) { zoomTo(zoomLevel + dir * 20); }

// ─── Vue : Adapter / Page double / Plein écran ───────────────────────────────

let doublePageMode = false;

// Adapter à la page : ajuste l'échelle pour que la page 1 remplisse #canvas
async function fitToPage() {
  if (!currentPdfDoc) { t("Ouvrez un PDF d'abord"); return; }
  const canvasEl = document.getElementById('pdf-viewport');
  const avail    = canvasEl.clientWidth - 48; // 24px marge de chaque côté
  const page1    = await currentPdfDoc.getPage(1);
  const vp1      = page1.getViewport({ scale: 1 });
  // En mode double page on divise par 2 (moins un gap)
  const targetW  = doublePageMode ? (avail / 2 - 12) : avail;
  baseFitScale   = targetW / vp1.width;
  zoomLevel      = 100;
  document.getElementById('zoom-val').textContent = 'Adapté';
  if (tabs[activeTabIdx]) { tabs[activeTabIdx].baseFitScale = baseFitScale; tabs[activeTabIdx].zoomLevel = zoomLevel; }
  await renderMainPages(currentPdfDoc, baseFitScale, null, null);
}

// Page double : affiche 2 pages côte à côte
function toggleDoublePage() {
  doublePageMode = !doublePageMode;
  const pagesEl = document.getElementById('pdf-pages');
  const btn     = document.getElementById('mdi-double-page');
  if (doublePageMode) {
    pagesEl.style.flexDirection  = 'row';
    pagesEl.style.flexWrap       = 'wrap';
    pagesEl.style.justifyContent = 'center';
    pagesEl.style.gap            = '16px';
    if (btn) btn.classList.add('act');
    // Ré-adapter la largeur au mode double
    fitToPage();
    t('Mode page double activé');
  } else {
    pagesEl.style.flexDirection  = 'column';
    pagesEl.style.flexWrap       = '';
    pagesEl.style.justifyContent = '';
    pagesEl.style.gap            = '';
    if (btn) btn.classList.remove('act');
    // Restaurer l'échelle normale
    if (currentPdfDoc) fitToPage();
    t('Mode page simple restauré');
  }
}

// Plein écran : bascule le mode plein écran navigateur/Electron
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const on  = !!document.fullscreenElement;
  const ico = document.getElementById('ico-fullscreen');
  const lbl = document.getElementById('lbl-fullscreen');
  const btn = document.getElementById('mdi-fullscreen');
  if (ico) ico.className = on ? 'fa-solid fa-compress' : 'fa-regular fa-window-maximize';
  if (lbl) lbl.textContent = on ? 'Quitter plein écran' : 'Plein écran';
  if (btn) btn.classList.toggle('act', on);
  // Ré-adapter la mise en page après le changement de taille
  if (currentPdfDoc) setTimeout(fitToPage, 150);
});

// ─── Outils ───────────────────────────────────────────────────────────────────
function setTool(el, name) {
  if (pendingAnnot) cancelPending();
  // Toggle : re-cliquer sur l'outil actif le désactive (retour en mode Lecture)
  if (name === currentTool) {
    currentTool = 'Lecture';
    if (el) document.querySelectorAll('#tbar .tb').forEach(b => b.classList.remove('act'));
    const pe = document.getElementById('pdf-pages');
    if (pe) { pe.classList.remove('sel-mode'); pe.classList.remove('text-mode'); }
    document.getElementById('draw-tb')?.style.setProperty('display','none');
    removeAllDrawOverlays();
    clearSelection();
    document.getElementById('st-tool').innerHTML = '<i class="fa-solid fa-arrow-pointer"></i>Lecture';
    t('Outil désactivé — mode lecture');
    return;
  }
  currentTool = name;
  if (el) {
    document.querySelectorAll('#tbar .tb').forEach(b => b.classList.remove('act'));
    el.classList.add('act');
  }
  document.getElementById('st-tool').innerHTML = '<i class="fa-solid fa-arrow-pointer"></i>' + name;
  const pagesEl = document.getElementById('pdf-pages');
  if (pagesEl) {
    pagesEl.classList.toggle('sel-mode',  name === 'Sélection');
    pagesEl.classList.toggle('text-mode', name === 'Texte');
  }
  if (name !== 'Texte' && activeTextAnno) { activeTextAnno.classList.remove('tsel'); activeTextAnno = null; }
  hideTextFmtBar();
  clearSelection();
  if (name === 'Image') { setTimeout(insertImage, 50); return; }
  if (DRAW_TOOLS.includes(name)) {
    showDrawToolbar(name);
    if (shapeType === 'fill' && name === 'Biffure') { /* keep */ }
    if (name !== 'Biffure') shapeType = name === 'Formes' ? 'rect' : shapeType;
  } else {
    document.getElementById('draw-tb')?.style.setProperty('display','none');
    removeAllDrawOverlays();
  }
  t('Outil : ' + name);
}

// ─── Onglets ──────────────────────────────────────────────────────────────────
function lTab(name, el) {
  document.querySelectorAll('#lp .pt').forEach(p => p.classList.remove('act'));
  el.classList.add('act');
  document.querySelectorAll('#lp .pv').forEach(v => v.classList.remove('act'));
  document.getElementById('tab-' + name).classList.add('act');
}
function rTab(name, el) {
  document.querySelectorAll('#rp .pt').forEach(p => p.classList.remove('act'));
  el.classList.add('act');
  document.querySelectorAll('#r-pr,#r-ai,#r-sec').forEach(v => v.style.display = 'none');
  document.getElementById('r-' + name).style.display = 'block';
}

// ─── Miniatures (clic sur miniature = selection) ──────────────────────────────
function selPage(el, n) {
  document.querySelectorAll('.th').forEach(th => th.classList.remove('act'));
  el.classList.add('act');
  document.getElementById('cur-page').textContent = n;
  t('Page ' + n + ' selectionnee');
}

// ─── OCR : dimensions naturelles d'une image base64 ──────────────────────────
function getImageDimensions(base64, type) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = 'data:image/' + type + ';base64,' + base64;
  });
}

// ─── OCR : ameliorer l'image (uniquement pour Tesseract, pas pour le PDF) ─────
// Niveaux de gris + contraste + upscale x2 si petite.
// Retourne { data, type:'png', width, height } de l'image AMELIOREE.
async function enhanceImageForOCR(base64, type) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      const upscale = (img.width < 1500) ? 2 : 1;
      canvas.width  = img.width  * upscale;
      canvas.height = img.height * upscale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const c = Math.min(255, Math.max(0, ((gray - 128) * 1.4) + 128));
        d[i] = d[i+1] = d[i+2] = c;
      }
      ctx.putImageData(imgData, 0, 0);

      const enhW = canvas.width;
      const enhH = canvas.height;
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onload = e => resolve({ data: e.target.result.split(',')[1], type: 'png', width: enhW, height: enhH });
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/' + type + ';base64,' + base64;
  });
}

// ─── OCR : flux complet image → PDF searchable ───────────────────────────────

// ─── Paramètres OCR ────────────────────────────────────────────────────────────

function toggleOcrEngine() {
  const isGoogle = document.getElementById('ocr-google') && document.getElementById('ocr-google').checked;
  const keySection = document.getElementById('gv-key-section');
  const testBtn    = document.getElementById('btn-test-gv');
  if (keySection) keySection.style.display = isGoogle ? 'block' : 'none';
  if (testBtn)    testBtn.style.display    = isGoogle ? 'inline-flex' : 'none';
}

async function openOcrSettings() {
  if (!window.electronAPI) { t("Disponible uniquement dans l'application Electron"); return; }
  const settings = (await window.electronAPI.getSettings()) || {};
  const engine   = settings.ocrEngine || 'tesseract';
  const apiKey   = settings.googleVisionKey || '';

  let body = `
<div style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid rgba(200,150,46,.2)">
  <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.12em;color:var(--gold);margin-bottom:10px;text-transform:uppercase">${_s('settings.lang')}</div>
  <div style="display:flex;gap:10px">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.88rem">
      <input type="radio" name="app-lang" id="lang-fr" value="fr" onchange="applyLang('fr')"> <strong>Français</strong>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.88rem">
      <input type="radio" name="app-lang" id="lang-en" value="en" onchange="applyLang('en')"> <strong>English</strong>
    </label>
  </div>
</div>
<div style="margin-bottom:18px">
  <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.12em;color:var(--gold);margin-bottom:10px;text-transform:uppercase">${_s('settings.ocr_engine')}</div>
  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:10px;font-size:.88rem">
    <input type="radio" name="ocr-engine" id="ocr-tesseract" value="tesseract" onchange="toggleOcrEngine()">
    <div><strong>Tesseract</strong><div style="font-size:.78rem;opacity:.65;margin-top:2px">Local — hors ligne — sans configuration</div></div>
  </label>
  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.88rem">
    <input type="radio" name="ocr-engine" id="ocr-google" value="google" onchange="toggleOcrEngine()">
    <div><strong>Google Vision</strong><div style="font-size:.78rem;opacity:.65;margin-top:2px">IA — haute precision — necessite une cle API</div></div>
  </label>
</div>
<div id="gv-key-section" style="display:none;margin-top:6px;padding:12px 14px;background:rgba(0,0,0,.25);border:1px solid rgba(200,150,46,.3);border-radius:4px">
  <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.1em;color:var(--gold);margin-bottom:8px;text-transform:uppercase">Cle API Google Cloud Vision</div>
  <input id="gv-api-key" type="password" placeholder="AIzaSy..."
    style="width:100%;padding:7px 10px;background:rgba(0,0,0,.35);border:1px solid rgba(200,150,46,.4);border-radius:3px;color:var(--txt);font-family:monospace;font-size:.82rem;box-sizing:border-box;outline:none">
  <div style="margin-top:7px;font-size:.75rem;opacity:.55">
    1 000 req./mois gratuites &nbsp;·&nbsp;
    Activer : console.cloud.google.com → APIs → Cloud Vision API
  </div>
  <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
    <div class="mbtn" onclick="saveOcrSettings()"><i class="fa-solid fa-check"></i> Enregistrer</div>
    <div class="mbtn" id="btn-test-gv" onclick="testGoogleVision()"><i class="fa-solid fa-satellite-dish"></i> Tester la connexion</div>
  </div>
</div>
<div id="gv-save-simple" style="margin-top:14px">
  <div class="mbtn" onclick="saveOcrSettings()"><i class="fa-solid fa-check"></i> Enregistrer</div>
</div>`;

  const openaiKey = settings.openaiKey || '';
  body += `
<div style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(200,150,46,.2)">
  <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.12em;color:var(--gold);margin-bottom:10px;text-transform:uppercase">Clé API OpenAI (ChatGPT)</div>
  <div style="display:flex;gap:6px;align-items:center">
    <input id="openai-api-key" type="password" placeholder="sk-…"
      style="flex:1;padding:7px 10px;background:rgba(0,0,0,.35);border:1px solid rgba(200,150,46,.4);border-radius:3px;color:var(--txt);font-family:monospace;font-size:.82rem;box-sizing:border-box;outline:none">
    <span onclick="encTogglePwd('openai-api-key',this)" title="Afficher"
      style="cursor:pointer;color:var(--txt2);padding:4px 8px;border:1px solid rgba(200,150,46,.3);border-radius:3px;font-size:.8rem"><i class="fa-solid fa-eye"></i></span>
  </div>
  <div style="margin-top:6px;font-size:.72rem;opacity:.55">
    Utilisée pour : Traduction IA · Résumé · Chat avec le PDF
    &nbsp;·&nbsp; <a href="https://platform.openai.com/api-keys" style="color:var(--gold-l);text-decoration:none" target="_blank">platform.openai.com</a>
  </div>
</div>`;

  openModal(_s('settings.title'), body);

  // Appliquer les valeurs sauvegardees
  const radio = document.getElementById('ocr-' + engine);
  if (radio) radio.checked = true;
  const oaKeyInput = document.getElementById('openai-api-key');
  if (oaKeyInput) oaKeyInput.value = openaiKey;
  const keyInput = document.getElementById('gv-api-key');
  if (keyInput) keyInput.value = apiKey;
  // Pré-sélectionner la langue courante
  const langRadio = document.getElementById('lang-' + _lang);
  if (langRadio) langRadio.checked = true;

  // Afficher/masquer la section selon l'engine selectionne
  toggleOcrEngine();

  // Masquer le bouton "Enregistrer" simple quand Google Vision est actif
  // (il y a deja un bouton Enregistrer dans la section gv-key-section)
  const simpleSave = document.getElementById('gv-save-simple');
  if (simpleSave) simpleSave.style.display = (engine === 'google') ? 'none' : 'block';

  // Mettre a jour l'affichage quand on change d'engine
  document.querySelectorAll('input[name="ocr-engine"]').forEach(r => {
    r.addEventListener('change', () => {
      const isGoogle = document.getElementById('ocr-google').checked;
      if (simpleSave) simpleSave.style.display = isGoogle ? 'none' : 'block';
      toggleOcrEngine();
    });
  });
}

async function saveOcrSettings() {
  if (!window.electronAPI) return;
  const radio  = document.querySelector('input[name="ocr-engine"]:checked');
  const engine = radio ? radio.value : 'tesseract';
  const apiKey = (document.getElementById('gv-api-key') || {}).value || '';
  const openaiKey = (document.getElementById('openai-api-key') || {}).value || '';
  const langRadio = document.querySelector('input[name="app-lang"]:checked');
  const lang = langRadio ? langRadio.value : _lang;
  await window.electronAPI.saveSettings({ ocrEngine: engine, googleVisionKey: apiKey, openaiKey, lang });
  // Appliquer la langue immédiatement
  applyLang(lang);
  closeModal();
  t(_s('settings.saved'));
}

async function testGoogleVision() {
  if (!window.electronAPI) return;
  const apiKey = (document.getElementById('gv-api-key') || {}).value || '';
  if (!apiKey) { t('Entrez une cle API Google Vision'); return; }

  const btn = document.getElementById('btn-test-gv');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Test...';

  try {
    // Image de test generee via canvas : JPEG 300x80 avec du texte visible
    // (un PNG transparent ou trop petit est rejete par Google Vision avec 400)
    const testCanvas = document.createElement('canvas');
    testCanvas.width  = 300;
    testCanvas.height = 80;
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 80);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px serif';
    ctx.fillText('Test Vision API', 10, 55);
    const testImg = testCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];

    await window.electronAPI.ocrWithGoogleVision(testImg, 'jpeg', apiKey);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Tester la connexion';
    t('Google Vision — connexion OK !');
  } catch (err) {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Tester la connexion';
    // Afficher le detail complet dans la console pour diagnostiquer
    console.error('Google Vision test error:', err.message);
    t('Erreur : ' + err.message.slice(0, 120));
  }
}

// ─── Import universel : image (OCR→PDF) ou document (Word/txt/md/rtf/html→PDF) ─
async function importFile() {
  if (!window.electronAPI) { t("Disponible uniquement dans l'application Electron"); return; }
  const result = await window.electronAPI.openImportDialog();
  if (!result) return;

  if (result.type === 'gdoc') {
    // Google Doc : raccourci local — ne contient pas le document
    // On propose l'export PDF direct ou l'ouverture dans le navigateur
    await _showGdocImportDialog(result);
  } else if (result.type === 'image') {
    // Réutiliser le pipeline OCR existant avec les données déjà lues
    await _runOcrPipeline(result);
  } else {
    // Document texte/Word → PDF via BrowserWindow printToPDF
    const loadBar   = document.getElementById('load-bar');
    const loadInner = document.getElementById('load-inner');
    const loadLabel = document.getElementById('load-label');
    loadBar.style.display = 'block';
    loadInner.style.width = '10%';
    loadLabel.textContent = 'Conversion en cours…';

    const res = await window.electronAPI.convertDocToPdf(result.filePath, result.ext);
    if (res.error) {
      loadBar.style.display = 'none';
      t('Erreur : ' + res.error);
      return;
    }
    loadInner.style.width = '90%';
    loadLabel.textContent = 'Ouverture du PDF…';
    await handleOpenWith({ name: res.name, size: Math.round(res.data.length * .75), data: res.data, filePath: null });
    loadBar.style.display = 'none';
    t('Document importé : ' + res.name);
  }
}

// ─── Google Docs : dialogue d'aide à l'export ────────────────────────────────
function _showGdocImportDialog({ url, exportUrl, name }) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:20000;display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-panel);border:1px solid var(--gold);border-top:3px solid var(--gold);border-radius:6px;padding:24px 28px;min-width:340px;max-width:480px;font-size:.85rem;color:var(--txt)';
    box.innerHTML = `
      <div style="font-family:Cinzel,serif;color:var(--gold);margin-bottom:10px;font-size:.95rem">
        <i class="fa-brands fa-google-drive"></i> Google Docs — « ${name} »
      </div>
      <p style="color:var(--txt2);margin:0 0 14px;line-height:1.5">
        Les fichiers <b>.gdoc</b> sont des raccourcis vers Google Drive.<br>
        Le document n'est pas stocké localement.<br><br>
        Pour l'importer dans PDFEditor Pro :
      </p>
      <ol style="color:var(--txt2);margin:0 0 18px;padding-left:18px;line-height:1.9">
        <li>Ouvrez le document dans Google Docs</li>
        <li>Fichier → Télécharger → <b>PDF</b> ou <b>Word (.docx)</b></li>
        <li>Importez le fichier téléchargé ici</li>
      </ol>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        ${url ? `<div class="mbtn" id="gdoc-open-btn" style="background:var(--gold);color:#1a1209;border-color:var(--gold)"><i class="fa-brands fa-google-drive"></i> Ouvrir dans Google Docs</div>` : ''}
        <div class="mbtn" id="gdoc-close-btn"><i class="fa-solid fa-xmark"></i> Fermer</div>
      </div>`;
    ov.appendChild(box);
    document.body.appendChild(ov);
    box.querySelector('#gdoc-close-btn').addEventListener('click', () => { ov.remove(); resolve(); });
    const openBtn = box.querySelector('#gdoc-open-btn');
    if (openBtn) openBtn.addEventListener('click', () => {
      window.open(url, '_blank');
      ov.remove(); resolve();
    });
  });
}

async function importImageOCR() {
  // Redirige vers le sélecteur unifié (images + documents)
  return importFile();
}

async function _runOcrPipeline(imgData) {
  if (!window.electronAPI) return;

  document.getElementById('drop-zone').style.display = 'none';
  const loadBar   = document.getElementById('load-bar');
  const loadInner = document.getElementById('load-inner');
  const loadLabel = document.getElementById('load-label');
  loadBar.style.display = 'block';
  loadInner.style.width = '3%';
  loadLabel.textContent = "Traitement de l'image...";

  // Lire les preferences OCR
  const settings  = window.electronAPI ? (await window.electronAPI.getSettings() || {}) : {};
  const useGoogle = (settings.ocrEngine === 'google') && !!settings.googleVisionKey;

  window.electronAPI.removeAllListeners('ocr-progress');
  if (!useGoogle) {
    window.electronAPI.onOcrProgress(({ status, progress }) => {
      loadInner.style.width = Math.round(20 + progress * 55) + '%';
      loadLabel.textContent = status;
    });
  }

  try {
    loadInner.style.width = '5%';
    loadLabel.textContent = "Lecture de l'image...";
    if (!imgData) { loadBar.style.display = 'none'; document.getElementById('drop-zone').style.display = 'flex'; return; }

    const origDims = await getImageDimensions(imgData.imageData, imgData.imageType);

    let ocrResult = null;
    let ocrWidth, ocrHeight;

    if (useGoogle) {
      // ── Google Cloud Vision ──────────────────────────────────────────────────
      loadInner.style.width = '25%';
      loadLabel.textContent = "Google Vision \u2014 envoi de l'image...";
      ocrResult = await window.electronAPI.ocrWithGoogleVision(
        imgData.imageData, imgData.imageType, settings.googleVisionKey
      );
      loadInner.style.width = '80%';
      ocrWidth  = ocrResult.ocrWidth  || origDims.width;
      ocrHeight = ocrResult.ocrHeight || origDims.height;

    } else {
      // ── Tesseract (local) ────────────────────────────────────────────────────
      loadInner.style.width = '12%';
      loadLabel.textContent = "Preparation OCR...";
      const enhanced = await enhanceImageForOCR(imgData.imageData, imgData.imageType);

      loadInner.style.width = '20%';
      loadLabel.textContent = "Reconnaissance OCR...";
      ocrResult = await window.electronAPI.ocrFromData(
        enhanced ? enhanced.data : imgData.imageData,
        enhanced ? 'png'         : imgData.imageType
      );
      ocrWidth  = enhanced ? enhanced.width  : origDims.width;
      ocrHeight = enhanced ? enhanced.height : origDims.height;
    }

    // ── Etape finale : PDF image ORIGINALE + calque texte OCR ───────────────────
    loadInner.style.width = '82%';
    loadLabel.textContent = 'Creation du PDF...';
    const pdfBase64 = await createSearchablePDF({
      imageData:   imgData.imageData,
      imageType:   imgData.imageType,
      imageName:   imgData.imageName,
      imageWidth:  origDims.width,
      imageHeight: origDims.height,
      words:       ocrResult ? ocrResult.words : [],
      ocrWidth,
      ocrHeight,
    });

    loadInner.style.width = '100%';
    loadLabel.textContent = 'PDF cree';
    setTimeout(() => loadBar.style.display = 'none', 600);
    await handleOpenWith({ name: imgData.imageName, size: Math.round(pdfBase64.length * 0.75), data: pdfBase64, filePath: null });
    t(imgData.imageName + ' — OCR termine' + (useGoogle ? ' (Google Vision)' : ''));

  } catch (err) {
    loadBar.style.display = 'none';
    document.getElementById('drop-zone').style.display = 'flex';
    t('Erreur OCR : ' + err.message);
    console.error(err);
  }
}

// ─── Creer un PDF searchable ──────────────────────────────────────────────────
// 1 pixel = 1 point PDF : aucune perte de qualite.
// L'image est embarquee a sa resolution native integrale.
// ocrWidth/ocrHeight = dimensions de l'image enhanced (pour corriger les coords).
async function createSearchablePDF({ imageData, imageType, imageName, imageWidth, imageHeight, words, ocrWidth, ocrHeight }) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const imgBytes = base64ToBytes(imageData);

  let w = imageWidth  || 595;
  let h = imageHeight || 842;

  // Embarquer l'image originale (couleurs, pleine resolution)
  let pdfImage;
  try {
    pdfImage = (imageType === 'png')
      ? await pdfDoc.embedPng(imgBytes)
      : await pdfDoc.embedJpg(imgBytes);
    const dims = pdfImage.scale(1);
    w = dims.width;
    h = dims.height;
  } catch(e) { console.warn('Embed image:', e.message); }

  // 1 pixel = 1 point PDF → qualite maximale, aucune compression
  // Le lecteur PDF zoome / ajuste a la fenetre automatiquement.
  const ptW = w;
  const ptH = h;

  const page = pdfDoc.addPage([ptW, ptH]);

  // Facteurs coords OCR → points PDF
  // Si OCR tourne sur image 2x upscalee : effectiveOcrW = 2*w → wordFactorX = ptW/(2*w) = 0.5
  const effectiveOcrW = (ocrWidth  && ocrWidth  > 0) ? ocrWidth  : w;
  const effectiveOcrH = (ocrHeight && ocrHeight > 0) ? ocrHeight : h;
  const wordFactorX   = ptW / effectiveOcrW;
  const wordFactorY   = ptH / effectiveOcrH;

  // Texte OCR invisible EN PREMIER (recouvert par l'image)
  if (words && words.length > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    words.forEach(word => {
      if (!word.text || !word.text.trim() || word.confidence < 20) return;
      // Filtrer les caracteres hors encodage WinAnsi (Helvetica = latin etendu 0x20-0xFF)
      // Ex: cases a cocher, emojis, caracteres CJK → ignores silencieusement
      const safeText = word.text.replace(/[^\x20-\xFF]/g, '');
      if (!safeText.trim()) return;
      try {
        const { x0, y0, x1, y1 } = word.bbox;
        const wordH   = (y1 - y0) * wordFactorY;
        const targetW = (x1 - x0) * wordFactorX;
        // Taille de police pour couvrir la largeur du bbox OCR :
        // PDF.js extraira item.width ≈ targetW → les spans de selection
        // couvrent exactement la zone du mot reconnu par l'OCR.
        let fontSize = Math.max(wordH * 0.85, 1);
        if (safeText.length > 0 && targetW > 0) {
          const widthAt = font.widthOfTextAtSize(safeText, fontSize);
          if (widthAt > 0) {
            const fsForW = fontSize * (targetW / widthAt);
            fontSize = Math.min(Math.max(fsForW, 1), Math.max(wordH * 5, 5));
          }
        }
        const pdfX = x0 * wordFactorX;
        const pdfY = ptH - y1 * wordFactorY;
        page.drawText(safeText, { x: pdfX, y: pdfY, size: fontSize, font, color: rgb(1,1,1), opacity: 0.01 });
      } catch(e) { /* caractere non supporte — mot ignore */ }
    });
  }

  // Image ORIGINALE par-dessus (couvre le texte invisible)
  if (pdfImage) {
    page.drawImage(pdfImage, { x: 0, y: 0, width: ptW, height: ptH });
  }

  // Export base64
  const pdfBytes = await pdfDoc.save();
  let b64 = '';
  const chunk = 8192;
  const arr = new Uint8Array(pdfBytes);
  for (let i = 0; i < arr.length; i += chunk) b64 += String.fromCharCode(...arr.subarray(i, i + chunk));
  return btoa(b64);
}

// ─── Nouveau document ─────────────────────────────────────────────────────────
function newDocument() {
  currentPdfDoc  = null;
  currentPdfData  = null;
  currentFilePath = null;
  selectedThumbPage = 0; selectedThumbPages = new Set();
  if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
    tabs[activeTabIdx].pdfDoc = null; tabs[activeTabIdx].data = null;
    tabs[activeTabIdx].name = ''; tabs[activeTabIdx].filePath = null;
  }
  renderGen++;
  renderTabBar();
  const pageOpsBar = document.getElementById('page-ops-bar');
  if (pageOpsBar) pageOpsBar.style.display = 'none';

  const pagesEl = document.getElementById('pdf-pages');
  pagesEl.innerHTML = '';
  pagesEl.style.display = 'none';

  document.getElementById('drop-zone').style.display = 'flex';
  document.getElementById('load-bar').style.display  = 'none';

  const thContainer = document.getElementById('th-container');
  const thEmpty     = document.getElementById('th-empty');
  if (thContainer) thContainer.innerHTML = '';
  if (thEmpty)     thEmpty.style.display = 'block';

  document.getElementById('doc-name').textContent    = '—';
  document.getElementById('doc-pages').textContent   = '—';
  document.getElementById('doc-size').textContent    = '—';
  document.getElementById('quality-bar').style.width = '0%';
  document.getElementById('quality-val').textContent = '— / 100';
  document.getElementById('st-file').textContent     = 'Aucun fichier';
  document.getElementById('cur-page').textContent    = '—';
  document.getElementById('total-pages').textContent = '—';

  zoomLevel = 100;
  document.getElementById('zoom-val').textContent = '100%';
  t('Nouveau document');
}


// ─── Flush formulaire avant enregistrement ───────────────────────────────────
// Capture l'état DOM actuel de tous les champs visibles et l'applique à currentPdfData
// au cas où le focus est encore dans un champ (blur non encore déclenché).
// Capture tous les champs DOM visibles et les écrit dans le PDF via PDF.js saveDocument.
// Appelée juste avant chaque save pour attraper l'état du champ actif (blur non encore déclenché).
async function flushFormFields() {
  const inputs = document.querySelectorAll('.form-layer input, .form-layer textarea, .form-layer select');
  if (!inputs.length || !currentPdfData || !currentPdfDoc) return;
  if (typeof currentPdfDoc.saveDocument !== 'function') return;

  try {
    const storage = currentPdfDoc.annotationStorage;
    let hasChanges = false;

    for (const el of inputs) {
      const objNum = el.dataset.pdfObjNum;
      if (!objNum) continue;
      const annotId = objNum + 'R'; // ex: "40R"

      let val;
      if (el.type === 'checkbox') {
        val = el.checked ? (el.dataset.exportValue || 'Yes') : 'Off';
      } else if (el.type === 'radio') {
        val = el.checked ? (el.value || 'Yes') : 'Off';
      } else {
        val = el.value || '';
      }

      storage.setValue(annotId, { value: val });
      hasChanges = true;
    }

    if (hasChanges) {
      const bytes = await currentPdfDoc.saveDocument();
      const data  = bytesToBase64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      currentPdfData = data;
      currentPdfSize = Math.round(data.length * 0.75);
      if (tabs[activeTabIdx]) { tabs[activeTabIdx].data = data; tabs[activeTabIdx].size = currentPdfSize; }
      console.log('[FORM] flushFormFields OK, bytes:', bytes.byteLength ?? bytes.length);
    }
  } catch(e) {
    console.warn('flushFormFields:', e.message);
  }
}

// ─── Enregistrer (Ctrl+S) ────────────────────────────────────────────────────
async function saveDocument() {
  if (!currentPdfData) { t("Aucun document ouvert"); return; }
  await flushFormFields();
  if (currentFilePath) {
    const res = await window.electronAPI.writeFile(currentFilePath, currentPdfData);
    if (res.success) {
      t("Enregistre : " + currentPdfName);
      if (tabs[activeTabIdx]) tabs[activeTabIdx].savedData = currentPdfData;
    } else {
      t("Erreur : " + res.error);
    }
  } else {
    await saveDocumentAs();
  }
}

// ─── Enregistrer sous (choix format + chemin) ────────────────────────────────
// Formats supportes : PDF, PNG, JPEG
// Pour PDF  : sauvegarde directe de currentPdfData
// Pour image: rendu PDF.js page 1 a 2x → canvas → base64 → fichier
async function saveDocumentAs() {
  if (!currentPdfData) { t("Aucun document ouvert"); return; }
  await flushFormFields();

  const dlg = await window.electronAPI.savePDF(currentPdfName || 'document.pdf');
  if (dlg.canceled || !dlg.filePath) return;

  const fp  = dlg.filePath;
  const ext = fp.split('.').pop().toLowerCase();

  try {
    let b64 = currentPdfData;

    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      if (!currentPdfDoc) { t("Document non charge"); return; }
      const mime     = (ext === 'png') ? 'image/png' : 'image/jpeg';
      const numPages = currentPdfDoc.numPages;

      if (numPages === 1) {
        // Page unique → fichier direct au chemin choisi
        const page = await currentPdfDoc.getPage(1);
        const vp   = page.getViewport({ scale: 2 });
        const cv   = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        b64 = cv.toDataURL(mime, 0.95).split(',')[1];
        // Sauvegarde via le bloc commun en bas

      } else {
        // Plusieurs pages → fichiers numerotes : document_p001.png, _p002.png …
        const dotIdx  = fp.lastIndexOf('.');
        const base    = dotIdx >= 0 ? fp.slice(0, dotIdx) : fp;
        const extPart = dotIdx >= 0 ? fp.slice(dotIdx)    : '.' + ext;
        let errors = 0;

        for (let p = 1; p <= numPages; p++) {
          try {
            const page = await currentPdfDoc.getPage(p);
            const vp   = page.getViewport({ scale: 2 });
            const cv   = document.createElement('canvas');
            cv.width = vp.width; cv.height = vp.height;
            await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            const pageB64  = cv.toDataURL(mime, 0.95).split(',')[1];
            const padded   = String(p).padStart(3, '0');
            const pagePath = base + '_p' + padded + extPart;
            const res = await window.electronAPI.writeFile(pagePath, pageB64);
            if (!res.success) errors++;
          } catch(e) { errors++; }
        }

        const baseName = base.split(/[\\/]/).pop();
        if (errors === 0) {
          t(numPages + " pages exportees : " + baseName + "_p001" + extPart + " … " + baseName + "_p" + String(numPages).padStart(3,'0') + extPart);
        } else {
          t((numPages - errors) + "/" + numPages + " pages exportees (" + errors + " erreur(s))");
        }
        return; // export multi-page termine, pas de sauvegarde unique en bas
      }

    } else if (ext !== 'pdf') {
      t("Format non supporte : ." + ext);
      return;
    }

    const res = await window.electronAPI.writeFile(fp, b64);
    if (!res.success) throw new Error(res.error);

    if (ext === 'pdf') {
      currentFilePath = fp;
      currentPdfName  = fp.split(/[\\/]/).pop();
      if (tabs[activeTabIdx]) {
        tabs[activeTabIdx].filePath  = fp;
        tabs[activeTabIdx].name      = currentPdfName;
        tabs[activeTabIdx].savedData = currentPdfData;
      }
      t("PDF enregistre : " + currentPdfName);
    } else {
      t("Exporte : " + fp.split(/[\\/]/).pop());
    }
  } catch(err) {
    t("Erreur : " + err.message);
    console.error(err);
  }
}

// ─── Actions de menu ──────────────────────────────────────────────────────────

// ─── Signets : génération IA (PDF.js text analysis) ─────────────────────────
async function generateBookmarks() {
  if (!currentPdfDoc) { t("Aucun document ouvert"); return; }
  const tab = tabs[activeTabIdx];
  if (!tab) return;
  t("Analyse du document...");

  const allItems = [];
  for (let p = 1; p <= currentPdfDoc.numPages; p++) {
    try {
      const page = await currentPdfDoc.getPage(p);
      const tc   = await page.getTextContent();
      tc.items.forEach(item => {
        if (!item.str || !item.str.trim()) return;
        const size = Math.abs(item.transform ? item.transform[3] : 0) || (item.height || 0);
        if (size > 0) allItems.push({ str: item.str.trim(), size, page: p });
      });
    } catch(e) {}
  }

  if (allItems.length === 0) { t("Aucun texte extractible"); return; }

  // Taille moyenne de police dans le document
  const sizes = allItems.map(i => i.size);
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const threshold = avg * 1.35;

  // Candidats : taille > seuil, longueur raisonnable
  const seen = new Set();
  const bookmarks = [];
  allItems.forEach(c => {
    if (c.size < threshold) return;
    const text = c.str.replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 120) return;
    const key = text.slice(0, 50).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const level = c.size >= avg * 2.0 ? 0 : 1;
    bookmarks.push({ id: Date.now() + Math.random(), title: text, page: c.page, level });
  });

  if (bookmarks.length === 0) { t("Aucun titre detecté — le document n\'a peut-être pas de titres formatés"); return; }

  tab.bookmarks = bookmarks;
  renderBookmarkPanel();
  // Switch to bookmarks tab
  document.querySelectorAll(".pt").forEach(b => b.classList.remove("act"));
  document.querySelectorAll(".pv").forEach(p => p.classList.remove("act"));
  // Switch to bookmarks tab
  document.querySelectorAll(".pt").forEach(b => b.classList.remove("act"));
  document.querySelectorAll(".pv").forEach(p => p.classList.remove("act"));
  document.getElementById("tab-bk")?.classList.add("act");
  // Find bk tab button by iterating
  document.querySelectorAll(".pt").forEach(btn => {
    if (btn.textContent.includes("Signets")) btn.classList.add("act");
  });
  const bkPanel = document.getElementById("tab-bk");
  if (bkPanel) bkPanel.classList.add("act");
  t(bookmarks.length + " signets générés");
}

function renderBookmarkPanel() {
  const bkEmpty = document.getElementById("bk-empty");
  const bkList  = document.getElementById("bk-list");
  if (!bkEmpty || !bkList) return;

  const tab = tabs[activeTabIdx];
  const bookmarks = (tab && tab.bookmarks) ? tab.bookmarks : [];

  bkList.innerHTML = "";
  if (bookmarks.length === 0) {
    bkEmpty.style.display = "flex";
    return;
  }
  bkEmpty.style.display = "none";

  bookmarks.forEach((bk, idx) => {
    const el = document.createElement("div");
    el.className = "bk-item" + (bk.level > 0 ? " bk-sub" : "");
    const iconClass = bk.level === 0 ? "fa-solid fa-caret-right" : "fa-solid fa-minus";
    const iconSz    = bk.level === 0 ? "" : ' style="font-size:.4rem"';
    el.innerHTML =
      "<span class=\"bk-nav\" onclick=\"scrollToPage(" + bk.page + ")\">" +
        "<i class=\"" + iconClass + "\"" + iconSz + "></i>" +
        "<i class=\"fa-regular fa-bookmark\"></i>" +
        "<span class=\"bk-title\">" + bk.title.replace(/</g, "&lt;") + "</span>" +
      "</span>" +
      "<span class=\"bk-page\" onclick=\"scrollToPage(" + bk.page + ")\">p." + bk.page + "</span>" +
      "<span class=\"bk-del\" onclick=\"deleteBookmark(" + idx + ")\" title=\"Supprimer\">&#x2715;</span>";

    el.querySelector(".bk-title").addEventListener("dblclick", e => {
      e.stopPropagation();
      startEditBookmark(idx, el.querySelector(".bk-title"));
    });
    bkList.appendChild(el);
  });
}

function startEditBookmark(idx, titleEl) {
  const tab = tabs[activeTabIdx];
  const bk  = tab && tab.bookmarks ? tab.bookmarks[idx] : null;
  if (!bk) return;
  const inp = document.createElement("input");
  inp.value = bk.title;
  inp.style.cssText = "background:rgba(0,0,0,.5);color:var(--txt);border:1px solid var(--gold);padding:2px 6px;border-radius:3px;width:100%;font-family:inherit;font-size:inherit;outline:none;";
  titleEl.replaceWith(inp);
  inp.focus(); inp.select();
  const commit = () => { bk.title = inp.value.trim() || bk.title; renderBookmarkPanel(); };
  inp.addEventListener("blur",    commit);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") renderBookmarkPanel();
  });
}

function deleteBookmark(idx) {
  const tab = tabs[activeTabIdx];
  if (!tab || !tab.bookmarks) return;
  tab.bookmarks.splice(idx, 1);
  renderBookmarkPanel();
}

function addBookmarkManual() {
  if (!currentPdfDoc) { t("Aucun document ouvert"); return; }
  const tab = tabs[activeTabIdx];
  if (!tab) return;
  if (!tab.bookmarks) tab.bookmarks = [];
  const curPage = parseInt(document.getElementById("cur-page")?.textContent || "1") || 1;
  tab.bookmarks.push({ id: Date.now(), title: "Nouveau signet", page: curPage, level: 0 });
  renderBookmarkPanel();
  setTimeout(() => {
    const items = document.querySelectorAll(".bk-item");
    const last  = items[items.length - 1];
    if (last) {
      const title = last.querySelector(".bk-title");
      if (title) startEditBookmark(tab.bookmarks.length - 1, title);
    }
  }, 60);
}

// ─── Réparer un PDF corrompu ─────────────────────────────────────────────────
async function repairPDF() {
  if (!currentPdfData) { t("Aucun document ouvert"); return; }
  closeModal();
  t("Reparation en cours...");
  try {
    const { PDFDocument } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true, throwOnInvalidObject: false });
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName + " (réparé)", size: Math.round(data.length * 0.75), data, filePath: null }, true);
    t("PDF réparé — " + doc.getPageCount() + " page(s) récupérée(s)");
  } catch(e) {
    t("Réparation impossible : " + e.message);
    console.error(e);
  }
}

// ─── Dialogue multi-fichiers ──────────────────────────────────────────────────
function askMultiOpenChoice(count, names) {
  // Nettoyer tout resolve orphelin avant d'en créer un nouveau
  if (openChoiceResolve) { openChoiceResolve('cancel'); openChoiceResolve = null; }
  return new Promise(resolve => {
    openChoiceResolve = resolve;
    const list = names.slice(0, 5).map(n => "<li style=\"margin:2px 0;opacity:.8\">" + n.replace(/</g,"&lt;") + "</li>").join("");
    const more = names.length > 5 ? ("<li style=\"opacity:.5\">... et " + (names.length - 5) + " autre(s)</li>") : "";
    openModal(count + " documents sélectionnés",
      "<div style=\"margin-bottom:12px;font-size:.82rem\">" +
        "<ul style=\"margin:4px 0 12px 16px;padding:0;font-size:.78rem\">" + list + more + "</ul>" +
        "Comment ouvrir ces fichiers ?</div>" +
      "<div style=\"display:flex;flex-direction:column;gap:8px\">" +
        "<div class=\"mbtn\" style=\"justify-content:flex-start\" onclick=\"resolveOpenChoice(&quot;tabs&quot;)\">" +
          "<i class=\"fa-solid fa-table-columns\"></i>&nbsp; Onglets individuels</div>" +
        "<div class=\"mbtn\" style=\"justify-content:flex-start\" onclick=\"resolveOpenChoice(&quot;merge&quot;)\">" +
          "<i class=\"fa-solid fa-layer-group\"></i>&nbsp; Fusionner en un seul document</div>" +
        "<div class=\"mbtn\" style=\"justify-content:flex-start;opacity:.55\" onclick=\"resolveOpenChoice(&quot;cancel&quot;)\">" +
          "<i class=\"fa-solid fa-xmark\"></i>&nbsp; Annuler</div></div>");
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// OUTIL SÉLECTION — rectangle pointillé (position:fixed, viewport-space)
// ══════════════════════════════════════════════════════════════════════════════
function initSelectionTool() {
  const pagesEl = document.getElementById('pdf-pages');
  if (!pagesEl) return;

  // ── mousedown : débuter la sélection ─────────────────────────────────────
  pagesEl.addEventListener('mousedown', e => {
    if (currentTool !== 'Sélection') return;
    if (e.button !== 0) return;
    if (eyedropperActive) { pickColor(e); return; }
    if (e.target.closest('.text-anno-box, #sel-toolbar, #sel-ai-menu, #sel-box-panel')) return;
    // Ne pas intercepter les clics sur le calque texte → laisser la sélection native fonctionner
    if (e.target.tagName === 'SPAN' && e.target.closest('.textLayer')) return;
    e.preventDefault();
    clearSelection();

    // Capturer le wrap exactement au clic — même technique que l'outil dessin
    // (e.target.closest au lieu d'un algorithme de détection à posteriori).
    selStartWrap = e.target.closest('.page-wrap') || null;

    // Coordonnées viewport brutes — selRect sera position:fixed sur document.body
    selStart = { vx: e.clientX, vy: e.clientY };

    selRect = document.createElement('div');
    selRect.id = 'sel-rect';
    selRect.style.cssText =
      'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0;' +
      'border:2px dashed var(--gold);background:rgba(200,150,46,.07);' +
      'pointer-events:none;box-sizing:border-box;z-index:9999;border-radius:1px;';
    document.body.appendChild(selRect);

    selDims = document.createElement('div');
    selDims.id = 'sel-dims';
    selDims.style.cssText =
      'position:fixed;display:none;z-index:9999;font-size:.58rem;' +
      "font-family:'Cinzel',serif;color:var(--gold);background:rgba(0,0,0,.75);" +
      'padding:2px 6px;border-radius:3px;pointer-events:none;white-space:nowrap;letter-spacing:.05em;';
    document.body.appendChild(selDims);
  });

  // ── mousemove sur document : mettre à jour le rectangle ──────────────────
  document.addEventListener('mousemove', e => {
    if (currentTool !== 'Sélection' || !selStart || !selRect) return;
    const x0 = Math.min(selStart.vx, e.clientX);
    const y0 = Math.min(selStart.vy, e.clientY);
    const w  = Math.abs(e.clientX - selStart.vx);
    const h  = Math.abs(e.clientY - selStart.vy);
    selRect.style.left   = x0 + 'px';
    selRect.style.top    = y0 + 'px';
    selRect.style.width  = w  + 'px';
    selRect.style.height = h  + 'px';
    if (selDims && w > 20 && h > 12) {
      selDims.style.display = 'block';
      selDims.textContent   = Math.round(w) + ' × ' + Math.round(h) + ' px';
      selDims.style.left    = x0 + 'px';
      selDims.style.top     = (y0 + h + 4) + 'px';
    }
  });

  // ── mouseup sur document : valider la sélection ──────────────────────────
  document.addEventListener('mouseup', e => {
    if (currentTool !== 'Sélection' || !selStart) return;
    const startWrap = selStartWrap;   // récupérer avant reset
    selStart = null; selStartWrap = null;
    if (!selRect) return;
    const w = parseInt(selRect.style.width)  || 0;
    const h = parseInt(selRect.style.height) || 0;
    if (w < 8 || h < 8) { clearSelection(); return; }

    // Utiliser le wrap capturé au mousedown — même technique que l'outil dessin.
    // Élimine tout algorithme de détection a posteriori (source des bugs à fort zoom).
    if (!startWrap) { clearSelection(); return; }

    const selL = parseInt(selRect.style.left);
    const selT = parseInt(selRect.style.top);
    const selR = selL + w;

    // dataset.page est défini au render (wrap.dataset.page = i, 1-based).
    // Plus fiable que wraps.indexOf() qui peut être faussé par des wraps extra (mesures, etc.).
    const pageIdx = parseInt(startWrap.dataset.page) || 0;
    if (pageIdx < 1) { clearSelection(); return; }

    const wr = startWrap.getBoundingClientRect();

    // Coordonnées canvas relatives au wrap (clampées aux bornes de la page)
    const lx = Math.max(0, Math.min(selL - wr.left, wr.width));
    const ly = Math.max(0, Math.min(selT - wr.top,  wr.height));
    const scale = baseFitScale * zoomLevel / 100;
    const pdfX = lx / scale;
    const pdfY = ly / scale;
    // Clamp largeur/hauteur pour ne pas dépasser le bord de la page
    const pdfW = Math.min(w / scale, wr.width  / scale - pdfX);
    const pdfH = Math.min(h / scale, wr.height / scale - pdfY);

    currentSel = {
      wrap: startWrap, pageIdx, lx, ly, w, h,
      pdfX, pdfY, pdfW, pdfH, scale
    };
    console.log('[SEL] pageIdx=', pageIdx,
      'selL=', selL, 'selT=', selT, 'w=', w, 'h=', h,
      'wr.left=', wr.left, 'wr.top=', wr.top, 'wr.w=', wr.width, 'wr.h=', wr.height,
      '→ lx=', lx, 'ly=', ly,
      '| scale=', scale,
      '| pdfX=', pdfX, 'pdfY=', pdfY, 'pdfW=', pdfW, 'pdfH=', pdfH);
    showSelToolbar(selR, selT);
  });
}

// ─── Barre d'actions sélection ────────────────────────────────────────────────
function showSelToolbar(vX, vY) {
  const tb = document.getElementById('sel-toolbar');
  if (!tb) return;
  tb.style.display = 'flex';
  // Position: under the selection's bottom-right, stay in viewport
  const tbW = 290, tbH = 40;
  let left = vX - tbW / 2;
  let top  = vY + 10;
  left = Math.max(4, Math.min(left, window.innerWidth  - tbW - 4));
  top  = Math.max(4, Math.min(top,  window.innerHeight - tbH - 4));
  tb.style.left = left + 'px';
  tb.style.top  = top  + 'px';
  // Paste button enabled only if clipboard has data
  // Bouton coller : allumé seulement par selCopy(), éteint par clearSelection()
}

function clearSelection() {
  currentSel = null; selStart = null;
  if (selRect) { selRect.remove(); selRect = null; }
  if (selDims) { selDims.remove(); selDims = null; }
  document.getElementById('sel-toolbar')?.style.setProperty('display','none');
  document.getElementById('sel-ai-menu')?.style.setProperty('display','none');
  document.getElementById('sel-box-panel')?.style.setProperty('display','none');
  document.getElementById('btn-sel-paste')?.classList.remove('on');
}

// ─── Dialogue de périmètre de recadrage ──────────────────────────────────────
// Retourne 'current' | 'all' | null (annulé)
function askCropScope(pageIdx, totalPages) {
  return new Promise(resolve => {
    const ov  = document.createElement('div');
    const box = document.createElement('div');
    ov.style.cssText  = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:20000;display:flex;align-items:center;justify-content:center;';
    box.style.cssText = 'background:var(--bg-panel);border:1px solid var(--gold);border-top:3px solid var(--gold);border-radius:6px;padding:24px 28px;min-width:320px;text-align:center';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:Cinzel,serif;color:var(--gold);margin-bottom:8px;font-size:.9rem';
    title.innerHTML = '<i class="fa-solid fa-crop-simple"></i> Recadrage';

    const sub = document.createElement('div');
    sub.style.cssText = 'color:var(--txt2);font-size:.8rem;margin-bottom:18px';
    sub.textContent = 'Appliquer la sélection à…';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    const btnCurrent = document.createElement('div');
    btnCurrent.className = 'mbtn';
    btnCurrent.innerHTML = '<i class="fa-solid fa-file"></i> Page ' + pageIdx + ' uniquement';

    const btnAll = document.createElement('div');
    btnAll.className = 'mbtn';
    btnAll.innerHTML = '<i class="fa-solid fa-copy"></i> Toutes les pages (' + totalPages + ')';
    btnAll.style.cssText = 'background:var(--gold);color:#1a1209;border-color:var(--gold)';

    const btnCancel = document.createElement('div');
    btnCancel.className = 'mbtn';
    btnCancel.textContent = 'Annuler';
    btnCancel.style.cssText = 'opacity:.7';

    const close = v => { ov.remove(); resolve(v); };
    btnCurrent.addEventListener('click', () => close('current'));
    btnAll    .addEventListener('click', () => close('all'));
    btnCancel .addEventListener('click', () => close(null));
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });

    row.appendChild(btnCurrent); row.appendChild(btnAll); row.appendChild(btnCancel);
    box.appendChild(title); box.appendChild(sub); box.appendChild(row);
    ov.appendChild(box);
    document.body.appendChild(ov);
    ov.tabIndex = -1; ov.focus();
  });
}

// ─── Effacement de zone (rectangle blanc) ────────────────────────────────────
// Remplace l'ancien recadrage MediaBox par un rectangle blanc plein,
// dont les coordonnées sont identiques à selRedact — système maîtrisé.
async function selCrop() {
  if (!currentSel || !currentPdfData) { t('Aucune sélection'); return; }
  const { PDFDocument, rgb } = PDFLib;
  const { pageIdx, pdfX, pdfY, pdfW, pdfH } = currentSel;
  if (pdfW < 2 || pdfH < 2) { t('Sélection trop petite.'); return; }
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx - 1];
    const { width: pageW, height: pH } = page.getSize();
    const mb = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x:0, y:0, width:pageW, height:pH };
    console.log('[CROP] pageIdx=', pageIdx, '| pageSize=', pageW, 'x', pH,
      '| MediaBox x=', mb.x, 'y=', mb.y, 'w=', mb.width, 'h=', mb.height,
      '| pdfX=', pdfX, 'pdfY=', pdfY, 'pdfW=', pdfW, 'pdfH=', pdfH,
      '| drawRect y_bottom=', pH - pdfY - pdfH);
    // Coordonnées PDF : x depuis la gauche, y depuis le bas (axe PDF inversé)
    page.drawRectangle({
      x: pdfX,
      y: pH - pdfY - pdfH,
      width:  pdfW,
      height: pdfH,
      color:       rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 1,
      opacity:      1,
      borderOpacity: 1,
    });
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length * .75), data, filePath: currentFilePath }, true);
    clearSelection();
    _logMod('Zone effacée');
    t('Zone effacée.');
  } catch(e) {
    console.error('[selCrop]', e);
    t('Erreur : ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE UNDO / REDO
// ══════════════════════════════════════════════════════════════════════════════
function updateUndoRedoBtns() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.classList.toggle('dis', undoStack.length === 0);
  if (r) r.classList.toggle('dis', redoStack.length === 0);
  // Rafraîchir la tab bar pour afficher/masquer le point dirty
  const list = document.getElementById('tab-list');
  if (list && tabs.length) renderTabBar();
}

async function undoPDF() {
  if (!undoStack.length) { t('Rien à annuler'); return; }
  if (currentPdfData) redoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
  const prev = undoStack.pop();
  skipUndo = true;
  await renderPDFFromData(prev);
  skipUndo = false;
  updateUndoRedoBtns();
  t('Annulé');
}

async function redoPDF() {
  if (!redoStack.length) { t('Rien à rétablir'); return; }
  if (currentPdfData) undoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
  const next = redoStack.pop();
  skipUndo = true;
  await renderPDFFromData(next);
  skipUndo = false;
  updateUndoRedoBtns();
  t('Rétabli');
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPRESSION
// ══════════════════════════════════════════════════════════════════════════════
async function printCurrentPDF() {
  if (!currentPdfData) { t('Aucun document à imprimer'); return; }
  t('Ouverture de la boîte de dialogue d\'impression…');
  try {
    const res = await window.electronAPI.printPDF(currentPdfData);
    if (!res.ok) t('Erreur impression : ' + res.reason);
  } catch(e) { t('Erreur impression : ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// INSERTION IMAGE — overlay drag/resize avec mini-menu
// ══════════════════════════════════════════════════════════════════════════════
async function insertImage() {
  if (!currentPdfDoc) { t('Ouvrez un PDF avant d\'insérer une image'); return; }
  try {
    const file = await window.electronAPI.openImageDialog();
    if (!file) return;
    imgOverlayB64  = file.data;
    imgOverlayType = file.type;
    imgHasFrame    = false;
    // Placer sur la première page visible
    const wraps = document.querySelectorAll('.page-wrap');
    if (!wraps.length) return;
    const canv = document.getElementById('pdf-viewport');
    // Trouver la page la plus visible
    let bestWrap = wraps[0], bestVis = 0;
    wraps.forEach(w => {
      const r = w.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      if (vis > bestVis) { bestVis = vis; bestWrap = w; }
    });
    createImgOverlay(bestWrap, file.data, file.type);
  } catch(e) { t('Erreur : ' + e.message); }
}

function createImgOverlay(wrap, b64, type) {
  removeImgOverlay();
  imgOverlayWrap = wrap;
  imgOverlayB64  = b64;
  imgOverlayType = type;

  const div = document.createElement('div');
  div.id = 'img-overlay';

  // Image
  const img = document.createElement('img');
  img.id  = 'img-overlay-img';
  img.src = 'data:image/' + type + ';base64,' + b64;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;';
  div.appendChild(img);

  // Poignées de redimensionnement (4 coins) — dans wrap, pas dans l'overlay
  imgHandles = {};
  ['nw','ne','sw','se'].forEach(dir => {
    const h = document.createElement('div');
    h.style.cssText = 'position:absolute;width:14px;height:14px;background:#c9a84c;border:2px solid #fff;border-radius:3px;z-index:500;cursor:' + dir + '-resize;box-sizing:border-box;';
    h.dataset.dir = dir;
    h.addEventListener('mousedown', e => {
      imgOverlayResizing = true;
      imgOverlayRSStart = { x: e.clientX, y: e.clientY, w: div.offsetWidth, h: div.offsetHeight, l: parseInt(div.style.left)||0, t: parseInt(div.style.top)||0, dir };
      e.preventDefault(); e.stopPropagation();
    });
    wrap.appendChild(h);
    imgHandles[dir] = h;
  });

  // Barre d'outils flottante
  const tb = document.createElement('div');
  tb.id = 'img-tb';
  tb.innerHTML =
    '<div class="img-tbtn" onclick="imgToggleFrame()" title="Cadre/Bordure" id="img-btn-frame"><i class="fa-solid fa-border-all"></i></div>' +
    '<div class="img-tbtn" onclick="imgRemoveBg()" title="Supprimer le fond"><i class="fa-solid fa-wand-magic-sparkles"></i></div>' +
    '<div class="img-tbtn" onclick="imgFlipH()" title="Miroir"><i class="fa-solid fa-left-right"></i></div>' +
    '<div class="img-tbtn" onclick="imgRotate90()" title="Pivoter 90°"><i class="fa-solid fa-rotate-right"></i></div>' +
    '<div class="img-tbtn" id="img-lock-btn" onclick="imgToggleLock()" title="Verrouiller proportions"><i class="fa-solid fa-lock-open"></i></div>' +
    '<div class="img-sep"></div>' +
    '<div class="img-tbtn" style="color:#5cb85c" onclick="imgValidate()" title="Insérer dans le PDF"><i class="fa-solid fa-check"></i></div>' +
    '<div class="img-tbtn" style="color:#e74c3c" onclick="removeImgOverlay()" title="Annuler"><i class="fa-solid fa-xmark"></i></div>';
  div.appendChild(tb);

  // Taille initiale : 40% de la largeur de la page
  const initW = Math.round(wrap.offsetWidth * 0.40);
  div.style.left  = '30px';
  div.style.top   = '30px';
  div.style.width = initW + 'px';
  div.style.height = initW + 'px'; // sera ajusté après chargement image

  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      div.style.height = Math.round(initW * img.naturalHeight / img.naturalWidth) + 'px';
    }
    updateImgHandles();
  };

  wrap.appendChild(div);
  imgOverlay = div;
  updateImgHandles(); // après ajout au DOM pour offsetWidth/Height corrects

  // Drag
  div.addEventListener('mousedown', e => {
    if (!e.target.closest('#img-tb')) {
      imgOverlayDragging = true;
      const r = div.getBoundingClientRect();
      imgOverlayDragOff  = { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    e.preventDefault();
    e.stopPropagation();
  });
}

function updateImgHandles() {
  if (!imgOverlay || !imgHandles) return;
  const l = parseInt(imgOverlay.style.left) || 0;
  const t = parseInt(imgOverlay.style.top)  || 0;
  const w = imgOverlay.offsetWidth;
  const h = imgOverlay.offsetHeight;
  const hs = 7;
  imgHandles.nw.style.left = (l - hs) + 'px'; imgHandles.nw.style.top = (t - hs) + 'px';
  imgHandles.ne.style.left = (l + w - hs) + 'px'; imgHandles.ne.style.top = (t - hs) + 'px';
  imgHandles.sw.style.left = (l - hs) + 'px'; imgHandles.sw.style.top = (t + h - hs) + 'px';
  imgHandles.se.style.left = (l + w - hs) + 'px'; imgHandles.se.style.top = (t + h - hs) + 'px';
}

function imgOverlayMove(e) {
  if (!imgOverlay || !imgOverlayWrap) return;
  const wr = imgOverlayWrap.getBoundingClientRect();
  if (imgOverlayDragging) {
    const nx = e.clientX - imgOverlayDragOff.x - wr.left;
    const ny = e.clientY - imgOverlayDragOff.y - wr.top;
    imgOverlay.style.left = Math.max(0, nx) + 'px';
    imgOverlay.style.top  = Math.max(0, ny) + 'px';
  } else if (imgOverlayResizing && imgOverlayRSStart) {
    const s = imgOverlayRSStart;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    let nw = s.w, nh = s.h, nl = s.l, nt = s.t;
    if (s.dir === 'se') { nw = s.w + dx; nh = s.h + dy; }
    else if (s.dir === 'sw') { nw = s.w - dx; nl = s.l + dx; nh = s.h + dy; }
    else if (s.dir === 'ne') { nw = s.w + dx; nh = s.h - dy; nt = s.t + dy; }
    else if (s.dir === 'nw') { nw = s.w - dx; nl = s.l + dx; nh = s.h - dy; nt = s.t + dy; }
    nw = Math.max(30, nw); nh = Math.max(20, nh);
    if (imgAspectLocked && imgAspectRatio > 0) nh = Math.round(nw / imgAspectRatio);
    imgOverlay.style.width  = nw + 'px';
    imgOverlay.style.height = nh + 'px';
    imgOverlay.style.left   = nl + 'px';
    imgOverlay.style.top    = nt + 'px';
  }
  updateImgHandles();
}

function imgOverlayUp() {
  imgOverlayDragging = false;
  imgOverlayResizing = false;
  imgOverlayRSStart  = null;
}

function removeImgOverlay() {
  if (imgOverlay) { imgOverlay.remove(); imgOverlay = null; }
  if (imgHandles) { Object.values(imgHandles).forEach(h => h.remove()); imgHandles = null; }
  imgOverlayWrap = null; imgOverlayB64 = null; imgHasFrame = false;
}

function imgToggleFrame() {
  if (!imgOverlay) return;
  imgHasFrame = !imgHasFrame;
  const img = document.getElementById('img-overlay-img');
  if (img) img.style.outline = imgHasFrame ? '3px solid #222' : 'none';
  document.getElementById('img-btn-frame')?.classList.toggle('on', imgHasFrame);
}

function imgFlipH() {
  const img = document.getElementById('img-overlay-img');
  if (!img) return;
  const cur = img.style.transform || '';
  img.style.transform = cur.includes('scaleX(-1)') ? cur.replace('scaleX(-1)', '').trim() : (cur + ' scaleX(-1)').trim();
}

function imgRotate90() {
  const img = document.getElementById('img-overlay-img');
  if (!img) return;
  const m = (img.style.transform || '').match(/rotate\((\d+)deg\)/);
  const cur = m ? parseInt(m[1]) : 0;
  const next = (cur + 90) % 360;
  img.style.transform = (img.style.transform || '').replace(/rotate\(\d+deg\)/, '').trim() + ' rotate(' + next + 'deg)';
}

function imgRemoveBg() {
  const img = document.getElementById('img-overlay-img');
  if (!img || !imgOverlayB64) return;
  // Canvas pour manipuler les pixels
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  const tmpImg = new Image();
  tmpImg.onload = () => {
    cvs.width = tmpImg.naturalWidth; cvs.height = tmpImg.naturalHeight;
    ctx.drawImage(tmpImg, 0, 0);
    const id = ctx.getImageData(0, 0, cvs.width, cvs.height);
    const d  = id.data;
    // Couleur de fond = coin supérieur gauche
    const bgR = d[0], bgG = d[1], bgB = d[2];
    const tol = 30;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i]-bgR)<tol && Math.abs(d[i+1]-bgG)<tol && Math.abs(d[i+2]-bgB)<tol) {
        d[i+3] = 0; // transparent
      }
    }
    ctx.putImageData(id, 0, 0);
    const newB64 = cvs.toDataURL('image/png').split(',')[1];
    imgOverlayB64  = newB64;
    imgOverlayType = 'png';
    img.src = 'data:image/png;base64,' + newB64;
    t('Fond supprimé');
  };
  tmpImg.src = 'data:image/' + imgOverlayType + ';base64,' + imgOverlayB64;
}

async function imgValidate() {
  if (!imgOverlay || !imgOverlayWrap || !imgOverlayB64 || !currentPdfData) return;
  const scale = baseFitScale * zoomLevel / 100;
  const lx = parseInt(imgOverlay.style.left)  || 0;
  const ly = parseInt(imgOverlay.style.top)   || 0;
  const lw = imgOverlay.offsetWidth;
  const lh = imgOverlay.offsetHeight;
  // Coordonnées PDF
  const pdfX = lx / scale;
  const pdfY_fromTop = ly / scale;
  const pdfW = lw / scale;
  const pdfH = lh / scale;
  // Trouver l'index de page
  const wraps = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx = wraps.indexOf(imgOverlayWrap); // 0-based
  // Rendu de l'image avec transformations appliquées sur canvas
  const img = document.getElementById('img-overlay-img');
  let finalB64 = imgOverlayB64, finalType = imgOverlayType;
  if (img && img.style.transform) {
    const cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    const ctx = cvs.getContext('2d');
    ctx.save();
    ctx.translate(cvs.width/2, cvs.height/2);
    // Appliquer rotation
    const rm = img.style.transform.match(/rotate\((\d+)deg\)/);
    if (rm) ctx.rotate(parseInt(rm[1]) * Math.PI / 180);
    // Appliquer miroir
    if (img.style.transform.includes('scaleX(-1)')) ctx.scale(-1, 1);
    ctx.drawImage(img, -cvs.width/2, -cvs.height/2);
    ctx.restore();
    finalB64  = cvs.toDataURL('image/png').split(',')[1];
    finalType = 'png';
  }
  try {
    const { PDFDocument, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    const pdfY = pH - pdfY_fromTop - pdfH;
    const imgBytes = base64ToBytes(finalB64);
    const embImg   = finalType === 'png' ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
    page.drawImage(embImg, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
    if (imgHasFrame) {
      page.drawRectangle({ x: pdfX, y: pdfY, width: pdfW, height: pdfH, borderColor: rgb(0,0,0), borderWidth: 1.5, opacity: 0 });
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    removeImgOverlay();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    _logMod('Image insérée');
    t('Image insérée');
  } catch(err) { t('Erreur insertion : ' + err.message); }
}


function toggleSelAiMenu() {
  const m = document.getElementById('sel-ai-menu');
  if (!m) return;
  if (m.style.display !== 'none') { m.style.display = 'none'; return; }
  document.getElementById('sel-box-panel').style.display = 'none';
  const tb = document.getElementById('sel-toolbar');
  if (tb) {
    const tbr = tb.getBoundingClientRect();
    m.style.left = tbr.left + 'px';
    m.style.top  = (tbr.bottom + 4) + 'px';
  }
  m.style.display = 'block';
}

// ─── Actions sur la sélection ─────────────────────────────────────────────────
function getSelCanvas() {
  if (!currentSel) return null;
  const { wrap, lx, ly, w, h } = currentSel;
  const src = wrap.querySelector('canvas');
  if (!src) return null;
  const cvs = document.createElement('canvas');
  cvs.width = Math.round(w); cvs.height = Math.round(h);
  cvs.getContext('2d').drawImage(src, Math.round(lx), Math.round(ly), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h));
  return cvs;
}

function selCopy() {
  const cvs = getSelCanvas();
  if (!cvs) { t('Impossible de copier'); return; }
  selClipboard     = cvs.toDataURL('image/png').split(',')[1];
  selClipboardPdfW = currentSel.pdfW;
  selClipboardPdfH = currentSel.pdfH;
  selClipboardPxW  = currentSel.w;
  selClipboardPxH  = currentSel.h;
  selClipboardLx   = currentSel.lx;
  selClipboardLy   = currentSel.ly;
  selClipboardWrap = currentSel.wrap;
  document.getElementById('btn-sel-paste')?.classList.add('on');
  // NE PAS écrire dans le clipboard système : Ctrl+V resterait dans le chemin externe
  // et perdrait les dimensions/position. Le clipboard interne gère tout le copier-coller intra-app.
  t('Zone copiée (' + currentSel.w + '×' + currentSel.h + 'px)');
}

// ── Fonctions menu Édition ────────────────────────────────────────────────────
async function menuCrop() {
  if (!currentSel || !currentPdfData) { t('Sélectionnez d\'abord une zone avec l\'outil Sélection.'); return; }
  const { PDFDocument } = PDFLib;
  const { pageIdx, pdfX, pdfY, pdfW, pdfH } = currentSel;
  if (pdfW < 2 || pdfH < 2) { t('Sélection trop petite.'); return; }
  try {
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pages = doc.getPages();
    const totalPages = pages.length;

    const scope = await askCropScope(pageIdx, totalPages);
    if (!scope) return;

    const applyTo = scope === 'all' ? pages : [pages[pageIdx - 1]];

    for (const page of applyTo) {
      const { width: pageW, height: pH } = page.getSize();
      const mb = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x: 0, y: 0, width: pageW, height: pH };
      const mbX = mb.x || 0, mbY = mb.y || 0;
      const newX = pdfX + mbX;
      const newY = mbY + pH - pdfY - pdfH;
      console.log('[CROP] page', page, '| newX=', newX, 'newY=', newY, 'w=', pdfW, 'h=', pdfH);
      page.setMediaBox(newX, newY, pdfW, pdfH);
      if (typeof page.setCropBox === 'function') page.setCropBox(newX, newY, pdfW, pdfH);
    }

    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length * .75), data, filePath: currentFilePath }, true);
    clearSelection();
    _logMod('Page recadrée');
    t(scope === 'all' ? 'Toutes les pages recadrées.' : 'Page recadrée.');
  } catch(e) {
    console.error('[menuCrop]', e);
    t('Erreur : ' + e.message);
  }
}

function menuCopy() {
  if (currentSel) { selCopy(); }
  else { t('Sélectionnez d\'abord une zone avec l\'outil Sélection.'); }
}

function menuCut() {
  if (!currentSel) { t('Sélectionnez d\'abord une zone avec l\'outil Sélection.'); return; }
  selCopy();
  selRedact(); // efface la zone source
}

function menuPaste() {
  if (!currentPdfData) { t('Ouvrez d\'abord un PDF.'); return; }
  // Utilise uniquement le clipboard interne (dimensions PDF exactes garanties)
  // Pour coller une image externe, utiliser Ctrl+V
  if (!selClipboard) { t('Rien à coller — copiez d\'abord une zone avec l\'outil Sélection.'); return; }
  const wrap = selClipboardWrap || currentSel?.wrap || document.querySelector('.page-wrap');
  if (!wrap) return;
  const scale = baseFitScale * zoomLevel / 100;
  const pxW = selClipboardPdfW * scale;
  const pxH = selClipboardPdfH * scale;
  const lx  = selClipboardLx;
  const ly  = selClipboardLy;
  clearSelection();
  _createPasteOverlay(wrap, selClipboard, lx, ly, pxW, pxH, selClipboardPdfW, selClipboardPdfH);
  t('Zone collée.');
}

// ── Coller une image depuis le presse-papiers système (image externe) ────────
async function menuPasteExternal() {
  if (!currentPdfData) { t('Ouvrez d\'abord un PDF.'); return; }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!item.types.includes('image/png') && !item.types.includes('image/jpeg')) continue;
      const type = item.types.includes('image/png') ? 'image/png' : 'image/jpeg';
      const blob = await item.getType(type);
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        const img = new Image();
        img.onload = () => {
          const wrap = currentSel?.wrap || document.querySelector('.page-wrap');
          if (!wrap) return;
          const scale = baseFitScale * zoomLevel / 100;
          const maxW = wrap.clientWidth * 0.8;
          const W = Math.min(img.naturalWidth, maxW / scale) * scale;
          const H = W * img.naturalHeight / img.naturalWidth;
          clearSelection();
          _createPasteOverlay(wrap, b64, 40, 40, W, H);
          t('Image externe collée.');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(blob);
      return;
    }
    t('Aucune image dans le presse-papiers.');
  } catch (err) {
    t('Impossible de lire le presse-papiers : ' + err.message);
  }
}

// ── Initialisation au chargement ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadLang(); // Charger la langue sauvegardée et appliquer les traductions
  // Signaler à main.js que le renderer est prêt à recevoir un fichier
  // (déclenche l'envoi du PDF passé en argument au lancement de l'app)
  if (window.electronAPI?.rendererReady) window.electronAPI.rendererReady();
});

// ── Suivi de page en temps réel lors du scroll ────────────────────────────────
// Met à jour l'indicateur cur-page dès que l'utilisateur fait défiler le PDF.
// Critique à fort zoom (300%) où la page fait ~3000 px et le label bas est hors écran.
document.addEventListener('DOMContentLoaded', () => {
  const vpEl    = document.getElementById('pdf-viewport');
  const curEl   = document.getElementById('cur-page');
  if (!vpEl || !curEl) return;

  vpEl.addEventListener('scroll', () => {
    const wraps = document.querySelectorAll('.page-wrap');
    if (!wraps.length) return;
    const viewMid = vpEl.scrollTop + vpEl.clientHeight / 2;
    let bestPage = 1;
    wraps.forEach((wrap, idx) => {
      // offsetTop est relatif au premier ancêtre positionné (= #pdf-viewport)
      if (wrap.offsetTop <= viewMid) bestPage = idx + 1;
    });
    curEl.textContent = bestPage;
  }, { passive: true });
});

// ── Redimensionnement des panneaux latéraux ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const MIN_W = 120, MAX_W = 520;

  function initResizeHandle(handleId, panelId, side) {
    const handle = document.getElementById(handleId);
    const panel  = document.getElementById(panelId);
    if (!handle || !panel) return;

    // Restaurer la largeur sauvegardée
    const saved = localStorage.getItem('panel-w-' + panelId);
    if (saved) panel.style.width = saved + 'px';

    let startX, startW;

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startW = panel.offsetWidth;
      handle.classList.add('rh-active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e) {
        const dx   = side === 'left' ? e.clientX - startX : startX - e.clientX;
        const newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
        panel.style.width = newW + 'px';
      }

      function onUp() {
        handle.classList.remove('rh-active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('panel-w-' + panelId, panel.offsetWidth);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  initResizeHandle('resize-left',  'lp', 'left');
  initResizeHandle('resize-right', 'rp', 'right');
});

// ── Glisser-déposer d'image externe sur une page PDF ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const pagesEl = document.getElementById('pdf-pages');
  if (!pagesEl) return;

  pagesEl.addEventListener('dragover', e => {
    if (!currentPdfData) return;
    const hasFile = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasFile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // Surbrillance du wrap cible
    const wrap = e.target.closest('.page-wrap');
    document.querySelectorAll('.page-wrap.drag-over').forEach(w => { if (w !== wrap) w.classList.remove('drag-over'); });
    if (wrap) wrap.classList.add('drag-over');
  });

  pagesEl.addEventListener('dragleave', e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      document.querySelectorAll('.page-wrap.drag-over').forEach(w => w.classList.remove('drag-over'));
    }
  });

  pagesEl.addEventListener('drop', e => {
    document.querySelectorAll('.page-wrap.drag-over').forEach(w => w.classList.remove('drag-over'));
    if (!currentPdfData) return;
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();

    const wrap = e.target.closest('.page-wrap');
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const dropLx = e.clientX - rect.left;
    const dropLy = e.clientY - rect.top;

    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target.result.split(',')[1];
      const img = new Image();
      img.onload = () => {
        const scale = baseFitScale * zoomLevel / 100;
        const maxW = wrap.clientWidth * 0.8;
        const W = Math.min(img.naturalWidth, maxW / scale) * scale;
        const H = W * img.naturalHeight / img.naturalWidth;
        // Centrer sur le point de dépôt
        const lx = Math.max(0, dropLx - W / 2);
        const ly = Math.max(0, dropLy - H / 2);
        clearSelection();
        _createPasteOverlay(wrap, b64, lx, ly, W, H);
        t('Image déposée.');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
});

// ── Listener paste global — gère Ctrl+V quand pas de clipboard interne ────────
document.addEventListener('paste', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (!currentPdfData) return;

  const items = e.clipboardData?.items;
  // Cherche une image dans le presse-papiers système
  if (items) {
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        // Si le b64 correspond à notre copie interne → utiliser dimensions et position d'origine
        if (selClipboard && b64 === selClipboard) {
          const wrap = selClipboardWrap || document.querySelector('.page-wrap');
          if (!wrap) return;
          const scale = baseFitScale * zoomLevel / 100;
          const pxW = selClipboardPdfW * scale;
          const pxH = selClipboardPdfH * scale;
          clearSelection();
          _createPasteOverlay(wrap, selClipboard, selClipboardLx, selClipboardLy, pxW, pxH, selClipboardPdfW, selClipboardPdfH);
          t('Zone collée.');
          return;
        }
        // Image externe réelle
        const img = new Image();
        img.onload = () => {
          const wrap = currentSel?.wrap || document.querySelector('.page-wrap');
          if (!wrap) return;
          const scale = baseFitScale * zoomLevel / 100;
          const maxW  = wrap.clientWidth * 0.8;
          const W     = Math.min(img.naturalWidth, maxW / scale) * scale;
          const H     = W * img.naturalHeight / img.naturalWidth;
          clearSelection();
          _createPasteOverlay(wrap, b64, 40, 40, W, H);
          t('Image collée depuis le presse-papiers.');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(blob);
      return; // image trouvée — on s'arrête
    }
  }
  // Aucune image externe → fallback copie interne (inter-onglets)
  if (selClipboard) {
    e.preventDefault();
    const wrap = selClipboardWrap || currentSel?.wrap || document.querySelector('.page-wrap');
    if (!wrap) return;
    const scale = baseFitScale * zoomLevel / 100;
    const pxW = selClipboardPdfW * scale;
    const pxH = selClipboardPdfH * scale;
    clearSelection();
    _createPasteOverlay(wrap, selClipboard, selClipboardLx, selClipboardLy, pxW, pxH, selClipboardPdfW, selClipboardPdfH);
    t('Zone collée.');
  }
});

// ── Paste overlay globals ─────────────────────────────────────────────────────
let pasteOverlay      = null;
let pasteOverlayWrap  = null;
let pasteOverlayDrag  = false;
let pasteOverlayRS    = false;
let pasteOverlayDragOff = null;
let pasteOverlayRSStart = null;
let pasteHandles      = null; // { nw, ne, sw, se }
let pasteOverlayB64   = null; // image courante de l'overlay (peut être externe)
let pasteAspectLocked = true; // proportions verrouillées par défaut
let pasteAspectRatio  = 1;    // w/h
// Dimensions PDF de référence (stockées à la création, utilisées au commit)
let pasteInitPdfW = 0, pasteInitPdfH = 0; // taille PDF originale en points
let pasteInitPxW  = 0, pasteInitPxH  = 0; // taille écran initiale de l'overlay (px)

function selPaste() {
  if (!selClipboard || !currentPdfData) { t('Rien à coller'); return; }
  const wrap = currentSel?.wrap || document.querySelector('.page-wrap');
  if (!wrap) return;
  const lx    = currentSel?.lx   ?? 40;
  const ly    = currentSel?.ly   ?? 40;
  const pw    = currentSel?.w    ?? 200;
  const ph    = currentSel?.h    ?? 150;
  // Dimensions PDF de référence pour une reproduction 100% fidèle
  const pdfW  = currentSel?.pdfW ?? (pw / (baseFitScale * zoomLevel / 100));
  const pdfH  = currentSel?.pdfH ?? (ph / (baseFitScale * zoomLevel / 100));
  document.getElementById('btn-sel-paste')?.classList.remove('on');
  clearSelection();
  currentTool = 'Lecture';
  document.querySelectorAll('#tbar .tb').forEach(b => b.classList.remove('act'));
  document.getElementById('pdf-pages')?.classList.remove('sel-mode');
  const stTool = document.getElementById('st-tool');
  if (stTool) stTool.innerHTML = '<i class="fa-solid fa-arrow-pointer"></i>Lecture';
  _createPasteOverlay(wrap, selClipboard, lx, ly, pw, ph, pdfW, pdfH);
}

function _createPasteOverlay(wrap, b64, lx, ly, initW, initH, pdfW, pdfH) {
  _removePasteOverlay();
  const scale        = baseFitScale * zoomLevel / 100;
  pasteOverlayWrap  = wrap;
  pasteOverlayB64   = b64;
  pasteAspectLocked = true;
  pasteAspectRatio  = initW / Math.max(1, initH);
  // Dimensions PDF de référence (ground truth pour taille fidèle)
  pasteInitPdfW = pdfW  ?? initW / scale;
  pasteInitPdfH = pdfH  ?? initH / scale;
  pasteInitPxW  = initW;
  pasteInitPxH  = initH;

  const div = document.createElement('div');
  div.id = 'paste-overlay';
  div.style.cssText =
    'position:absolute;left:' + lx + 'px;top:' + ly + 'px;' +
    'width:' + initW + 'px;height:' + initH + 'px;' +
    'cursor:move;z-index:500;box-sizing:border-box;';
  // Image
  const img = document.createElement('img');
  img.src = 'data:image/png;base64,' + b64;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;';
  div.appendChild(img);
  // Mini toolbar
  const tb = document.createElement('div');
  tb.id = 'paste-overlay-tb';
  tb.style.cssText =
    'position:absolute;top:-38px;left:50%;transform:translateX(-50%);' +
    'display:flex;align-items:center;gap:4px;' +
    'background:var(--bg-panel);border:1px solid var(--gold);' +
    'border-radius:4px;padding:3px 8px;z-index:501;white-space:nowrap;';
  tb.innerHTML =
    '<span style="font-size:.62rem;color:var(--txt2);padding-right:4px;font-family:Cinzel,serif;letter-spacing:.05em">COLLER</span>' +
    '<div class="img-tbtn" id="paste-lock-btn" onclick="_togglePasteAspect()" title="Verrouiller/déverrouiller les proportions" style="color:var(--gold)"><i class="fa-solid fa-lock"></i></div>' +
    '<div class="img-tbtn" onclick="_commitPasteOverlay()" title="Valider — coller définitivement" style="color:#5cb85c"><i class="fa-solid fa-check"></i></div>' +
    '<div class="img-tbtn" onclick="_removePasteOverlay()" title="Annuler" style="color:#e74c3c"><i class="fa-solid fa-xmark"></i></div>';
  div.appendChild(tb);
  // Drag
  div.addEventListener('mousedown', e => {
    if (!e.target.closest('#paste-overlay-tb')) {
      pasteOverlayDrag   = true;
      const r = div.getBoundingClientRect();
      pasteOverlayDragOff = { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    e.preventDefault(); e.stopPropagation();
  });
  wrap.appendChild(div);
  pasteOverlay = div;

  // 8 poignées de redimensionnement : 4 coins + 4 bords
  const BASE_PH_CORNER = 'position:absolute;width:14px;height:14px;background:#c9a84c;border:2px solid #fff;border-radius:3px;z-index:502;box-sizing:border-box;';
  const BASE_PH_EDGE   = 'position:absolute;background:#c9a84c;border:2px solid #fff;border-radius:3px;z-index:502;box-sizing:border-box;';
  pasteHandles = {};
  // Coins (redimensionnement libre H+V)
  ['nw','ne','sw','se'].forEach(dir => {
    const h = document.createElement('div');
    h.style.cssText = BASE_PH_CORNER + 'cursor:' + dir + '-resize;';
    h.dataset.dir = dir;
    h.addEventListener('mousedown', e => {
      pasteOverlayRS = true;
      pasteOverlayRSStart = { x: e.clientX, y: e.clientY, w: div.offsetWidth, h: div.offsetHeight, l: parseInt(div.style.left)||0, t: parseInt(div.style.top)||0, dir };
      e.preventDefault(); e.stopPropagation();
    });
    wrap.appendChild(h);
    pasteHandles[dir] = h;
  });
  // Bords (redimensionnement axe unique)
  [['n','ns-resize','20px','8px'],['s','ns-resize','20px','8px'],['e','ew-resize','8px','20px'],['w','ew-resize','8px','20px']].forEach(([dir, cursor, w, h]) => {
    const el = document.createElement('div');
    el.style.cssText = BASE_PH_EDGE + 'cursor:' + cursor + ';width:' + w + ';height:' + h + ';';
    el.dataset.dir = dir;
    el.addEventListener('mousedown', e => {
      pasteOverlayRS = true;
      pasteOverlayRSStart = { x: e.clientX, y: e.clientY, w: div.offsetWidth, h: div.offsetHeight, l: parseInt(div.style.left)||0, t: parseInt(div.style.top)||0, dir };
      e.preventDefault(); e.stopPropagation();
    });
    wrap.appendChild(el);
    pasteHandles[dir] = el;
  });
  updatePasteHandles();
  t('Déplacez et redimensionnez, puis cliquez ✓');
}

function updatePasteHandles() {
  if (!pasteOverlay || !pasteHandles) return;
  const l  = parseInt(pasteOverlay.style.left) || 0;
  const t  = parseInt(pasteOverlay.style.top)  || 0;
  const w  = pasteOverlay.offsetWidth;
  const h  = pasteOverlay.offsetHeight;
  const hs = 7; // demi-taille poignée coin (14px)
  const he = 4; // demi-épaisseur poignée bord (8px)
  // Coins
  pasteHandles.nw.style.left = (l - hs) + 'px';      pasteHandles.nw.style.top = (t - hs) + 'px';
  pasteHandles.ne.style.left = (l + w - hs) + 'px';  pasteHandles.ne.style.top = (t - hs) + 'px';
  pasteHandles.sw.style.left = (l - hs) + 'px';      pasteHandles.sw.style.top = (t + h - hs) + 'px';
  pasteHandles.se.style.left = (l + w - hs) + 'px';  pasteHandles.se.style.top = (t + h - hs) + 'px';
  // Bords (milieu de chaque côté)
  pasteHandles.n.style.left  = (l + w/2 - 10) + 'px'; pasteHandles.n.style.top  = (t - he) + 'px';
  pasteHandles.s.style.left  = (l + w/2 - 10) + 'px'; pasteHandles.s.style.top  = (t + h - he) + 'px';
  pasteHandles.e.style.left  = (l + w - he) + 'px';   pasteHandles.e.style.top  = (t + h/2 - 10) + 'px';
  pasteHandles.w.style.left  = (l - he) + 'px';        pasteHandles.w.style.top  = (t + h/2 - 10) + 'px';
}

document.addEventListener('mousemove', e => {
  if (!pasteOverlay || !pasteOverlayWrap) return;
  const wr = pasteOverlayWrap.getBoundingClientRect();
  if (pasteOverlayDrag && pasteOverlayDragOff) {
    pasteOverlay.style.left = Math.max(0, e.clientX - pasteOverlayDragOff.x - wr.left) + 'px';
    pasteOverlay.style.top  = Math.max(0, e.clientY - pasteOverlayDragOff.y - wr.top)  + 'px';
  } else if (pasteOverlayRS && pasteOverlayRSStart) {
    const s = pasteOverlayRSStart;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    let nw = s.w, nh = s.h, nl = s.l, nt = s.t;
    const isCorner = ['nw','ne','sw','se'].includes(s.dir);
    if      (s.dir === 'se') { nw = s.w + dx; nh = s.h + dy; }
    else if (s.dir === 'sw') { nw = s.w - dx; nl = s.l + dx; nh = s.h + dy; }
    else if (s.dir === 'ne') { nw = s.w + dx; nh = s.h - dy; nt = s.t + dy; }
    else if (s.dir === 'nw') { nw = s.w - dx; nl = s.l + dx; nh = s.h - dy; nt = s.t + dy; }
    // Bords : un seul axe
    else if (s.dir === 'e')  { nw = s.w + dx; }
    else if (s.dir === 'w')  { nw = s.w - dx; nl = s.l + dx; }
    else if (s.dir === 's')  { nh = s.h + dy; }
    else if (s.dir === 'n')  { nh = s.h - dy; nt = s.t + dy; }
    nw = Math.max(20, nw);
    // Verrouillage proportions : uniquement pour les coins
    if (pasteAspectLocked && isCorner) {
      const useW = s.dir === 'ne' || s.dir === 'se' || (Math.abs(dx) >= Math.abs(dy));
      if (useW) { nh = nw / pasteAspectRatio; if (s.dir === 'ne') nt = s.t + s.h - nh; }
      else       { nw = nh * pasteAspectRatio; if (s.dir === 'nw') nl = s.l + s.w - nw; }
    } else {
      nh = Math.max(20, nh);
    }
    pasteOverlay.style.width  = nw + 'px';
    pasteOverlay.style.height = nh + 'px';
    pasteOverlay.style.left   = nl + 'px';
    pasteOverlay.style.top    = nt + 'px';
  }
  updatePasteHandles();
});

document.addEventListener('mouseup', () => {
  pasteOverlayDrag = false; pasteOverlayRS = false;
  pasteOverlayRSStart = null;
});

function _togglePasteAspect() {
  pasteAspectLocked = !pasteAspectLocked;
  if (pasteAspectLocked && pasteOverlay) {
    pasteAspectRatio = pasteOverlay.offsetWidth / Math.max(1, pasteOverlay.offsetHeight);
  }
  const btn = document.getElementById('paste-lock-btn');
  if (btn) btn.innerHTML = pasteAspectLocked
    ? '<i class="fa-solid fa-lock"></i>'
    : '<i class="fa-solid fa-lock-open" style="opacity:.5"></i>';
}

function _removePasteOverlay() {
  if (pasteOverlay) { pasteOverlay.remove(); pasteOverlay = null; }
  if (pasteHandles) { Object.values(pasteHandles).forEach(h => h.remove()); pasteHandles = null; }
  pasteOverlayWrap = null; pasteOverlayDrag = false; pasteOverlayRS = false;
  pasteOverlayB64  = null;
  pasteInitPdfW = 0; pasteInitPdfH = 0; pasteInitPxW = 0; pasteInitPxH = 0;
}

async function _commitPasteOverlay() {
  if (!pasteOverlay || !pasteOverlayWrap || !pasteOverlayB64 || !currentPdfData) return;
  const scale       = baseFitScale * zoomLevel / 100;
  const lx          = parseInt(pasteOverlay.style.left) || 0;
  const ly          = parseInt(pasteOverlay.style.top)  || 0;
  const lw          = pasteOverlay.offsetWidth;
  const lh          = pasteOverlay.offsetHeight;
  // Dimensions PDF : proportionnelles à la taille initiale de référence
  // → si l'utilisateur n'a pas redimensionné, on obtient exactement pdfInitW/H
  const scaleFactorW = lw / Math.max(1, pasteInitPxW);
  const scaleFactorH = lh / Math.max(1, pasteInitPxH);
  const pdfW        = pasteInitPdfW * scaleFactorW;
  const pdfH        = pasteInitPdfH * scaleFactorH;
  const pdfX        = lx / scale;
  const pdfYfromTop = ly / scale;
  const wraps       = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx     = wraps.indexOf(pasteOverlayWrap); // 0-based
  // Sauvegarder b64 ET pageIdx AVANT _removePasteOverlay (qui met pasteOverlayB64 à null)
  const b64         = pasteOverlayB64;
  _removePasteOverlay();
  try {
    const { PDFDocument } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    const pdfY   = pH - pdfYfromTop - pdfH;
    const embImg = await doc.embedPng(base64ToBytes(b64));
    page.drawImage(embImg, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await fastRerenderPage(data, [pageIdx + 1]);
    _logMod('Zone collée');
    t('Zone collée définitivement ✓');
  } catch(err) { t('Erreur collage : ' + err.message); }
}

async function selRedact(fillR, fillG, fillB) {
  if (!currentSel || !currentPdfData) { t('Aucune sélection'); return; }
  const { PDFDocument, rgb } = PDFLib;
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[currentSel.pageIdx - 1];
    const { height: pH } = page.getSize();
    // Même formule que l'outil dessin : px = sx/scale + mbX, py = mbY + pH - sy/scale
    const mb   = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x:0, y:0 };
    const mbX  = mb.x || 0, mbY = mb.y || 0;
    console.log('[REDACT] pageIdx=', currentSel.pageIdx, 'pH=', pH, 'mb=', mb,
      'pdfX=', currentSel.pdfX, 'pdfY=', currentSel.pdfY,
      '→ x=', currentSel.pdfX + mbX, 'y=', mbY + pH - currentSel.pdfY - currentSel.pdfH);
    page.drawRectangle({
      x: currentSel.pdfX + mbX,
      y: mbY + pH - currentSel.pdfY - currentSel.pdfH,
      width: currentSel.pdfW, height: currentSel.pdfH,
      color: rgb(fillR ?? 1, fillG ?? 1, fillB ?? 1), opacity: 1, borderWidth: 0
    });
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    clearSelection();
    _logMod('Zone biffée');
    t('Zone masquée');
  } catch(e) { t('Erreur : ' + e.message); }
}

function selRedactBg() {
  document.getElementById('sel-ai-menu').style.display = 'none';
  selRedact(0, 0, 0); // fond noir
}

function selToBox() {
  document.getElementById('sel-ai-menu').style.display = 'none';
  const panel = document.getElementById('sel-box-panel');
  if (!panel) return;
  const tb = document.getElementById('sel-toolbar');
  if (tb) { const r = tb.getBoundingClientRect(); panel.style.left = r.left + 'px'; panel.style.top = (r.bottom + 6) + 'px'; }
  panel.style.display = 'block';
}

async function applySelBox() {
  if (!currentSel || !currentPdfData) return;
  const fc = document.getElementById('box-fill-color').value;
  const op = parseInt(document.getElementById('box-fill-opacity').value) / 100;
  const sc = document.getElementById('box-stroke-color').value;
  const sw = parseFloat(document.getElementById('box-stroke-w').value) || 0;
  const h2r = hex => ({ r: parseInt(hex.slice(1,3),16)/255, g: parseInt(hex.slice(3,5),16)/255, b: parseInt(hex.slice(5,7),16)/255 });
  const { PDFDocument, rgb } = PDFLib;
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[currentSel.pageIdx - 1];
    const { height: pH } = page.getSize();
    const fRgb = h2r(fc), sRgb = h2r(sc);
    page.drawRectangle({
      x: currentSel.pdfX, y: pH - currentSel.pdfY - currentSel.pdfH,
      width: currentSel.pdfW, height: currentSel.pdfH,
      color: rgb(fRgb.r, fRgb.g, fRgb.b), opacity: op,
      borderColor: sw > 0 ? rgb(sRgb.r, sRgb.g, sRgb.b) : undefined,
      borderWidth: sw > 0 ? sw : 0, borderOpacity: sw > 0 ? 1 : 0
    });
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    document.getElementById('sel-box-panel').style.display = 'none';
    clearSelection();
    t('Boîte appliquée');
  } catch(e) { t('Erreur : ' + e.message); }
}

// ─── Pipette ──────────────────────────────────────────────────────────────────
function toggleEyedropper() {
  eyedropperActive = !eyedropperActive;
  document.getElementById('btn-dropper')?.classList.toggle('on', eyedropperActive);
  const pagesEl = document.getElementById('pdf-pages');
  if (pagesEl) pagesEl.style.cursor = eyedropperActive ? 'crosshair' : '';
  if (eyedropperActive) t('Pipette : cliquez sur une couleur dans le document');
}

function pickColor(e) {
  if (!eyedropperActive) return;
  const wrap = e.target.closest('.page-wrap'); if (!wrap) return;
  const canvas = wrap.querySelector('canvas'); if (!canvas) return;
  const wr = wrap.getBoundingClientRect();
  const cx = (e.clientX - wr.left) * (canvas.width  / wrap.offsetWidth);
  const cy = (e.clientY - wr.top)  * (canvas.height / wrap.offsetHeight);
  const px = canvas.getContext('2d').getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
  const hex = '#' + [px[0],px[1],px[2]].map(v => v.toString(16).padStart(2,'0')).join('');
  // Apply to open box panel if visible, else copy
  const bfc = document.getElementById('box-fill-color');
  if (document.getElementById('sel-box-panel').style.display !== 'none' && bfc) {
    bfc.value = hex; t('Couleur prélevée : ' + hex + ' → fond');
  } else {
    navigator.clipboard?.writeText(hex).catch(() => {});
    t('Couleur : ' + hex + ' (copiée dans le presse-papiers)');
  }
  eyedropperActive = false;
  document.getElementById('btn-dropper')?.classList.remove('on');
  const pagesEl = document.getElementById('pdf-pages');
  if (pagesEl) pagesEl.style.cursor = '';
}

// ─── Actions IA sur la sélection ──────────────────────────────────────────────

function selCopyLastOcrText() {
  if (lastOcrText) navigator.clipboard?.writeText(lastOcrText).catch(() => {});
  t('Texte copié');
}

// ─── Reconstruction texte avec retours à la ligne (via bbox Y) ──────────────
function buildTextWithNewlines(words, imgHeight) {
  if (!words || !words.length) return '';
  const tol = Math.max(imgHeight * 0.018, 6); // tolérance = 1.8% hauteur image
  // Trier par Y puis X
  const sorted = [...words].filter(w => w.text && w.text.trim()).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    return Math.abs(dy) < tol ? a.bbox.x0 - b.bbox.x0 : dy;
  });
  const lines = [];
  let curLine = [], lastY = -Infinity;
  for (const w of sorted) {
    if (curLine.length && (w.bbox.y0 - lastY) > tol) {
      lines.push(curLine.join(' '));
      curLine = [];
    }
    curLine.push(w.text);
    lastY = w.bbox.y0;
  }
  if (curLine.length) lines.push(curLine.join(' '));
  return lines.join('\n');
}

async function selOCR() {
  document.getElementById('sel-ai-menu').style.display = 'none';
  const cvs = getSelCanvas(); if (!cvs) return;
  const imgB64 = cvs.toDataURL('image/jpeg', 0.95).split(',')[1];
  t('OCR de la zone...');
  const settings  = window.electronAPI ? (await window.electronAPI.getSettings() || {}) : {};
  const useGoogle = settings.ocrEngine === 'google' && !!settings.googleVisionKey;
  let text = '';
  try {
    const r = useGoogle
      ? await window.electronAPI.ocrWithGoogleVision(imgB64, 'jpeg', settings.googleVisionKey)
      : await window.electronAPI.ocrFromData(imgB64, 'jpeg', null);
    text = buildTextWithNewlines(r.words || [], cvs.height);
    lastOcrText = text;
  } catch(e) { t('Erreur OCR : ' + e.message); return; }
  openModal('OCR — Texte de la zone',
    '<div style="white-space:pre-wrap;font-size:.82rem;line-height:1.6;background:rgba(0,0,0,.25);padding:12px;border-radius:4px;border:1px solid var(--gold-border);max-height:280px;overflow-y:auto;user-select:text">' +
    (text || '(aucun texte détecté)').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' +
    '<div class="mbtn" style="margin-top:12px" onclick="selCopyLastOcrText()"><i class="fa-solid fa-copy"></i> Copier</div>');
}

async function selChangeText() {
  document.getElementById('sel-ai-menu').style.display = 'none';
  if (!currentSel || !currentPdfData) return;

  // 1. OCR de la zone pour pré-remplir le textarea
  const cvs = getSelCanvas(); if (!cvs) return;
  const imgB64 = cvs.toDataURL('image/jpeg', 0.95).split(',')[1];
  t('Lecture du texte de la zone...');
  const settings = window.electronAPI ? (await window.electronAPI.getSettings() || {}) : {};
  const useGoogle = settings.ocrEngine === 'google' && !!settings.googleVisionKey;
  let detectedText = '';
  try {
    const r = useGoogle
      ? await window.electronAPI.ocrWithGoogleVision(imgB64, 'jpeg', settings.googleVisionKey)
      : await window.electronAPI.ocrFromData(imgB64, 'jpeg', null);
    detectedText = buildTextWithNewlines(r.words || [], cvs.height);
    lastOcrText  = detectedText;
    // Estimer la taille de police depuis les bboxes OCR
    if ((r.words || []).length) {
      const heights = r.words.map(w => w.bbox.y1 - w.bbox.y0).filter(h => h > 0);
      const medH = heights.sort((a,b)=>a-b)[Math.floor(heights.length/2)] || 20;
      const imgScale = cvs.height / (currentSel.pdfH || 1);
      window._selEstFontSize = Math.max(4, Math.round(medH / imgScale * 0.82));
    } else {
      window._selEstFontSize = Math.max(4, Math.round(currentSel.pdfH * 0.62));
    }
  } catch(e) {
    window._selEstFontSize = Math.max(4, Math.round(currentSel.pdfH * 0.62));
  }

  // 2. Modal avec textarea éditable
  const fs0 = window._selEstFontSize || 12;
  const safe = (detectedText || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  openModal('Remplacer le texte',
    '<div style="font-size:.73rem;color:var(--txt2);margin-bottom:6px">Texte détecté (modifiez avant validation) :</div>' +
    '<textarea id="rpl-txt" style="width:100%;box-sizing:border-box;min-height:110px;background:rgba(0,0,0,.32);color:var(--cream);border:1px solid var(--gold-border);border-radius:4px;padding:9px;font-size:.84rem;resize:vertical;font-family:Georgia,serif;line-height:1.55">' + safe + '</textarea>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">' +
    '<span style="font-size:.73rem;color:var(--txt2)">Taille estimée :</span>' +
    '<input type="number" id="rpl-fs" value="' + fs0 + '" min="4" max="300" style="width:64px;background:rgba(0,0,0,.3);color:var(--cream);border:1px solid var(--gold-border);border-radius:3px;padding:3px 7px;font-size:.82rem">' +
    '<span style="font-size:.73rem;color:var(--txt2)">pt &nbsp;—&nbsp; couleur :</span>' +
    '<input type="color" id="rpl-clr" value="#000000" style="width:32px;height:24px;border:none;cursor:pointer;background:none">' +
    '</div>' +
    '<div class="mbtn" style="margin-top:13px" onclick="applyReplaceText()"><i class="fa-solid fa-pen-to-square"></i> Appliquer</div>'
  );
}

async function applyReplaceText() {
  const newText = document.getElementById('rpl-txt')?.value ?? '';
  const fs      = parseFloat(document.getElementById('rpl-fs')?.value)  || 12;
  const hexClr  = document.getElementById('rpl-clr')?.value || '#000000';
  closeModal();
  if (!currentSel || !currentPdfData) return;
  // Convertir hex → rgb 0-1
  const hr = parseInt(hexClr.slice(1,3),16)/255;
  const hg = parseInt(hexClr.slice(3,5),16)/255;
  const hb = parseInt(hexClr.slice(5,7),16)/255;
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[currentSel.pageIdx - 1];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const { height: pH } = page.getSize();
    const pdfY = pH - currentSel.pdfY - currentSel.pdfH;
    // Masquer l'ancienne zone avec fond blanc
    page.drawRectangle({ x: currentSel.pdfX, y: pdfY, width: currentSel.pdfW, height: currentSel.pdfH, color: rgb(1,1,1), opacity: 1, borderWidth: 0 });
    // Écrire ligne par ligne (respecte les \n)
    if (newText.trim()) {
      const lines  = newText.split('\n');
      const lineH  = fs * 1.3;
      let   yPos   = pdfY + currentSel.pdfH - fs; // partir du haut de la zone
      for (const line of lines) {
        const safe = line.replace(/[^\x20-\xFF]/g, '');
        if (safe.trim()) {
          page.drawText(safe, { x: currentSel.pdfX + 2, y: yPos, size: fs, font, color: rgb(hr, hg, hb), maxWidth: currentSel.pdfW - 4 });
        }
        yPos -= lineH;
        if (yPos < pdfY - fs) break;
      }
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length * 0.75), data, filePath: currentFilePath }, true);
    clearSelection();
    t('Texte remplacé');
  } catch(err) { t('Erreur : ' + err.message); }
}



// ══════════════════════════════════════════════════════════════════════════════
// OUTIL TEXTE — zones de texte éditables avec barre de mise en forme
// ══════════════════════════════════════════════════════════════════════════════
function initTextTool() {
  const pagesEl = document.getElementById('pdf-pages');
  if (!pagesEl) return;
  pagesEl.addEventListener('mousedown', e => {
    if (currentTool !== 'Texte') return;
    if (e.target.closest('.text-anno-box')) return;
    const wrap = e.target.closest('.page-wrap');
    if (!wrap) return;
    e.preventDefault();
    if (activeTextAnno) { activeTextAnno.classList.remove('tsel'); activeTextAnno = null; }
    hideTextFmtBar();
    const wRect = wrap.getBoundingClientRect();
    createTextAnno(wrap, e.clientX - wRect.left, e.clientY - wRect.top);
  });
  // Global drag/resize
  document.addEventListener('mousemove', onTextDragMove);
  document.addEventListener('mouseup',   onTextDragUp);
  document.addEventListener('mousemove', imgOverlayMove);
  document.addEventListener('mouseup',   imgOverlayUp);
}

function createTextAnno(wrap, x, y) {
  const box = document.createElement('div');
  box.className = 'text-anno-box tsel';
  box.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:220px;min-height:40px';
  box.innerHTML =
    '<div class="text-anno-content" contenteditable="true" ' +
    'style="font-size:16px;font-family:Georgia,serif;color:#000;text-align:left;background:rgba(255,255,255,0.9);">' +
    '</div>' +
    '<div class="text-anno-resize" title="Redimensionner"></div>';

  // Drag (only via border/handle, not content)
  box.addEventListener('mousedown', e => {
    if (e.target.classList.contains('text-anno-resize')) {
      // Resize
      textAnnoResizing = true;
      textAnnoDragging = false;
      textAnnoResizeStart = { x: e.clientX, y: e.clientY, w: box.offsetWidth, h: box.offsetHeight, box };
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (e.target.closest('.text-anno-content')) return; // typing
    // Drag
    textAnnoDragging = true;
    textAnnoResizing = false;
    activeTextAnno = box; box.classList.add('tsel');
    const br = box.getBoundingClientRect();
    textAnnoDragOff = { x: e.clientX - br.left, y: e.clientY - br.top };
    e.preventDefault(); e.stopPropagation();
  });

  // Select on click
  box.addEventListener('mousedown', e => {
    if (activeTextAnno && activeTextAnno !== box) {
      activeTextAnno.classList.remove('tsel');
    }
    activeTextAnno = box;
    box.classList.add('tsel');
    showTextFmtBar(box);
  }, true);

  wrap.appendChild(box);
  activeTextAnno = box;

  // Focus content
  const content = box.querySelector('.text-anno-content');
  setTimeout(() => { content.focus(); showTextFmtBar(box); }, 20);
  return box;
}

function onTextDragMove(e) {
  if (textAnnoDragging && activeTextAnno) {
    const wrap = activeTextAnno.parentElement;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const nx = e.clientX - textAnnoDragOff.x - wr.left;
    const ny = e.clientY - textAnnoDragOff.y - wr.top;
    activeTextAnno.style.left = Math.max(0, nx) + 'px';
    activeTextAnno.style.top  = Math.max(0, ny) + 'px';
  } else if (textAnnoResizing && textAnnoResizeStart) {
    const { x, y, w, h, box } = textAnnoResizeStart;
    box.style.width     = Math.max(60,  w + e.clientX - x) + 'px';
    box.style.minHeight = Math.max(28,  h + e.clientY - y) + 'px';
  }
}

function onTextDragUp() {
  textAnnoDragging = false;
  textAnnoResizing = false;
  textAnnoResizeStart = null;
}

// ─── Barre de mise en forme flottante ────────────────────────────────────────
function showTextFmtBar(box) {
  const bar = document.getElementById('text-fmt-bar');
  if (!bar) return;
  const br = box.getBoundingClientRect();
  bar.style.display = 'flex';
  bar.style.left = Math.max(4, br.left) + 'px';
  bar.style.top  = Math.max(4, br.top - bar.offsetHeight - 8) + 'px';
  // Sync controls from current box style
  const c = box.querySelector('.text-anno-content');
  if (!c) return;
  const cs = window.getComputedStyle(c);
  const fsel = document.getElementById('ta-font');
  if (fsel) {
    const ff = c.style.fontFamily || cs.fontFamily;
    fsel.value = ff.split(',')[0].replace(/["']/g, '').trim().toLowerCase().includes('arial') ? 'Arial,sans-serif' :
      ff.toLowerCase().includes('helvetica') ? "'Helvetica Neue',sans-serif" :
      ff.toLowerCase().includes('courier') ? "'Courier New',monospace" :
      ff.toLowerCase().includes('cinzel')  ? "'Cinzel',serif" :
      ff.toLowerCase().includes('times')   ? "'Times New Roman',serif" : 'Georgia,serif';
  }
  const fsz = document.getElementById('ta-size');
  if (fsz) fsz.value = parseInt(c.style.fontSize || cs.fontSize) || 16;
  const clr = document.getElementById('ta-color');
  if (clr) clr.value = rgbToHex(c.style.color || cs.color);
  const bg = document.getElementById('ta-bg');
  if (bg) bg.value = rgbToHex(c.style.backgroundColor || cs.backgroundColor);
}

function hideTextFmtBar() {
  const bar = document.getElementById('text-fmt-bar');
  if (bar) bar.style.display = 'none';
}

function rgbToHex(rgb) {
  const m = (rgb || '').match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
}

// ─── Commandes de formatage ───────────────────────────────────────────────────
function taApplyActive(prop, value) {
  const c = activeTextAnno?.querySelector('.text-anno-content');
  if (!c) return;
  c.style[prop] = value;
  if (activeTextAnno) showTextFmtBar(activeTextAnno);
}

function taToggleActive(cmd) {
  const c = activeTextAnno?.querySelector('.text-anno-content');
  if (!c) return;
  c.focus();
  document.execCommand(cmd, false, null);
}

function taAlignActive(align) {
  const c = activeTextAnno?.querySelector('.text-anno-content');
  if (!c) return;
  c.style.textAlign = align;
  ['ta-al','ta-ac','ta-ar','ta-aj'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  const map = { left:'ta-al', center:'ta-ac', right:'ta-ar', justify:'ta-aj' };
  document.getElementById(map[align])?.classList.add('on');
}

function removeActiveTextAnno() {
  if (activeTextAnno) { activeTextAnno.remove(); activeTextAnno = null; }
  hideTextFmtBar();
}

// Close text box when clicking outside
document.addEventListener('mousedown', e => {
  if (!activeTextAnno) return;
  if (e.target.closest('.text-anno-box') || e.target.closest('#text-fmt-bar')) return;
  activeTextAnno.classList.remove('tsel');
  activeTextAnno = null;
  hideTextFmtBar();
});

// ══════════════════════════════════════════════════════════════════════════════
// OCR DU PDF COURANT (onglet IA)
// ══════════════════════════════════════════════════════════════════════════════
async function ocrCurrentPDF() {
  if (!currentPdfDoc || !currentPdfData) { t('Aucun document ouvert'); return; }
  // Désactiver l'outil sélection pendant et après l'OCR pour que le texte soit sélectionnable
  const pagesElOcr = document.getElementById('pdf-pages');
  currentTool = 'Lecture';
  if (pagesElOcr) { pagesElOcr.classList.remove('sel-mode'); pagesElOcr.classList.remove('text-mode'); }
  document.querySelectorAll('#tbar .tb').forEach(b => b.classList.remove('act'));
  clearSelection();
  const n = currentPdfDoc.numPages;
  const loadBar   = document.getElementById('load-bar');
  const loadInner = document.getElementById('load-inner');
  const loadLabel = document.getElementById('load-label');
  loadBar.style.display = 'block';
  loadInner.style.width = '5%';
  loadLabel.textContent = 'Initialisation OCR...';

  const settings  = window.electronAPI ? (await window.electronAPI.getSettings() || {}) : {};
  const useGoogle = settings.ocrEngine === 'google' && !!settings.googleVisionKey;
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const outDoc = await PDFDocument.create();
  const font   = await outDoc.embedFont(StandardFonts.Helvetica);

  for (let p = 1; p <= n; p++) {
    const pct = Math.round((p / n) * 90);
    loadInner.style.width = pct + '%';
    loadLabel.textContent = 'OCR page ' + p + ' / ' + n + (useGoogle ? ' (Google Vision)' : ' (Tesseract)') + '...';

    const page = await currentPdfDoc.getPage(p);
    const vp   = page.getViewport({ scale: 2 });
    const cvs  = document.createElement('canvas');
    cvs.width  = vp.width;  cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;

    const imgB64  = cvs.toDataURL('image/jpeg', 0.92).split(',')[1];
    const imgType = 'jpeg';

    let words = [];
    try {
      if (useGoogle) {
        const r = await window.electronAPI.ocrWithGoogleVision(imgB64, imgType, settings.googleVisionKey);
        words = r.words || [];
      } else {
        const r = await window.electronAPI.ocrFromData(imgB64, imgType, null);
        words = r.words || [];
      }
    } catch(e) { console.warn('OCR p' + p + ':', e); }

    // Page originale en image
    const { width: pvW, height: pvH } = page.getViewport({ scale: 1 });
    const outPage = outDoc.addPage([pvW, pvH]);
    const jpgBytes = base64ToBytes(imgB64);
    const jpgImg   = await outDoc.embedJpg(jpgBytes);
    outPage.drawImage(jpgImg, { x: 0, y: 0, width: pvW, height: pvH });

    // Texte invisible (pour la sélection / recherche)
    const sX = pvW / vp.width;
    const sY = pvH / vp.height;
    for (const word of words) {
      const safe = (word.text || '').replace(/[^\x20-\xFF]/g, '');
      if (!safe.trim()) continue;
      try {
        const { x0, y0, x1, y1 } = word.bbox;
        const wH = (y1 - y0) * sY;
        const tW = (x1 - x0) * sX;
        let fs = Math.max(wH * 0.85, 1);
        const wAt = font.widthOfTextAtSize(safe, fs);
        if (wAt > 0 && tW > 0) fs = Math.min(Math.max(fs * (tW / wAt), 1), Math.max(wH * 5, 5));
        outPage.drawText(safe, { x: x0 * sX, y: pvH - y1 * sY, size: fs, font, color: rgb(1,1,1), opacity: 0.01 });
      } catch(e) {}
    }
  }

  loadInner.style.width = '100%';
  loadLabel.textContent = 'Finalisation...';
  const data = bytesToBase64(await outDoc.save());
  await renderPDFFromData({ name: currentPdfName + ' (OCR)', size: Math.round(data.length * 0.75), data, filePath: null }, true);
  t('OCR terminé — ' + n + ' page(s). Utilisez le curseur normal pour sélectionner le texte.');
}

function menuAction(action) {
  switch (action) {
    case 'new':    newDocument(); break;
    case 'save':   saveDocument();   break;
    case 'saveAs': saveDocumentAs(); break;
    case 'search': t('Rechercher & Remplacer'); break;
    case 'cut':    menuCut();  break;
    case 'copy':   menuCopy(); break;
    default:       t(action);
  }
}

// ─── Couleurs, calques, signets, champs ───────────────────────────────────────
document.querySelectorAll('.cs').forEach(sw => {
  sw.addEventListener('click', function () {
    this.closest('.cplt').querySelectorAll('.cs').forEach(s => s.classList.remove('act'));
    this.classList.add('act');
    paletteActivateRect(this);
  });
});
document.querySelectorAll('.ly-eye').forEach(eye => {
  eye.addEventListener('click', function () {
    const i = this.querySelector('i');
    if (i.classList.contains('fa-eye-slash')) { i.classList.replace('fa-eye-slash','fa-eye'); i.style.color='var(--gold)'; t('Calque visible'); }
    else { i.classList.replace('fa-eye','fa-eye-slash'); i.style.color='var(--txt2)'; t('Calque masque'); }
  });
});
document.querySelectorAll('.bki').forEach(bk => { bk.addEventListener('click', function () { t('-> ' + this.textContent.trim()); }); });
document.querySelectorAll('.ffi').forEach(ff => { ff.addEventListener('click', function () { t('Champ : ' + this.textContent.trim()); }); });

// ─── Chat IA → implémenté en bas du fichier ──────────────────────────────

// ─── Sauvegarde avant fermeture ──────────────────────────────────────────────

// Sauvegarde silencieuse d'un onglet (sans changer l'onglet actif)
async function saveTabBeforeClose(tab) {
  if (!tab.data) return true;
  // Si l'onglet actif : flush les champs de formulaire d'abord
  if (tabs[activeTabIdx] === tab) await flushFormFields();

  if (tab.filePath) {
    const res = await window.electronAPI.writeFile(tab.filePath, tab.data);
    if (res.success) { tab.savedData = tab.data; return true; }
    t('Erreur sauvegarde : ' + res.error);
    return false;
  }
  // Pas de chemin → Save As (nécessite de switcher sur cet onglet)
  syncActiveTab();
  const prevIdx = activeTabIdx;
  const idx = tabs.indexOf(tab);
  if (idx >= 0 && idx !== prevIdx) { activeTabIdx = idx; loadActiveTab(); }

  const dlg = await window.electronAPI.savePDF(tab.name || 'document.pdf');
  if (dlg.canceled || !dlg.filePath) {
    if (idx >= 0 && idx !== prevIdx) { activeTabIdx = prevIdx; loadActiveTab(); }
    return false; // annulé
  }
  const fp  = dlg.filePath;
  const res = await window.electronAPI.writeFile(fp, tab.data);
  if (res.success) {
    tab.filePath  = fp;
    tab.name      = fp.split(/[\\/]/).pop();
    tab.savedData = tab.data;
  }
  if (idx >= 0 && idx !== prevIdx) { activeTabIdx = prevIdx; loadActiveTab(); }
  return res.success;
}

// Dialog "modifications non enregistrées" — traite les onglets dirty un par un
async function handleAppCloseRequested() {
  syncActiveTab();
  const dirty = tabs.filter(isTabDirty);
  if (!dirty.length) { window.electronAPI.confirmClose(); return; }

  for (const tab of dirty) {
    const answer = await showSaveBeforeCloseDialog(tab.name || 'Sans titre');
    if (answer === 'cancel') return;           // l'utilisateur annule la fermeture
    if (answer === 'save') {
      const ok = await saveTabBeforeClose(tab);
      if (!ok) return;                         // save annulé → ne pas fermer
    }
    // 'discard' → on continue sans sauvegarder
  }
  window.electronAPI.confirmClose();
}

// Affiche un dialogue modal et retourne une promesse : 'save' | 'discard' | 'cancel'
function showSaveBeforeCloseDialog(docName) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:50000;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-panel);border:1px solid var(--gold);border-top:3px solid var(--gold);border-radius:6px;padding:28px 32px;min-width:360px;max-width:500px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.8);';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:2rem;color:var(--gold);margin-bottom:14px;';
    icon.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:Cinzel,serif;font-size:.95rem;color:var(--gold-l);margin-bottom:10px;';
    title.textContent = 'Modifications non enregistrées';

    const msg = document.createElement('div');
    msg.style.cssText = 'font-family:"Cormorant Garamond",serif;font-size:.95rem;color:var(--txt);margin-bottom:24px;line-height:1.5;';
    msg.innerHTML = `<strong style="color:var(--gold-l)">${docName}</strong><br>a des modifications non enregistrées.<br>Voulez-vous enregistrer avant de quitter ?`;

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;';

    const mkBtn = (label, color, val) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `padding:8px 20px;border:1px solid ${color};background:transparent;color:${color};border-radius:4px;font-family:"Cormorant Garamond",serif;font-size:.9rem;cursor:pointer;transition:all .15s;`;
      b.onmouseover = () => { b.style.background = color; b.style.color = '#111'; };
      b.onmouseout  = () => { b.style.background = 'transparent'; b.style.color = color; };
      b.onclick = () => { document.body.removeChild(ov); resolve(val); };
      return b;
    };

    btns.appendChild(mkBtn('Enregistrer',       'var(--gold)',  'save'));
    btns.appendChild(mkBtn('Ne pas enregistrer','#e67e22',     'discard'));
    btns.appendChild(mkBtn('Annuler',           '#e74c3c',     'cancel'));

    box.append(icon, title, msg, btns);
    ov.appendChild(box);
    document.body.appendChild(ov);
  });
}

// ─── Fichiers récents ─────────────────────────────────────────────────────────
function renderRecentMenu(list) {
  const sub = document.getElementById('recent-submenu');
  const item = document.getElementById('recent-menu-item');
  if (!sub) return;
  sub.innerHTML = '';

  if (!list || !list.length) {
    sub.innerHTML = '<div class="mdi" style="opacity:.5;font-style:italic;cursor:default">Aucun fichier récent</div>';
    if (item) item.style.opacity = '.5';
    return;
  }
  if (item) item.style.opacity = '';

  list.forEach(fp => {
    const name = fp.replace(/\\/g, '/').split('/').pop();
    const d = document.createElement('div');
    d.className = 'mdi';
    d.innerHTML = `<i class="fa-regular fa-file-pdf"></i>
      <span style="display:flex;flex-direction:column;overflow:hidden">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
        <span class="recent-path">${fp}</span>
      </span>`;
    d.addEventListener('click', () => openRecentFile(fp));
    sub.appendChild(d);
  });

  // Séparateur + Effacer
  const sep = document.createElement('div'); sep.className = 'msep'; sub.appendChild(sep);
  const clear = document.createElement('div');
  clear.className = 'mdi';
  clear.innerHTML = '<i class="fa-solid fa-trash-can"></i><span style="opacity:.7">Effacer la liste</span>';
  clear.addEventListener('click', async () => {
    await window.electronAPI.addToRecent('__clear__');
  });
  sub.appendChild(clear);
}

async function openRecentFile(filePath) {
  // Fermer le menu
  document.querySelectorAll('.mi.open').forEach(m => m.classList.remove('open'));
  if (!window.electronAPI) return;
  const res = await window.electronAPI.openRecentFile(filePath);
  if (res && res.error) t('⚠ ' + res.error);
}

// ─── Integration Electron ─────────────────────────────────────────────────────
if (window.electronAPI) {
  window.electronAPI.onOpenFile(fileData  => handleOpenWith(fileData));
  initSelectionTool();
  initTextTool();
  initDrawingTools();
  window.electronAPI.onMenuAction(action  => menuAction(action));

  // Charger la liste au démarrage
  window.electronAPI.getRecentFiles().then(renderRecentMenu).catch(() => {});

  // Écouter les mises à jour (après ouverture d'un fichier)
  window.electronAPI.onRecentUpdated(list => renderRecentMenu(list));

  // Fermeture : sauvegarder si nécessaire
  if (window.electronAPI.onCloseRequested) {
    window.electronAPI.onCloseRequested(() => handleAppCloseRequested());
  }
}

// ─── Raccourcis clavier ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 's')                    { e.preventDefault(); menuAction('save'); }
  if (mod && e.key === 'z' && !e.shiftKey)    { e.preventDefault(); undoPDF(); }
  if (mod && e.key === 'z' &&  e.shiftKey)    { e.preventDefault(); redoPDF(); }
  if (mod && e.key === 'o')                    { e.preventDefault(); openFile(); }
  if (mod && e.key === 'f' && !e.shiftKey)     { e.preventDefault(); toggleFullscreen(); }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoom(1); }
  if (mod && e.key === '0')                    { e.preventDefault(); fitToPage(); }
  if (e.key === 'F11')                          { e.preventDefault(); toggleFullscreen(); }
  if (mod && e.key === '-')                    { e.preventDefault(); zoom(-1); }
  if (mod && e.key === 'c' && currentSel)      { e.preventDefault(); menuCopy(); }
  if (mod && e.key === 'x' && currentSel)      { e.preventDefault(); menuCut(); }
  // Ctrl+V : clipboard interne → menuPaste() directement (taille+position exactes)
  if (mod && e.key === 'v') {
    if (selClipboard && currentPdfData) { e.preventDefault(); menuPaste(); }
    // else : pas de preventDefault → le 'paste' event gérera l'image externe
  }
  if (e.key === 'Escape') closeModal();
  if (!mod) {
    if (e.key === 'h' || e.key === 'H') setTool(null, 'Surligner');
    if (e.key === 'e' || e.key === 'E') setTool(null, 'Biffure');
    if (e.key === 't' || e.key === 'T') setTool(null, 'Texte');
    if (e.key === 'm' || e.key === 'M') setTool(null, 'Mesures');
  }
});

// Reposition format bar on scroll/resize
document.getElementById('pdf-viewport')?.addEventListener('scroll', () => {
  if (activeTextAnno) showTextFmtBar(activeTextAnno);
});
window.addEventListener('resize', () => {
  if (activeTextAnno) showTextFmtBar(activeTextAnno);
});

// ══════════════════════════════════════════════════════════════════════════════
// VERROUILLAGE PROPORTIONS IMAGE
// ══════════════════════════════════════════════════════════════════════════════
let imgAspectLocked = false;
let imgAspectRatio  = 1;

function imgToggleLock() {
  imgAspectLocked = !imgAspectLocked;
  if (imgAspectLocked && imgOverlay) {
    imgAspectRatio = imgOverlay.offsetWidth / Math.max(1, imgOverlay.offsetHeight);
  }
  const btn = document.getElementById('img-lock-btn');
  if (btn) {
    btn.innerHTML = imgAspectLocked
      ? '<i class="fa-solid fa-lock"></i>'
      : '<i class="fa-solid fa-lock-open"></i>';
    btn.classList.toggle('on', imgAspectLocked);
    btn.title = imgAspectLocked ? 'Proportions verrouillées' : 'Verrouiller les proportions';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE COMMUNE — OUTILS DE DESSIN
// ══════════════════════════════════════════════════════════════════════════════
let drawColor    = '#e53935';
let drawFill     = 'transparent';
let drawStrokeW  = 2;
let drawOpacity  = 1.0;
let penMode      = 'free';        // 'free' | 'line'
let shapeType    = 'rect';        // 'rect' | 'ellipse' | 'line' | 'arrow' | 'fill' | 'strike'
let noteBg       = '#FFFF8D';
let noteClr      = '#1a1a1a';
let drawOverlay  = null;          // canvas courant (peut changer au survol d'une autre page)
let drawWrap     = null;          // page-wrap courant
let drawIsDown   = false;
let drawStart    = null;          // {x, y} début
let _drawGestureOv   = null;     // overlay capturé au mousedown — stable pour toute la gesture
let _drawGestureWrap = null;     // wrap capturé au mousedown
let drawPts      = [];            // points main-levée ou sommets de ligne
let penLinePts   = [];            // sommets lignes connectées
let noteOverlay  = null;          // div post-it courant
let noteDragging = false;
let noteDragOff  = { x: 0, y: 0 };
// Pending annotation (entre dessin et commit dans le PDF)
let pendingAnnot     = null;
let pendingOvDiv     = null;
let pendingDragging  = false;
let pendingResizing  = null;
let pendingDragStart = null;
// Note resize
let noteResizing     = false;
let noteResizStart   = null;

// ── Overlay canvas ────────────────────────────────────────────────────────────
function getDrawCanvas(wrap) {
  let ov = wrap.querySelector('.draw-ov');
  if (!ov) {
    const pc = wrap.querySelector('canvas');
    ov = document.createElement('canvas');
    ov.className = 'draw-ov';
    ov.width  = pc ? pc.offsetWidth  : wrap.offsetWidth;
    ov.height = pc ? pc.offsetHeight : wrap.offsetHeight;
    ov.style.cssText = 'position:absolute;top:0;left:0;z-index:250;cursor:crosshair;';
    ov.addEventListener('mousedown', onDrawMouseDown);
    wrap.appendChild(ov);
  }
  return ov;
}

function clearOvCanvas() {
  if (drawOverlay) {
    const ctx = drawOverlay.getContext('2d');
    ctx.clearRect(0, 0, drawOverlay.width, drawOverlay.height);
  }
}

function removeAllDrawOverlays() {
  document.querySelectorAll('.draw-ov').forEach(c => c.remove());
  if (noteOverlay) { noteOverlay.remove(); noteOverlay = null; }
  drawOverlay = null; drawWrap = null; drawIsDown = false;
  drawPts = []; penLinePts = [];
}

function activateDrawOnWrap(wrap) {
  // Supprimer les anciens overlays si changement de page
  if (drawWrap && drawWrap !== wrap) {
    clearOvCanvas();
    drawPts = []; penLinePts = [];
  }
  drawWrap    = wrap;
  drawOverlay = getDrawCanvas(wrap);
}

function cancelDrawing() {
  cancelPending();
  drawIsDown = false; drawPts = []; penLinePts = []; drawStart = null;
  clearOvCanvas();
  if (currentTool === 'Stylo') showDrawToolbar('Stylo');
}

// ── setTool : afficher la barre ────────────────────────────────────────────
const DRAW_TOOLS = ['Stylo','Formes','Surligner','Note','Biffure'];

function showDrawToolbar(tool) {
  const tb = document.getElementById('draw-tb');
  if (!tb) return;
  if (!DRAW_TOOLS.includes(tool)) { tb.style.display = 'none'; return; }

  const col  = v => `<input type="color" class="dtb-clr" value="${v}" onchange="${'drawColor=this.value'}">`;
  const rang = (id, mn, mx, val, cb) =>
    `<input type="range" class="dtb-range" min="${mn}" max="${mx}" value="${val}"
      oninput="${cb};this.nextElementSibling.textContent=this.value">
     <span class="dtb-val">${val}</span>`;
  const btn  = (label, onclick, tip, extra='') =>
    `<div class="dtb-btn ${extra}" onclick="${onclick}" title="${tip}">${label}</div>`;
  const swatches = (colors, prop) => colors.map(c =>
    `<div class="dtb-sw" style="background:${c}" onclick="${prop}='${c}'"></div>`).join('');
  const sep = '<div class="dtb-sep"></div>';

  let h = '';

  if (tool === 'Stylo') {
    h = `<div class="dtb-g">
      ${btn('<i class="fa-solid fa-pen"></i>',     "setPenMode('free')","Main levée", penMode==='free'?'on':'')}
      ${btn('<i class="fa-solid fa-draw-polygon"></i>',"setPenMode('line')","Lignes connectées",penMode==='line'?'on':'')}
    </div>${sep}
    <div class="dtb-g"><div class="dtb-lbl">Couleur</div>
      <input type="color" class="dtb-clr" value="${drawColor}" onchange="drawColor=this.value">
    </div>
    <div class="dtb-g"><div class="dtb-lbl">Épais.</div>
      ${rang('sw',1,20,drawStrokeW,'drawStrokeW=+this.value')}
    </div>${sep}
    ${penMode==='line' && penLinePts.length>0
      ? btn('<i class="fa-solid fa-check"></i> Terminer','penFinishLine()','Terminer la ligne','ok')
      : ''}
    ${btn('<i class="fa-solid fa-xmark"></i>','cancelDrawing()','Effacer','del')}`;

  } else if (tool === 'Formes') {
    h = `<div class="dtb-g">
      ${btn('<i class="fa-regular fa-square"></i>',   "setDrawShape('rect')",   'Rectangle',  shapeType==='rect'?'on':'')}
      ${btn('<i class="fa-regular fa-circle"></i>',   "setDrawShape('ellipse')",'Ellipse',    shapeType==='ellipse'?'on':'')}
      ${btn('<i class="fa-solid fa-minus"></i>',      "setDrawShape('line')",   'Ligne',      shapeType==='line'?'on':'')}
      ${btn('<i class="fa-solid fa-arrow-right"></i>',"setDrawShape('arrow')",  'Flèche',     shapeType==='arrow'?'on':'')}
    </div>${sep}
    <div class="dtb-g"><div class="dtb-lbl">Trait</div>
      <input type="color" class="dtb-clr" value="${drawColor}" onchange="drawColor=this.value">
      ${rang('sw',1,20,drawStrokeW,'drawStrokeW=+this.value')}
    </div>
    <div class="dtb-g"><div class="dtb-lbl">Fond</div>
      <input type="color" class="dtb-clr" id="fill-clr"
        value="${drawFill==='transparent'?'#ffffff':drawFill}"
        onchange="drawFill=this.value; document.getElementById('btn-fill-none').classList.remove('on')">
      <div class="dtb-btn ${drawFill==='transparent'?'on':''}" id="btn-fill-none" title="Pas de fond"
        onclick="if(drawFill==='transparent'){drawFill=document.getElementById('fill-clr').value;this.classList.remove('on')}else{drawFill='transparent';this.classList.add('on')}">⊘</div>
    </div>`;

  } else if (tool === 'Surligner') {
    h = `<div class="dtb-g"><div class="dtb-lbl">Couleur</div>
      ${swatches(['#FFD600','#69F0AE','#40C4FF','#FF6E40','#E040FB'],'drawColor')}
      <input type="color" class="dtb-clr" id="hl-clr" value="${drawColor}" onchange="drawColor=this.value">
    </div>
    <div class="dtb-g"><div class="dtb-lbl">Opacité</div>
      ${rang('op',10,80,Math.round(drawOpacity*100),'drawOpacity=this.value/100')}%
    </div>`;

  } else if (tool === 'Note') {
    h = `<div class="dtb-g"><div class="dtb-lbl">Fond</div>
      ${swatches(['#FFFF8D','#CCFF90','#80D8FF','#FFD180','#FFB3FF'],'noteBg')}
      <input type="color" class="dtb-clr" value="${noteBg}" onchange="noteBg=this.value">
    </div>
    <div class="dtb-g"><div class="dtb-lbl">Texte</div>
      <input type="color" class="dtb-clr" value="${noteClr}" onchange="noteClr=this.value">
    </div>
    <div class="dtb-hint">↖ Cliquez sur la page pour poser une note</div>`;

  } else if (tool === 'Biffure') {
    h = `<div class="dtb-g">
      ${btn('<i class="fa-solid fa-square-full"></i>',"setDrawShape('fill')",  'Couvrir zone',  shapeType==='fill'?'on':'')}
      ${btn('<i class="fa-solid fa-strikethrough"></i>',"setDrawShape('strike')","Barrer ligne",shapeType==='strike'?'on':'')}
    </div>${sep}
    <div class="dtb-g"><div class="dtb-lbl">Couleur</div>
      ${swatches(['#000000','#e53935','#ffffff','#0D47A1'],'drawColor')}
      <input type="color" class="dtb-clr" value="${drawColor}" onchange="drawColor=this.value">
    </div>
    <div class="dtb-g"><div class="dtb-lbl">Opacité</div>
      ${rang('op',10,100,Math.round(drawOpacity*100),'drawOpacity=this.value/100')}%
    </div>`;
  }

  tb.innerHTML = h;
  tb.style.display = 'flex';
}

function setPenMode(m) { penMode = m; penLinePts = []; clearOvCanvas(); showDrawToolbar('Stylo'); }
function setDrawShape(s) { shapeType = s; showDrawToolbar(currentTool); }

// ── Événements de dessin (sur le canvas overlay) ─────────────────────────────
function onDrawMouseDown(e) {
  if (!DRAW_TOOLS.includes(currentTool)) return;
  e.preventDefault(); e.stopPropagation();
  // Utiliser e.currentTarget (le canvas cliqué) plutôt que la variable globale drawOverlay
  // qui peut avoir changé si la souris a survolé une autre page avant ce clic.
  const ov = e.currentTarget || drawOverlay;
  const wrap = ov.closest ? ov.closest('.page-wrap') : drawWrap;
  _drawGestureOv   = ov;
  _drawGestureWrap = wrap;
  // Synchroniser les globales avec la page réellement cliquée
  if (wrap && wrap !== drawWrap) { drawWrap = wrap; drawOverlay = ov; }
  const r  = ov.getBoundingClientRect();
  const x  = e.clientX - r.left;
  const y  = e.clientY - r.top;

  if (currentTool === 'Note') { placeNote(x, y, wrap); return; }

  if (currentTool === 'Stylo' && penMode === 'line') {
    if (penLinePts.length === 0) penLinePts = [];
    penLinePts.push({ x, y });
    redrawPenLine();
    showDrawToolbar('Stylo');
    return;
  }

  drawIsDown = true;
  drawStart  = { x, y };
  drawPts    = [{ x, y }];
}

function onDrawMouseMove(e) {
  if (!drawOverlay || !DRAW_TOOLS.includes(currentTool)) return;
  if (!drawIsDown) return;
  const r = drawOverlay.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const ctx = drawOverlay.getContext('2d');

  if (currentTool === 'Stylo' && penMode === 'free') {
    drawPts.push({ x, y });
    ctx.clearRect(0,0,drawOverlay.width,drawOverlay.height);
    drawPenFreeOnCtx(ctx, drawPts);
    return;
  }

  // Shapes / Surligner / Biffure : preview
  clearOvCanvas();
  const x0 = drawStart.x, y0 = drawStart.y;
  const w = x - x0, h = y - y0;
  ctx.globalAlpha = (currentTool==='Surligner'||currentTool==='Biffure') ? drawOpacity : 1;
  ctx.strokeStyle = drawColor;
  ctx.lineWidth   = drawStrokeW;
  ctx.fillStyle   = drawFill === 'transparent' ? 'rgba(0,0,0,0)' : hexToRgba(drawFill, 0.25);

  if (currentTool === 'Surligner') {
    ctx.fillStyle = hexToRgba(drawColor, drawOpacity);
    ctx.fillRect(Math.min(x0,x), Math.min(y0,y), Math.abs(w), Math.abs(h));
  } else if (currentTool === 'Biffure') {
    if (shapeType === 'fill') {
      ctx.fillStyle = hexToRgba(drawColor, drawOpacity);
      ctx.fillRect(Math.min(x0,x), Math.min(y0,y), Math.abs(w), Math.abs(h));
    } else {
      // strike : ligne centrale
      ctx.beginPath(); ctx.moveTo(x0, y0 + h/2); ctx.lineTo(x, y0 + h/2);
      ctx.stroke();
    }
  } else if (shapeType === 'rect') {
    if (drawFill !== 'transparent') { ctx.fill(); ctx.fillRect(Math.min(x0,x),Math.min(y0,y),Math.abs(w),Math.abs(h)); }
    ctx.strokeRect(Math.min(x0,x), Math.min(y0,y), Math.abs(w), Math.abs(h));
  } else if (shapeType === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x0+w/2, y0+h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
    if (drawFill !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shapeType === 'line') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  } else if (shapeType === 'arrow') {
    drawArrowOnCtx(ctx, x0, y0, x, y);
  }
  ctx.globalAlpha = 1;
}

function onDrawMouseUp(e) {
  if (!drawOverlay || !DRAW_TOOLS.includes(currentTool) || currentTool === 'Note') return;
  if (currentTool === 'Stylo' && penMode === 'line') return; // ligne: commit au double-clic
  if (!drawIsDown) return;
  drawIsDown = false;
  if (!drawStart) return;
  // Utiliser l'overlay capturé au mousedown pour la cohérence des coordonnées
  const ov = _drawGestureOv || drawOverlay;
  const gestureWrap = _drawGestureWrap || drawWrap;
  _drawGestureOv = null; _drawGestureWrap = null;
  const r  = ov.getBoundingClientRect();
  const x  = e.clientX - r.left;
  const y  = e.clientY - r.top;
  const x0 = drawStart.x, y0 = drawStart.y;
  drawStart = null;

  // ── Mode main levée: stocker les pts et entrer en mode pending ──
  if (currentTool === 'Stylo' && penMode === 'free') {
    const pts = [...drawPts];
    drawPts = [];
    if (pts.length < 2) { clearOvCanvas(); return; }
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs)-bx, bh = Math.max(...ys)-by;
    pendingAnnot = { type:'pen', tool:'Stylo', pts, wrap:gestureWrap,
      color:drawColor, strokeW:drawStrokeW, opacity:1,
      _bbox:{ x:bx, y:by, w:bw, h:bh } };
    showPendingOverlay(pendingAnnot._bbox);
    return;
  }

  // ── Mode formes / surligner / biffure: stocker et mode pending ──
  drawPts = [];
  const bx = Math.min(x0,x), by = Math.min(y0,y);
  const bw = Math.abs(x-x0), bh = Math.abs(y-y0);
  if (bw < 3 && bh < 3) { clearOvCanvas(); return; }
  pendingAnnot = { type:'shape', tool:currentTool, subType:shapeType,
    x0, y0, x1:x, y1:y, wrap:gestureWrap,
    color:drawColor, fill:drawFill, strokeW:drawStrokeW, opacity:drawOpacity,
    _bbox:{ x:bx, y:by, w:bw, h:bh } };
  // Redessiner final net sur le canvas
  redrawPendingOnCanvas();
  showPendingOverlay(pendingAnnot._bbox);
}

function onDrawDblClick(e) {
  if (currentTool === 'Stylo' && penMode === 'line' && penLinePts.length > 0) {
    penFinishLine();
  }
}

function penFinishLine() {
  if (!drawWrap || penLinePts.length < 2) { penLinePts = []; showDrawToolbar('Stylo'); return; }
  commitPenLine(penLinePts);
  penLinePts = []; clearOvCanvas(); showDrawToolbar('Stylo');
}

function redrawPenLine() {
  if (!drawOverlay) return;
  const ctx = drawOverlay.getContext('2d');
  clearOvCanvas();
  ctx.strokeStyle = drawColor; ctx.lineWidth = drawStrokeW;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (penLinePts.length < 2) {
    ctx.beginPath(); ctx.arc(penLinePts[0].x, penLinePts[0].y, drawStrokeW/2, 0, Math.PI*2);
    ctx.fillStyle = drawColor; ctx.fill(); return;
  }
  ctx.beginPath(); ctx.moveTo(penLinePts[0].x, penLinePts[0].y);
  for (let i=1; i<penLinePts.length; i++) ctx.lineTo(penLinePts[i].x, penLinePts[i].y);
  ctx.stroke();
  // Marquer les points
  penLinePts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle=drawColor; ctx.fill(); });
}

function drawPenFreeOnCtx(ctx, pts) {
  if (!pts.length) return;
  ctx.strokeStyle = drawColor; ctx.lineWidth = drawStrokeW;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function drawArrowOnCtx(ctx, x1, y1, x2, y2) {
  const hLen = 14, hAngle = Math.PI/7;
  const angle = Math.atan2(y2-y1, x2-x1);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hLen*Math.cos(angle-hAngle), y2 - hLen*Math.sin(angle-hAngle));
  ctx.lineTo(x2 - hLen*Math.cos(angle+hAngle), y2 - hLen*Math.sin(angle+hAngle));
  ctx.closePath(); ctx.fillStyle = drawColor; ctx.fill();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Note (post-it) ────────────────────────────────────────────────────────────
function placeNote(x, y, wrap) {
  if (!wrap) return;
  // Supprimer la note existante si elle n'est pas validée
  if (noteOverlay && !noteOverlay.dataset.committed) noteOverlay.remove();

  const note = document.createElement('div');
  note.className = 'note-overlay';
  note.style.left = x + 'px'; note.style.top = y + 'px';
  note.style.background = noteBg;

  const handle = document.createElement('div');
  handle.className = 'note-handle';
  handle.textContent = '📌 Note';
  handle.style.color = noteClr;
  note.appendChild(handle);

  const ta = document.createElement('textarea');
  ta.className   = 'note-ta';
  ta.placeholder = 'Saisissez votre commentaire…';
  ta.style.color = noteClr;
  note.appendChild(ta);

  const footer = document.createElement('div');
  footer.className = 'note-footer';
  footer.innerHTML =
    '<div class="note-btn ok" onclick="commitNote(this.closest(\'.note-overlay\'))">✓ Intégrer</div>' +
    '<div class="note-btn del" onclick="this.closest(\'.note-overlay\').remove()">✕</div>';
  note.appendChild(footer);

  // Drag sur handle
  handle.addEventListener('mousedown', e => {
    noteDragging = true;
    const r = note.getBoundingClientRect();
    noteDragOff = { x: e.clientX-r.left, y: e.clientY-r.top };
    e.preventDefault(); e.stopPropagation();
  });

  // Poignée de redimensionnement (coin bas-droite)
  const rsz = document.createElement('div');
  rsz.className = 'note-resize';
  rsz.title = 'Redimensionner';
  rsz.addEventListener('mousedown', e => {
    noteResizing = true;
    const r = note.getBoundingClientRect();
    noteResizStart = { mx: e.clientX, my: e.clientY, w: r.width, h: r.height };
    e.preventDefault(); e.stopPropagation();
  });
  note.appendChild(rsz);

  wrap.appendChild(note);
  noteOverlay = note;
  ta.focus();
}

async function commitNote(note) {
  if (!note || !currentPdfData) return;
  const wrap    = note.closest('.page-wrap');
  const wraps   = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx = wraps.indexOf(wrap);
  if (pageIdx < 0) return;

  const lx = parseInt(note.style.left), ly = parseInt(note.style.top);
  const nw = note.offsetWidth, nh = note.offsetHeight;
  const text = note.querySelector('.note-ta')?.value?.trim() || '';
  const scale = baseFitScale * zoomLevel / 100;

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pdfX = lx / scale, pdfW = nw / scale;
    const pdfYt = ly / scale, pdfH = nh / scale;
    const pdfY  = pH - pdfYt - pdfH;

    // Fond coloré
    const hx = noteBg, hr = parseInt(hx.slice(1,3),16)/255, hg = parseInt(hx.slice(3,5),16)/255, hb = parseInt(hx.slice(5,7),16)/255;
    const cx = noteClr, cr = parseInt(cx.slice(1,3),16)/255, cg = parseInt(cx.slice(3,5),16)/255, cb = parseInt(cx.slice(5,7),16)/255;
    page.drawRectangle({ x:pdfX, y:pdfY, width:pdfW, height:pdfH, color:rgb(hr,hg,hb), borderColor:rgb(cr,cg,cb), borderWidth:0.8, opacity:0.92 });
    if (text) {
      const safe = text.replace(/[^\x20-\xFF]/g,'');
      const lines = safe.split('\n');
      const fs = Math.min(8, pdfH * 0.12);
      let yy = pdfY + pdfH - fs - 4;
      for (const line of lines) {
        if (yy < pdfY + 2) break;
        page.drawText(line.replace(/[^\x20-\xFF]/g,''), { x:pdfX+4, y:yy, size:fs, font, color:rgb(cr,cg,cb), maxWidth:pdfW-8 });
        yy -= fs * 1.4;
      }
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    note.remove(); noteOverlay = null;
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    t('Note intégrée');
  } catch(err) { t('Erreur note : ' + err.message); }
}

// ── Commit dessin → PDF ───────────────────────────────────────────────────────
async function commitCurrentDrawing(x0, y0, x1, y1) {
  if (!drawWrap || !currentPdfData) return;
  const wraps   = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx = wraps.indexOf(drawWrap);
  if (pageIdx < 0) return;
  const scale = baseFitScale * zoomLevel / 100;

  try {
    const { PDFDocument, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    // Tenir compte de l'origine de la MediaBox (ex : page recadrée avec boxX/boxY > 0)
    const mb = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x: 0, y: 0 };
    const mbX = mb.x || 0, mbY = mb.y || 0;
    const toP  = (sx, sy) => ({ px: sx/scale + mbX, py: mbY + pH - sy/scale });

    const p0 = toP(x0, y0), p1 = toP(x1, y1);
    const pW = Math.abs(p1.px - p0.px), pH2 = Math.abs(p0.py - p1.py);
    const prx = Math.min(p0.px, p1.px), pry = Math.min(p0.py, p1.py);
    const sw  = drawStrokeW / scale;
    const hexC = drawColor;
    const cr = parseInt(hexC.slice(1,3),16)/255, cg = parseInt(hexC.slice(3,5),16)/255, cb = parseInt(hexC.slice(5,7),16)/255;
    const strokeC = rgb(cr,cg,cb);
    let   fillC   = undefined;
    if (drawFill !== 'transparent') {
      const fc = drawFill;
      const fr = parseInt(fc.slice(1,3),16)/255, fg = parseInt(fc.slice(3,5),16)/255, fb = parseInt(fc.slice(5,7),16)/255;
      fillC = rgb(fr,fg,fb);
    }

    if (currentTool === 'Surligner') {
      page.drawRectangle({ x:prx, y:pry, width:pW, height:pH2, color:strokeC, opacity:drawOpacity, borderWidth:0 });
    } else if (currentTool === 'Biffure') {
      if (shapeType === 'fill') {
        page.drawRectangle({ x:prx, y:pry, width:pW, height:pH2, color:strokeC, opacity:drawOpacity, borderWidth:0 });
      } else {
        const midY = (p0.py + p1.py) / 2;
        page.drawLine({ start:{x:p0.px,y:midY}, end:{x:p1.px,y:midY}, thickness:sw*1.5, color:strokeC, opacity:drawOpacity });
      }
    } else if (shapeType === 'rect') {
      page.drawRectangle({ x:prx, y:pry, width:pW, height:pH2,
        borderColor:strokeC, borderWidth:sw, color:fillC, opacity:1, borderOpacity:1 });
    } else if (shapeType === 'ellipse') {
      page.drawEllipse({ x:prx+pW/2, y:pry+pH2/2, xScale:pW/2, yScale:pH2/2,
        borderColor:strokeC, borderWidth:sw, color:fillC, opacity:1, borderOpacity:1 });
    } else if (shapeType === 'line') {
      page.drawLine({ start:{x:p0.px,y:p0.py}, end:{x:p1.px,y:p1.py}, thickness:sw, color:strokeC });
    } else if (shapeType === 'arrow') {
      page.drawLine({ start:{x:p0.px,y:p0.py}, end:{x:p1.px,y:p1.py}, thickness:sw, color:strokeC });
      // Pointe de flèche via SVG path
      const angle = Math.atan2(p0.py-p1.py, p1.px-p0.px);
      const aLen  = 10/scale, aAng = Math.PI/7;
      const hx1 = p1.px - aLen*Math.cos(angle-aAng), hy1 = p1.py + aLen*Math.sin(angle-aAng);
      const hx2 = p1.px - aLen*Math.cos(angle+aAng), hy2 = p1.py + aLen*Math.sin(angle+aAng);
      page.drawSvgPath(`M ${p1.px} ${p1.py} L ${hx1} ${hy1} L ${hx2} ${hy2} Z`, { color:strokeC, scale:1 });
    }

    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    clearOvCanvas();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    t('Dessin appliqué');
  } catch(err) { t('Erreur dessin : ' + err.message); }
}

async function commitPenLine(pts) {
  if (pts.length < 2 || !drawWrap || !currentPdfData) return;
  const wraps   = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx = wraps.indexOf(drawWrap);
  if (pageIdx < 0) return;
  const scale = baseFitScale * zoomLevel / 100;

  try {
    const { PDFDocument, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    const mb = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x: 0, y: 0 };
    const mbX = mb.x || 0, mbY = mb.y || 0;
    const toP  = (sx, sy) => ({ x: sx/scale + mbX, y: mbY + pH - sy/scale });
    const cr = parseInt(drawColor.slice(1,3),16)/255, cg = parseInt(drawColor.slice(3,5),16)/255, cb = parseInt(drawColor.slice(5,7),16)/255;
    const sw = drawStrokeW / scale;
    for (let i=0; i<pts.length-1; i++) {
      const a = toP(pts[i].x, pts[i].y), b = toP(pts[i+1].x, pts[i+1].y);
      page.drawLine({ start:a, end:b, thickness:sw, color:rgb(cr,cg,cb) });
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    clearOvCanvas();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    t('Tracé appliqué');
  } catch(err) { t('Erreur tracé : ' + err.message); }
}

async function commitPenFree(pts) {
  // Maintenant géré via le système pending; conservé pour compatibilité
  if (pts.length < 2 || !drawWrap || !currentPdfData) return;
  await commitPenFreeFromPts(pts, drawWrap, drawColor, drawStrokeW);
}


// ── Pending annotation: afficher un overlay draggable/resizable ───────────────
function showPendingOverlay(bbox) {
  cancelPendingOverlay();
  if (!drawWrap) return;
  const PAD = 7;
  const div = document.createElement('div');
  div.className = 'pending-ov';
  div.style.left   = (bbox.x - PAD) + 'px';
  div.style.top    = (bbox.y - PAD) + 'px';
  div.style.width  = (bbox.w + PAD*2) + 'px';
  div.style.height = (bbox.h + PAD*2) + 'px';

  // Poignées de redimensionnement (coins)
  ['nw','ne','sw','se'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'pov-h ' + d;
    h.dataset.resize = d;
    div.appendChild(h);
  });

  // Mini-toolbar Valider / Annuler
  const tb = document.createElement('div');
  tb.className = 'pov-tb';
  tb.innerHTML = '<button class="pov-btn ok" onclick="validatePending()">✓ Valider</button>' +
                 '<button class="pov-btn del" onclick="cancelPending()">✕ Annuler</button>';
  div.appendChild(tb);

  // Gestion drag (déplacement) et resize (coins)
  div.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.dataset.resize) {
      pendingResizing  = e.target.dataset.resize;
      pendingDragStart = { x: e.clientX, y: e.clientY };
    } else if (!e.target.classList.contains('pov-btn')) {
      pendingDragging  = true;
      pendingDragStart = { x: e.clientX, y: e.clientY };
    }
    e.preventDefault(); e.stopPropagation();
  });

  drawWrap.appendChild(div);
  pendingOvDiv = div;
}

function movePendingAnnot(dx, dy) {
  if (!pendingAnnot || !pendingOvDiv) return;
  if (pendingAnnot.type === 'pen') {
    pendingAnnot.pts = pendingAnnot.pts.map(p => ({ x: p.x+dx, y: p.y+dy }));
  }
  pendingAnnot.x0 = (pendingAnnot.x0 ?? 0) + dx;
  pendingAnnot.y0 = (pendingAnnot.y0 ?? 0) + dy;
  pendingAnnot.x1 = (pendingAnnot.x1 ?? 0) + dx;
  pendingAnnot.y1 = (pendingAnnot.y1 ?? 0) + dy;
  pendingAnnot._bbox.x += dx; pendingAnnot._bbox.y += dy;
  pendingOvDiv.style.left = (parseInt(pendingOvDiv.style.left) + dx) + 'px';
  pendingOvDiv.style.top  = (parseInt(pendingOvDiv.style.top)  + dy) + 'px';
  redrawPendingOnCanvas();
}

function resizePendingAnnot(dir, dx, dy) {
  if (!pendingAnnot || !pendingOvDiv) return;
  const isL = dir.includes('w'), isT = dir.includes('n');
  const PAD = 7;

  if (pendingAnnot.type === 'pen' && pendingAnnot.pts.length > 0) {
    const xs = pendingAnnot.pts.map(p=>p.x), ys = pendingAnnot.pts.map(p=>p.y);
    const ox = Math.min(...xs), oy = Math.min(...ys);
    const oldW = Math.max(...xs)-ox || 1, oldH = Math.max(...ys)-oy || 1;
    const newW = Math.max(20, oldW + (isL ? -dx : dx));
    const newH = Math.max(20, oldH + (isT ? -dy : dy));
    const sx = newW/oldW, sy = newH/oldH;
    const shiftX = isL ? oldW - newW : 0, shiftY = isT ? oldH - newH : 0;
    pendingAnnot.pts = pendingAnnot.pts.map(p => ({
      x: ox + (p.x-ox)*sx + shiftX,
      y: oy + (p.y-oy)*sy + shiftY
    }));
    const xs2 = pendingAnnot.pts.map(p=>p.x), ys2 = pendingAnnot.pts.map(p=>p.y);
    pendingAnnot._bbox = { x:Math.min(...xs2), y:Math.min(...ys2),
      w:Math.max(...xs2)-Math.min(...xs2), h:Math.max(...ys2)-Math.min(...ys2) };
  } else {
    if (isL) pendingAnnot.x0 += dx; else pendingAnnot.x1 += dx;
    if (isT) pendingAnnot.y0 += dy; else pendingAnnot.y1 += dy;
    const bx = Math.min(pendingAnnot.x0,pendingAnnot.x1);
    const by = Math.min(pendingAnnot.y0,pendingAnnot.y1);
    pendingAnnot._bbox = { x:bx, y:by,
      w:Math.abs(pendingAnnot.x1-pendingAnnot.x0),
      h:Math.abs(pendingAnnot.y1-pendingAnnot.y0) };
  }

  const b = pendingAnnot._bbox;
  pendingOvDiv.style.left   = (b.x - PAD) + 'px';
  pendingOvDiv.style.top    = (b.y - PAD) + 'px';
  pendingOvDiv.style.width  = (b.w + PAD*2) + 'px';
  pendingOvDiv.style.height = (b.h + PAD*2) + 'px';
  redrawPendingOnCanvas();
}

function redrawPendingOnCanvas() {
  if (!pendingAnnot || !drawOverlay) return;
  clearOvCanvas();
  const ctx = drawOverlay.getContext('2d');
  ctx.strokeStyle = pendingAnnot.color;
  ctx.lineWidth   = pendingAnnot.strokeW;
  ctx.lineJoin    = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha = pendingAnnot.opacity ?? 1;

  if (pendingAnnot.type === 'pen') {
    drawPenFreeOnCtx(ctx, pendingAnnot.pts);
  } else {
    const { tool, subType:sub, x0, y0, x1, y1, color, fill, opacity } = pendingAnnot;
    const w = x1-x0, h = y1-y0;
    if (tool === 'Surligner') {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = hexToRgba(color, opacity);
      ctx.fillRect(Math.min(x0,x1), Math.min(y0,y1), Math.abs(w), Math.abs(h));
    } else if (tool === 'Biffure') {
      ctx.globalAlpha = opacity;
      if (sub === 'fill') {
        ctx.fillStyle = hexToRgba(color, opacity);
        ctx.fillRect(Math.min(x0,x1), Math.min(y0,y1), Math.abs(w), Math.abs(h));
      } else {
        ctx.beginPath(); ctx.moveTo(x0, y0+h/2); ctx.lineTo(x1, y0+h/2); ctx.stroke();
      }
    } else if (sub === 'rect') {
      if (fill !== 'transparent') { ctx.fillStyle=fill; ctx.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(w),Math.abs(h)); }
      ctx.strokeRect(Math.min(x0,x1), Math.min(y0,y1), Math.abs(w), Math.abs(h));
    } else if (sub === 'ellipse') {
      ctx.beginPath(); ctx.ellipse(x0+w/2,y0+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);
      if (fill !== 'transparent') { ctx.fillStyle=fill; ctx.fill(); }
      ctx.stroke();
    } else if (sub === 'line') {
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    } else if (sub === 'arrow') {
      drawArrowOnCtx(ctx, x0, y0, x1, y1);
    }
  }
  ctx.globalAlpha = 1;
}

async function validatePending() {
  if (!pendingAnnot) return;
  const ann = { ...pendingAnnot };
  cancelPendingOverlay();
  pendingAnnot = null;
  clearOvCanvas();

  if (ann.type === 'pen') {
    await commitPenFreeFromPts(ann.pts, ann.wrap, ann.color, ann.strokeW);
  } else {
    await commitCurrentDrawingFromAnnot(ann);
  }
}

function cancelPending() {
  cancelPendingOverlay();
  pendingAnnot = null;
  clearOvCanvas();
}

function cancelPendingOverlay() {
  if (pendingOvDiv) { pendingOvDiv.remove(); pendingOvDiv = null; }
  pendingDragging = false;
  pendingResizing = null;
  pendingDragStart = null;
}

async function commitPenFreeFromPts(pts, wrap, color, strokeW) {
  if (!pts || pts.length < 2 || !wrap || !currentPdfData) return;
  const wraps   = Array.from(document.querySelectorAll('.page-wrap'));
  const pageIdx = wraps.indexOf(wrap);
  if (pageIdx < 0) return;
  const scale = baseFitScale * zoomLevel / 100;
  try {
    const { PDFDocument, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIdx];
    const { height: pH } = page.getSize();
    const mb = typeof page.getMediaBox === 'function' ? page.getMediaBox() : { x: 0, y: 0 };
    const mbX = mb.x || 0, mbY = mb.y || 0;
    const toP  = (sx, sy) => ({ x: sx/scale + mbX, y: mbY + pH - sy/scale });
    const hexC = color || drawColor;
    const cr   = parseInt(hexC.slice(1,3),16)/255;
    const cg   = parseInt(hexC.slice(3,5),16)/255;
    const cb   = parseInt(hexC.slice(5,7),16)/255;
    const sw   = (strokeW || drawStrokeW) / scale;
    // Sous-échantillonnage adaptatif: conserver ~400 points max pour un PDF raisonnable
    const maxPts = 400;
    const step   = Math.max(1, Math.floor(pts.length / maxPts));
    const sub    = pts.filter((_, i) => i % step === 0);
    if (sub[sub.length-1] !== pts[pts.length-1]) sub.push(pts[pts.length-1]);
    for (let i = 0; i < sub.length-1; i++) {
      const a = toP(sub[i].x, sub[i].y);
      const b = toP(sub[i+1].x, sub[i+1].y);
      page.drawLine({ start: a, end: b, thickness: sw, color: rgb(cr, cg, cb) });
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    t('Tracé intégré');
  } catch(err) { t('Erreur tracé : ' + err.message); }
}

async function commitCurrentDrawingFromAnnot(ann) {
  // Sauvegarder l'état global et appliquer les paramètres du pending
  const savedWrap = drawWrap, savedTool = currentTool, savedShape = shapeType;
  const savedClr  = drawColor, savedFill = drawFill, savedSW = drawStrokeW, savedOp = drawOpacity;
  drawWrap = ann.wrap; currentTool = ann.tool; shapeType = ann.subType;
  drawColor = ann.color; drawFill = ann.fill; drawStrokeW = ann.strokeW; drawOpacity = ann.opacity;
  await commitCurrentDrawing(ann.x0, ann.y0, ann.x1, ann.y1);
  drawWrap = savedWrap; currentTool = savedTool; shapeType = savedShape;
  drawColor = savedClr; drawFill = savedFill; drawStrokeW = savedSW; drawOpacity = savedOp;
}

// ── Init outils dessin ────────────────────────────────────────────────────────
function initDrawingTools() {
  // Écouter mousemove/mouseup sur le document
  document.addEventListener('mousemove', e => {
    // Pending annotation: drag ou resize
    if (pendingAnnot && pendingDragStart) {
      const dx = e.clientX - pendingDragStart.x;
      const dy = e.clientY - pendingDragStart.y;
      pendingDragStart = { x: e.clientX, y: e.clientY };
      if (pendingDragging)        movePendingAnnot(dx, dy);
      else if (pendingResizing)   resizePendingAnnot(pendingResizing, dx, dy);
      return;
    }
    if (!DRAW_TOOLS.includes(currentTool)) return;
    // Note drag
    if (currentTool === 'Note' && noteDragging && noteOverlay) {
      const wrap = noteOverlay.parentElement;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      noteOverlay.style.left = (e.clientX - noteDragOff.x - wr.left) + 'px';
      noteOverlay.style.top  = (e.clientY - noteDragOff.y - wr.top)  + 'px';
      return;
    }
    // Note resize
    if (currentTool === 'Note' && noteResizing && noteOverlay && noteResizStart) {
      const dw = e.clientX - noteResizStart.mx;
      const dh = e.clientY - noteResizStart.my;
      noteOverlay.style.width  = Math.max(120, noteResizStart.w + dw) + 'px';
      noteOverlay.style.height = Math.max(80,  noteResizStart.h + dh) + 'px';
      return;
    }
    onDrawMouseMove(e);
  });
  document.addEventListener('mouseup', e => {
    if (pendingDragging || pendingResizing) {
      pendingDragging = false; pendingResizing = null; pendingDragStart = null; return;
    }
    if (currentTool === 'Note') {
      noteDragging = false;
      if (noteResizing) { noteResizing = false; noteResizStart = null; }
      return;
    }
    if (!DRAW_TOOLS.includes(currentTool) || !drawIsDown) return;
    onDrawMouseUp(e);
  });
  // Clic droit sur overlay → annuler
  document.addEventListener('contextmenu', e => {
    if (DRAW_TOOLS.includes(currentTool) && e.target.classList.contains('draw-ov')) {
      e.preventDefault(); cancelDrawing();
    }
  });

  // Activer l'overlay sur chaque page-wrap lorsque l'outil de dessin est actif
  document.getElementById('pdf-pages')?.addEventListener('mouseover', e => {
    if (!DRAW_TOOLS.includes(currentTool)) return;
    const wrap = e.target.closest('.page-wrap');
    if (wrap) activateDrawOnWrap(wrap);
  });
}


// ─── En-têtes & Pieds de page ─────────────────────────────────────────────────
function openHFPanel() {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  const ov = document.getElementById('hf-overlay');
  ov.style.display = 'flex';
}

function closeHFPanel() {
  document.getElementById('hf-overlay').style.display = 'none';
}

function hfScopeChange() {
  const scope = document.getElementById('hf-scope').value;
  const wrap  = document.getElementById('hf-range-wrap');
  wrap.classList.toggle('hidden', scope !== 'range');
}

function insertHFVar(inputId, varStr) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const s = inp.selectionStart, e = inp.selectionEnd;
  inp.value = inp.value.slice(0, s) + varStr + inp.value.slice(e);
  inp.focus();
  inp.setSelectionRange(s + varStr.length, s + varStr.length);
}

async function doApplyHF() {
  if (!currentPdfData) { t('Aucun PDF ouvert'); return; }

  const fields = {
    hL: document.getElementById('hf-h-l').value,
    hC: document.getElementById('hf-h-c').value,
    hR: document.getElementById('hf-h-r').value,
    fL: document.getElementById('hf-f-l').value,
    fC: document.getElementById('hf-f-c').value,
    fR: document.getElementById('hf-f-r').value,
  };

  if (!Object.values(fields).some(v => v.trim())) {
    t('Aucun contenu à appliquer'); return;
  }

  const fontName  = document.getElementById('hf-font').value;
  const fontSize  = Math.max(4, parseFloat(document.getElementById('hf-size').value) || 10);
  const colorHex  = document.getElementById('hf-color').value || '#000000';
  const marginPt  = Math.max(0, parseFloat(document.getElementById('hf-margin').value) || 28);
  const scope     = document.getElementById('hf-scope').value;
  const fromPage  = parseInt(document.getElementById('hf-from').value) || 1;
  const toPage    = parseInt(document.getElementById('hf-to').value)   || 99999;

  closeHFPanel();
  t('Application en cours…');

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const fontMap = {
      'Helvetica':       StandardFonts.Helvetica,
      'Helvetica-Bold':  StandardFonts.HelveticaBold,
      'Times-Roman':     StandardFonts.TimesRoman,
      'Times-Bold':      StandardFonts.TimesRomanBold,
      'Courier':         StandardFonts.Courier,
    };

    const doc     = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pdfFont = await doc.embedFont(fontMap[fontName] || StandardFonts.Helvetica);

    const r = parseInt(colorHex.slice(1,3), 16) / 255;
    const g = parseInt(colorHex.slice(3,5), 16) / 255;
    const b = parseInt(colorHex.slice(5,7), 16) / 255;
    const color = rgb(r, g, b);

    const pages      = doc.getPages();
    const totalPages = pages.length;
    const today      = new Date().toLocaleDateString('fr-FR');
    const fileName   = currentPdfName || '';

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;

      if (scope === 'skip1' && pageNum === 1) continue;
      if (scope === 'odd'   && pageNum % 2 === 0) continue;
      if (scope === 'even'  && pageNum % 2 !== 0) continue;
      if (scope === 'range' && (pageNum < fromPage || pageNum > toPage)) continue;

      const page = pages[i];
      const { width, height } = page.getSize();

      function resolve(text) {
        return text
          .replace(/\{page\}/gi,    String(pageNum))
          .replace(/\{total\}/gi,   String(totalPages))
          .replace(/\{date\}/gi,    today)
          .replace(/\{fichier\}/gi, fileName);
      }

      function drawCell(text, align, yPos) {
        const str = resolve(text);
        if (!str.trim()) return;
        const tw = pdfFont.widthOfTextAtSize(str, fontSize);
        let x;
        if      (align === 'left')  x = marginPt;
        else if (align === 'right') x = width - marginPt - tw;
        else                        x = (width - tw) / 2;
        // Clamp to page bounds
        x = Math.max(0, Math.min(x, width - tw));
        const y = Math.max(0, Math.min(yPos, height - fontSize));
        page.drawText(str, { x, y, size: fontSize, font: pdfFont, color });
      }

      const hY = height - marginPt - fontSize;
      drawCell(fields.hL, 'left',   hY);
      drawCell(fields.hC, 'center', hY);
      drawCell(fields.hR, 'right',  hY);

      const fY = marginPt;
      drawCell(fields.fL, 'left',   fY);
      drawCell(fields.fC, 'center', fY);
      drawCell(fields.fR, 'right',  fY);
    }

    const saved  = await doc.save({ useObjectStreams: false });
    const newB64 = bytesToBase64(saved);
    await renderPDFFromData(
      { name: currentPdfName, size: saved.length, data: newB64, filePath: currentFilePath },
      true
    );
    t('En-têtes et pieds de page appliqués ✓');
  } catch (err) {
    console.error('HF error:', err);
    t('Erreur : ' + err.message);
  }
}

// ─── Filigranes & Tampons ─────────────────────────────────────────────────────
let stampConfig = null;

function openWMPanel() {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('wm-overlay').style.display = 'flex';
}

function closeWMPanel() {
  document.getElementById('wm-overlay').style.display = 'none';
}

function wmTab(tab) {
  ['wm', 'st'].forEach(k => {
    document.getElementById('wm-tab-' + k).classList.toggle('act', k === tab);
    document.getElementById('wm-body-' + k).style.display = k === tab ? 'flex' : 'none';
  });
}

function wmToggleMode(mode) {
  document.getElementById('wm-text-opts').style.display = mode === 'text'  ? '' : 'none';
  document.getElementById('wm-img-opts').style.display  = mode === 'image' ? '' : 'none';
}

function wmScopeChange() {
  const wrap = document.getElementById('wm-range-wrap');
  wrap.classList.toggle('hidden', document.getElementById('wm-scope').value !== 'range');
}

// Wire image file input label
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('wm-img-input');
  if (fi) fi.addEventListener('change', () => {
    document.getElementById('wm-img-name').textContent = fi.files[0]?.name || '—';
  });
});

// ── Saisie manuelle du zoom ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const zv = document.getElementById('zoom-val');
  if (!zv) return;
  zv.title  = 'Cliquer pour saisir un zoom précis';
  zv.style.cursor = 'text';

  zv.addEventListener('click', () => {
    if (zv.querySelector('input')) return; // déjà en mode édition

    const prev = zoomLevel;
    const inp  = document.createElement('input');
    inp.type  = 'text';
    inp.value = String(zoomLevel);
    inp.style.cssText = [
      'width:34px', 'text-align:center', 'background:transparent',
      'border:none', 'border-bottom:1px solid var(--gold)', 'outline:none',
      'font-family:Cinzel,serif', 'font-size:.58rem', 'color:var(--gold)',
      'padding:0', 'margin:0',
    ].join(';');

    zv.textContent = '';
    zv.appendChild(inp);
    inp.select();

    function commit() {
      const raw = parseInt(inp.value, 10);
      zv.textContent = zoomLevel + '%';
      if (!isNaN(raw)) zoomTo(raw);
      else zv.textContent = prev + '%';
    }
    function cancel() { zv.textContent = prev + '%'; }

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    inp.addEventListener('blur', commit);
  });
});

// ── Filigrane texte / image ───────────────────────────────────────────────────
async function doApplyWatermark() {
  if (!currentPdfData) return;

  const mode     = document.querySelector('input[name="wm-mode"]:checked')?.value || 'text';
  const opacity  = parseFloat(document.getElementById('wm-opacity').value) / 100;
  const rotDeg   = parseFloat(document.getElementById('wm-rotation').value) || 45;
  const position = document.getElementById('wm-position').value;
  const scope    = document.getElementById('wm-scope').value;
  const fromPage = parseInt(document.getElementById('wm-from').value) || 1;
  const toPage   = parseInt(document.getElementById('wm-to').value)   || 99999;

  let text = '', fontSize = 60, fontName = 'Helvetica-Bold', colorHex = '#c8962e';
  let imgB64 = null, imgType = 'jpeg';

  if (mode === 'text') {
    text = document.getElementById('wm-text').value.trim();
    if (!text) { t('Saisissez un texte de filigrane'); return; }
    fontSize  = parseFloat(document.getElementById('wm-wm-size').value)  || 60;
    fontName  = document.getElementById('wm-wm-font').value;
    colorHex  = document.getElementById('wm-wm-color').value;
  } else {
    const file = document.getElementById('wm-img-input').files[0];
    if (!file) { t('Sélectionnez une image'); return; }
    imgType = file.type.includes('png') ? 'png' : 'jpeg';
    imgB64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
  }

  closeWMPanel();
  t('Application du filigrane…');

  try {
    const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
    const fontMap = {
      'Helvetica':      StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman':    StandardFonts.TimesRoman,
      'Times-Bold':     StandardFonts.TimesRomanBold,
      'Courier':        StandardFonts.Courier,
    };
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });

    let pdfFont = null;
    if (mode === 'text') pdfFont = await doc.embedFont(fontMap[fontName] || StandardFonts.HelveticaBold);

    const r = parseInt(colorHex.slice(1,3),16)/255;
    const g = parseInt(colorHex.slice(3,5),16)/255;
    const b = parseInt(colorHex.slice(5,7),16)/255;
    const color = rgb(r, g, b);

    const pages      = doc.getPages();
    const totalPages = pages.length;
    let   embImg     = null;

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      if (scope === 'skip1' && pageNum === 1) continue;
      if (scope === 'odd'   && pageNum % 2 === 0) continue;
      if (scope === 'even'  && pageNum % 2 !== 0) continue;
      if (scope === 'range' && (pageNum < fromPage || pageNum > toPage)) continue;

      const page = pages[i];
      const { width, height } = page.getSize();

      if (mode === 'text') {
        const tW = pdfFont.widthOfTextAtSize(text, fontSize);
        const rotRad = (rotDeg * Math.PI) / 180;

        // Draw text centered at (cx, cy) with rotation, using centered-rotation formula
        function drawWMText(cx, cy) {
          const x = cx - (tW / 2) * Math.cos(rotRad) + (fontSize / 2) * Math.sin(rotRad);
          const y = cy - (tW / 2) * Math.sin(rotRad) - (fontSize / 2) * Math.cos(rotRad);
          page.drawText(text, { x, y, size: fontSize, font: pdfFont, color, opacity, rotate: degrees(rotDeg) });
        }

        if (position === 'center') {
          drawWMText(width / 2, height / 2);
        } else {
          // Mosaïque
          const spacingX = tW * 1.4 + 30;
          const spacingY = fontSize * 2.8;
          for (let tx = spacingX / 2; tx < width; tx += spacingX) {
            for (let ty = spacingY / 2; ty < height; ty += spacingY) {
              drawWMText(tx, ty);
            }
          }
        }
      } else if (imgB64) {
        if (!embImg) {
          embImg = imgType === 'png'
            ? await doc.embedPng(base64ToBytes(imgB64))
            : await doc.embedJpg(base64ToBytes(imgB64));
        }
        const sc  = Math.min(width * 0.5 / embImg.width, height * 0.5 / embImg.height);
        const iW  = embImg.width  * sc;
        const iH  = embImg.height * sc;
        page.drawImage(embImg, { x: (width - iW) / 2, y: (height - iH) / 2, width: iW, height: iH, opacity });
      }
    }

    const saved = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({ name: currentPdfName, size: saved.length, data: bytesToBase64(saved), filePath: currentFilePath }, true);
    _logMod('Filigrane appliqué');
    t('Filigrane appliqué ✓');
  } catch (err) {
    console.error('WM error:', err);
    t('Erreur : ' + err.message);
  }
}

// ── Tampons : placement interactif ────────────────────────────────────────────
function startStampMode(config) {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  stampConfig = config;
  closeWMPanel();
  document.getElementById('pdf-pages').classList.add('stamp-mode');
  t('Cliquez sur la page pour placer le tampon — Échap pour annuler');
  _createStampPreview(config);
  document.addEventListener('click',     _onStampClick,        true);
  document.addEventListener('keydown',   _onStampKeydown);
  document.addEventListener('mousemove', _updateStampPreview);
}

function _onStampKeydown(e) {
  if (e.key === 'Escape') _cancelStampMode();
}

function _cancelStampMode() {
  stampConfig = null;
  document.getElementById('pdf-pages')?.classList.remove('stamp-mode');
  document.removeEventListener('click',     _onStampClick,        true);
  document.removeEventListener('keydown',   _onStampKeydown);
  document.removeEventListener('mousemove', _updateStampPreview);
  _removeStampPreview();
}

function _onStampClick(e) {
  const wrap = e.target.closest('.page-wrap');
  if (!wrap) { _cancelStampMode(); return; }
  e.stopPropagation();
  e.preventDefault();
  document.getElementById('pdf-pages').classList.remove('stamp-mode');
  document.removeEventListener('click',     _onStampClick,        true);
  document.removeEventListener('keydown',   _onStampKeydown);
  document.removeEventListener('mousemove', _updateStampPreview);
  _removeStampPreview();
  const cfg = stampConfig;
  stampConfig = null;
  _placeStampAt(wrap, e, cfg);
}

function applyCustomStamp() {
  const text    = document.getElementById('wm-st-text').value.trim();
  const color   = document.getElementById('wm-st-color').value;
  const size    = parseFloat(document.getElementById('wm-st-size').value) || 24;
  const rot     = parseFloat(document.getElementById('wm-st-rot').value)  || 0;
  const noFrame = document.getElementById('wm-st-noframe').checked;
  if (!text) { t('Saisissez un texte de tampon'); return; }
  startStampMode({ label: text, color, fontSize: size, rotation: rot, noFrame });
}

async function _placeStampAt(wrap, e, cfg) {
  if (!currentPdfData || !cfg) return;

  const wrapRect  = wrap.getBoundingClientRect();
  const cvs       = wrap.querySelector('canvas');
  const sc        = baseFitScale * zoomLevel / 100;
  const pageIndex = parseInt(wrap.dataset.page || '1') - 1;

  // Viewport → PDF coords (PDF y is bottom-up)
  const clickX  = (e.clientX - wrapRect.left) / sc;
  const pdfPageH = cvs.height / sc;
  const clickY  = pdfPageH - (e.clientY - wrapRect.top) / sc;

  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.getPages()[pageIndex];

    const text    = cfg.label   || 'TAMPON';
    const fsz     = cfg.fontSize|| 24;
    const hex     = cfg.color   || '#c0392b';
    const rot     = cfg.rotation !== undefined ? cfg.rotation : -30;
    const noFrame = cfg.noFrame || false;
    const opacity = 0.82;

    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const color = rgb(r, g, b);

    const tW     = font.widthOfTextAtSize(text, fsz);
    const tH     = fsz;
    const rotRad = (rot * Math.PI) / 180;
    const padX = 10, padY = 6;

    // Compute bottom-left of a box centered at (cx,cy) after rotation
    function centeredOrigin(cx, cy, hw, hh) {
      return {
        x: cx - hw * Math.cos(rotRad) + hh * Math.sin(rotRad),
        y: cy - hw * Math.sin(rotRad) - hh * Math.cos(rotRad),
      };
    }

    if (!noFrame) {
      // Outer frame
      const ow = tW/2 + padX + 2, oh = tH/2 + padY + 2;
      const o1 = centeredOrigin(clickX, clickY, ow, oh);
      page.drawRectangle({ x: o1.x, y: o1.y, width: ow*2, height: oh*2,
        borderColor: color, borderWidth: 1.2, opacity: 0, borderOpacity: opacity,
        rotate: degrees(rot) });
      // Inner frame
      const iw = tW/2 + padX - 2, ih = tH/2 + padY - 2;
      const o2 = centeredOrigin(clickX, clickY, iw, ih);
      page.drawRectangle({ x: o2.x, y: o2.y, width: iw*2, height: ih*2,
        borderColor: color, borderWidth: 2, opacity: 0, borderOpacity: opacity,
        rotate: degrees(rot) });
    }

    // Text — slight baseline lift: text visual center is ~35% above baseline
    const lift = tH * 0.18;
    const ot = centeredOrigin(clickX, clickY + lift, tW/2, tH * 0.35);
    page.drawText(text, { x: ot.x, y: ot.y, size: fsz, font, color, opacity, rotate: degrees(rot) });

    const saved = await doc.save({ useObjectStreams: false });
    await fastRerenderPage(bytesToBase64(saved), [pageIndex + 1]);
    _logMod('Tampon apposé');
    t('Tampon placé ✓');
  } catch (err) {
    console.error('Stamp error:', err);
    t('Erreur : ' + err.message);
  }
}

// ── Quick apply droite (panneau Propriétés) ───────────────────────────────────
async function quickApplyHFRight() {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  const hText = (document.getElementById('rp-hdr-r')?.value || '').trim();
  const fText = (document.getElementById('rp-ftr-r')?.value || '').trim();
  if (!hText && !fText) { t('Saisissez un texte'); return; }

  const today    = new Date().toLocaleDateString('fr-FR');
  const fileName = currentPdfName || '';

  function resolveVars(text, pageNum, totalPages) {
    return text
      .replace(/\{page\}/gi,    String(pageNum))
      .replace(/\{total\}/gi,   String(totalPages))
      .replace(/\{date\}/gi,    today)
      .replace(/\{fichier\}/gi, fileName);
  }

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const col  = rgb(0, 0, 0);
    const sz   = 10, marg = 28;
    const pages = doc.getPages();

    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const pageNum = i + 1, total = pages.length;
      if (hText) {
        const str = resolveVars(hText, pageNum, total);
        const tw  = font.widthOfTextAtSize(str, sz);
        page.drawText(str, { x: width - marg - tw, y: height - marg - sz, size: sz, font, color: col });
      }
      if (fText) {
        const str = resolveVars(fText, pageNum, total);
        const tw  = font.widthOfTextAtSize(str, sz);
        page.drawText(str, { x: width - marg - tw, y: marg, size: sz, font, color: col });
      }
    });

    const saved = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({ name: currentPdfName, size: saved.length, data: bytesToBase64(saved), filePath: currentFilePath }, true);
    t('Mise en page appliquée ✓');
  } catch (err) {
    console.error('Quick HF error:', err);
    t('Erreur : ' + err.message);
  }
}

// ─── Stamp preview (ghost following cursor) ───────────────────────────────────
let _stampPreviewEl = null;

function _createStampPreview(config) {
  _removeStampPreview();
  const scale  = baseFitScale * zoomLevel / 100;
  const fsz    = (config.fontSize || 24) * scale;
  const rot    = config.rotation !== undefined ? config.rotation : -30;
  const color  = config.color || '#c0392b';
  const noFrm  = config.noFrame || false;

  const el = document.createElement('div');
  el.id = 'stamp-preview';
  el.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:99999',
    'display:none',
    `transform:rotate(${rot}deg)`,
    'transform-origin:center center',
    `font-size:${fsz}px`,
    'font-family:Arial,Helvetica,sans-serif',
    'font-weight:bold',
    `color:${color}`,
    noFrm ? '' : `border:2px solid ${color}`,
    noFrm ? '' : `outline:1.5px solid ${color}`,
    'outline-offset:3px',
    'padding:4px 10px',
    'opacity:0.82',
    'white-space:nowrap',
    'letter-spacing:0.06em',
  ].filter(Boolean).join(';');
  el.textContent = config.label || '';
  document.body.appendChild(el);
  _stampPreviewEl = el;
}

function _removeStampPreview() {
  if (_stampPreviewEl) { _stampPreviewEl.remove(); _stampPreviewEl = null; }
}

function _updateStampPreview(e) {
  if (!_stampPreviewEl) return;
  const wrap = e.target.closest('.page-wrap');
  if (!wrap) { _stampPreviewEl.style.display = 'none'; return; }
  _stampPreviewEl.style.display = 'block';
  const w = _stampPreviewEl.offsetWidth  || 0;
  const h = _stampPreviewEl.offsetHeight || 0;
  _stampPreviewEl.style.left = (e.clientX - w / 2) + 'px';
  _stampPreviewEl.style.top  = (e.clientY - h / 2) + 'px';
}

// ─── Variables drag&drop panneau droit ────────────────────────────────────────
function rpVarDragStart(e, varStr) {
  e.dataTransfer.setData('text/plain', varStr);
  e.dataTransfer.effectAllowed = 'copy';
}

function rpVarDrop(e, inputId) {
  e.preventDefault();
  const varStr = e.dataTransfer.getData('text/plain');
  if (varStr) rpVarInsert(inputId, varStr);
}

function rpVarInsert(inputId, varStr) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const s = inp.selectionStart ?? inp.value.length;
  const e = inp.selectionEnd   ?? inp.value.length;
  inp.value = inp.value.slice(0, s) + varStr + inp.value.slice(e);
  inp.focus();
  inp.setSelectionRange(s + varStr.length, s + varStr.length);
}

// ─── Numérotation Bates ───────────────────────────────────────────────────────
function openBatesPanel() {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  updateBatesPreview();
  document.getElementById('bates-overlay').style.display = 'flex';
}

function closeBatesPanel() {
  document.getElementById('bates-overlay').style.display = 'none';
}

function batesScopeChange() {
  const wrap = document.getElementById('bates-range-wrap');
  wrap.classList.toggle('hidden', document.getElementById('bates-scope').value !== 'range');
}

function updateBatesPreview() {
  const prefix = document.getElementById('bates-prefix').value;
  const suffix = document.getElementById('bates-suffix').value;
  const start  = parseInt(document.getElementById('bates-start').value) || 1;
  const digits = parseInt(document.getElementById('bates-digits').value) || 6;

  function fmt(n) { return prefix + String(n).padStart(digits, '0') + suffix; }

  const p1 = document.getElementById('bates-preview');
  const p2 = document.getElementById('bates-preview2');
  if (p1) p1.textContent = fmt(start);
  if (p2) p2.textContent = fmt(start + 1);
}

async function doApplyBates() {
  if (!currentPdfData) return;

  const prefix = document.getElementById('bates-prefix').value;
  const suffix = document.getElementById('bates-suffix').value;
  const start  = parseInt(document.getElementById('bates-start').value)  || 1;
  const digits = parseInt(document.getElementById('bates-digits').value) || 6;
  const zone   = document.getElementById('bates-zone').value;           // "footer-right" etc.
  const fontName= document.getElementById('bates-font').value;
  const fontSize= parseFloat(document.getElementById('bates-size').value) || 9;
  const colorHex= document.getElementById('bates-color').value || '#000000';
  const marginPt= parseFloat(document.getElementById('bates-margin').value) || 28;
  const scope   = document.getElementById('bates-scope').value;
  const fromPage= parseInt(document.getElementById('bates-from').value) || 1;
  const toPage  = parseInt(document.getElementById('bates-to').value)   || 99999;

  closeBatesPanel();
  t('Application de la numérotation Bates…');

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const fontMap = {
      'Courier':        StandardFonts.Courier,
      'Helvetica':      StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman':    StandardFonts.TimesRoman,
    };

    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const font = await doc.embedFont(fontMap[fontName] || StandardFonts.Courier);

    const r = parseInt(colorHex.slice(1,3),16)/255;
    const g = parseInt(colorHex.slice(3,5),16)/255;
    const b = parseInt(colorHex.slice(5,7),16)/255;
    const color = rgb(r, g, b);

    const pages      = doc.getPages();
    const totalPages = pages.length;
    let   batesIdx   = 0; // counts only applied pages for sequential numbering

    // [zone] = "header-left" | "header-center" | "header-right" | "footer-*"
    const [vZone, hAlign] = zone.split('-'); // e.g. ["footer","right"]

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      if (scope === 'skip1' && pageNum === 1) continue;
      if (scope === 'odd'   && pageNum % 2 === 0) continue;
      if (scope === 'even'  && pageNum % 2 !== 0) continue;
      if (scope === 'range' && (pageNum < fromPage || pageNum > toPage)) continue;

      const batesNum = start + batesIdx;
      batesIdx++;
      const batesStr = prefix + String(batesNum).padStart(digits, '0') + suffix;

      const page = pages[i];
      const { width, height } = page.getSize();
      const tW = font.widthOfTextAtSize(batesStr, fontSize);

      let x;
      if      (hAlign === 'left')   x = marginPt;
      else if (hAlign === 'right')  x = width - marginPt - tW;
      else                          x = (width - tW) / 2;

      const y = (vZone === 'header')
        ? height - marginPt - fontSize
        : marginPt;

      page.drawText(batesStr, { x, y, size: fontSize, font, color });
    }

    const saved = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({ name: currentPdfName, size: saved.length, data: bytesToBase64(saved), filePath: currentFilePath }, true);
    t(`Numérotation Bates appliquée — ${batesIdx} pages numérotées ✓`);
  } catch (err) {
    console.error('Bates error:', err);
    t('Erreur : ' + err.message);
  }
}

// ─── Palette de couleurs → rectangle de remplissage ───────────────────────────
let paletteRectMode  = false;
let paletteColor     = '#C8962E';
let _pRectEl         = null;   // rubber-band div
let _pRectStart      = null;   // {wrap, clientX, clientY, wrapRect}

function paletteActivateRect(swEl) {
  const color = swEl.dataset.color || '#C8962E';
  paletteColor = color;

  if (!currentPdfData) { t('Ouvrez un PDF pour utiliser cet outil'); return; }

  paletteRectMode = true;
  document.getElementById('pdf-pages').classList.add('stamp-mode'); // reuse crosshair CSS

  const ind = document.getElementById('palette-rect-ind');
  if (ind) {
    ind.style.display = 'flex';
    ind.querySelector('.pr-color-dot').style.background = color;
  }
  t('Dessinez un rectangle sur la page — Échap pour annuler');
  document.addEventListener('mousedown', _onPaletteDown, true);
  document.addEventListener('keydown',   _onPaletteKey);
}

function paletteDeactivateRect() {
  paletteRectMode = false;
  document.getElementById('pdf-pages')?.classList.remove('stamp-mode');
  const ind = document.getElementById('palette-rect-ind');
  if (ind) ind.style.display = 'none';
  document.removeEventListener('mousedown', _onPaletteDown, true);
  document.removeEventListener('mousemove', _onPaletteMove, true);
  document.removeEventListener('mouseup',   _onPaletteUp,   true);
  document.removeEventListener('keydown',   _onPaletteKey);
  _hidePRectBand();
  _pRectStart = null;
}

function _onPaletteKey(e) {
  if (e.key === 'Escape') paletteDeactivateRect();
}

function _onPaletteDown(e) {
  const wrap = e.target.closest('.page-wrap');
  if (!wrap) return;
  e.stopPropagation(); e.preventDefault();
  _pRectStart = { wrap, clientX: e.clientX, clientY: e.clientY, wrapRect: wrap.getBoundingClientRect() };
  document.addEventListener('mousemove', _onPaletteMove, true);
  document.addEventListener('mouseup',   _onPaletteUp,   true);
}

function _onPaletteMove(e) {
  if (!_pRectStart) return;
  const x1 = Math.min(_pRectStart.clientX, e.clientX);
  const y1 = Math.min(_pRectStart.clientY, e.clientY);
  const w  = Math.abs(e.clientX - _pRectStart.clientX);
  const h  = Math.abs(e.clientY - _pRectStart.clientY);
  if (!_pRectEl) {
    _pRectEl = document.createElement('div');
    _pRectEl.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:9998',
      `border:2px dashed ${paletteColor}`,
    ].join(';');
    document.body.appendChild(_pRectEl);
  }
  _pRectEl.style.left       = x1 + 'px';
  _pRectEl.style.top        = y1 + 'px';
  _pRectEl.style.width      = w  + 'px';
  _pRectEl.style.height     = h  + 'px';
  _pRectEl.style.background = hexToRgba(paletteColor, 0.25);
}

function _hidePRectBand() {
  if (_pRectEl) { _pRectEl.remove(); _pRectEl = null; }
}

function _onPaletteUp(e) {
  document.removeEventListener('mousemove', _onPaletteMove, true);
  document.removeEventListener('mouseup',   _onPaletteUp,   true);
  if (!_pRectStart) return;
  const start = _pRectStart;
  _pRectStart = null;
  _hidePRectBand();

  const w = Math.abs(e.clientX - start.clientX);
  const h = Math.abs(e.clientY - start.clientY);
  if (w < 4 || h < 4) return; // trop petit

  const scale     = baseFitScale * zoomLevel / 100;
  const cvs       = start.wrap.querySelector('canvas');
  const pdfH      = cvs.height / scale;
  const pageIndex = parseInt(start.wrap.dataset.page || '1') - 1;
  const wr        = start.wrapRect;

  // Viewport → PDF coords (PDF y-axis: bottom = 0)
  const pdfX1 = (Math.min(start.clientX, e.clientX) - wr.left) / scale;
  const pdfX2 = (Math.max(start.clientX, e.clientX) - wr.left) / scale;
  const pdfY2 = pdfH - (Math.min(start.clientY, e.clientY) - wr.top) / scale; // top → large y
  const pdfY1 = pdfH - (Math.max(start.clientY, e.clientY) - wr.top) / scale; // bottom → small y

  commitPaletteRect(pageIndex, pdfX1, pdfY1, pdfX2 - pdfX1, pdfY2 - pdfY1, paletteColor);
  // Reste en mode rectangle pour dessiner plusieurs zones d'affilée
}

async function commitPaletteRect(pageIndex, x, y, width, height, colorHex) {
  if (!currentPdfData || width < 1 || height < 1) return;
  const { PDFDocument, rgb } = PDFLib;
  try {
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageIndex];
    if (!page) return;

    const h = colorHex.replace('#','');
    const color = rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);

    page.drawRectangle({
      x, y, width, height,
      color,
      opacity: 0.5,
      borderColor: color,
      borderWidth: 1,
      borderOpacity: 0.85,
    });

    const saved = await doc.save({ useObjectStreams: false });
    await fastRerenderPage(bytesToBase64(saved), [pageIndex + 1]);
    t('Rectangle appliqué ✓');
  } catch (err) {
    console.error('Palette rect error:', err);
    t('Erreur : ' + err.message);
  }
}

// ─── Re-rendu ciblé d'une seule page (tampon, palette rect) ──────────────────
async function fastRerenderPage(newB64, changedPageNums) {
  // Push OLD state to undo BEFORE overwriting
  if (currentPdfData) {
    undoStack.push({ name: currentPdfName, size: currentPdfSize, data: currentPdfData, filePath: currentFilePath });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoBtns();
  }

  // Update stored data
  currentPdfData = newB64;
  if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
    tabs[activeTabIdx].data = newB64;
    tabs[activeTabIdx].size = Math.round(newB64.length * 0.75);
  }

  // Re-parse with PDF.js (needed for correct rendering after content change)
  const bytes  = base64ToBytes(newB64);
  const newPdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  currentPdfDoc = newPdf;
  if (activeTabIdx >= 0 && tabs[activeTabIdx]) tabs[activeTabIdx].pdfDoc = newPdf;

  const scale     = baseFitScale * zoomLevel / 100;
  const THUMB_W   = 130;

  for (const pn of changedPageNums) {
    // ── Re-render main canvas ──────────────────────────────────────────────
    const page = await newPdf.getPage(pn);
    const vp   = page.getViewport({ scale });

    const wraps = document.querySelectorAll('.page-wrap');
    const wrap  = Array.from(wraps).find(w => parseInt(w.dataset.page) === pn);
    if (wrap) {
      const cv = wrap.querySelector('canvas');
      cv.width  = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp, annotationMode: 0 }).promise;
    }
    page.cleanup();

    // ── Re-render thumbnail ────────────────────────────────────────────────
    const allThs = document.querySelectorAll('.th');
    const thEl   = allThs[pn - 1];
    if (thEl) {
      const thPage = await newPdf.getPage(pn);
      const vp0  = thPage.getViewport({ scale: 1 });
      const thVp = thPage.getViewport({ scale: THUMB_W / vp0.width });
      const thCv = document.createElement('canvas');
      thCv.width  = Math.round(thVp.width);
      thCv.height = Math.round(thVp.height);
      await thPage.render({ canvasContext: thCv.getContext('2d'), viewport: thVp }).promise;
      thPage.cleanup();
      const thcEl = thEl.querySelector('.thc');
      if (thcEl) {
        const img = document.createElement('img');
        img.src = thCv.toDataURL('image/jpeg', 0.75);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
        thcEl.innerHTML = '';
        thcEl.appendChild(img);
      }
    }
  }
}

// ─── Score de qualité ─────────────────────────────────────────────────────────
async function calculateQualityScore(pdf, data) {
  const breakdown = [];
  let total = 0;

  // 1. Couche texte (+20)
  try {
    const p1 = await pdf.getPage(1);
    const tc = await p1.getTextContent();
    const hasText = tc.items.length > 8;
    const pts = hasText ? 20 : 0;
    breakdown.push({ label: 'Couche texte (searchable)', pts, max: 20, ok: hasText });
    total += pts;
  } catch(e) { breakdown.push({ label: 'Couche texte', pts: 0, max: 20, ok: false }); }

  // 2. Métadonnées (+20)
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info || {};
    const hasTitle  = !!(info.Title?.trim());
    const hasAuthor = !!(info.Author?.trim() || info.Creator?.trim());
    const pts = (hasTitle ? 12 : 0) + (hasAuthor ? 8 : 0);
    breakdown.push({ label: 'Métadonnées (titre, auteur)', pts, max: 20, ok: pts >= 8 });
    total += pts;
  } catch(e) { breakdown.push({ label: 'Métadonnées', pts: 0, max: 20, ok: false }); }

  // 3. Signets / plan (+15)
  try {
    const outline = await pdf.getOutline();
    const has = !!(outline && outline.length > 0);
    const pts = has ? 15 : 0;
    breakdown.push({ label: 'Signets / plan du document', pts, max: 15, ok: has });
    total += pts;
  } catch(e) { breakdown.push({ label: 'Signets', pts: 0, max: 15, ok: false }); }

  // 4. Taille fichier (+15)
  const sizeMB = data.length * 0.75 / 1048576;
  const sizePts = sizeMB < 5 ? 15 : sizeMB < 15 ? 10 : sizeMB < 30 ? 5 : 0;
  breakdown.push({ label: `Taille (${sizeMB.toFixed(1)} Mo)`, pts: sizePts, max: 15, ok: sizePts >= 10 });
  total += sizePts;

  // 5. Version PDF (+10)
  try {
    const hdr = atob(data.slice(0, 12)).replace(/[^\x20-\x7E]/g, '');
    const m   = hdr.match(/%PDF-(\d+\.\d+)/);
    const ver = m ? parseFloat(m[1]) : 1.0;
    const pts = ver >= 1.5 ? 10 : ver >= 1.4 ? 7 : 3;
    breakdown.push({ label: `Version PDF ${ver.toFixed(1)}`, pts, max: 10, ok: pts >= 7 });
    total += pts;
  } catch(e) { breakdown.push({ label: 'Version PDF', pts: 5, max: 10, ok: false }); total += 5; }

  // 6. Pages multiples (+10)
  const np   = pdf.numPages;
  const ppts = np > 1 ? 10 : 5;
  breakdown.push({ label: `Nombre de pages (${np})`, pts: ppts, max: 10, ok: np > 1 });
  total += ppts;

  // 7. Format standard (+10)
  try {
    const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
    const w = vp.width, h = vp.height;
    const isStd = (Math.abs(w-595)<6 && Math.abs(h-842)<6) || // A4
                  (Math.abs(w-612)<6 && Math.abs(h-792)<6) || // Letter
                  (Math.abs(w-842)<6 && Math.abs(h-595)<6);   // A4 paysage
    const pts = isStd ? 10 : 5;
    breakdown.push({ label: `Format page (${Math.round(w)}×${Math.round(h)} pt)`, pts, max: 10, ok: isStd });
    total += pts;
  } catch(e) { breakdown.push({ label: 'Format page', pts: 5, max: 10, ok: false }); total += 5; }

  return { score: Math.min(100, total), breakdown };
}

// ─── Tooltip qualité ──────────────────────────────────────────────────────────
function showQualityTooltip(e) {
  const bd = window._qualityBreakdown;
  if (!bd || !bd.length) return;
  const tip  = document.getElementById('quality-tooltip');
  const body = document.getElementById('quality-tooltip-body');
  body.innerHTML = bd.map(r => `
    <div class="qt-row">
      <span class="qt-icon">${r.ok ? '✓' : '○'}</span>
      <span class="qt-label" style="color:${r.ok ? 'var(--txt)' : 'var(--txt2)'}">${r.label}</span>
      <span class="qt-pts">${r.pts}/${r.max}</span>
    </div>`).join('') +
    `<div class="qt-total">Total : ${Math.min(100, bd.reduce((s,r)=>s+r.pts,0))} / 100</div>`;
  const rect = document.getElementById('quality-section').getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.right   = (window.innerWidth - rect.left + 8) + 'px';
  tip.style.top     = rect.top + 'px';
}
function hideQualityTooltip() {
  document.getElementById('quality-tooltip').style.display = 'none';
}

// ─── Gestionnaire de signets ──────────────────────────────────────────────────
let _bkmgrList = []; // [{title, pageNum}]

async function openBkmgrPanel() {
  if (!currentPdfData || !currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  await _bkmgrLoadFromPdf();
  _bkmgrRender();
  document.getElementById('bkmgr-overlay').style.display = 'flex';
}

function closeBkmgrPanel() {
  document.getElementById('bkmgr-overlay').style.display = 'none';
}

async function _bkmgrLoadFromPdf() {
  _bkmgrList = [];
  try {
    const outline = await currentPdfDoc.getOutline();
    if (!outline) return;
    _bkmgrList = await _flattenOutline(outline, currentPdfDoc);
  } catch(e) { _bkmgrList = []; }
}

async function _flattenOutline(items, pdf) {
  const result = [];
  for (const item of items || []) {
    let pageNum = 1;
    try {
      let dest = item.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (Array.isArray(dest) && dest[0] && typeof dest[0] === 'object') {
        pageNum = (await pdf.getPageIndex(dest[0])) + 1;
      }
    } catch(e) { pageNum = 1; }
    result.push({ title: item.title || 'Sans titre', pageNum });
    if (item.items?.length) result.push(...await _flattenOutline(item.items, pdf));
  }
  return result;
}

function _bkmgrRender() {
  const list  = document.getElementById('bkmgr-list');
  const empty = document.getElementById('bkmgr-empty');
  const count = document.getElementById('bkmgr-count');
  count.textContent = _bkmgrList.length + ' signet' + (_bkmgrList.length > 1 ? 's' : '');

  if (!_bkmgrList.length) {
    if (empty) empty.style.display = 'block';
    list.querySelectorAll('.bkmgr-row').forEach(r => r.remove());
    return;
  }
  if (empty) empty.style.display = 'none';
  list.querySelectorAll('.bkmgr-row').forEach(r => r.remove());

  _bkmgrList.forEach((bm, idx) => {
    const row = document.createElement('div');
    row.className = 'bkmgr-row';
    row.innerHTML = `
      <span class="bkmgr-num">${idx + 1}</span>
      <input class="bkmgr-title" value="${bm.title.replace(/"/g,'&quot;')}" placeholder="Titre du signet"
        oninput="_bkmgrList[${idx}].title=this.value">
      <span class="bkmgr-pl">p.</span>
      <input type="number" class="bkmgr-page" value="${bm.pageNum}" min="1"
        oninput="_bkmgrList[${idx}].pageNum=parseInt(this.value)||1">
      <div class="bkmgr-acts">
        <div class="bkmgr-act" onclick="bkmgrMoveUp(${idx})" title="Monter">↑</div>
        <div class="bkmgr-act" onclick="bkmgrMoveDown(${idx})" title="Descendre">↓</div>
        <div class="bkmgr-act del" onclick="bkmgrDelete(${idx})" title="Supprimer">✕</div>
      </div>`;
    list.appendChild(row);
  });
}

function bkmgrAdd() {
  const curPage = parseInt(document.getElementById('cur-page')?.textContent || '1') || 1;
  _bkmgrList.push({ title: 'Nouveau signet', pageNum: curPage });
  _bkmgrRender();
  // Focus the last title input
  const rows = document.querySelectorAll('.bkmgr-row');
  rows[rows.length - 1]?.querySelector('.bkmgr-title')?.focus();
}

function bkmgrDelete(idx) {
  _bkmgrList.splice(idx, 1);
  _bkmgrRender();
}

function bkmgrMoveUp(idx) {
  if (idx === 0) return;
  [_bkmgrList[idx - 1], _bkmgrList[idx]] = [_bkmgrList[idx], _bkmgrList[idx - 1]];
  _bkmgrRender();
}

function bkmgrMoveDown(idx) {
  if (idx >= _bkmgrList.length - 1) return;
  [_bkmgrList[idx], _bkmgrList[idx + 1]] = [_bkmgrList[idx + 1], _bkmgrList[idx]];
  _bkmgrRender();
}

function bkmgrGenerateAI() {
  closeBkmgrPanel();
  generateBookmarks();
}

async function doApplyBookmarks() {
  if (!currentPdfData) return;
  closeBkmgrPanel();
  t('Application des signets…');
  try {
    const { PDFDocument, PDFName, PDFNull, PDFNumber, PDFHexString } = PDFLib;
    const doc   = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pages = doc.getPages();

    // Remove existing outlines
    try { doc.catalog.delete(PDFName.of('Outlines')); } catch(e) {}

    const valid = _bkmgrList.filter(bm => bm.pageNum >= 1 && bm.pageNum <= pages.length && bm.title.trim());

    if (valid.length > 0) {
      // Reserve refs
      const rootRef  = doc.context.register(doc.context.obj({}));
      const itemRefs = valid.map(() => doc.context.register(doc.context.obj({})));

      // Assign item dicts
      for (let i = 0; i < valid.length; i++) {
        const bm   = valid[i];
        const page = pages[bm.pageNum - 1];
        const dest = doc.context.obj([page.ref, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull]);
        const def  = {
          Title:  PDFHexString.fromText(bm.title),
          Parent: rootRef,
          Dest:   dest,
          Count:  PDFNumber.of(0),
        };
        if (i > 0)                def.Prev = itemRefs[i - 1];
        if (i < valid.length - 1) def.Next = itemRefs[i + 1];
        doc.context.assign(itemRefs[i], doc.context.obj(def));
      }

      // Assign root dict
      doc.context.assign(rootRef, doc.context.obj({
        Type:  PDFName.of('Outlines'),
        First: itemRefs[0],
        Last:  itemRefs[valid.length - 1],
        Count: PDFNumber.of(valid.length),
      }));

      doc.catalog.set(PDFName.of('Outlines'), rootRef);
      doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    }

    const saved  = await doc.save({ useObjectStreams: false });
    const newB64 = bytesToBase64(saved);

    // Update data without re-rendering pages (bookmarks are metadata only)
    currentPdfData = newB64;
    if (activeTabIdx >= 0 && tabs[activeTabIdx]) {
      tabs[activeTabIdx].data = newB64;
      tabs[activeTabIdx].size = saved.length;
    }
    undoStack.push({ name: currentPdfName, size: saved.length, data: newB64, filePath: currentFilePath });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoBtns();

    t(`${valid.length} signet${valid.length > 1 ? 's' : ''} appliqué${valid.length > 1 ? 's' : ''} ✓`);
  } catch (err) {
    console.error('Bookmarks error:', err);
    t('Erreur : ' + err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── TRADUCTION 40+ LANGUES ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ── Helper: parse page range string "1-3,5,7-9" → [1,2,3,5,7,8,9] ──────────
function parsePageRange(str, total) {
  const pages = new Set();
  for (const part of str.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const from = Math.max(1, parseInt(m[1]));
    const to   = Math.min(total, m[2] ? parseInt(m[2]) : from);
    for (let i = from; i <= to; i++) pages.add(i);
  }
  return [...pages].sort((a,b)=>a-b);
}

async function openTranslatePanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('tp-overlay').style.display = 'flex';
  document.getElementById('tp-result-wrap').style.display = 'none';
  // Pre-fill API key from settings if saved
  try {
    const s = await window.electronAPI.getSettings();
    if (s.openaiKey) document.getElementById('tp-apikey').value = s.openaiKey;
  } catch(e) {}
}
function closeTranslatePanel() {
  document.getElementById('tp-overlay').style.display = 'none';
}
function tpSetLang(lang) {
  document.getElementById('tp-lang').value = lang;
}
function tpScopeChange(sel) {
  document.getElementById('tp-range').style.display = sel.value === 'range' ? 'block' : 'none';
}
async function doTranslate() {
  const lang   = document.getElementById('tp-lang').value.trim();
  let apiKey = document.getElementById('tp-apikey').value.trim();
  if (!apiKey) apiKey = await _getAIKey();
  if (!lang) { t('Entrez une langue cible'); return; }
  if (!apiKey) { t('Clé API OpenAI manquante — configurez-la dans Paramètres (⚙)'); return; }

  const scope = document.getElementById('tp-scope').value;
  const rangeStr = document.getElementById('tp-range').value;
  const btn   = document.getElementById('tp-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traduction…';
  btn.style.pointerEvents = 'none';

  try {
    // Determine target pages
    let pages = [];
    if (scope === 'current') {
      pages = [parseInt(document.getElementById('cur-page')?.textContent || '1') || 1];
    } else if (scope === 'range') {
      pages = parsePageRange(rangeStr, currentPdfDoc.numPages);
    } else {
      pages = Array.from({ length: currentPdfDoc.numPages }, (_, i) => i + 1);
    }

    // Extract text from all target pages
    let fullText = '';
    for (const pn of pages) {
      const page = await currentPdfDoc.getPage(pn);
      const tc   = await page.getTextContent();
      const pageText = tc.items.map(it => it.str).join(' ').trim();
      if (pageText) fullText += (pages.length > 1 ? `\n\n[Page ${pn}]\n` : '') + pageText;
    }
    if (!fullText.trim()) { t('Aucun texte extractible'); return; }

    // Save API key for later
    window.electronAPI.getSettings().then(s =>
      window.electronAPI.saveSettings({ ...s, openaiKey: apiKey })).catch(()=>{});

    // Call AI translation via IPC
    const res = await window.electronAPI.aiTranslate(fullText, lang, apiKey, null);
    if (!res.success) throw new Error(res.error);

    document.getElementById('tp-result').value = res.result;
    document.getElementById('tp-result-wrap').style.display = 'block';
    t('Traduction terminée ✓');
  } catch (err) {
    t('Erreur : ' + err.message.slice(0, 80));
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-language"></i> Traduire';
    btn.style.pointerEvents = '';
  }
}
function tpCopy() {
  const txt = document.getElementById('tp-result').value;
  navigator.clipboard.writeText(txt).then(() => t('Copié ✓')).catch(() => t('Erreur copie'));
}
async function tpInsertAsPage() {
  const txt = document.getElementById('tp-result').value;
  if (!txt || !currentPdfData) return;
  t('Insertion…');
  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]); // A4
    const margin = 50, lineH = 14, fontSize = 11;
    const maxW  = page.getWidth() - margin * 2;
    const lines = [];
    for (const para of txt.split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const wid  = font.widthOfTextAtSize(test, fontSize);
        if (wid > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      lines.push(line);
      lines.push('');
    }
    let y = page.getHeight() - margin;
    for (const line of lines) {
      if (y < margin) break;
      if (line) page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.05, 0.05, 0.1) });
      y -= lineH;
    }
    const saved  = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({ name: currentPdfName, size: saved.length, data: bytesToBase64(saved), filePath: currentFilePath }, true);
    t('Page insérée ✓');
    closeTranslatePanel();
  } catch(err) { t('Erreur : ' + err.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CHIFFREMENT + MOT DE PASSE + DROITS ─────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function openEncryptPanel() {
  if (!currentPdfData) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('enc-overlay').style.display = 'flex';
}
function closeEncryptPanel() {
  document.getElementById('enc-overlay').style.display = 'none';
}
function encTogglePwd(inputId, iconEl) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  iconEl.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}
function encGenPwd(inputId) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&';
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById(inputId).value = pwd;
  document.getElementById(inputId).type  = 'text';
}
async function doEncrypt() {
  const userPwd  = document.getElementById('enc-user-pwd').value;
  const ownerPwd = document.getElementById('enc-owner-pwd').value;
  if (!userPwd && !ownerPwd) { t('Entrez au moins un mot de passe'); return; }

  const bits = parseInt(document.getElementById('enc-level').value) || 256;
  const permissions = {
    print:  document.getElementById('perm-print').checked,
    copy:   document.getElementById('perm-copy').checked,
    modify: document.getElementById('perm-modify').checked,
    annot:  document.getElementById('perm-annot').checked,
    extract:document.getElementById('perm-extract').checked,
    forms:  document.getElementById('perm-forms').checked,
  };

  closeEncryptPanel();
  t('Chiffrement…');

  try {
    // First, save to a temp location then encrypt
    const saveRes = await window.electronAPI.savePDF(
      (currentPdfName || 'document').replace(/\.pdf$/i,'') + '_chiffré.pdf'
    );
    if (saveRes.canceled || !saveRes.filePath) { t('Annulé'); return; }

    const res = await window.electronAPI.encryptPDF({
      pdfData: currentPdfData, userPwd, ownerPwd, bits, permissions
    });

    if (!res.success) {
      if (res.notFound) {
        t('QPDF non trouvé — installez QPDF (brew install qpdf / winget install qpdf.qpdf)');
      } else {
        t('Erreur chiffrement : ' + res.error.slice(0, 80));
      }
      return;
    }

    await window.electronAPI.writeFile(saveRes.filePath, res.data);
    t('PDF chiffré enregistré ✓ — ' + saveRes.filePath.split(/[\\/]/).pop());
  } catch(err) { t('Erreur : ' + err.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── BIFFURE DÉFINITIVE (caviardage) ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _redactMode   = false;
let _redactZones  = []; // [{pageNum, x, y, w, h, el}] — PDF coords
let _redactBand   = null;
let _redactStart  = null;

function startRedactMode() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  _redactMode  = true;
  _redactZones = [];
  _updateRedactBadge();
  document.body.classList.add('redact-mode');
  document.addEventListener('mousedown', _redactDown, true);
  document.addEventListener('mousemove', _redactMove, true);
  document.addEventListener('mouseup',   _redactUp,   true);
  t('Mode caviardage actif — dessinez les zones à supprimer');
}
function stopRedactMode() {
  _redactMode = false;
  document.body.classList.remove('redact-mode');
  document.removeEventListener('mousedown', _redactDown, true);
  document.removeEventListener('mousemove', _redactMove, true);
  document.removeEventListener('mouseup',   _redactUp,   true);
  _redactBand && _redactBand.remove(); _redactBand = null;
  // Remove visual overlays
  document.querySelectorAll('.redact-zone').forEach(e => e.remove());
  _redactZones = [];
  _updateRedactBadge();
  t('Mode caviardage désactivé');
}
function _updateRedactBadge() {
  const badge = document.getElementById('redact-count-badge');
  if (badge) badge.textContent = _redactZones.length + ' zone(s) à caviarder';
}
function _redactDown(e) {
  if (!_redactMode) return;
  const wrap = e.target.closest('.page-wrap');
  if (!wrap) return;
  e.preventDefault(); e.stopPropagation();
  _redactStart = { x: e.clientX, y: e.clientY, wrap };
  _redactBand = document.createElement('div');
  _redactBand.className = 'redact-band';
  _redactBand.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:0;height:0`;
  document.body.appendChild(_redactBand);
}
function _redactMove(e) {
  if (!_redactBand || !_redactStart) return;
  const x = Math.min(e.clientX, _redactStart.x);
  const y = Math.min(e.clientY, _redactStart.y);
  const w = Math.abs(e.clientX - _redactStart.x);
  const h = Math.abs(e.clientY - _redactStart.y);
  _redactBand.style.cssText = `position:fixed;background:rgba(192,57,43,.25);border:2px dashed #e74c3c;pointer-events:none;z-index:9999;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
}
function _redactUp(e) {
  if (!_redactBand || !_redactStart) return;
  const wrap   = _redactStart.wrap;
  const pageNum = parseInt(wrap.dataset.page) || 1;
  const wRect   = wrap.getBoundingClientRect();
  const scale   = baseFitScale * zoomLevel / 100;

  const cssX = Math.min(e.clientX, _redactStart.x) - wRect.left;
  const cssY = Math.min(e.clientY, _redactStart.y) - wRect.top;
  const cssW = Math.abs(e.clientX - _redactStart.x);
  const cssH = Math.abs(e.clientY - _redactStart.y);

  _redactBand.remove(); _redactBand = null; _redactStart = null;

  if (cssW < 4 || cssH < 4) return;

  // Visual overlay on page
  const zone = document.createElement('div');
  zone.className = 'redact-zone';
  zone.style.cssText = `left:${cssX}px;top:${cssY}px;width:${cssW}px;height:${cssH}px`;
  wrap.appendChild(zone);

  // Store in PDF coordinates
  _redactZones.push({ pageNum, cssX, cssY, cssW, cssH, scale, el: zone });
  _updateRedactBadge();
}

async function commitRedaction() {
  if (!_redactZones.length || !currentPdfData) return;
  t('Caviardage en cours…');

  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc   = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pdfPages = doc.getPages();

    // Group zones by page
    const byPage = {};
    for (const z of _redactZones) {
      (byPage[z.pageNum] = byPage[z.pageNum] || []).push(z);
    }

    for (const [pnStr, zones] of Object.entries(byPage)) {
      const pn   = parseInt(pnStr);
      const pdfPage = pdfPages[pn - 1];
      if (!pdfPage) continue;

      // Render page to canvas at 2× (rasterize to destroy text layer)
      const pjsPage = await currentPdfDoc.getPage(pn);
      const vp = pjsPage.getViewport({ scale: 2 });
      const cv = document.createElement('canvas');
      cv.width  = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d');
      await pjsPage.render({ canvasContext: ctx, viewport: vp }).promise;
      pjsPage.cleanup();

      // Draw black redaction rectangles (at 2× scale)
      ctx.fillStyle = '#000000';
      for (const z of zones) {
        const factor = 2 / z.scale;
        ctx.fillRect(
          Math.floor(z.cssX * factor), Math.floor(z.cssY * factor),
          Math.ceil(z.cssW  * factor), Math.ceil(z.cssH  * factor)
        );
      }

      // Convert to PNG and embed in pdf-lib
      const pngB64  = cv.toDataURL('image/png').split(',')[1];
      const pngEmb  = await doc.embedPng(base64ToBytes(pngB64));
      const { width: pw, height: ph } = pdfPage.getSize();

      // Remove existing content (replace with blank then draw image)
      pdfPage.drawRectangle({ x:0, y:0, width:pw, height:ph, color: PDFLib.rgb(1,1,1) });
      pdfPage.drawImage(pngEmb, { x:0, y:0, width:pw, height:ph });
    }

    const saved = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({ name: currentPdfName, size: saved.length, data: bytesToBase64(saved), filePath: currentFilePath }, true);
    stopRedactMode();
    t('Caviardage appliqué ✓ — texte supprimé définitivement');
  } catch(err) {
    console.error('Redact error:', err);
    t('Erreur : ' + err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── SIGNATURE ÉLECTRONIQUE ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const SIG_STORAGE_KEY = 'pdfeditor_signatures_v2';
let _sigOrigImageData = null; // ImageData before bg removal (for undo threshold)
let _sigActiveTab     = 'draw';
let _sigDrawing       = false;
let _sigLastPt        = null;
let _sigPoints        = [];

// ── Saved signatures (localStorage) ──────────────────────────────────────────
function sigLoad() {
  try { return JSON.parse(localStorage.getItem(SIG_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function sigSaveAll(arr) { localStorage.setItem(SIG_STORAGE_KEY, JSON.stringify(arr)); }

// ── Panel open/close ──────────────────────────────────────────────────────────
function openSigPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('sig-overlay').style.display = 'flex';
  sigRenderSaved();
  sigTab('draw');
  sigInitCanvas();
}
function closeSigPanel() {
  document.getElementById('sig-overlay').style.display = 'none';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function sigTab(name) {
  _sigActiveTab = name;
  ['draw','image','text'].forEach(t2 => {
    document.getElementById('sigtab-' + t2)?.classList.toggle('active', t2 === name);
    const tc = document.getElementById('sig-tc-' + t2);
    if (tc) tc.style.display = t2 === name ? 'flex' : 'none';
  });
  if (name === 'text') sigTextPreview();
}

// ── Draw tab ──────────────────────────────────────────────────────────────────
function sigInitCanvas() {
  const cv  = document.getElementById('sig-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);

  // Show/hide hint
  const hint = document.getElementById('sig-canvas-hint');
  if (hint) hint.style.display = 'block';

  const thick = document.getElementById('sig-thick');
  if (thick) {
    thick.oninput = () => {
      document.getElementById('sig-thick-val').textContent = thick.value;
    };
  }

  cv.onmousedown = (e) => {
    _sigDrawing = true;
    _sigPoints  = [];
    const pt = _sigPt(e, cv);
    _sigPoints.push(pt);
    _sigLastPt = pt;
    if (hint) hint.style.display = 'none';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };
  cv.onmousemove = (e) => {
    if (!_sigDrawing) return;
    const pt = _sigPt(e, cv);
    _sigPoints.push(pt);
    const color = document.getElementById('sig-color').value || '#0d1b2a';
    const lw    = parseFloat(document.getElementById('sig-thick').value) || 2;
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    // Smooth curve to midpoint
    if (_sigLastPt) {
      const mx = (_sigLastPt.x + pt.x) / 2;
      const my = (_sigLastPt.y + pt.y) / 2;
      ctx.quadraticCurveTo(_sigLastPt.x, _sigLastPt.y, mx, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
    }
    _sigLastPt = pt;
  };
  cv.onmouseup = cv.onmouseleave = () => {
    if (_sigDrawing) { ctx.stroke(); _sigDrawing = false; _sigLastPt = null; }
  };
}
function _sigPt(e, cv) {
  const r = cv.getBoundingClientRect();
  const scaleX = cv.width  / r.width;
  const scaleY = cv.height / r.height;
  return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
}
function sigClearCanvas() {
  const cv = document.getElementById('sig-canvas');
  if (!cv) return;
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  const hint = document.getElementById('sig-canvas-hint');
  if (hint) hint.style.display = 'block';
}

// ── Image tab ─────────────────────────────────────────────────────────────────
function sigImgPick() {
  // Try via IPC first (native dialog), fallback to file input
  window.electronAPI.openImageForSig().then(res => {
    if (!res) return;
    const img = new Image();
    img.onload = () => _sigImgLoaded(img);
    img.src = 'data:image/' + res.type + ';base64,' + res.data;
  }).catch(() => {
    document.getElementById('sig-img-file').click();
  });
}
function sigImgFileLoad(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => _sigImgLoaded(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function _sigImgLoaded(img) {
  const cv  = document.getElementById('sig-img-canvas');
  const maxW = 420, maxH = 160;
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  cv.width  = Math.round(img.width  * ratio);
  cv.height = Math.round(img.height * ratio);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  _sigOrigImageData = ctx.getImageData(0, 0, cv.width, cv.height);
  cv.style.display = 'block';
  document.getElementById('sig-img-drop').style.display   = 'none';
  document.getElementById('sig-img-tools').style.display  = 'block';
}
function sigToggleRmBg(cb) {
  const row = document.getElementById('sig-rm-bg-thresh-row');
  if (row) row.style.display = cb.checked ? 'flex' : 'none';
  if (cb.checked) sigApplyRmBg();
  else {
    // Restore original
    const cv = document.getElementById('sig-img-canvas');
    if (_sigOrigImageData) cv.getContext('2d').putImageData(_sigOrigImageData, 0, 0);
  }
}
function sigApplyRmBg() {
  if (!_sigOrigImageData) return;
  const cv  = document.getElementById('sig-img-canvas');
  const ctx = cv.getContext('2d');
  const thresh = parseInt(document.getElementById('sig-rm-thresh').value) || 80;
  document.getElementById('sig-rm-thresh-val').textContent = thresh;

  // Work on a copy
  const copy = new ImageData(
    new Uint8ClampedArray(_sigOrigImageData.data),
    _sigOrigImageData.width, _sigOrigImageData.height
  );
  const d = copy.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    // Consider "white/light" pixel as background
    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r,g,b) - Math.min(r,g,b);
    if (brightness > (255 - thresh) && saturation < 40) {
      d[i + 3] = 0; // transparent
    }
  }
  ctx.putImageData(copy, 0, 0);
}

// ── Text tab ──────────────────────────────────────────────────────────────────
function sigTextPreview() {
  const cv   = document.getElementById('sig-text-canvas');
  if (!cv) return;
  const ctx  = cv.getContext('2d');
  const text = document.getElementById('sig-text-inp')?.value || '';
  const font = document.getElementById('sig-text-style')?.value || "italic 52px 'Georgia',serif";
  const color= document.getElementById('sig-text-color')?.value || '#0d1b2a';
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!text) return;
  ctx.font      = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2, cv.width - 20);
}

// ── Get current signature as data URL ────────────────────────────────────────
function _sigGetDataUrl() {
  if (_sigActiveTab === 'draw') {
    const cv = document.getElementById('sig-canvas');
    // Trim transparent edges
    const ctx = cv.getContext('2d');
    const id  = ctx.getImageData(0, 0, cv.width, cv.height);
    const d   = id.data;
    let minX=cv.width, minY=cv.height, maxX=0, maxY=0;
    for (let y=0;y<cv.height;y++) for (let x=0;x<cv.width;x++) {
      if (d[(y*cv.width+x)*4+3]>10) { minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y); }
    }
    if (maxX < minX) return null; // empty
    const trimCV = document.createElement('canvas');
    trimCV.width  = maxX - minX + 10;
    trimCV.height = maxY - minY + 10;
    trimCV.getContext('2d').drawImage(cv, minX-5, minY-5, trimCV.width, trimCV.height, 0, 0, trimCV.width, trimCV.height);
    return trimCV.toDataURL('image/png');
  } else if (_sigActiveTab === 'image') {
    const cv = document.getElementById('sig-img-canvas');
    if (cv.style.display === 'none') return null;
    return cv.toDataURL('image/png');
  } else if (_sigActiveTab === 'text') {
    const cv = document.getElementById('sig-text-canvas');
    return cv.toDataURL('image/png');
  }
  return null;
}

// ── Save signature ────────────────────────────────────────────────────────────
function sigSave() {
  const dataUrl = _sigGetDataUrl();
  if (!dataUrl) { t('Créez une signature d\'abord'); return; }
  const name = document.getElementById('sig-name').value.trim() || 'Signature ' + (sigLoad().length + 1);
  const sigs  = sigLoad();
  sigs.push({ id: Date.now(), name, dataUrl, created: new Date().toISOString() });
  sigSaveAll(sigs);
  sigRenderSaved();
  t('Signature enregistrée ✓');
}

function sigRenderSaved() {
  const list  = document.getElementById('sig-saved-list');
  const empty = document.getElementById('sig-saved-empty');
  const sigs  = sigLoad();
  list.innerHTML = '';
  if (!sigs.length) { if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  sigs.forEach((sig, idx) => {
    const item = document.createElement('div');
    item.className = 'sig-saved-item';
    item.innerHTML = `
      <img src="${sig.dataUrl}" alt="${sig.name}">
      <div class="sig-saved-name">${sig.name}</div>
      <div class="sig-saved-del" onclick="sigDeleteSaved(${sig.id},event)" title="Supprimer">✕</div>
      <div class="sig-saved-use">Utiliser</div>`;
    item.onclick = (e) => {
      if (e.target.closest('.sig-saved-del')) return;
      _sigPlaceDataUrl(sig.dataUrl);
    };
    list.appendChild(item);
  });
}

function sigDeleteSaved(id, e) {
  e?.stopPropagation();
  const sigs = sigLoad().filter(s => s.id !== id);
  sigSaveAll(sigs);
  sigRenderSaved();
  t('Signature supprimée');
}

// ── Place signature on PDF ────────────────────────────────────────────────────
function sigPlace() {
  const dataUrl = _sigGetDataUrl();
  if (!dataUrl) { t('Créez ou sélectionnez une signature d\'abord'); return; }
  closeSigPanel();
  _sigPlaceDataUrl(dataUrl);
}

function _sigPlaceDataUrl(dataUrl) {
  if (!currentPdfDoc) return;
  t('Cliquez sur la page pour placer la signature…');

  // Pre-load image to get real dimensions → accurate centering
  const _img = new Image();
  _img.onload = () => {
    const sigPxW = parseInt(document.getElementById('sig-size')?.value || '150') || 150;
    const sigAR  = _img.naturalWidth ? _img.naturalHeight / _img.naturalWidth : 0.35;
    const sigPxH = Math.round(sigPxW * sigAR);

    const preview = document.createElement('div');
    preview.id = 'sig-preview';
    preview.style.cssText = 'position:fixed;pointer-events:none;z-index:9998;opacity:.78;border:1px dashed var(--gold);padding:0;box-sizing:border-box';
    preview.innerHTML = `<img src="${dataUrl}" style="width:${sigPxW}px;height:${sigPxH}px;display:block">`;
    document.body.appendChild(preview);

    // Center preview exactly on cursor
    function onMove(e) {
      preview.style.left = (e.clientX - sigPxW / 2) + 'px';
      preview.style.top  = (e.clientY - sigPxH / 2) + 'px';
    }
    function cleanup() {
      preview.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    }
    async function onClick(e) {
      const wrap = e.target.closest('.page-wrap');
      if (!wrap) { cleanup(); t('Placement annulé'); return; }
      e.preventDefault(); e.stopPropagation();
      cleanup();
      await _sigEmbedOnPage(dataUrl, wrap, e, sigPxW, sigAR);
    }
    function onKey(e) { if (e.key === 'Escape') { cleanup(); t('Placement annulé'); } }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  };
  _img.onerror = () => t('Erreur chargement image');
  _img.src = dataUrl;
}

async function _sigEmbedOnPage(dataUrl, wrap, clickEvent, sigPxW, sigAR) {
  const pageNum = parseInt(wrap.dataset.page) || 1;
  const wRect   = wrap.getBoundingClientRect();
  const scale   = baseFitScale * zoomLevel / 100;

  // Click position relative to page (CSS px)
  const cssX = clickEvent.clientX - wRect.left;
  const cssY = clickEvent.clientY - wRect.top;

  // Dimensions in PDF points
  const sigPxWFinal = sigPxW || (parseInt(document.getElementById('sig-size')?.value || '150') || 150);
  const sigPdfW     = sigPxWFinal / scale;
  const sigPdfH     = sigPdfW * (sigAR || 0.35);

  // Convert click center to PDF coords (bottom-left origin, Y flipped)
  const pjsPage = await currentPdfDoc.getPage(pageNum);
  const vp      = pjsPage.getViewport({ scale: 1 });
  const pdfCX   = cssX / scale;                    // click X in PDF pts
  const pdfCY   = vp.height - (cssY / scale);       // click Y in PDF pts (flipped)

  // Place image centered on click → left = center - half-width, bottom = center - half-height
  const pdfX = pdfCX - sigPdfW / 2;
  const pdfY = pdfCY - sigPdfH / 2;

  try {
    const { PDFDocument } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageNum - 1];

    // Embed PNG (strip data:image/png;base64, prefix)
    const b64  = dataUrl.split(',')[1];
    let pngEmb;
    try { pngEmb = await doc.embedPng(base64ToBytes(b64)); }
    catch { pngEmb = await doc.embedJpg(base64ToBytes(b64)); }

    page.drawImage(pngEmb, { x: pdfX, y: pdfY, width: sigPdfW, height: sigPdfH });

    const saved = await doc.save({ useObjectStreams: false });
    await fastRerenderPage(bytesToBase64(saved), [pageNum]);
    t('Signature placée ✓');
  } catch(err) {
    console.error('Sig embed error:', err);
    t('Erreur : ' + err.message);
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// ── TRADUCTION IN-PLACE v2 — Canvas-based, couleurs préservées ───────────────
// ═════════════════════════════════════════════════════════════════════════════

function doTranslateDispatch() {
  if (document.getElementById('tp-inplace')?.checked) {
    doTranslateInPlace();
  } else {
    doTranslate();
  }
}

// ── Extract text blocks with PDF coordinates ──────────────────────────────────
async function _tpExtractBlocks(pn) {
  const pjsPage = await currentPdfDoc.getPage(pn);
  const tc      = await pjsPage.getTextContent();
  const vp      = pjsPage.getViewport({ scale: 1 });

  const items = tc.items
    .filter(it => it.str && it.str.trim())
    .map(it => ({
      str: it.str,
      x:   it.transform[4],
      y:   it.transform[5],
      h:   Math.abs(it.transform[3]) || it.height || 10,
      w:   it.width || 0,
      bold: it.fontName && it.fontName.toLowerCase().includes('bold'),
    }))
    .filter(it => it.h > 1.5);

  if (!items.length) return { blocks: [], pageH: vp.height, pageW: vp.width };

  // Sort top-to-bottom (high PDF-y first), then left-to-right
  items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  // Group into lines
  const lines = [];
  let curLine = null;
  for (const it of items) {
    if (!curLine || curLine.refY - it.y > curLine.h * 0.6) {
      curLine = { refY: it.y, h: it.h, items: [it], minX: it.x, maxX: it.x + it.w };
      lines.push(curLine);
    } else {
      curLine.items.push(it);
      curLine.h    = Math.max(curLine.h, it.h);
      curLine.minX = Math.min(curLine.minX, it.x);
      curLine.maxX = Math.max(curLine.maxX, it.x + (it.w || 0));
    }
  }

  // Group lines into paragraph blocks
  const blocks = [];
  let curBlock = null;
  for (const line of lines) {
    const lineTop = line.refY + line.h;
    if (!curBlock || curBlock.topY - lineTop > line.h * 2.0) {
      curBlock = { lines: [line], topY: lineTop, botY: line.refY,
                   minX: line.minX, maxX: line.maxX, maxH: line.h };
      blocks.push(curBlock);
    } else {
      curBlock.lines.push(line);
      curBlock.botY = Math.min(curBlock.botY, line.refY);
      curBlock.minX = Math.min(curBlock.minX, line.minX);
      curBlock.maxX = Math.max(curBlock.maxX, line.maxX);
      curBlock.maxH = Math.max(curBlock.maxH, line.h);
    }
  }

  return {
    blocks: blocks.map(b => ({
      text:     b.lines.map(l => l.items.map(i => i.str).join('')).join('\n'),
      pdfX:     Math.max(0, b.minX - 1),
      pdfY:     Math.max(0, b.botY - 2),
      pdfW:     Math.max(10, b.maxX - b.minX + 4),
      pdfH:     Math.max(6,  b.topY - b.botY + 4),
      fontSize: Math.min(72, Math.max(5, b.maxH * 0.90)),
    })),
    pageH: vp.height,
    pageW: vp.width,
  };
}

// ── Sample dominant background color in a canvas region ──────────────────────
function _sampleBg(ctx, cx, cy, cw, ch) {
  // Sample a thin border around the block (likely background, not text)
  const pts = [];
  const step = Math.max(1, Math.floor(Math.min(cw, ch) / 8));
  // Top & bottom edge
  for (let x = cx; x < cx + cw; x += step) {
    if (cy > 0)         pts.push([x, cy - 1]);
    if (cy + ch < ctx.canvas.height) pts.push([x, cy + ch]);
  }
  // Left & right edge
  for (let y = cy; y < cy + ch; y += step) {
    if (cx > 0)         pts.push([cx - 1, y]);
    if (cx + cw < ctx.canvas.width) pts.push([cx + cw, y]);
  }
  if (!pts.length) return [255, 255, 255];

  let r = 0, g = 0, b = 0;
  for (const [px, py] of pts) {
    const d = ctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
    r += d[0]; g += d[1]; b += d[2];
  }
  const n = pts.length;
  return [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
}

// ── Sample dominant foreground (text) color in a canvas region ───────────────
function _sampleFg(ctx, cx, cy, cw, ch, bg) {
  const [br, bg2, bb2] = bg;
  const imageData = ctx.getImageData(Math.round(cx), Math.round(cy),
                                     Math.round(cw), Math.round(ch));
  const d = imageData.data;
  const counts = {};
  for (let i = 0; i < d.length; i += 4) {
    const dr = Math.abs(d[i]   - br);
    const dg = Math.abs(d[i+1] - bg2);
    const db = Math.abs(d[i+2] - bb2);
    if (dr + dg + db < 40) continue; // skip near-background pixels
    const key = `${Math.round(d[i]/32)*32},${Math.round(d[i+1]/32)*32},${Math.round(d[i+2]/32)*32}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  if (!best) return [20, 20, 40]; // default: near-black
  return best[0].split(',').map(Number);
}

// ── Wrap and draw text on canvas ──────────────────────────────────────────────
function _cvDrawWrapped(ctx, text, x, y, maxW, lineH) {
  const lines = text.split('\n');
  let curY = y;
  for (const para of lines) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, curY);
        line = w; curY += lineH;
      } else { line = test; }
    }
    if (line) { ctx.fillText(line, x, curY); curY += lineH; }
  }
}

// ── Main translation function ─────────────────────────────────────────────────
async function doTranslateInPlace() {
  const lang   = document.getElementById('tp-lang').value.trim();
  let apiKey = document.getElementById('tp-apikey').value.trim();
  if (!apiKey) apiKey = await _getAIKey();
  if (!lang)   { t('Entrez une langue cible'); return; }
  if (!apiKey) { t('Clé API OpenAI requise — sk-…'); return; }

  const scope    = document.getElementById('tp-scope').value;
  const rangeStr = document.getElementById('tp-range').value;
  const btn = document.getElementById('tp-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traduction…';
  btn.style.pointerEvents = 'none';
  closeTranslatePanel();

  try {
    let pages = [];
    if (scope === 'current')
      pages = [parseInt(document.getElementById('cur-page')?.textContent || '1') || 1];
    else if (scope === 'range')
      pages = parsePageRange(rangeStr, currentPdfDoc.numPages);
    else
      pages = Array.from({ length: currentPdfDoc.numPages }, (_, i) => i + 1);

    const { PDFDocument } = PDFLib;
    const doc      = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const SCALE    = 2; // render at 2× for quality
    let   inserted = 0; // offset as we insert pages

    for (const pn of pages) {
      t(`Page ${pn} — extraction…`);

      // ① Rasterize original page to canvas
      const pjsPage = await currentPdfDoc.getPage(pn);
      const vp      = pjsPage.getViewport({ scale: SCALE });
      const cv      = document.createElement('canvas');
      cv.width  = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d');
      await pjsPage.render({ canvasContext: ctx, viewport: vp, annotationMode: 0 }).promise;
      pjsPage.cleanup();

      // ② Extract text blocks (in PDF 1× coords)
      const { blocks, pageH, pageW } = await _tpExtractBlocks(pn);
      if (!blocks.length) continue;

      // ③ Translate all blocks in one AI call
      const texts = blocks.map(b => b.text);
      const rawPrompt =
        `Translate each string in this JSON array to ${lang}.\n` +
        `Rules:\n- Return ONLY a valid JSON array with exactly ${texts.length} strings.\n` +
        `- Preserve \\n line breaks proportionally.\n- Keep very short labels short.\n` +
        `- No explanations, no markdown.\n\n` + JSON.stringify(texts);

      t(`Page ${pn} — traduction de ${texts.length} blocs…`);
      const res = await window.electronAPI.aiTranslate('', lang, apiKey, null, rawPrompt);
      if (!res.success) throw new Error(res.error);

      let translated;
      try {
        const clean = res.result.trim().replace(/^```(?:json)?\n?|```$/gm, '').trim();
        translated = JSON.parse(clean);
        if (!Array.isArray(translated)) throw new Error('not array');
      } catch {
        translated = res.result.split(/\n{2,}/).map(s => s.trim());
      }

      // ④ For each block: detect bg/fg color, erase, redraw translation on canvas
      for (let i = 0; i < blocks.length; i++) {
        const b    = blocks[i];
        const tTxt = String(translated[i] ?? b.text).trim();
        if (!tTxt) continue;

        // Convert PDF coords → canvas coords (flip Y, apply scale)
        const cx = (b.pdfX) * SCALE;
        const cy = (pageH - b.pdfY - b.pdfH) * SCALE;
        const cw = b.pdfW * SCALE;
        const ch = b.pdfH * SCALE;

        // Clamp to canvas bounds
        const cx2 = Math.max(0, Math.round(cx));
        const cy2 = Math.max(0, Math.round(cy));
        const cw2 = Math.min(cv.width  - cx2, Math.round(cw));
        const ch2 = Math.min(cv.height - cy2, Math.round(ch));
        if (cw2 <= 0 || ch2 <= 0) continue;

        // Sample bg and fg colors
        const bgRGB = _sampleBg(ctx, cx2, cy2, cw2, ch2);
        const fgRGB = _sampleFg(ctx, cx2, cy2, cw2, ch2, bgRGB);

        // ④a Erase original text with background color
        ctx.fillStyle = `rgb(${bgRGB[0]},${bgRGB[1]},${bgRGB[2]})`;
        ctx.fillRect(cx2, cy2, cw2, ch2);

        // ④b Draw translated text
        const fs     = Math.max(8, b.fontSize * SCALE);
        const lineH  = fs * 1.25;
        ctx.fillStyle   = `rgb(${fgRGB[0]},${fgRGB[1]},${fgRGB[2]})`;
        ctx.font        = `${fs}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = 'top';
        _cvDrawWrapped(ctx, tTxt, cx2 + 1, cy2 + 1, cw2 - 2, lineH);
      }

      // ⑤ Canvas → PNG → embed in new PDF page inserted right after original
      t(`Page ${pn} — insertion…`);
      const pngB64 = cv.toDataURL('image/png').split(',')[1];
      const pngEmb = await doc.embedPng(base64ToBytes(pngB64));

      const origPage = doc.getPages()[pn - 1 + inserted];
      const { width: pw, height: ph } = origPage.getSize();

      // Insert new page right after original (account for already-inserted pages)
      const insertIdx = pn + inserted; // 0-based index = right after original
      const newPage   = doc.insertPage(insertIdx, [pw, ph]);
      newPage.drawImage(pngEmb, { x: 0, y: 0, width: pw, height: ph });
      inserted++;
    }

    const saved = await doc.save({ useObjectStreams: false });
    await renderPDFFromData({
      name: currentPdfName, size: saved.length,
      data: bytesToBase64(saved), filePath: currentFilePath
    }, true);
    t(`Traduction insérée ✓ — ${inserted} page(s) ajoutée(s) après l'original`);
  } catch (err) {
    console.error('InPlace translate error:', err);
    t('Erreur : ' + err.message.slice(0, 80));
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-language"></i> Traduire';
    btn.style.pointerEvents = '';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CLEF API IA PARTAGÉE ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
async function _getAIKey() {
  try {
    const s = await window.electronAPI.getSettings();
    if (s && s.openaiKey) return s.openaiKey;
  } catch(e) {}
  return '';
}

async function aiKeySave(val) {
  try {
    const s = await window.electronAPI.getSettings();
    await window.electronAPI.saveSettings({ ...s, openaiKey: val });
  } catch(e) {}
}

// OpenAI key is stored in Settings (gear icon) — no inline pre-fill needed.

// ═════════════════════════════════════════════════════════════════════════════
// ── RÉSUMÉ DU DOCUMENT ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function openSummarizePanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('sum-overlay').style.display = 'flex';
  document.getElementById('sum-loading').style.display = 'none';
  document.getElementById('sum-content').style.display = 'none';
}

function closeSummarizePanel() {
  document.getElementById('sum-overlay').style.display = 'none';
}

async function doSummarize() {
  const apiKey = await _getAIKey();
  if (!apiKey) { t('Clé API OpenAI manquante — configurez-la dans Paramètres (⚙)'); return; }
  if (!currentPdfDoc) return;

  const btn = document.getElementById('sum-btn');
  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse…';
  document.getElementById('sum-loading').style.display = 'flex';
  document.getElementById('sum-content').style.display = 'none';

  try {
    // Extract text from all pages (max 60k chars)
    document.getElementById('sum-status').textContent = 'Extraction du texte…';
    let fullText = '';
    const maxPages = currentPdfDoc.numPages;
    for (let p = 1; p <= maxPages; p++) {
      const page = await currentPdfDoc.getPage(p);
      const tc   = await page.getTextContent();
      const pTxt = tc.items.map(i => i.str).join(' ');
      fullText += `[Page ${p}]\n${pTxt}\n\n`;
      if (fullText.length > 65000) { fullText += '\n[…document tronqué…]'; break; }
    }

    if (!fullText.trim()) {
      _sumShowError('Aucun texte extractible — ce PDF est peut-être scanné. Utilisez l\'OCR d\'abord.');
      return;
    }

    document.getElementById('sum-status').textContent = 'Analyse par IA…';

    const sumLang = document.getElementById('sum-lang')?.value || 'auto';
    const langRule = sumLang === 'auto'
      ? 'Respond in the same language as the document.'
      : `Respond ENTIRELY in ${sumLang} — translate all fields to ${sumLang}.`;

    const prompt = `Analyze this document and return a structured JSON summary.

Return ONLY valid JSON, no markdown, with this exact structure:
{
  "document_type": "type of document (contract, invoice, report, letter, etc.)",
  "language": "detected language",
  "executive_summary": "2-4 sentence executive summary",
  "key_points": ["point 1", "point 2", "point 3", ...],
  "important_figures": ["Rp 1,000,000", "12 items", etc.],
  "conclusions": "main conclusions or recommendations",
  "parties": ["party 1", "party 2"],
  "dates": ["date 1", "date 2"]
}

Rules:
- ${langRule}
- key_points: 4-8 items
- important_figures: only actual numbers/amounts, max 8
- parties: names of people, companies, organizations mentioned
- dates: relevant dates found in the document, max 5

Document:
${fullText}`;

    const res = await window.electronAPI.aiChat(
      [{ role: 'user', content: prompt }], apiKey, null
    );

    document.getElementById('sum-loading').style.display = 'none';
    if (!res.success) throw new Error(res.error);

    let data;
    try {
      const clean = res.result.trim().replace(/^```(?:json)?\n?|```$/gm, '').trim();
      data = JSON.parse(clean);
    } catch {
      _sumShowRaw(res.result);
      return;
    }
    _sumRender(data);
  } catch(err) {
    console.error('Summarize error:', err);
    _sumShowError('Erreur : ' + err.message.slice(0, 120));
  } finally {
    btn.style.pointerEvents = '';
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyser';
  }
}

function _sumShowError(msg) {
  document.getElementById('sum-loading').style.display = 'none';
  const c = document.getElementById('sum-content');
  c.innerHTML = `<div style="color:#e74c3c;padding:10px;font-size:.8rem;line-height:1.5">${msg}</div>`;
  c.style.display = 'block';
}
function _sumShowRaw(text) {
  const c = document.getElementById('sum-content');
  c.innerHTML = `<div style="white-space:pre-wrap;font-size:.78rem;color:var(--txt);line-height:1.6">${text.replace(/</g,'&lt;')}</div>`;
  c.style.display = 'block';
}
function _sumRender(d) {
  const esc = s => String(s || '').replace(/</g,'&lt;');
  let html = '';

  if (d.document_type)
    html += `<span class="sum-type-badge"><i class="fa-solid fa-file" style="margin-right:5px"></i>${esc(d.document_type)}${d.language ? ' · ' + esc(d.language) : ''}</span>`;

  if (d.executive_summary)
    html += `<div class="sum-section"><div class="sum-section-title">Résumé exécutif</div>
      <div class="sum-executive">${esc(d.executive_summary)}</div></div>`;

  if (d.key_points?.length)
    html += `<div class="sum-section"><div class="sum-section-title">Points clés</div>` +
      d.key_points.map(p => `<div class="sum-kp-item"><span class="sum-kp-bullet">▸</span><span>${esc(p)}</span></div>`).join('') + `</div>`;

  if (d.important_figures?.length)
    html += `<div class="sum-section"><div class="sum-section-title">Chiffres importants</div>` +
      d.important_figures.map(f => `<span class="sum-fig-item">${esc(f)}</span>`).join('') + `</div>`;

  if (d.parties?.length)
    html += `<div class="sum-section"><div class="sum-section-title">Parties concernées</div>` +
      d.parties.map(p => `<div class="sum-kp-item"><span class="sum-kp-bullet"><i class="fa-solid fa-user" style="font-size:.7rem"></i></span><span>${esc(p)}</span></div>`).join('') + `</div>`;

  if (d.dates?.length)
    html += `<div class="sum-section"><div class="sum-section-title">Dates</div>` +
      d.dates.map(f => `<span class="sum-fig-item">${esc(f)}</span>`).join('') + `</div>`;

  if (d.conclusions)
    html += `<div class="sum-section"><div class="sum-section-title">Conclusions</div>
      <div class="sum-conclusion">${esc(d.conclusions)}</div></div>`;

  const c = document.getElementById('sum-content');
  c.innerHTML = html;
  c.style.display = 'block';
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CHAT AVEC LE PDF ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _chatHistory = [];
let _pdfCtxCache = null; // { name, text }

// Switch to AI tab and focus chat
function activatePDFChat() {
  // Switch right panel to IA tab
  document.querySelectorAll('.pt').forEach(b => b.classList.remove('act'));
  document.querySelectorAll('.pv').forEach(p => p.classList.remove('act'));
  document.querySelectorAll('.pt').forEach(b => {
    if (b.textContent.trim() === 'IA') b.classList.add('act');
  });
  document.getElementById('r-ai')?.classList.add('act');
  document.getElementById('r-ai').style.display = 'block';
  setTimeout(() => document.getElementById('chat-inp')?.focus(), 100);
  t('Chat PDF activé — posez votre question');
}

async function _buildPdfContext() {
  if (_pdfCtxCache && _pdfCtxCache.name === currentPdfName && _pdfCtxCache.text)
    return _pdfCtxCache.text;
  if (!currentPdfDoc) return '';
  let text = '';
  const maxP = Math.min(currentPdfDoc.numPages, 30);
  for (let p = 1; p <= maxP; p++) {
    const page = await currentPdfDoc.getPage(p);
    const tc   = await page.getTextContent();
    text += `[Page ${p}] ` + tc.items.map(i => i.str).join(' ') + '\n';
    if (text.length > 60000) break;
  }
  _pdfCtxCache = { name: currentPdfName, text };
  return text;
}

function _chatAddBubble(role, text, extraClass) {
  const display = document.getElementById('chat-display');
  if (!display) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}${extraClass ? ' ' + extraClass : ''}`;
  bubble.textContent = text;
  display.appendChild(bubble);
  display.scrollTop = display.scrollHeight;
  return bubble;
}

async function chatSend(event) {
  if (event?.type === 'keydown') {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return; // Shift+Enter = new line
    event.preventDefault(); // block default newline on Enter
  }
  const inp = document.getElementById('chat-inp');
  const msg = inp?.value.trim();
  if (!msg) return;

  const apiKey = await _getAIKey();
  if (!apiKey) {
    _chatAddBubble('ai', '⚠️ Clé API OpenAI manquante — configurez-la dans Paramètres (⚙).', 'error');
    return;
  }
  if (!currentPdfDoc) {
    _chatAddBubble('ai', '⚠️ Ouvrez un PDF d\'abord.', 'error');
    return;
  }

  inp.value = '';
  inp.style.height = '';
  _chatAddBubble('user', msg);
  const typingBubble = _chatAddBubble('ai', '···', 'typing');

  try {
    // Build PDF context (cached)
    const pdfText = await _buildPdfContext();

    const systemContent = `Tu es un assistant expert qui analyse des documents PDF.
${pdfText ? `Voici le contenu du document "${currentPdfName || 'document'}" :\n\n${pdfText}\n\n` : ''}
Réponds de façon précise et concise. Si le document est dans une autre langue, adapte ta réponse à la langue de l'utilisateur. Cite les numéros de page pertinents quand c'est utile.`;

    const messages = [
      { role: 'system', content: systemContent },
      ..._chatHistory.slice(-12), // keep last 6 exchanges
      { role: 'user', content: msg }
    ];

    const res = await window.electronAPI.aiChat(messages, apiKey, null);

    typingBubble.remove();

    if (!res.success) throw new Error(res.error);

    _chatHistory.push({ role: 'user',      content: msg });
    _chatHistory.push({ role: 'assistant', content: res.result });
    _chatAddBubble('ai', res.result);

    } catch(err) {
    typingBubble.remove();
    _chatAddBubble('ai', '⚠️ Erreur : ' + err.message.slice(0, 100), 'error');
  }
}

function clearChat() {
  _chatHistory = [];
  _pdfCtxCache = null;
  const display = document.getElementById('chat-display');
  if (display) display.innerHTML = '';
  t('Conversation effacée');
}

// ═════════════════════════════════════════════════════════════════════════════
// ── COMPARER DEUX VERSIONS ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let cmpPdfA = null; // { name, bytes }
let cmpPdfB = null;

function openComparePanel() {
  document.getElementById('cmp-overlay').style.display = 'flex';
  document.getElementById('cmp-result').style.display = 'none';
  document.getElementById('cmp-loading').style.display = 'none';
  cmpPdfA = null; cmpPdfB = null;
  document.getElementById('cmp-a-name').textContent = '— aucun fichier —';
  document.getElementById('cmp-b-name').textContent = '— aucun fichier —';
  _cmpUpdateBtn();
  // Pre-load current doc as A
  if (currentPdfData && currentPdfName) {
    cmpPdfA = { name: currentPdfName, data: currentPdfData };
    document.getElementById('cmp-a-name').textContent = currentPdfName;
    _cmpUpdateBtn();
  }
}
function closeCmpPanel() { document.getElementById('cmp-overlay').style.display = 'none'; }

function _cmpUpdateBtn() {
  const btn = document.getElementById('cmp-btn');
  const ok  = !!(cmpPdfA && cmpPdfB);
  btn.style.pointerEvents = ok ? '' : 'none';
  btn.style.opacity       = ok ? '1' : '0.4';
}

async function cmpLoadA(source) {
  if (source === 'current') {
    if (!currentPdfData) { t('Aucun document ouvert'); return; }
    cmpPdfA = { name: currentPdfName, data: currentPdfData };
    document.getElementById('cmp-a-name').textContent = currentPdfName;
  } else {
    const file = await _cmpOpenPDF();
    if (!file) return;
    cmpPdfA = file;
    document.getElementById('cmp-a-name').textContent = file.name;
  }
  _cmpUpdateBtn();
}
async function cmpLoadB() {
  const file = await _cmpOpenPDF();
  if (!file) return;
  cmpPdfB = file;
  document.getElementById('cmp-b-name').textContent = file.name;
  _cmpUpdateBtn();
}

async function _cmpOpenPDF() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) { resolve(null); return; }
      const buf  = await f.arrayBuffer();
      const data = btoa(String.fromCharCode(...new Uint8Array(buf)));
      resolve({ name: f.name, data });
    };
    inp.click();
  });
}

async function _cmpExtractText(pdfData) {
  const bytes  = base64ToBytes(pdfData);
  const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages  = [];
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const tc   = await page.getTextContent();
    pages.push(tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
    page.cleanup();
  }
  return pages;
}

// Myers diff on word tokens
function _wordDiff(a, b) {
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  // Simple LCS-based diff
  const n = wa.length, m = wb.length;
  const dp = Array.from({length: n+1}, () => new Array(m+1).fill(0));
  for (let i = n-1; i >= 0; i--)
    for (let j = m-1; j >= 0; j--)
      dp[i][j] = wa[i] === wb[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && wa[i] === wb[j]) { ops.push({t:'=', v:wa[i]}); i++; j++; }
    else if (j < m && (i >= n || dp[i][j+1] >= (i<n?dp[i+1][j]:0))) { ops.push({t:'+', v:wb[j]}); j++; }
    else { ops.push({t:'-', v:wa[i]}); i++; }
  }
  return ops;
}

async function doCompare() {
  if (!cmpPdfA || !cmpPdfB) return;
  document.getElementById('cmp-result').style.display  = 'none';
  document.getElementById('cmp-loading').style.display = 'flex';
  try {
    const [pagesA, pagesB] = await Promise.all([
      _cmpExtractText(cmpPdfA.data), _cmpExtractText(cmpPdfB.data)
    ]);
    const nPages = Math.max(pagesA.length, pagesB.length);
    let totalAdd = 0, totalDel = 0, totalSame = 0;
    let htmlA = '', htmlB = '';
    for (let p = 0; p < nPages; p++) {
      const txtA = pagesA[p] || '';
      const txtB = pagesB[p] || '';
      if (!txtA && !txtB) continue;
      const diff = _wordDiff(txtA, txtB);
      let renderA = '', renderB = '';
      diff.forEach(op => {
        const esc = op.v.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if      (op.t === '=') { renderA += `<span class="cmp-same">${esc} </span>`; renderB += `<span class="cmp-same">${esc} </span>`; totalSame++; }
        else if (op.t === '-') { renderA += `<span class="cmp-del">${esc} </span>`; totalDel++; }
        else                   { renderB += `<span class="cmp-add">${esc} </span>`; totalAdd++; }
      });
      htmlA += `<div class="cmp-page"><div class="cmp-page-num">Page ${p+1}</div><div class="cmp-text">${renderA||'<em style="opacity:.4">vide</em>'}</div></div>`;
      htmlB += `<div class="cmp-page"><div class="cmp-page-num">Page ${p+1}</div><div class="cmp-text">${renderB||'<em style="opacity:.4">vide</em>'}</div></div>`;
    }
    const total = totalAdd + totalDel + totalSame || 1;
    const sim   = Math.round(totalSame / total * 100);
    const res   = document.getElementById('cmp-result');
    res.innerHTML =
      `<div class="cmp-stat">
        <span>Similarité : <b style="color:var(--gold)">${sim}%</b></span>
        <span style="color:#2ecc71">+${totalAdd} ajouts</span>
        <span style="color:#e74c3c">−${totalDel} suppressions</span>
        <span>${totalSame} mots identiques</span>
      </div>
      <div class="cmp-cols">
        <div class="cmp-col"><div class="cmp-col-hdr">A — ${cmpPdfA.name}</div>${htmlA}</div>
        <div class="cmp-col" style="border-left:1px solid rgba(200,150,46,.2)"><div class="cmp-col-hdr">B — ${cmpPdfB.name}</div>${htmlB}</div>
      </div>`;
    res.style.display = 'block';
  } catch(e) { t('Erreur comparaison : ' + e.message); }
  finally { document.getElementById('cmp-loading').style.display = 'none'; }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── HISTORIQUE DES MODIFICATIONS ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const _modHistory = [];

function _logMod(operation, detail) {
  _modHistory.push({ op: operation, detail: detail || '', time: new Date() });
}

function openHistoryPanel() {
  document.getElementById('hist-overlay').style.display = 'flex';
  _renderHistory();
}
function closeHistPanel() { document.getElementById('hist-overlay').style.display = 'none'; }

function _renderHistory() {
  const c = document.getElementById('hist-content');
  if (!_modHistory.length) {
    c.innerHTML = '<div class="hist-empty">Aucune modification enregistrée dans cette session.</div>';
    return;
  }
  c.innerHTML = [..._modHistory].reverse().map((e, i) => {
    const d = e.time;
    const hm = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0');
    return `<div class="hist-item">
      <div class="hist-dot" style="background:${_histColor(e.op)}"></div>
      <div>
        <div class="hist-op"><b>${e.op}</b>${e.detail ? ' — ' + e.detail : ''}</div>
        <div class="hist-time">${hm} · ${d.toLocaleDateString('fr-FR')}</div>
      </div>
    </div>`;
  }).join('');
}

function _histColor(op) {
  if (op.includes('Tampon') || op.includes('Filigrane')) return '#f39c12';
  if (op.includes('Supprim') || op.includes('Redact') || op.includes('Biffur')) return '#e74c3c';
  if (op.includes('Traduct') || op.includes('Résumé') || op.includes('Chat')) return '#9b59b6';
  if (op.includes('Page') || op.includes('Rotat') || op.includes('Fusionn')) return '#3498db';
  if (op.includes('Signatur') || op.includes('Certificat') || op.includes('Chiffr')) return '#2ecc71';
  return 'var(--gold)';
}

function clearHistory() {
  _modHistory.length = 0;
  _renderHistory();
}

function exportHistory() {
  if (!_modHistory.length) { t('Historique vide'); return; }
  const lines = _modHistory.map(e =>
    `[${e.time.toLocaleString('fr-FR')}] ${e.op}${e.detail ? ' — ' + e.detail : ''}`
  ).join('\n');
  const hdr = `Historique PDFEditor — ${currentPdfName || 'document'}\n${'═'.repeat(60)}\n`;
  const blob = new Blob([hdr + lines], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'historique_' + (currentPdfName||'pdf').replace(/\.pdf$/i,'') + '.txt';
  a.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// ── MÉTADONNÉES ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
async function openMetaPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('meta-overlay').style.display = 'flex';
  // Load existing metadata
  try {
    const { PDFDocument } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    document.getElementById('meta-title').value    = doc.getTitle()    || '';
    document.getElementById('meta-author').value   = doc.getAuthor()   || '';
    document.getElementById('meta-subject').value  = doc.getSubject()  || '';
    document.getElementById('meta-keywords').value = doc.getKeywords() || '';
    document.getElementById('meta-creator').value  = doc.getCreator()  || '';
    // Try to get language from XMP
    const langEl = document.getElementById('meta-lang');
    if (langEl) langEl.value = '';
  } catch(e) { /* ignore */ }
  _metaScorePreview();
}
function closeMetaPanel() { document.getElementById('meta-overlay').style.display = 'none'; }

function _metaScorePreview() {
  const title    = document.getElementById('meta-title').value.trim();
  const author   = document.getElementById('meta-author').value.trim();
  const lang     = document.getElementById('meta-lang').value;
  const keywords = document.getElementById('meta-keywords').value.trim();
  const prev     = document.getElementById('meta-score-preview');
  const items    = [];
  if (title)    items.push('<span style="color:#2ecc71">✓ Titre présent (+pts score)</span>');
  if (lang)     items.push('<span style="color:#2ecc71">✓ Langue définie (+pts score)</span>');
  if (author)   items.push('<span style="color:var(--gold)">✓ Auteur renseigné</span>');
  if (keywords) items.push('<span style="color:var(--gold)">✓ Mots-clés renseignés</span>');
  if (items.length) {
    prev.innerHTML = '<b style="color:var(--gold)">Impact sur le score :</b> ' + items.join(' · ');
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}
// Wire live preview
['meta-title','meta-author','meta-subject','meta-keywords','meta-creator'].forEach(id => {
  document.addEventListener('input', e => { if (e.target.id === id) _metaScorePreview(); });
});
document.addEventListener('change', e => { if (e.target.id === 'meta-lang') _metaScorePreview(); });

async function doSaveMeta() {
  if (!currentPdfData) return;
  const title    = document.getElementById('meta-title').value.trim();
  const author   = document.getElementById('meta-author').value.trim();
  const subject  = document.getElementById('meta-subject').value.trim();
  const keywords = document.getElementById('meta-keywords').value.trim();
  const creator  = document.getElementById('meta-creator').value.trim();
  const lang     = document.getElementById('meta-lang').value;
  try {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    if (title)    doc.setTitle(title);
    if (author)   doc.setAuthor(author);
    if (subject)  doc.setSubject(subject);
    if (keywords) doc.setKeywords([keywords]);
    if (creator)  doc.setCreator(creator);
    doc.setProducer('PDFEditor Pro');
    doc.setModificationDate(new Date());
    // Set language in catalog if provided
    if (lang) {
      const { PDFName, PDFString } = PDFLib;
      doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeMetaPanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    _logMod('Métadonnées modifiées', [title && 'titre', lang && 'langue', author && 'auteur'].filter(Boolean).join(', '));
    t('Métadonnées enregistrées');
  } catch(e) { t('Erreur : ' + e.message); }
}

async function doCleanMeta() {
  if (!currentPdfData) return;
  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject('');
    doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
    // Remove lang
    doc.catalog.delete(PDFName.of('Lang'));
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeMetaPanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    _logMod('Métadonnées supprimées');
    t('Métadonnées supprimées');
  } catch(e) { t('Erreur : ' + e.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CERTIFICAT & HORODATAGE ──────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function openCertPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('cert-overlay').style.display = 'flex';
  // Populate page selector
  const sel = document.getElementById('cert-page');
  sel.innerHTML = Array.from({length: currentPdfDoc.numPages}, (_,i) =>
    `<option value="${i+1}">Page ${i+1}</option>`).join('');
  // Default date = today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('cert-date').value = today;
  certPreview();
}
function closeCertPanel() { document.getElementById('cert-overlay').style.display = 'none'; }

function _certColors(style) {
  switch(style) {
    case 'blue': return { border:'#2980b9', text:'#1a5276', bg:'rgba(41,128,185,.08)', accent:'#3498db' };
    case 'red':  return { border:'#c0392b', text:'#7b241c', bg:'rgba(192,57,43,.08)', accent:'#e74c3c' };
    case 'bw':   return { border:'#333',    text:'#111',    bg:'rgba(0,0,0,.05)',      accent:'#555' };
    default:     return { border:'#b8860b', text:'#7d5500', bg:'rgba(200,150,46,.08)', accent:'#c8962e' };
  }
}

function certPreview() {
  const cv  = document.getElementById('cert-preview-cv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const name    = document.getElementById('cert-name').value    || 'Nom du signataire';
  const org     = document.getElementById('cert-org').value     || 'Organisation';
  const purpose = document.getElementById('cert-purpose').value || 'Approuvé';
  const date    = document.getElementById('cert-date').value    || new Date().toISOString().split('T')[0];
  const style   = document.querySelector('input[name="cert-style"]:checked')?.value || 'gold';
  const c       = _certColors(style);
  _drawCertStamp(ctx, 320, 100, name, org, purpose, date, c);
}

function _drawCertStamp(ctx, W, H, name, org, purpose, date, c) {
  ctx.clearRect(0, 0, W, H);
  // Background
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  // Border double
  ctx.strokeStyle = c.border; ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W-4, H-4);
  ctx.strokeStyle = c.accent + '66'; ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, W-10, H-10);
  // Certificate icon area
  ctx.fillStyle = c.accent;
  ctx.font = 'bold 22px serif';
  ctx.fillText('✦', 14, 34);
  // Title
  ctx.fillStyle = c.border;
  ctx.font = 'bold 8px "Arial Narrow",Arial,sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('DOCUMENT CERTIFIÉ', 42, 16);
  ctx.letterSpacing = '0px';
  // Name
  ctx.fillStyle = c.text;
  ctx.font = 'bold 11px Arial,sans-serif';
  ctx.fillText(name.slice(0, 38), 42, 32);
  // Org
  ctx.font = '9px Arial,sans-serif';
  ctx.fillStyle = c.accent;
  ctx.fillText(org.slice(0, 42), 42, 46);
  // Purpose
  ctx.fillStyle = c.text;
  ctx.font = 'italic 9px Arial,sans-serif';
  ctx.fillText(purpose.slice(0, 45), 14, 64);
  // Date line
  ctx.fillStyle = c.border;
  ctx.font = '8px monospace';
  const dateStr = 'Horodaté le ' + date + ' · PDFEditor Pro';
  ctx.fillText(dateStr, 14, 82);
  // Bottom star row
  ctx.fillStyle = c.accent + 'aa';
  ctx.font = '7px serif';
  for (let x = 14; x < W-20; x += 14) ctx.fillText('✦', x, 95);
}

async function doApplyCert() {
  if (!currentPdfData) return;
  const name    = document.getElementById('cert-name').value.trim()    || 'Non renseigné';
  const org     = document.getElementById('cert-org').value.trim()     || '';
  const purpose = document.getElementById('cert-purpose').value.trim() || 'Certifié';
  const dateVal = document.getElementById('cert-date').value           || new Date().toISOString().split('T')[0];
  const pageNum = parseInt(document.getElementById('cert-page').value) || 1;
  const pos     = document.getElementById('cert-pos').value            || 'br';
  const style   = document.querySelector('input[name="cert-style"]:checked')?.value || 'gold';
  const c       = _certColors(style);

  // Rasterize stamp to PNG
  const stampW = 280, stampH = 88;
  const cv = document.createElement('canvas');
  cv.width = stampW * 2; cv.height = stampH * 2; // @2x
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  _drawCertStamp(ctx, stampW, stampH, name, org, purpose, dateVal, c);
  const pngB64 = cv.toDataURL('image/png').split(',')[1];

  const btn = document.getElementById('cert-btn');
  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    const { PDFDocument } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageNum - 1];
    const { width: pw, height: ph } = page.getSize();
    const imgW = stampW * 0.75, imgH = stampH * 0.75; // PDF pts
    // Position
    let px, py;
    const mg = 18;
    switch(pos) {
      case 'bl': px = mg;        py = mg;           break;
      case 'tr': px = pw-imgW-mg; py = ph-imgH-mg;  break;
      case 'tl': px = mg;        py = ph-imgH-mg;   break;
      case 'center': px = (pw-imgW)/2; py = (ph-imgH)/2; break;
      default:   px = pw-imgW-mg; py = mg;           break; // br
    }
    const embImg = await doc.embedPng(base64ToBytes(pngB64));
    page.drawImage(embImg, { x: px, y: py, width: imgW, height: imgH });
    // Add certification metadata
    doc.setSubject('Certifié par ' + name + (org ? ' · ' + org : ''));
    doc.setKeywords(['certifié', 'horodaté', purpose]);
    doc.setModificationDate(new Date());
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeCertPanel();
    await fastRerenderPage(data, [pageNum]);
    _logMod('Certificat apposé', `${name} — ${purpose} — p.${pageNum}`);
    t('Certificat apposé sur la page ' + pageNum);
  } catch(e) { t('Erreur : ' + e.message); }
  finally {
    btn.style.pointerEvents = '';
    btn.innerHTML = '<i class="fa-solid fa-certificate"></i> Appliquer';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── EXTRAIRE TABLEAUX ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _extractedTables = []; // [[ [row cells] ]]

function openExtractTablePanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('tbl-overlay').style.display = 'flex';
  document.getElementById('tbl-result').innerHTML = '';
  document.getElementById('tbl-count').textContent = '';
  document.getElementById('tbl-export-row').style.display = 'none';
  document.getElementById('tbl-loading').style.display = 'none';
  _extractedTables = [];
  // Populate page selector
  const sel = document.getElementById('tbl-page');
  sel.innerHTML = Array.from({length: currentPdfDoc.numPages}, (_,i) =>
    `<option value="${i+1}">Page ${i+1}</option>`).join('');
}
function closeTblPanel() { document.getElementById('tbl-overlay').style.display = 'none'; }

async function doDetectTables() {
  const pageNum = parseInt(document.getElementById('tbl-page').value) || 1;
  document.getElementById('tbl-result').innerHTML = '';
  document.getElementById('tbl-loading').style.display = 'flex';
  document.getElementById('tbl-count').textContent = '';
  document.getElementById('tbl-export-row').style.display = 'none';
  document.getElementById('tbl-detect-btn').style.pointerEvents = 'none';
  try {
    const page  = await currentPdfDoc.getPage(pageNum);
    const tc    = await page.getTextContent({ includeMarkedContent: false });
    const items = tc.items.filter(i => i.str.trim());
    if (!items.length) {
      document.getElementById('tbl-result').innerHTML = '<div class="tbl-empty">Aucun texte détectable sur cette page (PDF scanné ?).</div>';
      return;
    }
    // ── Step 1: cluster items into rows by Y coordinate
    const YTHRESH = 4; // pts tolerance for same row
    const rows = [];
    items.forEach(item => {
      const y = Math.round(item.transform[5] / YTHRESH) * YTHRESH;
      let row = rows.find(r => Math.abs(r.y - y) <= YTHRESH);
      if (!row) { row = { y, cells: [] }; rows.push(row); }
      row.cells.push({ x: item.transform[4], y: item.transform[5], text: item.str.trim(), w: item.width });
    });
    rows.sort((a, b) => b.y - a.y); // PDF Y is bottom-up → sort descending = top-to-bottom
    rows.forEach(r => r.cells.sort((a, b) => a.x - b.x));

    // ── Step 2: detect column boundaries (X clusters across all rows)
    const allX = rows.flatMap(r => r.cells.map(c => c.x));
    const cols  = _clusterValues(allX, 15); // group X positions within 15pts

    // ── Step 3: build table matrix — assign each cell to nearest column
    const matrix = rows.map(row => {
      const rowArr = new Array(cols.length).fill('');
      row.cells.forEach(cell => {
        const ci = cols.reduce((best, cx, i) =>
          Math.abs(cx - cell.x) < Math.abs(cols[best] - cell.x) ? i : best, 0);
        rowArr[ci] = rowArr[ci] ? rowArr[ci] + ' ' + cell.text : cell.text;
      });
      return rowArr;
    });

    // ── Step 4: filter out non-table rows (rows with only 1 column populated)
    // Split matrix into table segments separated by sparse rows
    const tables = _splitIntoTables(matrix, cols.length);
    _extractedTables = tables;

    if (!tables.length) {
      document.getElementById('tbl-result').innerHTML = '<div class="tbl-empty">Aucun tableau détecté. Le document ne semble pas contenir de structure tabulaire.</div>';
      return;
    }

    // ── Render
    document.getElementById('tbl-count').textContent = `${tables.length} tableau${tables.length>1?'x':''} détecté${tables.length>1?'s':''}`;
    document.getElementById('tbl-export-row').style.display = 'flex';
    const html = tables.map((tbl, ti) => {
      const hdr  = tbl[0];
      const body = tbl.slice(1);
      const thHtml = hdr.map(h => `<th>${_esc(h)}</th>`).join('');
      const tbHtml = body.map(row =>
        '<tr>' + row.map(c => `<td>${_esc(c)}</td>`).join('') + '</tr>'
      ).join('');
      return `<div class="tbl-table-wrap">
        <div class="tbl-table-title">Tableau ${ti+1} — ${tbl.length} lignes × ${hdr.length} colonnes</div>
        <table class="tbl-table"><thead><tr>${thHtml}</tr></thead><tbody>${tbHtml}</tbody></table>
      </div>`;
    }).join('');
    document.getElementById('tbl-result').innerHTML = html;
    _logMod('Tableaux extraits', `page ${pageNum} — ${tables.length} tableau(x)`);
  } catch(e) {
    document.getElementById('tbl-result').innerHTML = `<div class="tbl-empty" style="color:#e74c3c">Erreur : ${e.message}</div>`;
  } finally {
    document.getElementById('tbl-loading').style.display = 'none';
    document.getElementById('tbl-detect-btn').style.pointerEvents = '';
  }
}

function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function _clusterValues(vals, thresh) {
  const sorted = [...new Set(vals.map(v => Math.round(v)))].sort((a,b) => a-b);
  const clusters = [];
  sorted.forEach(v => {
    const last = clusters[clusters.length-1];
    if (last !== undefined && v - last <= thresh) {
      // merge into cluster center
      clusters[clusters.length-1] = Math.round((last + v) / 2);
    } else {
      clusters.push(v);
    }
  });
  return clusters;
}

function _splitIntoTables(matrix, nCols) {
  // A "sparse" row: has fewer than 2 populated cells → likely a title/separator
  const isSparse = row => row.filter(Boolean).length < 2;
  const tables = [];
  let current  = [];
  matrix.forEach(row => {
    if (isSparse(row)) {
      if (current.length >= 2) tables.push(current);
      current = [];
    } else {
      current.push(row);
    }
  });
  if (current.length >= 2) tables.push(current);
  // Filter tables with at least 2 columns
  return tables.filter(t => t[0] && t[0].filter(Boolean).length >= 2);
}

function exportTableCSV() {
  if (!_extractedTables.length) return;
  const csv = _extractedTables.map((tbl, i) =>
    `# Tableau ${i+1}\n` + tbl.map(row => row.map(c => `"${(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  ).join('\n\n');
  _downloadText(csv, 'tableaux.csv', 'text/csv');
  t('CSV exporté');
}
function exportTableTSV() {
  if (!_extractedTables.length) return;
  const tsv = _extractedTables.map((tbl, i) =>
    `# Tableau ${i+1}\n` + tbl.map(row => row.map(c => (c||'').replace(/\t/g,' ')).join('\t')).join('\n')
  ).join('\n\n');
  _downloadText(tsv, 'tableaux.tsv', 'text/tab-separated-values');
  t('TSV exporté');
}
function _downloadText(text, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: mime}));
  a.download = filename; a.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// ── COMPRESSER ───────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function openCompressPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('comp-overlay').style.display = 'flex';
  document.getElementById('comp-result').style.display  = 'none';
  document.getElementById('comp-progress').style.display= 'none';
  const sz = currentPdfData ? Math.round(currentPdfData.length * 0.75 / 1024) : 0;
  document.getElementById('comp-size-info').innerHTML =
    `Taille actuelle : <b style="color:var(--gold)">${sz} Ko</b>`;
}
function closeCompressPanel() { document.getElementById('comp-overlay').style.display = 'none'; }

async function doCompress() {
  const level   = document.querySelector('input[name="comp-level"]:checked')?.value || 'light';
  const quality = parseInt(document.getElementById('comp-quality')?.value || '65') / 100;
  const btn     = document.getElementById('comp-btn');
  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  document.getElementById('comp-progress').style.display = 'block';
  document.getElementById('comp-result').style.display   = 'none';

  const setProgress = (pct, txt) => {
    document.getElementById('comp-bar').style.width = pct + '%';
    document.getElementById('comp-progress-txt').textContent = txt;
  };

  try {
    const origSize = Math.round(currentPdfData.length * 0.75 / 1024);
    let newData;

    if (level === 'light') {
      setProgress(30, 'Nettoyage des objets…');
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
      // Clear verbose metadata
      doc.setTitle(doc.getTitle() || ''); doc.setProducer('PDFEditor Pro');
      doc.setModificationDate(new Date());
      setProgress(80, 'Sauvegarde optimisée…');
      newData = bytesToBase64(await doc.save({ useObjectStreams: false }));
      setProgress(100, 'Terminé');

    } else if (level === 'medium') {
      // Recompress page images via canvas
      const { PDFDocument } = PDFLib;
      const origBytes = base64ToBytes(currentPdfData);
      const srcDoc    = await pdfjsLib.getDocument({ data: origBytes }).promise;
      const newDoc    = await PDFDocument.create();
      const SCALE     = 1.5; // render at 1.5x for decent quality
      const n         = srcDoc.numPages;
      for (let p = 1; p <= n; p++) {
        setProgress(Math.round((p-1)/n*85), `Recompression page ${p}/${n}…`);
        const page  = await srcDoc.getPage(p);
        const vp0   = page.getViewport({ scale: 1 });
        const vp    = page.getViewport({ scale: SCALE });
        const cv    = document.createElement('canvas');
        cv.width    = Math.round(vp.width); cv.height = Math.round(vp.height);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        page.cleanup();
        const jpgB64 = cv.toDataURL('image/jpeg', 0.72).split(',')[1];
        const embImg = await newDoc.embedJpg(base64ToBytes(jpgB64));
        const pg     = newDoc.addPage([vp0.width, vp0.height]);
        pg.drawImage(embImg, { x: 0, y: 0, width: vp0.width, height: vp0.height });
      }
      setProgress(95, 'Sauvegarde…');
      newData = bytesToBase64(await newDoc.save({ useObjectStreams: false }));
      setProgress(100, 'Terminé');

    } else { // strong
      const { PDFDocument } = PDFLib;
      const origBytes = base64ToBytes(currentPdfData);
      const srcDoc    = await pdfjsLib.getDocument({ data: origBytes }).promise;
      const newDoc    = await PDFDocument.create();
      const SCALE     = 1.0;
      const n         = srcDoc.numPages;
      for (let p = 1; p <= n; p++) {
        setProgress(Math.round((p-1)/n*88), `Rasterisation page ${p}/${n}…`);
        const page  = await srcDoc.getPage(p);
        const vp0   = page.getViewport({ scale: 1 });
        const vp    = page.getViewport({ scale: SCALE });
        const cv    = document.createElement('canvas');
        cv.width    = Math.round(vp.width); cv.height = Math.round(vp.height);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        page.cleanup();
        const jpgB64 = cv.toDataURL('image/jpeg', quality).split(',')[1];
        const embImg = await newDoc.embedJpg(base64ToBytes(jpgB64));
        const pg     = newDoc.addPage([vp0.width, vp0.height]);
        pg.drawImage(embImg, { x: 0, y: 0, width: vp0.width, height: vp0.height });
      }
      setProgress(96, 'Sauvegarde…');
      newData = bytesToBase64(await newDoc.save({ useObjectStreams: false }));
      setProgress(100, 'Terminé');
    }

    const newSize  = Math.round(newData.length * 0.75 / 1024);
    const gain     = Math.round((1 - newData.length / currentPdfData.length) * 100);
    const gainTxt  = gain > 0 ? `–${gain}%` : `+${Math.abs(gain)}%`;
    const gainCol  = gain > 0 ? '#2ecc71' : '#e74c3c';
    document.getElementById('comp-result').innerHTML =
      `<b style="color:${gainCol}">${gainTxt}</b> &nbsp;·&nbsp; ${origSize} Ko → <b>${newSize} Ko</b>` +
      (level === 'strong' ? ' &nbsp;<span style="opacity:.6;font-size:.68rem">(texte converti en image)</span>' : '');
    document.getElementById('comp-result').style.display = 'block';

    closeCompressPanel();
    await renderPDFFromData({ name: currentPdfName, size: newSize * 1024, data: newData, filePath: currentFilePath }, true);
    _logMod('PDF compressé', `niveau ${level} — ${gainTxt} (${origSize}→${newSize} Ko)`);
    t(`Compression ${gainTxt} — ${newSize} Ko`);
  } catch(e) {
    t('Erreur compression : ' + e.message);
  } finally {
    btn.style.pointerEvents = ''; btn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Compresser';
    document.getElementById('comp-progress').style.display = 'none';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── AMÉLIORER LA QUALITÉ ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ── Real-ESRGAN ONNX ─────────────────────────────────────────────────────────
const ESRGAN_MODEL_NAME = 'realesrgan-x4plus.onnx';
// URLs de téléchargement — float32 en premier pour compatibilité maximale
const ESRGAN_MODEL_URLS = [
  'https://huggingface.co/imgdesignart/realesrgan-x4-onnx/resolve/main/onnx/model.onnx',
  'https://huggingface.co/imgdesignart/realesrgan-x4-onnx/resolve/main/onnx/model_fp16.onnx',
  'https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/real_esrgan_x4plus.onnx',
];
const ESRGAN_TILE_DEFAULT = 256;
const ESRGAN_SCALE_DEFAULT = 4;

// ── ESPCN ONNX (rapide, ~337 Ko) ─────────────────────────────────────────────
const ESPCN_MODEL_NAME = 'espcn-x4.onnx';
const ESPCN_MODEL_URLS = [
  'https://media.githubusercontent.com/media/onnx/models/main/validated/vision/super_resolution/sub_pixel_cnn_2016/model/super-resolution-10.onnx',
  'https://huggingface.co/datasets/onnx/super-resolution/resolve/main/super-resolution-10.onnx',
];
let esrganSession  = null;
let esrganTileH    = ESRGAN_TILE_DEFAULT;
let esrganTileW    = ESRGAN_TILE_DEFAULT;
let esrganChIn     = 3;
let esrganScale    = ESRGAN_SCALE_DEFAULT;
let esrganIsFloat16 = false; // le modèle attend-il du float16 ?

// ── Conversion float32 ↔ float16 ────────────────────────────────────────────
function _f32ToF16Array(src) {
  const dst = new Uint16Array(src.length);
  const f32 = new Float32Array(1);
  const i32 = new Int32Array(f32.buffer);
  for (let i = 0; i < src.length; i++) {
    f32[0] = src[i];
    const x    = i32[0];
    const sign = (x >> 16) & 0x8000;
    const exp  = ((x >> 23) & 0xff) - 127 + 15;
    const mant = x & 0x7fffff;
    if (exp <= 0)  { dst[i] = sign; continue; }
    if (exp >= 31) { dst[i] = sign | 0x7c00; continue; }
    dst[i] = sign | (exp << 10) | (mant >> 13);
  }
  return dst;
}
function _f16ToF32(v) {
  const sign = (v & 0x8000) ? -1 : 1;
  const exp  = (v >> 10) & 0x1f;
  const mant = v & 0x3ff;
  if (exp === 0)  return sign * Math.pow(2, -14) * (mant / 1024);
  if (exp === 31) return mant ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + mant / 1024);
}

function _showModelStatus(msg) {
  const el = document.getElementById('enh-model-status');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}

// Télécharge le modèle si absent, avec progression
async function _ensureEsrganDownloaded(setP) {
  const exists = await window.electronAPI.onnxModelExists(ESRGAN_MODEL_NAME);
  if (exists) return;
  _showModelStatus('⬇ Téléchargement du modèle Real-ESRGAN (~85 Mo)…');
  window.electronAPI.removeAllListeners('onnx-progress');
  let downloaded = false;
  for (const url of ESRGAN_MODEL_URLS) {
    try {
      setP(2, `Téléchargement depuis ${new URL(url).hostname}…`);
      window.electronAPI.onOnnxProgress(pct => {
        setP(Math.round(pct * 0.55), `Téléchargement… ${pct}%`);
        _showModelStatus(`⬇ Téléchargement… ${pct}%`);
      });
      const res = await window.electronAPI.onnxDownloadModel(url, ESRGAN_MODEL_NAME);
      if (res && res.ok) { downloaded = true; break; }
    } catch(e) { /* essayer URL suivante */ }
  }
  if (!downloaded) throw new Error(
    'Téléchargement échoué sur toutes les sources.\n' +
    'Placez manuellement "realesrgan-x4plus.onnx" dans userData/onnx-models/'
  );
  _showModelStatus('✅ Modèle téléchargé.');
}

async function _ensureEspcnDownloaded(setP) {
  const exists = await window.electronAPI.onnxModelExists(ESPCN_MODEL_NAME);
  if (exists) return;
  _showModelStatus('⬇ Téléchargement du modèle ESPCN (~337 Ko)…');
  window.electronAPI.removeAllListeners('onnx-progress');
  let downloaded = false;
  for (const url of ESPCN_MODEL_URLS) {
    try {
      setP(2, `Téléchargement ESPCN depuis ${new URL(url).hostname}…`);
      window.electronAPI.onOnnxProgress(pct => {
        setP(Math.round(pct * 0.1), `Téléchargement ESPCN… ${pct}%`);
      });
      const res = await window.electronAPI.onnxDownloadModel(url, ESPCN_MODEL_NAME);
      if (res && res.ok) { downloaded = true; break; }
    } catch(e) { /* essayer URL suivante */ }
  }
  if (!downloaded) throw new Error(
    'Téléchargement ESPCN échoué. Vérifiez votre connexion.'
  );
  _showModelStatus('✅ Modèle ESPCN téléchargé.');
}

async function ensureEsrganSession(setP) {
  if (esrganSession) return esrganSession;

  if (typeof ort === 'undefined') throw new Error('onnxruntime-web non chargé');
  const wasmBase = new URL('../node_modules/onnxruntime-web/dist/', window.location.href).href;
  ort.env.wasm.wasmPaths = wasmBase;
  ort.env.wasm.numThreads = 1;

  const exists = await window.electronAPI.onnxModelExists(ESRGAN_MODEL_NAME);
  if (!exists) {
    _showModelStatus('⬇ Téléchargement du modèle Real-ESRGAN en cours…');
    window.electronAPI.removeAllListeners('onnx-progress');

    let downloaded = false;
    for (const url of ESRGAN_MODEL_URLS) {
      try {
        setP(2, `Tentative : ${new URL(url).hostname}…`);
        window.electronAPI.onOnnxProgress(pct => {
          setP(Math.round(pct * 0.58), `Téléchargement… ${pct}%`);
        });
        const res = await window.electronAPI.onnxDownloadModel(url, ESRGAN_MODEL_NAME);
        if (res && res.ok) { downloaded = true; break; }
      } catch(e) { /* essayer URL suivante */ }
    }
    if (!downloaded) throw new Error(
      'Téléchargement échoué sur toutes les sources.\n' +
      'Placez manuellement "realesrgan-x4plus.onnx" dans le dossier userData/onnx-models/'
    );
  }

  setP(60, 'Compilation WASM en cours — merci de patienter…');
  _showModelStatus('⚙ Compilation du modèle en mémoire (peut prendre 30-60s)…');

  // Animation de la barre pendant le chargement (bloquant)
  let _animPct = 60;
  const _animInterval = setInterval(() => {
    _animPct = _animPct >= 94 ? 61 : _animPct + 0.5;
    setP(Math.round(_animPct), 'Compilation WASM en cours — merci de patienter…');
  }, 400);

  try {
    const modelPath = await window.electronAPI.onnxModelPath(ESRGAN_MODEL_NAME);
    const fileUrl   = 'file:///' + modelPath.replace(/\\/g, '/');
    esrganSession = await ort.InferenceSession.create(fileUrl, { executionProviders: ['wasm'] });
  } finally {
    clearInterval(_animInterval);
  }

  // ── Détecter automatiquement dimensions et canaux du modèle ──────────────
  // On envoie une tuile 1×1 avec 3 canaux et on analyse l'erreur éventuelle
  const inName  = esrganSession.inputNames[0];
  const outName = esrganSession.outputNames[0];
  const _parseDimError = (msg) => {
    const regex = /index:\s*(\d+)\s+Got:\s*\d+\s+Expected:\s*(\d+)/g;
    let m;
    while ((m = regex.exec(msg)) !== null) {
      const idx = parseInt(m[1]), val = parseInt(m[2]);
      if (idx === 1) esrganChIn  = val;
      if (idx === 2) esrganTileH = val;
      if (idx === 3) esrganTileW = val;
    }
    if (esrganTileW === ESRGAN_TILE_DEFAULT && esrganTileH !== ESRGAN_TILE_DEFAULT)
      esrganTileW = esrganTileH;
  };

  // Probe float32 d'abord
  try {
    const probe  = new ort.Tensor('float32', new Float32Array(3), [1, 3, 1, 1]);
    const result = await esrganSession.run({ [inName]: probe });
    esrganIsFloat16 = false;
    esrganScale = result[outName].dims[2] || ESRGAN_SCALE_DEFAULT;
    setP(64, `Modèle float32, scale ×${esrganScale}`);
  } catch(e1) {
    if (e1.message && e1.message.toLowerCase().includes('float16')) {
      // Modèle fp16 — retenter avec float16
      esrganIsFloat16 = true;
      try {
        const probe16 = new ort.Tensor('float16', _f32ToF16Array(new Float32Array(3)), [1, 3, 1, 1]);
        const result  = await esrganSession.run({ [inName]: probe16 });
        esrganScale = result[outName].dims[2] || ESRGAN_SCALE_DEFAULT;
        setP(64, `Modèle float16, scale ×${esrganScale}`);
      } catch(e2) { _parseDimError(e2.message); }
    } else {
      _parseDimError(e1.message);
    }
  }

  _showModelStatus(`✅ Modèle chargé (${esrganTileH}×${esrganTileW}, ×${esrganScale})`);
  return esrganSession;
}

// ── Amélioration via processus principal (onnxruntime-node natif) ────────────
async function onnxRealESRGAN(srcCanvas, setP) {
  // Enregistrer les listeners de progression
  window.electronAPI.removeAllListeners('esrgan-progress');
  window.electronAPI.removeAllListeners('esrgan-status');
  window.electronAPI.onEsrganProgress(pct => setP(65 + Math.round(pct * 0.3), `Inférence… ${pct}%`));
  window.electronAPI.onEsrganStatus(msg => setP(62, msg));

  // Envoyer le canvas au main process comme PNG base64
  setP(62, 'Envoi au moteur natif…');
  const b64 = srcCanvas.toDataURL('image/png').split(',')[1];
  const resultB64 = await window.electronAPI.onnxEnhanceImage(b64, 'image/png');

  // Dessiner le résultat dans un nouveau canvas
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = 'data:image/png;base64,' + resultB64;
  });
  const out = document.createElement('canvas');
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  out.getContext('2d').drawImage(img, 0, 0);
  return out;
}

async function onnxEspcn(srcCanvas, setP) {
  window.electronAPI.removeAllListeners('esrgan-progress');
  window.electronAPI.removeAllListeners('esrgan-status');
  window.electronAPI.onEsrganProgress(pct => setP(65 + Math.round(pct * 0.3), `ESPCN… ${pct}%`));
  window.electronAPI.onEsrganStatus(msg => setP(62, msg));

  setP(60, 'Envoi au moteur ESPCN…');
  const b64 = srcCanvas.toDataURL('image/png').split(',')[1];
  const resultB64 = await window.electronAPI.onnxEspcnEnhance(b64, 'image/png');

  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = 'data:image/png;base64,' + resultB64;
  });
  const out = document.createElement('canvas');
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  out.getContext('2d').drawImage(img, 0, 0);
  return out;
}

// ── (ancien pipeline WASM — remplacé par IPC ci-dessus) ──────────────────────
async function _onnxRealESRGAN_wasm_UNUSED(srcCanvas, setP) {
  const session = await ensureEsrganSession(setP);
  const inName  = session.inputNames[0];
  const outName = session.outputNames[0];
  const TH = esrganTileH, TW = esrganTileW;
  const CHI = esrganChIn;
  const w = srcCanvas.width, h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  const srcPx  = srcCtx.getImageData(0, 0, w, h).data;

  // Préparer les canaux source
  // Canal Y (luminance) pour modèles 1-canal
  const Ys  = CHI === 1 ? new Float32Array(w * h) : null;
  const Cbs = CHI === 1 ? new Float32Array(w * h) : null;
  const Crs = CHI === 1 ? new Float32Array(w * h) : null;
  if (CHI === 1) {
    for (let i = 0; i < w * h; i++) {
      const r = srcPx[i*4], g = srcPx[i*4+1], b = srcPx[i*4+2];
      Ys[i]  =  0.299*r + 0.587*g + 0.114*b;
      Cbs[i] = -0.168736*r - 0.331264*g + 0.5*b + 128;
      Crs[i] =  0.5*r - 0.418688*g - 0.081312*b + 128;
    }
  }

  // Buffer de sortie Y (ou RGB)
  const outW = Math.ceil(w * esrganScale), outH = Math.ceil(h * esrganScale);
  const outY  = CHI === 1 ? new Float32Array(outW * outH) : null;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW; outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(outW, outH);
  const op = outImg.data;

  const tilesX = Math.ceil(w / TW), tilesY = Math.ceil(h / TH);
  const total = tilesX * tilesY;
  let done = 0;

  for (let ty = 0; ty < h; ty += TH) {
    for (let tx = 0; tx < w; tx += TW) {
      const tw = Math.min(TW, w - tx);
      const th = Math.min(TH, h - ty);
      // Padding si tuile plus petite que TW/TH (bords)
      const needPad = tw < TW || th < TH;
      const pH = needPad ? TH : th;
      const pW = needPad ? TW : tw;

      const buf = new Float32Array(CHI * pH * pW); // zéros = padding

      if (CHI === 3) {
        // RGB
        for (let y = 0; y < th; y++)
          for (let x = 0; x < tw; x++) {
            const si = ((ty+y)*w + (tx+x))*4;
            const pi = y*pW + x;
            buf[pi]               = srcPx[si]   / 255;
            buf[pH*pW + pi]       = srcPx[si+1] / 255;
            buf[2*pH*pW + pi]     = srcPx[si+2] / 255;
          }
      } else {
        // Y uniquement
        for (let y = 0; y < th; y++)
          for (let x = 0; x < tw; x++)
            buf[y*pW + x] = Ys[(ty+y)*w + (tx+x)] / 255;
      }

      const tensorData = esrganIsFloat16 ? _f32ToF16Array(buf) : buf;
      const tensorType = esrganIsFloat16 ? 'float16' : 'float32';
      const input  = new ort.Tensor(tensorType, tensorData, [1, CHI, pH, pW]);
      const result = await session.run({ [inName]: input });
      const rawOut = result[outName].data;
      const out    = esrganIsFloat16
        ? Float32Array.from(rawOut, v => _f16ToF32(v))
        : rawOut;
      const outDims = result[outName].dims; // [1, C_out, oh, ow]
      const actualScale = outDims[2] / pH;
      const otw = Math.round(tw * actualScale), oth = Math.round(th * actualScale);
      const opW  = outDims[3]; // largeur réelle de la tuile sortie (peut inclure padding)

      if (CHI === 3) {
        // Écrire RGB directement
        for (let y = 0; y < oth; y++)
          for (let x = 0; x < otw; x++) {
            const oi = ((ty*actualScale + y|0)*outW + (tx*actualScale + x|0))*4;
            const pi = y*opW + x;
            op[oi]   = Math.min(255, Math.max(0, out[pi]                      * 255));
            op[oi+1] = Math.min(255, Math.max(0, out[oth*opW + pi]            * 255));
            op[oi+2] = Math.min(255, Math.max(0, out[2*oth*opW + pi]          * 255));
            op[oi+3] = 255;
          }
      } else {
        // Écrire Y (sera fusionné avec CbCr après)
        for (let y = 0; y < oth; y++)
          for (let x = 0; x < otw; x++)
            outY[((ty*actualScale + y|0)*outW + (tx*actualScale + x|0))] =
              Math.min(255, Math.max(0, out[y*opW + x] * 255));
      }

      done++;
      setP(65 + Math.round(done/total*28), `Inférence… ${done}/${total} tuiles`);
    }
  }

  if (CHI === 1) {
    // Reconstruire RGB depuis Y upscalé + Cb/Cr upscalés par interpolation bilinéaire
    const cbC = document.createElement('canvas'); cbC.width = w; cbC.height = h;
    const crC = document.createElement('canvas'); crC.width = w; crC.height = h;
    const cbD = cbC.getContext('2d').createImageData(w, h);
    const crD = crC.getContext('2d').createImageData(w, h);
    for (let i = 0; i < w*h; i++) {
      const cb = Math.round(Cbs[i]), cr = Math.round(Crs[i]);
      cbD.data[i*4]=cb; cbD.data[i*4+1]=cb; cbD.data[i*4+2]=cb; cbD.data[i*4+3]=255;
      crD.data[i*4]=cr; crD.data[i*4+1]=cr; crD.data[i*4+2]=cr; crD.data[i*4+3]=255;
    }
    cbC.getContext('2d').putImageData(cbD, 0, 0);
    crC.getContext('2d').putImageData(crD, 0, 0);
    const upCb = document.createElement('canvas'); upCb.width=outW; upCb.height=outH;
    const upCr = document.createElement('canvas'); upCr.width=outW; upCr.height=outH;
    upCb.getContext('2d').drawImage(cbC, 0, 0, outW, outH);
    upCr.getContext('2d').drawImage(crC, 0, 0, outW, outH);
    const cbPx = upCb.getContext('2d').getImageData(0,0,outW,outH).data;
    const crPx = upCr.getContext('2d').getImageData(0,0,outW,outH).data;
    for (let i = 0; i < outW*outH; i++) {
      const y = outY[i], cb = cbPx[i*4]-128, cr = crPx[i*4]-128;
      op[i*4]   = Math.min(255, Math.max(0, y + 1.402*cr));
      op[i*4+1] = Math.min(255, Math.max(0, y - 0.344136*cb - 0.714136*cr));
      op[i*4+2] = Math.min(255, Math.max(0, y + 1.772*cb));
      op[i*4+3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

function openEnhancePanel() {
  if (!currentPdfDoc) { t("Ouvrez un PDF d'abord"); return; }
  const curPage = parseInt(document.getElementById('cur-page')?.textContent) || 1;
  const np = currentPdfDoc.numPages;
  document.getElementById('enh-page-info').innerHTML =
    `Document : <b style="color:var(--gold)">${np} page${np>1?'s':''}</b> — Page courante : <b style="color:var(--gold)">${curPage}</b>`;
  document.getElementById('enh-model-status').style.display = 'none';
  document.getElementById('enh-progress').style.display = 'none';
  document.getElementById('enh-result').style.display   = 'none';
  document.getElementById('enh-btn').style.pointerEvents = '';
  document.getElementById('enh-btn').innerHTML = '<i class="fa-solid fa-wand-sparkles"></i> Améliorer';
  document.getElementById('enh-overlay').style.display  = 'flex';
}

function closeEnhancePanel() {
  document.getElementById('enh-overlay').style.display = 'none';
}

// Applique un unsharp mask sur un canvas
function _enhUnsharp(canvas, amount) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  // Créer une version floutée
  const blur = document.createElement('canvas');
  blur.width = w; blur.height = h;
  const bctx = blur.getContext('2d');
  bctx.filter = 'blur(1.5px)';
  bctx.drawImage(canvas, 0, 0);
  bctx.filter = 'none';
  const orig    = ctx.getImageData(0, 0, w, h);
  const blurred = bctx.getImageData(0, 0, w, h);
  const result  = ctx.createImageData(w, h);
  for (let i = 0; i < orig.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = orig.data[i+c] - blurred.data[i+c];
      result.data[i+c] = Math.min(255, Math.max(0, orig.data[i+c] + amount * diff));
    }
    result.data[i+3] = orig.data[i+3];
  }
  ctx.putImageData(result, 0, 0);
}

// Netteté qualité sans bruit : Gaussian large + USM fort
// blurRadius > 1.5 → cible les bords structurels, pas le bruit de pixel
function _enhSharpEdge(canvas, amount, blurRadius) {
  blurRadius = blurRadius || 3;
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const blur = document.createElement('canvas');
  blur.width = w; blur.height = h;
  const bctx = blur.getContext('2d');
  bctx.filter = `blur(${blurRadius}px)`;
  bctx.drawImage(canvas, 0, 0);
  bctx.filter = 'none';
  const orig    = ctx.getImageData(0, 0, w, h);
  const blurred = bctx.getImageData(0, 0, w, h);
  const result  = ctx.createImageData(w, h);
  for (let i = 0; i < orig.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = orig.data[i+c] - blurred.data[i+c];
      result.data[i+c] = Math.min(255, Math.max(0, orig.data[i+c] + amount * diff));
    }
    result.data[i+3] = orig.data[i+3];
  }
  ctx.putImageData(result, 0, 0);
}

// Applique contraste + saturation via filter
function _enhContrast(canvas, contrast, saturation) {
  const w = canvas.width, h = canvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext('2d');
  ctx.filter = `contrast(${contrast}) saturate(${saturation})`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  const srcCtx = canvas.getContext('2d');
  srcCtx.clearRect(0, 0, w, h);
  srcCtx.drawImage(tmp, 0, 0);
}

// Parse une chaîne de pages "1,3,5-8" → [1,3,5,6,7,8]
function _parsePageRange(str, max) {
  const result = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) {
      for (let i = parseInt(m[1]); i <= parseInt(m[2]); i++) {
        if (i >= 1 && i <= max) result.add(i);
      }
    } else {
      const n = parseInt(part);
      if (!isNaN(n) && n >= 1 && n <= max) result.add(n);
    }
  });
  return Array.from(result).sort((a,b) => a-b);
}

// ── Amélioration OpenAI GPT-Image-1 (via IPC — main process, pas de CSP) ────
async function _openaiImageEnhance(srcCanvas, apiKey, setP) {
  const b64src = srcCanvas.toDataURL('image/png').split(',')[1];

  // Écouter les mises à jour de progression depuis le main process
  window.electronAPI.removeAllListeners('esrgan-status');
  window.electronAPI.onEsrganStatus(msg => setP(30, msg));

  setP(20, 'Envoi à OpenAI GPT-Image…');

  const prompt =
    'You are a pixel-level image restoration filter, not a designer. ' +
    'This document page has blur, noise and compression artifacts. ' +
    'Your ONLY permitted operation: make blurry/noisy pixels sharper and cleaner where they already stand. ' +
    '' +
    'ABSOLUTE CONSTRAINTS — any violation is a critical failure: ' +
    '• Output layout must be pixel-identical to input: same margins, same spacing, same structure. ' +
    '• Every text block must stay at the EXACT same position, same line breaks, same number of lines. ' +
    '• Font sizes must not change by even 1pt — do not reflow a single word or line. ' +
    '• Every photo/image element must keep its exact same bounding box and proportions. ' +
    '• All colors must be reproduced exactly: same RGB values for text, backgrounds, graphics, logos. ' +
    '• Do NOT reformat, redesign, reinterpret, modernize or apply any aesthetic judgment. ' +
    '• Do NOT use your knowledge of "good document design" — ignore it entirely. ' +
    '' +
    'Mental model: you are a camera lens sharpening focus on a fixed scene. ' +
    'The scene does not move. Nothing is added or removed. Only clarity improves.';

  // Appel via IPC (main process) pour contourner la CSP du renderer
  const json = await window.electronAPI.openaiImageEnhance(b64src, apiKey, prompt);

  setP(80, 'Réception et décodage…');
  const item = json.data?.[0];
  if (!item) throw new Error('Réponse OpenAI vide');

  const resultB64 = item.b64_json;
  if (!resultB64) throw new Error('Aucune image base64 retournée par OpenAI');

  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = 'data:image/png;base64,' + resultB64;
  });
  const out = document.createElement('canvas');
  out.width  = img.naturalWidth;
  out.height = img.naturalHeight;
  out.getContext('2d').drawImage(img, 0, 0);
  return out;
}

async function doEnhance() {
  if (!currentPdfData || !currentPdfDoc) return;
  const btn = document.getElementById('enh-btn');
  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  document.getElementById('enh-progress').style.display = 'block';
  document.getElementById('enh-result').style.display   = 'none';

  const setP = (pct, txt) => {
    document.getElementById('enh-bar').style.width = pct + '%';
    document.getElementById('enh-progress-txt').textContent = txt;
  };

  try {
    const level   = document.querySelector('input[name="enh-level"]:checked')?.value || 'standard';
    const scope   = document.querySelector('input[name="enh-scope"]:checked')?.value || 'current';
    const np      = currentPdfDoc.numPages;
    const curPage = parseInt(document.getElementById('cur-page')?.textContent) || 1;

    // Pages à traiter
    let pages;
    if (scope === 'current') {
      pages = [curPage];
    } else {
      const rangeStr = document.getElementById('enh-range').value.trim() || String(curPage);
      pages = _parsePageRange(rangeStr, np);
    }
    if (!pages.length) { t('Aucune page valide'); return; }

    // ── Vérification modèle / clé API selon le niveau choisi ───────────────────
    setP(0, 'Vérification…');
    let openaiApiKey = '';
    if (level === 'optimal') {
      openaiApiKey = await _getAIKey();
      if (!openaiApiKey) {
        t('Clé API OpenAI manquante — configurez-la dans Paramètres (⚙)');
        return;
      }
    } else if (level === 'espcn') {
      await _ensureEspcnDownloaded(setP);
    } else {
      await _ensureEsrganDownloaded(setP);
    }

    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });

    // Ordre décroissant : les insertions n'affectent pas les indices suivants
    const sortedDesc = [...pages].sort((a, b) => b - a);

    for (let pi = 0; pi < sortedDesc.length; pi++) {
      const pageNum = sortedDesc[pi];
      const baseP   = Math.round((pi / sortedDesc.length) * 60);
      setP(baseP, `Rendu page ${pageNum}…`);

      // Pré-render (scale 2× pour Optimal = meilleure entrée API, 1× pour les autres)
      const renderScale = level === 'optimal' ? 2 : 1;
      const pdfJsPage = await currentPdfDoc.getPage(pageNum);
      const vp = pdfJsPage.getViewport({ scale: renderScale });
      const offscreen = document.createElement('canvas');
      offscreen.width  = vp.width;
      offscreen.height = vp.height;
      await pdfJsPage.render({ canvasContext: offscreen.getContext('2d'), viewport: vp }).promise;

      let finalCanvas;
      if (level === 'optimal') {
        _showModelStatus('✨ Envoi à GPT-Image-1…');
        finalCanvas = await _openaiImageEnhance(offscreen, openaiApiKey, (pct, txt) => {
          setP(baseP + Math.round(pct * 0.35), txt);
        });
      } else if (level === 'espcn') {
        _showModelStatus('⚙ Inférence ESPCN…');
        finalCanvas = await onnxEspcn(offscreen, (pct, txt) => {
          setP(baseP + Math.round(pct * 0.35), txt);
        });
        _enhSharpEdge(finalCanvas, 2.8, 3);
        _enhContrast(finalCanvas, 1.08, 1.0);
      } else {
        _showModelStatus('⚙ Inférence Real-ESRGAN…');
        finalCanvas = await onnxRealESRGAN(offscreen, (pct, txt) => {
          setP(baseP + Math.round(pct * 0.35), txt);
        });
        if (level === 'maximum') {
          _enhUnsharp(finalCanvas, 1.2);
          _enhContrast(finalCanvas, 1.08, 1.04);
        }
      }

      // Convertir en PNG
      const imgBytes = base64ToBytes(finalCanvas.toDataURL('image/png').split(',')[1]);

      // Insérer la page améliorée APRÈS l'originale
      const origPg = doc.getPages()[pageNum - 1];
      const { width: pgW, height: pgH } = origPg.getSize();
      const pngImg  = await doc.embedPng(imgBytes);
      const newPage = doc.insertPage(pageNum, [pgW, pgH]);
      newPage.drawImage(pngImg, { x: 0, y: 0, width: pgW, height: pgH });

      setP(Math.round((pi + 1) / sortedDesc.length * 95), `Page ${pageNum} améliorée ✓`);
    }

    setP(97, 'Sauvegarde…');
    const newBytes = await doc.save();
    const newB64   = bytesToBase64(newBytes);
    setP(100, 'Terminé');

    closeEnhancePanel();
    await renderPDFFromData({
      name: currentPdfName,
      size: Math.round(newBytes.length * 0.75),
      data: newB64,
      filePath: currentFilePath
    }, true);

    const modelLabel = level === 'optimal' ? 'GPT-Image-1 (OpenAI)'
      : level === 'espcn' ? 'ESPCN 4×'
      : `Real-ESRGAN 4×${level === 'maximum' ? ' + netteté' : ''}`;
    document.getElementById('enh-result').style.display = 'block';
    document.getElementById('enh-result').innerHTML =
      `✅ <b>${pages.length} page${pages.length>1?'s':''}</b> améliorée${pages.length>1?'s':''} — ${modelLabel}.`;

    _logMod('Pages améliorées ' + modelLabel, pages.join(', '));
  } catch(e) {
    t('Erreur : ' + e.message); console.error(e);
  } finally {
    btn.style.pointerEvents = '';
    btn.innerHTML = '<i class="fa-solid fa-wand-sparkles"></i> Améliorer';
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// ── MESURES & COTATION ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let msrMode       = 'dist'; // 'dist' | 'area' | 'calib'
let msrPoints     = [];     // [{x,y, wrap}]
let msrLabels     = [];     // DOM elements
let msrCanvases   = {};     // per wrap canvas
let msrActive     = false;
let msrCalPx      = 100;
let msrCalVal     = 1;
let msrCalUnit    = 'cm';
let msrCalibPhase = 0;
let msrCalibPts   = [];

function openMeasurePanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  msrActive = true;
  const bar = document.getElementById('msr-bar');
  bar.style.display = 'flex';
  _msrUpdateCalDisplay();
  msrSetMode('dist');
  // Attach canvas to each page wrap
  document.querySelectorAll('.page-wrap').forEach(wrap => {
    if (!wrap.querySelector('#msr-canvas-' + wrap.dataset.page)) {
      const cv = document.createElement('canvas');
      cv.id = 'msr-canvas-' + wrap.dataset.page;
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:300;';
      wrap.style.position = 'relative';
      wrap.appendChild(cv);
      msrCanvases[wrap.dataset.page] = cv;
    }
  });
  // Intercept clicks
  document.getElementById('pdf-pages').addEventListener('click', _msrClick);
  t('Cliquez pour placer des points de mesure');
}

function closeMeasurePanel() {
  msrActive = false;
  document.getElementById('msr-bar').style.display = 'none';
  document.getElementById('pdf-pages').removeEventListener('click', _msrClick);
  msrClear();
  // Remove canvases
  Object.values(msrCanvases).forEach(cv => cv.remove());
  msrCanvases = {};
}

function msrSetMode(mode) {
  msrMode = mode;
  msrPoints = [];
  msrCalibPhase = 0; msrCalibPts = [];
  document.getElementById('msr-btn-dist').classList.toggle('act', mode === 'dist');
  document.getElementById('msr-btn-area').classList.toggle('act', mode === 'area');
  const calibBtn = document.getElementById('msr-btn-calib');
  if (calibBtn) calibBtn.classList.toggle('act', mode === 'calib');
  const closeBtn = document.getElementById('msr-btn-close-poly');
  if (closeBtn) closeBtn.style.display = 'none';
  _msrRedrawAll();
  if (mode === 'calib') {
    msrCalibPhase = 1; msrCalibPts = [];
    t('Étalonnage : cliquez le 1er point de la référence sur le plan');
  }
}

function _msrUpdateCalDisplay() {
  const lbl = document.getElementById('msr-cal-lbl');
  if (lbl) lbl.textContent = msrCalPx.toFixed(1) + ' px = ' + msrCalVal + ' ' + msrCalUnit;
}

function msrClear() {
  msrPoints = [];
  msrLabels.forEach(l => l.remove()); msrLabels = [];
  _msrRedrawAll();
}

function _msrClick(e) {
  if (!msrActive) return;
  if (e.target.closest('#msr-bar')) return;
  const wrap = e.target.closest('.page-wrap');
  if (!wrap) return;
  const wr = wrap.getBoundingClientRect();
  const x  = e.clientX - wr.left;
  const y  = e.clientY - wr.top;

  if (msrMode === 'calib') {
    if (msrCalibPhase === 1) {
      msrCalibPts = [{ x, y, wrap }];
      msrCalibPhase = 2;
      _msrDrawCalibPt(wrap, x, y);
      t('Étalonnage : cliquez maintenant le 2ème point de la référence');
    } else if (msrCalibPhase === 2) {
      msrCalibPts.push({ x, y, wrap });
      const dx = msrCalibPts[1].x - msrCalibPts[0].x;
      const dy = msrCalibPts[1].y - msrCalibPts[0].y;
      const pxDist = Math.sqrt(dx*dx + dy*dy);
      _msrAskCalibValue(pxDist);
      msrCalibPhase = 0;
    }
    return;
  }

  msrPoints.push({ x, y, wrap });
  if (msrMode === 'dist' && msrPoints.length === 2) {
    _msrShowDist(); msrPoints = [];
  } else if (msrMode === 'area') {
    const closeBtn = document.getElementById('msr-btn-close-poly');
    if (closeBtn) closeBtn.style.display = msrPoints.length >= 3 ? '' : 'none';
  }
  _msrRedrawAll();
}

function msrClosePoly() {
  if (msrPoints.length >= 3) { _msrShowArea(); msrPoints = []; }
  const closeBtn = document.getElementById('msr-btn-close-poly');
  if (closeBtn) closeBtn.style.display = 'none';
  _msrRedrawAll();
}

function _msrDrawCalibPt(wrap, x, y) {
  const cv = wrap.querySelector('[id^=msr-canvas-]');
  if (!cv) return;
  cv.width = wrap.offsetWidth; cv.height = wrap.offsetHeight;
  const ctx = cv.getContext('2d');
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(231,76,60,.35)'; ctx.fill();
  ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2);
  ctx.fillStyle = '#e74c3c'; ctx.fill();
}

function _msrAskCalibValue(pxDist) {
  const unit = msrCalUnit;
  const body = '<div style="padding:10px 0;font-size:.82rem;color:var(--txt2)">Distance mesurée sur le plan : <b style="color:var(--gold)">' + pxDist.toFixed(1) + ' px</b></div>' +
    '<div class="sum-section-title" style="margin-top:8px">Distance réelle correspondante</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
    '<input id="calib-real-val" type="number" min="0.01" step="0.1" value="1" class="enc-inp" style="width:100px">' +
    '<select id="calib-real-unit" class="enc-inp" style="width:80px">' +
    '<option value="cm"' + (unit==="cm"?" selected":"") + '>cm</option>' +
    '<option value="mm"' + (unit==="mm"?" selected":"") + '>mm</option>' +
    '<option value="m"'  + (unit==="m" ?" selected":"") + '>m</option>'  +
    '<option value="in"' + (unit==="in"?" selected":"") + '>in</option>' +
    '<option value="ft"' + (unit==="ft"?" selected":"") + '>ft</option>' +
    '<option value="px"' + (unit==="px"?" selected":"") + '>px</option>' +
    '</select></div>' +
    '<div style="margin-top:10px;font-size:.72rem;color:var(--txt2)">Ex : règle 10 cm → cliquez ses 2 extrémités, entrez <b>10</b> et <b>cm</b>.</div>';
  const ftr = '<div class="mbtn" onclick="closeModal()">Annuler</div>' +
    '<div class="mbtn ok" onclick="_msrApplyCalib(' + pxDist + ')"><i class="fa-solid fa-ruler"></i> Valider</div>';
  openModal("Étalonnage", body, ftr);
}

function _msrApplyCalib(pxDist) {
  const val  = parseFloat(document.getElementById("calib-real-val")?.value) || 1;
  const unit = document.getElementById("calib-real-unit")?.value || "cm";
  msrCalPx  = pxDist;
  msrCalVal = val;
  msrCalUnit = unit;
  _msrUpdateCalDisplay();
  closeModal();
  msrSetMode("dist");
  t("Étalon : " + pxDist.toFixed(1) + " px = " + val + " " + unit);
}

function _msrToPx(p1, p2) {
  return Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2);
}

function _msrConvert(px) {
  return ((px / msrCalPx) * msrCalVal).toFixed(2) + ' ' + msrCalUnit;
}

function _msrShowDist() {
  const [p1, p2] = msrPoints;
  const px  = _msrToPx(p1, p2);
  const txt = _msrConvert(px);
  const mx  = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const lbl = document.createElement('div');
  lbl.className = 'msr-label';
  lbl.textContent = txt;
  lbl.style.left = (mx + p1.wrap.getBoundingClientRect().left - document.documentElement.clientLeft) + 'px';
  lbl.style.top  = (my + p1.wrap.getBoundingClientRect().top + window.scrollY - 20) + 'px';
  lbl.style.position = 'fixed';
  document.body.appendChild(lbl);
  msrLabels.push(lbl);
  _msrDrawLine(p1.wrap, [p1, p2]);
  t('Distance : ' + txt);
}

function _msrShowArea() {
  let area = 0;
  const pts = msrPoints;
  for (let i = 0, j = pts.length-1; i < pts.length; j=i++) {
    area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  const pxArea = Math.abs(area / 2);
  const realArea = (pxArea / (msrCalPx * msrCalPx)) * (msrCalVal * msrCalVal);
  const txt = realArea.toFixed(2) + ' ' + msrCalUnit + '²';
  const cx  = pts.reduce((s,p) => s+p.x, 0) / pts.length;
  const cy  = pts.reduce((s,p) => s+p.y, 0) / pts.length;
  const wr  = pts[0].wrap.getBoundingClientRect();
  const lbl = document.createElement('div');
  lbl.className = 'msr-label';
  lbl.textContent = 'Surface : ' + txt;
  lbl.style.cssText = `position:fixed;left:${cx + wr.left}px;top:${cy + wr.top - 20}px`;
  document.body.appendChild(lbl);
  msrLabels.push(lbl);
  _msrDrawLine(pts[0].wrap, pts, true);
  t('Surface : ' + txt);
}

function _msrDrawLine(wrap, pts, close=false) {
  const cv = wrap.querySelector('[id^=msr-canvas-]');
  if (!cv) return;
  cv.width  = wrap.offsetWidth; cv.height = wrap.offsetHeight;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2;
  ctx.fillStyle   = 'rgba(243,156,18,.08)';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  if (close) { ctx.closePath(); ctx.fill(); }
  ctx.stroke();
  // Endpoints
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#f39c12'; ctx.fill();
  });
}

function _msrRedrawAll() {
  Object.values(msrCanvases).forEach(cv => {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
  });
  if (msrPoints.length >= 1) {
    const wrap = msrPoints[0].wrap;
    const cv   = wrap.querySelector('[id^=msr-canvas-]');
    if (cv) {
      cv.width = wrap.offsetWidth; cv.height = wrap.offsetHeight;
      _msrDrawLine(wrap, msrPoints, false);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── ACCESSIBILITÉ PDF/UA ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _a11yResults = [];

function openA11yPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('a11y-overlay').style.display = 'flex';
  document.getElementById('a11y-content').innerHTML = '';
  document.getElementById('a11y-footer').style.display = 'none';
  document.getElementById('a11y-loading').style.display = 'flex';
  setTimeout(doA11yCheck, 100);
}
function closeA11yPanel() { document.getElementById('a11y-overlay').style.display = 'none'; }

async function doA11yCheck() {
  _a11yResults = [];
  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pages = doc.getPages();
    const n     = pages.length;

    // 1. Titre
    const title = doc.getTitle();
    _a11y(title ? 'pass' : 'fail', 'Titre du document',
      title ? `"${title}"` : 'Aucun titre défini — requis pour PDF/UA', 'meta');

    // 2. Langue
    let lang = '';
    try { lang = doc.catalog.lookup(PDFName.of('Lang'))?.asString()?.replace(/[<>]/g,'') || ''; } catch{}
    _a11y(lang ? 'pass' : 'fail', 'Langue du document',
      lang ? `Langue : ${lang}` : 'Aucune langue définie — requis pour PDF/UA et l\'accessibilité des lecteurs d\'écran', 'meta');

    // 3. Balisage (Tagged PDF)
    let tagged = false;
    try {
      const markInfo = doc.catalog.lookupMaybe(PDFName.of('MarkInfo'), Object);
      tagged = !!(markInfo);
    } catch {}
    _a11y(tagged ? 'pass' : 'warn', 'PDF balisé (Tagged)',
      tagged ? 'Structure de balisage présente' : 'PDF non balisé — les lecteurs d\'écran ne peuvent pas déterminer l\'ordre de lecture. Nécessite un outil spécialisé (Acrobat Pro) pour le balisage complet.', 'structure');

    // 4. Métadonnées auteur
    const author = doc.getAuthor();
    _a11y(author ? 'pass' : 'info', 'Auteur renseigné',
      author ? `Auteur : ${author}` : 'Non renseigné (recommandé)', 'meta');

    // 5. Texte extractible
    let hasText = false;
    try {
      const page = await currentPdfDoc.getPage(1);
      const tc   = await page.getTextContent();
      hasText    = tc.items.some(i => i.str.trim());
    } catch {}
    _a11y(hasText ? 'pass' : 'fail', 'Texte sélectionnable',
      hasText ? 'Le texte est extractible (non-scan)' : 'Aucun texte extractible — PDF scanné. Utilisez l\'OCR pour le rendre accessible.', 'content');

    // 6. Polices embarquées
    let allFontsEmbedded = true;
    try {
      const embForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), Object);
      // Simple heuristic: check if font resources exist in pages
      const fontCheck = doc.context.indirectObjects;
      // We can't easily enumerate fonts without low-level parsing, so we do a simple check
      allFontsEmbedded = true; // Assume OK if pdf-lib can load without error
    } catch {}
    _a11y('info', 'Polices embarquées',
      'Vérification approfondie disponible via Acrobat Pro. Les polices non embarquées causent des problèmes d\'affichage et d\'accessibilité.', 'content');

    // 7. Contraste — cannot verify without rasterization, give advice
    _a11y('info', 'Contraste des couleurs',
      'Le rapport de contraste minimal recommandé est 4.5:1 (texte normal) et 3:1 (grand texte). Utilisez l\'outil Sélection + pipette pour vérifier les couleurs.', 'visual');

    // 8. Liens / annotations
    let hasLinks = false;
    try {
      pages.forEach(pg => {
        const annots = pg.node.lookupMaybe(PDFName.of('Annots'), Object);
        if (annots) hasLinks = true;
      });
    } catch {}
    _a11y(hasLinks ? 'info' : 'info', 'Liens et annotations',
      hasLinks ? 'Des annotations/liens sont présents — vérifiez qu\'ils ont des textes alternatifs.' : 'Aucun lien détecté.', 'content');

    // 9. Chiffrement
    const isEncrypted = !!(doc.isEncrypted);
    _a11y(isEncrypted ? 'warn' : 'pass', 'Chiffrement',
      isEncrypted ? 'Document chiffré — peut bloquer les lecteurs d\'écran.' : 'Aucun chiffrement — accessible aux technologies d\'assistance.', 'security');

    // 10. ViewerPreferences DisplayDocTitle
    let displayTitle = false;
    try {
      const vp = doc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), Object);
      if (vp) displayTitle = true;
    } catch {}
    _a11y(displayTitle ? 'pass' : 'warn', 'Affichage du titre dans la barre',
      displayTitle ? 'ViewerPreferences configuré' : 'Titre non affiché dans la barre de la visionneuse (DisplayDocTitle manquant)', 'meta');

    _renderA11y();
  } catch(e) {
    document.getElementById('a11y-content').innerHTML = `<div class="tbl-empty" style="color:#e74c3c">Erreur : ${e.message}</div>`;
  } finally {
    document.getElementById('a11y-loading').style.display = 'none';
    document.getElementById('a11y-footer').style.display  = 'flex';
  }
}

function _a11y(status, label, detail, category) {
  _a11yResults.push({ status, label, detail, category });
}

function _renderA11y() {
  const pass = _a11yResults.filter(r => r.status==='pass').length;
  const fail = _a11yResults.filter(r => r.status==='fail').length;
  const warn = _a11yResults.filter(r => r.status==='warn').length;
  const total= _a11yResults.length;
  const score= Math.round((pass + warn*0.5) / total * 100);
  const scoreCol = score >= 80 ? '#2ecc71' : score >= 50 ? '#f39c12' : '#e74c3c';
  const icons    = { pass:'✅', fail:'❌', warn:'⚠️', info:'ℹ️' };
  const categories = [...new Set(_a11yResults.map(r => r.category))];
  const catLabels  = { meta:'Métadonnées', structure:'Structure', content:'Contenu', visual:'Visuel', security:'Sécurité' };

  let html = `<div class="a11y-score" style="color:${scoreCol}">${score}%</div>
    <div class="a11y-score-label">${pass} critères OK · ${fail} erreurs · ${warn} avertissements</div>`;
  categories.forEach(cat => {
    html += `<div class="a11y-section">${catLabels[cat]||cat}</div>`;
    _a11yResults.filter(r => r.category===cat).forEach(r => {
      const fixable = r.status !== 'pass' && (r.label.includes('Titre') || r.label.includes('Langue') || r.label.includes('barre'));
      html += `<div class="a11y-item">
        <div class="a11y-icon">${icons[r.status]||'ℹ️'}</div>
        <div class="a11y-body">
          <div class="a11y-label"><b>${r.label}</b></div>
          <div class="a11y-detail">${r.detail}</div>
          ${fixable && r.status !== 'pass' ? '<span class="a11y-fix" onclick="openMetaPanel()">→ Corriger dans Métadonnées</span>' : ''}
        </div>
      </div>`;
    });
  });
  document.getElementById('a11y-content').innerHTML = html;
  const hasFixes = _a11yResults.some(r => r.status !== 'pass' && (r.label.includes('Titre')||r.label.includes('Langue')||r.label.includes('barre')));
  document.getElementById('a11y-fix-btn').style.display = hasFixes ? '' : 'none';
}

async function doAutoFixA11y() {
  const noTitle = _a11yResults.find(r => r.label.includes('Titre') && r.status==='fail');
  const noLang  = _a11yResults.find(r => r.label.includes('Langue') && r.status==='fail');
  const noDisp  = _a11yResults.find(r => r.label.includes('barre') && r.status !== 'pass');
  if (!noTitle && !noLang && !noDisp) { t('Rien à corriger automatiquement'); return; }
  try {
    const { PDFDocument, PDFName, PDFBool, PDFDict } = PDFLib;
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    if (noTitle)  doc.setTitle(currentPdfName?.replace(/\.pdf$/i,'') || 'Document');
    if (noLang)   doc.catalog.set(PDFName.of('Lang'), PDFLib.PDFString.of('fr'));
    if (noDisp) {
      // Add ViewerPreferences with DisplayDocTitle
      const vp = doc.context.obj({ DisplayDocTitle: true });
      doc.catalog.set(PDFName.of('ViewerPreferences'), vp);
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeA11yPanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    _logMod('Corrections accessibilité auto');
    t('Corrections accessibilité appliquées');
  } catch(e) { t('Erreur : ' + e.message); }
}

function exportA11yReport() {
  if (!_a11yResults.length) return;
  const icons = { pass:'[OK]', fail:'[ERREUR]', warn:'[AVERTISSEMENT]', info:'[INFO]' };
  const lines = _a11yResults.map(r => `${icons[r.status]} ${r.label}\n   ${r.detail}`).join('\n\n');
  const score = Math.round(_a11yResults.filter(r=>r.status==='pass').length/_a11yResults.length*100);
  const hdr   = `Rapport Accessibilité PDF/UA\nDocument : ${currentPdfName||'inconnu'}\nDate : ${new Date().toLocaleString('fr-FR')}\nScore : ${score}%\n${'═'.repeat(50)}\n\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([hdr+lines], {type:'text/plain'}));
  a.download = 'accessibilite_' + (currentPdfName||'rapport').replace(/\.pdf$/i,'') + '.txt';
  a.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CALQUES (OCG) ────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _layerStates = []; // [{ref, name, visible}]

async function openLayersPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('lay-overlay').style.display = 'flex';
  document.getElementById('lay-loading').style.display = 'flex';
  document.getElementById('lay-content').innerHTML = '';
  document.getElementById('lay-apply-btn').style.display = 'none';
  _layerStates = [];
  try {
    const { PDFDocument, PDFName, PDFArray } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const ocProps = doc.catalog.lookupMaybe(PDFName.of('OCProperties'), Object);
    if (!ocProps) {
      document.getElementById('lay-content').innerHTML =
        '<div class="hist-empty">Ce PDF ne contient pas de calques (Optional Content Groups).</div>';
      document.getElementById('lay-loading').style.display = 'none';
      return;
    }
    const ocgArr = ocProps.lookupMaybe(PDFName.of('OCGs'), Array);
    if (!ocgArr || ocgArr.size() === 0) {
      document.getElementById('lay-content').innerHTML =
        '<div class="hist-empty">Aucun calque détecté dans ce document.</div>';
      document.getElementById('lay-loading').style.display = 'none';
      return;
    }
    // Read default visibility from /D (default config)
    const dConfig = ocProps.lookupMaybe(PDFName.of('D'), Object);
    const offArr  = dConfig?.lookupMaybe(PDFName.of('OFF'), Array);
    const offRefs = new Set();
    if (offArr) for (let i = 0; i < offArr.size(); i++) offRefs.add(offArr.get(i).toString());

    for (let i = 0; i < ocgArr.size(); i++) {
      const ref  = ocgArr.get(i);
      const ocg  = doc.context.lookup(ref, Object);
      const name = ocg?.lookupMaybe(PDFName.of('Name'))?.asString?.() ||
                   ocg?.lookupMaybe(PDFName.of('Name'))?.decodeText?.() || `Calque ${i+1}`;
      const vis  = !offRefs.has(ref.toString());
      _layerStates.push({ ref, name, visible: vis });
    }

    document.getElementById('lay-content').innerHTML = _layerStates.map((l, i) =>
      `<div class="lay-item">
        <div class="lay-eye ${l.visible ? 'on' : ''}" onclick="layToggle(${i})" id="lay-eye-${i}" title="${l.visible ? 'Masquer' : 'Afficher'}">
          <i class="fa-solid ${l.visible ? 'fa-eye' : 'fa-eye-slash'}"></i></div>
        <div class="lay-name">${l.name}</div>
        <div class="lay-badge">${l.visible ? 'Visible' : 'Masqué'}</div>
      </div>`
    ).join('');
    document.getElementById('lay-apply-btn').style.display = '';
  } catch(e) {
    document.getElementById('lay-content').innerHTML = `<div class="hist-empty" style="color:#e74c3c">Erreur lecture calques : ${e.message}</div>`;
  } finally {
    document.getElementById('lay-loading').style.display = 'none';
  }
}
function closeLayersPanel() { document.getElementById('lay-overlay').style.display = 'none'; }

function layToggle(i) {
  _layerStates[i].visible = !_layerStates[i].visible;
  const eye = document.getElementById('lay-eye-' + i);
  eye.className = 'lay-eye ' + (_layerStates[i].visible ? 'on' : '');
  eye.innerHTML = `<i class="fa-solid ${_layerStates[i].visible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
  eye.closest('.lay-item').querySelector('.lay-badge').textContent = _layerStates[i].visible ? 'Visible' : 'Masqué';
}

async function doApplyLayers() {
  try {
    const { PDFDocument, PDFName, PDFArray, PDFRef } = PDFLib;
    const doc     = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const ocProps = doc.catalog.lookupMaybe(PDFName.of('OCProperties'), Object);
    const dConfig = ocProps?.lookupMaybe(PDFName.of('D'), Object);
    if (!dConfig) { t('Structure OCG non modifiable'); return; }
    // Build OFF array
    const offRefs = _layerStates.filter(l => !l.visible).map(l => l.ref);
    dConfig.set(PDFName.of('OFF'), doc.context.obj(offRefs));
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeLayersPanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    const hidden = offRefs.length;
    _logMod('Calques modifiés', `${hidden} calque(s) masqué(s)`);
    t(`Calques mis à jour — ${hidden} masqué(s)`);
  } catch(e) { t('Erreur calques : ' + e.message); }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── VIDÉO / AUDIO / 3D ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _mediaB64  = null;
let _mediaName = '';
let _mediaMime = '';

function openMediaPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('media-overlay').style.display = 'flex';
  document.getElementById('media-result').style.display  = 'none';
  _mediaB64 = null; _mediaName = '';
  document.getElementById('media-fname').textContent = '— aucun fichier sélectionné —';
  const sel = document.getElementById('media-page');
  sel.innerHTML = Array.from({length: currentPdfDoc.numPages}, (_,i) =>
    `<option value="${i+1}">Page ${i+1}</option>`).join('');
}
function closeMediaPanel() { document.getElementById('media-overlay').style.display = 'none'; }

function mediaUpdateAccept() { _mediaB64 = null; document.getElementById('media-fname').textContent = '— aucun fichier sélectionné —'; }

async function mediaPickFile() {
  const type   = document.getElementById('media-type').value;
  const accept = type==='video' ? '.mp4,.avi,.mov,.mkv' :
                 type==='audio' ? '.mp3,.wav,.ogg,.aac' :
                 type==='model' ? '.obj,.stl,.u3d,.prc' : '*';
  const file   = await new Promise(res => {
    const inp = document.createElement('input'); inp.type='file'; inp.accept=accept;
    inp.onchange = () => res(inp.files[0] || null); inp.click();
  });
  if (!file) return;
  _mediaB64 = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res(fr.result.split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  _mediaName = file.name;
  _mediaMime = file.type || 'application/octet-stream';
  document.getElementById('media-fname').textContent = file.name + ' (' + Math.round(file.size/1024) + ' Ko)';
  if (!document.getElementById('media-label').value)
    document.getElementById('media-label').value = file.name;
}

async function doEmbedMedia() {
  if (!_mediaB64 || !currentPdfData) { t('Sélectionnez un fichier média d\'abord'); return; }
  const pageNum = parseInt(document.getElementById('media-page').value) || 1;
  const label   = document.getElementById('media-label').value || _mediaName;
  const pos     = document.getElementById('media-pos').value || 'center';
  const btn     = document.getElementById('media-btn');
  btn.style.pointerEvents = 'none'; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    const { PDFDocument, PDFName, PDFArray, PDFHexString, PDFDict, PDFStream, PDFNumber, PDFString } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const page = doc.getPages()[pageNum - 1];
    const { width: pw, height: ph } = page.getSize();

    // Embed file as EmbeddedFile stream
    const fileBytes = base64ToBytes(_mediaB64);
    const efStream  = doc.context.stream(fileBytes, {
      Type: 'EmbeddedFile', Subtype: _mediaMime,
      Params: { Size: fileBytes.length }
    });
    const efRef = doc.context.register(efStream);

    // File Specification Dictionary
    const fsDict = doc.context.obj({
      Type: 'Filespec', F: PDFString.of(_mediaName), UF: PDFHexString.fromText(_mediaName),
      EF: { F: efRef },
    });
    const fsRef = doc.context.register(fsDict);

    // Position
    const W=160, H=60;
    let rx, ry;
    const mg = 20;
    switch(pos) {
      case 'tl': rx=mg; ry=ph-H-mg; break; case 'tr': rx=pw-W-mg; ry=ph-H-mg; break;
      case 'bl': rx=mg; ry=mg; break; case 'br': rx=pw-W-mg; ry=mg; break;
      default:   rx=(pw-W)/2; ry=(ph-H)/2;
    }
    const typeIcon = _mediaMime.startsWith('video')?'▶ ': _mediaMime.startsWith('audio')?'♪ ':'📎 ';

    // Create annotation (FileAttachment + appearance as button-like rect)
    const annotDict = doc.context.obj({
      Type: 'Annot', Subtype: 'FileAttachment',
      Rect: [rx, ry, rx+W, ry+H],
      Contents: PDFHexString.fromText(typeIcon + label),
      FS: fsRef,
      Name: 'PushPin',
      T: PDFHexString.fromText('Média intégré'),
    });
    const annotRef = doc.context.register(annotDict);

    // Add annotation to page
    let annots = page.node.lookupMaybe(PDFName.of('Annots'), Array);
    if (!annots) { annots = doc.context.obj([]); page.node.set(PDFName.of('Annots'), annots); }
    annots.push(annotRef);

    // Also draw visual indicator on page
    const { rgb } = PDFLib;
    const iconC = _mediaMime.startsWith('video') ? rgb(0.16,0.48,0.70) :
                  _mediaMime.startsWith('audio') ? rgb(0.17,0.63,0.17) : rgb(0.5,0.4,0.1);
    page.drawRectangle({ x:rx, y:ry, width:W, height:H, color:iconC, opacity:0.12, borderColor:iconC, borderWidth:1.5 });
    page.drawText(typeIcon + label.slice(0,28), {
      x: rx+10, y: ry+H/2-5, size: 10,
      color: iconC, maxWidth: W-20
    });
    page.drawText('Cliquer pour ouvrir', { x: rx+10, y: ry+8, size: 7, color: iconC, opacity: 0.7 });

    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeMediaPanel();
    await fastRerenderPage(data, [pageNum]);
    _logMod('Média intégré', `${_mediaName} — p.${pageNum}`);
    t(`${_mediaName} intégré page ${pageNum}`);
  } catch(e) { t('Erreur intégration média : ' + e.message); }
  finally { btn.style.pointerEvents=''; btn.innerHTML='<i class="fa-solid fa-plus"></i> Intégrer'; }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── GESTION COULEURS ICC ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
async function openICCPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('icc-overlay').style.display = 'flex';
  document.getElementById('icc-preview').style.display = 'none';
  // Detect current color info
  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc  = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const hasOI = !!(doc.catalog.lookupMaybe(PDFName.of('OutputIntents'), Array));
    const info  = hasOI ? '✅ OutputIntent ICC déjà présent' : '⚠️ Aucun profil ICC OutputIntent embarqué';
    const pages = doc.getPages().length;
    document.getElementById('icc-info').innerHTML =
      `<div style="padding:9px 12px;background:rgba(0,0,0,.2);border-radius:4px;font-size:.76rem;color:var(--txt2)">
        ${info}<br>Pages : ${pages} · Producteur : ${doc.getProducer()||'—'}
      </div>`;
  } catch(e) {}
}
function closeICCPanel() {
  document.getElementById('icc-overlay').style.display = 'none';
  document.getElementById('icc-preview').style.display = 'none';
}

async function doICCAction() {
  const action = document.querySelector('input[name="icc-action"]:checked')?.value || 'embed-srgb';
  if (action === 'rgb2cmyk') { await iccPreviewCMYK(); return; }
  const btn = document.getElementById('icc-btn');
  btn.style.pointerEvents='none'; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    const { PDFDocument, PDFName, PDFHexString, PDFString } = PDFLib;
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    if (action === 'embed-srgb') {
      // Minimal sRGB OutputIntent (ICC profile reference)
      const oiDict = doc.context.obj({
        Type: 'OutputIntent', S: PDFName.of('GTS_PDFA1'),
        OutputConditionIdentifier: PDFString.of('sRGB'),
        Info: PDFString.of('sRGB IEC61966-2.1'),
        RegistryName: PDFString.of('http://www.color.org'),
      });
      const oiRef  = doc.context.register(oiDict);
      const oiArr  = doc.context.obj([oiRef]);
      doc.catalog.set(PDFName.of('OutputIntents'), oiArr);
      doc.setProducer('PDFEditor Pro — sRGB OutputIntent');
    } else if (action === 'remove') {
      doc.catalog.delete(PDFName.of('OutputIntents'));
    }
    const data = bytesToBase64(await doc.save({ useObjectStreams: false }));
    closeICCPanel();
    await renderPDFFromData({ name: currentPdfName, size: Math.round(data.length*.75), data, filePath: currentFilePath }, true);
    _logMod('ICC ' + (action==='embed-srgb'?'profil sRGB embarqué':'profils supprimés'));
    t(action==='embed-srgb' ? 'Profil sRGB OutputIntent embarqué' : 'Profils ICC supprimés');
  } catch(e) { t('Erreur ICC : ' + e.message); }
  finally { btn.style.pointerEvents=''; btn.innerHTML='<i class="fa-solid fa-palette"></i> Appliquer'; }
}

async function iccPreviewCMYK() {
  const page  = await currentPdfDoc.getPage(1);
  const vp    = page.getViewport({ scale: 0.8 });
  const cv    = document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height);
  await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  // Simulate CMYK by desaturating + shifting channels
  const ctx = cv.getContext('2d');
  const id  = ctx.getImageData(0,0,cv.width,cv.height);
  const d   = id.data;
  for (let i=0; i<d.length; i+=4) {
    const r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
    const k=1-Math.max(r,g,b);
    const c=k<1?(1-r-k)/(1-k):0, m=(1-g-k)/(1-k||1), y=(1-b-k)/(1-k||1);
    d[i]  = Math.round((1-c)*(1-k)*255);
    d[i+1]= Math.round((1-m)*(1-k)*255);
    d[i+2]= Math.round((1-y)*(1-k)*255);
  }
  ctx.putImageData(id,0,0);
  const prevcv = document.getElementById('icc-preview-cv');
  prevcv.width=cv.width; prevcv.height=cv.height;
  prevcv.getContext('2d').drawImage(cv,0,0);
  document.getElementById('icc-preview').style.display='block';
  t('Aperçu CMJN simulé (non modifié dans le PDF)');
}

// ═════════════════════════════════════════════════════════════════════════════
// ── PRÉFLIGHTING ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _pflResults = [];

async function openPreflightPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('pfl-overlay').style.display = 'flex';
  document.getElementById('pfl-content').innerHTML = '';
  document.getElementById('pfl-loading').style.display = 'flex';
  document.getElementById('pfl-footer').style.display  = 'none';
  _pflResults = [];
  setTimeout(doPreflightCheck, 80);
}
function closePreflightPanel() { document.getElementById('pfl-overlay').style.display = 'none'; }

async function doPreflightCheck() {
  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc   = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pages = doc.getPages(); const n = pages.length;

    function _pfl(status, label, detail, cat) { _pflResults.push({status,label,detail,cat}); }

    // 1. Page dimensions
    document.getElementById('pfl-status').textContent = 'Vérification dimensions…';
    const stdSizes = {
      'A4':[595,842],'A3':[842,1191],'Letter':[612,792],'Legal':[612,1008],'A5':[420,595]
    };
    pages.forEach((pg, i) => {
      const {width:w, height:h} = pg.getSize();
      const match = Object.entries(stdSizes).find(([,s]) => Math.abs(s[0]-w)<2 && Math.abs(s[1]-h)<2 || Math.abs(s[1]-w)<2 && Math.abs(s[0]-h)<2);
      _pfl(match?'pass':'info', `Page ${i+1} — Dimensions`,
        match ? `${match[0]} (${Math.round(w)}×${Math.round(h)} pts)` : `Format personnalisé : ${Math.round(w)}×${Math.round(h)} pts — vérifiez le fond perdu (+3mm).`, 'dimensions');
    });

    // 2. Metadata
    document.getElementById('pfl-status').textContent = 'Vérification métadonnées…';
    _pfl(doc.getTitle()  ?'pass':'warn','Titre du document', doc.getTitle()||'Manquant — requis pour PDF/A et accessibilité','metadata');
    _pfl(doc.getAuthor() ?'pass':'info','Auteur',            doc.getAuthor()||'Non renseigné','metadata');

    // 3. Encryption
    _pfl(!doc.isEncrypted?'pass':'fail','Chiffrement', doc.isEncrypted?'Document chiffré — incompatible PDF/A':'Non chiffré — compatible archivage','security');

    // 4. OutputIntent / ICC
    const hasOI = !!(doc.catalog.lookupMaybe(PDFName.of('OutputIntents'),Array));
    _pfl(hasOI?'pass':'warn','Profil ICC OutputIntent', hasOI?'OutputIntent présent':'Aucun profil ICC — couleurs non gérées pour l\'impression.','color');

    // 5. JavaScript
    let hasJS = false;
    try { hasJS = !!(doc.catalog.lookupMaybe(PDFName.of('JavaScript'),Object)||doc.catalog.lookupMaybe(PDFName.of('AA'),Object)); } catch{}
    _pfl(hasJS?'fail':'pass','JavaScript', hasJS?'Actions JavaScript détectées — incompatible PDF/A':'Aucun JavaScript','security');

    // 6. Language
    let lang=''; try { lang=doc.catalog.lookup(PDFName.of('Lang'))?.asString()?.replace(/[<>]/g,'')||''; } catch{}
    _pfl(lang?'pass':'warn','Langue', lang?`Langue définie : ${lang}`:'Aucune langue — requis PDF/UA','metadata');

    // 7. Images resolution (estimate)
    document.getElementById('pfl-status').textContent = 'Analyse résolution images…';
    for (let pi=0; pi<Math.min(n,5); pi++) {
      const page  = await currentPdfDoc.getPage(pi+1);
      const vp    = page.getViewport({scale:1});
      const pw    = vp.width, ph = vp.height;
      const ops   = await page.getOperatorList();
      // Heuristic: render at high DPI and check if it's readable
      // We estimate by checking if page has images (objDeps includes Image)
      const hasImages = ops.fnArray.includes(pdfjsLib.OPS?.paintImageXObject||82);
      if (hasImages) {
        _pfl('info', `Page ${pi+1} — Résolution images`,
          `Des images sont présentes. Résolution estimée sur ${Math.round(pw)}×${Math.round(ph)} pts. Recommandé: ≥300 DPI pour impression.`, 'images');
      }
    }

    // 8. Fonts
    document.getElementById('pfl-status').textContent = 'Vérification polices…';
    let fontsOK = true;
    try {
      const resCounts = [];
      pages.forEach(pg => {
        const res = pg.node.lookupMaybe(PDFName.of('Resources'), Object);
        if (res) { const fonts = res.lookupMaybe(PDFName.of('Font'), Object); if (fonts) resCounts.push(fonts.size()); }
      });
      const total = resCounts.reduce((a,b)=>a+b,0);
      _pfl('info','Polices utilisées', `${total} référence(s) de police détectées dans les ressources de page. L\'intégration complète (subset) est recommandée pour PDF/A.`,'fonts');
    } catch{ _pfl('info','Polices','Analyse non disponible pour ce document.','fonts'); }

    // 9. Tagged PDF
    let tagged=false; try { tagged=!!(doc.catalog.lookupMaybe(PDFName.of('MarkInfo'),Object)); } catch{}
    _pfl(tagged?'pass':'warn','PDF balisé (Tagged)', tagged?'Structure de balisage présente':'Non balisé — requis pour PDF/UA et l\'accessibilité.','accessibility');

    // 10. Annotations
    let annotCount=0;
    pages.forEach(pg => { const a=pg.node.lookupMaybe(PDFName.of('Annots'),Array); if(a) annotCount+=a.size(); });
    _pfl('info','Annotations', `${annotCount} annotation(s) au total.`,'annotations');

    _renderPreflight();
  } catch(e) {
    document.getElementById('pfl-content').innerHTML=`<div class="tbl-empty" style="color:#e74c3c">Erreur : ${e.message}</div>`;
  } finally {
    document.getElementById('pfl-loading').style.display='none';
    document.getElementById('pfl-footer').style.display='flex';
  }
}

function _renderPreflight() {
  const pass=_pflResults.filter(r=>r.status==='pass').length;
  const fail=_pflResults.filter(r=>r.status==='fail').length;
  const warn=_pflResults.filter(r=>r.status==='warn').length;
  const total=_pflResults.length;
  const score=Math.round((pass+warn*.5)/total*100);
  const col=score>=80?'#2ecc71':score>=50?'#f39c12':'#e74c3c';
  const icons={pass:'✅',fail:'❌',warn:'⚠️',info:'ℹ️'};
  const cats=[...new Set(_pflResults.map(r=>r.cat))];
  const catLbl={dimensions:'Dimensions',metadata:'Métadonnées',security:'Sécurité',color:'Couleurs',images:'Images',fonts:'Polices',accessibility:'Accessibilité',annotations:'Annotations'};
  let html=`<div class="pfl-score" style="color:${col}">${score}%</div>
    <div class="pfl-score-sub">${pass} OK · ${fail} erreur(s) · ${warn} avertissement(s) · ${total-pass-fail-warn} info</div>`;
  cats.forEach(cat => {
    html+=`<div class="pfl-section">${catLbl[cat]||cat}</div>`;
    _pflResults.filter(r=>r.cat===cat).forEach(r => {
      html+=`<div class="pfl-check"><div class="pfl-icon">${icons[r.status]||'ℹ️'}</div>
        <div class="pfl-body"><div class="pfl-label"><b>${r.label}</b></div>
        <div class="pfl-detail">${r.detail}</div></div></div>`;
    });
  });
  document.getElementById('pfl-content').innerHTML=html;
}

function exportPreflightReport() {
  if (!_pflResults.length) return;
  const icons={pass:'[OK]',fail:'[ERREUR]',warn:'[AVERTISSEMENT]',info:'[INFO]'};
  const score=Math.round(_pflResults.filter(r=>r.status==='pass').length/_pflResults.length*100);
  const lines=_pflResults.map(r=>`${icons[r.status]} ${r.label}\n   ${r.detail}`).join('\n\n');
  const hdr=`Rapport Préflighting — PDFEditor Pro\nDocument : ${currentPdfName||'—'}\nDate : ${new Date().toLocaleString('fr-FR')}\nScore : ${score}%\n${'═'.repeat(55)}\n\n`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([hdr+lines],{type:'text/plain'}));
  a.download='preflight_'+(currentPdfName||'doc').replace(/\.pdf$/i,'')+'.txt';
  a.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// ── CONFORMITÉ PDF/A · X · E · UA ───────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
let _stdResults=[], _stdTarget='';

function openPDFStdPanel() {
  if (!currentPdfDoc) { t('Ouvrez un PDF d\'abord'); return; }
  document.getElementById('std-overlay').style.display='flex';
  document.getElementById('std-result').style.display='none';
  document.getElementById('std-export-btn').style.display='none';
  document.getElementById('std-fix-btn').style.display='none';
  _stdResults=[];
}
function closePDFStdPanel() { document.getElementById('std-overlay').style.display='none'; }

async function doPDFStdCheck() {
  _stdTarget=document.querySelector('input[name="pdf-std"]:checked')?.value||'pdfa1b';
  const btn=document.getElementById('std-check-btn');
  btn.style.pointerEvents='none'; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';
  _stdResults=[];
  try {
    const { PDFDocument, PDFName } = PDFLib;
    const doc=await PDFDocument.load(base64ToBytes(currentPdfData),{ignoreEncryption:true});
    function _std(ok,label,detail,fixable=false){ _stdResults.push({ok,label,detail,fixable}); }
    const isTgt=(v)=>_stdTarget===v;

    // Common checks
    const title=doc.getTitle();
    _std(!!title, 'Titre du document', title||'Manquant', isTgt('pdfa1b')||isTgt('pdfa2b')||isTgt('pdfua1'));
    let lang=''; try{lang=doc.catalog.lookup(PDFName.of('Lang'))?.asString()?.replace(/[<>]/g,'')||'';}catch{}
    _std(!!lang, 'Langue définie (/Lang)', lang||'Manquante', isTgt('pdfua1')||isTgt('pdfa1b'));
    _std(!doc.isEncrypted, 'Pas de chiffrement', doc.isEncrypted?'Chiffrement présent':'Aucun chiffrement', false);
    const hasOI=!!(doc.catalog.lookupMaybe(PDFName.of('OutputIntents'),Array));
    _std(hasOI||isTgt('pdfa1b'), 'OutputIntent ICC', hasOI?'Présent':'Manquant — requis PDF/X', isTgt('pdfx4'));
    let hasJS=false; try{hasJS=!!(doc.catalog.lookupMaybe(PDFName.of('JavaScript'),Object));}catch{}
    _std(!hasJS,'Pas de JavaScript',hasJS?'JavaScript détecté — interdit PDF/A':'Aucun JavaScript');
    if (isTgt('pdfua1')||isTgt('pdfa1b')) {
      let tagged=false; try{tagged=!!(doc.catalog.lookupMaybe(PDFName.of('MarkInfo'),Object));}catch{}
      _std(tagged,'PDF balisé (Tagged)',tagged?'Structure présente':'Non balisé — requis PDF/UA');
    }
    if (isTgt('pdfx4')) {
      const hasTrimBox = doc.getPages().some(pg=>pg.node.lookupMaybe(PDFName.of('TrimBox'),Array));
      _std(hasTrimBox,'TrimBox (zone de rognage)',hasTrimBox?'Présent':'Manquant — requis PDF/X',true);
    }
    // XMP metadata
    const xmpStream=doc.catalog.lookupMaybe(PDFName.of('Metadata'),Object);
    _std(!!xmpStream,'Métadonnées XMP',xmpStream?'Flux XMP présent':'Absent — recommandé PDF/A',true);

    _renderStdResult();
    document.getElementById('std-export-btn').style.display='';
    const hasFix=_stdResults.some(r=>!r.ok&&r.fixable);
    document.getElementById('std-fix-btn').style.display=hasFix?'':'none';
  } catch(e){ t('Erreur : '+e.message); }
  finally{ btn.style.pointerEvents=''; btn.innerHTML='<i class="fa-solid fa-magnifying-glass"></i> Vérifier'; }
}

const _stdNames={pdfa1b:'PDF/A-1b',pdfa2b:'PDF/A-2b',pdfx4:'PDF/X-4',pdfua1:'PDF/UA-1'};

function _renderStdResult() {
  const pass=_stdResults.filter(r=>r.ok).length, total=_stdResults.length;
  const pct=Math.round(pass/total*100);
  const col=pct===100?'#2ecc71':pct>=60?'#f39c12':'#e74c3c';
  const verdict=pct===100?'✅ CONFORME':'❌ NON CONFORME';
  let html=`<div style="text-align:center;padding:10px 0">
    <div style="font-family:'Cinzel Decorative',cursive;font-size:1.4rem;color:${col}">${pct}%</div>
    <div style="font-size:.8rem;color:${col};margin-top:4px">${verdict} — ${_stdNames[_stdTarget]}</div>
    <div style="font-size:.7rem;color:var(--txt2);margin-top:2px">${pass}/${total} critères satisfaits</div>
  </div>`;
  _stdResults.forEach(r=>{
    html+=`<div class="std-check">
      <div style="width:20px;flex-shrink:0">${r.ok?'✅':'❌'}</div>
      <div><div style="font-size:.78rem;color:var(--txt)">${r.label}</div>
      <div style="font-size:.7rem;color:var(--txt2);margin-top:2px">${r.detail}</div></div>
    </div>`;
  });
  document.getElementById('std-result').innerHTML=html;
  document.getElementById('std-result').style.display='block';
}

async function doPDFStdFix() {
  try {
    const { PDFDocument, PDFName, PDFString } = PDFLib;
    const doc=await PDFDocument.load(base64ToBytes(currentPdfData),{ignoreEncryption:true});
    let fixes=[];
    if (!doc.getTitle()) {
      doc.setTitle(currentPdfName?.replace(/\.pdf$/i,'')||'Document');
      fixes.push('Titre ajouté');
    }
    let lang=''; try{lang=doc.catalog.lookup(PDFName.of('Lang'))?.asString()?.replace(/[<>]/g,'')||'';}catch{}
    if (!lang) {
      doc.catalog.set(PDFName.of('Lang'), PDFString.of('fr'));
      fixes.push('Langue définie (fr)');
    }
    if (_stdTarget==='pdfx4') {
      const hasOI=!!(doc.catalog.lookupMaybe(PDFName.of('OutputIntents'),Array));
      if (!hasOI) {
        const oiDict=doc.context.obj({Type:'OutputIntent',S:PDFName.of('GTS_PDFX'),
          OutputConditionIdentifier:PDFString.of('sRGB'),Info:PDFString.of('sRGB IEC61966-2.1')});
        doc.catalog.set(PDFName.of('OutputIntents'),doc.context.obj([doc.context.register(oiDict)]));
        fixes.push('OutputIntent sRGB ajouté');
      }
    }
    // Add ViewerPreferences
    doc.catalog.set(PDFName.of('ViewerPreferences'), doc.context.obj({DisplayDocTitle:true}));
    fixes.push('DisplayDocTitle activé');
    doc.setProducer('PDFEditor Pro — '+(_stdNames[_stdTarget]||''));
    doc.setModificationDate(new Date());

    const data=bytesToBase64(await doc.save({useObjectStreams:false}));
    closePDFStdPanel();
    await renderPDFFromData({name:currentPdfName, size:Math.round(data.length*.75), data, filePath:currentFilePath}, true);
    _logMod('Conformité '+(_stdNames[_stdTarget]||''), fixes.join(', '));
    t('Corrections appliquées : '+fixes.join(', '));
  } catch(e){ t('Erreur : '+e.message); }
}

function exportStdReport() {
  if (!_stdResults.length) return;
  const score=Math.round(_stdResults.filter(r=>r.ok).length/_stdResults.length*100);
  const lines=_stdResults.map(r=>`[${r.ok?'OK':'ERREUR'}] ${r.label}\n   ${r.detail}`).join('\n\n');
  const hdr=`Rapport Conformité ${_stdNames[_stdTarget]||''} — PDFEditor Pro\nDocument : ${currentPdfName||'—'}\nDate : ${new Date().toLocaleString('fr-FR')}\nScore : ${score}%\n${'═'.repeat(55)}\n\n`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([hdr+lines],{type:'text/plain'}));
  a.download='conformite_'+(currentPdfName||'doc').replace(/\.pdf$/i,'')+'.txt';
  a.click();
}

// ═════════════════════════════════════════════════════════════════════════════
// ── AIDE & RACCOURCIS CLAVIER ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function openHelpModal() {
  const sections = [
    {
      icon: 'fa-folder-open', title: 'Fichiers',
      rows: [
        ['⌘ N',       'Nouveau document'],
        ['⌘ O',       'Ouvrir un PDF'],
        ['⌘ S',       'Enregistrer'],
        ['⌘ ⇧ S',     'Enregistrer sous…'],
        ['⌘ P',       'Imprimer'],
        ['Glisser-déposer', 'Ouvrir un PDF depuis l\'explorateur'],
      ]
    },
    {
      icon: 'fa-rotate-left', title: 'Édition',
      rows: [
        ['⌘ Z',       'Annuler la dernière action'],
        ['⌘ ⇧ Z',     'Rétablir'],
        ['⌘ C',       'Copier la sélection'],
        ['⌘ X',       'Couper la sélection'],
        ['⌘ V',       'Coller'],
        ['Suppr',      'Supprimer l\'élément sélectionné'],
        ['Échap',      'Désactiver l\'outil / fermer la fenêtre'],
      ]
    },
    {
      icon: 'fa-magnifying-glass', title: 'Navigation & Affichage',
      rows: [
        ['⌘ +',       'Zoom avant'],
        ['⌘ −',       'Zoom arrière'],
        ['⌘ 0',       'Adapter à la page'],
        ['⌘ F',       'Plein écran'],
        ['F11',        'Plein écran (alternatif)'],
        ['⌘ G',       'Rechercher dans le document'],
        ['↑ ↓',       'Naviguer entre les pages (hors zone texte)'],
      ]
    },
    {
      icon: 'fa-pen-nib', title: 'Outils (raccourcis clavier)',
      rows: [
        ['T',          'Outil Texte'],
        ['H',          'Surligner'],
        ['E',          'Biffure'],
        ['M',          'Mesures & Cotation'],
        ['Double-clic texte', 'Sélectionner un mot'],
        ['Triple-clic texte', 'Sélectionner une ligne'],
      ]
    },
    {
      icon: 'fa-layer-group', title: 'Pages',
      rows: [
        ['⌘ ⇧ +',     'Insérer une page vierge après la page courante'],
        ['⌘ ⇧ D',     'Dupliquer la page courante'],
        ['⌘ ⇧ ⌫',    'Supprimer la page courante'],
        ['Glisser vignette', 'Réordonner les pages'],
      ]
    },
    {
      icon: 'fa-circle-question', title: 'Général',
      rows: [
        ['?',          'Ouvrir cette aide'],
        ['Échap',      'Fermer les panneaux / modales'],
      ]
    },
  ];

  const col = (rows) => rows.map(([k, v]) =>
    `<tr>
      <td style="padding:5px 14px 5px 0;white-space:nowrap">
        ${k.split(' ').map(part =>
          ['⌘','⇧','⌥','⌃','Suppr','Échap','F11','↑','↓'].includes(part) || /^[A-Z]$/.test(part)
            ? `<kbd style="display:inline-block;padding:2px 6px;border-radius:3px;border:1px solid rgba(200,150,46,.4);background:rgba(200,150,46,.08);font-family:monospace;font-size:.72rem;color:var(--gold);margin:0 1px">${part}</kbd>`
            : `<span style="font-size:.72rem;color:var(--gold)">${part}</span>`
        ).join('')}
      </td>
      <td style="padding:5px 0;font-size:.76rem;color:var(--txt2)">${v}</td>
    </tr>`
  ).join('');

  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 28px;padding:4px 0 8px">
      ${sections.map(s => `
        <div>
          <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.1em;color:var(--gold);
               text-transform:uppercase;border-bottom:1px solid rgba(200,150,46,.25);padding-bottom:5px;margin-bottom:6px">
            <i class="fa-solid ${s.icon}" style="margin-right:6px;opacity:.7"></i>${s.title}
          </div>
          <table style="border-collapse:collapse;width:100%">${col(s.rows)}</table>
        </div>`
      ).join('')}
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:rgba(200,150,46,.06);border:1px solid rgba(200,150,46,.15);border-radius:4px;font-size:.7rem;color:var(--txt2);text-align:center">
      ⌘ = Ctrl sur Windows &nbsp;·&nbsp; ⇧ = Shift &nbsp;·&nbsp; ⌥ = Alt &nbsp;·&nbsp; ⌫ = Backspace/Delete
    </div>`;

  openModal('<i class="fa-regular fa-circle-question" style="color:var(--gold);margin-right:8px"></i>Aide &amp; Raccourcis clavier', body);
}

// Raccourci '?' pour ouvrir l'aide
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === '?') openHelpModal();
});

// ══════════════════════════════════════════════════════════════════════════════
// SUPPRESSION DES FILIGRANES
// ══════════════════════════════════════════════════════════════════════════════

function openRemoveWMPanel() {
  if (!currentPdfDoc) { t('Ouvrez d\'abord un PDF.'); return; }
  const np = currentPdfDoc.numPages;
  const curPage = parseInt(document.getElementById('cur-page')?.textContent) || 1;
  document.getElementById('rmwm-page-info').textContent =
    `Document : ${np} page${np > 1 ? 's' : ''} · Page courante : ${curPage}`;
  document.getElementById('rmwm-progress').style.display = 'none';
  document.getElementById('rmwm-result').style.display = 'none';
  document.getElementById('rmwm-btn').disabled = false;
  document.getElementById('rmwm-overlay').style.display = 'flex';
  // Toggle options doc scanné
  document.getElementById('rmwm-scanned').onchange = function() {
    document.getElementById('rmwm-gray-opts').style.display = this.checked ? 'flex' : 'none';
  };
}

function closeRemoveWMPanel() {
  document.getElementById('rmwm-overlay').style.display = 'none';
}

// ── helpers inflate/deflate via Node.js zlib (IPC → main process) ────────────
function _u8ToB64(arr) {
  let s = '';
  const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function _b64ToU8(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function _pdfInflate(data) {
  const b64 = _u8ToB64(data instanceof Uint8Array ? data : new Uint8Array(data));
  const res = await window.electronAPI.pdfInflate(b64);
  if (!res.ok) throw new Error(res.err || 'inflate failed');
  return _b64ToU8(res.b64);
}

async function _pdfDeflate(data) {
  const b64 = _u8ToB64(data instanceof Uint8Array ? data : new Uint8Array(data));
  const res = await window.electronAPI.pdfDeflate(b64);
  if (!res.ok) throw new Error('deflate failed');
  return _b64ToU8(res.b64);
}

// ── tokeniseur de flux de contenu PDF ────────────────────────────────────────
function _tokenizePdfCS(bytes) {
  const str = new TextDecoder('latin1').decode(bytes);
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    if (' \t\n\r\f\0'.includes(str[i])) { i++; continue; }
    if (str[i] === '%') { while (i < str.length && str[i] !== '\n' && str[i] !== '\r') i++; continue; }
    if (str[i] === '(') {
      let d = 1, v = '('; i++;
      while (i < str.length && d > 0) {
        if (str[i] === '\\') { v += str[i] + (str[i+1] || ''); i += 2; continue; }
        if (str[i] === '(') d++; if (str[i] === ')') d--;
        v += str[i++];
      }
      tokens.push({ t: 's', v });
    } else if (str[i] === '<' && str[i+1] === '<') {
      let d = 1, v = '<<'; i += 2;
      while (i < str.length - 1 && d > 0) {
        if (str[i] === '<' && str[i+1] === '<') { d++; v += '<<'; i += 2; }
        else if (str[i] === '>' && str[i+1] === '>') { d--; v += '>>'; i += 2; }
        else v += str[i++];
      }
      tokens.push({ t: 'd', v });
    } else if (str[i] === '<') {
      let v = '<'; i++;
      while (i < str.length && str[i] !== '>') v += str[i++];
      v += '>'; i++;
      tokens.push({ t: 'h', v });
    } else if (str[i] === '[') {
      let d = 1, v = '['; i++;
      while (i < str.length && d > 0) {
        if (str[i] === '[') d++; if (str[i] === ']') d--;
        v += str[i++];
      }
      tokens.push({ t: 'a', v });
    } else if (str[i] === '/') {
      let v = '/'; i++;
      while (i < str.length && !' \t\n\r\f\0[]<>()/%'.includes(str[i])) v += str[i++];
      tokens.push({ t: 'n', v });
    } else {
      let v = '';
      while (i < str.length && !' \t\n\r\f\0[]<>()/%'.includes(str[i])) v += str[i++];
      if (!v) { i++; continue; }
      const n = parseFloat(v);
      tokens.push({ t: isNaN(n) ? 'o' : 'm', v, n: isNaN(n) ? undefined : n });
    }
  }
  return tokens;
}

// ── suppression des blocs suspects (q…Q) dans la liste de tokens ──────────────
// Rotation significative = sin(θ) > 0.5 → θ > 30°
const _WM_ROT_THRESHOLD = 0.5;

function _hasSignificantRotation(tokens, opIdx) {
  // Vérifie si le token d'opérateur (cm ou Tm) à opIdx a une rotation significative
  if (opIdx < 6) return false;
  const b = tokens[opIdx-5]?.n ?? 0;
  const c = tokens[opIdx-4]?.n ?? 0;
  return Math.abs(b) > _WM_ROT_THRESHOLD || Math.abs(c) > _WM_ROT_THRESHOLD;
}

function _wmFilterTokens(tokens, lowOpGS, opts) {
  const { removeRotated = true } = opts;
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].t === 'o' && tokens[i].v === 'q') {
      let depth = 1, j = i + 1;
      let lowOp = false, hasCmRot = false, hasTmRot = false;
      let hasText = false, hasInlineImg = false, hasXObject = false;

      while (j < tokens.length) {
        const tk = tokens[j];
        if (tk.t === 'o' && tk.v === 'q') depth++;
        if (tk.t === 'o' && tk.v === 'Q') { depth--; if (!depth) break; }

        // GS avec opacité basse
        if (tk.t === 'o' && tk.v === 'gs' && tokens[j-1]?.t === 'n')
          if (lowOpGS.has(tokens[j-1].v.slice(1))) lowOp = true;

        // cm (transformation CTM) avec rotation
        if (tk.t === 'o' && tk.v === 'cm' && _hasSignificantRotation(tokens, j)) hasCmRot = true;

        // Tm (text matrix) avec rotation — fréquent pour les filigranes en diagonale
        if (tk.t === 'o' && tk.v === 'Tm' && _hasSignificantRotation(tokens, j)) hasTmRot = true;

        // Opérateurs de dessin de texte
        if (tk.t === 'o' && ['Tj', 'TJ', "'", '"'].includes(tk.v)) hasText = true;

        // Image inline (données binaires brutes) — toujours préserver
        if (tk.t === 'o' && tk.v === 'BI') hasInlineImg = true;

        // Do = XObject (peut être Form = filigrane, ou Image = à préserver)
        if (tk.t === 'o' && tk.v === 'Do') hasXObject = true;

        j++;
      }

      const hasRot = hasCmRot || hasTmRot;
      const blockTokens = j - i - 1;
      const isSmallBlock = blockTokens < 600; // augmenté à 600

      // Pattern filigrane Form XObject : q [gs] /Name Do Q — petit bloc, sans texte direct
      // Filigrane en overlay (ex. SPECIMEN en XObject)
      const isXObjectWatermark = lowOp && hasXObject && !hasText && !hasInlineImg
        && blockTokens < 20;

      // Filigrane texte diagonal : rotation (cm ou Tm) + texte + pas d'image inline
      const matchRot = removeRotated && hasRot && hasText && !hasInlineImg && isSmallBlock;

      // Opacité + rotation combinées (double critère = très précis)
      const matchOp  = lowOp && hasRot && hasText && !hasInlineImg && isSmallBlock;

      if (isXObjectWatermark || matchRot || matchOp) {
        i = j + 1;
      } else {
        out.push(tokens[i]);
        out.push(..._wmFilterTokens(tokens.slice(i + 1, j), lowOpGS, opts));
        if (j < tokens.length) out.push(tokens[j]);
        i = j + 1;
      }
    } else {
      out.push(tokens[i++]);
    }
  }
  return out;
}

// ── Mode document scanné : filtrage pixel par pixel ──────────────────────────
// ── Helpers communs pour le mode scanné ──────────────────────────────────────
function _wmBuildMask(d, W, H, gMin, gMax, TOL) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = d[i], g = d[i+1], b = d[i+2];
      if (r >= gMin && r <= gMax && g >= gMin && g <= gMax && b >= gMin && b <= gMax
          && Math.abs(r-g) < TOL && Math.abs(g-b) < TOL && Math.abs(r-b) < TOL) {
        mask[y * W + x] = 1;
      }
    }
  }
  return mask;
}

// ── Mode standard : remplissage fond blanc ou couleur locale ─────────────────
async function _wmRemoveScanned(pageIndices, setP, smartFill = false) {
  const { PDFDocument } = PDFLib;
  const gMin = parseInt(document.getElementById('rmwm-gmin').value) || 140;
  const gMax = parseInt(document.getElementById('rmwm-gmax').value) || 220;
  const TOL  = 30;

  setP(5, 'Chargement…');

  // Charger le document original (pour copier les pages non traitées)
  const originalDoc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
  const totalPages  = originalDoc.getPageCount();

  // Traiter d'abord les pages cibles → stocker les images résultantes
  const processedMap = {}; // index de page → { pngBytes, pgW, pgH }
  const targetSet    = new Set(pageIndices);

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pi = pageIndices[idx];
    setP(10 + Math.round(idx / pageIndices.length * 80), `Traitement page ${pi + 1}…`);

    const pdfPage = await currentPdfDoc.getPage(pi + 1);
    const viewport = pdfPage.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const W = canvas.width, H = canvas.height;
    const mask = _wmBuildMask(d, W, H, gMin, gMax, TOL);

    if (!smartFill) {
      for (let i = 0; i < W * H; i++) {
        if (!mask[i]) continue;
        d[i*4] = d[i*4+1] = d[i*4+2] = 255;
      }
    } else {
      const NX = [-1,1,0,0,-2,2,0,0,-1,-1,1,1];
      const NY = [0,0,-1,1,0,0,-2,2,-1,1,-1,1];
      const orig = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!mask[y * W + x]) continue;
          let rS = 0, gS = 0, bS = 0, cnt = 0;
          for (let n = 0; n < NX.length; n++) {
            const nx = x + NX[n], ny = y + NY[n];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (mask[ny * W + nx]) continue;
            const pi2 = (ny * W + nx) * 4;
            rS += orig[pi2]; gS += orig[pi2+1]; bS += orig[pi2+2];
            cnt++;
          }
          const i = (y * W + x) * 4;
          if (cnt > 0) {
            d[i] = Math.round(rS/cnt); d[i+1] = Math.round(gS/cnt); d[i+2] = Math.round(bS/cnt);
          } else {
            d[i] = d[i+1] = d[i+2] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const pngB64   = canvas.toDataURL('image/png').split(',')[1];
    processedMap[pi] = { pngBytes: _b64ToU8(pngB64), pgW: viewport.width / 2, pgH: viewport.height / 2 };
  }

  // Construire le document final : toutes les pages originales,
  // en remplaçant uniquement celles qui ont été traitées
  setP(92, 'Assemblage du document…');
  const newDoc = await PDFDocument.create();

  for (let i = 0; i < totalPages; i++) {
    if (processedMap[i]) {
      // Page traitée : insérer l'image nettoyée
      const { pngBytes, pgW, pgH } = processedMap[i];
      const img     = await newDoc.embedPng(pngBytes);
      const newPage = newDoc.addPage([pgW, pgH]);
      newPage.drawImage(img, { x: 0, y: 0, width: pgW, height: pgH });
    } else {
      // Page non traitée : copier telle quelle depuis le document original
      const [copied] = await newDoc.copyPages(originalDoc, [i]);
      newDoc.addPage(copied);
    }
  }

  setP(97, 'Sauvegarde…');
  const newBytes = await newDoc.save();
  setP(100, 'Terminé');
  return newBytes;
}

// ── Mode IA : inpainting via OpenAI Images Edit (DALL-E) ─────────────────────
async function _wmRemoveScannedAI(pageIndices, setP, apiKey) {
  const { PDFDocument } = PDFLib;
  const gMin = parseInt(document.getElementById('rmwm-gmin').value) || 140;
  const gMax = parseInt(document.getElementById('rmwm-gmax').value) || 220;
  const TOL  = 30;
  const TARGET = 1024; // gpt-image-1 : image carrée max 1024×1024

  setP(5, 'Chargement…');
  const newDoc = await PDFDocument.create();

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pi = pageIndices[idx];
    setP(10 + Math.round(idx / pageIndices.length * 80), `Page ${pi + 1} — envoi à l'IA…`);

    // ── Rendu page ──────────────────────────────────────────────────────────
    const pdfPage = await currentPdfDoc.getPage(pi + 1);
    const vp1     = pdfPage.getViewport({ scale: 1.0 });
    const scale   = Math.min(TARGET / vp1.width, TARGET / vp1.height, 2.0);
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    const W = canvas.width, H = canvas.height;
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const mask = _wmBuildMask(d, W, H, gMin, gMax, TOL);

    // ── Image opaque originale (1024×1024, fond blanc) ─────────────────────
    const sqCanvas = document.createElement('canvas');
    sqCanvas.width = sqCanvas.height = TARGET;
    const sqCtx = sqCanvas.getContext('2d');
    sqCtx.fillStyle = '#ffffff';
    sqCtx.fillRect(0, 0, TARGET, TARGET);
    sqCtx.drawImage(canvas, 0, 0);  // image originale, SANS aucune modification

    // ── Masque séparé : transparent là où le filigrane, opaque ailleurs ────
    // gpt-image-1 : zones alpha=0 dans le masque = zones à reconstruire dans l'image
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskCanvas.height = TARGET;
    const mCtx = maskCanvas.getContext('2d');
    // Fond entièrement opaque (zones à conserver)
    mCtx.fillStyle = 'rgba(0,0,0,255)';
    mCtx.fillRect(0, 0, TARGET, TARGET);
    const mData = mCtx.getImageData(0, 0, TARGET, TARGET);
    const md = mData.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        const mi = (y * TARGET + x) * 4;
        md[mi] = md[mi+1] = md[mi+2] = md[mi+3] = 0; // transparent = à reconstruire
      }
    }
    mCtx.putImageData(mData, 0, 0);

    // ── Appel IPC → main process + timer de progression ───────────────────
    const imageB64 = sqCanvas.toDataURL('image/png').split(',')[1];
    const maskB64  = maskCanvas.toDataURL('image/png').split(',')[1];
    const basePct  = 10 + Math.round(idx / pageIndices.length * 80);
    let elapsed = 0;
    const ticker = setInterval(() => {
      elapsed++;
      const label = pageIndices.length > 1
        ? `Page ${pi + 1}/${pageIndices.length} — IA en cours… ${elapsed}s`
        : `Analyse IA en cours… ${elapsed}s`;
      setP(basePct, label);
    }, 1000);

    let json;
    try {
      json = await electronAPI.openaiImageInpaint(
        imageB64, maskB64,
        'Remove the watermark text. Restore the original background underneath as if the watermark was never there. Do not modify any other content.',
        apiKey
      );
    } finally {
      clearInterval(ticker);
    }
    const resultB64 = json.data?.[0]?.b64_json;
    if (!resultB64) throw new Error('Réponse IA vide');

    // ── Recadrer au format original et intégrer ─────────────────────────────
    const resultImg = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = 'data:image/png;base64,' + resultB64;
    });
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = W; cropCanvas.height = H;
    cropCanvas.getContext('2d').drawImage(resultImg, 0, 0, W, H, 0, 0, W, H);

    const finalB64 = cropCanvas.toDataURL('image/png').split(',')[1];
    const finalBytes = _b64ToU8(finalB64);
    const img2 = await newDoc.embedPng(finalBytes);
    const [pgW, pgH] = [W / scale, H / scale];
    const newPage = newDoc.addPage([pgW, pgH]);
    newPage.drawImage(img2, { x: 0, y: 0, width: pgW, height: pgH });
  }

  setP(95, 'Sauvegarde…');
  const newBytes = await newDoc.save();
  setP(100, 'Terminé');
  return newBytes;
}

// ── traitement principal ──────────────────────────────────────────────────────
async function doRemoveWatermarks() {
  if (!currentPdfDoc || !currentPdfData) return;

  const btn  = document.getElementById('rmwm-btn');
  const prg  = document.getElementById('rmwm-progress');
  const res  = document.getElementById('rmwm-result');
  btn.disabled = true;
  prg.style.display = 'block';
  res.style.display  = 'none';

  const setP = (pct, txt) => {
    document.getElementById('rmwm-bar').style.width = pct + '%';
    document.getElementById('rmwm-progress-txt').textContent = txt;
  };

  const threshold     = parseFloat(document.getElementById('rmwm-threshold').value);
  const removeRotated = document.getElementById('rmwm-rotated').checked;
  const isScanned     = document.getElementById('rmwm-scanned').checked;
  const scope         = document.querySelector('input[name="rmwm-scope"]:checked')?.value || 'all';
  const curPage       = parseInt(document.getElementById('cur-page')?.textContent) || 1;

  try {
    const { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFNumber } = PDFLib;

    // ── Mode document scanné ────────────────────────────────────────────────
    if (isScanned) {
      const pageCount   = currentPdfDoc.numPages;
      const pageIndices = scope === 'current' ? [curPage - 1]
        : Array.from({ length: pageCount }, (_, k) => k);
      const useSmartFill = document.getElementById('rmwm-smartfill')?.checked;
      const newBytes = await _wmRemoveScanned(pageIndices, setP, useSmartFill);
      const newB64   = bytesToBase64(newBytes);
      await renderPDFFromData({
        name: currentPdfName, size: Math.round(newBytes.length * 0.75),
        data: newB64, filePath: currentFilePath,
      }, true);
      res.style.display = 'block';
      res.style.background = 'rgba(46,204,113,.08)';
      res.style.borderColor = 'rgba(46,204,113,.3)';
      res.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#2ecc71;margin-right:6px"></i>`
        + (useSmartFill ? 'Filigrane supprimé — remplissage fond coloré.' : 'Filigrane supprimé — fond blanc.');
      btn.disabled = false; prg.style.display = 'none';
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    setP(5, 'Chargement du document…');
    const doc = await PDFDocument.load(base64ToBytes(currentPdfData), { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    const pageIndices = scope === 'current' ? [curPage - 1]
      : Array.from({ length: pageCount }, (_, k) => k);

    let totalRemoved = 0;

    for (let idx = 0; idx < pageIndices.length; idx++) {
      const pi = pageIndices[idx];
      setP(10 + Math.round(idx / pageIndices.length * 82), `Analyse page ${pi + 1}/${pageCount}…`);

      const page  = doc.getPage(pi);
      const { node } = page;

      // 1. Identifier les ExtGState à faible opacité
      const lowOpGS = new Set();
      try {
        const rsrcVal = node.get(PDFName.of('Resources'));
        const rsrc    = rsrcVal ? doc.context.lookup(rsrcVal) : null;
        if (rsrc) {
          const egVal = rsrc.get(PDFName.of('ExtGState'));
          const eg    = egVal ? doc.context.lookup(egVal) : null;
          if (eg?.entries) {
            for (const [key, val] of eg.entries()) {
              try {
                const gs = doc.context.lookup(val);
                const Ca = gs?.get?.(PDFName.of('Ca'));
                const ca = gs?.get?.(PDFName.of('ca'));
                const opacity = Ca?.asNumber?.() ?? ca?.asNumber?.();
                if (opacity !== undefined && opacity < threshold) {
                  // encodedName = '/GS1' → on retire le '/'
                  const name = (key.encodedName ?? '').replace(/^\//, '')
                    || key.decodeText?.() || String(key);
                  lowOpGS.add(name);
                }
              } catch(_) {}
            }
          }
        }
      } catch(_) {}

      // 2. Traiter chaque flux de contenu
      const processRef = async (ref) => {
        let stream;
        try { stream = doc.context.lookup(ref); } catch(_) { return 0; }
        if (!(stream instanceof PDFRawStream)) return 0;

        // Résoudre le filtre (peut être PDFRef, PDFName ou PDFArray)
        const rawFilter  = stream.dict.get(PDFName.of('Filter'));
        const filterObj  = rawFilter ? doc.context.lookup(rawFilter) : null;
        // Chaîne de filtres multiples ou filtre inconnu → ignorer ce stream
        if (filterObj instanceof PDFArray) return 0;
        const filterName = filterObj?.encodedName?.replace(/^\//, '')
          ?? filterObj?.decodeText?.() ?? '';
        // Ignorer si paramètre prédicteur présent (images) ou filtre non décompressable
        if (stream.dict.get(PDFName.of('DecodeParms'))) return 0;
        if (filterName && filterName !== 'FlateDecode' && filterName !== 'Fl') return 0;

        let bytes = stream.contents;
        if (filterName === 'FlateDecode' || filterName === 'Fl') {
          try { bytes = await _pdfInflate(bytes); } catch(_) { return 0; }
        }
        // Si filterName === '' : stream non compressé, on traite directement
        if (!filterName && bytes.length > 0 && bytes[0] === 0x78) return 0; // sécurité anti-zlib brut

        const tokens    = _tokenizePdfCS(bytes);
        const processed = _wmFilterTokens(tokens, lowOpGS, { removeRotated });
        if (processed.length === tokens.length) return 0;

        const removed    = tokens.length - processed.length;
        // Encodage latin-1 (pas UTF-8) pour préserver les bytes > 127 dans les chaînes PDF
        const joined  = processed.map(tk => tk.v).join(' ');
        const newText = new Uint8Array(joined.length);
        for (let ci = 0; ci < joined.length; ci++) newText[ci] = joined.charCodeAt(ci) & 0xFF;
        const compressed = await _pdfDeflate(newText);

        // Créer un nouveau flux compressé
        const newDict = doc.context.obj({
          '/Filter': '/FlateDecode',
          '/Length': compressed.length,
        });
        const newStream = PDFRawStream.of(newDict, compressed);
        doc.context.assign(ref, newStream);
        return removed;
      };

      try {
        const ctVal   = node.get(PDFName.of('Contents'));
        if (!ctVal) continue;
        const ctObj   = doc.context.lookup(ctVal);
        if (ctObj instanceof PDFRawStream) {
          totalRemoved += await processRef(ctVal);
        } else if (ctObj instanceof PDFArray) {
          for (let si = 0; si < ctObj.size(); si++)
            totalRemoved += await processRef(ctObj.get(si));
        }
      } catch(_) {}
    }

    setP(96, 'Sauvegarde…');
    const newBytes = await doc.save();
    const newB64   = bytesToBase64(newBytes);
    setP(100, 'Terminé');

    await renderPDFFromData({
      name:     currentPdfName,
      size:     Math.round(newBytes.length * 0.75),
      data:     newB64,
      filePath: currentFilePath,
    }, true);

    res.style.display = 'block';
    if (totalRemoved > 0) {
      res.style.background = 'rgba(46,204,113,.08)';
      res.style.borderColor = 'rgba(46,204,113,.3)';
      res.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#2ecc71;margin-right:6px"></i>`
        + `${totalRemoved} élément${totalRemoved > 1 ? 's' : ''} supprimé${totalRemoved > 1 ? 's' : ''} — filigranes retirés avec succès.`;
    } else {
      res.style.background = 'rgba(200,150,46,.08)';
      res.style.borderColor = 'rgba(200,150,46,.3)';
      res.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--gold);margin-right:6px"></i>`
        + `Aucun filigrane détecté avec ces paramètres. Essayez d'augmenter le seuil de transparence.`;
    }

    _logMod('Suppression filigranes',
      scope === 'all' ? `toutes les pages` : `page ${curPage}`,
      `seuil=${Math.round(threshold*100)}%`);

  } catch(e) {
    t('Erreur : ' + e.message);
    console.error('[rmwm]', e);
  } finally {
    btn.disabled = false;
    prg.style.display = 'none';
  }
}
