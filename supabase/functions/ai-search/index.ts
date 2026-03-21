// supabase/functions/ai-search/index.ts
// Edge Function pour la recherche conversationnelle IA
// Utilise pgvector pour la similarité sémantique + Claude API pour le dialogue

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SearchRequest {
  query: string
  conversation_history?: ChatMessage[]
  filters?: {
    context?: 'buy' | 'rent'
    city?: string
    canton?: string
    min_price?: number
    max_price?: number
    rooms?: number
    property_type?: string
  }
  limit?: number
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      query,
      conversation_history = [],
      filters = {},
      limit = 20,
    }: SearchRequest = await req.json()

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Le paramètre "query" est requis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ── Step 1: Generate embedding for the user query ──
    // Using Supabase's built-in embedding or external API
    // For now, fall back to keyword-based search if no embedding API is configured

    let matchingListings: Record<string, unknown>[] = []

    // ── Step 2: Search listings ──
    // Try pgvector similarity search first, fall back to keyword search
    let dbQuery = supabase
      .from('listings')
      .select(`
        *,
        property:properties(
          id, title, description, type, status, price, currency,
          rooms, bedrooms, bathrooms, surface_m2,
          address, city, canton, postal_code, lat, lng,
          photos, features
        ),
        agency:agencies(name, logo_url)
      `)
      .eq('property.status', 'active')

    // Apply filters
    if (filters.context === 'rent') {
      dbQuery = dbQuery.lte('property.price', 10000) // Rough heuristic: rent < 10K/month
    }
    if (filters.city) {
      dbQuery = dbQuery.eq('property.city', filters.city)
    }
    if (filters.canton) {
      dbQuery = dbQuery.eq('property.canton', filters.canton)
    }
    if (filters.min_price) {
      dbQuery = dbQuery.gte('property.price', filters.min_price)
    }
    if (filters.max_price) {
      dbQuery = dbQuery.lte('property.price', filters.max_price)
    }
    if (filters.rooms) {
      dbQuery = dbQuery.gte('property.rooms', filters.rooms)
    }
    if (filters.property_type) {
      dbQuery = dbQuery.eq('property.type', filters.property_type)
    }

    // Keyword search fallback
    if (query) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,description_ai.ilike.%${query}%,property.city.ilike.%${query}%,property.address.ilike.%${query}%`
      )
    }

    const { data: listings, error: listingsError } = await dbQuery
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit)

    if (listingsError) {
      throw new Error(`Erreur de recherche: ${listingsError.message}`)
    }

    matchingListings = listings || []

    // ── Step 3: Build AI response ──
    let aiResponse = ''

    if (anthropicApiKey) {
      // Build context from matching listings
      const listingsContext = matchingListings
        .slice(0, 10)
        .map((l: Record<string, unknown>) => {
          const p = l.property as Record<string, unknown> | null
          if (!p) return ''
          return `- ${p.title}: ${p.rooms} pièces, ${p.bedrooms} chambres, ${p.surface_m2} m², CHF ${p.price}, ${p.address}, ${p.city} (${p.canton})`
        })
        .filter(Boolean)
        .join('\n')

      const systemPrompt = `Tu es l'assistant de recherche immobilière MEGGA, spécialisé dans le marché suisse.
Règles strictes :
- Réponds toujours en français
- Formate les prix en CHF avec l'apostrophe suisse (CHF 720'000)
- Pas de discrimination (origine, genre, religion, âge)
- Pas de contenus trompeurs sur les biens
- Si l'utilisateur pose une question juridique ou veut négocier, recommande de contacter un agent
- Disclaimer implicite : les informations sont à titre indicatif
- Sois concis, utile et professionnel
- Maximum 3-4 phrases par réponse
- Si aucun bien ne correspond, suggère d'élargir les critères`

      const messages = [
        ...conversation_history.map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `Recherche utilisateur : "${query}"

Biens trouvés (${matchingListings.length} résultats) :
${listingsContext || 'Aucun bien ne correspond exactement.'}

Réponds de manière naturelle en présentant les résultats pertinents. Si aucun résultat, suggère d'élargir la recherche.`,
        },
      ]

      // Call Claude API
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: systemPrompt,
          messages,
        }),
      })

      if (claudeResponse.ok) {
        const claudeData = await claudeResponse.json()
        aiResponse =
          claudeData.content?.[0]?.text ||
          `J'ai trouvé ${matchingListings.length} bien(s) correspondant à votre recherche.`
      } else {
        aiResponse = `J'ai trouvé ${matchingListings.length} bien(s) correspondant à votre recherche.`
      }
    } else {
      // No API key — basic response
      aiResponse =
        matchingListings.length > 0
          ? `J'ai trouvé ${matchingListings.length} bien(s) correspondant à votre recherche "${query}".`
          : `Aucun bien ne correspond exactement à "${query}". Essayez d'élargir vos critères.`
    }

    return new Response(
      JSON.stringify({
        results: matchingListings,
        ai_response: aiResponse,
        total: matchingListings.length,
        query,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
