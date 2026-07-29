# KYB — le connecteur LINDAS et le format du numéro de registre

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`.

**Goal :** servir trois des quatre vétos d'entité pour la Suisse sans attendre les
identifiants Zefix, et le quatrième — le format du numéro — pour la Suisse comme pour la
France, par un calcul qui ne demande aucun réseau.

**Architecture :** deux connecteurs de plus dans `supabase/functions/_shared/kyb-sources.ts`.
Le premier interroge LINDAS, l'entrepôt de données liées de la Confédération, qui publie le
registre du commerce Zefix en SPARQL public. Le second ne sort pas du processus : il vérifie
la clé de contrôle du numéro déclaré.

**Ce que l'étape 6 ignorait.** Elle a posé un squelette Zefix en attendant des identifiants
REST, sans savoir que le dépôt contenait déjà `scripts/zefix-enrich-agencies.mjs`, qui lit
les mêmes données par une voie publique. Ce plan remplace le squelette par un connecteur qui
fonctionne.

---

## Ce qui a été vérifié en direct avant d'écrire ce plan

Rien de ce qui suit n'est supposé. Tout a été mesuré le 29.07.2026 contre les services réels.

**L'identifiant est un nœud, pas une chaîne.** Un `schema:identifier` de LINDAS pointe vers
un `schema:PropertyValue` portant `schema:name "CompanyUID"` et `schema:value "CHE105909036"`
— sans séparateurs, là où une agence saisit `CHE-105.909.036`.

**La forme de la requête décide de sa vitesse.** Filtrer les identifiants par `STRENDS` sur
l'URI met **14 secondes** : c'est un scan des 2,37 millions d'identifiants. Interroger le
littéral `schema:value` met **0,147 seconde**. Seule la seconde forme est utilisable sous le
budget de 10 s d'un connecteur.

**Un même UID porte plusieurs raisons sociales.** `CHE105909036` rend deux entrées Zefix,
`Nestlé S.A.` et `Nestlé AG`, chacune avec sa propre commune. Ce sont les versions
linguistiques officielles du nom, toutes deux inscrites au registre.

**Le statut actif n'existe pas dans le graphe.** L'inventaire des prédicats le confirme :
`legalName`, `name`, `address`, `municipality`, `additionalType`, `description`,
`identifier` — et rien sur l'état de l'entité. C'est ce que l'en-tête du script du dépôt
annonçait déjà (« présence ≈ inscrite au RC »).

**La clé de contrôle CHE se vérifie.** Poids `[5,4,3,2,7,6,5,4]` sur les huit premiers
chiffres, somme modulo 11, clé = 11 − reste (10 invalide, 11 vaut 0). Éprouvé sur **200 UID
réels tirés de LINDAS : 200 valides, 0 rejeté à tort**.

**Le SIREN suit Luhn, sans exception au niveau du SIREN.** Éprouvé sur 15 SIREN réels tirés
de `recherche-entreprises`. La Poste, dont le cas est le contre-exemple classique, porte
`356000000` qui **passe** Luhn : l'exception française porte sur le SIRET des établissements,
pas sur le SIREN. Un numéro fabriqué (`403265452`) est bien rejeté.

---

## Global Constraints

- Edge Functions en Deno. `_shared/kyb-sources.ts` reste un **module pur** : aucun `import`,
  aucun `Deno.env.get`, importable tel quel depuis vitest/Node.
- **Aucun résultat inventé.** Une source qui ne répond pas produit `unavailable` avec la
  raison jointe, jamais un `match` par défaut.
- **L'exclusivité de juridiction est un invariant, pas une préférence.** Le moteur ne garde
  qu'une ligne par `check_type` (`distinct on … order by … ctid desc`) : deux sources
  applicables au même siège pour un même type feraient dépendre un véto de l'ordre
  d'insertion. La matrice du volet « harnais pur » doit rester verte, et elle doit voir les
  nouvelles sources.
- **Un véto ne se pose sur `match` que si la preuve est entière.** `partial` ne fait pas
  passer un véto : c'est voulu, et c'est ce qui distingue « l'entité existe » de « l'entité
  existe et elle est active ».
- TypeScript strict, aucun `any`. Apostrophes ASCII droites, aucun tiret cadratin ni
  demi-cadratin dans le code.
- Commentaires en français disant le **pourquoi**, à la densité du fichier.
- Migration idempotente, datée au-dessus de `20260729151800` et jamais antérieure au jour du
  merge en UTC — le garde-date de `deploy.yml` saute tout ce qui est plus ancien.

---

## Interfaces posées par ce chantier

```ts
// _shared/kyb-sources.ts

