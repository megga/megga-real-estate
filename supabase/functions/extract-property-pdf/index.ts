// supabase/functions/extract-property-pdf/index.ts
// Extracts structured property data from a PDF using Claude API.
// Authenticated agents only — uses Anthropic credits, so anon access is blocked.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 10 MB cap on base64 payload (Claude PDF support tops out around there too,
// and prevents a single agent from running up the Anthropic bill on one call).
const MAX_PDF_BASE64_BYTES = 10 * 1024 * 1024

const EXTRACTION_PROMPT = `Tu es un expert immobilier suisse. Analyse ce document PDF et extrais TOUTES les informations du bien immobilier.

Retourne un JSON strict avec ces champs (utilise null si l'info n'est pas trouvée) :

{
  "title": "string — titre ou description courte du bien",
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
  "address": "string — adresse complète (rue + numéro)",
  "city": "string — ville",
  "canton": "string — code canton 2 lettres (GE, VD, ZH...)",
  "postal_code": "string — NPA",
  "features": ["string — liste des caractéristiques : parking, balcon, terrasse, cave, ascenseur, vue lac, etc."],
  "mandate_type": "simple | exclusive | null",
  "confidence": number de 0 à 100 — ta confiance globale dans l'extraction
}

Règles :
- Prix en CHF, sans apostrophes, juste le nombre
- Surface en m² (nombre seul)
- Si le document mentionne "PPE" ou "copropriété", type = "apartment"
- Si le document mentionne "maison individuelle" ou "villa", type = "house" ou "villa"
- Extrait l'adresse la plus précise possible
- Déduis le canton depuis le NPA ou la ville si non mentionné
- Pour les features, normalise : "place de parc" → "parking", "balcon/loggia" → "balcon"
- Retourne UNIQUEMENT le JSON, pas de texte avant ou après`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { pdf_base64, filename } = await req.json()

    if (!pdf_base64 || typeof pdf_base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'pdf_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (pdf_base64.length > MAX_PDF_BASE64_BYTES) {
      return new Response(
        JSON.stringify({ error: 'PDF trop volumineux (max 10 Mo)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Claude API with PDF document
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
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf_base64,
                },
                cache_control: { type: 'ephemeral' },
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
      // Find JSON in the response (Claude sometimes wraps it in ```json blocks)
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

    return new Response(
      JSON.stringify({
        success: true,
        data: extracted,
        filename: filename ?? 'document.pdf',
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
