// supabase/functions/extract-property-url/index.ts
// Fetches a property listing URL and extracts structured data using Claude API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTRACTION_PROMPT = `Tu es un expert immobilier suisse. Analyse cette page web d'annonce immobilière et extrais TOUTES les informations du bien.

Retourne un JSON strict avec ces champs (utilise null si l'info n'est pas trouvée) :

{
  "title": "string — titre de l'annonce",
  "description": "string — description complète du bien",
  "type": "apartment | house | villa | commercial | land",
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
  "source_url": "string — URL source",
  "source_portal": "string — nom du portail (Homegate, ImmoScout24, RealAdvisor, Comparis, autre)",
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
- Retourne UNIQUEMENT le JSON, pas de texte avant ou après`

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
]

function isAllowedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain))
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Fetch the page HTML
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
      },
    })

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

    // Limit to ~100K chars to stay within Claude's context
    const truncatedHtml = cleanedHtml.slice(0, 100_000)

    // Also try to extract JSON-LD structured data (many portals use it)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    const jsonLdBlocks = (jsonLdMatch || [])
      .map(block => block.replace(/<\/?script[^>]*>/gi, '').trim())
      .join('\n')

    // Call Claude API with the HTML content
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `URL source : ${url}\n\n${jsonLdBlocks ? `--- JSON-LD structured data ---\n${jsonLdBlocks}\n\n` : ''}--- HTML de la page (nettoyé) ---\n${truncatedHtml}`,
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ''

    // Parse the JSON from Claude's response
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

    return new Response(
      JSON.stringify({
        success: true,
        data: extracted,
        source_url: url,
        usage: result.usage,
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
