# Audit Persona — Super-Admin / "MEGGA Platform Operator"

**Date :** 16 avril 2026
**Persona :** Admin SaaS supervisant la plateforme MEGGA (rôle `super_admin`)
**Environnement :** http://localhost:5175 (DEV_BYPASS_AUTH=true, role=super_admin)
**Outillage :** Playwright Chromium headless, viewport 1440×900, locale fr-CH
**Script :** `scripts/audit-admin.mjs`
**Rapport machine :** `docs/audits/2026-04-16-simulation/admin/report.json`

---

## Persona summary

Je suis l'opérateur MEGGA. Mon job : surveiller la santé de la plateforme, détecter les dossiers KYC à risque, modérer les annonces du marketplace, traiter les tickets support, configurer les feature flags et plans, valider les changelogs avant déploiement et garder un œil sur le NPS. Je commence par `/dashboard` puis je fonce sur `/dashboard/admin` (vue d'ensemble) avant de tourner sur les 12 autres pages.

**Verdict global :** La PR de l'admin existe et 14 pages sont câblées dans le router (`App.tsx` lignes 242-255), MAIS un bug bloquant dans `useAdminNotifications.ts` empêche le rendu de TOUTES les pages admin en sessions consécutives (re-mount StrictMode → `.on()` après `.subscribe()`). Visuellement, les pages `/dashboard/admin/*` rendent **un écran blanc** dès la 2e navigation. Statique : code propre, design system respecté (admin-accent partout), aucun mock data, hooks Supabase réels.

---

## Journey log

