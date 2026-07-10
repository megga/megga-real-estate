// supabase/functions/extract-property-url/index.ts
// Fetches a property listing URL and extracts structured data using DeepSeek (text).
// Authenticated agents only — uses AI credits per call.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { callDeepSeek } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 8s ceiling on the upstream portal fetch so a slowloris URL can't pin a worker.
const PORTAL_FETCH_TIMEOUT_MS = 8000

const EXTRACTION_PROMPT = `Tu es un expert immobilier suisse. Analyse cette page web d'annonce immobilière et extrais TOUTES les informations du bien.

Retourne un JSON strict avec ces champs (utilise null si l'info n'est pas trouvée) :

{
  "title": "string — titre de l'annonce",
  "description": "string — description complète du bien",
  "type": "apartment | house | villa | commercial | land",
  "transaction_type": "buy | rent — déduis depuis le contexte (Flatfox = location dans 95% des cas, RealAdvisor = vente, libellés 'à louer'/'à vendre', présence d'un loyer mensuel vs prix d'achat)",
  "price": number,
  "charges_monthly": number | null,
  "rooms": number,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "surface_m2": number,
  "floor": number | null,
  "total_floors": number | null,
  "year_built": number | null,
  "condition": "new | renovated | good | to_renovate | null",
  "address": "string — adresse complète (rue + numéro si disponible)",
  "city": "string — ville",
  "canton": "string — code canton 2 lettres (GE, VD, ZH...)",
  "postal_code": "string — NPA",
  "photos": ["string — URLs des photos du bien (les premières 10 max)"],
  "features": ["string — liste des caractéristiques"],
  "is_furnished": boolean | null,
  "deposit_months": number | null,
  "availability_date": "string | null — format ISO YYYY-MM-DD si mentionné",
  "external_regie": {
    "name": "string",
    "phone": "string",
    "email": "string",
    "website": "string | null"
  } | null,
  "source_url": "string — URL source",
  "source_portal": "string — nom du portail (Homegate, ImmoScout24, RealAdvisor, Comparis, Flatfox, Anibis, Petitesannonces, autre)",
  "reference_id": "string | null — numéro de référence de l'annonce",
  "confidence": number de 0 à 100
}

Règles :
- Prix en CHF, juste le nombre (pas d'apostrophes)
- Surface en m² (nombre seul)
- Déduis le canton depuis le NPA ou la ville si non mentionné explicitement
- Pour les photos, extrais les URLs complètes des images (pas les thumbnails, les full-size si possible)
- Normalise les features : "place de parc" → "parking", "balcon/loggia" → "balcon"
- Si le portail est identifiable (Homegate, ImmoScout24, etc.), indique-le dans source_portal
- transaction_type "rent" si la page mentionne loyer/CHF par mois/à louer ; "buy" si prix d'achat/à vendre/CHF total
- is_furnished : true si l'annonce mentionne explicitement "meublé"/"furnished"/"möbliert"
- deposit_months : nombre de mois de garantie/caution (1, 2 ou 3 — typique en Suisse), null si non précisé
- external_regie : à remplir UNIQUEMENT si une régie de gestion est clairement identifiée (nom + au moins phone OU email). Sinon null.
- Retourne UNIQUEMENT le JSON, pas de texte avant ou après`

// Per-agency monthly quotas — mirror virtual-staging / extract-property-pdf
// shape. URL extraction uses DeepSeek text (~CHF 0.001 per call), so
// worst-case Pro = CHF 1/month/agent.
const PLAN_QUOTAS: Record<string, number> = {
  starter: 5,
  pro: 100,
  entreprise: 500,
  agency: 500,
}

