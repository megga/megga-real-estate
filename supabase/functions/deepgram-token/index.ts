import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured')
    }

    // Create a temporary Deepgram API key (valid 60 seconds)
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}` },
    })

    if (!response.ok) {
      // Fallback: return the key directly (for dev/MVP — in prod use scoped keys)
      return new Response(
        JSON.stringify({ key: DEEPGRAM_API_KEY }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const projects = await response.json()
    const projectId = projects.projects?.[0]?.project_id

    if (!projectId) {
      return new Response(
        JSON.stringify({ key: DEEPGRAM_API_KEY }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create temporary scoped key
    const keyResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'Temporary browser key',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }),
    })

    if (!keyResponse.ok) {
      return new Response(
        JSON.stringify({ key: DEEPGRAM_API_KEY }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const keyData = await keyResponse.json()

    return new Response(
      JSON.stringify({ key: keyData.key }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
