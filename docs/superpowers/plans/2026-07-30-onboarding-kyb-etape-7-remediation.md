# Onboarding KYB, étape 7 : le véto sans source et la boucle de remédiation

> **Pour les agents :** SOUS-SKILL REQUIS, utiliser `superpowers:subagent-driven-development`.
> Une tâche par sous-agent, une revue entre chacune. Ce cadencement a trouvé un défaut réel à
> presque chaque tâche des étapes 1 à 6, dont plusieurs critiques.

**Écrit le :** 30 juillet 2026, après l'audit consigné dans
[docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md](../../handoff/onboarding-api/HANDOFF_ONBOARDING_API.md).
Les lettres de constat (A, B, C, D, E, G) renvoient au §9 de ce document.

**Goal :** rendre le dispositif d'onboarding utilisable par un humain de bout en bout. Trois
choses aujourd'hui l'en empêchent : aucun dossier ne peut s'auto-valider, un dossier rejeté est
un cul-de-sac, et une agence validée peut changer son identité déclarée sans trace ni
revérification.

**Non-goal :** élargir la couverture des sources. Aucun nouveau registre, aucun nouveau pays.
Le lot 3 du handoff attend, et il attend **derrière** cette étape, parce qu'un connecteur de
plus ne fait rien aboutir tant que le véto sans source bloque tout.

---

## Le fait qui commande l'étape

`pep_sanctions_screening` est déclaré **véto de personne** dans le catalogue
(`20260729150300`, `is_veto = true`). Le moteur exige que chaque signataire actif passe chaque
véto de personne, et un résultat manquant échoue exactement comme un résultat défavorable
(`where lpc.result is distinct from 'match'`).

Or **aucun chemin de production n'écrit jamais de ligne `pep_sanctions_screening`.** Il n'y a
que trois `insert into agency_person_verification_checks` dans tout le dépôt, tous scopés à
`id_document` ; `record_agency_verification_run` n'écrit que dans `agency_verification_checks` ;
et `admin_resolve_agency_id_document` refuse tout autre type.

Donc `veto_failed` est toujours vrai, `verification_status` vaut toujours `manual_review`, et
**la branche `auto_validated` est du code mort en production.**

La preuve existe déjà et elle passe :
`tests/backend/agency-verification-engine.spec.ts:596`, « un veto PERSONNE ABSENT envoie en
revue ». C'est exactement le cas de production. Les mesures pays par pays du §7bis de l'ancien
handoff, elles, posent ce véto à la main dans leur fixture
(`tests/backend/agency-verification-run.spec.ts:1246`) : c'est ce qui a rendu le problème
invisible pendant six étapes.

---

## Deux arbitrages, tranchés le 30 juillet 2026 par Thomas

> **Décisions actées, plus rien à demander avant de coder :**
> 1. `pep_sanctions_screening` est **branché sur Dilisense** (option A ci-dessous).
> 2. La remédiation passe par un **nouveau statut `correction_requested`** (option A ci-dessous),
>    et `rejected` **reste terminal**.
>
> Le raisonnement qui suit est conservé parce qu'il dit **pourquoi**, et parce que la réserve de
> coût sur la première décision reste vraie : c'est la plus chère des trois options.

Les deux touchent au CHECK de `verification_status`, au moteur, à `useLabGuard` et à la file de
revue. Les trancher après avoir codé coûterait une reprise sur trois couches.

### Arbitrage 1 : le sort de `pep_sanctions_screening`

| Option | Ce qu'elle affirme | Coût |
|---|---|---|
| **A. Brancher Dilisense** | un screening PEP et sanctions conditionne l'accès aux surfaces LAB | Dilisense est déjà dans la pile (`kyc-screening`, `DILISENSE_API_KEY` posée). Il faut étendre `record_agency_verification_run` aux checks de personne, qu'elle n'écrit pas |
| **B. Retirer `is_veto`** | ce screening n'est pas une condition d'accès, il redevient un signal ou disparaît | une ligne de config, aucun code. Mais c'est une position de conformité assumée, à faire valider |
| **C. Le résoudre à la main** | un relecteur tranche le screening comme il tranche la pièce d'identité | une RPC de plus, et une charge humaine de plus sur chaque dossier |

