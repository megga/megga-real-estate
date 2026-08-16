# Audit pré-lancement public — MEGGA Real Estate

> **Statut : EN COURS** · Démarré le 2026-07-02
> **Auteur** : audit assisté (lecture seule). **Application des correctifs : Julien**, au cas par cas.
> **Cadre** : aucune modification de GitHub / Supabase / Cloudflare. Seules des requêtes SELECT/EXPLAIN
> read-only ont été exécutées sur la base live (via Management API, token existant).

## Méthode & légende

Audit en vagues, sécurité d'abord. Chaque finding : `ID · gravité · emplacement · impact · statut · remédiation`.

Statut de vérification :
- ✅ **Confirmé live** — vérifié contre la base de production (requête read-only).
- 📄 **Confirmé source** — vérifié dans le code / migrations (source de vérité du déploiement).
- 🔎 **À vérifier** — hypothèse à confirmer (drift live, test dynamique).
- ⛔ **Requalifié** — finding initial invalidé après vérification.

Gravité : **P0** (bloquant lancement) · **ÉLEVÉ** · **MOYEN** · **FAIBLE** · **INFO**.

---

## Résumé exécutif — bloquants avant lancement public

Priorité de traitement (sécurité). Correctifs = ressort de Julien, au cas par cas.

1. **🔴 P0 — `send-email` = relais email ouvert** (`S1a`). Envoi non authentifié, destinataire + HTML arbitraires
   depuis `noreply@megga.ch`. **Le plus urgent** : risque phishing/spam + destruction de la réputation DKIM/SPF
   du domaine dès l'ouverture publique.
2. **🔴 P0 — JWT `service_role` forgeable** (`photo-processor` + `backfill-cf-images`, `S1b`/`S22`) :
   `decodeJwtRole()` décode le rôle **sans vérifier la signature** ; sous `--no-verify-jwt`, un anonyme forge un
   JWT `{"role":"service_role"}` → bypass total (SSRF + écrasement R2 path-traversal via `photo-processor` ;
   corruption `market_listings` + pivot via `backfill-cf-images`). **Classe de vuln, 2 fonctions.**
3. **🟠 ÉLEVÉ — cluster coût/DoS non authentifié** : `dashboard-ai-hint` (abus Claude + injection audit cross-tenant),
   `market-scraper-batch`/`flatfox-sync`/`realadvisor-sync`/`market-scraper` (DoS + écritures massives service_role).
4. **🟠 ÉLEVÉ — `join_agency(agency_id)` = brèche multi-tenant** (`S13`, ✅ confirmé live) : tout utilisateur
   authentifié peut rejoindre **n'importe quelle agence** (aucun contrôle d'invitation ; le trigger de garde est
   contourné car la RPC tourne en `SECURITY DEFINER` owner `postgres`) → accès CRM complet de la cible (contacts,
   biens, **dossiers KYC**). Contourne le flux d'invitation `accept-team-invite`.
5. **🟠 MOYEN‑ÉLEVÉ — RPC cross-agence `get_agency_stats`/`get_onboarding_milestones`** (`S2`, ✅) : fuite agrégée
   **anonyme**. + **`check_email_exists`** (`S10`, ✅) : énumération de comptes anonyme.
6. **🟡 MOYEN — SSRF authentifié (`c2pa-sign`, `virtual-staging`) + injection chemin Storage, RPC maintenance/cron
   appelables par anon (`S17`), policies anon trop larges (`S12` : tous les tickets support / visites tokenisées),
   abus coût LLM, pollution audit.**
7. **🟡 MOYEN (compliance) — Sentry expose le token `/kyc/:token` + PII (`S27`) ; MFA **non appliquée au niveau
   données** (0 policy `aal2` + gate client fail-open, `S28`) ; tout membre d'agence peut changer le **plan de
   facturation** (`S30`).**

**Décision structurante recommandée (pour Julien)** — **deux postures « ouvertes par défaut » à inverser** :
(a) arrêter de déployer les Edge Functions en `--no-verify-jwt` par défaut et/ou imposer `require-agent-auth`
(ou un secret `safeEqual` pour le cron) sur **chaque** fonction ; (b) **`REVOKE EXECUTE ... FROM public, anon`**
sur les fonctions `SECURITY DEFINER` non publiques (53 exposées à `anon`). Ce sont 2 décisions d'archi transverses,
pas ~20 patchs isolés.

**Bonnes nouvelles** : RLS activée sur toutes les tables applicatives, escalade de rôle `profiles` **verrouillée**
en prod (S3 requalifié), secrets bien côté serveur, webhooks signés, hygiène de code exemplaire.

