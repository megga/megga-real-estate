// supabase/functions/parse-search-query/index.ts
//
// Smart input parser for the public marketplace (/acheter, /louer).
// Takes a free-form natural-language query and returns structured MarketFilters.
//
// Scope: STATELESS — no DB writes beyond the ai_usage_logs fire-and-forget
// logging handled inside callPublicAI(). The client is the source of truth
// for filter state.
//
// Provider: DeepSeek V3 via callPublicAI() (no Claude fallback — see decision
// 2026-04-17 in _shared/ai-provider.ts). If DeepSeek is down the client
// gracefully falls back to the existing city-lookup behaviour.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { callPublicAI } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Request / response contract ────────────────────────────────────────────

interface ParseRequest {
  query: string
  context: 'buy' | 'rent'
  lang?: 'fr' | 'de' | 'en' | 'it'
}

// The subset of MarketFilters the parser can populate. Keep in sync with
// src/hooks/useMarketListings.ts MarketFilters. `features` is new — it maps
// to market_listings boolean columns (has_balcony, has_swimming_pool, …)
// and will be wired into the RPC on Day 3 of the C sprint.
export interface ParsedFilters {
  canton?: string          // 2-letter code (GE, VD, VS, …)
  city?: string            // free text ("Genève", "Lausanne Ouchy")
  types?: string[]         // apartment, house, villa, loft, attic, commercial, …
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  minSurface?: number
  maxSurface?: number
  features?: string[]      // balcony, pool, view, garage, elevator, furnished, pets, fireplace, new_building, minergie, parking
  confidence: 'high' | 'medium' | 'low'
}

// Canton slug → 2-letter code. Romand cantons first (immobilier.ch audience).
const CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'JU', 'BE', 'BS', 'BL', 'AG', 'SO',
  'ZH', 'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR',
  'AI', 'SG', 'GR', 'TI',
]

const TYPES = [
  'apartment', 'house', 'villa', 'commercial', 'office',
  'parking', 'storage', 'land', 'loft', 'attic', 'studio',
]

// v1 features whitelist — each must map to a boolean column on
// market_listings (see get_market_map_points migration 20260418_001 and
// useMarketListings.ts applyFilters). `terrace` is deferred to v2 because
// the market_listings.features JSONB uses inconsistent FR slugs ("terrasse")
// with no dedicated column.
const FEATURES = [
  'balcony', 'pool', 'view',                      // exterior
  'garage', 'parking', 'elevator',                // convenience
  'furnished', 'pets_allowed',                    // living
  'fireplace', 'new_building', 'minergie',        // building
]

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(lang: string, context: 'buy' | 'rent'): string {
  return `You are a real estate search filter extractor for Switzerland. Parse the user's natural-language query into a strict JSON object.

Context: the user is searching to ${context === 'rent' ? 'RENT (monthly rent in CHF)' : 'BUY (total price in CHF)'}.
User language: ${lang}.

Output a single JSON object matching this exact schema:
{
  "canton": string | null,     // 2-letter Swiss canton code, one of: ${CANTONS.join(', ')}
  "city": string | null,       // free-form city/quartier name, capitalized (e.g. "Genève", "Lausanne Ouchy", "Carouge")
  "types": string[] | null,    // 0 or more of: ${TYPES.join(', ')}
  "minPrice": number | null,   // CHF, no separators
  "maxPrice": number | null,
  "minRooms": number | null,   // Swiss "pièces" (0.5 increments allowed, e.g. 4.5)
  "maxRooms": number | null,
  "minSurface": number | null, // square meters
  "maxSurface": number | null,
  "features": string[] | null, // 0 or more of: ${FEATURES.join(', ')}
  "confidence": "high" | "medium" | "low"
}

Strict rules:
- Output ONLY the JSON object, no prose, no markdown, no code fences.
- Unknown/absent fields MUST be null (not undefined, not omitted).
- "K" = thousand CHF, "M" or "mio" = million CHF. "< 2500" → maxPrice 2500.
- "3-4 pièces" → minRooms 3, maxRooms 4. "4p" or "4.5p" → minRooms set only.
- "grand" alone (no number) → minRooms 4 OR minSurface 100 (pick the more likely).
- Swiss city disambiguation: prefer romand cities (Geneva, Lausanne, etc.) unless clearly German.
- "animaux OK", "pets", "chien", "Haustiere erlaubt" → features includes "pets_allowed".
- "meublé", "furnished", "möbliert", "arredato" → features includes "furnished".
- "vue lac", "lake view", "Seesicht" → features includes "view".
- "proche CEVA", "near station", "< 15min Cornavin" → ignore for now (no geocoding).
- confidence "high" if ≥ 2 fields extracted unambiguously. "low" if input is vague or doesn't describe property search.

Examples:
Input: "4 pièces balcon Genève sous 2'500/mois"
Output: {"canton":"GE","city":"Genève","types":null,"minPrice":null,"maxPrice":2500,"minRooms":4,"maxRooms":null,"minSurface":null,"maxSurface":null,"features":["balcony"],"confidence":"high"}

Input: "villa piscine vue lac max 3M"
Output: {"canton":null,"city":null,"types":["villa"],"minPrice":null,"maxPrice":3000000,"minRooms":null,"maxRooms":null,"minSurface":null,"maxSurface":null,"features":["pool","view"],"confidence":"high"}

Input: "truc sympa"
Output: {"canton":null,"city":null,"types":null,"minPrice":null,"maxPrice":null,"minRooms":null,"maxRooms":null,"minSurface":null,"maxSurface":null,"features":null,"confidence":"low"}`
}

