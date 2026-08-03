# Revue KYB — ce que l'écran peut montrer, et ce qui reste à trancher

> **Ce document ne décide rien.** Il décrit le contrat réel des 7 RPC livrées, l'état réel
> de la production, et nomme les arbitrages que la maquette manquante (Q9) laisse ouverts.
> Il existe parce que la règle 4 du handoff exige un amendement écrit validé par le PO
> **avant** le code, et qu'aucun document ne décrivait cet écran depuis les RPC elles-mêmes.
>
> **Méthode.** Tout ce qui suit a été lu le 4 août 2026 avec `pg_get_functiondef` sur la
> base de production `eayczugyrvmtqnnmvjod`, jamais dans les fichiers de migration — une
> migration peut avoir dérivé de la fonction vivante. Les chiffres viennent de `SELECT`.
> Ce qui n'a pas été mesuré est signalé comme tel et n'est pas comblé par une supposition.
>
> Écran concerné : [`src/pages/admin/AdminKybReviewPage.tsx`](../../src/pages/admin/AdminKybReviewPage.tsx)
> (1502 lignes) · hook [`src/hooks/useAdminKybReview.ts`](../../src/hooks/useAdminKybReview.ts)
> Handoff : `docs/handoff/console-admin/HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` §5.13 (`:209-215`), Q9 (`:261`)

---

## 1. L'état réel de la production — à lire avant tout dessin

| Mesure | Valeur |
|---|---|
| Agences en base | **12** |
| dont `pending` | 10 (la plus ancienne attend depuis le **23.03.2026**) |
| dont `manual_review` | **2** |
| Agences avec un `verification_score` non NULL | **0** |
| Dossiers réellement servis par la file | **2** |
| Décisions humaines jamais prises | **0** |
| Types de contrôles au catalogue | 19 (6 vétos, 13 scorables) |
| Types ayant déjà produit au moins une ligne | **9 sur 19** (7 entité + 2 personne) |

