/**
 * web-shim.js — Émulation de window.electronAPI pour le déploiement web.
 * Chargé uniquement si window.electronAPI n'existe pas déjà (hors Electron).
 */
(function () {
  if (window.electronAPI) return; // Déjà fourni par Electron

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function b64toBlob(b64, mime) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function downloadB64(b64, filename) {
    const blob = b64toBlob(b64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function fileInputPickFiles(accept, multiple) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = async () => {
        const files = [];
        for (const f of Array.from(inp.files)) {
          const data = await f.arrayBuffer();
          const bytes = new Uint8Array(data);
          let b64 = '';
          const chunk = 8192;
          for (let i = 0; i < bytes.length; i += chunk) {
            b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          b64 = btoa(b64);
          files.push({ name: f.name, data: b64, filePath: f.name });
        }
        document.body.removeChild(inp);
        resolve(files.length ? files : null);
      };
      inp.oncancel = () => { document.body.removeChild(inp); resolve(null); };
      inp.click();
    });
  }

  function lsGet(key, def) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; } catch { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // Pending save path (simulated)
  let _pendingSaveName = 'document.pdf';

  // Fichier choisi dans openImportDialog, consommé par convertDocToPdf
  let _pendingImport = null;

  const IMAGE_EXTS  = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];
  const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';

  function b64toBytes(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(s);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('Chargement impossible : ' + src));
      document.head.appendChild(s);
    });
  }

  // (Dé)compression via Compression Streams. Tolère les octets parasites après
  // la fin du flux (fréquents dans les PDF) si des données ont déjà été produites.
  async function zStream(bytes, format, compress) {
    const stream = compress ? new CompressionStream(format) : new DecompressionStream(format);
    const writer = stream.writable.getWriter();
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
    } catch (e) {
      if (compress || !total) throw e;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  // Renvoie une image PNG ou JPEG (seuls formats que pdf-lib sait intégrer) ;
  // les autres formats sont convertis en PNG via un canvas.
  async function normalizeImage(b64, ext) {
    const head = b64toBytes(b64.slice(0, 16));
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) {
      return { imageData: b64, imageType: 'png' };
    }
    if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) {
      return { imageData: b64, imageType: 'jpeg' };
    }
    const mime = 'image/' + ({ jpg: 'jpeg', svg: 'svg+xml' }[ext] || ext || 'png');
    const url = URL.createObjectURL(b64toBlob(b64, mime));
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Format d\'image non supporté'));
        i.src = url;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return { imageData: c.toDataURL('image/png').split(',')[1], imageType: 'png' };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Sélection d'une image : renvoie les deux formes de clés utilisées par app.js
  // ({data, type} pour l'insertion / la signature, {imageData, imageType} pour l'OCR).
  async function pickImage() {
    const files = await fileInputPickFiles('image/*', false);
    if (!files) return null;
    const f = files[0];
    const img = await normalizeImage(f.data, f.name.split('.').pop().toLowerCase());
    return { data: img.imageData, type: img.imageType, imageData: img.imageData,
             imageType: img.imageType, imageName: f.name, name: f.name };
  }

  // ─── Google Gemini (mêmes fonctions que main.js côté Electron) ──────────────
  const GEMINI_API         = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const GEMINI_TEXT_MODEL  = 'gemini-3.8-flash';
  const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
  const GEMINI_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

  async function geminiGenerate(model, body, apiKey, timeoutMs) {
    const res = await fetch(GEMINI_API + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = null; }
    if (!res.ok) throw new Error('Gemini ' + res.status + ' : ' + (json?.error?.message || txt.slice(0, 200)));
    if (!json?.candidates?.length) {
      throw new Error('Réponse Gemini vide' + (json?.promptFeedback?.blockReason ? ' (bloquée : ' + json.promptFeedback.blockReason + ')' : ''));
    }
    return json;
  }

  function geminiParts(json) {
    return json.candidates[0].content?.parts || [];
  }

  function geminiText(json) {
    const text = geminiParts(json).filter(p => p.text && !p.thought).map(p => p.text).join('');
    if (!text) throw new Error('Réponse Gemini sans texte (' + (json.candidates[0].finishReason || '?') + ')');
    return text;
  }

  // Messages au format { role: system|user|assistant, content } → format Gemini
  function toGeminiBody(messages) {
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const body = {
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return body;
  }

  // Ratio Gemini le plus proche des dimensions de l'image
  function nearestRatio(w, h) {
    const r = Math.log(w / h);
    return GEMINI_RATIOS.reduce((best, cur) => {
      const [a, b] = cur.split(':').map(Number);
      const [c, d] = best.split(':').map(Number);
      return Math.abs(Math.log(a / b) - r) < Math.abs(Math.log(c / d) - r) ? cur : best;
    });
  }

  // ─── HTML → PDF (texte sélectionnable, via pdf-lib) ─────────────────────────
  // Mise en page simple : titres, paragraphes, gras/italique, listes, tableaux, images.
  async function htmlToPdf(html) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const fonts = {
      r:  await doc.embedFont(StandardFonts.Helvetica),
      b:  await doc.embedFont(StandardFonts.HelveticaBold),
      i:  await doc.embedFont(StandardFonts.HelveticaOblique),
      bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
      m:  await doc.embedFont(StandardFonts.Courier),
    };
    const fontFor = r => r.mono ? fonts.m : fonts[(r.bold ? 'b' : '') + (r.italic ? 'i' : '') || 'r'];

    // Les polices standard n'encodent que WinAnsi : remplacer le reste
    const okChar = new Map();
    function clean(text, font) {
      let out = '';
      for (const ch of text.replace(/ /g, ' ').replace(/\t/g, '    ')) {
        let ok = okChar.get(ch);
        if (ok === undefined) {
          try { font.encodeText(ch); ok = true; } catch { ok = false; }
          okChar.set(ch, ok);
        }
        out += ok ? ch : (/[‐-―]/.test(ch) ? '-' : '?');
      }
      return out;
    }

    const PW = 595.28, PH = 841.89, M = 56, CW = PW - 2 * M;
    let page = doc.addPage([PW, PH]);
    let y = PH - M;
    const newPage = () => { page = doc.addPage([PW, PH]); y = PH - M; };
    const ensure = h => { if (y - h < M && y < PH - M) newPage(); };

    // Découpe des runs en lignes de largeur maxW
    function layout(runs, size, maxW) {
      const lines = [];
      let line = [], w = 0;
      const push = () => { lines.push(line); line = []; w = 0; };
      for (const r of runs) {
        const font = fontFor(r);
        const parts = r.text.split(/(\n|\s+)/);
        for (let p of parts) {
          if (!p) continue;
          if (p === '\n') { push(); continue; }
          if (/^\s+$/.test(p)) { if (line.length) p = ' '; else continue; }
          p = clean(p, font);
          let pw = font.widthOfTextAtSize(p, size);
          if (w + pw > maxW && line.length) {
            push();
            if (p === ' ') continue;
          }
          // Mot plus long que la ligne : coupure caractère par caractère
          while (pw > maxW && p.length > 1) {
            let n = p.length;
            while (n > 1 && font.widthOfTextAtSize(p.slice(0, n), size) > maxW - w) n--;
            line.push({ text: p.slice(0, n), font, x: w });
            push();
            p = p.slice(n);
            pw = font.widthOfTextAtSize(p, size);
          }
          line.push({ text: p, font, x: w });
          w += pw;
        }
      }
      if (line.length) push();
      return lines;
    }

    function drawText(runs, { size = 11, indent = 0, prefix = '', before = 0, after = 6 } = {}) {
      const prefW = prefix ? fonts.r.widthOfTextAtSize(prefix, size) : 0;
      const lines = layout(runs, size, CW - indent - prefW);
      if (!lines.length) return;
      const lh = size * 1.35;
      y -= before;
      lines.forEach((ln, idx) => {
        ensure(lh);
        y -= lh;
        if (idx === 0 && prefix) {
          page.drawText(prefix, { x: M + indent, y, size, font: fonts.r, color: rgb(0, 0, 0) });
        }
        for (const seg of ln) {
          page.drawText(seg.text, { x: M + indent + prefW + seg.x, y, size, font: seg.font, color: rgb(0, 0, 0) });
        }
      });
      y -= after;
    }

    async function drawImage(src) {
      const m = /^data:image\/([\w+.-]+);base64,(.*)$/s.exec(src || '');
      if (!m) return;
      let img;
      try {
        const n = await normalizeImage(m[2], m[1]);
        const bytes = b64toBytes(n.imageData);
        img = n.imageType === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      } catch { return; }
      const scale = Math.min(1, CW / img.width, (PH - 2 * M) / img.height);
      const w = img.width * scale, h = img.height * scale;
      ensure(h + 6);
      y -= h;
      page.drawImage(img, { x: M, y, width: w, height: h });
      y -= 8;
    }

    function drawTable(rows) {
      const cols = Math.max(0, ...rows.map(r => r.length));
      if (!cols) return;
      const colW = CW / cols, pad = 4, size = 10, lh = size * 1.3;
      for (const row of rows) {
        const cells = row.map(runs => layout(runs, size, colW - 2 * pad));
        const h = Math.max(1, ...cells.map(c => c.length)) * lh + 2 * pad;
        ensure(h);
        for (let c = 0; c < cols; c++) {
          const x = M + c * colW;
          page.drawRectangle({ x, y: y - h, width: colW, height: h,
                               borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
          (cells[c] || []).forEach((ln, i) => {
            for (const seg of ln) {
              page.drawText(seg.text, { x: x + pad + seg.x, y: y - pad - (i + 1) * lh + 3,
                                        size, font: seg.font, color: rgb(0, 0, 0) });
            }
          });
        }
        y -= h;
      }
      y -= 8;
    }

    // Collecte des runs inline ; les images deviennent des marqueurs {img}
    function collect(node, style, out) {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { out.push({ ...style, text: ch.nodeValue }); continue; }
        if (ch.nodeType !== 1) continue;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'br') { out.push({ ...style, text: '\n' }); continue; }
        if (tag === 'img') { out.push({ img: ch.getAttribute('src') }); continue; }
        if (tag === 'ul' || tag === 'ol' || tag === 'script' || tag === 'style') continue;
        const s = { ...style };
        if (tag === 'b' || tag === 'strong' || tag === 'th') s.bold = true;
        if (tag === 'i' || tag === 'em') s.italic = true;
        if (tag === 'code') s.mono = true;
        collect(ch, s, out);
      }
      return out;
    }

    async function emitRuns(runs, opts) {
      let buf = [];
      for (const r of runs) {
        if (r.img !== undefined) { drawText(buf, opts); buf = []; await drawImage(r.img); }
        else buf.push(r);
      }
      drawText(buf, opts);
    }

    const HEAD = { h1: 20, h2: 16, h3: 14, h4: 12, h5: 11, h6: 11 };
    const BLOCKS = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'footer', 'body',
      'blockquote', 'pre', 'ul', 'ol', 'table', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure']);

    async function walk(node, indent) {
      let inline = [];
      const flush = async () => {
        if (inline.some(r => r.img !== undefined || (r.text || '').trim())) {
          await emitRuns(inline, { indent });
        }
        inline = [];
      };
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { inline.push({ text: ch.nodeValue }); continue; }
        if (ch.nodeType !== 1) continue;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'title') continue;
        if (!BLOCKS.has(tag)) { collect({ childNodes: [ch] }, {}, inline); continue; }
        await flush();
        if (HEAD[tag]) {
          await emitRuns(collect(ch, { bold: true }, []), { size: HEAD[tag], indent, before: 8, after: 6 });
        } else if (tag === 'p') {
          await emitRuns(collect(ch, {}, []), { indent });
        } else if (tag === 'pre') {
          drawText([{ mono: true, text: ch.textContent }], { size: 9.5, indent });
        } else if (tag === 'blockquote') {
          await walk(ch, indent + 20);
        } else if (tag === 'ul' || tag === 'ol') {
          let n = 0;
          for (const li of ch.children) {
            if (li.tagName.toLowerCase() !== 'li') continue;
            n++;
            await emitRuns(collect(li, {}, []), { indent: indent + 14,
              prefix: tag === 'ol' ? n + '. ' : '• ', after: 3 });
            for (const sub of li.children) {
              const st = sub.tagName.toLowerCase();
              if (st === 'ul' || st === 'ol') await walk({ childNodes: [sub] }, indent + 28);
            }
          }
          y -= 4;
        } else if (tag === 'table') {
          const rows = [...ch.querySelectorAll('tr')]
            .filter(tr => tr.closest('table') === ch)
            .map(tr => [...tr.children].map(td => collect(td, {}, []).filter(r => r.img === undefined)));
          drawTable(rows);
        } else if (tag === 'hr') {
          ensure(12); y -= 6;
          page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
          y -= 6;
        } else {
          await walk(ch, indent);
        }
      }
      await flush();
    }

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    await walk(parsed.body, 0);
    return bytesToB64(await doc.save());
  }

  // ─── OCR Tesseract.js (chargé à la demande) ──────────────────────────────────
  let _tesseractWorker = null;
  async function _getTesseract(lang) {
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    if (!_tesseractWorker) {
      _tesseractWorker = await Tesseract.createWorker(lang || 'fra+eng');
    }
    return _tesseractWorker;
  }

  // ─── API shim ────────────────────────────────────────────────────────────────
  window.electronAPI = {

    // Ouvrir un PDF (file input)
    openPDF: async () => {
      const files = await fileInputPickFiles('.pdf', true);
      if (!files) return null;
      return files.map(f => ({ name: f.name, data: f.data, filePath: f.name }));
    },

    // Ouvrir une image
    openImageDialog: () => pickImage(),

    openImageForSig: () => pickImage(),

    // Import universel (image ou doc)
    openImportDialog: async () => {
      const files = await fileInputPickFiles('.pdf,.docx,.doc,.txt,.md,.html,.htm,.jpg,.jpeg,.png,.webp,.bmp,.gif', false);
      if (!files) return null;
      const f = files[0];
      const ext = f.name.split('.').pop().toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        const img = await normalizeImage(f.data, ext);
        return { type: 'image', imageData: img.imageData, imageType: img.imageType, imageName: f.name };
      }
      _pendingImport = { name: f.name, ext, data: f.data };
      return { type: 'doc', filePath: f.name, ext };
    },

    // Conversion document → PDF (fichier mémorisé par openImportDialog)
    convertDocToPdf: async (filePath, ext) => {
      const f = _pendingImport;
      _pendingImport = null;
      if (!f) return { error: 'Aucun fichier à convertir' };
      const pdfName = f.name.replace(/\.[^.]+$/, '') + '.pdf';
      try {
        if (f.ext === 'pdf') return { name: f.name, data: f.data };
        if (f.ext === 'doc') return { error: 'Format .doc (Word 97-2003) non supporté en mode web — enregistrez-le en .docx' };
        let html;
        if (f.ext === 'docx') {
          await loadScript(MAMMOTH_URL, 'mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer: b64toBytes(f.data).buffer });
          html = result.value;
        } else {
          const text = new TextDecoder('utf-8').decode(b64toBytes(f.data));
          if (f.ext === 'html' || f.ext === 'htm') html = text;
          else html = text.split(/\r?\n/).map(l => '<p>' + escapeHtml(l) + '</p>').join('');
        }
        const data = await htmlToPdf(html);
        return { name: pdfName, data };
      } catch (e) {
        return { error: e.message || String(e) };
      }
    },

    // Dialogue de sauvegarde (simulé — retourne un nom fictif)
    savePDF: async (defaultName) => {
      _pendingSaveName = defaultName || 'document.pdf';
      return { filePath: _pendingSaveName, canceled: false };
    },

    saveImageDialog: async (defaultName) => {
      return { filePath: defaultName || 'image.png', canceled: false };
    },

    // Écrire un fichier → téléchargement navigateur
    writeFile: async (filePath, data) => {
      const fname = (filePath || _pendingSaveName).split(/[\\/]/).pop();
      downloadB64(data, fname);
      return { success: true };
    },

    showInFolder: async () => {},

    // ─── Paramètres (localStorage) ────────────────────────────────────────────
    getSettings: async () => lsGet('pdfeditor_settings', {}),
    saveSettings: async (s) => { lsSet('pdfeditor_settings', s); return { success: true }; },

    // ─── Fichiers récents (localStorage) ─────────────────────────────────────
    getRecentFiles: async () => lsGet('pdfeditor_recent', []),
    addToRecent: async (filePath) => {
      let list = lsGet('pdfeditor_recent', []);
      list = [filePath, ...list.filter(x => x !== filePath)].slice(0, 10);
      lsSet('pdfeditor_recent', list);
    },
    openRecentFile: async () => null, // Pas d'accès FS en web

    // ─── OCR ─────────────────────────────────────────────────────────────────
    ocrFromData: async (imageData, imageType) => {
      try {
        const settings = lsGet('pdfeditor_settings', {});
        const worker = await _getTesseract(settings.lang || 'fra+eng');
        const blob = b64toBlob(imageData, 'image/' + imageType);
        const url = URL.createObjectURL(blob);
        const { data } = await worker.recognize(url);
        URL.revokeObjectURL(url);
        return {
          words: (data.words || []).map(w => ({
            text: w.text, confidence: w.confidence,
            bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }
          })),
          ocrWidth: data.canvas ? data.canvas.width : 0,
          ocrHeight: data.canvas ? data.canvas.height : 0,
        };
      } catch (e) { return { error: e.message }; }
    },

    ocrWithGoogleVision: async (imageData, imageType, apiKey) => {
      try {
        const resp = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ image: { content: imageData },
              features: [{ type: 'TEXT_DETECTION' }] }] }) }
        );
        const json = await resp.json();
        const ann = json.responses?.[0]?.textAnnotations || [];
        const words = ann.slice(1).map(a => {
          const vs = a.boundingPoly?.vertices || [];
          return { text: a.description, confidence: 95,
            bbox: { x0: vs[0]?.x||0, y0: vs[0]?.y||0, x1: vs[2]?.x||0, y1: vs[2]?.y||0 } };
        });
        return { words, ocrWidth: 0, ocrHeight: 0 };
      } catch (e) { return { error: e.message }; }
    },

    onOcrProgress: (cb) => {},

    // ─── IA : traduction et chat (Gemini, fetch direct) ──────────────────────
    aiTranslate: async (text, targetLang, apiKey, rawPrompt) => {
      try {
        const content = rawPrompt || (
          'Translate the following text to ' + targetLang + '.\n' +
          'Preserve paragraphs and line breaks. Return only the translation, no commentary.\n\n' + text);
        const body = toGeminiBody([{ role: 'user', content }]);
        body.generationConfig = { temperature: 0.3 };
        const json = await geminiGenerate(GEMINI_TEXT_MODEL, body, apiKey, 180000);
        return { success: true, result: geminiText(json) };
      } catch (e) { return { success: false, error: e.message }; }
    },

    aiChat: async (messages, apiKey) => {
      try {
        const body = toGeminiBody(messages);
        body.generationConfig = { temperature: 0.5 };
        const json = await geminiGenerate(GEMINI_TEXT_MODEL, body, apiKey, 180000);
        return { success: true, result: geminiText(json) };
      } catch (e) { return { success: false, error: e.message }; }
    },

    // ─── Impression ───────────────────────────────────────────────────────────
    printPDF: async (pdfData) => {
      downloadB64(pdfData, 'print.pdf');
      return { success: true };
    },

    // ─── Chiffrement ──────────────────────────────────────────────────────────
    encryptPDF: async () => ({ success: false, error: 'Non disponible en mode web' }),

    // ─── zlib inflate/deflate ─────────────────────────────────────────────────
    // Même contrat que le main process Electron : { ok, b64 } / { ok:false, err }
    // Les flux PDF FlateDecode sont au format zlib ; repli en raw deflate si en-tête absent.
    pdfInflate: async (b64) => {
      const bytes = b64toBytes(b64);
      try {
        return { ok: true, b64: bytesToB64(await zStream(bytes, 'deflate', false)) };
      } catch (e) {
        try {
          return { ok: true, b64: bytesToB64(await zStream(bytes, 'deflate-raw', false)) };
        } catch (_) {
          return { ok: false, err: e.message };
        }
      }
    },
    pdfDeflate: async (b64) => {
      try {
        return { ok: true, b64: bytesToB64(await zStream(b64toBytes(b64), 'deflate', true)) };
      } catch (e) { return { ok: false, err: e.message }; }
    },

    // ─── ONNX (stubs — modèles lourds non chargés en web) ────────────────────
    onnxModelExists: async () => false,
    onnxModelPath: async () => null,
    onnxDownloadModel: async () => ({ success: false }),
    onOnnxProgress: () => {},
    onnxEnhanceImage: async () => ({ error: 'ONNX non disponible en mode web' }),
    onEsrganProgress: () => {},
    onEsrganStatus: () => {},
    onnxEspcnEnhance: async () => ({ error: 'Non disponible en mode web' }),
    // Édition d'image Gemini — renvoie { b64, mimeType } (lève une erreur sinon)
    aiImageEdit: async (imageB64, width, height, prompt, apiKey, imageSize) => {
      const body = {
        contents: [{ role: 'user', parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageB64 } },
        ] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: nearestRatio(width, height), imageSize: imageSize || '2K' },
        },
      };
      const json = await geminiGenerate(GEMINI_IMAGE_MODEL, body, apiKey, 240000);
      const parts = geminiParts(json);
      const img = parts.map(p => p.inlineData || p.inline_data).find(Boolean);
      if (!img) throw new Error("Gemini n'a pas renvoyé d'image" +
        (parts.some(p => p.text) ? ' : ' + parts.map(p => p.text || '').join(' ').slice(0, 150) : ''));
      return { b64: img.data, mimeType: img.mimeType || img.mime_type || 'image/png' };
    },

    // ─── Listeners (no-op en web) ─────────────────────────────────────────────
    onOpenFile:       () => {},
    onMenuAction:     () => {},
    onCloseRequested: () => {},
    onRecentUpdated:  () => {},
    confirmClose:     () => {},
    rendererReady:    async () => {},
    removeAllListeners: () => {},
    getImageData:     () => pickImage(),
    getStartupLog: async () => [],
  };

  console.log('[web-shim] electronAPI initialisé (mode navigateur)');
})();
