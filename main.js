'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { createWorker } = require('tesseract.js');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const https = require('https');
const http  = require('http');

let mainWindow;
let pendingFilePath  = null;  // fichier à ouvrir dès que les deux conditions sont réunies
let _windowReady     = false; // ready-to-show a tiré (fenêtre visible)
let _rendererReady   = false; // renderer-ready a tiré (JS initialisé)

// N'envoie le fichier en attente que quand la fenêtre EST visible ET le renderer EST prêt.
// Évite le bug « pages blanches » au démarrage à froid : requestAnimationFrame ne tire pas
// tant que la fenêtre est cachée (show:false), l'opacity du viewport restait à 0.
function _trySendPendingFile() {
  if (_windowReady && _rendererReady && pendingFilePath) {
    const fp = pendingFilePath;
    pendingFilePath = null;
    sendFileToRenderer(fp);
  }
}

function createWindow() {
  _windowReady   = false;
  _rendererReady = false;
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  960,
    minHeight: 600,
    title: 'PDFEdit - Édition Or',
    backgroundColor: '#111C1C',
    show: false, // évite le flash blanc au démarrage
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Afficher la fenêtre seulement quand elle est visuellement prête,
  // puis tenter d'envoyer le fichier en attente (si le renderer est déjà prêt).
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    _windowReady = true;
    _trySendPendingFile();
  });

  // ─── Intercepter la fermeture pour proposer la sauvegarde ───────────────────
  let forceClose = false;
  mainWindow.on('close', e => {
    if (forceClose) return; // déjà validé par le renderer
    e.preventDefault();
    mainWindow.webContents.send('app-close-requested');
  });
  ipcMain.on('confirm-close', () => {
    forceClose = true;
    mainWindow.close();
  });

  // ─── Menu contextuel natif (clic droit) ──────────────────────────────────────
  // Electron desactive le menu natif par defaut ; on le restaure avec Copier/Coller
  mainWindow.webContents.on('context-menu', (e, params) => {
    const items = [];
    if (params.editFlags.canCopy)  items.push({ label: 'Copier',  role: 'copy'  });
    if (params.editFlags.canPaste) items.push({ label: 'Coller',  role: 'paste' });
    if (params.editFlags.canCut)   items.push({ label: 'Couper',  role: 'cut'   });
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Tout selectionner', role: 'selectAll' });
    if (params.isEditable || params.editFlags.canCopy) {
      Menu.buildFromTemplate(items).popup({ window: mainWindow });
    }
  });

  if (process.env.NODE_ENV === 'development') mainWindow.webContents.openDevTools();
  buildNativeMenu();
}

function buildNativeMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about', label: 'A propos de PDFEdit Or' }, { type: 'separator' },
      { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' }
    ]}] : []),
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',           accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu-action', 'new') },
      { label: 'Ouvrir un PDF...', accelerator: 'CmdOrCtrl+O', click: handleOpenFile },
      { label: 'Ouvrir un fichier récent', submenu: (() => {
          const recent = loadRecentFiles();
          if (!recent.length) return [{ label: 'Aucun fichier récent', enabled: false }];
          return [
            ...recent.map(fp => ({
              label: path.basename(fp),
              sublabel: fp,
              click: () => {
                try { sendFileToRenderer(fp); }
                catch { dialog.showErrorBox('Fichier introuvable', fp); }
              }
            })),
            { type: 'separator' },
            { label: 'Effacer la liste', click: () => {
                saveRecentFiles([]);
                buildNativeMenu();
                if (mainWindow) mainWindow.webContents.send('recent-files-updated', []);
              }
            }
          ];
        })()
      },
      { type: 'separator' },
      { label: 'Enregistrer',       accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu-action', 'save') },
      { label: 'Enregistrer sous...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu-action', 'saveAs') },
      { type: 'separator' },
      { label: 'Imprimer...', accelerator: 'CmdOrCtrl+P', click: () => mainWindow.webContents.print() },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter' }
    ]},
    { label: 'Edition', submenu: [
      { role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Retablir' },
      { type: 'separator' },
      { label: 'Couper',  accelerator: 'CmdOrCtrl+X', click: () => mainWindow.webContents.send('menu-action', 'cut')  },
      { label: 'Copier',  accelerator: 'CmdOrCtrl+C', click: () => mainWindow.webContents.send('menu-action', 'copy') },
      { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout selectionner' },
      { type: 'separator' },
      { label: 'Rechercher...', accelerator: 'CmdOrCtrl+H', click: () => mainWindow.webContents.send('menu-action', 'search') }
    ]},
    { label: 'Affichage', submenu: [
      { role: 'reload', label: 'Recharger' }, { role: 'forceReload', label: 'Forcer rechargement' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Zoom par defaut' }, { role: 'zoomIn', label: 'Zoom avant' }, { role: 'zoomOut', label: 'Zoom arriere' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein ecran' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Outils developpeur' }
    ]},
    { label: 'Aide', submenu: [
      { label: 'Documentation', click: () => shell.openExternal('https://github.com/votre-user/pdf-editor#readme') },
      { label: 'Signaler un probleme', click: () => shell.openExternal('https://github.com/votre-user/pdf-editor/issues') }
    ]}
  ];
  if (!isMac) {
    mainWindow.setMenuBarVisibility(false);
  } else {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un document PDF',
    filters: [{ name: 'Documents PDF', extensions: ['pdf'] }, { name: 'Tous les fichiers', extensions: ['*'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return;
  sendFileToRenderer(result.filePaths[0]);
}

function sendFileToRenderer(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const stat   = fs.statSync(filePath);
    mainWindow.webContents.send('open-file', { name: path.basename(filePath), size: stat.size, data: buffer.toString('base64'), filePath });
    addToRecentFiles(filePath);
  } catch (err) {
    dialog.showErrorBox('Erreur de lecture', 'Impossible de lire le fichier :\n' + err.message);
  }
}

// ─── IPC : Ouvrir un PDF ──────────────────────────────────────────────────────
ipcMain.handle('open-pdf-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un ou plusieurs documents PDF',
    filters: [{ name: 'Documents PDF', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  // Retourne un tableau, même pour un seul fichier
  return result.filePaths.map(filePath => {
    const buffer = fs.readFileSync(filePath);
    const stat   = fs.statSync(filePath);
    return { name: path.basename(filePath), size: stat.size, data: buffer.toString('base64'), filePath };
  });
});

// ─── IPC : Sauvegarder ───────────────────────────────────────────────────────
ipcMain.handle('save-pdf-dialog', async (event, { defaultName }) => {
  return await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer sous',
    defaultPath: defaultName || 'document.pdf',
    filters: [
      { name: 'Documents PDF',     extensions: ['pdf']         },
      { name: 'Image PNG',         extensions: ['png']         },
      { name: 'Image JPEG',        extensions: ['jpg', 'jpeg'] },
      { name: 'Tous les fichiers', extensions: ['*']           }
    ]
  });
});

ipcMain.handle('write-file', async (event, { filePath, data }) => {
  try { fs.writeFileSync(filePath, Buffer.from(data, 'base64')); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

// ─── IPC OCR ETAPE 1 : Selectionner et lire l'image (original, couleurs intactes) ───
ipcMain.handle('get-image-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selectionner une image',
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','bmp','tiff','tif'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath  = result.filePaths[0];
  const ext       = path.extname(filePath).slice(1).toLowerCase();
  const imageName = path.basename(filePath, path.extname(filePath)) + '.pdf';
  const buffer    = fs.readFileSync(filePath);

  return {
    imageData: buffer.toString('base64'),
    imageType: (ext === 'png') ? 'png' : 'jpeg',
    imageName
  };
});

// ─── IPC OCR ETAPE 2 : Reconnaitre le texte sur l'image amelioree ────────────
// Recoit l'image en niveaux de gris + contraste + upscale (depuis renderer canvas).
// Ecrit dans un fichier temp, lance Tesseract, retourne mots + dimensions.
ipcMain.handle('ocr-from-data', async (event, { imageData, imageType }) => {
  const ext     = (imageType === 'png') ? 'png' : 'jpg';
  const tmpPath = path.join(os.tmpdir(), 'pdfeditor_ocr_' + Date.now() + '.' + ext);

  mainWindow.webContents.send('ocr-progress', { status: 'Initialisation OCR...', progress: 0.02 });

  let ocrData = null;
  try {
    fs.writeFileSync(tmpPath, Buffer.from(imageData, 'base64'));

    const worker = await createWorker(['fra', 'eng'], 1, {
      logger: m => {
        if (m.progress !== undefined) {
          mainWindow.webContents.send('ocr-progress', { status: m.status || 'Traitement...', progress: m.progress });
        }
      }
    });

    // tessedit_ocr_engine_mode est passe comme 2eme arg de createWorker (1=LSTM)
    // pageseg_mode 3 = auto SANS OSD (le mode 1 requiert osd.traineddata absent)
    await worker.setParameters({
      tessedit_pageseg_mode:     '3',
      preserve_interword_spaces: '1',
      tessedit_char_whitelist:   '',
    });

    const recognized = await worker.recognize(tmpPath);
    await worker.terminate();
    ocrData = recognized.data;
  } catch(err) {
    mainWindow.webContents.send('ocr-progress', { status: 'OCR indisponible', progress: 1 });
    console.error('OCR error:', err);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch(e) {}
  }

  return {
    words: ocrData ? ocrData.words.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) : [],
    ocrWidth:  ocrData ? ocrData.width  : 0,
    ocrHeight: ocrData ? ocrData.height : 0,
  };
});

// ─── IPC : Afficher dans l'explorateur ───────────────────────────────────────
ipcMain.handle('show-in-folder', async (event, filePath) => { shell.showItemInFolder(filePath); });


// ─── Fichiers récents ──────────────────────────────────────────────────────────
const RECENT_MAX = 10;

function getRecentPath() {
  return path.join(app.getPath('userData'), 'pdfeditor-recent.json');
}

function loadRecentFiles() {
  try { return JSON.parse(fs.readFileSync(getRecentPath(), 'utf-8')); }
  catch { return []; }
}

function saveRecentFiles(list) {
  try { fs.writeFileSync(getRecentPath(), JSON.stringify(list)); } catch {}
}

function addToRecentFiles(filePath) {
  let list = loadRecentFiles().filter(p => p !== filePath);
  list.unshift(filePath);
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
  saveRecentFiles(list);
  // Mettre à jour le sous-menu natif (Mac menu bar)
  buildNativeMenu();
  // Envoyer la liste mise à jour au renderer
  if (mainWindow) mainWindow.webContents.send('recent-files-updated', list);
}

ipcMain.handle('get-recent-files', () => loadRecentFiles());

ipcMain.handle('add-to-recent', (event, filePath) => {
  if (filePath === '__clear__') {
    saveRecentFiles([]);
    buildNativeMenu();
    if (mainWindow) mainWindow.webContents.send('recent-files-updated', []);
  } else {
    addToRecentFiles(filePath);
  }
});

ipcMain.handle('open-recent-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      // Retirer le fichier introuvable de la liste
      const list = loadRecentFiles().filter(p => p !== filePath);
      saveRecentFiles(list);
      if (mainWindow) mainWindow.webContents.send('recent-files-updated', list);
      return { error: 'Fichier introuvable : ' + filePath };
    }
    sendFileToRenderer(filePath);
    return { ok: true };
  } catch(e) { return { error: e.message }; }
});

// ─── IPC : Paramètres (stockés dans userData) ─────────────────────────────────
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'pdfeditor-settings.json');
}

ipcMain.handle('get-settings', () => {
  try { return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); }
  catch { return {}; }
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    // Merge avec les paramètres existants pour ne jamais perdre de clés
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch(e) {}
    const merged = { ...existing, ...settings };
    fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2));
    return { success: true };
  }
  catch (err) { return { success: false, error: err.message }; }
});

