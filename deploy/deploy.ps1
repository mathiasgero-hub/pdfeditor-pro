# deploy.ps1 — Déploie PDFEditor Pro sur pdfedit-or.artmonie.com
# Usage : .\deploy\deploy.ps1 [-KeyFile "C:\Users\..\.ssh\id_rsa"]

param(
    [string]$KeyFile = "$env:USERPROFILE\.ssh\id_rsa",
    [string]$Server  = "185.135.137.86",
    [string]$User    = "root",
    [string]$Dest    = "/var/www/pdfedit-or"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Déploiement PDFEditor Pro ===" -ForegroundColor Cyan
Write-Host "Serveur : $User@$Server"
Write-Host "Clef SSH : $KeyFile"
Write-Host "Dossier source : $ProjectRoot\renderer"

# 1. Créer le dossier distant
Write-Host "`n[1/4] Création du dossier distant..." -ForegroundColor Yellow
ssh -i $KeyFile "${User}@${Server}" "mkdir -p $Dest"

# 2. Copier les fichiers renderer (sans node_modules ni fichiers Electron)
Write-Host "[2/4] Envoi des fichiers..." -ForegroundColor Yellow
scp -i $KeyFile -r "$ProjectRoot\renderer\*" "${User}@${Server}:${Dest}/"

# 3. Installer et configurer nginx (si premier déploiement)
Write-Host "[3/4] Configuration nginx..." -ForegroundColor Yellow
scp -i $KeyFile "$ProjectRoot\deploy\nginx-pdfedit.conf" "${User}@${Server}:/etc/nginx/sites-available/pdfedit-or"
ssh -i $KeyFile "${User}@${Server}" @"
    ln -sf /etc/nginx/sites-available/pdfedit-or /etc/nginx/sites-enabled/pdfedit-or 2>/dev/null || true
    nginx -t && systemctl reload nginx
"@

# 4. Obtenir le certificat SSL (certbot)
Write-Host "[4/4] Certificat SSL (Let's Encrypt)..." -ForegroundColor Yellow
ssh -i $KeyFile "${User}@${Server}" @"
    if ! [ -d /etc/letsencrypt/live/pdfedit-or.artmonie.com ]; then
        apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true
        certbot --nginx -d pdfedit-or.artmonie.com --non-interactive --agree-tos -m mathias.gero@gmail.com
    else
        echo 'Certificat déjà présent'
    fi
"@

Write-Host "`n=== Déploiement terminé ! ===" -ForegroundColor Green
Write-Host "Ouvre https://pdfedit-or.artmonie.com" -ForegroundColor Green
