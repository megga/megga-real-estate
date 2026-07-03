# Plan « tokens admin » — à exécuter par Julien (Supabase / Cloudflare / CI / secrets)

> Regroupe les changements de remédiation qui **ne passent pas par une simple PR code** : ils modifient le schéma
> DB (migrations), les grants/policies RLS, le pipeline CI/CD, ou des secrets. À appliquer avec les accès admin
> Supabase/Cloudflare. Détails et SQL complets : `docs/audits/patches/` (05-08, 11B). Contexte : `PRE_LAUNCH_AUDIT.md`.

## ⚠️ Précaution migrations — drift de bookkeeping
La table `supabase_migrations.schema_migrations` est désynchronisée (des migrations appliquées apparaissent
« non appliquées », ex. `20260627120000`). **Ne pas lancer `supabase db push`** (rejouerait des migrations sur la
prod). Le CI applique les migrations via la Management API (voir `deploy.yml`, commentaire l.83-88) — utiliser ce
chemin, ou appliquer chaque migration manuellement après revue. Réconcilier le bookkeeping séparément
(`supabase migration repair --status applied <version>`) si besoin.

## A. Migrations SQL (schéma / RLS / grants) — ordre recommandé

| # | Migration proposée | Finding | Patch |
|---|---|---|---|
| A1 | `join_agency` : gate invitation `team_invitations` + revoke anon | S13 (ÉLEVÉ) | `patches/05` |
| A2 | Verrou grants `SECURITY DEFINER` : revoke anon sur RPC maintenance + garde `is_super_admin` sur `get_agency_stats`/`get_onboarding_milestones` + revoke `check_email_exists` anon | S2/S10/S17 | `patches/06` |
| A3 | Resserrer policies anon (`support_tickets`/`visits`/`ticket_*` `USING(true)`) → RPC tokenisées ; borne `contacts_anon_onboarding_insert` | S12/S31 | `patches/07` |
| A4 | Trigger garde colonnes billing sur `agencies` | S30 | `patches/08` |
| A5 | `set search_path` sur les 7 fonctions à search_path mutable | S14 | audit §1.4 |
| A6 | Exiger `aal2` en RLS sur tables KYC (après MFA obligatoire à l'onboarding) | S28 | `patches/11` §B2 |

**Séquencement A3/A6** : A3 et A6 peuvent casser des flux publics/agents s'ils sont livrés seuls.
- A3 : livrer les RPC tokenisées **et** le front qui les appelle (PR code) **avant** de retirer les policies anon.
- A6 : rendre le MFA obligatoire à l'onboarding **avant** d'exiger `aal2`, sinon les agents sans TOTP perdent l'accès KYC.

## B. CI / CD (`.github/workflows/deploy.yml`) — coordination avec les PRs code

| # | Changement | Finding | Note |
|---|---|---|---|
| B1 | **Auth edge functions** : les PRs code ajoutent `requireAgentAuth`/`requireServiceSecret` sur chaque fonction. Une fois **toutes** déployées, ajouter un filet CI (`scripts/check-edge-auth.sh`) qui échoue si une fonction n'a aucune garde. | S1 (P0) | Déployer le code AVANT de resserrer. Le `--no-verify-jwt` peut rester si chaque fonction s'authentifie ; sinon, basculer une allowlist `JWT_PROTECTED`. |
| B2 | **Lint bloquant** : retirer `\|\| true` de `npm run lint` (l.60) **après** le merge de la PR `chore/lint-fixes` (46 erreurs corrigées). | Q2 | Sans la PR de fixes d'abord, le deploy casserait. |

## C. Secrets Supabase (Edge Functions)

| Secret | Usage | Action |
|---|---|---|
| `CONTACT_NOTIFICATION_TO` | Destinataire forcé de `contact_notification_admin` (patch `send-email`) | Créer (sinon fallback `contact@megga.ch` dans le code). |
| `app_config.service_role_key` | Comparaison constant-time des fonctions cron (patch 02/09) | **Vérifier qu'il est présent** et égal au token forwardé par pg_cron (déjà utilisé par les fonctions whatsapp). |

## D. Cloudflare / R2
- Rien de bloquant identifié. `property-photos`/`agency-logos` publics + listables (S18) = par design ; si l'énumération
  gêne, désactiver le listing du bucket. Buckets KYC/documents déjà privés (OK).

## E. Dépendances (peut être une PR code, listé ici pour visibilité)
`npm audit` = 48 vulns (1 critique `protobufjs`, 9 high). La PR `chore/deps-cleanup` retire ~9 deps mortes ; il
restera à traiter `protobufjs`/`hono`/`undici` (transitives) — arbitrage `npm audit fix` / overrides (peut nécessiter
un bump de deps → revue).

## Résumé de séquencement conseillé
1. **PRs code sécurité** (edge auth, SSRF, send-email, B1) — mergées/déployées.
2. **A1, A2, A4, A5** (migrations sans dépendance front).
3. **PR code RPC tokenisées** + **A3** (policies anon) ensemble.
4. **PR lint-fixes** puis **B2** (lint bloquant).
5. **MFA obligatoire onboarding** (PR code) puis **A6** (aal2 RLS).
6. Secrets **C** en amont des déploiements concernés.