| # | Étape | URL | OK | Captures | Notes |
|---|-------|-----|----|----------|-------|
| 01 | Home (gate) | `/` | OK | `01-home-home.png` | Hero "Trouvez votre bien. Partout en Suisse." rendu, gate `gg` traversée. |
| 02 | Redirect dashboard | `/dashboard` | OK | `02-dashboard-redirect-dashboard.png` | Sidebar **agent** (Aujourd'hui, Pipeline, Contacts...) — pas de menu admin visible alors que role=super_admin. Spinner persistant côté contenu. |
| 03 | Admin Dashboard | `/dashboard/admin` | OK (route) | `03-admin-dashboard-admin-dashboard.png` | **ÉCRAN BLANC TOTAL.** PageError React : `cannot add postgres_changes callbacks for realtime:admin-notifications after subscribe()`. |
| 04 | Admin Agencies | `/dashboard/admin/agencies` | OK (route) | `04-admin-agencies-admin-agencies.png` | Écran blanc. Même PageError. |
| 05 | Admin Agency Detail | `/dashboard/admin/agencies/:id` | SKIP | – | Aucune agence dans la liste (parce que la liste précédente n'a pas pu render). |
| 06 | Admin Users | `/dashboard/admin/users` | OK (route) | `06-admin-users-admin-users.png` | Écran blanc. Drawer non testé. |
| 07 | Monitoring | `/dashboard/admin/monitoring` | OK (route) | `07-admin-monitoring-admin-monitoring.png` | Blanc. |
| 08 | Marketplace | `/dashboard/admin/marketplace` | OK (route) | `08-admin-marketplace-admin-marketplace.png` | Blanc. |
| 09 | Compliance | `/dashboard/admin/compliance` | OK (route) | `09-admin-compliance-admin-compliance.png` | Blanc. |
| 10 | Support | `/dashboard/admin/support` | OK (route) | `10-admin-support-admin-support.png` | Blanc. |
| 11 | Live Feed | `/dashboard/admin/live` | OK (route) | `11-admin-live-admin-live.png` | Blanc. |
| 12 | Changelog | `/dashboard/admin/changelog` | OK (route) | `12-admin-changelog-admin-changelog.png` | Blanc. |
| 13 | Feature Flags | `/dashboard/admin/feature-flags` | OK (route) | `13-admin-feature-flags-admin-feature-flags.png` | Blanc. |
| 14 | Plans | `/dashboard/admin/plans` | OK (route) | `14-admin-plans-admin-plans.png` | Blanc. |
| 15 | Security Audit | `/dashboard/admin/security` | OK (route) | `15-admin-security-admin-security.png` | Blanc. |
| 16 | NPS | `/dashboard/admin/nps` | OK (route) | `16-admin-nps-admin-nps.png` | Blanc. |
| 17 | Sidebar nav | `/dashboard/admin` | OK (route) | `17-sidebar-nav-sidebar.png` | `aside a` retourne 0 items — sidebar admin ne se monte jamais (composant crashe avant). |
| 18 | Lang switch | x4 | OK (route) | `18-lang-switch-lang-{de,en,it,fr}.png` | Toutes les langues affichent un écran blanc — bug en amont, pas de chance de tester l'i18n côté admin. |

---

## Bugs

| Sév | ID | Page | Description | Fichier:Ligne | Fix proposé |
|-----|----|------|-------------|---------------|-------------|
| 🔴 CRITIQUE | A1 | TOUTES les pages admin | `cannot add postgres_changes callbacks for realtime:admin-notifications after subscribe()` — la subscription Realtime du panneau de notifications fait crasher l'arbre React entier, donc **chaque page admin rend du blanc**. Provoqué par useEffect re-run en dev StrictMode + nom de channel fixe partagé (`admin-notifications`). | `src/hooks/useAdminNotifications.ts:42-54` | Donner un nom unique au channel (`admin-notifications-${useId()}`) ou recréer le client Supabase channel à chaque mount, ou retourner sans subscribe si déjà existante. Aussi : envelopper le `.on()` avant `.subscribe()` et garder la référence. Ne pas utiliser le même channel name dans toute l'app. |
| 🔴 CRITIQUE | A2 | `/dashboard` | Sidebar **agent** affichée pour un super_admin. Aucun lien "Admin" dans la sidebar — l'opérateur n'a aucun moyen de découvrir les pages `/dashboard/admin/*` autrement qu'en tapant l'URL. | Sidebar dashboard | Ajouter une section "Plateforme" visible si `profile.role === 'super_admin'` avec liens vers les 13 pages admin. |
| 🟠 HIGH | A3 | `/dashboard/admin/agencies/:id` | Route non testable — pas d'agence visible côté UI. Si la liste est vide en prod, la page detail est inaccessible. | `AdminAgenciesPage.tsx` | Ajouter empty state CTA "Créer la première agence" + seed de démo pour DEV_BYPASS. |
| 🟡 MEDIUM | A4 | Tous | 535 erreurs console `ERR_CERT_AUTHORITY_INVALID` sur les requêtes Supabase Pro depuis Playwright headless. Empêche tout chargement de données dans l'audit. | Cert HTTPS Supabase | Pour audits Playwright : `chromium.launch({ args: ['--ignore-certificate-errors'] })` ou contexte `ignoreHTTPSErrors: true`. |
| 🟡 MEDIUM | A5 | Lang switch | Le sélecteur i18n côté admin n'est pas testable parce que tout est blanc. | – | Bloqué par A1. |

---

## UX frictions

- **Découvrabilité** : un super_admin connecté arrive sur le dashboard agent. Pas d'indication "Tu es admin". Pas de badge violet visible. Pas de lien sidebar. Friction immédiate.
- **Pas de breadcrumb visible** entre `/dashboard/admin/agencies` et `/dashboard/admin/agencies/:id` (à valider une fois A1 corrigé).
- **Pas de fil de notifications visible** sur le screenshot du dashboard — composant `AdminNotificationPanel` semble être la cause du crash. Le retirer désactive le crash mais perd la fonction.

---

## Static findings (par page)

| Fichier | Design system | Mock data | i18n | Loading/Empty | Notes |
|---------|---------------|-----------|------|----------------|-------|
| `AdminDashboardPage.tsx` | OK — `bg-admin-accent`, dark mode classes | NON | `useTranslation('admin')` | `kpisLoading`, `alertsLoading` | KPIs + alertes + Health Pulse. Câblé `useAdminStats`. |
| `AdminAgenciesPage.tsx` | OK | NON | OK | OK (10) | Câblé `useAdminAgencies`. |
| `AdminAgencyDetailPage.tsx` | OK | NON | OK | OK (16) | 5 onglets (Overview, Users, Listings, KYC, Billing). |
| `AdminUsersPage.tsx` | OK (admin-accent ×7) | NON | OK | OK (11) | Câblé `useAdminUsers`. Drawer (`UserDrawer.tsx`). |
| `AdminMonitoringPage.tsx` | OK | NON | OK | OK (7) | Câblé `useAdminMonitoring` (Edge Function `admin-monitoring`). |
| `AdminMarketplacePage.tsx` | OK | NON | OK | OK (12) | Modération avec `ModerationActionDialog`. |
| `AdminCompliancePage.tsx` | OK | NON | OK | OK (16) | KYC cross-agences via `useAdminCompliance`. |
| `AdminSupportPage.tsx` | OK | NON | OK | OK (16) | Tickets + suggestion IA réponses (`ticket-ai-reply`). |
| `AdminLiveFeedPage.tsx` | OK | NON | OK | OK (5) | Realtime + auto-scroll. |
| `AdminChangelogPage.tsx` | OK | NON | OK | OK (4) | Release notes éditables. |
| `AdminFeatureFlagsPage.tsx` | OK | NON | NON (pas de useTranslation détecté en haut du fichier — à vérifier) | OK (3) | Toggles par plan. |
| `AdminPlansPage.tsx` | OK | NON | OK | OK (4) | Plans & quotas. |
| `AdminSecurityAuditPage.tsx` | OK | NON | OK | OK (9) | Listing audit RLS. |
| `AdminNpsPage.tsx` | OK | NON | OK | OK (7) | Stats satisfaction. |

**Conformité design system :** PASS — aucune occurrence de `bg-white`, `text-gray-9*`, `border-gray-2*`, `bg-gray-5*` dans les 14 fichiers. L'accent violet (`admin-accent`) est utilisé dans les 14 pages (76 occurrences au total). Aucune référence à `MOCK_`, `mockData`, `TODO`, `FIXME`. Tous les hooks `useAdmin*` interrogent réellement Supabase.

**Hooks Supabase réels** : `useAdminStats` (7 from), `useAdminMonitoring` (6 from), `useAdminSupport` (13 from), `useAdminCompliance` (6 from), `useAdminModeration` (4), `useAdminSearch` (3), `useAdminAgencies`, `useAdminUsers`. Aucune donnée hardcodée détectée.

---

## Top 5 console errors

1. `Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID` — **535×** — toutes les requêtes Supabase échouent depuis Playwright headless (cert non trusté). Bug d'audit, pas de prod.
2. *(unique pageError)* `cannot add postgres_changes callbacks for realtime:admin-notifications after subscribe()` — **propagé sur 13 pages** — voir bug A1.

(Pas de 3-5 : un seul type de console error, un seul type de page error.)

---

## Test data created

**Aucune.** L'audit est read-only. Pas d'impersonate déclenchée. Pas de toggle de feature flag. Pas de modération d'annonce. Pas de réponse à un ticket. Pas de modification des plans, du changelog ou du NPS. Pas de drag/resize de widgets effectué (page jamais rendue).

---

## Admin pages status

| Page | Route | Renders OK | Mock vs Real data | i18n OK | Dark mode OK | Notes |
|------|-------|------------|-------------------|---------|--------------|-------|
| Dashboard | `/dashboard/admin` | ❌ blanc | Real (`useAdminStats`) | OK (`admin` ns) | OK | Crash A1. |
| Agencies | `/dashboard/admin/agencies` | ❌ blanc | Real (`useAdminAgencies`) | OK | OK | Crash A1. |
| Agency Detail | `/dashboard/admin/agencies/:id` | ⚠️ skipped | Real | OK | OK | Pas testée (liste vide). |
| Users | `/dashboard/admin/users` | ❌ blanc | Real (`useAdminUsers`) | OK | OK | Crash A1. |
| Monitoring | `/dashboard/admin/monitoring` | ❌ blanc | Real (Edge Function) | OK | OK | Crash A1. |
| Marketplace | `/dashboard/admin/marketplace` | ❌ blanc | Real (`useAdminModeration`) | OK | OK | Crash A1. |
| Compliance | `/dashboard/admin/compliance` | ❌ blanc | Real (`useAdminCompliance`) | OK | OK | Crash A1. |
| Support | `/dashboard/admin/support` | ❌ blanc | Real (`useAdminSupport`) | OK | OK | Crash A1. |
| Live Feed | `/dashboard/admin/live` | ❌ blanc | Real (`useAdminLiveFeed`) | OK | OK | Crash A1. |
| Changelog | `/dashboard/admin/changelog` | ❌ blanc | Real | OK | OK | Crash A1. |
| Feature Flags | `/dashboard/admin/feature-flags` | ❌ blanc | Real | À vérifier (pas de `useTranslation` au top) | OK | Crash A1. |
| Plans | `/dashboard/admin/plans` | ❌ blanc | Real | OK | OK | Crash A1. |
| Security Audit | `/dashboard/admin/security` | ❌ blanc | Real | OK | OK | Crash A1. |
| NPS | `/dashboard/admin/nps` | ❌ blanc | Real (`useAdminNps`) | OK | OK | Crash A1. |

**0 / 14 pages réellement rendues** dans Playwright headless à cause de A1 + A4.
**14 / 14 pages déclarées dans le router et codées proprement** côté statique.

---

## Recommandations

1. **Fix A1 immédiat** — bloquant produit, pas seulement audit. Le bug touche n'importe quel utilisateur super_admin qui visite plus d'une page admin dans la même session (StrictMode dev OU navigation client-side qui re-mount le composant).
2. **Fix A2** — exposer un menu admin dans la sidebar quand `profile.role === 'super_admin'`. Sinon, fonctionnalité indécouvrable.
3. **Re-run l'audit** avec `ignoreHTTPSErrors: true` dans `audit-helper.mjs` une fois A1 corrigé pour valider le rendu réel des 14 pages, l'i18n et le dark mode.
4. **Ajouter un test e2e Playwright qui visite les 14 pages admin** dans la CI pour empêcher la régression.
