// supabase/functions/admin-user-lifecycle/index.ts
// Cycle de vie des comptes utilisateurs, côté admin plateforme (P4).
//
// POST { action: 'suspend' | 'reactivate' | 'force_password_reset', user_id }
//
//   suspend  : ban GoTrue (ban_duration 87600h ≈ 10 ans) + profiles.is_suspended.
//              ⚠ Les access tokens déjà émis restent valides ≤1h (le ban bloque
//              le refresh, pas les JWT en cours) — documenté, assumé.
//   reactivate : lève le ban + flag false.
//   force_password_reset : génère un lien recovery GoTrue et l'envoie par
//              Resend au compte cible.
//
// Garde-fous :
//   * Auth : _shared/require-super-admin.ts (rôle + allowlist).
//   * ANTI-AUTO-LOCKOUT : refuse d'agir sur un compte dont l'email est
//     allowlisté super-admin (on ne peut pas se suspendre entre admins).
//   * Chaque action est journalisée DEUX fois, dans deux journaux distincts :
//     activity_events (ce que l'agence a le droit de voir) et admin_log famille
//     `lifecycle` (le registre MEGGA, chaîné, seul lu par l'écran Sécurité).
//     Sans la seconde, le critère 2 du gate G2 — « UI → RPC → ligne visible dans
//     Sécurité avec metadata » — ne pouvait structurellement pas passer ici.
//
// ⚠ ACTEUR = « Système ». requireSuperAdmin rend un client à la CLÉ DE SERVICE :
// auth.uid() y est NULL, donc admin_log_write force actor_label à « Système » et
// LÈVE si on lui passe autre chose. L'identité de l'opérateur est déplacée dans
// la première paire de metadata, pas perdue.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

const ACTIONS = ['suspend', 'reactivate', 'force_password_reset'] as const
type Action = typeof ACTIONS[number]

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

    const body = await req.json().catch(() => ({})) as { action?: string; user_id?: string }
    const action = body.action as Action | undefined
    const targetId = body.user_id
    if (!action || !ACTIONS.includes(action) || !targetId) {
      return json(400, { error: 'action (suspend|reactivate|force_password_reset) and user_id required' })
    }

    const { data: target, error: targetErr } = await supabase.auth.admin.getUserById(targetId)
    if (targetErr || !target.user) {
      return json(404, { error: 'target user not found' })
    }
    const targetEmail = target.user.email ?? ''

    // Anti-auto-lockout : jamais d'action de cycle de vie sur un compte allowlisté.
    const { data: isAllowlisted } = await supabase.rpc('super_admin_allowlist_match', {
      p_email: targetEmail,
    })
    if (isAllowlisted === true) {
      return json(403, { error: 'refused: cannot run lifecycle actions on an allowlisted admin account' })
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('agency_id, full_name, email')
      .eq('id', targetId)
      .maybeSingle()

    // Les deux journaux dans le même geste, toujours dans cet ordre : le registre MEGGA
    // EN DERNIER, parce que admin_log_write prend le verrou de chaîne et le tient jusqu'au
    // COMMIT (§10.2 amendé — entité d'abord, chaîne ensuite).
    //
    // `pairs` est un tableau ORDONNÉ de {l, v}, jamais un objet, et sans flottant : le hash
    // de chaîne porte sur le TEXTE du jsonb, donc tout part en chaînes de caractères.
    const audit = async (
      auditAction: string,
      metadata: Record<string, unknown> = {},
      pairs: Array<{ l: string; v: string }> = [],
    ) => {
      const { error } = await supabase.from('activity_events').insert({
        agency_id: targetProfile?.agency_id ?? null,
        actor_id: admin.id,
        actor_kind: 'user',
        category: 'auth',
        action: auditAction,
        entity_type: 'profile',
        entity_id: targetId,
        severity: 'warn',
        object_label: targetProfile?.full_name || targetEmail,
        metadata: { target_email: targetEmail, ...metadata },
      })
      if (error) throw error

      const { error: registryErr } = await supabase.rpc('admin_log_write', {
        p_family: 'lifecycle',
        p_action: auditAction,
        p_severity: 'warn',
        p_entity_type: 'profile',
        p_entity_id: targetId,
        p_entity_label: targetProfile?.full_name || targetEmail,
        p_agency_id: targetProfile?.agency_id ?? null,
        p_metadata: [
          { l: 'Opérateur', v: admin.email || admin.id },
          { l: 'Compte cible', v: targetEmail || targetId },
          ...pairs,
        ],
      })
      // On lève, comme pour activity_events. Conséquence connue et assumée : le ban GoTrue
      // est déjà posé quand on arrive ici, donc l'appelant reçoit un 500 sur un geste qui a
      // eu lieu. Avaler l'erreur donnerait l'inverse — un geste réussi en silence, absent du
      // registre — et c'est le pire des deux pour un journal LBA.
      if (registryErr) throw registryErr
    }

    if (action === 'suspend') {
      const { error } = await supabase.auth.admin.updateUserById(targetId, { ban_duration: '87600h' })
      if (error) throw error
      const { error: flagErr } = await supabase.from('profiles').update({ is_suspended: true }).eq('id', targetId)
      if (flagErr) throw flagErr
      await audit('user_suspended', {}, [
        { l: 'Action', v: 'Suspension' },
        // Le fait le moins évident du geste, et celui qu'un auditeur doit lire ici : le ban
        // bloque le REFRESH, pas les JWT déjà émis. L'accès survit donc jusqu'à 1 h.
        { l: 'Accès résiduel', v: 'jusqu’à 1 h (les JWT en cours restent valides)' },
      ])
      return json(200, { success: true, action })
    }

    if (action === 'reactivate') {
      const { error } = await supabase.auth.admin.updateUserById(targetId, { ban_duration: 'none' })
      if (error) throw error
      const { error: flagErr } = await supabase.from('profiles').update({ is_suspended: false }).eq('id', targetId)
      if (flagErr) throw flagErr
      await audit('user_reactivated', {}, [{ l: 'Action', v: 'Réactivation' }])
      return json(200, { success: true, action })
    }

    // force_password_reset
    if (!targetEmail) return json(400, { error: 'target has no email' })
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
    })
    if (linkErr) throw linkErr
    const actionLink = linkData.properties?.action_link
    if (!actionLink) throw new Error('recovery link generation returned no link')

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY missing')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [targetEmail],
        subject: 'Réinitialisation de votre mot de passe MEGGA',
        text: `Bonjour,\n\nUn administrateur MEGGA a déclenché la réinitialisation de votre mot de passe.\n\nRéinitialiser : ${actionLink}\n\nSi vous n'êtes pas à l'origine de cette demande, contactez support@megga.ch.`,
      }),
    })
    if (!res.ok) throw new Error(`resend failed: ${res.status}`)
    await audit('password_reset_sent', { initiated_by: 'admin' }, [
      { l: 'Action', v: 'Réinitialisation de mot de passe' },
      // Le lien de récupération lui-même n'entre JAMAIS au registre : il vaut session.
      { l: 'Remise', v: 'lien envoyé au compte cible par e-mail' },
    ])
    return json(200, { success: true, action })
  } catch (err) {
    console.error('[admin-user-lifecycle]', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
