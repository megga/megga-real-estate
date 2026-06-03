# Agent WhatsApp — Palier 3b : undo des outils auto + suggestion d'autonomie (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le filet d'undo `/annuler` du Palier 3 aux 5 autres outils **auto** de l'agent (`create_contact`, `add_note`, `schedule_visit`, `create_reminder`, `qualify_lead` — undo 30 s, `qualify_lead` revenu de façon **cohérente**), et livrer la **première UI super-admin de suggestion** qui lit `whatsapp_confirmation_log` et propose (à un humain) de monter l'autonomie d'un agent. MEGGA observe, n'élève rien toute seule.

**Architecture :** (1) On réutilise l'infra d'undo existante (`whatsapp_recent_auto_actions` + handler `/annuler`) : on élargit le `CHECK tool`, on ajoute un helper `recordAutoUndo`, et chaque outil auto enregistre de quoi se défaire. (2) Le handler `/annuler` gagne un dispatcher de rollback **par outil** + un **garde-fou** : un undo réclamé mais sans branche libère son verrou (ne brûle pas le slot). (3) `qualify_lead` capture l'état AVANT (tags + critères + recherche créée) pour un undo **atomique** (sinon état incohérent). (4) Une RPC `SECURITY DEFINER` agrège `whatsapp_confirmation_log` et flague `update_pipeline` (SEUL outil élevable) → une page `/dashboard/admin/autonomy` (accent violet, `SuperAdminGuard`) l'affiche.

**Tech Stack :** Supabase Edge (Deno/TS), PostgreSQL (migrations additives idempotentes, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, `CREATE OR REPLACE FUNCTION`), Vitest (unit purs + backend live), React 18 + Vite + React Query + react-i18next (`admin` namespace, FR/DE/EN/IT). DeepSeek-only (aucun changement de provider).

**Réf. stratégie :** [docs/strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md](../../strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md) §5 (Échelle d'autonomie). **Réf. Palier 3 (livré) :** [docs/superpowers/plans/2026-06-03-whatsapp-agent-p3-autonomy.md](2026-06-03-whatsapp-agent-p3-autonomy.md). **Cerveau :** `megga/whatsapp-agent-stability-autonomy-strategy`, `megga/megga-ai-agent-learning` (directive « MEGGA apprend l'agent »), `megga/whatsapp-copilot-lessons` (leçon 11), `megga/ai-guardrails`, `megga/kyc-non-blocking`, `megga/super-admin`, `megga/deploy-migrations-gate`.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp undo annuler outils auto qualify_lead incohérence confirmation_log suggestion super-admin autonomie" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga
npx ruflo memory get -k "megga/super-admin" -n megga
```
**Ne pas modifier le seed** pendant l'implémentation (mise à jour du cerveau = dernière tâche). Re-consulter le cerveau au début de chaque tâche.

## Contraintes dures (non négociables)

- **Socle légal IMMUABLE** : `send_client_message`, `send_listings`, `record_offer`, `open_kyc_case` restent `confirm` ; validation KYC = MLRO humain. Ce palier ne touche QUE des outils `auto` réversibles (CRM) + `update_pipeline` (déjà élevable au P3). La suggestion d'autonomie ne concerne QUE `update_pipeline` (jamais le socle légal — il ne devient JAMAIS auto, même « toujours approuvé »).
- **MEGGA ne s'auto-promeut jamais** : la RPC de suggestion *propose* à un humain (super-admin). Aucune élévation d'autonomie automatique.
- **IA = DeepSeek uniquement**. **Migrations additives + idempotentes** (`DROP CONSTRAINT IF EXISTS` puis `ADD CONSTRAINT`, `CREATE OR REPLACE`, `CREATE INDEX IF NOT EXISTS`). **Dater les migrations du jour de merge** (cerveau `deploy-migrations-gate` : sinon `deploy.yml:154` les saute en silence). `npm run build` passe avant tout push. i18n : les 4 langues (FR/DE/EN/IT) doivent rester synchronisées (skill `i18n-sync`).
- **Undo honnête** (acquis P3, à conserver) : on ne promet `/annuler` que si l'enregistrement d'undo a réussi ; on n'annonce « annulé » que si le rollback a réussi.

## Périmètre

**FAIT (ce plan) :** undo 30 s des 5 outils auto (`recordAutoUndo` + capture des ids + branches de rollback) ; `qualify_lead` undo cohérent (restaure tags + critères + supprime la recherche créée) ; garde-fou « tool sans branche libère le verrou » ; durcissements P3 différés (élargir le `CHECK tool`, purge cron 7 j de `whatsapp_recent_auto_actions`, index couvrant `INCLUDE(outcome)` sur `whatsapp_confirmation_log`) ; RPC `get_whatsapp_autonomy_suggestions` + page super-admin `/dashboard/admin/autonomy`.

**PAS fait (→ futurs plans) :** la couche d'apprentissage profonde (profil de style par agent injecté dans le SYSTEM prompt — directive `megga-ai-agent-learning` point 2) ; l'application automatique de la suggestion (le super-admin agit via le contrôle d'autonomie existant ; pas de mutation inline dans ce plan) ; l'observabilité `ai_usage_logs` WhatsApp (= Palier 4).

---

## File Structure

**Créer :**
- `supabase/migrations/<stamp>_p3b_auto_undo_widen_check.sql` — élargit `whatsapp_recent_auto_actions.tool` CHECK + purge cron 7 j + index couvrant confirmation_log.
- `supabase/migrations/<stamp>_whatsapp_autonomy_suggestions_rpc.sql` — RPC `get_whatsapp_autonomy_suggestions` (SECURITY DEFINER).
- `tests/backend/whatsapp-auto-undo.spec.ts` — spec live : rollback `create_contact` + `qualify_lead` cohérent + winner-take-one.
- `tests/backend/whatsapp-autonomy-suggestions.spec.ts` — spec live : RPC suggère `update_pipeline` (≥10 oui/0 non, autonomy≠resume), jamais le socle légal.
- `src/hooks/useAdminAutonomy.ts` — hook React Query sur la RPC.
- `src/pages/admin/AdminAutonomyPage.tsx` — page super-admin (accent violet).

**Modifier :**
- `supabase/functions/_shared/whatsapp-actions.ts` — `recordAutoUndo` (helper) ; `logTimeline` renvoie l'id ; câblage undo dans `execCreateContact`, `execAddNote`, `execScheduleVisit`, `execCreateReminder`, `execQualifyLead`.
- `supabase/functions/_shared/whatsapp-agent-router.ts` — `isUndoableAutoTool` (pur) + test.
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — test de `isUndoableAutoTool`.
- `supabase/functions/_shared/whatsapp-i18n.ts` — `undoHint`, `undoneAuto`, `undoNoun`.
- `supabase/functions/whatsapp-webhook/index.ts` — extraire `rollbackAutoAction` (inclut le `update_pipeline` du P3) + branches par outil + garde-fou « libère le verrou ».
- `src/App.tsx` — route `/dashboard/admin/autonomy` (lazy + `SuperAdminGuard`).
- `src/i18n/locales/{fr,de,en,it}/admin.json` — clés `autonomy.*`.

**Contrats de payload undo (définis UNE fois — réutilisés Task 3/4/5) :**
```
update_pipeline : { transaction_id, old_stage }                              (P3, existant)
create_contact  : { contact_id }
add_note        : { event_id }                                              (id activity_events)
schedule_visit  : { visit_id }
create_reminder : { reminder_id }
qualify_lead    : { contact_id, old_tags, old_search_criteria, created_search_id }   (created_search_id nullable)
```

---

## Task 1 : Migration — élargir le `CHECK tool` + purge cron + index couvrant

> Dette technique P3 (notée dans la PR #563) réglée ici, car ce palier ajoute des `tool` à `whatsapp_recent_auto_actions` et bâtit l'UI qui lit `whatsapp_confirmation_log`.

**Files:**
- Create: `supabase/migrations/<stamp>_p3b_auto_undo_widen_check.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Palier 3b. (1) Élargit le CHECK tool de whatsapp_recent_auto_actions aux 5 outils auto
-- désormais annulables (en plus de update_pipeline). DROP IF EXISTS + ADD = idempotent et
-- ré-applicable le même jour. (2) Purge cron quotidien (>7 j) de la table d'undo (dette P3,
-- pas de FK, croissance sinon illimitée). (3) Index couvrant INCLUDE(outcome) sur le journal
-- de confirmations pour la RPC de suggestion (agrège oui/non par agent+outil).

