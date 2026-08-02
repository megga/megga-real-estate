# Audit pré-lancement — STATUT & suivi des correctifs

> Mis à jour : 2026-07-03. Source des findings : [PRE_LAUNCH_AUDIT.md](PRE_LAUNCH_AUDIT.md).
> Ce document est le **tableau de bord vivant** : quel finding est corrigé (PR mergée), en cours, ou à faire.

## Cadre de l'audit
- **Objectif** : préparer le SaaS à un **lancement public** — sécurité, robustesse multi-utilisateurs, perf, absence de bugs.
- **Golden rule** : **aucun changement visuel / UX** dans les PRs de remédiation (l'UX est gérée séparément).
- **Séparation** : les correctifs **code** passent en PR (mergées par l'équipe) ; tout ce qui exige des **tokens admin**
  (migrations Supabase, grants/policies RLS, CI, secrets, Cloudflare) est regroupé dans
  [PRE_LAUNCH_ADMIN_PLAN.md](PRE_LAUNCH_ADMIN_PLAN.md).
- ⚠️ **Drift de bookkeeping des migrations** : ne **jamais** `supabase db push` à l'aveugle (voir Annexe du rapport).

## Ledger des PRs (finding → PR → état)

| Finding | Description | PR | État |
|---------|-------------|----|------|
| S1a | `send-email` relais email ouvert | #774 | ✅ mergée |
| S1b / S22 | JWT `service_role` forgeable (`photo-processor`, `backfill-cf-images`) | #775 | ✅ mergée |
| S1h | SSRF anonyme `c2pa-verify` + helper `safe-fetch` | #776 | ✅ mergée |
| S1c | auth `dashboard-ai-hint` (abus Claude + injection audit cross-tenant) | #777 | ✅ mergée |
| S23 | SSRF authentifié `c2pa-sign` (garde `assertPublicUrl`) | #780 | ✅ mergée |
| S24 | SSRF + injection chemin Storage `virtual-staging` | #781 | ✅ mergée |
| B1 | piste d'audit pipeline (audit en `onSuccess`) | #778 | ✅ mergée |
| S27 | Sentry — scrub token KYC/portail + PII/logs | #779 | ✅ mergée |
| S20 (partiel) | retrait de 6 deps mortes (npm audit) | #782 | ✅ mergée |
| P9 | memo cartes Kanban réactivé | #783 | ✅ mergée |
| S1i / S1j | auth `translate-on-demand` + `speech-to-text` | #784 | 🟢 ouverte ⚠️ *(voir caveat)* |
| B8 | fuite blob URLs preview photos (`ListingFormPage`) | #785 | 🟢 ouverte |

## ⚠️ Caveat sur #784 (à trancher avant merge)
`translate-on-demand` a un en-tête « appelée par la page détail marketplace » (visiteurs **anonymes**). La marketplace
SPA est désactivée dans cette app, mais **si la vitrine `megga.ch` appelle encore cette fonction publiquement**,
`requireAgentAuth` la casserait. → confirmer qu'aucun appelant public ne subsiste ; sinon protéger par
**rate-limit + captcha** plutôt que par auth agent. `speech-to-text` (dictée CRM) n'a pas ce doute.

## Reste à faire — CODE (mineur)
- **P10** — invalidations larges `useProperties.ts:187-190` → cibler (`setQueryData`). *Borderline* : change la
  fraîcheur des données affichées → à valider (pas fait pour respecter la golden rule sans validation).
- ~~**Scrapers coût/DoS** (`flatfox-sync`, `market-scraper`) → **gelé** tant que la PR **#677** n'est pas mergée.~~
  **FAIT (2026-08-02)** — dégelé et appliqué : `patches/09` §C posé sur `flatfox-sync`, `realadvisor-sync`,
  `market-scraper` et `send-visit-email` (S1g et voisins). Le gel a tenu six semaines pendant que quatre endpoints
  d'écriture `service_role` restaient joignables sans aucune authentification ; #677 n'a pas bougé depuis sa création
  le 18 juin. Les gardes sont posées en tête de gestionnaire, loin du mapping d'ingestion que #677 modifie : le
  conflit attendu est trivial et se résout côté #677.
  ⚠️ Deux findings du même patron ont été trouvés en dehors de `patches/09` et corrigés ici : `admin-monitoring` et
  `ai-billing-monitor` décodaient la revendication `role` d'un JWT **sans vérifier la signature** — sous
  `--no-verify-jwt`, un jeton forgé `{"role":"service_role"}` sautait la garde super-admin. Non-régression :
  [tests/backend/edge-service-secret-guard.spec.ts](../tests/backend/edge-service-secret-guard.spec.ts).

## Reste à faire — ADMIN (Julien, tokens) → [PRE_LAUNCH_ADMIN_PLAN.md](PRE_LAUNCH_ADMIN_PLAN.md)
Findings **non couverts par une PR code** car ils touchent le schéma/RLS/CI/secrets :

| Finding | Sévérité | Nature | Patch |
|---------|----------|--------|-------|
| **S13** | **ÉLEVÉ** | `join_agency` = brèche multi-tenant → migration gate invitation | `patches/05` |
| S2 / S10 / S17 | MOYEN‑É | RPC `SECURITY DEFINER` exécutables par `anon` → REVOKE + garde rôle | `patches/06` |
| S12 / S31 | MOYEN | policies `anon` trop larges (tickets/visites) → RPC tokenisées | `patches/07` |
| S30 | MOYEN | tout membre peut changer le plan facturation → trigger garde | `patches/08` |
| S28 | MOYEN | MFA non appliquée (0 policy `aal2`) + gate fail-open | `patches/11` §B |
| S14 | FAIBLE | 7 fonctions à `search_path` mutable | audit §1.4 |
| B5 | MOYEN | échecs silencieux écritures KYC (message d'erreur = UX → Julien) | `patches/04` |
| — | — | Lint bloquant (`deploy.yml` `\|\| true`) après fix des 46 erreurs | `patches/12` §C |
| — | — | Suppression fichiers morts (⚠️ **vérif par fichier** — voir corrections) | `patches/12` §B |

## 🔎 Corrections apportées à l'audit pendant l'implémentation
L'audit initial (généré par exploration multi-agents) contenait des imprécisions **rattrapées en implémentant** —
à connaître pour ne pas les reproduire :

1. **`motion` n'est PAS une dépendance morte** — utilisée via `import … from 'motion/react'` (24 imports). Listée à
   tort comme doublon de `framer-motion`. La retirer casse le build. **Conservée.**
2. **2 « fichiers morts » sont référencés** : `ContactTimeline` (≈ `useContactTimeline`) et `ContactsDetailPane`
   (3 réfs). **Non supprimés.** Toute suppression de fichier mort exige une vérif par fichier (grep sous-chemins + build).
3. **`react-use` / `langsmith`** sont **transitifs** (absents de `package.json`), non retirables directement.
4. **JWT service-role (S1b/S22)** : le fix compare au secret **`app_config.service_role_key`** (ce que pg_cron
   forwarde, pattern des fonctions whatsapp), **pas** à l'env `SUPABASE_SERVICE_ROLE_KEY` (qui pouvait différer et
   casser le pipeline). Repli env conservé. → **valider en staging** qu'un déclenchement cron s'authentifie toujours.
5. **B8** : la fuite blob est à **`ListingFormPage.tsx:1242`** (`useMemo` sans revoke), pas 3020 comme indiqué.
6. **`translate-on-demand`** : conçue **publique** (marketplace) — voir caveat #784.

**Leçon** : chaque cible a été **re-vérifiée réellement** (grep sous-chemins, `deno check`, `npm run build`) avant
action ; ne pas faire confiance aveuglément au rapport d'audit brut.

## Comment continuer (pour Julien / son Claude Code)
1. Merger #784 (après caveat) et #785.
2. Attaquer l'**ADMIN_PLAN** dans l'ordre — **priorité absolue `S13 join_agency`** (brèche multi-tenant ÉLEVÉ non corrigée).
3. Chaque `patches/NN-*.md` contient le before/after ou la migration SQL **proposée** (à relire/tester).
4. Vérifs live possibles en read-only via la Management API (token `SUPABASE_ACCESS_TOKEN`), endpoint
   `/database/query` — SELECT uniquement (voir §« Requêtes de vérification » du rapport).
5. Séquencer A3 (policies anon) et A6 (`aal2` RLS) avec le front / le MFA obligatoire (voir ADMIN_PLAN).
