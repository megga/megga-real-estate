# WhatsApp — Mimétisme de voix (few-shot) : MEGGA rédige au ton RÉEL de l'agent, par l'exemple (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`). **Session FRAÎCHE** : ce plan est autonome — tout le contexte d'archi est ci-dessous.

**Goal:** Au lieu de distiller l'agent en 4 paramètres (`learned_style`) qu'un humain doit relire et activer, MEGGA apprend sa voix **comme un LLM** : on lui montre **3-4 vrais messages récents** que l'agence a envoyés à ses clients, et elle **copie le ton** dans ses brouillons (réponse WhatsApp, email client, brouillons du copilote web). Few-shot, **auto-appliqué** (aucun toggle), **dégradation propre** si pas assez de matière.

**Architecture:** On réutilise le corpus qui existe déjà — `whatsapp_messages` (les messages `outbound` rattachés à un `contact_id` = les vrais messages clients de l'agence). Un helper `fetchClientVoiceSamples()` les lit (agence-scopé), un formateur **pur** `formatVoiceExamples()` en fait un bloc few-shot borné, injecté dans les 3 prompts de rédaction **à côté** de `formatStyleBlock` existant. Le socle légal est intact : ce bloc ne fait que **façonner un brouillon que l'agent valide** — donc pas besoin de gate d'activation (le vrai gate, c'est la confirmation d'envoi WYSIWYG déjà livrée). On complète aussi le corpus en **persistant les envois client validés via MEGGA** dans `whatsapp_messages` (aujourd'hui ils ne sont que loggés dans `activity_events`, sans le corps).

