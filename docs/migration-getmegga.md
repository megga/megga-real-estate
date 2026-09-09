# Migration `megga.ch` → `getmegga.com`

> Décidée le 09.09.2026 (Julien). Le produit passe sur `getmegga.com` ; `megga.ch`
> est ensuite libérée pour devenir le domaine de la **holding**.
>
> Ce document est le **plan d'exécution**, pas un compte rendu. Chaque phase porte
> son oracle de vérification et ce qui casse si on la saute. Les phases A, B, D et E
> se jouent **hors du dépôt** — seule la phase C est du code.

---

## 1. État mesuré au départ (09.09.2026)

| Hôte | Rôle réel | Vérifié |
|---|---|---|
| `megga.ch` | vitrine statique + **login/signup du CRM** + worker `/api/geo` | 200 |
| `app.megga.ch` | CRM React, projet Pages `megga-app` | 200 |
| `api.megga.ch` | domaine custom Supabase → CNAME `eayczugyrvmtqnnmvjod.supabase.co` | vivant |
| `img.megga.ch` | photos R2 | vivant |
| `send.megga.ch` | MAIL FROM Resend/SES `eu-west-1` + DKIM `resend._domainkey.megga.ch` | vivant |
| `admin.megga.ch` | **retiré le 28.07.2026**, aucun DNS | mort |

`getmegga.com` est **déjà sur Cloudflare** (mêmes serveurs de noms `vicente` /
`lindsey` que `megga.ch`), porte déjà des MX Spacemail et un SPF Spacemail, et
**ne sert aucun A/CNAME** : la zone est prête, rien n'y est branché.

⚠ **Le CRM n'a pas de page de connexion à lui.** `ProtectedRoute` fait un
`window.location.replace()` vers la vitrine. La vitrine et le CRM ne peuvent donc
pas migrer séparément.

---

## 2. Topologie cible

```
getmegga.com          → vitrine + /login /signup   (projet Pages megga-real-estate)
app.getmegga.com      → CRM React                  (projet Pages megga-app)
api.getmegga.com      → Supabase (GoTrue, PostgREST)
img.getmegga.com      → photos R2
send.getmegga.com     → MAIL FROM Resend
```

---

## 3. Les trois contraintes d'ordre

Elles ne sont pas des préférences : chacune vient d'une mesure, et chacune produit
une panne **muette** si on l'ignore.

### 3.1 L'URI Google doit être enregistrée AVANT la bascule du domaine custom

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' \
  'https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.megga.ch%2Fauth%2Fcallback'
