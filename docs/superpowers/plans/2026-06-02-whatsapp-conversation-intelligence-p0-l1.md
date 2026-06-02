# WhatsApp Conversation Intelligence — Plan #1 (P0 sécurité + L1 capture/transcription)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'exposition `whatsapp-agent` (P0), puis faire entrer les notes vocales et médias clients dans le CRM — récupérés, stockés (R2), et transcrits (Deepgram) — de façon durable (aucun message perdu).

**Architecture :** Le webhook marque les entrants média/voix `processing_status='pending'` et ACK tout de suite. Un `pg_cron` (chaque minute) appelle l'edge function `whatsapp-process`, qui **réclame** un lot de messages (`FOR UPDATE SKIP LOCKED`), télécharge le média Meta → R2, transcrit l'audio (Deepgram Nova-2), et marque `done`/`failed` avec reprise. Tout I/O réseau utilise `fetch` global (testable Node) ; seul le PUT R2 (aws4fetch) vit dans l'edge function (validé en staging).

**Tech Stack :** Supabase Edge (Deno), PostgreSQL + `pg_cron` + `pg_net`, Cloudflare R2 (`aws4fetch` SigV4), Deepgram Nova-2, Meta Cloud API (Graph v22.0). Tests : vitest (unitaires purs) + RLS backend.

**Spec :** `docs/superpowers/specs/2026-06-02-whatsapp-conversation-intelligence-design.md` (lots P0 + L1).

**IA :** DeepSeek uniquement (pas de Claude) — pertinent en L2 ; aucun appel LLM dans ce plan.

**Convention commits :** un commit **par lot** (P0, puis L1), pas par micro-étape — l'utilisateur groupe les commits et signale la fin de lot. Pas de `git push` sans accord.

---

## Carte des fichiers

**P0 — Sécurité**
- Modifier : `.github/workflows/deploy.yml` (boucle de déploiement → allowlist `verify_jwt`)
- Modifier : `supabase/config.toml` (ajout `[functions.whatsapp-agent]` + `[functions.whatsapp-process]` `verify_jwt = true`)

**L1 — Capture média + transcription**
- Créer : `supabase/migrations/20260602090000_whatsapp_capture_columns.sql` (colonnes + index + `claim_whatsapp_jobs`)
- Modifier : `supabase/functions/_shared/whatsapp-gateway.ts` (`mediaId`/`mediaMime` + extraction Meta) — logique pure
- Test : `supabase/functions/_shared/whatsapp-gateway.test.ts` (extraction media_id)
- Créer : `supabase/functions/_shared/whatsapp-media.ts` (purs : `extFromMime`, `buildMediaKey`, `parseMetaMediaMeta`, `fetchMetaMedia`)
- Test : `supabase/functions/_shared/whatsapp-media.test.ts`
- Créer : `supabase/functions/_shared/whatsapp-transcribe.ts` (`parseDeepgram` pur + `transcribe`)
- Test : `supabase/functions/_shared/whatsapp-transcribe.test.ts`
- Créer : `supabase/functions/whatsapp-process/index.ts` (orchestrateur cron : claim → média→R2 → transcription → statut)
- Modifier : `supabase/functions/whatsapp-webhook/index.ts` (extraire media_id/mime ; `pending` si média/voix)
- Créer : `supabase/migrations/20260602093000_whatsapp_process_cron.sql` (`cron.schedule` → `whatsapp-process`)
- Modifier : `vitest.config.ts` (glob des tests `_shared`)
- Modifier : `src/hooks/useWhatsAppMessages.ts` (exposer `transcript`, `media_url`, `processing_status`) — contrat de données pour Julien

---

## Lot P0 — Sécurité (déployer `whatsapp-agent` en JWT vérifié)

Contexte : `deploy.yml` déploie **toutes** les fonctions avec `--no-verify-jwt`. Or `whatsapp-agent.isServiceRole()` ne fait que **décoder** le JWT (sans vérifier la signature), car il suppose que la plateforme la valide (`verify_jwt=true`). Résultat : garde « service-role only » contournable. On passe à une **allowlist** : les fonctions internes sont déployées sans le flag (donc `verify_jwt=true`), les autres restent publiques comme aujourd'hui.

### Task 1 : Allowlist `verify_jwt` dans le déploiement