**Tech Stack:** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude), React 18 + Vite (ai-copilot côté edge). **Pas de migration** (réutilise `whatsapp_messages` existante) → pas de date-gate. Réutilise la T1 (PR #567) et la sortie assistée (PR #574, `send_client_email` / brouillon WYSIWYG / `learned_style` dans ai-copilot).

---

## Relation avec les autres plans (à lire avant de commencer)

- **Supersède la philosophie** du plan gelé `docs/superpowers/plans/2026-06-04-whatsapp-agent-learning-corrections.md` (T2 « enums »). Ce plan-ci va dans l'autre sens : **par l'exemple, pas par distillation en paramètres**. On **n'exécute pas** la T2-enums ; après cette livraison, elle peut être retirée (décision séparée). Le `learned_style` (T1) **reste** comme résumé bon-marché + filet de repli ; on ne le supprime pas.
- **Phase 2 (PAS dans ce plan) :** la **boucle de corrections** (« non, plutôt… ») — quand l'agent corrige un brouillon avant de valider, capter SA version comme exemple de voix à fort poids. Ça demande un changement du flux de confirmation (accepter une correction en texte libre, pas seulement oui/non) → feature distincte, à planifier après. Notée, hors périmètre ici.

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp voix few-shot exemples learned_style formatStyleBlock send_client_email ai-copilot whatsapp_messages contact_id human-in-the-loop guardrails" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga   # T1 style ; la couche d'apprentissage
npx ruflo memory get -k "megga/megga-ai-persona" -n megga          # client = la vitrine, vouvoiement, TOUJOURS validé
npx ruflo memory get -k "megga/ai-guardrails" -n megga             # jamais de contact client sans validation agent
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga    # tiers/confirm ; brouillon WYSIWYG (PR #574)
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek uniquement** pour toute rédaction (`deepseek-chat`). JAMAIS Claude/OpenAI.
- **Socle légal / human-in-the-loop intact :** ce bloc ne touche QUE des **brouillons** qui restent validés par l'agent (sortie assistée : `send_client_message`/`send_listings`/`send_client_email` restent tier `confirm`, `canLeaveConfirm` reste `false`). On ne change AUCUN tier, AUCUN chemin d'envoi. Le mimétisme de voix s'applique **sans gate** précisément parce que l'humain valide chaque envoi.
- **Anti-fuite inter-clients (PII) :** le bloc few-shot montre de vrais messages → le prompt **interdit explicitement** de réutiliser leur **contenu/données** (noms, prix, dates) ; il ne sert qu'au **TON**. À répéter dans le texte du bloc (`formatVoiceExamples`).
- **PII / data-residency (décision produit, à confirmer) :** le few-shot envoie de vrais messages clients à DeepSeek. C'est le **même flux** que la rédaction actuelle (l'instruction + le contexte du fil partent déjà à DeepSeek) et les messages sont **déjà** dans `whatsapp_messages` — **aucun nouveau stockage**. À relier au flag data-residency `ai-copilot` (cerveau `copilot-models-pii`) ; ne bloque pas ce plan, mais le noter dans le cerveau (Task 7).
- **Dégradation propre :** `formatVoiceExamples` renvoie `''` si < 2 exemples → les prompts retombent **exactement** sur le comportement actuel (`formatStyleBlock` + brief). Aucun risque cold-start.
- **Limite v1 assumée :** la voix est **agence-scopée**, pas par agent (`whatsapp_messages` ne trace pas l'agent émetteur d'un `outbound`). Pour un agent solo (le client actuel) c'est de facto sa voix. Raffinement par-agent = plus tard. **À noter dans le cerveau**, pas un blocage.
- **Pas de migration** (réutilise `whatsapp_messages`). `npm run build` vert avant tout push. **Specs backend tournent LIVE en CI** (skipIf n'est PAS un skip ; nettoyage `.then(()=>{}, ()=>{})`, JAMAIS `.catch`). i18n : ces blocs sont **agent-facing FR/EN** (comme `formatStyleBlock`), pas d'UI 4-langues à toucher.

## Périmètre

**FAIT (ce plan) :** (1) formateur pur `formatVoiceExamples` + type `VoiceSample` (TDD) ; (2) helper `fetchClientVoiceSamples` (lecture `whatsapp_messages`, agence-scopé) ; (3) injection dans `prepareSendClientEmail` (email) ; (4) injection dans le prompt système de `whatsapp-agent` (réponses `send_client_message`) ; (5) injection dans `ai-copilot` (brouillons web) ; (6) **persistance** des envois client validés via MEGGA (`send_client_message`/`send_listings`) dans `whatsapp_messages` (enrichit le corpus + complète le fil) ; (7) specs live + cerveau + PR.

**PAS fait (Phase 2 / plus tard) :** boucle de corrections (« non, plutôt… » → exemple à fort poids) ; voix **par agent** en agence multi-agents ; retrait de la T2-enums ; un éventuel store dédié si on veut sortir la voix de `whatsapp_messages`.

---

## Carte d'archi (anchors vérifiés)

- `supabase/functions/_shared/agent-style.ts` : `formatStyleBlock(ls)` (self-gating `status==='active'`), type `LearnedStyle`. **Fichier pur**, déjà dans le glob `include` de `vitest.config.ts` via `agent-style.test.ts`. On y AJOUTE `VoiceSample`, `formatVoiceExamples`, `fetchClientVoiceSamples`.
- `supabase/functions/_shared/whatsapp-actions.ts` : `prepareSendClientEmail` (l. ~1197-1317) — construit `systemPrompt` (l. ~1254-1265) puis appende `${styleBlock}` (l. ~1263). `ActionCtx` (l. 25 : `supabase, profileId, agencyId, lang…`). C'est là qu'on injecte la voix pour l'email.
- `supabase/functions/whatsapp-agent/index.ts` : fetch `learned_style` (l. 92-94) + `styleBlock` ; message système (l. 121) finit par `...Ne mélange pas les langues.${styleBlock}`. `ctx.agencyId = link.agency_id`. C'est là qu'on injecte la voix pour les réponses client.
- `supabase/functions/ai-copilot/index.ts` : bloc perso (l. ~271-297) fetch `agent_ai_profiles.select('brief, learned_style')` puis appende `system_addendum` + `formatStyleBlock` ; le `systemPrompt` est consommé à l'appel DeepSeek (l. ~331-341). On y injecte la voix.
- `supabase/functions/whatsapp-webhook/index.ts` : `executePending` (l. ~570-648). `send_client_message` (l. ~577-607) envoie via Meta puis loggue `activity_events` **mais n'insère PAS** le corps dans `whatsapp_messages`. `send_listings` (l. ~618-635) idem. Pattern d'upsert outbound de référence (réponse MEGGA→agent) : l. **398-408** (`provider`, `provider_message_id`, `direction:'outbound'`, `wa_from: sendConfig.metaPhoneNumberId ?? 'megga'`, `wa_to`, `agency_id`, `body`, `status:'received'`, `is_agent_error`, `onConflict:'provider,provider_message_id', ignoreDuplicates:true`). `provider.parseSendResult(status, body).providerMessageId` extrait l'id (l. 392-393).
- `whatsapp_messages` (migration `20260528150000`) : colonnes `direction('inbound'|'outbound')`, `wa_from`, `wa_to`, `contact_id (uuid, FK contacts, NULL)`, `agency_id (uuid, FK agencies, NULL)`, `body (text, NULL)`, `created_at`, `provider`, `provider_message_id`, `is_agent_error`, `status`, `transcript`. Index partiels `(contact_id, created_at DESC) WHERE contact_id IS NOT NULL` et `(agency_id, created_at DESC) WHERE agency_id IS NOT NULL`. **Les messages clients = `direction='outbound' AND contact_id IS NOT NULL`.**

---

## File Structure

**Modifier :**
- `supabase/functions/_shared/agent-style.ts` — `VoiceSample`, `formatVoiceExamples` (pur), `fetchClientVoiceSamples` (I/O) — Tasks 1-2.
- `supabase/functions/_shared/agent-style.test.ts` — tests de `formatVoiceExamples` — Task 1. *(Déjà dans le glob `include`.)*
- `supabase/functions/_shared/whatsapp-actions.ts` — injecter la voix dans `prepareSendClientEmail` — Task 3.
- `supabase/functions/whatsapp-agent/index.ts` — injecter la voix dans le prompt système (réponses client) — Task 4.
- `supabase/functions/ai-copilot/index.ts` — injecter la voix — Task 5.
- `supabase/functions/whatsapp-webhook/index.ts` — persister les envois client validés (MEGGA) — Task 6.

**Créer :**
- `tests/backend/whatsapp-voice-mirroring.spec.ts` — spec live — Task 7.

**Contrats (définis une fois) :**
```ts
// _shared/agent-style.ts
export type VoiceSample = { body: string }   // un vrai message client de l'agence (source de ton)
export function formatVoiceExamples(samples: VoiceSample[] | null | undefined, lang?: 'fr' | 'en'): string
export async function fetchClientVoiceSamples(supabase: SupabaseClient, agencyId: string | null, limit?: number): Promise<VoiceSample[]>
```

---

## Task 1 : `formatVoiceExamples` + type `VoiceSample` (pur, TDD)

**Files:** Modify `supabase/functions/_shared/agent-style.ts` + `supabase/functions/_shared/agent-style.test.ts`

- [ ] **Step 1 : Tests (échouent)** — AJOUTER à `agent-style.test.ts`. Élargir d'abord l'import en tête : `import { formatStyleBlock, formatVoiceExamples, type LearnedStyle, type VoiceSample } from './agent-style'`. Puis :
```ts
const voice: VoiceSample[] = [
  { body: 'Bonjour Madame, le bien de Cologny est toujours disponible. Je vous propose une visite jeudi en fin de journée.' },
  { body: 'Bonjour, merci pour votre retour. Je reviens vers vous très vite avec les documents demandés.' },
]

describe('formatVoiceExamples', () => {
  it('rend un bloc few-shot pour ≥ 2 exemples', () => {
    const s = formatVoiceExamples(voice)
    expect(s).toContain('Copie le TON')
    expect(s).toContain('Cologny')
    expect(s.length).toBeLessThanOrEqual(900)
  })
  it('interdit explicitement de réutiliser le contenu (anti-fuite)', () => {
    expect(formatVoiceExamples(voice)).toMatch(/NE REPRENDS JAMAIS|jamais leur contenu/i)
  })
  it('renvoie vide en dessous de 2 exemples (cold-start → fallback)', () => {
    expect(formatVoiceExamples([])).toBe('')
    expect(formatVoiceExamples([{ body: 'ok' }])).toBe('')
    expect(formatVoiceExamples(null)).toBe('')
    expect(formatVoiceExamples(undefined)).toBe('')
  })
  it('dédoublonne et borne chaque exemple à 220 car.', () => {
    const dup = [{ body: 'Z'.repeat(400) }, { body: 'Z'.repeat(400) }, { body: 'Bonjour, voici les informations demandées.' }]
    const s = formatVoiceExamples(dup)
    expect(s).toContain('Bonjour, voici les informations')   // 2 uniques → rendu
    expect(s).not.toContain('Z'.repeat(221))                 // chaque exemple tronqué
  })
  it('filtre les messages vides / trop courts', () => {
    expect(formatVoiceExamples([{ body: '  ' }, { body: 'a' }])).toBe('')
  })
  it('variante EN', () => {
    expect(formatVoiceExamples(voice, 'en')).toContain('Mirror the TONE')
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run supabase/functions/_shared/agent-style.test.ts` → échec (`formatVoiceExamples` non défini).

- [ ] **Step 3 : Implémenter** — AJOUTER à `agent-style.ts` (sans toucher `LearnedStyle`/`formatStyleBlock`) :
```ts
/** Un vrai message destiné à un client, source de mimétisme de voix (few-shot). */
export type VoiceSample = { body: string }

const VOICE_MIN = 2            // en dessous, pas assez de signal → bloc vide (fallback style/brief)
const VOICE_MAX = 4            // few-shot borné (coût + focus)
const VOICE_SAMPLE_CHARS = 220 // borne par exemple
const VOICE_BLOCK_CHARS = 900  // borne du bloc entier

/** Bloc FEW-SHOT : montre de VRAIS messages clients pour copier le TON, JAMAIS le contenu.
 *  Vide si < VOICE_MIN exemples. Auto-appliqué (pas de gate) : ne façonne qu'un brouillon validé. */
export function formatVoiceExamples(samples: VoiceSample[] | null | undefined, lang: 'fr' | 'en' = 'fr'): string {
  const cleaned = (samples ?? [])
    .map((s) => (s?.body ?? '').trim())
    .filter((b) => b.length > 1)
    .map((b) => b.slice(0, VOICE_SAMPLE_CHARS))
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const b of cleaned) { const k = b.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(b) } }
  const picked = uniq.slice(0, VOICE_MAX)
  if (picked.length < VOICE_MIN) return ''
  const list = picked.map((b) => `- « ${b} »`).join('\n')
  const head = lang === 'en'
    ? `\n\nReal recent messages this agency sent to its clients — Mirror the TONE (vocabulary, length, sign-offs). NEVER reuse their content/data (names, prices, dates); write fresh for the current client.\n${list}`
    : `\n\nVrais messages récents que cette agence a envoyés à ses clients — Copie le TON (vocabulaire, longueur, formules). NE REPRENDS JAMAIS leur contenu/données (noms, prix, dates) ; rédige du neuf pour le client courant.\n${list}`
  return head.slice(0, VOICE_BLOCK_CHARS)
}
```

- [ ] **Step 4 : Run → PASS.** `npx vitest run supabase/functions/_shared/agent-style.test.ts` (les tests T1 existants + les 6 nouveaux passent). Puis `deno check supabase/functions/_shared/agent-style.ts`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/agent-style.ts supabase/functions/_shared/agent-style.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): formatVoiceExamples + type VoiceSample (pur, TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : `fetchClientVoiceSamples` (lecture `whatsapp_messages`, agence-scopé)

> Lit les vrais messages clients de l'agence (`outbound` + `contact_id`), récents, pour le few-shot. Agence-scopé (limite v1 : pas par agent). Lecture seule, dégrade à `[]`.

**Files:** Modify `supabase/functions/_shared/agent-style.ts`

- [ ] **Step 1 : Ajouter l'import de type** en tête de `agent-style.ts` (type-only → n'affecte pas le test Node) :
```ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
```

