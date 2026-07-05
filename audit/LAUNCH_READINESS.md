# 🚀 Launch Readiness — checklist go-live public

> Mis à jour : 2026-07-04. Checklist priorisée pour l'ouverture publique de MEGGA.
> Statuts : ✅ fait · 🟡 en cours / à valider · ⬜ à faire · 🔴 **bloquant**.
> Responsables : **Admin** (Julien — tokens Supabase/Cloudflare, migrations, secrets) · **Dev** · **Legal** (Gregory/juriste) · **Ops**.
> Complément : [STATUS.md](STATUS.md) (findings→PR) · [PRE_LAUNCH_ADMIN_PLAN.md](PRE_LAUNCH_ADMIN_PLAN.md) (migrations).

---

## 0. 🔴 Bloquants absolus (NE PAS ouvrir sans)

| # | Item | Resp. | État | Réf. |
|---|------|-------|------|------|
| 0.1 | **Appliquer la migration `join_agency`** (gate invitation) — **brèche multi-tenant confirmée LIVE le 2026-07-04** (anon/authenticated peuvent rejoindre n'importe quelle agence → accès CRM/KYC) | Admin | 🔴 à faire | `patches/05` |
| 0.2 | Migration **grants SECDEF** : `REVOKE anon` sur RPC maintenance + `get_agency_stats`/`get_onboarding_milestones` (anon-exécutables confirmé live) + `check_email_exists` | Admin | 🔴 à faire | `patches/06` |
| 0.3 | Migration **policies anon** (`support_tickets`/`visits` `USING(true)` → RPC tokenisées) + insert onboarding borné | Admin | 🔴 à faire | `patches/07` |
| 0.4 | Migration **billing** (trigger : seuls admin/manager changent `plan`/`billing`) | Admin | 🔴 à faire | `patches/08` |
| 0.5 | **Valider en staging** les edge-functions auth mergées (cron `backfill`/`photo-processor` s'authentifient toujours ; front `dashboard-ai-hint` OK) | Dev+Admin | 🟡 | #775, #777 |
| 0.6 | Trancher le **caveat `translate-on-demand`** (la vitrine l'appelle-t-elle publiquement ?) → sinon rate-limit+captcha | Admin | 🟡 | #784 |
| 0.7 | **Réconcilier le bookkeeping des migrations** (drift : `db push` interdit à l'aveugle) | Admin | 🔴 à faire | audit §Annexe |

## 1. 🟠 Robustesse à l'échelle (« milliers d'utilisateurs simultanés »)

> ⚠️ Audit **statique** fait ; **aucun test de charge réel** encore. C'est le prochain livrable (voir `audit/load-test/`).

| # | Item | Resp. | État |
|---|------|-------|------|
| 1.1 | **Test de charge k6 sur staging** (pipeline/contacts/matching/KYC + edge functions) — définir SLO p95 & taux d'erreur | Dev | ⬜ à faire (script fourni) |
| 1.2 | **Pooler Supabase** (Supavisor mode *transaction*) + limites de connexions du plan Pro vérifiées | Admin | ⬜ |
| 1.3 | `statement_timeout` cohérent + revue des **slow queries** (`pg_stat_statements`) sous charge | Admin | ⬜ |
| 1.4 | **Listes non plafonnées** (`useContacts`/`useProperties` sans `limit`, 0 virtualisation) testées avec une **grosse agence** (milliers de contacts) ; sinon pagination/virtualisation | Dev | ⬜ (P2/P10) |
| 1.5 | Reste des `count:'exact'` → `estimated` (P1 AdminMonitoring, P8 useReminders) | Dev | ⬜ |
| 1.6 | **Realtime** : plafond de connexions concurrentes du plan vérifié ; channels `useId()` OK ✅ | Admin | 🟡 |
| 1.7 | **Cloudflare** : cache des assets statiques, headers, cold starts edge functions mesurés | Admin | ⬜ |
| 1.8 | Index DB sur requêtes fréquentes (partial indexes market_listings ✅ ; index « contacts dormants » via #649) | Admin | 🟡 |

## 2. 🟡 Observabilité & Ops

| # | Item | Resp. | État |
|---|------|-------|------|
| 2.1 | Sentry **scrub token KYC** ✅ (#779) — configurer **alerting** (taux d'erreur, latence, quota) | Ops | 🟡 |
| 2.2 | **Uptime monitoring** externe (app + Supabase + edge functions) + statut public | Ops | ⬜ |
| 2.3 | Dashboards : erreurs, latences edge functions, `pg_stat`, quotas IA (`ai-billing-monitor` existe) | Ops | ⬜ |
| 2.4 | **Runbook incident** + astreinte (qui, quoi, escalade) pour le jour J | Ops | ⬜ |
| 2.5 | Vérifier `0 console.log` en prod ✅ ; logs edge functions structurés | Dev | ✅ |

## 3. 🟡 Abus / rate-limiting / DDoS

| # | Item | Resp. | État |
|---|------|-------|------|
| 3.1 | **Cloudflare WAF + rate-limiting** sur endpoints publics (formulaire contact, `send-email` public, magic-links, `seller-portal`, webhooks) | Admin | ⬜ |
| 3.2 | **Captcha** sur formulaires publics (contact, signup) — captcha Auth activé ✅, à étendre | Admin | 🟡 |
| 3.3 | Rate-limit applicatif sur edge functions IA restantes (déjà auth via #784) | Dev | 🟡 |
| 3.4 | CORS `*` sur edge functions : acceptable (auth par Bearer/token) mais à revoir pour les webhooks | Dev | ⬜ |

## 4. 🟡 Compliance suisse (LPD/nLPD + LAB/KYC)

| # | Item | Resp. | État |
|---|------|-------|------|
| 4.1 | **Data residency** : Supabase `eu-west-1` (Irlande) — données immo/KYC suisses hors CH → validation juridique | Legal | ⬜ |
| 4.2 | **Rétention KYC** (triggers `enforce_kyc_*_retention`) conforme aux durées légales LAB (art. 7) | Legal | 🟡 |
| 4.3 | **DPA** avec sous-traitants : Supabase, Resend, Stripe, Deepgram, Anthropic, DeepSeek, Cloudflare, Intercom, PostHog | Legal | ⬜ |
| 4.4 | Mentions légales, CGU/CGV, politique de confidentialité, **cookie consent** (PostHog consent-gated ✅) | Legal | 🟡 |
| 4.5 | **MFA obligatoire** pour agents (compliance) **avant** d'exiger `aal2` en RLS (S28) — séquencer | Admin | ⬜ |
| 4.6 | Registre des traitements (nLPD art. 12) | Legal | ⬜ |

## 5. 🟢 DR / backups / rollback

| # | Item | Resp. | État |
|---|------|-------|------|
| 5.1 | **PITR** Supabase activé (plan Pro) + **test de restauration** réel | Admin | ⬜ |
| 5.2 | Plan de **rollback deploy** (Cloudflare Pages + edge functions + migrations) documenté | Admin | ⬜ |
| 5.3 | Rotation des secrets prévue ; aucun secret dans git ✅ | Admin | 🟡 |

## 6. 🟢 Process go-live

| # | Item | Resp. | État |
|---|------|-------|------|
| 6.1 | **Soft launch / canary** (feature flags existants) — ouvrir progressivement | Ops | ⬜ |
| 6.2 | **Runbook go-live** (ordre : migrations → smoke tests → monitoring renforcé → ouverture) | Ops | ⬜ |
| 6.3 | Lint bloquant en CI (après fix des 46 erreurs) + tests frontend critiques (MFA/KYC) | Dev | ⬜ (`patches/12`) |
| 6.4 | Communication (support prêt, FAQ, canal incident) | Ops | ⬜ |

---

## Ordre d'exécution recommandé
1. **Section 0** (bloquants) — surtout `join_agency` + les migrations, en staging d'abord, puis prod.
2. **Section 1** — test de charge k6 sur staging (le vrai juge du « milliers de simultanés »).
3. **Sections 2–4** en parallèle (ops, abus, compliance).
4. **Section 5–6** — DR + process, puis **soft launch canary** avant l'ouverture large.
