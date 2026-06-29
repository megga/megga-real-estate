// supabase/functions/idx-feed/index.ts
//
// Feed IDX 3.01 (mode PULL) — endpoint que le portail (immobilier.ch) va
// CHERCHER périodiquement pour importer les annonces de l'agence.
//
// Auth : token de feed par agence (agency_syndication_config.idx_feed_token),
// passé en ?token=… ou Authorization: Bearer …. PAS de JWT Supabase
// (verify_jwt=false dans config.toml) — l'appelant est un serveur tiers.
//
// Read-only : un poll ne mute rien (idempotent, cacheable). L'inscription d'un
// bien au feed se fait ailleurs (UI / outils WhatsApp → property_syndications).
//
// La sérialisation IDX vit dans _shared/idx-mapper.ts (helper pur, testé).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildIdxFeed, type IdxProperty, type IdxAgency } from '../_shared/idx-mapper.ts'

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

  const agencyId = config.agency_id as string

  // 2) Charger l'agence (bloc contact IDX).
  const { data: agencyRow, error: agencyErr } = await supabase
    .from('agencies')
    .select('id, name, address, city, canton, phone, email, logo_url')
    .eq('id', agencyId)
    .maybeSingle()

  if (agencyErr || !agencyRow) return txt('Internal Error', 500)

  const agency: IdxAgency = {
    id: agencyRow.id,
    name: agencyRow.name,
    street: agencyRow.address,
    city: agencyRow.city,
    canton: agencyRow.canton,
    phone: agencyRow.phone,
    email: agencyRow.email,
    logoUrl: agencyRow.logo_url,
  }

  // 3) Biens inscrits au feed de ce portail, encore actifs.
  const { data: syndRows, error: syndErr } = await supabase
    .from('property_syndications')
    .select(
      `external_ref, status,
       properties:property_id (
         id, type, transaction_type, title, description, price, charges_monthly,
         currency, rooms, surface_m2, floor, year_built, address, postal_code,
         city, canton, availability_date, photos, mandate_expires_at, updated_at,
         status, deleted_at
       )`,
    )
    .eq('agency_id', agencyId)
    .eq('portal', portal)
    .in('status', ['queued', 'published'])

  if (syndErr) return txt('Internal Error', 500)

  const properties: IdxProperty[] = (syndRows ?? [])
    .map((s: Record<string, unknown>) => {
      const p = s.properties as Record<string, unknown> | null
      if (!p) return null
      // Ne syndiquer que les biens actifs non supprimés.
      if (p.status !== 'active' || p.deleted_at != null) return null
      const id = String(p.id)
      return {
        id,
        ref: id,
        type: p.type as string | null,
        transactionType: p.transaction_type as string | null,
        title: p.title as string | null,
        description: p.description as string | null,
        price: p.price != null ? Number(p.price) : null,
        chargesMonthly: p.charges_monthly != null ? Number(p.charges_monthly) : null,
        currency: p.currency as string | null,
        rooms: p.rooms != null ? Number(p.rooms) : null,
        surfaceM2: p.surface_m2 != null ? Number(p.surface_m2) : null,
        floor: p.floor as number | null,
        yearBuilt: p.year_built as number | null,
        address: p.address as string | null,
        postalCode: p.postal_code as string | null,
        city: p.city as string | null,
        canton: p.canton as string | null,
        availabilityDate: p.availability_date as string | null,
        photos: (p.photos as string[] | null) ?? [],
        publishUntil: p.mandate_expires_at as string | null,
        updatedAt: p.updated_at as string | null,
        externalRef: s.external_ref as string | null,
        listingUrl: LISTING_BASE_URL ? `${LISTING_BASE_URL}/${id}` : null,
      } as IdxProperty
    })
    .filter((p): p is IdxProperty => p !== null)

  const feed = buildIdxFeed(properties, agency, { senderId: config.idx_sender_id as string })

  return txt(feed)
})