- [ ] **Step 2 : Implémenter** (après `formatVoiceExamples`) :
```ts
/** Récupère de vrais messages clients récents de l'agence (mimétisme de voix).
 *  Agence-scopé au SQL (`whatsapp_messages` ne trace pas l'agent émetteur — limite v1).
 *  Lecture seule ; dégrade à [] proprement (jamais d'exception qui casse la rédaction). */
export async function fetchClientVoiceSamples(
  supabase: SupabaseClient, agencyId: string | null, limit = 8,
): Promise<VoiceSample[]> {
  if (!agencyId) return []
  const { data } = await supabase.from('whatsapp_messages')
    .select('body')
    .eq('agency_id', agencyId)
    .eq('direction', 'outbound')
    .not('contact_id', 'is', null)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as Array<{ body: string | null }>)
    .map((r) => ({ body: (r.body ?? '').trim() }))
    .filter((s) => s.body.length > 1)
}
```
> Note : on récupère `limit=8` et `formatVoiceExamples` en garde 4 après dédup — marge pour les doublons/messages courts.

- [ ] **Step 3 : Vérifier** `deno check supabase/functions/_shared/agent-style.ts` → 0 erreur. `npx vitest run supabase/functions/_shared/agent-style.test.ts` reste vert (le test ne touche pas la fonction I/O).

