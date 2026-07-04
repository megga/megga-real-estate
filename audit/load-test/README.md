# Test de charge — « milliers d'utilisateurs simultanés »

Harness [k6](https://k6.io) pour valider la tenue en charge du CRM agent **avant le lancement public**.
Complète l'analyse statique de l'audit (qui ne mesure PAS le comportement réel sous concurrence).

## ⚠️ Règles de sécurité
- **STAGING UNIQUEMENT.** Le script refuse de démarrer si `BASE_URL` pointe sur la prod (`eayczugyrvmtqnnmvjod`).
  Idéalement, cloner la prod dans un projet Supabase de test avec un **volume réaliste** (grosse agence = milliers de contacts).
- **Lectures seules.** Aucune écriture, aucune edge function IA (coût LLM/Deepgram/Anthropic réel). Pour tester les
  écritures/edge functions, écrire des scénarios dédiés sur un projet jetable et budgété.
- Prévenir avant de lancer un profil `stress`/`soak` (charge soutenue → connexions pooler, quotas).

## Prérequis
1. Installer k6 : `brew install k6` (macOS) — voir k6.io/docs.
2. Un **projet staging** Supabase avec données réalistes.
3. Un **agent de test** sur staging → récupérer son `access_token` (JWT) et l'`anon key` staging.

## Lancer
```bash
BASE_URL="https://<staging-ref>.supabase.co" \
ANON_KEY="<staging anon key>" \
AGENT_JWT="<access_token agent de test>" \
PROFILE=load \
k6 run audit/load-test/k6-crm-reads.js
```

Profils (`PROFILE=`) :
| Profil | Charge | Usage |
|--------|--------|-------|
| `smoke` (défaut) | 5 VUs / 30s | vérifier que le script marche |
| `load` | montée à 500 VUs | charge nominale attendue |
| `stress` | 500 → 1000 → 2000 VUs | trouver le point de rupture (« milliers ») |
| `soak` | 300 VUs / 30 min | fuites / dégradation dans le temps |

## Interpréter
- **SLO proposés** (à ajuster) : `http_req_duration p95 < 800ms`, `crm_errors < 1%`. k6 échoue si les seuils sont dépassés.
- Regarder par endpoint (`tags name=`) quel appel dégrade en premier — souvent les **listes non plafonnées**
  (`contacts`/`properties` sans pagination) ou les **RPC analytics** (`statement_timeout`).
- **Corréler côté Supabase** pendant le run : connexions actives (pooler Supavisor), `pg_stat_statements`
  (slow queries), CPU/IO du plan Pro, erreurs `57014` (statement timeout).

## Points de rupture attendus (hypothèses de l'audit à confirmer)
1. **Épuisement des connexions** si le pooler n'est pas en mode *transaction* → passer Supavisor en transaction.
2. **Listes non bornées** (`useContacts`/`useProperties` sans `limit`/pagination, 0 virtualisation) → latence qui
   explose pour une grosse agence. Cf. findings **P2 / P10**.
3. **`count:'exact'`** résiduels (P1/P8) → seq scans sous charge. Passer en `estimated`.
4. **Edge functions cold starts** — non couvert ici (lectures REST) ; tester séparément si des edge functions sont
   sur le chemin critique.

## Après le test
Reporter les résultats dans [../LAUNCH_READINESS.md](../LAUNCH_READINESS.md) §1 (SLO tenus ? points de rupture ?
actions correctives). Les correctifs de scale (pagination, `estimated`, pooler) redeviennent des PRs / migrations.
