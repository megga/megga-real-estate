# CLAUDE.md — MEGGA Real Estate

> Source de vérité pour Claude Code. Lis-le avant de coder.
>
> **Docs détaillés (externalisés pour économiser des tokens) :**
> - Schéma DB complet : [docs/schema.md](docs/schema.md)
> - Pages MVP (42 écrans) : [docs/pages.md](docs/pages.md)
> - Modules IA (specs Gregory) : [docs/ai-modules.md](docs/ai-modules.md)
> - Design system patterns : [docs/design-system.md](docs/design-system.md)
> - Roadmap sprints : [docs/roadmap.md](docs/roadmap.md)
> - Changelog : [docs/CHANGELOG.md](docs/CHANGELOG.md)

---

## 1. PROJET

**Nom :** MEGGA Real Estate — SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (26 cantons, 4 langues)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend — Claude Code gère le backend)

**Vision :** Compliance-First Transaction OS — CRM transactionnel verticalisé + pipeline LAB/KYC + portail vendeur + copilote IA métier + marketplace publique.

**5 objectifs (Document Maître) :** Toute fonctionnalité doit servir au moins 1 :
1. Réduire le temps administratif
2. Réduire le risque LAB/KYC
3. Accélérer le closing
4. Augmenter la transparence client
5. Remplacer un outil fragmenté

**Positionnement :** System of record + workflow engine + rules engine + AI copilot. L'IA est compliance-enabling, PAS compliance-replacing. Validation humaine obligatoire.

---

## 2. STACK TECHNIQUE

```
Frontend :     React 18+ / TypeScript / Vite / Tailwind CSS 3
UI Kit :       shadcn/ui + Radix UI
State :        React Query (TanStack Query)
Routing :      React Router v6
Forms :        React Hook Form + Zod
Drag & Drop :  dnd-kit (pipeline Kanban)
Maps :         Mapbox GL JS (react-map-gl)
Icons :        Lucide React
Charts :       Recharts
i18n :         react-i18next (FR/DE/EN/IT)

Backend :      Supabase Pro (eayczugyrvmtqnnmvjod, eu-west-1)
               PostgreSQL 15+ / Edge Functions (Deno) / Auth / Storage / Realtime / pgvector / pg_cron
IA :           Claude API (Sonnet 4) via Edge Functions
Email :        Resend (megga.ch DKIM/SPF)
Payments :     Stripe
Hosting :      Cloudflare Pages
CI/CD :        GitHub Actions → Cloudflare Pages + Supabase Edge Functions auto-deploy

Marketplace :  33'000+ biens Flatfox (rent) synchés via pg_cron quotidien (04:00 UTC)
               8 types : apartment, house, villa, commercial, office, parking, storage, land
               Source Flatfox CDN pour les photos (cdn.flatfox.ch)
```

### Commandes

```bash
npm run dev          # Dev server localhost:5173
npm run build        # Build production (tsc + vite)
npm run lint         # ESLint
```

---

## 3. DESIGN SYSTEM

> Patterns détaillés (composants, exemples TSX) : voir [docs/design-system.md](docs/design-system.md)

**Direction :** Minimal, transparent, professionnel (Linear/Notion style). Dark/light mode sur dashboard agent.

**Règles visuelles clés :**
- Bentos : `rounded-xl border border-theme-border` — PAS d'ombres
- Boutons : style ghost `border border-theme-border text-theme-secondary` — JAMAIS `bg-accent text-white`
- Badges : texte coloré sans fond (`text-red-500`, pas `bg-red-100 text-red-800`)
- Modals : TOUJOURS `createPortal(document.body)` avec `z-[100]`
- Steppers : monochrome (numéros + underline), pas de dots colorés
- Scrollbars : `.scrollbar-hide` sur modals et pipeline
- Notifications sidebar : pas de dot rouge par défaut (système Messages retiré du CRM agent)

**Thème CSS Variables :**
```
Dark mode :   Page #1C1C1C | Cards #2A2A2A | Borders #383838 | Text #ECECEF | Muted #8E8E96
Tokens :      bg-theme-page, bg-theme-card, bg-theme-section, bg-theme-sidebar, bg-theme-hover, bg-theme-active
              text-theme-primary, text-theme-secondary, text-theme-tertiary, text-theme-muted
              border-theme-border, border-theme-border-subtle
```

