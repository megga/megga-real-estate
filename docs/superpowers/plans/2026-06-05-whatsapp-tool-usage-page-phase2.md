# Phase 2 — page super-admin « Usage des outils » (copilote WhatsApp)

> Plan autonome. Cerveau : `megga/whatsapp-observability-backlog` (MVP livré ; cette PR = phase 2).
> Worktree : `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/wa-tool-usage-page`
> (branche `claude/wa-tool-usage-page`, sur `main` à jour qui contient déjà la RPC + la table).
> **Chaque sous-agent doit commencer par `cd <worktree>`** (il démarre au cwd du dépôt principal).

## Pourquoi

Le MVP (PR #592, mergé + déployé) capture chaque appel d'outil du copilote WhatsApp dans
`whatsapp_tool_usage` et expose `get_whatsapp_tool_usage_stats(p_known_tools text[])`. Phase 2 =
une page super-admin **lecture seule** qui visualise ces stats : par outil → nb d'appels, taux
d'erreur, dernière utilisation, et surtout les **outils jamais utilisés** (en passant le catalogue
`WHATSAPP_TOOLS` via `p_known_tools`). Modèle exact : la page `/dashboard/admin/autonomy`.

## Portée

Page + hook + catalogue frontend + route + nav + i18n (4 langues). **Aucun changement backend**
(la RPC et la table existent déjà en prod). Lecture seule — MEGGA observe, aucune mutation.

## Contraintes (rappel)

- DeepSeek-only (aucune inférence ici de toute façon).
- RLS super_admin : la page est sous `SuperAdminGuard` ET la RPC garde `is_super_admin()` côté
  serveur (déjà en place). Pas de donnée cross-agence exposée à un non-super-admin.
- Design system Sugar v2 CRM (dashboard agent/admin) : `rounded-xl border border-theme-border`, PAS
  d'ombres ; badges = texte coloré sans fond ; tokens `text-theme-*` / `bg-theme-*` / `admin-accent` ;
  titres capitalize, jamais UPPERCASE. Cloner la structure de `AdminAutonomyPage`.
- i18n : 4 langues FR/DE/EN/IT synchronisées (clés identiques). Namespace `admin` (clés plates
  pointées, ex `"toolUsage.title"`) pour la page ; namespace `common` pour `nav.adminToolUsage`.
- TypeScript strict, pas de `any`.

## Référence terrain (déjà vérifiée)

- Page modèle : `src/pages/admin/AdminAutonomyPage.tsx`.
- Hook modèle : `src/hooks/useAdminAutonomy.ts` (useQuery + `supabase.rpc`, cast `as unknown as`).
- Guard : `src/components/admin/SuperAdminGuard.tsx`.
- Route : `src/App.tsx` l.191 (lazy import) + l.589 (`<Route path="admin/autonomy" …>`).
- Nav : `src/components/layout/Sidebar.tsx` l.246-260 (tableau d'items admin, `labelKey`/`href`/`icon`,
  namespace `common`). Item autonomy = l.259 (`icon: 'sparkle'`).
- i18n page : `src/i18n/locales/{fr,de,en,it}/admin.json` — **objet JSON plat à clés pointées** ;
  bloc modèle `autonomy.*` (title/subtitle/error/observeNote/empty/col.*).
- i18n nav : `src/i18n/locales/{fr,de,en,it}/common.json` — clé plate `nav.adminAutonomy`.
- Catalogue d'outils (source de vérité edge) : `supabase/functions/_shared/whatsapp-agent-router.ts`
  `TOOL_TIERS` (28 outils ; le bundle Vite ne peut PAS importer ce fichier Deno → miroir frontend).
- RPC : `get_whatsapp_tool_usage_stats(p_known_tools text[] DEFAULT NULL)` → `tool, total_calls
  (bigint→number), error_count (number), error_rate (numeric→STRING via PostgREST), last_used_at`.
  Avec `p_known_tools` = tous les noms → chaque outil apparaît (jamais utilisé ⇒ total_calls=0,
  last_used_at=null), trié par `total_calls DESC, tool`.

---

## Tâche 1 — Core : catalogue + hook + page (3 nouveaux fichiers)

### 1a. `src/lib/whatsapp-tools-catalog.ts`

Miroir frontend des 28 outils + tier. **Vérifier la liste contre `TOOL_TIERS` du router** avant de
figer (source de vérité edge).

