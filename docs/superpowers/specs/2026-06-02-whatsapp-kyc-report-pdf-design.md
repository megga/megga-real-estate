# Rapport KYC en PDF par WhatsApp — Pipeline (design)

> **Statut :** spec prête. À reprendre dans une conversation FRAÎCHE (consulter le cerveau : `npx ruflo memory search -q "rapport KYC PDF whatsapp" -n megga`) → `writing-plans` puis exécution.
> **Pré-requis déjà livrés (en prod) :** KYC par WhatsApp Phase 1 (`open_kyc_case` / `attach_kyc_document` / `run_kyc_screening`, PR #537) ; copilote WhatsApp bilingue FR/EN ; rapport PDF CRM existant.
> **Réf. cerveau :** `megga/kyc-report-pdf-whatsapp`, `megga/kyc-whatsapp-spec`, `megga/edge-audit-export`.

## But

Quand l'agent demande son rapport KYC depuis WhatsApp (« envoie-moi le rapport KYC de Dubois »), MEGGA génère le **PDF officiel** (identique à celui du CRM) et l'envoie **en pièce jointe WhatsApp**. Sert les objectifs 1 (réduire l'admin) et 4 (transparence).

## Le rapport existant — à RÉUTILISER, pas reconstruire

Le rapport KYC est un **PDF rendu côté FRONTEND, factuel (sans IA)** :
- Route CRM : **`/dashboard/kyc/:dossierId/export`** → `src/pages/agent/KycExportPage.tsx`.
- Rendu : `PdfPage1/2/3` (`src/components/kyc-report/`) à partir de `buildReportData.ts`, qui transforme `kyc_cases + documents + activity_events` en view-model. **Commentaire explicite : « ZÉRO mention IA / Sonnet : volontaire »** — c'est le rapport LBA pour FINMA, factuel. L'analyse Sonnet (`kyc_cases.ai_analysis`) reste un assist INTERNE, hors du PDF officiel.
- Génération : **`window.print()`** (impression native navigateur, styles `@page A4` + `@media print`). **Pas de PDF stocké, pas de librairie PDF, pas de rendu serveur** (« plus simple, plus léger », dixit le code).

➡️ **Conséquence :** il n'existe AUCUN artefact PDF à récupérer. Pour le joindre dans WhatsApp, il faut le **générer côté serveur** — un edge function (Deno) ne peut pas « imprimer » comme un navigateur.

## Architecture proposée (Option A — Cloudflare Browser Rendering)

Rendre le **template React existant** en headless → PDF (DRY : un seul template, PDF WhatsApp = PDF CRM, zéro divergence), puis l'envoyer en document WhatsApp. **4 composants :**

1. **Route de rendu tokenisée** (réutilise l'HMAC `_shared/magic-link-token.ts`). Le navigateur headless n'a pas de session agent → il faut une route chargeable sans login :
   - Nouvelle route publique **`/kyc-report/:token`** qui rend `PdfPage1/2/3` à partir de données fournies par une **edge function `kyc-report-data`** (service-role) validant le token. Le token encode `{ dossier_id, agency_id, expiry court ~5 min }` (signé via `signMagicLinkToken`). Données scopées agence côté serveur (jamais le body).
   - *(Alternative : réutiliser `KycExportPage` avec un mode `?token=` — voir Q1.)*

2. **Worker Cloudflare Browser Rendering** (`@cloudflare/puppeteer`, binding Browser Rendering — l'app est déjà sur Cloudflare). Charge l'URL tokenisée, attend le 1ᵉʳ paint des fontes (le CRM attend 800 ms), `page.pdf({ format: 'A4', printBackground: true })` → buffer PDF. Réutilise les styles `@page/@media print` existants.

3. **Envoi de document WhatsApp (NOUVEAU)**. Aujourd'hui seul `buildSendTextRequest` existe (`whatsapp-gateway.ts`) — MEGGA n'envoie que du texte.
   - Ajouter **`buildSendDocumentRequest`** au provider Meta (message type `document`, avec un média).
   - Héberger le PDF pour Meta : **upload média Meta** (media id, éphémère) OU **URL signée Supabase storage** que Meta récupère (voir Q2).
   - **Fenêtre 24 h Meta** : l'agent ayant écrit à MEGGA, la fenêtre est ouverte → document envoyable sans template approuvé.

4. **Outil copilote `send_kyc_report`** (catalogue `whatsapp-tools.ts` + exécuteur `whatsapp-actions.ts`).
   - « envoie-moi le rapport KYC de X » → résout le contact (`search_contacts`) → trouve le dossier (`findOpenKycCase`, déjà livré) → mint token → appelle le Worker (HTTP, clé service-à-service comme `run_kyc_screening`) → récupère le PDF → l'envoie en **document à l'agent** (son propre numéro) → audit `activity_events`.
   - Restitution texte (langue de l'agent, via le module i18n existant) : « Voici le rapport KYC de X — PDF joint. »
   - Tier : **auto** (rapport à l'agent lui-même, aucun contact client) — voir Q3.

## Réutilise vs nouveau

**Réutilisé :** `KycExportPage` + `PdfPage1/2/3` + `buildReportData` (le template, intact) · `signMagicLinkToken`/`verifyMagicLinkToken` (HMAC) · données `kyc_cases` · infra outils WhatsApp (`toolTier`/`runTool`/`whatsapp-actions`) · `findOpenKycCase` · module i18n FR/EN (`whatsapp-i18n.ts`) · `sendWhatsAppText` (texte d'accompagnement) · buckets storage privés · pattern auth service-à-service (cf. `run_kyc_screening`/`kyc-screening`).

**Nouveau :** route `/kyc-report/:token` + edge `kyc-report-data` (données par token, scopées agence) · Worker Cloudflare Browser Rendering (+ binding wrangler) · `buildSendDocumentRequest` (document Meta) + l'envoi média · outil `send_kyc_report` + son exécuteur · 1 entrée `TOOL_TIERS`.

## Sécurité / compliance

- **Token court (~5 min) + scopé** `{ dossier_id, agency_id }` ; l'edge `kyc-report-data` valide le token (service-role) et **scope l'agence au SQL** (jamais cross-agency) ; aucune session agent exposée au headless.
- **Le PDF = rapport officiel factuel (sans IA)**, identique au CRM (un seul template → DRY, pas de divergence). Ne PAS injecter l'analyse Sonnet dans le PDF (cohérent avec `buildReportData`).
- **Document envoyé UNIQUEMENT au numéro de l'agent** (fenêtre 24 h), jamais à un client sans validation humaine (règle persona/MEGGA).
- **PDF = données KYC sensibles** → si hébergé en storage, **URL signée courte + bucket privé** ; idéalement **upload média Meta éphémère** (pas de stockage durable). Lié à Q2.
- **Audit** : `activity_events` (`actor_kind='ai'`, `actor_id` NULL, `action='kyc_report_sent'`, `category='kyc'`, `metadata.profile_id`).
- **Règle d'or préservée** : générer/envoyer un rapport ne touche NI `dossier_status` NI `is_completed` (lecture seule du dossier).

## Périmètre / phasage

- **Phase 1 (cible)** : l'agent demande SON rapport par WhatsApp → PDF joint à lui-même.
- **Hors scope** : envoi du rapport à un CLIENT par WhatsApp (nécessiterait templates Meta approuvés + validation, même contrainte que la collecte client KYC Phase 2).

## Questions à trancher (conversation fraîche, avec Gregory)

1. **Route de rendu :** nouvelle route dédiée tokenisée `/kyc-report/:token` *(reco : isolée du dashboard authentifié, plus propre)* OU réutiliser `/dashboard/kyc/:id/export` en mode `?token=` ?
2. **Hébergement du PDF pour Meta :** upload média Meta éphémère *(reco : pas de stockage durable d'un PDF sensible)* OU URL signée Supabase storage ? **Et : archive-t-on le PDF envoyé dans `documents` (rétention 10 ans, preuve d'envoi pour l'audit) ?**
3. **Tier de `send_kyc_report` :** `auto` *(reco)* ou `confirm` ?
4. **Cloudflare Browser Rendering :** confirmer plan/coût/limites CF (le binding nécessite un Worker + plan adéquat). Fallback si indispo : service HTML→PDF externe, ou **Option B** (`pdf-lib` en edge — duplique le template, fidélité moindre) ?
5. **Contenu :** le PDF WhatsApp = strictement le rapport officiel factuel (sans IA), identique au CRM *(reco oui)* ? Veut-on une 1ʳᵉ page « résumé » adaptée mobile ?
6. **Déclencheur :** rapport générable à tout stade du dossier *(reco)* ou seulement si screené / complété ?

## Tests + compliance

- Token (pur + backend RLS) : validité / expiry / scope agence (HMAC).
- Worker : rendu d'un dossier connu → PDF non vide, A4, 3 pages.
- `send_kyc_report` : résolution dossier, tier `auto`, document envoyé à l'agent, audit `activity_events`.
- Vérifier : **aucune fuite cross-agency** (token + edge data scopent l'agence) ; pas de PDF sensible en URL publique non signée ; pas d'IA dans le PDF ; règle d'or intacte (aucune écriture `verified`/`is_completed`).
- Coût : 1 rendu CF Browser Rendering + 1 envoi Meta par rapport — surveiller (pattern `ai-billing-monitor`).

---

*Spec rédigée le 2 juin 2026, grounded sur le code live (`KycExportPage`, `buildReportData`, `whatsapp-gateway`, `magic-link-token`). Prochaine étape : `writing-plans` (découpe : token+edge data → Worker CF → envoi document Meta → outil → tests) dans une conversation fraîche.*