BEGIN;

-- (1) CHECK élargi. Le nom auto-généré au P3 est whatsapp_recent_auto_actions_tool_check.
ALTER TABLE public.whatsapp_recent_auto_actions
  DROP CONSTRAINT IF EXISTS whatsapp_recent_auto_actions_tool_check;
ALTER TABLE public.whatsapp_recent_auto_actions
  ADD CONSTRAINT whatsapp_recent_auto_actions_tool_check
  CHECK (tool IN ('update_pipeline','create_contact','add_note','schedule_visit','create_reminder','qualify_lead'));

-- (3) Index couvrant pour get_whatsapp_autonomy_suggestions (count oui/non par profile_id+tool).
CREATE INDEX IF NOT EXISTS idx_wa_confirmation_log_profile_tool_outcome
  ON public.whatsapp_confirmation_log (profile_id, tool)
  INCLUDE (outcome, created_at);

COMMIT;

-- (2) Purge cron quotidien (hors transaction : pg_cron.schedule). Idempotent : unschedule-si-existe
-- puis schedule. Guardé sur la présence du schema cron (comme les crons existants).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-recent-auto-actions-purge') THEN
      PERFORM cron.unschedule('whatsapp-recent-auto-actions-purge');
    END IF;
    PERFORM cron.schedule(
      'whatsapp-recent-auto-actions-purge',
      '30 4 * * *',
      $purge$DELETE FROM public.whatsapp_recent_auto_actions WHERE created_at < now() - interval '7 days';$purge$
    );
  END IF;
