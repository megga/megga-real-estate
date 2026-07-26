# KYB agences — fichier de relais

> **Pour qui :** la personne qui reprend ce chantier.
> **Écrit le :** 26 juillet 2026. **Branche :** `feat/agency-kyb-verification` @ `06b91801`.
> **Conception et raisonnement :** [agency-kyb-verification.md](agency-kyb-verification.md) —
> ce fichier-ci ne répète pas les décisions, il dit **où on en est et quoi faire**.

---

## En une minute

Le **schéma** de vérification d'identité des agences est écrit, exécuté pour de vrai et
couvert par des tests. Le **moteur** qui exploite ce schéma n'existe pas encore.

| | État |
|---|---|
| Schéma DB (8 tables, 4 migrations) | ✅ livré, exécuté sur Postgres 17 local, testé |
| Frontend (saisie forme juridique + n° de registre) | ✅ livré, build + 951 tests unitaires verts |
| Tests de non-régression | ✅ 16 tests, `tests/backend/agency-kyb-verification.spec.ts` |
| Docs + cerveau système | ✅ à jour |
| **Moteur de scoring** | ❌ **prochaine étape, conception déjà faite (§6)** |
| Connecteurs registres | ❌ rien écrit ; la source suisse est bloquée (§7) |
| File de revue manuelle (console admin) | ❌ rien écrit |

**Deux choses à faire avant de merger** (§2). **Ne pas merger sans les avoir traitées.**

---

## 1. Ce que contient la branche

6 commits, 20 fichiers :

```
f9b1a0ad  feat(kyb)  schéma (4 migrations, 8 tables)
aed8b28a  merge      mise à jour depuis main
dad8cc37  feat(kyb)  frontend : réglages agence adaptés
65521bb6  docs(kyb)  schema.md + system-map.md + seed du cerveau
d4220fe2  fix(kyb)   alias homonymes manquants (défaut trouvé à l'exécution)
06b91801  test(kyb)  16 tests de non-régression
```

Migrations : `20260726120000` référentiel · `120100` colonnes `agencies` · `120200`
personnes liées · `120300` journaux de checks.

---

## 2. ⚠ À traiter AVANT de merger

### a) Collision d'horodatage de migration

`main` porte déjà `20260726120000_realadvisor_shard_map_3day.sql` (commit `b77b0c68`).
Ma migration `20260726120000_legal_forms_reference.sql` a **le même préfixe de version**.
La collision n'est pas encore visible dans la branche — elle apparaît au merge ou au
rebase sur `main` à jour.

Le dépôt a déjà corrigé ce cas deux fois en juillet 2026 (`debfdeea`, `674e80e9`) : la
pratique établie est de re-dater. Comme le fichier de `main` est déjà mergé, ce sont
**mes 4 fichiers** qui se re-datent.

> Je n'ai pas reproduit le mode d'échec exact du CLI Supabase avec deux versions
> identiques — `deploy.yml`, lui, trie par nom de fichier et resterait déterministe.
> Mais le dépôt traite ça comme un défaut à corriger, pas comme un détail.

### b) Le date-guard de `deploy.yml`

`deploy.yml` n'applique que les migrations dont l'horodatage est `>= TODAY` (UTC).
Mergées un jour après leur date, **elles sont sautées définitivement** — aucun
déploiement ultérieur ne les rattrape, il n'y a qu'un `::warning::` facile à manquer.
Or `deploy-app.yml` n'a **aucun** garde-fou de date : le frontend partirait en cherchant
`business_registration_number` et `legal_form_id`, colonnes inexistantes → page
Réglages → Agence cassée **durablement**, pas quelques minutes.

### 👉 Une seule action règle les deux

**Re-dater les 4 migrations au jour du merge :**

```bash
cd supabase/migrations && for f in 20260726120*_*.sql; do git mv "$f" "$(date -u +%Y%m%d)${f:8}"; done
```

```bash
npm run lint:migrations && npx vitest run --config=vitest.backend.config.ts tests/backend/agency-kyb-verification.spec.ts
```

L'alternative (les appliquer à la main avant de merger) est documentée dans `deploy.yml`
comme le flux normal du dépôt, mais ne résout pas la collision.

### c) Fenêtre de coupure, inévitable

Les trois workflows (`deploy.yml` migrations+vitrine, `deploy-app.yml` CRM,
`deploy-admin.yml`) se déclenchent **en parallèle**, sans ordre garanti entre « migration
appliquée » et « nouveau bundle en ligne ». Réglages → Agence sera en erreur quelques
minutes, dans un sens ou dans l'autre. C'est la conséquence assumée d'un `RENAME COLUMN`
atomique ; le rendre transparent demanderait le découpage en trois temps (ajouter la
colonne + double écriture, déployer, supprimer plus tard), jugé disproportionné.

---

