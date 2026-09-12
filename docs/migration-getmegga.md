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

⛔ **CE CHIFFRE ÉTAIT FAUX, corrigé le 09.09.2026 : 814, pas 9 434.** Il conflatait deux
mesures distinctes — « lignes AYANT un `photos_cf` » (9 434) et « lignes POINTANT vers
`img.megga.ch` » (814). Remesuré par hôte : **814** sur l'ancien hôte, et **8 620 avec un
`photos_cf` VIDE (`[]`)**. 🟠 Ces 8 620 sont une anomalie PRÉEXISTANTE, sans rapport avec la
migration : le traitement photo a tourné et n'a rien produit pour 91 % des lignes qu'il a
touchées. À regarder séparément.

Les **814** lignes concernées alimentent le matching CRM. Réécrites avant que
`img.getmegga.com` ne serve le bucket R2, ce sont 814 annonces sans photos — une balise
`<img>` cassée ne lève rien.

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

## 7. Phase D — renvois 301 ✅ FAITE le 09.09.2026

⛔ **L'ORDRE ÉCRIT ICI ÉTAIT LE MAUVAIS, et le corriger a évité une coupure.** Ce plan
disait : retirer d'abord les domaines des projets Pages (D1/D2), *puis* créer les renvois
(D3). Une *Redirect Rule* a besoin d'un enregistrement DNS **proxifié** pour se déclencher —
or détacher un domaine custom Pages emporte le CNAME qui le porte. Dans cet ordre,
`megga.ch` aurait cessé de résoudre **avant** que la règle puisse tirer. Règle d'abord, donc.

✅ **D1/D2 SONT FAITS depuis le 09.09.2026, et la parade tient en une ligne : un
enregistrement porteur.** Ils avaient d'abord été *refusés ici*, à raison — dans l'ordre
D1→D3 la zone serait tombée. Une fois les 301 posées, les détacher devient possible à une
condition : **reposer immédiatement un enregistrement proxifié**, puisque Cloudflare
supprime le CNAME avec le domaine custom.

⛔ **Cloudflare le DIT, et il faut le lire avant de cliquer.** Le dialogue *Remove domain?*
porte la phrase « The CNAME record pointing to your project **will be removed** to make this
change ». Ce n'était donc pas une inférence : c'est écrit, et c'est vrai — mesuré, la zone
est passée de 23 à 22 enregistrements et l'hôte a cessé de résoudre (A et AAAA vides au
serveur autoritatif) **alors que `curl` répondait encore 301**, sur son cache résolveur. ⚠ Un
`curl` qui marche juste après un détachement ne prouve RIEN : il lit un cache dont le TTL
n'a pas expiré. L'oracle est `dig @<ns autoritatif>`, jamais le résolveur du poste.

**Ce qui a été reposé** — un enregistrement dont la seule fonction est de *porter* la règle :

| Nom | Type | Contenu | Proxy |
|---|---|---|---|
| `megga.ch` · `www` · `app` · `img` | `A` | `192.0.2.1` | **Proxied** |

`192.0.2.1` est TEST-NET-1 (RFC 5737), non routable : rien ne peut y aboutir, et c'est le
but. Les règles matchent `http.host eq …`, elles tirent **au bord, avant l'origine** — la
cible de l'enregistrement ne les regarde donc pas, seule sa présence et son proxy comptent.
Mesuré après coup : les quatre hôtes rendent 301 depuis l'IP autoritative fraîche, chemin
**et** query préservés, et l'image servie au bout de la chaîne est identique **octet pour
octet** (même sha256) à celle de l'ancien hôte.

⚠ **Depuis le 11.09.2026, `app` ne fait plus partie de ce tableau** : l'enregistrement et sa
règle 301 ont été supprimés — le CRM n'a plus aucun DNS sur l'ancienne zone. Voir le §8 bis.

⚠ **`help.megga.ch` est un CNAME vers l'apex** : détacher l'apex l'emportait avec lui. C'est
pourquoi l'apex a été reposé en premier. Et `rockwell.megga.ch` pointe vers un **autre**
projet Pages, étranger à cette migration — ne pas y toucher.

