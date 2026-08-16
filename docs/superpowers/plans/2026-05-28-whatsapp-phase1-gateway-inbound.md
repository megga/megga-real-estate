# WhatsApp — Phase 1 : Gateway + miroir entrant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recevoir les messages WhatsApp entrants depuis OpenWA, les stocker côté MEGGA (mappés au contact quand possible) et les afficher en lecture seule dans le CRM.

**Architecture:** OpenWA (local) émet un webhook `message.received` signé HMAC → edge function Supabase `whatsapp-webhook` (publique, sans auth Supabase, validée par signature) → couche d'abstraction `whatsapp-gateway` (interface provider, impl OpenWA, swappable Meta) normalise le payload → insertion idempotente dans `whatsapp_messages` (service role) → mapping best-effort vers `contacts` par numéro → audit `activity_events` → le CRM lit via un hook React Query (RLS par agence).

**Tech Stack:** Supabase Pro (`eayczugyrvmtqnnmvjod`), Edge Functions Deno, PostgreSQL + RLS, React 18 + Vite + TanStack Query, Vitest (tests backend + unit).

**Flux de données :**
```
Client → WhatsApp → OpenWA (localhost:2785)
  → POST https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/whatsapp-webhook
     headers: x-openwa-signature: sha256=<hmac>, x-openwa-idempotency-key: <uuid>
  → edge fn vérifie HMAC (secret partagé WHATSAPP_WEBHOOK_SECRET)
  → gateway.parseInbound() → NormalizedInboundMessage
  → map wa_from → contacts.phone (best-effort) → contact_id + agency_id
  → INSERT whatsapp_messages ON CONFLICT (provider, provider_message_id) DO NOTHING
  → INSERT activity_events (action='whatsapp_message_received')
CRM → useWhatsAppMessages(contactId) → SELECT whatsapp_messages (RLS agence) → CdWhatsAppCard (read-only)
```

**Note conformité (LPD) — à respecter dans tout le plan :**
- Les messages contiennent des données personnelles → RLS stricte (un agent ne voit que les messages de son agence ; messages non mappés = super_admin seul).
- `raw` (payload brut) stocké pour debug Phase 1 → prévoir une purge/rétention en Phase 4 (noté, pas implémenté ici).
- En prod, OpenWA sera remplacé par l'API Cloud Meta (la couche gateway rend ça transparent) — aucune donnée client ne doit transiter par OpenWA en production.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/20260528150000_whatsapp_messages.sql` | Table `whatsapp_messages` + RLS + index + idempotency |
| `src/types/database.ts` (modif) | Type généré de la table (ajout manuel, devance le typegen) |
| `supabase/functions/_shared/whatsapp-gateway.ts` | Abstraction provider : types, `verifyHmac`, `OpenWAProvider.parseInbound`, factory `getProvider` |
| `supabase/functions/_shared/whatsapp-gateway.test.ts` | Tests unitaires Vitest (parse + HMAC) |
| `supabase/functions/whatsapp-webhook/index.ts` | Edge function réceptrice (signature → parse → insert → audit) |
| `tests/backend/whatsapp-messages-rls.spec.ts` | Test d'isolation RLS cross-agence |
| `src/hooks/useWhatsAppMessages.ts` | Hook React Query lecture seule |
| `src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx` | Carte read-only dans la fiche contact |

---

## Task 1 : Migration `whatsapp_messages`

