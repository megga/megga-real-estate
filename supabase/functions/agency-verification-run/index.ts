// supabase/functions/agency-verification-run/index.ts
//
// Socle de la verification KYB (etape 4, tache 1) : lit l'agence a verifier,
// execute les connecteurs disponibles (_shared/kyb-sources.ts -- registre
// AGENCY_KYB_SOURCES, vide a la tache 1, RDAP ajoute a la tache 2, VIES +
// recherche-entreprises x2 a la tache 3, le format du numero de registre et les trois
// sources Zefix par LINDAS au chantier LINDAS, plus le geocodage Mapbox et le squelette
// du registre UID construits ici meme -- voir le point 2 plus bas), puis confie
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
// kyc-screening et idx-syndicate), acceptee sous SES DEUX FORMATS -- le JWT legacy de
// Deno.env et la cle `sb_secret_` d'app_config, que net.http_post rejoue en Bearer. Voir
// isTrustedServiceCaller plus bas : n'en reconnaitre qu'un seul rendait la chaine KYB
// dependante de la coincidence des deux sources. Aucun chemin utilisateur pour l'instant : cette
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
  runAgencyKybPersonSources,
  selectApplicableSources,
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  createUidRegisterSources,
  createPepSanctionsSources,
  type AgencyForVerification,
  type KybCheckResult,
  type PersonForVerification,
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

/** Le Bearer recu porte-t-il le secret service-role, sous L'UN OU L'AUTRE de ses formats ?
 *
 *  Supabase expose la MEME identite service_role sous deux formats egalement valides : le
 *  JWT legacy (`eyJ...`) et la cle `sb_secret_...`. Cette fonction n'en voyait qu'un --
 *  celui de Deno.env -- et rejetait l'autre en 401 avant toute logique, alors qu'il ouvre
 *  exactement les memes portes. Accepter les deux n'elargit donc aucun privilege : qui
 *  detient l'un detient deja l'acces complet a la base.
 *
 *  POURQUOI CA COMPTE ICI, et pas seulement par elegance : l'appelant nominal est
 *  net.http_post, qui rejoue en Bearer `app_config.service_role_key` -- pas la variable
 *  d'environnement. Rien ne garantit que les deux portent la meme valeur, et le depot
 *  contenait deja les deux croyances contradictoires sur ce point (l'en-tete de
 *  tests/backend/agency-verification-run.spec.ts affirme que le runtime edge n'injecte que
 *  le JWT legacy ; la production observee injecte la cle `sb_secret_`). Tant que la garde
 *  ne regardait qu'une seule des deux sources, une rotation qui ne toucherait que l'autre
 *  coupait toute la chaine KYB en 401 -- silencieusement, puisque net.http_post est
 *  fire-and-forget et que personne ne lit net._http_response.
 *
 *  Ordre delibere : la variable d'environnement d'abord, parce qu'elle est en memoire et
 *  qu'elle suffit dans le cas nominal. app_config n'est lu qu'en repli, donc le chemin
 *  passant ne paie aucun aller-retour SQL supplementaire. Un echec de lecture d'app_config
 *  (table absente en local, RLS) vaut « pas de second credential », jamais une 500 : la
 *  garde reste fermee, elle ne s'ouvre pas sur une erreur. */
