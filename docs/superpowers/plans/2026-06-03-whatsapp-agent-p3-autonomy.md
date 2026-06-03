# Agent WhatsApp — Palier 3 : autonomie sûre (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que l'agent en mode `resume` arrête de taper « oui » 10-15×/jour pour les déplacements de pipeline (réversibles, audités) — déplacement **auto + undo `/annuler` 60 s** quand son autonomie l'autorise — tout en gardant le socle légal (envoi client / offres / KYC) **toujours en `confirm`**, et en plantant la première brique de l'apprentissage (MEGGA observe quelles actions l'agent approuve toujours).

**Architecture :** (1) Pré-requis bloquant : la clé `pipeline_move` dans `compute_agent_preferences` (sinon `can_auto_send` renvoie `false` pour tous = code mort). (2) `update_pipeline` est le SEUL outil `confirm` qui peut passer en auto — gardé par une fonction pure `canLeaveConfirm` (le socle légal ne quitte JAMAIS `confirm`, testé en CI). (3) Un undo différé : table `whatsapp_recent_auto_actions` + commande `/annuler` traitée en tête du webhook. (4) Un journal `whatsapp_confirmation_log` (oui/non par outil) = la graine d'apprentissage.

**Tech Stack :** Supabase Edge (Deno/TS), PostgreSQL (migrations additives idempotentes, `CREATE OR REPLACE FUNCTION`), Vitest (unit purs + backend live). DeepSeek-only (aucun changement de provider).

