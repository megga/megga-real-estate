# Rapport KYC en PDF par WhatsApp — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand l'agent écrit « envoie-moi le rapport KYC de Dubois » sur WhatsApp, MEGGA génère le PDF officiel du dossier (identique au CRM) et le lui renvoie en pièce jointe WhatsApp.

**Architecture (Option A — Cloudflare Browser Rendering via API REST, sans Worker) :** le template React du rapport (`KycExportPage`/`PdfPage1-3`/`buildPdfReportData`, déjà en prod) est rendu en PDF par le **Browser Rendering REST API** de Cloudflare (`POST .../browser-rendering/pdf`, GA, appelable depuis une edge Supabase avec un token API — **pas de Worker, pas de wrangler**). Une route publique tokenisée `/kyc-report/:token` rend les 3 pages à partir d'une edge `kyc-report-data` (HMAC, scopée agence). Une edge orchestratrice `kyc-report-pdf` (service-à-service, comme `kyc-screening`) mint le token, appelle CF, uploade le PDF en média Meta éphémère et l'envoie en document à l'agent. Un outil copilote `send_kyc_report` (tier `auto`) câble le tout.

**Tech Stack :** Deno (edge functions Supabase), React 18 + Vite (route de rendu), Web Crypto (HMAC token réutilisé), Meta WhatsApp Cloud API (document message + media upload), Cloudflare Browser Rendering REST API. Tests : Vitest (modules purs) + backend specs live (token/scope).

---

## Décisions tranchées (les 6 questions)