```ts
// Catalogue des outils du copilote WhatsApp (nom + tier), MIROIR FRONTEND de la source de vérité
// edge : supabase/functions/_shared/whatsapp-agent-router.ts (TOOL_TIERS). Le bundle Vite ne peut
// pas importer le code edge (Deno) → ce miroir est maintenu à la main.
// ⚠ À garder en SYNC quand on ajoute/retire un outil côté agent.
// Sert à passer p_known_tools à get_whatsapp_tool_usage_stats pour révéler les outils JAMAIS utilisés.

export type WaToolTier = 'read' | 'auto' | 'confirm' | 'slow_async'

export interface WaToolCatalogEntry {
  name: string
  tier: WaToolTier
}

export const WHATSAPP_TOOL_CATALOG: WaToolCatalogEntry[] = [
  // read (12)
  { name: 'get_my_agenda', tier: 'read' },
  { name: 'search_contacts', tier: 'read' },
  { name: 'get_contact_brief', tier: 'read' },
  { name: 'list_followups', tier: 'read' },
  { name: 'get_matches', tier: 'read' },
  { name: 'get_daily_brief', tier: 'read' },
  { name: 'search_listings', tier: 'read' },
  { name: 'get_kyc_status', tier: 'read' },
  { name: 'summarize_group_thread', tier: 'read' },
  { name: 'check_group_leak', tier: 'read' },
  { name: 'draft_listing_copy', tier: 'read' },
  { name: 'prepare_meeting', tier: 'read' },
  // auto (7)
  { name: 'create_contact', tier: 'auto' },
  { name: 'add_note', tier: 'auto' },
  { name: 'schedule_visit', tier: 'auto' },
  { name: 'create_reminder', tier: 'auto' },
  { name: 'qualify_lead', tier: 'auto' },
  { name: 'create_deal', tier: 'auto' },
  { name: 'attach_kyc_document', tier: 'auto' },
  // confirm (7)
  { name: 'send_kyc_link', tier: 'confirm' },
  { name: 'send_client_email', tier: 'confirm' },
  { name: 'update_pipeline', tier: 'confirm' },
  { name: 'send_client_message', tier: 'confirm' },
  { name: 'send_listings', tier: 'confirm' },
  { name: 'record_offer', tier: 'confirm' },
  { name: 'open_kyc_case', tier: 'confirm' },
  // slow_async (2)
  { name: 'run_kyc_screening', tier: 'slow_async' },
  { name: 'send_kyc_report', tier: 'slow_async' },
]

export const WHATSAPP_TOOL_NAMES: string[] = WHATSAPP_TOOL_CATALOG.map((tt) => tt.name)
```

### 1b. `src/hooks/useAdminToolUsage.ts` (clone de useAdminAutonomy)

```ts
// MEGGA CRM — WhatsApp tool-usage stats admin hook.
// Reads from RPC `get_whatsapp_tool_usage_stats` (migration 20260605060100), en passant le
// catalogue d'outils (p_known_tools) pour révéler les outils JAMAIS utilisés.
// Read-only: MEGGA observe. Garde serveur is_super_admin() (la RPC lève 42501 sinon).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { WHATSAPP_TOOL_NAMES } from '@/lib/whatsapp-tools-catalog'

export interface ToolUsageRow {
  tool: string
  total_calls: number       // bigint → number (PostgREST)
  error_count: number       // bigint → number
  error_rate: number | string // numeric → string (PostgREST)
  last_used_at: string | null
}

export function useAdminToolUsage() {
  return useQuery({
    queryKey: ['admin', 'tool-usage-stats'],
    queryFn: async (): Promise<ToolUsageRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
      )('get_whatsapp_tool_usage_stats', { p_known_tools: WHATSAPP_TOOL_NAMES })
      if (error) throw error
      return (data ?? []) as ToolUsageRow[]
    },
    staleTime: 60_000,
  })
}
```

### 1c. `src/pages/admin/AdminToolUsagePage.tsx` (clone de AdminAutonomyPage)

Colonnes : Outil · Tier · Appels · Taux d'erreur · Dernière utilisation. Outils jamais utilisés
(`total_calls === 0`) : ligne atténuée + « Jamais utilisé » dans la dernière colonne. Taux d'erreur
≥ 20 % en `text-red-500` (texte coloré sans fond, conforme DS).

