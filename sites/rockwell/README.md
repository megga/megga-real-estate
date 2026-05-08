# Rockwell Properties — site statique

Site landing déployé sur https://rockwell.megga.ch (Cloudflare Pages, projet `rockwell-megga`).

Déploiement automatique via `.github/workflows/deploy-rockwell.yml` à chaque push sur `main` qui touche `sites/rockwell/**`.

## Protection par mot de passe (page custom)

Le site est protégé par `functions/_middleware.js` (Cloudflare Pages Functions).
Au lieu du dialog HTTP natif du navigateur, une **page custom** est servie : champ unique « Mot de passe » + bouton « Entrer ». Cookie 30 jours `rockwell_auth` (HttpOnly, Secure, SameSite=Lax) après authentification.

### Activer la protection

Dans le dashboard Cloudflare → Pages → projet `rockwell-megga` → **Settings** → **Environment variables** → **Production**, définir :

| Variable | Valeur |
|---|---|
| `ROCKWELL_AUTH_PASSWORD` | mot de passe long (24+ caractères, générer aléatoirement) |

Cliquer **Save and deploy**. Le site demande désormais ce mot de passe via la page custom.

### Désactiver la protection

Soit :
- Supprimer la variable ci-dessus depuis le dashboard, OU
- Supprimer `functions/_middleware.js` et redeployer

Si la var n'est pas définie, le middleware passe sans bloquer (fallback safe).

### Notes

- Cookie : `rockwell_auth` (hash SHA-256 du mot de passe), durée 30 jours.
- Pour rotation : changer la valeur de `ROCKWELL_AUTH_PASSWORD` et redeployer (les anciens cookies deviennent invalides automatiquement, hash différent).
- Pour forcer une re-saisie immédiate sur tous les appareils : changer le mot de passe.
- `Cache-Control: no-store` partout pour éviter le cache CDN sur les réponses sensibles.
- `X-Robots-Tag: noindex, nofollow` sur la page de gate.
- Comparaison du mot de passe en temps constant (limite les timing attacks).
