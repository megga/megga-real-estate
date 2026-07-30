# Onboarding client (KYB agences) : relais vers l'équipe API

> **⚠ MIS À JOUR LE 30 JUILLET 2026, APRÈS LIVRAISON DE L'ÉTAPE 7.** Ce document a été écrit
> comme un audit ; six des sept constats du §9 ont été **corrigés le jour même**, dans la
> foulée, par l'étape 7 (« la boucle de remédiation »). Le §9 conserve la description
> complète de chaque défaut — c'est ce qui permet de comprendre le code qui les ferme — et
> porte désormais, pour chacun, ce qui a été livré et où le vérifier. La feuille de route du
> §10 est réordonnée en conséquence.
>
> **Plan d'exécution :**
> [docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md](../../superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md)
>
> **Ce qui est livré, en une ligne chacun :**
>
> | Constat | Livré |
> |---|---|
> | A · aucun dossier ne pouvait s'auto-valider | véto PEP branché sur Dilisense, RPC élargie à la portée personne, invariant qui interdit tout véto orphelin |
> | B · le rejet était un cul-de-sac | cinquième décision `correction_requested`, gate et saisie rouverts, resoumission qui rend la main au moteur |
> | C · une pièce refusée était irremplaçable | garde anti-doublon filtrée sur le dernier verdict, relecteur capable de trancher la pièce remplacée |
> | D · l'identité restait modifiable après validation | gel après soumission, écriture réservée aux dirigeants, journalisation de tout changement |
> | E · aucune notification | courriel Resend sur les quatre décisions, avec le motif |
> | G · dépendance de test non déclarée | **non traité** (hors périmètre onboarding) |
> | F · KYC agent léger | **non traité** : lot 4, à cadrer produit |
>
> **Vérification au 30.07.2026, base locale réinitialisée :** 121 fichiers backend,
> **1048 tests passés**, 4 skippés (secrets absents en local), 0 échec. Unitaires : 1349
> passés. Lint : 0 erreur. i18n : 0 clé manquante sur 4 langues.

> **Pour qui :** l'équipe qui reprend et poursuit le développement de l'API d'onboarding
> (Edge Functions, RPC Postgres, connecteurs de registres).
> **Écrit le :** 30 juillet 2026, après audit du dépôt à `main` = `401928cc`.
> **Ce document se lit seul.** Tout ce qu'il affirme a été vérifié dans le dépôt, dans les
> journaux de déploiement ou en exécutant les suites de tests, et chaque affirmation porte
> sa preuve. Ce qui n'a pas pu être vérifié est dit comme tel, jamais arrondi.

## Les trois documents existants, et ce que celui-ci ajoute

| Document | Rôle |
|---|---|
| [../../agency-kyb-verification.md](../../agency-kyb-verification.md) | décisions de conception du schéma et de la vérification, inventaire des sources par pays |
| [../../superpowers/specs/2026-07-26-onboarding-kyb-design.md](../../superpowers/specs/2026-07-26-onboarding-kyb-design.md) | conception du parcours utilisateur, gate, découpage en étapes |
| [../../agency-kyb-handoff.md](../../agency-kyb-handoff.md) | journal de chantier étape par étape, écrit pour la session qui reprenait |
| **ce document** | **état vérifié en production, contrat d'API, invariants, dette ouverte, feuille de route** |

Les trois premiers restent la source des **raisons**. Celui-ci est la source de l'**état** et
du **contrat**. Une divergence entre eux se tranche en faveur de celui-ci, avec une
exception explicite signalée au §11.

---

## 1. En une page

**Le parcours d'onboarding client est en production et fonctionne de bout en bout.** Un
dirigeant s'inscrit sur la vitrine, une agence est provisionnée, un gate le retient sur un
wizard en cinq étapes, sa soumission déclenche une vérification qui interroge neuf sources
réelles, un moteur Postgres calcule un score et un statut, un super-admin arbitre les
dossiers douteux dans une file paginée, et trois surfaces à risque LAB restent fermées
jusqu'à ce qu'un humain ait validé l'identité.

**Ce qui reste à construire n'est plus le socle : c'est la sortie de secours.** Le dispositif
sait dire non. Il ne sait pas encore dire « corrige et redépose ». Un dossier rejeté est un
cul-de-sac définitif, une pièce d'identité refusée ne peut pas être remplacée, et une agence
validée peut changer sa raison sociale et son numéro de registre sans qu'aucune vérification
soit rejouée ni qu'aucune trace soit écrite. Ces trois points sont détaillés au §9 et
constituent le premier lot de la feuille de route.

**Et un fait à dire avant tout le reste : en production, aucun dossier ne peut aujourd'hui
s'auto-valider, dans aucun pays.** Le véto de personne `pep_sanctions_screening` n'a aucun
connecteur, aucun chemin d'écriture, aucune RPC de résolution, et un véto sans ligne échoue.
`veto_failed` est donc toujours vrai. La documentation existante affirme le contraire pour la
France : cette affirmation a été mesurée dans une fixture qui pose ce véto à la main. Détail
et preuve au §9 A.

| Sujet | État vérifié |
|---|---|
| Schéma (8 tables, 20 migrations) | appliqué en production, `HTTP 201` sur chacune |
| Edge Function `agency-verification-run` | déployée (bundle 123 kB) |
| Connecteurs réels | 9 actifs, 1 squelette (registre UID) |
| Moteur de scoring | RPC Postgres, seuil d'auto-validation 0.85 |
| File de revue admin | livrée, paginée, 4 décisions humaines |
| Gardes LAB | 3 surfaces fermées, dont le chemin WhatsApp |
| Tests | 391 backend KYB, 1325 unitaires, 3 e2e |
| Lint | 0 erreur, 132 avertissements |
| Auto-validation possible en production | **aucun pays**, véto `pep_sanctions_screening` sans source |
| Auto-validation possible si ce véto était servi | France oui, Suisse non, Liechtenstein non |
| Boucle de remédiation | **absente** |
| Notification de décision | **absente** |
| KYC agent léger (invités) | **jamais construit** |

---

## 2. Contexte produit

### Le cadrage, et ce qu'il implique pour l'API

MEGGA est un CRM immobilier suisse positionné « compliance-first ». L'onboarding client
n'est pas un formulaire d'inscription : c'est le **point d'entrée d'un dispositif LAB** (lutte
anti-blanchiment). Ce que l'API vérifie ici conditionne l'accès à deux gestes réglementés
plus loin dans le produit : ouvrir un dossier KYC sur un client final, et lancer une
signature électronique.

Décisions produit actées, à ne pas rouvrir sans arbitrage de Thomas :

| Sujet | Décision |
|---|---|
| Modèle | self-serve, saisie à la charge de l'utilisateur, **au niveau agence** |
| Utilisateur individuel | n'ouvre pas de compte en self-serve ; il entre par invitation et relève d'un KYC agent léger, pas du KYB |
| Accès pendant la vérification | accès complet dès la soumission, bandeau de rappel, blocage des seules actions à risque LAB |
| Exemption de gate | les trois comptes développeurs (super-admins) uniquement |
| Reprise de données | aucune, la base est entièrement mock, aucun client réel connecté |
| Prestataire de liveness | aucun ; la pièce d'identité est relue par un humain, le slot reste ouvert dans le schéma |
| Régime des gardes | **garde plein**, aucun interrupteur : aucune agence n'agit sur une surface LAB avant validation humaine ou auto-validation |
| Screening PEP et sanctions | **véto réel, branché sur Dilisense** (décidé le 30.07.2026 après le constat du §9 A). Ne pas le retirer du jeu de vétos ; si la source est injoignable, la sortie est une décision humaine, pas un renoncement au contrôle |
| Dossier renvoyé pour correction | **nouveau statut `correction_requested`**, distinct de `rejected`, qui reste **terminal** (décidé le 30.07.2026) |

### Les quatre pays, et pourquoi il n'y en a que trois au wizard

