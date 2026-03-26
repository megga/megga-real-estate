# CLAUDE.md — MEGGA Real Estate

> Ce fichier est la source de vérité pour Claude Code. Lis-le en entier avant de coder quoi que ce soit.
> 
> **Document de référence stratégique :** DOCUMENT_MAITRE_PROJET_SAAS_REAL_ESTATE_SUISSE (v1.0)
> Ce CLAUDE.md est aligné sur le Document Maître Produit. En cas de doute stratégique (scope, priorité, positionnement), le Document Maître fait autorité.

---

## 1. PROJET

**Nom :** MEGGA Real Estate
**Type :** SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (toute la Suisse, pas juste la Suisse romande)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend, pas de compétences backend — Claude Code gère tout)

**Vision :** Le système d'exploitation des transactions immobilières suisses à haute conformité — pas un simple portail d'annonces avec un chatbot, mais une **plateforme SaaS verticale, AI-native, compliance-first**, orientée exécution des transactions immobilières suisses. CRM transactionnel verticalisé + pipeline transaction LAB/KYC + portail vendeur + copilote IA métier + marketplace publique (phase ultérieure).

**En une phrase (Gregory Lyonnet) :** "Le courtier ne doit plus perdre du temps à chercher, relancer, rédiger, organiser et suivre manuellement."

**Document de référence stratégique :** Le **Document Maître Produit** (DOCUMENT_MAITRE_PROJET_SAAS_REAL_ESTATE_SUISSE_AI-NATIVE_COMPLIANCE-FIRST) est la source de vérité stratégique. Toute nouvelle fonctionnalité doit répondre à au moins un de ces 5 objectifs : réduire le temps administratif, réduire le risque LAB/KYC, accélérer le closing, augmenter la transparence client, ou remplacer un outil fragmenté. Si elle n'en sert aucun — elle est hors scope MVP.

**Positionnement stratégique :**
- Le différenciateur principal n'est PAS "l'IA". C'est l'intégration native de la conformité transactionnelle suisse + l'automatisation opérationnelle + l'IA contextuelle métier.
- L'IA est une couche d'orchestration, d'assistance et d'accélération — pas le produit.
- Formule : System of record + workflow engine + rules engine + AI copilot. PAS : LLM + UI + promesses vagues.
- Le produit est compliance-enabling, PAS compliance-replacing. Validation humaine obligatoire pour décisions sensibles.

**Ordre stratégique d'expansion :**
1. Transaction résidentielle (MVP — on est ici)
2. Transaction premium / off-market
3. Multi-agences / groupes
4. Deal room / partenaires
5. Gérance / PPE
6. Marketplace publique / data network / benchmarks

**Ce projet est SÉPARÉ de MEGGA (clones IA).** Repo différent, Supabase différent, design system différent.

---

## 2. STACK TECHNIQUE

```
Frontend :     React 18+ / TypeScript / Vite / Tailwind CSS 3
UI Kit :       shadcn/ui + Radix UI
State :        React Query (TanStack Query) pour le server state
Routing :      React Router v6
Forms :        React Hook Form + Zod
Drag & Drop :  dnd-kit (pipeline Kanban)
Maps :         Mapbox GL JS (react-map-gl)
Icons :        Lucide React
Charts :       Recharts
Date :         date-fns
i18n :         react-i18next + i18next (FR/DE/EN/IT — installé, sélecteur dans Paramètres > Profil)

Backend :      Supabase Pro
               - PostgreSQL 15+
               - Edge Functions (Deno/TypeScript)
               - Auth (email + magic link + OAuth Google)
               - Storage (photos listings, documents KYC)
               - Realtime (messaging, notifications, matching alerts)
               - pgvector (embeddings listings pour recherche IA)
               - pg_cron (tâches automatiques : relances, reminders, surveillance)

IA :           Anthropic Claude API (Sonnet 4) via Edge Functions
               ✅ MEGGA AI copilote connecté (Edge Function ai-copilot)
               - Copilote métier temps réel (résumés, suggestions, rédaction, KYC)
               - Recherche conversationnelle (RAG + pgvector) — Phase 2
               - Scoring leads, buyer intelligence, seller intelligence — Phase 2
               - Matching intelligent acheteurs ↔ biens — Phase 2 (enrichissement IA)
               - Copilote de négociation — Phase 2
               - Génération d'annonces multi-versions — Phase 2
               - Analyse d'objections post-visite — Phase 2

Marché :       RealAdvisor (realadvisor.ch) — BASE DE DONNÉES MARCHÉ SUISSE
               ✅ API JSON découverte : /api/listings?offerType_eq=buy&salePrice_gte=X&salePrice_lte=Y
               - 43'000+ biens à vendre dans toute la Suisse
               - Pas de pagination (offset ignoré), MAIS filtre prix fonctionne
               - Stratégie : tranches de prix fines → 36 résultats uniques par tranche
               - ~620 tranches = ~10'000+ biens uniques ingérés
               - Photos via CDN img.realadvisor.ch (pas d'upload R2 nécessaire)
               - Edge Function market-scraper : 1 tranche par appel
               - Edge Function market-scraper-batch : orchestre toutes les tranches (~3 min)
               - Table market_listings (permanente) + market_price_history (tracker prix)
               - Matching engine enrichi : matches aussi contre market_listings
               - Page publique Acheter connectée (usePublicListings hook)
               ⚠️ IMPORTANT — Secrets API :
               - L'API /api/listings est NON documentée et sans CAPTCHA
               - Tous les autres portails (Homegate, ImmoScout24, Comparis) ont Cloudflare/Datadome
               - Le endpoint /fr/search?page=N retourne 403 depuis Edge Functions (marche uniquement dans un vrai navigateur)
               - Garder un délai 2-4s entre les requêtes, pas plus de 1 scan/jour

Matching ext : RealAdvisor (realadvisor.ch) via Edge Function external-matching
               - Ancien système : parse RSC flight data (React Server Components)
               - Cache 1h dans table external_listings
               - 3 niveaux : fiche MEGGA, enrichi (10 photos, stats), Full CRM (import, notes, comparaison)
               - ⚠️ RSC parsing ne retourne que ~3-24 listings par page (limité)

Scraping :     Scripts Node.js (scrape-paginated, scrape-delta, scrape-extra)
               ✅ 38'514 biens en DB (table market_listings, 26 cantons)
               - scrape-paginated.mjs : scraping complet par tranches de prix (590 tranches)
               - scrape-delta.mjs : mise à jour quotidienne (50 tranches, ~3 min)
               - scrape-extra.mjs : stratégies complémentaires (propertyType, rooms, sort variations)
               - Contrôle qualité automatique : quality_score 0-100 + quality_flags
               - Biens suspects (score < 50) masqués automatiquement

Email :        Resend (transactionnel + relances automatiques)
               ✅ Domaine megga.ch configuré (DKIM + SPF vérifiés)
               - Edge Function send-email avec template HTML MEGGA
               - From : noreply@megga.ch
Payments :     Stripe (abonnements agents)
Analytics :    PostHog
Hosting :      Cloudflare Pages (PAS Vercel — gratuit, pas de surprise billing)
CI/CD :        GitHub Actions → Cloudflare Pages auto-deploy

Voice (Phase 2) : Speech-to-text (Whisper API ou Deepgram)
                   Text-to-speech (ElevenLabs ou équivalent)
```

### Commandes de base

```bash
npm run dev          # Démarre le serveur local sur localhost:5173
npm run build        # Build production
npm run lint         # ESLint + TypeScript check
npm run preview      # Preview du build
```

---

## 3. STRUCTURE DU PROJET

