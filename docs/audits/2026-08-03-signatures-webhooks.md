# Audit — vérification de signature des webhooks

**Date :** 3 août 2026 · **Périmètre :** `stripe-webhook`, `esign-webhook`, `whatsapp-webhook`, `log-auth-event`
**Nature :** rapport seul — aucun correctif écrit, aucune donnée modifiée.

---

## 1. Pourquoi ces quatre fonctions

`verify_jwt = false` est posé sur les 68 edge functions (`supabase/config.toml`). Pour ces
quatre-là, il n'existe **aucun garde `_shared`** en amont : ni `require-agent-auth`, ni
`require-super-admin`, ni `require-service-secret`. La signature *est* le contrôle d'accès.
Ce qu'elles touchent quand elle cède :

| Fonction | Écrit dans | Conséquence d'un contournement |
|---|---|---|
| `stripe-webhook` | `subscriptions`, `agencies`, `activity_events`, `agency_related_persons` | État de facturation + statut de vérification d'identité KYB |
| `esign-webhook` | `signature_requests` (+ archivage document signé) | État de signature électronique d'un acte |
| `whatsapp-webhook` | `whatsapp_messages`, puis **`whatsapp-actions.ts`** | Pipeline, envoi de lien KYC, e-mail client, publication portails, **suppression de contact** |
| `log-auth-event` | `auth_events` | Journal d'audit d'authentification (relu par l'export DSAR) |

## 2. Méthode

Chaque fonction est passée aux six critères, en lisant l'**ordre réel des instructions** —
pas l'intention déclarée en commentaire. Le critère qui décide de tout est le premier :
si un client `service_role` existe avant que la signature soit tranchée, tout ce qui suit
est décoratif.

Les implémentations partagées ont été lues à la source, pas supposées :
`verifyHmac` ([whatsapp-gateway.ts:128](../../supabase/functions/_shared/whatsapp-gateway.ts))
et `timingSafeEqual` ([esign-gateway.ts:118](../../supabase/functions/_shared/esign-gateway.ts)).

---

## 3. Matrice — les six critères

✅ présent · ⚠ partiel · ❌ absent · — sans objet

| Critère | `stripe-webhook` | `esign-webhook` | `whatsapp-webhook` | `log-auth-event` |
|---|---|---|---|---|
| Signature **avant** parse et écriture | ✅ L178→184→192 | ⚠ lecture DB **avant** le jeton (L70) | ✅ L50→64→75→79→81 | ❌ aucun contrôle |
| Comparaison en temps constant | ✅ (stripe-node) | ✅ L77 | ✅ POST · ❌ **GET L41 (`===`)** | — |
| Fenêtre horodatée / anti-rejeu | ✅ `t=` + 300 s | ❌ jeton statique, jamais expiré | ❌ absente (mitigée par dédup) | ❌ |
| Corps **brut** pour le HMAC | ✅ `req.text()` L178 | — (corps non fait confiance) | ✅ `rawBody` L50 | — |
| Échec sans mutation d'état | ✅ 400 avant le client | ✅ 401 L78 | ✅ 401/500 avant le client | ✅ |
| Idempotence au rejeu | ⚠ état oui, **audit non** | ✅ L88-91 + claim atomique | ✅ upsert `ignoreDuplicates` L137 | ❌ |

### Ce qui est fait correctement — et mérite d'être conservé tel quel

Les trois webhooks signés **créent le client `service_role` après** la vérification.
C'est la propriété d'ordre qui compte le plus, et elle est correcte partout. Trois points
au-dessus de la moyenne :

- `stripe-webhook` passe la chaîne brute à `constructEventAsync` (L184) — jamais un objet
  re-sérialisé. Le commentaire du `catch` final (L516-519) démontre que l'ordre a été
  pensé, pas subi.
- `esign-webhook` **ne fait pas confiance au corps du callback** : il re-interroge le
  statut officiel chez le provider (L109-113). Un corps forgé ne peut donc rien affirmer.
  C'est ce choix qui fait retomber la sévérité du §4.3 de haute à moyenne.
- `log-auth-event` hache l'IP avec un sel quotidien tournant (L57-65) : conception nLPD
  soignée. Le problème n'est pas la crypto, c'est la porte ouverte.

---

## 4. Constats, par exploitabilité décroissante

### 4.1 — `log-auth-event` : écriture non authentifiée dans le journal d'audit · **ÉLEVÉ**

Aucune signature, aucun jeton, aucune clé. `verify_jwt = false` + zéro contrôle en code :
**n'importe qui connaissant l'URL insère des lignes arbitraires dans `auth_events`**, via
`service_role`, donc en contournant la RLS.

Ce qui rend le constat sérieux, c'est la migration
[`20260719150000_close_auth_events_client_writes.sql`](../../supabase/migrations/20260719150000_close_auth_events_client_writes.sql).
Elle a révoqué l'INSERT client sur cette table, en écrivant noir sur blanc :

> « Rouvrir une écriture anon sur une table d'audit serait un vecteur de spam avec la clé
> anon publique »

Le raisonnement est juste. Mais le vecteur décrit **est resté ouvert à côté** — et il est
pire que celui qui a été fermé, puisqu'il ne demande même pas la clé anon. La porte
d'entrée a été verrouillée pendant que la porte de service restait ouverte.

Trois effets :

1. **Falsification d'historique.** `user_id` accepte tout UUID connu. On fabrique la
   séquence `signin.failure` qu'on veut contre le compte qu'on veut.
2. **Contamination de l'export DSAR.** `admin-dsar-export` relit `auth_events`. Les lignes
   forgées sortiraient dans l'export LPD/nLPD d'une personne comme son historique
   d'authentification authentique. Pour un produit compliance-first, c'est le point le
   plus coûteux : ce n'est plus de la sécurité, c'est de l'intégrité de registre.
3. **`ip_hash` choisi par l'appelant.** `extractClientIp` (L69-78) fait confiance sans
   condition à `cf-connecting-ip`, puis `x-real-ip`, puis `x-forwarded-for`. La fonction
   étant appelable en direct, l'en-tête est posé par l'attaquant. La corrélation 24 h
   annoncée en tête de fichier — « rate limit per IP, brute-force detection » — est donc
   défaite à volonté.

⚠ **Ce qui plafonne la sévérité :** aucune logique de verrouillage de compte ne lit
`auth_events` (vérifié : aucun consommateur hors `auditLog.ts` en affichage et
`admin-dsar-export`). La promesse « brute-force detection » du bandeau est une intention,
pas une implémentation. Donc pas de DoS par verrouillage — le dommage est l'intégrité du
journal, pas la disponibilité des comptes.

Note mineure : `/^[0-9a-f-]{36}$/i` (L97) n'est pas un validateur d'UUID — 36 tirets
passent. La colonne étant `uuid`, l'insert échoue proprement ; c'est un 500 gratuit, pas
une faille.

### 4.2 — `whatsapp-webhook` : l'appelant choisit le secret qu'il doit forger · **ÉLEVÉ — CONFIRMÉ**

La branche de vérification est choisie **par l'en-tête que l'appelant envoie** (L56) :

```
if (metaSig)  → vérifie contre META_APP_SECRET
else          → vérifie contre WHATSAPP_WEBHOOK_SECRET   ← branche par défaut
```

Omettre `x-hub-signature-256` suffit à basculer sur le secret OpenWA. L'attaquant ne
choisit pas *s'il* doit signer, mais **avec lequel des deux secrets** — donc il prend le
plus faible, le plus ancien, ou le plus largement diffusé. Une requête sans aucun en-tête
de signature tombe elle aussi dans la branche OpenWA, au lieu d'être rejetée d'emblée.

Or **OpenWA est un vestige de la Phase 1.** Aucune référence vivante hors
`whatsapp-gateway.ts`, le webhook lui-même, et des copies périmées
(`.claude/worktrees/`, `docs/superpowers/plans/2026-05-28-…`). Le plan d'origine le dit :
« en prod, OpenWA sera remplacé par l'API Cloud Meta ».

Ce que la branche protège n'est pas anodin : le pipeline entrant atteint
`whatsapp-actions.ts` — mise à jour de pipeline, envoi de lien KYC, e-mail client,
publication/retrait portails, **suppression de contact**.

✅ **CONFIRMÉ le 04.08.2026, sans sonde et sans toucher la production.**
`WHATSAPP_WEBHOOK_SECRET` **est posé** : il apparaît dans la liste des secrets Edge
Functions du tableau de bord Supabase, avec son condensat SHA-256 et sa date de mise à
jour. Un secret absent n'y figurerait pas du tout — la présence de la ligne suffit, la
valeur n'a pas eu à être révélée. C'est la vérification la moins chère de tout ce
rapport, et elle ne laisse aucune trace.

Verdict : **chemin d'authentification parallèle bien vivant sur un provider mort.** La
sévérité passe de « élevé sous réserve » à élevé tout court, et le correctif devient une
suppression plutôt qu'une refonte — retirer la branche OpenWA, exiger un provider connu
au lieu d'y retomber par défaut, puis révoquer le secret.

⚠ Reste à vérifier, et ça compte : la **date de mise à jour** du secret. S'il n'a pas
bougé depuis la Phase 1, c'est un identifiant partagé jamais tourné, rattaché à une
intégration abandonnée — exactement le profil de celui dont une fuite ne serait
remarquée par personne.

### 4.3 — `esign-webhook` : jeton de capacité statique, en clair dans l'URL · **MOYEN**

L'entropie est bonne — `${crypto.randomUUID()}${crypto.randomUUID()}` sans tirets
([sign-document/index.ts:321](../../supabase/functions/sign-document/index.ts)), soit 64
caractères hex. Rien à redire côté génération.

Le problème est le cycle de vie. Le jeton :

- voyage **dans la query string** (`?sr=…&token=…`) → journaux d'accès du provider,
  journaux Supabase, journaux Cloudflare, tout intermédiaire sur le trajet ;
- **n'expire jamais** ;
- **n'est jamais nettoyé après finalisation** (vérifié : `webhook_token` n'apparaît nulle
  part dans `_shared/esign-finalize.ts`) ;
