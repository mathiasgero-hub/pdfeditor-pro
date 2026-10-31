# PDFEdit Or — version Ardoisia (pdfedit-or.ardoisia.com)

Deuxième instance du même éditeur, en **mode Ardoisia** (`ARDOISIA_MODE=1`) : la connexion Google interne et les clés personnelles disparaissent, l'identité vient de la plateforme, les fonctions IA consomment des crédits. L'instance actuelle (`pdfedit-or.artmonie.com`) n'est pas touchée.

| Élément | Valeur |
|---|---|
| Adresse | https://pdfedit-or.ardoisia.com |
| Utilisateur système / dossier API | `pdfeditardoisia` / `/home/pdfeditardoisia/app` |
| Service systemd / port local | `pdfedit-ardoisia` / `127.0.0.1:4960` |
| Site statique | `/var/www/pdfedit-ardoisia` (servi par nginx) |
| nginx | `/etc/nginx/sites-available/pdfedit-ardoisia` |
| Certificat | `/etc/letsencrypt/live/pdfedit-or.ardoisia.com/` (méthode webroot) |

Qui paie quoi : compte du lycée → clés du lycée (Gemini et Vision), jamais débité ; abonné individuel et crédits offerts → clé Gemini de l'éditeur, débité avant chaque appel et remboursé si Google échoue (pas de Vision : l'OCR intégré Tesseract est gratuit) ; autre établissement → SES clés (coffre de la plateforme) ; **accès limité** → l'éditeur et l'OCR intégré fonctionnent, les fonctions IA sont refusées.

Tarifs (réglables dans le `.env` de la plateforme) : traduction / résumé / chat : 1,5 crédit par tranche de 4 000 caractères envoyés (`PRICE_PDF_TEXT`) ; amélioration d'image par IA : 40 crédits (`PRICE_PDF_IMAGE`).

La version Ardoisia n'est **pas installable** : ni manifeste, ni service worker (le site statique est construit par `deploy/ardoisia/build-static.cjs`).

## Ordre des opérations
Fenêtre **PC** = `PS C:\...>` · fenêtre **VPS** = `root@vmi3566471:~#`.

### A. Mettre à jour la plateforme (obligatoire AVANT l'application : nouveaux tarifs `pdf_text` / `pdf_image`)
PC, dossier `ardoisia` : `.\deploy\deploy.cmd`

### B. Installer l'instance
1. PC, dossier `C:\Dev\pdfeditor-pro` :
   `scp deploy/ardoisia/pdfedit-ardoisia.service deploy/ardoisia/setup-ardoisia.sh fsj-vps:/tmp/`
2. VPS : `bash /tmp/setup-ardoisia.sh` (clés copiées sur place, seuls les NOMS des variables sont affichés).
3. PC : `.\deploy\ardoisia\deploy-ardoisia.cmd` (tests, envoi, installation, démarrage, retour automatique en cas d'échec).

### C. Certificat puis nginx
1. VPS : `certbot certonly --webroot -w /var/www/certbot -d pdfedit-or.ardoisia.com`
2. PC : `scp deploy/ardoisia/nginx-pdfedit-or.ardoisia.com.conf fsj-vps:/tmp/`
3. VPS, avec retour automatique :

```bash
cp /tmp/nginx-pdfedit-or.ardoisia.com.conf /etc/nginx/sites-available/pdfedit-ardoisia && ln -sf /etc/nginx/sites-available/pdfedit-ardoisia /etc/nginx/sites-enabled/pdfedit-ardoisia && nginx -t && systemctl reload nginx && echo "=== NGINX RECHARGÉ ===" || { echo "=== ERREUR : retour arrière ==="; rm -f /etc/nginx/sites-enabled/pdfedit-ardoisia; nginx -t && systemctl reload nginx; echo "=== BLOC RETIRÉ ==="; }
```

### D. Ouvrir l'application dans le portail
Dans `ardoisia/apps.json`, passer `"status": "soon"` à `"available"` pour `pdfedit`, puis `.\deploy\deploy.cmd` (dossier `ardoisia`).

### E. Vérifier
- Visiteur déconnecté → redirigé vers la connexion d'Ardoisia ; après connexion, retour sur l'éditeur.
- Compte à crédits : ⚙ Paramètres → « Compte Ardoisia » affiche le solde et les tarifs ; une traduction fait baisser le solde ; aucune fenêtre de clés.
- Accès limité (école de test suspendue) : l'éditeur s'ouvre, la traduction est refusée avec un message clair, l'OCR intégré fonctionne.
- `https://pdfedit-or.ardoisia.com/manifest.json` → 404 ; aucune invite « installer l'application ».

## Retour arrière
```bash
rm -f /etc/nginx/sites-enabled/pdfedit-ardoisia && nginx -t && systemctl reload nginx
systemctl stop pdfedit-ardoisia
```

## Mises à jour du code
`.\deploy\ardoisia\deploy-ardoisia.cmd` depuis `C:\Dev\pdfeditor-pro`. Le `.env` du serveur n'est jamais écrasé.
