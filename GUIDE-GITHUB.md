# Guide — Publier PDFEditor Pro sur GitHub

## Etape 1 : Creer un compte GitHub (si pas encore fait)
1. Aller sur https://github.com/signup
2. Creer un compte gratuit

## Etape 2 : Creer un depot (repository)
1. Connecte-toi sur https://github.com
2. Cliquer le bouton vert "New" (ou + en haut a droite)
3. Nom du depot : `pdfeditor-pro`
4. Visibilite : **Public** (necessaire pour les releases gratuites)
   OU **Private** si tu veux que seul toi puisses voir le code
5. Cliquer "Create repository"

## Etape 3 : Uploader les fichiers
### Option A — Via le site GitHub (sans ligne de commande)
1. Sur la page de ton depot vide, cliquer "uploading an existing file"
2. Glisser-deposer TOUS les fichiers du dossier PDFEditor-App
   (main.js, preload.js, package.json, renderer/, assets/, .github/)
3. Cliquer "Commit changes"

### Option B — Via Git (plus rapide si tu as Git installe)
```
git init
git add .
git commit -m "Version initiale"
git remote add origin https://github.com/TON-COMPTE/pdfeditor-pro.git
git push -u origin main
```

## Etape 4 : Declencher le premier build
1. Dans ton depot GitHub, aller sur "Releases" (colonne droite)
2. Cliquer "Create a new release"
3. Dans "Choose a tag", taper `v1.0.0` et cliquer "Create new tag"
4. Titre : `PDFEditor Pro v1.0.0`
5. Description : notes de version (optionnel)
6. Cliquer "Publish release"

GitHub Actions va maintenant :
- Lancer 3 machines en parallele (Windows, Mac, Linux)
- Compiler l'application sur chacune
- Attacher les fichiers a ta release automatiquement

Duree : environ 10-15 minutes.

## Etape 5 : Partager
Une fois le build termine, ta page de release ressemble a :
  https://github.com/TON-COMPTE/pdfeditor-pro/releases/latest

Les utilisateurs y trouvent :
  - PDFEditor Pro Setup.exe    (Windows — installeur)
  - PDFEditor Pro.exe          (Windows — portable)
  - PDFEditor Pro.dmg          (Mac)
  - PDFEditor Pro.AppImage     (Linux)

Envoie simplement ce lien a tes utilisateurs.

## Pour les mises a jour
A chaque nouvelle version :
1. Modifier le code
2. Creer un nouveau tag : `v1.1.0`, `v1.2.0`, etc.
3. GitHub rebuild et publie automatiquement les nouveaux installeurs

---
Les utilisateurs existants peuvent revenir sur la meme URL pour
telecharger la derniere version.
