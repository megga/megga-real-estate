# CLAUDE.md — MEGGA Real Estate

> Source de vérité pour Claude Code. Lis-le avant de coder.
>
> **🧠 CERVEAU SYSTÈME — à consulter AVANT toute tâche non triviale :**
> Une cartographie vivante de TOUS les rouages (archi, KYC, WhatsApp, matching, pipeline,
> copilote IA, marketplace, intégrations, signatures…) existe et doit être utilisée.
> 1. Carte lisible (point d'entrée) : [docs/system-map.md](docs/system-map.md)
> 2. Mémoire sémantique locale (0 API) :
>    `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<sujet>" -n megga`
>    (⚠ le flag ET la version épinglée sont nécessaires — sans eux la recherche répond
>    « no results » sur un cerveau plein ; cf. « Maintenir le cerveau » de docs/system-map.md)
> 3. Source de la mémoire : [.claude-flow/knowledge/megga-memory.seed.json](.claude-flow/knowledge/megga-memory.seed.json)
>
> **APRÈS avoir livré une feature / un changement d'archi :** mettre le cerveau à jour
> (sinon il se périme). Routine : éditer le seed JSON (+ `docs/system-map.md` si besoin),
> puis `npm run ruflo:seed`. Détails : section « Maintenir le cerveau » de docs/system-map.md.
>
> **Docs détaillés (externalisés pour économiser des tokens) :**
> - 🧠 Carte système / rouages : [docs/system-map.md](docs/system-map.md)
> - Schéma DB complet : [docs/schema.md](docs/schema.md)
> - Pages et routes réelles (inventaire, pas spec) : [docs/pages.md](docs/pages.md)
> - Modules IA (specs Gregory) : [docs/ai-modules.md](docs/ai-modules.md)
> - Design system patterns (Sugar v2 CRM) : [docs/design-system.md](docs/design-system.md)
> - Design system Property X (Marketplace — ⚠ ARCHIVÉ, marketplace désactivée) : [docs/design-system-propertyx.md](docs/design-system-propertyx.md)
> - Roadmap sprints : [docs/roadmap.md](docs/roadmap.md)
> - Changelog : [docs/CHANGELOG.md](docs/CHANGELOG.md)
>
> **🎨 Vestiges Property X (marketplace désactivée — pivot CRM-first) :**
> Le design system Property X, ses 11 pages `/design-system/*` et le catalogue `figma-catalog.ts`
> (ainsi que le skill `figma-to-section`) ont été **retirés** avec la marketplace. Il ne subsiste
> que le **système d'icônes** utilisé par tout le CRM — `MEIcon`, `PxIconFont`, `PxSocialIcon`,
> `PxWhatsAppButton` — et les **tokens `PX.*`** ([src/components/propertyx/tokens.ts](src/components/propertyx/tokens.ts)).
> Utiliser ces tokens pour tout ce qui touche à l'iconographie ; ne pas réintroduire d'atomes Px
> de présentation (PxButton, PxBadge, PxInput…). Seule route DS survivante : `/design-system/megga-x`
> (MeggaX, port de la vitrine — voir [src/components/megga-x/](src/components/megga-x)).

---

## 1. PROJET

**Nom :** MEGGA Real Estate — SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (26 cantons, 4 langues)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend — Claude Code gère le backend)

**Vision :** Compliance-First Transaction OS — CRM transactionnel verticalisé + pipeline LAB/KYC + copilote IA métier. La marketplace publique est désactivée depuis le pivot CRM-first (juin 2026) ; son backend Flatfox reste branché pour le matching CRM (voir §8).

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
Drag & Drop :  HTML5 natif (pipeline Kanban) · dnd-kit (réordonnancement photos ListingForm)
Maps :         Mapbox GL JS (react-map-gl)
Icons :        Lucide React
Charts :       Recharts
i18n :         react-i18next (FR/DE/EN/IT)

Backend :      Supabase Pro (eayczugyrvmtqnnmvjod, eu-west-1)
               PostgreSQL 15+ / Edge Functions (Deno) / Auth / Storage / Realtime / pgvector / pg_cron
