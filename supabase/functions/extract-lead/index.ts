// supabase/functions/extract-lead/index.ts
// Sprint 3 — Extraction de lead depuis un message libre (email/SMS/WhatsApp).
//
// Pipeline :
//   1. Auth JWT côté caller (agent CRM uniquement)
//   2. Validation entrée (longueur, non-vide)
//   3. PII redaction côté serveur (jamais envoyer AVS/IBAN/password à l'IA)
//   4. Appel DeepSeek avec prompt strict JSON
//   5. Parse + double-pass verbatim : email/phone doivent apparaître dans
//      le texte source (sinon hallucination → null)
//   6. Log AuditEvent dans activity_events (actor_kind='ai')
//   7. Retour JSON au front
//
// Le rawText reçu n'est PAS stocké côté Edge Function — c'est au caller
// (côté front via useImportLead) de le persister sur le Contact créé,
// dans une colonne avec rétention 90j (cf. red-team A2).
//
// Spec : RED_TEAM_SPRINT_3.md §A.A1, §A.A4, §G.G6.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callDeepSeek } from '../_shared/ai-provider.ts'
import { redactPII, formatRedactionSummary } from '../_shared/pii-redaction.ts'

// CORS — restreint aux origines MEGGA (audit Sprint 3a §A.4).
// La logique : on inspecte l'Origin du request et on autorise uniquement
// les domaines MEGGA + previews Cloudflare Pages + dev local. Pour les
// autres, on retombe sur la valeur par défaut "null" qui bloque le browser.
const ALLOWED_ORIGINS = [
  /^https:\/\/megga\.ch$/,
  /^https:\/\/[a-z0-9-]+\.megga\.ch$/,
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/,  // Cloudflare Pages previews
  /^http:\/\/localhost:\d+$/,             // dev local
]

function buildCorsHeaders(originHeader: string | null): Record<string, string> {
  const allow = originHeader && ALLOWED_ORIGINS.some((re) => re.test(originHeader))
    ? originHeader
    : 'null'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Vary': 'Origin',
  }
}

// Limites — protègent le coût LLM et l'abus (red-team A5).
const MAX_TEXT_LENGTH = 8000  // ~2000 tokens en entrée. Tronqué silencieusement.
const MIN_TEXT_LENGTH = 10    // sous ce seuil, extraction sans valeur.

// Rate limits (audit Sprint 3a §A.5) — protègent contre l'abus / coût LLM.
//   - Par user : 50 extractions / heure (≈ 1 / minute, marge confortable
//     pour un agent qui travaille en continu)
//   - Par agence : 200 extractions / heure (agglomère plusieurs agents)
//   - Comptés sur activity_events où actor_kind='ai' et l'auteur déclencheur
//     match (cf. logExtraction.metadata.triggered_by_user_id).
// Au-delà → 429 + audit severity='critical' (alerte super_admin).
const RATE_LIMIT_PER_USER_HOUR   = 50
const RATE_LIMIT_PER_AGENCY_HOUR = 200

interface ExtractRequest {
  text: string
}

type Intent = 'buyer' | 'seller' | 'tenant'
type Urgency = 'high' | 'medium' | 'normal'
type NextAction = 'call' | 'visit' | 'match' | 'kyc'

interface ExtractedFields {
  firstName: string
  lastName: string
  email: string
  phone: string
  intent: Intent
  budget: number | null
  rooms: number | null
  zone: string
  urgency: Urgency
  nextAction: NextAction
  confidence: number  // 0-1, jamais affiché en UI, log audit uniquement
}

interface ExtractResponse {
  extracted: ExtractedFields
  redactionSummary: string  // ex. "AVS×1, PASSWORD×1" — affiché côté UI
  redactionCount: number
  truncated: boolean
}

