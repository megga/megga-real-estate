# Onboarding KYB — étape 6 : le squelette des connecteurs Zefix et UID

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`.

**Goal :** poser les connecteurs du registre suisse (Zefix) et du registre UID/TVA de
façon qu'il ne reste, le jour où les identifiants arrivent, que **l'URL, l'authentification
et l'analyse de la réponse** à écrire — sans qu'aucun dossier ne change de verdict d'ici là.

**Architecture :** deux fabriques de connecteurs dans
`supabase/functions/_shared/kyb-sources.ts`, sur le motif exact de
`createAddressGeocodeSource` (tâche 3 de l'étape 4) : ces sources ont besoin d'un secret,
elles ne peuvent donc pas vivre dans `AGENCY_KYB_SOURCES`, une liste construite au
chargement du module avant qu'aucun jeton ne soit lu. `agency-verification-run/index.ts`
les construit à partir de `Deno.env`. Tant que les identifiants manquent, elles lèvent —
et `runKybSource()` traduit ce throw en `unavailable`, comme pour n'importe quelle source
injoignable.

**Conception de référence :** [handoff §7bis, §7ter et §8](../../agency-kyb-handoff.md),
[inventaire des sources §3](../../agency-kyb-verification.md),
[plan de l'étape 4](2026-07-28-onboarding-kyb-etape-4.md) pour le motif des connecteurs.

---

## Ce que cette étape doit régler en plus d'ajouter deux connecteurs

Ajouter Zefix, c'est faire écrire `registry_lookup` et `registry_legal_name_match` par une
**deuxième** source. Ces deux types n'ont aujourd'hui qu'un seul propriétaire, le registre
français. La même chose vaut pour `vat_lookup`, que VIES est seul à écrire et que le
registre UID écrira aussi.

Or le moteur ne garde qu'**une** ligne par type : `distinct on (check_type) … order by
check_type, checked_at desc, ctid desc` (20260728130000). Deux lignes écrites dans la même
transaction portent le même `checked_at` — c'est la **dernière insérée** qui gagne, donc
l'ordre du tableau passé à `record_agency_verification_run`.

Conséquence si on se contente d'ajouter les connecteurs : le jour où Zefix répond, un
dossier suisse porterait deux `registry_lookup` — le `match` de Zefix, et l'`unavailable`
que le connecteur français produit déjà pour tout siège hors de France (« siège hors
France, source non interrogée »). Selon l'ordre d'insertion, **l'`unavailable` masquerait
le `match`**, c'est-à-dire qu'un véto réellement satisfait se lirait comme un véto absent.
Aujourd'hui les deux valent `unavailable` et rien ne se voit : le piège se refermerait
exactement le jour où quelqu'un branche l'URL, en croyant n'avoir touché qu'au parsing.

**Ce plan choisit de rendre la collision impossible plutôt que de la documenter.** Une
source déclare la juridiction qu'elle couvre ; on ne l'interroge pas hors de cette
juridiction. Zefix couvre `CH`, le registre français `FR`, le registre UID `CH`/`LI`, VIES
tout le reste : deux propriétaires du même `check_type` ne peuvent alors jamais s'appliquer
à la même agence, et l'ordre d'insertion cesse d'être porteur de sens.

Écarté délibérément : faire préférer au moteur un résultat tranché à un `unavailable`. Ce
serait laisser un `match` d'hier survivre à la panne d'aujourd'hui — un dossier
continuerait d'afficher une vérification que plus rien ne soutient. « La dernière ligne
gagne, sans exception » est la bonne règle pour une piste d'audit ; c'est en amont qu'il
faut éviter d'écrire deux lignes concurrentes.

---

## Global Constraints

- Edge Functions en Deno, dans `supabase/functions/`. Code partagé dans `_shared/`.
- `_shared/kyb-sources.ts` reste un **module pur** : aucun `import`, aucun `Deno.env.get`,
  importable tel quel depuis vitest/Node. Les secrets se lisent dans
  `agency-verification-run/index.ts` et s'injectent en paramètre.
- **Aucun résultat inventé.** Une source qui ne répond pas produit `unavailable` avec la
  raison jointe, jamais un `match` par défaut, jamais une absence de ligne pour une source
  qu'on a réellement interrogée.
- **Aucun verdict ne doit changer dans cette étape.** `unavailable` est exclu du numérateur
  et du dénominateur, un véto absent ne passe pas : à la fin de l'étape, un dossier suisse
  part toujours en revue humaine, comme avant. C'est le critère de non-régression.
- TypeScript strict, aucun `any`. Apostrophes ASCII droites, aucun tiret cadratin ni
  demi-cadratin (`npm run lint:prose`).
- Commentaires en français disant le **pourquoi**. Pas de glose ligne à ligne.
- `activity_events` : `category` vaut `'kyc'`, `severity` dans `info | warn | critical`, et
  avec `actor_kind='system'` le champ `actor_id` **doit** être NULL.
- Le `source` d'un check est contraint en base :
  `zefix | uid_register | vies | recherche_entreprises | insee_sirene | oera_li | rdap |
  gleif | mapbox | cci_immobilier | manual` (20260728103000). `zefix` et `uid_register` y
  sont déjà — **aucune migration n'est nécessaire dans cette étape**, et le catalogue
  `verification_check_types` porte déjà les quatre types visés.
- Ne rien deviner sur Zefix ni sur le registre UID : l'un renvoie `401`, l'autre n'a jamais
  été testé en API. Aucune URL, aucun schéma de réponse, aucun en-tête d'authentification
  ne doit être écrit « au plus probable ». Ce qui n'est pas connu reste une valeur de
  configuration vide et un commentaire qui dit quoi remplir.
- Vérification locale : la pile Supabase tourne (`http://127.0.0.1:54321`) et
  `.env.test.local` porte les clés — les specs backend s'exécutent **pour de vrai** ici,
  ne pas se contenter d'un `skipIf` vert.