| Règle | Correspondance | Action |
|---|---|---|
| `megga.ch` | `http.host eq "megga.ch"` | 301 → `concat("https://getmegga.com", http.request.uri.path)` |
| `www.megga.ch` | `http.host eq "www.megga.ch"` | 301 → `concat("https://getmegga.com", …)` |
| `app.megga.ch` | `http.host eq "app.megga.ch"` | 301 → `concat("https://app.getmegga.com", …)` |
| `help.megga.ch` | *(règle PRÉEXISTANTE, recâblée)* | 301 → `https://getmegga.com/aide` |

⚠ **UNE RÈGLE EXISTAIT DÉJÀ SUR CETTE ZONE, et ce plan l'ignorait** : `help.megga.ch` →
`https://megga.ch/aide`. Laissée telle quelle, elle produisait un **double saut** dès la
première règle posée. Recâblée vers `getmegga.com/aide` (vérifié 200 avant de rebrancher).
🟠 Elle mourra quand même à la libération de la zone : **décider si `help.` doit renaître sur
`getmegga.com`** ou disparaître.

**Trois conditions tenues, chacune mesurée :**
- **301**, jamais 302 — un 302 ne transmet pas le signal de permanence aux moteurs.
- **Chemin ET query préservés** (case « Preserve query string » cochée sur les trois règles
  neuves). Éprouvé sur les trois formes de liens tokenisés réellement en circulation :
  `…/kyc/<jeton>`, `…/visite/:id/modifier?token=…`, `…/accept-invite/<jeton>` — tous
  arrivent avec leur jeton intact.
- **Un seul saut** partout, destination en 200 : mesuré à `curl -L` sur les quatre hôtes.

| # | Geste | Où |
|---|---|---|
| D3 | ✅ Trois règles de redirection créées, la quatrième recâblée | Cloudflare Rules |
| D4 | ✅ **`Site URL` Supabase** : `https://megga.ch` → `https://getmegga.com`. C'est le repli quand aucune redirection ne correspond, ET `{{ .SiteURL }}` des gabarits d'e-mail | Supabase → Auth → URL Configuration |

🖱 **Deux pièges d'interface, mesurés** :
1. ⛔ **Le bouton *Deploy* des Redirect Rules ne réagit PAS à un clic par référence
   d'élément** — aucune erreur, aucune validation rouge, le bouton reste actif et il ne se
   passe rien. Il faut un clic **aux coordonnées**. La première règle a été perdue ainsi, et
   j'ai failli attribuer l'échec à l'ordre des couches Cloudflare : c'était juste le clic.
2. ⚠ **Le gabarit « Redirect to a different domain » se rend sous DEUX formes** selon les
   chargements : *motif joker* (`URI Full wildcard`, cible **Static** avec `${1}`) ou
   *expression* (`http.host eq …`, cible **Dynamic** avec `concat(...)`). La combinaison
   joker + Static + `${1}` **échoue en silence**. La forme expression est celle qui marche.

---

## 8. Phase E — nettoyage, puis libération

