import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROOM_TYPES = [
  'salon', 'cuisine', 'chambre', 'salle_de_bain', 'bureau',
  'entree', 'terrasse', 'garage', 'exterieur', 'autre',
]

const SYSTEM_PROMPT = `Tu es un expert immobilier suisse. Pour chaque photo immobilière, tu dois:

1. IDENTIFIER le type de pièce parmi: ${ROOM_TYPES.join(', ')}
2. ÉVALUER la qualité photographique (0-100) sur 4 critères:
   - sharpness: netteté de l'image (0-100)
   - lighting: qualité de l'éclairage (0-100)
   - composition: cadrage et composition (0-100)
   - overall: score global (0-100)
3. DÉTECTER les problèmes: "blur", "overexposed", "underexposed", "low_res", "dark", "tilted"

Réponds UNIQUEMENT en JSON valide, sans markdown:
{
  "room": "salon",
  "confidence": 0.95,
  "quality": {
    "sharpness": 85,
    "lighting": 90,
    "composition": 80,
    "overall": 85
  },
  "flags": []
}`

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // JWT crypto-verified + profile.agency_id loaded. Closes the
    // "Authorization: anything" bypass from the red-team audit.
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { profile, supabase } = auth

    const { photo_urls, property_id } = await req.json()

    if (!photo_urls?.length) {
      return new Response(
        JSON.stringify({ error: 'photo_urls requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ownership check: if a property_id is provided it must belong to the
    // caller's agency. Closes the cross-tenant labeling drain.
    if (property_id) {
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('id, agency_id')
        .eq('id', property_id)
        .single()

      if (propError || !property) {
        return new Response(
          JSON.stringify({ error: 'Bien introuvable' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (property.agency_id !== profile.agency_id) {
        return new Response(
          JSON.stringify({ error: 'Bien hors agence — labeling refusé' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const results = []

    for (const url of photo_urls) {
      try {
        // Fetch image as base64
        const imgResp = await fetch(url)
        if (!imgResp.ok) {
          results.push({ url, error: 'Impossible de charger la photo', room: 'autre', confidence: 0, quality: { sharpness: 0, lighting: 0, composition: 0, overall: 0 }, flags: ['load_error'] })
          continue
        }

        const imgBuffer = await imgResp.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
        const contentType = imgResp.headers.get('content-type') || 'image/jpeg'

        // Call Claude Vision
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            system: SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: contentType,
                    data: base64,
                  },
                },
                {
                  type: 'text',
                  text: 'Analyse cette photo immobilière.',
                },
              ],
            }],
          }),
        })

        if (!claudeResp.ok) {
          const errText = await claudeResp.text()
          results.push({ url, error: `Claude API error: ${errText}`, room: 'autre', confidence: 0, quality: { sharpness: 50, lighting: 50, composition: 50, overall: 50 }, flags: ['api_error'] })
          continue
        }

        const claudeData = await claudeResp.json()
        const text = claudeData.content?.[0]?.text || '{}'

        // Parse JSON response
        const parsed = JSON.parse(text)
        results.push({
          url,
          room: ROOM_TYPES.includes(parsed.room) ? parsed.room : 'autre',
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
          quality: {
            sharpness: Math.min(100, Math.max(0, parsed.quality?.sharpness || 50)),
            lighting: Math.min(100, Math.max(0, parsed.quality?.lighting || 50)),
            composition: Math.min(100, Math.max(0, parsed.quality?.composition || 50)),
            overall: Math.min(100, Math.max(0, parsed.quality?.overall || 50)),
          },
          flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        })

        // Rate limit: 200ms between calls
        await new Promise(r => setTimeout(r, 200))
      } catch (photoErr) {
        results.push({
          url,
          room: 'autre',
          confidence: 0,
          quality: { sharpness: 50, lighting: 50, composition: 50, overall: 50 },
          flags: ['parse_error'],
          error: String(photoErr),
        })
      }
    }

    // Log activity
    if (property_id) {
      await supabase.from('activity_events').insert({
        agency_id: profile.agency_id,
        action: 'photo_auto_label',
        entity_type: 'property',
        entity_id: property_id,
        actor_id: profile.id,
        actor_kind: 'ai',
        metadata: { photo_count: photo_urls.length, results_count: results.length },
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
