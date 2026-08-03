import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// L'adresse d'acceptation s'est déjà bâtie ici depuis l'en-tête `Origin`, que
// l'appelant choisit : elle vient d'un constructeur partagé, chemin compris.
// Rationnel complet et garde-fou : `_shared/app-url.ts`,
// `tests/unit/invite-link-origin-guard.spec.ts`.
import { teamInviteAcceptUrl } from '../_shared/app-url.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 3,
  agency: 10,
  enterprise: 50,
}

interface InviteRequest {
  action?: 'invite' | 'resend' | 'cancel'
  email?: string
  role?: string
  invitationId?: string
}

function buildInviteEmailHtml(params: {
  inviterName: string
  agencyName: string
  role: string
  acceptUrl: string
}): string {
  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    manager: 'Manager',
    agent: 'Agent',
    assistant: 'Assistant',
  }
  const roleLabel = roleLabels[params.role] || params.role

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation — MEGGA</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Immobilier Suisse</span>
    </div>

    <!-- Content -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:32px;">
      <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 16px 0;">
        Vous êtes invité à rejoindre une équipe
      </h2>

      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px 0;">
        <strong style="color:#374151;">${params.inviterName}</strong> vous invite à rejoindre
        <strong style="color:#374151;">${params.agencyName}</strong> sur MEGGA.
      </p>

      <div style="background:#f9fafb;border-radius:10px;padding:16px;margin:0 0 24px 0;">
        <p style="font-size:12px;color:#9ca3af;margin:0 0 4px 0;">Votre rôle</p>
        <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0;">${roleLabel}</p>
      </div>

      <a href="${params.acceptUrl}" target="_blank" rel="noopener noreferrer"
        style="display:block;text-align:center;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Accepter l'invitation
      </a>

      <p style="font-size:11px;color:#9ca3af;text-align:center;margin:16px 0 0 0;">
        Cette invitation expire dans 7 jours.
      </p>
    </div>

    <!-- Disclaimer -->
    <p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:24px;line-height:1.5;">
      Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
    </p>
  </div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authenticated client (for RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Admin client (for token lookups, bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get caller profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, agency_id, full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: 'No agency found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller is admin or manager
    if (!['admin', 'manager'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Admin or Manager role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: InviteRequest = await req.json()
    const action = body.action || 'invite'

    // Get agency info
    const { data: agency } = await supabase
      .from('agencies')
      .select('id, name, plan')
      .eq('id', profile.agency_id)
      .single()

    if (!agency) {
      return new Response(JSON.stringify({ error: 'Agency not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── ACTION: CANCEL ───
    if (action === 'cancel') {
      if (!body.invitationId) {
        return new Response(JSON.stringify({ error: 'invitationId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // `.select().single()` et pas un simple update : PostgREST ne lève AUCUNE
      // erreur quand un UPDATE ne touche aucune ligne. Sans lui, un id d'une
      // autre agence (ou déjà annulé) repartait en `{success:true}` et faisait
      // écrire une ligne d'audit portant un `entity_id` jamais vérifié. La
      // branche `resend`, juste en dessous, faisait déjà le bon geste.
      const { data: cancelled, error } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', body.invitationId)
        .eq('agency_id', profile.agency_id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!cancelled) {
        return new Response(JSON.stringify({ error: 'Invitation not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Log activity
      await supabaseAdmin.from('activity_events').insert({
        agency_id: profile.agency_id,
        actor_id: user.id,
        action: 'team_invite_cancelled',
      category: 'auth',
        entity_type: 'team',
        entity_id: body.invitationId,
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── ACTION: RESEND ───
    if (action === 'resend') {
      if (!body.invitationId) {
        return new Response(JSON.stringify({ error: 'invitationId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Generate new token and extend expiry
      const newToken = crypto.randomUUID()
      const { data: invitation, error } = await supabase
        .from('team_invitations')
        .update({
          token: newToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', body.invitationId)
        .eq('agency_id', profile.agency_id)
        .eq('status', 'pending')
        .select()
        .single()

      if (error || !invitation) {
        return new Response(JSON.stringify({ error: 'Invitation not found or not pending' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Send email
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (RESEND_API_KEY) {
        const html = buildInviteEmailHtml({
          inviterName: profile.full_name,
          agencyName: agency.name,
          role: invitation.role,
          acceptUrl: teamInviteAcceptUrl(newToken),
        })

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'MEGGA Immobilier <noreply@megga.ch>',
            to: [invitation.email],
            subject: `Invitation à rejoindre ${agency.name} sur MEGGA`,
            html,
          }),
        })
      }

      // Log activity
      await supabaseAdmin.from('activity_events').insert({
        agency_id: profile.agency_id,
        actor_id: user.id,
        action: 'team_invite_resent',
      category: 'auth',
        entity_type: 'team',
        entity_id: body.invitationId,
        metadata: { email: invitation.email },
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── ACTION: INVITE ───
    if (!body.email || !body.role) {
      return new Response(JSON.stringify({ error: 'email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // `body.role` partait tel quel dans l'invitation, et le token d'invitation
    // VAUT attribution de rôle au moment du claim : seul l'enum `user_role`
    // bornait la valeur, si bien qu'un `manager` pouvait émettre une invitation
    // `admin` — un cran au-dessus de lui. On borne à une liste explicite, puis
    // au niveau de l'appelant.
    //
    // ⚠ Doit rester aligné sur `team_role_rank()` (migration 20260802210000),
    // qui porte la MÊME règle dans la policy RLS : cette garde-ci ne protège que
    // les appels passant par cette fonction, or la table est exposée à
    // `authenticated`, donc un dirigeant peut écrire en direct via PostgREST.
    // `assistant` est un rôle d'agent à part entière (src/types/auth.ts
    // AGENT_ROLES, proposé par la console) : l'omettre revenait à refuser une
    // invitation légitime.
    const ROLE_RANK: Record<string, number> = { assistant: 1, agent: 1, manager: 2, admin: 3 }
    const requestedRank = ROLE_RANK[body.role]
    if (!requestedRank) {
      return new Response(JSON.stringify({ error: 'role must be assistant, agent, manager or admin' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (requestedRank > (ROLE_RANK[profile.role] ?? 0)) {
      return new Response(
        JSON.stringify({ error: 'Cannot invite someone above your own role.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Check plan limit
    const { data: countResult } = await supabaseAdmin.rpc('get_agency_member_count', {
      p_agency_id: profile.agency_id,
    })
    const currentCount = countResult ?? 0
    const maxMembers = PLAN_LIMITS[agency.plan] ?? 1

    if (currentCount >= maxMembers) {
      return new Response(JSON.stringify({
        error: 'plan_limit_reached',
        message: `Votre plan ${agency.plan} est limité à ${maxMembers} membres.`,
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .eq('email', body.email)
      .maybeSingle()

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'already_member' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already invited (pending)
    const { data: existingInvite } = await supabaseAdmin
      .from('team_invitations')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .eq('email', body.email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'already_invited' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert invitation
    const { data: invitation, error: insertError } = await supabase
      .from('team_invitations')
      .insert({
        agency_id: profile.agency_id,
        email: body.email,
        role: body.role,
        invited_by: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      const html = buildInviteEmailHtml({
        inviterName: profile.full_name,
        agencyName: agency.name,
        role: body.role,
        acceptUrl: teamInviteAcceptUrl(invitation.token),
      })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'MEGGA Immobilier <noreply@megga.ch>',
          to: [body.email],
          subject: `Invitation à rejoindre ${agency.name} sur MEGGA`,
          html,
        }),
      })
    }

    // Log activity
    await supabaseAdmin.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: user.id,
      action: 'team_invite_sent',
      // `auth` : une invitation est un geste d'IDENTITÉ (qui a accès à l'agence), pas un
      // réglage. Les trois actions d'invitation de ce fichier portent donc la même famille.
      category: 'auth',
      entity_type: 'team',
      entity_id: invitation.id,
      metadata: { email: body.email, role: body.role },
    })

    return new Response(JSON.stringify({
      success: true,
      invitationId: invitation.id,
    }), {
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