**Réf. stratégie (la spec) :** [docs/strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md](../../strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md), §5 (Échelle d'autonomie). **Cerveau :** `megga/whatsapp-agent-stability-autonomy-strategy`, `megga/megga-ai-agent-learning` (la directive « MEGGA apprend l'agent »), `megga/ai-guardrails`, `megga/kyc-non-blocking`, `megga/whatsapp-agent-copilot`.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp autonomie pipeline_move can_auto_send undo annuler confirmation_log socle légal" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga
```
**Ne pas modifier le seed** pendant l'implémentation (mise à jour du cerveau = dernière tâche).

## Contraintes dures (non négociables)

- **Socle légal IMMUABLE** : `send_client_message`, `send_listings`, `record_offer`, `open_kyc_case` restent `confirm` à TOUS les niveaux d'autonomie ; la validation KYC reste MLRO. **`update_pipeline` est le SEUL outil `confirm` qui peut passer en auto** (réversible, audité, aucun flux client/argent). C'est garanti par `canLeaveConfirm` (Task 4) et testé en CI de façon paramétrée (Task 4 + Task 8).
- **MEGGA ne s'auto-promeut jamais** : le journal de confirmations sert à *suggérer* (à un humain, plus tard, côté super-admin) ; il n'élève rien tout seul.
- **IA = DeepSeek uniquement**. **Migrations additives + idempotentes**. **Dater les migrations du jour de merge** (cerveau `deploy-migrations-gate` : sinon sautées silencieusement). `npm run build` passe avant tout push.

## Périmètre

**FAIT (ce plan) :** clé `pipeline_move` ; `update_pipeline` auto+undo 60 s quand `can_auto_send` l'autorise ; infra d'undo (`/annuler`) ; journal de confirmations ; invariant socle légal paramétré.

**PAS fait (→ P3b, plan séparé) :** undo 30 s pour les autres outils `auto` (`create_contact`/`add_note`/`schedule_visit`/`create_reminder`) + la prévention pro-active d'incohérence de `qualify_lead` (réutilisent la MÊME infra d'undo, on ajoutera juste les rollbacks par outil) ; l'UI super-admin qui lit `whatsapp_confirmation_log` et **propose** la montée d'autonomie (frontend Julien) ; le filtrage tier `read` du 2ᵉ appel pendant un pending (mineur).

---

## File Structure

**Créer :**
- `supabase/migrations/<stamp>_autonomy_gate_pipeline_move.sql` — `CREATE OR REPLACE compute_agent_preferences` + clé `pipeline_move`.
- `supabase/migrations/<stamp>_whatsapp_recent_auto_actions.sql` — table d'undo.
- `supabase/migrations/<stamp>_whatsapp_confirmation_log.sql` — journal d'apprentissage.
- `tests/backend/whatsapp-autonomy-gate.spec.ts` — spec live : `pipeline_move` (resume=true / suggest=false) + undo rollback.

**Modifier :**
- `supabase/functions/_shared/whatsapp-agent-router.ts` — `canLeaveConfirm` + `isUndoCommand` (purs).
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — invariant socle légal paramétré + undo parser.
- `supabase/functions/_shared/whatsapp-actions.ts` — `execUpdatePipelineWithUndo` (déplace + audit + enregistre l'undo).
- `supabase/functions/whatsapp-agent/index.ts` — branche auto de `update_pipeline` (canLeaveConfirm + can_auto_send).
- `supabase/functions/whatsapp-webhook/index.ts` — handler `/annuler` (rollback) + écriture `whatsapp_confirmation_log`.
- `supabase/functions/_shared/whatsapp-i18n.ts` — messages undo (`pipelineAutoMoved`, `undoneStage`, `nothingToUndo`).

---

## Task 1 : Migration — clé `pipeline_move` dans `compute_agent_preferences` (pré-requis bloquant)

> Sans ça, `can_auto_send(profileId,'pipeline_move')` lit `(autonomy_gate->>'pipeline_move')` = NULL → `false` pour TOUS, même en `resume`. À shipper EN PREMIER.

**Files:**
- Create: `supabase/migrations/<stamp>_autonomy_gate_pipeline_move.sql`

- [ ] **Step 1 : Écrire la migration** (`CREATE OR REPLACE` de la fonction ENTIÈRE — reproduire le corps du baseline `00000000000000_baseline_remote_schema.sql:714-855` à l'identique, en ajoutant SEULEMENT la clé `pipeline_move` dans les 3 branches du `CASE v_autonomy`)

```sql
-- Ajoute la clé 'pipeline_move' à l'autonomy_gate de compute_agent_preferences (source de
-- vérité unique du calibrage). suggest=false, notify=false, resume=true. Sans cette clé,
-- can_auto_send(_, 'pipeline_move') renvoie false pour tout agent → le câblage L3 (Palier 3)
-- serait code mort. Reproduit le corps EXACT du baseline + la seule clé ajoutée. Idempotent
-- (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.compute_agent_preferences(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload       JSONB;
  v_specialite    TEXT;
  v_zone          JSONB;
  v_dispo         TEXT;
  v_priorite      TEXT;
  v_autonomy      TEXT;
  v_sla           JSONB;
  v_autonomy_gate JSONB;
  v_weights       JSONB;
BEGIN
  SELECT day0_payload INTO v_payload FROM profiles WHERE id = p_agent_id;
  IF v_payload IS NULL THEN
    RETURN NULL;  -- pré-Day0 : aucune action IA auto tant que l'agent n'a pas calibré
  END IF;

  v_specialite := v_payload->>'specialite';
  v_zone       := v_payload->'zone';
  v_dispo      := v_payload->>'dispo';
  v_priorite   := v_payload->>'priorite';
  v_autonomy   := v_payload->>'autonomy';

  v_sla := CASE v_dispo
    WHEN 'office' THEN jsonb_build_object('hours_start',9,'hours_end',18,'days_of_week',jsonb_build_array(1,2,3,4,5),'response_target_hours',4)
    WHEN 'wide'   THEN jsonb_build_object('hours_start',8,'hours_end',20,'days_of_week',jsonb_build_array(1,2,3,4,5,6),'response_target_hours',8)
    WHEN '247'    THEN jsonb_build_object('hours_start',0,'hours_end',24,'days_of_week',jsonb_build_array(1,2,3,4,5,6,7),'response_target_hours',NULL)
    ELSE NULL
  END;

  -- autonomy_gate : + clé 'pipeline_move' (déplacement pipeline = réversible + audité, donc
  -- seul outil 'confirm' élevable ; jamais d'envoi client/offre/KYC ici — socle légal immuable).
  v_autonomy_gate := CASE v_autonomy
    WHEN 'suggest' THEN jsonb_build_object(
      'relance_simple',false,'sms_courtoisie',false,'accuse_reception',false,
      'email_followup',false,'briefing_today',false,'proposal_send',false,
      'pipeline_move',  false
    )
    WHEN 'notify' THEN jsonb_build_object(
      'relance_simple',true,'sms_courtoisie',true,'accuse_reception',true,
      'email_followup',false,'briefing_today',true,'proposal_send',false,
      'pipeline_move',  false
    )
    WHEN 'resume' THEN jsonb_build_object(
      'relance_simple',true,'sms_courtoisie',true,'accuse_reception',true,
      'email_followup',true,'briefing_today',true,
      'proposal_send',  false,  -- proposition commerciale = TOUJOURS validée (immuable)
      'pipeline_move',  true     -- déplacement pipeline = auto en resume (réversible, audité)
    )
    ELSE jsonb_build_object()  -- autonomy inconnue → tout interdit
  END;

  v_weights := CASE v_priorite
    WHEN 'acquisition'  THEN jsonb_build_object('new_lead',1.0,'dormant',0.3,'deal_active',0.5,'sourcing',0.9)
    WHEN 'closing'      THEN jsonb_build_object('new_lead',0.4,'dormant',0.5,'deal_active',1.0,'sourcing',0.4)
    WHEN 'fidelisation' THEN jsonb_build_object('new_lead',0.5,'dormant',1.0,'deal_active',0.6,'sourcing',0.3)
    ELSE jsonb_build_object('new_lead',0.5,'dormant',0.5,'deal_active',0.5,'sourcing',0.5)
  END;

  RETURN jsonb_build_object(
    'agent_id',p_agent_id,'specialite',v_specialite,'zone_ids',v_zone,'dispo',v_dispo,
    'priorite',v_priorite,'autonomy',v_autonomy,'sla',v_sla,'autonomy_gate',v_autonomy_gate,
    'priorite_weights',v_weights,'has_calibrated',true
  );
END;
$$;
```

> ⚠️ Avant d'écrire : relire `00000000000000_baseline_remote_schema.sql` autour de la fonction (≈ l.714-855) et confirmer que le corps ci-dessus reproduit fidèlement TOUTES les branches (SLA, weights, RETURN) — seules les 3 lignes `'pipeline_move'` sont ajoutées. Si le baseline a évolué, partir du baseline réel, ne pas du copier-coller aveugle.

- [ ] **Step 2 : Vérifier** — `can_auto_send` (baseline:666-684) lit `autonomy_gate->>'pipeline_move'` ; aucune modif de `can_auto_send` nécessaire. Idempotent (`CREATE OR REPLACE`).

- [ ] **Step 3 : Commit**
```bash
git add supabase/migrations/*_autonomy_gate_pipeline_move.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(autonomy): clé pipeline_move dans compute_agent_preferences (pré-requis L3)"
```

---

## Task 2 : Migration — table `whatsapp_recent_auto_actions` (undo différé)

**Files:**
- Create: `supabase/migrations/<stamp>_whatsapp_recent_auto_actions.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Filet d'undo des actions auto WhatsApp (Palier 3). Après une action réversible exécutée
-- en auto (ex. déplacement pipeline en mode resume), on enregistre de quoi la DÉFAIRE et
-- jusqu'à quand (undo_until). La commande « /annuler » de l'agent, dans la fenêtre, rejoue
-- le payload_undo. Additif + idempotent. RLS ON sans policy (service_role only — back-office).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_recent_auto_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL,
  agency_id     uuid NULL,
  tool          text NOT NULL,                 -- ex. 'update_pipeline'
  payload_undo  jsonb NOT NULL,                -- de quoi défaire (ex. {transaction_id, old_stage})
  created_at    timestamptz NOT NULL DEFAULT now(),
  undo_until    timestamptz NOT NULL,          -- fin de la fenêtre d'undo
  undone_at     timestamptz NULL               -- posé quand l'undo est consommé (anti-rejeu)
);

ALTER TABLE public.whatsapp_recent_auto_actions ENABLE ROW LEVEL SECURITY;

-- Le handler /annuler cherche la dernière action encore annulable d'un agent.
CREATE INDEX IF NOT EXISTS idx_wa_recent_auto_undoable
  ON public.whatsapp_recent_auto_actions (profile_id, created_at DESC)
  WHERE undone_at IS NULL;

COMMIT;
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_whatsapp_recent_auto_actions.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): table whatsapp_recent_auto_actions (undo différé L3)"
```

---

## Task 3 : Migration — table `whatsapp_confirmation_log` (graine d'apprentissage)

**Files:**
- Create: `supabase/migrations/<stamp>_whatsapp_confirmation_log.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Journal des confirmations agent (oui/non) par outil — PREMIÈRE BRIQUE de « MEGGA apprend
-- l'agent » (cerveau megga-ai-agent-learning). Sert plus tard à SUGGÉRER (à un humain, UI
-- super-admin) de monter l'autonomie après N « oui » sans « non ». MEGGA observe, n'élève
-- rien toute seule. Additif + idempotent. RLS ON sans policy (service_role only).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_confirmation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL,
  agency_id   uuid NULL,
  tool        text NOT NULL,
  outcome     text NOT NULL CHECK (outcome IN ('yes','no')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_confirmation_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wa_confirmation_log_profile_tool
  ON public.whatsapp_confirmation_log (profile_id, tool, created_at DESC);

COMMIT;
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_whatsapp_confirmation_log.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): table whatsapp_confirmation_log (apprentissage des confirmations)"
```

---

## Task 4 : Router — `canLeaveConfirm` + `isUndoCommand` (purs) + invariant socle légal (TDD)

> On écrit l'invariant socle légal D'ABORD (test), puis le code minimal.

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)** — ajouter à `whatsapp-agent-router.test.ts`

```ts
import { canLeaveConfirm, isUndoCommand } from './whatsapp-agent-router'

describe('canLeaveConfirm — invariant socle légal (Palier 3)', () => {
  it('SEUL update_pipeline peut quitter confirm', () => {
    expect(canLeaveConfirm('update_pipeline')).toBe(true)
  })
  it('le socle légal ne quitte JAMAIS confirm', () => {
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case']) {
      expect(canLeaveConfirm(t)).toBe(false)
    }
  })
  it('un outil inconnu ne quitte pas confirm', () => {
    expect(canLeaveConfirm('outil_inconnu')).toBe(false)
  })
})

describe('isUndoCommand', () => {
  it('reconnaît les annulations courtes', () => {
    for (const t of ['/annuler', 'annuler', 'annule', 'undo', 'reviens']) expect(isUndoCommand(t)).toBe(true)
  })
  it('ne matche pas une phrase normale', () => {
    expect(isUndoCommand('déplace Dupont en négociation')).toBe(false)
    expect(isUndoCommand('')).toBe(false)
  })
})
```

- [ ] **Step 2 : Run → FAIL** (`canLeaveConfirm`/`isUndoCommand` non définis)
Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 3 : Implémenter dans `whatsapp-agent-router.ts`** (après `toolTier`, ≈ l.47)

```ts
// SEUL outil 'confirm' qui peut passer en auto (Palier 3) : update_pipeline — réversible
// (undo) + audité, aucun flux client/argent. Le socle légal (send_client_message/send_listings/
// record_offer/open_kyc_case) renvoie false ICI quel que soit l'agent → ne quitte JAMAIS confirm.
export function canLeaveConfirm(tool: string): boolean {
  return tool === 'update_pipeline'
}

const UNDO_WORDS = new Set(['/annuler', 'annuler', 'annule', 'undo', 'reviens', 'rétablis', 'retablis'])
/** Vrai si le message est une commande d'annulation courte (pour l'undo différé). */
export function isUndoCommand(body: string | null | undefined): boolean {
  if (!body) return false
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  return UNDO_WORDS.has(norm)
}
```

- [ ] **Step 4 : Run → PASS.** `deno check supabase/functions/_shared/whatsapp-agent-router.ts`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): canLeaveConfirm (invariant socle légal) + isUndoCommand"
```

---

## Task 5 : `whatsapp-actions` — `execUpdatePipelineWithUndo` (déplace + audit + enregistre l'undo)

> Variante de `execUpdatePipeline` (whatsapp-actions:314-336) qui, en plus, enregistre de quoi DÉFAIRE et renvoie un message « /annuler 60 s ». L'`execUpdatePipeline` existant (chemin confirm via `executePending`) reste INTACT.

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`
- Modify: `supabase/functions/_shared/whatsapp-i18n.ts`

- [ ] **Step 1 : Ajouter les messages i18n** (`whatsapp-i18n.ts`, helpers exportés)

```ts
/** Confirmation d'un déplacement pipeline AUTO + fenêtre d'undo. */
export function pipelineAutoMoved(lang: WaLang, who: string, label: string): string {
  return lang === 'en'
    ? `Done — ${who} moved to ${label}. Reply /annuler within 60s to undo.`
    : `C'est fait — ${who} passé en ${label}. Tape /annuler dans les 60 s pour revenir en arrière.`
}
/** Confirmation d'un undo réussi. */
export function undoneStage(lang: WaLang, label: string): string {
  return lang === 'en' ? `Rolled back — back to ${label}.` : `Annulé — c'est revenu en ${label}.`
}
/** Rien à annuler dans la fenêtre. */
export function nothingToUndo(lang: WaLang): string {
  return lang === 'en' ? "Nothing to undo (the window has passed)." : "Rien à annuler (la fenêtre est passée)."
}
```

- [ ] **Step 2 : Ajouter `execUpdatePipelineWithUndo`** dans `whatsapp-actions.ts` (juste après `execUpdatePipeline`, ≈ l.336). Il réutilise `resolveContactDeal` (déjà dans le fichier) pour capter l'ancienne étape.

```ts
const PIPELINE_UNDO_SEC = 60

/** L3 : déplace le pipeline en AUTO et enregistre de quoi défaire (undo 60 s). Renvoie le
 *  message « /annuler ». N'est appelé QUE quand canLeaveConfirm + can_auto_send l'autorisent. */
export async function execUpdatePipelineWithUndo(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), stage = s(a.stage)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  if (!stage || !isValidStage(stage)) return `Erreur: étape invalide. Valeurs possibles : ${PIPELINE_STAGES.join(', ')}.`
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans votre agence.'
  const deal = await resolveContactDeal(ctx, contactId)
  if (!deal) return pipelineNoDeal(ctx.lang ?? 'fr')
  const label = stageLabel(stage, ctx.lang ?? 'fr')
  if (deal.stage === stage) return pipelineAlreadyAt(ctx.lang ?? 'fr', deal.label, label)

  const oldStage = deal.stage // capté AVANT l'update pour le rollback
  const { error } = await ctx.supabase.from('transactions')
    .update({ stage }).eq('id', deal.id).eq('agency_id', ctx.agencyId)
  if (error) return `Erreur pipeline: ${error.message}`

  // Audit LBA (identique à execUpdatePipeline, métadonnée 'auto').
  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'stage_change', entity_type: 'transaction', entity_id: deal.id,
    object_label: `${oldStage} → ${stage}`, category: 'deal', severity: 'info',
    metadata: { via: 'whatsapp', mode: 'auto', profile_id: ctx.profileId, old_stage: oldStage, new_stage: stage, contact_id: contactId },
  })

  // Enregistre l'undo (payload = quoi défaire + jusqu'à quand).
  await ctx.supabase.from('whatsapp_recent_auto_actions').insert({
    profile_id: ctx.profileId, agency_id: ctx.agencyId, tool: 'update_pipeline',
    payload_undo: { transaction_id: deal.id, old_stage: oldStage },
    undo_until: new Date(Date.now() + PIPELINE_UNDO_SEC * 1000).toISOString(),
  })

  return pipelineAutoMoved(ctx.lang ?? 'fr', deal.label, label)
}
```
> Importer `pipelineAutoMoved` depuis `whatsapp-i18n.ts` en tête de `whatsapp-actions.ts` (ajouter au bloc d'import existant). `resolveContactDeal`, `isValidStage`, `PIPELINE_STAGES`, `stageLabel`, `pipelineNoDeal`, `pipelineAlreadyAt`, `contactInAgency`, `hasAgency`, `s`, `NO_AGENCY` sont déjà dans le fichier.

- [ ] **Step 3 : Vérifier** — `deno check supabase/functions/_shared/whatsapp-actions.ts` → 0 erreur.

- [ ] **Step 4 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-actions.ts supabase/functions/_shared/whatsapp-i18n.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): execUpdatePipelineWithUndo (déplacement auto + undo 60s)"
```

