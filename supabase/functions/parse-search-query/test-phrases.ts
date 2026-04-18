// Local harness to measure DeepSeek V3 parse quality on 20 representative
// Swiss real-estate phrases across FR/DE/EN/IT.
//
// Run from the worktree root:
//   deno run --allow-net --allow-env \
//     supabase/functions/parse-search-query/test-phrases.ts
//
// Requires DEEPSEEK_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
// Exit code 0 if ≥ 90% pass (go), 1 otherwise (no-go).

import { callPublicAI } from '../_shared/ai-provider.ts'

// Import the prompt + validator from the edge function by duplicating them
// here. Edge functions aren't importable as modules across deploys; easier
// to keep this harness standalone.

const CANTONS = ['GE','VD','VS','NE','FR','JU','BE','BS','BL','AG','SO','ZH','LU','ZG','SZ','NW','OW','UR','GL','SH','TG','AR','AI','SG','GR','TI']
const TYPES = ['apartment','house','villa','commercial','office','parking','storage','land','loft','attic','studio']
const FEATURES = ['balcony','pool','view','garage','parking','elevator','furnished','pets_allowed','fireplace','new_building','minergie']

function buildSystemPrompt(lang: string, context: 'buy'|'rent'): string {
  return `You are a real estate search filter extractor for Switzerland. Parse the user's natural-language query into a strict JSON object.

Context: the user is searching to ${context === 'rent' ? 'RENT (monthly rent in CHF)' : 'BUY (total price in CHF)'}.
User language: ${lang}.

Output a single JSON object matching this exact schema:
{
  "canton": string | null,
  "city": string | null,
  "types": string[] | null,
  "minPrice": number | null,
  "maxPrice": number | null,
  "minRooms": number | null,
  "maxRooms": number | null,
  "minSurface": number | null,
  "maxSurface": number | null,
  "features": string[] | null,
  "confidence": "high" | "medium" | "low"
}

Valid cantons: ${CANTONS.join(', ')}.
Valid types: ${TYPES.join(', ')}.
Valid features: ${FEATURES.join(', ')}.

Strict rules:
- Output ONLY the JSON object, no prose, no markdown.
- Unknown fields MUST be null.
- "K" = 1000 CHF, "M" = 1M CHF.
- "pets" / "animaux" / "Haustiere" / "chien" → features "pets_allowed".
- "vue lac" / "lake view" / "Seesicht" → features "view".
- "meublé" / "furnished" / "möbliert" → features "furnished".`
}