- [ ] **Step 4 : Commit**
```bash
git add supabase/functions/_shared/agent-style.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): fetchClientVoiceSamples — corpus de voix depuis whatsapp_messages (agence-scopé)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Injecter la voix dans `prepareSendClientEmail` (email client)

**Files:** Modify `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Step 1 : Élargir l'import** d'`agent-style.ts` (il importe déjà `formatStyleBlock, type LearnedStyle`) :
```ts
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle } from './agent-style.ts'
```

- [ ] **Step 2 : Récupérer les exemples** dans `prepareSendClientEmail`, juste après le calcul de `styleBlock` (l. ~1231) :
```ts
  // Mimétisme de voix : vrais messages clients récents de l'agence (few-shot). Vide si < 2.
  const voiceSamples = await fetchClientVoiceSamples(ctx.supabase, ctx.agencyId)
  const voiceBlock = formatVoiceExamples(voiceSamples, lang === 'en' ? 'en' : 'fr')
```

- [ ] **Step 3 : Appender au `systemPrompt`** — le prompt actuel se termine (l. ~1263-1265) par le bloc de style additif puis ``Réponds UNIQUEMENT en JSON strict…``. Ajouter `${voiceBlock}` **après** le bloc de style additif et **avant** la consigne JSON finale. Le `systemPrompt` devient (extrait) :
```ts
- Longueur adaptée à l'objet : ni trop court ni trop long.${styleBlock ? `\n\nTon ADDITIF de cet agent (nuance uniquement la chaleur/concision/traits, sans jamais déroger au vouvoiement ni aux règles ci-dessus) :${styleBlock}` : ''}${voiceBlock}

Réponds UNIQUEMENT en JSON strict : {"subject":"…","body":"…"}`
```
> `voiceBlock` commence par `\n\n` quand non vide, `''` sinon → comportement actuel strictement inchangé en cold-start. Le vouvoiement (règle absolue déjà en tête du prompt) prime toujours sur le ton des exemples.

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/_shared/whatsapp-actions.ts` → 0 erreur. Relire : aucune autre logique touchée ; `fetchClientVoiceSamples` est `await`é avant le sous-appel DeepSeek ; dégrade à `''`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): send_client_email rédige au ton réel de l'agence (few-shot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Injecter la voix dans le prompt système de `whatsapp-agent` (réponses client)

