# Agent WhatsApp — Apprentissage Tranche 1 : profil de style par agent (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**Goal:** MEGGA apprend le **style de communication de chaque agent** (langue, registre, emoji, tournures) depuis ses messages, et l'**adopte sur WhatsApp** — un profil **par `profile_id`**, distillé par DeepSeek, **activé par un humain** avant injection.

**Architecture :** Pipeline `capture → distille → stocke → (revue super-admin) → injecte`. Un cron quotidien (`learn-agent-style`, clone de `whatsapp-agent-async`) distille via DeepSeek les messages récents de chaque agent en un `learned_style` court (sur `agent_ai_profiles.learned_style`, statut `suggested`). Un super-admin l'**active** (page `/dashboard/admin/learning` + RPC gardée `is_super_admin`). `whatsapp-agent` injecte le style `active` dans son prompt système (additif, tonal — jamais d'écrasement des règles légales).

**Tech Stack :** Supabase Edge (Deno/TS), PostgreSQL (migrations additives idempotentes), pg_cron + pg_net, DeepSeek (jamais Claude), React 18 + Vite + React Query + react-i18next (4 langues). Réf. spec : [docs/superpowers/specs/2026-06-03-whatsapp-agent-learning-style-design.md](../specs/2026-06-03-whatsapp-agent-learning-style-design.md).

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp apprentissage style agent_ai_profiles system_addendum injection prompt deepseek cron super-admin is_super_admin" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga
npx ruflo memory get -k "megga/whatsapp-copilot-lessons" -n megga   # leçons 11/13 + le piège is_super_admin (P3b)
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek uniquement** (jamais Claude/Anthropic/OpenAI). Cerveau `deepseek-not-claude`.
- **Human-in-the-loop** : un `learned_style` n'est JAMAIS injecté tant que son `status` n'est pas `active` (mis par un super-admin). Le cron ne pose que `suggested` et **préserve** un status déjà choisi par l'humain.
- **Style ADDITIF/tonal seulement** : appended APRÈS le `SYSTEM` figé ; ne touche jamais le socle légal ni la persona. Bloc borné (~300 car.).
- **Pas de PII** : la distillation extrait le STYLE, pas le contenu — le prompt DeepSeek interdit noms/adresses/montants/données client.
- **RPC super-admin gardées côté SERVEUR** par `public.is_super_admin()` (leçon P3b : `RAISE EXCEPTION ... ERRCODE '42501'` ; le `SuperAdminGuard` frontend ne suffit pas — fuite cross-agence sinon).
- **Migrations additives + idempotentes, DATÉES DU JOUR DE MERGE** (cerveau `deploy-migrations-gate` : sinon sautées en silence). `npm run build` passe avant tout push. **Specs backend tournent LIVE en CI** (skipIf n'est PAS un skip là-bas — les faire vraiment passer ; nettoyage `.then(()=>{}, ()=>{})` JAMAIS `.catch`). i18n 4 langues (skill `i18n-sync`).

## Périmètre

**FAIT (ce plan) :** colonne `learned_style` ; cron + edge `learn-agent-style` (capture+distille) ; injection conditionnelle dans `whatsapp-agent` ; RPC lecture + activation gardées ; page super-admin `/dashboard/admin/learning` ; specs live.

**PAS fait (tranches suivantes, MÊME pipeline) :** corrections passées (« non, plutôt… »), patterns d'horaires, contacts fréquents ; auto-activation sans revue ; auto-revue par l'agent lui-même.

---

## File Structure

**Créer :**
- `supabase/migrations/<stamp>_agent_learned_style_column.sql` — colonne `learned_style` + index.
- `supabase/migrations/<stamp>_learn_agent_style_cron.sql` — cron quotidien.
- `supabase/migrations/<stamp>_agent_learning_rpcs.sql` — RPC lecture + set-status (gardées `is_super_admin`).
- `supabase/functions/learn-agent-style/index.ts` — worker cron (capture + distille + stocke).
- `supabase/functions/learn-agent-style/deno.json` (si les autres fns en ont un — vérifier) + entrée `config.toml`.
- `supabase/functions/_shared/agent-style.ts` — `formatStyleBlock` (pur) + type `LearnedStyle`.
- `supabase/functions/_shared/agent-style.test.ts` — test de `formatStyleBlock`.
- `src/hooks/useAdminLearning.ts` — hook React Query.
- `src/pages/admin/AdminLearningPage.tsx` — page super-admin.
- `tests/backend/whatsapp-learning-style.spec.ts` — spec live.

**Modifier :**
- `supabase/functions/whatsapp-agent/index.ts` — injection du style `active` dans le message système (≈ l.110-111).
- `supabase/config.toml` — `[functions.learn-agent-style] verify_jwt = false`.
- `src/App.tsx` — route `/dashboard/admin/learning` (lazy + `SuperAdminGuard`).
- `src/components/layout/Sidebar.tsx` — entrée nav admin.
- `src/i18n/locales/{fr,de,en,it}/admin.json` (+ `common.json` pour le label nav).

**Contrat `LearnedStyle` (défini UNE fois, réutilisé partout) :**
```ts
type LearnedStyle = {
  language: 'fr' | 'en' | 'mixed'
  formality: 'tu' | 'vous' | 'direct'
  emoji: boolean
  traits: string            // 1-2 phrases, AUCUNE PII
  status: 'suggested' | 'active' | 'off'
  updated_at: string        // ISO
  sample_count: number
}
```
Stocké en `jsonb` sur `agent_ai_profiles.learned_style`.

---

## Task 1 : Migration — colonne `learned_style`

**Files:** Create `supabase/migrations/<stamp>_agent_learned_style_column.sql`

- [ ] **Step 1 : Écrire la migration** (vérifier d'abord que `agent_ai_profiles` existe : `agent_id uuid PK REFERENCES profiles(id)`, cf. `20260530190000_agent_ai_profiles.sql`)

```sql
-- Apprentissage T1 : profil de style appris par agent (jsonb), sur la table Day-0 agent_ai_profiles.
-- Additif + idempotent. NULL = pas encore de style appris (whatsapp-agent garde son prompt figé).
BEGIN;
ALTER TABLE public.agent_ai_profiles
  ADD COLUMN IF NOT EXISTS learned_style jsonb NULL;
COMMENT ON COLUMN public.agent_ai_profiles.learned_style IS
  'Apprentissage T1 : style de comm appris par agent { language, formality, emoji, traits, status(suggested|active|off), updated_at, sample_count }. Injecté dans whatsapp-agent UNIQUEMENT si status=active (human-in-the-loop). Distillé par learn-agent-style (DeepSeek), jamais de PII.';
COMMIT;
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_agent_learned_style_column.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): colonne agent_ai_profiles.learned_style (profil de style par agent)"
```

---

## Task 2 : `formatStyleBlock` (pur) + type `LearnedStyle` (TDD)

**Files:** Create `supabase/functions/_shared/agent-style.ts` + `agent-style.test.ts`

- [ ] **Step 1 : Test (échoue)** — `agent-style.test.ts` (mirror du style des tests `_shared/*.test.ts` existants — vérifier l'import `{ describe, it, expect }`/global)
```ts
import { formatStyleBlock, type LearnedStyle } from './agent-style'

const base: LearnedStyle = { language: 'fr', formality: 'tu', emoji: true, traits: 'phrases courtes, va droit au but', status: 'active', updated_at: '2026-06-03T00:00:00Z', sample_count: 20 }

describe('formatStyleBlock', () => {
  it('rend un bloc tonal borné pour un style actif', () => {
    const s = formatStyleBlock(base)
    expect(s).toContain('Style de cet agent')
    expect(s).toContain('phrases courtes')
    expect(s.length).toBeLessThanOrEqual(320)
  })
  it('renvoie chaîne vide si le style n\'est pas actif ou absent', () => {
    expect(formatStyleBlock({ ...base, status: 'suggested' })).toBe('')
    expect(formatStyleBlock({ ...base, status: 'off' })).toBe('')
    expect(formatStyleBlock(null)).toBe('')
    expect(formatStyleBlock(undefined)).toBe('')
  })
  it('tronque traits trop longs (borne le prompt)', () => {
    const long = formatStyleBlock({ ...base, traits: 'x'.repeat(500) })
    expect(long.length).toBeLessThanOrEqual(320)
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run supabase/functions/_shared/agent-style.test.ts` (ajouter ce chemin au glob `include` de `vitest.config.*` comme les autres `_shared/*.test.ts`).

- [ ] **Step 3 : Implémenter** `agent-style.ts`
```ts
export type LearnedStyle = {
  language: 'fr' | 'en' | 'mixed'
  formality: 'tu' | 'vous' | 'direct'
  emoji: boolean
  traits: string
  status: 'suggested' | 'active' | 'off'
  updated_at: string
  sample_count: number
}

/** Bloc TONAL injecté dans le prompt système de whatsapp-agent. Vide si pas 'active'.
 *  Borné (~300 car.) pour ne pas gonfler le prompt ni le coût. JAMAIS de règle/contenu. */
export function formatStyleBlock(ls: LearnedStyle | null | undefined): string {
  if (!ls || ls.status !== 'active') return ''
  const lang = ls.language === 'en' ? 'en anglais' : ls.language === 'mixed' ? 'FR/EN selon le contact' : 'en français'
  const reg = ls.formality === 'vous' ? 'vouvoie' : ls.formality === 'direct' ? 'style direct' : 'tutoie'
  const emo = ls.emoji ? 'utilise des emoji avec parcimonie' : 'sans emoji'
  const traits = (ls.traits ?? '').slice(0, 180)
  return `\n\nStyle de cet agent (adapte ton TON, jamais tes règles ni le socle légal) : ${lang}, ${reg}, ${emo}. ${traits}`.slice(0, 320)
}
```

- [ ] **Step 4 : Run → PASS.** `deno check supabase/functions/_shared/agent-style.ts`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/agent-style.ts supabase/functions/_shared/agent-style.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): formatStyleBlock + type LearnedStyle (pur, TDD)"
```

---

## Task 3 : Edge `learn-agent-style` (cron) — capture + distille + stocke

> Clone du pattern `whatsapp-agent-async` : appelé par pg_cron en service-role, `verify_jwt=false`, garde applicative `app_config.service_role_key`, BATCH borné. Lit `whatsapp_agent_links` (agents vérifiés) + leurs messages **entrants** récents (`whatsapp_messages` `wa_from = wa_number`), distille via DeepSeek, écrit `learned_style` (status `suggested`, en préservant un status humain existant).

**Files:** Create `supabase/functions/learn-agent-style/index.ts` ; Modify `supabase/config.toml`

- [ ] **Step 1 : Lire** `supabase/functions/whatsapp-agent-async/index.ts` (en entier) pour copier : la garde `app_config.service_role_key` (compare à temps constant), `createClient` service-role, `BATCH`, le `serve`. Lire aussi `whatsapp-agent/index.ts:68-104` pour le call DeepSeek (`fetch https://api.deepseek.com/v1/chat/completions`, `model:'deepseek-chat'`, `AbortSignal.timeout`) et la requête `whatsapp_messages`.

- [ ] **Step 2 : Implémenter** `learn-agent-style/index.ts`
```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MIN_MSGS = 10            // pas de profil tant qu'on n'a pas assez de signal
const SAMPLE = 30              // derniers messages échantillonnés
const BATCH = 5               // agents distillés par tick (cron quotidien, coût borné)
const DEEPSEEK_TIMEOUT_MS = 20_000

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0
}
const json = (o: unknown, c: number) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })

serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Garde : appelé par pg_cron avec Bearer = app_config.service_role_key (comme whatsapp-agent-async).
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const expected = (cfg?.value as string) ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || !safeEqual(provided, expected)) return json({ error: 'Forbidden' }, 403)

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return json({ error: 'no deepseek key' }, 200)

  // Agents vérifiés avec un numéro WhatsApp.
  const { data: links } = await admin.from('whatsapp_agent_links')
    .select('profile_id, wa_number').eq('verified', true).not('wa_number', 'is', null).limit(BATCH)
  let done = 0
  for (const link of links ?? []) {
    const waNumber = (link.wa_number as string) ?? ''
    if (!waNumber) continue
    // Messages ENTRANTS de l'agent (son style), récents.
    const { data: msgs } = await admin.from('whatsapp_messages')
      .select('body').eq('wa_from', waNumber).eq('direction', 'inbound')
      .not('body', 'is', null).order('created_at', { ascending: false }).limit(SAMPLE)
    const texts = (msgs ?? []).map((m) => (m.body as string)).filter((b) => b && b.trim().length > 1)
    if (texts.length < MIN_MSGS) continue

    const prompt = `Voici des messages écrits par un agent immobilier à son assistante. Résume SON style de communication. Réponds UNIQUEMENT en JSON strict: {"language":"fr|en|mixed","formality":"tu|vous|direct","emoji":true|false,"traits":"1-2 phrases sur ses tournures/préférences"}. RÈGLE ABSOLUE: décris le STYLE seulement — AUCUN nom, adresse, montant, ni donnée de contact. Messages:\n${texts.slice(0, SAMPLE).map((t) => `- ${t.slice(0, 200)}`).join('\n')}`
    let style: { language: string; formality: string; emoji: boolean; traits: string } | null = null
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 300, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
      })
      if (!r.ok) { console.error('deepseek http', r.status); continue }
      const d = await r.json()
      style = JSON.parse(d?.choices?.[0]?.message?.content ?? 'null')
    } catch (e) { console.error('distill failed:', (e as Error)?.name ?? 'error'); continue }
    if (!style || !['fr', 'en', 'mixed'].includes(style.language)) continue

    // Préserve un status posé par l'humain (active/off) ; sinon 'suggested'.
    const { data: existing } = await admin.from('agent_ai_profiles')
      .select('learned_style').eq('agent_id', link.profile_id).maybeSingle()
    const prevStatus = (existing?.learned_style as { status?: string } | null)?.status
    const status = prevStatus === 'active' || prevStatus === 'off' ? prevStatus : 'suggested'
    const learned = {
      language: style.language, formality: ['tu', 'vous', 'direct'].includes(style.formality) ? style.formality : 'tu',
      emoji: !!style.emoji, traits: (style.traits ?? '').slice(0, 240),
      status, updated_at: new Date().toISOString(), sample_count: texts.length,
    }
    // upsert : agent_ai_profiles a agent_id en PK ; un profil Day-0 existe déjà normalement.
    await admin.from('agent_ai_profiles').upsert({ agent_id: link.profile_id, learned_style: learned }, { onConflict: 'agent_id' })
    done++
  }
  return json({ ok: true, distilled: done }, 200)
})
```
> Vérifier le nom exact de la colonne numéro dans `whatsapp_agent_links` (`wa_number` ici — confirmer via le baseline/migration) et que `direction='inbound'` est la valeur réelle (cf. `whatsapp-webhook` qui écrit l'inbound). Vérifier que `app_config` est la table de config (clé `service_role_key`) comme dans `whatsapp-agent-async`.

- [ ] **Step 3 : `config.toml`** — ajouter :
```toml
[functions.learn-agent-style]
verify_jwt = false
```

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/learn-agent-style/index.ts` → 0 erreur.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/learn-agent-style/index.ts supabase/config.toml
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): edge learn-agent-style (distille le style par agent via DeepSeek)"
```

---

## Task 4 : Cron quotidien `learn-agent-style`

**Files:** Create `supabase/migrations/<stamp>_learn_agent_style_cron.sql`

- [ ] **Step 1 : Migration** (clone EXACT de `20260603110100_whatsapp_agent_async_cron.sql` : `net.http_post` vers la fonction, Bearer `get_app_config('service_role_key')`, garde `pg_cron`)
```sql
-- Apprentissage T1 : cron quotidien qui déclenche learn-agent-style (distillation par agent).
-- Quotidien (pas minute) : la distillation est best-effort et le style bouge lentement.
BEGIN;
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'learn-agent-style-daily', '40 4 * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/learn-agent-style',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.get_app_config('service_role_key')),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — learn-agent-style-daily non planifié';
  END IF;
END
$do$;
COMMIT;
```
> Horaire `40 4 * * *` : décalé des crons existants (flatfox 04:00, async-jobs-purge 03:20, recent-auto-actions-purge 04:30). Vérifier l'absence de collision.

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_learn_agent_style_cron.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): cron quotidien learn-agent-style"
```

---

## Task 5 : Injection du style dans `whatsapp-agent`

**Files:** Modify `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Importer** `formatStyleBlock`, `type LearnedStyle` depuis `../_shared/agent-style.ts` (bloc d'import en tête).

- [ ] **Step 2 : Lire le style actif** — après la construction de `ctx` (≈ l.84) et avant le `messages` (≈ l.110), ajouter :
```ts
  // Apprentissage T1 : style appris de l'agent, injecté SEULEMENT si activé (human-in-the-loop).
  const { data: prof } = await supabase.from('agent_ai_profiles')
    .select('learned_style').eq('agent_id', profileId).maybeSingle()
  const styleBlock = formatStyleBlock((prof?.learned_style as LearnedStyle | null) ?? null)
```

- [ ] **Step 3 : Append au message système** — l.110-111, ajouter `${styleBlock}` à la fin du `content` :
```ts
    { role: 'system', content: `${SYSTEM}\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}. Convertis toute date relative en ISO 8601 avec le décalage de Genève (+02:00 en été, +01:00 en hiver).\n\nLangue : réponds TOUJOURS dans la langue du dernier message de l'agent (français ou anglais). Ne mélange pas les langues.${styleBlock}` },
```
> `styleBlock` est `''` si pas de style `active` → comportement actuel strictement inchangé (dégradation propre). Il commence déjà par `\n\n`.

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/whatsapp-agent/index.ts` → 0 erreur. Relire : le bloc s'ajoute APRÈS le SYSTEM + les règles ; jamais avant ; vide si non-actif.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): whatsapp-agent injecte le style appris actif dans son prompt"
```

---

## Task 6 : RPC lecture + activation (gardées `is_super_admin`)

> Leçon P3b : garde SERVEUR obligatoire (le `SuperAdminGuard` frontend ne protège pas un appel `supabase.rpc` direct). `is_super_admin()` existe (baseline).

**Files:** Create `supabase/migrations/<stamp>_agent_learning_rpcs.sql`

- [ ] **Step 1 : Migration** (mirror du pattern P3b `get_whatsapp_autonomy_suggestions` : plpgsql, gate, REVOKE anon/GRANT authenticated)
```sql
-- Apprentissage T1 : RPC super-admin pour lire et activer les profils de style appris.
-- Gardées is_super_admin() côté serveur (ERRCODE 42501) — la RPC expose des données par-agent.
CREATE OR REPLACE FUNCTION public.get_agent_learned_styles()
RETURNS TABLE (agent_id uuid, agent_name text, agency_id uuid, learned_style jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.agency_id, ap.learned_style
    FROM agent_ai_profiles ap JOIN profiles p ON p.id = ap.agent_id
    WHERE ap.learned_style IS NOT NULL
    ORDER BY p.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_agent_learned_styles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_learned_styles() TO authenticated;

-- Activation / désactivation / édition des traits par un super-admin.
CREATE OR REPLACE FUNCTION public.set_agent_learned_style(p_agent_id uuid, p_status text, p_traits text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('suggested','active','off') THEN RAISE EXCEPTION 'bad status' USING ERRCODE = '22023'; END IF;
  UPDATE agent_ai_profiles
    SET learned_style = jsonb_set(
      jsonb_set(COALESCE(learned_style, '{}'::jsonb), '{status}', to_jsonb(p_status)),
      '{traits}', to_jsonb(COALESCE(p_traits, learned_style->>'traits', ''))
    )
    WHERE agent_id = p_agent_id AND learned_style IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.set_agent_learned_style(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_agent_learned_style(uuid, text, text) TO authenticated;
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_agent_learning_rpcs.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): RPC get/set agent learned style (gardées is_super_admin)"
```

---

## Task 7 : UI super-admin `/dashboard/admin/learning`

> Mirror EXACT du pattern P3b (`AdminAutonomyPage` + `useAdminAutonomy` + route + Sidebar `MEIcon` + i18n 4 langues). LÉGER : une liste par agent (nom, langue/registre/emoji, statut) + toggle Activer/Désactiver + édition `traits`. Lecture via `get_agent_learned_styles`, mutation via `set_agent_learned_style`.

**Files:** Create `src/hooks/useAdminLearning.ts`, `src/pages/admin/AdminLearningPage.tsx` ; Modify `src/App.tsx`, `src/components/layout/Sidebar.tsx`, les 4 `admin.json` (+ `common.json` pour le label nav)

- [ ] **Step 1 : Lire** `src/pages/admin/AdminAutonomyPage.tsx`, `src/hooks/useAdminAutonomy.ts`, la section admin de `src/components/layout/Sidebar.tsx`, les routes admin de `src/App.tsx` — mirror exact.

- [ ] **Step 2 : Hook** `src/hooks/useAdminLearning.ts`
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface LearnedStyleRow {
  agent_id: string; agent_name: string | null; agency_id: string | null
  learned_style: { language: string; formality: string; emoji: boolean; traits: string; status: string; updated_at: string; sample_count: number } | null
}
export function useAdminLearning() {
  return useQuery({
    queryKey: ['admin', 'learned-styles'],
    queryFn: async (): Promise<LearnedStyleRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_agent_learned_styles')
      if (error) throw error
      return (data ?? []) as LearnedStyleRow[]
    },
  })
}
export function useSetLearnedStyle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { agent_id: string; status: string; traits?: string }) => {
      const { error } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ error: Error | null }>)('set_agent_learned_style', { p_agent_id: v.agent_id, p_status: v.status, p_traits: v.traits ?? null })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'learned-styles'] }) },
  })
}
```
> Vérifier la signature exacte de `supabase.rpc` avec args dans un hook existant (ex. un hook admin qui passe des params) et l'aligner.

- [ ] **Step 3 : Page** `src/pages/admin/AdminLearningPage.tsx` — mirror du squelette `AdminAutonomyPage` (badge admin violet, titre, bannière « MEGGA observe, tu décides », table). Par ligne : `agent_name`, `language`/`formality`/`emoji`, `status`, et un bouton qui appelle `useSetLearnedStyle` (Activer si `suggested`/`off`, Désactiver si `active`). États loading/empty/error (bannière rouge `autonomy.error`-style). `useTranslation('admin')`, tokens `text-theme-*`/`bg-admin-accent`, `rounded-xl border border-theme-border`, `overflow-x-auto` sur la table. LECTURE SEULE par défaut, l'action = un clic humain explicite.

- [ ] **Step 4 : Route** — `src/App.tsx` : lazy `const AdminLearningPage = lazy(() => import('@/pages/admin/AdminLearningPage'))` + `<Route path="admin/learning" element={<SuperAdminGuard><AdminLearningPage /></SuperAdminGuard>} />` (à côté des autres admin).

- [ ] **Step 5 : Sidebar** — `src/components/layout/Sidebar.tsx` : entrée admin `{ labelKey: 'nav.adminLearning', href: '/dashboard/admin/learning', icon: 'sparkle' }` (mirror de l'entrée `autonomy` de P3b). Ajouter `nav.adminLearning` aux 4 `common.json`.

- [ ] **Step 6 : i18n** — ajouter aux 4 `src/i18n/locales/{fr,de,en,it}/admin.json` les clés `learning.title/subtitle/observeNote/col.*/activate/deactivate/empty/error` (FR + EN rédigés, DE/IT traduits fidèlement ; skill `i18n-sync`). Vérifier que chaque JSON parse.

- [ ] **Step 7 : Vérifier** `npm run build` → vert.

- [ ] **Step 8 : Commit**
```bash
git add src/hooks/useAdminLearning.ts src/pages/admin/AdminLearningPage.tsx src/App.tsx src/components/layout/Sidebar.tsx src/i18n/locales/*/admin.json src/i18n/locales/*/common.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(admin): page /dashboard/admin/learning — revue/activation des styles appris"
```

---

## Task 8 : Spec live + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-learning-style.spec.ts`

- [ ] **Step 1 : Spec live** (lire `tests/backend/whatsapp-autonomy-suggestions.spec.ts` pour le pattern super-admin : promouvoir agentA en `super_admin`, appeler via `clientA`, rejet via `clientB`). Couvrir :
  1. **RPC gardée** : seed un `agent_ai_profiles.learned_style` (status 'suggested') pour agentB ; `clientA` (super_admin) → `get_agent_learned_styles()` renvoie la ligne ; `clientB` (agent) → erreur (gate 42501).
  2. **Activation** : `clientA` → `set_agent_learned_style(agentB, 'active')` → la ligne passe `status='active'` ; `clientB` → rejet.
  3. **Injection conditionnelle** (pur, via `formatStyleBlock`) : déjà couvert par le test unit Task 2 — citer.
  Nettoyage `afterAll` `.then(()=>{}, ()=>{})` ; seed `learned_style` via `serviceRoleClient()` (table RLS).

- [ ] **Step 2 : Lancer** `npm run build && npx vitest run` → build vert, unit verts (dont `formatStyleBlock`). `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-learning-style.spec.ts` collecte propre.

- [ ] **Step 3 : Cerveau** :
- `megga/megga-ai-agent-learning` : la COUCHE D'APPRENTISSAGE (point 2) démarre — tranche 1 « style par agent » LIVRÉE (pipeline capture→distille→stocke→revue→injecte ; agent_ai_profiles.learned_style ; learn-agent-style cron DeepSeek ; injection conditionnelle status='active' ; page /dashboard/admin/learning).
- `megga/whatsapp-copilot-lessons` : leçon « Apprentissage T1 : prompt whatsapp-agent était FIGÉ (const SYSTEM) ; learned_style injecté APRÈS le SYSTEM (tonal, jamais d'écrasement légal), seulement si status='active' (human-in-the-loop, cron pose 'suggested') ; distillation DeepSeek sans PII ; RPC get/set gardées is_super_admin ».
- `megga/super-admin` : 16 pages (+ learning).
Puis `npm run ruflo:seed`.

- [ ] **Step 4 : Commit + PR**
```bash
git add tests/backend/whatsapp-learning-style.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(learning): spec RPC gardées + activation ; cerveau apprentissage T1 livré"
```
Ouvrir la PR vers `main`. **Dater les migrations du jour de merge.** NE PAS merger sans accord humain (CI verte d'abord).

---

## Self-Review (vérifié contre le spec)

- ✅ Pipeline capture→distille→stocke→revue→injecte : Task 3 (capture+distille) + Task 1 (stocke) + Task 6/7 (revue) + Task 5 (injecte).
- ✅ Human-in-the-loop : injection SEULEMENT si `status='active'` (Task 5 + `formatStyleBlock` Task 2) ; cron pose `suggested` et préserve `active`/`off` (Task 3).
- ✅ Style additif/tonal borné : `formatStyleBlock` ≤320 car., appended après le SYSTEM (Task 2/5).
- ✅ DeepSeek-only (Task 3) ; pas de PII (prompt + traits bornés).
- ✅ RPC gardées `is_super_admin` côté serveur (Task 6) — leçon P3b appliquée ; testées live (Task 8).
- ✅ Migrations additives/idempotentes (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, cron upsert) ; datées du jour de merge.
- ✅ Léger : 1 colonne, 1 worker, 1 page mince, prompt borné (demande de Gregory : « pas trop chargé »).

**Cohérence des noms :** `learned_style` (colonne) ↔ `LearnedStyle` (type) ↔ `formatStyleBlock` ↔ `learn-agent-style` (edge/cron) ↔ `get_agent_learned_styles`/`set_agent_learned_style` (RPC) ↔ `useAdminLearning`/`AdminLearningPage` ↔ clés i18n `learning.*` / `nav.adminLearning`.

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité (comme P1/P2/P3/P3b). Consulter le cerveau au début de chaque tâche. **Dater les migrations du jour de merge.** Mettre le cerveau à jour à la Task 8. i18n 4 langues synchronisées.
