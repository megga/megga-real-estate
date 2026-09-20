// supabase/functions/labs-voice-preview/index.ts
// Labs — ÉCOUTER une voix off avant de payer une vidéo.
//
// Julien, 20.09.2026 : « pour les voix off, il faudrait qu'on puisse les entendre,
// un petit bouton play ». Sans cet aperçu, choisir entre six voix et quatre langues
// se fait à l'aveugle — et le seul moyen d'entendre le résultat était de lancer une
// vidéo à ~CHF 3,70.
//
// Flux : auth agent → plan (le même mur que la génération) → Gemini TTS → WAV rendu
// en base64 dans la réponse.
//
// ⛔ RIEN N'EST STOCKÉ, et aucune ligne n'est écrite : un aperçu n'est pas une
// production. Il ne consomme donc AUCUN quota mensuel — ce qui le borne est ailleurs :
// le plan, un texte plafonné à 240 caractères (`LABS_PREVIEW_MAX_CHARS`), et un débit
// par agent. Sans ce dernier, un agent connecté pourrait marteler Gemini à volonté.
//
// Coût : ~0,01 $ l'aperçu (Gemini TTS Flash), contre ~3,70 CHF la vidéo qu'il évite
// de rater.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import {
  LABS_PREVIEW_MAX_CHARS, LABS_TTS_MODEL,
  base64ToBytes, cleanVoice, cleanVoiceLang, labsQuotaFor, labsVoiceoverPrompt,
  pcmDurationSeconds, pcmToWav, sampleRateFromMime,
} from '../_shared/labs.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Débit par agent — la seule chose qui borne un geste qui n'écrit rien.
 *
 * ⚠ En MÉMOIRE de l'isolat, donc approximatif : plusieurs isolats servent la même
 * fonction et un redémarrage remet le compteur à zéro. C'est assumé — le but est
 * d'empêcher la boucle accidentelle (un doigt qui reste sur le bouton), pas de tenir
 * un quota comptable. Le mur qui compte reste le PLAN.
 */
const FENETRE_MS = 60_000
const MAX_PAR_FENETRE = 12
const compteur = new Map<string, { n: number; depuis: number }>()

function tropVite(userId: string): boolean {
  const maintenant = Date.now()
  const e = compteur.get(userId)
  if (!e || maintenant - e.depuis > FENETRE_MS) {
    compteur.set(userId, { n: 1, depuis: maintenant })
    return false
  }
  e.n += 1
  return e.n > MAX_PAR_FENETRE
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase } = auth

  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY') ?? ''
  if (!apiKey) return json({ error: 'provider_not_configured' }, 503)

  let body: { text?: string; voiceName?: string; voiceLang?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  // Le texte de l'aperçu : plafonné plus court que la narration elle-même.
  const brut = typeof body.text === 'string' ? body.text.replace(/[ \t]+/g, ' ').trim() : ''
  if (brut.length === 0) return json({ error: 'invalid_prompt' }, 400)
  const texte = brut.slice(0, LABS_PREVIEW_MAX_CHARS)
  const voice = cleanVoice(body.voiceName)
  const lang = cleanVoiceLang(body.voiceLang)

  // Le même mur que la génération : écouter une voix est déjà un usage du studio.
  const { data: agency } = await supabase.from('agencies').select('plan').eq('id', profile.agency_id).single()
  if (labsQuotaFor(agency?.plan as string | null, 'video') === 0) return json({ error: 'upgrade_required' }, 403)

  if (tropVite(user.id)) return json({ error: 'too_many_previews' }, 429)

  let ttsJson: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${LABS_TTS_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: labsVoiceoverPrompt(texte, lang) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    })
    if (!res.ok) {
      console.error('labs-voice-preview tts:', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return json({ error: 'voiceover_failed' }, 502)
    }
    ttsJson = await res.json()
  } catch (e) {
    console.error('labs-voice-preview tts fetch:', redactedErrorMessage(e))
    return json({ error: 'voiceover_failed' }, 502)
  }

  const part = (ttsJson.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
  if (!part?.inlineData?.data) return json({ error: 'voiceover_failed' }, 502)

  const pcm = base64ToBytes(part.inlineData.data)
  const rate = sampleRateFromMime(part.inlineData.mimeType)
  const wav = pcmToWav(pcm, rate)

  // ⚠ Le WAV repart en base64 dans le CORPS, jamais par une URL : rien n'est déposé,
  // donc il n'y a rien à purger ni à protéger par une signature.
  let binaire = ''
  for (let i = 0; i < wav.length; i += 0x8000) {
    binaire += String.fromCharCode(...wav.subarray(i, i + 0x8000))
  }

  return json({
    audio: btoa(binaire),
    mime: 'audio/wav',
    durationS: Math.round(pcmDurationSeconds(pcm.length, rate) * 10) / 10,
    voice,
    lang,
    truncated: brut.length > LABS_PREVIEW_MAX_CHARS,
  })
})
