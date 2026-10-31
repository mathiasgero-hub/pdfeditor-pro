#!/usr/bin/env bash
# Déploie PDFEdit Or (version Ardoisia) sur le VPS. À lancer depuis votre PC :  .\deploy\ardoisia\deploy-ardoisia.cmd
# - site statique (renderer/ transformé : ni manifeste, ni service worker) dans /var/www/pdfedit-ardoisia
# - API (server.js, package*.json) dans /home/pdfeditardoisia/app ; jamais .env ni node_modules ; le .env du serveur est conservé
# - installe les dépendances, redémarre le service, vérifie /api/healthz ; en cas d'échec : retour automatique à la version précédente
# L'ancienne instance (pdfedit-or.artmonie.com) n'est jamais touchée.
set -euo pipefail

cd "$(dirname "$0")/../.."
HOST=${DEPLOY_HOST:-fsj-vps}
STAMP=$(date +%Y%m%d-%H%M%S)
TMPDIR_LOCAL=$(mktemp -d)
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

echo "==> Vérification locale (tests)"
(cd web-server && npm ci --no-audit --no-fund >/dev/null 2>&1; node test/ardoisia.mjs >/dev/null 2>&1) || { echo "Les tests du mode Ardoisia échouent : déploiement annulé. Lancez « node test/ardoisia.mjs » dans web-server pour voir pourquoi."; exit 1; }
(cd web-server && node test/api.mjs >/dev/null 2>&1) || { echo "Les tests de l'ancien mode échouent : déploiement annulé."; exit 1; }

echo "==> Contrôle de syntaxe des scripts de la page"
node -e '
const fs = require("fs"), vm = require("vm");
for (const f of ["renderer/app.js", "renderer/web-account.js", "renderer/web-shim.js", "renderer/web-launcher.js"]) new vm.Script(fs.readFileSync(f, "utf8"), { filename: f });
const html = fs.readFileSync("renderer/index.html", "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, n = 0;
while ((m = re.exec(html))) { n++; new vm.Script(m[1], { filename: "index.html#script" + n }); }
console.log("   scripts valides (" + n + " en ligne)");
' || { echo "Erreur de syntaxe dans les scripts : déploiement annulé."; exit 1; }

echo "==> Construction du site statique Ardoisia"
node deploy/ardoisia/build-static.cjs "$TMPDIR_LOCAL/site"
tar czf "$TMPDIR_LOCAL/static.tgz" -C "$TMPDIR_LOCAL/site" .
tar czf "$TMPDIR_LOCAL/api.tgz" -C web-server --exclude=node_modules --exclude='.env*' --exclude=test server.js package.json package-lock.json

echo "==> Envoi vers $HOST"
scp -q "$TMPDIR_LOCAL/static.tgz" "$HOST:/tmp/pdfedit-ardoisia-static-$STAMP.tgz"
scp -q "$TMPDIR_LOCAL/api.tgz" "$HOST:/tmp/pdfedit-ardoisia-api-$STAMP.tgz"

echo "==> Installation sur le serveur"
ssh "$HOST" "bash -s" -- "$STAMP" <<'REMOTE'
set -euo pipefail
STAMP="$1"
APP=/home/pdfeditardoisia/app
NEW=$APP.new
PREV=$APP.prev
SITE=/var/www/pdfedit-ardoisia

[ -f "$APP/.env" ] || { echo "Pas de $APP/.env : lancez d'abord deploy/ardoisia/setup-ardoisia.sh"; exit 1; }

# Site statique : remplacé d'un bloc (ancien site gardé le temps du contrôle)
rm -rf "$SITE.new" "$SITE.prev"; mkdir "$SITE.new"
tar xzf "/tmp/pdfedit-ardoisia-static-$STAMP.tgz" -C "$SITE.new"
chown -R www-data:www-data "$SITE.new"

# API
rm -rf "$NEW"; mkdir "$NEW"
tar xzf "/tmp/pdfedit-ardoisia-api-$STAMP.tgz" -C "$NEW"
cp "$APP/.env" "$NEW/.env"
chown -R pdfeditardoisia:pdfeditardoisia "$NEW"
chmod 600 "$NEW/.env"
(cd "$NEW" && runuser -u pdfeditardoisia -- npm ci --omit=dev --no-audit --no-fund --loglevel=error)

rm -rf "$PREV"
mv "$APP" "$PREV"
mv "$NEW" "$APP"
[ -d "$SITE" ] && mv "$SITE" "$SITE.prev"
mv "$SITE.new" "$SITE"
systemctl restart pdfedit-ardoisia

ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -fsS --max-time 3 http://127.0.0.1:4960/api/healthz >/dev/null 2>&1; then ok=1; break; fi
done
if [ "$ok" -ne 1 ]; then
  echo "ÉCHEC : le service ne répond pas. Retour à la version précédente."
  journalctl -u pdfedit-ardoisia -n 25 --no-pager || true
  rm -rf "$APP"; mv "$PREV" "$APP"
  rm -rf "$SITE"; [ -d "$SITE.prev" ] && mv "$SITE.prev" "$SITE" || mkdir -p "$SITE"
  systemctl restart pdfedit-ardoisia || true
  rm -f /tmp/pdfedit-ardoisia-*-"$STAMP".tgz
  exit 1
fi
rm -f /tmp/pdfedit-ardoisia-*-"$STAMP".tgz
echo "Service pdfedit-ardoisia : en ligne (127.0.0.1:4960). Site statique : $SITE"
REMOTE

echo "==> Terminé."