IA :           DeepSeek (deepseek-chat) pour TOUT le texte via Edge Functions — décision coût
               Vision/OCR/PDF : Gemini (Google) — DeepSeek n'a pas de vision. AUCUN Claude/Anthropic.
Email :        Resend (megga.ch DKIM/SPF)
Payments :     Stripe
Hosting :      Cloudflare Pages — 2 projets : megga-real-estate (megga.ch vitrine),
               megga-app (app.megga.ch CRM, console super-admin comprise)
CI/CD :        GitHub Actions → Cloudflare Pages + Supabase Edge Functions auto-deploy

Marketplace :  DÉSACTIVÉE (pivot CRM-first juin 2026) — /acheter /louer → vitrine megga.ch
               Backend conservé : market_listings ~173k (dont ~35k flatfox actives) + flatfox-sync
               (pg_cron 04:00 UTC)
               sert uniquement le matching CRM, aucun affichage public dans cette app
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

**⚠ Sugar Pure (Pipeline v2, juillet 2026)** : les surfaces refondues (Pipeline
kanban/liste/timeline, modale Nouveau deal, fiche deal V4) suivent la grammaire
« Sugar Pure » qui PRIME sur les règles bento ci-dessous : séparation par **ombre
douce sans bordure décorative**, accent noir unique (`sp.accent`), teintes d'étape
`SG_STAGE_HUE` + dérivations `sgMix` figées, pilules à fond plein + texte blanc.
Détails : [docs/design-system.md](docs/design-system.md) §Sugar Pure ; source
pixel = handoff `design_handoff_pipeline_refonte_v2`.

**🌒 Échelle sombre « Graphite » (défaut produit, handoff du 29 juil. 2026)** —
le sombre des surfaces Sugar n'empile plus des blancs translucides : c'est une
échelle de surfaces **OPAQUES** entre `#12161C` et `#21242F`, 5 paliers d'écart
de luminance constant, source unique `CRM_GRAPHITE`
([tokens.ts](src/components/crm-sugar/tokens.ts)).

| Palier | Valeur | Rôle | Token |
|---|---|---|---|
| S0 | `#12161C` | canvas — pages, pagers, fiches | `sp.pageBg` |
| S1 | `#161A21` | cadre bento, rail, top nav | `sp.frameBg` |
| S2 | `#1A1D26` | cards, colonnes, lignes | `sp.cardBg` |
| S3 | `#1D212A` | sous-cards, inputs, chips, hover | `sp.cardSubBg` |
| S4 | `#21242F` | **plafond** — modales, popovers, menus, ⌘K | `sp.solidBg` |

1. **Jamais de blanc translucide en REMPLISSAGE.** `rgba(255,255,255,α)` ne sert
   plus que de filet ou de voile SUR l'accent.
2. **On ne monte jamais au-dessus de S4.** Une sous-surface de modale se CREUSE
   (`solidBgSub` = S3). Toute surface flottante — menu, popover, tiroir — prend
   `sp.solidBg` + `sp.solidBorder` + `sp.solidShadow`, jamais le palier « card »
   ni le canvas.
3. **Consommer `sp.*` d'abord.** Pour un littéral local, `crmStep('s3', '<valeur
   historique>')`, uniquement dans une branche déjà gardée par `dark ? … : …`.
   Pour une palette montée une fois, **un getter** (`get card() { return
   crmStep('s2', '#17181A') }`) — sinon la valeur se fige au chargement.
4. **Teinte choisie par l'agent** (Réglages › Préférences › Apparence) :
   Graphite par défaut, Noir pur conservé ; `useDarkTone()` côté React,
   `crmDarkTone()` hors React, persistance `localStorage['megga.darkTone']`.
   `marine`/`meggaAi` sont retirés de l'offre mais restent résolvables.

Garde-fou : [tests/unit/graphite-scale.spec.ts](tests/unit/graphite-scale.spec.ts)
(plage étanche, AA de `muted`, bascule à chaud des palettes dérivées).

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

