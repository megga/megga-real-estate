import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { photo_urls, property_id } = await req.json()

    if (!photo_urls?.length) {
      return new Response(JSON.stringify({ error: 'photo_urls requis' }), { status: 400 })
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
        action: 'photo_auto_label',
        entity_type: 'property',
        entity_id: property_id,
        actor_id: 'ai',
        metadata: { photo_count: photo_urls.length, results_count: results.length },
      })
    }

    return new Response(JSON.stringify({ results }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
