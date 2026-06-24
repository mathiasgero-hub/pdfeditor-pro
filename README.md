# PDFEditor — Éditeur PDF Art Nouveau

Application de bureau Electron pour éditer, annoter, sécuriser et convertir des fichiers PDF.  
Interface inspirée de l'Art Nouveau : typographies Cinzel, palette vitrail, ornements botaniques SVG.

## Fonctionnalités

- Ouvrir et lire des PDFs (rendu PDF.js)
- Menus complets : Édition, Pages, Révision, Sécurité, IA, Outils, Conformité
- Panneau IA : résumé, traduction, OCR, chat avec le document
- Sécurité : chiffrement AES-256, signatures numériques, biffure permanente
- Conformité : PDF/A, PDF/X, PDF/E, PDF/UA, Numérotation Bates

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/VOTRE_USERNAME/pdf-editor.git
cd pdf-editor

# Installer les dépendances
npm install

# Lancer en mode développement
npm start
```

## Build — Créer un installeur

```bash
# Windows (.exe)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.AppImage)
npm run build:linux
```

Les fichiers de distribution seront générés dans le dossier `dist/`.

## Structure du projet

```
pdf-editor/
├── main.js          # Processus principal Electron (Node.js)
├── preload.js       # Bridge sécurisé IPC
├── package.json     # Config et dépendances
├── .gitignore
├── renderer/
│   ├── index.html   # Interface utilisateur
│   ├── styles.css   # Charte Art Nouveau
│   └── app.js       # Logique frontend + intégration Electron
└── assets/          # Icônes de l'application (à ajouter)
    ├── icon.ico     # Windows
    ├── icon.icns    # macOS
    └── icon.png     # Linux
```

## Technologies

- [Electron](https://www.electronjs.org/) v28
- [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) — rendu PDF
- [Font Awesome](https://fontawesome.com/) — icônes
- [Google Fonts](https://fonts.google.com/) — Cinzel Decorative, Cormorant Garamond

## Licence

MIT