**Files:**
- Modify: `.github/workflows/deploy.yml` (boucle, ~lignes 186-201)

- [ ] **Step 1 : Remplacer la boucle de déploiement**

Remplacer le `for fn_dir in supabase/functions/*/; do … done` existant par cette version (ajoute une allowlist `JWT_PROTECTED`) :

```bash
          SUCCESS=0
          FAILED=0
          FAILED_FNS=""

          # Fonctions internes (appelées en service-role) : JWT vérifié par la
          # plateforme. NE PAS déployer en --no-verify-jwt (sinon leur garde de
          # rôle, qui ne fait que décoder le JWT, devient contournable).
          JWT_PROTECTED="whatsapp-agent whatsapp-process"

          for fn_dir in supabase/functions/*/; do
            fn_name=$(basename "$fn_dir")
            if [ -f "$fn_dir/index.ts" ]; then
              echo "::group::Deploying $fn_name"
              if echo " $JWT_PROTECTED " | grep -q " $fn_name "; then
                supabase functions deploy "$fn_name"
              else
                supabase functions deploy "$fn_name" --no-verify-jwt
              fi
              RC=$?
              echo "::endgroup::"
              if [ $RC -eq 0 ]; then
                SUCCESS=$((SUCCESS + 1))
              else
                FAILED=$((FAILED + 1))
                FAILED_FNS="$FAILED_FNS $fn_name"
                echo "::warning::Deployment of $fn_name failed (rc=$RC) — continuing"
              fi
            fi
          done
```

- [ ] **Step 2 : Vérifier la logique d'allowlist à blanc**

