# CLAUDE.md — MEGGA Real Estate

> Source de vérité pour Claude Code. Lis-le avant de coder.
>
> **🧠 CERVEAU SYSTÈME — à consulter AVANT toute tâche non triviale :**
> Une cartographie vivante de TOUS les rouages (archi, KYC, WhatsApp, matching, pipeline,
> copilote IA, marketplace, intégrations, signatures…) existe et doit être utilisée.
> 1. Carte lisible (point d'entrée) : [docs/system-map.md](docs/system-map.md)
> 2. Mémoire sémantique locale (0 API) :
>    `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<phrase topique>" -n megga`
>    (⚠ le flag ET la version épinglée sont nécessaires — sans eux la recherche répond
>    « no results » sur un cerveau plein. ⚠ Interroger par une PHRASE, jamais par un mot-clé :
>    un mot seul passe sous le plancher de score et rend « no results » lui aussi, flag correct
>    ou non ; cf. « Maintenir le cerveau » de docs/system-map.md)
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

**🎨 DIRECTION UNIQUE = MEGGA X (depuis le 10 août 2026, [PR #1194](https://github.com/megga/megga-real-estate/pull/1194)).**
**Sugar est SUPPRIMÉE** — il n'y a plus de choix, plus de préférence `megga.da`,
plus de hook `useCrmDa`, plus d'attribut `<html data-crm-da>`, plus de blocs CSS
`[data-crm-da="…"]` ni d'alias `--crm-sugar-*`. Tout ce qui parle de Sugar Pure,
de Graphite ou d'une direction alternative dans ce document ou dans le cerveau
décrit désormais le PASSÉ.

Mécanique, à connaître avant de toucher au style :
1. **Couleurs** — `crmSugarPalette(dark)` rend `mxCrmPalette(dark)`. Le nom a
   survécu à la direction qu'il servait (33 points de construction et le type
   `SugarPalette`) ; le renommer est un geste lexical à part.
2. **Police et grammaire** — variables CSS déclarées dans le `:root` de
   [globals.css](src/styles/globals.css). Elles étaient une surcharge posée sur
   un sélecteur de direction ; la direction retirée, elles SONT l'échelle.
3. **Grammaire tokenisée** — rayons, espacements et tailles de texte ne sont pas
   des littéraux : ~4200 valeurs en variables CSS sur 161 fichiers, échelle
   normalisée à 13 barreaux de texte. **Écrire un littéral de rayon/espacement/
   taille dans un composant est une régression.**
4. **L'élément ACTIF porte l'accent `#424bfb`** (décision Julien, 10 août 2026).
   Remplace la règle Sugar Pure « l'accent EST l'encre », qui peignait l'actif en
   encre inversée — donc en non-couleur. ⚠ Exception : la pastille d'avatar est
   déjà l'accent, son état ouvert garde `sp.ink` pour contraster.

**Où vit quoi** — la distinction compte pour ne pas créer une seconde échelle :
[megga-x-crm/tokens.ts](src/components/megga-x-crm/tokens.ts) ne porte que la
**couleur** (ce qui alimente `mxCrmPalette()`) ; la **grammaire et la police**
sont des variables CSS, parce qu'elles doivent pouvoir basculer sur un conteneur.
[megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts) verrouille les
deux : les couleurs contre les variables de la vitrine, et le bloc CSS lui-même —
chaque rayon et chaque espacement doit être un barreau réel de la feuille.

⚠ Le **texte** s'en écarte volontairement sur **11 et 13 px**, absents de la
vitrine (ses tailles sautent 10 → 12 → 14). Le CRM a besoin de ces demi-pas. Le
test fige cet écart au lieu de l'interdire : en ajouter un demande de l'écrire,
donc d'en décider.

Les deux routes de décision (`/design-system/da-compare`, `/design-system/pipeline-mx`)
ont été retirées le 9 août 2026, la direction étant tranchée.

**Direction :** Minimal, transparent, professionnel (Linear/Notion style). Dark/light mode sur dashboard agent.

**⚠ « Sugar Pure » — HISTORIQUE.** Sa grammaire (ombre douce sans bordure,
accent noir unique, pilules à fond plein) a régi Pipeline, modale Nouveau deal et
fiche deal V4 de juillet 2026 au 10 août 2026. Ces surfaces sont passées à
MEGGA X. Ce qui SUBSISTE d'elle : les teintes d'étape `SG_STAGE_HUE` et les
dérivations `sgMix`, gardées parce qu'elles **encodent une information** (l'étape
du deal), pas parce qu'elles décorent.

**🌒 Sombre — échelle MEGGA X.** L'échelle « Graphite » (`#12161C`→`#21242F`,
5 paliers) ne peint PLUS le CRM : ses 110 appels à `crmStep` ont été repris, et
`crmStep`, le choix de teinte (Graphite / Noir pur), `useDarkTone` et
`megga.darkTone` sont supprimés. Le **mode** sombre est conservé.

