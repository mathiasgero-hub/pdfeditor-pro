# Lanceur Windows — ouvrir automatiquement les PDF et les images dans PDFEdit Or (web)

Windows sait confier un fichier à un **programme**, pas à un **site web**. Ce petit lanceur fait le pont :

1. Vous double-cliquez sur un PDF ou une image.
2. Windows lance `PDFEditOrLauncher.exe` avec ce fichier.
3. Le lanceur démarre en arrière-plan (sans fenêtre) et sert le fichier sur **127.0.0.1** (votre ordinateur seulement), avec un secret aléatoire, et **uniquement au site de PDFEdit Or** (l'en-tête `Origin` est vérifié).
4. Il ouvre votre navigateur sur https://pdfedit-or.ardoisia.com/ avec `#ouvrir=PORT:SECRET:ID`. La page récupère le fichier et l'ouvre (`web-launcher.js`), puis **reste à l'écoute du lanceur**.
5. Fichiers suivants : le nouveau lancement transmet le fichier au lanceur déjà en route (canal Windows réservé à votre compte). Si la page est encore ouverte, elle l'ouvre dans **un nouvel onglet de l'éditeur, dans la même page** : pas de nouvel onglet de navigateur. Le navigateur est ramené au premier plan quand c'est possible. Si la page a été fermée, un nouvel onglet s'ouvre.
6. Le lanceur s'arrête seul quelques minutes après la fermeture de la page.

Le fichier ne quitte jamais votre ordinateur. Un PDF s'ouvre dans un onglet ; une image est importée comme avec « Importer » (reconnaissance de texte, puis PDF d'une page). Un document déjà ouvert n'est jamais remplacé.

## Installation (une fois, sans droits administrateur)

1. Double-cliquez sur **`Installer-lanceur.cmd`**. Il compile le lanceur avec le compilateur fourni par Windows, le copie dans `%LOCALAPPDATA%\PDFEditOr-Lanceur\` et le déclare dans « Ouvrir avec » (registre de **votre** compte uniquement).
2. Choisissez-le comme application par défaut (Windows l'impose : un programme ne peut pas le faire à votre place) :
   - clic droit sur un PDF → **Ouvrir avec** → **Choisir une autre application** → **PDFEdit Or (web)** → cochez **Toujours utiliser cette application** → OK ;
   - ou Paramètres Windows → Applications → Applications par défaut → **PDFEdit Or (web)** (l'installeur ouvre cette page) ; refaire pour les images (`.jpg`, `.png`…) si vous le souhaitez.
3. La première fois, Chrome ou Edge peut demander d'**autoriser l'accès au réseau local** pour pdfedit-or.ardoisia.com : acceptez (c'est l'adresse 127.0.0.1 de votre ordinateur).

## Réglages — `%LOCALAPPDATA%\PDFEditOr-Lanceur\lanceur.ini`

| Réglage | Rôle |
|---|---|
| `url` | adresse de l'éditeur (par défaut pdfedit-or.ardoisia.com) |
| `navigateur` | chemin complet du navigateur à utiliser (vide = navigateur par défaut) |
| `port` | port local du lanceur (47650 par défaut ; les 9 suivants si occupé) |
| `inactivite` | secondes sans page ouverte avant l'arrêt du lanceur (300 par défaut) |

## Désinstallation

Double-cliquez sur **`Desinstaller-lanceur.cmd`** : le programme et toutes les entrées de registre sont retirés ; Windows reprend son programme habituel pour les fichiers concernés.

## Limites

- Navigateur : Chrome et Edge (récents) sont visés. Firefox et Safari n'ont pas été essayés.
- Il faut être connecté à Ardoisia dans ce navigateur (la page demande la connexion sinon ; rouvrez le fichier ensuite).
- Un site web ne peut pas être « forcé » au premier plan : le lanceur ramène la fenêtre du navigateur si l'onglet PDFEdit Or est l'onglet affiché ; sinon le fichier s'ouvre dans l'éditeur, mais il faut cliquer sur l'onglet PDFEdit Or du navigateur pour le voir.
- Une seule page PDFEdit Or reçoit les fichiers (la plus récemment à l'écoute) ; si vous en avez deux ouvertes, ce n'est pas prévisible.
- Après une mise à jour du lanceur : relancez `Installer-lanceur.cmd` (fermez d'abord le lanceur éventuellement en cours, il s'arrête seul au bout de quelques minutes).
- Les images et les PDF sont pris en charge ; les autres types (Word…) ne le sont pas.
- Fichiers jusqu'à 250 Mo.

## Pour développeurs

- Source du lanceur : `PDFEditOrLauncher.cs` ; essai sans navigateur : `PDFEditOrLauncher.exe fichier.pdf --no-browser` affiche l'adresse d'ouverture.
- Côté web : `renderer/web-launcher.js` (lit `#ouvrir=PORT:SECRET:ID`, récupère `/m/<secret>/<id>` puis `/f/<secret>/<id>`, puis écoute `/attente/<secret>` en attente longue ; `window.__forceNewTab` évite le dialogue « Ouvrir un document »), `window.__openLocalFile` dans `renderer/web-shim.js`, et `connect-src` de la CSP (`index.html`) qui autorise `http://127.0.0.1:*`.
- `installer.ps1 -Simuler -Dossier C:\temp\essai` compile et copie sans toucher au registre.

## Mise à disposition des utilisateurs (Ardoisia)

- Page publique en français, anglais et indonésien : `lanceur/page/index.html`, publiée sur https://pdfedit-or.ardoisia.com/lanceur/ **sans connexion** (bloc `location ^~ /lanceur/` de la configuration nginx, hors passerelle).
- `PDFEdit-Or-Lanceur.zip` est reconstruit à chaque déploiement par `deploy/ardoisia/build-static.cjs` (fichiers de ce dossier, retours à la ligne Windows) : modifier le lanceur puis redéployer suffit.
- Dans l'éditeur (version Ardoisia), Paramètres → « Ouverture automatique sous Windows » : explications courtes, téléchargement du .zip et lien vers la page.
