# Plan d'assainissement du CRM — environnement sain

> Handoff pour session dédiée (rédigé 17 juin 2026). À exécuter via la **méthode des 3 vagues**
> (cerveau ruflo `megga/methode-algo-vagues` : comprendre → concevoir → implémenter + revue
> adversariale + tests live → entretenir le cerveau ; orchestration Workflow ; qualité = discipline
> de vérification). **BUT : un environnement SAIN** — pas une feature de plus. On assainit : on tue
> les « faux done », les bugs silencieux, le code mort, et on câble/rend visible ce qui existe déjà.
> Source = audit CRM en éventail (5 lecteurs, ancré code + DB live) du 17 juin 2026.

## Constat fondateur (vérifié)
Le CRM est **bien plus câblé-réel** que ne le disait le cerveau (le « 11/14 » est périmé ; ~18 surfaces
agent, la plupart Supabase). Le vrai blocage n'est PAS le code mais le **désert de données** : l'agence
réelle `ebec0ad9` (« MEGGA Immobilier GE 3 ») a 7 contacts, 6 biens, **0 transaction**, 0 visite, 0 offre,
1 mandat, 2695 matches **tous `suggested` / 0 envoyé** ; les 4 seules transactions sont dans l'agence
DÉMO Rockwell, figées à `lead`. Donc tout le comportemental (sous-scores réactivité/engagement, vélocité
par étape, recalibrage, funnel de réaction) est **DATA-GATED → NE PAS coder**, ça attend l'usage. Ce
plan ne touche QUE ce qui est réparable sans usage.

