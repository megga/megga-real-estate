// supabase/functions/labs-video-status/index.ts
// Labs — l'état d'une vidéo en file d'attente, et sa FINALISATION quand elle aboutit.
//
// L'écran l'appelle toutes les quelques secondes tant qu'une vidéo est `generating`.
// Quand fal.ai répond COMPLETED :
//   1. un BAIL est pris (`labs_asset_claim_finalize`) — un seul appel finalise ;
//   2. si une voix off existe, la vidéo (rendue sans audio) et la piste WAV sont
//      multiplexées (`fal-ai/ffmpeg-api/merge-audio-video`, synchrone) ;
//   3. le fichier final est recopié sur R2 — l'URL de fal.ai n'est pas un stockage ;
//   4. la ligne passe `ready`, l'événement d'audit est écrit (acteur IA).
//
// ⛔ L'ÂGE NE TRANCHE QU'APRÈS fal.ai (`labsVideoSuite`). Rien n'est repris par un cron :
// une vidéo dont l'écran a été quitté reste `generating` jusqu'au prochain appel — et
// fal.ai garde le résultat plusieurs jours. Tester le délai d'abord, comme avant la
// revue du 21.09.2026, jetait et remboursait une vidéo que fal avait rendue (et
// facturée). Le délai de 15 min ne vaut que pour ce que fal dit ENCORE en cours.
//
// ⛔ UN SEUL FINALISEUR. Chaque écran ouvert sonde, et une finalisation dure bien plus
// que l'intervalle du sondage (mux jusqu'à 120 s, copie jusqu'à 90 s). Sans bail, chaque
// tour refaisait le mux payant et la copie, écrivait un événement de plus, et un échec
// concurrent pouvait réécrire `ready` en `failed` — vidéo livrée ET remboursée. Les
// écritures terminales sont en plus CONDITIONNELLES (`status` encore en cours).
//
// ⛔ Un refus PASSAGER de fal.ai (429, 5xx, délai) rend le bail et attend le tour
// suivant : un résultat payé ne se jette pas sur une panne d'une minute.
//
// ⛔ Le coût fournisseur ne sort pas : toute réponse passe par `assetPourAgent`.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { safeFetchResponse } from '../_shared/safe-fetch.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { r2Config, r2Put } from '../_shared/r2.ts'
import {
  LABS_MUX_ENDPOINT, LABS_VIDEO_ABANDON_MS, LABS_VIDEO_DELAI_MS,
  assetPourAgent, falCancelUrl, falRefusPassager, isUuid, labsVideoSuite,
} from '../_shared/labs.ts'
import { rembourserCredits } from '../_shared/credits-edge.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Une vidéo 1080p de 30 s tient largement ; au-delà, on garde l'URL du fournisseur. */
const MAX_VIDEO_BYTES = 120_000_000
/** La durée du bail : un mux (120 s) et une copie (90 s) au plus, avec de la marge. */
const BAIL_S = 300

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

/** Abandonner une requête que fal.ai tient encore en file : elle ne sera plus facturée. Sans garantie. */
async function falCancel(statusUrl: string | null, key: string): Promise<void> {
  const url = falCancelUrl(statusUrl)
  if (!url) return
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5_000)
  try {
    await fetch(url, { method: 'PUT', headers: { Authorization: `Key ${key}` }, signal: ctrl.signal })
  } catch (e) {
    console.error('labs-video-status fal cancel:', redactedErrorMessage(e))
  } finally {
    clearTimeout(timer)
  }
}

