// supabase/functions/labs-video/index.ts
// Labs — soumission d'une vidéo (Seedance 2.5 sur fal.ai), avec voix off optionnelle.
//
// Flux :
//   1. requireAgentAuth → agency_id de confiance
//   2. Corps : prompt, image source (production de l'agence, facultative), narration,
//      voix, durée, résolution, dossier
//   3. Plan (Pro et plus), puis DÉBIT des crédits une fois la durée connue — rendus si
//      fal.ai refuse la soumission (`credits_refund`, et `labs-video-status` rend aussi
//      quand le fournisseur échoue en file)
//   4. Ligne `labs_assets` en `pending` — un échec plus bas laisse une trace
//   5. Voix off : Gemini TTS → WAV sur R2 ; une narration > 30 s est refusée ICI,
//      avant de payer la vidéo.
//      ⛔ CE N'EST PAS SEEDANCE QUI PARLE. Seedance 2.5 génère bien un son — effets,
//      et même de la parole lip-syncée — mais on ne choisit PAS ce qui est dit : le
//      modèle invente. Une annonce immobilière exige le texte de l'agent, mot pour
//      mot. D'où une piste SÉPARÉE (Gemini TTS), une vidéo demandée MUETTE, et un
//      multiplexage à l'arrivée. Le prix de ce choix est écrit : avec voix off, pas
//      d'ambiance Seedance ; sans, pas de narration. Les deux ne cohabitent pas.
//      ⚠ Une troisième voie existe — passer le WAV en `audio_urls` à l'endpoint
//      `reference-to-video`, qui « génère le son et l'image dans le même espace
//      latent » et s'en servirait comme signal de rythme. La doc de fal ne dit PAS
//      si cette piste est conservée dans la sortie ; non éprouvé, donc non construit.
//   6. fal.ai (file d'attente) : image-to-video si source, text-to-video sinon.
//      Avec narration, la vidéo est demandée SANS audio natif — la piste est posée par
//      `labs-video-status` (multiplexage) quand la vidéo aboutit. Deux sons superposés
//      s'écraseraient ; une narration seule sur un travelling est le format attendu.
//   7. Réponse immédiate : l'écran interroge `labs-video-status`
//
// Coût : ~0,46 $/s en 720p, ~1,04 $/s en 1080p (barème au jeton, cf. `_shared/labs.ts`).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { r2Config, r2Put } from '../_shared/r2.ts'
import {
  LABS_TTS_MODEL, LABS_VIDEO_ENDPOINTS, LABS_VIDEO_MAX_S, LABS_VIDEO_RESOLUTIONS, type LabsVideoResolution,
  base64ToBytes, cleanPrompt, cleanVoice, cleanVoiceLang, cleanVoiceover, isUuid, labsOuvertAuPlan, labsVideoCostChf,
  labsVideoDuration, labsVideoPrompt, labsVoiceoverPrompt, pcmDurationSeconds, pcmToWav, sampleRateFromMime,
} from '../_shared/labs.ts'
import { creditsPourVideo } from '../_shared/credits.ts'
import { debiterCredits, rembourserCredits, reveillerAutoRecharge } from '../_shared/credits-edge.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VideoRequest {
  prompt: string
  folderId?: string | null
  sourceAssetId?: string | null
  voiceoverText?: string | null
  voiceName?: string
  voiceLang?: string
  durationS?: number | null
  resolution?: LabsVideoResolution
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

  const falKey = Deno.env.get('FAL_KEY') ?? ''
  const googleKey = Deno.env.get('GOOGLE_AI_API_KEY') ?? ''
  if (!falKey) return json({ error: 'provider_not_configured' }, 503)
  const r2 = r2Config()
  if (!r2) return json({ error: 'storage_not_configured' }, 503)

  let body: VideoRequest
  try {
    body = await req.json() as VideoRequest
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  // 2. Validation.
  const prompt = cleanPrompt(body.prompt)
  if (!prompt) return json({ error: 'invalid_prompt' }, 400)
  const folderId = body.folderId ?? null
  if (folderId !== null && !isUuid(folderId)) return json({ error: 'invalid_folder' }, 400)
  const sourceAssetId = body.sourceAssetId ?? null
  if (sourceAssetId !== null && !isUuid(sourceAssetId)) return json({ error: 'invalid_source' }, 400)
  const resolution: LabsVideoResolution = (LABS_VIDEO_RESOLUTIONS as readonly string[]).includes(String(body.resolution))
    ? (body.resolution as LabsVideoResolution)
    : '720p'
  const voiceoverRaw = body.voiceoverText ?? null
  if (voiceoverRaw !== null && voiceoverRaw.trim() !== '' && cleanVoiceover(voiceoverRaw) === null) {
    return json({ error: 'voiceover_too_long' }, 422)
  }
  const voiceover = voiceoverRaw ? cleanVoiceover(voiceoverRaw) : null
  const voiceLang = cleanVoiceLang(body.voiceLang)
  if (voiceover && !googleKey) return json({ error: 'provider_not_configured' }, 503)
  const voice = cleanVoice(body.voiceName)
  const requestedS = typeof body.durationS === 'number' ? body.durationS : null

  if (folderId) {
    const { data: folder } = await supabase
      .from('labs_folders').select('id').eq('id', folderId).eq('agency_id', profile.agency_id).maybeSingle()
    if (!folder) return json({ error: 'folder_not_found' }, 404)
  }

  let sourceUrl: string | null = null
  if (sourceAssetId) {
    const { data: src } = await supabase
      .from('labs_assets').select('id, url, kind, status')
      .eq('id', sourceAssetId).eq('agency_id', profile.agency_id).is('deleted_at', null).maybeSingle()
    if (!src || !src.url || src.kind === 'video' || src.status !== 'ready') return json({ error: 'source_not_found' }, 404)
    sourceUrl = src.url as string
  }

  // 3. Plan. ⚠ Le DÉBIT vient plus bas, une fois la durée connue : avec une voix off,
  // c'est la narration qui décide de la durée, donc du prix — et elle n'est mesurée
  // qu'après la synthèse (quelques centimes, qu'on accepte de perdre sur un refus).
  const { data: agency } = await supabase.from('agencies').select('plan').eq('id', profile.agency_id).single()
  if (!labsOuvertAuPlan(agency?.plan as string | null)) return json({ error: 'upgrade_required' }, 403)

  // 4. La ligne d'abord : ce qui échoue ensuite se lit dans `error_code`.
  const assetId = crypto.randomUUID()
  const endpoint = sourceUrl ? LABS_VIDEO_ENDPOINTS.imageToVideo : LABS_VIDEO_ENDPOINTS.textToVideo
  const { error: insErr } = await supabase.from('labs_assets').insert({
    id: assetId,
    agency_id: profile.agency_id,
    folder_id: folderId,
    created_by: user.id,
    kind: 'video',
    status: 'pending',
    prompt,
    voiceover_text: voiceover,
    voiceover_voice: voiceover ? voice : null,
    voiceover_lang: voiceover ? voiceLang : null,
    source_asset_id: sourceAssetId,
    thumbnail_url: sourceUrl,
    aspect_ratio: sourceUrl ? null : '16:9',
    model: endpoint,
    provider: 'fal',
    metadata: { resolution, requested_s: requestedS },
  })
  if (insErr) {
    console.error('labs-video insert:', redactedErrorMessage(insErr))
    return json({ error: 'record_failed' }, 500)
  }
  // `fail` rembourse AUSSI : un débit sans vidéo n'a pas de raison de rester. Avant le
  // débit, `credits_refund` ne trouve rien et ne rend rien — l'appel est sûr partout.
  const fail = async (code: string, status: number) => {
    await supabase.from('labs_assets').update({ status: 'failed', error_code: code, completed_at: new Date().toISOString() }).eq('id', assetId)
    await rembourserCredits(supabase, { agencyId: profile.agency_id, assetId, reason: code })
    return json({ error: code, assetId }, status)
  }

  // 5. Voix off.
  let voiceoverUrl: string | null = null
  let voiceoverSeconds: number | null = null
  if (voiceover) {
    let ttsJson: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${LABS_TTS_MODEL}:generateContent?key=${googleKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ⚠ La CONSIGNE précède le texte : Gemini TTS n'a pas de paramètre de langue.
          contents: [{ parts: [{ text: labsVoiceoverPrompt(voiceover, voiceLang) }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      })
      if (!res.ok) {
        console.error('labs-video tts:', res.status, (await res.text().catch(() => '')).slice(0, 300))
        return await fail('voiceover_failed', 502)
      }
      ttsJson = await res.json()
    } catch (e) {
      console.error('labs-video tts fetch:', redactedErrorMessage(e))
      return await fail('voiceover_failed', 502)
    }
    const audioPart = (ttsJson.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
    if (!audioPart?.inlineData?.data) return await fail('voiceover_failed', 502)
    const pcm = base64ToBytes(audioPart.inlineData.data)
    const rate = sampleRateFromMime(audioPart.inlineData.mimeType)
    voiceoverSeconds = pcmDurationSeconds(pcm.length, rate)
    // La borne haute de Seedance : une narration plus longue serait coupée net.
    if (voiceoverSeconds + 1 > LABS_VIDEO_MAX_S) return await fail('voiceover_too_long', 422)
    const put = await r2Put(r2, `labs/${profile.agency_id}/${assetId}-vo.wav`, pcmToWav(pcm, rate), 'audio/wav')
    if (!put.ok) {
      console.error('labs-video r2 vo:', put.err)
      return await fail('storage_failed', 502)
    }
    voiceoverUrl = put.url
  }

  // 6. Le prix est connu : DÉBITER, puis seulement soumettre à fal.ai.
  const duration = labsVideoDuration(voiceoverSeconds, requestedS)
  const credits = creditsPourVideo(resolution, Number(duration), !!voiceover)
  const debit = await debiterCredits(supabase, {
    agencyId: profile.agency_id, amount: credits, assetId, actorId: user.id,
    metadata: { kind: 'video', resolution, duration_s: Number(duration), voiceover: !!voiceover },
  })
  if (!debit.ok) {
    await supabase.from('labs_assets').update({ status: 'failed', error_code: 'insufficient_credits', completed_at: new Date().toISOString() }).eq('id', assetId)
    if (debit.error === 'insufficient_credits') return json({ error: 'insufficient_credits', assetId, balance: debit.balance ?? 0, needed: debit.needed ?? credits }, 402)
    return json({ error: 'credits_failed', assetId }, 500)
  }
  if (debit.autoTopupDue) reveillerAutoRecharge(profile.agency_id)

  const falPayload: Record<string, unknown> = {
    prompt: labsVideoPrompt(prompt, !!voiceover),
    resolution,
    duration,
    generate_audio: !voiceover,
    bitrate_mode: 'standard',
  }
  if (sourceUrl) {
    falPayload.image_url = sourceUrl
    falPayload.aspect_ratio = 'auto'
  } else {
    falPayload.aspect_ratio = '16:9'
  }

  let falJson: { request_id?: string; status_url?: string; response_url?: string }
  try {
    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(falPayload),
    })
    if (!res.ok) {
      console.error('labs-video fal submit:', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return await fail('submission_failed', 502)
    }
    falJson = await res.json()
  } catch (e) {
    console.error('labs-video fal fetch:', redactedErrorMessage(e))
    return await fail('submission_failed', 502)
  }
  if (!falJson.request_id) return await fail('submission_failed', 502)

  const durationS = Number(duration)
  const costChf = labsVideoCostChf(resolution, durationS, !!voiceover)
  const { data: asset, error: updErr } = await supabase
    .from('labs_assets')
    .update({
      status: 'generating',
      duration_s: durationS,
      voiceover_url: voiceoverUrl,
      provider_request_id: falJson.request_id,
      provider_status_url: falJson.status_url ?? null,
      provider_response_url: falJson.response_url ?? null,
      cost_chf: costChf,
      credits,
      metadata: { resolution, requested_s: requestedS, duration, generate_audio: !voiceover, voiceover_s: voiceoverSeconds },
    })
    .eq('id', assetId)
    .select('*')
    .single()
  if (updErr || !asset) {
    console.error('labs-video update:', redactedErrorMessage(updErr))
    return json({ error: 'record_failed', assetId }, 500)
  }

  return json({ asset, credits: { debited: credits, balance: debit.balance ?? null } })
})