---

## Interfaces posées par cette étape

Signatures exactes, pour que chaque tâche sache ce que les autres exposent.

```ts
// _shared/kyb-sources.ts

/** Ajout au contrat existant. Absent = la source s'applique toujours (RDAP, Mapbox). */
export interface KybSource {
  checkType: string
  source: string
  appliesTo?: (agency: AgencyForVerification) => boolean
  run: (agency: AgencyForVerification, signal: AbortSignal) => Promise<KybSourceResult>
}

/** Une source écartée avant exécution : trace pour le journal du passage, jamais une
 *  ligne de check (rien n'a été demandé à cette source). `jurisdiction_undeterminable`
 *  est posée quand le prédicat lui-même a levé (revue tâche 1) : on écarte plutôt que
 *  d'inclure, sans quoi deux sources d'un même type redeviendraient applicables
 *  ensemble — exactement la collision que cette règle existe pour interdire. */
export interface SkippedKybSource {
  check_type: string
  source: string
  reason: 'jurisdiction_not_covered' | 'jurisdiction_undeterminable'
}

export function selectApplicableSources(
  agency: AgencyForVerification,
  sources?: KybSource[],
): { applicable: KybSource[]; skipped: SkippedKybSource[] }

export class KybSourcePendingCredentialsError extends Error {} // name identique
export class KybSourceNotWiredError extends Error {}           // name identique

export interface PendingSourceConfig {
  baseUrl: string
  credential: string
}

export function createZefixSources(config: PendingSourceConfig): KybSource[]        // 3 sources
export function createUidRegisterSources(config: PendingSourceConfig): KybSource[]  // 1 source
```

Variables d'environnement lues par `agency-verification-run/index.ts`, toutes optionnelles
et vides aujourd'hui : `ZEFIX_API_URL`, `ZEFIX_API_CREDENTIAL`, `UID_REGISTER_API_URL`,
`UID_REGISTER_API_CREDENTIAL`.

---