END $$;
```

> ⚠️ Avant d'écrire : vérifier le NOM réel de la contrainte CHECK posée au P3 (`\d whatsapp_recent_auto_actions` ou la migration `*_whatsapp_recent_auto_actions.sql` — Postgres auto-nomme `whatsapp_recent_auto_actions_tool_check`). Si le nom diffère, adapter le `DROP CONSTRAINT IF EXISTS`. Vérifier le pattern cron exact d'un cron existant (ex. `20260603110200_whatsapp_async_jobs_purge_cron.sql`) et le reproduire.

- [ ] **Step 2 : Vérifier** — le CHECK élargi accepte les 6 outils ; les inserts P3 (`update_pipeline`) restent valides. Idempotence : `DROP CONSTRAINT IF EXISTS` + `CREATE INDEX IF NOT EXISTS` + unschedule-avant-schedule.

- [ ] **Step 3 : Commit**
```bash
git add supabase/migrations/*_p3b_auto_undo_widen_check.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): élargit CHECK tool undo (5 outils auto) + purge cron + index confirmation_log (P3b)"
```

---

## Task 2 : `recordAutoUndo` + `isUndoableAutoTool` + i18n (TDD pour le pur)

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.test.ts`
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`
- Modify: `supabase/functions/_shared/whatsapp-i18n.ts`

- [ ] **Step 1 : Test (échoue)** — ajouter à `whatsapp-agent-router.test.ts` (mirror du style existant — `import { isUndoableAutoTool } from './whatsapp-agent-router'`, voir comment `canLeaveConfirm` est importé/testé) :

```ts
describe('isUndoableAutoTool (Palier 3b)', () => {
  it('reconnaît les 5 outils auto annulables', () => {
    for (const t of ['create_contact', 'add_note', 'schedule_visit', 'create_reminder', 'qualify_lead'])
      expect(isUndoableAutoTool(t)).toBe(true)
  })
  it('exclut update_pipeline (géré par canLeaveConfirm) et le socle légal', () => {
    for (const t of ['update_pipeline', 'send_client_message', 'record_offer', 'open_kyc_case', 'inconnu'])
      expect(isUndoableAutoTool(t)).toBe(false)
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 3 : Implémenter** dans `whatsapp-agent-router.ts` (après `canLeaveConfirm`) :

```ts
// Outils 'auto' (exécutés direct) réversibles → éligibles à l'undo /annuler 30 s (Palier 3b).
// update_pipeline N'EST PAS ici : il est 'confirm' élevé via canLeaveConfirm (undo 60 s, P3).
const UNDOABLE_AUTO_TOOLS = new Set(['create_contact', 'add_note', 'schedule_visit', 'create_reminder', 'qualify_lead'])
export function isUndoableAutoTool(tool: string): boolean {
  return UNDOABLE_AUTO_TOOLS.has(tool)
}
```

- [ ] **Step 4 : Run → PASS.** `deno check supabase/functions/_shared/whatsapp-agent-router.ts`.

- [ ] **Step 5 : i18n** — ajouter à `whatsapp-i18n.ts` (près de `pipelineAutoMoved`/`undoneStage`) :

```ts
/** Suffixe « /annuler » à coller à un message d'action auto réversible (Palier 3b, 30 s). */
export function undoHint(lang: WaLang, seconds = 30): string {
  return lang === 'en'
    ? ` · /annuler within ${seconds}s to undo.`
    : ` · /annuler dans les ${seconds} s pour revenir en arrière.`
}
/** Nom de ce qui a été défait, par outil. */
export function undoNoun(lang: WaLang, tool: string): string {
  const fr: Record<string, string> = { create_contact: 'contact créé', add_note: 'note', schedule_visit: 'visite', create_reminder: 'rappel', qualify_lead: 'qualification' }
  const en: Record<string, string> = { create_contact: 'created contact', add_note: 'note', schedule_visit: 'visit', create_reminder: 'reminder', qualify_lead: 'qualification' }
  return (lang === 'en' ? en : fr)[tool] ?? (lang === 'en' ? 'action' : 'action')
}
/** Confirmation d'un undo générique (outil auto). */
export function undoneAuto(lang: WaLang, noun: string): string {
  return lang === 'en' ? `Rolled back — ${noun} undone.` : `Annulé — ${noun} défait.`
}
```

- [ ] **Step 6 : `recordAutoUndo` helper** dans `whatsapp-actions.ts` (juste après `execUpdatePipelineWithUndo`, ≈ après l. 374) :

```ts
const AUTO_UNDO_SEC = 30

/** L3b : enregistre de quoi DÉFAIRE une action auto réversible (fenêtre 30 s). Renvoie true
 *  si l'undo est bien enregistré (→ on peut promettre /annuler honnêtement), false sinon. */
export async function recordAutoUndo(
  ctx: ActionCtx, tool: string, payloadUndo: Record<string, unknown>, seconds = AUTO_UNDO_SEC,
): Promise<boolean> {
  if (!ctx.agencyId) return false
  const { error } = await ctx.supabase.from('whatsapp_recent_auto_actions').insert({
    profile_id: ctx.profileId, agency_id: ctx.agencyId, tool,
    payload_undo: payloadUndo,
    undo_until: new Date(Date.now() + seconds * 1000).toISOString(),
  })
  if (error) { console.error('recordAutoUndo failed:', (error.message ?? 'error').slice(0, 120)); return false }
  return true
}
```

- [ ] **Step 7 : Vérifier** — `deno check` sur `whatsapp-actions.ts` + `whatsapp-i18n.ts` → 0 erreur. Importer `undoHint`/`undoNoun`/`undoneAuto` là où nécessaire au fil des tâches.

- [ ] **Step 8 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/whatsapp-actions.ts supabase/functions/_shared/whatsapp-i18n.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): recordAutoUndo + isUndoableAutoTool + i18n undo (P3b)"
```

---

## Task 3 : Câbler l'undo dans `create_contact`, `schedule_visit`, `create_reminder`