### Structure des dossiers (où va quoi) — 3 runtimes séparés

Le code vit dans **3 runtimes distincts** ; un fichier ne « déménage » pas librement de l'un à l'autre.

| Dossier | Runtime | Contenu autorisé |
|---|---|---|
| `src/` | Navigateur (bundle Vite, **TS only**) | Code d'app **importé et rendu**, rien d'autre |
| `scripts/` | Node (`node scripts/*.mjs`, brut, **aucun loader TS**) | **Exécutables** seuls ; helpers partagés → `scripts/_shared/`, fixtures de données → `scripts/_data/` |
| `supabase/functions/` | Deno (edge) | Edge functions ; code partagé → `_shared/` |

- ⛔ **JAMAIS de helper ni de donnée de script dans `src/`** : c'est le bundle navigateur, et un script Node ne peut importer ni un `.ts` ni l'arbre frontend. Un helper de script va dans `scripts/_shared/`, pas dans `src/lib/`.
- `src/lib/` et `src/hooks/` sont **PLATS volontairement** — ne PAS les réorganiser en sous-dossiers thématiques (churn massif d'imports + conflits de merge ; le plat est idiomatique, l'alias `@/` suffit). `src/components/` est foldered par thème.
- Pas de dossier vide (`.gitkeep` orphelin), pas de code mort (0 fichier non-joignable depuis `main.tsx`, 0 export mort — `npm run lint:deadcode`).
- **Avant tout déplacement/renommage** : `git mv` (préserve l'historique) + greper TOUS les usages (imports relatifs ET `@/`, docs, skills, workflows CI), corriger les chemins, puis `npm run build`.

### Documentation du code

- En-tête `/** */` par fichier (rôle, route si page, comportements non-évidents) + docstring concise par unité **exportée** (composant/hook/TSDoc lib) + commentaires **« pourquoi »** là où la logique n'est pas évidente.
- ⛔ PAS de glose ligne-à-ligne, PAS de docstring sur chaque helper trivial, PAS de commentaire qui répète le code. Le commentaire dit le **pourquoi**, pas le **quoi** ; match la densité existante.

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
- `scripts/` = exécutables seuls (helpers → `scripts/_shared/`, données → `scripts/_data/`)
- Documenter le **pourquoi** : en-tête `/** */` par fichier + docstring par export
- `git mv` + corriger tous les imports (relatifs ET `@/`) avant `npm run build`

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
- Helper ou donnée de script dans `src/` (mauvais runtime — va dans `scripts/_shared/` ou `_data/`)
- Réorganiser `src/lib/` ou `src/hooks/` en sous-dossiers (churn d'imports + conflits de merge)
- Commenter chaque ligne / docstring-er chaque helper trivial (bruit qui se périme)
- Laisser un dossier vide (`.gitkeep` orphelin) ou du code mort

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

**41 jobs actifs** au 29 juil. 2026 (relevés dans `cron.job`) — cette section n'en listait que 2.
Inventaire complet et à jour dans le cerveau : `megga/pg-cron`. Les plus structurants :

| Job | Schedule | Cible |
|---|---|---|
| `flatfox-sync-daily` | `0 4 * * *` | flatfox-sync (location) |
| `realadvisor-fresh-daily` | `30 3 * * *` | realadvisor-sync (vente, national) |
| `realadvisor-rolling-daily` | `0 22 * * *` | realadvisor-sync (1 bucket de cantons/nuit) |
| `realadvisor-probe-fire` / `-collect` | `0 * * * *` / `10 * * * *` | RPC pg_net (détection de disparition) |
| `realadvisor-probe-sweep` | `30 1 * * *` | RPC (retrait des absents confirmés) |
| `realadvisor-revive-fire` / `-collect` | `30 2 * * *` / `45 2 * * *` | RPC (résurrection) |
| `realadvisor-health-daily` | `0 9 * * *` | RPC `realadvisor_health_check` |
| `platform-metrics-hourly` | `15 * * * *` | admin-monitoring |

⚠ Identifier un job par son **jobname**, jamais par son `jobid` : il change à chaque recréation.

---

## 8. ÉTAT D'IMPLÉMENTATION (mise à jour : 14 juin 2026 — pivot CRM-first)

### Vue d'ensemble

MVP Compliance-First Transaction OS en production sur `main` (Cloudflare Pages). **Pivot CRM-first (juin 2026)** : `app.megga.ch` = CRM agent seul ; la vitrine et la marketplace publique vivent hors de cette app.

**Marketplace publique : DÉSACTIVÉE (pivot CRM-first) :**
- `/acheter` + `/louer` (+ `/buy` `/rent` `/propriete`) → `MarketplaceDisabledRedirect` vers la vitrine `megga.ch`
- Backend conservé intact : `market_listings` (~90k Flatfox, ~50k active), `flatfox-sync` (pg_cron), `matching-engine` — au service du matching CRM, pas d'un affichage public
- Atomes Px + onboarding gardés ; pages SPA marketplace + Property X retirées (PR #601/#602)

**CRM agent :** la plupart des ~18 surfaces agent connectées Supabase (le « 11/14 » était périmé) — Contacts, Pipeline v2 Sugar Pure (14 stades DB → 8 colonnes UI ; kanban teinté/liste/timeline, bento de signature, nextAction = reminders), Matching, Mes biens (pager galerie + à-suivre · wizard « Créer un bien » Sugar v2 7 étapes · fiche V4), KYC (dilisense), ContactDetail, ListingForm, ActionBoard, Chat, Dashboard, cockpit Aujourd'hui, Analytics.

**Réseau inter-agences : ❌ RETIRÉ (hors périmètre v1).** L'ancien prototype `NetworkSugarV2Page` (données d'exemple, aucun backend, jamais routé) a été supprimé lors du nettoyage code mort ; les routes `/dashboard/network` et `/dashboard/reseau` redirigent vers `/dashboard`. Le module réel (partage de biens inter-agences + RLS cross-agence + modèles PDF) reste à construire plus tard.

**MEGGA AI :** Edge Function ai-copilot (DeepSeek deepseek-chat — appel api.deepseek.com direct), streaming, score engine. **Inférence texte = DeepSeek partout** ; **vision/OCR/PDF = Gemini** (photo-vision, extract-property-pdf via `_shared/vision.ts`). **AUCUN Claude/Anthropic** (retiré ; kyc-screening = Dilisense déterministe seul).

**Portail vendeur : ❌ RETIRÉ (26 juillet 2026).** Il n'avait jamais servi — `seller_portals` comptait 0 ligne depuis sa création, aucun lien personnel n'a jamais été émis, et l'UI de création avait déjà disparu de la fiche contact. Retiré en entier : routes (`/portal*` et `/portail*` redirigent vers la vitrine), pages, `components/seller-portal/`, hooks, section « Portails vendeurs » de la console admin, drapeau de plan `sellerPortal`, edge `seller-portal-action`, et les tables `seller_portals` / `seller_preferences` (migration `20260726180000`).

**Super-Admin :** **surface du CRM** montée sous `/dashboard/admin/*` (`App.tsx` → `AdminConsoleRoute` → `AdminConsoleRoutes` → `AdminShell` + 17 pages lazy). L'application autonome `admin.megga.ch` a été retirée le 28.07.2026 : plus de `build:admin`, plus de projet Pages dédié, plus de passage de session par fragment d'URL. Accent violet réservé au repère de contexte du rail ; nav groupée en 5 sections ; chrome et atomes dans `src/components/admin/kit/`.

Accès : `AdminConsoleRoute` → `useSuperAdminGate` (UX seule) ; le mur réel est en base (`is_super_admin()` = rôle **ET** e-mail allowlisté, lu dans `auth.users`) et sur les edges (`_shared/require-super-admin.ts`). ⚠️ Aucun contrôle AAL2 : le 2FA a été retiré (#873). Entrée par le dropdown profil Sugar et ⌘K (`src/lib/adminEntry.ts`) ; chaque entrée est journalisée (`admin_console_entered`) et l'impersonation reste audit-first (`admin_log_impersonation`, bloquante) via `?impersonate=<id>`.

⚠️ Les cibles de navigation de la console DOIVENT être préfixées par `ADMIN_CONSOLE_PATH` — une cible nue tombe sur le 404 du CRM, voire sur une redirection publique. Garde-fous : `tests/unit/admin-console-paths.spec.ts` et `tests/unit/redirects-guard.spec.ts` (ce dernier interdit toute règle de bord qui expulserait `/dashboard/*` vers un autre hôte : c'est ce qui avait rendu la console injoignable).

**Intégrations :** Resend, Stripe, Google/Outlook Calendar (OAuth), virtual staging (Gemini), Flatfox sync.

### Secrets Supabase
```
DEEPSEEK_API_KEY, GEMINI_API_KEY, RESEND_API_KEY, DILISENSE_API_KEY,
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
MAPBOX_TOKEN,
UID_REGISTER_API_URL, UID_REGISTER_API_CREDENTIAL
```

> `MAPBOX_TOKEN` est distinct de `VITE_MAPBOX_TOKEN` (secret GitHub Actions, injecté au
> build du bundle navigateur). Le connecteur de géocodage KYB tourne dans une Edge
> Function, côté serveur : il lui faut le jeton dans les secrets Supabase, pas dans le
> build. La même valeur convient. Sans lui, le check `address_geocode` produit
> `unavailable`, ce qui ne casse rien mais retire un signal du score.

> ⚠ **Les deux variables du registre UID ne sont PAS configurées** (aucun secret Supabase,
> aucune entrée `supabase/config.toml`) : on ignore encore s'il existe une API séparée pour
> la TVA suisse/liechtensteinoise, ou si ce n'est qu'un champ Zefix. Le squelette de
> connecteur (étape 6 du KYB agences, `supabase/functions/_shared/kyb-sources.ts`) les lit
> déjà : vides, le check `vat_lookup` (CH/LI) produit `unavailable`, ce qui ne casse rien et
> ne change aucun verdict. Les poser **sans écrire le connecteur** ne débloque rien non
> plus, et le signale explicitement (`KybSourceNotWiredError`).
>
> `ZEFIX_API_URL` et `ZEFIX_API_CREDENTIAL` **ont été retirées de cette liste le
> 29.07.2026** : elles ne sont plus lues nulle part. Le registre du commerce suisse est
> interrogé par **LINDAS**, l'endpoint SPARQL public de la Confédération, sans clé ni
> compte. Il ne manque plus que le **statut actif/radié**, absent de LINDAS, qui plafonne le
> check `registry_lookup` à `partial` et empêche donc un dossier suisse de s'auto-valider.
> Détail : [docs/agency-kyb-handoff.md](docs/agency-kyb-handoff.md) §7bis (ce que chaque
> pays peut auto-valider) et §8 (ce qui reste suspendu).

### Secrets GitHub Actions
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN,
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN
```

### Supabase
- **Project ref** : eayczugyrvmtqnnmvjod | **Region** : eu-west-1 | **Plan** : Pro
- **Anon key** : hardcodée dans `src/lib/supabase.ts` (sécurité via RLS, pas par obscurité)

### Prochaines priorités

> ⚠ Liste pré-pivot (avril 2026), conservée pour mémoire. Depuis le pivot CRM-first (juin 2026), les points marketplace publique (`/louer`, « Mes lieux », carte des prix) sont gelés ; le focus actuel est le CRM agent.

1. **Audit perf /louer** — Lighthouse, lazy images, virtualisation liste, Supercluster en worker
2. **"Mes lieux" multi-POI** — travail+école+sport sur la carte, trajet vers chaque bien
3. **Carte des prix temporelle** — overlay prix/m² avec slider 12 mois
4. **i18n** — finir migration 3 pages marketing (ServicesPage, EstimationsPage, VendrePage)
5. **Onboarding interactif** — checklist 5 étapes dans le dashboard agent
