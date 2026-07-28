# KYB agences et onboarding — fichier de relais

> **Pour qui :** Antoine, qui reprend ce chantier.
> **Écrit le :** 26 juillet 2026 (Antoine). **Mis à jour le :** 28 juillet 2026, après
> la livraison et la vérification complète de l'étape 2 (gate et wizard).
> **Branche :** `feat/agency-kyb-verification` @ `276e4d5a`.
>
> **Trois documents, trois rôles :**
> - celui-ci dit **où on en est et quoi faire**, étape par étape ;
> - [agency-kyb-verification.md](agency-kyb-verification.md) porte les **décisions de
>   conception du schéma et de la vérification** ;
> - [2026-07-26-onboarding-kyb-design.md](superpowers/specs/2026-07-26-onboarding-kyb-design.md)
>   porte la **conception du parcours utilisateur**, écrite après ton départ.

---

## En une minute

Le schéma est livré, exécuté pour de vrai et testé. Ce qui manquait à ton départ, ce
n'était pas seulement le moteur : c'était aussi **ce qui remplit les tables**. Le
parcours d'onboarding est maintenant cadré et décidé.

| | État |
|---|---|
| Schéma DB (8 tables, 4 migrations) | livré, exécuté sur Postgres 17 local, testé |
| Frontend Réglages → Agence (forme juridique, n° de registre) | livré, build et 951 tests unitaires verts |
| Tests de non-régression | 16 tests, `tests/backend/agency-kyb-verification.spec.ts` |
| Docs et cerveau système | à jour |
| Conception du parcours d'onboarding | **faite** (spec, voir en-tête) |
| Correctifs d'existant | livré, étape 1, 8 tests de non-régression |
| Trigger d'inscription versionné | livré, il n'était dans aucune migration |
| Gate et wizard de saisie | fait, étape 2 |
| Moteur de scoring | fait, étape 3, ta conception §7 reprise telle quelle |
| Connecteurs disponibles | à faire, étape 4 |
| File de revue admin et gardes LAB | à faire, étape 5 |
| Connecteurs Zefix et UID | bloqués, étape 6 |

**Six étapes sur sept ne dépendent d'aucune réponse externe.** Tu peux tout enchaîner
sans attendre Zefix.

---

## 0. Ce qui a changé depuis ton départ

### Décisions produit (Thomas)

| Sujet | Décision |
|---|---|
| Modèle | Self-serve, saisie à la charge de l'utilisateur, au niveau agence |
| Utilisateur individuel | N'ouvre pas de compte en self-serve. Il entre par invitation d'une agence existante et relève du KYC agent léger, pas du KYB |
| Accès pendant la vérification | Accès complet dès la saisie soumise, bandeau de rappel, blocage des seules actions à risque LAB |
| Exemption de gate | Les trois comptes développeurs uniquement (Julien, Antoine, Thomas) |
| Reprise de données | Aucune. Base entièrement mock, aucun client connecté |
| Prestataire liveness | Aucun pour l'instant. Upload relu par un humain, le slot reste ouvert dans le schéma |

Ton cadrage §1 (« un dirigeant crée un compte agence dont l'identité est vérifiée ;
ce compte crée ensuite les comptes agents ») est confirmé. Ce qui manquait, c'est que
**ce parcours n'existe pas dans le dépôt** : il a été supprimé le 18 juillet, huit
jours avant que tu écrives (voir ci-dessous).

### Trois découvertes en relisant le dépôt

Aucune n'était visible depuis ce que tu avais sous les yeux : tes RLS sont correctes,
le chemin d'inscription aussi, c'est leur rencontre qui ne marche pas.

**a) Le fondateur ne peut pas écrire ses propres données KYB.**

La vitrine envoie `role:'agent'` dans `raw_user_meta_data`, `handle_new_user()` fige
cette valeur, et `provision_solo_agency()` ne touche pas au rôle (commentaire explicite :
« Ne touche PAS role »). Or ton `is_agency_admin()` exige `admin` ou `manager`.

Conséquence : dans l'état actuel du dépôt, le dirigeant d'une agence auto-provisionnée
échoue à ta garde et ne peut rien insérer dans `agency_related_persons`. **Le parcours
est structurellement bloqué avant même d'exister.** C'est le premier correctif de
l'étape 1, et sans lui rien du reste ne tourne.

À noter : `create_agency_and_join` fait pourtant l'inverse, l'appelant devient `admin`.
L'incohérence date de la migration du 18 juillet.

**b) Il manquait un statut : `validated`.**

Ton énumération est `pending | auto_validated | manual_review | rejected`. Quand un
relecteur valide un dossier parti en revue humaine, aucune valeur ne convient :
`auto_validated` mentirait sur l'origine de la décision, et c'est exactement la
distinction qu'un audit LAB regarde. On ajoute `validated` pour la décision humaine,
`auto_validated` restant réservé au moteur, avec la même règle de non-écrasement que
`rejected`.

**c) Le parcours d'onboarding a été supprimé le 18 juillet.**