> **État au 09.09.2026, après le second passage : E1 à E6 et E8 sont FAITS.
> Restent E7, E9, E10 et les 3 clés `app_config` — chacun sur une condition NOMMÉE,
> aucun sur une impression.** Le 11.09.2026, le DNS du CRM a en outre été retiré de
> l'ancienne zone (§8 bis) : c'est une première tranche d'E10, jouée hôte par hôte.
>
> | | | |
> |---|---|---|
> | **E1** | ✅ `R2_PUBLIC_BASE` → `https://img.getmegga.com` | prouvé par le digest `001be14e…`, sans lire le secret |
> | **E2** | ✅ audit des secrets porteurs de domaine | voir les trois corrections ci-dessous |
> | **E3** | ✅ 814 lignes `photos_cf` réécrites | 0 restant, re-mesuré ce jour |
> | **E4** | ✅ URI `api.megga.ch/auth/v1/callback` retirée, plus les **2 origines JavaScript** de l'ancienne zone que ce plan ne comptait pas ; *Authorized domains* réduits à `getmegga.com` seul | débloqué par la redéclaration du consentement, ci-dessous |
> | **E5** | ✅ allowlist Supabase Auth : **12 → 7 URLs**, plus aucune sur l'ancienne zone | OAuth re-mesuré après coup : « Sign in - Google Accounts », 0 erreur |
> | **E6** | ✅ `img.megga.ch` débranché du bucket R2 | mais **précédé d'une 301**, voir ci-dessous |
> | **E8** | ✅ les 4 exemptions transitoires retirées du code | leur condition écrite était « quand le domaine custom Pages sera détaché » — elle est remplie |
> | **E7** (Mapbox) | ⏸ | **ce n'est pas une étape de migration** : les deux jetons sont aujourd'hui le MÊME, sans restriction. Rien n'y nomme l'ancienne zone, donc rien n'y bloque la libération. Créer un jeton = manipuler une clé d'API : geste de Julien |
> | **E9** (Resend) | ✅ 11.09 | domaine Resend `megga.ch` **supprimé par Julien**, puis ses trois enregistrements DNS (§8 bis). ⚠ **Joué sans la preuve que ce plan exigeait** — un envoi vu livré depuis `getmegga.com` — et c'est une décision, pas un oubli : aucun expéditeur du code ne porte plus l'ancienne zone depuis la phase C, donc garder le domaine ne préservait qu'un retour arrière qui aurait de toute façon exigé un changement de code. ⚠ **Et la base ne peut toujours pas trancher** : `email_delivery_events` compte **0 ligne depuis toujours** (son webhook ne reçoit que les rebonds) et `activity_events` ne trace aucun envoi. L'oracle qui reste est humain : la prochaine alerte « [MEGGA Admin] » reçue par Julien doit venir de `@getmegga.com` |
> | **E10** | ⏸ *partiel* | le DNS du CRM est parti le 11.09 (§8 bis). Le reste (`megga.ch`, `www`, `help`, `img`, l'e-mail) attend la même liste de contrôle, hôte par hôte |
> | `app_config` (3 clés) | ⏸ | gelé sur **A7** : elles portent `tech@megga.ch` en **destinataire**. Basculer avant que `tech@getmegga.com` existe ferait rebondir l'alerting RealAdvisor dans le vide |
>
> ✅ **CE QUI A DÉBLOQUÉ E4, et que ce plan croyait bloquant pour des semaines.** Il disait
> qu'E4 devait attendre parce que le consentement Google déclarait encore des URLs
> `megga.ch` « pour une vérification data access déjà soumise ». Le blocage réel était
> l'inverse — Google l'écrit lui-même dans *Branding verification issues* :
> « **Your home page is behind a login page** » et « the app name … does not match the app
> name on your home page ». C'était le **portail de la vitrine** sur l'ancienne zone, qui
> répondait 401 au relecteur ; le second point n'en était que la conséquence (sans page
> lisible, aucun nom à comparer). `getmegga.com` sortant **sans portail**, les trois URLs
> ont été redéclarées (`/`, `/privacy`, `/terms` — mesurées à 200), et Google a **vérifié
> puis publié le branding dans la minute**. ⚠ Le résultat vérifié **expire en 7 jours s'il
> n'est pas publié** : ne pas quitter l'écran sans cliquer *Publish branding*.
>
> ⚠ **B5 était à moitié fait, et personne ne l'aurait vu.** L'URI `…supabase.co/auth/v1/callback`
> — le filet posé en B0 pour la fenêtre sans domaine custom — avait bien été retirée. Mais
> Google **dérive** les *Authorized domains* des URI et **ne les retire pas** avec elles :
> `eayczugyrvmtqnnmvjod.supabase.co` était resté déclaré comme domaine de MEGGA, alors qu'il
> ne nous appartient pas — exactement ce que B0 s'était juré d'éviter. Retiré.
>
> ⚠ **E6 a été précédé d'une 301, et ce n'était pas prévu ici.** Débrancher `img.` « à froid »
> aurait cassé les images des **e-mails déjà envoyés** — un `<img>` mort ne lève rien. Une
> cinquième Redirect Rule (`img.megga.ch` → `img.getmegga.com`) a donc été posée AVANT.
> Découverte au passage, utile : **une Redirect Rule prend le pas sur un domaine custom R2**
> — mesuré, l'hôte rendait déjà 301 alors qu'il était encore attaché au bucket.
>
> ⛔ **La case « Preserve query string » ne prend pas quand on la coche par référence
> d'élément** — elle s'affiche bleue, elle se déploie, et la règle part **sans** l'option. Le
> même piège que le bouton *Deploy* en phase D, dans l'autre sens : là, l'action ne partait
> pas ; ici elle part *incomplète*, donc en silence. L'oracle est un `curl` avec `?a=1`, pas
> la capture d'écran du formulaire. Cliquer le **libellé**, aux coordonnées.
>
> ✅ **CE QUE E2 A CORRIGÉ DANS CE PLAN :**
> - `IDX_LISTING_BASE_URL` et `APP_URL` **n'existent pas** — ce document demandait de les
>   vérifier ; il n'y avait rien à vérifier.
> - **`R2_PUBLIC_URL` existe et n'était documenté NULLE PART.** Digest confronté : il vaut
>   `https://pub-7720073375be…r2.dev`, l'URL de dev du bucket — **pas** un hôte `megga.ch`,
>   donc rien à migrer. Un secret voisin de `R2_PUBLIC_BASE` qu'un balayage par nom aurait
>   confondu.
> - 🟠 **`MEGGA_KYC_PUBLIC_DOMAIN` est toujours posé** alors que `CLAUDE.md` écrit que son
>   lecteur a été retiré du code. Secret mort — à supprimer, hors migration.


