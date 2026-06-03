# Agent WhatsApp — Palier 1 : Stabilisation (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le ressenti « l'agent WhatsApp plante / oublie tout » par 4 correctifs ciblés (< 1 jour), sans nouvelle architecture : fin du ré-écho des erreurs en mémoire, verrou anti-double-screening, garde anti-amnésie, et fin de la course d'envoi du PDF.

**Architecture :** Aucune nouvelle infra. (1) Une colonne `is_agent_error` sur `whatsapp_messages` que l'agent pose sur ses réponses d'échec et exclut de sa mémoire 24h (C1). (2) Un verrou `screening_status` en base contre le double-screening Dilisense. (3) Une garde quand le numéro de l'agent est vide (amnésie silencieuse). (4) Réduction de l'abort Cloudflare interne pour qu'il reste sous celui de l'appelant.

**Tech Stack :** Supabase Edge Functions (Deno/TypeScript), PostgreSQL (migrations additives idempotentes), Vitest backend (specs live contre une stack Supabase locale en CI).

**Réf. stratégie (la spec) :** [docs/strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md](../../strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md), §2 (Stabilisation immédiate) + §4.2 (garde waNumber). **Cerveau :** `megga/whatsapp-agent-stability-autonomy-strategy`, `megga/whatsapp-copilot-lessons` (leçon 5 = l'écho), `megga/whatsapp-data-model`.

> **Déjà livré (NE PAS refaire) :** §2.3 (les 4 `console.error` PII-safe sur `kyc-report-pdf`) a été shippé dans la PR #548. Ce plan couvre §2.1, §2.2, §2.4, §2.5, §4.2.

---

## Avant de commencer — consulter le cerveau

Le projet a une mémoire vivante. **Avant de coder**, lancer :
```bash
npx ruflo memory search -q "whatsapp agent mémoire écho is_agent_error screening lock" -n megga
npx ruflo memory get -k "megga/whatsapp-copilot-lessons" -n megga
```
Leçon 5 = la cause de l'écho. Le nœud `whatsapp-agent-stability-autonomy-strategy` contient le diagnostic complet. **Ne pas modifier le seed** pendant l'implémentation (la mise à jour du cerveau est la dernière tâche).

## Contraintes dures (non négociables)

- **IA = DeepSeek uniquement** côté agent (jamais Claude). Ne rien changer au provider.
- **Human-in-the-loop légal intact** : ce palier ne touche AUCUN tier `confirm` (envoi client / offres / pipeline / KYC). On ne fait que de la stabilité.
- **Migrations additives + idempotentes** (`IF NOT EXISTS` / `DROP ... IF EXISTS` / `CREATE OR REPLACE`) : le CI rejoue les migrations du jour (cf. `.github/workflows/deploy.yml`).
- Edges déployées `--no-verify-jwt` (auth applicative interne) — ne pas y toucher.

---

## File Structure

**Créer :**
- `supabase/migrations/20260603100000_whatsapp_messages_is_agent_error.sql` — colonne `is_agent_error`.
- `supabase/migrations/20260603100100_kyc_screening_status_check.sql` — CHECK + sémantique du verrou sur `kyc_cases.screening_status`.
- `tests/backend/whatsapp-agent-error-memory.spec.ts` — spec live : une réponse d'erreur est flaggée + exclue de C1.
- `tests/backend/kyc-screening-lock.spec.ts` — spec live : double appel rapproché = un seul screening.

**Modifier :**
- `supabase/functions/whatsapp-agent/index.ts` — (a) poser `isError:true` sur les branches d'échec, (b) filtrer C1 sur `is_agent_error=false`, (c) garde waNumber vide (§4.2).
- `supabase/functions/whatsapp-webhook/index.ts` — propager `isError` de `callAgentBrain` → écrire `is_agent_error` sur l'outbound.
- `supabase/functions/_shared/whatsapp-actions.ts` — verrou `screening_status` dans `execRunKycScreening` + message timeout déterministe (§2.4).
- `supabase/functions/kyc-report-pdf/index.ts` — abort CF 55000 → 45000 (§2.5).

**Réutilisé sans changement :** le pattern service-à-service, `t(lang,...)` i18n, `safeEqual`, l'infra de tests backend (`tests/backend/helpers/`).

---

## Task 1 : Migration — colonne `is_agent_error` sur `whatsapp_messages`

**Files:**
- Create: `supabase/migrations/20260603100000_whatsapp_messages_is_agent_error.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Marque les réponses outbound de l'agent qui sont des ÉCHECS (IA indispo, "je n'ai
-- pas compris", boucle épuisée, occupé…). La mémoire conversationnelle C1 (24h) les
-- EXCLUT, sinon MEGGA relit ses propres erreurs comme du contexte valide et les
-- ré-écho (cf. brain whatsapp-copilot-lessons, leçon 5). Additif, défaut false :
-- aucune ligne existante n'est affectée. RLS inchangée (service_role écrit, policy
-- whatsapp_messages_agency_select lit — 20260528150000).

BEGIN;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_agent_error boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_messages.is_agent_error IS
  'true = réponse agent en échec/dégradée, exclue de la mémoire conversationnelle C1';

COMMIT;
```

- [ ] **Step 2 : Vérifier la syntaxe SQL localement (si stack Supabase dispo)**

Run: `supabase db reset` n'est pas nécessaire ; valider le fichier en l'appliquant à une base locale si présente, sinon relire. La colonne est additive et idempotente (`IF NOT EXISTS`).
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260603100000_whatsapp_messages_is_agent_error.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): colonne is_agent_error sur whatsapp_messages (anti-écho mémoire)"
```

---

## Task 2 : `whatsapp-agent` — flag `isError` sur les échecs + filtre C1

L'agent renvoie aujourd'hui `{ reply }`. On ajoute `isError: true` UNIQUEMENT sur les branches d'échec/dégradées (jamais sur une vraie réponse ni un prompt de confirmation). Et on filtre la mémoire C1 pour ne jamais relire un échec.

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Filtrer C1 sur `is_agent_error=false`**

Trouver la requête d'historique C1 (≈ lignes 86-94) :
```ts
  const { data: histRows } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, transcript')
    .or(`wa_from.eq.${waNumber},wa_to.eq.${waNumber}`)
    .neq('provider_message_id', currentMessageId ?? '')
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(12)
```
Ajouter `.eq('is_agent_error', false)` après le `.or(...)` :
```ts
  const { data: histRows } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, transcript')
    .or(`wa_from.eq.${waNumber},wa_to.eq.${waNumber}`)
    .eq('is_agent_error', false) // anti-écho : ne jamais relire une réponse d'échec (leçon 5)
    .neq('provider_message_id', currentMessageId ?? '')
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(12)
```

- [ ] **Step 2 : Poser `isError: true` sur les branches d'échec**

Le helper `json(obj, code)` (≈ ligne 167) sérialise `obj` tel quel. Sur CHAQUE retour d'échec/dégradé, ajouter `isError: true`. Les retours concernés (et EUX SEULS) :

```ts
  // (≈ l.66) IA indispo :
  if (!apiKey) return json({ reply: t(lang, 'iaDown'), isError: true }, 200)
  ...
  // (≈ l.110) DeepSeek n'a rien renvoyé :
  if (!resp) return json({ reply: t(lang, 'cantProcess'), isError: true }, 200)
  ...
  // (≈ l.128) budget d'outils dépassé :
  return json({ reply: t(lang, 'tooLarge'), isError: true }, 200)
  ...
  // (≈ l.140) une action est déjà en attente :
  if (stash.status === 'busy') return json({ reply: t(lang, 'busy'), isError: true }, 200)
  ...
  // (≈ l.143) préparation d'action échouée :
  if (stash.status === 'error') return json({ reply: stash.error ?? t(lang, 'prepFail'), isError: true }, 200)
  ...
  // (≈ l.164) boucle épuisée sans réponse :
  return json({ reply: t(lang, 'reformulate'), isError: true }, 200)