**JAMAIS utiliser** : `bg-white`, `text-gray-900`, `border-gray-200` (cassent le dark mode), `shadow-card`, `shadow-sm`

**Typo :** DM Sans 400/500/600/700. Hero 4xl, Page 2xl, Section xl, Card lg, Body base, Small sm, Caption xs.

---

## 4. PATTERNS DE CODE

### Convention de nommage
```
Composants : PascalCase (ListingCard.tsx) | Hooks : use* (useListings.ts)
Types : PascalCase | SQL : snake_case | Edge Functions : kebab-case
```

### Pattern composant
```tsx
import { cn } from '@/lib/utils';
interface Props { listing: Listing; className?: string }
export default function ListingCard({ listing, className }: Props) {
  return <div className={cn('rounded-xl border border-theme-border', className)}>{...}</div>
}
```

### Pattern hook Supabase
```tsx
export function useListings(filters?: Filters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Pattern Supabase Realtime (IMPORTANT — bug A1 audit)
```tsx
// TOUJOURS utiliser useId() pour le channel name — sinon crash au re-mount
const channelId = useId()
useEffect(() => {
  const channel = supabase.channel(`nom-${channelId}`).on('postgres_changes', {...}).subscribe()
  return () => { supabase.removeChannel(channel) }
}, [channelId])
```

---

## 5. RÈGLES ABSOLUES

### DO ✅
- TypeScript strict (pas de `any`)
- RLS activé sur CHAQUE table Supabase
- `cn()` pour classes conditionnelles
- Prix : `CHF 720'000` (apostrophe suisse) — utiliser `formatCHF()` (type-defensive, accepte string/null)
- Labels UI en français par défaut
- Composants shadcn/ui quand ils existent
- États loading, empty, error pour chaque liste/page
- Responsive mobile-first (md: lg:)
- Human-in-the-loop : validation KYC, envoi message/document
- Audit trail : `activity_events` pour toute action (y compris IA avec `actor_id = 'ai'`)
- Scores IA affichés comme "estimation" (icône sparkle/ai)
- Timeline unifiée par contact

### DON'T ❌
- `any` en TypeScript
- Données hardcodées (tout vient de Supabase)
- localStorage pour données sensibles
- Validation KYC auto sans action humaine
- Envoi auto au client sans validation agent
- Couleurs hardcodées (`bg-white`, `text-gray-*`) → tokens thème
- `bg-accent` plein sur boutons → style ghost
- Ombres sur bentos
- Modals inline → toujours `createPortal`
- UPPERCASE dans les titres → capitalize
- Dots rouges sidebar
- Next.js / Vercel → React+Vite / Cloudflare Pages
- `console.log` en production
- Mentionner "Lovable", "Claude", "ChatGPT" dans l'interface
- IA présentée comme "automatique" ou "garantie" → "assistance"
- Fonctionnalité hors les 5 objectifs du Document Maître

---

## 6. MONNAIE ET LOCALISATION

```
Devise :     CHF (apostrophe : CHF 720'000)
Surface :    120 m²
Date :       16.03.2026 (DD.MM.YYYY) ou relatif
Langues :    FR (défaut), DE, EN, IT — react-i18next, 12 namespaces
Cantons :    GE VD VS NE FR BE JU BS BL AG SO ZH LU ZG SZ NW OW UR GL SH TG AR AI SG GR TI
```

---

## 7. PERFORMANCE & BASE DE DONNÉES

> Section ajoutée le 16 avril 2026 après des incidents de statement timeout sur 33K+ rows.

### Règles Supabase (statement timeout = 3-8s sur Pro)