## Task 1 : la juridiction d'une source, et l'exclusivité qu'elle garantit

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `supabase/functions/agency-verification-run/index.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Aucun connecteur nouveau dans cette tâche : on pose d'abord la règle qui empêchera les deux
suivantes de créer une collision, et on la prouve pendant qu'elle est encore vérifiable sur
l'existant.

`appliesTo` s'ajoute au contrat `KybSource`, facultatif — une source sans juridiction
déclarée s'applique toujours, ce qui laisse RDAP et Mapbox strictement inchangés (ils sont
seuls propriétaires de leurs types). `selectApplicableSources()` sépare les sources
applicables des sources écartées ; `runAgencyKybSources()` garde exactement sa signature et
son contrat actuels (elle rend toujours une ligne par source **qu'on lui donne**) — c'est
`index.ts` qui filtre avant d'appeler, puis joint la liste des écartées à `p_metadata` sous
`sources_skipped`, de sorte que le journal du passage dise ce qui n'a pas été demandé et
pourquoi.

Juridictions à déclarer sur les connecteurs existants, en comparant `agency.country` après
`trim()` et `toUpperCase()` (le connecteur français compare déjà `=== 'FR'` ; on ne change
pas la valeur testée, seulement le moment où on la teste) :

| Source | S'applique quand |
|---|---|
| `registry_lookup` / `registry_legal_name_match` (recherche_entreprises) | pays `FR` |
| `vat_lookup` (vies) | pays renseigné et **ni `CH` ni `LI`** |
| `domain_whois_age` (rdap), `address_geocode` (mapbox) | toujours — pas de `appliesTo` |

Le gabarit VIES est volontairement « tout sauf CH/LI » et non « les 27 États membres » :
seule la disjonction avec le registre UID est nécessaire à la démonstration, et une agence
allemande doit rester interrogeable sans qu'on ait à retoucher une liste. Le connecteur
rejette déjà lui-même un préfixe de TVA que VIES ne couvre pas.

**Changement de comportement assumé**, à signaler en revue : une agence sans pays déclaré
ne reçoit plus de lignes `registry_lookup`, `registry_legal_name_match` ni `vat_lookup`
(elle en recevait trois, toutes `unavailable`). Une agence suisse n'en reçoit plus deux
« siège hors France ». Le moteur traite déjà `unavailable` et « ligne absente » à
l'identique, et la trace de ce qui n'a pas été interrogé passe dans `sources_skipped`.
Une agence française, seul pays réellement couvert aujourd'hui, ne change en rien.

> **Corrigé après la revue finale.** Ce paragraphe affirmait ici qu'aucun score ni statut
> ne bougeait. C'était vrai d'une source qui aurait de toute façon produit `unavailable`,
> et faux d'une source **écartée qui aurait tranché** : VIES n'avait aucune juridiction
> avant cette étape, donc elle répondait aussi pour un siège CH ou sans pays déclarant
> une TVA à préfixe européen, et son verdict pesait 3.00 au score. L'écarter faisait
> monter le score, jusqu'à basculer en `auto_validated` un dossier qui partait en revue
> humaine — mesuré contre le moteur : 0.200 puis 1.000. Le correctif fait porter la
> propriété de `vat_lookup` par le **préfixe de TVA déclaré** avant le pays du siège, de
> sorte que le verdict d'avant l'étape soit rendu à l'identique dans les huit
> combinaisons. La leçon vaut au-delà de ce cas : « le moteur traite `unavailable` et
> ligne absente à l'identique » ne dit rien du verdict qu'une source aurait rendu si on
> l'avait laissée répondre.

**Tests :**
- Matrice d'exclusivité, le test qui porte toute la tâche : pour chaque pays de
  `['CH', 'FR', 'LI', 'DE', null]`, aucune paire de sources applicables ne partage un
  `check_type`. Il doit couvrir le registre complet tel qu'`index.ts` le compose (les
  entrées de `AGENCY_KYB_SOURCES` **plus** le géocodage, plus, aux tâches 2 et 3, Zefix et
  UID) — sinon il ne protège pas ce qu'il prétend protéger.
- Une source sans `appliesTo` n'est jamais écartée, quel que soit le pays.
- Une source écartée ne produit **aucune** ligne de check, et figure dans `skipped` avec son
  `check_type`, sa `source` et sa raison.
- `runAgencyKybSources()` inchangée : toutes les assertions existantes du fichier restent
  vertes sans être réécrites (elle rend toujours `sources.length` lignes).
- Bout en bout, contre la fonction déployée : une agence `FR` écrit toujours ses cinq
  checks ; une agence `CH` en écrit moins et son `p_metadata.sources_skipped` nomme les
  sources françaises. Adapter les assertions de comptage existantes plutôt que les
  supprimer.

---

## Task 2 : le squelette Zefix

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `supabase/functions/agency-verification-run/index.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

`createZefixSources(config)` rend **trois** sources de `source: 'zefix'`, juridiction `CH` :

| `checkType` | Ce que Zefix apportera | Véto |
|---|---|---|
| `registry_lookup` | existence au registre et statut actif | oui |
| `registry_legal_name_match` | raison sociale déclarée ↔ raison sociale du registre | oui |
| `registry_country_match` | juridiction du registre ↔ pays déclaré | oui |

