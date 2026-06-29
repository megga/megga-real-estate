// supabase/functions/idx-feed/index.ts
//
// Feed IDX 3.01 (mode PULL) — endpoint que le portail va CHERCHER, OU endpoint de
// PRÉVISUALISATION/debug du CSV exact qui sera poussé par FTP (idx-syndicate).
//
// Auth : token de feed par agence (agency_syndication_config.idx_feed_token),
// passé en ?token=… ou Authorization: Bearer …. PAS de JWT Supabase
// (verify_jwt=false). Read-only : un poll ne mute rien.
//
// La génération du feed vit dans _shared/idx-feed-core.ts (partagé avec le push).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildAgencyIdxFeed } from '../_shared/idx-feed-core.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LISTING_BASE_URL = Deno.env.get('IDX_LISTING_BASE_URL') ?? '' // ex. https://app.megga.ch/listing
const DEFAULT_PORTAL = 'immobilier_ch'

function txt(body: string, status = 200, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

serve(async (req) => {
  if (req.method !== 'GET') return txt('Method Not Allowed', 405)

  const url = new URL(req.url)
  const token =
    url.searchParams.get('token') ??
    (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '')
  const portal = url.searchParams.get('portal') ?? DEFAULT_PORTAL

  if (!token) return txt('Unauthorized', 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // 1) Résoudre le token → agence (et n'accepter que les feeds activés).
  const { data: config, error: configErr } = await supabase
    .from('agency_syndication_config')
    .select('agency_id, idx_enabled, idx_sender_id')
    .eq('idx_feed_token', token)
    .maybeSingle()

  if (configErr) return txt('Internal Error', 500)
  if (!config || !config.idx_enabled) return txt('Unauthorized', 401)

  // 2) Générer le feed via le cœur partagé.
  try {
    const feed = await buildAgencyIdxFeed(supabase, config.agency_id as string, portal, {
      senderId: config.idx_sender_id as string,
      listingBaseUrl: LISTING_BASE_URL || null,
    })
    if (!feed.agencyFound) return txt('Internal Error', 500)
    return txt(feed.csv)
  } catch (err) {
    console.error('idx-feed build failed:', (err as Error)?.message ?? 'error')
    return txt('Internal Error', 500)
  }
})
