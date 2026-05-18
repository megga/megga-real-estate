// supabase/functions/virtual-staging/index.ts
// MEGGA Staging — Virtual staging IA via Google Nano Banana 2
// (Gemini 3.1 Flash Image Preview, lancé fév. 2026)
//
// Flow :
//   1. Auth + ownership check (cross-tenant guard)
//   2. Quota mensuel (Starter=0 / Pro=50 / Agency=200)
//   3. PHOTO-VISION GATE (Claude Vision)
//      - Refuse si type de pièce détecté ≠ demandé (confidence ≥ 85%)
//      - Refuse si qualité < 50/100 ou flag critique (blur/dark/low_res)
//      - Refuse si personne identifiable (LPD art. 6)
//   4. PROMPT MASTER (Claude Haiku)
//      - Enrichit le prompt Gemini avec le contexte photo (lumière, qualité,
//        observations Vision) et le style/roomType choisi par l'agent
//      - Fallback statique si Haiku échoue
//   5. Gemini Nano Banana 2 → image staged
//   6. Upload Storage + `ai_generated_photos` array + audit event
//
// Coût total : Claude Vision ~CHF 0.003 + Claude Haiku ~CHF 0.001
//              + Gemini ~CHF 0.034 = ~CHF 0.038/image

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analyzePhoto, judgePhotoForStaging, type PhotoAnalysis, type RoomType } from '../_shared/photo-vision.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Nano Banana 2 (Gemini 3.1 Flash Image Preview) — image generation endpoint
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_API_KEY}`

// Cheap, fast model — used as a prompt engineer, not for image work.
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

type StagingStyle = 'modern' | 'classic' | 'luxury' | 'scandinavian' | 'minimal'
type StagingRoomType =
  | 'salon' | 'chambre' | 'cuisine' | 'salle_a_manger' | 'bureau' | 'autre'
  | 'terrasse' | 'jardin' | 'balcon' // outdoor variants

interface StagingRequest {
  photoUrl: string
  style: StagingStyle
  roomType: StagingRoomType
  propertyId: string
  /** Skip the prompt-master Haiku call (use static template). Use for debug. */
  skipPromptMaster?: boolean
}

const STYLE_PROMPTS: Record<StagingStyle, string> = {
  modern: 'mobilier moderne et épuré, lignes droites, couleurs neutres avec touches de couleur, canapé design, table basse minimaliste',
  classic: 'mobilier classique élégant, bois noble, tissus riches, tapis persan, bibliothèque, fauteuils capitonnés',
  luxury: 'mobilier haut de gamme luxueux, matériaux nobles (marbre, laiton, velours), éclairage d\'ambiance, pièces de designer',
  scandinavian: 'mobilier scandinave clair et chaleureux, bois de bouleau, lin naturel, plantes vertes, hygge, tons pastel',
  minimal: 'mobilier minimaliste japonisant, très peu de meubles, espace ouvert, tons neutres, zen',
}

const ROOM_PROMPTS: Record<StagingRoomType, string> = {
  salon: 'un salon avec canapé, table basse, tapis, éclairage, plantes',
  chambre: 'une chambre avec lit double, tables de nuit, lampes, coussins',
  cuisine: 'une cuisine avec plan de travail décoré, tabourets, accessoires, fruits',
  salle_a_manger: 'une salle à manger avec table, chaises, suspension, décoration murale',
  bureau: 'un bureau à domicile avec bureau, chaise ergonomique, étagères, lampe',
  // Outdoor — Nano Banana 2 supporte le staging extérieur, on profite.
  terrasse: 'une terrasse aménagée avec mobilier outdoor (canapé bas extérieur, table basse, plantes en pot)',
  jardin: 'un jardin avec mobilier de jardin (table à manger pour 6, parasol, transats, plantes ornementales)',
  balcon: 'un balcon avec petit mobilier outdoor (fauteuils 1-2 places, table d\'appoint, jardinières)',
  autre: 'une pièce meublée avec goût, fonctionnelle et accueillante',
}

// Plan quotas
const PLAN_QUOTAS: Record<string, number> = {
  starter: 0,
  pro: 50,
  entreprise: 200,
  agency: 200,
}

// Mapping virtual-staging StagingRoomType → photo-vision RoomType pour le gate.
// La classification Vision a un vocabulaire légèrement différent (pas de
// `salle_a_manger`, pas de `jardin`/`balcon`). On normalise dans le sens
// "demandé → détecté attendu" pour comparer sans faux positifs.
function expectedDetectedRooms(requested: StagingRoomType): RoomType[] {
  switch (requested) {
    case 'salle_a_manger': return ['salon', 'autre'] // vision ne distingue pas
    case 'jardin': return ['exterieur', 'terrasse', 'autre']
    case 'balcon': return ['terrasse', 'exterieur', 'autre']
    case 'salon':
    case 'chambre':
    case 'cuisine':
    case 'bureau':
    case 'terrasse':
    case 'autre':
      return [requested as RoomType, 'autre']
    default:
      return ['autre']
  }
}

function isOutdoorRoom(r: StagingRoomType): boolean {
  return r === 'terrasse' || r === 'jardin' || r === 'balcon'
}

/**
 * Prompt Master — utilise Claude Haiku pour adapter le prompt Gemini au
 * contexte précis de la photo. Renvoie un prompt enrichi en français.
 *
 * Fallback silencieux sur le prompt statique si Haiku flanche (timeout,
 * 5xx, etc.) — on ne casse jamais le flow staging pour un enrichissement.
 */
async function masterPrompt({
  style,
  roomType,
  analysis,
}: {
  style: StagingStyle
  roomType: StagingRoomType
  analysis: PhotoAnalysis
}): Promise<string> {
  const baseStyle = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
  const baseRoom = ROOM_PROMPTS[roomType] || ROOM_PROMPTS.autre
  const outdoor = isOutdoorRoom(roomType)

  const staticPrompt = buildStaticPrompt({ baseStyle, baseRoom, outdoor })

  if (!ANTHROPIC_API_KEY) return staticPrompt

  const sceneSummary = JSON.stringify({
    detected_room: analysis.room,
    confidence: analysis.confidence,
    quality: analysis.quality,
    flags: analysis.flags,
  })

  const systemPrompt = `Tu es un prompt-engineer expert pour les modèles de génération d'image, spécialisé en home staging virtuel pour l'immobilier suisse premium.

