import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