**Recommandation : A**, et voici pourquoi. Le dispositif entier est construit sur l'idée qu'une
preuve manquante envoie en revue humaine plutôt que de valider sur ce qu'on n'a pas. B inverse
cette logique sur le seul véto qui touche aux sanctions internationales, c'est-à-dire sur celui
où elle compte le plus. C fonctionne mais ajoute une décision humaine par dossier alors que la
donnée est automatisable et déjà payée. A est aussi la seule option qui laisse le catalogue
dire la vérité sur ce qu'il contrôle.

**Réserve à porter avec la recommandation :** A est la plus chère des trois, parce qu'elle
demande d'étendre `record_agency_verification_run` aux checks de personne. Cette extension
sert ensuite `signatory_registry_match` (poids 3.00, servi par LINDAS, lot 3.1 du handoff),
donc elle n'est pas perdue. Si le calendrier ne le permet pas, **C est un repli honnête**, B
ne l'est pas.

### Arbitrage 2 : la forme de la remédiation

| Option | Effet |
|---|---|
| **A. Nouveau statut `correction_requested`** | l'audit distingue « rejeté » de « à corriger ». Touche le CHECK de `verification_status`, le moteur (ne doit pas l'écraser), `useLabGuard` (nouveau cas bloqué), la file de revue (nouveau filtre) |
| **B. Retour à `pending`** | aucun changement de CHECK, mais le journal perd la distinction : on ne saura pas, en relisant, si un dossier était neuf ou renvoyé |

**Recommandation : A.** La distinction `auto_validated` / `validated` a été ajoutée à ce
chantier précisément parce que « qui a décidé » est ce qu'un audit LAB regarde. « Pourquoi ce
dossier est revenu » relève de la même famille. Le coût est réel mais localisé, et il se paie
une fois.

**Question subsidiaire, tranchée avec la principale : `rejected` reste terminal.** C'est
cohérent uniquement parce que `correction_requested` existe : un relecteur qui veut laisser une
chance demande une correction, un relecteur qui rejette ferme le dossier. Deux gestes, deux sens,
et un rejet qui peut se défaire n'est plus un rejet.

---

## Découpage en tâches

Sept tâches, séquentielles, une par sous-agent avec une revue entre chacune. Les deux
arbitrages étant rendus, **aucune tâche n'attend plus de réponse**.

### Tâche 1 : le test qui interdit un véto orphelin

**Ne dépend de rien. À faire en premier, avant toute correction.**

Écrire dans `tests/backend/agency-verification-engine.spec.ts` un test qui, pour **chaque**
type déclaré véto dans `verification_check_config` (`is_veto` et `valid_to is null`), exige
qu'au moins l'une des deux propositions soit vraie :

- un connecteur du registre le déclare (`checkType` dans les sources de `_shared/kyb-sources.ts`,
  y compris les fabriques), ou
- une RPC de décision humaine peut le résoudre.

Ce test doit être **rouge maintenant**, sur `pep_sanctions_screening`, et le prouver avant
d'écrire quoi que ce soit d'autre. Un test jamais vu échouer ne prouve rien : c'est la règle qui
a servi à chaque étape de ce chantier, appliquée par mutation.

> Piège à éviter : ne pas coder la liste des vétos en dur dans le test. La table est la source
> de vérité, et un test qui recopie la table ne détecte jamais un ajout.

**Critère de sortie :** le test échoue en nommant `pep_sanctions_screening`, et il passera dès
que la tâche 4 ou 5 aura tranché.

### Tâche 2 : la pièce d'identité redevient remplaçable (constat C)

