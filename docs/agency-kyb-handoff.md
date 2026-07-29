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
| Connecteurs disponibles | fait, étape 4 (RDAP, VIES, registre FR, géocodage) |
| File de revue admin et gardes LAB | fait, étape 5 |
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

> **Périmé, conservé comme historique.** Tout ce qui suit dans cette sous-section décrit
> l'état des 26-28 juillet. Le re-datage a été **exécuté le 29.07.2026** sur 19 migrations,
> par une procédure qui remplace les commandes ci-dessous (les globs `202607261[34]*` et
> `20260727*` ne désignent plus rien du chantier). Aller directement au **§7ter, « Le merge :
> ce qui a été fait le 29 juillet 2026 »**, y compris pour savoir quoi refaire si le merge
> glisse d'un jour.

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
| 4 | Connecteurs disponibles | fait | 3 | non |
| 5 | File de revue admin et gardes LAB | fait | 3 | non |
| 6 | Connecteurs Zefix et UID | squelette posé, connecteurs à écrire | 4 | **oui** |

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

### Étape 6 : squelettes Zefix et registre UID

**Squelette posé, connecteurs absents.** Ne pas lire cette étape comme « Zefix est
branché » : aucune requête n'est émise vers Zefix ni vers le registre UID, et aucun
dossier n'a changé de verdict. Ce qui a été fait, c'est tout ce qui pouvait l'être sans
identifiants, pour qu'il ne reste, le jour où ils arrivent, que trois choses à écrire.

**Ce qui est câblé** (`supabase/functions/_shared/kyb-sources.ts`, construit par
`agency-verification-run/index.ts`) :

| Fabrique | Sources | `source` | Juridiction |
|---|---|---|---|
| `createZefixSources(config)` | `registry_lookup`, `registry_legal_name_match`, `registry_country_match` | `zefix` | `CH` |
| `createUidRegisterSources(config)` | `vat_lookup` | `uid_register` | `CH` et `LI` |

Les quatre `check_type` et les deux valeurs de `source` étaient déjà au catalogue
(`20260728103000`) : **aucune migration dans cette étape.** Les configurations viennent
de quatre variables d'environnement, toutes vides aujourd'hui (§8).

Tant qu'elles le sont, chaque source lève `KybSourcePendingCredentialsError`, que le
harnais traduit en `unavailable` avec la raison jointe. Si les secrets sont posés sans que
le connecteur ait été écrit, elle lève `KybSourceNotWiredError` à la place. Deux erreurs
et non une, parce qu'elles appellent deux gestes différents : la première attend une
réponse de `zefix@bj.admin.ch`, la seconde dit que le travail restant est du code, ici.
Sans cette distinction, celui qui vient de poser les secrets ne verrait qu'un
`unavailable` identique à celui de la veille. Le type d'erreur est lisible dans
`raw_response.error_type`, donc dans la file de revue.

**Ce qui reste le jour où les identifiants arrivent : l'URL, l'authentification, l'analyse
de la réponse. Rien d'autre.** Ni migration, ni retouche de `index.ts`, ni place à trouver
dans le registre, ni gestion d'erreur ou de timeout à réécrire. Rien n'a été deviné :
aucune URL, aucun en-tête, aucun schéma de réponse n'est écrit « au plus probable ». Une
URL inventée se découvrirait en production, une valeur vide se découvre à la lecture.

**La règle de juridiction, et pourquoi elle vient avec cette étape.** Une source déclare
désormais ce qu'elle couvre (`KybSource.appliesTo`) ; `selectApplicableSources()` écarte
avant exécution celles qui ne couvrent pas le dossier, et `index.ts` joint les écartées à
`p_metadata.sources_skipped` pour que la trace dise ce qui n'a pas été interrogé.

Elle existe pour rendre **impossible** que deux sources écrivent le même `check_type` pour
une même agence. Le moteur ne garde qu'une ligne par type, et deux lignes écrites dans la
même transaction portent le même `checked_at` : c'est la dernière insérée qui gagne.
Ajouter Zefix donnait un second propriétaire à `registry_lookup` et
`registry_legal_name_match`, le registre UID un second à `vat_lookup`. Le jour où Zefix
répondrait `match`, l'`unavailable` que le connecteur français produit déjà pour tout
siège hors de France pouvait s'insérer après lui et le masquer : **un véto réellement
satisfait se serait lu comme un véto absent**, et cela le jour même où quelqu'un aurait
cru ne toucher qu'au parsing. Zefix couvre `CH`, le registre français `FR` ; `vat_lookup`
se départage sur le **préfixe de TVA déclaré** et non sur le pays du siège (voir plus bas).
Deux propriétaires d'un même type ne peuvent plus s'appliquer au même dossier, et l'ordre
d'insertion cesse de porter du sens.

