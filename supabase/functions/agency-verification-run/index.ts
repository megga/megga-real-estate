// supabase/functions/agency-verification-run/index.ts
//
// Socle de la verification KYB (etape 4, tache 1) : lit l'agence a verifier,
// execute les connecteurs disponibles (_shared/kyb-sources.ts -- AUCUN connecteur
// reel dans cette tache, le registre AGENCY_KYB_SOURCES est vide), ecrit les
// checks produits, appelle le moteur de scoring
// (recompute_agency_verification, 20260728130000), puis journalise son PROPRE
// passage (distinct du journal du moteur -- voir plus bas).
//
// Auth : Bearer == cle service-role, comparaison a temps constant (meme motif que
// kyc-screening et idx-syndicate). Aucun chemin utilisateur pour l'instant : cette
// fonction n'est destinee qu'a des appelants internes de confiance -- le
// declenchement (appel client apres soumission, cron, ou relais admin) se decide
// a la tache 4. De toute facon, les tables de checks refusent l'ecriture a tout
// role utilisateur (RLS, migration 20260728103000) : ecrire ici en service_role
// est la seule maniere d'y poser une ligne, cote serveur comme cote client.
//
// Rejouable : cette fonction n'efface, ne met a jour, ni ne reordonne AUCUNE
// ligne existante de agency_verification_checks -- uniquement des inserts. Le
// moteur departage deja correctement deux checks du meme type par ctid (ordre
// d'insertion), jamais par checked_at (egal quand ecrits dans la meme
// transaction) : voir la revue de l'etape 3 dans
// 20260728130000_recompute_agency_verification.sql. Introduire ici une logique
// d'ordre ou de nettoyage referait, moins bien, ce que le moteur fait deja --
// c'est precisement ce que ce fichier doit s'interdire.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runAgencyKybSources, type AgencyForVerification, type KybCheckResult } from '../_shared/kyb-sources.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Comparaison a temps constant du secret service-role (anti timing-attack), meme
// implementation que kyc-screening et idx-syndicate.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RunRequest {
  agency_id?: string
}

// Sous-ensemble de colonnes utile aux connecteurs (taches 2/3) -- jamais la ligne
// agencies entiere (billing, targets... hors sujet pour un connecteur KYB).
const AGENCY_COLUMNS =
  'id, legal_name, trade_name, business_registration_number, country, canton, city, postal_code, address, website, tva'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!serviceRoleKey || !safeEqual(provided, serviceRoleKey)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: RunRequest
  try {
    body = (await req.json()) as RunRequest
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const agencyId = body.agency_id
  if (typeof agencyId !== 'string' || !UUID_RE.test(agencyId)) {
    return json({ error: 'agency_id required (uuid)' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    // 1. Lecture de l'agence a verifier.
    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .select(AGENCY_COLUMNS)
      .eq('id', agencyId)
      .maybeSingle<AgencyForVerification>()

    if (agencyErr) throw agencyErr
    if (!agency) return json({ error: 'agency_not_found' }, 404)

    // 2. Sources -- registre VIDE dans cette tache (voir _shared/kyb-sources.ts).
    // Le harnais garantit que toute source, presente ou future, produit TOUJOURS
    // une ligne : succes, echec ou timeout ne font jamais disparaitre un check et
    // ne font jamais echouer cet appel.
    const outcomes = await runAgencyKybSources(agency)

    // 3. Ecriture -- un seul insert (une seule transaction) si au moins une
    // source a tourne. Jamais de delete/update sur les lignes existantes :
    // append-only, voir l'en-tete de ce fichier.
    if (outcomes.length > 0) {
      const { error: insertErr } = await supabase
        .from('agency_verification_checks')
        .insert(outcomes.map((o) => ({ agency_id: agencyId, ...o })))
      if (insertErr) throw insertErr
    }

    // 4. Le moteur -- APRES l'ecriture, jamais avant : il doit voir les lignes
    // fraiches. RPC service_role (20260728130000).
    const { error: recomputeErr } = await supabase.rpc('recompute_agency_verification', {
      p_agency_id: agencyId,
    })
    if (recomputeErr) throw recomputeErr

    // 5. Journalisation du PASSAGE de cette fonction -- distincte du journal du
    // moteur (action='agency_verification_recomputed', pose par la RPC elle-meme,
    // qui documente la DECISION de scoring). Celle-ci documente la couche
    // connecteurs : combien de sources ont tourne, quelle repartition de
    // resultats. category='kyc' (jamais 'compliance', absent du CHECK),
    // actor_kind='system' impose actor_id NULL (contrainte
    // activity_events_actor_kind_coherence) -- c'est cette fonction qui agit, pas
    // un humain.
    const tally: Record<KybCheckResult, number> = {
      match: 0,
      partial: 0,
      mismatch: 0,
      unavailable: 0,
      pending_manual_review: 0,
    }
    for (const outcome of outcomes) tally[outcome.result] += 1

    const { error: logErr } = await supabase.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: null,
      actor_kind: 'system',
      action: 'agency_verification_run',
      entity_type: 'agency',
      entity_id: agencyId,
      category: 'kyc',
      severity: tally.unavailable > 0 ? 'warn' : 'info',
      metadata: { sources_run: outcomes.length, results: tally },
    })
    if (logErr) throw logErr

    return json({ ok: true, agency_id: agencyId, checks_written: outcomes.length, results: tally })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[agency-verification-run]', message)
    return json({ error: message }, 500)
  }
})