- n'est protégé par **aucune limitation de débit**.

Ce qu'un jeton fuité permet vraiment reste borné, et c'est à mettre au crédit de la
conception : le corps n'étant pas cru, l'attaquant ne peut pas *déclarer* qu'un acte est
signé. Au mieux il force une réconciliation, ou provoque l'écriture de `last_error`
(L123). D'où **moyen** et non élevé.

Sous-constat : la ligne `signature_requests` est lue (L70-74) **avant** la validation du
jeton, sur un `srId` non validé. Lecture seule, `service_role`, échec propre si l'UUID est
malformé — pas un trou, mais l'ordre gagnerait à être inversé.

### 4.4 — `stripe-webhook` : pas de registre d'événements, pas de garde d'ordre · **MOYEN**

La vérification de signature elle-même est **correcte sur les six critères**. Le manque est
en aval.

**Aucune table d'événements traités** (vérifié : ni `stripe_events`, ni équivalent). Deux
conséquences distinctes :

1. **Duplication du journal d'audit.** Les écritures d'état sont idempotentes par
   construction (upserts sur `agency_id` avec des valeurs absolues) — mais les
   `activity_events.insert` (L248, L322, L368, L441) ne le sont pas. Et ce n'est pas
   théorique : le `catch` final rend **500** (L527), ce qui *garantit* un rejeu Stripe. Un
   échec DB à mi-parcours laisse donc les inserts déjà passés en place, puis les rejoue.