async function isTrustedServiceCaller(
  supabase: ReturnType<typeof createClient>,
  provided: string,
  envServiceRoleKey: string,
): Promise<boolean> {
  if (safeEqual(provided, envServiceRoleKey)) return true
  if (!provided) return false

  try {
    // Meme forme d'acces que whatsapp-process (garde service-role deja en production sur
    // cette table) : pas de generique sur maybeSingle, valeur elargie a l'usage.
    const { data: cfg } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'service_role_key')
      .maybeSingle()

    return safeEqual(provided, (cfg?.value as string | undefined) ?? '')
  } catch {
    return false
  }
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
  if (!serviceRoleKey) return json({ error: 'unauthorized' }, 401)

  // Le client est construit AVANT la garde (et non apres, comme jusqu'ici) parce que le
  // second credential accepte se lit en base. La cle d'env sert a le construire : c'est
  // la seule dont on dispose a coup sur a cet instant.
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  })

  if (!(await isTrustedServiceCaller(supabase, provided, serviceRoleKey))) {
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
    // depuis la tache 2, VIES + recherche-entreprises x2 depuis la tache 3, le format du
    // numero de registre et les trois sources Zefix par LINDAS depuis le chantier LINDAS).
    // Un connecteur qui a besoin d'une CONFIGURATION ne peut pas vivre dans
    // AGENCY_KYB_SOURCES (une liste construite au chargement du module, avant qu'aucun
    // secret ne soit lu) : c'est ICI, et seulement ici, que _shared/kyb-sources.ts a
    // besoin d'un Deno.env.get -- le module partage lui-meme en reste totalement libre
    // (voir son en-tete). DEUX fabriques dans ce cas aujourd'hui : le geocodage et le
    // registre UID.
    //
    // Mapbox (tache 3 de l'etape 4) : MAPBOX_TOKEN absent en local, meme situation que
    // DILISENSE_API_KEY/GEMINI_API_KEY -> le connecteur produit lui-meme `unavailable`,
    // jamais un echec qui bloquerait tout le passage. Le harnais garantit que toute
    // source, presente ou future, produit TOUJOURS une ligne : succes, echec ou timeout
    // ne font jamais disparaitre un check et ne font jamais echouer cet appel.
    //
    // ZEFIX A QUITTE CETTE LISTE au chantier LINDAS (tache 2), et c'est un gain, pas une
    // perte : ses trois sources etaient construites ici parce qu'un squelette attendait
    // des identifiants (ZEFIX_API_URL / ZEFIX_API_CREDENTIAL, vides partout, demande a
    // zefix@bj.admin.ch sans reponse). Le registre du commerce suisse est en fait publie
    // en SPARQL par LINDAS, sans authentification -- ces trois sources n'ont donc plus
    // aucun secret a lire et sont redevenues des entrees statiques de AGENCY_KYB_SOURCES.
    // Les deux variables d'environnement ne sont plus lues nulle part. Le jour ou les
    // identifiants PublicREST arriveront, c'est le seul check registry_lookup qui en aura
    // besoin (pour le STATUT actif, la seule chose que LINDAS ne publie pas) : il
    // redeviendra alors une fabrique, et c'est ici que sa configuration sera lue.
    //
    // Le registre UID (etape 6, tache 3) reste cable ici, et son statut DIFFERE de celui
    // qu'avait Zefix : Zefix a repondu 401, on savait donc qu'il existe et ce qu'il
    // attend ; le registre UID n'a JAMAIS ete teste en API, et la question « API separee
    // ou champ Zefix ? » n'est pas tranchee (doc de conception §3) -- LINDAS n'y change
    // rien, le graphe Zefix ne porte aucune donnee de TVA. Ses deux variables sont vides
    // pour cette raison-la, pas faute d'un identifiant demande. Sa fabrique rend un
    // TABLEAU pour UNE source, et l'appel ci-dessous l'etale : si la reponse est « champ
    // Zefix », la source disparaitra sans que ce fichier change.
    const sources = [
      ...AGENCY_KYB_SOURCES,
      createAddressGeocodeSource(Deno.env.get('MAPBOX_TOKEN') ?? ''),
      ...createUidRegisterSources({
        baseUrl: Deno.env.get('UID_REGISTER_API_URL') ?? '',
        credential: Deno.env.get('UID_REGISTER_API_CREDENTIAL') ?? '',
      }),
    ]

    // Filtre de JURIDICTION (etape 6, tache 1) -- ICI, sur le registre complet compose
    // juste au-dessus, et jamais dans runAgencyKybSources() (qui doit continuer de
    // rendre une ligne par source qu'on lui donne : son contrat). Deux sources qui se
    // partagent un check_type ne doivent jamais etre interrogees pour le meme dossier,
    // sans quoi la derniere ligne inseree masquerait l'autre au moteur -- voir la
    // section « Juridiction d'une source » de _shared/kyb-sources.ts. Ce qui n'a pas ete
    // interroge passe dans sources_skipped ci-dessous, jamais dans un silence.
    //
    // Ecarter n'est neutre pour le verdict QUE si la source ecartee n'avait rien a
    // repondre sur ce dossier (le moteur traite alors `unavailable` et « ligne absente »
    // a l'identique). Une source ecartee qui aurait rendu un verdict emporte ce verdict :
    // c'est ce qui est arrive a VIES sur un siege CH declarant une TVA a prefixe UE,
    // corrige en revue finale (section « Qui possede vat_lookup » du module partage).
    const { applicable, skipped } = selectApplicableSources(agency, sources)
    const outcomes = await runAgencyKybSources(agency, applicable)

    // 2bis. Sources de PERSONNE (etape 7, tache 4) -- le veto pep_sanctions_screening.
    //
    // POURQUOI SEULS LES SIGNATAIRES ACTIFS. Le moteur n'evalue les vetos de personne que
    // sur eux (recompute_agency_verification, CTE active_signatories), et
    // submit_agency_identity refuse deja de poser un check sur une personne qui ne porte
    // pas un role signatory actif. Interroger un UBO passif ecrirait des lignes que le
    // moteur ne regarde jamais, et ferait payer un appel Dilisense pour rien. « Actif » se
    // lit comme partout ailleurs dans ce chantier : valid_to nul ou futur.
    //
    // Une lecture qui echoue n'interrompt PAS le passage : les checks d'agence viennent
    // d'etre produits et doivent etre ecrits. On journalise l'echec dans les metadonnees
    // (person_read_error) plutot que de perdre le travail deja fait -- le veto restera
    // absent, donc echoue, donc le dossier partira en revue humaine. C'est le penchant du
    // dispositif : faute de preuve, un humain tranche.
    let personOutcomes: Awaited<ReturnType<typeof runAgencyKybPersonSources>> = []
    let personReadError: string | null = null
    try {
      const { data: signatories, error: personsErr } = await supabase
        .from('agency_related_persons')
        .select('id, first_name, last_name, date_of_birth, nationality, agency_person_roles!inner(role, valid_to)')
        .eq('agency_id', agencyId)
        .eq('agency_person_roles.role', 'signatory')
      if (personsErr) throw personsErr

      const active: PersonForVerification[] = (signatories ?? [])
        .filter((row) => {
          const roles = (row as unknown as { agency_person_roles?: { valid_to: string | null }[] })
            .agency_person_roles ?? []
          return roles.some((r) => r.valid_to === null || new Date(r.valid_to) > new Date())
        })
        .map((row) => ({
          id: (row as unknown as { id: string }).id,
          first_name: (row as unknown as { first_name: string | null }).first_name,
          last_name: (row as unknown as { last_name: string | null }).last_name,
          date_of_birth: (row as unknown as { date_of_birth: string | null }).date_of_birth,
          nationality: (row as unknown as { nationality: string | null }).nationality,
        }))

      personOutcomes = await runAgencyKybPersonSources(
        active,
        createPepSanctionsSources({ apiKey: Deno.env.get('DILISENSE_API_KEY') ?? '' }),
        undefined,
        agency
      )
    } catch (personErr) {
      personReadError = personErr instanceof Error ? personErr.message : 'unknown_error'
      console.error('[agency-verification-run] lecture des signataires', personReadError)
    }

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
    // DEUX tallys, un par PORTEE, et jamais un seul (correctif : les fondre changeait le
    // SENS de `results`, qui accompagne `checks_written` -- lui-meme d'agence -- depuis
    // l'etape 4 ; un appelant lisant `results.unavailable` se serait retrouve avec un
    // compte de deux tables melangees, sans moyen de savoir laquelle). La severite du
    // journal, elle, regarde bien les deux : un screening injoignable merite le meme
    // `warn` qu'un registre injoignable, dans les deux cas un veto restera absent.
    for (const outcome of outcomes) tally[outcome.result] += 1

    const personTally: Record<KybCheckResult, number> = {
      match: 0,
      partial: 0,
      mismatch: 0,
      unavailable: 0,
      pending_manual_review: 0,
    }
    for (const outcome of personOutcomes) personTally[outcome.result] += 1

    const { error: runErr } = await supabase.rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: outcomes,
      p_person_checks: personOutcomes,
      p_severity: tally.unavailable > 0 || personTally.unavailable > 0 || personReadError ? 'warn' : 'info',
      // sources_skipped TOUJOURS present, tableau vide compris : « rien n'a ete ecarte »
      // et « la question ne s'est pas posee » doivent se lire pareil dans la trace, sans
      // qu'un relecteur ait a deviner ce qu'un champ absent signifie. Meme raison pour
      // person_read_error, toujours present : `null` dit « la lecture a abouti ».
      p_metadata: {
        sources_run: outcomes.length,
        person_sources_run: personOutcomes.length,
        sources_skipped: skipped,
        person_read_error: personReadError,
        results: tally,
        person_results: personTally,
      },
    })
    if (runErr) throw runErr

    return json({
      ok: true,
      agency_id: agencyId,
      checks_written: outcomes.length,
      person_checks_written: personOutcomes.length,
      results: tally,
      person_results: personTally,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[agency-verification-run]', message)
    return json({ error: message }, 500)
  }
})