**Les 2 dossiers de la file sont des essais.** Tous deux portent `legal_name = 'Juarts'`
(l'agence du développeur), sous les noms `FCKASS` et `ICIASS`, `created_by` NULL, créés les
1er et 3 août — la fenêtre exacte de construction du KYB. **La file réelle est donc vide.**

**Aucun humain n'a jamais utilisé cet écran.** `activity_events` ne porte que
`agency_verification_recomputed` (3) et `agency_verification_run` (3), tous
`actor_kind = 'system'`. `admin_log` compte 61 lignes, **100 % `family = 'ops'`, aucune en
`'kyb'`** — or les 5 gestes de décision écrivent tous dans cette famille.

> **Conséquence méthodologique, qui coupe dans les deux sens.** Aucun retour terrain
> n'existe. Une maquette produite aujourd'hui serait dessinée **exactement aussi à l'aveugle**
> qu'un habillage. Ni « attendons le dessin » ni « habillons tout de suite » n'est mieux
> informé que l'autre.
>
> **Ne pas en conclure que l'écran est superflu.** Le handoff (`:211`) affirme que la file
> est « le passage obligé de presque toutes les agences suisses », et la structure lui donne
> raison : un dossier suisse ne peut pas s'auto-valider tant que `registry_lookup` plafonne à
> `partial` (LINDAS ne publie pas le statut actif/radié). Le volume est faible parce que
> MEGGA a 12 agences, pas parce que l'écran ne sert à rien.

---

## 2. Le périmètre réel de la file — un statut, pas deux

Le handoff §5.13 (`:209`) annonce que la file arbitre les dossiers
« en `manual_review` **/ `correction_requested`** ».

**C'est faux du code livré.** `get_admin_agency_review_queue` filtre
`where a.verification_status = 'manual_review'` en dur, et son `total_count` compte le même
prédicat. Un seul statut est servi.

Cela produit un **angle mort mesurable** : `admin_request_agency_correction` fait passer le
dossier en `correction_requested`, donc **le fait sortir de la seule liste KYB de la
console** — et rien ne permet de le retrouver. La fiche agence ne porte aucune section de
vérification (`grep -in "verif\|kyb" src/pages/admin/AdminAgencyDetailPage.tsx` = 0), alors
que le handoff `:143` la promet et que la règle 2 (`:11`) range la « pilule de vérification
KYB » parmi les amendements **déjà validés par le PO**.

→ **Question ouverte n° 1** (§11).

---

## 3. Contrat de la file — les 8 colonnes, et ce qu'elle ne rend pas

`get_admin_agency_review_queue(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)`
`STABLE SECURITY DEFINER`, `search_path = public`.

**Garde** : `is_super_admin() OR is_service_role()`, en **toute première instruction**, avant
la moindre lecture. Refus = `raise exception` avec `errcode 42501`.

| Colonne | Type | Sémantique |
|---|---|---|
| `agency_id` | `uuid` | clé du dossier |
| `agency_name` | `text` | `coalesce(legal_name, name)` — **la raison sociale prime sur le nom d'usage** |
| `country` | `text` | pays du siège |
| `verification_status` | `text` | toujours `'manual_review'` (conséquence du filtre) |
| `verification_score` | `numeric` | **NULL sur 100 % du corpus** — voir §8 |
| `identity_submitted_at` | `timestamptz` | date de soumission du dossier |
| `verification_sweep_attempts` | `smallint` | tentatives du filet de rattrapage — **0 partout** |
| `total_count` | `bigint` | total des `manual_review`, répété sur chaque ligne |

**Pagination** : `limit least(greatest(p_limit,1),1000) offset greatest(p_offset,0)` — bornes
défensives des deux côtés.

**Tri** : `order by a.verification_score asc nulls first, a.identity_submitted_at asc, a.id asc`.
Déterministe (départage final sur clé primaire, donc pas de perte ni de doublon entre pages).
Mais **la clé primaire du tri est inerte** : le score étant NULL partout, l'ordre effectif
est l'ancienneté de soumission. L'écran se décrit pourtant comme trié par score
([`AdminKybReviewPage.tsx:1421`](../../src/pages/admin/AdminKybReviewPage.tsx:1421)).
→ **Question ouverte n° 4**.

### Ce que la file NE rend PAS

Contrainte dure pour toute maquette : la file ignore le **nombre de contrôles en échec**, le
**nom du signataire**, le **motif d'une décision antérieure**, et la **date du dernier
recalcul**. Une colonne « Pourquoi ce dossier est ici » exige donc, par ligne, un appel
supplémentaire à `get_admin_agency_review_detail`.

> **Ce n'est pas interdit** — c'est l'une des 7 RPC existantes, celle que le handoff ordonne
> de consommer. C'est un coût (N lectures par page ; avec la file actuelle, N = 2), pas une
> violation de la règle 3. Le vocabulaire i18n de cette colonne existe d'ailleurs déjà en
> 4 langues et n'est consommé nulle part (5 clés `kybReview.table.*` mortes).
> → **Question ouverte n° 3**.

---

## 4. Contrat du détail — les 9 colonnes, et trois pièges

`get_admin_agency_review_detail(p_agency_id uuid)` — `STABLE SECURITY DEFINER`, même garde
en première instruction. Renvoie l'`union all` des contrôles **d'entité** et des contrôles
**de personne**, triés `checked_at desc, check_id desc`.

| Colonne | Type | Piège |
|---|---|---|
| `check_id` | `uuid` | |
| `related_person_id` | `uuid` | `NULL` sur les contrôles d'entité — c'est le discriminant des deux moitiés |
| `check_type` | `text` | 19 valeurs au catalogue, 9 seulement déjà observées |
| `source` | `text` | connecteur ayant produit le verdict (`zefix`, `manual`…) |
| `result` | `text` | `match` · `partial` · `mismatch` · `unavailable` · `pending_manual_review` |
| `raw_response` | `jsonb` | ⚠ **contient de la PII** — voir ci-dessous |
| `checked_at` | `timestamptz` | |
| `applicable_weight` | `numeric` | ⚠ **nullable** — voir ci-dessous |
| `is_veto` | `boolean` | ⚠ **nullable** — même cause |

**Piège 1 — `raw_response` porte de la PII.** Le contrôle `pep_sanctions_screening` y stocke
notamment `screened_name`, c'est-à-dire le nom de la personne physique criblée. Afficher ce
JSON brut expose de la donnée personnelle dans la console. → **Question ouverte n° 6**.

**Piège 2 — `applicable_weight` et `is_veto` sont nullables.** Ils viennent d'un
`left join lateral` sur `verification_check_config` borné par la date du contrôle. Si aucune
ligne de configuration ne couvrait `checked_at`, les deux sortent `NULL`. Un écran qui lit
`is_veto === false` traiterait alors un véto comme un contrôle ordinaire.

**Piège 3 — un poids de `0.00` ne veut pas dire « sans importance ».** Les 6 vétos portent
tous `weight = 0.00` **parce qu'ils sont hors score**, pas parce qu'ils comptent pour rien :
leur échec est bloquant et n'est jamais compensé par un bon score ailleurs. Une colonne
« poids » affichée telle quelle ferait lire les contrôles les plus graves comme les plus
négligeables.

> Le poids rendu est celui **en vigueur à la date du contrôle**, jamais le barème courant :
> c'est ce qui permet de rejustifier un score passé. Ne jamais le recalculer côté écran.

---

## 5. Trois écarts entre la RPC de détail et le moteur — que l'écran doit corriger lui-même

La RPC de lecture et `recompute_agency_verification` ne voient pas le même ensemble. Un
écran qui rendrait la RPC telle quelle afficherait autre chose que ce sur quoi le verdict a
été calculé.

| # | La RPC de détail rend… | Le moteur retient… |
|---|---|---|
| 1 | **tout l'historique** des contrôles | le **dernier par type** (`distinct on`) |
| 2 | **toutes** les personnes rattachées à l'agence | les seuls **signataires actifs** (`role='signatory'`, `valid_to` ouvert) |
| 3 | départage `check_id desc` | départage **`ctid desc`** |

L'écart n° 3 est réel mais non matérialisé : `checked_at` vaut `now()` par défaut, soit
l'heure de **début de transaction**, donc deux lignes écrites dans la même transaction
portent le même horodatage et seul le départage les sépare. Aucune collision n'existe
aujourd'hui dans les données. Le jour où elle surviendra, l'écran et le moteur pourront
désigner deux lignes différentes comme « la plus récente ».

---

## 6. La machine à états — 6 valeurs, 2 terminales

`pending` · `auto_validated` · `validated` · `manual_review` · `rejected` · `correction_requested`

- **`manual_review` est le seul état sur lequel 4 des 5 gestes acceptent d'agir.**
- **`validated` et `rejected` sont TERMINAUX** : aucune des 7 RPC n'en fait sortir, et
  `recompute_agency_verification` sort avant tout calcul si le statut est déjà tranché
  (`if v_status in ('rejected','validated','correction_requested') then return`).
  **Une maquette ne peut donc pas proposer d'annuler une décision.**
- **`correction_requested` rouvre le parcours** : la RPC y remet `identity_submitted_at` à
  NULL, ce qui rouvre le gate d'onboarding **et** dégèle les colonnes d'identité légale.
  C'est ce qui la distingue d'un rejet. Mais le dossier quitte alors la file (§2).

---

## 7. Les 5 gestes — gardes, motifs, effets, retours

Toutes les RPC d'écriture : `SECURITY DEFINER`, `search_path = public, pg_temp`, garde
`is_super_admin()` en **première instruction** (et **sans** `is_service_role`, contrairement
aux deux lectures), `select … for update` pour sérialiser un double-clic ou deux relecteurs
simultanés.

> **Toutes échouent par `raise exception`, donc par ROLLBACK.** Aucune ne renvoie une erreur
> métier en committant : une clé d'idempotence ne peut pas être brûlée par un refus.

| Geste | Statut exigé | Motif | Effet | Retour |
|---|---|---|---|---|
| `admin_validate_agency_review` | `manual_review` | — | `validated` + `verified_at = now()` | `{verification_status:'validated'}` |
| `admin_reject_agency_review` | `manual_review` | **obligatoire** (`btrim` ≠ '') | `rejected` + `verified_at = null` | `{verification_status:'rejected'}` |
| `admin_request_agency_correction` | `manual_review` | **obligatoire** | `correction_requested` + `identity_submitted_at = null` + `verified_at = null` | `{verification_status:'correction_requested'}` |
| `admin_relaunch_agency_review` | **aucun** — exige `identity_submitted_at` non NULL | — | appelle le moteur, relit le statut **après** | `{verification_status:<statut APRÈS>}` |
| `admin_resolve_agency_id_document` | `manual_review` | résultat ∈ `match\|partial\|mismatch` | **insère** une nouvelle ligne de contrôle (append-only) | `{result:<p_result>}` |

### Ce que l'écran doit savoir de chaque geste

**`validate` pose `'validated'`, jamais `'auto_validated'`** : cette valeur est réservée au
moteur. Seule une décision humaine pose `validated`.

**Le motif d'un rejet vit dans `metadata`, il n'a aucune colonne dédiée.** Il est écrit deux
fois volontairement — dans `activity_events` et dans `admin_log` — pour qu'un auditeur lisant
le registre MEGGA n'ait pas à joindre le journal de l'agence.

**`relaunch` renvoie `ok: true` même quand elle ne change rien.** Le seul champ qui distingue
« ça a bougé » de « ça n'a rien fait » est `data.verification_status`. Le registre, lui,
consigne explicitement « aucun changement de statut ».

**`resolve_id_document` est le geste le plus gardé** — et le seul dont la matière est prouvée
présente en production. Il vérifie, dans cet ordre : le vocabulaire du résultat ; que le
contrôle est bien de type `id_document` ; que le contrôle **appartient à l'agence annoncée**
(l'`p_agency_id` est traité comme une assertion de l'appelant, vérifiée, jamais comme un
filtre — un filtre resterait muet sur un écart) ; que l'agence est en `manual_review` ; que
la ligne visée est **la plus récente** ; et qu'elle **attend encore**. D'où deux erreurs
distinctes, qui appellent deux gestes différents :

- `id_document check superseded: a more recent line exists for this person` → l'écran est
  périmé, il faut **recharger**, pas réessayer ;
- `id_document check already resolved for this person` → double-clic, **ne rien faire**.

Ces deux messages sont **en anglais et non traduits**, et ce sont les seules informations qui
distinguent les deux situations. → **Question ouverte n° 7**.

> ⚠ **`resolve_id_document` n'appelle PAS le moteur.** Elle insère le verdict et journalise,
> puis s'arrête. Le score et le statut ne sont pas recalculés : le dossier **reste en
> `manual_review`** jusqu'à ce que quelqu'un clique « relancer ». Un relecteur qui tranche
> une pièce d'identité et s'attend à voir le dossier progresser ne verra rien bouger.
> Ce n'est nommé dans aucun document. → **Question ouverte n° 5**.

---

## 8. Le score — pourquoi il est NULL, et pourquoi le « réparer » le rendrait menteur

`recompute_agency_verification` construit une CTE `scored` filtrée sur **deux** conditions :

```sql
where lac.result not in ('unavailable', 'pending_manual_review')   -- résolu
  and not c.is_veto                                                 -- non-véto
```

Le score vaut `sum(weight × résultat) / sum(weight)` sur cette CTE seule, avec
`match = 1`, `partial = 0.5`, `mismatch = 0` — et `null` si `sum(weight) = 0`.

**Le dénominateur ne compte donc que les contrôles résolus et non-véto, jamais le barème
total de 21,50.** C'est ce qui rend le modèle transposable d'un pays à l'autre : un pays sans
source n'est pas pénalisé, seulement moins confirmé.

Aujourd'hui, les 3 seuls contrôles scorables jamais produits — `vat_lookup` (3.00),
`address_geocode` (1.50), `domain_whois_age` (0.75) — sortent **tous** `unavailable`. La CTE
est vide, `sum(weight)` est NULL, **le score est NULL pour tout dossier suisse**.

> ### ⚠ Poser `MAPBOX_TOKEN` ne réparerait pas le score : il le rendrait faux
>
> CLAUDE.md §8 présente ce geste comme « le geste à plus fort effet sur le KYB ». C'est vrai,
> mais l'effet est adverse. Débloquer `address_geocode` en fait **l'unique terme du
> dénominateur** — le score vaudrait alors exactement son seul résultat, soit **1.000** s'il
> réussit. Sur des dossiers dont `registry_legal_name_match` vaut `mismatch`, c'est-à-dire
> dont une source **contredit** la raison sociale déclarée.
>
> Et comme la file trie `verification_score asc nulls first`, ces dossiers passeraient au
> **fond** de la file de priorité, étiquetés « parfait ».
>
> ✅ **L'auto-validation reste bloquée** : un véto en échec force `manual_review` quel que
> soit le score, et la sécurité tient. **Le défaut est de lecture et de priorisation, pas
> d'admission.** Aucune agence n'entrerait en silence.
>
> → **Question ouverte n° 2.**

**Seuils en vigueur** (`get_agency_verification_config()`) : `auto_validate_min = 0.85`,
`review_priority_min = 0.5`. Aucun des trois n'a jamais classé quoi que ce soit, faute de
score.

---

## 9. Pourquoi un dossier est là — 6 codes, 3 atteignables

`qualifyReviewReasons` ([`AdminKybReviewPage.tsx:361-447`](../../src/pages/admin/AdminKybReviewPage.tsx:361))
distingue les situations qui n'appellent pas la même décision. Confrontée aux données réelles :

| Code | Déclenchable aujourd'hui ? |
|---|---|
| `veto_failed` | ✅ `registry_legal_name_match` = `mismatch` sur 2/2 |
| `id_document_pending` | ✅ `id_document` = `pending_manual_review` sur 2/2 |
| `low_score` | ✅ score NULL sur 2/2 |
| `veto_missing_source` | ❌ 0 véto en `unavailable` |
| `no_active_signatory` | ❌ 1 signataire actif sur chaque dossier |
| `sweep_exhausted` | ❌ `verification_sweep_attempts` = 0 partout |

**Les 2 dossiers portent exactement les mêmes 3 raisons et le même nom d'agence** : la file
réelle affiche deux entrées visuellement indiscernables. C'est un artefact du jeu d'essai
(§1), pas une propriété de l'écran — ne pas en tirer d'exigence de maquette.

Deux nuances de vocabulaire que la donnée impose :

- **`low_score` recouvre deux choses très différentes** — « le score est bas » et « le score
  n'est pas calculable ». Aujourd'hui c'est toujours le second, et la cause est une lacune
  d'infrastructure MEGGA, pas un défaut de l'agence. → **Question ouverte n° 8**.
- **`unavailable` recouvre trois causes** — identifiants absents, donnée d'entrée absente,
  refus du fournisseur. Le champ `raw_response.error_type` les distingue déjà
  (`KybSourcePendingCredentialsError` vs `KybSourceNotWiredError`), et le handoff `:212` le
  nomme. Un libellé unique perd la seule information actionnable du lot.
  → **Question ouverte n° 9**.

---

## 10. Ce qui est déjà branché et n'appelle aucun travail front

**Les notifications partent d'un trigger, pas de l'écran.**
`agencies_notify_verification_decision_trg` — `AFTER UPDATE OF verification_status ON agencies`.

- Se déclenche sur une **transition**, jamais sur un état : sans le `is distinct from`, un
  simple changement d'adresse re-annoncerait une validation vieille de six mois.
- **Liste blanche de 4 statuts** : `validated`, `auto_validated`, `rejected`,
  `correction_requested`. `pending` et `manual_review` sont des états d'attente et
  n'envoient rien.
- ⚠ Le handoff parle de « notifications sur les 4 décisions ». C'est **4 statuts**, dont
  `auto_validated` qui est produit par la machine, pas par un humain.
- L'échec de dispatch est **non bloquant** (`exception when others → raise warning`) : une
  décision de conformité ne peut pas échouer parce qu'un courriel n'est pas parti.
- L'edge function **relit le statut en base** ; celui transmis n'est qu'indicatif, parce que
  le worker `pg_net` traite la file avec du retard.

**Chaque geste écrit deux fois** : `activity_events` (catégorie `kyc`, écho produit) et
`admin_log` (famille `kyb`, registre MEGGA). Aucun des deux n'est à construire.

---

## 11. Les questions ouvertes — aucune n'est tranchée ici

| # | Question | Ce qu'il faut pour trancher | Qui | Coût de se tromper |
|---|---|---|---|---|
| 1 | **Q9 telle qu'elle a mué** : acte-t-on la surface déjà livrée, et où ? Le handoff `:215` recommande une section dans l'écran Agences et un détail plein cadre ; le code a déjà posé une **entrée de rail dédiée** ([`AdminShell.tsx:87`](../../src/components/admin/AdminShell.tsx:87)) | confronter la reco au code livré ; noter que la « pilule de vérification KYB » est déjà un amendement validé PO (`:11`) | PO | déménager ensuite = routage + `admin-console-paths.spec.ts` + le lien de la Vue d'ensemble |
| 2 | **Un score calculé sur 1 vérification de 13 s'affiche-t-il comme un score, ou avec sa base ?** (« 1.000 · 1 contrôle sur 13 ») | §8 ; décision à prendre **avant** de poser `MAPBOX_TOKEN`, pas après | PO / conformité | un dossier en `mismatch` affiché « parfait » et relégué au fond de la file |
| 3 | **Périmètre de la file** : `manual_review` seul, ou + `correction_requested` ? Et une colonne « Pourquoi » au prix de N lectures de détail ? | §2, §3 ; savoir si les 10 `pending` sont des comptes réels | PO | un dossier renvoyé en correction disparaît sans vue de suivi |
| 4 | **Le tri** : afficher un axe de repli (ancienneté, gravité) tant que le score est absent, ou laisser la file se dire « triée par score » ? | §3 ; `vat_lookup` (3.00, le plus lourd) restera `unavailable` même après Mapbox | PO | une maquette qui met le score en héros afficherait des tirets |
| 5 | **Résoudre une pièce d'identité ne recalcule rien.** L'écran doit-il enchaîner sur une relance, l'annoncer, ou laisser le relecteur relancer ? | §7 ; c'est le seul geste dont la matière existe en production | PO | le relecteur tranche et croit que rien ne s'est passé |
| 6 | **Que montre l'écran de `raw_response`** (PII : `screened_name`) : rien, un résumé dérivé, un dépliant journalisé ? | arbitrage LPD | PO / conformité | exposition de donnée personnelle dans la console |
| 7 | **Les 2 messages d'erreur anglais** (`superseded` / `already resolved`) : les traduire, et dire quoi ? | §7 ; ce sont les seules informations qui distinguent « recharger » de « ne rien faire » | PO | le relecteur réessaie là où il devrait recharger |
| 8 | **`low_score` recouvre « bas » et « incalculable »** : un libellé ou deux ? | §9 | PO | un titre qui se lit comme un jugement sur l'agence alors que la cause est chez MEGGA |
| 9 | **`unavailable` recouvre 3 causes** : un libellé ou trois ? | §9 ; `raw_response.error_type` existe déjà | PO / maquette | perte de la seule information actionnable |
| 10 | **Confirmation sur « Valider »** : c'est le geste le plus irréversible de l'écran (`validated` est terminal, aucune RPC ne rouvre) et c'est aujourd'hui le **premier bouton, sans dialogue**, quand rejeter et demander une correction en ont un ([`:1209`](../../src/pages/admin/AdminKybReviewPage.tsx:1209)) | §6, §7 | PO / conformité | une agence admise définitivement par un clic |
| 11 | **Lecture de « en attente de design »** (règle 3, `:12`) : interdit-elle tout changement visuel, ou seulement tout élément nouveau ? | rien dans les documents ne le dit ; `PLAN…:44` penche pour le second | PO | décide si même un habillage exige l'amendement de la règle 4 |

---

## 12. Ce que ce document n'a pas mesuré

À ne pas combler par supposition :

1. **Personne n'a ouvert cet écran dans un navigateur.** Aucune capture n'existe, en clair
   comme en sombre. Tout jugement visuel sur la page actuelle est déduit de la source.
2. **Un bug possible, non éprouvé** : `Escape` depuis la modale de motif ferme-t-il aussi le
   tiroir ? Le tiroir écoute en bulle
   ([`:1088`](../../src/pages/admin/AdminKybReviewPage.tsx:1088)), la visionneuse d'identité
   se protège en capture ([`:836`](../../src/pages/admin/AdminKybReviewPage.tsx:836)), la
   modale de motif n'a pas d'équivalent. Un clic tranche.
3. **Le type JSON de `verification_score`** une fois non NULL (`numeric` Postgres →
   `.toFixed(3)` côté écran). Aucun dossier scoré n'existe, donc non mesurable aujourd'hui.
4. **Les 2 dossiers d'essai** : leur nature est déduite de `legal_name = 'Juarts'`,
   `created_by` NULL et de leur date de création. À confirmer d'un mot par Gregory ou Julien.