2. **Livraison hors séquence.** Stripe ne garantit pas l'ordre, et rien ici ne compare
   `event.created` à l'état courant. Un `customer.subscription.updated` arrivant après un
   `customer.subscription.deleted` **réactive un abonnement résilié** et restaure son
   `mrr_chf`. Ce chemin ne demande aucun attaquant : il suffit que Stripe reprenne.

Constat mineur (**FAIBLE**) : L189 renvoie le message d'erreur brut à l'appelant
(`Webhook Error: ${err.message}`). Cela distingue « en-tête malformé » de « condensat qui
ne correspond pas » pour un sondeur anonyme.

### 4.5 — `whatsapp-webhook` : le handshake GET compare un secret avec `===` · **FAIBLE**

```js
if (mode === 'subscribe' && verifyToken && token === verifyToken)   // L41
```

`WHATSAPP_VERIFY_TOKEN` est un secret longue durée comparé en temps variable. Exploiter un
canal temporel sur une comparaison de chaînes JS à travers le réseau n'est pas réaliste —
d'où **faible**. Mais `timingSafeEqual` existe déjà à deux fichiers de là, et la même
fonction fait déjà les choses correctement sur le POST. L'incohérence coûte plus en
lisibilité qu'elle ne coûterait à corriger.

---

## 5. Couverture de test