// ─── IPC : OCR via Google Cloud Vision API ────────────────────────────────────
// imageData : base64 de l'image originale (couleur, pleine resolution)
// Retourne { words:[{text,confidence,bbox:{x0,y0,x1,y1}}], ocrWidth, ocrHeight }
ipcMain.handle('ocr-google-vision', async (event, { imageData, imageType, apiKey }) => {
  if (!apiKey) throw new Error("Cle API Google Vision manquante");

  const url  = "https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(apiKey);
  const body = JSON.stringify({
    requests: [{
      image: { content: imageData },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
    }]
  });

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  } catch (netErr) {
    throw new Error("Impossible de joindre Google Vision API : " + netErr.message);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error("Google Vision " + res.status + " : " + txt.slice(0, 200));
  }

  const data = await res.json();
  if (data.responses && data.responses[0] && data.responses[0].error) {
    throw new Error(data.responses[0].error.message || "Erreur Google Vision");
  }

  const page = (data.responses && data.responses[0] && data.responses[0].fullTextAnnotation &&
                data.responses[0].fullTextAnnotation.pages)
               ? data.responses[0].fullTextAnnotation.pages[0] : null;
  if (!page) return { words: [], ocrWidth: 0, ocrHeight: 0 };

  const words = [];
  for (const block of (page.blocks || [])) {
    for (const para of (block.paragraphs || [])) {
      for (const word of (para.words || [])) {
        const text = (word.symbols || []).map(s => s.text).join('');
        if (!text.trim()) continue;
        const verts = (word.boundingBox && word.boundingBox.vertices) ? word.boundingBox.vertices : [];
        if (!verts.length) continue;
        const xs = verts.map(v => v.x || 0);
        const ys = verts.map(v => v.y || 0);
        words.push({
          text,
          confidence: Math.round((word.confidence !== undefined ? word.confidence : 0.9) * 100),
          bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
        });
      }
    }
  }

  return { words, ocrWidth: page.width || 0, ocrHeight: page.height || 0 };
});

// ─── IPC : Ouvrir image ───────────────────────────────────────────────────────
ipcMain.handle('open-image-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Insérer une image',
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','bmp','gif','tiff'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fp  = result.filePaths[0];
  const ext = path.extname(fp).slice(1).toLowerCase();
  const data = fs.readFileSync(fp).toString('base64');
  return { name: path.basename(fp), data, type: ext === 'png' ? 'png' : 'jpeg', ext };
});

// ─── IPC : Importer fichier (image ou document) ──────────────────────────────
const IMAGE_EXTS = ['jpg','jpeg','png','webp','bmp','tiff','tif'];
const DOC_EXTS   = ['docx','doc','txt','md','rtf','html','htm','odt','gdoc','gsheet','gslides'];

ipcMain.handle('open-import-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un fichier',
    filters: [
      { name: 'Tous les formats', extensions: [...IMAGE_EXTS, ...DOC_EXTS] },
      { name: 'Images',           extensions: IMAGE_EXTS },
      { name: 'Documents Word',   extensions: ['docx','doc'] },
      { name: 'Google Docs',      extensions: ['gdoc','gsheet','gslides'] },
      { name: 'Texte & Markdown', extensions: ['txt','md','rtf'] },
      { name: 'Web (HTML)',        extensions: ['html','htm'] },
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fp  = result.filePaths[0];
  const ext = path.extname(fp).slice(1).toLowerCase();

  // ── Google Docs raccourci (.gdoc / .gsheet / .gslides) ──────────────────────
  if (['gdoc','gsheet','gslides'].includes(ext)) {
    try {
      const content = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const url = content.url || content.url_path || '';
      if (url) {
        // Construire l'URL d'export direct en PDF
        const exportUrl = url.replace(/\/edit.*$/, '/export?format=pdf');
        return { type: 'gdoc', url, exportUrl, name: path.basename(fp, '.' + ext) };
      }
    } catch {}
    return { type: 'gdoc', url: '', exportUrl: '', name: path.basename(fp, '.' + ext) };
  }

  if (IMAGE_EXTS.includes(ext)) {
    const data = fs.readFileSync(fp).toString('base64');
    return { type: 'image', imageData: data,
             imageType: ext === 'png' ? 'png' : 'jpeg',
             imageName: path.basename(fp) };
  }
  return { type: 'document', filePath: fp, ext, name: path.basename(fp) };
});