Tu reçois :
- Le contexte de la photo source (classification de pièce, scores qualité 0–100, flags qualité)
- Un style de mobilier demandé
- Un type de pièce demandé

Tu produis UN SEUL prompt en français, 100–180 mots, qui sera passé tel quel à Gemini Nano Banana 2 pour générer la version meublée de la même pièce.

Le prompt doit :
1. S'ouvrir sur "Tu es un expert en home staging virtuel pour l'immobilier suisse haut de gamme."
2. Décrire le mobilier précis à ajouter en s'adaptant à la lumière/qualité observées (ex. si l'image est sombre, demander un éclairage chaud d'appoint ; si la composition est tiltée, indiquer "corrige discrètement l'inclinaison")
3. Lister des règles strictes IMMUABLES :
   - Architecture inchangée (murs, fenêtres, sol, plafond)
   - Aucune personne, aucun animal
   - Aucun objet impossible ou flottant
   - Conserver la perspective, les ombres, la direction de la lumière
   - Si la pièce est déjà entièrement meublée : renvoyer la photo inchangée
   - Pas de texte, watermark, logo, signature
4. Finir par "Génère uniquement l'image résultante, photoréaliste, qualité professionnelle."

Réponds UNIQUEMENT avec le prompt final, sans introduction ni explication.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content:
            `Contexte photo : ${sceneSummary}\n` +
            `Style demandé : ${style} → ${baseStyle}\n` +
            `Type de pièce demandé : ${roomType} → ${baseRoom}\n` +
            `Pièce extérieure : ${outdoor ? 'oui' : 'non'}\n\n` +
            `Construis le prompt Gemini optimal.`,
        }],
      }),
    })

    if (!resp.ok) return staticPrompt

    const data = await resp.json()
    const text = (data?.content?.[0]?.text as string | undefined)?.trim() || ''
    // Sanity guard — si Haiku rend trop court (ratio < 0.4 vs static) ou trop
    // long (> 2000 char), on fallback. Évite un prompt cassé qui ruine Gemini.
    if (text.length < staticPrompt.length * 0.4 || text.length > 2000) {
      return staticPrompt
    }
    return text
  } catch {
    return staticPrompt
  }
}

