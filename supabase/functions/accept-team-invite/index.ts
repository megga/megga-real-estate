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

      // Verify email matches — .trim() des deux côtés : une invitation saisie/collée
      // avec des espaces autour de l'e-mail refuserait sinon la réclamation avec
      // email_mismatch alors que l'adresse est identique.
      if (user.email?.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
        return new Response(JSON.stringify({
          error: 'email_mismatch',
          expectedEmail: invitation.email,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Ancienne agence AVANT réécriture : handle_new_user() provisionne toujours une
      // agence solo pour les rôles agence, y compris pour un invité (sans ça, un
      // invité qui ne réclame jamais reste agency_id NULL pour toujours — le wizard de
      // rattrapage a été supprimé et join_agency est fermée). Capturer l'ancien id ICI,
      // avant l'UPDATE qui suit, sinon il est perdu.
      const { data: priorProfile, error: priorProfileError } = await supabaseAdmin
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle()
      if (priorProfileError) throw priorProfileError
      const priorAgencyId = priorProfile?.agency_id ?? null

      // Update profile: assign to agency + role
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          agency_id: agency?.id,
          role: invitation.role,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // ─── Nettoyage de l'agence solo devenue inutile ───
      // Une fois la réclamation faite, l'agence solo auto-provisionnée à l'inscription
      // est une ligne morte. Suppression strictement conditionnelle : solo=true, créée
      // PAR CET utilisateur, et plus aucun membre (le sien vient de partir ci-dessus —
      // 0 membre restant veut donc dire qu'il n'y a jamais eu personne d'autre). Le
      // moindre doute → on garde la ligne mais on journalise : perdre une agence qui
      // porte des données serait bien pire qu'une ligne morte. Ne bloque jamais la
      // réclamation elle-même (erreurs journalisées, jamais throw).
      if (priorAgencyId && priorAgencyId !== agency?.id) {
        const { data: staleAgency, error: staleAgencyError } = await supabaseAdmin
          .from('agencies')
          .select('id, solo, created_by')
          .eq('id', priorAgencyId)
          .maybeSingle()

        if (staleAgencyError) {
          console.error('[accept-team-invite] solo agency lookup failed:', staleAgencyError.message, { priorAgencyId })
        } else if (staleAgency?.solo === true && staleAgency.created_by === user.id) {
          const { data: remainingMembers, error: remainingError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('agency_id', priorAgencyId)
            .limit(1)

          if (remainingError) {
            console.error('[accept-team-invite] solo agency member check failed:', remainingError.message, { priorAgencyId })
          } else if ((remainingMembers?.length ?? 0) === 0) {
            const { error: deleteError } = await supabaseAdmin
              .from('agencies')
              .delete()
              .eq('id', priorAgencyId)
            if (deleteError) {
              console.error('[accept-team-invite] solo agency delete failed:', deleteError.message, { priorAgencyId })
            }
          } else {
            console.warn('[accept-team-invite] solo agency still has members, not deleting', { priorAgencyId })
          }
        }
        // staleAgency introuvable, ou solo=false, ou created_by différent : jamais
        // l'agence auto-provisionnée de CET invité — on n'y touche pas.
      }

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
      category: 'auth',
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
