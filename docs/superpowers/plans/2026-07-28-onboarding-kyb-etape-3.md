# Onboarding KYB — étape 3 : le moteur de scoring

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`
> pour exécuter ce plan tâche par tâche.

**Goal :** calculer, à partir des lignes de vérification, un score et un statut pour
chaque agence, de façon explicable et auditable.

**Architecture :** une RPC Postgres, pas une Edge Function. Tous les moteurs de score de
ce projet vivent en Postgres, et l'agrégation pondérée sur des lignes de checks est du
SQL naturel : atomique avec la donnée, sans aller-retour réseau, testable par le harnais
backend existant. Les Edge Functions seront nécessaires pour les connecteurs, qui ont
besoin du réseau, pas pour le calcul.

**Conception de référence :** [relais KYB](../../agency-kyb-handoff.md) §7, écrite par
Antoine en lisant le dépôt. Elle est reprise telle quelle ; ce plan ne fait que
l'ordonner en tâches.

---

## Global Constraints

- Migration idempotente et rejouable, nommée `YYYYMMDDHHMMSS_nom.sql`, **datée du jour
  du merge** : le pipeline saute définitivement toute migration antérieure. La séquence
  actuelle du chantier va jusqu'à `20260728110000`.
- `SECURITY DEFINER` avec `SET search_path TO 'public'`, `REVOKE` sur `anon` et
  `authenticated`, `GRANT` au `service_role` seul. Élargir plus tard si la console admin
  appelle la RPC directement : plutôt sous-accorder que l'inverse.
- `activity_events` : `category` doit valoir `'kyc'` (la valeur `'compliance'` fait
  échouer la contrainte CHECK), `severity` dans `info | warn | critical`, et avec
  `actor_kind='system'` le champ `actor_id` **doit être NULL**.
- Commentaires SQL en français disant le **pourquoi**, sans glose ligne à ligne.
- TypeScript strict sans `any`. Tests backend derrière `describe.skipIf(!HAS_KEYS)` :
  **lire le compte de tests, jamais le code de sortie**.
- Apostrophes ASCII droites uniquement comme délimiteurs de chaîne en TypeScript.

---

## Les règles de calcul, telles qu'elles doivent être

Elles viennent de la conception d'Antoine. Chacune a une raison, et s'en écarter casse
une propriété de conformité.

**Dernier check par type.** Les checks sont append-only : une ré-exécution ajoute une
ligne. Le moteur ne considère que la plus récente de chaque type,
`distinct on (check_type) ... order by check_type, checked_at desc`.

**Jointure du poids temporelle.** C'est le coeur de l'auditabilité :
`cfg.valid_from <= chk.checked_at and (cfg.valid_to is null or cfg.valid_to > chk.checked_at)`.
Un dossier validé hier doit pouvoir se rejustifier avec le barème d'hier, pas avec celui
d'aujourd'hui.

**Véto.** Un check dont la configuration porte `is_veto` ne passe que sur `match`.
**Un véto absent ne passe PAS** : l'absence de preuve n'est pas une preuve. Exiger en
outre au moins un signataire actif, sinon blocage : on ne valide pas une entité dont on
ignore qui l'engage.

**`unavailable`** est exclu du numérateur **et** du dénominateur. Un pays sans source
disponible n'est pas pénalisé, il est seulement moins confirmé. C'est ce qui rend le
dispositif transposable d'un pays à l'autre.

**`pending_manual_review`** force la revue humaine, quel que soit le score.

**Résultats scorés** : `match` vaut 1, `partial` vaut 0.5, `mismatch` vaut 0.

**Score `null`** quand aucun check scorable n'existe : n'auto-valide jamais.

**`rejected` et `validated` ne sont jamais posés automatiquement** et le moteur ne doit
**pas les écraser** : un verdict humain ne se retourne pas tout seul au prochain passage.

**Pas de colonne de priorité.** La file admin trie par score, ce qui évite une colonne
dérivée et reste cohérent avec le reste du schéma.

**Les deux niveaux comptent.** Les checks d'agence alimentent le score. Les checks de
personne portent les vétos de personne : un hit PEP ou sanctions envoie en revue humaine
quel que soit le score de l'entité.

---

## Task 1 : le barème réglable

**Files:**
- Créer : `supabase/migrations/<jour>_agency_verification_config.sql`
- Créer : `tests/backend/agency-verification-config.spec.ts`

**Interfaces:**
- Produit : `public.get_agency_verification_config() returns jsonb`.

Patron `app_config`, clé `agency_verification_v1`, fonction jumelle calquée sur
`get_property_score_config()` : lis cette dernière avant d'écrire, elle est le modèle
maison. `STABLE SECURITY DEFINER`, `search_path` figé.

Défauts sûrs en dur : `auto_validate_min` à 0.85, `review_priority_min` à 0.5.

La fonction n'expose **que** cette clé, jamais tout `app_config`. La sécurité tient aux
droits, pas à une hypothèse sur la façon dont l'appelant s'en sert.

**Tests :** la fonction renvoie les deux seuils ; elle n'expose aucune autre clé ; elle
est refusée à `anon`.

---

## Task 2 : le moteur

**Files:**
- Créer : `supabase/migrations/<jour>_recompute_agency_verification.sql`
- Créer : `tests/backend/agency-verification-engine.spec.ts`

**Interfaces:**
- Consomme : `verification_check_config`, `verification_check_types`,
  `agency_verification_checks`, `agency_person_verification_checks`,
  `agency_person_roles`, `get_agency_verification_config()`.
- Produit : `public.recompute_agency_verification(p_agency_id uuid) returns void`, qui
  met à jour `agencies.verification_score`, `verification_status` et `verified_at`.

**Tests, un par règle.** Chacun doit être prouvé rouge avant l'implémentation, et
chacun garde une propriété de conformité qui se casserait silencieusement :

- un dossier sans véto et de score suffisant passe en `auto_validated` ;
- un score entre les deux seuils part en `manual_review` ;
- un score sous le seuil bas part aussi en `manual_review` (la priorité vient du tri, pas
  du statut) ;
- un véto en `mismatch` envoie en revue quel que soit le score ;
- **un véto absent envoie en revue** : c'est la règle la plus facile à casser par
  inadvertance, et la plus lourde de conséquence ;
- une agence sans signataire actif ne peut pas être auto-validée ;
- un `unavailable` ne fait pas baisser le score, il sort du calcul ;
- un `pending_manual_review` force la revue même avec un score parfait ;
- deux checks du même type ne comptent qu'une fois, le plus récent ;
- **le poids appliqué est celui en vigueur à la date du check**, pas le poids courant :
  crée deux versions de configuration et vérifie que le score reflète l'ancienne ;
- un hit PEP ou sanctions au niveau personne envoie en revue ;
- un statut `rejected` posé par un humain n'est **pas** écrasé par un passage du moteur ;
- un statut `validated` non plus ;
- une agence sans aucun check scorable a un score `null` et n'est jamais auto-validée ;
- la RPC est refusée à `anon` et à `authenticated`.

---

## Task 3 : vérification et documentation

**Files:**
- Modifier : `docs/agency-kyb-handoff.md`, `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] Suite backend complète, en lisant le compte de tests.
- [ ] `npm run lint:migrations`, `npm run build`.
- [ ] Handoff : passer l'étape 3 à l'état fait, décrire le moteur en quelques lignes et
      rappeler que le déclenchement viendra avec les connecteurs de l'étape 4.
- [ ] Cerveau système : entrée décrivant le moteur, puis `npm run ruflo:seed` après
      validation du JSON.

---

## Ce qui n'est pas dans cette étape

**Le déclenchement.** Rien n'appellera le moteur automatiquement tant qu'aucun
connecteur ne produit de check : c'est l'étape 4 qui le câblera, et le cron viendra avec
elle, gardé par la présence de `pg_cron` comme les autres.

**La file de revue.** Elle est à l'étape 5.