// ── Parsing & validation ───────────────────────────────────────────────────

function safeParseJson(text: string): unknown {
  // The model sometimes wraps JSON in ```json … ``` despite instructions.
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // Last-resort: find the first { … last } span.
    const first = stripped.indexOf('{')
    const last = stripped.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) return null
    try {
      return JSON.parse(stripped.slice(first, last + 1))
    } catch {
      return null
    }
  }
}

function validateFilters(raw: unknown): ParsedFilters | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const asString = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  const asNumber = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const asStringArray = (v: unknown, allowed: string[]): string[] | undefined => {
    if (!Array.isArray(v)) return undefined
    const out = v.filter((x): x is string => typeof x === 'string' && allowed.includes(x))
    return out.length > 0 ? out : undefined
  }

  const canton = asString(o.canton)
  const validCanton = canton && CANTONS.includes(canton.toUpperCase())
    ? canton.toUpperCase()
    : undefined

  const confidenceRaw = asString(o.confidence)
  const confidence: ParsedFilters['confidence'] =
    confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
      ? confidenceRaw
      : 'low'

  return {
    canton: validCanton,
    city: asString(o.city),
    types: asStringArray(o.types, TYPES),
    minPrice: asNumber(o.minPrice),
    maxPrice: asNumber(o.maxPrice),
    minRooms: asNumber(o.minRooms),
    maxRooms: asNumber(o.maxRooms),
    minSurface: asNumber(o.minSurface),
    maxSurface: asNumber(o.maxSurface),
    features: asStringArray(o.features, FEATURES),
    confidence,
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: ParseRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const context = body.context === 'buy' || body.context === 'rent' ? body.context : 'rent'
  const lang = ['fr', 'de', 'en', 'it'].includes(body.lang as string)
    ? (body.lang as 'fr' | 'de' | 'en' | 'it')
    : 'fr'

  if (!query) {
    return new Response(JSON.stringify({ error: 'query is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (query.length > 300) {
    return new Response(JSON.stringify({ error: 'query too long (max 300 chars)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const aiResp = await callPublicAI(
      [{ role: 'user', content: query }],
      buildSystemPrompt(lang, context),
      { maxTokens: 300, temperature: 0 },
    )

    const parsed = safeParseJson(aiResp.text)
    const filters = validateFilters(parsed)

    if (!filters) {
      return new Response(
        JSON.stringify({
          error: 'parse_failed',
          raw: aiResp.text.slice(0, 200),
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        filters,
        usage: {
          input_tokens: aiResp.input_tokens,
          output_tokens: aiResp.output_tokens,
          cost_usd: aiResp.estimated_cost_usd,
          provider: aiResp.provider,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: 'provider_error', detail: msg.slice(0, 200) }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