**La portée exacte de cet « impossible ».** Le filtre lit le `check_type` que la source
**déclare** (`source.checkType`). Un connecteur peut écraser le sien **à l'exécution** via
`KybSourceResult.check_type` (c'est ce que fait RDAP pour `domain_generic_provider`), et
cette écriture-là ne passe par aucun filtre, puisqu'elle n'existe qu'une fois la source
déjà exécutée. Aucun type partagé n'est produit de cette façon aujourd'hui ; à vérifier
avant d'y recourir en écrivant le parsing Zefix.

Écarté délibérément : faire préférer au moteur un résultat tranché à un `unavailable`. Ce
serait laisser un `match` d'hier survivre à la panne d'aujourd'hui. « La dernière ligne
gagne, sans exception » reste la bonne règle pour une piste d'audit ; c'est en amont qu'il
faut éviter d'écrire deux lignes concurrentes.

**Changement de comportement assumé** : une agence sans pays déclaré ni TVA à préfixe
européen ne reçoit plus de lignes `registry_lookup`, `registry_legal_name_match` ni
`vat_lookup` (elle en recevait trois, toutes `unavailable`), et une agence suisse n'en
reçoit plus deux « siège hors France ». Ces lignes-là valaient `unavailable`, que le moteur
traite exactement comme une ligne absente : ni score ni statut ne bougent. Vérifié en base
et non supposé : un dossier suisse par ailleurs parfait reste en `manual_review` avec
`veto_failed` à vrai, et bascule en `auto_validated` dès que les quatre vétos sont posés à
la main.

**Ce qu'écarter coûte quand la source avait un verdict à rendre** (défaut trouvé en revue
finale, corrigé). Écarter n'est neutre **qu'à la condition** que la source écartée n'ait
rien eu à répondre sur ce dossier. `agencies.tva` est du texte libre : ni `StepAgence.tsx`
ni la base ne vérifient l'accord entre le préfixe et le pays du siège, et un dossier `CH`
peut donc déclarer une TVA à préfixe européen. Avant l'étape 6, VIES était interrogée pour
tout siège et rendait sur ce numéro un `mismatch` (poids 3.00). Départager sur le seul pays
du siège l'écartait : le signal défavorable disparaissait au profit d'un `unavailable` du
registre UID, exclu du numérateur **et** du dénominateur. Mesuré en base, mêmes vétos posés
à la main : **0.200 → `manual_review` avec le `mismatch`, 1.000 → `auto_validated` sans**.
Un dossier qui devait passer par la revue humaine s'auto-validait, et ouvrait donc les
gardes LAB, sans que le relecteur, qui ne regarde pas la TVA, voie jamais la différence.

Corrigé par un **point de décision unique**, `vatLookupOwner(agency)` : le préfixe déclaré
prime (une TVA à préfixe UE revient à VIES, quel que soit le siège), le siège ne tranche
que ce que le préfixe ne tranche pas (`CH`/`LI` au registre UID, tout le reste à VIES), et
sans l'un ni l'autre personne n'écrit, le moteur traitant cette absence comme
l'`unavailable` d'alors. Les deux `appliesTo` comparent la même valeur unique à la leur :
l'exclusivité reste une propriété du code, pas deux prédicats à tenir d'accord. Les dix
combinaisons (siège × préfixe) sont vérifiées contre le code d'avant l'étape 6 dans
`tests/backend/agency-verification-run.spec.ts` (matrice de propriétaires, volet 9) et le
verdict lui-même contre le vrai moteur (volet 2).

**Hors périmètre, et pourquoi.** `registry_number_format` ne dépend d'aucun identifiant
(clé de contrôle du numéro `CHE` et du SIREN, un calcul pur) : il n'est pas bloqué, donc il
n'avait rien à faire dans une étape qui prépare ce qui attend une réponse de l'extérieur.
C'est un travail court, à mener séparément, et c'est le dernier véto qui empêche un dossier
suisse par ailleurs complet d'être auto-validé. `signatory_registry_match`, que Zefix
pourrait pourtant alimenter, est un check de **personne** : `record_agency_verification_run`
n'écrit que dans `agency_verification_checks`, l'accueillir demanderait d'étendre la RPC.
`address_registry_match` et `activity_code_match` sont deux signaux moyens à rouvrir quand
les sources répondront et qu'on saura ce qu'elles renvoient. GLEIF reste à retester depuis
une Edge Function réelle. `oera.li` n'a aucune API publique connue : le Liechtenstein reste
en revue manuelle pour son registre du commerce, seul son numéro de TVA étant couvert par
le squelette UID.

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
`pending_manual_review` par la RPC de soumission, aucun prestataire automatique n'étant
branché, et le moteur refuse l'auto-validation tant qu'un check reste dans cet état.
L'étape 5 y a changé une chose, et une seule : un chemin existe désormais pour l'en
sortir (`admin_resolve_agency_id_document`, migration `20260728160000`). C'est un geste
humain, à poser dossier par dossier ; aucune ligne ne se résout d'elle-même. Ce seul fait
tiendrait donc encore chaque dossier hors de l'auto-validation même si les deux vétos
étaient comblés demain.

**Ce n'est pas un défaut à corriger dans l'urgence.** C'est l'état souhaitable tant que
les sources manquent : le dispositif préfère envoyer tout le monde en revue humaine
plutôt que de valider sur une preuve qu'il n'a pas. Mais quiconque se demandera pourquoi
l'auto-validation ne se déclenche jamais doit trouver la réponse ici, pas la reconstituer
en assemblant trois fichiers.

Pour l'atteindre un jour, il faudra quatre choses. Deux ont bougé depuis que ce paragraphe
a été écrit, et aucune des quatre n'est acquise. **Rien n'est auto-validable aujourd'hui,
et l'étape 6 n'y a rien changé : c'était son critère de non-régression.**

- **Un connecteur de format de numéro de registre.** Inchangé : toujours aucun, et il
  n'attend rien de personne (calcul pur, laissé hors de l'étape 6 délibérément, voir §6).
- **Un connecteur de concordance de pays.** A désormais un propriétaire déclaré pour la
  Suisse (le squelette Zefix), mais **muet** : il produit `unavailable`, ce qui ne passe
  pas plus qu'un véto absent. Et toujours personne pour la France : le connecteur français
  a laissé ce type de côté, n'interrogeant que des sièges déjà déclarés en France. Un
  propriétaire déclaré n'est pas une preuve.
- **La file de revue pour résoudre les pièces d'identité.** Livrée (étape 5) : la
  vérification de pièce d'identité n'est plus bloquée par l'absence d'un chemin, seulement
  par le geste humain qu'il faut poser dossier par dossier.
- **Zefix pour la Suisse.** Câblé, sans identifiants (§6 étape 6, et §8 pour l'état de la
  demande). Le squelette ne rapproche pas de l'auto-validation : il rend seulement le
  branchement futur court et lisible.