```
megga-real-estate/
├── CLAUDE.md                    # CE FICHIER — lis-le en premier
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.local                   # SUPABASE_URL + SUPABASE_ANON_KEY
├── public/
│   ├── megga-logo.svg           # Logo MEGGA complet
│   └── megga-gg.svg             # Icône GG seul
├── src/
│   ├── main.tsx                 # Point d'entrée
│   ├── App.tsx                  # Router principal
│   ├── lib/
│   │   ├── supabase.ts          # Client Supabase initialisé
│   │   ├── constants.ts         # Couleurs, config, enums
│   │   └── utils.ts             # Helpers (cn, formatCHF, formatDate...)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useListings.ts
│   │   ├── useContacts.ts
│   │   ├── useTransactions.ts
│   │   ├── useMatching.ts       # Matching acheteurs ↔ biens
│   │   ├── useReminders.ts      # Relances et reminders
│   │   ├── useActionBoard.ts    # Actions du jour
│   │   └── use[Module].ts
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components (Button, Input, Card...)
│   │   ├── layout/
│   │   │   ├── Navbar.tsx       # Navigation publique
│   │   │   ├── Sidebar.tsx      # Navigation agent (dashboard)
│   │   │   ├── Footer.tsx
│   │   │   └── PageLayout.tsx
│   │   ├── listings/
│   │   │   ├── ListingCard.tsx
│   │   │   ├── ListingGrid.tsx
│   │   │   ├── ListingDetail.tsx
│   │   │   └── ListingForm.tsx
│   │   ├── search/
│   │   │   ├── SearchBar.tsx    # Barre de recherche IA principale
│   │   │   ├── SearchResults.tsx
│   │   │   └── ChatSearch.tsx   # Interface conversationnelle
│   │   ├── map/
│   │   │   └── MapView.tsx
│   │   ├── crm/
│   │   │   ├── ContactList.tsx
│   │   │   ├── ContactCard.tsx
│   │   │   ├── ContactDetail.tsx    # Fiche contact enrichie (timeline unifiée)
│   │   │   ├── ContactTimeline.tsx  # Timeline unique : appels, emails, WhatsApp, visites, notes
│   │   │   ├── PipelineKanban.tsx
│   │   │   └── DealCard.tsx
│   │   ├── matching/
│   │   │   ├── MatchingPanel.tsx    # Panel de suggestions matching IA
│   │   │   ├── MatchScoreCard.tsx   # Card avec score de compatibilité
│   │   │   └── MatchActions.tsx     # Actions rapides : envoyer, planifier visite
│   │   ├── automation/
│   │   │   ├── ReminderList.tsx     # Liste des relances à faire
│   │   │   ├── ReminderConfig.tsx   # Configuration relances auto
│   │   │   └── AutomationRules.tsx  # Règles d'automatisation
│   │   ├── action-board/
│   │   │   ├── ActionBoard.tsx      # "Quoi faire aujourd'hui" — écran principal
│   │   │   ├── ActionCard.tsx       # Card d'action suggérée
│   │   │   └── NextBestAction.tsx   # Suggestion IA next-best-action par client/deal
│   │   ├── ai-copilot/
│   │   │   ├── CopilotPanel.tsx     # Panel IA global (commandes naturelles)
│   │   │   ├── CopilotSummary.tsx   # Résumé intelligent d'une fiche
│   │   │   └── CopilotNegotiation.tsx # Aide à la négociation
│   │   ├── kyc/
│   │   │   ├── KycCaseList.tsx
│   │   │   ├── KycCaseDetail.tsx
│   │   │   └── KycChecklist.tsx
│   │   ├── portal/              # Portail vendeur
│   │   │   ├── SellerDashboard.tsx
│   │   │   ├── SellerVisits.tsx
│   │   │   ├── SellerOffers.tsx
│   │   │   └── SellerAnalysis.tsx   # Positionnement marché, prix m², comparables
│   │   ├── messaging/
│   │   │   ├── Inbox.tsx
│   │   │   ├── Thread.tsx
│   │   │   └── WhatsAppThread.tsx   # Thread WhatsApp intégré
│   │   └── documents/
│   │       ├── TemplateList.tsx
│   │       ├── DocumentGenerator.tsx
│   │       └── DocumentViewer.tsx
│   ├── pages/
│   │   ├── public/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── ListingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── agent/
│   │   │   ├── ActionBoardPage.tsx  # "Quoi faire aujourd'hui" — PAGE PRINCIPALE AGENT
│   │   │   ├── DashboardPage.tsx    # KPIs et analytics
│   │   │   ├── ContactsPage.tsx
│   │   │   ├── ContactDetailPage.tsx # Fiche contact complète + timeline + matching
│   │   │   ├── PipelinePage.tsx
│   │   │   ├── MatchingPage.tsx     # Vue matching acheteurs ↔ biens
│   │   │   ├── ListingsPage.tsx
│   │   │   ├── ListingFormPage.tsx  # Wizard création/édition bien
│   │   │   ├── KycPage.tsx
│   │   │   ├── KycDetailPage.tsx
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── CalendarPage.tsx
│   │   │   ├── DocumentsPage.tsx    # Templates + génération
│   │   │   └── SettingsPage.tsx
│   │   └── particulier/           # ✅ Portail vendeur (6/6 pages complètes)
│   │       ├── SellerLayout.tsx    # Layout sidebar + dark/light mode
│   │       ├── MonDossierPage.tsx  # Dashboard confiance (KPIs, timeline, progression)
│   │       ├── MesVisitesPage.tsx  # Visites planifiées/effectuées + feedbacks
│   │       ├── MesOffresPage.tsx   # Offres reçues (montants, statuts, progression)
│   │       ├── MesDocumentsPage.tsx # Documents (10 docs, progression, alertes)
│   │       ├── MesMessagesPage.tsx # Messagerie agent-vendeur (bulles, timestamps)
│   │       ├── AnalysePage.tsx     # Positionnement marché (prix/m², comparables)
│   │       ├── MonProfilPage.tsx   # Profil vendeur (edit, déconnexion)
│   │       ├── PortalGateway.tsx   # Validation token d'accès
│   │       └── PortalInvalidPage.tsx # Accès invalide/expiré
│   ├── types/
│   │   ├── database.ts          # Types Supabase (générés)
│   │   ├── listing.ts
│   │   ├── contact.ts
│   │   ├── transaction.ts
│   │   ├── matching.ts          # Types matching IA
│   │   ├── automation.ts        # Types relances et règles auto
│   │   └── kyc.ts
│   └── styles/
│       └── globals.css          # Tailwind base + custom CSS
├── scripts/
│   ├── lib/
│   │   └── validate-listing.mjs  # Fonction de validation qualité partagée
│   ├── scrape-paginated.mjs      # Scraping complet RealAdvisor (590 tranches)
│   ├── scrape-delta.mjs          # Mise à jour quotidienne (~3 min)
│   ├── scrape-extra.mjs          # Stratégies complémentaires
│   └── recalculate-quality.mjs   # Recalcul quality_score sur tous les biens
├── supabase/
│   ├── migrations/              # SQL migrations
│   └── functions/               # Edge Functions Deno
│       ├── ai-copilot/          # ✅ DÉPLOYÉ — Copilote IA (Claude Sonnet 4, chat libre + actions)
│       ├── external-matching/   # ✅ DÉPLOYÉ — Scan marché suisse via RealAdvisor
│       ├── send-email/          # ✅ DÉPLOYÉ — Envoi email via Resend (template HTML MEGGA)
│       ├── ai-search/           # Recherche conversationnelle (Phase 2)
│       ├── ai-matching/         # Enrichissement IA du matching (Phase 2)
│       ├── ai-scoring/          # Buyer/seller intelligence (Phase 2)
│       ├── ai-negotiation/      # Copilote négociation (Phase 2)
│       ├── ai-listing-gen/      # Génération annonces multi-versions (Phase 2)
│       ├── score-engine/        # ✅ DÉPLOYÉ — Scoring comportemental contacts + propriétés
│       ├── automation-engine/   # Moteur de relances automatiques (Phase 2)
│       └── webhooks/            # Stripe, Resend... (Phase 2)
```

---

## 4. DESIGN SYSTEM

### 4.1 Direction esthétique

**Minimal, transparent, professionnel.** Inspiré de Lovable, Linear et Notion.

Le dashboard agent utilise un système **dark/light mode** avec CSS variables. Les pages publiques restent en mode clair uniquement.

Caractéristiques clés :
- **Bentos transparents** : pas de fond coloré sur les cards, juste `rounded-xl border border-theme-border`
- **Pas d'ombres** : pas de `shadow-card`, pas de `shadow-sm`. Juste des borders subtils
- **Boutons ghost** : `border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active`. JAMAIS de `bg-accent text-white` pour les boutons d'action
- **Badges texte** : couleur texte sans fond (pas de `bg-danger/10 text-danger`). Juste `text-red-500` ou `text-emerald-500`
- **Pas d'icônes** dans les titres, les boutons d'action, ni les labels de formulaire
- **Dots colorés** pour les indicateurs (score, risque, statut) : `w-2 h-2 rounded-full bg-red-500`
- **Actions au hover** : les boutons CTA (Voir, Éditer, Supprimer) sont cachés par défaut, visibles au group-hover
- **Notification sidebar** : dot rouge `w-2 h-2` UNIQUEMENT sur Messages (pas sur Pipeline, Matching, etc.)
- **Modals** : toujours rendu via `createPortal(document.body)` avec `z-[100]` pour overlay plein écran (pas de navbar visible derrière)
- **Steppers** : monochrome — numéros + underline, pas de dots colorés, pas de cercles verts/bleus
- **Barres de progression** : monochromes `bg-theme-primary`, pas de gradient rouge→jaune→vert
- **Scrollbars cachées** : `.scrollbar-hide` sur les containers qui scrollent (modals, pipeline colonnes)
- **Toggles dark mode** : fond `bg-gray-600` en dark mode (pas `bg-theme-primary` qui est blanc)
- **Sidebar transitions** : `transition-[width] duration-200 ease-out` (pas `transition-all`), labels en `opacity` animée
- **Pills sélectionnés** : `bg-theme-active text-theme-primary` (pas de border accent, pas de fond coloré)

**CE QUE CE N'EST PAS :**
- Pas de gradients flashy
- Pas de couleurs saturées (les bg-accent plein sont interdits — y compris sur les boutons "Créer", "Envoyer", "Confirmer")
- Pas d'ombres (shadow-card, shadow-sm, shadow-lg sont supprimés des bentos)
- Pas d'icônes décoratives dans les boutons, les headers, ni les labels de formulaire
- Pas de cercles colorés dans les steppers (pas de CheckCircle vert, pas de cercle bleu numéroté)
- Pas de barres multicolores (pas de gradient vert→jaune→rouge pour les scores)
- Pas de titres en UPPERCASE pour les sections (utiliser capitalize)

### 4.2 Système de thème (CSS Variables)

Les couleurs sont définies via CSS variables dans `src/styles/globals.css` avec deux palettes : `:root` (light) et `[data-theme="dark"]`. Le ThemeProvider est scopé au dashboard uniquement (dans AgentLayout).

**Palette Dark Mode (confirmée) :**
```
Page       #1C1C1C     --color-bg-page
Sidebar    #161616     --color-bg-sidebar
Cards      #2A2A2A     --color-bg-card
Surfaces   #222222     --color-bg-section
Borders    #383838     --color-border
Texte      #ECECEF     --color-text-primary
Muted      #8E8E96     --color-text-secondary
Accent     #2563EB     --color-accent
```

**Tokens Tailwind sémantiques (à utiliser PARTOUT au lieu des couleurs hardcodées) :**
```
Backgrounds :  bg-theme-page, bg-theme-card, bg-theme-section, bg-theme-sidebar,
               bg-theme-input, bg-theme-elevated, bg-theme-hover, bg-theme-active
Textes :       text-theme-primary, text-theme-secondary, text-theme-tertiary,
               text-theme-muted, text-theme-inverse
Borders :      border-theme-border, border-theme-border-subtle, border-theme-border-focus
```

**JAMAIS utiliser :**
- `bg-white`, `bg-gray-50`, `text-gray-900`, `border-gray-200` — ces classes hardcodées ne fonctionnent pas en dark mode
- `bg-primary-100`, `text-primary-600` — utiliser `bg-theme-active`, `text-theme-secondary`
- `shadow-card`, `shadow-sm` sur les bentos — pas d'ombres dans le style Lovable

**Logo SVG :**
- Sidebar ouverte : `/public/megga-logo.svg` (logo complet)
- Sidebar repliée : `/public/megga-gg.svg` (icône GG)
- En dark mode : `style={{ filter: 'var(--logo-filter, none)' }}` pour inverser en blanc

### 4.2b Composants patterns

**Bento (container standard) :**
```tsx
<div className="rounded-xl border border-theme-border p-5">
```

**Bouton ghost (action standard) :**
```tsx
<button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
```

**Input transparent :**
```tsx
<input className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
```

**Badge texte (pas de fond) :**
```tsx
<span className="text-xs font-medium text-red-500">Élevé</span>
```

**Dot indicateur :**
```tsx
<span className="w-2 h-2 rounded-full bg-red-500" />
```

**Actions au hover :**
```tsx
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  <button>Action</button>
</div>
```

**Modal (TOUJOURS via createPortal) :**
```tsx
{open && createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-theme-card rounded-xl border border-theme-border p-6 max-w-lg w-full mx-4">
      {/* contenu */}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary">Annuler</button>
        <button className="h-9 px-4 text-sm font-medium border border-theme-border rounded-lg hover:border-theme-active">Confirmer</button>
      </div>
    </div>
  </div>,
  document.body
)}
```

**Stepper monochrome :**
```tsx
<div className="flex items-center gap-8">
  {steps.map((step, i) => (
    <button key={i} className={cn(
      "text-sm pb-2 border-b-2 transition-colors",
      i === current ? "text-theme-primary border-theme-primary font-semibold" :
      i < current ? "text-theme-secondary border-theme-primary" :
      "text-theme-muted border-transparent"
    )}>
      {i + 1}. {step}
    </button>
  ))}
</div>
```

**Pill sélectionné (type, durée, récurrence) :**
```tsx
<button className={cn(
  "h-9 px-4 rounded-lg text-sm transition-colors",
  selected ? "bg-theme-active text-theme-primary font-medium" : "text-theme-secondary hover:text-theme-primary"
)}>
```

### 4.3 Typographie

```
Font :          "DM Sans", sans-serif
                Import : https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap

Alternativement pour les titres de listings / prix :
Font display :  "Plus Jakarta Sans", sans-serif

Tailles :
- Hero titre :     text-4xl (36px) md:text-5xl (48px) — font-bold
- Page titre :     text-2xl (24px) md:text-3xl (30px) — font-semibold
- Section titre :  text-xl (20px) — font-semibold
- Card titre :     text-lg (18px) — font-semibold
- Body :           text-base (16px) — font-normal
- Small :          text-sm (14px) — font-normal
- Caption :        text-xs (12px) — font-normal text-gray-500
- Prix listing :   text-xl (20px) md:text-2xl (24px) — font-bold
```