```

Mesuré le 09.09.2026 : appelé sur l'URL **`.supabase.co`**, GoTrue répond quand même
`redirect_uri=https%3A%2F%2Fapi.megga.ch%2Fauth%2Fv1%2Fcallback`.

⛔ **Le domaine custom gouverne l'OAuth GLOBALEMENT.** L'URL `.supabase.co` est un
filet pour l'**API**, pas pour l'**OAuth** : le jour où le domaine custom devient
`api.getmegga.com`, *toutes* les connexions Google émettent la nouvelle URI, quel que
soit l'endpoint appelé. Si elle n'est pas déclarée chez Google, la connexion Google
tombe pour tout le monde, immédiatement, en `redirect_uri_mismatch`.

### 3.2 Les liens sortants ne doivent basculer qu'une fois le nouvel hôte servi

`supabase/functions/_shared/app-url.ts` porte le repli de **tous** les liens publics
(KYC, visites, invitations d'équipe, rendez-vous d'accueil, rendu PDF, images
d'e-mail). Déployer son nouveau repli avant que `app.getmegga.com` ne serve le CRM
enverrait des liens vers un hôte sans DNS — et un bouton d'e-mail mort ne lève
aucune erreur nulle part.

### 3.3 Les données en base basculent en DERNIER

Mesuré : **9 434 lignes** de `market_listings.photos_cf` portent des URLs
`img.megga.ch`, et elles alimentent le matching CRM. Réécrites avant que
`img.getmegga.com` ne serve le bucket R2, ce sont 9 434 annonces sans photos — une
balise `<img>` cassée ne lève rien.

C'est pourquoi la bascule des données est un **exécutable** (`scripts/migrate-domaine-getmegga.mjs`)
et non une migration : une migration de `supabase/migrations/` s'applique au prochain
merge, sans qu'on choisisse le moment.

---

## 4. Phase A — préparation *additive* (rien ne casse)

Tout ici s'ajoute à côté de l'existant. `megga.ch` continue de servir normalement.

> ⛔ **A0 EST LE PREMIER DOMINO, ET IL PREND DU TEMPS.** Le client OAuth appartient au
> compte **`hello@megga.ai`** (projet Google « My First Project », `tribal-dispatch-504619-c1`).
> Google inscrit d'office le domaine de chaque URI de redirection comme *Authorized domain*
> du consentement — et **refuse un domaine non vérifié comme possédé**. Mesuré le
> 09.09.2026 : `dig TXT getmegga.com` ne rend **aucun** `google-site-verification`, là où
> `megga.ch` en porte deux (émis par l'**ancien** compte, auquel `hello@megga.ai` n'a aucun
> accès — ils ne servent donc à rien ici).
>
> **Sans A0, A5 est impossible ; sans A5, B casse la connexion Google pour tout le monde.**

| # | Geste | Où |
|---|---|---|
| A0 | **Vérifier la propriété de `getmegga.com` dans Google Search Console, connecté en `hello@megga.ai`** (et non un autre compte), puis poser l'enregistrement TXT `google-site-verification` rendu | Search Console + DNS Cloudflare |
| A1 | Ajouter `getmegga.com` **et** `www.getmegga.com` comme domaines personnalisés du projet Pages `megga-real-estate` | Cloudflare Pages |
| A2 | Ajouter `app.getmegga.com` comme domaine personnalisé du projet Pages `megga-app` | Cloudflare Pages |
| A3 | Ajouter `img.getmegga.com` comme domaine personnalisé du bucket R2 (R2 en accepte plusieurs — **garder `img.megga.ch` branché**) | Cloudflare R2 |
| A4 | Ajouter à l'allowlist Supabase Auth : `https://app.getmegga.com/**` et `https://getmegga.com/**`. **Ne rien retirer.** | Supabase → Auth → URL Configuration |
| A5 | Ajouter chez Google l'URI `https://api.getmegga.com/auth/v1/callback` **à côté** de l'ancienne, et `getmegga.com` aux *Authorized domains* | Google Cloud Console → Credentials |
| A6 | Créer le domaine `getmegga.com` dans Resend et poser DKIM + `send.getmegga.com` | Resend + DNS Cloudflare |
| A7 | Créer les boîtes `noreply@`, `hello@`, `legal@`, `privacy@`, `tech@`, `sales@`, `support@`, `security@` sur `getmegga.com` | Spacemail |

**Oracle A0** — la propriété est prouvée par le DNS, pas par l'écran de Search Console :

```bash
dig +short TXT getmegga.com | grep google-site-verification
```

⚠ Vérifier **dans la console** que la propriété apparaît bien sous `hello@megga.ai`. Un
enregistrement posé pour un autre compte ne débloque pas ce client OAuth — c'est
exactement le cas de `megga.ch`, vérifié par l'ancien compte et inutile ici.

**Oracle A1–A3** — les trois hôtes répondent, et servent bien le même contenu que leurs aînés :

```bash
for h in getmegga.com app.getmegga.com img.getmegga.com; do printf "%-22s " "$h"; curl -s -o /dev/null -w '%{http_code}\n' "https://$h"; done
```

⚠ `img.getmegga.com` répondra **404** à la racine : c'est normal, il n'y a pas
d'objet à la racine du bucket. L'oracle utile est une vraie photo — prendre une URL
dans `photos_cf` et remplacer l'hôte.

**Oracle A6** — le DKIM et le MAIL FROM sont visibles avant même que Resend ne les valide :

```bash
dig +short TXT resend._domainkey.getmegga.com; dig +short TXT send.getmegga.com; dig +short MX send.getmegga.com
```

⚠ Resend affiche parfois « Verified » sur un enregistrement **inexistant** (constaté
sur `megga.ch`). Le `dig` fait foi, pas l'écran.

---

## 5. Phase B — bascule du domaine custom Supabase

**Prérequis dur : A5 est fait.** Voir §3.1.

| # | Geste | Où |
|---|---|---|
| B1 | Changer le domaine custom du projet : `api.megga.ch` → `api.getmegga.com` | Supabase → Settings → Custom Domains |
| B2 | Laisser le CNAME `api.megga.ch` en place pour l'instant | DNS Cloudflare |

