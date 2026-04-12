import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SavedSearchFilters {
  context?: 'buy' | 'rent'
  q?: string
  types?: string[]
  minPrice?: string
  maxPrice?: string
  rooms?: string
  bedrooms?: string
  bathrooms?: string
  city?: string
  canton?: string
  lifestyleTags?: string[]
  energyLabel?: string
}

interface SavedSearch {
  id: string
  user_id: string
  name: string
  filters: SavedSearchFilters
  alert_enabled: boolean
  alert_email: string | null
  alert_frequency: 'instant' | 'daily' | 'weekly'
  last_alerted_at: string | null
  results_count: number
}

interface MarketListing {
  id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photos: string[]
  source_url: string
  source_portal: string
  first_seen_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

function shouldProcess(search: SavedSearch): boolean {
  if (!search.alert_enabled || !search.alert_email) return false

  const now = Date.now()
  const last = search.last_alerted_at ? new Date(search.last_alerted_at).getTime() : 0

  switch (search.alert_frequency) {
    case 'instant': return now - last > 30 * 60 * 1000 // 30 min
    case 'daily': return now - last > 24 * 60 * 60 * 1000 // 24h
    case 'weekly': return now - last > 7 * 24 * 60 * 60 * 1000 // 7 days
    default: return false
  }
}

function buildPropertyCard(listing: MarketListing): string {
  const photo = listing.photos?.[0]
  const photoHtml = photo
    ? `<img src="${photo}" alt="${listing.title || 'Bien'}" style="width:100%;height:180px;object-fit:cover;display:block;" />`
    : `<div style="height:120px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">Pas de photo</div>`

  const stats = [
    listing.rooms ? `${listing.rooms} p.` : null,
    listing.surface_m2 ? `${listing.surface_m2} m²` : null,
    listing.type || null,
  ].filter(Boolean).join(' · ')

  return `
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:16px;">
      ${photoHtml}
      <div style="padding:16px;">
        <p style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 4px 0;">${listing.price > 0 ? formatCHF(listing.price) : 'Prix sur demande'}</p>
        <p style="font-size:12px;color:#9ca3af;margin:0 0 8px 0;">${listing.address || listing.city}, ${listing.canton}</p>
        ${stats ? `<p style="font-size:12px;color:#6b7280;margin:0 0 12px 0;">${stats}</p>` : ''}
        <a href="${listing.source_url || '#'}" target="_blank" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;">Voir le bien →</a>
      </div>
    </div>`
}

function buildAlertEmail(search: SavedSearch, listings: MarketListing[]): string {
  const count = listings.length
  const propertyCards = listings.slice(0, 5).map(buildPropertyCard).join('')
  const searchUrl = `https://megga.ch/acheter?${new URLSearchParams(
    Object.entries(search.filters).reduce((acc, [k, v]) => {
      if (v && v !== '') acc[k] = Array.isArray(v) ? v.join(',') : String(v)
      return acc
    }, {} as Record<string, string>)
  ).toString()}`

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Immobilier Suisse</span>
    </div>

    <p style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 4px 0;">
      ${count} nouveau${count > 1 ? 'x' : ''} bien${count > 1 ? 's' : ''} correspond${count > 1 ? 'ent' : ''} a votre recherche
    </p>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 24px 0;">
      Recherche : "${search.name}"
    </p>

    ${propertyCards}

    ${count > 5 ? `<p style="font-size:13px;color:#6b7280;text-align:center;margin:16px 0;">et ${count - 5} autre${count - 5 > 1 ? 's' : ''} bien${count - 5 > 1 ? 's' : ''}...</p>` : ''}

    <a href="${searchUrl}" target="_blank" style="display:block;text-align:center;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-top:8px;">
      Voir tous les resultats →
    </a>

    <p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:32px;line-height:1.5;">
      Vous recevez cet email car vous avez active les alertes pour la recherche "${search.name}" sur MEGGA.
      Pour vous desabonner, modifiez vos alertes dans vos recherches sauvegardees.
    </p>
  </div>
</body>
</html>`
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Fetch all saved searches with alerts enabled
    const { data: searches, error: searchErr } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('alert_enabled', true)
      .not('alert_email', 'is', null)

    if (searchErr) throw searchErr
    if (!searches || searches.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No active alerts' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let emailsSent = 0
    let errors = 0

    for (const search of searches as SavedSearch[]) {
      if (!shouldProcess(search)) continue

      const f = search.filters

      // 2. Build query for new listings since last alert
      let query = supabase
        .from('market_listings')
        .select('id, title, price, address, city, canton, rooms, surface_m2, type, photos, source_url, source_portal, first_seen_at')
        .in('status', ['active', 'price_reduced'])
        .gt('price', 0)
        .gte('quality_score', 50)

      // Apply filters (mirrors applyFilters from useMarketListings.ts)
      if (f.context === 'rent') {
        query = query.eq('transaction_type', 'rent')
      } else {
        query = query.eq('transaction_type', 'buy')
      }

      if (f.types && f.types.length > 0) query = query.in('type', f.types)
      if (f.canton) query = query.eq('canton', f.canton)
      if (f.city) query = query.ilike('city', `%${f.city}%`)
      if (f.minPrice) query = query.gte('price', Number(f.minPrice))
      if (f.maxPrice) query = query.lte('price', Number(f.maxPrice))

      if (f.rooms) {
        const minRooms = f.rooms.endsWith('+') ? Number(f.rooms.replace('+', '')) : Number(f.rooms)
        query = query.gte('rooms', minRooms)
      }
      if (f.bedrooms) {
        const minBed = f.bedrooms.endsWith('+') ? Number(f.bedrooms.replace('+', '')) : Number(f.bedrooms)
        query = query.gte('bedrooms', minBed)
      }
      if (f.bathrooms) {
        const minBath = f.bathrooms.endsWith('+') ? Number(f.bathrooms.replace('+', '')) : Number(f.bathrooms)
        query = query.gte('bathrooms', minBath)
      }
      if (f.energyLabel) {
        query = query.eq('energy_label', f.energyLabel)
      }

      // Only NEW listings since last alert
      if (search.last_alerted_at) {
        query = query.gt('first_seen_at', search.last_alerted_at)
      }

      query = query.order('first_seen_at', { ascending: false }).limit(20)

      const { data: newListings, error: listErr } = await query
      if (listErr) {
        console.error(`Error querying listings for search ${search.id}:`, listErr)
        errors++
        continue
      }

      if (!newListings || newListings.length === 0) {
        // No new listings — update last_alerted_at to avoid re-checking
        await supabase
          .from('saved_searches')
          .update({ last_alerted_at: new Date().toISOString() })
          .eq('id', search.id)
        continue
      }

      // 3. Send email
      const html = buildAlertEmail(search, newListings as MarketListing[])
      const subject = `${newListings.length} nouveau${newListings.length > 1 ? 'x' : ''} bien${newListings.length > 1 ? 's' : ''} | ${search.name}`

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'MEGGA <noreply@megga.ch>',
          to: [search.alert_email],
          subject,
          html,
        }),
      })

      if (resendRes.ok) {
        emailsSent++
        // 4. Update last_alerted_at + results_count
        await supabase
          .from('saved_searches')
          .update({
            last_alerted_at: new Date().toISOString(),
            results_count: newListings.length,
          })
          .eq('id', search.id)
      } else {
        const errBody = await resendRes.text()
        console.error(`Resend error for ${search.alert_email}:`, errBody)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        processed: searches.length,
        emails_sent: emailsSent,
        errors,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Search alert error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