```

**NE PAS** toucher : la vraie réponse `json({ reply: (msg?.content as string) || 'OK.' }, 200)` (≈ l.115), le prompt de confirmation `json({ reply: stash.prompt ?? t(lang, 'fallbackConfirm') }, 200)` (≈ l.145 — c'est une demande légitime, pas un échec), et la passe forcée réussie `if (forcedContent) return json({ reply: forcedContent }, 200)` (≈ l.163). Ces réponses restent en mémoire (contexte utile).

- [ ] **Step 3 : Vérifier le type Deno**

Run: `deno check supabase/functions/whatsapp-agent/index.ts`
Expected: 0 erreur (le helper `json(obj: unknown, code)` accepte la clé supplémentaire).

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): flag isError sur les réponses d'échec + filtre C1 (anti-écho)"
```

---

## Task 3 : `whatsapp-webhook` — propager `isError` → écrire `is_agent_error`

Le webhook appelle `callAgentBrain` (qui renvoie un string aujourd'hui) puis écrit l'outbound avec `status:'received'`. On fait remonter `isError` et on l'écrit.

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : `callAgentBrain` renvoie `{ reply, isError }`**

Remplacer la signature + le corps (≈ lignes 379-410) :
```ts
async function callAgentBrain(
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
  messageText: string,
  lang: WaLang,
): Promise<{ reply: string; isError: boolean }> {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        profileId: agentLink.profile_id,
        waNumber: msg.fromPhone,
        message: messageText,
        currentMessageId: msg.providerMessageId,
        inboundMedia:
          msg.mediaId && (msg.mediaType === 'image' || msg.mediaType === 'document')
            ? { mediaId: msg.mediaId, messageId: msg.providerMessageId }
            : null,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const data = await r.json().catch(() => ({}))
    const reply = (data?.reply as string) || t(lang, 'cantProcess')
    return { reply, isError: !!data?.isError || !data?.reply }
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return { reply: t(lang, 'cantProcessNow'), isError: true }
  }
}
```

- [ ] **Step 2 : Tracer `isError` jusqu'à l'écriture outbound**

Là où `reply` est calculé (≈ lignes 331-333), introduire un booléen. Le `else` qui appelle `callAgentBrain` :
```ts
  } else {
    reply = await callAgentBrain(agentLink, msg, userText, detectLang(userText))
  }
```
devient :
```ts
  let replyIsError = false
  if (/* branche verbatim existante */) {
    // ... reply = ... (confirmations/contrôle : ce ne sont PAS des erreurs → replyIsError reste false)
  } else {
    const brain = await callAgentBrain(agentLink, msg, userText, detectLang(userText))
    reply = brain.reply
    replyIsError = brain.isError
  }
```
> Adapter à la structure réelle du `if/else` autour de la ligne 331 (déclarer `let replyIsError = false` AVANT le bloc, le passer à `true` seulement dans la branche `callAgentBrain`).

Puis l'écriture outbound (≈ lignes 352-361) ajoute `is_agent_error` :
```ts
  await admin.from('whatsapp_messages').upsert({
    provider: provider.name,
    provider_message_id: outId ?? `local-agent-${msg.providerMessageId}`,
    direction: 'outbound',
    wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
    wa_to: msg.fromPhone,
    agency_id: agentLink.agency_id,
    body: outText,
    status: 'received',
    is_agent_error: replyIsError,
  }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
```

- [ ] **Step 3 : Vérifier le type Deno**

Run: `deno check supabase/functions/whatsapp-webhook/index.ts`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): webhook écrit is_agent_error sur l'outbound (anti-écho)"
```

---

## Task 4 : Verrou anti-double-screening + message timeout déterministe (§2.2 + §2.4)

`execRunKycScreening` n'a aucun verrou applicatif : sur timeout (50s) + relance, un 2e screening Dilisense part (double crédit). On pose un verrou via `kyc_cases.screening_status`.

**Files:**
- Create: `supabase/migrations/20260603100100_kyc_screening_status_check.sql`
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`