Deux impasses à lever, dans une **nouvelle** migration, jamais en reprenant
`20260729151000` ni `20260729151500` : elles sont appliquées en production, leur version
d'origine est déjà enregistrée.

1. `submit_agency_identity` : la garde anti-doublon ne repose jamais de ligne dès qu'une ligne
   existe, quel qu'en soit le `result`. La filtrer sur `result` : reposer une ligne
   `pending_manual_review` quand la précédente vaut `mismatch` ou `partial`.
2. `admin_resolve_agency_id_document` : elle refuse de retrancher une pièce déjà résolue
   (`id_document check already resolved for this person`). Le relecteur doit pouvoir trancher la
   **nouvelle** ligne. Choisir le prédicat avec soin : ce qui doit être interdit, c'est de
   retrancher deux fois la **même** ligne, pas de trancher une ligne différente.

**Réserve à vérifier avant de coder :** ces deux fonctions sont dans deux migrations
différentes et `submit_agency_identity` a été redéfinie **trois fois** (`20260729150800`,
`20260729151000`, `20260729151400`). Repartir de la **dernière** version, `20260729151400`, et
la recopier intégralement dans la nouvelle migration. Une `create or replace` partielle
perdrait le déclenchement `net.http_post`.

**Critère de sortie :** un test backend qui pose un `mismatch`, redépose une pièce, obtient une
nouvelle ligne `pending_manual_review`, et la fait trancher par le relecteur.

### Tâche 3 : les données déclarées cessent d'être modifiables en silence (constat D)

Trois volets, un seul objectif : qu'aucune identité vérifiée ne puisse être remplacée sans
trace.

1. **Restreindre `agencies_members_update`** aux rôles `admin` et `manager`. Le `TODO RBAC` de
   `20260527010000` dit lui-même que la policy est ouverte « pour l'instant » parce que l'app
   n'avait qu'un rôle effectif. Elle en a plusieurs depuis, et `provision_solo_agency` pose
   `admin` sur le fondateur.
2. **Geler les colonnes déclaratives** une fois `identity_submitted_at` posé :
   `legal_name`, `legal_form_id`, `business_registration_number`, `country`, `tva`, `address`,
   `canton`, `city`, `postal_code`. Même patron que `20260729151600` : REVOKE de colonne
   **et** trigger, deux défenses indépendantes. La seconde attrape ce que la première laisse
   passer quand l'écriture vient d'un chemin `SECURITY DEFINER`.
3. **Journaliser** tout changement de ces colonnes dans `activity_events`
   (`category='kyc'`, `actor_kind='user'`), y compris avant soumission. La règle de dépôt dit
   « `activity_events` pour toute action » et cet écran n'en écrit aucun.

**Réserve importante :** geler ces colonnes ferme aussi le chemin légitime « je me suis trompé
d'un chiffre dans mon numéro de registre ». C'est **précisément** ce que la tâche 5 rouvre, par
la voie contrôlée. Faire la tâche 3 sans la tâche 5 laisse une agence bloquée sur une faute de
frappe : les deux vont ensemble, et la 5 ne peut pas passer avant la 3 sans laisser un trou
ouvert entre les deux.

**Piège à ne pas reproduire :** l'étape 5 avait découvert qu'un garde lisant un fait que le
gardé contrôle ne garde rien. Vérifier que le trigger ne s'appuie pas sur une valeur que
l'appelant peut poser lui-même.

**Critère de sortie :** un test backend prouvant qu'un agent simple ne peut plus écrire
`legal_name`, qu'un dirigeant ne peut plus le faire après soumission, et qu'un changement
avant soumission laisse un `activity_events`.

### Tâche 4 : le véto sans source, volet écriture (arbitrage 1, tranché : Dilisense)

1. Étendre `record_agency_verification_run` pour accepter des checks de **portée personne**.
   Décider la forme du paramètre : un second tableau, ou un champ de portée sur les lignes
   existantes. Le second tableau est plus explicite et évite qu'une ligne mal typée aille dans
   la mauvaise table.