function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _mdToHtml(md) {
  return md
    .split('\n')
    .map(l => {
      if (/^### /.test(l)) return '<h3>' + _escHtml(l.slice(4)) + '</h3>';
      if (/^## /.test(l))  return '<h2>' + _escHtml(l.slice(3)) + '</h2>';
      if (/^# /.test(l))   return '<h1>' + _escHtml(l.slice(2)) + '</h1>';
      if (/^\*\s/.test(l)||/^- /.test(l)) return '<li>' + _escHtml(l.slice(2)) + '</li>';
      if (l.trim() === '')  return '<br>';
      return '<p>' + _escHtml(l) + '</p>';
    })
    .join('\n');
}

ipcMain.handle('convert-doc-to-pdf', async (event, { filePath, ext }) => {
  try {
    let html = '';
    const baseName = path.basename(filePath, path.extname(filePath));

    if (ext === 'docx' || ext === 'doc') {
      const mammoth = require('mammoth');
      const res = await mammoth.convertToHtml({ path: filePath });
      html = res.value;

    } else if (ext === 'txt') {
      const text = fs.readFileSync(filePath, 'utf8');
      html = text.split('\n').map(l => '<p style="margin:0;min-height:1.4em">' + _escHtml(l) + '</p>').join('');

    } else if (ext === 'md') {
      html = _mdToHtml(fs.readFileSync(filePath, 'utf8'));

    } else if (ext === 'rtf') {
      // Extraction du texte brut (suppression des codes RTF)
      const raw = fs.readFileSync(filePath, 'utf8');
      const plain = raw
        .replace(/\{\\[^{}]*\}/g, '')
        .replace(/\\[a-z]+\-?\d*\s?/g, ' ')
        .replace(/[{}\\]/g, '')
        .replace(/\r\n|\r/g, '\n');
      html = plain.split('\n').map(l => '<p style="margin:0;min-height:1.4em">' + _escHtml(l.trim()) + '</p>').join('');

    } else if (ext === 'html' || ext === 'htm') {
      html = fs.readFileSync(filePath, 'utf8');
      // HTML complet : utiliser directement
      const tmpHtml = path.join(os.tmpdir(), 'pdfeditor_import_' + Date.now() + '.html');
      fs.writeFileSync(tmpHtml, html, 'utf8');
      const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
      await new Promise((res, rej) => {
        win.webContents.once('did-finish-load', res);
        win.webContents.once('did-fail-load', rej);
        win.loadFile(tmpHtml);
      });
      const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
      win.destroy();
      try { fs.unlinkSync(tmpHtml); } catch {}
      return { data: Buffer.from(pdf).toString('base64'), name: baseName + '.pdf' };

    } else if (ext === 'odt') {
      return { error: 'Format ODT non supporté directement. Exportez en .docx depuis LibreOffice.' };
    } else {
      return { error: 'Format non supporté : ' + ext };
    }

    // Envelopper dans une page HTML complète
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.6;margin:2cm}
      p{margin:0 0 .4em}h1{font-size:2em;margin:.6em 0 .3em}h2{font-size:1.5em;margin:.5em 0 .25em}
      h3{font-size:1.2em;margin:.4em 0 .2em}li{margin:.2em 0}
      table{border-collapse:collapse;width:100%;margin:.5em 0}
      td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}
      img{max-width:100%;height:auto}
    </style></head><body>${html}</body></html>`;

    const tmpHtml = path.join(os.tmpdir(), 'pdfeditor_import_' + Date.now() + '.html');
    fs.writeFileSync(tmpHtml, fullHtml, 'utf8');

    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await new Promise((res, rej) => {
      win.webContents.once('did-finish-load', res);
      win.webContents.once('did-fail-load', (_, code, desc) => rej(new Error(desc)));
      win.loadFile(tmpHtml);
    });
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    win.destroy();
    try { fs.unlinkSync(tmpHtml); } catch {}

    return { data: Buffer.from(pdf).toString('base64'), name: baseName + '.pdf' };
  } catch (e) {
    return { error: e.message };
  }
});

// ─── IPC : Impression ─────────────────────────────────────────────────────────
// On génère un HTML qui rend les pages PDF en canvas via PDF.js, puis appelle
// window.print(). L'impression canvas→HTML fonctionne là où le viewer PDF natif bloque.
ipcMain.handle('print-pdf', async (event, { pdfData }) => {
  const stamp = Date.now();
  const tmpHtml = path.join(os.tmpdir(), `pdfeditor_print_${stamp}.html`);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#666; font-family:sans-serif; }
  #status { color:#fff; padding:12px; font-size:14px; }
  canvas { display:block; margin:12px auto; box-shadow:0 2px 8px rgba(0,0,0,.5); }
  @media print {
    body { background:white; }
    #status { display:none; }
    canvas { margin:0; box-shadow:none; page-break-after:always; width:100% !important; height:auto !important; }
    canvas:last-child { page-break-after:avoid; }
  }
</style>
</head><body>
<div id="status">Chargement du document…</div>
<div id="pages"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
<script>
(async () => {
  try {
    const PDFJS = pdfjsLib;
    PDFJS.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const b64 = '${pdfData}';
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);

    const pdf = await PDFJS.getDocument({ data: arr }).promise;
    const container = document.getElementById('pages');
    document.getElementById('status').textContent =
      'Rendu de ' + pdf.numPages + ' page(s)…';

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 2 }); // 2× pour qualité impression
      const canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      canvas.style.width  = (vp.width  / 2) + 'px';
      canvas.style.height = (vp.height / 2) + 'px';
      container.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      document.getElementById('status').textContent =
        'Page ' + p + '/' + pdf.numPages + ' rendue';
    }

    document.getElementById('status').textContent = '';
    setTimeout(() => window.print(), 300);
  } catch(e) {
    document.getElementById('status').textContent = 'Erreur : ' + e.message;
  }
})();
</script>
</body></html>`;

  fs.writeFileSync(tmpHtml, html, 'utf8');

  // Ouvrir dans le navigateur système (Edge/Chrome) = dialog d'impression complet
  // avec aperçu, marges, taille de papier, etc.
  await shell.openExternal('file:///' + tmpHtml.replace(/\\/g, '/'));

  // Nettoyer après 60s (le navigateur a eu le temps de charger le fichier)
  setTimeout(() => { try { fs.unlinkSync(tmpHtml); } catch {} }, 60000);
  return { ok: true };
});



// ─── IPC : Chiffrement PDF (via QPDF) ────────────────────────────────────────
ipcMain.handle('encrypt-pdf', async (event, { pdfData, userPwd, ownerPwd, bits, permissions }) => {
  const tmpIn  = path.join(os.tmpdir(), 'pdfeditor_enc_in_'  + Date.now() + '.pdf');
  const tmpOut = path.join(os.tmpdir(), 'pdfeditor_enc_out_' + Date.now() + '.pdf');
  const { execFile } = require('child_process');
  try {
    fs.writeFileSync(tmpIn, Buffer.from(pdfData, 'base64'));
    const args = ['--encrypt', userPwd || '', ownerPwd || userPwd || '', String(bits || 256)];
    if (!permissions.print)  args.push('--print=none');
    if (!permissions.copy)   args.push('--extract=n');
    if (!permissions.modify) args.push('--modify=none');
    if (!permissions.annot)  args.push('--annotate=n');
    args.push('--', tmpIn, tmpOut);
    await new Promise((resolve, reject) => {
      execFile('qpdf', args, { timeout: 30000 }, (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      });
    });
    const result = fs.readFileSync(tmpOut).toString('base64');
    return { success: true, data: result };
  } catch (err) {
    const isNotFound = err.message.includes('ENOENT') || err.message.includes('not found');
    return { success: false, error: err.message, notFound: isNotFound };
  } finally {
    try { fs.unlinkSync(tmpIn);  } catch(e) {}
    try { fs.unlinkSync(tmpOut); } catch(e) {}
  }
});

// ─── IPC : Ouvrir image pour signature ───────────────────────────────────────
ipcMain.handle('open-image-for-sig', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Charger une image de signature',
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','svg','gif','webp','bmp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fp  = result.filePaths[0];
  const ext = path.extname(fp).slice(1).toLowerCase();
  return { data: fs.readFileSync(fp).toString('base64'), type: ext === 'png' ? 'png' : 'jpeg', name: path.basename(fp) };
});

// ─── IPC : Traduction IA (OpenAI-compatible) ──────────────────────────────────
ipcMain.handle('ai-translate', async (event, { text, targetLang, apiKey, apiUrl, rawPrompt }) => {
  const url = (apiUrl || 'https://api.openai.com') + '/v1/chat/completions';
  try {
    const content = rawPrompt || (
      'Translate the following text to ' + targetLang + '.\n' +
      'Preserve paragraphs and line breaks. Return only the translation, no commentary.\n\n' + text
    );
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content }],
        max_tokens: 4000, temperature: 0.3
      })
    });
    if (!res.ok) { const t = await res.text().catch(()=>''); throw new Error('API ' + res.status + ': ' + t.slice(0,200)); }
    const data = await res.json();
    return { success: true, result: data.choices[0].message.content };
  } catch(err) { return { success: false, error: err.message }; }
});


