'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // Ouvrir un PDF via dialogue natif
  openPDF: () => ipcRenderer.invoke('open-pdf-dialog'),

  // Enregistrer un PDF
  savePDF: (defaultName) => ipcRenderer.invoke('save-pdf-dialog', { defaultName }),

  // Ecrire des donnees dans un fichier
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', { filePath, data }),

  // Reveler le fichier dans l'explorateur
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

  // Ecouter les evenements emis par main.js
  onOpenFile:   (callback) => { ipcRenderer.on('open-file',    (_, fileData) => callback(fileData)); },
  onMenuAction: (callback) => { ipcRenderer.on('menu-action',  (_, action)   => callback(action)); },

  // ─── OCR : nouveau flux en 2 etapes ─────────────────────────────────────────

  // Etape 1 : Ouvrir le dialogue image, lire le fichier original (couleurs intactes)
  // Retourne { imageData: base64, imageType, imageName } ou null si annule
  getImageData: () => ipcRenderer.invoke('get-image-data'),

  // Etape 2 : Reconnaitre le texte sur l'image amelioree (envoyee depuis le renderer)
  // Retourne { words, ocrWidth, ocrHeight }
  ocrFromData: (imageData, imageType) => ipcRenderer.invoke('ocr-from-data', { imageData, imageType }),

  // Progression OCR
  onOcrProgress: (callback) => { ipcRenderer.on('ocr-progress', (_, data) => callback(data)); },

  // Retirer les listeners (nettoyage)
  removeAllListeners: (channel) => { ipcRenderer.removeAllListeners(channel); },

  // ─── Parametres OCR ──────────────────────────────────────────────────────────
  openImageDialog: ()       => ipcRenderer.invoke('open-image-dialog'),
  printPDF:  (pdfData)      => ipcRenderer.invoke('print-pdf', { pdfData }),
  getSettings:  ()         => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ─── OCR via Google Cloud Vision API ─────────────────────────────────────────
  // Retourne { words, ocrWidth, ocrHeight }
  ocrWithGoogleVision: (imageData, imageType, apiKey) =>
    ipcRenderer.invoke('ocr-google-vision', { imageData, imageType, apiKey }),

  // ─── Chiffrement ─────────────────────────────────────────────────────────────
  encryptPDF: (opts) => ipcRenderer.invoke('encrypt-pdf', opts),

  // ─── Signature : ouvrir image ────────────────────────────────────────────────
  openImageForSig: () => ipcRenderer.invoke('open-image-for-sig'),

  // ─── Traduction IA ────────────────────────────────────────────────────────────
  aiTranslate: (text, targetLang, apiKey, apiUrl, rawPrompt) =>
    ipcRenderer.invoke('ai-translate', { text, targetLang, apiKey, apiUrl, rawPrompt }),


  // ─── Chat IA ─────────────────────────────────────────────────────────────────
  aiChat: (messages, apiKey, apiUrl) =>
    ipcRenderer.invoke('ai-chat', { messages, apiKey, apiUrl }),

});