- [ ] **Step 1 : Migration — CHECK sur `screening_status`**

`kyc_cases.screening_status` existe (`TEXT`, ajouté par `20260526120000`) mais SANS contrainte. Figer le vocabulaire :
```sql
-- Vocabulaire du verrou de screening (anti double-crédit Dilisense). Colonne déjà
-- présente (20260526120000_restore_missing_columns) en TEXT libre. On la borne.
-- Additif/idempotent.

BEGIN;

ALTER TABLE public.kyc_cases DROP CONSTRAINT IF EXISTS kyc_cases_screening_status_check;
ALTER TABLE public.kyc_cases ADD CONSTRAINT kyc_cases_screening_status_check
  CHECK (screening_status IS NULL OR screening_status IN ('running','done','failed'));

COMMIT;
```

- [ ] **Step 2 : Poser le verrou dans `execRunKycScreening`**

Dans `supabase/functions/_shared/whatsapp-actions.ts`, dans `execRunKycScreening` (≈ lignes 582-627), APRÈS avoir trouvé le dossier (`const kc = await findOpenKycCase(...)`) et AVANT le `fetch` de l'edge `kyc-screening`, ajouter le verrou atomique :

```ts
  // Verrou anti-double-screening : claim atomique. 0 ligne = déjà en cours < 2 min.
  const { data: lock } = await ctx.supabase
    .from('kyc_cases')
    .update({ screening_status: 'running', last_screening_at: new Date().toISOString() })
    .eq('id', kc.id)
    .or('screening_status.is.null,screening_status.eq.failed,last_screening_at.lt.' +
        new Date(Date.now() - 120_000).toISOString())
    .select('id')
    .maybeSingle()
  if (!lock) {
    return `Le screening de ${name} tourne déjà, je te donne le résultat dès qu'il est prêt.`
  }