## 3. Monter l'environnement (Windows — compter 20 min)

La machine d'origine n'avait **ni Node ni le CLI Supabase**. Si tu repars de zéro :

```bash
scoop install nodejs-lts
```

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase
```

⚠ **Scoop modifie le PATH utilisateur, que les shells déjà ouverts ne voient pas.**
Redémarre tes terminaux, sinon `node`/`npm`/`supabase` resteront « introuvables ».

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

Aucun n'affecte la CI Linux — ils ne cassent que la validation locale, c'est-à-dire
exactement au moment où on veut s'en servir.

| Script | Symptôme | Cause |
|---|---|---|
| `check-migration-idempotence.mjs` | 6 faux positifs | `/--.*$/` ne masque pas les commentaires en CRLF (`.` ne matche pas `\r`) |
| `check-dead-exports.mjs` | 28 faux positifs | allowlist en slashes vs chemins `ts-prune` en antislash |
| `check-edge-roster.mjs` | « dérive » fantôme | compare une chaîne en `\n` à un fichier en CRLF (67 dossiers / 67 entrées, aucun écart réel) |
| `ruflo-seed-memory.mjs` | `spawnSync npx ENOENT` | `execFileSync('npx')` : sous Windows c'est `npx.cmd`, non résolu via PATHEXT |

**Conséquence du dernier :** la mémoire sémantique locale (`.swarm/memory.db`) n'a jamais
été construite sur cette machine. `npx ruflo memory search` répond donc **vide** — un faux
négatif silencieux qui se lit « le cerveau ne sait rien sur ce sujet ». En attendant le
correctif, passer par [system-map.md](system-map.md) ou grepper directement
`.claude-flow/knowledge/megga-memory.seed.json` (le fichier durable, à jour).

---

## 5. Ce qui est vérifié, et par quoi

Rien ci-dessous n'est une supposition ; tout est reproductible.

- **Exécution des migrations** — `supabase db reset`, 174 migrations à neuf, exit 0.
- **Backfill `legal_form` texte → FK** — 13 cas : sigle simple, accents, ponctuation,
  casse et espaces multiples, libellé dans une autre langue que le pays
  (« Aktiengesellschaft » pour une SA suisse), libellé inconnu, pays hors périmètre, et
  les **deux ambiguïtés qui doivent être refusées** (« SA » et « Entreprise
  individuelle » sans pays). Invariant : 0 ligne portant à la fois le texte et la FK.
- **RLS** — agent simple : **0 ligne dans sa propre agence** · dirigeant : 1 · autre
  agence : 0 · pondérations invisibles même au dirigeant · référentiel lisible par tous
  (il alimente le menu) · écriture de check refusée (`42501`) · insertion cross-agence
  refusée · contrainte rôle/attributs tenue.
- **Le test garde vraiment ce qu'il prétend** — vérifié **par mutation** : l'alias `sa`
  de `FR_SA` retiré en base, le test « garde ambigus les sigles homonymes entre pays »
  échoue ; alias restauré, il repasse. Un test jamais vu échouer ne prouve rien.
- **Non-régression** — suite backend complète : 619 tests / 104 fichiers, 0 échec.
  Front : `npm run build`, `npm run build:admin`, 951 tests unitaires.

---

## 6. Prochaine étape : le moteur de scoring

Décidée et conçue, **pas commencée**. Tout ce qui suit a été établi en lisant le dépôt —
autant ne pas le redécouvrir.

### Forme : une RPC Postgres, pas une Edge Function

**Tous** les moteurs de score de ce projet vivent en Postgres (`calculate_property_scores`,
scoring contacts, focus radar). Et l'agrégation pondérée sur des lignes de checks est du
SQL naturel : atomique avec la donnée, sans aller-retour réseau, testable par le harnais
backend qui existe déjà. Les Edge Functions seront nécessaires pour les **connecteurs**
(eux ont besoin du réseau), pas pour le calcul.

### Seuils réglables : patron `app_config`

Clé `agency_verification_v1` + fonction jumelle `get_agency_verification_config()`,
calquée sur `get_property_score_config()` (`jsonb`, `STABLE SECURITY DEFINER`,
`search_path`). Défauts sûrs en dur : `auto_validate_min` 0.85, `review_priority_min` 0.5.

### Règles de calcul (issues de [la conception](agency-kyb-verification.md) §2)

- **Dernier check par type** : les checks sont append-only, une ré-exécution ajoute une
  ligne → `distinct on (check_type) … order by check_type, checked_at desc`.
- **Jointure du poids TEMPORELLE** — c'est le cœur du dispositif d'auditabilité :
  `cfg.valid_from <= chk.checked_at and (cfg.valid_to is null or cfg.valid_to > chk.checked_at)`.
- **Véto** : ne passe que sur `match`. Un véto **absent** ne passe PAS — l'absence de
  preuve n'est pas une preuve. Exiger au moins un signataire actif, sinon blocage : on ne
  valide pas une entité dont on ignore qui l'engage.
- **`unavailable`** exclu du numérateur ET du dénominateur (un pays sans VIES n'est pas
  pénalisé). **`pending_manual_review`** force la revue humaine.
- Score `null` (aucun check scorable) → jamais d'auto-validation.
- **`rejected` n'est jamais posé automatiquement** (décision humaine), et le moteur ne
  doit **pas écraser** un `rejected` existant : un verdict humain ne se retourne pas tout
  seul au prochain passage.
- **Pas de colonne de priorité** : la file admin trie par score (éviter une colonne
  dérivée, cohérent avec le reste du schéma).

### ⚠ Contraintes de `activity_events` vérifiées en base (elles cassent à l'application)

- `category` ∈ `kyc | deal | contact | bien | doc | auth | settings | ai` →
  utiliser **`'kyc'`**. `'compliance'` **fait échouer** la contrainte CHECK.
- `severity` ∈ `info | warn | critical`.
- `actor_kind` NOT NULL ∈ `user | ai | system`, **et** contrainte
  `activity_events_actor_kind_coherence` : avec `actor_kind='system'`, `actor_id` **doit
  être NULL**.

### Droits

`REVOKE EXECUTE` sur `anon`/`authenticated`, `GRANT` au `service_role` seul (discipline
`20260711210000_secdef_execute_revoke`). Élargir plus tard si la console admin appelle la
RPC directement — plutôt sous-accorder que l'inverse.

### Pas de cron pour l'instant

Inutile avant que des connecteurs produisent des checks. À ajouter avec eux, gardé par la
présence de `pg_cron` comme les autres.

---

## 7. Dépendances externes en attente

**Le registre bloqué est le suisse — c'est-à-dire le marché.** Le connecteur de plus
forte valeur est celui qu'on ne peut pas écrire aujourd'hui.

| Source | Statut au 26.07.2026 |
|---|---|
| **Zefix** (registre CH) | `401` — identifiants demandés à `zefix@bj.admin.ch`, **sans réponse** |
| Registre UID/TVA (CH/LI) | API séparée ou champ Zefix ? **non clarifié** |
| `oera.li` (registre LI) | **aucune API publique** → revue manuelle pour ce pays |
| Carte pro immobilier CCI (FR) | pas d'API (403 anti-bot) → revue manuelle |
| GLEIF (LEI) | non joignable **depuis le sandbox d'outils** — à retester depuis une edge function, ce n'est pas un fait sur GLEIF |
| `recherche-entreprises.api.gouv.fr` (FR) | ✅ public, sans clé, 7 req/s |
| VIES (TVA UE) | ✅ public, sans clé |
| RDAP `.ch` / `.li` / `.fr` | ✅ publics |

**Le moteur ne dépend d'aucune de ces réponses** : les tables de checks sont agnostiques
de la source, et un check `source='manual'` saisi par un humain se score exactement comme
un check automatique. C'est ce qui rend le parcours suisse exploitable dès maintenant.

---

## 8. Carte des fichiers

| Fichier | Rôle |
|---|---|
| `docs/agency-kyb-verification.md` | conception, arbitrages, inventaire des sources |
| `supabase/migrations/20260726120000_legal_forms_reference.sql` | référentiel + alias + `normalize_legal_form_text()` |
| `…120100_agencies_kyb_columns.sql` | renommage `ide`, FK forme juridique, backfill, état de vérification |
| `…120200_agency_related_persons.sql` | personnes de conformité + rôles + `is_agency_admin()` |
| `…120300_agency_verification_checks.sql` | catalogue, config pondérée versionnée, 2 journaux |
| `tests/backend/agency-kyb-verification.spec.ts` | 16 tests de non-régression |
| `src/hooks/useLegalForms.ts` | options du menu, filtrées par pays du siège |
| `src/hooks/useAgencySettings.ts` | lecture/écriture des réglages agence |
| `src/components/crm-sugar/settings/focus/pfKit{,Core}.tsx` | mode « choix unique » ajouté à `PfEditField` |

Le SQL de vérification manuelle (backfill et RLS) était jetable et **n'est pas dans le
dépôt** : il a été remplacé par le spec de non-régression, qui couvre les mêmes cas.

---

## 9. Ce que je ferais en arrivant

1. Lire §2 et décider quand on merge (le re-datage règle collision + date-guard d'un coup).
2. Monter l'environnement (§3) et lancer `supabase db reset` + les 16 tests — si ça passe,
   la base est saine et tu peux faire confiance au reste de ce document.
3. Écrire le moteur (§6). La conception est faite ; c'est du SQL et des tests.
4. Relancer les identifiants Zefix — c'est le chemin critique du marché suisse, et
   personne d'autre que nous ne le débloquera.
