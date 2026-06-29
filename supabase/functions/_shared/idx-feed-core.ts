// supabase/functions/_shared/idx-feed-core.ts
//
// Génération du feed IDX d'une agence depuis la DB — partagé par idx-feed (pull)
// et idx-syndicate (push FTP). I/O Deno (SupabaseClient) → pas couvert en unit ;
// toute la logique de mapping PURE vit dans idx-mapper.ts (testée).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildIdxFeed,
  propertyRowToIdxInput,
  agencyRowToIdxAgency,
  type IdxProperty,
  type IdxPropertyRow,
  type IdxAgencyRow,
} from './idx-mapper.ts'

// Colonnes properties nécessaires au feed (+ status/deleted_at pour le filtrage).
const FEED_PROPERTY_COLUMNS =
  'id, type, transaction_type, title, description, price, charges_monthly, ' +
  'currency, rooms, surface_m2, floor, year_built, address, postal_code, city, canton, ' +
  'availability_date, photos, mandate_expires_at, updated_at, status, deleted_at'

export interface AgencyFeed {
  agencyFound: boolean
  csv: string
  propertyIds: string[]
}

/** Construit le feed IDX d'une agence : biens inscrits (queued/published) au portail,
 *  encore actifs et non supprimés. Renvoie le CSV + les ids inclus (pour MAJ d'état). */
export async function buildAgencyIdxFeed(
  supabase: SupabaseClient,
  agencyId: string,
  portal: string,
  opts: { senderId?: string; listingBaseUrl?: string | null } = {},
): Promise<AgencyFeed> {
  const { data: agencyRow, error: agencyErr } = await supabase
    .from('agencies')
    .select('id, name, address, city, canton, phone, email, logo_url')
    .eq('id', agencyId)
    .maybeSingle()
  if (agencyErr) throw new Error(`agency load: ${agencyErr.message}`)
  if (!agencyRow) return { agencyFound: false, csv: '', propertyIds: [] }

  const { data: syndRows, error: syndErr } = await supabase
    .from('property_syndications')
    .select(`external_ref, status, properties:property_id (${FEED_PROPERTY_COLUMNS})`)
    .eq('agency_id', agencyId)
    .eq('portal', portal)
    .in('status', ['queued', 'published'])
  if (syndErr) throw new Error(`syndications load: ${syndErr.message}`)

  const properties: IdxProperty[] = []
  const propertyIds: string[] = []
  for (const s of (syndRows ?? []) as Array<Record<string, unknown>>) {
    const p = s.properties as (IdxPropertyRow & { status?: string; deleted_at?: string | null }) | null
    if (!p) continue
    // Ne syndiquer que les biens actifs non supprimés.
    if (p.status !== 'active' || p.deleted_at != null) continue
    properties.push(
      propertyRowToIdxInput(p, {
        externalRef: (s.external_ref as string | null) ?? null,
        listingBaseUrl: opts.listingBaseUrl ?? null,
      }),
    )
    propertyIds.push(p.id)
  }

  const csv = buildIdxFeed(properties, agencyRowToIdxAgency(agencyRow as IdxAgencyRow), {
    senderId: opts.senderId,
  })
  return { agencyFound: true, csv, propertyIds }
}
