// supabase/functions/admin-dsar-export/index.ts
// Export DSAR (nLPD art. 25 — droit d'accès) déclenché par un super-admin.
//
// POST { user_id } → JSON agrégé des traitements dont MEGGA est RESPONSABLE :
// profil, consentements, appareils, événements d'authentification, activité (en
// tant qu'acteur), identité KYB du dirigeant, appel d'accueil, et preuve de
// destruction des pièces d'identité.
//
// LA LIGNE DE PARTAGE A ÉTÉ REFORMULÉE le 07.08.2026. Elle disait « les données
// MÉTIER d'agence ne sont pas des données personnelles du compte ». L'intention
// était juste — les contacts CRM appartiennent à l'agence, qui en est le
// responsable, et la personne exerce ses droits auprès d'elle (registre,
// activité n°2) — mais la formulation rangeait du mauvais côté l'identité KYB du
// dirigeant. Or là, MEGGA vérifie POUR SON PROPRE COMPTE avant d'ouvrir l'accès
// (activité n°13) : sa date de naissance et son numéro de pièce lui étaient dus,
// et n'étaient pas exportés. Le critère est désormais le RÔLE de MEGGA
// (responsable vs sous-traitant), pas la nature « compte vs métier ».
//
// Le périmètre est déclaré une seule fois, dans `_shared/personal-data-estate.ts`,
// avec `delete-account` : les deux listes avaient divergé en silence, elles ne
// se recoupaient plus que sur deux tables.
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

    const [consents, devices, authEvents, activityEvents, relatedPersons, onboardingCalls] =
      await Promise.all([
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
        // KYB — MEGGA est RESPONSABLE du traitement ici (registre, activité n°13) :
        // c'est elle qui vérifie le dirigeant pour son propre compte. La date de
        // naissance et le numéro de pièce ne sont pas « des données métier de
        // l'agence », et l'omission de cette table était le gros du constat F2.
        supabase.from('agency_related_persons')
          .select('id, agency_id, first_name, last_name, date_of_birth, nationality, id_document_type, id_document_number, identity_verification_status, identity_verified_at, created_at')
          .eq('profile_id', targetId),
        // Objet de PLATEFORME (MEGGA ↔ agence), hors tenant — donc responsable, pas
        // sous-traitant.
        supabase.from('onboarding_calls')
          .select('id, agency_id, host_display_name, scheduled_at, duration_minutes, status, attendee_phone, attendee_note, cancel_reason, created_at')
          .eq('booked_by', targetId)
          .order('scheduled_at', { ascending: false }),
      ])
    for (const res of [consents, devices, authEvents, activityEvents, relatedPersons, onboardingCalls]) {
      if (res.error) throw res.error
    }

    // Preuve d'effacement — se résout en DEUX temps : le journal porte un
    // `related_person_id` (une ligne KYB), pas un identifiant de compte.
    // Sans FK par construction, donc aucune jointure possible ; on passe par les
    // identifiants obtenus ci-dessus.
    const personIds = (relatedPersons.data ?? []).map((p) => (p as { id: string }).id)
    const purges = personIds.length > 0
      ? await supabase.from('agency_id_document_purges')
          .select('storage_path, purge_reason, uploaded_at, purged_at')
          .in('related_person_id', personIds)
          .order('purged_at', { ascending: false })
      : { data: [], error: null }
    if (purges.error) throw purges.error

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
          kyb_related_persons: relatedPersons.data?.length ?? 0,
          onboarding_calls: onboardingCalls.data?.length ?? 0,
          id_document_purges: purges.data?.length ?? 0,
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
        kyb_related_persons: relatedPersons.data ?? [],
        onboarding_calls: onboardingCalls.data ?? [],
        id_document_purges: purges.data ?? [],
      },
      notes: {
        scope:
          'Traitements dont MEGGA est RESPONSABLE (nLPD art. 25) : compte, consentements, ' +
          'appareils, sécurité, activité, identité KYB du dirigeant, appel d\'accueil, et preuve ' +
          'de destruction des pièces d\'identité.',
        out_of_scope:
          'Les données pour lesquelles MEGGA est SOUS-TRAITANT (contacts CRM, transactions, ' +
          'dossiers KYC des parties) restent hors périmètre : le responsable du traitement est ' +
          'l\'agence utilisatrice, et la personne exerce ses droits auprès d\'elle (registre, ' +
          'activité n°2). Ce n\'est pas une omission technique mais la ligne de partage retenue.',
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