> Ces 3 outils insèrent une ligne ; on capte son id et on enregistre l'undo. `execCreateContact` (whatsapp-actions:84) renvoie déjà `.select('id')`. `execScheduleVisit` (:265) et `execCreateReminder` (:295) font `.insert(row)` SANS `.select` → ajouter `.select('id').single()`.

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Step 1 : Importer** `undoHint` depuis `whatsapp-i18n.ts` (bloc d'import existant, l.18-20).

- [ ] **Step 2 : `execCreateContact`** — remplacer le `return` final (≈ l.117-118). Ne PAS toucher le chemin de dédup (« contact existe déjà » : rien créé → pas d'undo) :

```ts
  await logTimeline(ctx, 'Contact créé', `${data.first_name ?? ''} ${data.last_name ?? ''} (via WhatsApp)`.trim(), data.id)
  const undoOk = await recordAutoUndo(ctx, 'create_contact', { contact_id: data.id })
  const base = `Contact créé: ${data.first_name} ${data.last_name ?? ''} (id ${data.id}).`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
```

- [ ] **Step 3 : `execScheduleVisit`** — la ligne `const { error } = await ctx.supabase.from('visits').insert(row)` (≈ l.288) devient :

```ts
  const { data: visit, error } = await ctx.supabase.from('visits').insert(row).select('id').single()
  if (error) return `Erreur planification: ${error.message}`
  await logTimeline(ctx, 'Visite planifiée', `${propTitle} — ${frDateTime(iso)}`, contactId)
  const undoOk = await recordAutoUndo(ctx, 'schedule_visit', { visit_id: visit.id })
  const base = `Visite planifiée le ${frDateTime(iso)} pour ${buyerName ?? 'le contact'} (bien : ${propTitle}).`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
```

- [ ] **Step 4 : `execCreateReminder`** — la ligne `const { error } = await ctx.supabase.from('reminders').insert({...})` (≈ l.303) capture l'id :

```ts
  const { data: reminder, error } = await ctx.supabase.from('reminders').insert({
    agency_id: ctx.agencyId, contact_id: contactId,
    type: 'custom', trigger_rule: 'manual', status: 'pending', channel: 'task',
    trigger_at: iso, message_template: body.slice(0, 500),
  }).select('id').single()
  if (error) return `Erreur rappel: ${error.message}`
  if (contactId) await logTimeline(ctx, 'Rappel créé', `${body.slice(0, 120)} (${frDateTime(iso)})`, contactId)
  const undoOk = await recordAutoUndo(ctx, 'create_reminder', { reminder_id: reminder.id })
  const base = `Rappel noté pour le ${frDateTime(iso)} : « ${body.slice(0, 120)} ».`
  return undoOk ? base + undoHint(ctx.lang ?? 'fr') : base
```

- [ ] **Step 5 : Vérifier** — `deno check supabase/functions/_shared/whatsapp-actions.ts` → 0 erreur. Relire : les chemins d'erreur (`return 'Erreur...'`) ne posent PAS d'undo.

- [ ] **Step 6 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): undo 30s pour create_contact/schedule_visit/create_reminder (P3b)"
```

---

## Task 4 : Câbler l'undo dans `add_note` + `qualify_lead` (undo cohérent)

> `add_note` EST une entrée `activity_events` (via `logTimeline`) → pour l'annuler il faut l'id de cette entrée. `qualify_lead` écrase `contacts.tags` + `contacts.search_criteria` ET crée une `client_searches` → l'undo doit TOUT restaurer (sinon état incohérent : tags revenus mais recherche encore active).

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Step 1 : `logTimeline` renvoie l'id** — la fonction (≈ l.141-158) renvoie aujourd'hui `boolean`. La faire renvoyer `string | null` (l'id de l'`activity_events` inséré). Les appelants existants testent la truthiness (`if (!ok)`), ce qui reste correct (id non-null = truthy, null = falsy) :

```ts
async function logTimeline(ctx: ActionCtx, action: string, objectLabel: string, contactId: string | null): Promise<string | null> {
  const { data, error } = await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action, entity_type: 'contact', entity_id: contactId,
    object_label: objectLabel.slice(0, 500), category: 'contact', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId },
  }).select('id').single()
  if (error) { console.error('activity_events insert failed'); return null }
  return data.id
}
```
> Vérifier les autres appelants de `logTimeline` (grep `logTimeline(`) : ils utilisent `await logTimeline(...)` sans lire la valeur, OU `const ok = await logTimeline(...); if (!ok)`. Les deux restent corrects.

- [ ] **Step 2 : `execAddNote`** — capter l'id et poser l'undo (≈ l.133-135) :

```ts
  const eventId = await logTimeline(ctx, 'Note ajoutée', body, contactId)
  if (!eventId) return "Erreur: impossible d'enregistrer la note."
  const undoOk = await recordAutoUndo(ctx, 'add_note', { event_id: eventId })
  return undoOk ? 'Note ajoutée à la fiche.' + undoHint(ctx.lang ?? 'fr') : 'Note ajoutée à la fiche.'
```

- [ ] **Step 3 : `execQualifyLead` — capturer l'état AVANT** — le SELECT (≈ l.386-388) doit aussi lire `search_criteria` :

```ts
  const { data } = await ctx.supabase
    .from('contacts').select('id, phone, email, tags, search_criteria')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  const c = data as { id: string; phone: string | null; email: string | null; tags: string[] | null; search_criteria: unknown } | null
  if (!c) return 'Erreur: contact introuvable dans votre agence.'
  const oldTags = Array.isArray(c.tags) ? c.tags : []        // capté AVANT l'update
  const oldCriteria = c.search_criteria ?? null               // capté AVANT l'update
```
> Remplacer l'usage existant `existingTags` par `oldTags` (même valeur) dans le calcul de `newTags`.

- [ ] **Step 4 : `execQualifyLead` — capter l'id de la recherche créée** — dans le bloc `if (!existing) { ... }` (≈ l.411-418), capter l'id :

```ts
    let createdSearchId: string | null = null
    if (!existing) {
      const { data: cs } = await ctx.supabase.from('client_searches').insert({
        agency_id: ctx.agencyId, contact_id: contactId,
        label: `WhatsApp — ${criteria.transaction_type === 'rent' ? 'location' : 'achat'}`,
        criteria, is_active: true,
      }).select('id').single()
      createdSearchId = cs?.id ?? null
      searchCreated = true
    }
```
> Déclarer `let createdSearchId: string | null = null` au niveau de la fonction (avant le `if (isSearchable...)`), car utilisé dans le payload undo plus bas.

- [ ] **Step 5 : `execQualifyLead` — poser l'undo cohérent** — juste avant le `return parts.join(' ')` final (≈ l.432) :

```ts
  const undoOk = await recordAutoUndo(ctx, 'qualify_lead', {
    contact_id: contactId, old_tags: oldTags, old_search_criteria: oldCriteria, created_search_id: createdSearchId,
  })
  if (undoOk) parts.push(undoHint(ctx.lang ?? 'fr').trim())
  return parts.join(' ')
```

- [ ] **Step 6 : Vérifier** — `deno check supabase/functions/_shared/whatsapp-actions.ts` → 0 erreur. Relire : `oldTags`/`oldCriteria` captés AVANT l'`update`, `createdSearchId` null si la recherche existait déjà.

- [ ] **Step 7 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): undo add_note + qualify_lead cohérent (tags+critères+recherche) (P3b)"
```

---

## Task 5 : `/annuler` — dispatcher de rollback par outil + garde-fou

> Le handler P3 (whatsapp-webhook ≈ l.306-348) ne gère que `update_pipeline`. On EXTRAIT un helper `rollbackAutoAction` (qui inclut désormais `update_pipeline`), on ajoute les 5 branches, et un garde-fou : si l'outil réclamé n'a pas de branche, on LIBÈRE le verrou (`undone_at = NULL`) pour ne pas brûler le slot (note de la revue finale P3).

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : Importer** `isUndoableAutoTool` n'est PAS requis ici (le dispatch se fait par `tool`). Importer `undoneAuto`, `undoNoun` depuis `whatsapp-i18n.ts` (le bloc importe déjà `undoneStage`, `nothingToUndo`). `stageLabel` déjà importé.

- [ ] **Step 2 : Helper `rollbackAutoAction`** — ajouter (près de `executePending`, ≈ l.457). Renvoie le message de confirmation, ou `null` si l'outil n'a aucune branche (→ le handler libèrera le verrou). Toutes les écritures sont scopées agence ; chaque rollback réussi loggue un `activity_events mode:'undo'` :

```ts
type UndoRow = { id: string; tool: string; payload_undo: unknown }

/** Rejoue le payload_undo d'une action auto. Renvoie le texte de confirmation, ou null si
 *  l'outil n'a pas de branche de rollback (→ le handler relâche le verrou, slot non brûlé).
 *  N'est appelé QUE sur un undo déjà réclamé (gagnant-unique). */
async function rollbackAutoAction(
  admin: SupabaseClient, agentLink: { profile_id: string; agency_id: string | null }, row: UndoRow, lang: WaLang,
): Promise<string | null> {
  const agencyId = agentLink.agency_id
  const p = (row.payload_undo ?? {}) as Record<string, unknown>
  // category ∈ {kyc,deal,contact,bien,doc,auth,settings,ai} (CHECK activity_events). 'deal' pour
  // une transaction (cohérent P3), 'contact' pour les écritures liées contact.
  const audit = async (category: string, entityType: string, entityId: string | null, label: string) => {
    await admin.from('activity_events').insert({
      agency_id: agencyId, actor_id: null, actor_kind: 'ai',
      action: 'wa_undo', entity_type: entityType, entity_id: entityId,
      object_label: label.slice(0, 500), category, severity: 'info',
      metadata: { via: 'whatsapp', mode: 'undo', profile_id: agentLink.profile_id, tool: row.tool },
    })
  }

  if (row.tool === 'update_pipeline') {
    const tx = String(p.transaction_id ?? ''), old = String(p.old_stage ?? '')
    if (!tx || !old) return null
    const { error } = await admin.from('transactions').update({ stage: old }).eq('id', tx).eq('agency_id', agencyId)
    if (error) { console.error('undo update_pipeline failed:', error.message.slice(0, 120)); return null }
    await audit('deal', 'transaction', tx, `undo → ${old}`)  // 'deal' = cohérent avec le P3
    return undoneStage(lang, stageLabel(old, lang))
  }
  if (row.tool === 'create_contact') {
    const id = String(p.contact_id ?? ''); if (!id) return null
    const { error } = await admin.from('contacts').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) { console.error('undo create_contact failed:', error.message.slice(0, 120)); return null }
    await audit('contact', 'contact', null, 'undo création contact')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'add_note') {
    const id = String(p.event_id ?? ''); if (!id) return null
    const { error } = await admin.from('activity_events').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) { console.error('undo add_note failed:', error.message.slice(0, 120)); return null }
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'schedule_visit') {
    const id = String(p.visit_id ?? ''); if (!id) return null
    const { error } = await admin.from('visits').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) { console.error('undo schedule_visit failed:', error.message.slice(0, 120)); return null }
    await audit('contact', 'visit', id, 'undo visite')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'create_reminder') {
    const id = String(p.reminder_id ?? ''); if (!id) return null
    const { error } = await admin.from('reminders').delete().eq('id', id).eq('agency_id', agencyId)
    if (error) { console.error('undo create_reminder failed:', error.message.slice(0, 120)); return null }
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'qualify_lead') {
    const cid = String(p.contact_id ?? ''); if (!cid) return null
    // Cohérence : restaurer tags + critères ET supprimer la recherche créée (tout ou rien).
    const { error: uErr } = await admin.from('contacts')
      .update({ tags: (p.old_tags ?? []) as unknown, search_criteria: p.old_search_criteria ?? null })
      .eq('id', cid).eq('agency_id', agencyId)
    if (uErr) { console.error('undo qualify_lead (contacts) failed:', uErr.message.slice(0, 120)); return null }
    if (p.created_search_id) {
      await admin.from('client_searches').delete().eq('id', String(p.created_search_id)).eq('agency_id', agencyId)
    }
    await audit('contact', 'contact', cid, 'undo qualification')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  return null // outil sans branche → le handler relâchera le verrou
}
```

- [ ] **Step 3 : Brancher le helper dans le handler `/annuler`** — remplacer le bloc `if (claimed && claimed.length > 0) { ... }` (P3, ≈ l.322-346) par :

```ts
      if (claimed && claimed.length > 0) {
        const undoReply = await rollbackAutoAction(admin, agentLink, last as UndoRow, lang)
        if (undoReply) {
          await sendWhatsAppText(provider, msg.fromPhone, undoReply)
          return
        }
        // Échec/rollback impossible OU outil sans branche : LIBÉRER le verrou pour ne pas
        // brûler le slot (un /annuler honnête doit pouvoir re-tenter). On NE return PAS :
        // le message suit le flux normal (le cerveau répondra).
        await admin.from('whatsapp_recent_auto_actions').update({ undone_at: null }).eq('id', last.id)
      }
```
> Conserver tout le reste du handler `/annuler` (la sélection `last`, le check fenêtre, la réclamation gagnant-unique) INCHANGÉ. La requête `last` (≈ l.309-315) sélectionne déjà `id, tool, payload_undo, undo_until` — OK pour `UndoRow`.

- [ ] **Step 4 : Vérifier** — `deno check supabase/functions/whatsapp-webhook/index.ts` → 0 erreur. Relire : (a) chaque rollback scopé `.eq('agency_id', agencyId)` ; (b) échec de rollback → `null` → verrou relâché (pas de fausse confirmation) ; (c) `qualify_lead` restaure les 3 (tags + critères + suppression recherche).

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-webhook/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): /annuler rollback par outil + garde-fou verrou (P3b)"
```

---

## Task 6 : Spec backend live — rollbacks d'undo

**Files:**
- Create: `tests/backend/whatsapp-auto-undo.spec.ts`

- [ ] **Step 1 : Spec** (lire `tests/backend/whatsapp-autonomy-gate.spec.ts` pour les helpers — `setupTwoAgencies`, `serviceRoleClient`, `HAS_KEYS`, nettoyage `afterAll` avec `.then(()=>{}, ()=>{})` JAMAIS `.catch`). Couvrir, en répliquant la logique de `rollbackAutoAction` côté test (UPDATE/DELETE) :
  1. **create_contact undo** : insérer un contact, insérer une `whatsapp_recent_auto_actions` (`tool='create_contact'`, `payload_undo={contact_id}`), rejouer le rollback (DELETE contact .eq agency), assert contact absent.
  2. **qualify_lead undo cohérent** : seed contact avec tags `['x']` + `search_criteria` A + une `client_searches` active ; payload `{contact_id, old_tags:['x'], old_search_criteria:A, created_search_id:<id>}` ; rejouer (UPDATE tags+criteria, DELETE search) ; assert tags=`['x']`, search_criteria=A, recherche supprimée.
  3. **garde-fou** : une ligne `tool='create_contact'` avec `payload_undo={}` (pas de contact_id) → le rollback renverrait null → assert qu'on PEUT remettre `undone_at=NULL` (le slot reste annulable).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Palier 3b — rollbacks d\'undo auto', () => {
  let setup: TwoAgenciesSetup
  const seeded: { table: string; id: string }[] = []
  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const s of seeded) await svc.from(s.table).delete().eq('id', s.id).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('create_contact : le rollback supprime le contact créé', async () => {
    const svc = serviceRoleClient()
    const { data: c } = await svc.from('contacts')
      .insert({ agency_id: setup.agencyAId, first_name: 'Undo', last_name: 'Test', email: `undo-${setup.stamp}@t.local`, type: 'buyer' })
      .select('id').single()
    // rollback = ce que fait rollbackAutoAction pour create_contact
    await svc.from('contacts').delete().eq('id', c!.id).eq('agency_id', setup.agencyAId)
    const { data: gone } = await svc.from('contacts').select('id').eq('id', c!.id).maybeSingle()
    expect(gone).toBeNull()
  })
})
```
> Adapter le seed `contacts` à la forme réelle (voir un spec qui insère un contact, ex. `documents-contact-id.spec.ts` : `agency_id, first_name, last_name, email, type`). Ajouter les `it` 2 (qualify_lead cohérent) et 3 (garde-fou) sur le même modèle.

