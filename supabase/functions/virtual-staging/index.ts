// supabase/functions/virtual-staging/index.ts
// MEGGA Staging — Virtual staging IA via Google Gemini (Nano Banana 2)
// Coût : ~CHF 0.034/image en batch 1K, ~CHF 0.05/image en 2K
// Quotas : Starter=0, Pro=50 images/mois, Agency=200 images/mois

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Gemini 2.0 Flash image generation endpoint
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`

interface StagingRequest {
  photoUrl: string
  style: 'modern' | 'classic' | 'luxury' | 'scandinavian' | 'minimal'
  roomType: 'salon' | 'chambre' | 'cuisine' | 'salle_a_manger' | 'bureau' | 'autre'
  propertyId: string
}

const STYLE_PROMPTS: Record<string, string> = {
  modern: 'mobilier moderne et épuré, lignes droites, couleurs neutres avec touches de couleur, canapé design, table basse minimaliste',
  classic: 'mobilier classique élégant, bois noble, tissus riches, tapis persan, bibliothèque, fauteuils capitonnés',
  luxury: 'mobilier haut de gamme luxueux, matériaux nobles (marbre, laiton, velours), éclairage d\'ambiance, pièces de designer',
  scandinavian: 'mobilier scandinave clair et chaleureux, bois de bouleau, lin naturel, plantes vertes, hygge, tons pastel',
  minimal: 'mobilier minimaliste japonisant, très peu de meubles, espace ouvert, tons neutres, zen',
}

const ROOM_PROMPTS: Record<string, string> = {
  salon: 'un salon avec canapé, table basse, tapis, éclairage, plantes',
  chambre: 'une chambre avec lit double, tables de nuit, lampes, coussins',
  cuisine: 'une cuisine avec plan de travail décoré, tabourets, accessoires, fruits',
  salle_a_manger: 'une salle à manger avec table, chaises, suspension, décoration murale',
  bureau: 'un bureau à domicile avec bureau, chaise ergonomique, étagères, lampe',
  autre: 'une pièce meublée avec goût, fonctionnelle et accueillante',
}

// Plan quotas
const PLAN_QUOTAS: Record<string, number> = {
  starter: 0,
  pro: 50,
  entreprise: 200,
  agency: 200,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_AI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { photoUrl, style, roomType, propertyId } = await req.json() as StagingRequest

    if (!photoUrl || !style || !propertyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: photoUrl, style, propertyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Auth + quota check
    const authHeader = req.headers.get('authorization') || ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile + plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, agency_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Profil agent non trouvé' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get agency plan
    const { data: agency } = await supabase
      .from('agencies')
      .select('plan')
      .eq('id', profile.agency_id)
      .single()

    const plan = (agency?.plan as string) || 'starter'
    const quota = PLAN_QUOTAS[plan] || 0

    if (quota === 0) {
      return new Response(
        JSON.stringify({
          error: 'Plan Starter — le staging virtuel est disponible à partir du plan Pro',
          upgrade_required: true,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check monthly usage
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: usageCount } = await supabase
      .from('activity_events')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id)
      .eq('action', 'virtual_staging')
      .gte('created_at', startOfMonth.toISOString())

    const currentUsage = usageCount || 0
    if (currentUsage >= quota) {
      return new Response(
        JSON.stringify({
          error: `Quota atteint (${currentUsage}/${quota} images ce mois)`,
          quota_exceeded: true,
          current_usage: currentUsage,
          quota,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch original photo as base64
    const photoResponse = await fetch(photoUrl)
    if (!photoResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Impossible de charger la photo originale' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const photoBuffer = await photoResponse.arrayBuffer()
    const photoBase64 = btoa(String.fromCharCode(...new Uint8Array(photoBuffer)))
    const mimeType = photoResponse.headers.get('content-type') || 'image/jpeg'

    // Build prompt
    const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
    const roomDesc = ROOM_PROMPTS[roomType || 'autre'] || ROOM_PROMPTS.autre

    const prompt = `Tu es un expert en home staging virtuel pour l'immobilier suisse haut de gamme.

Voici la photo d'une pièce vide ou peu meublée. Génère une version réaliste de cette MÊME pièce meublée et décorée.

Type de pièce : ${roomDesc}
Style souhaité : ${styleDesc}

RÈGLES STRICTES :
- Garde EXACTEMENT la même architecture (murs, fenêtres, sol, plafond, lumière naturelle)
- Ajoute UNIQUEMENT du mobilier, de la décoration et de l'éclairage
- Le résultat doit être photoréaliste, comme une vraie photo d'intérieur
- Qualité professionnelle, éclairage cohérent avec la lumière existante
- Pas de texte, pas de watermark, pas de logo
- Perspective et proportions réalistes`

    // Call Gemini API
    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: photoBase64,
              },
            },
          ],
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.4,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Erreur de génération. Réessayez.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()

    // Extract generated image from response
    const parts = geminiData?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData)

    if (!imagePart?.inlineData?.data) {
      return new Response(
        JSON.stringify({ error: 'Aucune image générée. La pièce est peut-être déjà meublée.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upload staged photo to Supabase Storage
    const stagedFileName = `${propertyId}/staged_${Date.now()}_${style}.jpg`
    const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), (c) => c.charCodeAt(0))

    const { error: uploadError } = await supabase.storage
      .from('property-photos')
      .upload(stagedFileName, imageBytes, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Erreur de sauvegarde de l\'image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('property-photos')
      .getPublicUrl(stagedFileName)

    // Track the staged URL so the marketplace can render an "AI-staged" badge
    // on it. Read-modify-write on properties.ai_generated_photos: same property
    // can have multiple staged variants over time.
    {
      const { data: row } = await supabase
        .from('properties')
        .select('ai_generated_photos')
        .eq('id', propertyId)
        .single()
      const current = (row?.ai_generated_photos as string[] | undefined) ?? []
      if (!current.includes(publicUrl.publicUrl)) {
        await supabase
          .from('properties')
          .update({ ai_generated_photos: [...current, publicUrl.publicUrl] })
          .eq('id', propertyId)
      }
    }

    // Log usage in activity_events
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: user.id,
      actor_kind: 'ai',
      action: 'virtual_staging',
      entity_type: 'property',
      entity_id: propertyId,
      severity: 'info',
      category: 'ai',
      metadata: {
        style,
        room_type: roomType || 'autre',
        original_url: photoUrl,
        staged_url: publicUrl.publicUrl,
        usage_count: currentUsage + 1,
        quota,
      },
    })

    return new Response(
      JSON.stringify({
        staged_url: publicUrl.publicUrl,
        style,
        room_type: roomType || 'autre',
        usage: { current: currentUsage + 1, quota, remaining: quota - currentUsage - 1 },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Virtual staging error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