```

Puis, en cas d'échec réseau du fetch (le `catch` existant), libérer le verrou (`screening_status: 'failed'`) avant de retourner le message d'erreur ; en cas de succès (après la réponse OK de l'edge), poser `screening_status: 'done'`. Exemple, à intégrer dans les branches existantes :
```ts
  } catch (e) {
    await ctx.supabase.from('kyc_cases').update({ screening_status: 'failed' }).eq('id', kc.id)
    const n = (e as Error)?.name
    if (n === 'TimeoutError' || n === 'AbortError') {
      // §2.4 : message DÉTERMINISTE (ne plus dire "il a peut-être abouti" → évite la relance)
      return 'Le screening tourne, je te donne le résultat dès qu\'il est prêt.'
    }
    return 'Le screening a échoué (réseau). Réessaie dans un instant.'
  }
  // ... après res.ok et le parsing du résultat :
  await ctx.supabase.from('kyc_cases').update({ screening_status: 'done' }).eq('id', kc.id)
```

> Note : l'edge `kyc-screening` a déjà sa propre idempotence 60s (`last_screening_at`), mais elle est INTERNE à l'edge. Ce verrou applicatif (côté exécuteur) empêche le 2e APPEL de partir, et le message §2.4 supprime l'incitation à relancer.

- [ ] **Step 3 : Vérifier**

Run: `deno check supabase/functions/_shared/whatsapp-actions.ts`
Expected: 0 erreur (l'erreur pré-existante `magic-link-token.ts:92` n'est pas dans ce fichier ; il ne l'importe pas).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260603100100_kyc_screening_status_check.sql supabase/functions/_shared/whatsapp-actions.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(kyc): verrou screening_status anti-double-screening + message timeout déterministe"
```

---

## Task 5 : Garde `waNumber` vide — amnésie silencieuse (§4.2)

Si `waNumber` est vide, le filtre C1 `.or('wa_from.eq.,wa_to.eq.')` ne matche rien → historique vide → l'agent « oublie tout » SANS trace.

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Court-circuiter C1 si `waNumber` vide**