Run :
```bash
JWT_PROTECTED="whatsapp-agent whatsapp-process"
for fn in whatsapp-agent whatsapp-process whatsapp-webhook whatsapp-send seller-portal-action; do
  if echo " $JWT_PROTECTED " | grep -q " $fn "; then echo "$fn => verify_jwt (pas de flag)"; else echo "$fn => --no-verify-jwt (public)"; fi
done
```
Expected :
```
whatsapp-agent => verify_jwt (pas de flag)
whatsapp-process => verify_jwt (pas de flag)
whatsapp-webhook => --no-verify-jwt (public)
whatsapp-send => --no-verify-jwt (public)
seller-portal-action => --no-verify-jwt (public)
```
(`whatsapp-webhook` doit rester public : HMAC, pas de JWT Meta. `whatsapp-send` reste public : il vérifie l'agent via `requireAgentAuth` côté code.)

### Task 2 : Déclarer `verify_jwt` dans `config.toml`

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Ajouter les entrées (intention déclarative)**

Ajouter à la fin de `supabase/config.toml` :

```toml
# Fonctions internes appelées en service-role (webhook→agent, cron→process).
# JWT vérifié par la plateforme — ne JAMAIS déployer en --no-verify-jwt.
[functions.whatsapp-agent]
verify_jwt = true

[functions.whatsapp-process]
verify_jwt = true
```

- [ ] **Step 2 : Vérifier la syntaxe TOML**

Run : `grep -A1 "functions.whatsapp-agent\|functions.whatsapp-process" supabase/config.toml`
Expected : les deux blocs avec `verify_jwt = true`.

### Task 3 : Commit P0

- [ ] **Step 1 : Commit (fin de lot P0)**

```bash
git add .github/workflows/deploy.yml supabase/config.toml
git commit -m "fix(whatsapp): déployer whatsapp-agent en JWT vérifié (allowlist verify_jwt)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Note exécution : la correction n'est effective qu'au prochain déploiement sur `main`. Re-déployer `whatsapp-agent` après merge.

---

## Lot L1 — Capture média + transcription

### Task 4 : Migration — colonnes de traitement + fonction de claim

**Files:**
- Create: `supabase/migrations/20260602090000_whatsapp_capture_columns.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- L1 : capture média + transcription. Le message porte son propre état de
-- traitement ("le message est le job"). claim_whatsapp_jobs() réclame un lot de
-- façon atomique (FOR UPDATE SKIP LOCKED) pour le cron whatsapp-process.

BEGIN;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS processing_status     text NOT NULL DEFAULT 'done'
    CHECK (processing_status IN ('pending','processing','done','failed','skipped')),
  ADD COLUMN IF NOT EXISTS claimed_at            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retry_count           smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error            text NULL,
  ADD COLUMN IF NOT EXISTS media_r2_key          text NULL,
  ADD COLUMN IF NOT EXISTS media_id              text NULL,  -- jeton Meta (~30 j) relu par le cron
  ADD COLUMN IF NOT EXISTS media_mime            text NULL,
  ADD COLUMN IF NOT EXISTS transcript            text NULL,
  ADD COLUMN IF NOT EXISTS transcript_lang       text NULL,
  ADD COLUMN IF NOT EXISTS transcript_confidence real NULL;

-- File de travail : index partiel sur ce que le cron réclame.
CREATE INDEX IF NOT EXISTS idx_wa_messages_pending
  ON public.whatsapp_messages (created_at)
  WHERE processing_status IN ('pending','processing','failed');

-- Réclamation atomique d'un lot. SECURITY DEFINER : seul le service_role
-- l'appelle (aucun GRANT client). SKIP LOCKED => pas de double-traitement.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_jobs(p_batch int DEFAULT 25)
RETURNS SETOF public.whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_messages m
  SET processing_status = 'processing', claimed_at = now()
  WHERE m.id IN (
    SELECT id FROM public.whatsapp_messages
    WHERE processing_status = 'pending'
       OR (processing_status = 'processing' AND claimed_at < now() - interval '5 minutes')
       OR (processing_status = 'failed' AND retry_count < 3)
    ORDER BY created_at
    LIMIT GREATEST(p_batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING m.*;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_jobs(int) FROM public, anon, authenticated;

COMMIT;
```

- [ ] **Step 2 : Appliquer en local/staging et vérifier**

Run : `supabase db push` (ou via MCP `apply_migration`).
Expected : migration appliquée sans erreur ; `\d whatsapp_messages` montre les nouvelles colonnes.

### Task 5 : Gateway — extraire le `media_id` Meta

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-gateway.ts`
- Test: `supabase/functions/_shared/whatsapp-gateway.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

Ajouter dans `whatsapp-gateway.test.ts` :

```ts
import { getProvider } from './whatsapp-gateway'

describe('MetaProvider — média entrant', () => {
  const meta = getProvider('meta')
  const audioPayload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { display_phone_number: '41791112233', phone_number_id: '123' },
      messages: [{
        from: '41780001122', id: 'wamid.AUDIO1', timestamp: '1717000000',
        type: 'audio', audio: { id: 'MEDIA_AUDIO_42', mime_type: 'audio/ogg; codecs=opus', voice: true },
      }],
    } }] }],
  }

  it('extrait mediaId + mediaMime pour un vocal', () => {
    const m = meta.parseInbound(audioPayload)!
    expect(m.mediaType).toBe('audio')
    expect(m.mediaId).toBe('MEDIA_AUDIO_42')
    expect(m.mediaMime).toBe('audio/ogg; codecs=opus')
  })

  it('mediaId = null pour un texte', () => {
    const textPayload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: '123' },
        messages: [{ from: '41780001122', id: 'wamid.TXT1', timestamp: '1717000000', type: 'text', text: { body: 'bonjour' } }],
      } }] }],
    }
    const m = meta.parseInbound(textPayload)!
    expect(m.mediaId).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test (échoue)**