Trois sources et non une : une `KybSourceResult` ne porte qu'un `check_type`, et le
registre français a déjà tranché ce point de la même façon — deux entrées interrogeant le
même point d'API, couplage accepté (une poignée d'appels par vérification).

`registry_country_match` mérite d'être justifié plutôt que subi : le connecteur français l'a
laissé de côté au motif qu'il n'interroge que des sièges déjà déclarés en France, une
réponse positive ne confirmant alors rien qu'on ne sache. L'arbitrage retenu ici est
inverse, et c'est délibéré : trouver le numéro déclaré **dans le registre de la juridiction
déclarée** est une confirmation réelle, pas une tautologie — c'est la seule chose qui
distingue « cette entité est enregistrée en Suisse » de « cette agence prétend être suisse ».
C'est aussi l'un des deux vétos que le [handoff §7bis](../../agency-kyb-handoff.md) désigne
comme bloquant l'auto-validation de tout dossier, de tout pays. À signaler en revue :
combler ce véto pour `CH` seulement laisse `FR` sans lui, donc toujours non
auto-validable — asymétrie assumée, à traiter hors de cette étape.

**Structure du connecteur et gestion d'erreur** — c'est le cœur de la tâche :

- Les trois sources partagent un même constructeur interne, paramétré par le `check_type`
  et un libellé : rien de ce qui reste à écrire (URL, authentification, parsing) ne doit
  exister en trois exemplaires à recopier.
- `run()` lève `KybSourcePendingCredentialsError` tant que `baseUrl` **ou** `credential` est
  vide — le cas d'aujourd'hui. `runKybSource()` le traduit en `unavailable`, et
  `describeSourceFailure()` joint `error_type` et `message` : un relecteur de la file admin
  lit « en attente d'identifiants », pas un `unavailable` nu.
- `run()` lève `KybSourceNotWiredError` si la configuration **est** présente. Deux erreurs
  distinctes plutôt qu'une seule, parce qu'elles appellent deux gestes différents : la
  première attend une réponse de `zefix@bj.admin.ch`, la seconde signale que quelqu'un a
  posé les secrets sans brancher le connecteur — une situation qui, sans ce garde-fou,
  produirait un `unavailable` silencieux et permanent que personne ne relierait à la
  configuration qu'il vient de poser.
- Aucun `fetch`, aucune URL, aucun schéma de réponse écrit « par anticipation ». Le
  commentaire de section énumère les trois gestes qui resteront, dans l'ordre, et renvoie au
  §8 du handoff pour l'état de la demande d'identifiants.
- Le message d'erreur ne doit jamais porter `credential`, ni rien qui en dérive.

**Tests :**
- Sans configuration : chacune des trois sources produit `unavailable`, avec
  `raw_response.error_type === 'KybSourcePendingCredentialsError'` et le `check_type`
  attendu.
- Avec configuration : `unavailable` également, mais `error_type` vaut
  `KybSourceNotWiredError` — la distinction est le garde-fou, elle doit être vérifiée.
- Aucune requête réseau n'est tentée dans les deux cas (stub de `fetch` qui échoue le test
  s'il est appelé, motif déjà employé par les tests RDAP de ce fichier).
- Le `credential` n'apparaît nulle part dans `raw_response` sérialisé, dans aucun des deux
  cas.
- Juridiction : les trois sources s'appliquent à `CH`, à aucun autre pays, ni à un pays
  absent. La matrice d'exclusivité de la tâche 1 les inclut désormais.

---

## Task 3 : le squelette du registre UID, et la preuve en base

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`
- Modifier : `supabase/functions/agency-verification-run/index.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

`createUidRegisterSources(config)` rend **une** source : `check_type` `vat_lookup`,
`source: 'uid_register'`, juridiction `CH` **et** `LI` — le FL-UID liechtensteinois dérive
du système suisse par l'union douanière et porte le même préfixe `CHE`
([conception §3](../../agency-kyb-verification.md)). Même constructeur interne, mêmes deux
erreurs, mêmes interdits que la tâche 2. Une fabrique rendant un tableau, comme Zefix, pour
que l'ajout d'un second type UID plus tard ne change pas la façon dont `index.ts` l'appelle.

Le statut de cette source diffère de celui de Zefix et le commentaire doit le dire : Zefix a
répondu `401`, on sait donc qu'il existe et ce qu'il attend ; le registre UID **n'a jamais
été testé en API** et la question « API séparée ou champ Zefix ? » n'est pas tranchée. Si la
réponse est « champ Zefix », cette source disparaîtra au profit d'un quatrième type servi
par le connecteur Zefix — ce que la structure permet sans rien casser ailleurs.

