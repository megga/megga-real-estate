/**
 * accept-team-invite — l'invitation d'équipe, vue puis réclamée depuis la page publique
 * `/accept-invite/:token` (AcceptInvitePage).
 *
 * Deux actions :
 *   · `preview` — ce que la page affiche (e-mail invité, rôle, agence, qui invite), à
 *     quiconque tient le jeton. `leavesAgencyWithData` ne s'y ajoute QUE pour l'appelant
 *     connecté dont l'e-mail est celui de l'invitation. N'importe quel admin d'agence solo
 *     peut fabriquer un vrai lien pour l'e-mail d'un tiers : lui dire si l'agence de sa
 *     cible porte des données serait une fuite.
 *   · `claim` — rattache le compte connecté (e-mail concordant) à l'agence qui invite.
 *
 * ⛔ CETTE FONCTION NE SUPPRIME PLUS AUCUNE AGENCE ELLE-MÊME (audit du 13.09.2026, point S9).
 * Elle supprimait l'agence solo de l'invité sur trois conditions — solo, créée par lui, plus
 * aucun membre — sans regarder ce qu'elle contenait : deals, rappels, dossier KYB de
 * l'agence partaient en cascade. La décision appartient désormais à
 * `release_empty_solo_agency` (20260913160200), qui ne libère qu'une agence VIERGE et garde
 * toute autre en journalisant `solo_agency_retained`.
 *
 * L'ordre de la réclamation, et pourquoi il compte :
 *   1. SIMULATION d'abord (`p_dry_run`), avant tout geste irréversible : une agence qui
 *      porte des données ne se quitte que sur `confirmLeave: true` — sinon 409
 *      `prior_agency_holds_data`, et le profil n'a pas bougé ;
 *   2. le profil change d'agence, la pile d'onglets est vidée ;
 *   3. le lien WhatsApp et le profil IA suivent la personne. Le copilote WhatsApp tire son
 *      agence du LIEN, pas de l'appartenance : laissé en place, un non-membre garderait la
 *      main sur l'agence qu'il vient de quitter — et l'agence, que le lien référence, ne
 *      serait jamais libérée ;
 *   4. seulement alors, la libération réelle, dont un échec ne fait jamais échouer la
 *      réclamation (l'agence est gardée, ce qui est sûr).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface AcceptRequest {
  token: string
  action?: 'preview' | 'claim'
  /**
   * Consentement EXPLICITE à quitter une agence qui porte des données. Seul `true` compte :
   * sans lui, la réclamation s'arrête en 409 avant de déplacer le profil.
   */
  confirmLeave?: boolean
}

/** Verdict de `release_empty_solo_agency` (20260913160200). */
interface ReleaseVerdict {
  /** L'agence a été supprimée par CET appel (toujours faux en simulation). */
  released: boolean
  /** L'agence remplit toutes les conditions d'une libération. */
  releasable: boolean
  /** `not_found` | `not_owned_solo` | `holds_data`, ou `null` si libérable. */
  reason: string | null
  /** Ce qui retient l'agence : tables, `profiles`, `agencies.columns`… */
  blocking: string[]
}

function isReleaseVerdict(v: unknown): v is ReleaseVerdict {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.released === 'boolean'
    && typeof r.releasable === 'boolean'
    && (r.reason === null || typeof r.reason === 'string')
    && Array.isArray(r.blocking) && r.blocking.every((b) => typeof b === 'string')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Même adresse, aux espaces et à la casse près. `.trim()` des deux côtés : une invitation
 * saisie ou collée avec des espaces refuserait sinon une adresse identique.
 */
function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toLowerCase()
  return x !== '' && x === (b ?? '').trim().toLowerCase()
}

/** Agence courante du profil, lue AVANT toute réécriture — sinon elle est perdue. */
async function currentAgencyOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.from('profiles').select('agency_id').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data?.agency_id as string | null | undefined) ?? null
}