Run : `npm run test:unit -- whatsapp-gateway`
Expected : FAIL (`mediaId` n'existe pas sur le type / undefined).

- [ ] **Step 3 : Ajouter les champs au type + l'extraction**

Dans `NormalizedInboundMessage` (après `mediaUrl`) :

```ts
  mediaUrl: string | null
  mediaId: string | null
  mediaMime: string | null
```

Dans `OpenWAProvider.parseInbound`, dans l'objet retourné, ajouter :

```ts
      mediaUrl: (data.mediaUrl as string) ?? null,
      mediaId: null,
      mediaMime: null,
```

Dans `MetaProvider.parseInbound`, remplacer :

```ts
    const mediaObj = message[type] as { caption?: string } | undefined
```
par :
```ts
    const mediaObj = message[type] as { id?: string; mime_type?: string; caption?: string } | undefined
```
et dans l'objet retourné, remplacer la ligne `mediaUrl: null,` par :
```ts
      mediaUrl: null, // bytes récupérés en différé via Graph API (whatsapp-media)
      mediaId: mediaObj?.id ?? null,
      mediaMime: mediaObj?.mime_type ?? null,
```

- [ ] **Step 4 : Lancer le test (passe)**

Run : `npm run test:unit -- whatsapp-gateway`
Expected : PASS (tous les tests gateway, anciens + nouveaux).

### Task 6 : `vitest.config.ts` — référencer les nouveaux tests `_shared`

**Files:**
- Modify: `vitest.config.ts`

`include` liste les tests `_shared` **un par un** (pas de glob : d'autres `_shared/*.test.ts`, ex. `pii-redaction.test.ts`, ne sont pas prévus pour tourner sous Node). On ajoute nos deux fichiers de la même façon.

- [ ] **Step 1 : Ajouter les deux entrées**

Juste après `'supabase/functions/_shared/whatsapp-agent-router.test.ts'`, insérer :
```ts
'supabase/functions/_shared/whatsapp-media.test.ts',
'supabase/functions/_shared/whatsapp-transcribe.test.ts',
```

- [ ] **Step 2 : Vérifier que les tests existants tournent encore**

Run : `npm run test:unit -- _shared`
Expected : PASS (gateway + agent-router ; les 2 nouveaux fichiers seront créés aux Tasks 7-8 et tournés là).

### Task 7 : `whatsapp-media.ts` — helpers purs + fetch Meta

**Files:**
- Create: `supabase/functions/_shared/whatsapp-media.ts`
- Test: `supabase/functions/_shared/whatsapp-media.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent)**

`whatsapp-media.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { extFromMime, buildMediaKey, parseMetaMediaMeta } from './whatsapp-media'

describe('extFromMime', () => {
  it('mappe les mimes courants', () => {
    expect(extFromMime('audio/ogg; codecs=opus')).toBe('ogg')
    expect(extFromMime('image/jpeg')).toBe('jpg')
    expect(extFromMime('application/pdf')).toBe('pdf')
  })
  it('repli bin si inconnu', () => {
    expect(extFromMime('application/x-weird')).toBe('bin')
    expect(extFromMime(null)).toBe('bin')
  })
})

describe('buildMediaKey', () => {
  it('clé déterministe scoper agence/message', () => {
    expect(buildMediaKey('ag1', 'msg9', 'audio/ogg')).toBe('wa/ag1/msg9.ogg')
  })
})

describe('parseMetaMediaMeta', () => {
  it('lit url + mime de la réponse Graph étape 1', () => {
    expect(parseMetaMediaMeta({ url: 'https://x/y', mime_type: 'audio/ogg' }))
      .toEqual({ url: 'https://x/y', mime: 'audio/ogg' })
  })
  it('null si pas d’url', () => {
    expect(parseMetaMediaMeta({})).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run : `npm run test:unit -- whatsapp-media`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `whatsapp-media.ts`**

```ts
// Récupération des médias WhatsApp entrants (Meta Cloud API).
// Helpers PURS (testables Node) + fetchMetaMedia (fetch global, sans Deno).
// Le PUT R2 (aws4fetch) vit dans whatsapp-process (Deno) — validé en staging.

const MIME_EXT: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'application/pdf': 'pdf',
}

/** Extension de fichier depuis un mime (paramètres ignorés). 'bin' si inconnu. */
export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return 'bin'
  const base = mime.split(';')[0].trim().toLowerCase()
  return MIME_EXT[base] ?? 'bin'
}

/** Clé R2 déterministe : rejouable sans doublon. */
export function buildMediaKey(agencyId: string, messageId: string, mime: string | null): string {
  return `wa/${agencyId}/${messageId}.${extFromMime(mime)}`
}

/** Réponse Graph étape 1 ({ url, mime_type }) → { url, mime } ou null. */
export function parseMetaMediaMeta(json: unknown): { url: string; mime: string | null } | null {
  const j = json as { url?: string; mime_type?: string }
  if (!j?.url) return null
  return { url: j.url, mime: j.mime_type ?? null }
}

export interface MetaMediaConfig { metaToken: string; apiVersion?: string }

/** 2 étapes Graph : media_id → URL signée (≈5 min) → bytes. fetch global (Node OK). */
export async function fetchMetaMedia(
  mediaId: string, cfg: MetaMediaConfig,
): Promise<{ bytes: Uint8Array; mime: string | null }> {
  const v = cfg.apiVersion ?? 'v22.0'
  const metaRes = await fetch(`https://graph.facebook.com/${v}/${mediaId}`, {
    headers: { Authorization: `Bearer ${cfg.metaToken}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!metaRes.ok) throw new Error(`meta media meta HTTP ${metaRes.status}`)
  const meta = parseMetaMediaMeta(await metaRes.json())
  if (!meta) throw new Error('meta media: pas d’URL (média expiré ?)')

  const binRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${cfg.metaToken}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!binRes.ok) throw new Error(`meta media bytes HTTP ${binRes.status}`)
  return { bytes: new Uint8Array(await binRes.arrayBuffer()), mime: meta.mime }
}
```

- [ ] **Step 4 : Lancer (passe)**

Run : `npm run test:unit -- whatsapp-media`
Expected : PASS (8 assertions).

### Task 8 : `whatsapp-transcribe.ts` — parse Deepgram (pur) + appel

**Files:**
- Create: `supabase/functions/_shared/whatsapp-transcribe.ts`
- Test: `supabase/functions/_shared/whatsapp-transcribe.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

```ts
import { describe, it, expect } from 'vitest'
import { parseDeepgram } from './whatsapp-transcribe'

describe('parseDeepgram', () => {
  it('extrait transcript + confidence + langue', () => {
    const r = parseDeepgram({ results: { channels: [{
      detected_language: 'fr',
      alternatives: [{ transcript: 'bonjour je cherche un 3 pièces', confidence: 0.97 }],
    }] } })
    expect(r).toEqual({ transcript: 'bonjour je cherche un 3 pièces', confidence: 0.97, lang: 'fr' })
  })
  it('repli propre si réponse vide', () => {
    expect(parseDeepgram({})).toEqual({ transcript: '', confidence: 0, lang: null })
  })
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run : `npm run test:unit -- whatsapp-transcribe`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `whatsapp-transcribe.ts`**

```ts
// Transcription d'un audio WhatsApp via Deepgram Nova-2.
// parseDeepgram = pur (testé). transcribe() = fetch global (clé en paramètre,
// pas de Deno.env) → importable et mockable sous Node.

export interface Transcript { transcript: string; confidence: number; lang: string | null }

/** Lit la forme de réponse Deepgram. Repli neutre si vide. */
export function parseDeepgram(json: unknown): Transcript {
  const ch = (json as { results?: { channels?: Array<Record<string, unknown>> } })
    ?.results?.channels?.[0]
  const alt = (ch?.alternatives as Array<{ transcript?: string; confidence?: number }> | undefined)?.[0]
  return {
    transcript: alt?.transcript ?? '',
    confidence: alt?.confidence ?? 0,
    lang: (ch?.detected_language as string) ?? null,
  }
}

/** Appel Deepgram (octets bruts). Lève si HTTP non-2xx. */
export async function transcribe(bytes: Uint8Array, mime: string | null, apiKey: string): Promise<Transcript> {
  const qs = new URLSearchParams({ model: 'nova-2', detect_language: 'true', smart_format: 'true', punctuate: 'true' })
  const res = await fetch(`https://api.deepgram.com/v1/listen?${qs}`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': mime || 'audio/ogg' },
    body: bytes,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`deepgram HTTP ${res.status}`)
  return parseDeepgram(await res.json())
}
```

- [ ] **Step 4 : Lancer (passe)**

Run : `npm run test:unit -- whatsapp-transcribe`
Expected : PASS.

### Task 9 : `whatsapp-process` — orchestrateur cron

**Files:**
- Create: `supabase/functions/whatsapp-process/index.ts`

- [ ] **Step 1 : Implémenter l'orchestrateur**

```ts
// supabase/functions/whatsapp-process/index.ts
// Orchestrateur cron (L1) : réclame les messages 'pending', récupère le média
// Meta → R2, transcrit l'audio (Deepgram), marque done/failed avec reprise.
// Appelé UNIQUEMENT par pg_cron en service-role. DÉPLOYER verify_jwt=true
// (cf. config.toml + allowlist deploy.yml) — NE JAMAIS --no-verify-jwt.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'
import { fetchMetaMedia, buildMediaKey } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'

const BATCH = 25
const MAX_RETRIES = 3
const AUDIO_MIMES = ['audio/']

function json(o: unknown, c: number) {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}

function isServiceRole(auth: string | null): boolean {
  if (!auth?.startsWith('Bearer ')) return false
  const parts = auth.slice(7).trim().split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    return (JSON.parse(atob(b64 + pad)) as { role?: string }).role === 'service_role'
  } catch { return false }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!isServiceRole(req.headers.get('Authorization'))) return json({ error: 'Forbidden' }, 403)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''

  const r2 = new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    region: 'auto', service: 's3',
  })
  const r2Account = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
  const r2Bucket = Deno.env.get('R2_BUCKET') ?? 'megga-market'

  const { data: jobs, error } = await admin.rpc('claim_whatsapp_jobs', { p_batch: BATCH })
  if (error) return json({ error: error.message }, 500)
  if (!jobs?.length) return json({ ok: true, claimed: 0 }, 200)

  let done = 0, failed = 0
  for (const m of jobs as Array<Record<string, unknown>>) {
    const id = m.id as string
    try {
      const patch: Record<string, unknown> = { processing_status: 'done', last_error: null }

      if (m.media_id && metaToken) {
        const { bytes, mime } = await fetchMetaMedia(m.media_id as string, { metaToken, apiVersion })
        const key = buildMediaKey((m.agency_id as string) ?? 'unknown', id, (m.media_mime as string) ?? mime)
        await r2.fetch(`https://${r2Account}.r2.cloudflarestorage.com/${r2Bucket}/${key}`, {
          method: 'PUT', body: bytes, headers: { 'Content-Type': mime || 'application/octet-stream' },
        })
        patch.media_r2_key = key
        if (mime && !m.media_mime) patch.media_mime = mime

        const isAudio = AUDIO_MIMES.some((p) => (mime ?? '').startsWith(p))
        if (isAudio && deepgramKey) {
          const t = await transcribe(bytes, mime, deepgramKey)
          patch.transcript = t.transcript
          patch.transcript_lang = t.lang
          patch.transcript_confidence = t.confidence
        }
      }

      await admin.from('whatsapp_messages').update(patch).eq('id', id)
      done++
    } catch (e) {
      const rc = ((m.retry_count as number) ?? 0) + 1
      await admin.from('whatsapp_messages').update({
        processing_status: rc >= MAX_RETRIES ? 'failed' : 'pending',
        retry_count: rc,
        last_error: String((e as Error)?.message ?? 'error').slice(0, 300),
      }).eq('id', id)
      failed++
    }
  }
  return json({ ok: true, claimed: jobs.length, done, failed }, 200)
})
```

- [ ] **Step 2 : Vérifier le typecheck Deno (si CLI dispo) sinon le build front**

Run : `npm run build`
Expected : build vert (le front ne casse pas ; les edge functions sont hors `tsc -b` mais on confirme l'absence de régression globale).

### Task 10 : Webhook — persister média/mime + marquer `pending`

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

`media_id` (jeton Meta, ~30 j — colonne créée en Task 4) est persisté pour que le cron récupère les octets ; `media_mime` aide stockage/transcription ; `processing_status='pending'` met l'entrant média en file (sinon `'done'`, rien à traiter).

- [ ] **Step 1 : Mettre à jour l'`upsert` de la branche client**

Dans la branche client (l'`upsert` `whatsapp_messages`, ~lignes 188-206), remplacer l'objet par :

```ts
    .upsert({
      provider: provider.name,
      provider_message_id: msg.providerMessageId,
      session_id: msg.sessionId,
      direction: 'inbound',
      wa_from: msg.fromPhone,
      wa_to: msg.toPhone,
      contact_id: contactId,
      agency_id: agencyId,
      body: msg.body,
      media_type: msg.mediaType,
      media_url: msg.mediaUrl,
      media_id: msg.mediaId,
      media_mime: msg.mediaMime,
      // L1 : un entrant avec média à récupérer passe en file de traitement.
      processing_status: msg.mediaId ? 'pending' : 'done',
      status: 'received',
      wa_timestamp: msg.timestamp,
      raw: msg.raw,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
```

- [ ] **Step 2 : Vérifier l'absence de régression sur le parsing**

Run : `npm run test:unit -- whatsapp`
Expected : PASS (gateway + agent-router ; rien de cassé).

### Task 11 : Migration cron — planifier `whatsapp-process`

**Files:**
- Create: `supabase/migrations/20260602093000_whatsapp_process_cron.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Planifie whatsapp-process chaque minute. Mirroir du pattern existant
-- (get_app_config + net.http_post + Bearer service_role), cf. matching/search-alert.

BEGIN;

SELECT cron.schedule(
  'whatsapp-process-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMIT;
```

- [ ] **Step 2 : Vérifier l'enregistrement du job**

Run (SQL) : `SELECT jobname, schedule FROM cron.job WHERE jobname = 'whatsapp-process-minute';`
Expected : une ligne, schedule `* * * * *`.

### Task 12 : Hook front (contrat de données pour Julien)

**Files:**
- Modify: `src/hooks/useWhatsAppMessages.ts`

- [ ] **Step 1 : Exposer les nouveaux champs**

Dans `WhatsAppMessageRow`, ajouter :
```ts
  transcript: string | null
  transcript_lang: string | null
  processing_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
```
Dans le `.select(...)` de `useWhatsAppMessages`, ajouter ces colonnes :
```ts
.select('id, created_at, direction, wa_from, wa_to, body, media_type, media_url, status, wa_timestamp, transcript, transcript_lang, processing_status')
```

- [ ] **Step 2 : Vérifier le typecheck**

Run : `npm run build`
Expected : build vert.

> Handoff Julien : la bulle vocale affiche `transcript` (🎤) ; `processing_status` ∈ {pending,processing} → « transcription en cours… » ; `failed` → « transcription indisponible ». Aucun composant à créer côté back.

### Task 13 : Vérification end-to-end (staging) + commit L1

- [ ] **Step 1 : Smoke test staging**

Déployer les fonctions sur staging, envoyer une vraie note vocale au numéro Business, attendre ≤ 2 min :
- `whatsapp_messages` : la ligne passe `pending → done`, `transcript` rempli, `media_r2_key` présent.
- couper `DEEPGRAM_API_KEY` (clé invalide) une minute : la ligne passe `failed` après 3 tentatives, le `body`/légende reste lisible (dégradation propre), aucune autre ligne bloquée.

- [ ] **Step 2 : Suite de tests complète**

Run : `npm run test:unit && npm run build`
Expected : tous verts.

- [ ] **Step 3 : Commit (fin de lot L1)**

```bash
git add supabase/migrations/20260602090000_whatsapp_capture_columns.sql \
        supabase/migrations/20260602093000_whatsapp_process_cron.sql \
        supabase/functions/_shared/whatsapp-gateway.ts \
        supabase/functions/_shared/whatsapp-gateway.test.ts \
        supabase/functions/_shared/whatsapp-media.ts \
        supabase/functions/_shared/whatsapp-media.test.ts \
        supabase/functions/_shared/whatsapp-transcribe.ts \
        supabase/functions/_shared/whatsapp-transcribe.test.ts \
        supabase/functions/whatsapp-process/index.ts \
        supabase/functions/whatsapp-webhook/index.ts \
        vitest.config.ts src/hooks/useWhatsAppMessages.ts
git commit -m "feat(whatsapp): L1 — capture média Meta→R2 + transcription Deepgram (durable cron)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Suite (plans ultérieurs, hors ce document)

- **Plan #2 — L2 compréhension** : table `whatsapp_conversation_insights` + RLS, `whatsapp-comprehend` (DeepSeek `deepseek-chat`, prompt + parse/validation purs testés), branchement dans le cron (recalcul d'insight par contact touché, debounce), hook `useConversationInsight` + contrat pour Julien.
- **Plan #3 — L3 compliance** : avis client `whatsapp_notices` (une fois par numéro), cron de purge (audio R2 après transcription + champ `raw`). **Actif avant tout trafic client réel en prod.**

## Notes de découpe / risques

- **`media_id` éphémère** : valable ~30 j côté Meta ; le cron minute le récupère bien avant expiration. Au-delà → `failed` (pas de boucle infinie, `MAX_RETRIES`).
- **Tests I/O** : `fetchMetaMedia`/`transcribe` utilisent `fetch` global (mockables) ; le PUT R2 (aws4fetch, Deno) est validé en staging, pas en unitaire.
- **Secrets requis en prod** : `META_WHATSAPP_TOKEN`, `DEEPGRAM_API_KEY`, `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (déjà posés pour `photo-processor`/WhatsApp, à confirmer).