// Allowed domains for scraping
const ALLOWED_DOMAINS = [
  'homegate.ch',
  'immoscout24.ch',
  'realadvisor.ch',
  'comparis.ch',
  'immomig.ch',
  'acheter-louer.ch',
  'flatfox.ch',
  'newhome.ch',
  'propertybase.com',
  'casaone.ch',
  'anibis.ch',
  'petitesannonces.ch',
]

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only http(s); blocks file://, javascript:, data:, gopher:, etc.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    // Strict match: hostname === domain  OR  hostname ends with ".domain".
    // Closes the `attacker-flatfox.ch` suffix-match SSRF.
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { profile, supabase } = auth

    // ── Monthly quota check ────────────────────────────────────────────
    const { data: agency } = await supabase
      .from('agencies')
      .select('plan')
      .eq('id', profile.agency_id)
      .single()
    const plan = (agency?.plan as string) || 'starter'
    const quota = PLAN_QUOTAS[plan] ?? 0

    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const { count: usageCount } = await supabase
      .from('activity_events')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id)
      .eq('action', 'extract_property_url')
      .gte('created_at', startOfMonth.toISOString())

    const currentUsage = usageCount ?? 0
    if (currentUsage >= quota) {
      return new Response(
        JSON.stringify({
          error: `Quota mensuel atteint (${currentUsage}/${quota} URL extraites ce mois)`,
          quota_exceeded: true,
          current_usage: currentUsage,
          quota,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return new Response(
        JSON.stringify({ error: 'URL invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isAllowedUrl(url)) {
      return new Response(
        JSON.stringify({
          error: 'Portail non supporté',
          message: `Domaine "${parsedUrl.hostname}" non reconnu. Portails supportés : ${ALLOWED_DOMAINS.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the page HTML — with timeout + manual redirect handling so that a
    // 302 to an internal-network URL can't bypass the allowlist.
    const fetchController = new AbortController()
    const fetchTimer = setTimeout(() => fetchController.abort(), PORTAL_FETCH_TIMEOUT_MS)
    let pageResponse: Response
    try {
      pageResponse = await fetch(url, {
        redirect: 'manual',
        signal: fetchController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
        },
      })
    } finally {
      clearTimeout(fetchTimer)
    }

    // If the portal redirects, re-validate the target against the allowlist.
    if (pageResponse.status >= 300 && pageResponse.status < 400) {
      const location = pageResponse.headers.get('location') || ''
      const target = (() => {
        try { return new URL(location, url).toString() } catch { return '' }
      })()
      if (!target || !isAllowedUrl(target)) {
        return new Response(
          JSON.stringify({ error: 'Redirection hors allowlist refusée' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // One-hop follow only; same headers.
      pageResponse = await fetch(target, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
        },
      })
    }

    if (!pageResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Impossible de charger la page',
          message: `Le portail a répondu avec le statut ${pageResponse.status}. Certains portails bloquent les requêtes automatiques.`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const html = await pageResponse.text()

    // Clean HTML: remove scripts, styles, and excessive whitespace to save tokens
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    // Limit to ~100K chars to stay within the model's context
    const truncatedHtml = cleanedHtml.slice(0, 100_000)

    // Also try to extract JSON-LD structured data (many portals use it)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    const jsonLdBlocks = (jsonLdMatch || [])
      .map(block => block.replace(/<\/?script[^>]*>/gi, '').trim())
      .join('\n')

    // Extraction via DeepSeek (texte) : JSON strict + timeout large (gros output tardif).
    let result
    try {
      result = await callDeepSeek(
        [{ role: 'user', content: `URL source : ${url}\n\n${jsonLdBlocks ? `--- JSON-LD structured data ---\n${jsonLdBlocks}\n\n` : ''}--- HTML de la page (nettoyé) ---\n${truncatedHtml}` }],
        EXTRACTION_PROMPT,
        { maxTokens: 4096, timeoutMs: 30000, responseFormat: 'json_object', agencyId: profile.agency_id, module: 'extract-property-url' },
      )
    } catch (err) {
      console.error('DeepSeek extraction error:', (err as Error)?.message ?? 'error')
      return new Response(
        JSON.stringify({ error: 'AI extraction error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const text = result.text ?? ''

    // Parse the JSON from the model's response
    let extracted
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      extracted = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', text)
      return new Response(
        JSON.stringify({ error: 'Failed to parse extraction result', raw: text }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure source_url is set
    extracted.source_url = url

    // Log successful extraction for quota accounting and audit trail (only on
    // the success path — failures don't burn the agent's monthly cap).
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: profile.id,
      actor_kind: 'ai',
      action: 'extract_property_url',
      entity_type: 'property',
      severity: 'info',
      category: 'ai',
      metadata: {
        source_url: url,
        source_portal: (extracted as { source_portal?: string } | null)?.source_portal ?? null,
        usage: { input_tokens: result.input_tokens, output_tokens: result.output_tokens },
        usage_count: currentUsage + 1,
        quota,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: extracted,
        source_url: url,
        usage: { input_tokens: result.input_tokens, output_tokens: result.output_tokens },
        quota: { current: currentUsage + 1, limit: quota, remaining: quota - currentUsage - 1 },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