**La preuve demandée**, dans le `describe` adossé à la base (la pile locale tourne, ce test
doit passer pour de vrai). Motif de fixture à reprendre :
`tests/backend/agency-verification-engine.spec.ts:94` (`createAgency`) et ses cas
« veto-absent » (l. 282) et « unavailable » (l. 317).

1. Une agence suisse dont **tout le reste est parfait** : signataire actif, checks de
   personne résolus en `match`, tous les signaux d'entité scorables en `match`. Appeler
   `agency-verification-run`, puis constater : les quatre lignes `zefix`/`uid_register`
   existent, toutes `unavailable`, aucune absente ; `verification_status` vaut
   `manual_review` et `veto_failed` est vrai.
2. Le contrôle qui rend la preuve concluante, sur le motif de la démonstration du §7bis : la
   même agence, plus quatre lignes de véto `match` insérées à la main
   (`registry_number_format`, `registry_lookup`, `registry_legal_name_match`,
   `registry_country_match`), rappeler le moteur — le dossier bascule en `auto_validated`.
   Sans ce second temps, le premier ne prouve pas que ce sont bien les sources injoignables
   qui retiennent le dossier.

**Test de non-régression, à ne pas oublier :** un dossier français reste exactement dans
l'état où l'étape 4 l'a laissé, mêmes checks, même statut. C'est le seul pays réellement
couvert ; si cette étape le déplace, elle a cassé quelque chose.

---

## Task 4 : vérification d'ensemble et documentation

- [ ] `npm run test:backend` en entier, en **lisant le compte de tests** — pas seulement le
      code de sortie. Les specs backend s'exécutent réellement ici : un `skipIf` vert n'est
      pas un test passé.
- [ ] `npm run lint`, `npm run lint:prose`, `npm run lint:roster`, `npm run lint:migrations`,
      `npm run build`.
- [ ] `docs/agency-kyb-handoff.md` : étape 6 passée à « squelette posé » dans le tableau du
      §7ter ; une section §6 qui dit ce qui est câblé, ce qui reste (URL, authentification,
      parsing), et le fait que la règle de juridiction interdit désormais deux sources sur un
      même type ; §8 complété des quatre noms de variables d'environnement attendues.
- [ ] `CLAUDE.md` : `ZEFIX_API_URL`, `ZEFIX_API_CREDENTIAL`, `UID_REGISTER_API_URL`,
      `UID_REGISTER_API_CREDENTIAL` dans les secrets Supabase attendus, marqués comme non
      encore configurés — même précédent que `MAPBOX_TOKEN` (commit `46f8c7f4`).
- [ ] Cerveau système : `.claude-flow/knowledge/megga-memory.seed.json`, puis
      `npm run ruflo:seed` après validation du JSON.

---

## Ce qui n'est pas dans cette étape

**`registry_number_format`**, le quatrième véto d'entité sans connecteur. Il ne dépend
d'aucun identifiant — clé de contrôle du numéro `CHE` (modulo 11) et du SIREN, un calcul pur
sans réseau. Il n'est donc pas bloqué, et le traiter ici brouillerait la seule chose que
cette étape prétend faire : préparer ce qui attend une réponse de l'extérieur. C'est un
travail réel et court, à mener séparément — et il reste, après cette étape, le dernier véto
qui empêche un dossier suisse par ailleurs complet d'être auto-validé.

**`signatory_registry_match`**, que Zefix pourrait pourtant alimenter (les organes figurent
au registre). C'est un check de **personne**, et `record_agency_verification_run` n'écrit
que dans `agency_verification_checks` : l'accueillir demanderait d'étendre la RPC, donc une
migration et un tour de revue qui n'ont rien à voir avec le squelette demandé.

**`address_registry_match` et `activity_code_match`**, deux signaux moyens que Zefix et le
registre UID pourraient servir. Hors du périmètre « ce qui débloque un véto », à rouvrir
quand les sources répondront et qu'on saura ce qu'elles renvoient vraiment.

**GLEIF**, à retester depuis une Edge Function réelle avant d'en conclure quoi que ce soit —
le sandbox d'outils d'Antoine ne prouve rien sur GLEIF.

**`oera.li`**, sans API publique connue : le Liechtenstein reste en revue manuelle pour son
registre du commerce, seul son numéro de TVA étant couvert par le squelette UID.