const SYSTEM_PROMPT = `Tu reçois un message brut (email, SMS, formulaire web, transcription WhatsApp).
Extrais les champs suivants au format JSON strict (uniquement du JSON, aucun texte avant ou après).
Si un champ est absent du message, renvoie une chaîne vide "" ou null.

Schéma exact attendu :
{
  "firstName": string,
  "lastName": string,
  "email": string,           // adresse email valide OU "" si absente
  "phone": string,           // numéro tel quel (avec espaces/préfixe) OU "" si absent
  "intent": "buyer" | "seller" | "tenant",
  "budget": number | null,   // CHF entier (loyer mensuel si tenant)
  "rooms": number | null,    // ex. 4, 3.5, 2.5
  "zone": string,            // quartier ou ville mentionnés
  "urgency": "high" | "medium" | "normal",
  "nextAction": "call" | "visit" | "match" | "kyc",
  "confidence": number       // 0.0 à 1.0 — TON estimation de la qualité d'extraction
}

RÈGLES :
- intent : 'buyer' si l'auteur cherche à ACHETER ; 'seller' si "vendre / mandat / mon appartement / ma maison" ; 'tenant' si "louer / loyer / charges comprises".
- urgency : 'high' si "rapidement / urgent / cette semaine / asap / fin du mois" ; 'medium' si "dans X mois / au printemps / cet été" ; 'normal' sinon.
- nextAction : 'visit' si urgency=high et intent=buyer ; 'call' si intent=seller ou premier contact ; 'match' si critères clairs (budget+pièces+zone) ; 'kyc' si offre/signature/compromis mentionnés.
- confidence : sois honnête. Court message ambigu = 0.3-0.5. Email détaillé avec nom complet, email valide, budget précis = 0.85-1.0.

AUCUNE INVENTION : si une info n'est pas dans le texte, laisse vide/null. Tu ne devines pas un email plausible.
Si le texte contient des marqueurs [REDACTED:XXX], traite-les comme des trous neutres — ne tente PAS de reconstruire la donnée.`

/**
 * Double-pass : vérifie qu'un email/phone extrait apparaît bien dans le
 * texte source (case-insensitive, espaces normalisés). Sinon → "" (anti-
 * hallucination, red-team A4).
 */
function verifyVerbatim(extractedValue: string, sourceText: string): string {
  if (!extractedValue) return ''
  const v = extractedValue.toLowerCase().replace(/\s+/g, '')
  const s = sourceText.toLowerCase().replace(/\s+/g, '')
  return s.includes(v) ? extractedValue : ''
}

interface ParseResult {
  fields: ExtractedFields
  /** Audit Sprint 3a §C.3 — valeurs LLM rejetées par le narrowing
   * (ex. intent='investor' coercé en 'buyer'). Loggé en audit pour
   * traçabilité des divergences modèle ↔ contract. */
  coercions: Array<{ field: string; rawValue: unknown; coercedTo: string }>
}

function parseAndValidate(rawJson: string, sourceText: string): ParseResult | null {
  // Strip d'éventuels code fences ```json ... ``` que le modèle ajoute parfois.
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  const coercions: ParseResult['coercions'] = []

  // Intent — narrow + audit coercion (§C.3)
  let intent: Intent
  if (parsed.intent === 'seller' || parsed.intent === 'tenant' || parsed.intent === 'buyer') {
    intent = parsed.intent
  } else {
    if (parsed.intent !== undefined && parsed.intent !== '') {
      coercions.push({ field: 'intent', rawValue: parsed.intent, coercedTo: 'buyer' })
    }
    intent = 'buyer'
  }

  // Urgency — narrow + audit coercion (§C.3)
  let urgency: Urgency
  if (parsed.urgency === 'high' || parsed.urgency === 'medium' || parsed.urgency === 'normal') {
    urgency = parsed.urgency
  } else {
    if (parsed.urgency !== undefined && parsed.urgency !== '') {
      coercions.push({ field: 'urgency', rawValue: parsed.urgency, coercedTo: 'normal' })
    }
    urgency = 'normal'
  }

  // NextAction — narrow + audit coercion (§C.3)
  const validActions: NextAction[] = ['call', 'visit', 'match', 'kyc']
  let nextAction: NextAction
  if (validActions.includes(parsed.nextAction as NextAction)) {
    nextAction = parsed.nextAction as NextAction
  } else {
    if (parsed.nextAction !== undefined && parsed.nextAction !== '') {
      coercions.push({ field: 'nextAction', rawValue: parsed.nextAction, coercedTo: 'call' })
    }
    nextAction = 'call'
  }

  const fields: ExtractedFields = {
    firstName: typeof parsed.firstName === 'string' ? parsed.firstName.trim() : '',
    lastName:  typeof parsed.lastName === 'string'  ? parsed.lastName.trim()  : '',
    // Double-pass verbatim (A4)
    email: verifyVerbatim(typeof parsed.email === 'string' ? parsed.email.trim() : '', sourceText),
    phone: verifyVerbatim(typeof parsed.phone === 'string' ? parsed.phone.trim() : '', sourceText),
    intent,
    budget: typeof parsed.budget === 'number' && parsed.budget > 0 ? Math.round(parsed.budget) : null,
    rooms:  typeof parsed.rooms === 'number' && parsed.rooms > 0  ? parsed.rooms : null,
    zone:   typeof parsed.zone === 'string' ? parsed.zone.trim() : '',
    urgency,
    nextAction,
    confidence: typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5,
  }

  return { fields, coercions }
}