> Pour `send_client_message`, le corps est composé par la boucle principale DeepSeek (argument d'outil), pas par un sous-appel dédié. On injecte donc la voix dans le **message système**, mais **scopée aux messages CLIENT** (sinon MEGGA risque de vouvoyer l'agent en chat). Cadrage explicite.

**Files:** Modify `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Élargir l'import** (l. ~25 actuelle) :
```ts
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle } from '../_shared/agent-style.ts'
```

- [ ] **Step 2 : Récupérer les exemples** juste après le calcul de `styleBlock` (l. ~94) :
```ts
  // Mimétisme de voix (few-shot) : vrais messages clients de l'agence, pour les messages DESTINÉS À UN CLIENT.
  const voiceSamples = await fetchClientVoiceSamples(supabase, ctx.agencyId)
  const rawVoice = formatVoiceExamples(voiceSamples, lang === 'en' ? 'en' : 'fr')
  // Cadrage : la voix ne s'applique QU'aux messages client (send_client_message), jamais au chat avec l'agent.
  const voiceBlock = rawVoice
    ? (lang === 'en'
        ? `\n\nWhen you draft a message FOR A CLIENT (send_client_message), mirror this tone; with the agent, keep your usual style.${rawVoice}`
        : `\n\nQuand tu rédiges un message POUR UN CLIENT (send_client_message), copie ce ton ; avec l'agent, garde ton style habituel.${rawVoice}`)
    : ''