// ─── IPC : Chat IA (messages array) ──────────────────────────────────────────
ipcMain.handle('ai-chat', async (event, { messages, apiKey, apiUrl }) => {
  const url = (apiUrl || 'https://api.openai.com') + '/v1/chat/completions';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 2000, temperature: 0.5 })
    });
    if (!res.ok) { const txt = await res.text().catch(()=>''); throw new Error('API ' + res.status + ': ' + txt.slice(0,200)); }
    const data = await res.json();
    return { success: true, result: data.choices[0].message.content };
  } catch(err) { return { success: false, error: err.message }; }
});

// ─── IPC : Sauvegarder une image ─────────────────────────────────────────────
ipcMain.handle('save-image-dialog', async (event, { defaultName }) => {
  return await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer l\'image améliorée',
    defaultPath: defaultName || 'image-amelioree.png',
    filters: [
      { name: 'Image PNG',  extensions: ['png'] },
      { name: 'Image JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'Image WebP', extensions: ['webp'] },
    ]
  });
});

// ─── IPC : Real-ESRGAN via onnxruntime-node (natif, rapide) ─────────────────
let ortNode = null;
try { ortNode = require('onnxruntime-node'); } catch(e) { console.warn('onnxruntime-node non disponible:', e.message); }

let esrganNodeSession = null;
let esrganNodeIsF16   = false;
let esrganNodeScale   = 4;

let espcnNodeSession  = null;

// ── Float16 helpers ──────────────────────────────────────────────────────────
function f32ToF16Array(src) {
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const f = src[i];
    if (isNaN(f))       { out[i] = 0x7e00; continue; }
    if (!isFinite(f))   { out[i] = f > 0 ? 0x7c00 : 0xfc00; continue; }
    const b    = new Uint32Array(new Float32Array([f]).buffer)[0];
    const sign = (b >> 16) & 0x8000;
    const exp  = ((b >> 23) & 0xff) - 127 + 15;
    const man  = (b >> 13) & 0x3ff;
    if (exp <= 0)  { out[i] = sign; continue; }
    if (exp >= 31) { out[i] = sign | 0x7c00; continue; }
    out[i] = sign | (exp << 10) | man;
  }
  return out;
}
function f16ToF32(v) {
  const sign = (v & 0x8000) ? -1 : 1;
  const exp  = (v >> 10) & 0x1f;
  const man  =  v & 0x3ff;
  if (exp === 0)  return sign * Math.pow(2, -14) * (man / 1024);
  if (exp === 31) return man ? NaN : sign * Infinity;
  return sign * Math.pow(2, exp - 15) * (1 + man / 1024);
}
function f16ArrayToF32(src) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = f16ToF32(src[i]);
  return out;
}

async function getEsrganNodeSession(event) {
  // Session déjà en mémoire — retour immédiat
  if (esrganNodeSession) {
    event.sender.send('esrgan-status', 'Modèle déjà en mémoire ✓');
    return esrganNodeSession;
  }
  if (!ortNode) throw new Error('onnxruntime-node non installé');

  const modelPath = path.join(app.getPath('userData'), 'onnx-models', 'realesrgan-x4plus.onnx');
  if (!fs.existsSync(modelPath)) throw new Error('Modèle non téléchargé — utilisez d\'abord "Amélioration IA" pour le télécharger');

  // Premier chargement depuis le cache disque (~30-90s selon le modèle)
  event.sender.send('esrgan-status', 'Chargement du modèle depuis le cache disque…');
  esrganNodeSession = await ortNode.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    interOpNumThreads: 4,
    intraOpNumThreads: 4,
  });

  const inName  = esrganNodeSession.inputNames[0];
  const outName = esrganNodeSession.outputNames[0];

  // Probe pour détecter float16 et scale
  try {
    const t = new ortNode.Tensor('float32', new Float32Array(3), [1,3,1,1]);
    const r = await esrganNodeSession.run({ [inName]: t });
    esrganNodeIsF16 = false;
    esrganNodeScale = r[outName].dims[2] || 4;
  } catch(e) {
    if (e.message && (e.message.includes('float16') || e.message.includes('float 16'))) {
      esrganNodeIsF16 = true;
      try {
        const t16 = new ortNode.Tensor('float16', f32ToF16Array(new Float32Array(3)), [1,3,1,1]);
        const r16 = await esrganNodeSession.run({ [inName]: t16 });
        esrganNodeScale = r16[outName].dims[2] || 4;
      } catch(e2) {
        esrganNodeScale = 4;
      }
    } else {
      throw e;
    }
  }
  event.sender.send('esrgan-status', `Modèle prêt (${esrganNodeIsF16 ? 'fp16' : 'fp32'}, ×${esrganNodeScale})`);
  return esrganNodeSession;
}

// Helper : Buffer BGRA → Float32Array RGB [1,3,H,W]
function bgraToRgbTensor(buf, x, y, tw, th, stride) {
  const data = new Float32Array(3 * th * tw);
  for (let r = 0; r < th; r++) {
    for (let c = 0; c < tw; c++) {
      const si = ((y+r)*stride + (x+c))*4;
      const pi = r*tw + c;
      data[pi]            = buf[si+2] / 255; // R
      data[th*tw + pi]    = buf[si+1] / 255; // G
      data[2*th*tw + pi]  = buf[si]   / 255; // B
    }
  }
  return data;
}

