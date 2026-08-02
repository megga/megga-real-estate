// supabase/functions/admin-agency-lifecycle/index.ts
// Suspension / réactivation d'une agence entière, côté admin plateforme (P4).
//
// POST { action: 'suspend' | 'reactivate', agency_id }
//
// Effets : agencies.status ('suspended'|'active') + ban/unban GoTrue de chaque
// membre (boucle — volumétrie fine à l'échelle actuelle) + profiles.is_suspended.
// Les comptes allowlistés super-admin sont TOUJOURS exclus du ban (anti-lockout).
// L'ancien useAdminAgencies.updateStatus ne changeait que le statut — personne
// n'était réellement bloqué ; cette edge devient le seul chemin.
//
// Audit : DEUX journaux, et ce n'est pas une redondance.
//   * activity_events — agency_suspended / agency_activated (labels déjà présents
//     dans SENSITIVE_ACTIONS côté UI) : ce que l'AGENCE a le droit de voir.
//   * admin_log famille `lifecycle` — le registre MEGGA, avec sa chaîne
//     d'empreintes, seul lu par l'écran Sécurité de la console. Sans lui, le
//     critère 2 du gate G2 (« UI → RPC → ligne visible dans Sécurité avec
//     metadata ») ne pouvait structurellement pas passer pour cet écran.
//
// ⚠ ACTEUR = « Système », et il faut le savoir. requireSuperAdmin rend un client
// à la CLÉ DE SERVICE : auth.uid() y est NULL, donc admin_log_write force
// actor_label à « Système » et LÈVE si on lui passe autre chose. L'identité de
// l'opérateur n'est donc pas perdue mais DÉPLACÉE — première paire de metadata.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { user: admin, supabase } = auth

    const body = await req.json().catch(() => ({})) as { action?: string; agency_id?: string }
    const action = body.action
    const agencyId = body.agency_id
    if ((action !== 'suspend' && action !== 'reactivate') || !agencyId) {
      return json(400, { error: 'action (suspend|reactivate) and agency_id required' })
    }
    const suspend = action === 'suspend'

    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .maybeSingle()
    if (agencyErr || !agency) return json(404, { error: 'agency not found' })

    const { error: statusErr } = await supabase
      .from('agencies')
      .update({ status: suspend ? 'suspended' : 'active' })
      .eq('id', agencyId)
    if (statusErr) throw statusErr

    // Ban/unban de chaque membre — en excluant les comptes allowlistés.
    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('agency_id', agencyId)
    if (membersErr) throw membersErr

    let processed = 0
    let skipped = 0
    for (const member of members ?? []) {
      const { data: isAllowlisted } = await supabase.rpc('super_admin_allowlist_match', {
        p_email: member.email ?? '',
      })
      if (isAllowlisted === true) {
        skipped++
        continue
      }
      const { error: banErr } = await supabase.auth.admin.updateUserById(member.id, {
        ban_duration: suspend ? '87600h' : 'none',
      })
      if (banErr) {
        console.error(`[admin-agency-lifecycle] ban ${member.id} failed:`, banErr.message)
        continue
      }
      await supabase.from('profiles').update({ is_suspended: suspend }).eq('id', member.id)
      processed++
    }

    const { error: auditErr } = await supabase.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: admin.id,
      actor_kind: 'user',
      category: 'settings',
      action: suspend ? 'agency_suspended' : 'agency_activated',
      entity_type: 'agency',
      entity_id: agencyId,
      severity: 'warn',
      object_label: agency.name,
      metadata: { members_processed: processed, members_skipped_allowlisted: skipped },
    })
    if (auditErr) throw auditErr

    // Registre MEGGA — EN DERNIER. admin_log_write prend le verrou de chaîne et le tient
    // jusqu'au COMMIT ; l'appeler avant la boucle de ban l'aurait fait tenir pendant N
    // aller-retours GoTrue. Même règle qu'en SQL (§10.2 amendé : entité puis chaîne).
    //
    // p_metadata est un tableau ORDONNÉ de paires {l, v} — jamais un objet — et sans
    // flottant (le hash porte sur le TEXTE du jsonb). Les compteurs partent en chaînes.
    const { error: registryErr } = await supabase.rpc('admin_log_write', {
      p_family: 'lifecycle',
      p_action: suspend ? 'agency_suspended' : 'agency_activated',
      p_severity: 'warn',
      p_entity_type: 'agency',
      p_entity_id: agencyId,
      p_entity_label: agency.name,
      p_agency_id: agencyId,
      p_metadata: [
        { l: 'Opérateur', v: admin.email || admin.id },
        { l: 'Action', v: suspend ? 'Suspension' : 'Réactivation' },
        { l: 'Membres traités', v: String(processed) },
        { l: 'Membres épargnés (allowlist)', v: String(skipped) },
      ],
    })
    // On lève, comme pour activity_events juste au-dessus. La conséquence est connue et
    // assumée : l'état est DÉJÀ changé quand on arrive ici, donc l'appelant reçoit un 500
    // sur un geste qui a eu lieu. Avaler l'erreur produirait l'inverse — un geste réussi
    // en silence, absent du registre — et c'est le pire des deux pour un journal LBA.
    if (registryErr) throw registryErr

    return json(200, { success: true, action, members_processed: processed, members_skipped: skipped })
  } catch (err) {
    console.error('[admin-agency-lifecycle]', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
