// supabase/functions/buyer-init-thread/index.ts
//
// Creates (or reuses) a message thread for a public marketplace buyer
// contacting an agency about a listing. Also inserts the first message.
//
// Why an Edge Function and not 2 supabase.insert() from the client?
// - Derives `agency_id` from `market_listings.agency_profile_id` → agency
//   (or falls back to DEFAULT_PUBLIC_AGENCY_ID for generic inquiries).
// - Upserts on (buyer_user_id, property_id, agency_id) so a buyer never
//   ends up with duplicate threads for the same listing.
// - Runs under service_role so RLS stays strict for clients.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fixed UUID of the default "MEGGA Platform" agency, seeded in migration
// 20260418_002_public_buyer_threads.sql. All public marketplace inquiries
// are routed here until individual agencies claim their own listings.
const MEGGA_PLATFORM_AGENCY_ID = '00000000-0000-0000-0000-000000000001'

interface InitThreadRequest {
  content: string
  listing_id?: string | null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  // Override via DEFAULT_PUBLIC_AGENCY_ID if you later seed a different
  // platform agency. Default stays in sync with the migration seed.
  const DEFAULT_PUBLIC_AGENCY_ID = Deno.env.get('DEFAULT_PUBLIC_AGENCY_ID') ?? MEGGA_PLATFORM_AGENCY_ID

  try {
    // 1. Authenticate the caller (buyer) — we forward their JWT to get auth.uid()
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { content, listing_id }: InitThreadRequest = await req.json()
    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(JSON.stringify({ error: 'Message vide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Use the service-role client for the rest (bypass RLS atomically)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 3. Derive property context (title) and route to the default platform
    //    agency. Listing-level routing to specific CRM agencies is future
    //    work (requires claiming agency_profiles from the CRM side).
    const propertyId: string | null = listing_id ?? null
    let propertyTitle: string | null = null

    if (propertyId) {
      const { data: listing } = await admin
        .from('market_listings')
        .select('id, address, city')
        .eq('id', propertyId)
        .maybeSingle()
      if (listing) {
        propertyTitle = [listing.address, listing.city].filter(Boolean).join(', ') || null
      }
    }

    const agencyId = DEFAULT_PUBLIC_AGENCY_ID

    // 4. Upsert thread — reuse existing one if (buyer, property, agency) already exists
    //    nulls-not-distinct behaviour is provided by our unique index.
    const existingQuery = admin
      .from('message_threads')
      .select('id')
      .eq('buyer_user_id', user.id)
      .eq('agency_id', agencyId)
      .limit(1)
    const existing = propertyId
      ? await existingQuery.eq('property_id', propertyId).maybeSingle()
      : await existingQuery.is('property_id', null).maybeSingle()

    let threadId: string
    const nowIso = new Date().toISOString()
    const preview = content.trim().slice(0, 100)

    if (existing.data?.id) {
      threadId = existing.data.id
      await admin
        .from('message_threads')
        .update({
          last_message: preview,
          last_message_at: nowIso,
          unread_count: 1,
        })
        .eq('id', threadId)
    } else {
      const { data: newThread, error: insertErr } = await admin
        .from('message_threads')
        .insert({
          agency_id: agencyId,
          buyer_user_id: user.id,
          contact_name: user.email || 'Acheteur',
          contact_type: 'buyer',
          property_id: propertyId,
          property_title: propertyTitle,
          last_message: preview,
          last_message_at: nowIso,
          unread_count: 1,
        })
        .select('id')
        .single()
      if (insertErr || !newThread) {
        return new Response(JSON.stringify({ error: insertErr?.message || 'Échec de création du thread' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      threadId = newThread.id
    }

    // 5. Insert the first message
    const { error: msgErr } = await admin.from('messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_type: 'contact',
      sender_name: user.email || 'Acheteur',
      content: content.trim(),
    })
    if (msgErr) {
      return new Response(JSON.stringify({ error: msgErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ thread_id: threadId, agency_id: agencyId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