// Helper : Float32Array RGB output → Buffer BGRA
function rgbToBgra(out, dims, dst, dx, dy, dstW) {
  const [, , oh, ow] = dims;
  for (let r = 0; r < oh; r++) {
    for (let c = 0; c < ow; c++) {
      const oi = ((dy+r)*dstW + (dx+c))*4;
      const pi = r*ow + c;
      dst[oi]   = Math.min(255, Math.max(0, out[2*oh*ow+pi]*255+0.5))|0; // B
      dst[oi+1] = Math.min(255, Math.max(0, out[oh*ow+pi]*255+0.5))|0;   // G
      dst[oi+2] = Math.min(255, Math.max(0, out[pi]*255+0.5))|0;         // R
      dst[oi+3] = 255;
    }
  }
}

ipcMain.handle('onnx-enhance-image', async (event, { imageBase64, imageType }) => {
  const session  = await getEsrganNodeSession(event);
  const inName   = session.inputNames[0];
  const outName  = session.outputNames[0];
  const { nativeImage } = require('electron');

  const img    = nativeImage.createFromDataURL(`data:${imageType};base64,${imageBase64}`);
  const { width: w, height: h } = img.getSize();
  const src    = img.getBitmap();     // Buffer BGRA
  const SCALE  = esrganNodeScale;
  const TILE   = 512;
  const outW   = w * SCALE, outH = h * SCALE;
  const dst    = Buffer.alloc(outW * outH * 4, 255);

  const tilesX = Math.ceil(w / TILE), tilesY = Math.ceil(h / TILE);
  let done = 0, total = tilesX * tilesY;

  for (let ty = 0; ty < h; ty += TILE) {
    for (let tx = 0; tx < w; tx += TILE) {
      const tw = Math.min(TILE, w - tx);
      const th = Math.min(TILE, h - ty);

      const buf    = bgraToRgbTensor(src, tx, ty, tw, th, w);
      const tensorData = esrganNodeIsF16 ? f32ToF16Array(buf) : buf;
      const tensorType = esrganNodeIsF16 ? 'float16' : 'float32';
      const tensor = new ortNode.Tensor(tensorType, tensorData, [1, 3, th, tw]);
      const result = await session.run({ [inName]: tensor });
      const rawOut = result[outName].data;
      const out    = esrganNodeIsF16 ? f16ArrayToF32(rawOut) : rawOut;
      const dims   = result[outName].dims;

      rgbToBgra(out, dims, dst, tx*SCALE, ty*SCALE, outW);

      done++;
      event.sender.send('esrgan-progress', Math.round(done / total * 100));
    }
  }

  const resultImg = nativeImage.createFromBuffer(dst, { width: outW, height: outH });
  return resultImg.toPNG().toString('base64');
});

// ─── ESPCN : session + helpers + handler ─────────────────────────────────────

async function getEspcnNodeSession(event) {
  if (espcnNodeSession) {
    event.sender.send('esrgan-status', 'Modèle ESPCN déjà en mémoire ✓');
    return espcnNodeSession;
  }
  if (!ortNode) throw new Error('onnxruntime-node non installé');

  const modelPath = path.join(app.getPath('userData'), 'onnx-models', 'espcn-x4.onnx');
  if (!fs.existsSync(modelPath)) throw new Error('Modèle ESPCN non téléchargé');

  event.sender.send('esrgan-status', 'Chargement du modèle ESPCN…');
  espcnNodeSession = await ortNode.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    interOpNumThreads: 4,
    intraOpNumThreads: 4,
  });
  event.sender.send('esrgan-status', 'Modèle ESPCN prêt ✓');
  return espcnNodeSession;
}

// BGRA buf → Y, Cb, Cr (Float32Array, valeurs 0-1)
function extractYCbCr(buf, w, h) {
  const Y  = new Float32Array(h * w);
  const Cb = new Float32Array(h * w);
  const Cr = new Float32Array(h * w);
  for (let i = 0; i < h * w; i++) {
    const B = buf[i*4]   / 255;
    const G = buf[i*4+1] / 255;
    const R = buf[i*4+2] / 255;
    Y[i]  =  0.299*R + 0.587*G + 0.114*B;
    Cb[i] =  0.5 - 0.168736*R - 0.331264*G + 0.5*B;
    Cr[i] =  0.5 + 0.5*R - 0.418688*G - 0.081312*B;
  }
  return { Y, Cb, Cr };
}

// Interpolation bilinéaire Float32Array srcH×srcW → dstH×dstW
function bilinearUpscale(src, srcW, srcH, dstW, dstH) {
  const dst = new Float32Array(dstH * dstW);
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx = (dx + 0.5) * srcW / dstW - 0.5;
      const sy = (dy + 0.5) * srcH / dstH - 0.5;
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(srcW-1, x0+1);
      const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(srcH-1, y0+1);
      const fx = sx - x0, fy = sy - y0;
      dst[dy*dstW+dx] =
        src[y0*srcW+x0]*(1-fx)*(1-fy) + src[y0*srcW+x1]*fx*(1-fy) +
        src[y1*srcW+x0]*(1-fx)*fy     + src[y1*srcW+x1]*fx*fy;
    }
  }
  return dst;
}

// Y + Cb_up + Cr_up → Buffer BGRA
function yCbCrToBgra(Y, Cb, Cr, w, h) {
  const dst = Buffer.alloc(w * h * 4, 255);
  for (let i = 0; i < h * w; i++) {
    const y  = Math.max(0, Math.min(1, Y[i]));
    const cb = Cb[i] - 0.5;
    const cr = Cr[i] - 0.5;
    const R = Math.max(0, Math.min(1, y + 1.402*cr));
    const G = Math.max(0, Math.min(1, y - 0.344136*cb - 0.714136*cr));
    const B = Math.max(0, Math.min(1, y + 1.772*cb));
    dst[i*4]   = (B*255 + 0.5)|0;
    dst[i*4+1] = (G*255 + 0.5)|0;
    dst[i*4+2] = (R*255 + 0.5)|0;
    dst[i*4+3] = 255;
  }
  return dst;
}