2. Écrire le connecteur Dilisense comme un `KybSource`, en respectant les cinq règles du contrat
   (§5.2 du handoff), notamment : **ne jamais choisir `unavailable` soi-même**, et
   `raw_response` obligatoire.
3. Le connecteur porte sur une **personne**, pas sur l'agence. `AgencyForVerification` ne
   contient aucune donnée de personne : il faut soit l'étendre, soit introduire un second
   contrat pour les sources de personne. **Trancher explicitement, et le documenter** : c'est
   la décision structurante de cette tâche, et elle vaut aussi pour
   `signatory_registry_match`.

**Critère de sortie :** un dossier français complet atteint `auto_validated` **sans qu'aucune
fixture ne pose de check à la main**. C'est la première fois que ce serait vrai.

> **Si Dilisense s'avère injoignable depuis le runtime edge**, ne pas inventer de repli
> silencieux : le connecteur lève, le harnais traduit en `unavailable`, et le dossier part en
> revue humaine, exactement comme aujourd'hui. Signaler le fait plutôt que de le contourner, et
> ouvrir alors la RPC `admin_resolve_agency_person_check` (généralisation de
> `admin_resolve_agency_id_document` à tout véto de personne) comme voie de sortie humaine.
> C'était l'option C de l'arbitrage, et elle reste le repli honnête.

### Tâche 5 : la boucle de remédiation (constat B, arbitrage 2, tranché : `correction_requested`)

1. Nouvelle valeur `correction_requested` au CHECK de `agencies.verification_status`.
2. RPC `admin_request_agency_correction(p_agency_id uuid, p_reason text)`, cinquième décision
   humaine : remet `identity_submitted_at` à NULL, pose `correction_requested`, journalise
   (`activity_events`, `category='kyc'`, motif dans `metadata` comme le fait déjà
   `admin_reject_agency_review`). Mêmes droits que les quatre autres : `EXECUTE authenticated`,
   garde interne `is_super_admin()`, verrou `FOR UPDATE`.
3. `recompute_agency_verification` **ne doit pas écraser** `correction_requested`, au même titre
   que `rejected` et `validated`. Une seule ligne à ajouter, et l'oublier ferait effacer la
   décision au premier passage du filet horaire.
4. `useLabGuard` : nouveau cas bloqué, avec son propre libellé. Ni le bandeau ni l'écran de
   blocage ne doivent dire « en attente de vérification » à quelqu'un dont on attend une
   correction.