```

- [ ] **Step 3 : Appender au message système** — l. 121 finit par `...Ne mélange pas les langues.${styleBlock}`. Ajouter `${voiceBlock}` juste après `${styleBlock}` (avant le backtick fermant) :
```ts
    { role: 'system', content: `${SYSTEM}\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}. Convertis toute date relative en ISO 8601 avec le décalage de Genève (+02:00 en été, +01:00 en hiver).\n\nLangue : réponds TOUJOURS dans la langue du dernier message de l'agent (français ou anglais). Ne mélange pas les langues.${styleBlock}${voiceBlock}` },
```
> Ordre : SYSTEM figé → date → langue → style → voix. `voiceBlock = ''` si < 2 exemples → prompt byte-identique à aujourd'hui. La voix vient APRÈS le SYSTEM figé et la persona, jamais avant (ne contourne rien).

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/whatsapp-agent/index.ts` → 0 erreur. Confirmer : sans corpus, prompt inchangé ; le cadrage « pour un client uniquement » est présent.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): réponses client WhatsApp au ton réel de l'agence (few-shot, cadré client)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 : Injecter la voix dans `ai-copilot` (brouillons web)

**Files:** Modify `supabase/functions/ai-copilot/index.ts`

- [ ] **Step 1 : Élargir l'import** (la PR #574 a ajouté `formatStyleBlock, type LearnedStyle` depuis `../_shared/agent-style.ts`) :
```ts
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle } from '../_shared/agent-style.ts'
```

- [ ] **Step 2 : Récupérer + injecter** dans le bloc perso (`if (!isPublicSearch)`), juste après l'append de `formatStyleBlock(...)` (l. ~291-292). On dispose déjà du client service-role `sb` et de l'agence de l'utilisateur via son profil. Récupérer l'`agency_id` puis les exemples :
```ts
            // Mimétisme de voix : vrais messages clients de l'agence (few-shot), pour les brouillons client.
            const { data: profRow } = await sb.from('profiles').select('agency_id').eq('id', u.user.id).maybeSingle()
            const agencyId = (profRow as { agency_id: string | null } | null)?.agency_id ?? null
            const voiceBlock = formatVoiceExamples(
              await fetchClientVoiceSamples(sb, agencyId),
              language === 'en' ? 'en' : 'fr',
            )
            if (voiceBlock) systemPrompt += voiceBlock
```
> Reste DANS le `try { } catch (_) {}` best-effort existant (un échec ne bloque jamais la réponse IA). `voiceBlock = ''` si < 2 → inchangé. Le cadrage « client » est intrinsèque (le copilote rédige des brouillons client : `draft_email`/`draft_description`).

- [ ] **Step 3 : Vérifier** `deno check supabase/functions/ai-copilot/index.ts` → 0 erreur. Confirmer : dans le `try`, après le style ; chemin public (`isPublicSearch`) intact ; pas de `any`.

- [ ] **Step 4 : Commit**
```bash
git add supabase/functions/ai-copilot/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): ai-copilot rédige au ton réel de l'agence (few-shot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6 : Persister les envois client validés (MEGGA) dans `whatsapp_messages`

> Aujourd'hui `send_client_message`/`send_listings` envoient via Meta puis ne loggent que `activity_events` (sans le corps) → ces messages **manquent au fil ET au corpus de voix**. On les persiste (mirror l'upsert outbound l. 398-408). Double bénéfice : le fil client est complet, et la voix de MEGGA validée nourrit le few-shot.

**Files:** Modify `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : `send_client_message`** — dans `executePending`, le bloc l. ~595-606 fait `fetch(sreq…)` puis (si ok) `activity_events`. Récupérer l'id du provider et **insérer le message** avant le log. Remplacer le `try { const sres = await fetch(...) ... }` d'envoi par :
```ts
    let outId: string | null = null
    try {
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      if (!sres.ok) return t(lang, 'sendFail24h')
      const sbody = await sres.json().catch(() => ({}))
      outId = provider.parseSendResult(sres.status, sbody).providerMessageId
    } catch { return t(lang, 'sendFailNet') }
    // Persiste le message client envoyé (fil + corpus de voix). Idempotent, non bloquant.
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: outId ?? `local-clientmsg-${contactId}-${Date.now()}`,
      direction: 'outbound', wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
      wa_to: String(contact.phone).replace(/\D/g, ''), contact_id: contactId,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
```
> `contact` (avec `.phone`) et `text` sont déjà en scope dans ce bloc (résolus l. ~583-588). `sendConfig` aussi (l. ~589-593).