- [ ] **Step 2 : Lancer** — `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-auto-undo.spec.ts` (collecte + skip propre en local). Vérifier qu'aucune erreur de compile.

- [ ] **Step 3 : Commit**
```bash
git add tests/backend/whatsapp-auto-undo.spec.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(whatsapp): spec rollbacks undo auto (contact + qualify_lead cohérent) (P3b)"
```

---

## Task 7 : RPC `get_whatsapp_autonomy_suggestions` + spec

> Le journal `whatsapp_confirmation_log` est RLS ON sans policy (service_role only) → un super-admin authentifié NE peut PAS le lire en direct. Pattern établi (cerveau `super-admin`, ex. `get_admin_monitoring_health`) : une RPC `SECURITY DEFINER`, `REVOKE FROM anon` + `GRANT TO authenticated` ; le `SuperAdminGuard` frontend est la garde d'accès.

**Files:**
- Create: `supabase/migrations/<stamp>_whatsapp_autonomy_suggestions_rpc.sql`
- Create: `tests/backend/whatsapp-autonomy-suggestions.spec.ts`

- [ ] **Step 1 : Migration RPC**

```sql
-- Palier 3b. Agrège whatsapp_confirmation_log par agent+outil (oui/non, dernier non) et joint
-- l'autonomie de l'agent. Flague suggest_resume UNIQUEMENT pour update_pipeline (SEUL outil
-- élevable ; le socle légal ne devient JAMAIS auto) quand ≥10 oui, 0 non, autonomy≠resume.
-- SECURITY DEFINER (contourne la RLS du journal) ; REVOKE anon + GRANT authenticated ; la garde
-- d'accès est le SuperAdminGuard frontend (pattern get_admin_monitoring_health). Idempotent.

CREATE OR REPLACE FUNCTION public.get_whatsapp_autonomy_suggestions()
RETURNS TABLE (
  profile_id uuid, agent_name text, agency_id uuid, autonomy text,
  tool text, yes_count bigint, no_count bigint, last_no_at timestamptz, suggest_resume boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  WITH agg AS (
    SELECT l.profile_id, l.tool,
      count(*) FILTER (WHERE l.outcome = 'yes') AS yes_count,
      count(*) FILTER (WHERE l.outcome = 'no')  AS no_count,
      max(l.created_at) FILTER (WHERE l.outcome = 'no') AS last_no_at
    FROM whatsapp_confirmation_log l
    GROUP BY l.profile_id, l.tool
  )
  SELECT a.profile_id, p.full_name AS agent_name, p.agency_id,
    (p.day0_payload->>'autonomy') AS autonomy,
    a.tool, a.yes_count, a.no_count, a.last_no_at,
    (a.tool = 'update_pipeline' AND a.yes_count >= 10 AND a.no_count = 0
      AND COALESCE(p.day0_payload->>'autonomy', '') <> 'resume') AS suggest_resume
  FROM agg a JOIN profiles p ON p.id = a.profile_id
  ORDER BY a.profile_id, a.tool;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_autonomy_suggestions() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_autonomy_suggestions() TO authenticated;

COMMENT ON FUNCTION public.get_whatsapp_autonomy_suggestions() IS 'Palier 3b — suggestions d''autonomie pour le super-admin. Agrège whatsapp_confirmation_log (oui/non par agent+outil). suggest_resume=true UNIQUEMENT pour update_pipeline (seul outil élevable) ; MEGGA observe, n''élève rien. Lisible via SuperAdminGuard frontend.';
```