Correspondance appliquée, **par rôle et non par numéro** — Graphite *montait* ses
sous-surfaces, MEGGA X les *creuse* :

| Rôle | Token | Valeur |
|---|---|---|
| canvas | `sp.pageBg` | `#030303` |
| cadre bento, rail, top nav | `sp.frameBg` | `#050505` |
| carte, colonne, ligne | `sp.cardBg` | `#090909` |
| sous-carte **creusée** | `sp.cardSubBg` | `#050505` |
| survol, **élevée** | `sp.focusSurface` | `#181818` |
| flottante (modale, popover) | `sp.solidBg` | `#090909` |

1. **La séparation vient de la BORDURE**, pas de l'écart de luminance —
   `sp.shadow` vaut `'none'` en sombre, comme la vitrine. Écart mesuré
   canvas↔carte : 1,078:1 (Graphite) → **1,036:1** (MEGGA X).
2. ⛔ **Un élément posé sur une surface TEINTÉE reste un VOILE translucide**, pas
   un palier opaque. La migration Graphite avait converti mécaniquement les
   pastilles « + » des colonnes du pipeline en S3 opaque : des blocs gris au
   milieu de colonnes colorées.
3. ⛔ **L'accent `#424bfb` ne passe pas l'AA en TEXTE sur sombre** (3,44:1). En
   aplat il tient (5,78:1, c'est l'encre blanche qui porte). Pour une encre
   teintée sur sombre : `MXC_SYSTEM.blue300` (#8dc1ff, 10,6:1).
4. ⛔ **Les couleurs de système de la vitrine sont PÂLES** — réglées pour un
   canvas `#030303`. Sous encre blanche : 1,7:1. Sous `n100` : 11–19:1. Un
   remplissage pâle prend TOUJOURS l'encre sombre.

Garde-fous : [megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts)
(couleurs = barreaux réels de la vitrine, seuils AA, aucune police en dur, aucun
lecteur de `CrmTheme.primary`) et
[graphite-scale.spec.ts](tests/unit/graphite-scale.spec.ts) (aucune palette
d'écran n'est restée sur Graphite).

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
MEGGA_MAGIC_LINK_HMAC_SECRET,
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_IDENTITY_FLOW_ID,
MAPBOX_TOKEN,
UID_REGISTER_API_URL, UID_REGISTER_API_CREDENTIAL
```

> ⚠ **`STRIPE_IDENTITY_FLOW_ID` n'est pas un secret, mais il doit rester hors du dépôt.**
> C'est l'identifiant (`vf_…`) du flux de vérification configuré dans le tableau de bord
> Stripe (Identity, décision du 03.08.2026 : passeport + carte d'identité, selfie exigé,
> capture en direct, ni numéro de pièce ni e-mail ni téléphone). Le mode TEST et le mode
> RÉEL en portent **deux distincts** — en figer un dans le code casserait l'autre, même
> raison que les `STRIPE_PRICE_*`. Absent, `kyb-identity-verify` retombe sur les mêmes
> options posées en clair : le parcours tourne, il n'échoue pas.
>
> ⛔ **`MEGGA_APP_URL` doit rester ABSENTE — ne pas « réparer » son absence.** Constaté le
> 03.08.2026 : elle n'est posée nulle part, et c'est la bonne configuration. Son repli en
> dur, `https://app.megga.ch`, est la valeur qui sert réellement les quatre parcours
> publics — mesuré, `/kyc/…`, `/kyc-report/…`, `/accept-invite/…` et
> `/visite/…/modifier` rendent **200 sur `app.megga.ch` et 401 sur `megga.ch`** (la
> vitrine est protégée par mot de passe et ne connaît aucune de ces routes).
>
> La poser n'ajoute donc aucune capacité, seulement deux façons de casser les liens : une
> faute de frappe, ou le plan archivé
> `docs/superpowers/plans/2026-06-02-whatsapp-kyc-report-pdf.md` qui donne
> `MEGGA_APP_URL=https://megga.ch` en exemple. La suivre remplacerait une panne visible par
> une panne qui ressemble à un site vivant.
>
> À poser UNIQUEMENT le jour où l'app changerait de domaine — et alors sur le domaine de
> l'APP, avec le schéma, sans chemin (le segment `/kyc` appartient à la route, pas au
> réglage). Lecteurs : `_shared/app-url.ts` — qui porte les quatre constructeurs
> (`kycMagicLinkUrl`, `visitManageUrl`, `teamInviteAcceptUrl`, `kycReportRenderUrl`) — et
> `appointment-book`, seule fonction à garder sa propre lecture (elle accepte en plus un
> repli `APP_URL`, et fige la valeur dans une `const` de module).