/**
 * Libère l'agence quittée, ou simule la libération (`dryRun`). Ne jette JAMAIS : `null` veut
 * dire « verdict illisible » — RPC absente (migration sautée au déploiement), erreur, charge
 * inattendue. Rien n'a alors été supprimé : l'agence est gardée, ce qui est l'issue sûre.
 */
async function releaseSoloAgency(
  admin: SupabaseClient,
  agencyId: string,
  formerOwner: string,
  dryRun: boolean,
): Promise<ReleaseVerdict | null> {
  const { data, error } = await admin.rpc('release_empty_solo_agency', {
    p_agency_id: agencyId,
    p_former_owner: formerOwner,
    p_dry_run: dryRun,
  })
  if (error) {
    console.error('[accept-team-invite] release_empty_solo_agency failed, agency kept:', error.message, { agencyId, dryRun })
    return null
  }
  if (!isReleaseVerdict(data)) {
    console.error('[accept-team-invite] unexpected release payload, agency kept', { agencyId, dryRun })
    return null
  }
  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: AcceptRequest = await req.json()

    if (!body.token) {
      return json({ error: 'token required' }, 400)
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
      return json({ error: 'invitation_not_found' }, 404)
    }

    // Check status
    if (invitation.status !== 'pending') {
      return json({ error: 'invitation_' + invitation.status, status: invitation.status }, 410)
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return json({ error: 'invitation_expired' }, 410)
    }

    const agency = invitation.agency as unknown as { id: string; name: string } | null
    const inviter = invitation.inviter as unknown as { full_name: string } | null
    const authHeader = req.headers.get('Authorization')

    // Client porteur du JWT de l'appelant — seul juge de son identité (auth.getUser).
    const authClient = (header: string) => createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: header } } },
    )

    // ─── PREVIEW: return invitation details ───
    if (!body.action || body.action === 'preview') {
      const preview: Record<string, unknown> = {
        email: invitation.email,
        role: invitation.role,
        agencyName: agency?.name ?? 'Agence',
        inviterName: inviter?.full_name ?? 'Un membre',
        expiresAt: invitation.expires_at,
      }

      // Hors page connectée, la requête porte la clé anon : getUser la refuse et rien n'est
      // calculé. Un échec ici ne coûte jamais l'aperçu — seulement l'avertissement, que la
      // réclamation redonnera en 409 si besoin.
      if (authHeader && agency?.id) {
        try {
          const { data: { user } } = await authClient(authHeader).auth.getUser()
          if (user && sameEmail(user.email, invitation.email)) {
            const prior = await currentAgencyOf(supabaseAdmin, user.id)
            if (!prior || prior === agency.id) {
              preview.leavesAgencyWithData = false
            } else {
              const verdict = await releaseSoloAgency(supabaseAdmin, prior, user.id, true)
              if (verdict) preview.leavesAgencyWithData = verdict.reason === 'holds_data'
            }
          }
        } catch (e) {
          console.error('[accept-team-invite] preview: prior agency check failed:', e instanceof Error ? e.message : e)
        }
      }

      return json(preview)
    }

    // ─── CLAIM: accept the invitation ───
    if (body.action === 'claim') {
      if (!authHeader) {
        return json({ error: 'Authentication required to accept' }, 401)
      }

      const { data: { user }, error: authError } = await authClient(authHeader).auth.getUser()
      if (authError || !user) {
        return json({ error: 'Invalid session' }, 401)
      }

      if (!sameEmail(user.email, invitation.email)) {
        return json({ error: 'email_mismatch', expectedEmail: invitation.email }, 403)
      }

      // Sans agence cible, l'UPDATE du profil ci-dessous ne poserait QUE le rôle (supabase-js
      // retire les clés `undefined`) : un changement de rôle dans l'ancienne agence.
      if (!agency?.id) {
        return json({ error: 'invitation_not_found' }, 404)
      }

      // Ancienne agence AVANT réécriture : handle_new_user() provisionne toujours une
      // agence solo pour les rôles agence, y compris pour un invité (sans ça, un
      // invité qui ne réclame jamais reste agency_id NULL pour toujours — le wizard de
      // rattrapage a été supprimé et join_agency est fermée).
      const priorAgencyId = await currentAgencyOf(supabaseAdmin, user.id)
      const leavesPrior = priorAgencyId !== null && priorAgencyId !== agency.id

      // 1. Simulation, AVANT de toucher au profil. Un verdict illisible ne bloque pas la
      //    réclamation : la libération réelle, plus bas, reste fermée par défaut (elle ne
      //    supprime qu'une agence vierge), et une RPC absente ne supprime rien du tout.
      if (leavesPrior && body.confirmLeave !== true) {
        const preflight = await releaseSoloAgency(supabaseAdmin, priorAgencyId, user.id, true)
        if (preflight?.reason === 'holds_data') {
          return json({ error: 'prior_agency_holds_data' }, 409)
        }
      }

      // 2. Update profile: assign to agency + role
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          agency_id: agency.id,
          role: invitation.role,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // La pile d'onglets (crm_open_tabs) porte des NOMS de clients de l'agence quittée :
      // elle ne suit pas la personne. Même geste que team_remove_member (20260913130000).
      // Jamais bloquant : une pile qui survit est un défaut, pas une réclamation ratée.
      if (leavesPrior) {
        const { error: tabsError } = await supabaseAdmin.from('crm_open_tabs').delete().eq('user_id', user.id)
        if (tabsError) console.error('[accept-team-invite] crm_open_tabs purge failed:', tabsError.message)
      }

      // 3. Le lien WhatsApp et le profil IA suivent la personne, AVANT la libération : un
      //    lien qui pointe encore l'ancienne agence la retiendrait (SET NULL compte), et
      //    donnerait au copilote l'agence qu'on quitte. Le « contact chaud » du profil IA est
      //    un client de l'agence quittée : il ne suit pas la personne, comme les onglets.
      //    Même règle que le profil : dès que l'agence change, y compris depuis NULL.
      if (priorAgencyId !== agency.id) {
        const { error: linkError } = await supabaseAdmin
          .from('whatsapp_agent_links')
          .update({ agency_id: agency.id })
          .eq('profile_id', user.id)
        if (linkError) console.error('[accept-team-invite] whatsapp_agent_links re-home failed:', linkError.message)

        const { error: aiError } = await supabaseAdmin
          .from('agent_ai_profiles')
          .update({ agency_id: agency.id, hot_contact_id: null, hot_contact_at: null })
          .eq('agent_id', user.id)
        if (aiError) console.error('[accept-team-invite] agent_ai_profiles re-home failed:', aiError.message)
      }

      // 4. Libération réelle, maintenant que la personne est partie. Journalisée par la
      //    fonction elle-même (solo_agency_released / solo_agency_retained).
      if (leavesPrior) {
        const verdict = await releaseSoloAgency(supabaseAdmin, priorAgencyId, user.id, false)
        if (verdict && !verdict.released && verdict.reason === 'holds_data') {
          console.warn('[accept-team-invite] prior agency kept', { priorAgencyId, blocking: verdict.blocking })
        }
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
        agency_id: agency.id,
        actor_id: user.id,
        action: 'team_invite_accepted',
        category: 'auth',
        entity_type: 'team',
        entity_id: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      })

      return json({ success: true, redirectTo: '/dashboard' })
    }

    return json({ error: 'Invalid action' }, 400)

  } catch (error) {
    // L'aperçu se lit avec le seul jeton d'invitation, sans session : le texte d'une erreur
    // Postgres n'a pas à sortir de la fonction (audit S14). La page n'affiche de toute façon
    // que les codes qu'elle connaît, et une phrase générique pour le reste.
    console.error('[accept-team-invite] échec inattendu :', redactedErrorMessage(error))
    return json({ error: 'internal_error' }, 500)
  }
})
