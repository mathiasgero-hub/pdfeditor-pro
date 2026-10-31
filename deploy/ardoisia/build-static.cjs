// Construit la version Ardoisia du site statique : même éditeur, mais non installable (ni manifeste, ni icône d'écran d'accueil,
// ni service worker) et marqué « data-mode="ardoisia » pour que la page utilise le compte Ardoisia au lieu de la connexion Google.
//   node deploy/ardoisia/build-static.cjs <dossier-de-sortie>
const fs = require('fs')
const path = require('path')

const out = process.argv[2]
if (!out) { console.error('Usage : node build-static.cjs <dossier-de-sortie>'); process.exit(1) }
const src = path.join(__dirname, '..', '..', 'renderer')

fs.rmSync(out, { recursive: true, force: true })
fs.cpSync(src, out, { recursive: true })
fs.rmSync(path.join(out, 'manifest.json'), { force: true })
// Icônes de l'onglet (gardées dans assets/ du dépôt)
for (const icon of ['icon.png', 'icon.ico']) {
  const p = path.join(__dirname, '..', '..', 'assets', icon)
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, icon))
}

// Un service worker éventuellement installé par une ancienne version se vide et se désinscrit.
fs.writeFileSync(path.join(out, 'sw.js'),
  "self.addEventListener('install',()=>self.skipWaiting());" +
  "self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.registration.unregister()})()));\n")

const file = path.join(out, 'index.html')
let html = fs.readFileSync(file, 'utf8')
const before = html
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<meta name="(?:theme-color|mobile-web-app-capable|apple-mobile-web-app-[a-z-]+)"[^>]*>\s*/g, '')
  .replace(/<script>\s*if \('serviceWorker' in navigator\) \{[\s\S]*?\n  \}\s*\n/, '<script>\n')
  .replace('<html lang="fr">', '<html lang="fr" data-mode="ardoisia">')
if (html === before) throw new Error('index.html : aucune transformation appliquée (la structure a changé ?)')
if (/rel="manifest"|serviceWorker\.register/.test(html)) throw new Error('index.html : manifeste ou service worker encore présent')
if (!html.includes('data-mode="ardoisia"')) throw new Error('index.html : marqueur de mode absent')
fs.writeFileSync(file, html)
console.log('site statique Ardoisia écrit dans ' + out)
