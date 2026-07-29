// supabase/functions/agency-verification-run/index.ts
//
// Socle de la verification KYB (etape 4, tache 1) : lit l'agence a verifier,
// execute les connecteurs disponibles (_shared/kyb-sources.ts -- registre
// AGENCY_KYB_SOURCES, vide a la tache 1, RDAP ajoute a la tache 2, VIES +
// recherche-entreprises x2 a la tache 3, plus le geocodage Mapbox et les squelettes
// Zefix et registre UID construits ici meme -- voir le point 2 plus bas), puis confie
// l'ecriture des checks produits, l'appel du moteur de scoring
// (recompute_agency_verification, 20260728130000) et la journalisation de son
// PROPRE passage (distinct du journal du moteur -- voir plus bas) a UNE SEULE RPC,
// record_agency_verification_run (20260728140000).
//
// POURQUOI une seule RPC plutot que trois appels separes (revue etape 4/tache 1,
// point 2) : ecriture des checks, appel du moteur et journalisation etaient avant
// trois allers-retours PostgREST distincts, donc trois transactions Postgres
// distinctes. Un echec sur le DERNIER (le journal) laissait le travail deja committe
// -- checks ecrits, decision du moteur prise, y compris SON PROPRE evenement
// agency_verification_recomputed -- sans que cette fonction n'ait pu journaliser son
// propre passage : un trou de tracabilite dans le socle meme d'un dispositif LAB,
// meme si le rejeu restait sans danger. record_agency_verification_run enveloppe les trois
// dans une seule transaction Postgres : soit tout est committe, soit rien ne l'est.
// Le reseau (lecture de l'agence, appel des connecteurs) reste ici, en Deno -- une
// transaction Postgres ne doit jamais rester ouverte en attendant une reponse HTTP
// externe ; seule la partie 100% base de donnees bascule dans la RPC.
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
import {
  runAgencyKybSources,
  selectApplicableSources,
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  createZefixSources,
  createUidRegisterSources,
  type AgencyForVerification,
  type KybCheckResult,
} from '../_shared/kyb-sources.ts'

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

    // 2. Sources -- registre AGENCY_KYB_SOURCES (voir _shared/kyb-sources.ts ; RDAP
    // depuis la tache 2, VIES + recherche-entreprises x2 depuis la tache 3). Un
    // connecteur qui a besoin d'une CONFIGURATION ne peut pas vivre dans
    // AGENCY_KYB_SOURCES (une liste construite au chargement du module, avant qu'aucun
    // secret ne soit lu) : c'est ICI, et seulement ici, que _shared/kyb-sources.ts a
    // besoin d'un Deno.env.get -- le module partage lui-meme en reste totalement libre
    // (voir son en-tete). Trois fabriques dans ce cas aujourd'hui : le geocodage, Zefix et
    // le registre UID.
    //
    // Mapbox (tache 3 de l'etape 4) : MAPBOX_TOKEN absent en local, meme situation que
    // DILISENSE_API_KEY/GEMINI_API_KEY -> le connecteur produit lui-meme `unavailable`,
    // jamais un echec qui bloquerait tout le passage. Le harnais garantit que toute
    // source, presente ou future, produit TOUJOURS une ligne : succes, echec ou timeout
    // ne font jamais disparaitre un check et ne font jamais echouer cet appel.
    //
    // Zefix (etape 6, tache 2) est du meme cote pour la meme raison, mais son statut
    // differe et le restera un moment : ses deux variables sont VIDES partout, la demande
    // d'identifiants faite a zefix@bj.admin.ch etant sans reponse (handoff §8). Ses trois
    // sources produisent donc `unavailable` en signalant LAQUELLE des deux situations on
    // vit -- identifiants attendus, ou secrets poses sans connecteur ecrit -- voir la
    // section « Squelette Zefix » de _shared/kyb-sources.ts. Le cablage est fait UNE
    // FOIS, ici : le jour ou les identifiants arrivent, ce fichier n'a plus a changer.
    //
    // Le registre UID (etape 6, tache 3) est cable de la meme facon, mais son statut
    // DIFFERE de celui de Zefix : Zefix a repondu 401, on sait donc qu'il existe et ce
    // qu'il attend ; le registre UID n'a JAMAIS ete teste en API, et la question « API
    // separee ou champ Zefix ? » n'est pas tranchee (doc de conception §3). Ses deux
    // variables sont vides pour cette raison-la, pas faute d'un identifiant demande. Sa
    // fabrique rend un TABLEAU pour UNE source, et l'appel ci-dessous l'etale : si la
    // reponse est « champ Zefix », la source disparaitra sans que ce fichier change.
    const sources = [
      ...AGENCY_KYB_SOURCES,
      createAddressGeocodeSource(Deno.env.get('MAPBOX_TOKEN') ?? ''),
      ...createZefixSources({
        baseUrl: Deno.env.get('ZEFIX_API_URL') ?? '',
        credential: Deno.env.get('ZEFIX_API_CREDENTIAL') ?? '',
      }),
      ...createUidRegisterSources({
        baseUrl: Deno.env.get('UID_REGISTER_API_URL') ?? '',
        credential: Deno.env.get('UID_REGISTER_API_CREDENTIAL') ?? '',
      }),
    ]

    // Filtre de JURIDICTION (etape 6, tache 1) -- ICI, sur le registre complet compose
    // juste au-dessus, et jamais dans runAgencyKybSources() (qui doit continuer de
    // rendre une ligne par source qu'on lui donne : son contrat). Deux sources qui se
    // partagent un check_type ne doivent jamais etre interrogees pour le meme siege,
    // sans quoi la derniere ligne inseree masquerait l'autre au moteur -- voir la
    // section « Juridiction d'une source » de _shared/kyb-sources.ts. Aucun verdict ne
    // bouge pour autant : le moteur traite `unavailable` et « ligne absente » a
    // l'identique (exclus du numerateur ET du denominateur) ; ce qui n'a pas ete
    // interroge passe dans sources_skipped ci-dessous, jamais dans un silence.
    const { applicable, skipped } = selectApplicableSources(agency, sources)
    const outcomes = await runAgencyKybSources(agency, applicable)

    // 3-4-5. Ecriture des checks, appel du moteur et journalisation du PASSAGE de
    // cette fonction -- REGROUPES dans UNE SEULE RPC (record_agency_verification_run,
    // 20260728140000, revue point 2 -- voir l'en-tete de ce fichier). category='kyc'
    // (jamais 'compliance', absent du CHECK), actor_kind='system' impose actor_id
    // NULL (contrainte activity_events_actor_kind_coherence) -- c'est cette fonction
    // qui agit, pas un humain ; ces deux champs sont poses par la RPC elle-meme, pas
    // ici. La RPC reste inconditionnelle (meme sans aucun check) et APRES
    // runAgencyKybSources : elle doit voir les lignes fraiches (transmises en
    // parametre, pas relues) avant d'appeler le moteur.
    const tally: Record<KybCheckResult, number> = {
      match: 0,
      partial: 0,
      mismatch: 0,
      unavailable: 0,
      pending_manual_review: 0,
    }
    for (const outcome of outcomes) tally[outcome.result] += 1

    const { error: runErr } = await supabase.rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: outcomes,
      p_severity: tally.unavailable > 0 ? 'warn' : 'info',
      // sources_skipped TOUJOURS present, tableau vide compris : « rien n'a ete ecarte »
      // et « la question ne s'est pas posee » doivent se lire pareil dans la trace, sans
      // qu'un relecteur ait a deviner ce qu'un champ absent signifie.
      p_metadata: { sources_run: outcomes.length, sources_skipped: skipped, results: tally },
    })
    if (runErr) throw runErr

    return json({ ok: true, agency_id: agencyId, checks_written: outcomes.length, results: tally })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[agency-verification-run]', message)
    return json({ error: message }, 500)
  }
})