- [ ] **Step 2 : Spec live** `tests/backend/whatsapp-autonomy-suggestions.spec.ts` : seed `whatsapp_confirmation_log` pour `setup.agentAId` (autonomy='notify' via `day0_payload`), 10 lignes `tool='update_pipeline' outcome='yes'` → RPC renvoie `suggest_resume=true` pour cette ligne. Ajouter 1 ligne `outcome='no'` → `suggest_resume=false`. Vérifier qu'une ligne `tool='send_client_message'` (10 oui) a TOUJOURS `suggest_resume=false` (socle légal jamais élevable). Nettoyer les lignes seedées en `afterAll` (`.then(()=>{}, ()=>{})`).

- [ ] **Step 3 : Vérifier** — `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-autonomy-suggestions.spec.ts` collecte + skip propre.

- [ ] **Step 4 : Commit**
```bash
git add supabase/migrations/*_whatsapp_autonomy_suggestions_rpc.sql tests/backend/whatsapp-autonomy-suggestions.spec.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(admin): RPC get_whatsapp_autonomy_suggestions + spec (socle légal jamais suggéré) (P3b)"
```

---

## Task 8 : UI super-admin — hook + page + route + i18n

> Mirror du pattern super-admin (cerveau `super-admin`) : page sous `src/pages/admin/`, route `/dashboard/admin/autonomy` lazy + `SuperAdminGuard` dans `src/App.tsx`, accent violet `bg-admin-accent`/`text-admin-accent`, `useTranslation('admin')`, états loading/empty. **Page en LECTURE SEULE** : elle affiche la suggestion ; aucune mutation d'autonomie (MEGGA observe, l'humain agit via le contrôle d'autonomie existant).

