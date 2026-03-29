import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STYLE_PROMPTS: Record<string, string> = {
  modern: 'Style moderne : mobilier contemporain minimaliste, couleurs neutres, lignes épurées',
  classic: 'Style classique : mobilier traditionnel élégant, boiseries, textures riches',
  luxury: 'Style luxe : mobilier haut de gamme, matériaux nobles (marbre, velours), éclairage raffiné',
  scandinavian: 'Style scandinave : mobilier en bois clair, tons pastel, design fonctionnel hygge',
  minimal: 'Style minimaliste : très peu de meubles, espace ouvert, tons monochromes',
}

const ROOM_PROMPTS: Record<string, string> = {
  salon: 'un salon/séjour',
  chambre: 'une chambre à coucher',
  cuisine: 'une cuisine',
  salle_a_manger: 'une salle à manger',
  bureau: 'un bureau/home office',
  autre: 'une pièce',
}

// Rate limit: track by IP
const rateLimits = new Map<string, { count: number; resetAt: number }>()

serve(async (req) => {
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
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const now = Date.now()
    const limit = rateLimits.get(ip)

    if (limit && limit.resetAt > now && limit.count >= 5) {
      return new Response(JSON.stringify({ error: 'Limite atteinte. Réessayez dans 1 heure.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!limit || limit.resetAt <= now) {
      rateLimits.set(ip, { count: 1, resetAt: now + 3600000 })
    } else {
      limit.count++
    }

    const { photo_url, style, room_type } = await req.json()

    if (!photo_url || !style) {
      return new Response(JSON.stringify({ error: 'photo_url et style requis' }), { status: 400 })
    }

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
    const roomPrompt = ROOM_PROMPTS[room_type] || ROOM_PROMPTS.autre

    // Fetch original photo
    const imgResp = await fetch(photo_url)
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ error: 'Photo introuvable' }), { status: 400 })
    }

    const imgBuffer = await imgResp.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))

    // Call Gemini 2.0 Flash
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64,
                },
              },
              {
                text: `Cette photo montre ${roomPrompt} vide. Meuble cette pièce avec du mobilier ${stylePrompt}.
Garde exactement la même perspective, les mêmes murs, sols, fenêtres et architecture.
Ajoute UNIQUEMENT du mobilier et de la décoration appropriés.
Le résultat doit être photoréaliste et professionnel.`,
              },
            ],
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageSizes: ['1024x1024'],
          },
        }),
      }
    )

    if (!geminiResp.ok) {
      const errText = await geminiResp.text()
      return new Response(JSON.stringify({ error: `Gemini error: ${errText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const geminiData = await geminiResp.json()
    const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(
      (p: Record<string, unknown>) => p.inlineData
    )

    if (!imagePart?.inlineData?.data) {
      return new Response(JSON.stringify({ error: 'Pas d\'image générée' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const fileName = `public-staging/${crypto.randomUUID()}.jpg`
    const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0))

    const { error: uploadError } = await supabase.storage
      .from('property-photos')
      .upload(fileName, imageBytes, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload error: ${uploadError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(fileName)

    // Log activity
    await supabase.from('activity_events').insert({
      action: 'public_virtual_staging',
      entity_type: 'listing',
      actor_id: 'public_buyer',
      metadata: { style, room_type, ip: ip.substring(0, 8) + '***' },
    })

    return new Response(JSON.stringify({
      staged_url: urlData.publicUrl,
      style,
      room_type,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