/** Sources LINDAS (registre du commerce suisse, SPARQL public sans authentification).
 *  Trois entrées, juridiction CH. `endpoint` injecté pour que les tests puissent
 *  viser un stub sans toucher au reseau reel ; aucune cle, aucun secret. */
export function createLindasSources(endpoint?: string): KybSource[]   // 3 sources

/** Format et cle de controle du numero de registre. Aucun reseau : une entree
 *  statique de AGENCY_KYB_SOURCES, pas une fabrique. */
export const registryNumberFormatSource: KybSource                     // 1 source

/** Exportees pour les tests, et parce qu'un calcul de conformite doit etre
 *  verifiable isolement. */
export function isValidSwissUid(raw: string): boolean
export function isValidFrenchSiren(raw: string): boolean
```

Aucune variable d'environnement : LINDAS est public.

---

## Task 1 : le format du numéro de registre

**Files:**
- Créer : `supabase/migrations/<jour>__agency_check_source_internal.sql`
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Le seul des quatre vétos d'entité qui ne dépend d'aucun tiers, et le dernier qui n'a aucun
propriétaire. Il est indépendant de la tâche 2 : commence par lui.

**La migration d'abord, et elle est petite.** La contrainte `agency_verification_checks.source`
énumère des sources externes (`zefix`, `vies`, `rdap`…) et n'a aucune valeur pour un contrôle
qui ne sort pas du processus. Ajoute `'internal'`. Ne réutilise pas `'manual'` : il désigne
une saisie humaine, et un relecteur qui verrait `manual` sur un check calculé croirait qu'un
humain l'a posé — sur une piste d'audit LAB, c'est un contresens.

**Les deux algorithmes**, exactement tels qu'éprouvés plus haut :

- Suisse — `CHE` suivi de neuf chiffres, séparateurs de saisie (`-`, `.`, espaces) retirés
  avant calcul. Poids `[5,4,3,2,7,6,5,4]` sur les huit premiers chiffres, `11 - (somme % 11)`
  donne la clé ; un reste qui donnerait 10 rend le numéro invalide, 11 vaut 0.
- France — neuf chiffres, Luhn. Pas de traitement particulier pour La Poste : la vérification
  ci-dessus montre que son SIREN passe Luhn, l'exception ne concerne que le SIRET.

**Juridiction et applicabilité :** `CH` et `FR`. Un numéro absent ou d'une forme qui n'est ni
l'une ni l'autre lève, donc `unavailable` — jamais `mismatch` : ne pas savoir lire un numéro
n'est pas la même chose que constater qu'il est faux, et ce check est un **véto**.

**Tests :** les deux algorithmes sur des numéros réels (au moins dix UID et cinq SIREN, ceux
mesurés plus haut font l'affaire) et sur des numéros altérés d'un chiffre, qui doivent tous
être rejetés ; `CHE` mal formé, numéro absent, pays non couvert, séparateurs de saisie ;
le check écrit bien sous `registry_number_format` avec `source='internal'` ; et le cas qui
compte pour la conformité, adossé à la base : un numéro faux pose un véto en échec et le
dossier part en revue humaine.

---

## Task 2 : le connecteur LINDAS

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `supabase/functions/agency-verification-run/index.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Trois sources de `source: 'zefix'`, juridiction `CH`, interrogeant
`https://lindas.admin.ch/query` par `POST` (`Content-Type: application/x-www-form-urlencoded`,
`Accept: application/sparql-results+json`), sur la forme indexée établie plus haut.

| `checkType` | Absent du graphe | Présent |
|---|---|---|
| `registry_lookup` | `mismatch` — le registre a répondu, ce numéro n'y est pas | `partial` — l'existence est confirmée, **le statut actif n'est pas exposé** |
| `registry_legal_name_match` | lève → `unavailable`, rien à comparer | `match` si la raison sociale déclarée égale l'une des `legalName` rendues, sinon `mismatch` |
| `registry_country_match` | lève → `unavailable` | `match` — l'entité est inscrite au registre suisse |

**`registry_lookup` ne peut pas valoir `match`, et c'est le cœur du sujet.** LINDAS ne publie
pas l'état de l'entité : une société radiée y figure comme une société active. Poser `match`
signifierait « existe et active » sur une preuve qui ne porte que la moitié. `partial` est le
verdict honnête, il ne fait pas passer le véto, et la Suisse reste donc non auto-validable —
comme avant, mais pour une raison désormais précise et écrite. **C'est là, et nulle part
ailleurs, que l'appel REST Zefix viendra se greffer le jour où les identifiants arrivent :**
il apporte le statut, et ce seul check passe alors de `partial` à `match`. Le commentaire de
section doit le dire, puisque le squelette qui le disait disparaît (voir plus bas).

