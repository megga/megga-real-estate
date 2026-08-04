import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth agent : coupe l'abus anonyme des crédits Deepgram. cf. S1j.
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth

  try {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured')
    }

    // Get audio blob from request
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const language = (formData.get('language') as string) || 'fr'

    if (!audioFile) {
      throw new Error('No audio file provided')
    }
    // Borne anti-abus : dictée agent, pas d'upload massif.
    if (audioFile.size > 15_000_000) {
      return new Response(JSON.stringify({ error: 'Audio too large (max 15MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const audioBuffer = await audioFile.arrayBuffer()

    // Call Deepgram Nova-2 API
    const response = await fetch('https://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      language: language,
      punctuate: 'true',
      smart_format: 'true',
    }), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': audioFile.type || 'audio/webm',
      },
      body: audioBuffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Deepgram API error: ${response.status} — ${errorText}`)
    }

    const result = await response.json()
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0

    return new Response(
      JSON.stringify({ transcript, confidence, language }),
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