Commit `d4cbe117` (PR #876), environ 9 600 lignes : wizard `onboarding-sugar`
(`StepAgence`, `StepKYC`, `StepProfilAgent`, `StepProfilAgence`), Premier jour, gate
`resolveOnboardingGate`, edge function `day0-activation-setup`. Motif consigné : le
calibrage D0 n'avait jamais produit de donnée en prod.

Remplacement : `handle_new_user()` auto-provisionne une agence solo, et les flags
`onboarding_completed` / `first_day_done` sont passés à `DEFAULT true`.

Ce n'est pas une mauvaise nouvelle. L'ancien wizard servait le calibrage, le nouveau
sert la conformité : ils n'ont en commun que la forme. Mais **il n'existe plus aucun
gate**, on repart de zéro sur ce point.

### Défauts d'existant à corriger au passage

Vérifiés par lecture du dépôt, chacun incompatible avec le parcours cible.

| Défaut | Fait vérifié |
|---|---|
| Le nom d'agence saisi à l'inscription est jeté | La vitrine l'envoie dans `raw_user_meta_data.agency_name` ([megga-auth.js:369](../sites/megga-vitrine/js/megga-auth.js)), `handle_new_user()` nomme l'agence d'après `full_name` ou le préfixe de l'e-mail. Aucun consommateur d'`agency_name` en migrations, `src/` ou edge functions |
| Chaque agent invité laisse une agence solo orpheline | Il doit d'abord créer un compte, ce qui déclenche `handle_new_user`, avant que `accept-team-invite` ne réécrive son `agency_id` ([index.ts:129](../supabase/functions/accept-team-invite/index.ts)) |
| `join_agency(uuid)` ne vérifie aucune invitation | Toujours accordée à `authenticated` ([20260621130000:56](../supabase/migrations/20260621130000_fix_agency_join_role_cast.sql)). N'importe quel compte authentifié peut s'attacher à n'importe quelle agence par son UUID et devenir `agent` dessus, avec l'accès RLS aux contacts, deals et dossiers KYC. Le commentaire d'origine annonçait un remplacement par un workflow validé, jamais venu |

---

## 1. Ce que contient la branche

7 commits, 22 fichiers :

```
f9b1a0ad  feat(kyb)  schéma (4 migrations, 8 tables)
aed8b28a  merge      mise à jour depuis main
dad8cc37  feat(kyb)  frontend : réglages agence adaptés
65521bb6  docs(kyb)  schema.md + system-map.md + seed du cerveau
d4220fe2  fix(kyb)   alias homonymes manquants (défaut trouvé à l'exécution)
06b91801  test(kyb)  16 tests de non-régression
276e4d5a  docs(kyb)  fichier de relais
```

Migrations : `20260726120000` référentiel, `120100` colonnes `agencies`, `120200`
personnes liées, `120300` journaux de checks.

---

## 2. Étape 0 : à traiter AVANT de merger

Inchangée depuis ta rédaction. **Ne pas merger sans l'avoir traitée.**

### a) Collision d'horodatage de migration

`main` porte déjà `20260726120000_realadvisor_shard_map_3day.sql` (commit `b77b0c68`).
La migration `20260726120000_legal_forms_reference.sql` a **le même préfixe de
version**. La collision n'est pas visible dans la branche, elle apparaît au merge ou au
rebase sur `main` à jour.

Le dépôt a déjà corrigé ce cas deux fois en juillet 2026 (`debfdeea`, `674e80e9`) : la
pratique établie est de re-dater. Comme le fichier de `main` est déjà mergé, ce sont
**les 4 fichiers de cette branche** qui se re-datent.

> Le mode d'échec exact du CLI Supabase avec deux versions identiques n'a pas été
> reproduit ; `deploy.yml`, lui, trie par nom de fichier et resterait déterministe.
> Mais le dépôt traite ça comme un défaut à corriger, pas comme un détail.

### b) Le date-guard de `deploy.yml`

`deploy.yml` n'applique que les migrations dont l'horodatage est `>= TODAY` (UTC).
Mergées un jour après leur date, **elles sont sautées définitivement** : aucun
déploiement ultérieur ne les rattrape, il n'y a qu'un `::warning::` facile à manquer.
Or `deploy-app.yml` n'a **aucun** garde-fou de date : le frontend partirait en cherchant
`business_registration_number` et `legal_form_id`, colonnes inexistantes, et la page
Réglages → Agence casserait **durablement**.

### Ce qui a été fait, et ce qui reste à refaire le jour du merge

**Fait (étape 0) :** les 4 migrations ont été re-datées de `120*` vers `130*`.

Attention, la commande donnée à l'origine dans ce document était inopérante le jour même
de sa rédaction : `$(date -u +%Y%m%d)${f:8}` ne réécrit que les 8 chiffres de la date et
conserve la composante horaire, alors que **la collision portait sur l'horodatage complet
sur 14 chiffres**. Exécutée le 26 juillet, elle reproduisait le même nom de fichier. Le
re-datage a donc porté sur l'heure.

**À refaire le jour du merge, et cela concerne maintenant 8 migrations, pas 4.**

Le garde-date de `deploy.yml` n'applique que les migrations dont l'horodatage est
`>= TODAY` en UTC. Les 8 fichiers de ce chantier sont datés du 26 juillet 2026 : passé
minuit UTC, ils sont déjà périmés et seraient **sautés définitivement**, sans autre trace
qu'un `::warning::` dans le job.

```bash
cd supabase/migrations && for f in 202607261[34]*_*.sql; do git mv "$f" "$(date -u +%Y%m%d)${f:8}"; done
```

Contrôler ensuite qu'aucune version n'est en double, y compris face à `main` :

```bash
ls supabase/migrations/*.sql | sed 's#.*/##; s/_.*//' | sort | uniq -d
```

Attendu : aucune sortie. Puis rejouer la base et les tests :

```bash
supabase db reset && npm run lint:migrations && npm run test:backend
```

Attendu (état du 26 juillet) : `629 passed`, 0 échec. Lire le compte de tests, jamais
le code de sortie.

**Mise à jour étape 2 (vérifiée le 28 juillet 2026) :** l'étape 2 a ajouté 3
migrations, datées du 27 juillet 2026 (`20260728108000_submit_agency_identity.sql`,
`20260728109000_kyb_identity_documents_storage.sql`,
`20260728110000_submit_agency_identity_id_document.sql`). **Le total à re-dater le
jour du merge est donc désormais de 11 migrations, pas 8.** Vérifié par `date -u` au
moment de cette mise à jour : nous sommes le 28 juillet 2026 UTC, donc le garde-date
de `deploy.yml` (`stamp >= TODAY`) a déjà dépassé les 11 fichiers du chantier (tous
datés du 26 ou du 27 juillet) : mergés en l'état, ils seraient sautés définitivement,
sans autre trace qu'un `::warning::`. La commande de re-datage ci-dessus ne couvre
que les 8 fichiers `202607261[34]*` : le jour du merge, l'étendre aux 3 fichiers
`20260727*` (même motif `git mv "$f" "$(date -u +%Y%m%d)${f:8}"`, ordre relatif
conservé). Suite backend rejouée le 28 juillet sur les 189 migrations actuelles du
dépôt (schéma inchangé par cette mise à jour) : `658 passed`, 4 skipped (secrets
d'environnement absents en local, sans rapport avec ce chantier), 0 échec.

L'alternative (les appliquer à la main avant de merger) est documentée dans `deploy.yml`
comme le flux normal du dépôt, mais ne résout pas la collision.

### c) Fenêtre de coupure : sans objet désormais

Les trois workflows se déclenchent en parallèle, sans ordre garanti entre « migration
appliquée » et « nouveau bundle en ligne », donc Réglages → Agence est en erreur
quelques minutes dans un sens ou dans l'autre. **Thomas a confirmé que la base est
entièrement mock et qu'aucun client n'est connecté** : le point ne coûte rien ici.
Il redeviendra vrai le jour où il y aura des agences réelles.

---

## 3. Monter l'environnement (Windows, compter 20 min)

La machine d'origine n'avait ni Node ni le CLI Supabase. Si tu repars de zéro :

```bash
scoop install nodejs-lts
```

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase
```

**Scoop modifie le PATH utilisateur, que les shells déjà ouverts ne voient pas.**
Redémarre tes terminaux, sinon `node`, `npm` et `supabase` resteront introuvables.

Ensuite, Docker Desktop **lancé** (le démon, pas seulement le binaire installé), puis :

```bash
npm install && supabase start && supabase db reset
```

`supabase db reset` applique les 174 migrations à neuf sur un Postgres 17 jetable.
C'est **le** filet : c'est lui qui a trouvé le défaut corrigé par `d4220fe2`, que le
linter d'idempotence ne pouvait pas voir (il ne lit que du texte).

### Faire tourner les tests backend

Ils sont derrière un `describe.skipIf(!HAS_KEYS)` : **sans les variables, ils sont
SAUTÉS et la suite sort en 0 sans rien avoir exécuté.** Vérifie toujours le compte de
tests, pas le code de sortie.

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_ANON_KEY=$(supabase status -o json | jq -r .ANON_KEY) SUPABASE_TEST_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY) npx vitest run --config=vitest.backend.config.ts tests/backend/agency-kyb-verification.spec.ts
```

Attendu : `Tests 16 passed (16)`. Si tu lis `16 skipped`, les clés ne sont pas passées.

---

## 4. Pièges d'outillage Windows (4 rencontrés, tous des faux négatifs)

Aucun n'affecte la CI Linux. Ils ne cassent que la validation locale, c'est-à-dire
exactement au moment où on veut s'en servir.

| Script | Symptôme | Cause |
|---|---|---|
| `check-migration-idempotence.mjs` | 6 faux positifs | `/--.*$/` ne masque pas les commentaires en CRLF (`.` ne matche pas `\r`) |
| `check-dead-exports.mjs` | 28 faux positifs | allowlist en slashes vs chemins `ts-prune` en antislash |
| `check-edge-roster.mjs` | dérive fantôme | compare une chaîne en `\n` à un fichier en CRLF (67 dossiers pour 67 entrées, aucun écart réel) |
| `ruflo-seed-memory.mjs` | `spawnSync npx ENOENT` | `execFileSync('npx')` : sous Windows c'est `npx.cmd`, non résolu via PATHEXT |

**Conséquence du dernier :** la mémoire sémantique locale (`.swarm/memory.db`) n'a jamais
été construite sur cette machine. `npx ruflo memory search` répond donc **vide**, un faux
négatif silencieux qui se lit « le cerveau ne sait rien sur ce sujet ». En attendant le
correctif, passer par [system-map.md](system-map.md) ou grepper directement
`.claude-flow/knowledge/megga-memory.seed.json` (le fichier durable, à jour).

---

## 5. Ce qui est vérifié, et par quoi

Rien ci-dessous n'est une supposition, tout est reproductible.

- **Exécution des migrations** : `supabase db reset`, 174 migrations à neuf, exit 0.
- **Backfill `legal_form` texte vers FK** : 13 cas (sigle simple, accents, ponctuation,
  casse et espaces multiples, libellé dans une autre langue que le pays comme
  « Aktiengesellschaft » pour une SA suisse, libellé inconnu, pays hors périmètre, et
  les deux ambiguïtés qui doivent être refusées, « SA » et « Entreprise individuelle »
  sans pays). Invariant : 0 ligne portant à la fois le texte et la FK.
- **RLS** : agent simple 0 ligne dans sa propre agence, dirigeant 1, autre agence 0,
  pondérations invisibles même au dirigeant, référentiel lisible par tous (il alimente
  le menu), écriture de check refusée (`42501`), insertion cross-agence refusée,
  contrainte rôle/attributs tenue.
- **Le test garde vraiment ce qu'il prétend**, vérifié **par mutation** : l'alias `sa`
  de `FR_SA` retiré en base, le test « garde ambigus les sigles homonymes entre pays »
  échoue ; alias restauré, il repasse. Un test jamais vu échouer ne prouve rien.
- **Non-régression** : suite backend complète, 619 tests sur 104 fichiers, 0 échec
  (état étape 1). Front : `npm run build`, `npm run build:admin`, 951 tests
  unitaires (état étape 1). **Après l'étape 2** (vérifié le 28 juillet 2026) :
  backend 658 passed / 4 skipped sur 107 fichiers, 0 échec ; unitaires 1118 passed
  sur 65 fichiers, 0 échec ; e2e KYB (`test:e2e:kyb`) 2 passed. Les 4 skips backend
  sont deux specs gardées par des secrets absents en local
  (`MEGGA_MAGIC_LINK_HMAC_SECRET`, `DEEPSEEK_API_KEY`), sans rapport avec ce
  chantier ; la CI les fournit.

---

## 6. Le programme : 6 étapes exécutables

Une étape par PR, chacune vérifiable seule. Le détail de conception est dans le
[spec du parcours](superpowers/specs/2026-07-26-onboarding-kyb-design.md) ; ce qui suit
est ce qu'il faut avoir en tête pour exécuter.

| # | Étape | État | Dépend de | Bloqué |
|---|---|---|---|---|
| 0 | Re-dater les migrations et merger (§2) | fait | rien | non |
| 1 | Correctifs d'existant | fait | 0 | non |
| 2 | Gate, wizard 5 étapes, RPC de soumission | fait | 1 | non |
| 3 | Moteur de scoring (§7) | fait | 0 | non |
| 4 | Connecteurs disponibles | à faire | 3 | non |
| 5 | File de revue admin et gardes LAB | à faire | 3 | non |
| 6 | Connecteurs Zefix et UID | à faire | 4 | **oui** |

### Étape 3 : le moteur, tel qu'il a été livré

Ta conception §7 est reprise sans écart. `recompute_agency_verification(agency_id)`
agrège les checks en un score et un statut, `get_agency_verification_config()` porte les
deux seuils, les deux au `service_role` seul.

Trois choses que la revue a établies par mutation, et qu'il vaut mieux connaître avant
d'y toucher :

**Le départage du dernier check par type ne peut pas reposer sur la seule date.**
`checked_at` vaut par défaut l'heure de début de transaction : deux checks du même type
écrits dans la même transaction, ce que fera un connecteur qui rejoue, sont à égalité, et
`distinct on` retenait alors une ligne non spécifiée. Reproduit : un véto défavorable
frais écarté au profit d'un ancien favorable, agence restée auto-validée. Un départage
explicite a été ajouté.

**Les checks de personne scorables entrent bien dans le score.** Le premier jet ne lisait
que les checks d'agence, ce qui rendait muets `signatory_registry_match` et
`poa_document_review`, soit 23 % du poids du catalogue. Ton document de conception §2 B
liste explicitement le signataire listé comme organe au registre parmi les signaux
moyens qui contribuent au score : c'est lui qui a tranché.

**Le moteur se défend contre une table de configuration sale.** Deux fenêtres fermées et
chevauchantes faisaient compter un poids deux fois ; l'index unique ne protège que les
fenêtres ouvertes.

Rien n'appelle encore le moteur automatiquement : le déclenchement viendra avec les
connecteurs de l'étape 4, et le cron avec eux.

Un point à garder pour l'étape 5 : l'action « relancer la vérification » depuis la
console admin appellera cette RPC depuis un navigateur, donc sous un jeton
`authenticated`, alors qu'elle est réservée au `service_role`. Il faudra une Edge
Function relais ou un élargissement gardé par `is_super_admin()`.

### Étape 1 : correctifs d'existant

Quatre correctifs, chacun répond à un défaut du §0.

1. `handle_new_user()` lit `raw_user_meta_data.agency_name` pour nommer l'agence.
2. `provision_solo_agency()` pose `role='admin'` sur le fondateur, alignement sur
   `create_agency_and_join`. **Sans ce correctif, rien du reste ne fonctionne.**
3. `handle_new_user()` ne provisionne pas d'agence solo si une invitation valide existe
   pour cet e-mail (fin des agences orphelines).
4. `join_agency(uuid)` révoquée de `authenticated`. Le chemin invitation est déjà
   couvert par `accept-team-invite`, avec vérification d'expiration et de correspondance
   d'e-mail. Une RPC ouverte sans garde n'a pas à survivre à ce chantier.

Migration additive au passage : `agencies.identity_submitted_at timestamptz` et l'ajout
de `validated` au CHECK de `verification_status` (voir spec §6).

### Étape 2 : gate et wizard

**Condition d'activation du gate :**

```
gate actif si :
      profiles.agency_id is not null
  and profiles.role in ('admin', 'manager')        -- le dirigeant, pas l'employé
  and agencies.identity_submitted_at is null
  and not is_super_admin()
```

Pourquoi une colonne dédiée plutôt que `verification_status` : ce dernier vaut `pending`
par défaut à la création de la ligne et ne distingue pas « rien n'a été saisi » de
« saisi, en attente de traitement ». Deux faits distincts, deux colonnes.

**Cinq étapes de saisie :**

| Étape | Contenu | Écrit dans |
|---|---|---|
| 1. Signataire | Prénom, nom, date de naissance, nationalité, pouvoir de signature | `agency_related_persons` + `agency_person_roles` (`signatory`) |
| 2. Agence | Pays du siège, forme juridique, raison sociale, nom commercial, n° de registre, TVA, adresse | `agencies.*` |
| 3. Bénéficiaires effectifs | Personnes détenant 25 % ou plus | `agency_person_roles` (`ubo`) |
| 4. Pièce d'identité | Recto/verso du signataire | Storage `documents` + `agency_person_verification_checks` |
| 5. Récapitulatif | Attestation d'exactitude, soumission | `identity_submitted_at`, `activity_events` |

L'étape 3 est **sautée** si `legal_forms.category = 'sole_proprietorship'`, où le
signataire est l'entité et il n'y a pas d'UBO tiers. C'est le rôle que tu as donné à
`category`. L'ordre 2 avant 3 n'est donc pas cosmétique : le pays filtre les formes
juridiques (`useLegalForms`, déjà livré) et la forme juridique décide de l'étape 3.

**RPC de soumission** `submit_agency_identity()` : garde `is_agency_admin()`, vérifie la
complétude minimale (raison sociale, forme juridique, pays, au moins un signataire
actif), pose `identity_submitted_at`, journalise dans `activity_events`.
`GRANT authenticated`, `REVOKE anon`.

**Ne pas rejouer la boucle.** Un gate bloquant a déjà causé un P0 en juillet
(`c830f9a9`, « boucle onboarding ») et un autre chantier a dû exempter les super-admins
après coup (`e6c26c02`). Trois garde-fous dès la première version : progression
persistée à chaque étape et pas seulement à la fin, sortie « reprendre plus tard » qui
mène à un écran d'attente et jamais à une redirection en boucle, test e2e du cycle
complet login / gate / soumission / accès / relogin.

**Hypothèse à valider avant merge :** le rôle `super_admin` est aujourd'hui porté par
exactement les trois comptes développeurs. Si l'équipe MEGGA doit en compter d'autres,
l'exemption s'élargira mécaniquement. Acceptable (un compte interne n'a pas d'agence à
vérifier) mais ce doit rester un choix conscient.

### Étape 2 : livrée

Construite comme décrit ci-dessus. Route `/dashboard/identite`, redirection émise par
`AgentSugarLayout` via `useIdentityGate()` (jamais vers elle-même), écran mobile
(< 768 px) invitant à terminer sur ordinateur, sans échappatoire vers le CRM. Coquille
de wizard (`IdentityShell`) à cinq étapes (signataire, agence, bénéficiaires effectifs,
cette dernière sautée pour une raison individuelle, pièce d'identité, récapitulatif),
persistance de l'étape à chaque navigation (pas seulement à la soumission finale), et
sortie de secours « reprendre plus tard » : un écran d'attente local plutôt qu'une
route séparée, pour ne pas rouvrir la boucle de l'incident P0 c830f9a9. RPC
`submit_agency_identity()` : garde `is_agency_admin()`, quatre causes de refus à
message distinct (raison sociale, forme juridique, pays, signataire actif, dans cet
ordre, pour que le wizard sache où ramener l'utilisateur), idempotente (un second
appel après succès ne fait rien), journalisée dans `activity_events`
(`category='kyc'`). Cycle complet couvert par un test e2e Playwright
(`tests/e2e/onboarding-identite.spec.ts`, config dédiée `playwright.kyb.config.ts`,
authentification réelle contre un Supabase local) : connexion, gate, cinq étapes,
soumission, accès au dashboard, déconnexion, reconnexion sans reboucle, la sortie de
secours et, depuis la revue finale, un troisième cas dédié à la raison individuelle
(saut de l'étape bénéficiaires effectifs, stepper, récapitulatif). Câblé dans
`e2e.yml` (job séparé `e2e-kyb`) ; exécuté pour de vrai en local
(`npm run test:e2e:kyb`) lors de la vérification de fin d'étape, 3 tests, 3 passés.

Deux points qui ne se devinent pas depuis le code seul, à connaître avant de toucher
l'étape 3 :

- Les tables de vérification (`agency_verification_checks`,
  `agency_person_verification_checks`) n'ont **aucune policy INSERT** : elles
  refusent l'écriture à tout rôle utilisateur, quel qu'il soit. Seule la RPC
  (`SECURITY DEFINER`) pose les lignes de check, ce qui empêche un inscrit de
  fabriquer sa propre preuve de vérification. Le moteur de scoring (étape 3) lit ces
  mêmes tables : quiconque y touche doit savoir que le verrou est là.
- Le préfixe de stockage des pièces d'identité (`documents/{agency_id}/kyb-identity/…`)
  est comparé **en minuscules** dans les 8 policies du bucket `documents` (les 4
  générales et les 4 dédiées), parce que `storage.search()`, utilisé par `.list()`
  côté client, filtre lui-même en minuscules. Une comparaison sensible à la casse
  laissait un agent simple déposer un fichier sous `KYB-IDENTITY` (ou toute autre
  casse) : la policy générale (qui ne vérifie que l'agence, jamais le rôle) devenait
  alors seule à trancher, et le dirigeant qui listait ensuite ce préfixe voyait un
  fichier étranger dans son dossier de preuve.

### Dettes identifiées en revue finale (étape 2)

Deux points restent ouverts, relevés en revue finale de cette branche, à connaître
avant de reprendre ce chantier :

- **Pièces d'identité jamais purgées.** Le recto/verso déposé dans Storage
  (`documents/{agency_id}/kyb-identity/{related_person_id}`) n'est supprimé par
  aucun chemin quand la personne liée ou l'agence disparaît. Ce n'est pas une
  exposition (les policies ci-dessus restent fermées), mais c'est de la rétention
  sans propriétaire ni moyen de purge, dans la fonctionnalité même qui porte la
  conformité. À traiter avant qu'une vraie pièce d'identité soit déposée.
- **La garde anti-doublon du check `id_document` ne filtre pas sur `result`.**
  `submit_agency_identity()` (`20260728110000_submit_agency_identity_id_document.sql`)
  ne repose jamais une seconde ligne `agency_person_verification_checks` pour la
  même personne dès qu'une ligne existe, quel que soit son `result`. Après un
  verdict négatif, une pièce remplacée ne produirait donc jamais de nouvelle demande
  de revue. Relève de l'étape 5 (file de revue admin et gardes LAB).

### Étape 3 : le moteur de scoring

Ta conception (§7 ci-dessous) tient telle quelle. Un seul ajout : `validated` se traite
comme `rejected`, le moteur ne l'écrase pas.

### Étape 4 : connecteurs disponibles

Une edge function `agency-verification-run` (service_role), appelée après soumission et
rejouable depuis la console admin. Écrit les checks, puis appelle le moteur.

| Check | Source |
|---|---|
| `domain_whois` | RDAP `.ch` / `.li` / `.fr` |
| `vat_lookup` | VIES (UE) |
| `registry_lookup` (FR) | `recherche-entreprises.api.gouv.fr` |
| `address_geocode` | Mapbox |

Sur le domaine e-mail : Thomas a demandé s'il pouvait servir à valider l'appartenance à
l'agence en attendant Zefix. Réponse retenue, cohérente avec ton §2 : c'est un bon
signal d'**affiliation** (le contrôle de la boîte est déjà prouvé par la confirmation
d'e-mail Supabase) et un mauvais signal d'**existence** (un domaine coûte douze francs).
Il reste donc un signal faible qui nourrit le score, jamais un véto.

À retester avant de conclure : GLEIF, injoignable depuis ton bac à sable d'outils, ce
qui n'est pas un fait sur GLEIF. Et la présence d'enregistrements MX, qui demande une
résolution DNS et non du RDAP : vérifier ce que permettent les Edge Functions Supabase
avant de l'inscrire au barème.

### Étape 5 : file de revue admin et gardes LAB

Sur `admin.megga.ch`, application séparée (`npm run build:admin`), pas dans le CRM agent.

- Liste triée par score croissant, les plus douteux en tête. Pas de colonne de priorité
  dérivée, ta décision.
- Dossier détaillé : chaque check avec son type, sa source, son poids applicable à la
  date du check, son résultat et sa réponse brute. C'est ce qui permet de justifier
  check par check pourquoi un dossier a été validé.
- Actions : valider (pose `validated`), rejeter avec motif, relancer la vérification.
  Toute décision tracée dans `activity_events`, `category='kyc'`.

**Gardes LAB :** un hook unique lit `verification_status` et bloque deux surfaces tant
que le statut n'est ni `auto_validated` ni `validated` : ouverture d'un dossier KYC
client (`/dashboard/kyc`, edge `kyc-screening`) et demande de signature électronique
(edge `sign-document`). Le blocage explique pourquoi et pointe l'état du dossier. Liste
exacte à figer avec Gregory : ce sont des actions métier, pas un choix technique.

---

## 7. Le moteur de scoring : conception

Établie en lisant le dépôt, autant ne pas la redécouvrir.

### Forme : une RPC Postgres, pas une Edge Function

**Tous** les moteurs de score de ce projet vivent en Postgres
(`calculate_property_scores`, scoring contacts, focus radar). Et l'agrégation pondérée
sur des lignes de checks est du SQL naturel : atomique avec la donnée, sans aller-retour
réseau, testable par le harnais backend qui existe déjà. Les Edge Functions sont
nécessaires pour les **connecteurs** (eux ont besoin du réseau), pas pour le calcul.

### Seuils réglables : patron `app_config`

Clé `agency_verification_v1` et fonction jumelle `get_agency_verification_config()`,
calquée sur `get_property_score_config()` (`jsonb`, `STABLE SECURITY DEFINER`,
`search_path`). Défauts sûrs en dur : `auto_validate_min` 0.85, `review_priority_min` 0.5.

### Règles de calcul (issues de [la conception](agency-kyb-verification.md) §2)

- **Dernier check par type** : les checks sont append-only, une ré-exécution ajoute une
  ligne, donc `distinct on (check_type) ... order by check_type, checked_at desc`.
- **Jointure du poids TEMPORELLE**, coeur du dispositif d'auditabilité :
  `cfg.valid_from <= chk.checked_at and (cfg.valid_to is null or cfg.valid_to > chk.checked_at)`.
- **Véto** : ne passe que sur `match`. Un véto **absent** ne passe PAS, l'absence de
  preuve n'est pas une preuve. Exiger au moins un signataire actif, sinon blocage : on ne
  valide pas une entité dont on ignore qui l'engage.
- **`unavailable`** exclu du numérateur ET du dénominateur (un pays sans VIES n'est pas
  pénalisé). **`pending_manual_review`** force la revue humaine.
- Score `null` (aucun check scorable) : jamais d'auto-validation.
- **`rejected` et `validated` ne sont jamais posés automatiquement** (décision humaine),
  et le moteur ne doit **pas les écraser** : un verdict humain ne se retourne pas tout
  seul au prochain passage.
- **Pas de colonne de priorité** : la file admin trie par score (éviter une colonne
  dérivée, cohérent avec le reste du schéma).

### Contraintes de `activity_events` vérifiées en base (elles cassent à l'application)

- `category` dans `kyc | deal | contact | bien | doc | auth | settings | ai`, donc
  utiliser **`'kyc'`**. `'compliance'` **fait échouer** la contrainte CHECK.
- `severity` dans `info | warn | critical`.
- `actor_kind` NOT NULL dans `user | ai | system`, **et** contrainte
  `activity_events_actor_kind_coherence` : avec `actor_kind='system'`, `actor_id` **doit
  être NULL**.

### Droits

`REVOKE EXECUTE` sur `anon` et `authenticated`, `GRANT` au `service_role` seul
(discipline `20260711210000_secdef_execute_revoke`). Élargir plus tard si la console
admin appelle la RPC directement : plutôt sous-accorder que l'inverse.

### Pas de cron pour l'instant

Inutile avant que des connecteurs produisent des checks. À ajouter avec eux, gardé par
la présence de `pg_cron` comme les autres.

---

## 7bis. Aucun dossier ne peut être auto-validé aujourd'hui, et c'est normal

Écrit ici plutôt que laissé à déduire, parce que c'est le genre de fait qu'on découvre
par surprise après la mise en service.

Le catalogue définit **quatre vétos d'entité** : format du numéro de registre, existence
au registre, concordance de la raison sociale, concordance du pays. La règle du moteur
est qu'un véto **absent ne passe pas**, l'absence de preuve n'étant pas une preuve.

Or deux de ces quatre, le format du numéro et la concordance du pays, n'ont **aucun
connecteur** dans le dépôt. Ils sont donc absents pour toute agence, de tout pays, et pas
seulement pour la Suisse privée de Zefix.

**Conséquence, démontrée en base** lors de la revue de l'étape 4 : un dossier français
parfait, tous les checks disponibles en `match`, un signataire actif, un score de 1.000,
reste en `manual_review` avec `veto_failed` à vrai. Les deux lignes manquantes insérées à
la main, le même dossier bascule immédiatement en `auto_validated`. La cause est isolée
avec certitude.

Un facteur s'y ajoute côté personne : la vérification de pièce d'identité est posée en
`pending_manual_review` de façon permanente, aucun prestataire automatique n'étant
branché, et rien ne met encore cette ligne à jour puisque la file de revue est l'étape 5.
Ce seul fait bloquerait l'auto-validation même si les deux vétos étaient comblés demain.

**Ce n'est pas un défaut à corriger dans l'urgence.** C'est l'état souhaitable tant que
les sources manquent : le dispositif préfère envoyer tout le monde en revue humaine
plutôt que de valider sur une preuve qu'il n'a pas. Mais quiconque se demandera pourquoi
l'auto-validation ne se déclenche jamais doit trouver la réponse ici, pas la reconstituer
en assemblant trois fichiers.

Pour l'atteindre un jour, il faudra : un connecteur de format de numéro de registre, un
connecteur de concordance de pays, la file de revue de l'étape 5 pour résoudre les pièces
d'identité, et Zefix pour la Suisse.

---

## 8. Dépendances externes en attente

**Le registre bloqué est le suisse, c'est-à-dire le marché.** Le connecteur de plus
forte valeur est celui qu'on ne peut pas écrire aujourd'hui.

| Source | Statut au 26.07.2026 |
|---|---|
| **Zefix** (registre CH) | `401`, identifiants demandés à `zefix@bj.admin.ch`, **sans réponse** |
| Registre UID/TVA (CH/LI) | API séparée ou champ Zefix ? **non clarifié** |
| `oera.li` (registre LI) | **aucune API publique**, revue manuelle pour ce pays |
| Carte pro immobilier CCI (FR) | pas d'API (403 anti-bot), revue manuelle |
| GLEIF (LEI) | non joignable **depuis le sandbox d'outils**, à retester depuis une edge function ; ce n'est pas un fait sur GLEIF |
| `recherche-entreprises.api.gouv.fr` (FR) | public, sans clé, 7 req/s |
| VIES (TVA UE) | public, sans clé |
| RDAP `.ch` / `.li` / `.fr` | publics |

**Rien de ce programme ne dépend de ces réponses, sauf l'étape 6** : les tables de
checks sont agnostiques de la source, et un check `source='manual'` saisi par un humain
se score exactement comme un check automatique. C'est ce qui rend le parcours suisse
exploitable dès maintenant, en revue humaine.

---

## 9. Carte des fichiers

| Fichier | Rôle |
|---|---|
| `docs/agency-kyb-verification.md` | conception du schéma et de la vérification, arbitrages, inventaire des sources |
| `docs/superpowers/specs/2026-07-26-onboarding-kyb-design.md` | conception du parcours utilisateur, gate, découpage |
| `supabase/migrations/20260726120000_legal_forms_reference.sql` | référentiel, alias, `normalize_legal_form_text()` |
| `…120100_agencies_kyb_columns.sql` | renommage `ide`, FK forme juridique, backfill, état de vérification |
| `…120200_agency_related_persons.sql` | personnes de conformité, rôles, `is_agency_admin()` |
| `…120300_agency_verification_checks.sql` | catalogue, config pondérée versionnée, 2 journaux |
| `tests/backend/agency-kyb-verification.spec.ts` | 16 tests de non-régression |
| `src/hooks/useLegalForms.ts` | options du menu, filtrées par pays du siège |
| `src/hooks/useAgencySettings.ts` | lecture/écriture des réglages agence |
| `src/components/crm-sugar/settings/focus/pfKit{,Core}.tsx` | mode « choix unique » ajouté à `PfEditField` |

Fichiers à connaître pour l'étape 1, non modifiés à ce jour :

| Fichier | Pourquoi |
|---|---|
| `supabase/migrations/20260718130000_remove_onboarding_provision_solo_agency.sql` | `handle_new_user()` et `provision_solo_agency()`, les deux à corriger |
| `supabase/functions/accept-team-invite/index.ts` | rattachement de l'agent invité |
| `supabase/migrations/20260621130000_fix_agency_join_role_cast.sql` | `join_agency()` sans garde |
| `sites/megga-vitrine/js/megga-auth.js` | formulaire d'inscription, envoi d'`agency_name` |

Le SQL de vérification manuelle (backfill et RLS) était jetable et **n'est pas dans le
dépôt** : il a été remplacé par le spec de non-régression, qui couvre les mêmes cas.

---

## 10. Par où commencer

1. Monter l'environnement (§3) et lancer `supabase db reset` plus les 16 tests. Si ça
   passe, la base est saine et tu peux faire confiance au reste de ce document.
2. Traiter l'étape 0 (§2) et merger. Le re-datage règle collision et date-guard d'un
   coup.
3. Enchaîner l'étape 1 (§6). Le correctif du rôle fondateur conditionne tout le reste :
   sans lui, ta propre garde `is_agency_admin()` bloque le dirigeant sur ses propres
   données.
4. Puis étape 2, ou étape 3 si tu préfères commencer par du SQL. Elles sont
   indépendantes l'une de l'autre.
5. Relancer les identifiants Zefix quand tu y penses. C'est le chemin critique du marché
   suisse, et personne d'autre que nous ne le débloquera.