## Méthode / garde-fous (« fait correctement »)
- Ancrer chaque item au code (fichier:ligne) / DB live **avant** de toucher — l'audit peut avoir vieilli ; re-vérifier.
- Edge functions Deno = **non type-checkées** par `npm run build` ni vitest-unit → prouver via import dans un spec `tests/backend/` + **`BEGIN/ROLLBACK` live** contre la prod (rien persisté) ; `deno` absent localement.
- Contrat `activity_events` (le cleanup en touche) : `actor_kind ∈ {user,ai,system}` (jamais `agent`), `category ∈ {kyc,deal,contact,bien,doc,auth,settings,ai}` (jamais `signature`/`messaging`), cohérence `actor_id non-null ⇒ actor_kind='user'`. Un insert invalide **échoue silencieusement** (classe des bugs #666/#667).
- Crons : fix de `cron.job` = `ALTER` via migration (timestamp **14 chiffres**, vérifier libre) ; verrou facturation GitHub → souvent appliqué à la main via MCP `apply_migration` (idempotent).
- ⚠ Le **classifieur de sécurité gate les déploiements prod** (edge functions, changements cron) : prévoir une **autorisation explicite** du user pour ces déploiements (ne pas contourner).
- DeepSeek-only (jamais Claude sans accord) ; KYC non-bloquant ; HITL ; **0 PII nouvelle** ; `npm run build` vert ; revue adversariale (3 lentilles ou 1 agent selon taille) sur tout non-trivial ; tests backend **LIVE** en CI quand une table/RPC est touchée ; lire les exit codes **à la source** (pas via pipe) ; subagents → forcer `cd <worktree>` ; **PR par vague, pas de merge sans accord** ; cerveau MAJ à la fin.

---

## Vague 0 — Comprendre (re-cadrage)
Un workflow de lecteurs : re-vérifier chaque item ci-dessous contre le code/DB **actuels**, trancher les
décisions produit ouvertes (kill vs wire : `ai_actions_queue`, edge functions hors-tree, `automation_rules`,
Réseau inter-agences, aiInsights/Parcours équipe). Sortie = liste figée + périmètre par vague.

## Vague 1 — Sécurité & « faux done » (le cœur de « sain », d'abord)
1. **Bouton « Réinitialiser MFA » = no-op** — `src/components/admin/UserDrawer.tsx:269` (TODO). Le super-admin croit révoquer le 2FA, rien ne se passe. → brancher la révocation TOTP (Supabase Auth Admin API) ou retirer le bouton.
2. **2 crons morts** — `cron.job` #17 `ai-billing-hourly` + #18 `cf-images-backfill` : utilisent `current_setting('app.settings.supabase_url')` (GUC mort) au lieu de `get_app_config()`. cf-images = photos jamais migrées Cloudflare (perf galerie) ; ai-billing = zéro surveillance coût IA. → migration `ALTER` cron.command → `get_app_config('supabase_url')`.
3. **Cron `platform-metrics-hourly` (#11)** — JWT service_role legacy **en clair inline** dans `cron.command` → bombe à la rotation + secret exposé. → `get_app_config('service_role_key')`.
4. **Soumissions vendeurs — autoChecks compliance FACTICES** — `src/hooks/useBnSubmissions.ts:77-99` (esp. :94-99) : addressMatch / duplicates / cantonalRegistry affichés **`'ok'` en dur** sur une surface compliance → viole la règle anti-fabrication. → brancher les vrais checks OU marquer « non vérifié ».
5. **Inserts fire-and-forget qui avalent les erreurs** — `.then(()=>{})` dans `useSellerLead`, `useExternalMatching` (dont un `activity_events`) = la mécanique qui a caché le bug d'audit #666/#667. → garde d'erreur (au moins `console.error`).

## Vague 3 — Rendre visible & câbler (ROI immédiat, coût déjà payé)
*(Exécutée avant la V2 : plus de valeur, moins de risque.)*
6. **Surfacer le score de contact** (le plus haut ROI) — `calculate_contact_scores` calcule déjà **11 scores en prod** (RPC + cron) mais **aucune UI ne les lit**, alors que le score de bien l'est (asymétrie). → `useContactScores` (calque `usePropertyScores`) + pastille fiche/liste (calque `BnScoreBadge`), estimation + paliers. Backend 100% fait.
7. **Câblage WhatsApp→contact qui n'écrit pas** — `source='whatsapp'=0`, outbound `contact_id` NULL, `last_interaction_at` 2/12 ; 126 messages n'enrichissent ni fiche, ni timeline, ni sourcing. Le back-link #660 est inbound-only sur `contacts.phone` → investiguer le chemin outbound / le champ source. Réparable sans usage.
8. **En-tête « Aujourd'hui » hardcodé** — `src/components/crm-sugar/today/data.ts:58-59` (`agent.name='Gregory'`, `date='Dimanche 14 juin'`) ; rendu `PageAujourdhui.tsx:133-134`. → `useAuth().profile.full_name` + `new Date()` (i18n FR dispo). Premier écran de chaque session.
9. **Settings Notifications/Preferences non persistés** (0 hit supabase, toggles perdus au reload) + **autocomplete adresse agence mock** (`AgencySection.tsx:505-513`, cible swisstopo). → persister ; brancher ou retirer l'autocomplete.

## Vague 2 — Purge du code mort / dette
10. **Edge functions marketplace orphelines** (depuis le pivot) : `buyer-init-thread, parse-search-query, ai-search, public-staging, deepgram-token` — déployées, facturables, inatteignables ; le health-check les ping encore (`src/hooks/useAdminMonitoring.ts:37/40`) = faux signal. → retirer + purger le roster.
11. **Edge functions déployées HORS source-tree** (drift) : `gmail-sync, outlook-mail-sync` (buildées depuis /tmp), `email-classifier, support-chatbot, ticket-ai-reply`, `score-engine` (doublon MORT du scoring SQL). → versionner dans le repo OU supprimer du projet Supabase (décision produit).
12. **`ai_actions_queue`** (table + types, 0 ligne, 0 lecteur) → brancher à une surface agent OU supprimer (trancher reminders vs queue).
13. **`automation_rules` = 0 règle** → branche auto-send relance = code mort. → seed 1 règle par défaut SÛRE (HITL) OU retirer/assumer non livrée.

## Vague 4 — Honnêteté UI (mock surfacé comme réel)
14. **Réseau inter-agences** (`NetworkSugarV2Page`, 100% mock, `network/data.ts`, 3/5 vues « Coming soon », 0 table/RLS) = le plus gros écart UI-promet/backend-absent. POUR LA SANTÉ : **étiqueter « aperçu non livré »** (cheap). Le build réel (tables `agency_partners`/`shared_listings` + RLS cross-agence + templates) = **gros chantier séparé**, hors « santé ».
15. **aiInsights calendrier = `[]`** (`CalendarPage.tsx:482`) + **Parcours équipe mock** (`useParcoursSugar.ts:6` `PARCOURS_TEAM` + fallback `t-greg`, RBAC non câblé) → câbler OU retirer la promesse vide.

## Vague 5 — Entretenir le cerveau
Corriger les nœuds périmés (le « 11/14 », `project_today_refonte` « données démo » = FAUX, Calendar « HOT_BUYERS mock » = FAUX, claims Réseau). Marquer l'assainissement fait + ce qui reste data-gated. `npm run ruflo:seed`.

---

## Hors périmètre (chantiers séparés, après)
- **Estimation de prix / CMA** sur les ~34 700 `market_listings` — le **seul gros algo métier manquant**, indépendant du désert (fondation = vue `cantonal_price_medians`). À faire **après** l'assainissement.
- Couche comportementale v2 (sous-scores, vélocité, recalibrage) : data-gated.
- Build réel du Réseau inter-agences (gros, décision MVP).

**Ordre conseillé :** V0 → V1 → V3 → V2 → V4 → V5.
