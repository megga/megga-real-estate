# Rockwell Properties — site statique

Site landing déployé sur https://rockwell.megga.ch (Cloudflare Pages, projet `rockwell-megga`).

Déploiement automatique via `.github/workflows/deploy-rockwell.yml` à chaque push sur `main` qui touche `sites/rockwell/**`.

## Protection par mot de passe (HTTP Basic Auth)

Le site est protégé par `functions/_middleware.js` (Cloudflare Pages Functions).

### Activer la protection

Dans le dashboard Cloudflare → Pages → projet `rockwell-megga` → **Settings** → **Environment variables** → **Production**, définir :

| Variable | Valeur |
|---|---|
| `ROCKWELL_AUTH_USER` | identifiant choisi (ex: `rockwell`) |
| `ROCKWELL_AUTH_PASSWORD` | mot de passe long (générer 24+ caractères) |

Cliquer **Save and deploy**. Le site demande désormais ces credentials via le dialog natif du navigateur.

### Désactiver la protection

Soit :
- Supprimer les deux variables ci-dessus depuis le dashboard, OU
- Supprimer `functions/_middleware.js` et redeployer

Si les vars ne sont pas définies, le middleware passe sans bloquer (fallback safe).

### Notes

- Le `Cache-Control: no-store` empêche les caches CDN de garder la réponse 401.
- La comparaison du mot de passe est en temps constant (limite les timing attacks).
- Pour rotation : changer la valeur de `ROCKWELL_AUTH_PASSWORD` et redeployer (ou re-trigger le workflow).
- Pas de session : chaque navigateur cache le credential une fois entré (comportement natif Basic Auth). Pour forcer une re-saisie, fermer le navigateur ou faire un private mode.