function safeParseJson(text: string): unknown {
  const stripped = text.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```\s*$/i,'').trim()
  try { return JSON.parse(stripped) } catch { /* fall through to brace extraction */ }
  const first = stripped.indexOf('{'); const last = stripped.lastIndexOf('}')
  if (first === -1 || last <= first) return null
  try { return JSON.parse(stripped.slice(first, last + 1)) } catch { return null }
}

// ── Test phrases ─────────────────────────────────────────────────────────
// Each case asserts a subset of expected fields. Missing fields = no check.

interface TestCase {
  query: string
  lang: 'fr'|'de'|'en'|'it'
  context: 'buy'|'rent'
  expect: {
    canton?: string
    types?: string[]
    minPrice?: number
    maxPrice?: number
    minRooms?: number
    maxRooms?: number
    features?: string[]        // must include all these (superset OK)
    confidenceMin?: 'low'|'medium'|'high'
  }
}

const TESTS: TestCase[] = [
  // ── FR ──
  { query: '4 pièces balcon Genève sous 2\'500/mois', lang: 'fr', context: 'rent',
    expect: { canton: 'GE', minRooms: 4, maxPrice: 2500, features: ['balcony'], confidenceMin: 'high' } },
  { query: 'villa piscine vue lac max 3M', lang: 'fr', context: 'buy',
    expect: { types: ['villa'], maxPrice: 3000000, features: ['pool','view'], confidenceMin: 'high' } },
  { query: 'loft meublé Lausanne animaux OK', lang: 'fr', context: 'rent',
    expect: { types: ['loft'], features: ['furnished','pets_allowed'], confidenceMin: 'high' } },
  { query: 'studio proche Cornavin 1\'200 max', lang: 'fr', context: 'rent',
    expect: { types: ['studio'], maxPrice: 1200, confidenceMin: 'medium' } },
  { query: '5 pièces Morges entre 1.5M et 2M', lang: 'fr', context: 'buy',
    expect: { minRooms: 5, minPrice: 1500000, maxPrice: 2000000, confidenceMin: 'high' } },
  { query: 'appartement neuf Genève 4.5p garage', lang: 'fr', context: 'buy',
    expect: { canton: 'GE', types: ['apartment'], minRooms: 4.5, features: ['garage','new_building'], confidenceMin: 'high' } },

  // ── DE ──
  { query: '3 Zimmer Balkon Zürich bis 2500', lang: 'de', context: 'rent',
    expect: { canton: 'ZH', minRooms: 3, maxPrice: 2500, features: ['balcony'], confidenceMin: 'high' } },
  { query: 'möblierte Wohnung Basel Haustiere erlaubt', lang: 'de', context: 'rent',
    expect: { canton: 'BS', features: ['furnished','pets_allowed'], confidenceMin: 'high' } },
  { query: 'Villa mit Pool und Seesicht max 4 Millionen', lang: 'de', context: 'buy',
    expect: { types: ['villa'], maxPrice: 4000000, features: ['pool','view'], confidenceMin: 'high' } },
  { query: 'Studio nahe HB Zürich unter 1800', lang: 'de', context: 'rent',
    expect: { canton: 'ZH', types: ['studio'], maxPrice: 1800, confidenceMin: 'medium' } },

  // ── EN ──
  { query: '2 bedroom apartment Geneva under 2500', lang: 'en', context: 'rent',
    expect: { canton: 'GE', types: ['apartment'], maxPrice: 2500, confidenceMin: 'high' } },
  { query: 'villa with pool lake view max 3M', lang: 'en', context: 'buy',
    expect: { types: ['villa'], maxPrice: 3000000, features: ['pool','view'], confidenceMin: 'high' } },
  { query: 'furnished loft Lausanne pets ok', lang: 'en', context: 'rent',
    expect: { types: ['loft'], features: ['furnished','pets_allowed'], confidenceMin: 'high' } },
  { query: 'new building 4 rooms Zurich', lang: 'en', context: 'buy',
    expect: { canton: 'ZH', minRooms: 4, features: ['new_building'], confidenceMin: 'high' } },

  // ── IT ──
  { query: 'appartamento 3 locali Lugano max 2000', lang: 'it', context: 'rent',
    expect: { canton: 'TI', types: ['apartment'], minRooms: 3, maxPrice: 2000, confidenceMin: 'high' } },
  { query: 'villa piscina vista lago 3 milioni', lang: 'it', context: 'buy',
    expect: { types: ['villa'], maxPrice: 3000000, features: ['pool','view'], confidenceMin: 'medium' } },

  // ── Edge cases ──
  { query: 'truc sympa', lang: 'fr', context: 'rent',
    expect: { confidenceMin: 'low' } },
  { query: 'grand appart Carouge balcon', lang: 'fr', context: 'rent',
    expect: { canton: 'GE', features: ['balcony'], confidenceMin: 'medium' } },
  { query: 'parking Genève < 300', lang: 'fr', context: 'rent',
    expect: { canton: 'GE', types: ['parking'], maxPrice: 300, confidenceMin: 'high' } },
  { query: 'attique vue Alpes Valais', lang: 'fr', context: 'buy',
    expect: { canton: 'VS', types: ['attic'], features: ['view'], confidenceMin: 'high' } },
]

// ── Runner ───────────────────────────────────────────────────────────────

function confRank(c?: 'low'|'medium'|'high'): number {
  if (c === 'high') return 3; if (c === 'medium') return 2; if (c === 'low') return 1
  return 0
}

interface TestResult {
  query: string
  lang: string
  pass: boolean
  reasons: string[]
  parsed: Record<string, unknown> | null
  tokens: { in: number; out: number }
  cost: number
}

async function runOne(t: TestCase): Promise<TestResult> {
  const reasons: string[] = []
  let parsed: Record<string, unknown> | null = null
  let tokens = { in: 0, out: 0 }
  let cost = 0

  try {
    const resp = await callPublicAI(
      [{ role: 'user', content: t.query }],
      buildSystemPrompt(t.lang, t.context),
      { maxTokens: 300, temperature: 0 },
    )
    tokens = { in: resp.input_tokens, out: resp.output_tokens }
    cost = resp.estimated_cost_usd
    const raw = safeParseJson(resp.text)
    if (!raw || typeof raw !== 'object') {
      return { query: t.query, lang: t.lang, pass: false, reasons: ['invalid JSON'], parsed: null, tokens, cost }
    }
    parsed = raw as Record<string, unknown>
  } catch (err) {
    reasons.push(`API error: ${err instanceof Error ? err.message : String(err)}`)
    return { query: t.query, lang: t.lang, pass: false, reasons, parsed, tokens, cost }
  }

  const e = t.expect
  const p = parsed
  if (e.canton && p.canton !== e.canton) reasons.push(`canton: expected ${e.canton}, got ${p.canton}`)
  if (e.minPrice != null && p.minPrice !== e.minPrice) reasons.push(`minPrice: expected ${e.minPrice}, got ${p.minPrice}`)
  if (e.maxPrice != null && p.maxPrice !== e.maxPrice) reasons.push(`maxPrice: expected ${e.maxPrice}, got ${p.maxPrice}`)
  if (e.minRooms != null && p.minRooms !== e.minRooms) reasons.push(`minRooms: expected ${e.minRooms}, got ${p.minRooms}`)
  if (e.maxRooms != null && p.maxRooms !== e.maxRooms) reasons.push(`maxRooms: expected ${e.maxRooms}, got ${p.maxRooms}`)
  if (e.types) {
    const got = Array.isArray(p.types) ? p.types : []
    for (const v of e.types) if (!got.includes(v)) reasons.push(`types missing ${v} (got ${JSON.stringify(got)})`)
  }
  if (e.features) {
    const got = Array.isArray(p.features) ? p.features : []
    for (const v of e.features) if (!got.includes(v)) reasons.push(`features missing ${v} (got ${JSON.stringify(got)})`)
  }
  if (e.confidenceMin) {
    const got = p.confidence as 'low'|'medium'|'high'|undefined
    if (confRank(got) < confRank(e.confidenceMin)) reasons.push(`confidence: expected ≥ ${e.confidenceMin}, got ${got}`)
  }

  return { query: t.query, lang: t.lang, pass: reasons.length === 0, reasons, parsed, tokens, cost }
}

const results: TestResult[] = []
for (const t of TESTS) {
  const r = await runOne(t)
  results.push(r)
  const icon = r.pass ? '✅' : '❌'
  console.log(`${icon} [${r.lang}] ${r.query}`)
  if (!r.pass) {
    for (const reason of r.reasons) console.log(`   · ${reason}`)
    console.log(`   raw: ${JSON.stringify(r.parsed)}`)
  }
}

const passed = results.filter(r => r.pass).length
const total = results.length
const rate = (passed / total) * 100
const totalTokensIn = results.reduce((s, r) => s + r.tokens.in, 0)
const totalTokensOut = results.reduce((s, r) => s + r.tokens.out, 0)
const totalCost = results.reduce((s, r) => s + r.cost, 0)

console.log('\n─────────────────────────────────────────')
console.log(`Pass: ${passed}/${total} (${rate.toFixed(1)}%)`)
console.log(`Avg tokens: ${(totalTokensIn/total).toFixed(0)} in / ${(totalTokensOut/total).toFixed(0)} out`)
console.log(`Total cost: $${totalCost.toFixed(5)} (avg $${(totalCost/total).toFixed(6)}/req)`)
console.log('─────────────────────────────────────────')

Deno.exit(rate >= 90 ? 0 : 1)
