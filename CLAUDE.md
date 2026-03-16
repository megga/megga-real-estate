# CLAUDE.md — MEGGA Real Estate

> Ce fichier est la source de vérité pour Claude Code. Lis-le en entier avant de coder quoi que ce soit.

---

## 1. PROJET

**Nom :** MEGGA Real Estate
**Type :** SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (toute la Suisse, pas juste la Suisse romande)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend, pas de compétences backend — Claude Code gère tout)

**Vision :** Premier portail immobilier suisse "IA-first" — marketplace avec recherche conversationnelle, CRM intégré gratuit, pipeline transaction LAB/KYC, portail vendeur.

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
i18n :         (Phase 2 — FR d'abord, DE/EN/IT plus tard)

Backend :      Supabase Pro
               - PostgreSQL 15+
               - Edge Functions (Deno/TypeScript)
               - Auth (email + magic link + OAuth Google)
               - Storage (photos listings, documents KYC)
               - Realtime (messaging, notifications)
               - pgvector (embeddings listings pour recherche IA)

IA :           Anthropic Claude API via Edge Functions
               - Recherche conversationnelle (RAG + pgvector)
               - Copilote métier (résumés, suggestions, rédaction)
               - Scoring leads, next-best-action

Email :        Resend
Payments :     Stripe (abonnements agents)
Analytics :    PostHog
Hosting :      Cloudflare Pages (PAS Vercel — gratuit, pas de surprise billing)
CI/CD :        GitHub Actions → Cloudflare Pages auto-deploy
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
│   │   │   ├── PipelineKanban.tsx
│   │   │   └── DealCard.tsx
│   │   ├── kyc/
│   │   │   ├── KycCaseList.tsx
│   │   │   ├── KycCaseDetail.tsx
│   │   │   └── KycChecklist.tsx
│   │   ├── portal/              # Portail vendeur
│   │   │   ├── SellerDashboard.tsx
│   │   │   ├── SellerVisits.tsx
│   │   │   └── SellerOffers.tsx
│   │   └── messaging/
│   │       ├── Inbox.tsx
│   │       └── Thread.tsx
│   ├── pages/
│   │   ├── public/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── ListingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── agent/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ContactsPage.tsx
│   │   │   ├── PipelinePage.tsx
│   │   │   ├── ListingsPage.tsx
│   │   │   ├── KycPage.tsx
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── CalendarPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── seller/
│   │       └── PortalPage.tsx
│   ├── types/
│   │   ├── database.ts          # Types Supabase (générés)
│   │   ├── listing.ts
│   │   ├── contact.ts
│   │   ├── transaction.ts
│   │   └── kyc.ts
│   └── styles/
│       └── globals.css          # Tailwind base + custom CSS
├── supabase/
│   ├── migrations/              # SQL migrations
│   └── functions/               # Edge Functions Deno
│       ├── ai-search/           # Recherche conversationnelle
│       ├── ai-copilot/          # Copilote métier
│       └── webhooks/            # Stripe, Resend...
```

---

## 4. DESIGN SYSTEM

### 4.1 Direction esthétique

**Épuré, blanc, lumineux, professionnel, premium.**
Inspiré de la ref Dribbble (plateforme immobilière Miami — voir screenshot).

Caractéristiques clés :
- Fond blanc dominant (#FFFFFF) avec gris très léger pour les sections
- Cartes de listings avec photos HD plein format, coins arrondis 12px
- Grande barre de recherche centrale sur la home page
- Layout aéré, beaucoup d'espace blanc
- Typographie sobre et lisible
- Badges de couleur pour les statuts (Hot price, Nouveau, Exclusif...)
- Header épuré avec logo MEGGA à gauche, navigation centrée, CTA à droite

**CE QUE CE N'EST PAS :**
- Pas de dark mode (Phase 2 éventuellement)
- Pas de gradients flashy
- Pas de couleurs saturées partout
- Pas de design "dashboard SaaS gris triste" — c'est premium et lumineux

### 4.2 Couleurs

```typescript
// src/lib/constants.ts

export const colors = {
  // Primaires
  primary: {
    DEFAULT: '#1A1A1A',     // Noir quasi-pur — texte principal, logo
    50:  '#F7F7F7',
    100: '#E8E8E8',
    200: '#D1D1D1',
    300: '#B0B0B0',
    400: '#888888',
    500: '#6D6D6D',
    600: '#5D5D5D',
    700: '#4F4F4F',
    800: '#3D3D3D',
    900: '#1A1A1A',
  },

  // Accent — Bleu MEGGA (boutons CTA, liens actifs, éléments interactifs)
  accent: {
    DEFAULT: '#2563EB',     // Bleu vif — CTA principal
    hover:   '#1D4ED8',     // Bleu hover
    light:   '#EFF6FF',     // Bleu très léger — badges, backgrounds
    dark:    '#1E40AF',
  },

  // Succès / Compliance validée
  success: {
    DEFAULT: '#059669',     // Vert
    light:   '#ECFDF5',
    dark:    '#047857',
  },

  // Warning / Attention requise
  warning: {
    DEFAULT: '#D97706',     // Orange
    light:   '#FFFBEB',
    dark:    '#B45309',
  },

  // Danger / Bloqué / Hot price
  danger: {
    DEFAULT: '#DC2626',     // Rouge
    light:   '#FEF2F2',
    dark:    '#B91C1C',
  },

  // Backgrounds
  bg: {
    page:    '#FFFFFF',     // Fond principal
    section: '#F9FAFB',     // Fond sections alternées
    card:    '#FFFFFF',     // Fond cards
    sidebar: '#FAFAFA',     // Fond sidebar agent
    input:   '#F3F4F6',     // Fond champs de recherche
    overlay: 'rgba(0,0,0,0.5)',
  },

  // Borders
  border: {
    DEFAULT: '#E5E7EB',     // Bordure principale
    light:   '#F3F4F6',     // Bordure très subtile
    focus:   '#2563EB',     // Bordure focus
  },

  // Texte
  text: {
    primary:   '#1A1A1A',
    secondary: '#6B7280',
    tertiary:  '#9CA3AF',
    inverse:   '#FFFFFF',
    link:      '#2563EB',
  },
} as const;
```

### Tailwind config :

```typescript
// tailwind.config.ts — étend les couleurs par défaut
export default {
  theme: {
    extend: {
      colors: {
        accent:  '#2563EB',
        success: '#059669',
        warning: '#D97706',
        danger:  '#DC2626',
        border:  '#E5E7EB',
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        button: '8px',
        input: '10px',
        full: '9999px',
        badge: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
        navbar: '0 1px 3px rgba(0,0,0,0.05)',
        dropdown: '0 10px 40px rgba(0,0,0,0.12)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
};
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
- Position fixe à gauche, bg-sidebar, border-r
- Logo GG en haut (petit, 28px)
- Navigation verticale : icônes Lucide + labels
- Sections : Dashboard, Pipeline, Contacts, Mes biens, KYC, Messages, Calendrier
- Item actif : bg-accent/10 text-accent font-medium border-l-2 border-accent
- Item hover : bg-gray-100
- Profil agent en bas avec avatar + nom + rôle
- Compteurs (badges) : messages non lus, dossiers en attente

#### Pipeline Kanban
- Colonnes : Nouveau lead → Qualifié → Visite planifiée → Offre → Négociation → Signé
- Cards de deal : avatar contact, nom bien, prix, étape, date mise à jour
- Drag & drop via dnd-kit
- Compteur par colonne
- Couleur header colonne : gris par défaut, accent pour active

#### KYC Dossier
- En-tête : nom client, type (PP/PM), niveau de risque (badge couleur), statut global
- Checklist dynamique : items cochables, icônes vert/orange/rouge
- Section documents : upload zone, liste docs avec statut (validé, en attente, manquant)
- Journal d'audit : timeline d'événements
- Barre de progression : % complétude
- **Human-in-the-loop** : bouton "Valider le dossier" bien visible, pas de validation automatique

#### Portail Vendeur
- Vue simplifiée, pas de sidebar
- Dashboard : état du mandat, visites (compteur), offres, messages
- Timeline des activités récentes
- Accès documents
- Ton rassurant : "Votre bien est entre de bonnes mains"

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
    <div className={cn('bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow', className)}>
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

-- Contacts (acheteurs + vendeurs)
contacts (id, agency_id, first_name, last_name, email, phone, type, source, score, tags, notes, created_at)
  -- type: 'buyer' | 'seller' | 'both' | 'lead'
  -- score: 'hot' | 'warm' | 'cold'

-- Biens immobiliers
properties (id, agency_id, title, description, type, status, price, currency, rooms, bedrooms, bathrooms, surface_m2, address, city, canton, postal_code, lat, lng, photos, features, created_by, created_at, published_at)
  -- type: 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  -- status: 'draft' | 'active' | 'reserved' | 'sold' | 'archived'

-- Listings (annonces publiées)
listings (id, property_id, agency_id, title, description_ai, price_display, is_featured, is_hot, views_count, favorites_count, published_at, expires_at)

-- Transactions / Deals
transactions (id, agency_id, property_id, contact_buyer_id, contact_seller_id, assigned_to, stage, status, price_offered, price_final, mandate_type, notes, created_at, updated_at)
  -- stage: 'lead' | 'qualified' | 'visit_planned' | 'offer' | 'negotiation' | 'reserved' | 'financing' | 'notary' | 'signed' | 'closed'
  -- status: 'active' | 'on_hold' | 'cancelled' | 'completed'

-- Dossiers KYC
kyc_cases (id, agency_id, transaction_id, contact_id, type, risk_level, status, completion_pct, validated_by, validated_at, created_at)
  -- type: 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
  -- risk_level: 'low' | 'medium' | 'high' | 'unassessed'
  -- status: 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'

-- Checklist items KYC
kyc_checklist_items (id, kyc_case_id, label, category, is_required, is_completed, document_id, notes, completed_at, completed_by)

-- Documents
documents (id, agency_id, kyc_case_id, transaction_id, name, type, storage_path, size_bytes, uploaded_by, status, created_at)
  -- status: 'pending' | 'validated' | 'rejected'

-- Messages
messages (id, thread_id, sender_id, sender_type, content, read_at, created_at)
message_threads (id, agency_id, property_id, participants, last_message_at)

-- Favoris
favorites (id, user_id, listing_id, created_at)

-- Audit trail
activity_events (id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at)

-- Embeddings pour recherche IA
listing_embeddings (id, listing_id, embedding vector(1536), content_text, updated_at)
```

### Row Level Security (RLS)

```
CRITIQUE : Chaque table DOIT avoir des policies RLS activées.
- Les agents ne voient que les données de leur agence (agency_id = auth.jwt() -> agency_id)
- Les vendeurs (portail) ne voient que leurs propres transactions
- Les acheteurs (public) ne voient que les listings publiés (status = 'active')
```

---

## 7. PAGES MVP (37 ÉCRANS)

### Public (4)
1. **HomePage** — Hero avec barre de recherche IA + listings vedettes + CTA agent
2. **SearchPage** — Résultats + carte Mapbox split view + filtres + chat IA latéral
3. **ListingPage** — Fiche bien détaillée (photos, infos, carte, contact agent, estimation)
4. **LoginPage / RegisterPage** — Auth Supabase (email + Google OAuth)

### Agent Dashboard (10)
5. **DashboardPage** — KPIs, pipeline mini, dernières activités, tâches urgentes
6. **PipelinePage** — Kanban drag & drop des transactions
7. **ContactsPage** — Liste + filtres + scoring + tags
8. **ContactDetailPage** — Fiche contact, historique, transactions liées
9. **ListingsPage** — Mes biens, statuts, vues, favoris
10. **ListingFormPage** — Créer/éditer un listing (wizard multi-étapes)
11. **KycListPage** — Liste dossiers KYC, statuts, progression
12. **KycDetailPage** — Dossier KYC complet, checklist, documents, validation
13. **MessagesPage** — Inbox + threads
14. **CalendarPage** — Agenda visites, RDV (synchro Google Calendar Phase 2)

### Onboarding Client (4)
15. **OnboardingBuyerPP** — Formulaire acquéreur personne physique
16. **OnboardingBuyerPM** — Formulaire acquéreur personne morale
17. **OnboardingSellePP** — Formulaire vendeur personne physique
18. **OnboardingSellerPM** — Formulaire vendeur personne morale

### Portail Vendeur (5)
19. **SellerDashboard** — État du mandat, activité, stats
20. **SellerVisits** — Visites planifiées + retours
21. **SellerOffers** — Offres reçues
22. **SellerDocuments** — Documents liés au mandat
23. **SellerMessages** — Communication avec l'agent

### Settings (4)
24. **ProfileSettings** — Profil personnel
25. **AgencySettings** — Infos agence, branding
26. **TeamSettings** — Gestion équipe, rôles
27. **NotificationSettings** — Préférences notifications

### Génération Documents (3)
28. **TemplatesPage** — Liste templates (mandat, bon de visite, offre...)
29. **DocumentGenerator** — Sélection template + preview + export PDF
30. **DocumentViewer** — Visualisation document généré

---

## 8. RECHERCHE IA CONVERSATIONNELLE

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

---

## 9. RÈGLES ABSOLUES

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
- Audit trail : logger toute action importante dans `activity_events`

### DON'T ❌
- JAMAIS de `any` en TypeScript
- JAMAIS de données en dur (hardcoded) — tout vient de Supabase
- JAMAIS de localStorage pour les données sensibles (utiliser Supabase Auth)
- JAMAIS de validation KYC automatique sans action humaine
- JAMAIS de dark mode pour l'instant (Phase 2)
- JAMAIS de Next.js — c'est React + Vite (pas besoin de SSR, c'est un SaaS)
- JAMAIS de Vercel — c'est Cloudflare Pages
- JAMAIS de `console.log` en production
- JAMAIS mentionner "Lovable", "Claude", "Dribbble", "ChatGPT" dans l'interface ou le code
- JAMAIS afficher l'IA comme "automatique" ou "garantie" — c'est une "assistance"

---

## 10. MONNAIE ET LOCALISATION

```
Devise :          CHF (franc suisse)
Format prix :     CHF 720'000 (apostrophe comme séparateur milliers)
Format surface :  120 m²
Format date :     16.03.2026 (DD.MM.YYYY) — ou "il y a 2 heures" en relatif
Langue par défaut : Français
Cantons :         GE, VD, VS, NE, FR, BE, JU, BS, BL, AG, SO, ZH, LU, ZG, SZ, NW, OW, UR, GL, SH, TG, AR, AI, SG, GR, TI
```

---

## 11. PRIORITÉ DE DÉVELOPPEMENT

### Sprint 1 (Semaine 1-2) — Fondations
- Setup projet (Vite + React + TS + Tailwind + shadcn)
- Supabase : schema, RLS, auth
- Layout : Navbar, Footer, Sidebar
- HomePage avec hero + barre de recherche (statique d'abord)
- LoginPage / RegisterPage (Supabase Auth)

### Sprint 2 (Semaine 3-4) — Marketplace
- ListingCard + ListingGrid
- SearchPage avec filtres + résultats
- ListingPage (fiche détaillée)
- MapView (Mapbox intégration)
- Favoris

### Sprint 3 (Semaine 5-6) — Agent Dashboard
- DashboardPage (KPIs, activité récente)
- ContactsPage + ContactDetail
- ListingsPage + ListingForm (wizard)
- PipelineKanban (dnd-kit)

### Sprint 4 (Semaine 7-8) — Compliance & Transaction
- KYC : liste, détail, checklist, upload documents
- Onboarding client (formulaires)
- Pipeline transaction (stages)
- Génération documentaire (templates)
- Portail vendeur (dashboard + visites + offres)

### Sprint 5 (Semaine 9-10) — IA & Messaging
- Edge Function ai-search (pgvector + Claude API)
- Recherche conversationnelle frontend
- Messaging (threads, Realtime)
- Copilote IA (suggestions, résumés)

### Sprint 6 (Semaine 11-12) — Polish & Launch
- Responsive mobile
- Performance (lazy loading, image optimization)
- Tests end-to-end
- Déploiement Cloudflare Pages
- Onboarding pilote : Gregory + 10-20 agences
