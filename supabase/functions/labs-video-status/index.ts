// supabase/functions/labs-video-status/index.ts
// Labs — l'état d'une vidéo en file d'attente, et sa FINALISATION quand elle aboutit.
//
// L'écran l'appelle toutes les quelques secondes tant qu'une vidéo est `generating`.
// Quand fal.ai répond COMPLETED :
//   1. si une voix off existe, la vidéo (rendue sans audio) et la piste WAV sont
//      multiplexées (`fal-ai/ffmpeg-api/merge-audio-video`, synchrone) ;
//   2. le fichier final est recopié sur R2 — l'URL de fal.ai n'est pas un stockage ;
//   3. la ligne passe `ready`, l'événement d'audit est écrit (acteur IA).
// Au-delà de 15 minutes sans réponse, la ligne passe `failed` (`timeout`).
//
// ⚠ Rien n'est repris par un cron : une vidéo dont l'écran a été fermé reste
// `generating` jusqu'au prochain appel — et fal.ai garde le résultat plusieurs jours.
// Un balayage pg_cron est le complément naturel si cela devient gênant.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { safeFetchResponse } from '../_shared/safe-fetch.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { r2Config, r2Put } from '../_shared/r2.ts'
import { LABS_MUX_ENDPOINT, isUuid } from '../_shared/labs.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_GENERATION_MS = 15 * 60 * 1000
/** Une vidéo 1080p de 30 s tient largement ; au-delà, on garde l'URL du fournisseur. */
const MAX_VIDEO_BYTES = 120_000_000

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function falGet(url: string, key: string, timeoutMs = 20_000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Authorization: `Key ${key}` }, signal: ctrl.signal })
    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase } = auth

  const falKey = Deno.env.get('FAL_KEY') ?? ''
  if (!falKey) return json({ error: 'provider_not_configured' }, 503)

  let body: { assetId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  if (!isUuid(body.assetId)) return json({ error: 'invalid_asset' }, 400)

  const { data: asset } = await supabase
    .from('labs_assets').select('*')
    .eq('id', body.assetId).eq('agency_id', profile.agency_id).eq('kind', 'video').maybeSingle()
  if (!asset) return json({ error: 'asset_not_found' }, 404)

  // Terminal : on rend la ligne telle quelle.
  if (asset.status === 'ready' || asset.status === 'failed') return json({ asset })

  const fail = async (code: string) => {
    const { data } = await supabase
      .from('labs_assets')
      .update({ status: 'failed', error_code: code, completed_at: new Date().toISOString() })
      .eq('id', asset.id).select('*').single()
    return json({ asset: data ?? { ...asset, status: 'failed', error_code: code } })
  }

  if (Date.now() - new Date(asset.created_at as string).getTime() > MAX_GENERATION_MS) return await fail('timeout')
  if (!asset.provider_status_url || !asset.provider_response_url) return json({ asset })

  // L'état chez fal.ai.
  let statusBody: { status?: string; queue_position?: number } | null = null
  try {
    const r = await falGet(asset.provider_status_url as string, falKey)
    if (r.ok) statusBody = r.body as { status?: string; queue_position?: number }
    else if (r.status === 404 || r.status >= 500) console.error('labs-video-status fal status:', r.status)
  } catch (e) {
    console.error('labs-video-status fal status fetch:', redactedErrorMessage(e))
  }
  if (!statusBody) return json({ asset })
  if (statusBody.status === 'FAILED' || statusBody.status === 'ERROR') return await fail('provider_failed')
  if (statusBody.status !== 'COMPLETED') {
    return json({ asset, queuePosition: statusBody.queue_position ?? null })
  }

  // Le résultat.
  let videoUrl: string | null = null
  try {
    const r = await falGet(asset.provider_response_url as string, falKey, 30_000)
    if (!r.ok) {
      console.error('labs-video-status fal result:', r.status)
      return await fail('provider_failed')
    }
    videoUrl = ((r.body as { video?: { url?: string } })?.video?.url) ?? null
  } catch (e) {
    console.error('labs-video-status fal result fetch:', redactedErrorMessage(e))
    return json({ asset })
  }
  if (!videoUrl) return await fail('provider_failed')

  // Voix off : multiplexage synchrone (quelques secondes).
  if (asset.voiceover_url) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 120_000)
      const res = await fetch(`https://fal.run/${LABS_MUX_ENDPOINT}`, {
        method: 'POST',
        headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, audio_url: asset.voiceover_url }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        console.error('labs-video-status mux:', res.status, (await res.text().catch(() => '')).slice(0, 300))
        return await fail('mux_failed')
      }
      const muxed = await res.json() as { video?: { url?: string } }
      if (!muxed.video?.url) return await fail('mux_failed')
      videoUrl = muxed.video.url
    } catch (e) {
      console.error('labs-video-status mux fetch:', redactedErrorMessage(e))
      return await fail('mux_failed')
    }
  }

  // Recopie sur R2. Si le fichier dépasse le plafond, l'URL du fournisseur reste.
  let finalUrl = videoUrl
  let sizeBytes: number | null = null
  const r2 = r2Config()
  if (r2) {
    try {
      const file = await safeFetchResponse(videoUrl, { maxRedirects: 3, maxBytes: MAX_VIDEO_BYTES, timeoutMs: 90_000 })
      const put = await r2Put(r2, `labs/${profile.agency_id}/${asset.id}.mp4`, file.bytes, 'video/mp4')
      if (put.ok) {
        finalUrl = put.url
        sizeBytes = file.bytes.length
      } else {
        console.error('labs-video-status r2:', put.err)
      }
    } catch (e) {
      console.error('labs-video-status mirror:', redactedErrorMessage(e))
    }
  }

  const meta = (asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {}) as Record<string, unknown>
  const { data: ready, error: updErr } = await supabase
    .from('labs_assets')
    .update({
      status: 'ready',
      url: finalUrl,
      completed_at: new Date().toISOString(),
      metadata: { ...meta, bytes: sizeBytes, mirrored: finalUrl !== videoUrl },
    })
    .eq('id', asset.id)
    .select('*')
    .single()
  if (updErr || !ready) {
    console.error('labs-video-status update:', redactedErrorMessage(updErr))
    return json({ error: 'record_failed' }, 500)
  }

  const { error: auditErr } = await supabase.from('activity_events').insert({
    agency_id: profile.agency_id,
    actor_id: null,
    actor_kind: 'ai',
    action: 'labs_video_generated',
    entity_type: 'labs_asset',
    entity_id: asset.id,
    severity: 'info',
    category: 'ai',
    metadata: {
      profile_id: user.id,
      folder_id: asset.folder_id,
      source_asset_id: asset.source_asset_id,
      model: asset.model,
      duration_s: asset.duration_s,
      voiceover: !!asset.voiceover_url,
      cost_chf: asset.cost_chf,
      mirrored: finalUrl !== videoUrl,
    },
  })
  if (auditErr) console.error('labs-video-status audit:', redactedErrorMessage(auditErr))

  return json({ asset: ready })
})
