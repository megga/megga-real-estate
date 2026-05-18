import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { analyzePhoto } from '../_shared/photo-vision.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Bulk-analyse via le helper partagé. Conserve un sleep de 200ms entre
    // appels pour ménager l'API Anthropic (rate-limit defense-in-depth).
    const results = []
    for (let i = 0; i < photo_urls.length; i++) {
      const url = photo_urls[i] as string
      const analysis = await analyzePhoto(url)
      results.push({ url, ...analysis })
      if (i < photo_urls.length - 1) {
        await new Promise((r) => setTimeout(r, 200))
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
