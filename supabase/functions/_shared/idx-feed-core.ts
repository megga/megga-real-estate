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
  validateIdxProperty,
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
  /** Biens syndiqués (queued/published) considérés, AVANT filtrage validité.
   *  Sert à distinguer « rien à publier » (0) d'« anomalie : tout filtré » (>0). */
  candidateCount: number
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
  if (!agencyRow) return { agencyFound: false, csv: '', propertyIds: [], candidateCount: 0 }

  const { data: syndRows, error: syndErr } = await supabase
    .from('property_syndications')
    .select(`external_ref, status, properties:property_id (${FEED_PROPERTY_COLUMNS})`)
    .eq('agency_id', agencyId)
    .eq('portal', portal)
    .in('status', ['queued', 'published'])
  if (syndErr) throw new Error(`syndications load: ${syndErr.message}`)

  const candidates = (syndRows ?? []) as Array<Record<string, unknown>>
  const properties: IdxProperty[] = []
  const propertyIds: string[] = []
  for (const s of candidates) {
    const p = s.properties as (IdxPropertyRow & { status?: string; deleted_at?: string | null }) | null
    if (!p) continue
    // Ne syndiquer que les biens actifs non supprimés.
    if (p.status !== 'active' || p.deleted_at != null) continue
    const input = propertyRowToIdxInput(p, {
      externalRef: (s.external_ref as string | null) ?? null,
      listingBaseUrl: opts.listingBaseUrl ?? null,
    })
    // Ne JAMAIS émettre un enregistrement IDX incomplet : le gate de complétude du
    // publish ne couvre pas une dégradation ultérieure (édition web d'un bien publié).
    // On saute le bien invalide (logué) plutôt que d'envoyer une ligne cassée au portail.
    const missing = validateIdxProperty(input)
    if (missing.length > 0) {
      console.warn(`idx-feed skip incomplete property ${p.id}: ${missing.join(',')}`)
      continue
    }
    properties.push(input)
    propertyIds.push(p.id)
  }

  const csv = buildIdxFeed(properties, agencyRowToIdxAgency(agencyRow as IdxAgencyRow), {
    senderId: opts.senderId,
  })
  return { agencyFound: true, csv, propertyIds, candidateCount: candidates.length }
}