function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Récupère l'agency_id et user_id de l'agent appelant via le JWT.
 * Permet de scope l'audit et d'imposer une auth (refus si pas de JWT valide).
 */
async function authContext(authHeader: string | null): Promise<{
  userId: string
  agencyId: string | null
} | null> {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const { data: profile } = await client
    .from('profiles')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  return { userId: user.id, agencyId: profile?.agency_id ?? null }
}

/**
 * Vérifie les rate limits user/agence sur la dernière heure.
 * Retourne null si OK, ou un objet `{ scope, count, limit }` si dépassé.
 *
 * Implémenté via deux COUNT sur activity_events filtrés par actor_kind='ai'
 * et action='Extraction lead exécutée'. La table a déjà un index
 * idx_activity_events_actor_kind (agency_id, actor_kind, created_at) cf.
 * migration G2 — les deux queries restent < 50 ms.
 */
async function checkRateLimit(
  userId: string,
  agencyId: string | null,
): Promise<{ scope: 'user' | 'agency'; count: number; limit: number } | null> {
  const admin = supabaseAdmin()
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString()

  // Per-user
  const { count: userCount, error: userErr } = await admin
    .from('activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('actor_kind', 'ai')
    .eq('action', 'Extraction lead exécutée')
    .eq('metadata->>triggered_by_user_id', userId)
    .gte('created_at', oneHourAgo)

  if (userErr) {
    // On loggue mais on ne bloque pas — un échec de rate-limit-check ne doit
    // pas casser le service. Le rate limit reste en best-effort.
    console.error('[extract-lead] rate limit (user) check failed:', userErr.message)
  } else if ((userCount ?? 0) >= RATE_LIMIT_PER_USER_HOUR) {
    return { scope: 'user', count: userCount ?? 0, limit: RATE_LIMIT_PER_USER_HOUR }
  }

  // Per-agency
  if (agencyId) {
    const { count: agencyCount, error: agencyErr } = await admin
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('actor_kind', 'ai')
      .eq('action', 'Extraction lead exécutée')
      .gte('created_at', oneHourAgo)

    if (agencyErr) {
      console.error('[extract-lead] rate limit (agency) check failed:', agencyErr.message)
    } else if ((agencyCount ?? 0) >= RATE_LIMIT_PER_AGENCY_HOUR) {
      return { scope: 'agency', count: agencyCount ?? 0, limit: RATE_LIMIT_PER_AGENCY_HOUR }
    }
  }

  return null
}

/**
 * Log d'audit vers activity_events. actor_kind='ai' (G2 migration).
 *
 * Awaité côté caller (audit §A.3) : la rétention 10 ans nLPD/LBA art. 7
 * impose qu'un event métier ne soit jamais "perdu silencieusement" par
 * un fire-and-forget. Le coût UX (~50ms d'attente sur l'insert) est
 * négligeable vs la valeur d'audit.
 */
async function logExtraction(params: {
  agencyId: string | null
  userId: string
  success: boolean
  redactionSummary: string
  confidence: number
  truncated: boolean
  inputTokens?: number
  outputTokens?: number
  error?: string
  /** Override de severity — 'critical' utilisé pour les rate limit (§A.5). */
  severity?: 'info' | 'warn' | 'critical'
  /** Coercions LLM → contract narrowing (§C.3). Loggué pour audit. */
  coercions?: Array<{ field: string; rawValue: unknown; coercedTo: string }>
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from('activity_events')
      .insert({
        agency_id: params.agencyId,
        actor_id: null,
        actor_kind: 'ai',
        action: 'Extraction lead exécutée',
        entity_type: 'contact',
        entity_id: null,
        category: 'ai',
        severity: params.severity ?? (params.success ? 'info' : 'warn'),
        object_label: 'Import Lead IA',
        metadata: {
          triggered_by_user_id: params.userId,
          redaction_summary: params.redactionSummary,
          confidence: params.confidence,
          truncated: params.truncated,
          input_tokens: params.inputTokens,
          output_tokens: params.outputTokens,
          error: params.error,
          coercions: params.coercions,
        },
      })
    if (error) {
      console.error('[extract-lead] audit insert failed:', error.message)
    }
  } catch (err) {
    console.error('[extract-lead] audit threw:', err)
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Auth — refus si pas de JWT
  const ctx = await authContext(req.headers.get('Authorization'))
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1bis. Rate limit (§A.5)
  const rateLimited = await checkRateLimit(ctx.userId, ctx.agencyId)
  if (rateLimited) {
    // Audit critique — alerte super_admin via le journal
    await logExtraction({
      agencyId: ctx.agencyId,
      userId: ctx.userId,
      success: false,
      redactionSummary: '',
      confidence: 0,
      truncated: false,
      error: `rate_limit_${rateLimited.scope}_${rateLimited.count}/${rateLimited.limit}`,
      severity: 'critical',
    })
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        scope: rateLimited.scope,
        retryAfterSeconds: 3600,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '3600',
        },
      },
    )
  }

  // 2. Parse + validation
  let body: ExtractRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rawText = (body?.text ?? '').toString()
  if (rawText.trim().length < MIN_TEXT_LENGTH) {
    return new Response(JSON.stringify({ error: 'text_too_short' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const truncated = rawText.length > MAX_TEXT_LENGTH
  const capped = truncated ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText

  // 3. PII redaction AVANT envoi LLM
  const { redactedText, counts, total } = redactPII(capped)
  const redactionSummary = formatRedactionSummary(counts)

  // 4. Appel DeepSeek
  let aiResponse
  try {
    aiResponse = await callDeepSeek(
      [{ role: 'user', content: redactedText }],
      SYSTEM_PROMPT,
      { maxTokens: 600, temperature: 0.0, timeoutMs: 30000, responseFormat: 'json_object', agencyId: ctx.agencyId ?? undefined, module: 'extract-lead' },
    )
  } catch (err) {
    await logExtraction({
      agencyId: ctx.agencyId,
      userId: ctx.userId,
      success: false,
      redactionSummary,
      confidence: 0,
      truncated,
      error: (err as Error).message,
    })
    return new Response(JSON.stringify({ error: 'llm_unavailable', detail: (err as Error).message }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 5. Parse + double-pass verbatim (sur redactedText pour cohérence)
  const parseResult = parseAndValidate(aiResponse.text, redactedText)
  if (!parseResult) {
    await logExtraction({
      agencyId: ctx.agencyId,
      userId: ctx.userId,
      success: false,
      redactionSummary,
      confidence: 0,
      truncated,
      inputTokens: aiResponse.input_tokens,
      outputTokens: aiResponse.output_tokens,
      error: 'parse_failed',
    })
    return new Response(JSON.stringify({ error: 'parse_failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { fields: extracted, coercions } = parseResult

  // 6. Audit succès — awaité (§A.3). Si des coercions ont eu lieu (§C.3),
  //    on remonte severity='warn' et metadata.coercions pour traçabilité.
  await logExtraction({
    agencyId: ctx.agencyId,
    userId: ctx.userId,
    success: true,
    redactionSummary,
    confidence: extracted.confidence,
    truncated,
    inputTokens: aiResponse.input_tokens,
    outputTokens: aiResponse.output_tokens,
    severity: coercions.length > 0 ? 'warn' : undefined,
    coercions: coercions.length > 0 ? coercions : undefined,
  })

  const response: ExtractResponse = {
    extracted,
    redactionSummary,
    redactionCount: total,
    truncated,
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