function buildStaticPrompt({
  baseStyle,
  baseRoom,
  outdoor,
}: { baseStyle: string; baseRoom: string; outdoor: boolean }): string {
  return `Tu es un expert en home staging virtuel pour l'immobilier suisse haut de gamme.

Voici la photo d'${outdoor ? 'un espace extérieur vide ou peu aménagé' : 'une pièce vide ou peu meublée'}. Génère une version réaliste du MÊME espace meublé et décoré.

Type d'espace : ${baseRoom}
Style souhaité : ${baseStyle}

RÈGLES STRICTES IMMUABLES :
- Garde EXACTEMENT la même architecture (murs, fenêtres, sol, plafond${outdoor ? ', végétation existante' : ', lumière naturelle'})
- Ajoute UNIQUEMENT du mobilier, de la décoration et de l'éclairage
- Aucune personne, aucun animal — refus immédiat si une personne est visible
- Aucun objet flottant ou physiquement impossible
- Conserve la perspective, les ombres et la direction de la lumière existante
- Si l'espace est DÉJÀ entièrement meublé/aménagé : renvoie la photo inchangée
- Pas de texte, pas de watermark, pas de logo, pas de signature
- Perspective et proportions réalistes

Génère uniquement l'image résultante, photoréaliste, qualité professionnelle.`
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

    // Auth check FIRST — body parsing happens after we've established identity.
    // Closes the "leak the required field names without a JWT" smell.
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

    const body = await req.json() as StagingRequest
    const { photoUrl, style, roomType, propertyId, skipPromptMaster } = body

    if (!photoUrl || !style || !propertyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: photoUrl, style, propertyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Ownership check: le bien doit appartenir à l'agence du caller.
    // Le client Supabase utilise SERVICE_ROLE_KEY donc bypass RLS — c'est ici
    // qu'on bloque le cross-tenant IDOR (agent A stage le bien de B).
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, agency_id')
      .eq('id', propertyId)
      .single()

    if (propError || !property) {
      return new Response(
        JSON.stringify({ error: 'Bien introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (property.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Bien hors agence — staging refusé' }),
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

    // ── PHOTO-VISION GATE ────────────────────────────────────────────
    // Évite de brûler ~CHF 0.034 de Gemini sur une photo qui foirera. Coût
    // ajouté : ~CHF 0.003 de Claude Vision. Break-even dès qu'on évite 1
    // staging raté sur 12 (large marge en pratique).
    const analysis = await analyzePhoto(photoUrl)
    const compatibleRooms = expectedDetectedRooms(roomType || 'autre')
    const isMismatch =
      compatibleRooms.length > 0 &&
      analysis.room !== 'autre' &&
      !compatibleRooms.includes(analysis.room) &&
      analysis.confidence >= 0.85

    if (isMismatch) {
      return new Response(
        JSON.stringify({
          error: `Cette photo semble être un(e) ${analysis.room} (${Math.round(analysis.confidence * 100)}% de confiance), mais vous avez sélectionné "${roomType}". Choisissez le bon type de pièce ou uploadez une autre photo.`,
          mismatch: true,
          detected_room: analysis.room,
          requested_room: roomType,
          confidence: analysis.confidence,
          // Suggestion à l'UI : re-proposer le type détecté
          suggested_room_type: analysis.room,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const verdict = judgePhotoForStaging(analysis, 'autre') // on a déjà géré le mismatch
    if (verdict.verdict === 'low_quality') {
      return new Response(
        JSON.stringify({
          error: `Qualité photo insuffisante : ${verdict.reason}. Uploadez une photo plus nette et mieux éclairée pour un staging optimal.`,
          quality_issue: true,
          analysis: {
            quality: analysis.quality,
            flags: analysis.flags,
          },
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (verdict.verdict === 'person_detected') {
      return new Response(
        JSON.stringify({
          error: 'Personne identifiable détectée sur la photo. Pour des raisons de protection des données (nLPD art. 6), le staging ne peut pas s\'appliquer à des photos contenant des personnes.',
          lpd_block: true,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (verdict.verdict === 'already_furnished') {
      return new Response(
        JSON.stringify({
          error: 'La pièce est déjà entièrement meublée — le staging IA ne va pas l\'améliorer. Si vous voulez la re-meubler dans un autre style, contactez le support.',
          already_furnished: true,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // verdict.verdict === 'load_error' : on continue quand même — Vision peut
    // avoir échoué pour une raison transitoire, on laisse Gemini essayer.

    // Fetch original photo as base64 (already validated by Vision above)
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

    // ── PROMPT MASTER ────────────────────────────────────────────────
    // Claude Haiku enrichit le prompt en se basant sur l'analyse Vision. Si
    // l'agent l'a explicitement désactivé (debug) ou si Haiku flanche, on
    // tombe sur le prompt statique (buildStaticPrompt).
    const prompt = skipPromptMaster
      ? buildStaticPrompt({
          baseStyle: STYLE_PROMPTS[style] || STYLE_PROMPTS.modern,
          baseRoom: ROOM_PROMPTS[roomType] || ROOM_PROMPTS.autre,
          outdoor: isOutdoorRoom(roomType),
        })
      : await masterPrompt({ style, roomType, analysis })

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
        // Trace de l'analyse Vision pour debug a posteriori
        vision: {
          detected_room: analysis.room,
          confidence: analysis.confidence,
          quality_overall: analysis.quality.overall,
          flags: analysis.flags,
        },
        prompt_master_used: !skipPromptMaster,
      },
    })

    return new Response(
      JSON.stringify({
        staged_url: publicUrl.publicUrl,
        style,
        room_type: roomType || 'autre',
        usage: { current: currentUsage + 1, quota, remaining: quota - currentUsage - 1 },
        analysis: {
          detected_room: analysis.room,
          confidence: analysis.confidence,
          quality: analysis.quality,
          flags: analysis.flags,
        },
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