### 4.4 Spacing & Layout

```
Page padding :     px-4 md:px-6 lg:px-8
Max width :        max-w-7xl mx-auto (1280px)
Section gap :      py-12 md:py-16
Card gap :         gap-4 md:gap-6
Card padding :     p-0 (photo plein bord) — infos en p-4
Input height :     h-11 (44px) md:h-12 (48px)
Button height :    h-10 (40px) — CTA principal h-11
Navbar height :    h-16 (64px)
Sidebar width :    w-64 (256px)
```

### 4.5 Composants clés

#### Navbar (public)
- Logo MEGGA noir à gauche
- Navigation centrée : Acheter, Louer, Vendre, Estimations, Services
- Lien actif : texte bleu accent + underline 2px
- Droite : bouton "Publier une annonce" (accent, rounded-full) + "Se connecter" (outline)
- Background blanc, shadow-navbar, sticky top-0

#### Barre de recherche IA (hero)
- Container : photo immobilière floue en arrière-plan, overlay léger
- Titre : "Trouvez votre bien idéal" en blanc, text-4xl font-bold
- Tabs : Acheter / Louer / Vendre / Estimer — style pill, sélectionné = bg-primary text-white
- Barre de recherche : bg-white rounded-xl shadow-lg, inputs inline (type, pièces, budget, localisation)
- Bouton recherche : bg-accent rounded-full, icône Search
- En dessous ou en overlay : zone de texte libre "Décrivez ce que vous cherchez..." pour la recherche IA conversationnelle

#### Listing Card
- Photo en haut, aspect-[4/3], rounded-card overflow-hidden
- Bouton favoris (cœur) en haut à droite de la photo, bg-white/80 backdrop-blur rounded-full
- Dots de navigation photos en bas de la photo
- Sous la photo : prix en font-bold text-xl, badge "Hot price" si applicable (bg-danger text-white text-xs px-2 py-0.5 rounded-badge)
- Adresse en text-secondary
- Infos : pièces · chambres · surface — text-sm text-tertiary, séparées par "·"
- Hover : shadow-card-hover, transition-shadow duration-200