ipcMain.handle('onnx-espcn-enhance', async (event, { imageBase64, imageType }) => {
  const session = await getEspcnNodeSession(event);
  const inName  = session.inputNames[0];
  const outName = session.outputNames[0];
  const { nativeImage } = require('electron');

  const img  = nativeImage.createFromDataURL(`data:${imageType};base64,${imageBase64}`);
  const { width: w, height: h } = img.getSize();
  const src  = img.getBitmap();   // Buffer BGRA
  const TILE = 224;               // dimensions fixes du modèle ESPCN

  // Le facteur d'échelle réel est détecté sur la première tuile (3× pour le modèle ONNX Zoo)
  let SCALE = null, OUT_TILE = null, dstW = null, dstH = null, dst = null;

  const tilesX = Math.ceil(w / TILE), tilesY = Math.ceil(h / TILE);
  let done = 0, total = tilesX * tilesY;

  for (let ty = 0; ty < h; ty += TILE) {
    for (let tx = 0; tx < w; tx += TILE) {
      const tw = Math.min(TILE, w - tx);
      const th = Math.min(TILE, h - ty);

      // Canal Y zero-paddé à 224×224 + sauvegarde BGRA source de la tuile
      const Ypad    = new Float32Array(TILE * TILE);
      const srcTile = new Uint8Array(th * tw * 4);
      for (let r = 0; r < th; r++) {
        for (let c = 0; c < tw; c++) {
          const si = ((ty+r)*w + (tx+c)) * 4;
          const B  = src[si]/255, G = src[si+1]/255, R = src[si+2]/255;
          Ypad[r * TILE + c] = 0.299*R + 0.587*G + 0.114*B;
          const i = r*tw+c;
          srcTile[i*4]   = src[si];
          srcTile[i*4+1] = src[si+1];
          srcTile[i*4+2] = src[si+2];
          srcTile[i*4+3] = 255;
        }
      }

      // Inférence sur 224×224 (dimensions fixes)
      event.sender.send('esrgan-status', `ESPCN tuile ${done+1}/${total}…`);
      const tensor = new ortNode.Tensor('float32', Ypad, [1, 1, TILE, TILE]);
      const result = await session.run({ [inName]: tensor });
      const Yout   = result[outName].data;
      const odims  = result[outName].dims;   // [1,1,OUT_TILE,OUT_TILE]

      // Détecter le facteur d'échelle réel sur la première tuile
      if (SCALE === null) {
        SCALE    = Math.round(odims[2] / TILE);   // 672/224=3 ou 896/224=4
        OUT_TILE = odims[2];                       // largeur réelle de la sortie
        dstW     = w * SCALE;
        dstH     = h * SCALE;
        dst      = Buffer.alloc(dstW * dstH * 4, 255);
        event.sender.send('esrgan-status', `ESPCN facteur ×${SCALE} détecté`);
      }

      // Reconstruction : Y ESPCN (enhanced) + Cb/Cr source (nearest-neighbor) → BGRA
      const outH = th * SCALE, outW = tw * SCALE;
      for (let r = 0; r < outH; r++) {
        const sr = Math.min(th-1, (r / SCALE) | 0);
        for (let c = 0; c < outW; c++) {
          const sc  = Math.min(tw-1, (c / SCALE) | 0);
          const si  = sr*tw+sc;
          const B0  = srcTile[si*4]   / 255;
          const G0  = srcTile[si*4+1] / 255;
          const R0  = srcTile[si*4+2] / 255;
          // Cb, Cr source (BT.601)
          const cb  = -0.168736*R0 - 0.331264*G0 + 0.5*B0;
          const cr  =  0.5*R0 - 0.418688*G0 - 0.081312*B0;
          // Y amélioré par ESPCN (lire dans le buffer OUT_TILE-large)
          const y   = Math.max(0, Math.min(1, Yout[r * OUT_TILE + c]));
          // YCbCr → RGB
          const R   = Math.max(0, Math.min(1, y + 1.402*cr));
          const G   = Math.max(0, Math.min(1, y - 0.344136*cb - 0.714136*cr));
          const B   = Math.max(0, Math.min(1, y + 1.772*cb));
          const oi  = ((ty*SCALE+r)*dstW + (tx*SCALE+c)) * 4;
          dst[oi]   = (B*255+0.5)|0;
          dst[oi+1] = (G*255+0.5)|0;
          dst[oi+2] = (R*255+0.5)|0;
          dst[oi+3] = 255;
        }
      }

      done++;
      event.sender.send('esrgan-progress', Math.round(done / total * 100));
    }
  }

  const resultImg = nativeImage.createFromBuffer(dst, { width: dstW, height: dstH });
  return resultImg.toPNG().toString('base64');
});

// ─── IPC : OpenAI GPT-Image enhance ─────────────────────────────────────────
ipcMain.handle('openai-image-enhance', async (event, { imageBase64, apiKey, prompt }) => {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const boundary    = '----OABoundary' + Date.now().toString(16);
  const CRLF        = '\r\n';

  // Construire le corps multipart (RFC 2046)
  const field = (name, value) => Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`,
    'utf8'
  );

  const body = Buffer.concat([
    field('model',   'gpt-image-1'),
    field('prompt',  prompt),
    field('n',       '1'),
    field('quality', 'high'),
    field('size',    'auto'),
    Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="image"; filename="page.png"${CRLF}` +
      `Content-Type: image/png${CRLF}${CRLF}`,
      'utf8'
    ),
    imageBuffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8'),
  ]);

  // Timer de progression (gpt-image-1 peut prendre 30-90s)
  let elapsed = 0;
  const ticker = setInterval(() => {
    elapsed += 5;
    event.sender.send('esrgan-status', `GPT-Image génère… ${elapsed}s`);
  }, 5000);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/images/edits',
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        clearInterval(ticker);
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          const json = JSON.parse(text);
          if (res.statusCode !== 200) {
            reject(new Error(json.error?.message || 'HTTP ' + res.statusCode + ': ' + text.slice(0,200)));
          } else {
            resolve(json);
          }
        } catch(e) { reject(e); }
      });
    });
    req.setTimeout(150000, () => {        // timeout 150s
      clearInterval(ticker);
      req.destroy(new Error('Timeout OpenAI (150s)'));
    });
    req.on('error', (e) => { clearInterval(ticker); reject(e); });
    req.write(body);
    req.end();
  });
});