**Files:**
- Create: `src/hooks/useAdminAutonomy.ts`
- Create: `src/pages/admin/AdminAutonomyPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/locales/{fr,de,en,it}/admin.json`

- [ ] **Step 1 : Hook** `src/hooks/useAdminAutonomy.ts` (mirror `useAdminMonitoring.ts` — RPC via React Query) :

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AutonomyRow {
  profile_id: string
  agent_name: string | null
  agency_id: string | null
  autonomy: string | null
  tool: string
  yes_count: number
  no_count: number
  last_no_at: string | null
  suggest_resume: boolean
}

export function useAdminAutonomy() {
  return useQuery({
    queryKey: ['admin', 'autonomy-suggestions'],
    queryFn: async (): Promise<AutonomyRow[]> => {
      const { data, error } = await supabase.rpc('get_whatsapp_autonomy_suggestions')
      if (error) throw error
      return (data ?? []) as AutonomyRow[]
    },
  })
}
```

- [ ] **Step 2 : Page** `src/pages/admin/AdminAutonomyPage.tsx` (mirror le squelette des pages admin — `PageTransition`, header badge violet + titre + sous-titre, table dans `rounded-xl border border-theme-border`, états loading/empty, `useTranslation('admin')`). Grouper les lignes par agent ; afficher par outil les compteurs oui/non ; badge « Suggérer resume » (violet) quand `suggest_resume`. Bannière fixe « MEGGA observe, n'élève rien — décision humaine ». Squelette :

```tsx
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import PageTransition from '@/components/layout/PageTransition'
import { cn } from '@/lib/utils'
import { useAdminAutonomy, type AutonomyRow } from '@/hooks/useAdminAutonomy'

