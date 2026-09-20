// supabase/functions/labs-image/index.ts
// Labs — génération d'image (Nano Banana 2 = Gemini 3.1 Flash Image Preview).
//
// Flux :
//   1. requireAgentAuth → agency_id de confiance
//   2. Corps : prompt libre, dossier, image source (une production de l'agence), ratio, taille
//   3. Quota mensuel par plan (le quota « virtual_staging » du catalogue)
//   4. Gemini : prompt de garde + image source en inline (retouche) ou texte seul (création)
//   5. Écriture sur R2, ligne `labs_assets` (`status = 'ready'`), événement d'audit
//
// ⚠ Synchrone, comme `virtual-staging` : Gemini rend l'image dans la réponse (~10 s).
// La vidéo, elle, passe par une file d'attente (`labs-video` + `labs-video-status`).
//
// Coût ~CHF 0,09 l'image en 2K (relevé identique à `virtual-staging`).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { safeFetchResponse, type SafeFetchResult } from '../_shared/safe-fetch.ts'
import { toBase64 } from '../_shared/vision.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { r2Config, r2Put } from '../_shared/r2.ts'
import {
  LABS_IMAGE_MODEL, LABS_IMAGE_RATIOS, type LabsImageRatio,
  base64ToBytes, cleanPrompt, imageExtFor, isUuid, labsImageCostChf, labsImagePrompt,
  labsQuotaFor, monthStartIso,
} from '../_shared/labs.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ImageRequest {
  prompt: string
  folderId?: string | null
  sourceAssetId?: string | null
  aspectRatio?: LabsImageRatio
  imageSize?: '1K' | '2K'
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

  // 1. Auth AVANT toute lecture du corps.
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase } = auth

  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY') ?? ''
  if (!apiKey) return json({ error: 'provider_not_configured' }, 503)
  const r2 = r2Config()
  if (!r2) return json({ error: 'storage_not_configured' }, 503)

  let body: ImageRequest
  try {
    body = await req.json() as ImageRequest
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  // 2. Validation.
  const prompt = cleanPrompt(body.prompt)
  if (!prompt) return json({ error: 'invalid_prompt' }, 400)
  const imageSize = body.imageSize === '1K' ? '1K' : '2K'
  const aspectRatio = (LABS_IMAGE_RATIOS as readonly string[]).includes(String(body.aspectRatio))
    ? (body.aspectRatio as LabsImageRatio)
    : null
  const folderId = body.folderId ?? null
  if (folderId !== null && !isUuid(folderId)) return json({ error: 'invalid_folder' }, 400)
  const sourceAssetId = body.sourceAssetId ?? null
  if (sourceAssetId !== null && !isUuid(sourceAssetId)) return json({ error: 'invalid_source' }, 400)

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

  // 3. Plan et quota.
  const { data: agency } = await supabase.from('agencies').select('plan').eq('id', profile.agency_id).single()
  const quota = labsQuotaFor(agency?.plan as string | null, 'image')
  if (quota === 0) return json({ error: 'upgrade_required', quota: 0 }, 403)

  const { count } = await supabase
    .from('labs_assets')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', profile.agency_id)
    .eq('kind', 'image')
    .neq('status', 'failed')
    .gte('created_at', monthStartIso())
  const usage = count ?? 0
  if (usage >= quota) return json({ error: 'quota_exceeded', usage, quota }, 429)

  // 4. La source, par le fetch sûr (l'URL vient de la base, elle est revalidée quand même).
  let source: SafeFetchResult | null = null
  if (sourceUrl) {
    try {
      source = await safeFetchResponse(sourceUrl, { maxRedirects: 3, maxBytes: 20_000_000, timeoutMs: 15_000 })
    } catch (e) {
      console.error('labs-image source fetch:', redactedErrorMessage(e))
      return json({ error: 'source_unreadable' }, 400)
    }
  }

  const parts: Record<string, unknown>[] = [{ text: labsImagePrompt(prompt, !!source) }]
  if (source) {
    parts.push({ inline_data: { mime_type: source.contentType || 'image/jpeg', data: toBase64(source.bytes) } })
  }
  // Sans source, le ratio demandé s'applique ; avec, Nano Banana 2 garde la géométrie de
  // la photo dès qu'on ne lui en impose pas — c'est ce qu'on veut (les murs ne bougent pas).
  const imageConfig: Record<string, string> = { imageSize }
  if (!source && aspectRatio) imageConfig.aspectRatio = aspectRatio

  let geminiJson: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${LABS_IMAGE_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.4, imageConfig },
      }),
    })
    if (!res.ok) {
      console.error('labs-image gemini:', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return json({ error: 'generation_failed' }, 502)
    }
    geminiJson = await res.json()
  } catch (e) {
    console.error('labs-image gemini fetch:', redactedErrorMessage(e))
    return json({ error: 'generation_failed' }, 502)
  }

  const imagePart = (geminiJson.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)
  if (!imagePart?.inlineData?.data) return json({ error: 'no_image' }, 422)

  // 5. R2 puis la ligne. L'uuid est tiré ICI pour nommer l'objet avant d'insérer.
  const assetId = crypto.randomUUID()
  const { ext, contentType } = imageExtFor(imagePart.inlineData.mimeType)
  const bytes = base64ToBytes(imagePart.inlineData.data)
  const put = await r2Put(r2, `labs/${profile.agency_id}/${assetId}.${ext}`, bytes, contentType)
  if (!put.ok) {
    console.error('labs-image r2:', put.err)
    return json({ error: 'storage_failed' }, 502)
  }

  const costChf = labsImageCostChf(imageSize)
  const { data: asset, error: insErr } = await supabase
    .from('labs_assets')
    .insert({
      id: assetId,
      agency_id: profile.agency_id,
      folder_id: folderId,
      created_by: user.id,
      kind: 'image',
      status: 'ready',
      prompt,
      source_asset_id: sourceAssetId,
      url: put.url,
      thumbnail_url: put.url,
      aspect_ratio: source ? null : aspectRatio,
      model: LABS_IMAGE_MODEL,
      provider: 'gemini',
      cost_chf: costChf,
      metadata: { image_size: imageSize, mime: contentType, bytes: bytes.length },
      completed_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (insErr || !asset) {
    console.error('labs-image insert:', redactedErrorMessage(insErr))
    return json({ error: 'record_failed' }, 500)
  }

  // ⛔ actor_kind 'ai' ⇒ actor_id NULL (CHECK de cohérence) ; l'agent est dans metadata.
  const { error: auditErr } = await supabase.from('activity_events').insert({
    agency_id: profile.agency_id,
    actor_id: null,
    actor_kind: 'ai',
    action: 'labs_image_generated',
    entity_type: 'labs_asset',
    entity_id: assetId,
    severity: 'info',
    category: 'ai',
    metadata: {
      profile_id: user.id,
      folder_id: folderId,
      source_asset_id: sourceAssetId,
      model: LABS_IMAGE_MODEL,
      image_size: imageSize,
      cost_chf: costChf,
      usage: usage + 1,
      quota,
    },
  })
  if (auditErr) console.error('labs-image audit:', redactedErrorMessage(auditErr))

  return json({ asset, usage: { current: usage + 1, quota, remaining: Math.max(0, quota - usage - 1) } })
})