- [ ] **Step 2 : `send_listings`** — le bloc l. ~618-634 envoie via `sendWhatsAppText(provider, phone, text)` (renvoie un booléen). On n'a pas l'id du provider ici → persister avec un id local (idempotence raisonnable). Après `if (!sent) return …` :
```ts
    // Persiste le message client envoyé (fil + corpus de voix). Idempotent, non bloquant.
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: `local-listings-${String(pending.args.contact_id ?? '')}-${Date.now()}`,
      direction: 'outbound', wa_from: Deno.env.get('META_PHONE_NUMBER_ID') ?? 'megga',
      wa_to: phone, contact_id: String(pending.args.contact_id ?? '') || null,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
```
> `phone` et `text` sont en scope (l. ~621-622). Si `contact_id` est absent, `null` (le message reste au fil agence mais hors corpus voix — acceptable).

- [ ] **Step 3 : Vérifier** `deno check supabase/functions/whatsapp-webhook/index.ts` → 0 erreur. Relire : l'envoi n'est pas régressé (on garde les `return t(lang,'sendFail…')` sur échec) ; la persistance est `.then(()=>{},()=>{})` (jamais bloquante, jamais `.catch`) ; `onConflict` idempotent.

- [ ] **Step 4 : Commit**
```bash
git add supabase/functions/whatsapp-webhook/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(voice): persiste les messages client validés MEGGA (fil complet + corpus de voix)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7 : Spec live + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-voice-mirroring.spec.ts`

- [ ] **Step 1 : Spec live** — mirror `tests/backend/whatsapp-learning-style.spec.ts` (`setupTwoAgencies()`, `serviceRoleClient()`, `describe.skipIf(!HAS_KEYS)`, cleanup `.then(() => {}, () => {})`). Couvrir, **sans appeler DeepSeek** :
  1. **`fetchClientVoiceSamples` agence-scopé** : via `serviceRoleClient()`, insérer 3 messages dans `whatsapp_messages` pour l'agence A (`direction:'outbound'`, `contact_id` d'un contact A, `body` non vide) et 1 pour l'agence B. Importer `fetchClientVoiceSamples` depuis `../../supabase/functions/_shared/agent-style` et l'appeler avec un client service-role + `agencyAId` → renvoie **exactement** les 3 de A (jamais celui de B). Appeler avec `agencyId=null` → `[]`.
  2. **Formateur pur** (`formatVoiceExamples`) : déjà couvert par les tests unit (Task 1) — citer en commentaire, ne pas dupliquer.
  3. **Non-régression socle** (pur, import direct du router comme la spec sortie assistée) : `canLeaveConfirm('send_client_message') === false` ET `canLeaveConfirm('send_client_email') === false` — ce plan ne touche aucun tier.
  Nettoyage `afterAll` : supprimer les `whatsapp_messages` insérés (`.then(()=>{},()=>{})`), puis `setup.cleanup()`.
  > Note CI : la spec tourne LIVE (clés présentes) ; `fetchClientVoiceSamples` hit le vrai PostgREST. En local sans clés, `skipIf` saute (les parties pures restent couvertes par les unit tests de Task 1).

- [ ] **Step 2 : Build & tests** — `npm run build` (vert) ; `npx vitest run` (vert, dont les 6 nouveaux tests `agent-style`) ; `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-voice-mirroring.spec.ts` (collecte propre). `deno check` sur les 5 edge functions touchées (`agent-style.ts`, `whatsapp-actions.ts`, `whatsapp-agent/index.ts`, `ai-copilot/index.ts`, `whatsapp-webhook/index.ts`).

