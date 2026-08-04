// supabase/functions/admin-dsar-export/index.ts
// Export DSAR (nLPD art. 25 — droit d'accès) déclenché par un super-admin.
//
// POST { user_id } → JSON agrégé des données personnelles du sujet en tant
// qu'utilisateur de la plateforme : profil, consentements, appareils,
// événements d'authentification, activité (en tant qu'acteur). Les données
// MÉTIER d'agence (contacts, transactions…) ne sont pas des données
// personnelles du compte et restent hors périmètre v1.
//
// L'export est journalisé dans activity_events (action 'data_exported',
// severity warn) AVANT que la payload ne soit renvoyée — pas d'export sans
// trace.
//
// Auth : _shared/require-super-admin.ts (rôle + allowlist email).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

const ACTIVITY_LIMIT = 5000

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { user: admin, supabase } = auth

    const { user_id: targetId } = await req.json().catch(() => ({})) as { user_id?: string }
    if (!targetId || typeof targetId !== 'string') {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle()
    if (profileErr) throw profileErr
    if (!profile) {
      return new Response(JSON.stringify({ error: 'target profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [consents, devices, authEvents, activityEvents] = await Promise.all([
      supabase.from('user_consents')
        .select('consent_type, version, accepted_at, ip_hash')
        .eq('user_id', targetId)
        .order('accepted_at', { ascending: true }),
      supabase.from('user_devices')
        .select('fingerprint, browser, os, city, country, first_seen_at, last_seen_at, trusted')
        .eq('user_id', targetId),
      supabase.from('auth_events')
        .select('action, severity, ip_hash, user_agent, created_at')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_LIMIT),
      supabase.from('activity_events')
        .select('action, category, severity, entity_type, entity_id, object_label, created_at')
        .eq('actor_id', targetId)
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_LIMIT),
    ])
    for (const res of [consents, devices, authEvents, activityEvents]) {
      if (res.error) throw res.error
    }

    // Journaliser AVANT de renvoyer la payload — pas d'export sans trace.
    const { error: auditErr } = await supabase.from('activity_events').insert({
      agency_id: profile.agency_id ?? null,
      actor_id: admin.id,
      actor_kind: 'user',
      category: 'auth',
      action: 'data_exported',
      entity_type: 'profile',
      entity_id: targetId,
      severity: 'warn',
      object_label: profile.email ?? targetId,
      metadata: {
        kind: 'dsar',
        target_user_id: targetId,
        counts: {
          consents: consents.data?.length ?? 0,
          devices: devices.data?.length ?? 0,
          auth_events: authEvents.data?.length ?? 0,
          activity_events: activityEvents.data?.length ?? 0,
        },
      },
    })
    if (auditErr) throw auditErr

    const payload = {
      generated_at: new Date().toISOString(),
      generated_by: admin.email,
      subject: { user_id: targetId, email: profile.email },
      data: {
        profile,
        consents: consents.data ?? [],
        devices: devices.data ?? [],
        auth_events: authEvents.data ?? [],
        activity_events_as_actor: activityEvents.data ?? [],
      },
      notes: {
        scope: 'Données personnelles du compte utilisateur (nLPD art. 25). Les données métier d\'agence ne sont pas incluses.',
        activity_limit: ACTIVITY_LIMIT,
      },
    }

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[admin-dsar-export]', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
