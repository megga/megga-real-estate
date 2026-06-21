import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AcceptRequest {
  token: string
  action?: 'preview' | 'claim'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: AcceptRequest = await req.json()

    if (!body.token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client for token lookup (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Look up invitation by token
    const { data: invitation, error: lookupError } = await supabaseAdmin
      .from('team_invitations')
      .select(`
        id, email, role, status, expires_at, created_at,
        agency:agencies(id, name),
        inviter:profiles!team_invitations_invited_by_fkey(full_name)
      `)
      .eq('token', body.token)
      .single()

    if (lookupError || !invitation) {
      return new Response(JSON.stringify({ error: 'invitation_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check status
    if (invitation.status !== 'pending') {
      return new Response(JSON.stringify({
        error: 'invitation_' + invitation.status,
        status: invitation.status,
      }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return new Response(JSON.stringify({ error: 'invitation_expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const agency = invitation.agency as unknown as { id: string; name: string } | null
    const inviter = invitation.inviter as unknown as { full_name: string } | null

    // ─── PREVIEW: return invitation details ───
    if (!body.action || body.action === 'preview') {
      return new Response(JSON.stringify({
        email: invitation.email,
        role: invitation.role,
        agencyName: agency?.name ?? 'Agence',
        inviterName: inviter?.full_name ?? 'Un membre',
        expiresAt: invitation.expires_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── CLAIM: accept the invitation ───
    if (body.action === 'claim') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authentication required to accept' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify email matches
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return new Response(JSON.stringify({
          error: 'email_mismatch',
          expectedEmail: invitation.email,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update profile: assign to agency + role
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          agency_id: agency?.id,
          role: invitation.role,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Mark invitation as accepted
      const { error: inviteError } = await supabaseAdmin
        .from('team_invitations')
        .update({
          status: 'accepted',
          claimed_at: new Date().toISOString(),
          claimed_by: user.id,
        })
        .eq('id', invitation.id)

      if (inviteError) throw inviteError

      // Log activity
      await supabaseAdmin.from('activity_events').insert({
        agency_id: agency?.id,
        actor_id: user.id,
        action: 'team_invite_accepted',
        entity_type: 'team',
        entity_id: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      })

      return new Response(JSON.stringify({
        success: true,
        redirectTo: '/dashboard',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