**Files:**
- Create: `supabase/migrations/20260528150000_whatsapp_messages.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- whatsapp_messages — miroir des messages WhatsApp (Phase 1 : entrant seulement).
--
-- Alimentée par l'edge function whatsapp-webhook (service role). Chaque message
-- entrant OpenWA y est inséré, mappé au contact par numéro quand c'est possible.
--
-- RLS :
--   - service_role : insert (le webhook ; bypass RLS de toute façon)
--   - authenticated : SELECT uniquement les messages de SON agence (agency_id)
--   - super_admin : tout (y compris messages non mappés, agency_id NULL)
--
-- Idempotence : UNIQUE(provider, provider_message_id) — OpenWA peut retenter
-- la livraison d'un même event (X-OpenWA-Retry-Count).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),

  -- Provenance / provider-agnostic
  provider            text        NOT NULL    DEFAULT 'openwa' CHECK (provider IN ('openwa', 'meta')),
  provider_message_id text        NOT NULL,
  session_id          text        NULL,
  direction           text        NOT NULL    DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),

  -- Adresses (chiffres only, format international sans +)
  wa_from             text        NOT NULL,
  wa_to               text        NULL,

  -- Mapping CRM (best-effort par numéro)
  contact_id          uuid        NULL        REFERENCES public.contacts(id)  ON DELETE SET NULL,
  agency_id           uuid        NULL        REFERENCES public.agencies(id)  ON DELETE SET NULL,

  -- Contenu
  body                text        NULL,
  media_type          text        NULL        CHECK (media_type IS NULL OR media_type IN ('image','audio','video','document','location','contact','sticker')),
  media_url           text        NULL,

  status              text        NOT NULL    DEFAULT 'received' CHECK (status IN ('received','read','failed')),
  wa_timestamp        timestamptz NULL,
  raw                 jsonb       NULL,

  CONSTRAINT whatsapp_messages_provider_msgid_uniq UNIQUE (provider, provider_message_id)
);

-- Lecture fiche contact : messages d'un contact, triés par date.
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_created
  ON public.whatsapp_messages (contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

-- Filtre tenant.
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_agency_created
  ON public.whatsapp_messages (agency_id, created_at DESC)
  WHERE agency_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- authenticated : voit les messages de son agence uniquement.
-- public.current_agency_id() existe déjà (cf. baseline_remote_schema). Si le
-- helper diffère, l'aligner sur celui utilisé par les RLS de contacts.
DROP POLICY IF EXISTS "whatsapp_messages_agency_select" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_agency_select"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = public.current_agency_id());

-- super_admin : tout (gestion + messages non mappés).
DROP POLICY IF EXISTS "whatsapp_messages_super_admin_all" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_super_admin_all"
  ON public.whatsapp_messages
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Pas de policy INSERT pour anon/authenticated : seul le service_role écrit
-- (l'edge function), et le service_role bypass la RLS.

COMMIT;
```

- [ ] **Step 2: Vérifier le helper `current_agency_id()`**

Run: `grep -rn "current_agency_id\|FUNCTION public.current_agency" supabase/migrations/00000000000000_baseline_remote_schema.sql | head`
Expected: la fonction existe. Si le nom diffère (ex. `auth_agency_id`), remplacer dans la policy SELECT par le helper réellement utilisé par les RLS de `contacts` (vérifier : `grep -n "POLICY" supabase/migrations/*contacts* 2>/dev/null` ou la baseline).

- [ ] **Step 3: Appliquer la migration sur une branche Supabase (PAS prod directement)**

Créer une branche de dev Supabase pour tester sans risque (via MCP `create_branch` ou CLI). Appliquer la migration sur la branche. Ne merger sur prod qu'après validation e2e (Task 8).
Expected: migration appliquée sans erreur, table visible via `list_tables`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528150000_whatsapp_messages.sql
git commit -m "feat(whatsapp): add whatsapp_messages table with RLS + idempotency"
```

---

## Task 2 : Types `database.ts`

**Files:**
- Modify: `src/types/database.ts` (ajout alphabétique près des autres tables `w*` / dans `Tables`)

- [ ] **Step 1: Ajouter le type de la table**

Insérer dans `public.Tables` (suivre le pattern existant — Row/Insert/Update/Relationships) :

```typescript
      whatsapp_messages: {
        Row: {
          agency_id: string | null
          body: string | null
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          provider: string
          provider_message_id: string
          raw: Json | null
          session_id: string | null
          status: string
          wa_from: string
          wa_timestamp: string | null
          wa_to: string | null
        }
        Insert: {
          agency_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          provider?: string
          provider_message_id: string
          raw?: Json | null
          session_id?: string | null
          status?: string
          wa_from: string
          wa_timestamp?: string | null
          wa_to?: string | null
        }
        Update: {
          agency_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          provider?: string
          provider_message_id?: string
          raw?: Json | null
          session_id?: string | null
          status?: string
          wa_from?: string
          wa_timestamp?: string | null
          wa_to?: string | null
        }
        Relationships: []
      }
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc -b 2>&1 | grep whatsapp_messages || echo "OK no errors"`
Expected: `OK no errors`

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): add whatsapp_messages to database types"
```