Le wizard ne propose que `CH`, `FR` et `LI` ([StepAgence.tsx:58](../../../src/components/crm-sugar-identity/steps/StepAgence.tsx#L58)).
Ce n'est pas une limite technique : c'est le marché adressé. Le cas `LI` est une dette
ouverte, voir §9.

### La règle qui gouverne tout le reste

**Un véto ne passe que sur `match`.** Un véto absent ne passe pas (l'absence de preuve
n'est pas une preuve), un véto `partial` ne passe pas davantage. Là où une preuve manque, le
dispositif envoie en revue humaine plutôt que de valider sur ce qu'il n'a pas. Toute
proposition qui « débloquerait » un pays en assouplissant cette règle est une proposition de
dégrader le dispositif, et doit être traitée comme telle.

---

## 3. État vérifié au 30 juillet 2026

### Ce qui est en production

Toutes les migrations du chantier ont été appliquées, et cela se lit dans le journal de
déploiement, pas dans une supposition.

| Preuve | Contenu |
|---|---|
| run `30435386705` (PR #1017) | les 19 migrations `20260729150000` à `20260729151800`, `HTTP 201 (attempt 1/3)` sur chacune |
| même run | `Deployed Functions on project eayczugyrvmtqnnmvjod: agency-verification-run` (bundle 123 kB) |
| run `30438641751` (PR #1019) | `20260729160000_agency_review_queue_pagination.sql` appliquée |
| run `30457561924` (PR #1027) | `20260729180000_agency_check_source_internal.sql` appliquée |

Le dépôt porte **210 migrations** au total, dont **20** pour ce chantier.

### Ce que les branches contiennent encore

**Rien.** Toutes les branches du chantier sont intégrées à `main` :
`feat/agency-kyb-verification`, `feat/kyb-lindas-format`, `kyb-handoff-update`,
`claude/kyb-whatsapp-agency-guard-477173`, `claude/kyb-zefix-uid-connectors-267822` et
`claude/upbeat-kowalevski-3df544` sont toutes à **0 commit d'avance** sur `main`.
`claude/kyb-review-queue-pagination` porte un commit d'avance, `78811b59`, qui est le
pré-image du squash de la PR #1019 : son contenu est en production. Ces branches peuvent
être supprimées.

Autrement dit : **il n'y a plus de merge en attente**, contrairement à ce que dit encore le
§10 de l'ancien handoff.

### Ce que les suites de tests prouvent

Exécuté dans ce worktree le 30 juillet 2026, contre un Supabase local à jour :

```
npm run test:backend -- (12 specs KYB)   12 fichiers, 391 tests passés
npm run test:unit                        78 fichiers, 1325 tests passés
npm run lint                             0 erreur, 132 avertissements
```

Les 12 specs backend KYB sont : `agency-verification-run`, `agency-verification-engine`,
`agency-verification-config`, `agency-review-queue`, `agency-identity-submit`,
`agency-kyb-verification`, `agency-lab-guard`, `kyc-cases-insert-lab-guard`,
`open-kyc-case-lab-guard`, `kyb-identity-documents-storage`, `signup-provisioning`,
`onboarding-agency-rpc`, `agencies-verification-columns-lockdown`.

Deux réserves, honnêtement posées :

- **Un fichier unitaire ne se charge pas dans un worktree** :
  `tests/unit/workflows-yaml.spec.ts` importe `yaml`, qui **n'est pas déclaré dans
  `package.json`**. Il n'existe dans `package-lock.json` que comme dépendance transitive
  hoistée, ce qui fait passer la CI et échouer un `node_modules` élagué. Sans rapport avec
  l'onboarding, mais c'est une fragilité de la suite.
- **Les specs backend sont derrière `describe.skipIf(!HAS_KEYS)`.** Sans
  `.env.test.local`, elles se *skippent* en rendant exit code 0. **Lire le compte de tests,
  jamais le code de sortie.** C'est la règle numéro un de vérification sur ce chantier.

### Ce qui n'a pas pu être vérifié

- **L'enregistrement du job `agency-verification-sweep-hourly`** en production. Le connecteur
  Supabase MCP répond `net::ERR_FAILED` sur toute requête depuis cette session. La migration
  l'installe conditionnellement (`if exists (select 1 from pg_namespace where nspname = 'cron')`)
  et `pg_cron` est présent en production, donc il devrait être là, mais **cela reste à
  confirmer** :
  ```sql
  select jobname, schedule, active from cron.job where jobname = 'agency-verification-sweep-hourly';
  ```
- **Le job CI `e2e-kyb`** n'a jamais tourné pour de vrai sur `main` : il a été exercé en
  local (`npm run test:e2e:kyb`, 3 tests, 3 passés) mais jamais déclenché par la CI.

---

## 4. Architecture : le parcours de bout en bout

```
 VITRINE (megga.ch, hors de cette app)
   megga-auth.js : signUp({ data: { full_name, agency_name, role: 'agent' } })
        |
        v
 TRIGGER Postgres  on_auth_user_created -> handle_new_user()
   - lit raw_user_meta_data.agency_name pour nommer l'agence
   - n'auto-provisionne PAS si une invitation valide existe pour cet e-mail
   - provision_solo_agency() pose role = 'admin' sur le fondateur
        |
        v
 PREMIER LOGIN  AgentSugarLayout -> useIdentityGate()
   gate actif si : agency_id non nul
                ET role in ('admin','manager')
                ET agencies.identity_submitted_at is null
                ET not is_super_admin()
   -> redirection vers /dashboard/identite (jamais vers elle-meme)
        |
        v
 WIZARD 5 ETAPES  IdentityShell
   1 Signataire     -> agency_related_persons + agency_person_roles('signatory')
   2 Agence         -> agencies.* (pays, forme juridique, raison sociale, n de registre, TVA, adresse)
   3 Beneficiaires  -> agency_person_roles('ubo')   [SAUTEE si legal_forms.category = 'sole_proprietorship']
   4 Piece d'identite -> Storage documents/{agency_id}/kyb-identity/{related_person_id}
   5 Recapitulatif  -> submit_agency_identity(p_related_person_id)
        |
        v
 RPC submit_agency_identity()
   - garde is_agency_admin()
   - verrou FOR UPDATE sur agencies
   - 4 causes de refus a message distinct (raison sociale, forme juridique, pays, signataire actif)
   - pose identity_submitted_at, journalise activity_events(category='kyc')
   - pose le check id_document en pending_manual_review
   - net.http_post best-effort vers agency-verification-run   [fire-and-forget]
        |
        v
 EDGE FUNCTION agency-verification-run  (service_role uniquement)
   1. lit 11 colonnes d'agencies
   2. compose le registre : 9 sources statiques + createAddressGeocodeSource + createUidRegisterSources
   3. selectApplicableSources() filtre par juridiction  -> applicable / skipped
   4. runAgencyKybSources() : une ligne par source, toujours, quoi qu'il arrive
   5. record_agency_verification_run() : ecriture des checks + moteur + journal, UNE transaction
        |
        v
 MOTEUR recompute_agency_verification()
   score  = moyenne ponderee du dernier check de chaque type (entite + personne scorable)
   statut = auto_validated  si aucun veto en echec/absent
                            ET aucun pending_manual_review
                            ET un signataire actif
                            ET score >= 0.85
            manual_review   sinon (score NULL inclus)
   n'ecrase JAMAIS 'rejected' ni 'validated'
        |
        +--> auto_validated ------------> gardes LAB ouverts
        |
        +--> manual_review -----> FILE DE REVUE ADMIN (/dashboard/admin/kyb-review)
                                   valider  -> validated  -> gardes LAB ouverts
                                   rejeter  -> rejected    -> CUL-DE-SAC (voir §9)
                                   relancer -> rejoue le moteur
                                   resoudre la piece d'identite (match/partial/mismatch)

 FILET DE RATTRAPAGE  sweep_pending_agency_verifications()  [pg_cron, 25 * * * *]
   ramasse les dossiers soumis depuis > 15 min encore en 'pending'
   5 tentatives max, puis bascule en manual_review + activity_events explicatif
   plafonne a 25 dossiers eligibles par passage
```

### Le modèle de données : 8 tables

| Table | Rôle |
|---|---|
| `legal_forms` | référentiel des formes juridiques par pays, avec `category` (c'est `sole_proprietorship` qui fait sauter l'étape 3 du wizard) |
| `legal_form_aliases` | sigles et libellés, y compris dans une autre langue que le pays. Les homonymes entre pays (« SA », « Entreprise individuelle ») sont délibérément gardés **ambigus** : sans pays, ils ne se résolvent pas |
| `agency_related_persons` | personnes de conformité rattachées à une agence |
| `agency_person_roles` | rôles datés (`signatory`, `ubo`), avec `valid_from` / `valid_to`. Un signataire est « actif » si `valid_to` est nul ou futur |
| `verification_check_types` | catalogue des 19 types, avec leur `scope` (`agency` ou `person`) |
| `verification_check_config` | pondération **versionnée** : `weight`, `is_veto`, `valid_from`, `valid_to` |
| `agency_verification_checks` | journal des checks de portée **agence** |
| `agency_person_verification_checks` | journal des checks de portée **personne** |

Plus des colonnes ajoutées à `agencies` : `business_registration_number` (renommage de `ide`),
`legal_form_id` (FK), `verification_status`, `verification_score`, `verified_at`,
`identity_submitted_at`, `verification_sweep_attempts`.

`verification_status` prend cinq valeurs : `pending`, `auto_validated`, `manual_review`,
`validated`, `rejected`. **`auto_validated` et `validated` ne sont pas synonymes** : le
premier est une décision du moteur, le second d'un humain, et c'est exactement la distinction
qu'un audit LAB regarde. `validated` a été ajouté par ce chantier, il manquait à la conception
d'origine.

**Les deux tables de checks n'ont aucune policy INSERT.** Elles refusent l'écriture à tout
rôle utilisateur. Seules les RPC `SECURITY DEFINER` y posent des lignes, ce qui empêche un
inscrit de fabriquer sa propre preuve de vérification. Quiconque touche à ces tables doit
savoir que le verrou est là.

---

## 5. Contrat d'API

### 5.1 Edge Function `agency-verification-run`

Le seul point d'entrée HTTP du dispositif de vérification.

```
POST /functions/v1/agency-verification-run
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json

{ "agency_id": "<uuid>" }
```

| Réponse | Code | Corps |
|---|---|---|
| succès | 200 | `{ ok: true, agency_id, checks_written: <n>, results: { match, partial, mismatch, unavailable, pending_manual_review } }` |
| méthode | 405 | `{ error: 'method_not_allowed' }` |
| auth | 401 | `{ error: 'unauthorized' }` |
| corps illisible | 400 | `{ error: 'invalid_json' }` |
| `agency_id` absent ou non-UUID | 400 | `{ error: 'agency_id required (uuid)' }` |
| agence inconnue | 404 | `{ error: 'agency_not_found' }` |
| erreur interne | 500 | `{ error: <message> }` |

Points de contrat à respecter :

- **Auth par comparaison à temps constant** au `SUPABASE_SERVICE_ROLE_KEY` du runtime
  (`safeEqual`), même motif que `kyc-screening` et `idx-syndicate`. Aucun chemin utilisateur :
  cette fonction n'est destinée qu'à des appelants internes de confiance.
- **`verify_jwt = false`** dans `supabase/config.toml` : c'est le garde applicatif qui
  authentifie, pas GoTrue.
- **Rejouable.** Elle n'efface, ne met à jour, ni ne réordonne aucune ligne existante :
  uniquement des inserts. Le départage de deux checks du même type appartient au moteur
  (`distinct on (check_type) ... order by check_type, checked_at desc, ctid desc`), jamais à
  cette fonction. **Ne pas y introduire de logique d'ordre ni de nettoyage.**
- Elle lit **11 colonnes** d'`agencies`, jamais la ligne entière :
  `id, legal_name, trade_name, business_registration_number, country, canton, city, postal_code, address, website, tva`.
- Le réseau reste en Deno. **Aucune transaction Postgres ne doit rester ouverte en attendant
  une réponse HTTP externe** : c'est la raison d'être du découpage entre cette fonction et
  `record_agency_verification_run`.

### 5.2 Le contrat d'un connecteur

```ts
export interface KybSource {
  checkType: string                        // doit exister dans verification_check_types (FK)
  source: string                           // doit figurer dans le CHECK de la colonne source
  appliesTo?: (agency: AgencyForVerification) => boolean   // juridiction, facultatif
  run: (agency: AgencyForVerification, signal: AbortSignal) => Promise<KybSourceResult>
}

export interface KybSourceResult {
  result: 'match' | 'partial' | 'mismatch' | 'unavailable' | 'pending_manual_review'
  raw_response: Record<string, unknown>    // OBLIGATOIRE, jamais null
  check_type?: string                      // ecrase le type declare, pour CETTE execution
}
```

Cinq règles que le harnais impose, et qui expliquent la forme du type :

1. **Un connecteur ne choisit jamais `unavailable`.** Il lève. C'est `runKybSource()` qui
   traduit une exception ou un timeout en `unavailable` avec la preuve de l'échec. Un
   connecteur qui décide lui-même `unavailable` masque la différence entre « la source a
   répondu qu'elle ne sait pas » et « la source n'a pas répondu ».
2. **`raw_response` est obligatoire.** Un `match` sans pièce d'audit derrière est
   inacceptable dans un dispositif LAB : le type contraignait la forme du résultat, il
   contraint désormais son honnêteté.
3. **Le module `_shared/kyb-sources.ts` est pur.** Aucun import, aucun `Deno.env.get`. Un
   connecteur qui a besoin d'un secret est une **fabrique** appelée depuis `index.ts`
   (`createAddressGeocodeSource`, `createUidRegisterSources`). C'est ce qui permet d'importer
   le module tel quel depuis un test vitest.
4. **`signal` sert à annuler la requête sous-jacente** quand le harnais atteint son timeout
   (`DEFAULT_SOURCE_TIMEOUT_MS = 10_000`). Un connecteur qui l'ignore reste couvert par le
   timeout externe, mais laisse fuir une socket.
5. **Le harnais garantit une ligne par source qu'on lui donne.** Succès, échec ou timeout ne
   font jamais disparaître un check et ne font jamais échouer l'appel. Le filtrage de
   juridiction vit **avant** le harnais, dans `index.ts`, jamais dedans.

### 5.3 La règle de juridiction, et l'invariant qu'elle protège

Le moteur ne garde **qu'une ligne par `check_type`**. Deux lignes écrites dans la même
transaction portent le même `checked_at` (valeur par défaut = heure de début de transaction) :
c'est donc **la dernière insérée qui gagne**.

Trois `check_type` de registre ont **deux propriétaires chacun** (la France par
`recherche-entreprises`, la Suisse par LINDAS), et `vat_lookup` en a deux aussi (VIES et le
registre UID). Sans règle, l'`unavailable` du connecteur français pour un siège hors de
France pouvait s'insérer **après** le verdict suisse et le masquer : **un véto réellement
satisfait se serait lu comme un véto absent**.

`selectApplicableSources()` écarte avant exécution les sources dont `appliesTo` est faux, et
joint les écartées à `p_metadata.sources_skipped` avec l'une de deux raisons :

| Raison | Signification |
|---|---|
| `jurisdiction_not_covered` | cas nominal, cette source ne couvre pas ce pays, rien à corriger |
| `jurisdiction_undeterminable` | le prédicat `appliesTo` a **levé**, c'est le seul signal qu'il est bogué |

Deux pièges à connaître avant d'ajouter une juridiction :

- **La portée exacte de l'« impossible ».** Le filtre lit le `check_type` que la source
  **déclare**. Un connecteur peut écraser le sien **à l'exécution** via
  `KybSourceResult.check_type` (RDAP le fait pour `domain_generic_provider`), et cette
  écriture ne passe par aucun filtre. Aucun type partagé n'est produit ainsi aujourd'hui ;
  à vérifier avant d'y recourir.
- **Écarter n'est pas gratuit.** C'est neutre uniquement si la source écartée n'avait rien à
  répondre. Mesuré en base : un siège `CH` déclarant une TVA à préfixe UE donnait
  `0.200 / manual_review` avec le `mismatch` de VIES, et `1.000 / auto_validated` sans. D'où
  `vatLookupOwner(agency)`, **point de décision unique** : le préfixe de TVA déclaré prime,
  le siège ne tranche que ce que le préfixe ne tranche pas. Les deux `appliesTo` interrogent
  littéralement la même fonction, ce qui fait de l'exclusivité une propriété du code et non
  deux prédicats à tenir d'accord.

### 5.4 Les RPC Postgres

Toutes en `security definer`, `set search_path to 'public'`.

**Parcours utilisateur**

| RPC | Droits | Rôle |
|---|---|---|
| `submit_agency_identity(p_related_person_id uuid default null)` | `authenticated`, garde `is_agency_admin()` | soumission, complétude, verrou `FOR UPDATE`, idempotente, déclenche la vérification |
| `is_agency_admin()` | interne | `admin` ou `manager` de son agence |
| `get_signup_trigger_count()` | interne | garde-fou anti-doublon du trigger d'inscription |
| `normalize_legal_form_text(text)` | interne | backfill du référentiel de formes juridiques |

**Moteur**

| RPC | Droits | Rôle |
|---|---|---|
| `recompute_agency_verification(p_agency_id uuid)` | `service_role` **uniquement** | score, vétos, statut. N'écrase jamais `rejected` ni `validated` |
| `record_agency_verification_run(...)` | `service_role` | écriture des checks + moteur + journal, en **une** transaction |
| `get_agency_verification_config()` | `service_role` **uniquement** | expose `auto_validate_min` (0.85) et `review_priority_min` (0.5), jamais tout `app_config` |
| `sweep_pending_agency_verifications()` | `service_role` | filet de rattrapage horaire, 5 tentatives, 25 dossiers par passage |

**File de revue admin** (patron P3 : `EXECUTE authenticated`, garde interne `is_super_admin()`)

| RPC | Rôle |
|---|---|
| `get_admin_agency_review_queue(p_limit integer, p_offset integer)` | file paginée, tri par score croissant `NULLS FIRST`, départage `identity_submitted_at` puis `id`, rend `total_count` |
| `get_admin_agency_review_detail(p_agency_id uuid)` | chaque check avec type, source, poids applicable **à la date du check**, résultat, réponse brute |
| `admin_validate_agency_review(p_agency_id uuid)` | pose `validated` |
| `admin_reject_agency_review(p_agency_id uuid, p_reason text)` | pose `rejected`, remet `verified_at` à NULL, motif dans `metadata` |
| `admin_relaunch_agency_review(p_agency_id uuid)` | rejoue le moteur ; exige `identity_submitted_at` posé |
| `admin_resolve_agency_id_document(p_agency_id uuid, p_check_id uuid, p_result text)` | décision humaine sur la pièce d'identité ; `p_result` limité à `match` / `partial` / `mismatch` |

**Gardes LAB**

| RPC / module | Rôle |
|---|---|
| `is_agency_lab_cleared(p_agency_id uuid)` | lu par le `WITH CHECK` de la policy `kyc_cases_insert` |
| `_shared/agency-lab-guard.ts` : `requireAgencyLabCleared` | garde edge rendant une `Response` de refus |
| même module : `isAgencyLabClearedInDb` | garde edge booléen, pour un chemin qui n'a pas de `Response` à rendre |
| `agencies_guard_verification_columns()` | trigger, deuxième défense contre l'écriture des colonnes de vérification sous `current_user = authenticated` |

### 5.5 Le catalogue des checks

**19 types, 6 vétos** (4 d'entité, 2 de personne), 13 types scorables pour un poids total de
**21.50**. Les vétos portent `weight = 0` : ils sont hors score par construction.

| Type | Portée | Véto | Poids | Servi par |
|---|---|---|---|---|
| `registry_number_format` | agence | oui | 0 | calcul interne (`source='internal'`), CH et FR |
| `registry_lookup` | agence | oui | 0 | LINDAS (CH, plafonné `partial`), `recherche-entreprises` (FR) |
| `registry_legal_name_match` | agence | oui | 0 | LINDAS (CH), `recherche-entreprises` (FR) |
| `registry_country_match` | agence | oui | 0 | LINDAS (CH), `recherche-entreprises` (FR) |
| `pep_sanctions_screening` | personne | oui | 0 | **rien** |
| `id_document` | personne | oui | 0 | humain seul (`pending_manual_review` à la soumission) |
| `vat_lookup` | agence | non | 3.00 | VIES (UE), registre UID (CH/LI, **squelette**) |
| `signatory_registry_match` | personne | non | 3.00 | **rien** |
| `address_registry_match` | agence | non | 2.50 | **rien** |
| `activity_code_match` | agence | non | 2.00 | **rien** |
| `professional_registry` | agence | non | 2.00 | **rien** |
| `poa_document_review` | personne | non | 2.00 | **rien** |
| `address_geocode` | agence | non | 1.50 | Mapbox (**jeton absent en production**) |
| `lei_lookup` | agence | non | 1.50 | **rien** (GLEIF à retester depuis une edge) |
| `domain_website_match` | agence | non | 1.00 | **rien** |
| `domain_generic_provider` | agence | non | 1.00 | RDAP (type écrasé à l'exécution) |
| `domain_trade_name_similarity` | agence | non | 0.75 | **rien** |
| `domain_whois_age` | agence | non | 0.75 | RDAP `.ch` / `.li` / `.fr` |
| `phone_country_match` | agence | non | 0.50 | **rien** |

Valeurs autorisées de `source` (CHECK de colonne) : `zefix`, `uid_register`, `vies`,
`recherche_entreprises`, `insee_sirene`, `oera_li`, `rdap`, `gleif`, `mapbox`,
`cci_immobilier`, `manual`, `internal`.

> `internal` a été ajoutée par `20260729180000` pour un contrôle **calculé sans sortir du
> processus**. Ne pas la confondre avec `manual`, qui affirme qu'un humain a tranché.

**Les pondérations sont versionnées** (`verification_check_config`, colonnes `valid_from` /
`valid_to`). Un audit rejoue le poids en vigueur **à la date du check**, jamais le poids
courant. L'index unique ne protège que les fenêtres ouvertes : le moteur se défend en plus
contre deux fenêtres fermées et chevauchantes, qui faisaient compter un poids deux fois.

### 5.6 Les connecteurs actifs

9 entrées statiques dans `AGENCY_KYB_SOURCES`, plus 2 fabriques construites dans `index.ts`.

| Connecteur | `check_type` | Juridiction | Secret | Endpoint |
|---|---|---|---|---|
| RDAP | `domain_whois_age` (+ `domain_generic_provider`) | aucune | non | RDAP `.ch` / `.li` / `.fr` |
| VIES | `vat_lookup` | préfixe TVA UE | non | VIES |
| `recherche-entreprises` x3 | `registry_lookup`, `registry_legal_name_match`, `registry_country_match` | `FR` | non | `recherche-entreprises.api.gouv.fr`, 7 req/s |
| LINDAS x3 | mêmes trois types | `CH` | non | `https://lindas.admin.ch/query`, graphe `<https://lindas.admin.ch/foj/zefix>` |
| contrôle du numéro | `registry_number_format` | `CH`, `FR` | non | aucun réseau |
| Mapbox (fabrique) | `address_geocode` | aucune | `MAPBOX_TOKEN` | Geocoding v5 |
| registre UID (fabrique) | `vat_lookup` | `vatLookupOwner === 'uid_register'` | 2 variables | **squelette** |

Le squelette UID lève **deux erreurs distinctes**, et la distinction n'est pas cosmétique :

| Erreur | Signification | Geste attendu |
|---|---|---|
| `KybSourcePendingCredentialsError` | il manque un identifiant | attendre une réponse de l'extérieur |
| `KybSourceNotWiredError` | les secrets sont posés, le code manque | écrire le connecteur, ici |

Le type est lisible dans `raw_response.error_type`, donc dans la file de revue. Sans cette
distinction, celui qui vient de poser les secrets ne verrait qu'un `unavailable` identique à
celui de la veille.

---

## 6. Ce qui peut s'auto-valider, pays par pays

Les trois états ci-dessous sont **mesurés contre le vrai moteur** dans
`tests/backend/agency-verification-run.spec.ts`, chacun avec son contrôle. Ils ne sont pas
déduits de la lecture du code.

> **⚠ À lire avant ce tableau.** Ces trois mesures portent sur les **vétos d'entité** et sur
> la pièce d'identité, avec `pep_sanctions_screening` **posé à la main** par la fixture. En
> production, ce véto de personne n'a aucune source et aucun chemin d'écriture, donc **aucun
> des trois pays ne peut atteindre `auto_validated`** (§9 A). Ce qui suit décrit donc le régime
> qui s'appliquera **le jour où ce véto sera résolu**, pas celui d'aujourd'hui. Le contenu
> reste utile tel quel : il dit ce que chaque pays sait prouver de son entité, et c'est
> l'information qu'un relecteur de la file a besoin d'avoir.

### France : les quatre vétos d'entité sont servis

Mesuré sur un dossier Carrefour (SIREN réel `510761505`) :

| Vétos d'entité | Pièce d'identité | Verdict |
|---|---|---|
| les quatre en `match`, posés **par les connecteurs** | `pending_manual_review` | `manual_review`, score 1.000 |
| les mêmes, une seule ligne changée | `match` (geste humain) | **`auto_validated`**, score 1.000 |
| contrôle : les mêmes privés de la **seule** source `registry_country_match` | `match` | `manual_review`, score 1.000 |

La troisième ligne est ce qui rend la deuxième concluante : sans elle, il resterait possible
que la bascule vienne de la pièce d'identité et non du quatrième véto.

**Une agence française n'a plus aucun véto d'entité à faire poser à la main.** Une fois
`pep_sanctions_screening` résolu (§9 A), elle obtiendra l'accès aux surfaces LAB sur une seule
décision humaine, celle qui tranche la pièce d'identité. C'est deux décisions aujourd'hui, et
la seconde n'a aucun chemin.

### Suisse : trois vétos sur quatre, et le quatrième plafonne

LINDAS sert `registry_legal_name_match` et `registry_country_match` en `match`, le calcul
interne sert `registry_number_format`. `registry_lookup` **ne peut pas valoir `match`** :
LINDAS ne publie **aucun statut**, une société radiée y figure exactement comme une société
active. Poser `match` affirmerait « existe et active » sur une preuve qui n'en porte que la
moitié. `partial` est le verdict honnête, et un véto ne passe pas sur `partial`.

Mesuré sur un dossier suisse par ailleurs complet (IDE réel `CHE-105.909.036`, pièce
d'identité résolue) : il reste en `manual_review`. Le contrôle vaut répétition du jour où les
identifiants PublicREST arriveront : cette seule ligne passée de `partial` à `match`, rien
d'autre ne bougeant, le même dossier bascule en `auto_validated`.

**Ce qui manque n'est plus un connecteur : c'est une donnée**, le statut actif ou radié, que
la voie publique ne publie pas.

Deux conséquences à dire au client sans les arrondir :

- **Une agence suisse doit déclarer sa raison sociale telle que le registre la publie, pas sa
  traduction.** `schema:legalName` est mono-valué (mesure du 29.07.2026 : 0 nœud sur 791 071
  en porte plusieurs). Les traductions officielles vivent dans `schema:name`, et le
  connecteur refuse délibérément de le lire, parce que ce champ porte aussi les
  dénominations des *autres* entrées. Déclarer la traduction donne un `mismatch` sur un véto,
  donc un dossier bloqué.
- Les rares IDE rendant plusieurs raisons sociales (3 sur 791 068) sont des **doubles sièges
  statutaires**, pas des versions linguistiques.

### Liechtenstein : servi par rien

`LI` est l'un des trois pays sélectionnables, et **aucun de ses quatre vétos d'entité ne peut
être satisfait** :

- `oera.li` n'a aucune API publique connue et n'est pas dans LINDAS, qui publie le registre
  **suisse**. Les trois vétos de registre ne reçoivent même pas de ligne :
  `selectApplicableSources()` les écarte vers `sources_skipped`.
- `registry_number_format` ne couvre pas `LI` et produit un `unavailable` nommant le pays. Le
  FL-UID porte pourtant le même préfixe `CHE` que l'IDE suisse (union douanière), mais la
  conception le marque « non testé » : appliquer la clé suisse sans l'avoir éprouvée sur des
  numéros réels risquerait un `mismatch` sur une agence légitime, c'est-à-dire un véto
  **échoué** et pas seulement absent. Rester en `unavailable` est le choix prudent.

---

## 7. Invariants à ne jamais casser

Chacun a été établi par un défaut réel, souvent critique. La liste est courte parce que
chaque ligne coûte cher.

| # | Invariant | Ce qui arrive si on le casse |
|---|---|---|
| 1 | **Un véto ne passe que sur `match`** | un dossier s'auto-valide sur une preuve qu'on n'a pas |
| 2 | **Deux sources ne partagent jamais un `check_type` applicable au même dossier** | la dernière ligne insérée masque l'autre : un véto satisfait se lit comme absent |
| 3 | **Un prédicat `appliesTo` n'écarte que des sources qui n'auraient rien pu dire du dossier** | on jette un verdict défavorable ; mesuré : `manual_review` devenu `auto_validated` |
| 4 | **`raw_response` n'est jamais nul** | un `match` sans pièce d'audit derrière |
| 5 | **Un connecteur ne choisit jamais `unavailable`, il lève** | « la source ne sait pas » devient indistinguable de « la source n'a pas répondu » |
| 6 | **Le départage de deux checks du même type appartient au moteur** (`checked_at desc, ctid desc`) | reproduit : un véto défavorable frais écarté au profit d'un ancien favorable |
| 7 | **`recompute_agency_verification` n'écrase jamais `rejected` ni `validated`** | une décision humaine effacée par le moteur |
| 8 | **Les tables de checks n'ont aucune policy INSERT** | un inscrit fabrique sa propre preuve de vérification |
| 9 | **Les colonnes de vérification sont interdites à `authenticated`** (REVOKE colonne **et** trigger) | reproduit : une agence bloquée se débloquait elle-même en une requête, et franchissait les deux gardes serveur |
| 10 | **Le garde LAB est posé côté serveur, pas seulement dans le navigateur** | reproduit : un agent d'une agence jamais soumise ouvrait un dossier KYC par appel direct |
| 11 | **Tout chemin `service_role` vers `kyc_cases` porte son propre garde** | `service_role` contourne inconditionnellement les policies ; c'est le trou WhatsApp, refermé |
| 12 | **Le préfixe Storage `kyb-identity` se compare en minuscules** dans les 8 policies | reproduit : un agent déposait un fichier sous `KYB-IDENTITY` et le dirigeant le voyait dans son dossier de preuve |
| 13 | **Le gate ne redirige jamais vers lui-même, et la sortie « reprendre plus tard » ne quitte pas la route** | l'incident P0 `c830f9a9` (boucle d'onboarding) |
| 14 | **Aucune transaction Postgres n'attend une réponse HTTP externe** | un connecteur lent tient un verrou sur `agencies` |
| 15 | **`_shared/kyb-sources.ts` reste pur** (aucun import, aucun `Deno.env.get`) | le module cesse d'être testable hors Deno |
| 16 | **Les migrations se re-datent le jour du merge** | le date-guard de `deploy.yml` les saute **définitivement**, avec un simple `::warning::` |

Sur le point 16, en détail, parce que c'est le piège qui a le plus coûté sur ce chantier :
`deploy.yml` n'applique que les migrations dont l'horodatage est `>= TODAY` en UTC, et ne
signale un saut que par un avertissement, jamais par un échec. `deploy-app.yml`, lui, n'a
**aucun** garde-fou de date : le frontend partirait en cherchant des colonnes inexistantes.
Corollaire moins évident, appris à ses frais : **corriger une migration déjà mergée exige un
nouveau fichier, jamais une reprise sur place**, puisque la version d'origine est déjà
enregistrée en production.

---

## 8. Pré-requis pour l'équipe API

### 8.1 Environnement local (compter 30 minutes)

```bash
# 1. Docker (Colima ou Docker Desktop) doit tourner
# 2. Pile Supabase locale
supabase start

# 3. Base a neuf, TOUJOURS avant de conclure quoi que ce soit
supabase db reset

# 4. Variables de test
cp .env.test.example .env.test.local
# puis y coller SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_ROLE_KEY depuis `supabase status`

# 5. Verification
npm run test:backend
```

**Toujours faire le `db reset` d'abord.** Une pile locale chargée produit des échecs qui
n'existent nulle part ailleurs : résidus de lignes uniques, et surtout le seuil de 1000
lignes de PostgREST sur toute liste sans `LIMIT`. C'est exactement ce défaut-là qui avait
tronqué la file de revue KYB.

Sans `.env.test.local`, les specs backend se **skippent en rendant exit 0**. Lire le compte
de tests, jamais le code de sortie.

### 8.2 Secrets, et lesquels manquent

**Secrets Supabase attendus par ce dispositif**

| Variable | État | Sans elle |
|---|---|---|
| `MAPBOX_TOKEN` | **absente** en production | `address_geocode` sort `unavailable` : rien ne casse, un signal de poids 1.50 disparaît |
| `UID_REGISTER_API_URL` | **absente**, et l'URL elle-même est **inconnue** | `vat_lookup` sort `unavailable` pour une agence CH/LI |
| `UID_REGISTER_API_CREDENTIAL` | **absente** | idem |

`MAPBOX_TOKEN` est le cas facile : **le dépôt a déjà cette valeur**, sous
`VITE_MAPBOX_TOKEN` (secret GitHub Actions injecté au build du bundle navigateur). Le
connecteur de géocodage tourne côté serveur, dans une Edge Function : il lui faut le jeton
dans les **secrets Supabase**, pas dans le build. La même valeur convient. C'est un geste de
30 secondes qui n'a jamais été fait.

`UID_REGISTER_*` est le cas difficile, et **les poser sans écrire le connecteur ne débloque
rien** : la source lève alors `KybSourceNotWiredError` au lieu de
`KybSourcePendingCredentialsError`. On ignore encore s'il existe une API séparée pour la TVA
suisse et liechtensteinoise, ou si ce n'est qu'un champ Zefix. **Rien n'est deviné dans le
squelette** : aucune URL ni schéma de réponse écrit « au plus probable », parce qu'une URL
inventée se découvre en production alors qu'une valeur vide se découvre à la lecture.

`ZEFIX_API_URL` et `ZEFIX_API_CREDENTIAL` **ont été retirées** le 29.07.2026 : elles ne sont
plus lues nulle part depuis que les trois sources suisses passent par LINDAS. Ne pas les
réintroduire sans le code qui les consomme.

### 8.3 Discipline de dépôt

| Règle | Pourquoi |
|---|---|
| une migration par changement de schéma, **jamais de reprise sur place** après merge | la version d'origine est déjà enregistrée en production |
| re-dater les migrations le jour du merge | le date-guard, voir invariant 16 |
| `npm run check:drift` avant de conclure | détecte la dérive entre les migrations et la base |
| `npm run lint:migrations` | idempotence |
| `npm run lint:roster` | l'inventaire `src/lib/edgeFunctionRoster.ts` doit rester complet |
| `npm run lint:prose` | interdit les tirets cadratins dans l'i18n ; **se skippe en local**, gater le merge sur la CI |
| tests d'abord, prouvés rouges, puis implémentation | ce cadencement a trouvé un défaut réel à presque chaque tâche de ce chantier, dont plusieurs critiques |
| `activity_events` pour toute action, y compris IA (`actor_id = 'ai'`) | règle de dépôt, et exigence d'audit LAB |

Contraintes de `activity_events` qui cassent à l'application, vérifiées en base :

- `category` doit valoir `'kyc'` pour ce chantier ; `'compliance'` **n'existe pas** dans le
  CHECK et ferait échouer l'insert ;
- `actor_kind = 'system'` **impose** `actor_id` NULL (contrainte
  `activity_events_actor_kind_coherence`) ;
- la table est append-only, avec une exception née du merge : le `SET NULL` d'une FK est un
  cas autorisé (`20260729151800`).

### 8.4 Ce que la CI couvre, et ce qu'elle ne couvre pas

| Workflow | Déclencheur | Couvre |
|---|---|---|
| `unit-tests.yml` | `push: [main]`, `pull_request: [main]` | 1325 tests jsdom |
| `backend.yml` | idem | specs contre un Supabase éphémère, secrets fournis |
| `e2e.yml` job `e2e-kyb` | idem | cycle complet du wizard, **jamais exercé sur `main`** |
| `deploy.yml` | push sur `main` | migrations (avec date-guard) + Edge Functions |
| `deploy-app.yml` | push sur `main` | bundle navigateur, **aucun garde-fou de date** |

**Un push sur une branche de feature ne déclenche rien.** Les workflows ne se déclenchent que
sur `main` et sur les PR ciblant `main`. Une branche poussée sans PR n'a aucune vérification
CI, seulement la vérification locale de celui qui l'a poussée. C'est arrivé sur ce chantier :
le garde LAB WhatsApp a vécu plusieurs heures sur une branche sans qu'aucune recette ne
tourne.

---

## 9. Dette et trous ouverts

Classés par gravité. Les sept premiers sont **des découvertes de cet audit**, non consignées
ailleurs. Les suivants étaient déjà connus et sont repris ici pour que la liste soit complète.

### A. CRITIQUE : aucun dossier ne peut s'auto-valider en production, dans aucun pays

> **✅ CORRIGÉ le 30.07.2026 (étape 7, tâches 1 et 4).** Le véto est branché sur Dilisense
> (`createPepSanctionsSources`, `_shared/kyb-sources.ts`), `record_agency_verification_run`
> accepte des checks de portée personne (`20260730140000`), et
> `agency-verification-run/index.ts` interroge les signataires actifs. Un dossier français
> complet atteint `auto_validated` **sans qu'aucune fixture ne pose de check à la main** :
> `tests/backend/agency-person-verification-run.spec.ts`, avec son contrôle. Et l'invariant
> `tests/backend/agency-veto-coverage.spec.ts` interdit désormais tout véto orphelin, présent
> ou futur, la liste étant lue **dans la table**.

**Le fait.** `pep_sanctions_screening` est déclaré **véto de personne** dans le catalogue
([20260729150300:40](../../../supabase/migrations/20260729150300_agency_verification_checks.sql#L40),
`is_veto = true`). Le moteur construit `veto_types_person` depuis la configuration active et
exige que **chaque signataire actif passe chaque véto de personne**, un résultat manquant
échouant comme un résultat défavorable :

```sql
where lpc.result is distinct from 'match'   -- capture la ligne ABSENTE (NULL apres LEFT JOIN)
```

Or **aucun chemin de production n'écrit jamais de ligne `pep_sanctions_screening`.** Vérifié
de façon exhaustive : il n'existe que trois `insert into agency_person_verification_checks`
dans tout le dépôt, et les trois sont scopés à `id_document`
([20260729151000:178](../../../supabase/migrations/20260729151000_submit_agency_identity_id_document.sql#L178),
[20260729151400:245](../../../supabase/migrations/20260729151400_trigger_agency_verification_on_submit.sql#L245),
[20260729151500:642](../../../supabase/migrations/20260729151500_agency_review_queue.sql#L642)).
`record_agency_verification_run` n'écrit **que** dans `agency_verification_checks`, portée
agence ([20260729151300:69](../../../supabase/migrations/20260729151300_record_agency_verification_run.sql#L69)).
Et `admin_resolve_agency_id_document` refuse explicitement tout autre type :
`if v_check_type <> 'id_document' then raise exception`.

**Conséquence.** `veto_failed` est **toujours** vrai, donc `verification_status` vaut
**toujours** `manual_review`, quel que soit le pays, quel que soit le score, quoi qu'un humain
tranche sur la pièce d'identité. **La branche `auto_validated` est du code mort en
production.** Chaque agence devra passer par `admin_validate_agency_review`.

**La preuve existe déjà dans la suite**, et elle passe :
`tests/backend/agency-verification-engine.spec.ts:596`, « un veto PERSONNE ABSENT envoie en
revue » : quatre vétos d'entité en `match`, `id_document` en `match`, aucune ligne
`pep_sanctions_screening`, score 1.000, résultat `manual_review`. **C'est exactement le cas
de production.**

**Pourquoi la documentation existante dit le contraire.** Le §7bis de l'ancien handoff
affirme qu'une agence française « s'auto-valide dès qu'un humain tranche sa pièce
d'identité ». Cette mesure est réelle, mais sa fixture pose `pep_sanctions_screening` à la
main (`tests/backend/agency-verification-run.spec.ts:1246`, `PERSON_VETO_TYPES` inséré avec
`source: 'manual'`, résultat `match`). Le véto est donc satisfait **par le harnais de test**,
par un chemin qui n'existe pas en production.

**Deux issues, et c'est un arbitrage produit, pas un choix technique :**

| Option | Effet | Coût |
|---|---|---|
| **brancher Dilisense** sur `pep_sanctions_screening` | le véto devient réel ; l'auto-validation redevient atteignable pour la France | Dilisense est déjà dans la pile (`kyc-screening`, `DILISENSE_API_KEY` posée). Il faut étendre `record_agency_verification_run` aux checks de **personne**, qu'elle n'écrit pas |
| **retirer `is_veto` de ce type** (nouvelle ligne de config, `valid_to` sur l'ancienne) | l'auto-validation redevient atteignable immédiatement | assume qu'aucun screening PEP ne conditionne l'accès aux surfaces LAB, ce qui est une position de conformité à faire valider |

**Ce que cela change dans la feuille de route :** relancer les identifiants Zefix PublicREST
n'est **pas** le chemin critique de l'auto-validation suisse, contrairement à ce qu'affirme
l'ancien handoff. Tant que ce véto n'est pas résolu, Zefix ne débloquerait rien.

### B. CRITIQUE : un dossier rejeté est un cul-de-sac définitif

> **✅ CORRIGÉ le 30.07.2026 (étape 7, tâche 5).** Cinquième décision humaine,
> `admin_request_agency_correction` (`20260730150000`) : elle pose le nouveau statut
> `correction_requested`, remet `identity_submitted_at` à NULL — ce qui rouvre le gate ET
> dégèle la saisie — et exige un motif. `rejected` reste **terminal**, ce qui n'est cohérent
> que parce que la correction existe. Le moteur n'écrase pas ce statut, et une resoumission
> le repasse en `pending` : sans ce couple, le dossier serait enfermé dans l'autre sens.
> Couvert par `tests/backend/agency-correction-requested.spec.ts` (11 tests) et par un
> quatrième cas e2e qui vérifie l'absence de reboucle.

**Le fait, en trois lignes de code.** `admin_reject_agency_review` pose
`verification_status = 'rejected'` et **ne touche pas** `identity_submitted_at`
([20260729151500:424](../../../supabase/migrations/20260729151500_agency_review_queue.sql#L424)).
`useIdentityGate` ne lit **que** `identity_submitted_at`, et rend `'done'` dès qu'il est posé
(`resolveIdentityGateStatus`, [useIdentityGate.ts:104](../../../src/hooks/useIdentityGate.ts#L104)).
`recompute_agency_verification` refuse d'écraser `rejected`
([20260729151200:61](../../../supabase/migrations/20260729151200_recompute_agency_verification.sql#L61)).

**Conséquence.** Le gate ne se réouvre jamais, le wizard devient inatteignable, le garde LAB
reste fermé (`rejected` n'est ni `auto_validated` ni `validated`), et **aucune des quatre
décisions humaines ne rouvre un dossier**. Une agence rejetée par erreur, ou rejetée pour une
faute de saisie corrigeable, est bloquée à vie sans aucun chemin self-serve. Le seul recours
est un `UPDATE` manuel en base par un super-admin, hors de toute piste d'audit prévue.

**Ce que ça vaut aujourd'hui :** rien, la base est mock. **Ce que ça vaudra au premier client
réel :** un incident support par dossier rejeté.

### C. CRITIQUE : une pièce d'identité refusée ne peut pas être remplacée

> **✅ CORRIGÉ le 30.07.2026 (étape 7, tâche 2, migration `20260730121000`).** Les deux
> impasses sont levées par un point de décision unique, `_latest_person_verification_check`,
> qui départage les lignes **exactement comme le moteur** (`checked_at desc, ctid desc`) :
> `submit_agency_identity` repose une demande dès que le dernier verdict n'est ni `pending`
> ni `match`, et `admin_resolve_agency_id_document` tranche la ligne la plus récente si elle
> attend. Le départage par `ctid` est lui-même éprouvé par mutation.

Deux défauts se combinent, et c'est leur combinaison qui rend le cas insoluble :

1. La garde anti-doublon de `submit_agency_identity` **ne filtre pas sur `result`** : elle ne
   repose jamais une seconde ligne dès qu'une ligne existe, quel qu'en soit le verdict
   ([20260729151000:173](../../../supabase/migrations/20260729151000_submit_agency_identity_id_document.sql#L173)).
   Après un `mismatch`, une pièce remplacée ne produit donc **jamais** de nouvelle demande de
   revue.
2. Le wizard est de toute façon inatteignable après soumission (défaut B), donc **il n'existe
   aucun chemin pour déposer un remplacement**.

À quoi s'ajoute que `admin_resolve_agency_id_document` refuse de retrancher une pièce déjà
résolue (`id_document check already resolved for this person`) : le relecteur non plus n'a pas
de seconde chance.

Le premier point était consigné comme dette de l'étape 2 et attribué à l'étape 5. Il n'a pas
été traité. Les deux autres n'étaient pas identifiés.

### D. IMPORTANT : les données légales sont modifiables après validation, sans revérification ni trace

> **✅ CORRIGÉ le 30.07.2026 (étape 7, tâche 3, migration `20260730130000`).** Deux triggers :
> l'un refuse l'écriture des 5 colonnes d'identité à un agent simple, et à quiconque une fois
> le dossier soumis (le gel se lève quand `identity_submitted_at` repasse à NULL, ce qui est
> la charnière avec la tâche 5) ; l'autre journalise tout changement dans `activity_events`
> avec la liste des colonnes touchées. Côté écran, `resolveLegalIdentityLock` met les champs
> en lecture seule avec un motif, plutôt que de laisser l'utilisateur saisir pour rien.

Trois faits qui, mis ensemble, vident une partie du dispositif de sa substance.

1. **La policy est ouverte à tout membre.** `agencies_members_update`
   ([20260527010000](../../../supabase/migrations/20260527010000_agencies_members_rls.sql))
   autorise **n'importe quel membre** (pas seulement `admin` ou `manager`) à écrire
   n'importe quelle colonne de la ligne de son agence. Le `TODO RBAC` du 27 mai 2026 est
   toujours ouvert. `20260729151600` a verrouillé les colonnes **de vérification** ; les
   colonnes **déclaratives** restent libres.
2. **L'écran de réglages les expose.** `AgencyFocusSection` rend éditables `legal`,
   `legalFormId`, `businessRegistrationNumber` et `tva`, et `useAgencySettings` les écrit
   directement dans `agencies` ([useAgencySettings.ts:169](../../../src/hooks/useAgencySettings.ts#L169)).
   Aucun garde ne dépend de `identity_submitted_at` ni de `verification_status`.
3. **Rien ne rejoue la vérification, et rien ne l'écrit au journal.** Le déclenchement de
   `agency-verification-run` est câblé dans `submit_agency_identity` seulement : il n'existe
   aucun trigger `after update of legal_name, business_registration_number, country` sur
   `agencies`. Et `useAgencySettings` **n'écrit aucun `activity_events`**.

**Conséquence.** Une agence validée peut changer sa raison sociale et son numéro de registre.
Les checks continuent d'attester l'identité **précédente**, le statut reste `validated`, les
gardes LAB restent ouverts, et **la modification ne laisse aucune trace**. C'est exactement
ce qu'un audit LAB regarde, et cela contredit la règle de dépôt « `activity_events` pour
toute action ».

### E. IMPORTANT : aucune notification de décision

> **✅ CORRIGÉ le 30.07.2026 (étape 7, tâche 6).** Un trigger sur la TRANSITION de
> `verification_status` (`20260730160000`) déclenche `agency-verification-notify`, qui relit
> le motif dans le journal — les RPC l'écrivent après l'UPDATE, et le corps d'un
> `net.http_post` vit en clair dans la file — et envoie par Resend aux **dirigeants** de
> l'agence. Dans un trigger et non depuis l'écran : un appel côté client serait skippable.

Ni validation ni rejet n'émet quoi que ce soit. Resend est dans la pile et n'est appelé par
aucun chemin KYB (vérifié : aucune Edge Function ne référence `agency_verification_validated`
ni `agency_verification_rejected`). L'agence découvre la décision en se reconnectant et en
lisant le bandeau. Combiné au défaut B, un dirigeant rejeté n'apprend son sort qu'en
revenant, et n'a alors rien d'autre à faire que cliquer « Contacter le support » (Intercom).

Ce défaut est aggravé par A : puisque **tout** dossier passe par la revue humaine, la
notification n'est pas un confort, c'est le seul canal par lequel une agence peut apprendre
qu'elle est désormais autorisée à travailler.

### F. IMPORTANT : le KYC agent léger n'existe pas

> **⏳ NON TRAITÉ, et c'est délibéré.** Ce n'est pas un défaut d'implémentation mais une
> décision de conformité sur qui répond de l'identité d'un agent invité. Lot 4, à cadrer avec
> Thomas et Gregory.

La décision produit dit que l'utilisateur individuel n'ouvre pas de compte en self-serve : il
entre par invitation d'une agence existante et relève d'un **KYC agent léger**, pas du KYB.
Le chemin d'invitation existe (`accept-team-invite`, et `handle_new_user` ne provisionne plus
d'agence solo quand une invitation valide existe). **Le KYC agent léger, lui, n'existe nulle
part** : aucune table, aucune RPC, aucun écran, aucun check. Un agent invité entre donc dans
le CRM sans qu'aucune vérification d'identité individuelle ne soit prévue, sous le couvert
du KYB de son agence.

À trancher : est-ce acceptable en v1 (l'agence répond de ses agents) ou est-ce un lot à
construire ?

### G. MINEUR : dépendance de test non déclarée

`tests/unit/workflows-yaml.spec.ts` importe `yaml`, absent de `package.json`. Il n'existe
dans `package-lock.json` que comme dépendance transitive hoistée : la CI passe, un
`node_modules` élagué échoue. Sans rapport avec l'onboarding, mais c'est un faux négatif en
attente.

### Dette déjà connue, reprise ici pour être complète

| # | Sujet | État |
|---|---|---|
| H | **Les pièces d'identité ne sont purgées par aucun chemin** quand la personne liée ou l'agence disparaît | rétention sans propriétaire dans la fonctionnalité qui porte la conformité. Ce n'est pas une exposition (les policies restent fermées), mais c'est à traiter **avant** qu'une vraie pièce d'identité soit déposée |
| I | **`registry_lookup` plafonne à `partial` pour la Suisse** | LINDAS ne publie aucun statut actif/radié. Débloqué par les identifiants Zefix PublicREST, mais **cela ne suffira pas** à rendre un dossier suisse auto-validable tant que A n'est pas résolu |
| J | **`LI` est sélectionnable au wizard et servi par rien** | à trancher : éprouver la clé FL-UID sur des numéros réels, ou retirer `LI` de la liste tant que rien ne le sert |
| K | **`MAPBOX_TOKEN` n'est pas posé côté serveur** | `address_geocode` sort `unavailable` en production |
| L | **Le job `e2e-kyb` n'a jamais tourné en CI** | exercé en local seulement, 3 tests, 3 passés |
| M | **L'enregistrement du cron `agency-verification-sweep-hourly` n'est pas confirmé en production** | `pg_cron` absent en local et en CI, MCP Supabase indisponible depuis cette session |
| N | **Le gate s'appliquera rétroactivement** à tout dirigeant existant au déploiement, et sur mobile l'écran n'offre que la déconnexion | sans conséquence tant que la base est mock, à trancher avant qu'il y ait de vraies agences |
| O | **10 des 19 `check_type` du catalogue n'ont aucun connecteur** : `pep_sanctions_screening` (véto, voir A), plus 9 signaux scorables (`signatory_registry_match`, `address_registry_match`, `activity_code_match`, `professional_registry`, `poa_document_review`, `lei_lookup`, `domain_website_match`, `domain_trade_name_similarity`, `phone_country_match`) | arithmétique vérifiée : **15.25 des 21.50 points de poids scorable, soit 71 %, n'ont aucune source**. Le score est normalisé sur les seuls checks disponibles, donc rien ne casse, mais il ne repose en réalité que sur 6.25 points, et sur **4.75** tant que `MAPBOX_TOKEN` est absent : `vat_lookup` (3.00), `domain_generic_provider` (1.00) et `domain_whois_age` (0.75). Un seul `mismatch` sur `vat_lookup` fait alors tomber le score sous 0.85 |
| P | **GLEIF n'a jamais été retesté depuis une Edge Function réelle** | injoignable depuis le sandbox d'outils, ce qui n'est pas un fait sur GLEIF |
| Q | **La documentation existante est partiellement périmée** | voir §11 |

---

## 10. Feuille de route

> **Les lots 0 et 1 sont LIVRÉS** (30.07.2026, étape 7). Ce qui suit conserve leur détail
> parce qu'il dit ce que le code fait et pourquoi ; les deux tableaux portent l'état réel.
> **Le lot 2 est le prochain**, et il ne demande presque pas de code : ce sont trois gestes
> d'exploitation et une décision de rétention.

Cinq lots, dans cet ordre. L'ordre n'est pas négociable pour les trois premiers : le lot 0
décide si l'auto-validation existe, le lot 1 ferme des trous qui rendraient toute mise en
service impossible, le lot 2 conditionne la première vraie agence.

### Lot 0 ✅ LIVRÉ : rendre le véto sans source réel (défaut A)

Il commande tout le reste : tant qu'il n'est pas fait, la branche `auto_validated` est morte et
la valeur de tous les connecteurs déjà livrés reste théorique.

| Tâche | Contenu | Critère de sortie |
|---|---|---|
| 0.1 | **Étendre `record_agency_verification_run` aux checks de portée personne** : elle n'écrit aujourd'hui que dans `agency_verification_checks`. Cette extension sert aussi la tâche 3.1 | la RPC accepte et écrit un check de personne, dans la même transaction |
| 0.2 | **Écrire le connecteur Dilisense** comme un `KybSource` de portée personne, en respectant les cinq règles du §5.2. Décider et documenter la forme du contrat pour une source de personne : `AgencyForVerification` ne porte aucune donnée de personne | un dossier français complet atteint `auto_validated` **sans qu'aucune fixture ne pose de check à la main** |
| 0.3 | **Repli, seulement si 0.2 échoue pour une raison externe** : RPC `admin_resolve_agency_person_check`, généralisation de `admin_resolve_agency_id_document` à tout véto de personne. **Ne pas retirer `is_veto`** : le repli est une voie de sortie humaine, pas un renoncement au contrôle | un relecteur peut trancher le screening comme il tranche la pièce d'identité |
| 0.4 | **Un test de non-régression qui interdit le retour du problème** : pour chaque type déclaré véto, ou bien un connecteur le sert, ou bien une RPC de décision humaine peut le résoudre. La liste des vétos se lit **dans la table**, jamais en dur | il devient impossible d'ajouter un véto orphelin sans le savoir |

### Lot 1 ✅ LIVRÉ : la boucle de remédiation (défauts B, C, D, E)

C'est le lot qui manque pour que le dispositif soit utilisable par un humain.

| Tâche | Contenu | Critère de sortie |
|---|---|---|
| 1.1 | **RPC `admin_request_agency_correction(p_agency_id, p_reason)`** : cinquième décision humaine. Remet `identity_submitted_at` à NULL (donc rouvre le gate), pose le **nouveau statut `correction_requested`** (arbitrage rendu, voir ci-dessous), journalise. Touche le CHECK de `verification_status`, le moteur (qui ne doit pas l'écraser, au même titre que `rejected` et `validated`), `useLabGuard` (nouveau cas bloqué avec son propre libellé) et la file (ces dossiers n'attendent plus le relecteur) | un dossier peut revenir au wizard sur décision d'un relecteur, et l'`activity_events` dit qui, quand et pourquoi |
| 1.2 | **`submit_agency_identity` : filtrer la garde anti-doublon sur `result`** dans une **nouvelle** migration. Reposer une ligne `pending_manual_review` quand la précédente vaut `mismatch` ou `partial`. Et lever la même impasse côté relecteur dans `admin_resolve_agency_id_document`, qui refuse aujourd'hui de retrancher une pièce déjà résolue | une pièce remplacée après un verdict négatif produit une nouvelle demande de revue, et le relecteur peut la trancher |
| 1.3 | **`rejected` reste terminal** (arbitrage rendu). Cohérent uniquement parce que 1.1 existe : un relecteur qui veut laisser une chance demande une correction, un relecteur qui rejette ferme le dossier. À écrire dans le commentaire de `admin_reject_agency_review` pour que ce ne soit pas rouvert par distraction | le libellé de rejet, côté agence, ne promet aucune reprise |
| 1.4 | **Trigger de revérification sur changement déclaratif.** `after update of legal_name, business_registration_number, country, tva, address on agencies` : journaliser dans `activity_events`, et selon l'arbitrage produit, soit rejouer la vérification, soit rebasculer en `manual_review` | une modification post-validation laisse une trace et ne peut pas laisser un `validated` mensonger |
| 1.5 | **Restreindre `agencies_members_update`** aux rôles `admin` / `manager`, et geler les colonnes déclaratives une fois `identity_submitted_at` posé (colonne-privilège ou trigger, même patron que `20260729151600`). Ferme le `TODO RBAC` du 27 mai | un simple agent ne peut plus réécrire la raison sociale de son agence |
| 1.6 | **Notification de décision** par Resend : validé, rejeté, correction demandée. Réutiliser le patron d'e-mail existant, pas un nouveau | un dirigeant apprend la décision sans se reconnecter |

**Réserve à porter au moment de faire 1.1 :** rouvrir le gate rouvre la boucle que l'incident
P0 `c830f9a9` avait causée. Les trois garde-fous existants (progression persistée à chaque
étape, sortie « reprendre plus tard » locale et non une route séparée, redirection jamais
vers elle-même) doivent tenir sur ce nouveau chemin, et le test e2e doit couvrir le cycle
soumission, correction demandée, resoumission, sans reboucle.

### Lot 2 ⬅ PROCHAIN : mise en service (défauts H, K, L, M, N)

| Tâche | Contenu | Critère de sortie |
|---|---|---|
| 2.1 | Poser `MAPBOX_TOKEN` dans les secrets Supabase (même valeur que `VITE_MAPBOX_TOKEN`) | `address_geocode` rend un verdict en production |
| 2.2 | Confirmer le cron : `select jobname, schedule, active from cron.job where jobname = 'agency-verification-sweep-hourly'` | le filet de rattrapage tourne réellement |
| 2.3 | Faire tourner `e2e-kyb` en CI, une fois, sur une PR | le job est vert sur `main`, pas seulement en local |
| 2.4 | **Purge des pièces d'identité** : `on delete` en cascade côté Storage, ou job de purge. Décider la durée de rétention avec le DPO (voir `docs/compliance/`) | aucune pièce d'identité ne survit à la personne ou à l'agence qui la portait |
| 2.5 | Trancher le gate rétroactif et l'écran mobile | décision écrite, comportement conforme |

### Lot 3 : élargir la couverture (défauts I, J, O, P, et le squelette UID)

Par ordre de valeur décroissante. **Aucune de ces tâches ne rend un dossier auto-validable
tant que le lot 0 n'est pas fait**, ce qui est exactement l'inverse de ce que dit l'ancien
handoff.

| Tâche | Débloque | Dépend de |
|---|---|---|
| 3.1 | **`signatory_registry_match` par LINDAS.** Poids 3.00, le plus lourd du catalogue avec `vat_lookup`, et LINDAS le sert. Check de **personne**, donc il attend l'extension de `record_agency_verification_run` faite au lot 0.2 | tâche 0.2 |
| 3.2 | **`address_registry_match` et `activity_code_match` par LINDAS** (`schema:address`, `municipality`, `additionalType`). 4.50 points de poids, sans aucun secret | rien |
| 3.3 | **Relancer les identifiants Zefix PublicREST** (`zefix@bj.admin.ch`, sans réponse depuis le 26.07.2026). Fait passer `registry_lookup` de `partial` à `match` pour la Suisse. **Nécessaire mais non suffisant** pour une auto-validation suisse | un tiers |
| 3.4 | **Trancher `LI`** : éprouver la clé FL-UID sur des numéros réels et l'ajouter à `registry_number_format`, ou retirer `LI` du wizard | des numéros liechtensteinois réels |
| 3.5 | **Clarifier le registre UID** : API séparée ou champ Zefix ? Puis écrire le connecteur | un tiers |
| 3.6 | **Retester GLEIF depuis une Edge Function réelle** | rien |
| 3.7 | **Décider du sort des 4 signaux faibles jamais servis** (`domain_website_match`, `domain_trade_name_similarity`, `phone_country_match`, et `lei_lookup` si GLEIF ne répond pas) : les servir ou les retirer du barème. Un catalogue qui promet un contrôle inexistant est une dette d'audit | rien |

### Lot 4 : le KYC agent léger (défaut F)

Hors périmètre du KYB, à cadrer séparément avec Thomas et Gregory. Ce n'est pas un détail
d'implémentation : c'est une décision de conformité sur qui répond de l'identité d'un agent
invité.

---

## 11. Ce que la documentation existante dit de faux

À corriger, ou à lire en sachant que c'est périmé.

| Où | Ce qui est dit | La réalité au 30.07.2026 |
|---|---|---|
| agency-kyb-handoff.md §7bis, « France » | « une agence française obtient l'accès aux gestes que ferment les gardes LAB sur une seule décision humaine » | **faux en production.** La mesure est réelle mais sa fixture pose `pep_sanctions_screening` à la main. Aucun pays ne peut s'auto-valider aujourd'hui : voir §9 A. C'est la correction la plus importante de ce document |
| agency-kyb-handoff.md §10, point 4 | les identifiants Zefix sont « **la seule chose** qui rendra un dossier suisse auto-validable » | nécessaire, **pas suffisant** : le véto `pep_sanctions_screening` bloque en amont, indépendamment de la Suisse |
| [agency-kyb-handoff.md:529](../../agency-kyb-handoff.md#L529) | « Sur `admin.megga.ch`, application séparée (`npm run build:admin`) » | l'application autonome a été **retirée le 28.07.2026**. La file de revue est une surface du CRM, montée sous `ADMIN_CONSOLE_PATH` + `/kyb-review` ([AdminConsoleRoutes.tsx:67](../../../src/components/admin/AdminConsoleRoutes.tsx#L67)). Il n'y a plus de `build:admin` |
| [agency-kyb-handoff.md:1341](../../agency-kyb-handoff.md#L1341) §10 | « il reste un merge à faire » | **il n'en reste aucun.** Toutes les branches du chantier sont à 0 commit d'avance sur `main` |
| [agency-kyb-handoff.md:1352](../../agency-kyb-handoff.md#L1352) | « Re-dater les 20 migrations le jour du merge. C'est la seule action obligatoire » | **fait**, et appliqué en production. La consigne reste valable pour la prochaine fois, pas pour maintenant |
| agency-kyb-handoff.md §7ter | « la branche distante s'arrête à `1b2cb9eb` et le travail la dépasse de 124 commits » | tout est intégré |
| agency-kyb-handoff.md §2 | les commandes de re-datage avec les globs `202607261[34]*` et `20260727*` | ces globs ne désignent plus rien. La procédure réelle est au §7ter |
| CLAUDE.md, secrets | `UID_REGISTER_API_URL`, `UID_REGISTER_API_CREDENTIAL` listées | exact, mais **non configurées** ; le fichier le dit déjà |

---

## 12. Carte des fichiers

**Migrations** (`supabase/migrations/`), dans l'ordre d'application

| Fichier | Rôle |
|---|---|
| `20260729150000_legal_forms_reference.sql` | référentiel des formes juridiques, alias, `normalize_legal_form_text()` |
| `20260729150100_agencies_kyb_columns.sql` | renommage `ide` vers `business_registration_number`, FK forme juridique, backfill, état de vérification |
| `20260729150200_agency_related_persons.sql` | personnes de conformité, rôles, `is_agency_admin()` |
| `20260729150300_agency_verification_checks.sql` | catalogue des 19 types, config pondérée versionnée, 2 journaux de checks |
| `20260729150400_auth_user_created_trigger.sql` | `on_auth_user_created` versionné (il n'était dans aucune migration) |
| `20260729150500_signup_agency_provisioning.sql` | `handle_new_user()` et `provision_solo_agency()` corrigés, backfill des fondateurs |
| `20260729150600_revoke_join_agency.sql` | `join_agency(uuid)` révoquée d'`authenticated` |
| `20260729150700_agencies_identity_submission.sql` | `identity_submitted_at`, statut `validated` |
| `20260729150800_submit_agency_identity.sql` | RPC de soumission, garde de complétude, verrou `FOR UPDATE` |
| `20260729150900_kyb_identity_documents_storage.sql` | préfixe Storage `kyb-identity` et ses 4 policies dédiées |
| `20260729151000_submit_agency_identity_id_document.sql` | pièce d'identité du signataire, check `id_document` |
| `20260729151100_agency_verification_config.sql` | `get_agency_verification_config()`, seuils réglables |
| `20260729151200_recompute_agency_verification.sql` | **le moteur** : score, vétos, statut |
| `20260729151300_record_agency_verification_run.sql` | écriture des checks + moteur + journal, en une transaction |
| `20260729151400_trigger_agency_verification_on_submit.sql` | déclenchement depuis la soumission, et `sweep_pending_agency_verifications` |
| `20260729151500_agency_review_queue.sql` | file de revue admin et ses quatre décisions humaines |
| `20260729151600_lock_agency_verification_columns.sql` | écriture des colonnes de vérification révoquée aux rôles utilisateur |
| `20260729151700_kyc_cases_insert_lab_guard.sql` | garde LAB dans le `WITH CHECK` de `kyc_cases_insert` |
| `20260729151800_activity_events_allow_agency_detach.sql` | le `SET NULL` d'une FK devient un cas autorisé du journal append-only |
| `20260729160000_agency_review_queue_pagination.sql` | file paginée, `p_limit` plafonné à 1000, `total_count` |
| `20260729180000_agency_check_source_internal.sql` | valeur de source `internal` pour un contrôle calculé sans réseau |

**Backend**

| Fichier | Rôle |
|---|---|
| `supabase/functions/agency-verification-run/index.ts` | le passage de vérification : lit l'agence, compose et filtre le registre, appelle la RPC |
| `supabase/functions/_shared/kyb-sources.ts` | 2266 lignes : contrat, harnais, 9 connecteurs, règle de juridiction, squelette UID |
| `supabase/functions/_shared/agency-lab-guard.ts` | `requireAgencyLabCleared`, `isAgencyLabClearedInDb` |
| `supabase/functions/kyc-screening/index.ts` | surface LAB 1 |
| `supabase/functions/sign-document/index.ts` | surface LAB 2 |
| `supabase/functions/_shared/whatsapp-actions.ts` | surface LAB 3 (les **deux** étages du tier confirm) |
| `src/lib/edgeFunctionRoster.ts` | inventaire des Edge Functions, gaté par `npm run lint:roster` |

**Frontend**

| Fichier | Rôle |
|---|---|
| `src/hooks/useIdentityGate.ts` | gate, `resolveIdentityGateStatus` (pure, testée hors React) |
| `src/hooks/useAgencyIdentity.ts` | lecture et écriture du wizard, upload des pièces |
| `src/hooks/useLegalForms.ts` | options du menu, filtrées par pays du siège |
| `src/hooks/useLabGuard.ts` | garde LAB côté CRM agent |
| `src/hooks/useAdminKybReview.ts` | file de revue de la console admin |
| `src/hooks/useAgencySettings.ts` | réglages agence (voir défaut D) |
| `src/components/crm-sugar-identity/IdentityShell.tsx` | coquille du wizard, navigation et persistance |
| `src/components/crm-sugar-identity/steps/Step*.tsx` | les 5 étapes |
| `src/pages/agent/IdentitySugarPage.tsx`, `IdentityMobileNotice.tsx` | route `/dashboard/identite` |
| `src/pages/admin/AdminKybReviewPage.tsx` | écran de la file de revue |
| `src/components/layout/KycLabGuard.tsx`, `LabGuardBanner.tsx` | blocage et bandeau |
| `src/i18n/locales/{fr,de,en,it}/onboarding.json` | 129 clés, 4 langues, à parité |

**Tests**

| Fichier | Rôle |
|---|---|
| `tests/backend/agency-verification-run.spec.ts` | Edge Function, connecteurs, juridiction, squelette UID, et les trois mesures pays par pays du §6 |
| `tests/backend/agency-verification-engine.spec.ts`, `agency-verification-config.spec.ts` | moteur et barème |
| `tests/backend/agency-review-queue.spec.ts` | file et décisions humaines |
| `tests/backend/agency-identity-submit.spec.ts` | RPC de soumission, complétude, idempotence |
| `tests/backend/agency-kyb-verification.spec.ts` | non-régression du schéma, référentiel, backfill, policies |
| `tests/backend/agency-lab-guard.spec.ts`, `kyc-cases-insert-lab-guard.spec.ts`, `open-kyc-case-lab-guard.spec.ts` | les trois gardes LAB |
| `tests/backend/kyb-identity-documents-storage.spec.ts` | les 8 policies du préfixe `kyb-identity` |
| `tests/backend/signup-provisioning.spec.ts`, `onboarding-agency-rpc.spec.ts` | chemin d'inscription |
| `tests/backend/agencies-verification-columns-lockdown.spec.ts` | colonnes de vérification en lecture seule |
| `tests/unit/identity-gate.spec.ts`, `identity-shell-navigation.spec.ts`, `useAgencyIdentity.spec.ts`, `lab-guard.spec.ts`, `admin-kyb-review-reasons.spec.ts` | unitaires |
| `tests/e2e/onboarding-identite.spec.ts` + `playwright.kyb.config.ts` | cycle complet, authentification réelle, job CI `e2e-kyb` |

**Plans d'implémentation** (le raisonnement tâche par tâche) :
`docs/superpowers/plans/2026-07-2{6,7,8,9}-onboarding-kyb-etape*.md`, un par étape.

**Runbook** : `docs/runbooks/trigger-inscription-duplique.md`, rétablissement si le trigger
d'inscription se retrouve en double.

---

## 13. Étapes du handoff

Une passation utile n'est pas une lecture : c'est une reproduction. Dans cet ordre.

1. **Monter l'environnement** (§8.1) et faire tourner `supabase db reset && npm run test:backend`.
   Si la suite passe, la base est saine et le reste de ce document est fiable. **Ne pas
   continuer si elle ne passe pas** : tout ce qui suit suppose une base à jour.
2. **Lire le §7 en entier.** Seize invariants, chacun né d'un défaut réel. C'est la partie du
   document dont l'oubli coûte le plus cher.
3. **Rejouer une vérification de bout en bout**, en local, sur un dossier français : créer une
   agence, soumettre, observer les checks écrits, le score et le statut. Un SIREN réel utile
   pour cela : `510761505`. **Constater que le dossier reste en `manual_review` même avec un
   score de 1.000 et une pièce d'identité tranchée** : c'est le défaut A, et le voir une fois
   dispense de le réexpliquer.
4. **Rejouer le même exercice sur un dossier suisse** (IDE `CHE-105.909.036`) et constater que
   `registry_lookup` vaut `partial`. C'est la seconde raison, indépendante de la première, pour
   laquelle un dossier suisse n'aboutit pas seul.
5. **Ouvrir la file de revue admin** et trancher un dossier : valider, rejeter, relancer,
   résoudre une pièce d'identité. Puis **constater le défaut B** en essayant de faire revenir
   le dossier rejeté au wizard.
6. **Confirmer les deux points non vérifiés** : le cron (§3) et le job `e2e-kyb` (§8.4).
7. **Poser `MAPBOX_TOKEN`** (§8.2, tâche 2.1). Geste de 30 secondes, gain immédiat.
8. **Lire les deux arbitrages déjà rendus** (§2, lignes « Screening PEP » et « Dossier renvoyé
   pour correction »). Ils conditionnent le CHECK de `verification_status`, le moteur,
   `useLabGuard` et la file : ne pas les rouvrir sans repasser par Thomas.
9. **Corriger le §11** dans les documents concernés, pour que le prochain qui arrive ne
   reconstitue pas ce travail.

---

## 14. Lexique

| Terme | Sens dans ce dépôt |
|---|---|
| **KYB** | Know Your Business : vérification de l'identité d'une **agence** (personne morale) |
| **KYC** | Know Your Customer : vérification d'un **client final** de l'agence, autre dispositif |
| **LAB** | Lutte anti-blanchiment |
| **véto** | check bloquant, hors score, qui ne passe que sur `match` |
| **signal moyen / faible** | check qui contribue au score, jamais bloquant seul |
| **gate** | écran qui retient le dirigeant sur le wizard tant qu'il n'a pas soumis |
| **garde LAB** | blocage d'une surface à risque tant que l'agence n'est pas vérifiée |
| **auto_validated** | décision du moteur |
| **validated** | décision d'un humain. La distinction est **exactement** ce qu'un audit LAB regarde |
| **LINDAS** | endpoint SPARQL public de la Confédération, `https://lindas.admin.ch/query` |
| **IDE / UID** | numéro d'identification des entreprises suisse (`CHE-xxx.xxx.xxx`) |
| **FL-UID** | son équivalent liechtensteinois, même préfixe `CHE`, **non éprouvé** ici |
| **date-guard** | filtre de `deploy.yml` qui saute les migrations antérieures au jour courant |