Quand la période de transition est écoulée (les liens tokenisés en circulation ont
expiré, le SEO a suivi).

| # | Geste | Où |
|---|---|---|
| E1 | `R2_PUBLIC_BASE` → `https://img.getmegga.com` | Secrets Supabase |
| E2 | Vérifier `IDX_LISTING_BASE_URL` et `APP_URL` (s'ils sont posés) | Secrets Supabase |
| E3 | Jouer `node scripts/migrate-domaine-getmegga.mjs` (constat), puis `--apply` | base de production |
| E4 | ✅ URI `api.megga.ch/auth/v1/callback` + 2 origines JS + *Authorized domains* | Google Console |
| E5 | ✅ allowlist Supabase Auth ramenée à 7 URLs | Supabase |
| E6 | ✅ `img.megga.ch` débranché du bucket R2, **après** pose de la 301 | Cloudflare R2 |
| E7 | ⏸ Deux jetons Mapbox DISTINCTS, la copie navigateur restreinte à `app.getmegga.com` | Mapbox |
| E8 | ✅ les **quatre** exemptions transitoires retirées | dépôt |
| E8 bis | ⏸ supprimer `scripts/migrate-domaine-getmegga.mjs` — **après** A7 et son rejeu | dépôt |
| E9 | ✅ Domaine Resend `megga.ch` retiré (Julien), puis `send.megga.ch` MX + SPF et `resend._domainkey` supprimés du DNS | Resend + Cloudflare |
| E10 *(tranche CRM)* | ✅ DNS du CRM supprimés : `app.megga.ch` + sa règle, `api.megga.ch`, `_acme-challenge.api` — **après** déplacement de la sonde Sentry (§8 bis) | Cloudflare + Sentry |
| E10 | ⏸ Libérer la zone `megga.ch` pour la holding | Cloudflare |

⚠ **Deux gestes exigent une authentification que seul un humain peut fournir** — constaté
le 09.09.2026 : la Cloud Console demande une **passkey** (biométrie) pour `hello@megga.ai`,
et le tableau de bord Supabase un **code TOTP**. Aucun agent ne peut les franchir. Les
prévoir dans le créneau où quelqu'un est au clavier.

⚠ **E1 avant E3.** `R2_PUBLIC_BASE` gouverne les photos **futures** ; le script
réécrit les **passées**. Inversés, les photos traitées entre les deux repartent sur
l'ancien hôte, et personne ne le voit.

⚠ **E3 avant E6.** Débrancher `img.megga.ch` avant d'avoir réécrit les 814 lignes,
c'est perdre les photos de ces annonces sans le moindre message d'erreur.

⚠ **E8 est joué, et son cliquet a servi le jour même.** `tests/unit/domaine-getmegga.spec.ts`
fait rougir une exemption dont le fichier ne cite plus l'ancien domaine — c'est ce qui a
imposé de les retirer de la liste en même temps que du code.

⛔ **ET IL A ATTRAPÉ MIEUX QUE ÇA.** Les commentaires écrits pour *expliquer le retrait*
nommaient l'ancien hôte — donc les quatre fichiers le mentionnaient encore, et la garde les
a refusés. La tentation était de les réinscrire en exemption « puisque ce n'est que de la
prose » : c'eût été rendre **définitivement aveugles** les quatre fichiers les plus
dangereux du lot, ceux dont l'échec est **fermé et muet**. C'est la prose qui a cédé — elle
dit « l'ANCIENNE zone » et ne l'épelle plus.

✅ **Les exemptions sont désormais DEUX familles**, parce que les fondre était un piège :
`TRANSITOIRES` (ce qui doit disparaître, chaque entrée nommant sa condition de retrait) et
`HISTORIQUES` (ce qui doit rester — `_shared/app-url.ts` cite les anciens hôtes pour
**rapporter une mesure datée du 03.08.2026**). Laisser la seconde dans une liste nommée
« transitoires », avec une date de retrait, invitait le prochain lecteur à effacer un
chiffre daté en croyant solder une migration.

---

## 8 bis. Le DNS du CRM retiré de l'ancienne zone (11.09.2026)

**Supprimés** — la zone passe de 23 à **17** enregistrements, vérifié `dig @<ns autoritatif>` :

| Enregistrement | État avant suppression |
|---|---|
| `api.megga.ch` · CNAME → `eayczugyrvmtqnnmvjod.supabase.co` | **mort depuis la phase B** : `403 error code: 1014` sur tous les chemins — *CNAME Cross-User Banned*, la zone Cloudflare de Supabase ne connaît plus cet hôte |
| `_acme-challenge.api.megga.ch` · TXT | preuve de propriété Supabase de l'ancien domaine custom, sans objet |
| `app.megga.ch` · A `192.0.2.1` + sa règle 301 | porteur de la redirection vers `app.getmegga.com` |
| `send.megga.ch` · MX 10 `feedback-smtp.eu-west-1.amazonses.com` | retour des rebonds de l'envoi Resend — sans objet une fois le domaine Resend supprimé (E9) |
| `send.megga.ch` · TXT `v=spf1 include:amazonses.com ~all` | autorisait tout Amazon SES à envoyer au nom de `send.megga.ch` : le laisser, c'était une surface d'usurpation sans usage |
| `resend._domainkey.megga.ch` · TXT | clé DKIM publique d'un domaine que Resend ne connaît plus |

⚠ **Les trois derniers ont suivi la suppression du domaine dans Resend, jamais l'inverse** —
retirer le DNS d'un domaine encore vérifié l'aurait fait basculer en échec chez Resend. Et ce
qui ne devait PAS bouger n'a pas bougé, vérifié au même serveur : les MX de l'apex
(`mx1`/`mx2.privateemail.com` — la boîte `@megga.ch`, où `tech@megga.ch` reçoit encore les
alertes RealAdvisor), le DMARC, et le SPF de l'apex.

`api.megga.ch` et son `_acme-challenge` n'avaient plus aucune fonction. `app.megga.ch` en avait une, et il n'a été
coupé qu'après **trois oracles** — la liste de contrôle à rejouer pour chaque hôte d'E10 :

**1. Aucun lien client encore valide émis sur l'ancien hôte.** Les liens publics sont bâtis
par `_shared/app-url.ts` sur `MEGGA_APP_URL` (absente), donc sur son repli, passé à
`app.getmegga.com` avec la phase C (merge `4a93bfa8`, **09.09.2026 15:29:27 UTC**). Compté
en production, pour chaque table porteuse de jeton, les lignes créées avant cette heure et
encore actionnables : `kyc_magic_links` (`expires_at > now()`, `expired_at` nul),
`team_invitations` (non réclamées), `buyer_reception_links` (non révoquées), `visits` et
`onboarding_calls` (à venir), `whatsapp_optin_invites` (non consommées) — **0 partout**, et
la plupart de ces tables sont d'ailleurs vides.

**2. Qui frappe encore l'hôte.** Cloudflare → Security → Analytics → *Sampled logs*,
« Items per page » à **100**, puis déplier une ligne pour lire le *User agent*. ⚠ Le plan
gratuit **ne permet pas de filtrer par hôte** (le champ n'existe pas dans le filtre) — il faut
lire l'échantillon. Sur `app.megga.ch` : aucun humain, seulement des robots d'indexation, nos
propres sondes… et une requête **toutes les minutes pile**.

**3. ⛔ Cette requête-là était la seule surveillance du CRM.** User agent
`SentryUptimeBot/1.0` : une sonde d'uptime Sentry (organisation `juarts`, projet `megga`,
moniteur `1596381`), **créée seule par Sentry** le 07.08.2026 (« Created by: Sentry » ; journal
d'audit `uptime_monitor.add`) à partir des hôtes vus dans les événements d'erreur. Rien dans ce
dépôt ne la déclare, et personne ne l'avait déplacée à la migration.
- Sentry **suit les redirections** et juge le code d'ARRIVÉE (assertions `> 199` et `< 300`) :
  une vérification affichée « HTTP 301 » était verte parce que le 200 final passait. Elle
  surveillait donc bien le CRM — par ricochet. Côté Cloudflare, ça se lit : **la même IP frappe
  `app.megga.ch` et `app.getmegga.com` à la même seconde**, une seule série par minute.
- Supprimer l'hôte l'aurait fait tomber en échec DNS : fausse alerte « down », et plus aucune
  surveillance du CRM — sans un rouge nulle part tant que la 301 tenait.
- **Déplacée AVANT la coupure** (URL `https://app.getmegga.com`, environnement `production`,
  alerte e-mail conservée). Bascule prouvée dans *Recent Check-Ins* : **18:41 → 301** sur
  l'ancien hôte, **18:42 → 200** sur le nouveau, puis dix vérifications à 200 d'affilée,
  suppression du DNS comprise. Latence ~200 ms → ~115 ms, sans le détour par la redirection.
- ⚠ L'organisation est au **plan Developer depuis le 31.05.2026 : 1 seule sonde d'uptime**. Il
  fallait donc MODIFIER celle-ci — en créer une seconde aurait été refusé. Et le formulaire
  exige un « Environnement » que la sonde auto-créée n'avait pas.

🖱 **Trois pièges d'interface, mesurés :**
1. ⛔ **Dans la liste des Redirect Rules, le menu d'une ligne se déplace quand la page finit de
   charger** : un clic aux coordonnées a atterri sur *Move down* au lieu de *Delete*. Sans
   effet ici — les règles portent chacune sur un hôte distinct (`http.host eq …`), leur ordre
   est indifférent — mais ce n'est pas une garantie générale. L'oracle est la **boîte de
   confirmation, qui NOMME la règle** : la lire avant de valider.
2. Un clic *par référence d'élément* sur l'entrée *Delete* de ce menu **ne fait rien** — le même
   piège que le bouton *Deploy* de la phase D. Et la page d'édition d'une règle n'a **pas** de
   bouton de suppression : c'est le menu de la liste, aux coordonnées, ou rien.
3. Le compteur « You have used N of 200 » du tableau DNS **retarde** sur la suppression. Il a
   affiché 21 alors que l'hôte ne résolvait déjà plus : l'oracle reste `dig @<ns autoritatif>`.

⚠ **Avant E10, rejouer les trois oracles sur `megga.ch`, `www`, `help` et `img`** — et
regarder aussi l'e-mail : l'apex porte les MX de la boîte `@megga.ch`, et **`tech@megga.ch`
est encore le destinataire des alertes RealAdvisor** (`app_config`, gelé sur A7).

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