| Règle | Pourquoi | Exemple |
|---|---|---|
| **JAMAIS `count: 'exact'`** sur tables > 5K rows | Cause un sequential scan complet → timeout | Utiliser `count: 'estimated'` ou pas de count |
| **JAMAIS `ORDER BY` sans partial index** sur le WHERE exact | PostgreSQL fait un sort en mémoire sur toute la table → timeout | Créer un partial index couvrant WHERE + ORDER BY |
| **JAMAIS `.in('status', [...])` quand `.eq()` suffit** | `IN` ne match pas les partial indexes | `.eq('status', 'active')` au lieu de `.in('status', ['active', 'price_reduced'])` |
| **JAMAIS SELECT colonnes lourdes en liste** | `description` (2KB/row × 33K = 66MB), `photos` (array d'URLs) | Charger `description` uniquement sur la page détail |
| **Toujours un partial index pour les filtres fréquents** | Réduit le scan de 33K rows à <1K | `CREATE INDEX ... WHERE transaction_type='rent' AND status='active' AND quality_score >= 50` |

### Index existants (market_listings)
```sql
idx_ml_rent_active_created ON market_listings (created_at DESC)
  WHERE transaction_type = 'rent' AND status = 'active' AND quality_score >= 50
idx_market_listings_tx_type_status ON market_listings (transaction_type, status, quality_score, created_at DESC)
```

### Supabase Realtime — pattern obligatoire
```tsx
// TOUJOURS useId() pour channel name — sinon crash au re-mount (StrictMode/navigation)
const channelId = useId()
const channel = supabase.channel(`nom-${channelId}`)
```
Fichiers concernés : `useAdminNotifications.ts`, `useAdminLiveFeed.ts`, `useMessaging.ts` (tous fixés).

### Formatters type-defensive
`formatCHF(amount)` et `formatRent(amount)` acceptent `number | string | null | undefined`. Retournent `'CHF —'` pour les valeurs invalides. Ne JAMAIS appeler `.toFixed()` directement sur une valeur de formulaire.

### pg_cron actifs
| Job | Schedule | Edge Function |
|---|---|---|
| `flatfox-sync-daily` | `0 4 * * *` (04:00 UTC) | flatfox-sync |
| `platform-metrics-hourly` | `15 * * * *` | admin-monitoring |

---

## 8. ÉTAT D'IMPLÉMENTATION (mise à jour : 16 avril 2026)

### Vue d'ensemble

MVP Compliance-First Transaction OS en production sur `main` (Cloudflare Pages).

**Marketplace publique :**
- `/acheter` + `/louer` : carte Mapbox 3D, comparateur, favoris, alertes email, filtres 8 types
- 33'122 biens Flatfox actifs (rent, 26 cantons, 8 types) — sync quotidien pg_cron
- Photos réelles CDN Flatfox (plus de placeholders)

**CRM agent :** 11/14 pages connectées Supabase — Contacts, Pipeline 14 colonnes, Matching, Listings, KYC (dilisense), ContactDetail, ListingForm, ActionBoard, Chat, Dashboard.

**MEGGA AI :** Edge Function ai-copilot (Claude Sonnet 4), streaming, score engine.

**Portail vendeur :** `/portail/:token` (6 pages), dev route `/portail` (PortalDevWrapper + mock data).

**Super-Admin :** 14 pages (accent violet), impersonate avec audit trail, Stripe billing, monitoring Pro (pg_cron hourly), feature flags, NPS, security audit.

**Intégrations :** Resend, Stripe, Google/Outlook Calendar (OAuth), virtual staging (Gemini), Flatfox sync.

### Secrets Supabase
```
ANTHROPIC_API_KEY, RESEND_API_KEY, DILISENSE_API_KEY,
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

### Secrets GitHub Actions
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN,
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN
```

### Supabase
- **Project ref** : eayczugyrvmtqnnmvjod | **Region** : eu-west-1 | **Plan** : Pro
- **Anon key** : hardcodée dans `src/lib/supabase.ts` (sécurité via RLS, pas par obscurité)

### Prochaines priorités
1. **Audit perf /louer** — Lighthouse, lazy images, virtualisation liste, Supercluster en worker
2. **"Mes lieux" multi-POI** — travail+école+sport sur la carte, trajet vers chaque bien
3. **Carte des prix temporelle** — overlay prix/m² avec slider 12 mois
4. **i18n** — finir migration 3 pages marketing (ServicesPage, EstimationsPage, VendrePage)
5. **Onboarding interactif** — checklist 5 étapes dans le dashboard agent