---

## Task 3 : Couche d'abstraction `whatsapp-gateway` (TDD)

**Files:**
- Create: `supabase/functions/_shared/whatsapp-gateway.ts`
- Test: `supabase/functions/_shared/whatsapp-gateway.test.ts`

Le module n'utilise que la Web Crypto API (universelle Deno + Node/Vitest) — pas d'import `https://` Deno-only, pour rester testable par Vitest (cf. `_shared/pii-redaction.test.ts`).

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// supabase/functions/_shared/whatsapp-gateway.test.ts
import { describe, it, expect } from 'vitest'
import { getProvider, verifyHmac, type NormalizedInboundMessage } from './whatsapp-gateway'

describe('whatsapp-gateway — OpenWA provider', () => {
  const provider = getProvider('openwa')

  it('parse un event message.received en message normalisé', () => {
    const payload = {
      event: 'message.received',
      sessionId: 'sess_123',
      data: {
        id: 'wamid.ABC',
        from: '41791112233@c.us',
        to: '41220000000@c.us',
        body: 'Bonjour, je veux visiter',
        type: 'chat',
        timestamp: 1716900000,
      },
    }
    const msg = provider.parseInbound(payload) as NormalizedInboundMessage
    expect(msg).not.toBeNull()
    expect(msg.providerMessageId).toBe('wamid.ABC')
    expect(msg.fromPhone).toBe('41791112233')   // suffixe @c.us retiré, chiffres only
    expect(msg.toPhone).toBe('41220000000')
    expect(msg.body).toBe('Bonjour, je veux visiter')
    expect(msg.mediaType).toBeNull()
    expect(msg.sessionId).toBe('sess_123')
  })

  it('mappe un type média', () => {
    const msg = provider.parseInbound({
      event: 'message.received',
      sessionId: 's',
      data: { id: 'm2', from: '41790000000@c.us', type: 'image', body: '', caption: 'photo', timestamp: 1 },
    })
    expect(msg?.mediaType).toBe('image')
  })

  it('ignore les events non pertinents (message.sent, status)', () => {
    expect(provider.parseInbound({ event: 'message.sent', data: { id: 'x' } })).toBeNull()
    expect(provider.parseInbound({ event: 'session.connected', data: {} })).toBeNull()
  })

  it('verifyHmac valide une signature correcte et rejette une mauvaise', async () => {
    const secret = 'topsecret'
    const raw = '{"event":"message.received","data":{"id":"m"}}'
    // HMAC-SHA256(secret, raw) en hex, préfixé "sha256="
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
    const hex = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
    const good = `sha256=${hex}`

    expect(await verifyHmac(raw, good, secret)).toBe(true)
    expect(await verifyHmac(raw, 'sha256=deadbeef', secret)).toBe(false)
    expect(await verifyHmac(raw, '', secret)).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: FAIL — `Cannot find module './whatsapp-gateway'`

- [ ] **Step 3: Écrire l'implémentation**

```typescript
// supabase/functions/_shared/whatsapp-gateway.ts
//
// Couche d'abstraction provider WhatsApp. Le code applicatif (edge function,
// futur envoi) parle à cette interface, jamais directement à OpenWA ni Meta.
// Phase 1 : entrant seulement (parseInbound + verifyHmac). L'envoi (send) sera
// ajouté en Phase 2.
//
// N'utilise que la Web Crypto API → testable Vitest (Node) ET exécutable Deno.

export interface NormalizedInboundMessage {
  providerMessageId: string
  sessionId: string | null
  fromPhone: string          // chiffres only, format international sans +
  toPhone: string | null
  body: string | null
  mediaType: NormalizedMediaType | null
  mediaUrl: string | null
  timestamp: string | null   // ISO 8601
  raw: unknown
}

export type NormalizedMediaType =
  | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'

export interface WhatsAppProvider {
  readonly name: 'openwa' | 'meta'
  /** Retourne un message normalisé, ou null si l'event n'est pas un entrant pertinent. */
  parseInbound(payload: unknown): NormalizedInboundMessage | null
}

// ── Helpers ──────────────────────────────────────────────────────

/** Garde uniquement les chiffres (retire @c.us, +, espaces). */
export function normalizePhone(jid: string): string {
  return (jid || '').split('@')[0].replace(/\D/g, '')
}

const OPENWA_TYPE_TO_MEDIA: Record<string, NormalizedMediaType> = {
  image: 'image', audio: 'audio', ptt: 'audio', video: 'video',
  document: 'document', location: 'location', vcard: 'contact', sticker: 'sticker',
}

/** Vérifie une signature OpenWA "sha256=<hex>" en timing-safe. */
export async function verifyHmac(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const expected = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
  // Comparaison timing-safe (longueurs égales requises)
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// ── OpenWA provider ──────────────────────────────────────────────

class OpenWAProvider implements WhatsAppProvider {
  readonly name = 'openwa' as const

  parseInbound(payload: unknown): NormalizedInboundMessage | null {
    const p = payload as Record<string, unknown>
    if (!p || p.event !== 'message.received') return null
    const data = (p.data ?? {}) as Record<string, unknown>
    const id = data.id as string | undefined
    const from = data.from as string | undefined
    if (!id || !from) return null

    const type = (data.type as string) || 'chat'
    const mediaType = OPENWA_TYPE_TO_MEDIA[type] ?? null
    const ts = data.timestamp as number | undefined

    return {
      providerMessageId: id,
      sessionId: (p.sessionId as string) ?? null,
      fromPhone: normalizePhone(from),
      toPhone: data.to ? normalizePhone(data.to as string) : null,
      body: (data.body as string) || (data.caption as string) || null,
      mediaType,
      mediaUrl: (data.mediaUrl as string) ?? null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : null,
      raw: payload,
    }
  }
}

const PROVIDERS: Record<string, WhatsAppProvider> = {
  openwa: new OpenWAProvider(),
  // meta: new MetaProvider(),  // Phase 4
}

export function getProvider(name = 'openwa'): WhatsAppProvider {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown WhatsApp provider: ${name}`)
  return p
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: PASS (4 tests verts)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/whatsapp-gateway.ts supabase/functions/_shared/whatsapp-gateway.test.ts
git commit -m "feat(whatsapp): provider abstraction layer (parse + HMAC verify) with tests"
```

---

## Task 4 : Edge function `whatsapp-webhook`

**Files:**
- Create: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1: Écrire l'edge function**

```typescript
// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac } from '../_shared/whatsapp-gateway.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-openwa-signature, x-openwa-idempotency-key, x-openwa-retry-count, x-openwa-delivery-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  // 1. Signature HMAC sur le body brut
  const rawBody = await req.text()
  const signature = req.headers.get('x-openwa-signature') ?? ''
  const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET') ?? ''
  if (!secret) {
    console.error('WHATSAPP_WEBHOOK_SECRET not configured')
    return new Response('Server misconfigured', { status: 500, headers: corsHeaders })
  }
  if (!(await verifyHmac(rawBody, signature, secret))) {
    return new Response('Invalid signature', { status: 401, headers: corsHeaders })
  }

  // 2. Parse + normalisation via la couche gateway
  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { return new Response('Bad JSON', { status: 400, headers: corsHeaders }) }
  const provider = getProvider(Deno.env.get('WHATSAPP_PROVIDER') ?? 'openwa')
  const msg = provider.parseInbound(payload)
  if (!msg) return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 3. Mapping best-effort : numéro → contact (et son agence)
  let contactId: string | null = null
  let agencyId: string | null = null
  {
    // Match sur les derniers 9 chiffres pour tolérer les variations de format
    const tail = msg.fromPhone.slice(-9)
    const { data: contact } = await admin
      .from('contacts')
      .select('id, agency_id')
      .ilike('phone', `%${tail}`)
      .limit(1)
      .maybeSingle()
    if (contact) { contactId = contact.id; agencyId = contact.agency_id }
  }

  // 4. Insert idempotent (ON CONFLICT via upsert sur la contrainte unique)
  const { error: insErr } = await admin
    .from('whatsapp_messages')
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
      status: 'received',
      wa_timestamp: msg.timestamp,
      raw: msg.raw,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

  if (insErr) {
    console.error('whatsapp_messages insert error:', insErr.message)
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  // 5. Audit (best-effort, non bloquant)
  try {
    await admin.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: null,
      actor_kind: 'system',
      action: 'whatsapp_message_received',
      entity_type: contactId ? 'contact' : 'whatsapp',
      entity_id: contactId,
      category: 'messaging',
    })
  } catch { /* non bloquant */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 2: Vérifier la forme exacte de `activity_events`**

Run: `grep -n "activity_events" src/types/database.ts | head -1` puis lire les colonnes du `Insert`.
Expected: confirmer que `actor_kind`, `entity_id`, `category` existent. Sinon, ajuster l'insert (retirer/renommer les colonnes absentes). La RLS isolation test (Task 1) du repo montre le set minimal : `agency_id, actor_id, action, entity_type, category`.

- [ ] **Step 3: Déclarer le secret + déployer sur la branche Supabase**

```bash
# Secret partagé OpenWA ↔ webhook
supabase secrets set WHATSAPP_WEBHOOK_SECRET=$(openssl rand -hex 32) --project-ref <branch-ref>
supabase functions deploy whatsapp-webhook --project-ref <branch-ref> --no-verify-jwt
```
Note : `--no-verify-jwt` car la fonction est publique (validée par signature, pas par JWT Supabase), comme `stripe-webhook`.
Expected: déploiement OK, URL `https://<branch-ref>.supabase.co/functions/v1/whatsapp-webhook`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(whatsapp): inbound webhook edge function (HMAC verify → map → store → audit)"
```

---

## Task 5 : Test d'isolation RLS (backend, TDD)

**Files:**
- Create: `tests/backend/whatsapp-messages-rls.spec.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/backend/whatsapp-messages-rls.spec.ts
// RLS isolation — whatsapp_messages. Un agent ne doit voir que les messages
// de SON agence ; les messages non mappés (agency_id NULL) ne fuitent pas.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — whatsapp_messages', () => {
  let setup: TwoAgenciesSetup
  let msgAId: string
  let msgBId: string
  let msgOrphanId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const mk = async (agencyId: string | null, pmid: string) => {
      const { data, error } = await service.from('whatsapp_messages').insert({
        provider: 'openwa', provider_message_id: pmid, wa_from: '41790000000',
        direction: 'inbound', agency_id: agencyId, body: 'test', status: 'received',
      }).select('id').single()
      if (error) throw new Error(`${pmid}: ${error.message}`)
      return data.id as string
    }
    msgAId = await mk(setup.agencyAId, `pmid-A-${Date.now()}`)
    msgBId = await mk(setup.agencyBId, `pmid-B-${Date.now()}`)
    msgOrphanId = await mk(null, `pmid-orphan-${Date.now()}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [msgAId, msgBId, msgOrphanId]) {
      if (id) await service.from('whatsapp_messages').delete().eq('id', id)
    }
    await setup.cleanup()
  })

  it('agent A voit le message de son agence', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgAId)
    expect(data).toHaveLength(1)
  })

  it('agent A NE voit PAS le message de l\'agence B', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('agent A NE voit PAS un message non mappé (agency_id NULL)', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgOrphanId)
    expect(data ?? []).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer le test sur la branche Supabase**

Run: `SUPABASE_TEST_URL=<branch-url> SUPABASE_TEST_ANON_KEY=<anon> SUPABASE_TEST_SERVICE_ROLE_KEY=<service> npm run test:backend -- whatsapp-messages-rls`
Expected: 3 tests PASS. (Si `skipIf` saute : vérifier que les clés de test pointent sur la branche où la migration est appliquée.)

- [ ] **Step 3: Commit**

```bash
git add tests/backend/whatsapp-messages-rls.spec.ts
git commit -m "test(whatsapp): RLS isolation for whatsapp_messages (cross-agency + orphan)"
```

---

## Task 6 : Hook `useWhatsAppMessages`

**Files:**
- Create: `src/hooks/useWhatsAppMessages.ts`

- [ ] **Step 1: Écrire le hook**

```typescript
// src/hooks/useWhatsAppMessages.ts
// Lecture seule (Phase 1) des messages WhatsApp d'un contact. La RLS garantit
// le cloisonnement par agence — le hook ne fait aucun filtre tenant côté client.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface WhatsAppMessageRow {
  id: string
  created_at: string
  direction: 'inbound' | 'outbound'
  wa_from: string
  wa_to: string | null
  body: string | null
  media_type: string | null
  media_url: string | null
  status: string
  wa_timestamp: string | null
}

export function useWhatsAppMessages(contactId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-messages', contactId],
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<WhatsAppMessageRow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, created_at, direction, wa_from, wa_to, body, media_type, media_url, status, wa_timestamp')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WhatsAppMessageRow[]
    },
  })
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc -b 2>&1 | grep useWhatsAppMessages || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWhatsAppMessages.ts
git commit -m "feat(whatsapp): read-only useWhatsAppMessages hook"
```

---

## Task 7 : Carte read-only `CdWhatsAppCard` dans la fiche contact

**Files:**
- Create: `src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx`
- Modify: `src/pages/agent/ContactDetailPage.tsx` (monter la carte ; suivre l'emplacement des autres `Cd*Card`)

- [ ] **Step 1: Écrire la carte**

```tsx
// src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx
// Affichage read-only des messages WhatsApp d'un contact (Phase 1 : miroir
// entrant). Pas d'envoi ici — ce sera la Phase 2.

import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages'

interface Props { contactId: string }

export function CdWhatsAppCard({ contactId }: Props) {
  const { data: messages = [], isLoading } = useWhatsAppMessages(contactId)

  return (
    <div className="rounded-xl border border-theme-border bg-theme-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary">WhatsApp</h3>
        <span className="text-xs text-theme-muted">{messages.length} message{messages.length > 1 ? 's' : ''}</span>
      </div>

      {isLoading && <p className="text-xs text-theme-muted">Chargement…</p>}

      {!isLoading && messages.length === 0 && (
        <p className="text-xs text-theme-muted">Aucun message WhatsApp pour ce contact.</p>
      )}

      <div className="flex flex-col gap-2">
        {messages.map(m => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.direction === 'inbound'
                ? 'self-start bg-theme-section text-theme-primary'
                : 'self-end bg-emerald-600 text-white'
            }`}
          >
            {m.media_type && (
              <span className="block text-xs opacity-70 mb-0.5">[{m.media_type}]</span>
            )}
            {m.body || <span className="opacity-60 italic">(sans texte)</span>}
            <span className="block text-[10px] opacity-60 mt-1">
              {new Date(m.wa_timestamp || m.created_at).toLocaleString('fr-CH')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Monter la carte dans la fiche contact**

Dans `src/pages/agent/ContactDetailPage.tsx`, importer et rendre `<CdWhatsAppCard contactId={contact.id} />` à côté des autres cartes (`CdTimelineCard`, `CdNotesCard`…). Récupérer le nom exact de la variable contact id dans ce fichier.

Run d'abord: `grep -n "CdNotesCard\|CdTimelineCard\|contact.id\|contactId" src/pages/agent/ContactDetailPage.tsx | head`
Puis insérer l'import en haut et le composant au bon endroit du JSX.

- [ ] **Step 3: Vérifier visuellement**

Run: `npm run dev` puis ouvrir une fiche contact dans le CRM. Vérifier que la carte WhatsApp s'affiche (vide si pas de message).
Expected: carte "WhatsApp · 0 message" + "Aucun message WhatsApp pour ce contact."

- [ ] **Step 4: Commit**

```bash
git add src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx src/pages/agent/ContactDetailPage.tsx
git commit -m "feat(whatsapp): read-only WhatsApp thread card on contact detail"
```

---

## Task 8 : Câblage OpenWA → webhook + vérification e2e

**Files:** aucun (configuration runtime)

- [ ] **Step 1: Enregistrer le webhook sur la session OpenWA**

OpenWA tourne sur `localhost:2785`, session `megga-test` (id `09a744c9-0b26-4a1f-b284-b5a66158b13c`). Enregistrer le webhook pointant vers la fonction déployée, avec le même secret que `WHATSAPP_WEBHOOK_SECRET` :

```bash
SID="09a744c9-0b26-4a1f-b284-b5a66158b13c"
SECRET="<la même valeur que WHATSAPP_WEBHOOK_SECRET>"
curl -s -X POST "http://localhost:2785/api/sessions/$SID/webhooks" \
  -H "X-API-Key: dev-admin-key" -H "Content-Type: application/json" \
  -d "{\"url\":\"https://<branch-ref>.supabase.co/functions/v1/whatsapp-webhook\",\"events\":[\"message.received\"],\"secret\":\"$SECRET\"}"
```
Expected: 201 Created avec l'id du webhook.

- [ ] **Step 2: Vérifier que le compte WhatsApp est connecté**

Run: `curl -s "http://localhost:2785/api/sessions/$SID" -H "X-API-Key: dev-admin-key" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])"`
Expected: `connected` (sinon, rescanner le QR via le dashboard `localhost:2886`).

- [ ] **Step 3: Test e2e — envoyer un message au numéro lié**

Depuis un autre téléphone, envoyer un WhatsApp au numéro lié (ou s'auto-envoyer un message). Puis vérifier l'arrivée en base :

```bash
# via MCP execute_sql sur la branche, ou :
curl -s "https://<branch-ref>.supabase.co/rest/v1/whatsapp_messages?select=wa_from,body,created_at&order=created_at.desc&limit=3" \
  -H "apikey: <service-role>" -H "Authorization: Bearer <service-role>"
```
Expected: le message envoyé apparaît (wa_from, body corrects). Vérifier aussi `activity_events` (action `whatsapp_message_received`).

- [ ] **Step 4: Vérifier le mapping contact (optionnel)**

Créer un `contact` dont le `phone` correspond au numéro émetteur, renvoyer un message, vérifier que `contact_id` + `agency_id` sont remplis sur la nouvelle ligne, et que la carte CRM (Task 7) l'affiche.
Expected: message visible dans `CdWhatsAppCard` de la fiche contact.

- [ ] **Step 5: Vérifier l'idempotence**

Rejouer le même payload (ou laisser OpenWA retenter) → aucune ligne dupliquée (contrainte `provider,provider_message_id`).
Expected: 1 seule ligne par message.

---

## Self-Review

**Spec coverage :**
- (1) Couche d'abstraction `whatsapp-gateway` → Task 3 ✓
- (2) Edge function webhook + signature → Task 4 (HMAC en Task 3) ✓
- (3) Migration table + mapping contacts → Task 1 + mapping dans Task 4 ✓
- (4) Vue read-only CRM → Task 6 (hook) + Task 7 (carte) ✓
- RLS sur la table → Task 1 + test Task 5 ✓
- Audit `activity_events` → Task 4 step 5 ✓
- Webhook joignable depuis OpenWA local → Task 8 (OpenWA local → Supabase public, sortant : OK sans tunnel) ✓
- LPD → note conformité + RLS stricte + rétention `raw` notée pour Phase 4 ✓

**Cohérence des types :** `NormalizedInboundMessage` (Task 3) consommé tel quel par le webhook (Task 4). `WhatsAppMessageRow` (Task 6) = sous-ensemble des colonnes de la table (Task 1). `provider_message_id` cohérent partout.

**Points à confirmer pendant l'exécution (non bloquants, signalés dans les steps) :**
- Nom exact du helper RLS d'agence (`current_agency_id` vs autre) — Task 1 step 2
- Colonnes exactes d'`activity_events` (`actor_kind`, `entity_id`) — Task 4 step 2
- Emplacement de montage de la carte dans `ContactDetailPage` — Task 7 step 2

**Décision infra :** migration + edge function déployées d'abord sur une **branche Supabase** (pas prod). Merge sur prod seulement après Task 8 validée.

---

## Risques & garde-fous

- **Sécurité** : la fonction est publique → la signature HMAC est la seule barrière. Ne jamais logger le secret ; rejeter en 401 si signature absente/invalide.
- **Format numéro** : le mapping par `phone` est best-effort (match sur 9 derniers chiffres). Les non-matchs restent en `agency_id NULL` (super_admin only) — acceptable en Phase 1.
- **Ban OpenWA** : c'est un prototype. Aucune donnée client réelle sensible ne doit transiter tant qu'on n'est pas sur Meta (Phase 4). Utiliser un numéro de test.
- **Rétention `raw`** : contient le payload complet (PII). Purge à implémenter avant prod (Phase 4).
