import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const resendApiKey = Deno.env.get('RESEND_KEY')

    const body = await req.json()
    const { match_id, channel, message, agency_id } = body as {
      match_id: string
      channel: 'email' | 'whatsapp'
      message: string
      agency_id: string
    }

    if (!match_id || !channel || !message || !agency_id) {
      return new Response(JSON.stringify({ error: 'match_id, channel, message, and agency_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the match with related data
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone, whatsapp_phone),
        property:properties(id, title, address, city, canton, price, rooms, surface_m2)
      `)
      .eq('id', match_id)
      .eq('agency_id', agency_id)
      .single()

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send email via Resend if channel is email
    if (channel === 'email' && resendApiKey && match.contact?.email) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'MEGGA Immobilier <noreply@megga.ch>',
          to: match.contact.email,
          subject: `Bien immobilier : ${match.property?.title || 'Nouvelle proposition'}`,
          text: message,
        }),
      })

      if (!emailResponse.ok) {
        const errorBody = await emailResponse.text()
        console.error('Resend error:', errorBody)
        // Continue — we still update the match status
      }
    }

    // Update match status
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'sent',
        sent_via: channel,
        sent_at: new Date().toISOString(),
      })
      .eq('id', match_id)

    if (updateError) throw updateError

    // Log activity event
    await supabase.from('activity_events').insert({
      agency_id,
      actor_id: body.agent_id || null,
      action: 'property_sent',
      entity_type: 'match',
      entity_id: match_id,
      metadata: {
        contact_id: match.contact_id,
        property_id: match.property_id,
        channel,
        contact_name: match.contact ? `${match.contact.first_name} ${match.contact.last_name}` : null,
        property_title: match.property?.title || null,
      },
    })

    // Create a follow-up reminder (J+3)
    await supabase.from('reminders').insert({
      agency_id,
      contact_id: match.contact_id,
      property_id: match.property_id,
      match_id: match_id,
      type: 'follow_up_sent_property',
      trigger_rule: 'days_after_event',
      trigger_days: 3,
      status: 'pending',
      trigger_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      channel: 'notification',
    })

    return new Response(
      JSON.stringify({ success: true, match_id, channel }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
