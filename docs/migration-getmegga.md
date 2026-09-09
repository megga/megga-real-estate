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
>
> ⛔ **LE PIÈGE S'EST PRODUIT POUR DE VRAI, dès la première tentative.** Le navigateur était
> ouvert sur `julien.modelpro@gmail.com`, pas sur `hello@megga.ai` — et **rien à l'écran ne le
> signale** : Search Console affiche la même page d'accueil pour n'importe quel compte. Une
> propriété créée là aurait été « vérifiée » sans rien débloquer, et l'erreur ne se serait vue
> qu'à A5, en constatant que Google refuse toujours le domaine. **Vérifier le compte AVANT
> chaque geste Google** — l'avatar en haut à droite porte l'adresse dans son libellé
> accessible. Le même piège attend à A5 et à E4, qui se font dans la même console.
>
> ⚠ **La voie « automatique » de Google a été écartée volontairement.** Search Console détecte
> Cloudflare et propose de vérifier « en autorisant Google à accéder à votre compte DNS » :
> c'est un octroi OAuth **durable sur toute la zone**, pas sur un enregistrement. La voie
> manuelle (« Any DNS provider » dans le menu déroulant) donne le même résultat sans rien
> accorder. Préférer celle-là.

| # | Geste | Où |
|---|---|---|
| A0 | ✅ **FAIT le 09.09.2026.** Propriété **Domain** `getmegga.com` créée sous `hello@megga.ai`, TXT `google-site-verification=STPKaWUfCIkmKww1NyiaeMrOxUHU8xyRdnSoWRb39Is` posé à la racine, « Ownership verified » (méthode *Domain name provider*) | Search Console + DNS Cloudflare |
| A1 | ✅ **FAIT le 09.09.2026.** `getmegga.com` + `www.getmegga.com` ajoutés au projet Pages `megga-real-estate` (CNAME `@` et `www` → `megga-real-estate.pages.dev`). `megga.ch` / `www.megga.ch` inchangés, toujours *Active* | Cloudflare Pages |
| A2 | ✅ **FAIT le 09.09.2026.** `app.getmegga.com` ajouté au projet Pages `megga-app` (CNAME `app` → `megga-app.pages.dev`). `app.megga.ch` inchangé | Cloudflare Pages |
| A3 | ✅ **FAIT le 09.09.2026.** `img.getmegga.com` ajouté au bucket **`megga-market`** — ⚠ c'est CE bucket qui porte `img.megga.ch`, pas `megga-images` (qui n'a aucun domaine custom). Les deux domaines y sont *Enabled* | Cloudflare R2 |
| A4 | ✅ **FAIT le 09.09.2026** (après déverrouillage 2FA par Julien). **7 → 12 URLs**, en MIROIR EXACT des entrées existantes plutôt qu'en joker `/**` — un joker large aurait élargi la surface au passage. Ajoutées : `getmegga.com/auth/callback`, `www.getmegga.com/auth/callback`, `getmegga.com/reset-password.html`, `app.getmegga.com/auth/callback`, `app.getmegga.com/auth/callback*`. **Rien retiré.** | Supabase → Auth → URL Configuration |
| A5 | ✅ **FAIT le 09.09.2026** (après activation de la 2SV par Julien — Google Cloud l'impose depuis le 04.09.2026). Client **« MEGGA — Supabase Auth (app.megga.ch) »**, `833483825712-vh71…`. Ajoutés SANS RIEN RETIRER : origines JS `https://app.getmegga.com` et `https://getmegga.com` (à côté de `app.megga.ch`, `megga.ch`, `localhost:5173`) ; URI de redirection `https://api.getmegga.com/auth/v1/callback` (à côté de `api.megga.ch/...`) | Google Cloud Console → Credentials |
| A6 | ✅ **FAIT ET VÉRIFIÉ le 09.09.2026.** Resend affiche **Verified** — « Your domain is ready to send emails ». Région **Ireland `eu-west-1`** (lue, pas devinée). Trois enregistrements : `resend._domainkey` TXT (**218 car., la longueur exacte de celui de `megga.ch`**), `send` TXT (SPF), `send` MX (10). Suivi de clics et d'ouverture **désactivé**. ⚠ *Verified* signifie que Resend peut ENVOYER au nom du domaine — pas qu'un e-mail soit arrivé quelque part : rien n'a encore été envoyé, et les boîtes de A7 n'existent pas | Resend + DNS Cloudflare |
| A6 bis | ✅ **FAIT le 09.09.2026.** `_dmarc` TXT = `v=DMARC1; p=none; rua=mailto:dmarc_agg@vali.email`, miroir exact de `megga.ch`. Confirmé sur **trois** résolveurs publics. ⚠ Vérifié AVANT de poser : `vali.email` publie une autorisation de rapport externe en **wildcard** (`*._report._dmarc.vali.email`), donc les rapports pour un domaine NEUF sont acceptés sans démarche — sans elle, ils auraient été refusés en silence | DNS Cloudflare |
| A7 | Créer les boîtes `noreply@`, `hello@`, `legal@`, `privacy@`, `tech@`, `sales@`, `support@`, `security@` | Spacemail — **geste humain** : créer des boîtes, c'est créer des comptes et leur poser des mots de passe |

**Oracle A0** — la propriété est prouvée par le DNS, pas par l'écran de Search Console :

```bash
dig +short TXT getmegga.com @8.8.8.8 | grep google-site-verification
```

⚠ Interroger **`@8.8.8.8`**, le résolveur de Google : c'est celui que Search Console consulte.
Mesuré le 09.09.2026, il rend bien la ligne — et le TXT SPF Spacemail reste intact à côté
(deux TXT coexistent sans conflit ; seuls deux enregistrements **SPF** s'annuleraient).

⚠ Vérifier **dans la console** que la propriété apparaît bien sous `hello@megga.ai`. Un
enregistrement posé pour un autre compte ne débloque pas ce client OAuth — c'est
exactement le cas de `megga.ch`, vérifié par l'ancien compte et inutile ici.

**Oracle A1–A3** — les trois hôtes répondent, et servent bien le même contenu que leurs aînés :

```bash
for h in getmegga.com app.getmegga.com img.getmegga.com; do printf "%-22s " "$h"; curl -s -o /dev/null -w '%{http_code}\n' "https://$h"; done
```

⚠ `img.getmegga.com` répondra **404** à la racine : c'est normal, il n'y a pas
d'objet à la racine du bucket. L'oracle utile est une vraie photo — prendre une URL
dans `photos_cf` et remplacer l'hôte. Mesuré le 09.09.2026 sur
`listings/567cbbc2-…/0-detail.jpg` : **200 · image/jpeg · 170 412 o** sur les DEUX
hôtes, empreintes SHA-256 **identiques**.

⚠ **Un 403 juste après l'ajout est TRANSITOIRE** — le certificat du domaine custom se
provisionne. Mesuré : 403 puis 200 quelques secondes plus tard, sur la même URL. Ne pas
en conclure à une restriction d'accès.

⚠ **Le contenu servi par les anciens et les nouveaux hôtes n'est PAS identique à
l'octet, et c'est normal** : le seul écart mesuré est le script de détection de bots que
**Cloudflare injecte lui-même** (`__CF$cv$params`, `/cdn-cgi/challenge-platform/`),
présent sur la zone `megga.ch` et pas encore sur `getmegga.com`. Notre HTML, lui, est
identique. 🟠 **À aligner avant la phase D** : la nouvelle zone n'a pas la même posture
bot-management que l'ancienne, et personne ne s'en apercevra en regardant les pages.

**Oracle A5** — interroger Google DIRECTEMENT, avec un témoin négatif :

```bash
CID="833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e.apps.googleusercontent.com"
curl -s -L -A 'Mozilla/5.0' \
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=$CID&response_type=code&scope=email%20profile&redirect_uri=<URI encodée>" \
  | grep -qi redirect_uri_mismatch && echo "NON enregistrée" || echo "acceptée"
```

⚠ **Toujours joindre un TÉMOIN NÉGATIF** — une URI qui n'a jamais été enregistrée. Sans
lui, « acceptée » peut simplement vouloir dire que le motif recherché ne correspond à
rien. Mesuré le 09.09.2026 : les deux URIs `api.megga.ch` et `api.getmegga.com` sont
acceptées, et `api.exemple-jamais-enregistre.com` rend bien `redirect_uri_mismatch`.

⚠ La console prévient que « it may take 5 minutes to a few hours for settings to take
effect » — ici l'effet a été immédiat, mais ne pas conclure à un échec avant d'avoir
réessayé.

⚠ Le client s'appelle encore **« MEGGA — Supabase Auth (app.megga.ch) »**. Purement
cosmétique (« This name is only used to identify the client in the console and will not
be shown to end users »), mais à renommer en phase E pour ne pas laisser un repère faux.

✅ **SUIVI DE CLICS ET D'OUVERTURE : DÉSACTIVÉ, ET C'EST UNE DÉCISION** (Julien,
09.09.2026), pas un défaut hérité. Mesuré le même jour : `megga.ch` n'a lui non plus
**aucun sous-domaine de suivi** configuré — sa page invite encore à « Enable tracking
metrics ». Les deux domaines sont donc cohérents. Un pixel d'ouverture sur un produit
compliance-first se décide ; ne pas le réactiver au détour d'un réglage.

⛔ **NE PAS AJOUTER LE QUATRIÈME ENREGISTREMENT QUE RESEND PROPOSE.** Sa page liste une
section **« Enable Receiving »** avec un `MX @ inbound-smtp.<région>.amazonaws.com`,
priorité **0** — donc **sur l'apex, à la même priorité que les MX Spacemail déjà en place**.
L'ajouter éclaterait le courrier ENTRANT entre Spacemail et un inbound Resend qui ne fait
rien. `megga.ch` ne l'a jamais eu. Resend ne distingue pas visuellement ce bloc des trois
autres : il faut le sauter sciemment.

⛔ **LA VALEUR DKIM AFFICHÉE EST TRONQUÉE PAR UNE ELLIPSE DE STYLE** (`p=MIGfMA[…]0GCSqG…`).
La recopier depuis l'écran produit une clé fausse, donc des signatures qui échouent — une
panne qui ne se voit qu'en spam. La valeur BRUTE vit dans l'`aria-label` du bouton *Copy*.
Contrôle : la clé doit finir par `IDAQAB` et faire **218 caractères**, comme celle de
`megga.ch`.

**Oracle A6** — le DKIM et le MAIL FROM sont visibles avant même que Resend ne les valide :

```bash
dig +short TXT resend._domainkey.getmegga.com; dig +short TXT send.getmegga.com; dig +short MX send.getmegga.com
```

⚠ Resend affiche parfois « Verified » sur un enregistrement **inexistant** (constaté
sur `megga.ch`). Le `dig` fait foi, pas l'écran.

---

## 5. Phase B — bascule du domaine custom Supabase

✅ **Prérequis dur levé : A5 est fait le 09.09.2026**, les deux URIs sont acceptées par Google. Voir §3.1.

⛔ **SUPABASE N'OFFRE AUCUNE BASCULE — et c'est LE fait qui gouverne cette phase.** La
section *Custom domains* ne propose que **Docs** et **Delete custom domain** : il n'existe
pas de « changer » ni d'« ajouter à côté ». Le seul chemin est SUPPRIMER puis
RECONFIGURER, donc il y a forcément une fenêtre **sans domaine custom**.

⛔ **Pendant cette fenêtre, GoTrue émet `…supabase.co/auth/v1/callback`** — une URI que
CLAUDE.md a délibérément exclue du client Google. Mesuré le 09.09.2026, juste après la
suppression :

```
redirect_uri=https%3A%2F%2Feayczugyrvmtqnnmvjod.supabase.co%2Fauth%2Fv1%2Fcallback
```

Sans filet, **toute connexion Google échoue** le temps de la fenêtre. D'où B0 : enregistrer
cette URI chez Google AVANT de supprimer, et la retirer après (B5). Vérifié pendant la
fenêtre : Google l'accepte, la connexion tient.

⚠ **Rayon d'impact, mesuré et non supposé** : seule « Se connecter avec Google » dépend du
`redirect_uri`. Le mot de passe et les liens magiques passent par l'API, qui reste joignable
en `.supabase.co` — ni la vitrine ni le CRM n'appellent `api.megga.ch`.

⚠ **B reste un BASCULEMENT.** Il reste néanmoins peu risqué ici : ni la
vitrine (`megga-auth.js`) ni le CRM (`VITE_SUPABASE_URL`) n'appellent `api.megga.ch` — tous deux
passent par l'URL `.supabase.co`. Le domaine custom ne gouverne, en pratique, que le
`redirect_uri` de l'OAuth — et les DEUX valeurs sont désormais enregistrées chez Google, donc la
connexion fonctionne avant comme après la bascule.

| # | Geste | Où |
|---|---|---|
| B0 | ✅ **FAIT** — **FILET** : URI `https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback` enregistrée chez Google **avant** toute suppression | Google Cloud Console |
| B1 | ✅ **FAIT** — `api.megga.ch` supprimé (case « Also remove custom domain add-on » **NON cochée**, sinon impossible d'en configurer un nouveau) | Supabase |
| B2 | ✅ **FAIT** — CNAME `api` → `eayczugyrvmtqnnmvjod.supabase.co`, **DNS only** (proxy DÉSACTIVÉ, Supabase l'exige) | DNS Cloudflare |
| B3 | ✅ **FAIT** — TXT `_acme-challenge.api` → le jeton rendu par Supabase, propagé et vérifié au `dig` | DNS Cloudflare |
| B4 | ✅ **FAIT le 09.09.2026.** ⚠ **Il y a une étape ACTIVATE que ce plan avait manquée** : une fois les enregistrements vérifiés, Supabase n'active PAS tout seul — il affiche « Set up is almost complete. Press *Activate* » et **recommande une fenêtre d'indisponibilité de 20-30 minutes**. Signe avant-coureur utile : `api.getmegga.com` portait déjà un certificat TLS valide (`CN=api.getmegga.com`) alors que GoTrue émettait encore `.supabase.co` — l'ACME était passé, il ne manquait que le clic | Supabase |
| B5 | ✅ **FAIT le 09.09.2026** — URI `.supabase.co` retirée du client Google. Vérifié : elle rend désormais `redirect_uri_mismatch`, et `api.getmegga.com` reste acceptée | Google Cloud Console |

⚠ **L'indisponibilité de 20-30 minutes annoncée par Supabase NE S'EST PAS PRODUITE.** Le
dialogue de confirmation le dit d'ailleurs lui-même : « The Supabase domain will continue
to work too ». Mesuré pendant et après : `.supabase.co` a répondu son 401 habituel sans
interruption. Le chiffre de Supabase couvre le cas général — une app qui coderait
`api.<domaine>` en dur ; ici ni la vitrine ni le CRM ne le font. ⚠ Ne pas en conclure que
l'avertissement est faux : il est faux POUR CETTE ARCHITECTURE, et c'est la phase A qui a
rendu ça vrai.

✅ **Phase B close, vérifiée de bout en bout le 09.09.2026 :**

```
GoTrue émet        redirect_uri=https://api.getmegga.com/auth/v1/callback
Google             api.getmegga.com  → acceptée
                   …supabase.co      → refusée   (filet retiré)
                   témoin négatif    → refusée   (le test n'est pas creux)
API                api.getmegga.com  401 · …supabase.co  401
```

⚠ `api.megga.ch` rend désormais **403** : Supabase ne le reconnaît plus. Attendu, et rien
ne l'appelle — mais son URI reste chez Google jusqu'à E4.

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

## 5 bis. 🖱 Deux pièges d'INTERFACE qui coûtent du temps

Rien à voir avec la migration, tout à voir avec le fait de la conduire dans un navigateur.

0. ⚠ **Le dialogue « Add record » s'ouvre par INTERMITTENCE.** Un clic sur le bouton ne
   l'ouvre pas toujours, et rien ne distingue l'échec du succès à l'écran (cf. point 1).
   Ce qui a fini par marcher de façon fiable : **cliquer d'abord une zone neutre de la page**
   (le titre), *puis* le bouton, puis `find` — jamais deux clics de suite sur le bouton, qui
   l'ouvrent et le referment. Et un `ref` survit mal à un rechargement : en reprendre un frais.
1. ⛔ **Le dialogue « Add record » de Cloudflare est INVISIBLE aux captures d'écran.** Il
   vit dans une couche que la capture ne composite pas : l'écran montre la liste des
   enregistrements pendant que le dialogue est bel et bien ouvert. Conséquence — un clic
   « aux coordonnées lues sur la capture » tape **dans la page du dessous** et referme le
   dialogue. `find` le voit, lui. **Piloter ce dialogue uniquement par références
   d'éléments.**
2. ⚠ **Changer le Type d'un enregistrement VIDE les champs déjà saisis** (et le sélecteur
   retombe parfois sur `A`, d'où un « Enter a valid IPv4 address » sur une valeur de CNAME
   parfaitement correcte). Ordre qui marche : Type d'abord, tout le reste ensuite.
   L'oracle fiable de l'état du formulaire est `get_page_text`, pas la capture.

---

## 6 bis. ⛔ Le `Site URL` de Supabase — que ce document avait MANQUÉ

Découvert en faisant A4 le 09.09.2026 : la page *URL Configuration* ne porte pas qu'une
liste d'autorisations, elle porte aussi un **`Site URL`**, aujourd'hui `https://megga.ch`.

Il fait deux choses, et les deux comptent :

1. C'est le **repli** quand aucune URL de redirection ne correspond ;
2. c'est la variable **`{{ .SiteURL }}` des gabarits d'e-mail** Supabase Auth — donc
   l'adresse que portent les liens de confirmation et de réinitialisation réellement
   envoyés aux agents.

⚠ **Il n'a PAS été changé, volontairement.** Le basculer relève de la phase C/D, pas de la
phase A : le faire avant que le code ne soit déployé enverrait les liens d'authentification
vers le nouveau domaine alors que le reste pointe encore vers l'ancien. C'est un
**basculement**, pas un ajout — la phase A n'en contient aucun.

**À faire au moment de la phase D** : `https://megga.ch` → `https://getmegga.com`.

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

⚠ **Deux gestes exigent une authentification que seul un humain peut fournir** — constaté
le 09.09.2026 : la Cloud Console demande une **passkey** (biométrie) pour `hello@megga.ai`,
et le tableau de bord Supabase un **code TOTP**. Aucun agent ne peut les franchir. Les
prévoir dans le créneau où quelqu'un est au clavier.

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

4. ⛔ **CE POINT ÉTAIT FAUX, corrigé le 09.09.2026.** Il annonçait qu'ajouter Resend
   exigerait de **fusionner** son `include:` avec celui de Spacemail dans un TXT unique,
   « deux enregistrements SPF sur un même nom invalidant la politique entière ». La règle
   sur les doubles SPF est vraie ; son application ici ne l'est pas. Mesuré sur `megga.ch`,
   qui porte le même montage :

   ```
   send.megga.ch  TXT  "v=spf1 include:amazonses.com ~all"
   send.megga.ch  MX   10 feedback-smtp.eu-west-1.amazonses.com
   megga.ch       TXT  "v=spf1 include:spf.privateemail.com … ~all"   ← intact
   ```

   **Resend pose son SPF sur le sous-domaine `send.`, jamais sur la racine.** Il n'y a donc
   aucun conflit avec le SPF Spacemail de `getmegga.com`, et rien à fusionner. La prétention
   venait d'un raisonnement, pas d'une mesure — et le montage réel était sous les yeux depuis
   le premier inventaire.

5. 🟠 **DÉFAUT PRÉEXISTANT, mis au jour par A4 — la réinitialisation de mot de passe.**
   `megga-auth.js` construit **quatre** adresses de retour, une par langue :
   `/reset-password`, `/de/neues-passwort`, `/en/reset-password`, `/it/nuova-password`.
   **Aucune des quatre n'est dans l'allowlist** ; la seule entrée voisine est
   `…/reset-password.html`, avec l'extension. Les quatre fichiers existent bien dans la
   vitrine buildée — c'est donc l'autorisation qui manque, pas la page. Si Supabase exige
   une correspondance exacte, la réinitialisation retombe sur le `Site URL`, c'est-à-dire
   la racine du site, **dans les quatre langues**.
   ⚠ L'entrée existante a été **mirée à l'identique** (`getmegga.com/reset-password.html`)
   plutôt que « corrigée » en passant : réparer ça change le comportement de
   l'authentification en production, et c'est un arbitrage, pas un geste de migration.