---

## 7ter. Point de reprise au 29 juillet 2026

Écrit pour la session qui reprendra, et pour Julien qui décidera du merge.

### Où en est le chantier

Six étapes sur sept : les étapes 0 à 5 sont livrées, l'étape 6 n'est qu'un squelette.
122 commits de chantier depuis `276e4d5a`, 228 en comptant les 106 que `main` a apportés
en s'intégrant. Attention, `feat/agency-kyb-verification` ne porte plus tout : la branche
distante s'arrête à `1b2cb9eb`, dernier commit de l'étape 5, et le travail la dépasse
désormais de **124 commits**. L'étape 6, les correctifs de sa revue, l'intégration de
`main` et le re-datage des migrations ne vivent qu'en local, sur `kyb-handoff-update`
(le re-datage est le commit `856076ce`).

| Étape | État |
|---|---|
| 0 · Débloquer et merger les migrations d'Antoine | fait |
| 1 · Correctifs du chemin d'inscription | fait |
| 2 · Gate et wizard de saisie | fait |
| 3 · Moteur de scoring | fait |
| 4 · Connecteurs disponibles | fait |
| 5 · File de revue et gardes LAB | fait |
| 6 · Connecteurs Zefix et UID | squelette posé, connecteurs à écrire (§6) |
| Préparation du merge (intégrer `main`, re-dater les migrations) | **faite le 29.07.2026**, mais **datée**, donc périssable (voir ci-dessous) |