**Oracle** — la nouvelle URI sort, et Google l'accepte :

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' 'https://api.getmegga.com/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.getmegga.com%2Fauth%2Fcallback'
```

Puis **suivre l'URL rendue dans un navigateur** : une page « Sign in – Google
Accounts » *sans* `redirect_uri_mismatch`, `invalid_client` ni `unauthorized_client`
prouve que le couple client + URI est accepté. Un `%{redirect_url}` correct ne le
prouve pas — il ne dit que ce que *nous* envoyons.

---

## 6. Phase C — le code (cette PR)

Fait dans le dépôt, déployé par le merge sur `main` :

- **809 occurrences** réécrites dans **221 fichiers** (dont 195 portent désormais `getmegga.com`).
- Repli de `_shared/app-url.ts` → `https://app.getmegga.com`.
- `ProtectedRoute`, `VITRINE_URL`, `VITRINE_LOGIN_URL`, `geoLanguage`, `consents` → `getmegga.com`.
- Expéditeurs Resend → `noreply@getmegga.com`, `security@getmegga.com`.
- `deploy-app.yml` : `CUSTOM_DOMAIN` / `ZONE_NAME`.
- Quatre listes blanches **transitoires**, qui admettent les deux domaines : le CORS
  `/api/geo` du worker vitrine, `ALLOWED_ORIGINS` d'`extract-lead`,
  `tracePropagationTargets` de Sentry, l'assertion d'`edge-no-html-response`.
- Garde neuve : `tests/unit/domaine-getmegga.spec.ts`.

⚠ **Ce qui n'a PAS été réécrit, et c'est un choix** : `supabase/migrations/`
(appliquées — réécrire une migration partie en production fait diverger le dépôt de
la base), `docs/superpowers/plans/` et `specs/`, `docs/CHANGELOG.md`, `docs/handoff/`,
`docs/audits/`. Ces fichiers racontent une époque où `megga.ch` **était** l'adresse.
C'était vrai ; ça doit le rester.

⚠ `admin.megga.ch` est conservé partout : c'est un hôte **retiré**, pas un hôte qui
bouge. Le réécrire inventerait un domaine qui n'a jamais existé.