- [ ] **Step 3 : Cerveau** :
- `megga/megga-ai-agent-learning` : la couche d'apprentissage évolue — **mimétisme de voix (few-shot) LIVRÉ** : MEGGA copie le TON réel de l'agence à partir de ses vrais messages clients (`whatsapp_messages` outbound+contact_id), injecté dans `send_client_email` / réponses `send_client_message` / `ai-copilot`, **auto (pas de gate)** car le brouillon reste validé ; `learned_style` (enums T1) conservé en repli. **Supersède** la philosophie de la T2-enums (plan gelé `2026-06-04-whatsapp-agent-learning-corrections.md` — par l'exemple, pas par paramètres). Limite v1 : voix **agence-scopée** (pas par agent). PII : few-shot envoie de vrais messages clients à DeepSeek (même flux que la rédaction ; aucun nouveau stockage ; bloc anti-réutilisation du contenu) → lié au flag data-residency `copilot-models-pii`.
- `megga/whatsapp-agent-copilot` : `send_client_message`/`send_listings` **persistent désormais** le message envoyé dans `whatsapp_messages` (fil client complet + corpus de voix), en plus du log `activity_events`.
- `megga/megga-ai-persona` (si présent dans le seed) : la voix apprise façonne les brouillons clients ; le **vouvoiement reste la règle socle** (le few-shot ne nuance que le ton, jamais le vouvoiement ni la validation).
Puis `npm run ruflo:seed` ; valider le JSON (`node -e "require('./.claude-flow/knowledge/megga-memory.seed.json')"`).

- [ ] **Step 4 : Commit + PR** vers `main`. Pas de migration → pas de date-gate. NE PAS merger sans accord humain (CI verte d'abord). Le contrôleur ouvre la PR et confirme quand c'est vert.
```bash
git add tests/backend/whatsapp-voice-mirroring.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(voice): spec corpus agence-scopé + socle ; cerveau mimétisme de voix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ « Comme Claude » : par l'exemple (few-shot de vrais messages), pas par 4 paramètres à régler. Auto-appliqué (pas de toggle).
- ✅ Socle légal intact : aucun tier touché, `canLeaveConfirm` inchangé (testé Task 7.3) ; la voix ne façonne qu'un **brouillon validé** → pas de gate nécessaire, le gate reste la confirmation d'envoi (PR #574).
- ✅ Dégradation propre : `formatVoiceExamples` `''` si < 2 → prompts byte-identiques au comportement actuel (Tasks 3/4/5). Cold-start couvert.
- ✅ Anti-fuite PII inter-clients : le bloc interdit de réutiliser le contenu des exemples (testé Task 1) ; vouvoiement client toujours prioritaire.
- ✅ DeepSeek-only (aucun nouvel appel modèle ; on enrichit des prompts existants). Pas de migration (réutilise `whatsapp_messages`) → pas de date-gate.
- ✅ Corpus complété : envois client validés MEGGA persistés (Task 6) — fil + voix ; idempotent + non bloquant.
- ✅ Réutilise l'existant : `formatStyleBlock`/`agent-style.ts`, `whatsapp_messages`, les 3 chemins de rédaction (PR #567 + #574). Léger.
- ✅ Specs live + build vert + cerveau (Task 7). Blocs agent-facing FR/EN (pas d'UI 4-langues).
- ✅ Limites assumées et notées (voix agence-scopée v1 ; corrections = Phase 2 ; PII/data-residency = décision produit).

**Cohérence des noms :** `VoiceSample` (type) ↔ `formatVoiceExamples` (pur) ↔ `fetchClientVoiceSamples` (I/O) ↔ `voiceBlock` (injection) ↔ `whatsapp_messages` outbound+contact_id (corpus).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. Mettre le cerveau à jour à la Task 7. Attention de revue : (1) cold-start — sans corpus, les prompts sont strictement inchangés ; (2) anti-fuite — le bloc interdit la réutilisation du contenu des exemples ; (3) cadrage — la voix ne bave pas sur le chat agent (Task 4) ; (4) Task 6 ne régresse pas l'envoi (échecs toujours signalés) et reste idempotente/non bloquante ; (5) DeepSeek-only, socle légal jamais touché.