Les helpers sont testés — `verifyHmac`
([whatsapp-gateway.test.ts:44](../../supabase/functions/_shared/whatsapp-gateway.test.ts)),
`timingSafeEqual`
([esign-gateway.test.ts:41](../../supabase/functions/_shared/esign-gateway.test.ts)).

**Aucun test ne couvre les points d'entrée eux-mêmes.** Or les constats 4.1, 4.2 et 4.5 ne
vivent pas dans les helpers : ils vivent dans l'**ordre** et le **branchement** des
`index.ts`. Un test de `verifyHmac` ne verra jamais que l'appelant choisit sa branche.

---

## 6. Vérification des secrets — et la leçon de méthode

Trois secrets décident de la sévérité réelle et ne sont pas lisibles depuis le dépôt.
Aucun n'apparaît dans l'inventaire de `CLAUDE.md` §8 — mais cet inventaire est
incomplet de son propre aveu (`MEGGA_MAGIC_LINK_HMAC_SECRET` y manquait aussi).

| Secret | État | Conséquence |
|---|---|---|
| `WHATSAPP_WEBHOOK_SECRET` | ✅ **posé** (constaté 04.08.2026) | **§4.2 confirmé élevé** |
| `META_APP_SECRET` | à vérifier, même méthode | absent → branche Meta en 500 |
| `AUTH_EVENT_SALT_SECRET` | à vérifier, même méthode | absent → `log-auth-event` inerte (500 partout) |

**La méthode qui a tranché : lire la LISTE des secrets, pas leur valeur.** Le tableau de
bord Supabase (Project Settings › Edge Functions › Secrets) affiche chaque secret posé
avec son condensat SHA-256 et sa date de mise à jour. Un secret absent n'y figure pas du
tout — donc **la présence de la ligne répond à la question**, sans révéler quoi que ce
soit et sans émettre une seule requête vers la production.

C'est la vérification la moins chère du rapport, et elle rend inutile la sonde qui était
proposée ici : un POST sans en-tête de signature sur `whatsapp-webhook`, qui distingue
500 « Server misconfigured » (secret absent) de 401 « Invalid signature » (secret posé).
La sonde reste correcte — le contrôle précède toute écriture, elle ne mute rien — mais
elle touche la production et laisse une trace dans les journaux pour apprendre une chose
qu'une page de réglages donne gratuitement.

⚠ **Généralisable :** avant de sonder un service pour deviner sa configuration, vérifier
si un plan de contrôle l'expose déjà. Le condensat est fait pour ça — il permet aussi de
comparer deux environnements (test vs réel) sans jamais manipuler la valeur.

---

## 7. Ordre de correction suggéré

Un correctif par PR, dans cet ordre — le premier est le plus rentable et le plus isolé.

1. ~~**§4.1** — fermer `log-auth-event`~~ · ✅ **FAIT** ([#1154](https://github.com/megga/megga-real-estate/pull/1154), fusionnée le 04.08.2026).
   L'arbitrage annoncé ici s'est confirmé : l'appel légitime étant pré-authentification
   (`signin.failure`), tout secret côté navigateur serait public, et la limitation de
   débit était bien la seule réponse honnête. 60/minute et 600/heure par `ip_hash`,
   comptage et insertion en un seul aller (`log_auth_event_limited`), plus la résolution
   d'IP corrigée — `x-forwarded-for` se lit désormais depuis la DROITE, et
   `cf-connecting-ip` n'est plus cru.
2. **§4.2** — **c'est maintenant le plus rentable.** Le secret étant confirmé posé (§6),
   c'est une **suppression**, pas une refonte : retirer la branche OpenWA, exiger un
   provider connu au lieu d'y retomber par défaut, puis révoquer
   `WHATSAPP_WEBHOOK_SECRET`.
3. **§4.4** — table `stripe_events(event_id primary key)` en garde d'idempotence, et
   comparaison de `event.created` avant écriture d'état.
4. **§4.3** — nettoyer `webhook_token` à la finalisation ; envisager l'en-tête plutôt que
   la query string si le provider le permet.
5. **§4.5 + §4.4 mineur** — `timingSafeEqual` sur le handshake GET ; message d'erreur
   générique côté Stripe.

Chacun mérite un test de point d'entrée (§5) dans la même PR que son correctif.