5. La file de revue doit cesser de montrer ces dossiers (ils n'attendent plus le relecteur), et
   les faire revenir dès la resoumission.

**La réserve la plus importante de tout ce plan :** rouvrir le gate rouvre le chemin de
l'incident P0 `c830f9a9` (« boucle onboarding »). Les trois garde-fous existants doivent tenir
sur ce nouveau chemin : progression persistée à chaque étape et pas seulement à la fin, sortie
« reprendre plus tard » qui mène à un écran d'attente local et jamais à une redirection, et
redirection jamais émise vers la route du gate elle-même. **Ne pas les vérifier par lecture :
les vérifier par le test e2e**, en ajoutant à `tests/e2e/onboarding-identite.spec.ts` un
quatrième cas, soumission puis correction demandée puis resoumission puis relogin, sans
reboucle.

**Critère de sortie :** ce test e2e passe, exécuté pour de vrai (`npm run test:e2e:kyb`), et le
compte de tests est lu, pas le code de sortie.

### Tâche 6 : la notification (constat E)

**Attend la tâche 5**, pour connaître les statuts à notifier.

Un e-mail par Resend sur chaque décision humaine : validé, rejeté, correction demandée. Réutiliser
le patron d'e-mail transactionnel existant du dépôt, ne pas en introduire un second. Les libellés
dans les quatre langues (`src/i18n/locales/*/onboarding.json`, 129 clés aujourd'hui, à garder
à parité), et **sans tiret cadratin** : `npm run lint:prose` le refuse, et il se skippe en
local, donc gater sur la CI.

**Critère de sortie :** un test backend qui prouve l'appel, et la parité i18n vérifiée par
`npm run i18n:parity`.

### Tâche 7 : remettre la documentation d'aplomb

1. Corriger dans `docs/agency-kyb-handoff.md` les six points listés au §11 du handoff API, en
   commençant par le §7bis, dont l'affirmation sur la France est la plus trompeuse.
2. Mettre à jour le §9 et le §10 du handoff API avec ce qui a été livré.
3. Mettre le cerveau à jour : éditer
   `.claude-flow/knowledge/megga-memory.seed.json` puis `npm run ruflo:seed`.
   **Réserve connue :** cette commande ne rafraîchit pas `hnsw.index`, donc qui édite le cerveau
   et ne lance que ça continue de lire l'ancien texte. Vérifier après coup par une recherche.

---

## Vérification de fin d'étape

Aucun de ces chiffres ne se suppose. Les relever, les écrire.

```bash
supabase db reset                 # TOUJOURS avant de conclure
npm run test:backend              # lire le compte de tests, jamais le code de sortie
npm run test:unit
npm run test:e2e:kyb
npm run lint
npm run check:drift
npm run lint:migrations
npm run lint:roster
npm run i18n:parity
```

Référence au 30 juillet 2026, avant cette étape : **391** tests backend sur les 12 specs KYB,
**1325** tests unitaires, **3** e2e KYB, lint à **0 erreur**.

Et deux vérifications qui ne sont pas des tests :

- **La revue par mutation.** Pour chaque garde ajouté, le retirer et prouver que le test
  échoue, puis le remettre. Un garde qu'aucun test ne voit tomber n'est pas gardé.
- **La mesure en base.** Pour la tâche 4, relever le score et le statut d'un dossier réel avant
  et après, comme l'ont fait les trois mesures pays par pays du §7bis. Un `auto_validated`
  déduit du code ne compte pas.

---

## Contraintes de dépôt à ne pas redécouvrir

| Contrainte | Détail |
|---|---|
| **Jamais de reprise sur place** d'une migration mergée | sa version d'origine est déjà enregistrée en production ; toute correction est un **nouveau** fichier |
| **Re-dater les migrations le jour du merge** | le date-guard de `deploy.yml` saute définitivement celles antérieures au jour courant, avec un simple `::warning::` |
| `activity_events` | `category='kyc'` (`'compliance'` n'existe pas dans le CHECK) ; `actor_kind='system'` **impose** `actor_id` NULL |
| Aucune transaction Postgres n'attend un HTTP externe | le réseau reste en Deno |
| `_shared/kyb-sources.ts` reste pur | aucun import, aucun `Deno.env.get` ; un connecteur à secret est une fabrique appelée depuis `index.ts` |
| Un push sur une branche de feature ne déclenche **aucune** CI | les workflows ne se déclenchent que sur `main` et sur les PR ciblant `main` |
| Postgres local partagé | éviter les opérations destructives hors `db reset` |
| Pas de `bg-white`, `text-gray-*`, ni d'ombre sur un bento | tokens de thème seulement (`CLAUDE.md` §3) |

---

## Ce qui reste hors de cette étape, et pour qui

Ces trois points ne sont pas du code et ne peuvent pas être faits ici.

| Action | Pour qui |
|---|---|
| Poser `MAPBOX_TOKEN` dans les secrets Supabase (même valeur que `VITE_MAPBOX_TOKEN`) | **Julien** : ce dépôt ne touche pas aux services directement |
| Confirmer `select jobname, schedule, active from cron.job where jobname = 'agency-verification-sweep-hourly'` | **Julien** |
| Relancer `zefix@bj.admin.ch` pour les identifiants PublicREST | **Thomas** |