export default function AdminAutonomyPage() {
  const { t } = useTranslation('admin')
  const { data: rows = [], isLoading } = useAdminAutonomy()

  // Regroupe par agent
  const byAgent = new Map<string, AutonomyRow[]>()
  for (const r of rows) {
    const arr = byAgent.get(r.profile_id) ?? []
    arr.push(r); byAgent.set(r.profile_id, arr)
  }
  const suggestions = rows.filter((r) => r.suggest_resume)

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('autonomy.title')}</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {isLoading ? t('common.loading') : t('autonomy.subtitle', { count: suggestions.length })}
          </p>
        </div>

        {/* Bannière « MEGGA observe » */}
        <div className="rounded-xl border border-theme-border bg-admin-accent/5 px-4 py-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-admin-accent mt-0.5 shrink-0" />
          <p className="text-sm text-theme-secondary">{t('autonomy.observeNote')}</p>
        </div>

        {/* Table par agent */}
        <div className="rounded-xl border border-theme-border">
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary">
            <div className="flex-1">{t('autonomy.col.agent')}</div>
            <div className="w-24">{t('autonomy.col.autonomy')}</div>
            <div className="flex-1">{t('autonomy.col.tool')}</div>
            <div className="w-28 text-right">{t('autonomy.col.yesno')}</div>
            <div className="w-40 text-right">{t('autonomy.col.suggestion')}</div>
          </div>
          {isLoading ? (
            <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('autonomy.empty')}</div>
          ) : (
            rows.map((r, i) => (
              <div key={`${r.profile_id}-${r.tool}`} className={cn('flex items-center px-4 py-3', i < rows.length - 1 && 'border-b border-theme-border')}>
                <div className="flex-1 text-sm text-theme-primary capitalize">{r.agent_name ?? '—'}</div>
                <div className="w-24 text-sm text-theme-secondary">{r.autonomy ?? '—'}</div>
                <div className="flex-1 text-sm text-theme-secondary">{r.tool}</div>
                <div className="w-28 text-right text-sm text-theme-secondary">{r.yes_count} / {r.no_count}</div>
                <div className="w-40 text-right">
                  {r.suggest_resume
                    ? <span className="text-xs font-medium text-admin-accent">{t('autonomy.suggestResume')}</span>
                    : <span className="text-xs text-theme-tertiary">—</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  )
}
```

- [ ] **Step 3 : Route** — dans `src/App.tsx` : ajouter le lazy import près des autres admin (`const AdminAutonomyPage = lazy(() => import('@/pages/admin/AdminAutonomyPage'))`) et la route près des autres admin (`<Route path="admin/autonomy" element={<SuperAdminGuard><AdminAutonomyPage /></SuperAdminGuard>} />`). (Optionnel : ajouter l'entrée au menu admin si un menu existe — repérer où sont listées les autres entrées admin.)

- [ ] **Step 4 : i18n (4 langues)** — ajouter à `src/i18n/locales/fr/admin.json` (et traduire DE/EN/IT — skill `i18n-sync`) :

```json
{
  "autonomy.title": "Autonomie des agents",
  "autonomy.subtitle": "{{count}} suggestion(s) — MEGGA observe, vous décidez",
  "autonomy.observeNote": "MEGGA observe les confirmations (oui/non) de chaque agent. Quand un agent approuve toujours les déplacements de pipeline, elle suggère ici de monter son autonomie. Elle n'élève rien toute seule — la décision reste humaine. Le socle légal (envoi client, offres, KYC) n'est jamais proposé en automatique.",
  "autonomy.suggestResume": "Suggérer : resume",
  "autonomy.empty": "Aucune confirmation enregistrée pour l'instant.",
  "autonomy.col.agent": "Agent",
  "autonomy.col.autonomy": "Autonomie",
  "autonomy.col.tool": "Outil",
  "autonomy.col.yesno": "Oui / Non",
  "autonomy.col.suggestion": "Suggestion"
}
```
EN (`en/admin.json`) :
```json
{
  "autonomy.title": "Agent autonomy",
  "autonomy.subtitle": "{{count}} suggestion(s) — MEGGA observes, you decide",
  "autonomy.observeNote": "MEGGA watches each agent's confirmations (yes/no). When an agent always approves pipeline moves, it suggests raising their autonomy here. It never promotes anyone on its own — the call stays human. The legal base (client messages, offers, KYC) is never proposed for automation.",
  "autonomy.suggestResume": "Suggest: resume",
  "autonomy.empty": "No confirmations recorded yet.",
  "autonomy.col.agent": "Agent",
  "autonomy.col.autonomy": "Autonomy",
  "autonomy.col.tool": "Tool",
  "autonomy.col.yesno": "Yes / No",
  "autonomy.col.suggestion": "Suggestion"
}
```
> Reproduire les mêmes clés en DE et IT (traductions fidèles). Vérifier qu'aucune clé n'est en double et que le JSON parse.

- [ ] **Step 5 : Vérifier** — `npm run build` → vert (tsc + vite). La page se monte sous `/dashboard/admin/autonomy` derrière le guard.

- [ ] **Step 6 : Commit**
```bash
git add src/hooks/useAdminAutonomy.ts src/pages/admin/AdminAutonomyPage.tsx src/App.tsx src/i18n/locales/fr/admin.json src/i18n/locales/de/admin.json src/i18n/locales/en/admin.json src/i18n/locales/it/admin.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(admin): page /dashboard/admin/autonomy — suggestions d'autonomie WhatsApp (P3b)"
```

---

## Task 9 : Build + cerveau + PR

- [ ] **Step 1 : Lancer** — `npm run build && npx vitest run` → build vert, unit verts (dont `isUndoableAutoTool`).

- [ ] **Step 2 : Mettre à jour le cerveau** :
- `megga/whatsapp-copilot-lessons` : leçon « (12) Palier 3b : undo /annuler étendu aux 5 outils auto (create_contact/add_note/schedule_visit/create_reminder/qualify_lead, 30 s) via recordAutoUndo + rollbackAutoAction (dispatch par tool, garde-fou : tool sans branche relâche le verrou) ; qualify_lead undo COHÉRENT (restaure tags+search_criteria+supprime la client_searches créée) ; CHECK tool élargi (DROP+ADD), purge cron 7 j ; RPC get_whatsapp_autonomy_suggestions (SECURITY DEFINER, REVOKE anon/GRANT authenticated) + page /dashboard/admin/autonomy = 1re UI de suggestion, suggest_resume UNIQUEMENT update_pipeline (socle légal jamais élevable) ».
- `megga/whatsapp-agent-stability-autonomy-strategy` : P3b livré (undo outils auto + UI suggestion).
- `megga/megga-ai-agent-learning` : la brique « suggestion » (UI super-admin lisant confirmation_log) est livrée ; reste la couche d'apprentissage profonde (profil de style par agent).
- `megga/super-admin` : 15 pages (+ autonomy).
Puis `npm run ruflo:seed`.

- [ ] **Step 3 : Commit + PR**
```bash
git add .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "docs(cerveau): Palier 3b livré — undo outils auto + UI suggestion autonomie"
```
Ouvrir la PR vers `main`. **Vérifier la date des migrations = jour du merge** (`deploy-migrations-gate` ; re-dater si le merge glisse). NE PAS merger sans accord humain (CI verte d'abord).

---

## Self-Review (vérifié contre la stratégie §5 + les notes de revue P3)

- ✅ Undo 30 s des 5 outils auto via la MÊME infra (`whatsapp_recent_auto_actions`) — `recordAutoUndo` (Task 2) + capture des ids (Task 3/4) + `rollbackAutoAction` (Task 5).
- ✅ `qualify_lead` undo COHÉRENT : capture `old_tags` + `old_search_criteria` + `created_search_id` AVANT mutation, rollback restaure les 3 (Task 4/5).
- ✅ Garde-fou « tool sans branche relâche le verrou » (note de la revue finale P3) — `rollbackAutoAction` renvoie `null` → handler remet `undone_at=NULL` (Task 5).
- ✅ Durcissements P3 différés réglés : CHECK élargi (DROP+ADD), purge cron 7 j, index couvrant `INCLUDE(outcome)` (Task 1).
- ✅ Undo honnête conservé : `recordAutoUndo` renvoie false → pas de hint `/annuler` ; rollback échoue → verrou relâché, pas de fausse confirmation.
- ✅ Suggestion d'autonomie = `update_pipeline` UNIQUEMENT (socle légal jamais élevable, testé Task 7) ; RPC `SECURITY DEFINER` + `REVOKE anon`/`GRANT authenticated` ; page LECTURE SEULE (MEGGA observe).
- ✅ DeepSeek-only ; aucun tier `confirm` du socle légal touché ; pattern super-admin respecté (violet, guard, i18n 4 langues).

**Cohérence des noms :** `isUndoableAutoTool` ↔ `recordAutoUndo(tool, …)` ↔ `whatsapp_recent_auto_actions.tool` (CHECK élargi) ↔ `rollbackAutoAction` (branches par `tool`) ↔ payloads (`contact_id`/`event_id`/`visit_id`/`reminder_id`/`{contact_id,old_tags,old_search_criteria,created_search_id}`). `get_whatsapp_autonomy_suggestions` ↔ `useAdminAutonomy` ↔ `AdminAutonomyPage` ↔ clés i18n `autonomy.*`.

**Hors périmètre (futurs plans) :** couche d'apprentissage profonde (profil de style injecté au SYSTEM prompt) ; application automatique de la suggestion ; observabilité `ai_usage_logs` (Palier 4).

---

## Exécution

Session fraîche, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. **Dater les migrations du jour de merge.** Mettre le cerveau à jour à la Task 9. i18n : 4 langues synchronisées (skill `i18n-sync`).