---

## 1. Sécurité

### 1.1 Findings vérifiés

| ID | Gravité | Statut | Finding | Emplacement |
|----|---------|--------|---------|-------------|
| **S2** | **MOYEN‑ÉLEVÉ** | ✅ Confirmé live | RPC `get_agency_stats(uuid[])` et `get_onboarding_milestones(uuid[])` : `SECURITY DEFINER` (owner postgres, bypass RLS), **EXECUTE accordé à `anon` ET `authenticated`**, **aucune garde de rôle/appartenance** dans le corps. Un appelant **anonyme** (clé anon publique du bundle) peut passer des `agency_id[]` arbitraires et lire les compteurs agents/biens/transactions + milestones d'onboarding + dernière activité de **n'importe quelle agence**. Fuite d'infos agrégées cross-tenant, non authentifiée. | `supabase/migrations/20260526150000_restore_admin_rpcs.sql:17-79` (corps live identique) |
| **S3** | ~~MOYEN~~ | ⛔ Requalifié (INFO) | Escalade de rôle via `profiles.role` : **NON exploitable**. La base live applique 3 couches : trigger `trg_profiles_guard_role_agency` (lève si `role`/`agency_id` change), `role`/`agency_id` **exclus** des colonnes UPDATE accordées à `authenticated` (grant colonne par colonne), policy `profiles_update_own` avec `WITH CHECK` épinglant role+agency. La migration de verrou `20260627120000` **est appliquée** (le bookkeeping la disait « non appliquée » — faux, cf. §Annexe drift). Résidu : `signUp()` `update({role})` = **code mort** à nettoyer. | `src/hooks/useAuth.tsx:288-291` ; `supabase/migrations/20260627120000_profiles_privilege_escalation_lockdown.sql` |
| **S-RLS** | — | ✅ Confirmé live | **Toutes les tables applicatives ont RLS activée.** Seule table sans RLS = `spatial_ref_sys` (table système PostGIS, bénin). | schéma `public` |
| **S4** | MOYEN | 📄 Confirmé source | Audit trail d'impersonation super-admin en fire-and-forget **côté client** (contournable) ; impersonation purement `localStorage`, pas d'échange de token serveur. Un log d'impersonation peut être sauté. | `src/hooks/useImpersonate.ts:29,34-73` |
| **S6** | FAIBLE | 📄 Confirmé source | Sanitizer XSS regex maison contournable (SVG/`data:`/entités) sur aperçu de signature email. Durcir via DOMPurify. Surtout self-XSS (contenu saisi par l'utilisateur lui-même). | `src/components/crm-sugar/settings/ProfileSection.tsx:66-74,222` |
| **S8** | FAIBLE | 📄 Confirmé source | `.gitignore` ne couvre que `*.local` — `.env` / `.env.production` non ignorés (risque de commit accidentel de secrets). | `.gitignore:13,29` |
| **S9** | FAIBLE | 📄 Confirmé source | Insertions anonymes non bornées (`article_feedback`, `article_views`) → spam/flood. | `baseline_remote_schema.sql:6928,6932` |

### 1.2 P0 — Edge Functions `--no-verify-jwt` (audité, 66 fonctions)

**S1 · P0 · 📄 Confirmé source.** Le déploiement met **les 66 fonctions** en `--no-verify-jwt`
(`JWT_PROTECTED=""` → `.github/workflows/deploy.yml:215,225-228`). Aucun filet plateforme : chaque fonction est
joignable non authentifiée depuis Internet ; la seule protection est le code interne. `config.toml` ne liste
que ~10 fonctions en `verify_jwt=false` → **fausse assurance**. **Cause racine transverse** : plusieurs fonctions
confondent « présence d'un header `Bearer` » et authentification. Sous `--no-verify-jwt`, tout contrôle qui ne
valide pas cryptographiquement le token (via `auth.getUser` ou `safeEqual` contre un secret) est **nul**. Le helper
`_shared/require-agent-auth.ts` existe mais n'est pas utilisé par les fonctions vulnérables ci-dessous.

**Expositions confirmées (audit fonction-par-fonction, 25 fonctions inspectées) :**

| ID | Gravité | Fonction | Exploit | Emplacement |
|----|---------|----------|---------|-------------|
| **S1a** | **P0** | `send-email` | **Relais email ouvert non authentifié** : `to` arbitraire + corps **HTML arbitraire** (template `default` avec faux `Bearer`, ou templates publics `contact_*`). Le « contrôle » `startsWith('Bearer ')` **ne valide pas le token**. Spam/phishing depuis `noreply@megga.ch` → réputation DKIM/SPF. | `send-email/index.ts:336-340,414-439` |
| **S1b** | **ÉLEVÉ** | `photo-processor` | Garde service-role **contournable** : `decodeJwtRole()` décode le JWT **sans vérifier la signature** et accepte `role==='service_role'`. JWT forgé `{"role":"service_role"}` passe → **SSRF** (`photoUrls[]` fetchées sans allowlist) + **écrasement R2 arbitraire** (path-traversal sur `listingId` non validé, clé `listings/${listingId}/...`). | `photo-processor/index.ts:61-70,167,210` |
| **S1c** | **ÉLEVÉ** | `dashboard-ai-hint` | Aucune auth → abus de coût **Claude Sonnet** (LLM le plus cher) + **injection cross-tenant** dans `activity_events` (journal de conformité) avec `agency_id` contrôlé par l'attaquant. | `dashboard-ai-hint/index.ts:166-197` |
| **S1d** | **ÉLEVÉ** | `market-scraper-batch` | **Amplificateur DoS** : un appel anonyme déclenche 42 scrapes en cascade (service key propagée). Contient aussi un `count:'exact'` sur `market_listings`. | `market-scraper-batch/index.ts:35-102` |
| **S1e** | **ÉLEVÉ** | `flatfox-sync` | Sync massif service_role (~90k `market_listings`) déclenchable en boucle → DoS/coût egress. | `flatfox-sync/index.ts:745-751` |
| **S1f** | **ÉLEVÉ** | `realadvisor-sync` | Scrapes/sweeps lourds service_role, multi-modes, déclenchables anonymement (kill-switches partiels seulement). | `realadvisor-sync/index.ts:1067-1077` |
| **S1g** | **ÉLEVÉ** | `market-scraper` | Écritures `market_listings`/`market_price_history` + scraping, service_role, sans auth. | `market-scraper/index.ts:56-73` |
| **S1h** | MOYEN | `c2pa-verify` | **SSRF** non authentifiée : `fetch(photoUrl)` arbitraire, sans allowlist/timeout/limite de taille (SSRF aveugle + DoS mémoire). | `c2pa-verify/index.ts:39` |
| **S1i** | MOYEN | `translate-on-demand` | Abus de coût **DeepSeek** (texte arbitraire) + pollution `translation_cache`. | `translate-on-demand/index.ts:40-107` |
| **S1j** | MOYEN | `speech-to-text` | Abus de crédits **Deepgram** (audio arbitraire, sans limite de taille/rate). | `speech-to-text/index.ts:10-45` |
| **S1k** | MOYEN | `log-auth-event` | Pollution/forgerie du journal `auth_events` (anon *by design*, mais **pas de rate-limit**) → empoisonne la détection brute-force/new-device. | `log-auth-event/index.ts:111-163` |
| **S1l** | MOYEN | `send-reminder-email` | Service-role sans auth : force des envois + mute l'état (`reminders`→done, `activity_events`). Recipients DB-bound (blast radius borné par UUID). | `send-reminder-email/index.ts:157-269` |
| **S1m** | MOYEN | `send-visit-email` | Auth « Bearer-prefix » trompeuse non validée ; `confirmation_buyer` public. Recipients DB-bound (nuisance). | `send-visit-email/index.ts:64-67` |
| **S1n** | MOYEN→FAIBLE | `search-alert` | Service-role sans auth mais **auto-throttlé** (`last_alerted_at`) + recipients DB-bound. | `search-alert/index.ts:55-67,158` |
| **S1o** | FAIBLE | `external-matching` | Proxy de scraping RealAdvisor anonyme (URL contrainte à realadvisor.ch, pas de DB/service_role). | `external-matching/index.ts:264-311` |
| **S5** | FAIBLE | `seller-portal-action` | Token DB comparé en clair (`.eq('token', token)`) **mais** haute entropie + **expiration & statut vérifiés** + human-in-the-loop → blast radius minimal. À valider : entropie à la génération de `seller_portals`. | `seller-portal-action/index.ts:78,86,94` |
| **S1p** | FAIBLE | `idx-feed` | Token de feed par agence, read-only, périmètre limité à l'agence. Design légitime. | `idx-feed/index.ts:29-48` |

**Faux positifs du triage (auth correcte — RAS) :** `idx-syndicate`, `learn-agent-style`, `whatsapp-agent`,
`whatsapp-agent-async`, `whatsapp-process` (Bearer `safeEqual` constant-time contre le service_role) ;
`send-property-email`, `send-relance-email`, `whatsapp-send` (`requireAgentAuth` réel).

**S7 · FAIBLE · 📄** CORS `Access-Control-Allow-Origin: *` sur la quasi-totalité des fonctions.

### 1.3 Positifs confirmés (à préserver)

- Garde-fou anti-`service_role` dans le bundle client (`src/lib/supabase.ts:22-47`).
- DEV-bypass neutralisé en prod (`throw` si `import.meta.env.PROD`, `useAuth.tsx:13-15`).
- Webhooks signés : Stripe (`constructEvent`), WhatsApp (HMAC-SHA256 Meta/OpenWA), Intercom (JWT HS256).
- Magic-links KYC vendeur en token HMAC signé + expiration (`_shared/magic-link-token.ts`).
- Aucun secret réel dans `src/` ni dans git. Toutes les tables applicatives sous RLS.
- Config **Auth** solide (✅ confirmé live) : JWT 1 h, rotation refresh, `password_min_length=12` + toutes classes,
  captcha ON, **HIBP/leaked-password ON**, MFA TOTP dispo, ré-auth requise pour changement de mot de passe.
- Buckets **sensibles privés** (✅ live) : `kyc-documents`, `documents`, `signed-documents`, `kyc-magic-link`.
- `admin_set_user_role` gardé par `is_super_admin()` ; `create_agency_and_join` gardé par `auth.uid()` ; les
  fonctions KYC au nom inquiétant (`auto_verify_kyc_dossier`, `log_kyc_screening_decision`) sont des **triggers**
  (non appelables en RPC).

### 1.4 Couche base de données — grants & policies (audit approfondi, ✅ confirmé live)

Advisor sécurité Supabase : **170 lints** (1 ERROR = `spatial_ref_sys`/PostGIS, bénin ; 53 `anon_security_definer_function_executable` ; 81 idem authenticated ; 9 `rls_policy_always_true` ; 7 `function_search_path_mutable` ; 2 `public_bucket_allows_listing` ; 4 `extension_in_public` ; 1 `materialized_view_in_api`).

| ID | Gravité | Statut | Finding | Détail |
|----|---------|--------|---------|--------|
| **S13** | **ÉLEVÉ** | ✅ Confirmé live | `join_agency(uuid)` : brèche multi-tenant. `EXECUTE` accordé à `anon`+`authenticated`, garde interne = `auth.uid()` seul (pas d'invitation). Le trigger `tg_profiles_guard_role_agency` ne bloque que `current_user IN ('authenticated','anon')` → **contourné** car la RPC est `SECURITY DEFINER` owner `postgres`. Un user authentifié rejoint toute agence + `role='agent'` → accès CRM/KYC cible. | RPC `public.join_agency` ; trigger `tg_profiles_guard_role_agency` |
| **S2** | MOYEN‑ÉLEVÉ | ✅ | `get_agency_stats`/`get_onboarding_milestones` exécutables par **anon**, sans garde → fuite agrégée cross-agence. | migr. `20260526150000` |
| **S10** | MOYEN | ✅ | `check_email_exists(text)` exécutable par **anon** → **énumération de comptes** (`SELECT EXISTS FROM auth.users`). | RPC `public.check_email_exists` |
| **S12** | MOYEN | ✅ | Policies `anon` trop larges : `support_tickets.anon_select_own_ticket USING (true)` → lecture de **tous** les tickets ; `visits.anon_select_visit_by_token USING (manage_token IS NOT NULL)` → **toutes** les visites tokenisées (sans connaître le token) ; idem `ticket_events`/`ticket_messages` `USING (true)`. Fuite de données. | `pg_policies` |
| **S17** | MOYEN | ✅ | RPC de maintenance/cron `SECURITY DEFINER` appelables par **anon** : `mark_stale_kyc_dossiers`, `unpublish_expired_mandates`, `purge_expired_import_raw_text`, `cleanup_orphan_property_drafts`, `realadvisor_probe_*`/`realadvisor_sweep_enum`/`realadvisor_health_check`, `accept_followup_suggestion`. Intégrité données + DoS au niveau DB. Cause : `EXECUTE` non révoqué de `public`. | `pg_proc` grants |
| **S14** | FAIBLE | ✅ | 7 fonctions à `search_path` **mutable** (dont `tg_profiles_guard_role_agency`, `esign_touch_updated_at`, `ra_price_status`…) → durcissement `SET search_path` recommandé (vecteur d'escalade sur SECURITY DEFINER). | advisor `function_search_path_mutable` |
| **S15** | FAIBLE | ✅ | Vue matérialisée `cantonal_price_medians` exposée via l'API PostgREST (`materialized_view_in_api`). | advisor |
| **S16** | INFO | ✅ | Extensions dans le schéma `public` : `citext`, `pg_net`, `postgis`, `unaccent` (`pg_net` notable). Best-practice : schéma dédié. | advisor |
| **S18** | INFO | ✅ | Buckets publics **listables** : `property-photos`, `agency-logos` (énumération possible ; par design pour des photos publiques). | `storage.buckets` |
| **S19** | INFO | ✅ | 12 tables RLS activée **sans policy** = deny-all (sécurisé). Vérifier que `favorites`/`listings` ne sont pas des features cassées (pas de policy = inaccessibles hors service_role). | `pg_policies` |

### 1.5 Chaîne d'appro & secrets

| ID | Gravité | Statut | Finding |
|----|---------|--------|---------|
| **S20** | MOYEN | ✅ scanné | `npm audit` = **48 vulnérabilités** (1 critique `protobufjs` ; 9 high : `hono`, `js-cookie`, `undici`, `vite`, `ws`, `form-data`, `langsmith`, `react-use`, `@giphy/react-components`). Plusieurs high sentent la **dépendance morte** (`react-use`, `@giphy`, `langsmith`) → à supprimer ; d'autres transitives/dev (`vite`/`undici`/`ws`). Traiter avant lancement (`npm audit fix` + prune). |
| **S21** | INFO | ✅ scanné | **Aucun secret réel** dans l'historique git (uniquement `.env*.example`) ni hardcodé hors clé anon attendue. Recommandation : ajouter `gitleaks` en CI pour assurance continue. |

### 1.6 Upload & SSRF (audit approfondi)

| ID | Gravité | Statut | Finding | Emplacement |
|----|---------|--------|---------|-------------|
| **S22** | **P0** | 📄 | `backfill-cf-images` : **même** garde JWT forgeable que `photo-processor` (`decodeJwtRole` sans vérif de signature, accepte `role==='service_role'`). Anon → déclenche le batch (coût CF Images/CDN Flatfox) + **corruption `market_listings`** (stamp `photos_cf:[]`, `photos_cf_processed_at=now`) + **pivot vers `photo-processor`** (forward du token forgé). | `backfill-cf-images/index.ts:34-43,70-71,154-187` |
| **S23** | ÉLEVÉ | 📄 | `c2pa-sign` : **SSRF authentifié**. `photoUrls[]` arbitraires **jamais rapprochés** de `property.photos` ; `fetch()` sans allowlist/timeout/blocage IP privée (169.254.169.254, localhost, 10.x). SSRF aveugle (port-scan interne). | `c2pa-sign/index.ts:28,83,132,160` |
| **S24** | ÉLEVÉ | 📄 | `virtual-staging` : **SSRF authentifié** + **injection de chemin Storage** : `style` (typé mais non validé au runtime) interpolé dans `${propertyId}/staged_..._${style}.jpg` avec `upsert:true` → `..`/`/` permet d'**écraser des objets arbitraires** du bucket `property-photos`. | `virtual-staging/index.ts:355,414,501-509` |
| **S25** | MOYEN | 📄 | `send-property-email` : injection HTML e-mail (`photo_url`/`source_url`/`message`/`title` non échappés) vers `to` arbitraire depuis `noreply@megga.ch` (gated agent). | `send-property-email/index.ts:34,45,90,104,151` |
| **S26** | MOYEN | 📄 | `audit-pdf-export` : **injection de filtre PostgREST** — `filters.search` interpolé sans échappement dans `.or('action.ilike...')` (fuite bornée par `.eq('agency_id')` ANDé). | `audit-pdf-export/index.ts:283-287` |

**Requalif** : `translate-on-demand` (`S1i`) → **ÉLEVÉ** (aucune auth + abus DeepSeek + empoisonnement `translation_cache`).

**Patterns de référence (à généraliser)** : `extract-property-url` (allowlist host stricte + timeout 8 s + redirect re-validé),
`property-photo-r2` (photoUrls confinés au préfixe bucket + `keyPrefix` server-side), `magic-link-upload`
(HMAC + `sanitizeFilename` + taille 10 MB + `upsert:false` ; résidu : MIME déclaratif sans magic-bytes, pas de plafond
d'uploads par lien), `extract-property-pdf` (OK).

### 1.7 Sécurité côté client (audit approfondi)

| ID | Gravité | Statut | Finding | Emplacement |
|----|---------|--------|---------|-------------|
| **S27** | MOYEN‑HAUTE | 📄 | **Sentry fuite PII/token** : `sendDefaultPii:true`, Session Replay + `enableLogs` (forwarde les console logs), `tracesSampleRate:1.0`, **aucun `beforeSend`/scrub**. Le token secret de `/kyc/:token` peut partir dans les URLs de traces + fragments de données Supabase dans les logs, vers un tiers (Sentry). | `src/lib/sentry.ts:19,20,27,33` |
| **S28** | MOYEN | ✅ live | **MFA non appliquée au niveau données** : **0 policy RLS n'exige `aal2`** (vérifié live). Gate MFA = rendu purement client (`ProtectedRoute`) et **fail-open** sur erreur (`useMfaGate.ts:56-59` : toute exception → `needsMfa=false`). Un client qui contourne le rendu ou déclenche le fail-open accède aux données KYC avec un JWT aal1. | `useMfaGate.ts:56-59` ; `ProtectedRoute.tsx:46` |
| **S30** | MOYEN | ✅ live | **Tout membre d'agence peut modifier `plan`/facturation** : policy `agencies_members_update` = `id = get_user_agency_id()` sans restriction de rôle ni de colonne → un `agent`/`assistant` change le plan via `savePlanOnAgency`. Intra-agence, mais fraude/abus de facturation. | `agencies_members_update` ; `persistence.ts:245` |
| **S29** | FAIBLE | 📄 | PII de travail en `localStorage` sans purge au logout : brouillons + contacts (`megga.session.relance.v1`), méta-profil (`megga-profile-meta-v1`). Poste partagé. | `relanceData.ts:408-430` ; `useProfileMeta.ts:66` |
| **S31** | FAIBLE | ✅ live | `contacts_anon_onboarding_insert` : with_check = `source='onboarding'` **sans** contrainte d'`agency_id` → un anon peut injecter des leads onboarding dans **n'importe quelle** agence (pollution). | `contacts_anon_onboarding_insert` |

**Résolu / OK (vérifié live)** :
- `useContacts.ts:154` (agency_id client) → **non exploitable** : `contacts_insert` force `agency_id = get_my_agency_id()`. ✅
- RPC `team_set_member_role`/`team_remove_member`/`admin_set_user_role` → **gardes serveur correctes**. ✅
- Session Supabase en localStorage = défaut acceptable ; token KYC **jamais persisté** (URL + `rel=noreferrer`) ;
  aucun `postMessage` ; tous `target=_blank` avec `rel=noopener` ; Intercom allowlist stricte ; PostHog consent-gated
  sans session recording. ✅

---

## 2. Performance & robustesse (📄 confirmé source — à mesurer en Vague 2)

| ID | Gravité | Finding | Emplacement |
|----|---------|---------|-------------|
| **P1** | MOYEN | `count:'exact'` sur `market_listings` (**125 759** rows). ✅ EXPLAIN live : **indexé** (BitmapAnd, coût ~18.7k, ~44k rows comptés) — pas un seq-scan catastrophe, mais `count:'estimated'` serait instantané. | `AdminMonitoringPage.tsx:29` |
| **P2** | MOYEN | `@tanstack/react-virtual` installé mais **0 usage** ; listes Pipeline/Biens/Contacts en `.map()`, hooks `useContacts`/`useProperties`/`useContactsSugar`/`usePipelineSugar` **sans `.limit`/`.range`**. | `src/hooks/*` |
| **P3** | FAIBLE | Join `market_listings(*)` charge colonnes lourdes `description`+`photos` en contexte matches. | `useAtelierMatching.ts:278` ; `useMatching.ts:221` |
| **P4** | FAIBLE | `.toFixed()` sur valeurs de formulaire (risque `NaN`). | `ListingFormPage.tsx:398,403,424` ; `Step1Mandate.tsx:326,474` |
| **P5** | FAIBLE | Formateurs CHF manuels dupliqués contournant `formatCHF` type-defensive (≥8 fichiers). | `crm-sugar/**/helpers.ts`, etc. |
| **P6** | FAIBLE | Un seul Error Boundary racine ; pas d'`onError` global React Query. | `src/App.tsx:618-622,209-224` |
| **P7** | INFO | Memoization quasi nulle (3 `memo`). | pages CRM |
| **P8** | MOYEN | **N+1 sériel + `count:'exact'` en boucle** : par règle d'automation, 3 requêtes `await` séquentielles dont 2 `count:'exact'` sur `reminders` ; relancé à chaque mutation via invalidation `['automation-rules']`. | `useReminders.ts:358-384` |
| **P9** | MOYEN | **`memo` du Kanban défait** : `SugarDealCard` (memo + comparateur sur `onClick`/`onDragStart`) reçoit des **handlers inline recréés** → jamais skippé ; `SugarStageColumn` non mémoïsé → tout le board recompute à chaque survol pendant le drag. | `SugarStageColumn.tsx:118-129` ; `PipelinePage.tsx:138,449-463` |
| **P10** | MOYEN | **Invalidations larges** : `updateProperty` invalide `['agency-properties']`/`['agency-listings']`/`['listings']` (listes entières `select('*')`) à chaque édition → refetch massif. Modèle ciblé à généraliser (`useKyc`/`useOffers` invalidant par id = bon). | `useProperties.ts:187-190` |

**Confirmés OK** : Realtime `useId()` 5/5 channels, `.in()` jamais sur `market_listings`, états
loading/empty/error présents, code-splitting agressif (101 `lazy()`), cascades pipeline/contacts/matching
**batchées** (`.in('id',...)`, pas de N+1), invalidations KYC/offers ciblées par id.

---

## 3. Qualité de code & outillage (📄 confirmé source)

| ID | Gravité | Finding | Emplacement |
|----|---------|---------|-------------|
| **Q1** | MOYEN | Couverture tests **frontend quasi nulle** (0 test co-localisé). Trous critiques : **MFA/auth = 0 test** (`MfaModals.tsx` 1447 LOC), KYC wizard/guards UI non testés (e2e = smoke « la page monte »), gros formulaires (`ListingFormPage`, `NewDealDrawer`, `KycWizardModal`) sans test unitaire. Backend/RLS bien couvert (72 specs). | `tests/`, CI |
| **Q2** | MOYEN | **Lint non-bloquant au deploy** (`lint \|\| true`) masquant **46 erreurs** réparties sur **5 règles** / ~12 fichiers (27 `react-refresh/only-export-components`, 13 `react-hooks/static-components` dans 1 fichier, 3 whitespace auto-fixables, 2 `react-hooks/refs`, 1 tooling). **Aucune erreur de type** → lint bloquant réaliste en 1 passe. + 28 `set-state-in-effect` / 15 `react-hooks/purity` (vrais red flags render). | `.github/workflows/deploy.yml:60` |
| **Q3** | FAIBLE | Pas de Prettier ; pas de budget de bundle (`index` ~452 KB). | `vite.config.ts`, `package.json` |
| **Q4** | FAIBLE | **~9 dépendances mortes** (0 import `src/`) : `react-use`, `@giphy/react-components`+`js-fetch-api`, `langsmith`, `motion` (doublon `framer-motion`), `emoji-mart`×3, `cmdk`, `@stripe/stripe-js` (front). Suppression = quick-win + réduit les 48 vulns. | `package.json` |
| **Q6** | FAIBLE | **Fichiers/dossiers morts** (0 réf) à supprimer : `NetworkSugarV2Page.tsx` (**2314 LOC**, route neutralisée) + `crm-sugar/network/data.ts`, `crm/ContactTimeline.tsx`, `crm-sugar/SugarContactDetail.tsx`, `contacts/ContactsDetailPane.tsx`. | divers |
| **Q5** | INFO | Fichiers >1000 LOC actifs à refactorer : `ListingFormPage.tsx` (3131, prioritaire car actif + 0 test), `SecuritySection` (1636), `ImportLead` (1596), `AgencySection` (1499), `MfaModals` (1447), `NewDealDrawer` (1373), `KycWizardModal` (1283). Nomenclature `SugarV2/V3/V4` incohérente (dette cognitive). | pages/composants |

**Confirmés OK** : 0 `console.log`, 0 `@ts-ignore`, 2 `any`, tsconfig strict, CI mature (~123 fichiers de test).

---

## 4. Bugs de correction (chasse ciblée — Pipeline / ListingForm / KYC / Matching)

| ID | Gravité | Bug | Emplacement |
|----|---------|-----|-------------|
| **B1** | ÉLEVÉ (compliance) | Piste d'audit faussée : `logAudit.mutate('Étape changée')` émis **inconditionnellement** après `applyDrop`, même si la mutation de stade échoue (overlay reverté) → `activity_event` trace un déplacement annulé ; en succès, **double log** possible (client + trigger DB `trg_transaction_lifecycle`). | `PipelinePage.tsx:147-157` |
| **B2** | ÉLEVÉ (données) | Ordre des photos corrompu : `uploadPendingPhotos` renvoie `[...existingUrls, ...newUrls]` → l'ordre inter-classé arrangé au drag-drop (dnd-kit) est **perdu** à la sauvegarde (photo hero / galerie ≠ UI). | `ListingFormPage.tsx:2481-2486,1276-1304` |
| **B3** | MOYEN | Deal dupliqué : lookup `from('transactions')` **sans capture d'`error`** → sur erreur, `existing=null` → crée un **nouveau deal** alors qu'un actif existe peut-être. | `useAtelierMatching.ts:475-483` |
| **B4** | MOYEN | Écriture multi-étapes **sans transaction/rollback** : `execSendDossier` met le match à `sent` puis crée deal/timeline/reminder ; échec ultérieur → match `sent` orphelin, état non ré-entrant. | `useAtelierMatching.ts:467-539` |
| **B5** | MOYEN (compliance) | Échecs **silencieux** sur écritures LBA : `handleMarkVerified`/`confirmMarkAll` sans `onError` → l'agent croit avoir validé un contrôle (attestation LBA art. 9) alors que l'écriture a échoué. | `KycDossierDetail.tsx:240,265-268` |
| **B6** | FAIBLE-MOYEN (UX) | Course overlay optimiste : `onSettled` retire `pendingStage` avant que le refetch async n'ait rendu `liveDeals` → la carte **flashe** dans l'ancienne colonne puis re-avance. | `PipelinePage.tsx:124-131` ; `useTransactions.ts:162-165` |
| **B7** | FAIBLE-MOYEN | Contact orphelin : `createContact` réussit puis `createTransaction` échoue → contact créé sans rollback/cleanup ; retry recrée un contact. | `NewDealDrawer.tsx:203-241` |
| **B8** | FAIBLE | Fuite mémoire : `URL.createObjectURL(pendingFiles[0])` **inline dans le render**, jamais `revokeObjectURL` → un blob URL par render. | `ListingFormPage.tsx:3020` |
| **B9** | FAIBLE (latent) | `value ?? min` ne protège pas contre `NaN` (`NaN ?? min === NaN`) → stepper figé / `"NaN"` affiché / persisté. Pas de chemin d'entrée NaN actuel. | `ListingFormPage.tsx:398,403,424` |
| **B10** | FAIBLE (défensif) | `m.commission.toFixed(1)` sans garde → crash si `mandate` hydraté sans `commission` (import externe). Chemin sûr aujourd'hui (défaut 3.5). | `Step1Mandate.tsx:326,474` |

**Gates métier à confirmer** :
- **KYC « tout marquer vérifié »** (`KycDossierDetail.tsx:244`) : `canMarkAll` ne vérifie que sanctions/PEP ; un contrôle non requis compte comme fait → attestation LBA art. 9 possible sans id/adresse/fonds réellement complétés. **Vérifier que `markAll` côté serveur exige les 5 contrôles.**
- **Gate LBA publication** (`ListingFormPage.tsx:2616-2625`) : en création, `existingProperty=undefined` → mandat toujours vu non signé ; edge case « mandat signé sur draft auto-save » non couvert. À valider.

**Non-bugs vérifiés** (anti-faux-positifs) : registry avatars hydraté (`registerLiveContact`), `formatCHF/Rent(Number(...))` type-defensive, `lat.toFixed` gardé, KYC wizard anti-double-submit OK, `PendingRegistry` idempotent.

---

## Annexe — Drift bookkeeping migrations

La table `supabase_migrations.schema_migrations` est fortement désynchronisée du dossier local (93 « local-only »,
39 « remote-only »). **Preuve d'écart** : `20260627120000` (verrou anti-escalade) apparaît « non appliquée » au
bookkeeping alors qu'elle **est bien active en prod** (trigger + policy + grants vérifiés live). ⇒ **Ne jamais se
fier au bookkeeping** ; ne **jamais** lancer `supabase db push` sur cette base sans réconciliation délibérée
(risque de rejouer 93 migrations sur la prod). Réconciliation = ressort de Julien.

## Requêtes de vérification (read-only, rejouables)

Exécutées via `POST https://api.supabase.com/v1/projects/eayczugyrvmtqnnmvjod/database/query` (Bearer access-token) :
- Trigger garde role : `select tgname from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal;`
- Grants colonne : `select column_name from information_schema.column_privileges where table_name='profiles' and privilege_type='UPDATE' and grantee='authenticated';`
- Policies UPDATE profiles : `select polname, pg_get_expr(polqual,polrelid), pg_get_expr(polwithcheck,polrelid) from pg_policy where polrelid='public.profiles'::regclass;`
- Grants RPC : `select p.proname, r.rolname from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where p.proname in ('get_agency_stats','get_onboarding_milestones') and a.privilege_type='EXECUTE';`
- Tables sans RLS : `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;`