#### Sidebar Agent (dashboard)
- Position fixe à gauche, bg-theme-sidebar, border-r border-theme-border
- Logo : GG centré quand replié (`w-7 h-7 mx-auto`), logo complet quand déplié
- Navigation verticale : icônes Lucide + labels (labels en opacity animée au pliage/dépliage)
- Sections : **PRINCIPAL** (Aujourd'hui, Dashboard), **CRM** (Contacts, Pipeline, Matching), **BIENS** (Mes biens, Créer un bien), **COMMUNICATION** (Messages, Calendrier), **CONFORMITÉ** (KYC, Documents, Automatisation)
- Item actif : bg-theme-active text-theme-primary font-medium
- Item hover : bg-theme-hover
- Profil agent en bas avec avatar + nom + rôle
- **Dot notification UNIQUEMENT sur Messages** (pas sur Pipeline, Matching, etc.)
- **Bouton déplier** : en bas de la sidebar, pas à côté du logo
- **Transition pliage** : `transition-[width] duration-200 ease-out`, labels en `opacity` avec `delay-75`
- **Tooltips** quand replié : nom de la page au hover de chaque icône

#### Action Board ("Quoi faire aujourd'hui")
- **C'est la page d'accueil de l'agent** — la première chose qu'il voit en se connectant
- En-tête : "Bonjour [Prénom], voici votre journée" + date
- Sections empilées par priorité :
  1. **Urgences** (bg-danger/5 border-l-4 border-danger) : deals à risque, docs manquants, relances en retard
  2. **Relances du jour** (bg-warning/5 border-l-4 border-warning) : clients à rappeler, feedbacks à demander
  3. **Matchs trouvés** (bg-accent/5 border-l-4 border-accent) : nouveaux biens compatibles avec des recherches clients
  4. **Visites à confirmer** : agenda du jour
  5. **Suggestions IA** (bg-success/5 border-l-4 border-success) : next-best-actions proposées par l'IA
- Chaque ActionCard : icône, titre, description courte, bouton d'action rapide ("Appeler", "Envoyer", "Voir le dossier")
- Compteur global en haut : "X actions recommandées aujourd'hui"

#### Contact Detail (fiche enrichie)
- En-tête : nom complet, avatar, type (badge texte), score (dot coloré), tel/email en actions rapides
- **Résumé IA** en haut : texte simple, label "estimation IA" en `text-theme-muted text-[10px]` sans fond
- **Next Best Action** : encadré vert, suggestion IA ("Proposer le 3 pièces rue du Rhône — 92% compatible")
- Tabs : Infos · Timeline · Biens envoyés · Matching · Documents · Offres
- **Timeline unifiée** : tous les événements sur une seule timeline chronologique — appels, emails, messages internes, visites, biens envoyés, notes, tâches, documents, offres, relances
- **Buyer/Seller Intelligence** : barres monochromes `bg-theme-primary`, titres en minuscule, pas d'icônes devant les labels, valeurs en texte simple (pas de badges colorés)
- Section critères de recherche : type, zone, budget (annoncé + estimé IA), pièces, surface, features
- Tags et notes libres

#### Matching Panel
- Page dédiée MatchingPage + intégré dans ContactDetailPage onglet Matching
- Cards en grid avec photos edge-to-edge (pas de padding autour de la photo)
- Chaque MatchCard : photo bien, adresse, prix, raisons du match en `text-theme-secondary` séparées par " · " (Budget · Zone · Type)
- **Modal aperçu** : clic sur une card → modal plein écran avec carrousel photos, caractéristiques, description, score de compatibilité détaillé (Budget 30/30, Zone 25/25, etc.)
- **Barres de score monochromes** (`bg-theme-primary`), pas de pourcentage affiché sur la card
- Actions : "Envoyer →" au hover de la card → ouvre SendMatchDialog (Email ou Messagerie, PAS WhatsApp)
- Tri : par score (défaut), par prix, par date
- Filtre : base interne uniquement (Phase 1) | + portails externes (Phase 2)
- **Scrollbar cachée** sur le modal aperçu

#### Pipeline Kanban
- **14 colonnes** : Nouveau lead → À qualifier → Recherche active → Visite planifiée → Visite effectuée → Intérêt confirmé → Offre → Négociation → Réservé → Financement → Notaire → Signé | Perdu | À relancer
- **Layout immersif full-height** : colonnes occupent tout l'espace vertical, header/KPIs/filtres fixes
- **Scrollbar horizontale cachée** (`.scrollbar-hide`)
- Cards de deal : avatar contact, nom contact, adresse bien, prix, date mise à jour en relatif
- Drag & drop via dnd-kit
- **Dialogue confirmation si drop sur "Perdu"** (raison obligatoire)
- **Barre KPIs en haut** : total deals actifs, valeur totale pipeline, deals à risque, taux de conversion
- **Filtres** : recherche texte, filtre par agent, filtre par étape
- Dot coloré par colonne (pas de couleur header)
- Colonnes "Perdu" et "À relancer" visuellement distinctes (opacité réduite)

#### KYC Dossier
- En-tête : nom client, type (PP/PM), niveau de risque (dot coloré + texte), statut global
- Checklist dynamique : items cochables
- **Vérification Compliance** : lignes simples avec dot vert/rouge, pas de cards colorées. "Aucune correspondance" en `text-theme-secondary` (pas en vert)
- Section documents : upload zone, liste docs avec statut, badges expiration
- Journal d'audit : timeline d'événements
- Barre de progression : % complétude
- **Human-in-the-loop** : bouton "Valider le dossier" → modal minimaliste (pas d'icône ShieldCheck, pas de bouton vert, style ghost)
- **Score de risque** : barres monochromes, facteurs détaillés, label "estimation IA"

#### Portail Vendeur
- Vue simplifiée, pas de sidebar
- Dashboard : état du mandat, visites (compteur), offres, messages
- **Dashboard de confiance** : activité récente, dynamique du bien, qualité des retours
- **Analyse positionnement** : prix au m², biens comparables, risque de stagnation, suggestion de prix
- Timeline des activités récentes
- Accès documents
- Ton rassurant : "Votre bien est entre de bonnes mains"

#### Copilot Panel (MEGGA AI)
- Accessible depuis n'importe quel écran agent (bouton flottant en bas à droite, icône Sparkles style ghost)
- Input texte : commandes en langage naturel
- Exemples : "résume-moi ce client", "rédige une relance", "quels biens envoyer à M. Dupont", "prépare un mandat", "quelles sont les prochaines actions"
- L'IA est TOUJOURS connectée au contexte réel du CRM (client actif, deal actif, page courante)
- Réponses affichées dans un panel slide-in depuis le bas avec actions cliquables

#### Messagerie
- **Layout compact** : liste threads à gauche (1/3), thread ouvert à droite (2/3)
- **Compose** : zone de rédaction en bas avec bouton pièce jointe (icône Paperclip)
- **Timestamps groupés par jour** : "Aujourd'hui", "Hier", "20 mars 2026"
- **Statut de lecture** : double check vert pour lu, check gris pour envoyé
- **Épingler/Archiver** : actions au hover sur chaque thread
- **Canaux** : Email et Messagerie interne uniquement (PAS de WhatsApp — trop complexe à installer)
- **Recherche** : barre de recherche dans la liste des threads

#### Settings (8 onglets)
- **Profil** : avatar avec modal crop (zoom, rotation, reset), nom, email (non modifiable), téléphone, rôle, langue (pills FR/DE/EN/IT), bio
- **Apparence** : couleur d'accent, densité, coins, style sidebar, taille texte
- **Agence** : infos agence, branding
- **Équipe** : liste membres, invitation (modal createPortal), rôles
- **Notifications** : toggles email/push par type, toggles en gris moyen en dark mode (pas blanc)
- **Sécurité** : mot de passe (connecté Supabase), 2FA (bientôt disponible), Google OAuth link/unlink avec feedback, sessions (bientôt disponible), journal de sécurité (connecté activity_events)
- **Abonnement** : toggle mensuel/annuel (-20%), 3 plans (Starter gratuit, Pro CHF 89, Agency CHF 249), prix barré en annuel, CTA "Besoin d'un plan sur mesure ?"
- **Applications** : style Stripe Marketplace — 12 apps en grille 4 colonnes avec logos SVG officiels, filtres par catégorie (Tous, Connectés, Calendrier, Email, CRM, Outils). Apps : Email/Resend (connecté), Google Calendar (connectable avec sync), Outlook Calendar, Salesforce, HubSpot, Pipedrive, Zoho CRM, Freshsales, Import/Export CSV, PostHog, Google Drive, OneDrive

---

## 5. PATTERNS DE CODE

### 5.1 Convention de nommage

```
Composants :     PascalCase          → ListingCard.tsx
Hooks :          camelCase use*      → useListings.ts
Utils :          camelCase           → formatCHF.ts
Types :          PascalCase          → Listing, Contact, Transaction
Fichiers SQL :   snake_case          → 001_create_listings.sql
Edge Functions : kebab-case          → ai-search/index.ts
Variables CSS :  kebab-case          → --color-accent
Branches git :  feature/nom-feature → feature/search-bar
```

### 5.2 Pattern composant React

```tsx
// Toujours : export par défaut, props typées, cn() pour les classes conditionnelles

import { cn } from '@/lib/utils';

interface ListingCardProps {
  listing: Listing;
  className?: string;
  onFavorite?: (id: string) => void;
}

export default function ListingCard({ listing, className, onFavorite }: ListingCardProps) {
  return (
    <div className={cn('rounded-xl border border-theme-border bg-theme-card', className)}>
      {/* ... */}
    </div>
  );
}
```

### 5.3 Pattern Supabase

```tsx
// Hook custom pour chaque entité
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useListings(filters?: ListingFilters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      let query = supabase.from('listings').select('*, agency:agencies(name, logo_url)');
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.minPrice) query = query.gte('price', filters.minPrice);
      if (filters?.maxPrice) query = query.lte('price', filters.maxPrice);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### 5.4 Pattern Edge Function

```typescript
// supabase/functions/ai-search/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { query, conversation_history } = await req.json();

  // 1. Embed la query utilisateur
  // 2. Recherche pgvector (similarity search)
  // 3. Construit le prompt avec les résultats
  // 4. Appelle Claude API avec le contexte
  // 5. Stream la réponse

  return new Response(JSON.stringify({ results, ai_response }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 6. BASE DE DONNÉES (SCHÉMA SIMPLIFIÉ MVP)

### Tables principales

```sql
-- Agences
agencies (id, name, slug, logo_url, address, phone, email, plan, created_at)

-- Utilisateurs (agents + admins)
profiles (id, agency_id, email, full_name, avatar_url, role, phone, created_at)
  -- roles: 'admin' | 'manager' | 'agent' | 'assistant'

-- Contacts (acheteurs + vendeurs + investisseurs + locataires + bailleurs)
contacts (
  id, agency_id,
  -- Identité
  first_name, last_name, email, phone, whatsapp_phone, language, nationality,
  -- Classification
  type,          -- 'buyer' | 'seller' | 'investor' | 'tenant' | 'landlord' | 'both' | 'lead'
  source,        -- 'website' | 'referral' | 'portal' | 'walk_in' | 'social' | 'cold_call' | 'other'
  score,         -- 'hot' | 'warm' | 'cold'
  -- Budget
  budget_announced, budget_estimated_ai,
  -- Recherche
  search_zones,  -- text[] (cantons ou quartiers)
  search_criteria, -- jsonb (type, pièces min/max, surface min/max, features...)
  -- Scoring IA (buyer/seller intelligence)
  ai_seriousness_score,    -- 0-100, estimé par IA
  ai_purchase_probability, -- 0-100
  ai_timing,               -- 'immediate' | '1-3_months' | '3-6_months' | '6-12_months' | 'long_term'
  ai_engagement_level,     -- 'very_high' | 'high' | 'medium' | 'low' | 'dormant'
  -- Seller-specific
  ai_tension_level,        -- 'calm' | 'moderate' | 'tense' | 'critical' (vendeurs)
  ai_price_reduction_probability, -- 0-100 (vendeurs)
  -- Meta
  tags, notes, avatar_url,
  last_interaction_at,     -- Date de la dernière interaction (calculé)
  created_at, updated_at
)

-- Biens immobiliers
properties (
  id, agency_id,
  title, description, type, status, price, currency,
  rooms, bedrooms, bathrooms, surface_m2,
  floor, has_outdoor, has_parking, charges_monthly, year_built, condition,
  address, city, canton, postal_code, lat, lng,
  photos, features,
  -- Analyse marché IA
  ai_price_per_m2, ai_comparable_properties, ai_stagnation_risk, ai_suggested_price,
  -- Meta
  availability_date, created_by, created_at, published_at, updated_at
)
  -- type: 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  -- status: 'draft' | 'active' | 'reserved' | 'sold' | 'off_market' | 'archived'
  -- condition: 'new' | 'renovated' | 'good' | 'to_renovate'

-- Listings (annonces publiées)
listings (id, property_id, agency_id, title, description_ai, price_display, is_featured, is_hot, views_count, favorites_count, published_at, expires_at)

-- Recherches clients (sauvegardes)
client_searches (
  id, agency_id, contact_id,
  label,            -- "Recherche 4p Eaux-Vives"
  criteria,         -- jsonb : type, budget_min, budget_max, rooms_min, rooms_max, surface_min, zones[], features[]
  is_active,        -- true = surveillance continue activée
  last_matched_at,  -- Dernière fois que le matching a trouvé des résultats
  created_at, updated_at
)

-- Matching acheteurs ↔ biens
matches (
  id, agency_id,
  contact_id, property_id, client_search_id,
  score,            -- 0-100 score de compatibilité
  reasons,          -- jsonb : { budget: true, zone: true, rooms: true, surface: false, features: ['parking'] }
  status,           -- 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  sent_via,         -- 'email' | 'whatsapp' | 'both' | null
  sent_at, response_at,
  created_at
)

-- Transactions / Deals (pipeline enrichi)
transactions (
  id, agency_id, property_id, contact_buyer_id, contact_seller_id, assigned_to,
  stage, status,
  price_offered, price_final, mandate_type,
  notes, created_at, updated_at
)
  -- stage (pipeline enrichi Gregory) :
  --   'new_lead' | 'to_qualify' | 'active_search' | 'visit_planned' | 'visit_done' |
  --   'interest_confirmed' | 'offer' | 'negotiation' | 'reserved' |
  --   'financing' | 'notary' | 'signed' | 'closed' | 'lost' | 'to_recontact'
  -- status: 'active' | 'on_hold' | 'cancelled' | 'completed'

-- Relances et reminders automatiques
reminders (
  id, agency_id,
  contact_id, property_id, transaction_id, match_id,
  type,             -- 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom'
  trigger_rule,     -- 'days_after_event' | 'no_response' | 'inactivity' | 'manual'
  trigger_days,     -- Nombre de jours avant déclenchement
  status,           -- 'pending' | 'triggered' | 'done' | 'cancelled' | 'snoozed'
  trigger_at,       -- Date prévue de déclenchement
  completed_at,
  message_template, -- Template du message de relance (optionnel)
  channel,          -- 'email' | 'whatsapp' | 'task' | 'notification'
  created_at
)

-- Règles d'automatisation (configurées par l'agent)
automation_rules (
  id, agency_id,
  name,             -- "Relance J+3 après envoi bien"
  trigger_event,    -- 'property_sent' | 'visit_completed' | 'lead_inactive' | 'document_missing' | 'new_match'
  action,           -- 'create_reminder' | 'send_email' | 'send_whatsapp' | 'create_task' | 'notify_agent'
  delay_days,       -- Délai avant exécution
  template_id,      -- Référence au template de message
  is_active,
  created_at
)

-- Templates de messages (relances, confirmations, etc.)
message_templates (
  id, agency_id,
  name,             -- "Relance acheteur après envoi"
  category,         -- 'follow_up' | 'visit_confirmation' | 'property_presentation' | 'post_visit' | 'objection_response' | 'offer_follow_up' | 'thank_you' | 'seller_update'
  channel,          -- 'email' | 'whatsapp' | 'both'
  subject,          -- Sujet email (si applicable)
  body,             -- Corps du message avec variables {{contact.first_name}}, {{property.address}}, etc.
  is_ai_generated,  -- true si généré par IA
  created_at
)

-- Visites
visits (
  id, agency_id,
  property_id, contact_id, transaction_id,
  scheduled_at, completed_at,
  status,           -- 'planned' | 'confirmed' | 'done' | 'cancelled' | 'no_show'
  feedback_buyer,   -- Feedback acheteur (texte libre ou structuré)
  feedback_agent,   -- Notes agent post-visite
  ai_objections,    -- jsonb : objections détectées par IA dans le feedback
  rating,           -- 1-5 étoile (optionnel)
  created_at
)

-- Dossiers KYC
kyc_cases (id, agency_id, transaction_id, contact_id, type, risk_level, status, completion_pct, validated_by, validated_at, created_at)
  -- type: 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
  -- risk_level: 'low' | 'medium' | 'high' | 'unassessed'
  -- status: 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'

-- Checklist items KYC
kyc_checklist_items (id, kyc_case_id, label, category, is_required, is_completed, document_id, notes, completed_at, completed_by)

-- Documents
documents (id, agency_id, kyc_case_id, transaction_id, contact_id, property_id, name, type, storage_path, size_bytes, uploaded_by, status, created_at)
  -- status: 'pending' | 'validated' | 'rejected'
  -- type: 'mandate' | 'visit_voucher' | 'property_sheet' | 'offer' | 'kyc' | 'contract' | 'other'

-- Messages (email + WhatsApp unifiés)
messages (id, thread_id, sender_id, sender_type, channel, content, read_at, created_at)
  -- channel: 'internal' | 'email' | 'whatsapp'
message_threads (id, agency_id, property_id, contact_id, channel, participants, last_message_at)

-- Favoris
favorites (id, user_id, listing_id, created_at)

-- Audit trail
activity_events (id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at)

-- Embeddings pour recherche IA
listing_embeddings (id, listing_id, embedding vector(1536), content_text, updated_at)

-- Actions du jour (générées par IA, rafraîchies quotidiennement)
daily_actions (
  id, agency_id, agent_id,
  priority,         -- 'urgent' | 'high' | 'medium' | 'low'
  category,         -- 'follow_up' | 'match_found' | 'visit_confirm' | 'document_missing' | 'deal_at_risk' | 'suggestion'
  title, description,
  entity_type, entity_id, -- Lien vers le contact/deal/bien concerné
  action_type,      -- 'call' | 'email' | 'whatsapp' | 'send_property' | 'plan_visit' | 'review_document' | 'adjust_price'
  is_completed,
  generated_at, completed_at
)
```

### Row Level Security (RLS)

```
CRITIQUE : Chaque table DOIT avoir des policies RLS activées.
- Les agents ne voient que les données de leur agence (agency_id = auth.jwt() -> agency_id)
- Les vendeurs (portail) ne voient que leurs propres transactions
- Les acheteurs (public) ne voient que les listings publiés (status = 'active')
- Les relances et matchs sont filtrés par agency_id
```

---

## 7. PAGES MVP (42 ÉCRANS)

### Public (4)
1. **HomePage** — Hero avec barre de recherche IA + listings vedettes + CTA agent
2. **SearchPage** — Résultats + carte Mapbox split view + filtres + chat IA latéral
3. **ListingPage** — Fiche bien détaillée (photos, infos, carte, contact agent, estimation)
4. **LoginPage / RegisterPage** — Auth Supabase (email + Google OAuth)

### Agent Dashboard (15)
5. **ActionBoardPage** — ⭐ PAGE D'ACCUEIL AGENT — "Quoi faire aujourd'hui" (relances, matchs, urgences, suggestions IA)
6. **DashboardPage** — KPIs, analytics, pipeline mini, dernières activités
7. **PipelinePage** — Kanban drag & drop des transactions (12 colonnes enrichies)
8. **ContactsPage** — Liste + filtres + scoring + tags + scoring IA
9. **ContactDetailPage** — Fiche enrichie : résumé IA, timeline unifiée, next-best-action, matching, critères, documents
10. **MatchingPage** — Vue globale matching acheteurs ↔ biens, shortlists, envois en lot
11. **ListingsPage** — Mes biens, statuts, vues, favoris, analyse positionnement IA
12. **ListingFormPage** — Créer/éditer un listing (wizard multi-étapes) + génération annonce IA multi-versions
13. **KycListPage** — Liste dossiers KYC, statuts, progression
14. **KycDetailPage** — Dossier KYC complet, checklist, documents, validation
15. **MessagesPage** — Inbox unifié (email + WhatsApp + interne) + threads
16. **DocumentsPage** — Templates + génération mandat/bon de visite/fiche bien + signature
17. **CalendarPage** — Agenda visites, RDV (synchro Google Calendar Phase 2)
18. **AutomationPage** — Configuration des règles de relance automatique
19. **SettingsPage** — Profil, agence, équipe, notifications

### Onboarding Client (4)
20. **OnboardingBuyerPP** — Formulaire acquéreur personne physique
21. **OnboardingBuyerPM** — Formulaire acquéreur personne morale
22. **OnboardingSellerPP** — Formulaire vendeur personne physique
23. **OnboardingSellerPM** — Formulaire vendeur personne morale

### Portail Vendeur (6)
24. **SellerDashboard** — État du mandat, activité, stats, dashboard de confiance IA
25. **SellerVisits** — Visites planifiées + retours + feedbacks
26. **SellerOffers** — Offres reçues
27. **SellerDocuments** — Documents liés au mandat
28. **SellerMessages** — Communication avec l'agent
29. **SellerAnalysis** — Positionnement marché, prix m², comparables, alertes stagnation

### Settings (4)
30. **ProfileSettings** — Profil personnel
31. **AgencySettings** — Infos agence, branding
32. **TeamSettings** — Gestion équipe, rôles
33. **NotificationSettings** — Préférences notifications

### Génération Documents (3)
34. **TemplatesPage** — Liste templates (mandat, bon de visite, offre, lettre d'accompagnement...)
35. **DocumentGenerator** — Sélection template + preview + export PDF
36. **DocumentViewer** — Visualisation document généré

---

## 8. MODULES IA (spécifications Gregory Lyonnet)

> Gregory Lyonnet, notre expert terrain, a défini ces modules comme essentiels au quotidien d'un courtier. L'IA n'est JAMAIS un gadget — elle est toujours connectée au contexte réel du CRM.

### 8.1 MEGGA AI (ancien Copilote)

**Accès :** Bouton flottant en bas à droite (icône Sparkles, style ghost), disponible depuis toute page agent. Panel slide-in depuis le bas.

**Commandes naturelles supportées :**
- "Résume-moi ce client" → Résumé structuré (qui, où en est la relation, quoi faire ensuite)
- "Rédige une relance pour [client]" → Email ou WhatsApp contextualisé
- "Quels biens envoyer à [client]" → Shortlist matching avec scores
- "Prépare un mandat pour [bien]" → Pré-remplissage document
- "Quelles sont les prochaines actions" → Next-best-actions triées par priorité
- "Résume les objections de [client]" → Analyse des feedbacks de visite

**Règle clé :** L'IA doit TOUJOURS être nourrie par les vraies données CRM du client/bien/deal actif. Pas de réponse "dans le vide".

### 8.2 Matching intelligent acheteurs ↔ biens

**Flux quand un nouveau bien entre :**
1. L'IA analyse tous les acheteurs existants + leurs critères de recherche (client_searches)
2. Calcule un score de compatibilité (0-100%) basé sur : budget, zone, type, pièces, surface, features
3. Classe les meilleurs matchs
4. Propose l'envoi en un clic (email ou WhatsApp)

**Flux quand un acheteur est créé/modifié :**
1. L'IA surveille tous les biens déjà présents (status = 'active')
2. Propose les biens pertinents automatiquement
3. Suggère l'envoi immédiat

**Surveillance continue (si client_search.is_active = true) :**
- Nouveaux biens dans la base → notification agent
- Changements de prix → re-matching
- Biens remis en ligne → alerte
- Message type : "3 nouveaux biens correspondent à la recherche de M. Dupont"

**Phase 2 :** Recherche externe sur portails (dépend des API disponibles).

### 8.3 Relances automatiques intelligentes

**Types de relances :**

| Trigger | Délai | Action | Canal |
|---|---|---|---|
| Bien envoyé à un client | J+3 | Reminder agent ou relance auto | Email/WhatsApp |
| Visite effectuée | J+1 | Demande de feedback | Email/WhatsApp |
| Lead inactif | J+30 | Relance douce + nouveau bien | Email |
| Acheteur chaud non relancé | J+7 | Alerte agent | Notification |
| Vendeur sans suivi récent | J+14 | Alerte + suggestion update | Notification |
| Document manquant | J+3 | Relance client | Email |

**Adaptation comportementale (Phase 2) :**
- Email ouvert mais pas de réponse → relance différente
- Bien consulté plusieurs fois → signal d'intérêt fort
- Aucune ouverture → changer de canal (WhatsApp au lieu d'email)

**Principe :** L'agent garde toujours le contrôle. Les relances "auto" créent des suggestions/tâches, pas des envois silencieux (sauf si l'agent active l'envoi automatique explicitement).

### 8.4 Next Best Action

Pour chaque client ou deal, l'IA suggère la meilleure prochaine action :
- Appeler
- Relancer (email/WhatsApp)
- Envoyer un bien (avec lequel)
- Proposer une visite
- Revoir le prix (vendeur)
- Envoyer un document
- Passer à l'étape suivante du pipeline

**Implémentation :** Edge Function `ai-copilot` qui reçoit le contexte complet (contact, transactions, matchs, interactions récentes, relances) et renvoie 1-3 actions classées par impact estimé.

### 8.5 Buyer Intelligence

L'IA estime pour chaque acheteur :
- **Sérieux** (0-100) : basé sur réactivité, nombre de visites, cohérence budget/recherche
- **Budget réel estimé** : basé sur les biens consultés, offres faites, interactions
- **Timing** : immédiat, 1-3 mois, 3-6 mois, 6-12 mois, long terme
- **Probabilité d'achat** (0-100)
- **Niveau d'engagement** : very_high → dormant

### 8.6 Seller Intelligence

L'IA analyse pour chaque vendeur :
- **Niveau de tension** : calm, moderate, tense, critical
- **Risque d'insatisfaction** : basé sur durée de mise en vente, feedbacks, relances
- **Probabilité d'accepter une baisse** (0-100)
- **Niveau d'urgence** : pas pressé, modéré, urgent, très urgent

### 8.7 Copilote de négociation

Quand une offre arrive, l'IA aide sur :
- Niveau de marge (écart offre vs prix demandé vs marché)
- Timing (depuis combien de temps le bien est en vente, combien de visites)
- Stratégie de contre-offre suggérée
- Degré d'intérêt probable de l'acheteur (basé sur son historique)

### 8.8 Génération d'annonces multi-versions

Pour chaque bien, l'IA génère automatiquement :
- **Version standard** — portails classiques
- **Version premium** — mise en valeur haut de gamme
- **Version luxe** — vocabulaire immobilier de prestige
- **Version courte** — SMS/WhatsApp
- **Version réseaux sociaux** — Instagram/LinkedIn

L'agent choisit, édite, valide. Pas de publication automatique.

### 8.9 Analyse d'objections post-visite

Après les visites, l'IA regroupe et analyse :
- Objections récurrentes (bruit, étage, luminosité, prix...)
- Points faibles identifiés du bien
- Suggestions d'ajustement (prix, mise en valeur, travaux à mentionner)

Stocké dans `visits.ai_objections` et affiché dans le portail vendeur (anonymisé).

### 8.10 KYC Tier 1 — Compliance avancée (IMPLÉMENTÉ + CONNECTÉ SUPABASE)

**100% connecté à Supabase — plus aucun mock.**

**Screening PEP & Sanctions (API dilisense) :**
- Edge Function `kyc-screening` déployée — appelle l'API dilisense (`checkIndividual` / `checkEntity`)
- Sépare automatiquement les hits PEP et Sanctions
- Statuts : `not_checked` → `pending` → `clear` | `match`
- Section "Vérification Compliance" dans KycDetailPage avec statut vert/rouge/amber
- Colonne PEP/S toujours visible dans KycListPage avec icônes : AlertTriangle (match), ShieldCheck (clear), Loader2 (pending), tiret (non vérifié)
- Bouton "Relancer la vérification" → appelle Edge Function → résultats temps réel (human-in-the-loop)
- Testé avec succès : Vladimir Putin → 3 hits PEP + 14 hits Sanctions, score 85/100
- Chaque screening loggé dans `activity_events` avec `actor_id = 'ai'`
- Secret requis : `DILISENSE_API_KEY` dans Supabase Edge Functions Secrets

**Score de risque automatique :**
- Fonction `calculateRiskScore()` dans `src/lib/kycUtils.ts` (frontend) + calculé aussi dans Edge Function (backend)
- 5 facteurs : nationalité GAFI (25pts), PEP (25pts), montant >5M (20pts), PM vs PP (15pts), docs incomplets (15pts)
- Score 0-100 → low/medium/high avec barre visuelle et facteurs détaillés
- Stocké en DB : `kyc_cases.risk_score`, `kyc_cases.risk_factors`, `kyc_cases.risk_level`
- Listes FATF dans `src/lib/constants.ts` (FATF_HIGH_RISK_COUNTRIES, FATF_INCREASED_MONITORING)
- Label "estimation IA" obligatoire

**Création de dossier KYC depuis l'interface :**
- Bouton "Nouveau dossier" dans KycListPage (header + empty state)
- Modal : sélection contact, type (PP/PM), nationalité, montant, transaction liée (optionnel)
- `useCreateKycCase()` — crée le dossier + checklist par défaut adaptée PP/PM
- Checklist auto-générée : Identité (RC/passeport, statuts, UBO), Domicile, Revenus, Origine des fonds, Compliance

**Upload documents vers Supabase Storage :**
- Bucket `kyc-documents` (privé)
- Upload avec sélection catégorie (identité, domicile, financier, compliance, autre)
- `useUploadKycDocument()` → upload Storage + INSERT documents + activity_event

**Alertes expiration documents :**
- Champs `issued_at`, `expires_at`, `document_category` sur table `documents`
- Badges "Expiré" (rouge) / "Expire dans Xj" (orange) dans la liste documents

**Menus contextuels (clic droit) :**
- Liste KYC : Voir le dossier, Lancer le screening, Changer le statut (sous-menu), Valider, Copier l'ID
- Documents : Télécharger, Valider le document, Rejeter le document
- Checklist : Marquer complété/non complété, Lier un document
- Composant `ContextMenu` Radix UI réutilisable dans `src/components/ui/context-menu.tsx`

**Validation human-in-the-loop :**
- Bouton "Valider le dossier" → modal de confirmation → `useValidateKycCase()` → status = 'validated' + activity_event
- Notes internes persistées → `useUpdateKycNotes()`
- Journal d'audit chargé depuis `activity_events` WHERE entity_type = 'kyc'

**Hooks Supabase (`src/hooks/useKyc.ts`) :**
- `useKycCases(filters?)` — liste avec join contacts
- `useKycCase(id)` — détail avec checklist
- `useKycDocuments(kycCaseId)` — documents d'un dossier
- `useKycAuditEvents(kycCaseId)` — journal d'audit
- `useCreateKycCase()` — création + checklist auto
- `useUpdateKycItem()` — toggle checklist item
- `useUpdateKycStatus()` — changement de statut
- `useUpdateKycNotes()` — sauvegarde notes
- `useValidateKycCase()` — validation human-in-the-loop
- `useUploadKycDocument()` — upload Storage + INSERT
- `useScreenKycCase()` — appel Edge Function dilisense

**RLS corrigé :**
- Récursion infinie sur `profiles` fixée avec fonctions `SECURITY DEFINER` (`get_my_agency_id()`)
- Policies `contacts`, `documents`, `activity_events` mises à jour
- Policies ouvertes temporaires sur `kyc_cases` et `kyc_checklist_items` pour dev

---

## 9. RECHERCHE IA CONVERSATIONNELLE

### Flux utilisateur
1. L'utilisateur tape en langage naturel : "3 pièces lumineux près de Cornavin, max 2'500/mois"
2. Edge Function `ai-search` reçoit la query
3. La query est embeddée via l'API d'embeddings
4. Recherche pgvector : top-20 listings similaires
5. Prompt Claude avec contexte : listings trouvés + historique conversation + contraintes
6. Claude filtre, classe, et répond en langage naturel
7. Résultats affichés sur la carte + liste

### Garde-fous IA
- Pas de discrimination (origine, genre, religion, âge)
- Pas de contenus trompeurs sur les biens
- Redirection vers agent humain si : offre, négociation, question juridique
- Disclaimer : "Les informations sont fournies à titre indicatif"
- Max 10 tours de conversation avant suggestion de contacter un agent
- Temps de réponse cible : < 2 secondes

### Garde-fous modules IA agent (section 8)
- L'IA ne contacte JAMAIS un client sans validation agent (sauf si relance auto explicitement activée)
- L'IA ne modifie JAMAIS un prix, un statut, ou une étape pipeline sans action humaine
- L'IA n'envoie JAMAIS de document juridique sans validation agent
- Les scores IA (buyer/seller intelligence) sont indicatifs — affichés comme "estimation IA", pas comme vérité
- Le copilote de négociation donne des SUGGESTIONS, pas des décisions
- Toute action IA est loggée dans `activity_events` avec `actor_id = 'ai'`

---

## 10. RÈGLES ABSOLUES

### DO ✅
- Toujours utiliser TypeScript strict (pas de `any`)
- Toujours activer RLS sur chaque table Supabase
- Toujours utiliser `cn()` (clsx + tailwind-merge) pour les classes conditionnelles
- Toujours formater les prix en CHF : `CHF 720'000` (apostrophe suisse, pas de virgule)
- Toujours mettre les labels et textes UI en français
- Toujours utiliser les composants shadcn/ui quand ils existent
- Toujours gérer les états : loading, empty, error pour chaque liste/page
- Toujours rendre responsive : mobile-first, puis md: et lg:
- Human-in-the-loop pour toute validation KYC/compliance
- Human-in-the-loop pour tout envoi de message/document au client
- Audit trail : logger toute action importante dans `activity_events` (y compris actions IA)
- Toujours afficher les scores IA comme "estimation" avec un indicateur visuel (icône sparkle/ai)
- Timeline unifiée par contact : TOUT dans une seule timeline chronologique
- Toujours vérifier qu'une fonctionnalité sert au moins 1 des 5 objectifs du Document Maître (admin, LAB/KYC, closing, transparence client, fragmentation) avant de la coder
- Toujours positionner l'outil comme compliance-enabling, PAS compliance-replacing (formulation correcte : assistance, standardisation, orchestration, traçabilité, aide à la décision)
- L'IA doit toujours être contextualisée, traçable, contrôlable, réversible, et non autonome sur les points réglementaires critiques

### DON'T ❌
- JAMAIS de `any` en TypeScript
- JAMAIS de données en dur (hardcoded) — tout vient de Supabase
- JAMAIS de localStorage pour les données sensibles (utiliser Supabase Auth)
- JAMAIS de validation KYC automatique sans action humaine
- JAMAIS d'envoi automatique au client sans validation agent (sauf relance auto explicitement activée)
- JAMAIS d'action IA silencieuse — tout est loggé et visible
- JAMAIS de couleurs hardcodées (bg-white, text-gray-*) — toujours utiliser les tokens thème (text-theme-primary, bg-theme-card, etc.)
- JAMAIS de bg-accent plein sur les boutons d'action — utiliser le style ghost (border + text). Cela inclut "Créer", "Envoyer", "Confirmer", "Sauvegarder"
- JAMAIS d'ombres (shadow-card, shadow-sm) sur les bentos — juste border border-theme-border
- JAMAIS de modals rendus inline — toujours `createPortal(document.body)` avec `z-[100]`
- JAMAIS de dots/cercles colorés dans les steppers — utiliser numéros + underline monochrome
- JAMAIS de barres de progression multicolores (gradient rouge→vert) — utiliser `bg-theme-primary` monochrome
- JAMAIS de titres en UPPERCASE (pas de "BUYER INTELLIGENCE") — utiliser capitalize
- JAMAIS de WhatsApp comme canal — remplacé par Messagerie interne (trop complexe à installer pour les clients)
- JAMAIS de dots rouges sur la sidebar sauf Messages — les autres pages n'ont pas de "non lu"
- JAMAIS de scrollbars visibles dans les modals ou le pipeline — utiliser `.scrollbar-hide`
- JAMAIS de radio buttons natifs dans les modals — utiliser des pills
- JAMAIS de Next.js — c'est React + Vite (pas besoin de SSR, c'est un SaaS)
- JAMAIS de Vercel — c'est Cloudflare Pages
- JAMAIS de `console.log` en production
- JAMAIS mentionner "Lovable", "Claude", "Dribbble", "ChatGPT" dans l'interface ou le code
- JAMAIS afficher l'IA comme "automatique" ou "garantie" — c'est une "assistance"
- JAMAIS présenter les scores IA comme des certitudes — toujours "estimation"
- JAMAIS formuler "conformité automatique garantie" ou "LAB 100% automatisée" — c'est un risque juridique
- JAMAIS construire une fonctionnalité qui ne sert aucun des 5 objectifs du Document Maître — c'est du scope creep

---

## 11. MONNAIE ET LOCALISATION

```
Devise :          CHF (franc suisse)
Format prix :     CHF 720'000 (apostrophe comme séparateur milliers)
Format surface :  120 m²
Format date :     16.03.2026 (DD.MM.YYYY) — ou "il y a 2 heures" en relatif
Langue par défaut : Français
Langues supportées : FR (Français), DE (Deutsch), EN (English), IT (Italiano)
Sélecteur :       Paramètres > Profil > Langue (pills compacts, pas de drapeaux)
Stockage :        localStorage clé 'megga-language', détection auto navigateur
i18n :            react-i18next, 12 namespaces par langue (common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, automation, documents)
Cantons :         GE, VD, VS, NE, FR, BE, JU, BS, BL, AG, SO, ZH, LU, ZG, SZ, NW, OW, UR, GL, SH, TG, AR, AI, SG, GR, TI
```

---

## 12. PRIORITÉ DE DÉVELOPPEMENT

> **Stratégie (alignée Document Maître) :** On construit d'abord le **Compliance-First Transaction OS** — les outils agent qui changent leur quotidien (la vraie valeur pour embarquer les 10-20 agences pilotes). La marketplace publique arrive ensuite, une fois que l'outil CRM est adopté et que les agents ont de la valeur d'usage dès le premier jour, indépendamment du nombre d'acheteurs sur le portail.

> **Migration CRM enrichi en 6 étapes :** Le CRM agent passe du modèle générique au modèle enrichi spécifié par Gregory Lyonnet. L'ordre des 6 étapes n'est pas négociable — chaque étape débloque la suivante.

### Sprint 1 (Semaine 1-2) — Fondations + Setup
- Setup projet (Vite + React + TS + Tailwind + shadcn)
- Supabase : schema de base (tables section 6), RLS, auth
- Layout : Navbar, Footer, Sidebar (avec entrées : Aujourd'hui, Pipeline, Matching, Contacts, Mes biens, KYC, Messages, Documents, Calendrier)
- HomePage avec hero + barre de recherche (statique d'abord — marketplace en Sprint 6)
- LoginPage / RegisterPage (Supabase Auth)

### Sprint 2 (Semaine 3-4) — Migration CRM Étapes 1-2

#### Étape 1 — Migrations DB (2-3 jours)
- **Migration SQL unique** : créer les 7 nouvelles tables dans l'ordre de dépendances FK :
  - `message_templates` (aucune FK externe)
  - `client_searches` (FK → contacts)
  - `matches` (FK → contacts, properties, client_searches)
  - `reminders` (FK → contacts, properties, transactions, matches)
  - `automation_rules` (FK → message_templates)
  - `visits` (FK → properties, contacts, transactions)
  - `daily_actions` (aucune FK externe)
- **ALTER TABLE contacts** : ajouter whatsapp_phone, language, nationality, budget_announced, budget_estimated_ai, search_zones, search_criteria, ai_seriousness_score, ai_purchase_probability, ai_timing, ai_engagement_level, ai_tension_level, ai_price_reduction_probability, last_interaction_at
- **ALTER TABLE transactions** : enrichir stage pour supporter les 15 étapes pipeline Gregory (new_lead, to_qualify, active_search, visit_planned, visit_done, interest_confirmed, offer, negotiation, reserved, financing, notary, signed, closed, lost, to_recontact)
- **RLS policies** sur chaque nouvelle table (pattern : agency_id via profiles WHERE id = auth.uid())
- **Index** : matches(contact_id, status), reminders(agency_id, status, trigger_at), client_searches(contact_id, is_active), daily_actions(agent_id, is_completed, generated_at), visits(property_id, scheduled_at)
- Fichier unique : `supabase/migrations/YYYYMMDD_001_enriched_crm_tables.sql`
- Tester avec `supabase db reset` avant production

#### Étape 2 — Contact Detail enrichie (4-5 jours)
- **ContactDetailPage** avec 4 zones verticales :
  - Zone 1 : En-tête (nom, avatar, type badge, score IA badge, actions rapides appel/WhatsApp/email, last_interaction_at en relatif)
  - Zone 2 : Résumé IA (encadré bg-accent/5, icône sparkle, 2-3 phrases contextualisées, label "estimation IA", refresh à la demande + cache 24h)
  - Zone 3 : Next Best Action (encadré bg-success/5, suggestion IA, bouton d'action directe)
  - Zone 4 : Tabs (Infos · Timeline · Biens envoyés · Matching · Documents · Offres)
- **ContactTimeline.tsx** — Timeline unifiée agrégeant : messages email, WhatsApp, appels, visites, biens envoyés, notes, documents, offres, changements pipeline, relances, actions IA. Chaque type a icône Lucide + couleur distincte. Source : activity_events filtrés par contact_id (MVP), puis UNION ALL sur tables source (Phase 2)
- **useContactDetail(contactId)** — Hook React Query chargeant en parallèle : contact complet, activity_events, transactions liées, client_searches actives, matches récents. Expose refreshAiSummary()
- Section critères de recherche (onglet Infos) : type, zones (badges), budget annoncé vs estimé IA, pièces min/max, surface min/max, features, timing IA
- **CopilotSummary.tsx** + **NextBestAction.tsx** — Composants pour les zones 2-3 (mode mock d'abord, connecté à Edge Function ai-copilot en Sprint 5)

### Sprint 3 (Semaine 5-6) — Migration CRM Étapes 3-4

#### Étape 3 — Pipeline Kanban 12+ colonnes (3-4 jours)
- **PipelineKanban.tsx** refactorisé avec dnd-kit — 14 colonnes :
  1. Nouveau lead (gray-400) → 2. À qualifier (gray-500) → 3. Recherche active (blue-500) → 4. Visite planifiée (cyan-500) → 5. Visite effectuée (teal-500) → 6. Intérêt confirmé (green-500) → 7. Offre (emerald-600) → 8. Négociation (amber-500) → 9. Réservé (orange-500) → 10. Financement (purple-500) → 11. Notaire (indigo-600) → 12. Signé (green-700) | Perdu (red-500) | À relancer (yellow-500)
- Scroll horizontal obligatoire. Colonnes "Perdu" et "À relancer" visuellement distinctes (opacité réduite, séparateur)
- **DealCard enrichie** : avatar contact, nom contact, adresse bien (tronquée), prix, date mise à jour en relatif, **badge orange si relance en retard** (reminders WHERE transaction_id = X AND status = 'triggered' AND trigger_at < NOW())
- Drag-and-drop → 3 actions : UPDATE transactions.stage, INSERT activity_event (stage_change avec ancien/nouveau stage), invalidation cache React Query
- Dialogue de confirmation obligatoire si drop sur "Perdu" (raison obligatoire → transactions.notes)
- Barre de résumé en haut : total deals actifs, valeur totale pipeline, deals à risque, taux de conversion

#### Étape 4 — Action Board "Quoi faire aujourd'hui" (3-4 jours)
- **ActionBoardPage.tsx** — PAGE D'ACCUEIL AGENT (première chose vue à la connexion)
- En-tête : "Bonjour [Prénom], voici votre journée" + date + compteur global "X actions recommandées"
- 5 sections par priorité décroissante :
  1. **Urgences** (bg-red-50, border-l-4 border-red-500) : deals à risque, docs manquants, relances en retard → source : daily_actions priority='urgent' + reminders en retard
  2. **Relances du jour** (bg-amber-50, border-l-4 border-amber-500) : clients à rappeler, feedbacks → source : reminders du jour
  3. **Matchs trouvés** (bg-blue-50, border-l-4 border-blue-500) : nouveaux biens compatibles → source : matches status='suggested' récents
  4. **Visites à confirmer** (bg-white) : agenda du jour → source : visits WHERE scheduled_at = TODAY
  5. **Suggestions IA** (bg-green-50, border-l-4 border-green-500) : next-best-actions → source : daily_actions category='suggestion'
- **ActionCard.tsx** : icône Lucide, titre, description courte, bouton action rapide (Appeler/Envoyer/Voir dossier), lien entité. Click → is_completed = true
- **useActionBoard(agentId)** : daily_actions non complétées + reminders actifs + visites du jour + matches non traités. staleTime 30s
- **Implémentation en 2 temps** : Phase A statique (requêtes SQL directes, sans IA — déjà utile), Phase B connectée IA (Sprint 5 — daily_actions générées par pg_cron + ai-scoring)

### Sprint 4 (Semaine 7-8) — Migration CRM Étapes 5-6

#### Étape 5 — Matching acheteurs ↔ biens (4-5 jours)
- **Logique de scoring** (Edge Function ou SQL, sans LLM) — 100 points sur 5 critères :
  - Budget (30 pts) : prix bien dans fourchette client_search
  - Zone (25 pts) : ville/canton dans search_zones
  - Type de bien (15 pts) : type = type recherché
  - Pièces/Surface (15 pts) : dans fourchettes min/max
  - Features (15 pts) : features souhaitées présentes
- **3 déclencheurs** :
  - Nouveau bien actif → matching contre tous client_searches actifs → INSERT matches score ≥ 60
  - Nouveau client/critères → matching contre toutes properties actives
  - Job pg_cron quotidien → surveillance continue pour is_active = true
- **MatchingPage.tsx** : vue globale matchs non traités, filtrables par contact ou bien
- **MatchingPanel.tsx** : intégré dans ContactDetailPage onglet Matching
- **MatchScoreCard.tsx** : photo bien, adresse, prix, score %, barre progression colorée, raisons (badges "Budget ✓", "Zone ✓", "Critères ✓"), boutons "Envoyer au client" + "Planifier visite"
- Action "Envoyer" : choix canal (email/WhatsApp), template pré-rempli depuis message_templates (property_presentation), variables remplacées, édition avant envoi, confirmation → match.status = 'sent' + activity_event + reminder auto J+3

#### Étape 6 — Système de relances (4-5 jours)
- **6 types de relances préconfigurées** :
  - Bien envoyé → J+3 → reminder agent / relance auto (email/WhatsApp)
  - Visite effectuée → J+1 → demande feedback (email/WhatsApp)
  - Lead inactif → J+30 → relance douce + nouveau bien (email)
  - Acheteur chaud non relancé → J+7 → alerte agent (notification)
  - Vendeur sans suivi récent → J+14 → alerte + suggestion update (notification)
  - Document manquant KYC → J+3 → relance client (email)
- **3 couches du moteur** :
  - Configuration : automation_rules via AutomationPage (trigger + action + delay + template + is_active)
  - Génération : pg_cron toutes les heures → Edge Function automation-engine → scanne activity_events → crée reminders
  - Exécution : reminder.trigger_at atteint → status = 'triggered' → apparaît dans Action Board
- **Principe : l'agent garde le contrôle.** Par défaut = suggestions/tâches, PAS envois silencieux. Option "envoi auto" = opt-in explicite (auto_send = true dans la règle). Même en auto, activity_event créé.
- **message_templates** : variables {{contact.first_name}}, {{property.address}}, {{property.price}}, {{agent.full_name}}, etc. Catégories : follow_up, visit_confirmation, property_presentation, post_visit, seller_update. Canal : email, whatsapp, both
- **AutomationPage.tsx** : liste règles actives (toggle on/off), formulaire création, compteur relances générées
- **ReminderList.tsx** : relances en attente + triggered, actions : marquer fait, reporter (snooze +3j), annuler
- Génération documentaire (mandat, bon de visite, fiche bien)
- KYC : liste, détail, checklist, upload documents

### Sprint 5 (Semaine 9-10) — IA & Intelligence
- Edge Functions : ai-copilot, ai-matching (enrichissement du scoring), ai-scoring (buyer/seller intelligence)
- **ActionBoardPage connecté à l'IA** (daily_actions générées par pg_cron + ai-scoring)
- **Next-best-action** par client/deal (connecte CopilotSummary + NextBestAction à Edge Function ai-copilot)
- **Buyer intelligence + Seller intelligence** (scores IA enrichis via ai-scoring)
- Copilot Panel global (commandes naturelles : résumé, relance, matching, mandat, prochaines actions)
- Edge Function ai-search (pgvector + Claude API) pour recherche conversationnelle (Phase 2 prioritaire)

### Sprint 6 (Semaine 11-12) — Communication + Portail vendeur
- **WhatsApp Business API** : envoi, réception, archivage dans timeline
- Messaging unifié (email + WhatsApp + interne) + Inbox
- **Portail vendeur** : dashboard confiance, visites, offres, documents, analyse positionnement
- Onboarding client (formulaires PP/PM)

### Sprint 7 (Semaine 13-14) — Marketplace publique + IA avancée
- **Marketplace publique** (vitrine) : ListingCard, ListingGrid, SearchPage, ListingPage, MapView, Favoris
- Recherche conversationnelle frontend (ChatSearch.tsx connecté à ai-search)
- **Copilote de négociation** (aide à la contre-offre)
- **Génération annonces multi-versions** (standard, premium, luxe, courte, social)
- **Analyse d'objections** post-visite

### Sprint 8 (Semaine 15-16) — Launch
- Responsive mobile
- Performance (lazy loading, image optimization)
- Tests end-to-end
- Déploiement Cloudflare Pages
- Onboarding pilote : Gregory + 10-20 agences
- Feedback loop → itérations

### Phase 2 (post-launch)
- Assistant vocal (speech-to-text → commandes CRM)
- Notes vocales → texte (transcription auto dans fiche client)
- ~~Recherche externe sur portails (API ou scraping légal)~~ → ✅ FAIT (RealAdvisor, 3 niveaux)
- Analytics avancés (PostHog + dashboards custom)
- Publication multiportails (export contenu vers portails)
- Adaptation comportementale relances (email ouvert, lien cliqué)
- Estimation IA (AVM) basée sur données Registre foncier + transactions publiques
- Virtual staging IA intégré (API tierce)
- ~~Dark mode~~ → ✅ FAIT (dashboard agent + portail vendeur)
- i18n (DE, EN, IT)
- Signature électronique intégrée
- Alertes matching temps réel (pg_cron → notification Action Board)
- Historique de prix externe (tracker les baisses)
- Templates de messages intelligents (relances pré-remplies contextualisées)

---

## 13. ÉTAT D'IMPLÉMENTATION (mis à jour : 26 mars 2026)

### ✅ Fonctionnalités LIVE

#### Marketplace publique (38K biens) — 24 mars 2026
- **38'514 biens** dans table `market_listings` (scrappés de RealAdvisor, 26 cantons suisses)
- Page `/acheter` connectée aux vraies données Supabase (plus de mock)
- **4 hooks** dans `useMarketListings.ts` :
  - `useMarketListings(filters)` : pagination serveur (50/page), filtres Supabase
  - `useMapPoints(filters)` : 38K points légers pour Mapbox (id, lat, lng, prix)
  - `useMarketStats(context)` : compteurs par canton/type (fonctions RPC)
  - `useMarketListing(id)` : détail d'un bien
- **MapView** avec clustering Supercluster sur 38K points
- **Contrôle qualité** : quality_score 0-100 (prix/m² par canton, surface, photos, coords)
  - 96.6% Excellent (80-100), 3.2% Bon, 0.2% Acceptable, 18 suspects masqués
  - Fonction partagée `scripts/lib/validate-listing.mjs`
  - Script `scripts/recalculate-quality.mjs` pour recalculer les scores
- **Scripts scraping** :
  - `scripts/scrape-paginated.mjs` : scraping complet (~20 min, 590 tranches de prix)
  - `scripts/scrape-delta.mjs` : mise à jour quotidienne (~3 min, 50 tranches)
  - `scripts/scrape-extra.mjs` : stratégies complémentaires (propertyType, rooms, sort)
- **Migrations SQL** : market_listings table, quality_score, RPC stats functions
- **DB** : 160 MB / 500 MB (32% du plan Nano)
- **À FAIRE** : ListingPage pas encore connectée (utilise encore mockData)

#### KYC Connecté Supabase + Screening dilisense (23 mars 2026)
- **Edge Function** `kyc-screening` déployée — appelle API dilisense (PEP + Sanctions)
- 100% connecté Supabase (plus aucun mock)
- Création de dossier KYC depuis l'interface (modal avec contact, type PP/PM, nationalité, montant, transaction liée)
- Checklist auto-générée adaptée PP/PM
- Upload documents vers Storage bucket `kyc-documents`
- Score de risque 0-100 (5 facteurs GAFI)
- Validation human-in-the-loop avec audit trail
- Menus contextuels (clic droit) sur liste, documents, checklist
- Secret requis : `DILISENSE_API_KEY`
- **RLS corrigé** : récursion `profiles` fixée avec `get_my_agency_id()` SECURITY DEFINER

#### Matching externe RealAdvisor (ancien système — remplacé par market-scraper)
- **Edge Function** `external-matching` — ancien système RSC parsing
- Limité à ~3-24 listings par page (RSC data incomplète depuis 2026)
- Remplacé par `market-scraper` v4 (API JSON + tranches de prix)
- Gardé pour compatibilité (MatchingPage onglet "Marché" temps réel)

#### MEGGA AI (Copilote IA) — enrichi 26 mars 2026
- **Edge Function** `ai-copilot` déployée — Claude Sonnet 4
- Chat libre + actions prédéfinies (résumé client, relance, KYC, analyse marché)
- System prompt spécialisé immobilier suisse (LAB, KYC, droit foncier)
- Contexte CRM injecté (contact, bien, deal actif, scores comportementaux, mémoire contact)
- **Streaming naturel** : animation de typing mot par mot avec délais variables (30-80ms)
- **Contact Memory** : `fetchContactMemory()` — charge interactions, matchs, visites, transactions pour injecter le contexte complet dans chaque requête IA
- **Context Builder** : `buildContactContext()` + `buildMarketContext()` — construit le prompt enrichi avec données CRM + marché
- Panel slide-in depuis bouton ✨ (bas à droite du dashboard)
- **Coût** : ~$0.01/requête, $5 de crédits = ~500 requêtes

#### MEGGA Score Engine v1 — 26 mars 2026
- **Edge Function** `score-engine` — algorithme de scoring comportemental
- **Migration SQL** : `20260326_002_score_engine.sql` — tables `contact_scores`, `property_scores`, `scoring_signals`, `market_changes`
- **Scoring contact (Buyer Score 0-100)** : 5 facteurs pondérés :
  - Réactivité (20%) : temps de réponse moyen aux interactions
  - Engagement (25%) : fréquence et tendance des interactions
  - Cohérence budget (20%) : budget déclaré vs biens visités (détecte budget réel)
  - Qualité visites (20%) : fiabilité (show-up rate), feedbacks, patterns de rejet
  - Conversion (15%) : progression pipeline, offres soumises, timing
- **Scoring propriété (Heat Score 0-100)** : position marché, intérêt, stagnation
- **Pipeline Health** : `usePipelineHealth` — détecte deals stagnants, leads inactifs, KYC incomplets
- **Market Radar** : `MarketRadar.tsx` — nouveaux biens, baisses de prix, retraits (basé sur `market_changes`)
- **Intent Detection** : `useIntentDetection` — analyse les messages entrants (intérêt fort, objection, urgence, désintérêt)
- **Smart Replies** : `SmartReplies.tsx` — 3 suggestions de réponse contextuelles par thread
- **Composants UI** : `ContactScoreBar`, `PropertyHeatBadge`, `MessageIntentBadge`, `PipelineHealth`
- **scrape-delta enrichi** : log les changements de prix et nouveaux biens dans `market_changes`

#### Portail vendeur (6/6 pages)
- **Accès tokénisé** : URL unique `/portail/:token` (pas de login)
- **Table** `seller_portals` : token, contact_id, property_id, status, expires_at
- **Dark/light mode** : toggle Sun/Moon dans la sidebar
- Pages complètes :
  1. **Mon bien** (MonDossierPage) : KPIs, progression mandat 6 étapes, timeline activité, agent contact
  2. **Visites** (MesVisitesPage) : planifiées/effectuées, feedbacks anonymisés, ratings étoiles
  3. **Offres** (MesOffresPage) : montants, statuts (pending/accepted/rejected/counter), barre progression vs prix demandé, conditions
  4. **Documents** (MesDocumentsPage) : 10 docs, progression 75%, alertes expiration, filtres (tous/validés/attente/manquants), zone upload
  5. **Messages** (MesMessagesPage) : conversation agent-vendeur, bulles, timestamps, séparateurs de dates, indicateurs lecture
  6. **Analyse** (AnalysePage) : prix/m² vs quartier, positionnement visuel, risque stagnation, activité hebdo, 4 biens comparables vendus

#### Contact rapide
- Modal global accessible depuis n'importe quelle page agent
- Raccourci clavier **⌘⇧C** (Mac) / **Ctrl+Shift+C** (PC)
- Champs : prénom, nom, email, téléphone, type (acheteur/vendeur/les deux), source
- Création instantanée dans Supabase via `useContacts`

#### Envoi email Resend
- **Edge Function** `send-email` déployée
- Domaine `megga.ch` configuré (DKIM + SPF vérifiés)
- Template HTML responsive avec branding MEGGA
- From : `noreply@megga.ch`

#### Google Calendar Integration — 25 mars 2026
- **Edge Function** `google-calendar-sync` — 7 actions (save_tokens, list/create/update/delete events, sync_all, disconnect)
- **Hook** `useGoogleCalendar` — connexion OAuth, sync bidirectionnelle, events Google dans CalendarPage
- **Migration SQL** : tables `google_calendar_tokens` + `calendar_sync` avec RLS
- **CalendarPage** : événements Google affichés en violet (lecture seule), auto-sync au CRUD visites
- **Auth callback** : capture `provider_token` + `provider_refresh_token` si `gcal=1`
- **Prérequis** : Google Cloud Console (Calendar API activée) + secrets `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **Statut** : code prêt, en attente de configuration Google Cloud Console (mode Testing)

#### Outlook Calendar Integration — 26 mars 2026
- **Edge Function** `outlook-calendar-sync` déployée — Microsoft Graph API, 7 actions (save_tokens, list/create/update/delete events, sync_all, disconnect)
- **Hook** `useOutlookCalendar` — même pattern que Google Calendar (React Query, mutations, OAuth Azure)
- **Migration SQL** : tables `outlook_calendar_tokens` + `outlook_calendar_sync` avec RLS
- **CalendarPage** : événements Outlook mergés, auto-sync au CRUD visites
- **Auth callback** : capture `provider_token` + `provider_refresh_token` si `?outlook=1`
- **Prérequis** : Microsoft Entra (Azure AD) app configurée + secrets `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET`
- **Statut** : code déployé, Azure configuré, provider Azure activé dans Supabase Auth

#### Settings — Audit Sécurité + Applications — 26 mars 2026
- **SecurityTab** : mot de passe connecté Supabase (`updateUser`), 2FA marqué "Bientôt disponible" (toggle désactivé), sessions marquées "Bientôt disponible" (boutons désactivés), journal de sécurité connecté `activity_events`, Google OAuth link/unlink avec feedback succès/erreur
- **Applications** : refonte style Stripe Marketplace — 9 apps en grille 3 colonnes avec logos SVG officiels, filtres par catégorie (Tous, Connectés, Calendrier, CRM, Outils)
  - **Connectable** : Google Calendar (OAuth + sync), Outlook Calendar (OAuth Azure + sync)
  - **Bientôt** : Salesforce, HubSpot, Pipedrive, Import/Export CSV, PostHog, Google Drive, OneDrive
  - **Supprimés** : Resend (infrastructure interne, pas visible agent), Zoho CRM (rare en Suisse), Freshsales (inexistant sur ce marché)
- **Notifications** : refonte compact — grille checkboxes avec colonnes Email/Push + "Tout activer"
- **Portails immobiliers** supprimés (pas d'API publique — SMG/Homegate/ImmoScout24 = jardin fermé)

#### Audit technique dashboard — 26 mars 2026
- **Routes corrigées** : `/portal` → `/portail` (Navbar + AuthCallback), lien `/aide` mort supprimé
- **ContactsPage** connectée à Supabase via `useContacts()` (était mock)
- **MessagesPage** compose modal utilise vrais contacts Supabase (était hardcodé)
- **ActionBoardPage** salutation dynamique via `useAuth().profile` (était "Gregory" hardcodé)
- **Hooks dépréciés supprimés** : `useMatchingMock.ts`, `useContactDetail.ts`
- **Button default variant** corrigé : `bg-accent text-white` → ghost style conforme design system
- **MessagesPage redesign** : layout centré (max-w-5xl), fonds solides (bg-theme-sidebar / bg-theme-card), bulles modernisées, input bar élevée, indicateur non-lu en barre accent latérale

#### Page Privacy — 25 mars 2026
- Route `/privacy` — politique de confidentialité conforme LPD suisse (9 sections)
- Lien "Confidentialité" dans le Footer pointe vers `/privacy`
- Nécessaire pour Google OAuth consent screen

### 🔑 Secrets Supabase configurés
```
ANTHROPIC_API_KEY       → Claude API (Sonnet 4)
RESEND_API_KEY          → Envoi email via megga.ch
DILISENSE_API_KEY       → Screening PEP/Sanctions
MICROSOFT_CLIENT_ID     → Azure AD OAuth (Outlook Calendar)
MICROSOFT_CLIENT_SECRET → Azure AD OAuth (Outlook Calendar)
```

### 📊 Supabase
- **Project ref** : eayczugyrvmtqnnmvjod
- **Region** : eu-west-1 (Ireland)
- **Plan** : Nano (gratuit)
- **Tables** : agencies, profiles, contacts, properties, listings, transactions, kyc_cases, kyc_checklist_items, documents, messages, message_threads, favorites, activity_events, listing_embeddings, daily_actions, client_searches, matches, reminders, automation_rules, message_templates, visits, external_listings, seller_portals, google_calendar_tokens, calendar_sync, outlook_calendar_tokens, outlook_calendar_sync, contact_scores, property_scores, scoring_signals, market_changes

### DB — Corrections RLS appliquées (2026-03-23)
- Récursion infinie `profiles` → fixée avec `get_my_agency_id()` SECURITY DEFINER
- Policies `contacts`, `documents`, `activity_events` → migrées vers `get_my_agency_id()`
- Policies ouvertes temp sur `kyc_cases`, `kyc_checklist_items`, `contacts` (anon read)
- **À nettoyer pour la prod** : supprimer les policies `anon` et forcer `authenticated` partout

### Prochaines priorités
1. **Google Calendar** — configurer Google Cloud Console (mode Testing) + tester OAuth flow
2. **Outlook Calendar** — tester le flow OAuth Azure complet (bouton Connecter → sync)
3. **Score Engine v2 — Location Intelligence** — enrichir les scores avec données externes suisses :
   - Swisstopo (exposition solaire, altitude)
   - transport.opendata.ch (gares, temps de trajet)
   - OpenStreetMap (commerces, écoles, parcs à proximité)
   - sonBASE (carte de bruit)
   - OFS (démographie, revenus par commune)
4. **Market Radar temps réel** — notifications instantanées quand un bien avant-première matche un client
5. **Matching enrichi par Score Engine** — scoring client_searches × market_listings + comportement (refus, budget réel)
6. **Import/Export CSV** — migration depuis Pipedrive/HubSpot/Excel
7. **ListingPage connectée** — remplacer getListingById(mockData) par useMarketListing(supabase)
8. **PipelinePage connectée** — remplacer MOCK_DEALS par useTransactions()
9. **Briefing matinal IA** — résumé narratif quotidien des mouvements marché + actions prioritaires
10. **i18n pages agent** — ContactsPage, ContactDetailPage, Navbar (texte français hardcodé)