Fait à l'étape 5 : la couche de données de la file, les quatre décisions humaines
(valider, rejeter avec motif, relancer, résoudre la pièce d'identité), l'écran de la
console admin et les gardes LAB du CRM agent.

Reste à l'étape 6 : les connecteurs eux-mêmes. Le squelette Zefix et celui du registre
UID sont posés et couverts par des tests, mais aucun des deux n'interroge quoi que ce
soit : ils sortent `unavailable` tant qu'il manque des identifiants et le code qui va
avec (§6, et §8 pour l'état de la demande).

**Décision produit déjà prise pour les gardes : garde plein.** Aucune agence ne peut
ouvrir un dossier KYC client ni lancer une signature avant qu'un humain ait validé son
identité. Aucun interrupteur. Corollaire assumé : l'équipe MEGGA tranche chaque dossier
avant que l'agence ne travaille.

### Ce qui manque pour que cela fonctionne réellement en production

Par ordre de ce qui bloque le plus.

**`MAPBOX_TOKEN` est déclaré, pas posé.** Le connecteur de géocodage le réclame.
`CLAUDE.md` le liste depuis l'étape 5 dans les secrets Supabase attendus, mais rien ne l'a
jamais posé côté serveur : seul `VITE_MAPBOX_TOKEN` existe, injecté au build du bundle
navigateur. Sans lui, `address_geocode` produira `unavailable` en production, ce qui ne
casse rien mais retire un signal.

**Deux vétos d'entité n'ont aucun connecteur**, `registry_number_format` et
`registry_country_match`. Tant que c'est le cas, aucune agence d'aucun pays ne peut être
auto-validée. Voir §7bis, où le fait est démontré en base.

**Les pièces d'identité déposées ne sont supprimées par aucun chemin** quand la personne
ou l'agence disparaît. Ce n'est pas une exposition, les politiques restent fermées, mais
c'est de la rétention sans propriétaire dans la fonctionnalité qui porte la conformité.

**Deux recettes d'intégration continue n'ont jamais tourné pour de vrai** : le job
`e2e-kyb` ajouté à `e2e.yml`, et l'enregistrement du job planifié
`agency-verification-sweep-hourly`, `pg_cron` étant absent du stack local. À confirmer au
premier déploiement par
`select * from cron.job where jobname = 'agency-verification-sweep-hourly'`.

**Le gate s'appliquera rétroactivement** à tout dirigeant existant au déploiement, et sur
mobile l'écran n'offre que la déconnexion. Sans conséquence tant que la base est mock,
à trancher avant qu'il y ait de vraies agences.

### Trou de même classe, refermé depuis

Le tool WhatsApp `open_kyc_case` insère dans `kyc_cases` sous `service_role`, qui
contourne inconditionnellement les policies : ni le garde posé sur `kyc_cases_insert` ni
celui des edge functions ne couvraient ce chemin, et une agence non vérifiée pouvait
encore faire ouvrir un dossier KYC par WhatsApp. Trouvé en corrigeant l'étape 5, signalé
séparément.

Refermé depuis, avec le même garde : `isAgencyLabClearedInDb`
(`supabase/functions/_shared/agency-lab-guard.ts` — même lecture, même liste blanche,
même fail-closed que `requireAgencyLabCleared`) est appelé dans les **deux** étages du
tier confirm de `_shared/whatsapp-actions.ts`. `prepareOpenKycCase` n'arme plus une
confirmation vouée au refus ; `executeOpenKycCase` relit le garde au moment du « oui »,
puisque c'est là que l'INSERT a lieu et que le payload figé d'une action en attente
survit à un changement de statut de l'agence. C'est le seul `insert` sur `kyc_cases` de
tout `supabase/functions/`. Couverture : `tests/backend/open-kyc-case-lab-guard.spec.ts`
(9 tests live, dont les statuts intermédiaires et le fail-closed sur agence introuvable).

### Le merge : ce qui a été fait le 29 juillet 2026

Cette section était écrite au futur. Elle raconte désormais ce qui a été **exécuté**, parce
que la procédure garde toute sa valeur pour la prochaine fois : c'est elle qui explique
pourquoi la liste des fichiers se dérive de `git` et pas d'un glob, et pourquoi
l'horodatage de départ ne se calcule qu'après l'intégration de `main`.

**Fait :** `main` est intégré (commit de merge `5587e0f2`, 106 commits, **0 de retard**), et
les 18 migrations du chantier ont été re-datées de `20260728*` vers `20260729150000` à
`20260729151700`. Une **19e** s'y est ajoutée, `20260729151800_activity_events_allow_agency_detach.sql`
(voir plus bas). `agency-verification-run` est déclarée dans `supabase/config.toml`.

> **⚠ La fenêtre se referme à minuit UTC le 29 juillet 2026.** Les 19 migrations portent
> cette date. Le garde-date de `deploy.yml` n'applique que celles dont l'horodatage est
> supérieur ou égal à la date du jour en UTC, et il **ne signale un saut que par un
> avertissement, jamais par un échec**. **Mergées un jour ultérieur, elles sont toutes
> sautées en silence pendant que le bundle frontend part quand même** : tout dirigeant se
> retrouve alors devant un wizard dont ni les tables ni les RPC n'existent, avec la
> déconnexion pour seule sortie. Si le merge glisse au lendemain, il faut **re-dater à
> nouveau**, par la même procédure, au jour du merge. Ce n'est pas une formalité : c'est la
> seule chose de cette section qui périme.

#### Ce que la branche ne voyait pas, et pourquoi la procédure est ce qu'elle est

Mesuré le 29.07.2026 avant le merge : la branche avait **106 commits de retard** sur `main`,
qui avait touché **11 fichiers de migration** depuis la base commune (10 ajouts, 1
modification). Trois horodatages étaient **déjà** en collision, avant toute manipulation :

| Horodatage | Branche | `main` |
|---|---|---|
| `20260728100000` | `legal_forms_reference` | `realadvisor_rolling_true_3day_rotation` |
| `20260728110000` | `submit_agency_identity_id_document` | `realadvisor_shard_map_rebalance` |
| `20260728120000` | `agency_verification_config` | `suppress_agency_logo_collisions` |

Trois pièges en découlaient, et ils condamnaient l'ancienne commande (`ls 202607281*.sql`,
compteur dans les minutes à partir de `<jour>100000`). Ils restent la raison d'être de la
procédure ci-dessous :

1. **Le glob déborde sur `main`.** Une fois `main` intégré, `ls 202607281*.sql` rend 22
   fichiers, pas 18 : il attrape aussi les trois ci-dessus **côté `main`** plus
   `20260728190000_admin_console_perf_cleanup`. Ces quatre migrations ont été mergées sur
   `main` le 28 juillet, donc appliquées par le déploiement du jour même (le garde-date les
   couvrait). Les re-dater les ferait rejouer, et surtout changerait la version sous
   laquelle `supabase_migrations.schema_migrations` les connaît. **La liste des fichiers à
   renommer ne se dérive jamais d'un motif de nom** ; elle se dérive de `git`.
2. **Re-dater avant d'intégrer `main` échange trois collisions contre une.** Le premier
   fichier serait sorti en `<jour>100000_legal_forms_reference.sql` ; re-daté le 29 juillet
   2026, c'est `20260729100000`, que `main` porte déjà
   (`20260729100000_activity_events_technical_actions.sql`). Plus généralement, la borne
   basse se lit sur l'arbre de la branche seule et valait alors `20260726005000`, alors que
   l'arbre fusionné monte à `20260729140000` : les migrations du chantier se seraient
   retrouvées *avant* celles de `main`, pas après. L'horodatage de départ ne peut se choisir
   qu'**après** avoir vu l'arbre fusionné. C'est bien ce que le résultat montre : le départ
   retenu est `20260729150000`, juste au-dessus de `20260729140000`.
3. **Le contrôle de doublons documenté était aveugle, et bruyant.** `ls
   supabase/migrations/*.sql` ne lit que l'arbre de la BRANCHE, qui ignore ce que `main` a
   ajouté : joué sur la branche re-datée, il ne remonte rien alors que la collision du
   point 2 existe. Et tronquer au premier `_` (`sed 's/_.*//'`) répète le nommage
   historique : **120 fichiers sur 324** n'ont pas d'horodatage à 14 chiffres (3 au premier
   niveau, `20260522_003_*.sql` et deux voisins, plus les 117 de `_archived`), et leur
   préfixe tronqué se confond. D'où la forme retenue au temps 5, restreinte à
   `^[0-9]{14}_`.

#### La procédure, telle qu'elle a été exécutée : six temps, et c'est leur ordre qui la rend sûre

**1. Intégrer `main` d'abord.** Rien ne se re-date avant : l'horodatage de départ se
calcule sur l'arbre fusionné, et la liste des fichiers du chantier doit être opposée à un
`main` à jour.

```bash
git fetch origin && git merge origin/main   # résoudre les conflits, puis seulement continuer
```

Résultat : merge `5587e0f2`, 106 commits repris, `git rev-list --count HEAD..origin/main`
vaut **0**.

**2. Établir la liste par `git`, jamais par un glob.** Ce que `HEAD` a et que `main` n'a
pas. La commande a rendu les mêmes 18 fichiers avant comme après le merge, et **par
construction elle ne peut désigner aucun fichier de `main`**, quel que soit son horodatage.

```bash
git diff --name-only --diff-filter=A origin/main HEAD -- supabase/migrations | LC_ALL=C sort > /tmp/kyb-mine.txt
wc -l < /tmp/kyb-mine.txt   # valait 18 ; vaut 19 depuis l'ajout d'activity_events_allow_agency_detach
```

**3. Choisir l'horodatage de départ au-dessus de tout ce qui reste.** Deux contraintes :
strictement supérieur au plus haut horodatage des migrations qui NE sont pas renommées
(nos migrations sont les plus récentes, elles peuvent dépendre de tout ce qui précède et
rien ne dépend d'elles), et jamais antérieur au jour du merge en UTC (sinon le garde-date
de `deploy.yml` les saute). Le compteur va dans les **minutes**, jamais multiplié dans un
`printf`. Le calcul a rendu `20260729140000` comme plus haut horodatage conservé, donc
`20260729150000` comme départ.

```bash
ls supabase/migrations/*.sql | LC_ALL=C sort > /tmp/kyb-all.txt
KEPT_MAX=$(comm -23 /tmp/kyb-all.txt /tmp/kyb-mine.txt | sed 's#.*/##' | grep -E '^[0-9]{14}_' | cut -c1-14 | LC_ALL=C sort | tail -1)
TODAY=$(date -u +%Y%m%d); DAY=$TODAY
if [ "${KEPT_MAX:0:8}" -gt "$DAY" ]; then DAY="${KEPT_MAX:0:8}"; fi
if [ "${KEPT_MAX:0:8}" -eq "$DAY" ]; then HH=$(( 10#${KEPT_MAX:8:2} + 1 )); else HH=0; fi
[ "$HH" -le 23 ] || echo "STOP : plus d'heure libre le $DAY, prendre le jour suivant a la main"
echo "reste au plus haut : $KEPT_MAX  ->  depart $DAY$(printf '%02d' $HH)0000"
```

**4. Écrire un plan de renommage, le relire, puis l'appliquer.** Le plan est l'essai à
blanc : il n'affiche que l'ancien et le nouveau nom, aucun fichier ne bouge.

```bash
i=0; : > /tmp/kyb-plan.txt
while read -r p; do b="${p##*/}"; printf '%s\tsupabase/migrations/%s%02d%02d00_%s\n' "$p" "$DAY" "$HH" "$i" "${b#*_}" >> /tmp/kyb-plan.txt; i=$((i+1)); done < /tmp/kyb-mine.txt
awk -F'\t' '{ sub(".*/","",$1); sub(".*/","",$2); s=$2; sub("_.*","",s); printf "%-58s -> %-58s [%d chiffres]\n", $1, $2, length(s) }' /tmp/kyb-plan.txt
```

Trois contrôles **avant** de renommer. Chacun doit être muet ou dire `OK` :

```bash
awk -F'\t' '{ s=$2; sub(".*/","",s); sub("_.*","",s); if (length(s)!=14) print "HORODATAGE NON CONFORME : "s }' /tmp/kyb-plan.txt
diff <(awk -F'\t' '{print $2}' /tmp/kyb-plan.txt) <(awk -F'\t' '{print $2}' /tmp/kyb-plan.txt | LC_ALL=C sort) >/dev/null && echo "OK ordre lexicographique preserve"
comm -12 <(sed 's#.*/##' /tmp/kyb-mine.txt) <(git ls-tree -r --name-only origin/main -- supabase/migrations | sed 's#.*/##' | LC_ALL=C sort)
```

Puis seulement, appliquer le plan tel quel :

```bash
while IFS=$'\t' read -r old new; do git mv "$old" "$new"; done < /tmp/kyb-plan.txt
```

**5. Vérifier les doublons sur l'arbre FUSIONNÉ**, restreint au nommage à 14 chiffres pour
que le nommage historique n'ajoute pas ses faux positifs (point 3 ci-dessus). Doit être
muet, et l'est :

```bash
ls supabase/migrations/*.sql | sed 's#.*/##' | grep -E '^[0-9]{14}_' | cut -c1-14 | LC_ALL=C sort | uniq -d
```

**6. Corriger la seule référence porteuse.** Faite.
`tests/backend/signup-provisioning.spec.ts` **lit un fichier de migration par son chemin**
(`replayBackfillMigration()`, il rejoue le provisionnement d'inscription en entier) : il
pointe désormais sur `20260729150500_signup_agency_provisioning.sql`. Sans cette correction
le renommage le cassait par `ENOENT`, et seulement dans la CI backend, puisque le bloc est
`skipIf(!HAS_KEYS)`. Toutes les autres occurrences d'un horodatage du chantier sont des
commentaires : elles vieillissent, elles ne cassent rien.

```bash
grep -rn "supabase/migrations/2026072[0-9]\{7\}" tests/ scripts/ src/
```

Au 29.07.2026, après re-datage, il rend trois lignes : celle-ci, plus deux commentaires
(`tests/backend/agency-identity-submit.spec.ts` et `src/hooks/useAgencyIdentity.ts`), tous
deux à jour.

#### Une 19e migration, née du merge lui-même

`20260729151800_activity_events_allow_agency_detach.sql` n'appartient pas au chantier : elle
a été écrite **en intégrant `main`**, parce que l'intégration a rendu atteignable un défaut
que deux gardes du dépôt se disputaient depuis toujours. `activity_events.agency_id` porte
une FK `ON DELETE SET NULL` (un événement d'audit survit à l'agence qu'il concerne), et
`enforce_activity_events_immutability()` refusait exactement l'`UPDATE` que cette FK émet.
Tant qu'aucune agence ne portait d'événement, personne ne s'en apercevait ;
`20260729140000_agency_created_event.sql`, mergée sur `main` le matin même, journalise
`agency_created` à **chaque** création d'agence, donc rendait **toute agence nouvelle
définitivement non supprimable**. Le garde a été élargi de façon volontairement étroite :
seul `agency_id` peut bouger, seulement vers `NULL`, et seulement si tout le reste est
inchangé. Son en-tête porte le raisonnement complet, y compris pourquoi la LBA n'y perd
rien. Le chantier KYB n'a fait que l'exposer, étant le seul chemin du dépôt qui supprime une
agence.

#### Vérification sur base neuve

```bash
supabase db reset && npm run test:backend && npm run lint:migrations
```

Rejoué le 29.07.2026 : `supabase db reset` passe (204 migrations à horodatage à 14 chiffres,
3 historiques exclues par `lint:migrations`), backend **912 verts, 4 sautés, 0 échec** sur
916, unitaire **1313 verts**, et `lint:migrations`, `lint:roster`, `lint:prose`, `lint:i18n`
et `build` tous verts. `lint:roster` confirme au passage que `supabase/config.toml` déclare
bien les 67 fonctions du tree, `agency-verification-run` comprise.

> **Piège corrigé en revue finale.** La commande portait `printf '%04d' $((i*1000))`.
> `%04d` est une largeur **minimale**, pas une troncature : à partir de `i=10` elle rend
> cinq chiffres, donc un horodatage à **15 chiffres** au lieu de 14. Essai à blanc sur ces
> 18 fichiers : 8 d'entre eux sortaient à 15 chiffres, et le tri lexicographique des noms
> **complets** de fichiers, celui que font `deploy.yml` et la commande elle-même, plaçait
> alors `202607291010000_submit_agency_identity_id_document.sql` en **deuxième position**,
> juste après `20260729100000_legal_forms_reference.sql` et **avant**
> `20260729101000_agencies_kyb_columns.sql` : les deux partagent leurs 14 premiers
> caractères, et le suivant est `0` (0x30) d'un côté contre `_` (0x5F) de l'autre. Mesuré
> en collation `C`, celle des runners GitHub Actions ; sous une collation qui ignore la
> ponctuation (`en_US.UTF-8`) il glisse en troisième position, jamais plus loin. Dans les
> deux cas `submit_agency_identity_id_document` passe **avant** `agency_related_persons` et
> `agency_verification_checks`, donc `supabase db reset` en échec, et poussée sans reset la
> catastrophe décrite ci-dessus. La forme retenue ci-dessus tient jusqu'à 60 fichiers (`MM`
> va de `00` à `59`) ; au-delà, passer le compteur aux secondes plutôt que d'élargir le
> `printf`.
>
> Les noms cités ici sortent d'un essai à blanc mené avec un départ à `2026072910` ; le
> départ finalement appliqué est `20260729150000` (temps 3, calculé sur l'arbre fusionné).
> La démonstration ne dépend pas de l'heure, elle vaut telle quelle.

---

## 8. Dépendances externes en attente

**Le registre bloqué est le suisse, c'est-à-dire le marché.** Le connecteur de plus
forte valeur est celui qu'on ne peut pas écrire aujourd'hui.

| Source | Statut au 26.07.2026 |
|---|---|
| **Zefix PublicREST** (registre CH) | `401`, identifiants demandés à `zefix@bj.admin.ch`, **sans réponse** |
| **Zefix par LINDAS** (SPARQL Open Data) | ✅ **public, sans clé** (vérifié le 29.07.2026), mais **pas** le statut actif/radié |
| Registre UID/TVA (CH/LI) | API séparée ou champ Zefix ? **non clarifié** |
| `oera.li` (registre LI) | **aucune API publique**, revue manuelle pour ce pays |
| Carte pro immobilier CCI (FR) | pas d'API (403 anti-bot), revue manuelle |
| GLEIF (LEI) | non joignable **depuis le sandbox d'outils**, à retester depuis une edge function ; ce n'est pas un fait sur GLEIF |
| `recherche-entreprises.api.gouv.fr` (FR) | public, sans clé, 7 req/s |
| VIES (TVA UE) | public, sans clé |
| RDAP `.ch` / `.li` / `.fr` | publics |

**Le blocage suisse ne porte que sur le statut actif.** Les données Zefix sont aussi
publiées en Open Data par LINDAS, l'endpoint SPARQL de la Confédération
(`https://lindas.admin.ch/query`, graphe `<https://lindas.admin.ch/foj/zefix>`), public et
sans authentification. Ce dépôt s'en sert déjà : `scripts/zefix-enrich-agencies.mjs`
l'interroge pour retrouver l'IDE d'une agence, et dit l'avoir choisi plutôt que l'API REST
« qui exige des identifiants OFJ + throttle ». Vérifié en direct le 29.07.2026 : un `POST`
filtrant `schema:legalName` rend `HTTP 200` et les raisons sociales attendues, sans clé.
Conséquence, check par check : `registry_legal_name_match` et `registry_country_match` sont
**servables aujourd'hui** pour la Suisse ; `registry_lookup` ne l'est qu'à moitié, LINDAS
donnant l'existence mais **pas** le statut actif/radié, qui reste suspendu à PublicREST.
Le registre UID/TVA n'est pas concerné, LINDAS ne le remplace pas. Cela ne rend pour autant
aucun dossier suisse auto-validable : `registry_number_format` n'a toujours aucun connecteur
et la pièce d'identité reste en revue humaine (§7bis). Détail dans le commentaire de section
de `_shared/kyb-sources.ts`, écrit pour qui branchera le connecteur.

**Rien de ce programme ne dépend de ces réponses, sauf l'étape 6** : les tables de
checks sont agnostiques de la source, et un check `source='manual'` saisi par un humain
se score exactement comme un check automatique. C'est ce qui rend le parcours suisse
exploitable dès maintenant, en revue humaine.

### Où poser les identifiants quand ils arriveront

Les squelettes de l'étape 6 lisent quatre variables d'environnement, toutes **absentes
aujourd'hui**, aucune n'étant déclarée en secret Supabase ni dans `supabase/config.toml`.
Elles sont lues par `agency-verification-run/index.ts` et injectées dans les fabriques ;
le message d'indisponibilité que voit un relecteur de la file renvoie ici.

| Variable | Ce qu'elle porte | Sans elle |
|---|---|---|
| `ZEFIX_API_URL` | l'URL de base de Zefix PublicREST, **inconnue** : un `401` apprend qu'un service existe et exige une authentification, jamais à quoi ressemble un appel autorisé | `registry_lookup`, `registry_legal_name_match` et `registry_country_match` sortent `unavailable` pour toute agence suisse |
| `ZEFIX_API_CREDENTIAL` | de quoi s'authentifier auprès de Zefix, en attente de `zefix@bj.admin.ch` | idem |
| `UID_REGISTER_API_URL` | l'URL du registre UID, **plus incertaine encore** : on ignore s'il existe une API séparée ou si la TVA n'est qu'un champ Zefix | `vat_lookup` sort `unavailable` pour une agence suisse ou liechtensteinoise |
| `UID_REGISTER_API_CREDENTIAL` | de quoi s'y authentifier, si tant est qu'il faille le faire | idem |

**Les poser sans écrire le connecteur ne débloque rien**, et le dit : la source lève alors
`KybSourceNotWiredError` au lieu de `KybSourcePendingCredentialsError`, ce qui distingue
« il manque un identifiant » de « il manque du code » dans la pièce d'audit. Voir §6,
étape 6.

`MAPBOX_TOKEN` relève de la même famille (secret Supabase attendu, absent aujourd'hui)
mais pas de la même cause : ce jeton-là, le dépôt l'a déjà (il est utilisé côté navigateur
sous `VITE_MAPBOX_TOKEN`), il n'a simplement jamais été posé côté serveur. Voir `CLAUDE.md`.

---

## 9. Carte des fichiers

État réel de la branche (chaque chemin vérifié par un `ls`). Les migrations ont été
re-datées **au 29 juillet** en préparant le merge (§7ter) ; les noms en `2026072612xxxx`
puis en `20260728*` cités dans les versions précédentes de cette section **n'existent
plus**. Les occurrences de ces anciens horodatages qui subsistent ailleurs dans ce document
et dans les commentaires du code sont des références historiques : elles vieillissent, elles
ne cassent rien.

**Conception et suivi**

| Fichier | Rôle |
|---|---|
| `docs/agency-kyb-verification.md` | conception du schéma et de la vérification, arbitrages, inventaire des sources |
| `docs/superpowers/specs/2026-07-26-onboarding-kyb-design.md` | conception du parcours utilisateur, gate, découpage |
| `docs/agency-kyb-handoff.md` | ce document |
| `docs/superpowers/plans/2026-07-2{6,7,8,9}-onboarding-kyb-etape*.md` | 6 plans d'implémentation, un par étape (`etapes-0-1`, `etape-2` … `etape-6`) |
| `docs/runbooks/trigger-inscription-duplique.md` | rétablissement si le trigger d'inscription se retrouve en double |

**Migrations** : les 19, dans l'ordre d'application (`supabase/migrations/`)

| Fichier | Rôle |
|---|---|
| `20260729150000_legal_forms_reference.sql` | référentiel, alias, `normalize_legal_form_text()` |
| `20260729150100_agencies_kyb_columns.sql` | renommage `ide`, FK forme juridique, backfill, état de vérification |
| `20260729150200_agency_related_persons.sql` | personnes de conformité, rôles, `is_agency_admin()` |
| `20260729150300_agency_verification_checks.sql` | catalogue, config pondérée versionnée, 2 journaux de checks |
| `20260729150400_auth_user_created_trigger.sql` | `on_auth_user_created` versionné (il n'était dans aucune migration) |
| `20260729150500_signup_agency_provisioning.sql` | `handle_new_user()` / `provision_solo_agency()` corrigés, backfill des fondateurs |
| `20260729150600_revoke_join_agency.sql` | `join_agency(uuid)` révoquée d'`authenticated` |
| `20260729150700_agencies_identity_submission.sql` | `identity_submitted_at`, statut `validated` |
| `20260729150800_submit_agency_identity.sql` | RPC de soumission, garde de complétude, verrou `FOR UPDATE` |
| `20260729150900_kyb_identity_documents_storage.sql` | préfixe Storage `kyb-identity` et ses 4 policies dédiées |
| `20260729151000_submit_agency_identity_id_document.sql` | pièce d'identité du signataire, check `id_document` |
| `20260729151100_agency_verification_config.sql` | `get_agency_verification_config()`, seuils réglables |
| `20260729151200_recompute_agency_verification.sql` | **le moteur** : score, vétos, statut |
| `20260729151300_record_agency_verification_run.sql` | écriture des checks + moteur + journal, en une transaction |
| `20260729151400_trigger_agency_verification_on_submit.sql` | déclenchement depuis la soumission + `sweep_pending_agency_verifications` |
| `20260729151500_agency_review_queue.sql` | file de revue admin et ses quatre décisions humaines |
| `20260729151600_lock_agency_verification_columns.sql` | écriture des colonnes de vérification révoquée aux rôles utilisateur |
| `20260729151700_kyc_cases_insert_lab_guard.sql` | garde LAB dans le `WITH CHECK` de `kyc_cases_insert` |
| `20260729151800_activity_events_allow_agency_detach.sql` | née du merge : le `SET NULL` de la FK devient un cas autorisé du journal append-only |

**Backend applicatif**

| Fichier | Rôle |
|---|---|
| `supabase/functions/agency-verification-run/index.ts` | le passage de vérification : lit l'agence, compose et filtre le registre, appelle la RPC |
| `supabase/functions/_shared/kyb-sources.ts` | contrat des connecteurs, harnais, RDAP / VIES / recherche-entreprises / Mapbox, juridiction, squelettes Zefix et UID |
| `supabase/functions/_shared/agency-lab-guard.ts` | garde LAB côté edge (`requireAgencyLabCleared`, `isAgencyLabClearedInDb`) |
| `supabase/functions/kyc-screening/index.ts`, `sign-document/index.ts`, `_shared/whatsapp-actions.ts` | les trois surfaces que le garde LAB ferme |
| `src/lib/edgeFunctionRoster.ts` | inventaire des edge functions (y compris `agency-verification-run`) |

**Frontend**

| Fichier | Rôle |
|---|---|
| `src/hooks/useIdentityGate.ts` | gate d'identité légale, `resolveIdentityGateStatus` (pure, testée hors React) |
| `src/hooks/useAgencyIdentity.ts` | lecture/écriture du wizard, upload des pièces |
| `src/hooks/useLegalForms.ts` | options du menu, filtrées par pays du siège |
| `src/hooks/useLabGuard.ts` | garde LAB côté CRM agent |
| `src/hooks/useAdminKybReview.ts` | file de revue de la console admin |
| `src/hooks/useAgencySettings.ts` | lecture/écriture des réglages agence |
| `src/components/crm-sugar-identity/IdentityShell.tsx` + `tokens.ts` | coquille du wizard, navigation et persistance |
| `src/components/crm-sugar-identity/steps/Step{Signataire,Agence,Beneficiaires,PieceIdentite,Recapitulatif}.tsx` | les 5 étapes |
| `src/pages/agent/IdentitySugarPage.tsx`, `IdentityMobileNotice.tsx` | route `/dashboard/identite`, desktop et mobile |
| `src/pages/admin/AdminKybReviewPage.tsx` | écran de la file de revue |
| `src/components/layout/KycLabGuard.tsx`, `LabGuardBanner.tsx` | blocage et bandeau de rappel |
| `src/components/crm-sugar/settings/focus/pfKit{,Core}.tsx` | mode « choix unique » ajouté à `PfEditField` |
| `src/i18n/locales/{fr,de,en,it}/onboarding.json` | libellés du wizard, 4 langues |

**Tests**

| Fichier | Rôle |
|---|---|
| `tests/backend/agency-kyb-verification.spec.ts` | non-régression du schéma : référentiel, backfill, policies |
| `tests/backend/agency-identity-submit.spec.ts` | RPC de soumission, complétude, idempotence |
| `tests/backend/kyb-identity-documents-storage.spec.ts` | les 8 policies du préfixe `kyb-identity` |
| `tests/backend/signup-provisioning.spec.ts`, `onboarding-agency-rpc.spec.ts` | chemin d'inscription |
| `tests/backend/agency-verification-config.spec.ts`, `agency-verification-engine.spec.ts` | barème et moteur |
| `tests/backend/agency-verification-run.spec.ts` | Edge Function, connecteurs, juridiction, squelettes, non-régression du verdict |
| `tests/backend/agency-review-queue.spec.ts` | file de revue et décisions humaines |
| `tests/backend/agency-lab-guard.spec.ts`, `kyc-cases-insert-lab-guard.spec.ts`, `open-kyc-case-lab-guard.spec.ts` | gardes LAB (edge, RLS, WhatsApp) |
| `tests/backend/agencies-verification-columns-lockdown.spec.ts` | colonnes de vérification en lecture seule pour les rôles utilisateur |
| `tests/unit/identity-gate.spec.ts`, `identity-shell-navigation.spec.ts`, `useAgencyIdentity.spec.ts`, `lab-guard.spec.ts`, `admin-kyb-review-reasons.spec.ts` | unitaires |
| `tests/e2e/onboarding-identite.spec.ts` + `playwright.kyb.config.ts` | cycle complet, authentification réelle, job CI `e2e-kyb` (`.github/workflows/e2e.yml`) |

Fichiers à connaître, **non modifiés** par le chantier :

| Fichier | Pourquoi |
|---|---|
| `supabase/migrations/20260718130000_remove_onboarding_provision_solo_agency.sql` | version d'origine de `handle_new_user()` et `provision_solo_agency()`, remplacée par `…105000` |
| `supabase/migrations/20260621130000_fix_agency_join_role_cast.sql` | `join_agency()` d'origine, révoquée par `…106000` |
| `sites/megga-vitrine/js/megga-auth.js` | formulaire d'inscription de la vitrine, envoi d'`agency_name` |

Le SQL de vérification manuelle (backfill et RLS) était jetable et **n'est pas dans le
dépôt** : il a été remplacé par le spec de non-régression, qui couvre les mêmes cas.

---

## 10. Par où commencer

Les étapes 0 à 5 sont livrées, l'étape 6 pose des squelettes (§7ter pour le tableau
d'avancement). Il n'y a donc plus d'étape à « traiter » : il reste un merge à faire, et des
suites à décider.

1. Monter l'environnement (§3), puis `supabase db reset && npm run test:backend`. Si la
   suite backend passe, la base est saine et tu peux faire confiance au reste de ce
   document. Deux échecs connus, non liés au chantier, dans
   `tests/backend/agency-review-queue.spec.ts` : la file n'a pas de `LIMIT`, PostgREST
   tronque à 1000 lignes et une base locale chargée dépasse ce seuil.
2. **Re-dater les 18 migrations le jour du merge** (§7ter, « À faire au moment du merge »).
   C'est la seule action obligatoire, et l'oublier casse silencieusement le déploiement.
   Faire l'essai à blanc avant de renommer.
3. Poser `MAPBOX_TOKEN` côté serveur (§7ter) : déclaré dans `CLAUDE.md`, jamais posé.
4. Relancer les identifiants Zefix. C'est le chemin critique du marché suisse, et personne
   d'autre que nous ne le débloquera (§8). Le jour où ils arrivent, il ne reste que l'URL,
   l'authentification et l'analyse de la réponse (§6, étape 6).
5. `registry_number_format` est le travail court qui rapporte le plus : c'est un calcul pur
   (clé de contrôle `CHE` et SIREN), sans réseau ni identifiant, et le dernier véto qui
   empêche un dossier suisse par ailleurs complet d'être auto-validé (§7bis).
