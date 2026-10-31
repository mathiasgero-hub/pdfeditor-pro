#!/usr/bin/env bash
# À lancer UNE SEULE FOIS sur le VPS, en root (idempotent : le relancer ne casse rien).
#   - crée l'utilisateur système « pdfeditardoisia » (sans connexion possible) et son dossier
#   - écrit /home/pdfeditardoisia/app/.env : port 4960, MODE ARDOISIA, et les clés COPIÉES SUR PLACE, sans rien afficher :
#       * clés du lycée (GEMINI_API_KEY, GOOGLE_VISION_API_KEY) lues dans l'ancienne instance (/home/pdfedit/app/.env)
#       * clé de l'éditeur (INDIVIDUAL_GEMINI_API_KEY) et secret partagé avec la plateforme (INTERNAL_API_SECRET)
#         lus dans le .env de Je lis seul version Ardoisia (/home/jlsardoisia/app/.env)
#   - installe le service systemd (sans le démarrer), le dossier du site statique et celui des défis Let's Encrypt
# Il ne touche ni à nginx, ni à l'ancienne instance, ni aux autres applications.
set -euo pipefail

APP_USER=pdfeditardoisia
APP_HOME=/home/$APP_USER
APP_DIR=$APP_HOME/app
ENV_FILE=$APP_DIR/.env
OLD_ENV=/home/pdfedit/app/.env
PUBLISHER_ENV=/home/jlsardoisia/app/.env
SITE_DIR=/var/www/pdfedit-ardoisia
UNIT_SRC=${1:-/tmp/pdfedit-ardoisia.service}

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root."; exit 1; }
[ -f "$UNIT_SRC" ] || { echo "Fichier introuvable : $UNIT_SRC (envoyez deploy/ardoisia/pdfedit-ardoisia.service dans /tmp d'abord)."; exit 1; }
[ -x /usr/bin/node ] || { echo "/usr/bin/node est introuvable."; exit 1; }
NODE_MAJOR=$(/usr/bin/node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node $NODE_MAJOR détecté : Node 22 ou plus est requis."; exit 1; }
if ss -ltn | grep -q ':4960 '; then echo "Le port 4960 est déjà utilisé : arrêt."; exit 1; fi

# 1. Utilisateur système
if id "$APP_USER" >/dev/null 2>&1; then
  echo "Utilisateur $APP_USER : déjà présent."
else
  useradd --system --create-home --home-dir "$APP_HOME" --shell /usr/sbin/nologin "$APP_USER"
  echo "Utilisateur $APP_USER : créé."
fi
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# 2. Fichier .env
if [ -f "$ENV_FILE" ]; then
  echo "Fichier $ENV_FILE : déjà présent, laissé tel quel."
else
  umask 077
  {
    echo "PORT=4960"
    echo "BASE_URL=https://pdfedit-or.ardoisia.com"
    echo "ARDOISIA_MODE=1"
    echo "SCHOOL_DOMAIN=frenchschooljakarta.com"
    echo "PORTAL_URL=https://compte.ardoisia.com"
  } > "$ENV_FILE"
  if [ -f "$OLD_ENV" ]; then
    grep -E '^(GEMINI_API_KEY|GOOGLE_VISION_API_KEY)=' "$OLD_ENV" >> "$ENV_FILE" || true
  else
    echo "Ancienne instance introuvable ($OLD_ENV) : aucune clé du lycée copiée."
  fi
  if [ -f "$PUBLISHER_ENV" ]; then
    grep -E '^(INDIVIDUAL_GEMINI_API_KEY|INTERNAL_API_SECRET)=' "$PUBLISHER_ENV" >> "$ENV_FILE" || true
  else
    echo "$PUBLISHER_ENV introuvable : clé de l'éditeur et secret partagé non copiés."
  fi
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Fichier $ENV_FILE : créé (droits 600). Variables présentes (noms seulement) :"
  grep -oE '^[A-Z_]+=' "$ENV_FILE" | tr -d '=' | sed 's/^/  - /'
fi

# 3. Service systemd, site statique, défis Let's Encrypt
cp "$UNIT_SRC" /etc/systemd/system/pdfedit-ardoisia.service
systemctl daemon-reload
systemctl enable pdfedit-ardoisia >/dev/null 2>&1
mkdir -p "$SITE_DIR" /var/www/certbot
chown -R www-data:www-data "$SITE_DIR"
echo "Service pdfedit-ardoisia : installé et activé (non démarré). Site statique : $SITE_DIR"

echo
echo "Étape suivante : envoyer le code avec deploy/ardoisia/deploy-ardoisia.cmd depuis votre PC."