```tsx
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminToolUsage } from '@/hooks/useAdminToolUsage'
import { WHATSAPP_TOOL_CATALOG } from '@/lib/whatsapp-tools-catalog'

const TIER_BY_TOOL = new Map(WHATSAPP_TOOL_CATALOG.map((tt) => [tt.name, tt.tier]))

export default function AdminToolUsagePage() {
  const { t } = useTranslation('admin')
  const { data: rows = [], isLoading, error } = useAdminToolUsage()
  const total = rows.length
  const neverUsed = rows.filter((r) => r.total_calls === 0).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <Sparkles className="h-5 w-5 text-theme-secondary" />
          <h1 className="text-xl font-semibold text-theme-primary">{t('toolUsage.title')}</h1>
        </div>
        {!isLoading && (
          <p className="text-sm text-theme-tertiary mt-1">
            {t('toolUsage.subtitle', { neverUsed, total })}
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {t('toolUsage.error')}
        </div>
      )}

      {/* Observe-only notice */}
      <div className="rounded-xl border border-theme-border bg-admin-accent/5 px-4 py-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-admin-accent mt-0.5 shrink-0" />
        <p className="text-sm text-theme-secondary">{t('toolUsage.observeNote')}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-theme-border overflow-x-auto">
        <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary">
          <div className="flex-1">{t('toolUsage.col.tool')}</div>
          <div className="w-28">{t('toolUsage.col.tier')}</div>
          <div className="w-24 text-right">{t('toolUsage.col.calls')}</div>
          <div className="w-28 text-right">{t('toolUsage.col.errorRate')}</div>
          <div className="w-40 text-right">{t('toolUsage.col.lastUsed')}</div>
        </div>

        {isLoading && (
          <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Sparkles className="h-8 w-8 text-theme-border mx-auto mb-3" />
            <p className="text-sm text-theme-secondary">{t('toolUsage.empty')}</p>
          </div>
        )}

        {!isLoading && rows.map((r, i) => {
          const tier = TIER_BY_TOOL.get(r.tool)
          const never = r.total_calls === 0
          const rate = Number(r.error_rate)
          return (
            <div
              key={r.tool}
              className={cn(
                'flex items-center px-4 py-3',
                i < rows.length - 1 && 'border-b border-theme-border',
                never && 'opacity-60'
              )}
            >
              <div className="flex-1 text-sm text-theme-primary font-mono">{r.tool}</div>
              <div className="w-28 text-sm text-theme-secondary">
                {tier ? t(`toolUsage.tier.${tier}`) : '—'}
              </div>
              <div className="w-24 text-right text-sm text-theme-secondary tabular-nums">{r.total_calls}</div>
              <div className="w-28 text-right text-sm tabular-nums">
                {never
                  ? <span className="text-theme-tertiary">—</span>
                  : <span className={cn(rate >= 0.2 ? 'text-red-500' : 'text-theme-secondary')}>{(rate * 100).toFixed(1)}%</span>}
              </div>
              <div className="w-40 text-right text-sm text-theme-tertiary">
                {r.last_used_at
                  ? new Date(r.last_used_at).toLocaleDateString('fr-CH')
                  : t('toolUsage.neverUsed')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Critères :** pas de `any` ; tokens thème uniquement (pas de `bg-white`/`text-gray-*`/ombres) ; états
loading/empty/error présents ; clé dynamique `toolUsage.tier.${tier}` couverte par l'i18n (Tâche 3).

---

## Tâche 2 — Wiring : route (App.tsx) + nav (Sidebar.tsx)

### 2a. `src/App.tsx`
- Ajouter le lazy import près de l'import de `AdminAutonomyPage` (≈ l.191) :
  ```tsx
  const AdminToolUsagePage = lazy(() => import('@/pages/admin/AdminToolUsagePage'))
  ```
- Ajouter la route près de `admin/autonomy` (≈ l.589), sous `SuperAdminGuard` :
  ```tsx
  <Route path="admin/tool-usage" element={<SuperAdminGuard><AdminToolUsagePage /></SuperAdminGuard>} />
  ```

### 2b. `src/components/layout/Sidebar.tsx`
- Ajouter un item dans le tableau admin, juste après l'item `nav.adminLearning` (≈ l.260) :
  ```tsx
  { labelKey: 'nav.adminToolUsage', href: '/dashboard/admin/tool-usage', icon: 'sparkle' },
  ```
  **Vérifier** que `'sparkle'` est une clé valide de la map d'icônes du Sidebar (autonomy/learning
  l'utilisent → OK). Si une icône « métrique » mieux adaptée existe ET est mappée, la préférer ;
  sinon garder `'sparkle'`.

**Critères :** `npm run build` vert (l'import lazy résout le fichier de la Tâche 1c) ; l'item nav
apparaît dans le groupe admin.

---

## Tâche 3 — i18n : `toolUsage.*` (admin) + `nav.adminToolUsage` (common), 4 langues

**RÈGLE DURE : les 4 fichiers d'une même namespace doivent avoir le MÊME jeu de clés.** Ajouter les
clés plates pointées (ne PAS nester). Valider que chaque JSON parse après édition.

### 3a. `src/i18n/locales/{fr,de,en,it}/admin.json` — ajouter ces 15 clés (près du bloc `autonomy.*`)

FR :
```
"toolUsage.title": "Usage des outils",
"toolUsage.subtitle": "{{neverUsed}} outil(s) jamais utilisé(s) sur {{total}} — observabilité du copilote WhatsApp",
"toolUsage.error": "Impossible de charger les statistiques d'usage.",
"toolUsage.observeNote": "Chaque appel d'outil du copilote WhatsApp est tracé — l'outil, son tier, son résultat, jamais le contenu des messages. De quoi repérer les outils jamais utilisés et les taux d'erreur, et décider quoi améliorer.",
"toolUsage.empty": "Aucun appel d'outil enregistré pour l'instant.",
"toolUsage.neverUsed": "Jamais utilisé",
"toolUsage.col.tool": "Outil",
"toolUsage.col.tier": "Tier",
"toolUsage.col.calls": "Appels",
"toolUsage.col.errorRate": "Taux d'erreur",
"toolUsage.col.lastUsed": "Dernière utilisation",
"toolUsage.tier.read": "Lecture",
"toolUsage.tier.auto": "Auto",
"toolUsage.tier.confirm": "Confirmation",
"toolUsage.tier.slow_async": "Asynchrone"
```

EN :
```
"toolUsage.title": "Tool usage",
"toolUsage.subtitle": "{{neverUsed}} tool(s) never used out of {{total}} — WhatsApp copilot observability",
"toolUsage.error": "Couldn't load usage stats.",
"toolUsage.observeNote": "Every WhatsApp copilot tool call is tracked — the tool, its tier, its outcome, never message content. Spot never-used tools and error rates, and decide what to improve.",
"toolUsage.empty": "No tool call recorded yet.",
"toolUsage.neverUsed": "Never used",
"toolUsage.col.tool": "Tool",
"toolUsage.col.tier": "Tier",
"toolUsage.col.calls": "Calls",
"toolUsage.col.errorRate": "Error rate",
"toolUsage.col.lastUsed": "Last used",
"toolUsage.tier.read": "Read",
"toolUsage.tier.auto": "Auto",
"toolUsage.tier.confirm": "Confirm",
"toolUsage.tier.slow_async": "Async"
```

DE :
```
"toolUsage.title": "Tool-Nutzung",
"toolUsage.subtitle": "{{neverUsed}} Tool(s) nie verwendet von {{total}} — WhatsApp-Copilot-Observability",
"toolUsage.error": "Nutzungsstatistik konnte nicht geladen werden.",
"toolUsage.observeNote": "Jeder Tool-Aufruf des WhatsApp-Copiloten wird erfasst — das Tool, sein Tier, sein Ergebnis, nie der Nachrichteninhalt. So erkennen Sie nie genutzte Tools und Fehlerraten und entscheiden, was verbessert wird.",
"toolUsage.empty": "Noch keine Tool-Aufrufe erfasst.",
"toolUsage.neverUsed": "Nie verwendet",
"toolUsage.col.tool": "Tool",
"toolUsage.col.tier": "Tier",
"toolUsage.col.calls": "Aufrufe",
"toolUsage.col.errorRate": "Fehlerrate",
"toolUsage.col.lastUsed": "Zuletzt verwendet",
"toolUsage.tier.read": "Lesen",
"toolUsage.tier.auto": "Auto",
"toolUsage.tier.confirm": "Bestätigung",
"toolUsage.tier.slow_async": "Asynchron"
```

IT :
```
"toolUsage.title": "Utilizzo strumenti",
"toolUsage.subtitle": "{{neverUsed}} strumento/i mai usato/i su {{total}} — osservabilità del copilota WhatsApp",
"toolUsage.error": "Impossibile caricare le statistiche di utilizzo.",
"toolUsage.observeNote": "Ogni chiamata di strumento del copilota WhatsApp è tracciata — lo strumento, il suo tier, il suo esito, mai il contenuto dei messaggi. Per individuare gli strumenti mai usati e i tassi di errore e decidere cosa migliorare.",
"toolUsage.empty": "Nessuna chiamata di strumento registrata per ora.",
"toolUsage.neverUsed": "Mai usato",
"toolUsage.col.tool": "Strumento",
"toolUsage.col.tier": "Tier",
"toolUsage.col.calls": "Chiamate",
"toolUsage.col.errorRate": "Tasso di errore",
"toolUsage.col.lastUsed": "Ultimo utilizzo",
"toolUsage.tier.read": "Lettura",
"toolUsage.tier.auto": "Auto",
"toolUsage.tier.confirm": "Conferma",
"toolUsage.tier.slow_async": "Asincrono"
```

### 3b. `src/i18n/locales/{fr,de,en,it}/common.json` — ajouter `nav.adminToolUsage`

```
fr: "nav.adminToolUsage": "Usage des outils"
en: "nav.adminToolUsage": "Tool usage"
de: "nav.adminToolUsage": "Tool-Nutzung"
it: "nav.adminToolUsage": "Utilizzo strumenti"
```

**Critères :** chaque JSON parse ; jeu de clés identique entre fr/de/en/it pour chaque namespace.

---

## Vérification (orchestrateur)

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/wa-tool-usage-page
npm ci            # le worktree neuf n'a pas de node_modules
npm run build     # tsc -b + vite : VERT obligatoire
npm run lint      # si dispo
node -e "['fr','de','en','it'].forEach(l=>{JSON.parse(require('fs').readFileSync(`src/i18n/locales/${l}/admin.json`));JSON.parse(require('fs').readFileSync(`src/i18n/locales/${l}/common.json`))});console.log('i18n JSON valid')"
```