// ─── IPC : OpenAI inpainting (suppression filigrane scanné) ──────────────────
ipcMain.handle('openai-image-inpaint', async (event, { imageB64, maskB64, prompt, apiKey }) => {
  // gpt-image-1 : image opaque originale + masque séparé (alpha=0 = zones à reconstruire)
  const imageBuffer = Buffer.from(imageB64, 'base64');
  const maskBuffer  = Buffer.from(maskB64,  'base64');
  const boundary    = '----OAInpaintBoundary' + Date.now().toString(16);
  const CRLF        = '\r\n';

  const textField = (name, value) => Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`,
    'utf8'
  );
  const fileField = (name, filename, data) => Buffer.concat([
    Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}` +
      `Content-Type: image/png${CRLF}${CRLF}`,
      'utf8'
    ),
    data,
    Buffer.from(CRLF, 'utf8'),
  ]);

  const body = Buffer.concat([
    textField('model',   'gpt-image-1'),
    textField('prompt',  prompt),
    textField('n',    '1'),
    textField('size', '1024x1024'),
    fileField('image', 'page.png', imageBuffer),
    fileField('mask',  'mask.png', maskBuffer),
    Buffer.from(`--${boundary}--${CRLF}`, 'utf8'),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/images/edits',
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          const json = JSON.parse(text);
          if (res.statusCode !== 200) {
            reject(new Error(json.error?.message || 'HTTP ' + res.statusCode + ': ' + text.slice(0, 300)));
            return;
          }
          // Résultat : b64_json direct ou URL à télécharger
          const item = json.data?.[0];
          if (!item) { reject(new Error('Réponse IA vide')); return; }
          if (item.b64_json) { resolve({ data: [{ b64_json: item.b64_json }] }); return; }
          // Télécharger l'image depuis l'URL retournée
          https.get(item.url, (imgRes) => {
            const parts = [];
            imgRes.on('data', c => parts.push(c));
            imgRes.on('end', () => {
              resolve({ data: [{ b64_json: Buffer.concat(parts).toString('base64') }] });
            });
          }).on('error', reject);
        } catch(e) { reject(e); }
      });
    });
    req.setTimeout(240000, () => req.destroy(new Error('Timeout OpenAI inpainting (240s)')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
});

// ─── IPC : Modèle ONNX ───────────────────────────────────────────────────────
function getModelsDir() {
  const dir = path.join(app.getPath('userData'), 'onnx-models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('onnx-model-exists', (event, name) => {
  return fs.existsSync(path.join(getModelsDir(), name));
});

ipcMain.handle('onnx-model-path', (event, name) => {
  return path.join(getModelsDir(), name);
});

ipcMain.handle('onnx-download-model', async (event, { url, name }) => {
  const dest = path.join(getModelsDir(), name);
  if (fs.existsSync(dest)) return { ok: true, cached: true };

  const download = (u, redirects = 5) => new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Trop de redirections'));
    const proto = u.startsWith('https') ? https : http;
    proto.get(u, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', chunk => {
        received += chunk.length;
        if (total > 0) event.sender.send('onnx-progress', Math.round(received / total * 100));
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve({ ok: true }); });
      file.on('error', err => { try { fs.unlinkSync(dest); } catch(e) {} reject(err); });
    }).on('error', err => { try { fs.unlinkSync(dest); } catch(e) {} reject(err); });
  });

  return download(url);

});


// ── inflate / deflate pour la suppression de filigranes ──────────────────────
const zlib = require('zlib');

ipcMain.handle('pdf-inflate', async (event, { b64 }) => {
  const buf = Buffer.from(b64, 'base64');
  try {
    return { b64: zlib.inflateSync(buf).toString('base64'), ok: true };
  } catch(_) {
    try {
      return { b64: zlib.inflateRawSync(buf).toString('base64'), ok: true };
    } catch(e) {
      return { b64: null, ok: false, err: e.message };
    }
  }
});

ipcMain.handle('pdf-deflate', async (event, { b64 }) => {
  const buf = Buffer.from(b64, 'base64');
  const out = zlib.deflateSync(buf);
  return { b64: out.toString('base64'), ok: true };
});

// ─────────────────────────────────────────────────────────────────────────────

function getPdfFromArgv(argv) {
  // Dans l'app packagée, argv[0] = exe, argv[1] = chemin du PDF éventuellement
  // On cherche le premier argument non-flag qui se termine par .pdf
  return argv.slice(1).find(a => !a.startsWith('-') && a.toLowerCase().endsWith('.pdf')) || null;
}

// ─── Signal renderer-ready : le renderer prévient main qu'il est initialisé ──
// Cela évite tout timeout arbitraire pour envoyer le fichier au démarrage.
ipcMain.handle('renderer-ready', () => {
  _rendererReady = true;
  _trySendPendingFile();
});

// ─── Single-instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Une instance tourne déjà — on lui passe le fichier et on quitte
  app.quit();
} else {
  // Quand l'utilisateur double-clique sur un PDF alors que l'app tourne déjà
  app.on('second-instance', (event, argv) => {
    const filePath = getPdfFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (filePath) sendFileToRenderer(filePath);
    }
  });

  app.whenReady().then(() => {
    // Mémoriser le fichier AVANT de créer la fenêtre
    pendingFilePath = getPdfFromArgv(process.argv);
    createWindow();
    // Le fichier sera envoyé par le handler renderer-ready ci-dessus,
    // une fois que le renderer aura terminé loadLang() et son initialisation.
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

  // macOS : ouverture via Finder
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.webContents.isLoading()) {
      sendFileToRenderer(filePath);
    } else {
      pendingFilePath = filePath;
    }
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
