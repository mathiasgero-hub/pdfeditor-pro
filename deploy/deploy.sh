#!/usr/bin/env bash
# Déploiement de pdfedit-or.artmonie.com sur fsj-vps : éditeur (fichiers statiques) + serveur d'API (web-server).
# Usage (Git Bash, depuis n'importe où) : bash deploy/deploy.sh
# Pensez à incrémenter CACHE_NAME dans renderer/sw.js si le front a changé.
# Ne touche jamais au .env du serveur (clés du lycée, secrets).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=fsj-vps

(cd web-server && npm ci --no-audit --no-fund >/dev/null && npm test)

TMP=$(mktemp -d)
tar czf "$TMP/static.tgz" -C renderer .
tar czf "$TMP/api.tgz" -C web-server --exclude=node_modules --exclude='.env*' --exclude=test server.js package.json package-lock.json
scp "$TMP/static.tgz" "$TMP/api.tgz" "$HOST:/tmp/"
rm -rf "$TMP"

ssh "$HOST" 'set -e
  # Éditeur : fichiers statiques servis par nginx
  tar xzf /tmp/static.tgz -C /var/www/pdfedit-or
  chown -R www-data:www-data /var/www/pdfedit-or
  # API : serveur Node
  tar xzf /tmp/api.tgz -C /home/pdfedit/app
  chown -R pdfedit:pdfedit /home/pdfedit/app
  sudo -u pdfedit npm ci --omit=dev --no-audit --no-fund --prefix /home/pdfedit/app
  rm -f /tmp/static.tgz /tmp/api.tgz
  systemctl restart pdfedit-api
  sleep 1
  systemctl is-active pdfedit-api
  curl -fsS http://127.0.0.1:4950/api/healthz && echo'