Preview (si possible) : la page est sous `SuperAdminGuard` + appelle une RPC `super_admin only`
(42501 sinon). Sans session super-admin dans le preview, on confirme surtout la compilation/route ;
ne pas prétendre l'avoir vue rendue avec données si ce n'est pas le cas.

## Revues (subagent-driven)

1. **Conformité spec** : page lecture seule, clone fidèle d'AdminAutonomyPage ; RPC appelée avec
   `p_known_tools` = catalogue ; jamais-utilisés visibles ; sous SuperAdminGuard ; i18n 4 langues
   synchro ; aucun changement backend.
2. **Qualité de code** : pas de `any` ; tokens thème (pas de `bg-white`/gris/ombres) ; catalogue
   complet (28 outils, tiers corrects vs `TOOL_TIERS`) ; typage PostgREST (`error_rate` string) géré ;
   clé i18n dynamique `toolUsage.tier.${tier}` couverte ; pas de clé i18n manquante.
3. **Revue adversariale** : que se passe-t-il si la RPC renvoie un outil hors catalogue (tier
   introuvable → `—`, pas de crash) ? si `error_rate` est `"0"` / `null` ? `toLocaleDateString` sur une
   date nulle (gardé par le ternaire) ? un non-super-admin qui force l'URL (guard + 42501) ? dérive du
   catalogue si un outil est ajouté côté agent sans MAJ du miroir (un outil non listé n'est pas passé
   en `p_known_tools` → n'apparaît pas comme jamais-utilisé : documenter la limite).

## Cerveau (dernière tâche)

Éditer `.claude-flow/knowledge/megga-memory.seed.json` (entrée
`megga/whatsapp-observability-backlog`) : marquer la phase 2 comme livrée (page
`/dashboard/admin/tool-usage`, hook, catalogue frontend, i18n) ; noter la limite « miroir catalogue
à garder en sync ». Puis `npm run ruflo:seed`.

## PR

PR vers `main`. **NE PAS merger** (l'utilisateur valide la CI).