**Oracle** — après le déploiement :

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://app.getmegga.com/dashboard
```

et, dans le navigateur, une connexion complète depuis `getmegga.com/login` jusqu'au
`/dashboard`, en Google **et** en mot de passe. C'est le seul oracle du handoff de
session entre les deux origines.

---

## 7. Phase D — renvois 301 depuis les anciens hôtes

À faire **après** que la phase C est en production et vérifiée.

| # | Geste | Où |
|---|---|---|
| D1 | Retirer `megga.ch` / `www.megga.ch` des domaines du projet Pages `megga-real-estate` | Cloudflare Pages |
| D2 | Retirer `app.megga.ch` du projet Pages `megga-app` | Cloudflare Pages |
| D3 | Créer deux *Redirect Rules* sur la zone `megga.ch` : `megga.ch/*` → `https://getmegga.com/$1` et `app.megga.ch/*` → `https://app.getmegga.com/$1`, en **301**, en préservant chemin ET query | Cloudflare Rules |

⛔ **Le chemin et la query doivent survivre au renvoi.** Les liens déjà en
circulation portent leur capacité *dans l'URL* : `/visite/:id/modifier?token=…`,
`/kyc/:token`, `/accept-invite/:token`. Un 301 vers la racine les tue tous.

**Oracle** — un lien tokenisé réel survit au renvoi :

```bash
curl -s -o /dev/null -w '%{http_code} → %{redirect_url}\n' 'https://app.megga.ch/visite/abc/modifier?token=zzz'
```

Attendu : `301 → https://app.getmegga.com/visite/abc/modifier?token=zzz` — jeton compris.

---

## 8. Phase E — nettoyage, puis libération

Quand la période de transition est écoulée (les liens tokenisés en circulation ont
expiré, le SEO a suivi).

| # | Geste | Où |
|---|---|---|
| E1 | `R2_PUBLIC_BASE` → `https://img.getmegga.com` | Secrets Supabase |
| E2 | Vérifier `IDX_LISTING_BASE_URL` et `APP_URL` (s'ils sont posés) | Secrets Supabase |
| E3 | Jouer `node scripts/migrate-domaine-getmegga.mjs` (constat), puis `--apply` | base de production |
| E4 | Retirer l'ancienne URI `api.megga.ch/auth/v1/callback` chez Google, et `megga.ch` des *Authorized domains* | Google Console |
| E5 | Retirer `https://app.megga.ch/**` et `https://megga.ch/**` de l'allowlist Supabase Auth | Supabase |
| E6 | Débrancher `img.megga.ch` du bucket R2 | Cloudflare R2 |
| E7 | Restreindre `VITE_MAPBOX_TOKEN` à `app.getmegga.com` | Mapbox |
| E8 | Retirer les **quatre** exemptions transitoires du code, et supprimer `scripts/migrate-domaine-getmegga.mjs` | dépôt |
| E9 | Retirer le domaine Resend `megga.ch` | Resend |
| E10 | Libérer la zone `megga.ch` pour la holding | Cloudflare |

⚠ **E1 avant E3.** `R2_PUBLIC_BASE` gouverne les photos **futures** ; le script
réécrit les **passées**. Inversés, les photos traitées entre les deux repartent sur
l'ancien hôte, et personne ne le voit.

⚠ **E3 avant E6.** Débrancher `img.megga.ch` avant d'avoir réécrit les 9 434 lignes,
c'est perdre les photos de ces annonces sans le moindre message d'erreur.

⚠ **E8 est le vrai marqueur de fin.** `tests/unit/domaine-getmegga.spec.ts` porte un
cliquet : il fait **rougir** une exemption dont le fichier ne cite plus l'ancien
domaine. Tant que les quatre exemptions sont là, la migration n'est pas close.

---

## 9. `MEGGA_APP_URL` : ne pas « réparer » son absence

Ce secret n'est **posé nulle part**, et c'est la bonne configuration — son repli en
dur *est* la valeur qui sert. Il est passé de `https://app.megga.ch` à
`https://app.getmegga.com` dans cette PR.

Le poser n'ajoute aucune capacité, seulement deux façons de casser les liens : une
faute de frappe, ou le plan archivé `docs/superpowers/plans/2026-06-02-whatsapp-kyc-report-pdf.md`
qui donne la **vitrine** en exemple — la suivre remplacerait une panne visible par
une panne qui ressemble à un site vivant.

---

## 10. `megga.ai` n'est PAS migré, et c'est volontaire

`megga.ai` apparaît **20 fois** dans le dépôt et n'a pas été touché : ce n'est pas un
domaine de produit, c'est le **compte qui possède** le projet Google Cloud — le client
OAuth « Se connecter avec Google » **et** le compte de service de l'agenda d'accueil
(`GOOGLE_WORKSPACE_SA_KEY`). Aucun utilisateur ne l'atteint : il ne sert ni page, ni lien,
ni expéditeur.

⚠ **Une seule surface le rend visible** : l'écran de consentement Google affiche le nom de
l'app et son adresse de support. Puisqu'on touche déjà cet écran en A5 et E4, autant y
jeter un œil au passage.

⚠ Et le fait qu'il ne se voie pas ne le rend pas sans effet : c'est parce que le client vit
sur `hello@megga.ai` que **A0 doit être fait depuis CE compte**, et pas un autre.

---

## 11. Points restés OUVERTS

1. **Qui est le responsable de traitement après la scission ?** `docs/compliance/`
   (registre des traitements, DPIA, désignation DPO) porte désormais
   `privacy@getmegga.com` et `legal@getmegga.com`. Mais si `megga.ch` devient la
   **holding**, l'entité juridique responsable au sens de la LPD peut changer — et
   ça, aucun `sed` ne le décide. À trancher avec le conseil juridique.

2. **La messagerie n'a jamais tourné.** `MAIL_OAUTH_ORIGINS` ne porte plus que
   `https://app.getmegga.com`, volontairement : aucune boîte n'a jamais été connectée
   (0 ligne dans `mail_accounts`), donc il n'y a rien à ménager. C'est la **nouvelle**
   URI, `https://app.getmegga.com/oauth/mail/callback`, qu'il faut déclarer chez
   Google et dans l'inscription Entra ID — jamais l'ancienne.

3. **La vérification Google *data access* était bloquée par un 401 sur `megga.ch`**
   (portail de la vitrine), qui rendait la page d'accueil déclarée inaccessible au
   relecteur. Si `getmegga.com` sort sans portail, ce blocage tombe de lui-même — mais
   il faut alors **redéclarer la page d'accueil** dans l'écran de consentement.

4. **`getmegga.com` porte déjà un SPF Spacemail.** Y ajouter Resend demande de
   **fusionner** les deux `include:` dans un enregistrement TXT unique : deux
   enregistrements SPF sur un même nom invalident la politique entière.