> ✅ **`MEGGA_MAGIC_LINK_HMAC_SECRET` EST configuré** (mesuré le 03.08.2026) — il manquait
> simplement à cet inventaire. Il signe les jetons publics du lien magique KYC ET des liens
> de réception acheteur (`_shared/magic-link-token.ts`, ≥ 32 caractères exigés à la
> signature). Sans lui, les deux parcours échouent **fermé** — `verifyMagicLinkToken` rend
> `no_secret` et tout lien est refusé — donc son absence casse la fonctionnalité sans ouvrir
> de faille.
>
> Méthode, réutilisable pour tout secret d'edge : interroger la fonction déployée avec un
> faux jeton de syntaxe valide et lire le motif. Le secret est vérifié AVANT la signature,
> donc `no_secret` ⇒ absent, `invalid_signature` ⇒ présent. ⚠ Cet oracle disparaît avec la
> PR #1114, qui réduit le motif rendu aux appelants anonymes à `expired`/`invalid` — il
> renseignait un tiers sur la configuration du déploiement.

> ⚠ **`MAPBOX_TOKEN` n'est PAS configuré** (constat du 01.08.2026, [issue #1061](https://github.com/megga/megga-real-estate/issues/1061)).
> Il est distinct de `VITE_MAPBOX_TOKEN` (secret GitHub Actions, injecté au build du bundle
> navigateur). Le connecteur de géocodage KYB tourne dans une Edge Function, côté serveur :
> il lui faut le jeton dans les secrets Supabase, pas dans le build. Sans lui, le check
> `address_geocode` produit `unavailable` — et contrairement à ce que cette note affirmait,
> **ça ne « retire pas juste un signal » : ça empêche tout score d'exister**. Le moteur exclut
> `unavailable` du numérateur ET du dénominateur, or les trois seuls checks scorables
> (`vat_lookup` 3.00, `address_geocode` 1.50, `domain_whois_age` 0.75) sortent tous
> `unavailable` aujourd'hui → `verification_score = NULL` pour tout dossier suisse, et la file
> de revue trie sur des `NULL`.
>
> « La même valeur convient » **reste à vérifier** : si le jeton porte une restriction URL
> referrer, il fonctionnera dans le navigateur et échouera depuis l'Edge Function (appel sans
> referrer). Il faudra alors un second jeton public sans restriction, scope `geocoding`.

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
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN (⚠ vide — voir ci-dessous),
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN
```

> ⚠ **`VITE_MAPBOX_TOKEN` est listé ici mais vide au build** ([issue #1061](https://github.com/megga/megga-real-estate/issues/1061)).
> Les 290 fichiers déployés de `app.megga.ch` et `megga.ch` ont été inspectés le 01.08.2026 :
> aucun littéral `pk.`, alors que `MrhMapbox.tsx` lit `import.meta.env.VITE_MAPBOX_TOKEN` au
> niveau module — la valeur devrait y être figée. Conséquence : les cartes du CRM affichent
> le repli « Carte indisponible ». Les secrets GitHub n'étant pas lisibles, l'absence est
> déduite des artefacts, pas vérifiée à la source.

### Supabase
- **Project ref** : eayczugyrvmtqnnmvjod | **Region** : eu-west-1 | **Plan** : Pro
- **Anon key** : hardcodée dans `src/lib/supabase.ts` (sécurité via RLS, pas par obscurité)

### Prochaines priorités

**🔴 Bloquant en production — [issue #1061](https://github.com/megga/megga-real-estate/issues/1061) : jeton Mapbox absent partout.**
Deux secrets à poser, deux effets distincts, constatés le 01.08.2026 :
- `VITE_MAPBOX_TOKEN` (GitHub Actions) est **vide au build** → les cartes du CRM sont mortes
  (Matching · Recherche affiche le repli « Carte indisponible »). Vérifié en inspectant les
  290 fichiers déployés de `app.megga.ch` + `megga.ch` : zéro littéral `pk.`. Exige un
  redéploiement, la valeur étant figée au build.
- `MAPBOX_TOKEN` (secrets Supabase) absent → `address_geocode` = `unavailable`, donc
  **`verification_score` reste `NULL` pour tout dossier suisse** (les 3 seuls checks
  scorables sont tous `unavailable` ; les checks tranchés sont des vétos à poids 0). Pris en
  compte sans redéploiement. C'est le geste à plus fort effet sur le KYB.

⚠ Vérifier la restriction **URL referrer** du jeton : un jeton restreint marche dans le
navigateur mais échoue depuis l'Edge Function, qui appelle sans referrer — auquel cas les
deux secrets doivent porter des valeurs **différentes**.

---

> ⚠ Liste pré-pivot (avril 2026), conservée pour mémoire. Depuis le pivot CRM-first (juin 2026), les points marketplace publique (`/louer`, « Mes lieux », carte des prix) sont gelés ; le focus actuel est le CRM agent.

1. **Audit perf /louer** — Lighthouse, lazy images, virtualisation liste, Supercluster en worker
2. **"Mes lieux" multi-POI** — travail+école+sport sur la carte, trajet vers chaque bien
3. **Carte des prix temporelle** — overlay prix/m² avec slider 12 mois
4. **i18n** — finir migration 3 pages marketing (ServicesPage, EstimationsPage, VendrePage)
5. **Onboarding interactif** — checklist 5 étapes dans le dashboard agent