const EN_COURS = ['pending', 'generating']

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

  const rendreLigne = (row: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    json({ asset: assetPourAgent(row), ...extra })

  // Terminal : on rend la ligne telle quelle.
  if (!EN_COURS.includes(asset.status as string)) return rendreLigne(asset)

  // Un échec du fournisseur, du multiplexage ou du délai REND les crédits : l'agent n'a
  // rien reçu. ⚠ CONDITIONNEL : seul l'appel qui fait passer la ligne en `failed`
  // rembourse ; une ligne déjà terminée par un autre appel est rendue telle quelle.
  const fail = async (code: string) => {
    const { data } = await supabase
      .from('labs_assets')
      .update({ status: 'failed', error_code: code, completed_at: new Date().toISOString(), finalizing_until: null })
      .eq('id', asset.id).in('status', EN_COURS).select('*').maybeSingle()
    if (data) {
      await rembourserCredits(supabase, { agencyId: profile.agency_id, assetId: asset.id as string, reason: code })
      return rendreLigne(data)
    }
    const { data: actuelle } = await supabase.from('labs_assets').select('*').eq('id', asset.id).maybeSingle()
    return rendreLigne(actuelle ?? asset)
  }

  const ageMs = Date.now() - new Date(asset.created_at as string).getTime()

  // Jamais soumise (l'edge de création a échoué entre la ligne et la file) : rien à attendre de fal.
  if (!asset.provider_status_url || !asset.provider_response_url) {
    return ageMs > LABS_VIDEO_DELAI_MS ? await fail('timeout') : rendreLigne(asset)
  }

  // L'état chez fal.ai — AVANT tout jugement sur l'âge.
  let statusBody: { status?: string; queue_position?: number; error?: unknown } | null = null
  try {
    const r = await falGet(asset.provider_status_url as string, falKey)
    if (r.ok) statusBody = r.body as { status?: string; queue_position?: number; error?: unknown }
    else console.error('labs-video-status fal status:', r.status)
  } catch (e) {
    console.error('labs-video-status fal status fetch:', redactedErrorMessage(e))
  }
  const suite = labsVideoSuite({
    ageMs,
    falStatus: typeof statusBody?.status === 'string' ? statusBody.status : null,
    falErreur: statusBody?.error != null && statusBody.error !== '',
  })
  if (suite.suite === 'attendre') return rendreLigne(asset, { queuePosition: statusBody?.queue_position ?? null })
  if (suite.suite === 'echouer') {
    if (suite.code === 'timeout' && statusBody) await falCancel(asset.provider_status_url as string, falKey)
    return await fail(suite.code)
  }

  // fal.ai a rendu la vidéo : le BAIL, puis la finalisation. Un autre appel qui le tient
  // déjà finalise ; celui-ci rend la ligne telle quelle.
  const { data: pris, error: bailErr } = await supabase.rpc('labs_asset_claim_finalize', {
    p_asset: asset.id, p_agency: profile.agency_id, p_lease_seconds: BAIL_S,
  })
  if (bailErr) {
    console.error('labs-video-status bail:', redactedErrorMessage(bailErr))
    return rendreLigne(asset)
  }
  if (pris !== true) return rendreLigne(asset)

  // Une panne passagère rend le bail : le tour suivant reprend. Passé un jour, on abandonne.
  const reessayer = async (code: string) => {
    if (ageMs > LABS_VIDEO_ABANDON_MS) return await fail(code)
    await supabase.from('labs_assets').update({ finalizing_until: null }).eq('id', asset.id)
    return rendreLigne(asset)
  }

  // Le résultat.
  let videoUrl: string | null = null
  try {
    const r = await falGet(asset.provider_response_url as string, falKey, 30_000)
    if (!r.ok) {
      console.error('labs-video-status fal result:', r.status)
      return falRefusPassager(r.status) ? await reessayer('provider_failed') : await fail('provider_failed')
    }
    videoUrl = ((r.body as { video?: { url?: string } })?.video?.url) ?? null
  } catch (e) {
    console.error('labs-video-status fal result fetch:', redactedErrorMessage(e))
    return await reessayer('provider_failed')
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
        return falRefusPassager(res.status) ? await reessayer('mux_failed') : await fail('mux_failed')
      }
      const muxed = await res.json() as { video?: { url?: string } }
      if (!muxed.video?.url) return await fail('mux_failed')
      videoUrl = muxed.video.url
    } catch (e) {
      console.error('labs-video-status mux fetch:', redactedErrorMessage(e))
      return await reessayer('mux_failed')
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
      finalizing_until: null,
      metadata: { ...meta, bytes: sizeBytes, mirrored: finalUrl !== videoUrl },
    })
    .eq('id', asset.id)
    .in('status', EN_COURS)
    .select('*')
    .maybeSingle()
  if (updErr) {
    console.error('labs-video-status update:', redactedErrorMessage(updErr))
    return json({ error: 'record_failed' }, 500)
  }
  // Terminée entre-temps par un autre chemin : on ne réécrit rien, on ne journalise rien.
  if (!ready) {
    const { data: actuelle } = await supabase.from('labs_assets').select('*').eq('id', asset.id).maybeSingle()
    return rendreLigne(actuelle ?? asset)
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
    // ⛔ Jamais le coût fournisseur ici : le journal d'audit se lit dans toute l'agence.
    metadata: {
      profile_id: user.id,
      folder_id: asset.folder_id,
      source_asset_id: asset.source_asset_id,
      model: asset.model,
      duration_s: asset.duration_s,
      voiceover: !!asset.voiceover_url,
      credits: asset.credits,
      mirrored: finalUrl !== videoUrl,
    },
  })
  if (auditErr) console.error('labs-video-status audit:', redactedErrorMessage(auditErr))

  return rendreLigne(ready)
})
