// supabase/functions/speech-to-text/index.ts
// Dictée de l'agent : un fichier audio (multipart `audio`, `language` facultatif) →
// transcription Deepgram Nova-2. Réponse : { transcript, confidence, language }.
//
// Échecs : des CODES, jamais le texte du fournisseur (audit du 13.09.2026, S14) —
// `not_configured` (500), `audio_required` (400), `transcription_failed` (502 si
// Deepgram refuse, 400 sinon). Le détail est dans le journal de la fonction.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
      console.error('[speech-to-text] DEEPGRAM_API_KEY absente')
      return json({ error: 'not_configured' }, 500)
    }

    // Get audio blob from request
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const language = (formData.get('language') as string) || 'fr'

    if (!audioFile) {
      return json({ error: 'audio_required' }, 400)
    }
    // Borne anti-abus : dictée agent, pas d'upload massif.
    if (audioFile.size > 15_000_000) {
      return json({ error: 'Audio too large (max 15MB)' }, 400)
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
      // ⛔ Le corps de Deepgram reste au journal (audit S14) : il était recopié tel quel
      // dans la réponse, diagnostic du fournisseur compris.
      const errorText = await response.text().catch(() => '')
      console.error(`[speech-to-text] Deepgram ${response.status} :`, redactedErrorMessage(errorText, 300))
      return json({ error: 'transcription_failed' }, 502)
    }

    const result = await response.json()
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0

    return json({ transcript, confidence, language })
  } catch (error) {
    console.error('[speech-to-text] échec :', redactedErrorMessage(error))
    return json({ error: 'transcription_failed' }, 400)
  }
})
