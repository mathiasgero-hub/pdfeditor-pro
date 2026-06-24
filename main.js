'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  960,
    minHeight: 600,
    title: 'PDFEditor',
    backgroundColor: '#111C1C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

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
      { role: 'about', label: 'A propos de PDFEditor' }, { type: 'separator' },
      { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' }
    ]}] : []),
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',           accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu-action', 'new') },
      { label: 'Ouvrir un PDF...', accelerator: 'CmdOrCtrl+O', click: handleOpenFile },
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
      { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' },
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


// ─── IPC : Paramètres (stockés dans userData) ─────────────────────────────────
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'pdfeditor-settings.json');
}

ipcMain.handle('get-settings', () => {
  try { return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); }
  catch { return {}; }
});

ipcMain.handle('save-settings', (event, settings) => {
  try { fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2)); return { success: true }; }
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

// ─── IPC : Impression ─────────────────────────────────────────────────────────
ipcMain.handle('print-pdf', async (event, { pdfData }) => {
  const tmpPath = path.join(os.tmpdir(), 'pdfeditor_print_' + Date.now() + '.pdf');
  fs.writeFileSync(tmpPath, Buffer.from(pdfData, 'base64'));
  await shell.openPath(tmpPath);
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

// ─── Cycle de vie Electron ────────────────────────────────────────────────────

// Extraire un chemin PDF depuis argv (ignore les flags Electron internes)
function getPdfFromArgv(argv) {
  return argv.slice(1).find(a => !a.startsWith('-') && a.toLowerCase().endsWith('.pdf')) || null;
}

// Single-instance : si l'app est déjà ouverte et qu'on double-clique un PDF,
// on transmet le fichier à la fenêtre existante au lieu d'en ouvrir une nouvelle.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const filePath = getPdfFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (filePath) sendFileToRenderer(filePath);
    }
  });

  app.whenReady().then(() => {
    createWindow();
    // Fichier passé en argument au premier lancement (double-clic depuis Explorer)
    const filePath = getPdfFromArgv(process.argv);
    if (filePath) {
      // Attendre que le renderer soit prêt avant d'envoyer le fichier
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => sendFileToRenderer(filePath), 300);
      });
    }
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

  // Mac : ouvrir un fichier via le Finder (open-file event)
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => sendFileToRenderer(filePath), 300);
      });
      if (!mainWindow.webContents.isLoading()) sendFileToRenderer(filePath);
    }
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