---

## Task 6 : `whatsapp-agent` — branche auto de `update_pipeline`

> Dans la boucle d'outils, la branche `tier === 'confirm'` (whatsapp-agent ≈ l.155 post-P2 ; la repérer par `grep "if (tier === 'confirm')"`) intercepte `update_pipeline` : si `canLeaveConfirm(name)` ET `can_auto_send(profileId,'pipeline_move')` → exécution directe + undo, sinon comportement `confirm` actuel.

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Importer ce qu'il faut**

Au bloc d'import depuis `whatsapp-agent-router.ts` (≈ l.14), ajouter `canLeaveConfirm`. Au bloc d'import depuis `whatsapp-actions.ts` (≈ l.16-23), ajouter `execUpdatePipelineWithUndo`.

- [ ] **Step 2 : Intercepter dans la branche `confirm`**

Trouver le début de la branche `if (tier === 'confirm') {` (≈ l.155 post-P2) et insérer, JUSTE APRÈS le `{` :
```ts
      if (tier === 'confirm') {
        // L3 : update_pipeline peut quitter confirm si l'agent a l'autonomie (réversible+audité).
        // canLeaveConfirm garantit que le SOCLE LÉGAL (client/offre/KYC) n'entre JAMAIS ici.
        if (canLeaveConfirm(name)) {
          const { data: gate } = await supabase.rpc('can_auto_send', { p_agent_id: profileId, p_action_type: 'pipeline_move' })
          if (gate === true) {
            const auto = await execUpdatePipelineWithUndo(ctx, args)
            messages.push({ role: 'tool', tool_call_id: call.id, content: auto })
            continue
          }
        }
        // ... (le reste de la branche confirm — stashPending — INCHANGÉ)
```
Garder tout le corps existant de la branche `confirm` (le `stashPending` etc.) après ce bloc.