`waNumber` est destructuré ≈ ligne 61 (`waNumber = ''`). Juste AVANT la requête C1 (≈ ligne 85), entourer la requête d'une garde :
```ts
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (!waNumber) {
    console.warn('C1 skipped: no waNumber for profile', profileId) // PII-safe : profile id seul
  } else {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: histRows } = await supabase
      .from('whatsapp_messages')
      .select('direction, body, transcript')
      .or(`wa_from.eq.${waNumber},wa_to.eq.${waNumber}`)
      .eq('is_agent_error', false)
      .neq('provider_message_id', currentMessageId ?? '')
      .gt('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(12)
    history = buildHistoryMessages((histRows ?? []) as WaHistoryRow[])
  }
```
> Ajuster aux noms réels (`history`, `buildHistoryMessages`, `WaHistoryRow` sont déjà importés). Cette tâche fusionne avec le filtre `.eq('is_agent_error', false)` de la Task 2 — si la Task 2 est déjà faite, n'ajouter que la garde `if (!waNumber)`.

- [ ] **Step 2 : Vérifier**

Run: `deno check supabase/functions/whatsapp-agent/index.ts`
Expected: 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "fix(whatsapp): garde waNumber vide (amnésie silencieuse) + warn PII-safe"
```

---

## Task 6 : Fin de la course d'envoi du PDF (§2.5)

`kyc-report-pdf` : l'abort CF interne (55000 ms) PUIS upload Meta + envoi peut dépasser l'abort de l'appelant `execSendKycReport` (60000 ms) → l'appelant abandonne et annonce un échec ALORS QUE le PDF est déjà parti. Tant que l'envoi reste synchrone (avant l'async du Palier 2), réduire l'abort CF.

**Files:**
- Modify: `supabase/functions/kyc-report-pdf/index.ts`

- [ ] **Step 1 : Réduire l'abort CF de 55s à 45s**

Trouver le fetch Cloudflare (≈ ligne 79) :
```ts
        signal: AbortSignal.timeout(55000),
```
Remplacer par :
```ts
        signal: AbortSignal.timeout(45000), // < 60s de l'appelant execSendKycReport : garde une marge pour upload Meta + envoi, évite que l'appelant annonce un échec alors que le PDF est parti
```

- [ ] **Step 2 : Vérifier**

Run: `npm run build`
Expected: vert.

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/kyc-report-pdf/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "fix(kyc-report): abort CF 45s < appelant 60s (fin de la course d'envoi PDF)"
```

---

## Task 7 : Specs backend live + finalisation + cerveau

**Files:**
- Create: `tests/backend/whatsapp-agent-error-memory.spec.ts`
- Create: `tests/backend/kyc-screening-lock.spec.ts`

- [ ] **Step 1 : Spec écho mémoire**

