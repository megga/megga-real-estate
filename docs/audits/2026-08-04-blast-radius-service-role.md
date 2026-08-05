# Audit — rayon d'action de la clé service-role

**Date :** 4 août 2026 · **Périmètre :** les 59 edge functions qui instancient un client
`service_role`, les 6 scripts Node qui en lisent la clé, `src/` et la configuration Vite.
**Nature :** rapport seul — aucun correctif écrit, aucune donnée modifiée, aucun secret lu.

> **État au 5 août 2026 : les cinq constats sont traités et fusionnés.**
> §4.1 ([#1169](https://github.com/megga/megga-real-estate/pull/1169)),
> §4.2 ([#1167](https://github.com/megga/megga-real-estate/pull/1167)),
> §4.3 ([#1171](https://github.com/megga/megga-real-estate/pull/1171)),
> §4.4 et §4.7 ([#1170](https://github.com/megga/megga-real-estate/pull/1170)),
> §4.5 ([#1172](https://github.com/megga/megga-real-estate/pull/1172)).
> §4.6 (`idx-feed`) est **laissé ouvert à dessein** — voir §8.
> Ce que l'exécution a appris, et que l'audit n'avait pas vu : **§10**.
>
> Le corps du rapport est conservé **tel qu'il a été écrit**, y compris là où il s'est
> trompé (le §8.4 recommandait d'écrire un helper qui existait déjà). Un audit qu'on
> réécrit après coup ne dit plus ce qu'on savait au moment de décider.

> **Ce que ce lot cherchait, et pourquoi.** Le §4.1 de l'audit précédent
> ([2026-08-03-signatures-webhooks.md](2026-08-03-signatures-webhooks.md)) était une
> instance de ce motif : `log-auth-event` écrivait dans `auth_events` via un client
> `service_role` sur une entrée non validée, hors RLS. Il est corrigé. La question de ce
> lot n'est donc pas « est-ce que ça existe ici » — c'est confirmé — mais **« où
> ailleurs »**.
>
> Réponse courte : **aucun IDOR exploitable trouvé sur les 59 fonctions.** Le motif du
> §4.1 ne s'est pas reproduit. Ce que la revue a trouvé à la place est d'une autre
> nature — un **magasin de secret joignable en écriture par `authenticated`, que seule
> l'absence de policy retient**, et un **garde-fou anti-fuite navigateur aveugle au
> format de clé que le projet utilise déjà**. Les deux sont latents, aucun n'est
> aujourd'hui exploitable, et c'est précisément ce qui les rend faciles à laisser en
> place.

---

## 1. La surface, en chiffres

| | Nombre |
|---|---|
| Edge functions déployées (hors `_shared`) | 77 |
| … qui instancient un client `service_role` | **59** |
| Fichiers `_shared` qui lisent la clé | 6 |
| Scripts Node qui la lisent | 6 |

Sur ces 59 : **24** importent une garde partagée de `_shared/` (`requireAgentAuth`,
`requireSuperAdmin`, `isServiceSecret`, `requireAgencyLabCleared`) et **35** portent un
contrôle écrit sur place — signature de webhook, jeton HMAC, secret partagé, ou
`auth.getUser` en direct. Le détail par famille est au §3 (où le classement suit la garde
effective, pas l'import, d'où des totaux différents).

**Une seule des 59 n'a aucune garde : `log-auth-event`** — et c'est un choix documenté,
pas un oubli (elle est appelée avant toute session).

`verify_jwt = false` est posé sur les 77 (`supabase/config.toml`, 77 occurrences, aucune
à `true`). La passerelle Supabase ne vérifie donc **rien** : chaque fonction répond seule
de l'identité de son appelant. C'est le contexte que `scripts/check-edge-auth.mjs`
documente déjà, et ce script est bien **actif en CI** (`unit-tests.yml`, via
`npm run lint:edge-auth`).

Ce même script dit lui-même ce qu'il ne fait pas
([check-edge-auth.mjs:15-20](../../scripts/check-edge-auth.mjs)) :

> « Il vérifie qu'une garde EXISTE, pas qu'elle AUTORISE correctement. […] Cette porte
> attrape l'oubli total, pas l'IDOR. »

Le présent audit est exactement la couche qu'il laisse ouverte.

---

## 2. Méthode — et une correction du critère annoncé

La consigne posait : *« l'identité de l'appelant est-elle établie AVANT que le client
service-role soit créé ? L'ordre compte — tout ce qui vient après est décoratif. »*

**Ce critère est juste pour un webhook et faux pour le reste**, et l'appliquer tel quel
aurait produit une trentaine de faux positifs.

La raison est structurelle : `supabase.auth.getUser(token)` **exige un client privilégié
pour s'exécuter**. Vérifier un JWT utilisateur impose donc de créer le client
service-role d'abord. C'est le cas de `requireAgentAuth`
([require-agent-auth.ts:63](../../supabase/functions/_shared/require-agent-auth.ts) crée
le client, [:65](../../supabase/functions/_shared/require-agent-auth.ts) vérifie le
jeton), de `revoke-device-session` (L45 puis L46), de `detect-new-device` (L175 puis
L176), de `learn-agent-style` (L29 puis L31-34, où la garde lit `app_config` — donc a
besoin du client pour exister).

L'invariant qui discrimine réellement n'est pas *quand le client naît*, c'est :

> **Aucune valeur contrôlée par l'appelant n'atteint une requête avant que la garde ait
> tranché.**

Chacune des 59 fonctions a été lue sous ce critère. **Aucune ne le viole.** Dans tous les
cas d'ordre « client d'abord », ce que le client touche avant la garde est soit le jeton
lui-même, soit une constante (`app_config.key = 'service_role_key'`), jamais un
identifiant fourni par l'appelant.

Le second critère, lui, a été appliqué tel quel : **une valeur d'appelant qui atteint
`.eq()` / `.in()` / `.rpc()` sans contrôle de propriété EN AMONT est un contournement de
RLS par construction.** C'est ce critère qui produit le §4.5.

Vérifications faites contre le système qui tourne, pas contre ce que le code paraît dire :
la production a été interrogée en lecture (grants, policies, `cron.job`,
`net._http_response`), et le bundle a été scanné **après build réel**. Aucune valeur de
secret n'a été lue à aucun moment — seulement des longueurs, des préfixes et des
empreintes.

---

## 3. Matrice — les 59, par famille de garde

✅ correct · ⚠ correct mais fragile · ❌ défaut · — sans objet

Chaque fonction est classée par la **première** garde qui la couvre (une fonction peut en
porter plusieurs : `kyc-screening` a `requireAgentAuth` *et* `safeEqual`). Les totaux
somment donc à 59 sans double compte.

| Famille | Fonctions | Valeur d'appelant → requête sans contrôle amont | Identité avant toute requête d'appelant | Cloisonnement `agency_id` |
|---|---|---|---|---|
| Secret partagé / cron | 17 | ✅ aucune | ✅ | ✅ |
| `auth.getUser` direct | 11 | ✅ aucune | ✅ | ✅ `.eq('user_id', user.id)` composé |
| `requireAgentAuth` | 11 | ✅ aucune | ✅ | ⚠ à la main, 3 cas en lecture-puis-comparaison (§4.5) |
| Lien magique HMAC | 9 | ✅ l'id vient de la **charge signée** | ✅ | ✅ |
| `requireSuperAdmin` | 6 | ✅ aucune | ✅ | — (global par conception) |
| Webhooks signés | 3 | ✅ | ✅ | — (traités au lot #4) |
| Jeton de flux en base | 1 (`idx-feed`) | ⚠ le jeton **est** l'identité (§4.6) | ✅ | ✅ |
| **Aucune garde** | **1** (`log-auth-event`) | ✅ aucune (entrée non validée, mais aucun identifiant d'appelant n'atteint de filtre) | ❌ **par conception** | — |
| **Total** | **59** | | | |

La seule fonction sans garde est `log-auth-event`, et c'est **assumé et documenté** : elle
est appelée depuis l'écran de connexion, donc avant toute session. Son §4.1 au lot
précédent est traité (limitation de débit, PR #1154) — seule la note du script de contrôle
est restée en arrière (§4.7).

---

## 4. Constats, par exploitabilité décroissante

### 4.1 — `app_config` : un secret vivant, retenu par la seule absence de policy · **MOYEN (latent)**

`app_config` contient la ligne `service_role_key`, et cette ligne est **réellement
utilisée** : les 15 tâches `pg_cron` qui appellent une edge function rejouent sa valeur en
`Bearer` (`'Bearer ' || public.get_app_config('service_role_key')`), et huit fonctions la
comparent pour s'authentifier.

Mesuré en production le 04.08.2026 — **métadonnées seules, la valeur n'a jamais été lue** :

| Contrôle | État constaté |
|---|---|
| `get_app_config(text)` — EXECUTE | ✅ `postgres`, `service_role` **seulement** — `anon`/`authenticated` révoqués |
| `app_config` — RLS | activée, **0 policy** |
| `app_config` — grants `anon` | ✅ aucun |
| `app_config` — grants `authenticated` | ❌ **SELECT, INSERT, UPDATE, DELETE** (TRUNCATE bien retiré) |
| ligne `service_role_key` | présente, 41 caractères, format `sb_secret_…` |

La révocation de la fonction ([`20260705190000_get_app_config_revoke_grants.sql:14`](../../supabase/migrations/20260705190000_get_app_config_revoke_grants.sql))
et le retrait de TRUNCATE ([`20260803200312`](../../supabase/migrations/20260803200312_revoke_truncate_journal_audit.sql))
tiennent tous les deux — vérifiés en base, pas supposés.

**Ce qui reste :** `authenticated` détient encore les quatre verbes sur la table qui porte
le secret. Test de refus exécuté en production, `SET ROLE authenticated`, **avec contrôle
positif** :

| Sonde | Résultat |
|---|---|
| CONTRÔLE POSITIF — `select profiles` | exécuté, 0 ligne visible → le harnais fonctionne |
| CONTRÔLE POSITIF — `current_role` | `authenticated` → on a bien quitté `postgres` |
| `select app_config` | **0 ligne, aucune erreur** → filtré par la RLS, **pas** par le grant |
| `get_app_config('service_role_key')` | **refusé `42501`** → la révocation est vivante |
| `update app_config` | **accepté, 0 ligne** → pas d'erreur de privilège |

Le contrôle positif est ce qui rend ces résultats lisibles : il distingue « refusé par
privilège » (erreur `42501`, ligne 4) de « autorisé mais filtré par la RLS » (silence,
0 ligne, lignes 3 et 5). Sans lui, les trois auraient rendu « rien » et se seraient
ressemblé.

Donc : **aujourd'hui, rien ne fuit.** RLS activée sans policy refuse par défaut, et le
refus est réel. Le défaut est que le verrou est *l'absence de quelque chose*. Une seule
policy `FOR ALL` écrite un jour sur cette table — par inadvertance, ou par un script de
génération — rend le secret lisible à tout compte connecté. Le dépôt connaît déjà ce
raisonnement et l'a écrit noir sur blanc pour une autre table
([`20260802210000_team_invitations_rls_role_gate.sql`](../../supabase/migrations/20260802210000_team_invitations_rls_role_gate.sql)) :

> « la première policy `FOR ALL` écrite un jour ici le rouvrirait sans que personne ne le
> remarque »

C'est le même piège, sur une table dont le contenu est une clé plutôt qu'une invitation.

⚠ **Ce qui plafonne la sévérité :** il faut déjà un compte agent valide, et la RLS tient
réellement. Ce n'est pas une fuite, c'est un cran de sûreté manquant sur un magasin de
secret.

### 4.2 — Le garde-fou anti-fuite navigateur ne connaît pas le format de clé utilisé ici · **MOYEN (latent)**

`src/lib/supabase.ts` porte une défense explicite, née d'un incident réel (commentaire
L21-24 : « service_role was set where anon was expected → key leaked in the public
bundle »). Elle décode le JWT et refuse un rôle `service_role`
([supabase.ts:32-41](../../src/lib/supabase.ts), puis L46-57).

Elle ne reconnaît **que le format JWT** : `token.split('.')[1]`, base64, lecture de
`.role`. Or la clé de service de ce projet est au **nouveau format `sb_secret_…`** —
constaté en base au §4.1 : 41 caractères, **zéro point**, préfixe `sb_secret_`.

Exécuté sur une copie conforme de la fonction :

```
BLOCKED     | role=service_role  | legacy service_role JWT
NOT CAUGHT  | role=null          | new-format secret (la forme réellement en base)
NOT CAUGHT  | role=null          | new-format publishable
```

Un `VITE_SUPABASE_ANON_KEY=sb_secret_…` mal configuré passerait donc **sans un mot**, et
partirait dans le bundle public — exactement l'incident que ce garde-fou a été écrit pour
empêcher, dans le format que Supabase pousse désormais.

⚠ **Ce qui plafonne la sévérité, et il faut le dire nettement : le bundle est propre
aujourd'hui.** Voir §6 — vérifié sur la sortie construite, avec contrôle positif. Le
défaut est dans le filet, pas dans le produit.

### 4.3 — Deux clés de service distinctes servent la même décision de confiance · **FAIBLE-MOYEN (latent)**

Deux sources coexistent pour « prouver qu'on est le backend » :

- `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — comparée par `kyc-screening` (L70-72),
  `whatsapp-agent` (L74), `idx-syndicate` (L114), `kyc-report-pdf` (L37) ;
- `app_config.service_role_key` — comparée par `learn-agent-style` (L31-34),
  `whatsapp-agent-async`, `whatsapp-process`, `whatsapp-morning-brief`.

Les tâches `pg_cron`, elles, envoient **toujours** la seconde. Une fonction qui n'accepte
que la première dépend donc de la coïncidence des deux valeurs.

`agency-verification-run` est la seule à avoir vu le problème et à accepter **les deux
formats**, avec son raisonnement écrit
([index.ts:27-31](../../supabase/functions/agency-verification-run/index.ts)) :

> « n'en reconnaitre qu'un seul rendait la chaine KYB dependante de la coincidence des
> deux sources »

**Mesuré : elles coïncident aujourd'hui.** Sur 3 jours, `net._http_response` ne contient
**aucun 401 ni 403** sur 1 025 appels ; les 15 tâches cron→edge sont toutes actives et
sans échec.

⚠ **Piège de méthode évité, et il vaut d'être noté.** `cron.job_run_details.status =
'succeeded'` affiche 100 % de succès sur ces mêmes tâches — et **ne prouve rien** :
`net.http_post` est asynchrone, le statut ne dit que « la commande SQL a mis la requête en
file », jamais ce que le HTTP a répondu. C'est le vert-pour-la-mauvaise-raison du §8 de
l'audit précédent, rencontré ici en vrai. Seul `net._http_response` répond à la question.

Le risque est donc entièrement prospectif : le jour où l'une des deux valeurs tourne sans
l'autre, **la moitié des gardes cesse d'authentifier et l'autre continue**, sans que rien
ne le signale — le symptôme serait des tâches muettes, pas une alerte.

### 4.4 — `.gitignore` n'ignore pas `.env` · **FAIBLE**

Testé avec `git check-ignore` :

| Fichier | Ignoré ? |
|---|---|
| `.env.local` | ✅ (par la règle `*.local`, [.gitignore:17](../../.gitignore)) |
| `.env.test.local` | ✅ (idem) |
| `.env` | ❌ **committable** |
| `.env.production` | ❌ **committable** |
| `supabase/.env` | ❌ **committable** |

Les deux seuls fichiers d'environnement suivis sont `.env.example` et
`.env.test.example` — des gabarits, sans valeur réelle (vérifié). Et la protection
existante n'est pas nominative : `.env.local` n'est ignoré que **par accident**, en tant
que `*.local`.

`supabase/.env` mérite une mention à part : c'est l'emplacement que la CLI Supabase lit
pour les secrets d'edge functions (`--env-file`). C'est donc le chemin le plus plausible
pour qu'une vraie clé service-role atterrisse sur le disque — et il n'est pas couvert.

Aucune clé n'est aujourd'hui commitée : scan de tous les fichiers suivis, **zéro** JWT de
rôle non-`anon`, et l'unique littéral `sb_secret_` est une sentinelle de test
([agency-verification-run-auth.spec.ts:80](../../tests/backend/agency-verification-run-auth.spec.ts)).

### 4.5 — Lecture-puis-comparaison au lieu de requête cloisonnée · **FAIBLE (défense en profondeur)**

Trois fonctions lisent une ligne par identifiant fourni par l'appelant **sans filtre
d'agence**, puis comparent l'`agency_id` en mémoire et refusent :

| Fichier | Lecture non cloisonnée | Contrôle | Écriture ensuite |
|---|---|---|---|
| [c2pa-sign/index.ts:39-44](../../supabase/functions/c2pa-sign/index.ts) | `.eq('id', propertyId)` | L52 → 403 | L199-206 `.eq('id', propertyId)`, sans agence |
| [kyb-identity-read/index.ts:106-111](../../supabase/functions/kyb-identity-read/index.ts) | `.eq('id', relatedPersonId)` | L111 → refus | L167-169, sans agence |
| [kyc-screening/index.ts:141-155](../../supabase/functions/kyc-screening/index.ts) | `.eq('id', kyc_case_id)` | L163 → 403 | L208-210, sans agence |

**Ce n'est pas exploitable** : dans les trois, le contrôle précède l'usage, et il n'existe
aucun chemin de retour anticipé entre les deux. Le classement est délibérément bas.

Ce qui le rend digne d'être noté : la sécurité repose sur le **flot de contrôle**, pas sur
la requête. Un `return` inséré plus haut, un `try` qui avale, une branche ajoutée — et
l'`UPDATE` non cloisonné devient joignable. La forme robuste (`.eq('id', x).eq('agency_id',
profile.agency_id)`) rend le défaut impossible plutôt qu'évitable, et le dépôt la pratique
déjà : `sign-document` L387-389 compose bien les deux.

Sous-constat (**FAIBLE**) : `c2pa-sign` distingue `404 Property not found` de
`403 Bien hors agence`. Un agent peut donc tester l'existence d'un UUID de bien chez une
autre agence. Oracle d'existence mince, sur une fonction que son propre commentaire
déclare dormante (L213-215, « hors périmètre MVP »).

### 4.6 — `idx-feed` : jeton de capacité en query string, sans limitation de débit · **FAIBLE**

[idx-feed/index.ts:41-48](../../supabase/functions/idx-feed/index.ts) résout
`?token=…` en agence par `.eq('idx_feed_token', token)` sur un client `service_role`.

C'est **le motif légitime** d'une clé d'API portée en base — le jeton *est* l'identité, il
n'y a pas d'« amont » où poser un contrôle de propriété. Mais il partage trois traits avec
le §4.3 de l'audit précédent : il voyage dans l'URL (journaux du portail, de Supabase, de
Cloudflare), il n'expire pas, et rien ne limite le débit des tentatives. La colonne est
`unique` mais le dépôt ne contient **aucun générateur** pour elle — l'entropie dépend donc
de la main qui a rempli la ligne, et n'est pas garantie par le code.

Lecture seule, portée à une agence, feed de biens déjà destinés à la publication : d'où
**faible**.

### 4.7 — L'allowlist de `check-edge-auth.mjs` est périmée sur `log-auth-event` · **INFO**

[check-edge-auth.mjs:90-94](../../scripts/check-edge-auth.mjs) décrit encore les
événements comme « forgeables et **non limités en débit** — à traiter ». La limitation
existe depuis la PR #1154 (`log_auth_event_limited`, migration `20260804101347`, 60/min
et 600/h par `ip_hash`) — visible dans la fonction elle-même (L169-202).

Le script ne s'en aperçoit pas : sa détection de péremption ne se déclenche que si la
fonction gagne une garde d'*authentification*, or celle-ci a gagné une limitation de
débit. Pas un défaut de sécurité — mais c'est la seule note du dépôt qui décrive encore
l'état d'avant.

---

## 5. Ce qui est légitime — et pourquoi ce n'est pas du remplissage

La consigne demandait de dire nettement quels usages sont corrects. **La grande majorité
l'est**, et plusieurs sont meilleurs que la moyenne du marché.

**La famille du lien magique (9 fonctions) est correcte par construction.** L'identifiant
passé à `.eq()` ne vient jamais de la requête : il sort de la **charge utile signée**,
après vérification HMAC. `appointment-slots` L41-47 (crypto d'abord, base ensuite),
`kyc-report-data` L24-31. `appointment-slots` va plus loin (L84) : un lien régénéré
invalide le précédent en comparant le jeton stocké, alors même que la signature reste
cryptographiquement valide jusqu'à son `exp`. C'est une révocation, et elle n'était pas
gratuite à écrire.

**`buyer-reception-create` est le modèle à citer.** Il charge les `matches` avec
`.eq('agency_id', profile.agency_id).eq('contact_id', contactId)` (L52-54), puis
n'écrit que sur des identifiants **dérivés de ce résultat** (L59-63). L'`.in('id', toSend)`
sans filtre d'agence est sûr parce que `toSend` ne peut contenir que des lignes déjà
prouvées. C'est la différence entre « je refiltre » et « je ne peux pas ne pas être
filtré ».

**`detect-new-device` et `revoke-device-session`** établissent l'identité par
`admin.auth.getUser(token)` puis composent systématiquement `.eq('user_id', user.id)` sur
lecture **et** suppression (revoke L54-59 puis L79-83). La propriété est dans la requête,
pas dans une comparaison.

**`translate-on-demand`** n'a besoin d'aucun `agency_id` : le cache est indexé par
`sha256(contenu fourni par l'appelant)`, il ne contient aucune donnée de locataire, et la
clé de lecture est dérivée de ce que l'appelant possède déjà.

**`kyc-report-import`** ne reçoit aucun identifiant : tout est dérivé de
`profile.agency_id`. Quota et audit compris.

**Les 10 consommateurs de `requireSuperAdmin` sans `agency_id`** sont corrects : la
console est globale par conception, et le mur réel est en base (`is_super_admin()`).

**Les 6 scripts Node sont sains.** Aucun ne code de clé en dur ni ne prévoit de repli
littéral — tous exigent la variable d'environnement. Deux méritent d'être signalés comme
exemplaires :

- `seed-admin-staging.mjs` **refuse en dur la référence du projet de production** (L30-31)
  et exige `--confirm`. Un script qui crée 14 agences et 56 comptes ne peut pas partir sur
  la prod par distraction.
- `tests/backend/helpers/supabase.ts` **lève** si l'URL n'est pas `127.0.0.1`/`localhost`
  (L18-22). La clé service-role de test ne peut pas viser la production.

Seule réserve, mineure : `zefix-enrich-agencies.mjs:203` fait défaut sur l'URL de
production si `SUPABASE_URL` est absente. Combiné à une clé service-role dans
l'environnement, le défaut désigne la prod. Aucun autre script ne fait ça.

---

## 6. Le bundle navigateur — vérifié sur la sortie construite

**Résultat : aucune matière de clé non-`anon` dans le bundle.**

Trois barrières, dont deux tiennent seules :

1. **Vite ne peut pas inliner la clé.** Pas de bloc `define`, pas d'`envPrefix`
   personnalisé dans `vite.config.ts` → seul le préfixe `VITE_` par défaut atteint
   `import.meta.env`. `SUPABASE_SERVICE_ROLE_KEY` n'est pas préfixé : il n'existe aucun
   chemin par lequel Vite l'inscrive dans la sortie.
2. **L'anon key est codée en dur en repli** (`supabase.ts:25-26`), précisément pour qu'une
   variable mal configurée ne puisse pas y substituer autre chose.
3. **Le contrôle de rôle** — celui qui a le trou du §4.2.

Scan exécuté après `npm run build` (sortie exit 0), sur **693 fichiers construits** de
`dist/` : extraction de tout jeton de forme JWT, décodage de la revendication `role`, plus
recherche des littéraux `sb_secret_`. **Aucune trouvaille.**

Ce résultat n'a été retenu qu'après que le scanner a fait ses preuves — et il a fallu s'y
reprendre :

- **Première tentative : le contrôle positif n'a pas tourné du tout** (chemin `/tmp`
  invalide côté Node sous Windows → « scanned 0 files »). Le scan réel affichait pourtant
  déjà « aucune trouvaille ». **Ce résultat-là ne valait rien**, et c'est exactement le
  piège que le §8 de l'audit précédent décrit.
- **Seconde tentative, concluante :** un faux JWT `service_role` et un faux
  `sb_secret_…` plantés dans un fichier témoin sont **tous deux détectés**, tandis qu'un
  JWT `anon` planté à côté est correctement ignoré.
- **Contrôle de sanité supplémentaire :** la vraie clé `anon` est bien présente dans
  **5 fichiers** de `dist/`. Le scanner lit donc réellement des jetons embarqués dans les
  bundles — l'absence de `service_role` est une mesure, pas un angle mort.

---

## 7. Couverture de test

Ce qui existe et couvre bien :
`tests/backend/agency-verification-run-auth.spec.ts` couvre exactement le §4.3 — les deux
formats acceptés, et un jeton faux refusé. C'est le seul endroit du dépôt qui teste la
question de la double source.

Ce qui manque, dans l'ordre où ça coûterait le moins :

1. **Aucun test n'échouerait si une policy `FOR ALL` apparaissait sur `app_config`**
   (§4.1). C'est le contrôle le plus rentable de ce lot : une assertion « `authenticated`
   ne peut ni lire ni écrire `app_config` », écrite avec le contrôle positif du §4.1,
   verrouillerait la propriété au lieu de la constater.
2. **Aucun test ne couvre le garde-fou de `src/lib/supabase.ts`** (§4.2) — ni pour le JWT
   qu'il attrape, ni pour le format qu'il laisse passer. La fonction est pure : un test
   unitaire tiendrait en dix lignes.
3. **`scripts/check-edge-auth.mjs` ne sait pas voir un IDOR** (il le dit lui-même). Un
   contrôle « toute lecture par identifiant d'appelant est composée d'un filtre
   `agency_id` » attraperait le §4.5, mais demande une analyse de flot — à mettre en
   regard de son coût.

⚠ Rappel de contrainte pour le lot de correctifs : **`deno check` est le seul typecheck
que reçoivent les edge functions, et il est bloquant en CI** ; `tsc` n'en couvre aucune.
La commande de `unit-tests.yml` se rejoue en local :

```bash
mapfile -d '' files < <(find supabase/functions -name '*.ts' ! -name '*.test.ts' -print0)
deno check --no-lock "${files[@]}"
```

---

## 8. Ordre de correction suggéré

Un correctif par PR. Aucun n'est urgent — aucun constat n'est exploitable en l'état ; le
classement suit le rapport bénéfice/risque.

1. **§4.2 — apprendre le format `sb_secret_` au garde-fou navigateur.** Le plus rentable :
   quelques lignes dans `src/lib/supabase.ts`, aucun risque de régression, testable
   unitairement, et ça referme la porte d'un incident qui s'est **déjà produit** sur ce
   projet. Refuser tout `sb_secret_*` comme clé publique, et n'accepter que `eyJ…` de rôle
   `anon` ou un `sb_publishable_*`.
2. **§4.1 — retirer à `authenticated` ce dont il n'a pas l'usage sur `app_config`.**
   `REVOKE SELECT, INSERT, UPDATE, DELETE … FROM authenticated`. Aucun chemin applicatif
   ne lit cette table avec un JWT utilisateur (les tunables passent par des wrappers
   `SECURITY DEFINER` dédiés — `get_today_focus_config`, `get_contact_scoring_config` —
   précisément pour ne jamais exposer toute la table).
   ⚠ **Migration → échéance du même jour UTC.** Voir §9 : à écrire et fusionner le même
   jour UTC, avec un horodatage non rond.
   ⚠ **Vérifier avant de rédiger** que rien ne lit `app_config` sous `authenticated` — le
   §4.1 note que le `UPDATE` ne rend pas d'erreur mais 0 ligne : un appelant éventuel
   passerait d'un silence à une erreur, ce qui n'est pas neutre. C'est le raisonnement
   qu'a tenu `20260803200312` et il s'applique mot pour mot.
3. **§4.4 — élargir `.gitignore`** à `.env`, `.env.*`, `supabase/.env`, avec une exception
   explicite pour les `*.example` déjà suivis. Deux lignes, aucun effet sur l'existant.
4. **§4.3 — aligner les gardes sur les deux formats**, en reprenant
   `isTrustedServiceCaller` d'`agency-verification-run` comme helper `_shared` plutôt
   qu'en le recopiant. Le test qui existe déjà pour cette fonction devient alors le test du
   helper.
5. **§4.5 — composer `.eq('agency_id', …)` sur les trois écritures.** Purement
   défense en profondeur ; à faire quand on touche ces fichiers pour autre chose. Pour
   `c2pa-sign`, tenir compte du fait que la fonction est déclarée dormante — le refactor
   pourrait ne pas valoir sa PR.
6. **§4.7 — corriger la note périmée** de `check-edge-auth.mjs`. À joindre à n'importe
   quelle autre PR.

**Non retenu délibérément :** l'entropie du `idx_feed_token` (§4.6). Il faudrait d'abord
mesurer les jetons existants en base avant de décider s'il y a un problème — et cette
mesure lit des secrets vivants, ce que ce lot s'est interdit. À traiter comme une question
d'exploitation, pas de code.

---

## 9. Note de version — l'échéance qui mord

Le §8.2 est le seul point de cette liste qui exige une **migration**. La règle du dépôt,
et elle n'a pas d'exception praticable :

> Une migration doit être **fusionnée le même jour UTC** que son horodatage, sinon elle
> est ignorée silencieusement au déploiement. Horodatage **non rond**
> (`20260805143722`, pas `20260805140000`).

Conséquence pratique : **ne pas écrire cette migration un jour pour la fusionner le
lendemain.** Si la revue risque de traîner, il vaut mieux ouvrir la PR sans la migration,
puis l'ajouter le jour où elle sera effectivement fusionnée. Le mode d'échec est le pire
qui soit — la PR est verte, le fichier est sur `main`, et le `REVOKE` n'a jamais été
appliqué. Personne ne le remarquerait avant le prochain audit.

Les §8.1, §8.3, §8.4, §8.5 et §8.6 ne touchent pas la base et n'ont aucune contrainte de
date.

---

## 10. Ce que l'exécution a appris, et que l'audit n'avait pas vu

Ajouté le 5 août 2026, après fusion des cinq correctifs. Ces points valent pour les
prochains lots autant que pour celui-ci.

**Le helper recommandé existait déjà.** Le §8.4 proposait d'extraire
`isTrustedServiceCaller` d'`agency-verification-run` vers `_shared`. Or `isServiceSecret`
([require-service-secret.ts](../../supabase/functions/_shared/require-service-secret.ts))
faisait déjà exactement cela, acceptait déjà les deux formats, et comptait déjà **dix
appelants**. Le correctif est donc devenu une migration au lieu d'un ajout. Lire
`_shared/` en entier AVANT de recommander du code neuf aurait évité la recommandation ;
c'est le réflexe à ajouter au prochain audit.

**Un durcissement peut supprimer un signal de sécurité.** Le §4.5 demandait de composer
`.eq('agency_id', …)` sur les écritures. Appliqué mécaniquement à tous les sites de
`kyc-screening`, il aurait aussi cloisonné la **lecture de propriété** — celle qui ÉTABLIT
la propriété. La branche `403 cross-agency` serait devenue inatteignable et un accès
inter-agences serait sorti en « introuvable ». Plus fermé en apparence, moins lisible en
pratique : un refus qui ne dit plus ce qu'il refuse. **Classer chaque site en
lecture-de-contrôle ou écriture avant de patcher**, jamais l'inverse.

**Une mutation qui ne s'applique pas se lit comme un test qui passe.** Trois campagnes de
mutation ont été menées ; dans deux d'entre elles, un motif `perl -0pi -e` n'a pas
accroché (fins de ligne CRLF) et la suite affichait un vert parfaitement crédible. Seule
la trace « (applied) / (not applied) » l'a révélé. **Faire imprimer à la mutation qu'elle
a bien posé son marqueur** — sinon on mesure la couverture d'un fichier intact.

**La fusion en lot escamote les déploiements.** Six PR fusionnées en quelques minutes ont
produit **deux exécutions de `deploy.yml`** : la première et la dernière. Les quatre du
milieu sont `cancelled` — la file de concurrence ne garde qu'un run en attente. Aucune
perte (le dernier run porte la pointe de `main`), mais **la pastille verte d'une PR du
milieu ne prouve aucun déploiement**. Vérifier le DERNIER run, et pour une migration,
vérifier un effet observable en base.

**Le `COMMENT ON TABLE` est un excellent témoin de déploiement.** Les deux `REVOKE` du
§4.1 avaient été appliqués à la main avant la PR : leur présence ne prouvait donc rien sur
la CI. Le `COMMENT`, lui, n'avait jamais été posé — le retrouver en base après fusion
prouve que la CI a réellement exécuté le fichier. **Glisser un effet inédit et inoffensif
dans une migration idempotente donne une sonde de déploiement gratuite.**

**`supabase_migrations.schema_migrations` n'est pas tenu à jour par ce dépôt.** La
migration du §4.1 n'y figure pas — ni aucune des migrations du 4 août. `deploy.yml`
applique le SQL via l'API Management et n'écrit pas ce registre. Ce n'est donc pas un
indicateur d'application : la dernière entrée date du 3 août alors que la base est à jour.
Ne pas s'en servir pour diagnostiquer une dérive ; c'est `check-migration-drift.mjs` qui
compare réellement le dépôt à la production.

**L'outil SQL du plan de contrôle valide chaque instruction.** Une sonde du §4.1, écrite
pour être annulée, a été **committée en production** : il n'y avait pas de transaction à
annuler. Pour une sonde qui écrit, il faut un `BEGIN`/`ROLLBACK` explicite **dans le même
envoi**, ou s'en tenir à des lectures. Et ne jamais annoncer « annulé » avant de l'avoir
constaté.

**Un statut `succeeded` de `pg_cron` ne dit rien du HTTP.** `net.http_post` est
asynchrone : `cron.job_run_details.status` ne rapporte que la mise en file. Les 15 tâches
cron→edge affichaient 100 % de succès, ce qui ne prouvait pas que les gardes
authentifiaient. Seul `net._http_response` répond — et c'est lui qui a établi que les deux
secrets du §4.3 coïncident aujourd'hui (0 × 401/403 sur 1 025 appels).