- [ ] **Step 3 : Vérifier** — `deno check supabase/functions/whatsapp-agent/index.ts` → 0 erreur. Re-lire : `canLeaveConfirm` filtre AVANT le `can_auto_send` ; un outil du socle légal (canLeaveConfirm=false) tombe directement dans `stashPending` (confirm) → jamais auto.

- [ ] **Step 4 : Commit**
```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): update_pipeline auto+undo quand can_auto_send (L3), socle légal intact"
```

---

## Task 7 : `whatsapp-webhook` — handler `/annuler` (rollback) + journal de confirmations

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : Importer** `isUndoCommand` depuis `whatsapp-agent-router.ts` (bloc d'import ≈ l.11) et `undoneStage`/`nothingToUndo` depuis `whatsapp-i18n.ts`.

- [ ] **Step 2 : Handler `/annuler` en tête de `processAgentMessage`** — AVANT le bloc `const { data: pendingAction }` (≈ l.305), insérer :

```ts
  // L3 — undo différé : « /annuler » dans la fenêtre rejoue le dernier payload_undo.
  // Placé AVANT la gestion des pending (une action venant de partir en auto prime).
  if (isUndoCommand(userText)) {
    const { data: last } = await admin
      .from('whatsapp_recent_auto_actions')
      .select('id, tool, payload_undo, undo_until')
      .eq('profile_id', agentLink.profile_id)
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    const lang = detectLang(userText)
    if (last && Date.parse(last.undo_until) > Date.now()) {
      // Consommation gagnant-unique (anti double-undo) : on pose undone_at en filtrant NULL.
      const { data: claimed } = await admin.from('whatsapp_recent_auto_actions')
        .update({ undone_at: new Date().toISOString() })
        .eq('id', last.id).is('undone_at', null).select('id')
      if (claimed && claimed.length > 0) {
        let undoReply = nothingToUndo(lang)
        if (last.tool === 'update_pipeline') {
          const p = last.payload_undo as { transaction_id: string; old_stage: string }
          await admin.from('transactions').update({ stage: p.old_stage }).eq('id', p.transaction_id)
          await admin.from('activity_events').insert({
            agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
            action: 'stage_change', entity_type: 'transaction', entity_id: p.transaction_id,
            object_label: `undo → ${p.old_stage}`, category: 'deal', severity: 'info',
            metadata: { via: 'whatsapp', mode: 'undo', profile_id: agentLink.profile_id, new_stage: p.old_stage },
          })
          undoReply = undoneStage(lang, stageLabel(p.old_stage, lang))
        }
        await sendWhatsAppText(provider, msg.fromPhone, undoReply)
        return
      }
    }
    // Rien d'annulable : on laisse le message suivre le flux normal (le cerveau répondra).
  }
```
> `stageLabel` est exporté par `whatsapp-agent-router.ts` — l'importer si pas déjà. `sendWhatsAppText(provider, toPhone, body)` existe déjà (webhook:413). `detectLang` est importé. Si `/annuler` ne trouve rien d'annulable, on NE `return` PAS — le message continue vers la suite (utile si l'agent dit « annule » pour autre chose).

- [ ] **Step 3 : Journaliser les confirmations** dans le bloc `if (pendingAction)` (≈ l.321-324), après le DELETE gagnant-unique, sur `yes`/`no` :

```ts
    if (decision === 'yes' && valid) {
      await admin.from('whatsapp_confirmation_log').insert({
        profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
        tool: pendingAction.tool as string, outcome: 'yes',
      })
      reply = await executePending(admin, provider, agentLink, pendingAction, lang)
    } else if (decision === 'no') {
      await admin.from('whatsapp_confirmation_log').insert({
        profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
        tool: pendingAction.tool as string, outcome: 'no',
      })
      reply = t(lang, 'cancelled')
    } else if (!valid) {
```
> Insert best-effort (ne bloque pas si la table est absente avant la migration — mais elle est appliquée par la CI au même merge ; cf. `deploy-migrations-gate`).

- [ ] **Step 4 : Vérifier** — `deno check supabase/functions/whatsapp-webhook/index.ts` → 0 erreur.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-webhook/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): handler /annuler (undo pipeline) + journal de confirmations"
```

---

## Task 8 : Spec backend live + build + cerveau + PR

**Files:**
- Create: `tests/backend/whatsapp-autonomy-gate.spec.ts`

- [ ] **Step 1 : Spec live** (lire d'abord `tests/backend/kyc-screening-lock.spec.ts` pour les helpers). Couvrir :
  1. **`pipeline_move` câblée** : seed un profil avec `day0_payload.autonomy='resume'` → `can_auto_send(agent,'pipeline_move')` = `true` ; avec `autonomy='suggest'` → `false`. (Prouve que la clé existe et que le gate fonctionne.)
  2. **Undo rollback** : seed une transaction à l'étape A, insère une `whatsapp_recent_auto_actions` (`tool='update_pipeline'`, `payload_undo={transaction_id, old_stage:A}`, `undo_until` futur) avec la transaction passée à B ; rejoue le rollback (UPDATE stage=old_stage) ; assert la transaction revient à A.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Palier 3 — autonomy gate pipeline_move + undo', () => {
  let setup: TwoAgenciesSetup
  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => { await setup.cleanup() })

  it('can_auto_send(pipeline_move) suit l\'autonomie (resume=true, suggest=false)', async () => {
    const svc = serviceRoleClient()
    const setAutonomy = async (mode: string) => {
      await svc.from('profiles').update({
        day0_payload: { autonomy: mode, dispo: 'office', priorite: 'closing', specialite: 'x', zone: [] },
      }).eq('id', setup.agentAId)
    }
    await setAutonomy('resume')
    const { data: r } = await svc.rpc('can_auto_send', { p_agent_id: setup.agentAId, p_action_type: 'pipeline_move' })
    expect(r).toBe(true)
    await setAutonomy('suggest')
    const { data: s2 } = await svc.rpc('can_auto_send', { p_agent_id: setup.agentAId, p_action_type: 'pipeline_move' })
    expect(s2).toBe(false)
  })
})
```
> Adapter le seed `day0_payload` aux champs réels attendus par `compute_agent_preferences` (au minimum `autonomy`). Si `profiles.day0_payload` a des contraintes, lire un profil seedé existant. Ajouter le 2ᵉ `it` (undo rollback) sur le même modèle si une `transactions` minimale est seedable (sinon le documenter et tester au moins le gate).

- [ ] **Step 2 : Lancer** — `npm run build && npx vitest run` → build vert, unit verts (dont `canLeaveConfirm`/`isUndoCommand`).

- [ ] **Step 3 : Mettre à jour le cerveau** :
- `megga/whatsapp-agent-stability-autonomy-strategy` : P3 planifié → LIVRÉ (pipeline_move auto+undo + journal confirmations ; L1-undo autres outils + UI suggestion = P3b).
- `megga/whatsapp-copilot-lessons` : leçon « (11) Palier 3 : update_pipeline = SEUL outil confirm élevable (canLeaveConfirm, socle légal immuable testé en CI) ; auto si can_auto_send(pipeline_move) (clé ajoutée à compute_agent_preferences, sinon code mort) ; undo /annuler 60s via whatsapp_recent_auto_actions ; whatsapp_confirmation_log = graine d'apprentissage ».
- `megga/megga-ai-agent-learning` : noter que la 1ʳᵉ brique (confirmation_log) est livrée.
Puis `npm run ruflo:seed`.

- [ ] **Step 4 : Commit + PR**
```bash
git add tests/backend/whatsapp-autonomy-gate.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(whatsapp): spec autonomy gate + undo ; cerveau P3 livré"
```
Ouvrir la PR vers `main`. **Vérifier la date des migrations = jour du merge** (`deploy-migrations-gate`).

---

## Self-Review (vérifié contre la stratégie §5)

- ✅ Pré-requis bloquant `pipeline_move` (Task 1) AVANT le câblage (Task 6).
- ✅ `update_pipeline` SEUL outil élevable (`canLeaveConfirm`, Task 4) ; socle légal jamais auto — invariant **paramétré + exécuté** en CI (Task 4 + Task 8).
- ✅ Undo 60 s (table Task 2 + `execUpdatePipelineWithUndo` Task 5 + handler `/annuler` Task 7) ; consommation gagnant-unique anti double-undo.
- ✅ Journal de confirmations (Task 3 + écriture Task 7) = graine d'apprentissage (cerveau `megga-ai-agent-learning`).
- ✅ DeepSeek-only ; aucun tier `confirm` du socle légal touché ; `execUpdatePipeline` existant (chemin confirm) intact.

**Cohérence des noms :** `pipeline_move` (clé gate) ↔ `can_auto_send(_, 'pipeline_move')` ↔ `canLeaveConfirm('update_pipeline')` ↔ `execUpdatePipelineWithUndo` ↔ `whatsapp_recent_auto_actions.tool='update_pipeline'`.

**Hors périmètre (P3b) :** undo 30 s des autres outils `auto` + prévention pro-active `qualify_lead` (même infra, rollbacks par outil à ajouter au handler `/annuler`) ; UI super-admin de suggestion (frontend) ; filtrage tier `read` du 2ᵉ appel pendant un pending.

---

## Exécution

Session fraîche, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. **Dater les migrations du jour de merge.** Mettre le cerveau à jour à la Task 8.