Lire d'abord une spec voisine (`tests/backend/whatsapp-messages-rls.spec.ts`) pour les helpers de seed. Puis écrire `whatsapp-agent-error-memory.spec.ts` qui, contre la stack locale (service-role) :
- insère 2 lignes `whatsapp_messages` outbound pour un `wa_to` donné : une `is_agent_error=true`, une `is_agent_error=false` ;
- exécute la MÊME requête que C1 (`.eq('is_agent_error', false)` + filtres) ;
- assert que seule la ligne `false` revient (l'erreur est exclue).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL
const KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const run = !!(URL && KEY)

describe.skipIf(!run)('C1 exclut les réponses d\'erreur de la mémoire', () => {
  const supabase = createClient(URL!, KEY!)
  const waTo = '41790000000' + Math.floor(1) // utiliser un numéro de test isolé ; voir helpers
  // ... seed agency + 2 messages (1 is_agent_error=true, 1 false) en beforeAll ; cleanup en afterAll

  it('ne renvoie pas la ligne is_agent_error=true', async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('body, is_agent_error')
      .or(`wa_from.eq.${waTo},wa_to.eq.${waTo}`)
      .eq('is_agent_error', false)
      .gt('created_at', since)
    expect(data?.every((r) => r.is_agent_error === false)).toBe(true)
    expect(data?.length).toBe(1)
  })
})
```
> Adapter le seed/cleanup au pattern réel de `tests/backend/` (colonnes obligatoires de `whatsapp_messages` : provider, provider_message_id, direction, wa_from, agency_id). `SUPABASE_TEST_*` sont fournis en CI.

- [ ] **Step 2 : Spec verrou screening**

`kyc-screening-lock.spec.ts` : seed un `kyc_cases`, applique le claim atomique de la Task 4 DEUX fois de suite, assert que le 2e renvoie 0 ligne (verrou tenu).

```ts
// 1er claim : doit renvoyer la ligne (screening_status passé à 'running')
// 2e claim immédiat (mêmes conditions) : doit renvoyer 0 ligne → "déjà en cours"
// (réutiliser la requête .update().or(...).select('id').maybeSingle() de la Task 4)
```

- [ ] **Step 3 : Lancer le tout**

Run: `npm run build && npx vitest run`
Expected: build vert, unit verts. (Les backend specs tournent en CI contre la stack locale ; en local sans Docker elles skip proprement — mais elles DOIVENT passer en CI.)

- [ ] **Step 4 : Mettre à jour le cerveau** (exigé)

Éditer `.claude-flow/knowledge/megga-memory.seed.json` :
- Nœud `megga/whatsapp-copilot-lessons` : ajouter une leçon « (6) écho mémoire RÉSOLU par colonne is_agent_error (flaggée par whatsapp-agent sur ses branches d'échec, filtrée dans C1) ; garde waNumber vide ; verrou kyc_cases.screening_status anti-double-screening (CHECK running/done/failed). Palier 1 stabilisation livré ».
- Nœud `megga/whatsapp-agent-stability-autonomy-strategy` : passer « P1 » de planifié à LIVRÉ.
- `megga/whatsapp-data-model` : ajouter la colonne `is_agent_error` à la description de `whatsapp_messages`.

Puis `npm run ruflo:seed` et vérifier : `npx ruflo memory search -q "is_agent_error écho mémoire" -n megga`.

- [ ] **Step 5 : Commit + PR**

```bash
git add tests/backend/whatsapp-agent-error-memory.spec.ts tests/backend/kyc-screening-lock.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(whatsapp): specs écho mémoire + verrou screening ; cerveau P1 livré"
```
Ouvrir la PR vers `main` ; au merge, migrations + edges déployées par la CI.

---

## Self-Review (vérifié contre la stratégie §2 + §4.2)

- ✅ §2.1 écho mémoire → Tasks 1-3 (colonne + flag agent + filtre C1 + écriture webhook).
- ✅ §2.2 verrou screening → Task 4 (CHECK + claim atomique).
- ✅ §2.4 message timeout déterministe → Task 4 (message « je te donne le résultat dès qu'il est prêt »).
- ✅ §2.5 course PDF → Task 6 (abort 45s < 60s appelant).
- ✅ §4.2 garde waNumber → Task 5.
- ✅ §2.3 logs kyc-report-pdf → **déjà livré PR #548** (noté, non refait).
- Tests : 2 backend specs live (écho, verrou). Le reste est edge I/O — vérifié par `deno check` + le comportement DB testé en live.
- **Aucun tier `confirm` touché** → human-in-the-loop légal intact. DeepSeek-only intact.

**Cohérence des noms :** `is_agent_error` (colonne) ↔ `isError` (champ JSON agent) ↔ `replyIsError` (webhook) — bien distincts et reliés. `screening_status` ∈ {running,done,failed} cohérent entre la migration (CHECK) et l'exécuteur.

**Hors périmètre (Palier 2/3, NE PAS faire ici) :** l'async des outils lents (file job+cron), l'échelle d'autonomie, la migration `compute_agent_preferences`. Ce palier ne fait QUE stabiliser.

---

## Exécution

Ce plan est conçu pour une **session fraîche** en **subagent-driven** (un sous-agent par tâche + revue conformité-puis-qualité, comme le rapport KYC PDF). Démarrer la session sur ce fichier et invoquer `superpowers:subagent-driven-development`. Consulter le cerveau au début de chaque tâche (`npx ruflo memory search`). Mettre le cerveau à jour à la Task 7 (dernière), comme prévu.