**Comparer contre `legalName` uniquement, jamais `schema:name`.** Un même UID rend plusieurs
`legalName` — les versions linguistiques officielles, toutes inscrites — et les accepter
toutes est juste. `schema:name` porte en revanche des dénominations qui ne sont pas la raison
sociale ; les y mêler fabriquerait des `match` sur autre chose que ce que le véto vérifie.
Réutilise `normalizeLegalNameStrict`, déjà écrite et déjà corrigée deux fois en revue.

**Le squelette Zefix REST disparaît.** `createZefixSources` revendiquait ces trois types pour
`CH` : le garder ferait deux propriétaires applicables au même siège, exactement ce que la
règle de juridiction interdit. Retire-le, et emporte avec lui ce qui n'a plus d'objet.
`KybSourcePendingCredentialsError` et `KybSourceNotWiredError` restent **utilisées par le
squelette du registre UID** (`vat_lookup`, CH/LI), qui n'est pas concerné : LINDAS ne dit rien
de la TVA. Vérifie ce point plutôt que de supprimer trop large.

**Tests :** `fetch` stubbé, aucun réseau réel — motif des connecteurs existants. Réponse à
deux entrées (le cas Nestlé, mesuré) ; UID absent du graphe ; réponse hors schéma ; erreur
HTTP ; corps illisible ; timeout ; UID saisi avec séparateurs ; raison sociale correspondant à
la seconde entrée et non à la première ; et le fait qui porte tout : **un dossier suisse
autrement parfait reste en `manual_review`, parce que `registry_lookup` vaut `partial`.**

---

## Task 3 : la concordance de pays pour la France

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Une fois les tâches 1 et 2 livrées, un dossier **français** n'est plus retenu que par un seul
véto sans propriétaire : `registry_country_match`. Le connecteur `recherche-entreprises` avait
écarté ce check en jugeant qu'il confirmerait trivialement un pays qui a déjà filtré l'appel.
La tâche 2 retient l'argument inverse pour la Suisse — trouver le numéro déclaré **dans le
registre de la juridiction déclarée** est une confirmation réelle. Garder les deux
raisonnements en même temps serait incohérent.

Ajoute donc une quatrième entrée `recherche_entreprises`, juridiction `FR`, sur
`registry_country_match` : SIREN trouvé → `match` ; introuvable → lève, donc `unavailable`
(l'existence est déjà portée par `registry_lookup`, inutile de dupliquer le même constat).

**À signaler en revue :** après cette tâche, un dossier français dont tous les vétos passent
n'est plus retenu que par la pièce d'identité, en `pending_manual_review` jusqu'à décision
humaine. C'est-à-dire que **la France devient auto-validable dès qu'un humain résout la
pièce**. C'est un changement de régime réel : jusqu'ici aucun dossier d'aucun pays ne pouvait
aboutir sans intervention sur les vétos eux-mêmes. Le §7bis du handoff, qui démontre le
contraire, devra être réécrit — c'est la tâche 4.

---

## Task 4 : vérification et documentation

- [ ] `npm run test:backend` en entier après `supabase db reset`, en lisant le **compte** de
      tests. `npx vitest run`, `npm run lint`, `lint:prose`, `lint:roster`, `lint:migrations`,
      `npm run build`.
- [ ] `docs/agency-kyb-handoff.md` : le §7bis démontre qu'aucun dossier ne peut être
      auto-validé. Ce n'est plus vrai pour la France. Réécris-le sur mesure, en distinguant
      pays par pays ce qui reste bloquant, et **sans promettre** : la Suisse reste retenue par
      `registry_lookup`, faute de statut actif. Le §8 doit dire que LINDAS a levé une partie
      du blocage Zefix, et ce qui reste suspendu aux identifiants.
- [ ] `docs/agency-kyb-verification.md` §3 : la ligne « Registre entreprise » suisse passe de
      bloquée à servie par LINDAS, avec sa limite.
- [ ] `docs/system-map.md` et `.claude-flow/knowledge/megga-memory.seed.json` (entrées
      `megga/agency-verification-connectors` et `megga/agency-verification-pending-sources`),
      puis `npm run ruflo:seed` après validation du JSON.

---

## Ce qui n'est pas dans ce chantier

**Le statut actif d'une entité suisse.** Il n'existe pas dans LINDAS et reste suspendu aux
identifiants Zefix REST, demandés et sans réponse.

**Le registre UID/TVA** (`vat_lookup`, CH/LI) : LINDAS ne le couvre pas, son squelette reste
en l'état.

**`address_registry_match` et `activity_code_match`**, que LINDAS pourrait servir
(`schema:address`, `municipality`, `additionalType`). Ce sont des signaux moyens ; ce chantier
ne traite que ce qui débloque un véto.

**Le Liechtenstein**, dont le registre n'a toujours aucune API publique connue.