| # | Question | Décision |
|---|----------|----------|
| 1 | Route de rendu | **Route publique dédiée `/kyc-report/:token`** ; token `{ id: dossier_id, exp ~5 min, p: profile_id }` réutilisant l'HMAC `magic-link-token.ts` ; l'edge dérive `agency_id` du dossier **server-side**. |
| 2 | Hébergement PDF + archivage | **Upload média Meta éphémère** (pas de PDF sensible stocké) ; **PAS d'archivage** des bytes (l'envoi est tracé dans `activity_events`, le rapport est régénérable). → **Aucune migration.** |
| 3 | Tier de `send_kyc_report` | **`auto`** (rapport de l'agent à lui-même, aucun contact client). |
| 4 | Cloudflare Browser Rendering | **API REST depuis l'edge** (pas de Worker). Gratuit dans le tier free (10 min/jour). Token CF scopé `Browser Rendering - Edit`. Fallback documenté : Option B `pdf-lib`. |
| 5 | Contenu | **Strictement identique au CRM** (factuel, zéro IA), pas de page résumé mobile. Un seul template → DRY. |
| 6 | Déclencheur | **Tout stade** : générable dès qu'un dossier existe (cohérent avec KYC non-bloquant). |

**Hors scope :** envoi du rapport à un CLIENT par WhatsApp (templates Meta approuvés requis — même contrainte que la collecte client KYC Phase 2).

---

## Contrainte d'infra critique (à connaître avant de coder)

1. **Toute l'app megga.ch est derrière un HTTP Basic Auth `ai/ai`** (`sites/property-preview/_worker.js`, overlay `dist/`, « intercepts 100% of traffic »). Le headless CF doit passer ces creds via le param **`authenticate: { username, password }`** du REST API (confirmé doc CF, valable pour `/pdf`). Creds lus depuis un secret (`MEGGA_PREVIEW_BASIC_AUTH`) — jamais hardcodés.
2. **L'app est sur Cloudflare Pages, pas Workers** (aucun `wrangler.toml`). C'est pourquoi on passe par l'**API REST** (pas le binding Worker `@cloudflare/puppeteer`).
3. **Edges déployées `--no-verify-jwt`** (cf. `deploy.yml`, `JWT_PROTECTED=""`). Les nouvelles edges suivent ce schéma : `kyc-report-data` s'auth par le **token HMAC** (appelée par un navigateur public, aucun JWT) ; `kyc-report-pdf` s'auth par la **clé service-role comparée à temps constant** (appelée par `whatsapp-agent`, pattern `kyc-screening`).
4. **Règle d'or KYC** préservée : générer/envoyer un rapport est **lecture seule** — ne touche NI `dossier_status` NI `is_completed`.

---

## File Structure

**Nouveau :**
- `supabase/functions/kyc-report-data/index.ts` — edge : token → `BuildReportInput` JSON (service-role, scope agence).
- `supabase/functions/kyc-report-pdf/index.ts` — edge orchestratrice : mint token → CF `/pdf` → upload média Meta → send document → audit.
- `supabase/functions/_shared/cf-browser-render.ts` — module **pur** : `buildCfPdfRequestBody()` (corps de la requête CF `/pdf`). Testable.
- `src/pages/public/KycReportRenderPage.tsx` — route publique de rendu (3 pages PDF, sentinelle `#pdf-ready`, aucun auth/toolbar/print).
- `tests/backend/kyc-report-data.spec.ts` — spec live : token valide/expiré/cross-agency.
- `supabase/functions/_shared/cf-browser-render.test.ts` — unit (corps requête CF).

**Modifié :**
- `supabase/functions/_shared/magic-link-token.ts` — payload : champ optionnel `p` (profile id de l'agent demandeur).
- `supabase/functions/_shared/whatsapp-gateway.ts` — `OutboundDocumentMessage` + `buildSendDocumentRequest` (Meta) sur l'interface + provider.
- `supabase/functions/_shared/whatsapp-media.ts` — `parseMetaMediaUploadResult` (pur) + `uploadMetaMediaDocument` (I/O).
- `supabase/functions/_shared/whatsapp-actions.ts` — `ActionCtx.agentPhone` + `execSendKycReport`.
- `supabase/functions/_shared/whatsapp-tools.ts` — outil `send_kyc_report`.
- `supabase/functions/_shared/whatsapp-agent-router.ts` — `TOOL_TIERS.send_kyc_report = 'auto'`.
- `supabase/functions/whatsapp-agent/index.ts` — `ctx.agentPhone = waNumber` + dispatch `case 'send_kyc_report'`.
- `src/App.tsx` — route `<Route path="/kyc-report/:token" element={<KycReportRenderPage />} />`.
- Tests étendus : `whatsapp-gateway.test.ts`, `whatsapp-media.test.ts`, `whatsapp-agent-router.test.ts`, `magic-link-token` (nouveau test ou existant).

**Réutilisé sans changement :** `buildPdfReportData` + `PdfPage1/2/3` + `tokens.ts` · `signMagicLinkToken`/`verifyMagicLinkToken` · `findOpenKycCase`/`contactInAgency` (whatsapp-actions) · pattern service-à-service `safeEqual` (kyc-screening) · `fetchMetaMedia` (modèle pour l'upload) · client `supabase` anon (route de rendu) · infra outils `toolTier`/`runTool`.

---

## Task 0: Setup — secrets Supabase + token Cloudflare (manuel, prérequis)

**Aucun code.** Étape ops à faire AVANT le déploiement (les edges en ont besoin au runtime). À noter dans le PR.

- [ ] **Step 1: Créer un token API Cloudflare scopé Browser Rendering**

Dashboard Cloudflare → My Profile → API Tokens → Create Token → permission **`Account · Browser Rendering · Edit`** (rien d'autre — ne PAS réutiliser le token de déploiement Pages, trop large). Copier le token.

- [ ] **Step 2: Ajouter les secrets Supabase** (Dashboard → Project Settings → Edge Functions → Secrets, ou CLI)

```bash
supabase secrets set \
  CLOUDFLARE_ACCOUNT_ID=<account_id> \
  CLOUDFLARE_BROWSER_RENDER_TOKEN=<token_browser_rendering_edit> \
  MEGGA_APP_URL=https://megga.ch \
  MEGGA_PREVIEW_BASIC_AUTH=ai:ai
```

Déjà présents (réutilisés, ne pas recréer) : `MEGGA_MAGIC_LINK_HMAC_SECRET`, `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_API_VERSION`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 3: Vérifier le token CF** (smoke test, depuis ta machine)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/browser-rendering/pdf" \
  -H "Authorization: Bearer $CLOUDFLARE_BROWSER_RENDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/"}' --output /tmp/cf-test.pdf
file /tmp/cf-test.pdf
```
Expected : `/tmp/cf-test.pdf: PDF document, version 1.4` (et non un JSON d'erreur). Si erreur 403/permission → le token n'a pas `Browser Rendering - Edit`.

---

## Task 1: Token — champ optionnel `p` (profile de l'agent demandeur)

Le rapport officiel affiche le nom de l'agent responsable. L'edge de rendu n'a pas de session ; on transporte le profile id (UUID opaque) dans le token HMAC signé + court (5 min).

**Files:**
- Modify: `supabase/functions/_shared/magic-link-token.ts:11-14` (interface) et `:95-97` (type-guard verify)
- Test: `supabase/functions/_shared/magic-link-token.test.ts` (créer si absent)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `supabase/functions/_shared/magic-link-token.test.ts` :

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { signMagicLinkToken, verifyMagicLinkToken } from './magic-link-token.ts'

beforeAll(() => {
  // Secret de test (>= 32 chars). Deno.env est lu par le module ; en Node/Vitest
  // on l'injecte via globalThis.Deno shim.
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => (k === 'MEGGA_MAGIC_LINK_HMAC_SECRET' ? 'x'.repeat(40) : undefined) },
  }
})

describe('magic-link-token: champ p (profile id)', () => {
  it('round-trip un token avec p et le restitue', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'dossier-123', exp, p: 'profile-abc' })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.id).toBe('dossier-123')
    expect(res.payload?.p).toBe('profile-abc')
  })

  it('reste compatible avec un token sans p', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'm-link-1', exp })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.p).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run supabase/functions/_shared/magic-link-token.test.ts`
Expected: FAIL — `p` n'existe pas sur le type `MagicLinkTokenPayload` (erreur TS) ou `res.payload?.p` est `undefined` au premier test.

- [ ] **Step 3: Implémenter (widen l'interface, le `p` survit déjà au round-trip JSON)**

Dans `magic-link-token.ts`, remplacer l'interface (lignes 11-14) :

```ts
interface MagicLinkTokenPayload {
  id: string
  exp: number
  /** Optionnel : profile id de l'agent demandeur (rapport KYC PDF par WhatsApp).
   *  Survit au round-trip JSON ; non requis par les usages magic-link existants. */
  p?: string
}
```

Le `verifyMagicLinkToken` JSON-parse le payload entier, donc `p` est déjà restitué — aucune autre modif nécessaire (le type-guard `:95` ne valide que `id`/`exp`, ce qui reste correct).

- [ ] **Step 4: Lancer le test → passe**

Run: `npx vitest run supabase/functions/_shared/magic-link-token.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/magic-link-token.ts supabase/functions/_shared/magic-link-token.test.ts
git commit -m "feat(kyc-report): token magic-link accepte un champ p (profile agent)"
```

---

## Task 2: Gateway — `buildSendDocumentRequest` (Meta)

Aujourd'hui le provider n'envoie que du texte. On ajoute l'envoi d'un **document** (par media id Meta).

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-gateway.ts` (interface `WhatsAppProvider` + `OutboundDocumentMessage` + impl Meta)
- Test: `supabase/functions/_shared/whatsapp-gateway.test.ts`

- [ ] **Step 1: Écrire le test qui échoue** — ajouter à `whatsapp-gateway.test.ts` :

```ts
import { getProvider } from './whatsapp-gateway.ts'

describe('Meta buildSendDocumentRequest', () => {
  it('construit une requête document Meta valide', () => {
    const meta = getProvider('meta')
    expect(meta.buildSendDocumentRequest).toBeDefined()
    const req = meta.buildSendDocumentRequest!(
      { toPhone: '41791112233', mediaId: 'MEDIA_42', filename: 'Rapport-KYC-2026-AB3F.pdf', caption: 'KYC-2026-AB3F' },
      { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
    )
    expect(req.url).toBe('https://graph.facebook.com/v22.0/PNID/messages')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '41791112233',
      type: 'document',
      document: { id: 'MEDIA_42', filename: 'Rapport-KYC-2026-AB3F.pdf', caption: 'KYC-2026-AB3F' },
    })
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: FAIL — `buildSendDocumentRequest` undefined.

- [ ] **Step 3: Implémenter** — dans `whatsapp-gateway.ts`.

Ajouter le type (après `OutboundTextMessage`, ~ligne 27) :

```ts
export interface OutboundDocumentMessage {
  toPhone: string       // digits only, international sans +
  mediaId: string       // media id Meta (upload préalable)
  filename: string      // nom affiché dans WhatsApp
  caption?: string      // légende optionnelle
}
```

Ajouter à l'interface `WhatsAppProvider` (après `buildMarkReadRequest?`, ~ligne 60) — optionnel comme `buildMarkReadRequest` (seul Meta le supporte) :

```ts
  // Envoi d'un document (PDF) déjà uploadé en média. Optionnel : Meta uniquement.
  buildSendDocumentRequest?(msg: OutboundDocumentMessage, config: SendConfig): SendHttpRequest
```

Implémenter dans `MetaProvider` (après `buildMarkReadRequest`, avant la `}` de classe) :

```ts
  buildSendDocumentRequest(msg: OutboundDocumentMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    const document: Record<string, unknown> = { id: msg.mediaId, filename: msg.filename }
    if (msg.caption) document.caption = msg.caption
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'document',
        document,
      }),
    }
  }
```

(OpenWA ne l'implémente pas — l'interface l'a en optionnel ; la prod est sur Meta.)

- [ ] **Step 4: Lancer → passe**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/whatsapp-gateway.ts supabase/functions/_shared/whatsapp-gateway.test.ts
git commit -m "feat(whatsapp): buildSendDocumentRequest (envoi document PDF via Meta)"
```

---

## Task 3: Media — upload d'un document vers Meta

Pour envoyer un document Meta par media id, il faut d'abord uploader les bytes (`POST /{phone_number_id}/media`, multipart). On ajoute un parseur **pur** (testable) + l'upload I/O (modèle `fetchMetaMedia`).

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-media.ts`
- Test: `supabase/functions/_shared/whatsapp-media.test.ts`

- [ ] **Step 1: Écrire le test qui échoue** — ajouter à `whatsapp-media.test.ts` :

```ts
import { parseMetaMediaUploadResult } from './whatsapp-media.ts'

describe('parseMetaMediaUploadResult', () => {
  it('extrait le media id', () => {
    expect(parseMetaMediaUploadResult({ id: '1234567890' })).toBe('1234567890')
  })
  it('retourne null sans id', () => {
    expect(parseMetaMediaUploadResult({})).toBeNull()
    expect(parseMetaMediaUploadResult(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npx vitest run supabase/functions/_shared/whatsapp-media.test.ts`
Expected: FAIL — `parseMetaMediaUploadResult` n'existe pas.

- [ ] **Step 3: Implémenter** — ajouter à `whatsapp-media.ts` :

```ts
/** Réponse Meta upload média ({ id }) → media id, ou null. */
export function parseMetaMediaUploadResult(json: unknown): string | null {
  const j = json as { id?: string } | null
  return j?.id ?? null
}

export interface MetaUploadConfig {
  metaToken: string
  metaPhoneNumberId: string
  apiVersion?: string
}

/** Upload un document (PDF) vers Meta → media id (éphémère, ~30 jours).
 *  multipart/form-data : messaging_product + type + file. fetch global (Deno OK). */
export async function uploadMetaMediaDocument(
  bytes: Uint8Array, mime: string, filename: string, cfg: MetaUploadConfig,
): Promise<string> {
  const v = cfg.apiVersion ?? 'v22.0'
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', new Blob([bytes], { type: mime }), filename)
  const res = await fetch(`https://graph.facebook.com/${v}/${cfg.metaPhoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.metaToken}` }, // PAS de Content-Type : FormData le fixe (boundary)
    body: form,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`meta media upload HTTP ${res.status}`)
  const id = parseMetaMediaUploadResult(await res.json())
  if (!id) throw new Error('meta media upload: pas de media id')
  return id
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npx vitest run supabase/functions/_shared/whatsapp-media.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/whatsapp-media.ts supabase/functions/_shared/whatsapp-media.test.ts
git commit -m "feat(whatsapp): upload document PDF vers média Meta (parser pur + fetch)"
```

---

## Task 4: Module pur — corps de requête Cloudflare `/pdf`

Isoler la construction du corps CF (testable) du reste de l'I/O.

**Files:**
- Create: `supabase/functions/_shared/cf-browser-render.ts`
- Test: `supabase/functions/_shared/cf-browser-render.test.ts`

- [ ] **Step 1: Écrire le test qui échoue** — `cf-browser-render.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { buildCfPdfRequestBody } from './cf-browser-render.ts'

describe('buildCfPdfRequestBody', () => {
  it('construit un corps A4 avec auth Basic + attente SPA', () => {
    const body = buildCfPdfRequestBody({
      url: 'https://megga.ch/kyc-report/TOKEN',
      basicUser: 'ai',
      basicPass: 'ai',
    })
    expect(body.url).toBe('https://megga.ch/kyc-report/TOKEN')
    expect(body.authenticate).toEqual({ username: 'ai', password: 'ai' })
    expect(body.gotoOptions).toMatchObject({ waitUntil: 'networkidle0' })
    expect(body.waitForSelector).toMatchObject({ selector: '#pdf-ready' })
    expect(body.pdfOptions).toMatchObject({ format: 'a4', printBackground: true, preferCSSPageSize: true })
  })

  it('omet authenticate si pas de creds', () => {
    const body = buildCfPdfRequestBody({ url: 'https://x/y' })
    expect(body.authenticate).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npx vitest run supabase/functions/_shared/cf-browser-render.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter** — `cf-browser-render.ts` :

```ts
// Construction PURE du corps de requête Cloudflare Browser Rendering /pdf.
// (l'I/O — fetch CF — vit dans l'edge kyc-report-pdf). Testable Vitest.
//
// Réf. doc : gotoOptions.waitUntil=networkidle0 (SPA) + waitForSelector sur la
// sentinelle #pdf-ready (posée par la route une fois données+fontes prêtes) +
// pdfOptions A4/printBackground/preferCSSPageSize (le template a déjà @page A4).
// authenticate = HTTP Basic (l'app megga.ch est derrière ai/ai).

export interface CfPdfRequestInput {
  url: string
  basicUser?: string
  basicPass?: string
}

export function buildCfPdfRequestBody(input: CfPdfRequestInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    url: input.url,
    gotoOptions: { waitUntil: 'networkidle0', timeout: 45000 },
    waitForSelector: { selector: '#pdf-ready', timeout: 20000 },
    pdfOptions: {
      format: 'a4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30000,
    },
  }
  if (input.basicUser && input.basicPass) {
    body.authenticate = { username: input.basicUser, password: input.basicPass }
  }
  return body
}

/** Découpe "user:pass" en { user, pass } ; tolère un pass contenant des ':'. */
export function parseBasicAuthPair(raw: string | undefined): { user?: string; pass?: string } {
  if (!raw) return {}
  const i = raw.indexOf(':')
  if (i < 0) return {}
  return { user: raw.slice(0, i), pass: raw.slice(i + 1) }
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npx vitest run supabase/functions/_shared/cf-browser-render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/cf-browser-render.ts supabase/functions/_shared/cf-browser-render.test.ts
git commit -m "feat(kyc-report): module pur corps requête Cloudflare Browser Rendering /pdf"
```

---

## Task 5: Edge `kyc-report-data` — données du rapport par token

Sert la route de rendu : valide le token HMAC, dérive l'agence du dossier, renvoie le `BuildReportInput` JSON (mêmes queries que les hooks `useKyc*` + `useTransaction`).

**Files:**
- Create: `supabase/functions/kyc-report-data/index.ts`

- [ ] **Step 1: Écrire l'edge** — `kyc-report-data/index.ts` :

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    if (!token) return json({ error: 'token required' }, 400)

    const v = await verifyMagicLinkToken(token)
    if (!v.valid || !v.payload) return json({ error: `invalid token: ${v.reason ?? 'unknown'}` }, 401)
    const dossierId = v.payload.id
    const requesterProfileId = v.payload.p ?? null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Dossier + contact + checklist (mêmes selects que useKycCase)
    const { data: dossier, error: dErr } = await supabase
      .from('kyc_cases')
      .select('*, contact:contacts(first_name, last_name), checklist:kyc_checklist_items(*)')
      .eq('id', dossierId)
      .single()
    if (dErr || !dossier) return json({ error: 'dossier not found' }, 404)

    const agencyId = (dossier as { agency_id: string }).agency_id

    // Documents (mêmes colonnes que useKycDocuments)
    const { data: documents } = await supabase
      .from('documents')
      .select('id, kyc_case_id, name, type, storage_path, size_bytes, status, document_category, issued_at, expires_at, uploaded_by, created_at, sha256_hash')
      .eq('kyc_case_id', dossierId)
      .order('created_at', { ascending: false })

    // Audit (mêmes filtres que useKycAuditEvents)
    const { data: auditEvents } = await supabase
      .from('activity_events')
      .select('id, agency_id, actor_id, actor_kind, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
      .in('entity_type', ['kyc', 'kyc_case', 'kyc_check'])
      .eq('entity_id', dossierId)
      .order('created_at', { ascending: false })

    // Agence (nom)
    const { data: agency } = await supabase
      .from('agencies').select('name').eq('id', agencyId).single()

    // Agent demandeur (nom) — scopé agence par sécurité
    let agentName = 'Agent compliance'
    if (requesterProfileId) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', requesterProfileId).eq('agency_id', agencyId).maybeSingle()
      if (prof?.full_name) agentName = prof.full_name
    }

    // Transaction (montant + libellé bien + stage) — mirroir KycExportPage/useTransaction
    let transactionAmount: number | null = null
    let propertyLabel: string | null = null
    let stage: string | null = null
    const txId = (dossier as { transaction_id: string | null }).transaction_id
    if (txId) {
      const { data: tx } = await supabase
        .from('transactions')
        .select('stage, price_final, price_offered, property:properties(title, city)')
        .eq('id', txId)
        .maybeSingle<{ stage: string | null; price_final: number | null; price_offered: number | null; property: { title: string | null; city: string | null } | null }>()
      if (tx) {
        transactionAmount = tx.price_final ?? tx.price_offered ?? null
        stage = tx.stage ?? null
        const title = tx.property?.title ?? null
        const city = tx.property?.city ?? null
        propertyLabel = title ? (city ? `${title} · ${city}` : title) : null
      }
    }

    // Shape consommée par buildPdfReportData (BuildReportInput, côté route).
    // dossier.transaction.stage est lu par buildVerdict — on l'injecte.
    const report = {
      dossier: { ...dossier, transaction: { stage } },
      documents: documents ?? [],
      auditEvents: auditEvents ?? [],
      agentName,
      agencyName: agency?.name ?? 'MEGGA',
      transactionAmount,
      transactionRef: null,
      propertyLabel,
    }
    return json({ ok: true, report })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
```

- [ ] **Step 2: Vérifier le type-check Deno (best effort) + build app**

Run: `npx tsc -b` (l'edge n'est pas dans le build Vite, mais ça valide qu'on n'a rien cassé côté app).
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/kyc-report-data/index.ts
git commit -m "feat(kyc-report): edge kyc-report-data (données rapport par token HMAC, scope agence)"
```

> Test live de cette edge : voir Task 9 (`tests/backend/kyc-report-data.spec.ts`).

---

## Task 6: Route publique `/kyc-report/:token` (rendu des 3 pages)

Page React publique (pas d'auth) qui charge les données par token, rend `PdfPage1/2/3` via `buildPdfReportData` (template intact), et pose la sentinelle `#pdf-ready` une fois données + fontes prêtes (signal pour le headless CF).

**Files:**
- Create: `src/pages/public/KycReportRenderPage.tsx`
- Modify: `src/App.tsx` (lazy import + route après `/kyc/:token`)

- [ ] **Step 1: Écrire la page** — `src/pages/public/KycReportRenderPage.tsx` :

```tsx
// MEGGA — Rendu public tokenisé du rapport KYC (pour Cloudflare Browser Rendering).
// Aucune session : les données viennent de l'edge kyc-report-data (token HMAC).
// Pose #pdf-ready quand données + fontes sont prêtes → le headless capture alors.
// Réutilise le MÊME template que le CRM (buildPdfReportData + PdfPage1/2/3) → DRY.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { buildPdfReportData, type BuildReportInput } from '@/components/kyc-report/buildReportData'
import { PdfPage1 } from '@/components/kyc-report/PdfPage1'
import { PdfPage2 } from '@/components/kyc-report/PdfPage2'
import { PdfPage3 } from '@/components/kyc-report/PdfPage3'
import { PDF } from '@/components/kyc-report/tokens'

export default function KycReportRenderPage() {
  const { token } = useParams<{ token: string }>()
  const [input, setInput] = useState<BuildReportInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) { setError('missing token'); return }
      const { data, error: invErr } = await supabase.functions.invoke('kyc-report-data', { body: { token } })
      if (cancelled) return
      if (invErr || !data?.ok) { setError(invErr?.message ?? data?.error ?? 'load failed'); return }
      setInput(data.report as BuildReportInput)
    })()
    return () => { cancelled = true }
  }, [token])

  const reportData = useMemo(() => (input ? buildPdfReportData(input) : null), [input])

  // Sentinelle : attendre le rendu + les fontes (Manrope) avant de signaler "prêt".
  useEffect(() => {
    if (!reportData) return
    let cancelled = false
    const fontsReady = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready
      ?? Promise.resolve()
    Promise.resolve(fontsReady).then(() => {
      if (!cancelled) requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    })
    return () => { cancelled = true }
  }, [reportData])

  if (error) {
    // Sentinelle d'erreur distincte → le headless échoue proprement (pas de PDF blanc).
    return <div id="pdf-error" style={{ fontFamily: 'system-ui', padding: 24 }}>Rapport indisponible.</div>
  }
  if (!reportData) {
    return <div style={{ fontFamily: 'system-ui', padding: 24, color: PDF.muted }}>Préparation du rapport…</div>
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
      />
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pdf-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .pdf-page:last-child { break-after: auto; page-break-after: auto; }
        }
        body { background: #FFFFFF; }
      `}</style>

      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: '#FFFFFF', fontFamily: 'Manrope, system-ui, sans-serif',
        }}
      >
        <PdfPage1 data={reportData} />
        <PdfPage2 data={reportData} />
        <PdfPage3 data={reportData} />
      </div>

      {/* Signal pour Cloudflare Browser Rendering (waitForSelector: '#pdf-ready') */}
      {ready && <div id="pdf-ready" aria-hidden style={{ position: 'fixed', width: 1, height: 1, opacity: 0 }} />}
    </>
  )
}
```

- [ ] **Step 2: Enregistrer la route** dans `src/App.tsx`.

Ajouter le lazy import près des autres pages publiques (vers la ligne 35, à côté de `KycPublicPage`) :

```tsx
const KycReportRenderPage = lazy(() => import('@/pages/public/KycReportRenderPage'))
```

Ajouter la route **publique** juste après la ligne 345 (`<Route path="/kyc/:token" .../>`) :

```tsx
              <Route path="/kyc-report/:token" element={<KycReportRenderPage />} />
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK (tsc + vite), aucune erreur de type. `BuildReportInput` est bien exporté par `buildReportData.ts` (vérifié : `export interface BuildReportInput`).

- [ ] **Step 4: Vérif visuelle (preview)**

Démarrer le dev server, ouvrir `/kyc-report/<token>` avec un token valide (en mint un en local via `signMagicLinkToken({ id: <dossierId>, exp: now+300, p: <profileId> })`, ou tester d'abord l'edge `kyc-report-data` en staging puis copier le token). Vérifier : 3 pages rendues, fontes Manrope, `#pdf-ready` présent dans le DOM après ~1 s. (Le rendu PDF complet via CF se valide en Task 7.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/public/KycReportRenderPage.tsx src/App.tsx
git commit -m "feat(kyc-report): route publique /kyc-report/:token (rendu PDF tokenisé)"
```

---

## Task 7: Edge `kyc-report-pdf` — orchestrateur (CF render → média Meta → envoi)

Appelée service-à-service par `whatsapp-agent` (pattern `kyc-screening`). Mint le token, appelle CF `/pdf`, uploade en média Meta, envoie le document à l'agent, audite. Aucune écriture sur le dossier.

**Files:**
- Create: `supabase/functions/kyc-report-pdf/index.ts`

- [ ] **Step 1: Écrire l'edge** — `kyc-report-pdf/index.ts` :

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signMagicLinkToken } from '../_shared/magic-link-token.ts'
import { buildCfPdfRequestBody, parseBasicAuthPair } from '../_shared/cf-browser-render.ts'
import { uploadMetaMediaDocument } from '../_shared/whatsapp-media.ts'
import { getProvider } from '../_shared/whatsapp-gateway.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comparaison à temps constant (anti timing-attack) — identique kyc-screening.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Référence "KYC-2026-AB3F" depuis l'UUID + created_at (miroir buildReportData). */
function buildReference(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear()
  const tail = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `KYC-${year}-${tail}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // Auth service-à-service uniquement (appelée par whatsapp-agent).
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!serviceKey || !safeEqual(providedKey, serviceKey)) return json({ error: 'forbidden' }, 403)

    const { kyc_case_id, agency_id, profile_id, to_phone } = (await req.json()) as {
      kyc_case_id?: string; agency_id?: string; profile_id?: string; to_phone?: string
    }
    if (!kyc_case_id || !agency_id || !to_phone) return json({ error: 'kyc_case_id, agency_id, to_phone required' }, 400)
    const toPhone = to_phone.replace(/\D/g, '')
    if (!toPhone) return json({ error: 'invalid to_phone' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    // Garde cross-agency (défense en profondeur) + created_at pour la référence.
    const { data: kc, error: kcErr } = await supabase
      .from('kyc_cases').select('id, agency_id, created_at').eq('id', kyc_case_id).single<{
        id: string; agency_id: string; created_at: string
      }>()
    if (kcErr || !kc) return json({ error: 'kyc_case not found' }, 404)
    if (kc.agency_id !== agency_id) return json({ error: 'forbidden: cross-agency' }, 403)

    const reference = buildReference(kc.id, kc.created_at)

    // 1. Mint token court (5 min), avec p = profile demandeur.
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: kyc_case_id, exp, p: profile_id })

    // 2. Cloudflare Browser Rendering /pdf (REST API, pas de Worker).
    const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''
    const cfToken = Deno.env.get('CLOUDFLARE_BROWSER_RENDER_TOKEN') ?? ''
    const appUrl = Deno.env.get('MEGGA_APP_URL') ?? 'https://megga.ch'
    const { user, pass } = parseBasicAuthPair(Deno.env.get('MEGGA_PREVIEW_BASIC_AUTH'))
    if (!cfAccount || !cfToken) return json({ error: 'CLOUDFLARE_* secrets missing' }, 500)

    const renderUrl = `${appUrl}/kyc-report/${token}`
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/browser-rendering/pdf`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCfPdfRequestBody({ url: renderUrl, basicUser: user, basicPass: pass })),
        signal: AbortSignal.timeout(55000),
      },
    )
    if (!cfRes.ok) {
      const errTxt = await cfRes.text().catch(() => '')
      return json({ error: `cloudflare pdf HTTP ${cfRes.status}`, detail: errTxt.slice(0, 300) }, 502)
    }
    const pdfBytes = new Uint8Array(await cfRes.arrayBuffer())
    if (pdfBytes.byteLength < 1000) return json({ error: 'pdf empty/too small' }, 502) // garde anti-PDF blanc

    // 3. Upload média Meta (éphémère) + 4. envoi document à l'agent.
    const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
    const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
    const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
    if (!metaToken || !metaPhoneNumberId) return json({ error: 'META_* secrets missing' }, 500)

    const filename = `Rapport-KYC-${reference}.pdf`
    const mediaId = await uploadMetaMediaDocument(pdfBytes, 'application/pdf', filename, {
      metaToken, metaPhoneNumberId, apiVersion,
    })

    const provider = getProvider('meta')
    const sreq = provider.buildSendDocumentRequest!(
      { toPhone, mediaId, filename, caption: reference },
      { metaToken, metaPhoneNumberId, metaApiVersion: apiVersion },
    )
    const sendRes = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body })
    const sendParsed = provider.parseSendResult(sendRes.status, await sendRes.json().catch(() => ({})))
    if (!sendParsed.ok) return json({ error: `meta send HTTP ${sendRes.status}: ${sendParsed.error ?? ''}` }, 502)

    // 5. Audit (actor IA, lecture seule du dossier — règle d'or intacte).
    await supabase.from('activity_events').insert({
      agency_id,
      actor_id: null,
      actor_kind: 'ai',
      action: 'kyc_report_sent',
      entity_type: 'kyc',
      entity_id: kyc_case_id,
      metadata: { reference, channel: 'whatsapp', profile_id: profile_id ?? null },
    })

    return json({ ok: true, reference })
  } catch (err) {
    const name = (err as Error)?.name
    if (name === 'TimeoutError' || name === 'AbortError') return json({ error: 'render timeout' }, 504)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
```

- [ ] **Step 2: Vérifier le build app (les imports partagés compilent)**

Run: `npm run build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/kyc-report-pdf/index.ts
git commit -m "feat(kyc-report): edge kyc-report-pdf (CF render -> média Meta -> envoi document, audit)"
```

> Vérification end-to-end (CF + Meta réels) : impossible en unit/CI (coût + sandbox Meta). Validée **manuellement en staging** à la Task 10 (envoi d'un vrai rapport à un numéro de test).

---

## Task 8: Executor `execSendKycReport` + `ActionCtx.agentPhone`

L'exécuteur (tier `auto`) résout le contact, trouve le dossier, et appelle l'edge `kyc-report-pdf` service-à-service (comme `execRunKycScreening` appelle `kyc-screening`).

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts` (`ActionCtx` + nouvel exécuteur après `execRunKycScreening`, ~ligne 626)

- [ ] **Step 1: Ajouter `agentPhone` à `ActionCtx`** (lignes 24-30) :

```ts
export interface ActionCtx {
  supabase: SupabaseClient
  profileId: string
  agencyId: string | null
  inboundMedia?: { mediaId: string; messageId: string } | null
  lang?: WaLang
  agentPhone?: string  // numéro WhatsApp de l'agent (pour lui renvoyer un document)
}
```

- [ ] **Step 2: Ajouter l'exécuteur** après `execRunKycScreening` (après la ligne 626) :

```ts
// -- KYC par WhatsApp : send_kyc_report (tier auto) ---------------------------
// Génère le PDF officiel du dossier (via l'edge kyc-report-pdf : CF Browser
// Rendering du template CRM) et l'envoie en DOCUMENT à l'agent lui-même.
// Lecture seule du dossier (règle d'or). Générable à TOUT stade (décision Q6).

export async function execSendKycReport(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const toPhone = (ctx.agentPhone ?? '').replace(/\D/g, '')
  if (!toPhone) return "Erreur: je n'ai pas ton numéro WhatsApp pour t'envoyer le PDF."

  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans votre agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Tu veux que j'en ouvre un ?`

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kyc-report-pdf`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        kyc_case_id: kc.id,
        agency_id: ctx.agencyId,
        profile_id: ctx.profileId,
        to_phone: toPhone,
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    const n = (e as Error)?.name
    if (n === 'TimeoutError' || n === 'AbortError') {
      return 'La génération du rapport prend plus de temps que prévu — réessaie dans un instant.'
    }
    return "L'envoi du rapport a échoué (réseau). Réessaie dans un instant."
  }
  if (!res.ok) return `Je n'ai pas pu générer le rapport (code ${res.status}). Réessaie dans un instant.`
  return `Rapport KYC de ${name} envoyé en pièce jointe (PDF). Tu le reçois dans la conversation.`
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: OK (l'edge n'est pas dans le build Vite, mais ça garantit l'absence de régression).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git commit -m "feat(kyc-report): execSendKycReport + ActionCtx.agentPhone"
```

---

## Task 9: Câblage outil `send_kyc_report` (catalogue + tier + dispatch)

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-tools.ts` (catalogue)
- Modify: `supabase/functions/_shared/whatsapp-agent-router.ts` (tier)
- Modify: `supabase/functions/whatsapp-agent/index.ts` (`ctx.agentPhone` + dispatch)
- Test: `supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 1: Écrire le test de tier qui échoue** — ajouter à `whatsapp-agent-router.test.ts` :

```ts
import { toolTier } from './whatsapp-agent-router.ts'

describe('send_kyc_report tier', () => {
  it('est auto (rapport à soi-même, aucun contact client)', () => {
    expect(toolTier('send_kyc_report')).toBe('auto')
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: FAIL — `toolTier('send_kyc_report')` retourne `'confirm'` (fail-safe par défaut), pas `'auto'`.

- [ ] **Step 3: Ajouter le tier** dans `whatsapp-agent-router.ts`, après `run_kyc_screening: 'auto',` (ligne 41) :

```ts
  send_kyc_report: 'auto',
```

- [ ] **Step 4: Lancer → passe**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: PASS.

- [ ] **Step 5: Ajouter l'outil au catalogue** dans `whatsapp-tools.ts`, après l'entrée `attach_kyc_document` (avant le `]` de fermeture, ligne 271) :

```ts
  {
    type: 'function',
    function: {
      name: 'send_kyc_report',
      description: "Génère le rapport KYC officiel (PDF) d'un contact et l'envoie en pièce jointe à l'agent lui-même sur WhatsApp. Pour « envoie-moi le rapport KYC de Dubois », « le PDF KYC de Mme Vaucher ». Appelle directement l'outil. Il faut un dossier KYC déjà ouvert. contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: { contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' } },
        required: ['contact_id'],
      },
    },
  },
```

- [ ] **Step 6: Câbler dans `whatsapp-agent/index.ts`** — deux modifs.

(a) Importer l'exécuteur (ligne ~21, à côté de `execRunKycScreening, execAttachKycDocument`) :

```ts
  execRunKycScreening, execAttachKycDocument, execSendKycReport,
```

(b) Renseigner `agentPhone` à la création du `ctx` (ligne 81) :

```ts
  const ctx: ActionCtx = { supabase, profileId, agencyId: link.agency_id ?? null, inboundMedia: inboundMedia ?? null, lang, agentPhone: waNumber }
```

(c) Ajouter le case de dispatch dans `runTool` (après la ligne 213, `case 'attach_kyc_document'`) :

```ts
    case 'send_kyc_report': return execSendKycReport(ctx, args)
```

- [ ] **Step 7: Build + lint**

Run: `npm run build`
Expected: OK.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/whatsapp-tools.ts supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/whatsapp-agent/index.ts
git commit -m "feat(kyc-report): outil send_kyc_report (tier auto) + dispatch + agentPhone"
```

---

## Task 10: Backend spec live — `kyc-report-data` (token + scope agence)

Spec exécutée contre le Supabase réel en CI (cf. `megga/backend-tests-run-live-in-ci` : `skipIf` n'est PAS un skip en CI).

**Files:**
- Create: `tests/backend/kyc-report-data.spec.ts`

- [ ] **Step 1: Écrire la spec** (s'aligner sur le pattern des specs existantes de `tests/backend/` — client service-role + seed/cleanup). Squelette :

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { signMagicLinkToken } from '../../supabase/functions/_shared/magic-link-token'

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const HMAC = process.env.MEGGA_MAGIC_LINK_HMAC_SECRET
const run = URL && SERVICE && HMAC

// signMagicLinkToken lit Deno.env — shim pour Node/CI.
;(globalThis as unknown as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno ??= {
  env: { get: (k: string) => process.env[k] },
}

describe.skipIf(!run)('kyc-report-data edge (live)', () => {
  const supabase = createClient(URL!, SERVICE!)
  let agencyA = '', agencyB = '', dossier = '', fnUrl = ''

  beforeAll(async () => {
    fnUrl = `${URL}/functions/v1/kyc-report-data`
    // Seed minimal : 2 agences + 1 contact + 1 kyc_case dans l'agence A.
    // (réutiliser les helpers de seed des specs backend existantes si présents)
    // ... insert agencies A/B, un contact, un kyc_case 'dossier' (agency A) ...
  })
  afterAll(async () => { /* cleanup des rows seedées */ })

  it('token valide → renvoie le rapport scopé sur la bonne agence', async () => {
    const token = await signMagicLinkToken({ id: dossier, exp: Math.floor(Date.now() / 1000) + 300 })
    const res = await fetch(fnUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
    expect(j.report.dossier.agency_id).toBe(agencyA)
    expect(Array.isArray(j.report.documents)).toBe(true)
  })

  it('token expiré → 401', async () => {
    const token = await signMagicLinkToken({ id: dossier, exp: Math.floor(Date.now() / 1000) - 10 })
    const res = await fetch(fnUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    expect(res.status).toBe(401)
  })

  it('token signé pour un dossier inexistant → 404', async () => {
    const token = await signMagicLinkToken({ id: '00000000-0000-0000-0000-000000000000', exp: Math.floor(Date.now() / 1000) + 300 })
    const res = await fetch(fnUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    expect(res.status).toBe(404)
  })

  it('token bidon (mauvaise signature) → 401', async () => {
    const res = await fetch(fnUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'aaa.bbb' }),
    })
    expect(res.status).toBe(401)
  })
})
```

> Adapter le seed/cleanup au pattern réel de `tests/backend/` (lire une spec voisine, ex. `kyc-wa-uploads-rls.spec.ts`, pour les helpers d'insertion et les colonnes obligatoires de `kyc_cases`/`contacts`/`agencies`). L'edge dérive l'agence du dossier → ce test prouve l'absence de fuite cross-agency (un token ne porte jamais d'agency_id falsifiable).

- [ ] **Step 2: Lancer en local si stack Supabase dispo, sinon laisser tourner en CI**

Run (si secrets présents) : `npx vitest run tests/backend/kyc-report-data.spec.ts`
Expected: 4 tests PASS (ou skipped proprement sans secrets en local — mais ils DOIVENT passer en CI).

- [ ] **Step 3: Commit**

```bash
git add tests/backend/kyc-report-data.spec.ts
git commit -m "test(kyc-report): backend spec live kyc-report-data (token, expiry, cross-agency)"
```

---

## Task 11: Finalisation — build, vérif staging, cerveau, docs

- [ ] **Step 1: Build complet + lint**

Run: `npm run build && npm run lint`
Expected: build OK (tsc -b + vite), lint sans erreur (warnings tolérés).

- [ ] **Step 2: Lancer toute la suite unit**

Run: `npx vitest run supabase/functions/_shared/ src/` (ou la commande de test du repo)
Expected: tous verts (token, gateway, media, cf-browser-render, router).

- [ ] **Step 3: Vérification end-to-end en staging (manuelle — irremplaçable)**

Après merge/déploiement des edges + Task 0 (secrets) :
1. Depuis le WhatsApp d'un agent appairé : « envoie-moi le rapport KYC de <contact avec dossier ouvert> ».
2. Vérifier : un **document PDF** arrive (`Rapport-KYC-2026-XXXX.pdf`), 3 pages A4, fontes Manrope, identique au CRM.
3. Vérifier l'audit : `select action, metadata from activity_events where action='kyc_report_sent' order by created_at desc limit 1;` → `actor_kind='ai'`, `actor_id` NULL.
4. Vérifier la règle d'or : `dossier_status` et `is_completed` **inchangés**.
5. Coût CF : Dashboard → Compute → Browser Run → 1 rendu enregistré, bien dans le tier gratuit.

- [ ] **Step 4: Mettre le cerveau à jour** (exigé : « garde le cerveau dans la boucle »)

Éditer `.claude-flow/knowledge/megga-memory.seed.json`, nœud `megga/kyc-report-pdf-whatsapp` : passer de « SPEC PRÊTE » à **« LIVRÉ »**, consigner :
- Les 6 décisions (tableau ci-dessus).
- La **correction d'infra** : Option A = **API REST Browser Rendering depuis edge** (pas de Worker ; app sur Pages) ; Basic Auth `ai/ai` traversé via `authenticate`.
- Les composants livrés : edges `kyc-report-data` / `kyc-report-pdf`, route `/kyc-report/:token`, `buildSendDocumentRequest`, `uploadMetaMediaDocument`, `cf-browser-render.ts`, `execSendKycReport`, tier `auto`.
- Secrets ajoutés : `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_BROWSER_RENDER_TOKEN`, `MEGGA_APP_URL`, `MEGGA_PREVIEW_BASIC_AUTH`.
- Aucune migration (pas d'archivage). Règle d'or intacte.

Puis : `npm run ruflo:seed` (réindexe la mémoire sémantique). Mettre à jour `docs/system-map.md` (section KYC/WhatsApp) si la cartographie l'exige, et ajouter une ligne au `docs/CHANGELOG.md`.

- [ ] **Step 5: Commit + PR**

```bash
git add .claude-flow/knowledge/megga-memory.seed.json docs/system-map.md docs/CHANGELOG.md
git commit -m "docs(kyc-report): cerveau + changelog — rapport KYC PDF par WhatsApp livré"
```

Ouvrir la PR vers `main` (le déploiement edges + migrations passe par la CI au merge ; Task 0 secrets doit être fait AVANT que l'outil soit utilisé en prod).

---

## Self-Review (vérifié contre la spec)

**Couverture spec :**
- ✅ Composant 1 (route tokenisée + edge data) → Task 5 + 6. Token `{id,exp,p}` HMAC réutilisé (Task 1), agence dérivée server-side.
- ✅ Composant 2 (rendu headless A4) → Task 7 via **REST API** (correction Q4 ; remplace le Worker). `cf-browser-render.ts` (Task 4).
- ✅ Composant 3 (`buildSendDocumentRequest` + hébergement média) → Task 2 + 3 (upload média Meta éphémère, pas de stockage durable).
- ✅ Composant 4 (outil `send_kyc_report`) → Task 8 + 9, tier `auto`, réutilise `findOpenKycCase` + auth service-à-service.
- ✅ Sécurité : token court scopé, document QU'À l'agent (`ctx.agentPhone`), audit `kyc_report_sent`, règle d'or (aucune écriture `verified`/`is_completed`).
- ✅ Contenu identique CRM, sans IA (même `buildPdfReportData`, template intact — Q5).
- ✅ Tests : token, gateway, media, cf-body (unit) ; kyc-report-data (backend live) ; e2e manuel staging.
- ✅ Décisions Q1-Q6 toutes reflétées. Pas de migration (Q2). Tout stade (Q6).

**Cohérence des types/noms :** `BuildReportInput` (exporté par buildReportData.ts) consommé par la route ; `OutboundDocumentMessage`/`buildSendDocumentRequest` cohérents Task 2↔7 ; `uploadMetaMediaDocument`/`parseMetaMediaUploadResult` cohérents Task 3↔7 ; `buildCfPdfRequestBody`/`parseBasicAuthPair` cohérents Task 4↔7 ; `execSendKycReport`/`ActionCtx.agentPhone`/`send_kyc_report` cohérents Task 8↔9 ; token `{id,exp,p}` cohérent Task 1↔5↔7.

**Risques connus (documentés, pas des placeholders) :**
- Le rendu dépend du Basic Auth `ai/ai` : si les creds changent, mettre à jour `MEGGA_PREVIEW_BASIC_AUTH`.
- `waitForSelector` forme objet `{selector,timeout}` : si l'API CF la rejette, retomber sur `gotoOptions.waitUntil:'networkidle0'` seul + `waitForTimeout` (les deux sont dans le corps, ajuster `cf-browser-render.ts`).
- Fontes Manrope chargées via Google Fonts dans la route ; `document.fonts.ready` gate la sentinelle pour éviter un PDF aux fontes système.
