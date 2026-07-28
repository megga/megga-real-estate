// Backend test (live CI) -- socle de l'Edge Function agency-verification-run
// (etape 4, tache 1 -- supabase/functions/agency-verification-run/index.ts et son
// module partage supabase/functions/_shared/kyb-sources.ts), connecteur RDAP
// (etape 4, tache 2 -- domain_whois_age, premier connecteur reel du registre) et
// connecteurs VIES / recherche-entreprises / Mapbox (etape 4, tache 3).
//
// Principe directeur de toute l'etape 4 (voir
// docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-4.md, « Le principe qui
// gouverne toute cette etape ») : une source qui ne repond pas produit un check
// `unavailable`, JAMAIS une absence de ligne et JAMAIS un echec. Le moteur
// (recompute_agency_verification, 20260728130000) exclut `unavailable` du
// numerateur et du denominateur -- un pays sans source disponible n'est donc pas
// penalise, seulement moins confirme. Corollaire : ne jamais fabriquer un resultat
// par defaut (un `match` faute de reponse serait une preuve fabriquee par le
// systeme lui-meme).
//
// Six volets dans ce fichier :
//   1. Le harnais PUR (_shared/kyb-sources.ts) -- import direct, aucun reseau,
//      aucune dependance Deno (ce module n'appelle jamais Deno.env.get, contrairement
//      a _shared/magic-link-token.ts -- aucun shim globalThis.Deno necessaire, meme
//      motif que whatsapp-antifab.spec.ts qui importe deja un _shared/*.ts sans
//      extension de la meme facon).
//   2. La fonction deployee (HTTP, port 54321) -- lecture agence, ecriture des
//      checks, appel du moteur, journalisation. Cinq connecteurs reels existent a ce
//      stade (RDAP tache 2 ; VIES, recherche-entreprises x2, Mapbox tache 3) ; les
//      tests HTTP portent sur la PLOMBERIE (elle lit, ecrit, appelle le moteur,
//      journalise, rejoue proprement) et tiennent compte de ce que CES connecteurs
//      ecrivent reellement.
//   3-6. Chaque connecteur (describe hors skipIf, plus bas dans ce fichier) -- logique
//      pure, fetch STUBBE (jamais de reseau reel dans la suite automatisee, meme motif
//      que _shared/esign-finalize.test.ts qui stubbe deja fetch pour un connecteur
//      externe). Tourne SANS Supabase local -- import direct du module, comme le
//      volet 1. La verification CONTRE les vrais services se fait a la main, une
//      fois, hors de cette suite -- voir docs/superpowers/sdd/task-3-report.md.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer -- lire le compte de tests, jamais le code de
// sortie (meme convention que agency-verification-engine.spec.ts). Les volets 3-6
// (fetch stubbe) ne sont eux-memes jamais concernes par ce skip : ils ne touchent ni
// reseau ni DB.

import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import {
  runKybSource,
  runAgencyKybSources,
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  type KybSource,
  type AgencyForVerification,
} from '../../supabase/functions/_shared/kyb-sources'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const ENDPOINT = `${URL}/functions/v1/agency-verification-run`
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const FAKE_AGENCY: AgencyForVerification = {
  id: NIL_UUID,
  legal_name: 'Fake SA',
  trade_name: null,
  business_registration_number: null,
  country: 'CH',
  canton: 'GE',
  city: null,
  postal_code: null,
  address: null,
  website: null,
  tva: null,
}

/** PostgREST peut renvoyer un `numeric` en JSON number ou en texte selon la colonne -- defensif
 *  (meme motif que agency-verification-engine.spec.ts). */
const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x))

function failingSource(checkType: string): KybSource {
  return {
    checkType,
    source: 'manual',
    run: async () => {
      throw new Error(`boom-${checkType}`)
    },
  }
}

function hangingSource(checkType: string): KybSource {
  // Ignore delibirement le signal d'annulation -- simule une source qui ne repond
  // JAMAIS, pas meme a une annulation. La garantie de runKybSource doit tenir malgre
  // ca (voir _shared/kyb-sources.ts : le timeout externe ne depend pas de la
  // cooperation de la source).
  return {
    checkType,
    source: 'manual',
    run: () => new Promise(() => {}),
  }
}

function okSource(checkType: string, result: 'match' | 'partial' | 'mismatch' = 'match'): KybSource {
  return {
    checkType,
    source: 'manual',
    run: async () => ({ result, raw_response: { probe: true } }),
  }
}

describe.skipIf(!HAS_KEYS)('agency-verification-run -- socle (etape 4, tache 1)', () => {
  // Helpers DB partages par "Edge Function deployee" ET par
  // "record_agency_verification_run -- atomicite" (revue point 2) -- les deux
  // sections doivent creer une agence de test et lire son etat / ses checks / ses
  // evenements. Hisses ici (au lieu d'etre locaux a "Edge Function deployee" comme
  // avant ce correctif) pour que les deux sections les partagent sans dupliquer la
  // logique de nettoyage.
  const agencyIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNETE (meme motif que agency-verification-engine.spec.ts) :
    // une agence sur laquelle le moteur a tourne journalise un activity_events
    // append-only, ce qui peut empecher sa suppression (ON DELETE SET NULL sur
    // agency_id declenche le trigger d'immutabilite). On rapporte nommement,
    // jamais en silence.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-verification-run.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test non ` +
          'supprimee(s) -- limite structurelle documentee dans agency-verification-engine.spec.ts ' +
          '(activity_events est append-only, LBA art. 7), pas un echec inattendu :\n' +
          undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createAgency(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Run ${stamp}`, slug: `agence-run-${stamp}` })
      .select('id')
      .single()
    if (error) throw new Error(`agency: ${error.message}`)
    agencyIds.push(data!.id as string)
    return data!.id as string
  }

  async function addActiveSignatory(agencyId: string): Promise<string> {
    const svc = serviceRoleClient()
    const { data: person, error: pErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Signataire' })
      .select('id')
      .single()
    if (pErr) throw new Error(`related_person: ${pErr.message}`)
    const { error: rErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })
    if (rErr) throw new Error(`person_role: ${rErr.message}`)
    return person!.id as string
  }

  async function getAgency(
    agencyId: string
  ): Promise<{ verification_status: string; verification_score: number | string | null }> {
    const { data, error } = await serviceRoleClient()
      .from('agencies')
      .select('verification_status, verification_score')
      .eq('id', agencyId)
      .single()
    if (error) throw new Error(`get agency: ${error.message}`)
    return data as { verification_status: string; verification_score: number | string | null }
  }

  async function getChecks(agencyId: string): Promise<{ check_type: string; result: string }[]> {
    const { data, error } = await serviceRoleClient()
      .from('agency_verification_checks')
      .select('check_type, result')
      .eq('agency_id', agencyId)
    if (error) throw new Error(`get checks: ${error.message}`)
    return data as { check_type: string; result: string }[]
  }

  async function getEvents(agencyId: string, action: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await serviceRoleClient()
      .from('activity_events')
      .select('category, severity, actor_id, actor_kind, entity_type, entity_id, metadata')
      .eq('agency_id', agencyId)
      .eq('action', action)
    if (error) throw new Error(`get events ${action}: ${error.message}`)
    return data as Record<string, unknown>[]
  }

  describe('harnais pur -- runKybSource / runAgencyKybSources (aucun reseau, aucune DB)', () => {
    it('une source qui echoue produit unavailable, jamais un throw', async () => {
      const row = await runKybSource(failingSource('domain_whois_age'), FAKE_AGENCY)
      expect(row.result).toBe('unavailable')
      expect(row.check_type).toBe('domain_whois_age')
      expect(row.source).toBe('manual')
      expect(row.raw_response).not.toBeNull()
    })

    it('une source qui expire produit unavailable (jamais un hang indefini)', async () => {
      const row = await runKybSource(hangingSource('vat_lookup'), FAKE_AGENCY, 50)
      expect(row.result).toBe('unavailable')
      expect(row.check_type).toBe('vat_lookup')
    }, 2_000)

    it('une source qui reussit renvoie son propre resultat, inchange par le harnais', async () => {
      const row = await runKybSource(okSource('address_geocode', 'partial'), FAKE_AGENCY)
      expect(row.result).toBe('partial')
      expect(row.raw_response).toEqual({ probe: true })
    })

    it("aucune source ne produit jamais l'absence de ligne, quel que soit le sort de chacune", async () => {
      const sources = [okSource('address_geocode'), failingSource('domain_whois_age'), hangingSource('vat_lookup')]
      const rows = await Promise.all(sources.map((s) => runKybSource(s, FAKE_AGENCY, 50)))

      expect(rows).toHaveLength(sources.length)
      for (const row of rows) {
        expect(['match', 'partial', 'mismatch', 'unavailable', 'pending_manual_review']).toContain(row.result)
      }
      expect(rows[0].result).toBe('match')
      expect(rows[1].result, 'echec reseau -> unavailable, jamais absent').toBe('unavailable')
      expect(rows[2].result, 'timeout -> unavailable, jamais absent').toBe('unavailable')
    })

    it('runAgencyKybSources ne rejette jamais, meme si toutes les sources echouent ou expirent', async () => {
      const sources = [failingSource('domain_whois_age'), hangingSource('vat_lookup')]
      // Timeout court (50ms) : sans cet override, hangingSource attendrait
      // DEFAULT_SOURCE_TIMEOUT_MS (10s) avant de se resoudre -- correct mais inutilement
      // lent pour un test.
      const rows = await runAgencyKybSources(FAKE_AGENCY, sources, 50)
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.result === 'unavailable')).toBe(true)
    }, 2_000)

    it('AGENCY_KYB_SOURCES contient les 4 connecteurs sans configuration ajoutes aux taches 2 et 3 (RDAP, VIES, recherche-entreprises x2)', () => {
      // RDAP (tache 2) puis VIES + recherche-entreprises x2 (tache 3) : quatre
      // connecteurs qui n'ont besoin d'aucun secret, donc statiques dans ce registre
      // construit au chargement du module. Le geocodage Mapbox (tache 3 egalement)
      // n'y figure PAS : seul connecteur de ce fichier a avoir besoin d'un jeton, il
      // est construit par createAddressGeocodeSource() -- voir son en-tete dans
      // _shared/kyb-sources.ts et le describe dedie plus bas. Un check_type non
      // catalogue dans verification_check_types ferait de toute facon echouer
      // l'insert (FK, 20260728103000) -- ces entrees SONT donc deja de vrais
      // connecteurs, jamais des doubles de test.
      expect(AGENCY_KYB_SOURCES).toHaveLength(4)
      const sourceOfCheckType = (checkType: string) => AGENCY_KYB_SOURCES.find((s) => s.checkType === checkType)?.source
      expect(sourceOfCheckType('domain_whois_age')).toBe('rdap')
      expect(sourceOfCheckType('vat_lookup')).toBe('vies')
      expect(sourceOfCheckType('registry_lookup')).toBe('recherche_entreprises')
      expect(sourceOfCheckType('registry_legal_name_match')).toBe('recherche_entreprises')
    })

    // Revue etape 4/tache 1, point 1 : raw_response est desormais OBLIGATOIRE dans
    // KybSourceResult (voir _shared/kyb-sources.ts) -- un verdict sans preuve jointe
    // ne doit plus pouvoir s'ecrire. Les quatre tests ci-dessous verifient que le cas
    // `unavailable` (le seul que le harnais fabrique lui-meme) joint une preuve
    // exploitable par un humain, jamais un objet vide, jamais l'erreur brute (donc
    // jamais un secret ou un en-tete d'authentification).

    it("le raw_response d'un echec porte le type d'erreur et le message, exploitables par un humain qui relira le dossier", async () => {
      const row = await runKybSource(failingSource('domain_whois_age'), FAKE_AGENCY)
      expect(row.result).toBe('unavailable')
      expect(row.raw_response).toMatchObject({ reason: 'error', error_type: 'Error' })
      expect(typeof row.raw_response.message).toBe('string')
      expect(row.raw_response.message).toContain('boom-domain_whois_age')
    })

    it("le raw_response d'un timeout porte reason='timeout' et le nom de l'erreur de timeout, jamais un match par defaut", async () => {
      const row = await runKybSource(hangingSource('vat_lookup'), FAKE_AGENCY, 50)
      expect(row.result).toBe('unavailable')
      expect(row.raw_response).toMatchObject({ reason: 'timeout', error_type: 'KybSourceTimeoutError' })
      expect(row.raw_response.message).toContain('50ms')
    }, 2_000)

    it('un code de statut porte par une erreur de source est reporte dans raw_response.status, sans jamais transporter un secret ou un en-tete', async () => {
      // Simule un connecteur fetch()-base (taches 2+) dont l'erreur embarque sa
      // reponse HTTP -- statut ET en-tetes, Authorization compris. describeSourceFailure
      // (kyb-sources.ts) ne doit cherry-picker QUE le statut, jamais le reste.
      const statusSource: KybSource = {
        checkType: 'domain_whois_age',
        source: 'manual',
        run: async () => {
          const err = new Error('service unavailable') as Error & {
            status: number
            headers: Record<string, string>
          }
          err.status = 503
          err.headers = { Authorization: 'Bearer secret-token-do-not-leak' }
          throw err
        },
      }
      const row = await runKybSource(statusSource, FAKE_AGENCY)
      expect(row.result).toBe('unavailable')
      expect(row.raw_response.status).toBe(503)
      const serialized = JSON.stringify(row.raw_response)
      expect(serialized).not.toContain('secret-token-do-not-leak')
      expect(serialized).not.toContain('Authorization')
    })

    it('quel que soit le sort de chaque source (succes/echec/timeout), raw_response est toujours un objet non nul -- jamais absent', async () => {
      const sources = [okSource('address_geocode'), failingSource('domain_whois_age'), hangingSource('vat_lookup')]
      const rows = await Promise.all(sources.map((s) => runKybSource(s, FAKE_AGENCY, 50)))
      for (const row of rows) {
        expect(row.raw_response, `raw_response absent pour ${row.check_type}`).not.toBeNull()
        expect(row.raw_response, `raw_response absent pour ${row.check_type}`).not.toBeUndefined()
        expect(typeof row.raw_response).toBe('object')
      }
    })
  })

  describe('Edge Function deployee -- contrat HTTP', () => {
    async function callRun(agencyId: string, bearer: string = SERVICE_KEY): Promise<Response> {
      // apikey + Authorization avec la MEME valeur : meme motif defensif que
      // kyc-report-data.spec.ts (cette fonction n'est pas dans la liste
      // verify_jwt=false de config.toml -- le passage par la passerelle locale
      // depend d'une cle reconnue, l'autorisation reelle est verifiee PAR la
      // fonction elle-meme, pas par la passerelle).
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: bearer,
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ agency_id: agencyId }),
      })
    }

    it('OPTIONS -> 2xx (CORS preflight)', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://megga.ch',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      })
      expect(res.status >= 200 && res.status < 300, `CORS preflight got ${res.status}`).toBe(true)
    })

    it('sans Authorization -> 401', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_id: NIL_UUID }),
      })
      expect(res.status).toBe(401)
    })

    it("un Bearer valide mais qui n'est pas la cle service-role -> 401 (le jeton anon ne doit jamais suffire)", async () => {
      const res = await callRun(NIL_UUID, ANON_KEY)
      expect(res.status).toBe(401)
    })

    it('agency_id absent du corps -> 400', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('agency_id malforme (pas un uuid) -> 400', async () => {
      const res = await callRun('not-a-uuid')
      expect(res.status).toBe(400)
    })

    it('agence introuvable -> 404', async () => {
      const res = await callRun(NIL_UUID)
      expect(res.status).toBe(404)
    })

    it('ecrit les 5 checks (tous unavailable sans aucune donnee KYB declaree), appelle bien le moteur apres avoir ecrit, et journalise son passage', async () => {
      const agencyId = await createAgency('happy')
      await addActiveSignatory(agencyId)

      const res = await callRun(agencyId)
      const body = await res.json()
      expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
      expect(body.ok).toBe(true)
      // Cinq connecteurs au total depuis la tache 3 : RDAP + VIES + recherche-entreprises
      // x2 (statiques dans AGENCY_KYB_SOURCES) + Mapbox (ajoute par la fonction
      // elle-meme via createAddressGeocodeSource -- voir son en-tete). createAgency()
      // ne pose ni website, ni tva, ni country/business_registration_number, ni adresse
      // -> chaque connecteur n'a rien a verifier et produit `unavailable` (jamais un
      // echec, jamais une absence de ligne).
      expect(body.checks_written).toBe(5)
      expect(body.results.unavailable).toBe(5)

      // Le moteur a bien tourne : aucun check scorable disponible (tous unavailable,
      // exclus du numerateur ET du denominateur, regle du moteur 20260728130000) ->
      // score toujours null -> jamais auto_validated, et le statut a bouge du defaut
      // 'pending' vers 'manual_review'.
      const agency = await getAgency(agencyId)
      expect(agency.verification_status).toBe('manual_review')
      expect(num(agency.verification_score)).toBeNull()

      // Deux journalisations DISTINCTES : celle du moteur lui-meme
      // (agency_verification_recomputed, deja garantie par l'etape 3) et celle de
      // CETTE fonction (agency_verification_run, "journalise son passage" -- brief
      // tache 1).
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(1)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(1)

      const checks = await getChecks(agencyId)
      expect(checks).toHaveLength(5)
      expect(checks.every((c) => c.result === 'unavailable')).toBe(true)
      expect(new Set(checks.map((c) => c.check_type))).toEqual(
        new Set(['domain_whois_age', 'vat_lookup', 'registry_lookup', 'registry_legal_name_match', 'address_geocode'])
      )
    })

    it(
      'site web grand public (gmail.com) -> ecrit le check sous domain_generic_provider, jamais domain_whois_age ' +
        '(revue etape 4/tache 2, point 2 -- verifie ici contre le catalogue REEL, pas seulement contre la lecture du connecteur)',
      async () => {
        const agencyId = await createAgency('generic-provider')
        await addActiveSignatory(agencyId)
        const svc = serviceRoleClient()
        const { error: updErr } = await svc.from('agencies').update({ website: 'gmail.com' }).eq('id', agencyId)
        if (updErr) throw new Error(`update website: ${updErr.message}`)

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        // 5 connecteurs au total (voir le test precedent) -- seul RDAP a de quoi
        // repondre ici (website renseigne), les 4 autres restent unavailable.
        expect(body.checks_written).toBe(5)
        expect(body.results.partial).toBe(1)
        expect(body.results.unavailable).toBe(4)

        const checks = await getChecks(agencyId)
        expect(checks).toHaveLength(5)
        const genericProviderCheck = checks.find((c) => c.check_type === 'domain_generic_provider')
        expect(
          genericProviderCheck,
          'la FK agency_verification_checks.check_type -> verification_check_types.code aurait rejete un code absent du catalogue -- domain_generic_provider y figure deja avec son propre poids (migration 20260728103000)'
        ).toBeDefined()
        expect(genericProviderCheck?.result).toBe('partial')
      }
    )

    it('le passage journalise respecte activity_events (category=kyc, actor_kind=system, actor_id NULL)', async () => {
      const agencyId = await createAgency('audit-log')
      await addActiveSignatory(agencyId)
      const res = await callRun(agencyId)
      expect(res.status).toBe(200)

      const events = await getEvents(agencyId, 'agency_verification_run')
      expect(events).toHaveLength(1)
      const event = events[0]
      expect(event.category, 'category doit valoir kyc (jamais compliance, hors CHECK)').toBe('kyc')
      expect(event.actor_kind, "c'est cette fonction qui agit, pas un humain").toBe('system')
      expect(event.actor_id, 'actor_kind=system impose actor_id NULL').toBeNull()
      expect(event.entity_type).toBe('agency')
      expect(event.entity_id).toBe(agencyId)
    })

    it('rejouable : deux appels de suite ecrivent chacun leurs propres checks (pas de dedoublonnage cote fonction) et font tourner le moteur deux fois', async () => {
      const agencyId = await createAgency('replay')
      await addActiveSignatory(agencyId)

      const res1 = await callRun(agencyId)
      expect(res1.status).toBe(200)
      const res2 = await callRun(agencyId)
      expect(res2.status).toBe(200)

      // "Rejouable" ne veut pas dire "dedoublonne" : cette fonction insere une ligne a
      // CHAQUE appel pour CHAQUE connecteur (5 au total depuis la tache 3), c'est le
      // moteur qui departage plusieurs lignes du meme type par ctid (voir le test
      // dedie plus bas), jamais cette fonction qui filtre avant d'ecrire.
      expect(await getChecks(agencyId)).toHaveLength(10)
      // Chaque appel a reellement fait tourner le moteur -- pas seulement le
      // premier -- et journalise son propre passage a chaque fois.
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(2)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(2)
    })

    it(
      'rejouable sans empiler de doublons CONTRADICTOIRES : deux checks du meme type dans la ' +
        'meme transaction se departagent par ctid, jamais par date (revue etape 3)',
      async () => {
        const agencyId = await createAgency('same-tx-tiebreak')
        await addActiveSignatory(agencyId)

        // Simule ce qu'ecrirait un futur connecteur qui rejoue un veto : deux lignes
        // du meme check_type dans UN SEUL insert => meme checked_at (defaut = debut
        // de transaction, cf. l'en-tete de recompute_agency_verification). Ce test
        // verifie que la plomberie de cette fonction (appel du moteur APRES
        // l'ecriture, sans jamais essayer de reordonner/nettoyer les checks
        // existants elle-meme -- y compris ceux, distincts, que le connecteur RDAP
        // ecrit a chaque appel) laisse le moteur trancher correctement sur les DEUX
        // lignes seedees ici, et que rejouer ne casse pas ce resultat.
        const svc = serviceRoleClient()
        const { error: seedErr } = await svc.from('agency_verification_checks').insert([
          { agency_id: agencyId, check_type: 'registry_number_format', source: 'manual', result: 'match' },
          { agency_id: agencyId, check_type: 'registry_number_format', source: 'manual', result: 'mismatch' },
        ])
        if (seedErr) throw new Error(`seed same-tx: ${seedErr.message}`)

        const res = await callRun(agencyId)
        expect(res.status).toBe(200)

        // Veto registry_number_format tranche sur la ligne inseree EN DERNIER
        // (mismatch) -- jamais sur l'egalite de date -- donc revue humaine, jamais
        // auto_validated.
        const agency = await getAgency(agencyId)
        expect(
          agency.verification_status,
          "la ligne inseree en dernier (mismatch) doit gagner ; ne jamais s'appuyer sur checked_at pour l'ordre"
        ).toBe('manual_review')

        // Rejouer une seconde fois ne doit ni faire disparaitre ce resultat ni
        // reordonner/nettoyer les 2 lignes seedees (cette fonction ne touche jamais
        // aux checks existants) : le veto reste tranche par la meme ligne mismatch,
        // toujours manual_review. Le compte total grandit bien (chaque connecteur reel
        // ecrit sa propre ligne a chaque appel -- 5 depuis la tache 3, +5 a res, +5 a
        // res2), preuve que "rejouable" n'est pas "silencieux" -- seul le resultat
        // DECISIF (le veto seede) ne doit pas bouger.
        const res2 = await callRun(agencyId)
        expect(res2.status).toBe(200)
        expect(await getChecks(agencyId)).toHaveLength(12)
        const agencyAfter = await getAgency(agencyId)
        expect(agencyAfter.verification_status).toBe('manual_review')
      }
    )
  })

  describe('record_agency_verification_run -- atomicite (revue etape 4/tache 1, point 2)', () => {
    // Avant ce correctif, l'ecriture des checks, l'appel du moteur et la
    // journalisation du passage de agency-verification-run etaient trois appels
    // separes (trois transactions) -- un echec sur le DERNIER laissait le travail
    // deja committe (voir l'en-tete d'agency-verification-run/index.ts). La RPC
    // record_agency_verification_run (20260728140000) enveloppe desormais les trois
    // dans UNE SEULE transaction Postgres. Preuve directe : on force un echec sur ce
    // qui etait l'etape 3 (le journal, via un p_severity qui viole
    // activity_events_severity_check) APRES que les deux premieres etapes (insert
    // des checks, recompute_agency_verification) ont reellement tourne -- et on
    // verifie qu'AUCUNE des trois n'a laisse de trace : ni le check insere, ni la
    // decision du moteur, ni l'un ou l'autre evenement.
    it("un echec sur la journalisation (dernier insert) annule aussi l'ecriture des checks et le passage du moteur -- rien ne reste committe", async () => {
      const agencyId = await createAgency('atomic-rollback')
      await addActiveSignatory(agencyId)

      const svc = serviceRoleClient()
      const before = await getAgency(agencyId)
      expect(before.verification_status, 'statut par defaut avant tout passage').toBe('pending')

      const { error } = await svc.rpc('record_agency_verification_run', {
        p_agency_id: agencyId,
        p_checks: [{ check_type: 'vat_lookup', source: 'manual', result: 'match', raw_response: { probe: true } }],
        // Valeur hors activity_events_severity_check ('info' | 'warn' | 'critical')
        // -- force un echec APRES que l'insert des checks et l'appel du moteur ont
        // deja eu lieu dans cette meme fonction PL/pgSQL.
        p_severity: 'not-a-valid-severity',
        p_metadata: { probe: true },
      })

      expect(error, 'le CHECK constraint sur severity doit rejeter la valeur invalide').not.toBeNull()

      // Rien ne doit avoir ete committe : ni le check insere, ni la decision du
      // moteur (statut/score inchanges), ni son propre evenement, ni celui du
      // moteur -- tout ou rien, jamais un etat intermediaire.
      expect(await getChecks(agencyId)).toHaveLength(0)
      const after = await getAgency(agencyId)
      expect(after.verification_status, 'le moteur a bien tourne PUIS a ete annule avec le reste').toBe('pending')
      expect(num(after.verification_score)).toBeNull()
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(0)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(0)
    })
  })
})

// ─── Connecteur RDAP (domain_whois_age, etape 4 tache 2) -- logique pure ──────────
//
// Hors du describe.skipIf(!HAS_KEYS) ci-dessus DELIBEREMENT : ce volet n'a besoin ni
// de reseau reel (fetch stubbe, meme motif que _shared/esign-finalize.test.ts) ni de
// Supabase local (import direct du module, meme motif que le "harnais pur" plus
// haut). Il DOIT tourner meme sans `supabase start`, et jamais dependre de la
// disponibilite des serveurs RDAP publics (rdap.nic.ch / .li / .fr) -- une suite de
// tests qui dependrait d'un service tiers serait aussi fragile que le systeme qu'elle
// verifie. La verification CONTRE le vrai serveur RDAP se fait a la main, une fois,
// hors de cette suite -- voir docs/superpowers/sdd/task-2-report.md.
describe('connecteur RDAP (domain_whois_age) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function rdapSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'domain_whois_age')
    if (!found) throw new Error('domain_whois_age absent de AGENCY_KYB_SOURCES -- le connecteur RDAP n est pas enregistre')
    return found
  }

  function agencyWithWebsite(website: string | null): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'CH',
      canton: 'GE',
      city: null,
      postal_code: null,
      address: null,
      website,
      tva: null,
    }
  }

  // Reponse RDAP minimale valide -- {status, events} par defaut, ecrasable au cas par
  // cas. new Response() (global Node/Deno standard, aucun import) suffit : le
  // connecteur ne lit que .status (HTTP) et .json().
  function rdapResponse(body: Record<string, unknown>, httpStatus = 200): Response {
    return new Response(JSON.stringify({ status: ['active'], events: [], ...body }), {
      status: httpStatus,
      headers: { 'content-type': 'application/json' },
    })
  }

  it('aucun site web declare -> unavailable, jamais mismatch (rien a verifier) -- et aucune requete reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite(null))
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('domain_whois_age')
    expect(row.source).toBe('rdap')
    expect(fetchSpy, 'pas de site web -> rien a interroger, jamais un appel RDAP').not.toHaveBeenCalled()
  })

  it('site web vide (chaine blanche) -> unavailable, meme traitement que null', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(rdapSource(), agencyWithWebsite('   '))
    expect(row.result).toBe('unavailable')
  })

  it('suffixe non couvert (.de) -> unavailable, jamais un echec qui bloque tout le passage', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://www.example.de'))
    expect(row.result).toBe('unavailable')
    expect(fetchSpy, 'suffixe non couvert -> aucun serveur a interroger').not.toHaveBeenCalled()
  })

  it("domaine grand public (gmail.com) -> check domain_generic_provider en partial, jamais domain_whois_age (revue etape 4/tache 2, point 2) : beaucoup de petites agences n'ont pas de domaine propre", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite('gmail.com'))
    expect(row.result).toBe('partial')
    expect(
      row.check_type,
      'le catalogue (verification_check_types/verification_check_config, migration 20260728103000) distingue domain_generic_provider de domain_whois_age avec un poids different (1.00 vs 0.75) -- les plier dans un seul type laisserait une ligne de config morte'
    ).toBe('domain_generic_provider')
    expect(row.raw_response).toMatchObject({ domain: 'gmail.com', reason: 'generic_email_provider' })
    expect(fetchSpy, 'un domaine grand public ne declenche meme pas de requete RDAP').not.toHaveBeenCalled()
  })

  it('outlook.com (autre domaine grand public, avec chemin) -> partial et check_type domain_generic_provider egalement', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://outlook.com/mail/inbox'))
    expect(row.result).toBe('partial')
    expect(row.check_type).toBe('domain_generic_provider')
    expect(row.raw_response.domain).toBe('outlook.com')
  })

  it('domaine .ch introuvable au registre (RDAP 404) -> mismatch, jamais unavailable : le serveur A repondu, sans ambiguite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://une-agence-qui-nexiste-pas-zzz.ch'))
    expect(row.result).toBe('mismatch')
    expect(row.raw_response).toMatchObject({
      domain: 'une-agence-qui-nexiste-pas-zzz.ch',
      rdap_status: 404,
      reason: 'domain_not_registered',
    })
  })

  it(
    'domaine .ch enregistre il y a 3 jours, statut actif -> partial, jamais mismatch : un domaine recent ' +
      'ne contredit rien, il confirme seulement moins bien qu un domaine etabli (revue etape 4/tache 2, point 1)',
    async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: threeDaysAgo }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://jeune-agence.ch'))
      expect(
        row.result,
        'une agence fondee le mois dernier a legitimement un domaine du mois dernier -- mismatch inscrirait un verdict defavorable pour un fait qui n a rien d anormal'
      ).toBe('partial')
      expect(row.raw_response.age_days).toBeLessThan(10)
    }
  )

  it(
    "domaine .ch enregistre a l'instant (age_days = 0), statut actif -> partial, jamais un verdict defavorable : " +
      'preuve directe qu un domaine actif tres recent ne contredit jamais rien (revue etape 4/tache 2, point 1)',
    async () => {
      const rightNow = new Date().toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: rightNow }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://toute-nouvelle-agence.ch'))
      expect(row.raw_response.age_days).toBe(0)
      expect(row.result, 'meme a age_days=0 et statut actif, jamais mismatch -- seule la contradiction (inexistant/expire/suspendu) le justifie').toBe(
        'partial'
      )
    }
  )

  it('domaine .fr enregistre il y a plus de 6 mois, statut actif -> match', async () => {
    const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://www.regie-etablie.fr'))
    expect(row.result).toBe('match')
    expect(row.check_type, 'chemin normal (pas fournisseur grand public) -> check_type par defaut du connecteur').toBe('domain_whois_age')
  })

  it(
    'domaine .ch etabli (plus de 6 mois) mais statut pendingDelete -> mismatch : un domaine qui a existe mais ne ' +
      'tient plus contredit reellement une agence qui se pretend etablie ET en activite (revue etape 4/tache 2, point 1)',
    async () => {
      const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['pendingDelete'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-abandonnee.ch'))
      expect(row.result).toBe('mismatch')
    }
  )

  it('domaine .li enregistre il y a 90 jours (recent, sous le seuil d etablissement) -> partial : confirme moins bien qu un domaine etabli, sans jamais contredire', async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: ninetyDaysAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('agence-recente.li'))
    expect(row.result).toBe('partial')
  })

  it("reponse RDAP sans date d'enregistrement (constate en verification manuelle sur plusieurs domaines .ch reels) mais statut actif -> partial, jamais un match invente sur une anciennete inconnue", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rdapResponse({ status: ['active'], events: [] })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-sans-date.ch'))
    expect(row.result).toBe('partial')
  })

  it('statut non-actif sans date -> partial, jamais mismatch sur ce seul indice (vocabulaire de statut trop variable d un registre a l autre)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rdapResponse({ status: ['inactive'], events: [] })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-inactive.ch'))
    expect(row.result).toBe('partial')
  })

  it('le serveur RDAP repond en erreur serveur (500) -> unavailable, jamais un echec qui bloque le dossier', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable, jamais un match invente faute de savoir lire la reponse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>pas du json</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('panne reseau (fetch qui rejette) -> unavailable, jamais une exception qui remonte jusqu au moteur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('le domaine est extrait du site web quelle que soit sa forme (https://, www., chemin, query) et interroge le bon registre selon le suffixe', async () => {
    const fetchSpy = vi.fn(async () => rdapResponse({ status: ['active'], events: [] }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(rdapSource(), agencyWithWebsite('https://www.regie-dupont.ch/contact?ref=1'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://rdap.nic.ch/domain/regie-dupont.ch')
  })

  it('route .li vers rdap.nic.li et .fr vers rdap.nic.fr', async () => {
    const fetchSpy = vi.fn(async () => rdapResponse({ status: ['active'], events: [] }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(rdapSource(), agencyWithWebsite('regie.li'))
    await runKybSource(rdapSource(), agencyWithWebsite('regie.fr'))
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://rdap.nic.li/domain/regie.li')
    expect(String(fetchSpy.mock.calls[1][0])).toBe('https://rdap.nic.fr/domain/regie.fr')
  })

  it('un resultat calcule (match/partial/mismatch) joint toujours domaine, statut HTTP et payload RDAP -- jamais un verdict sans preuve (revue etape 4/tache 1, point 1)', async () => {
    const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-etablie.ch'))
    expect(row.result).toBe('match')
    expect(row.raw_response.domain).toBe('regie-etablie.ch')
    expect(row.raw_response.rdap_status).toBe(200)
    expect(row.raw_response.rdap).toBeTruthy()
  })

  it("timeout du connecteur RDAP (signal d'annulation atteint) -> unavailable via le harnais, meme sans reponse du tout", async () => {
    // Simule un serveur qui ne repond jamais : fetch ne se resout ni ne rejette avant
    // le timeout externe de runKybSource (Promise.race, _shared/kyb-sources.ts).
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-muette.ch'), 50)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'timeout' })
  }, 2_000)
})

// ─── Connecteur VIES (vat_lookup, etape 4 tache 3) -- logique pure ────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que le connecteur RDAP
// plus haut : fetch stubbe, aucun reseau reel, aucune dependance Supabase locale. La
// verification CONTRE le vrai service VIES se fait a la main, une fois, hors de cette
// suite -- voir docs/superpowers/sdd/task-3-report.md (endpoint REST, codes pays
// couverts EL/XI vs GR/GB/CH, forme exacte de reponse -- tout verifie en direct).
describe('connecteur VIES (vat_lookup) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function vatLookupSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'vat_lookup')
    if (!found) throw new Error('vat_lookup absent de AGENCY_KYB_SOURCES -- le connecteur VIES n est pas enregistre')
    return found
  }

  function agencyWithTva(tva: string | null): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'FR',
      canton: null,
      city: null,
      postal_code: null,
      address: null,
      website: null,
      tva,
    }
  }

  function viesResponse(body: Record<string, unknown>): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  it('aucune TVA declaree -> unavailable, jamais mismatch (facultative a la saisie) -- et aucune requete reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(vatLookupSource(), agencyWithTva(null))
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('vat_lookup')
    expect(row.source).toBe('vies')
    expect(fetchSpy, 'pas de TVA -> rien a verifier, jamais un appel VIES').not.toHaveBeenCalled()
  })

  it('TVA vide (chaine blanche) -> unavailable, meme traitement que null', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(vatLookupSource(), agencyWithTva('   '))
    expect(row.result).toBe('unavailable')
  })

  it(
    'TVA suisse (CHE-...) -> unavailable, jamais un appel VIES : la Suisse est hors UE, non couverte ' +
      '(registre UID, etape 6)',
    async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(vatLookupSource(), agencyWithTva('CHE-115.856.981 TVA'))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  )

  it('numero valide selon VIES -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: true, name: 'SA EXEMPLE', address: '1 RUE X' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('match')
  })

  it('numero juge invalide par VIES -> mismatch, jamais unavailable (le service A repondu)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: false, name: '---', address: '---' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR00000000000'))
    expect(row.result).toBe('mismatch')
  })

  it('la TVA saisie avec espaces/tirets/points est normalisee avant l appel (pays + numero corrects)', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('FR 10.632-012 100'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ countryCode: 'FR', vatNumber: '10632012100' })
  })

  it('la Grece (EL, pas GR) est acceptee et transmise telle quelle a VIES', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('EL123456789'))
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string).countryCode).toBe('EL')
  })

  it('Irlande du Nord (XI) est acceptee (regime TVA UE maintenu post-Brexit)', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('XI123456789'))
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string).countryCode).toBe('XI')
  })

  it(
    'VIES repond actionSucceed:false (code pays rejete ou service indisponible, HTTP 200 quand meme -- ' +
      'verifie en direct contre le vrai service, voir rapport de tache) -> unavailable, jamais mismatch',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => viesResponse({ actionSucceed: false, errorWrappers: [{ error: 'INVALID_INPUT' }] }))
      )
      const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
      expect(row.result).toBe('unavailable')
    }
  )

  it('erreur serveur (500) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>pas du json</html>', { status: 200 })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it('panne reseau (fetch qui rejette) -> unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it("timeout du connecteur -> unavailable via le harnais", async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'), 50)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'timeout' })
  }, 2_000)

  it('un resultat calcule joint toujours la TVA, le pays/numero extraits et la reponse VIES complete -- jamais un verdict sans preuve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: true, name: 'SA EXEMPLE' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.raw_response.country_code).toBe('FR')
    expect(row.raw_response.vat_number).toBe('10632012100')
    expect(row.raw_response.vies).toMatchObject({ valid: true, name: 'SA EXEMPLE' })
  })
})

// ─── Connecteur registre francais (registry_lookup / registry_legal_name_match,
//     etape 4 tache 3) -- logique pure ─────────────────────────────────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que RDAP/VIES plus haut.
// La verification CONTRE le vrai service (recherche-entreprises.api.gouv.fr) se fait a
// la main, une fois, hors de cette suite -- voir docs/superpowers/sdd/task-3-report.md
// (recherche par SIREN direct, forme exacte de reponse, SIREN inexistant -> 200 avec
// results:[] -- tout verifie en direct contre le vrai service).
describe('connecteur registre francais (registry_lookup / registry_legal_name_match) -- logique pure, fetch stubbe', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function registryLookupSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'registry_lookup')
    if (!found) throw new Error('registry_lookup absent de AGENCY_KYB_SOURCES')
    return found
  }

  function registryLegalNameMatchSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'registry_legal_name_match')
    if (!found) throw new Error('registry_legal_name_match absent de AGENCY_KYB_SOURCES')
    return found
  }

  function agencyFR(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Carrefour',
      trade_name: null,
      business_registration_number: '510761505',
      country: 'FR',
      canton: null,
      city: null,
      postal_code: null,
      address: null,
      website: null,
      tva: null,
      ...overrides,
    }
  }

  function rechercheEntreprisesResponse(results: Record<string, unknown>[]): Response {
    return new Response(JSON.stringify({ results, total_results: results.length }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  function activeResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { siren: '510761505', nom_raison_sociale: 'CARREFOUR', etat_administratif: 'A', ...overrides }
  }

  for (const label of ['registry_lookup', 'registry_legal_name_match'] as const) {
    const sourceOf = () => (label === 'registry_lookup' ? registryLookupSource() : registryLegalNameMatchSource())

    it(`${label} : siege hors France (CH) -> unavailable, jamais un appel reseau (ne s interroge que pour un siege en France)`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ country: 'CH' }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : aucun business_registration_number declare -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ business_registration_number: null }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : SIREN manifestement malforme (pas 9 chiffres) -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ business_registration_number: '12345' }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : erreur serveur (500) -> unavailable`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(`${label} : reponse illisible (JSON invalide) -> unavailable`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })))
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(
      `${label} : reponse HTTP 200 hors schema (results absent, ex. panne fournisseur) -> unavailable, ` +
        'jamais un verdict invente (revue etape 4/tache 3, point 1 -- meme garde que VIES : le type du champ ' +
        'attendu est verifie avant de conclure a une absence)',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(
            async () =>
              new Response(JSON.stringify({ error: 'service degrade' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
          )
        )
        const row = await runKybSource(sourceOf(), agencyFR())
        expect(row.result).toBe('unavailable')
      }
    )

    it(`${label} : panne reseau -> unavailable`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down')
        })
      )
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(`${label} : timeout -> unavailable via le harnais`, async () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
      const row = await runKybSource(sourceOf(), agencyFR(), 50)
      expect(row.result).toBe('unavailable')
    }, 2_000)
  }

  it('SIREN saisi avec espaces (forme d affichage officielle INSEE) -> normalise avant l appel', async () => {
    const fetchSpy = vi.fn(async () => rechercheEntreprisesResponse([activeResult()]))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(registryLookupSource(), agencyFR({ business_registration_number: '510 761 505' }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://recherche-entreprises.api.gouv.fr/search?q=510761505')
  })

  describe('registry_lookup -- existence et statut actif', () => {
    it('SIREN introuvable (results:[], le registre A repondu -- verifie en direct) -> mismatch, jamais unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('mismatch')
      expect(row.raw_response).toMatchObject({ reason: 'siren_not_found' })
    })

    it('entreprise active (etat_administratif=A) -> match', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([activeResult()])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('match')
    })

    it('entreprise existante mais cessee (etat_administratif != A) -> mismatch : contredit une agence qui se pretend en activite', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ etat_administratif: 'C' })]))
      )
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('mismatch')
    })

    it('un resultat calcule joint toujours le SIREN, le statut et la reponse complete -- jamais un verdict sans preuve', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([activeResult()])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.raw_response.siren).toBe('510761505')
      expect(row.raw_response.etat_administratif).toBe('A')
      expect(row.raw_response.recherche_entreprises).toBeTruthy()
    })
  })

  describe('registry_legal_name_match -- raison sociale (fuzzy strict : accents/casse/ponctuation)', () => {
    it('aucune raison sociale declaree (legal_name absent) -> unavailable, jamais un appel reseau', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: null }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('SIREN introuvable -> unavailable (rien a comparer), pas un doublon du mismatch de registry_lookup', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([])))
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it('raison sociale identique au caractere pres -> match', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'CARREFOUR' }))
      expect(row.result).toBe('match')
    })

    it('difference de casse et d accents seulement -> match (tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'REGIE DE LA COTE' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'régie de la Côte' }))
      expect(row.result).toBe('match')
    })

    it('difference de ponctuation seulement (S.A. vs SA, tiret vs espace) -> match (tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'DUPONT MARTIN SA' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Dupont-Martin S.A.' }))
      expect(row.result).toBe('match')
    })

    it('raison sociale reellement differente -> mismatch (rien au-dela d accent/casse/ponctuation n est tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Immobilier Dupont' }))
      expect(row.result).toBe('mismatch')
    })

    it('reste correct meme si l entreprise est cessee : le nom peut matcher independamment du statut actif', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ etat_administratif: 'C', nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Carrefour' }))
      expect(row.result).toBe('match')
    })

    it(
      'deux raisons sociales DIFFERENTES qui ne different que par la frontiere de mot (espace) ne doivent PAS ' +
        'matcher -- faux positif demontre en revue (etape 4/tache 3, point 2) : "Est Immobilier" et ' +
        '"ESTIM MOBILIER" se reduisaient avant correctif a la meme chaine, l espace ayant disparu comme ' +
        'n importe quelle ponctuation',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'ESTIM MOBILIER' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Est Immobilier' }))
        expect(row.result).toBe('mismatch')
      }
    )

    it(
      'la ligature Œ (aucune decomposition canonique Unicode, donc pas touchee par NFD) doit matcher son ' +
        'ecriture en deux lettres -- faux negatif demontre en revue (etape 4/tache 3, point 2) : ' +
        '"Dupont et Soeurs" vs "DUPONT ET SŒURS"',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'DUPONT ET SŒURS' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Dupont et Soeurs' }))
        expect(row.result).toBe('match')
      }
    )

    it(
      'la ligature Æ (voisine directe de Œ, meme absence de decomposition canonique) est egalement reduite ' +
        '-- pas seulement le cas signale (revue etape 4/tache 3, point 2)',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'AGENCE ÆQUITAS' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Agence Aequitas' }))
        expect(row.result).toBe('match')
      }
    )
  })
})

// ─── Connecteur geocodage Mapbox (address_geocode, etape 4 tache 3) -- logique pure ──
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que les connecteurs
// precedents. PAS de verification a la main contre le vrai service Mapbox pour ce
// connecteur precis (contrairement a VIES et recherche-entreprises) : aucun jeton
// Mapbox n'etait disponible dans l'environnement de cette tache -- voir les reserves
// de docs/superpowers/sdd/task-3-report.md. La forme de reponse stubbee ici reprend
// EXACTEMENT celle deja consommee en production par src/lib/mapbox.ts et
// src/components/crm-sugar-wizard/steps/Step2Address.tsx (Geocoding v5,
// `features[].context[]` avec `id`/`short_code`).
describe('connecteur geocodage Mapbox (address_geocode) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function agencyGeo(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'CH',
      canton: 'GE',
      city: 'Geneve',
      postal_code: '1201',
      address: 'Rue du Rhone 1',
      website: null,
      tva: null,
      ...overrides,
    }
  }

  function mapboxResponse(features: Record<string, unknown>[]): Response {
    return new Response(JSON.stringify({ features }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  function chGeFeature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      place_name: 'Rue du Rhone 1, 1201 Geneve, Suisse',
      context: [
        { id: 'region.456', short_code: 'CH-GE' },
        { id: 'country.789', short_code: 'CH' },
      ],
      ...overrides,
    }
  }

  it('aucun jeton configure -> unavailable, jamais un appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(createAddressGeocodeSource(''), agencyGeo())
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('address_geocode')
    expect(row.source).toBe('mapbox')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucune adresse declaree -> unavailable, jamais un appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(
      createAddressGeocodeSource('fake-token'),
      agencyGeo({ address: null, postal_code: null, city: null })
    )
    expect(row.result).toBe('unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucun pays declare -> unavailable, jamais un appel reseau (rien a comparer)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: null }))
    expect(row.result).toBe('unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucun resultat de geocodage (0 feature) -> partial, jamais mismatch (Mapbox n est pas un registre exhaustif)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('partial')
  })

  it('pays geocode identique au pays declare -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: null }))
    expect(row.result).toBe('match')
  })

  it('canton geocode identique au canton declare (CH) -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
    expect(row.result).toBe('match')
  })

  it('pays geocode DIFFERENT du pays declare -> mismatch : contradiction reelle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mapboxResponse([chGeFeature({ context: [{ id: 'country.1', short_code: 'FR' }] })]))
    )
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH' }))
    expect(row.result).toBe('mismatch')
  })

  it('pays coherent mais canton geocode DIFFERENT du canton declare -> mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mapboxResponse([
          chGeFeature({
            context: [
              { id: 'region.1', short_code: 'CH-ZH' },
              { id: 'country.2', short_code: 'CH' },
            ],
          }),
        ])
      )
    )
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
    expect(row.result).toBe('mismatch')
  })

  it(
    'pays coherent, canton absent de la reponse (non contredit) -> match : le canton ne fait que basculer un match ' +
      'en mismatch, jamais l inverse a lui seul',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mapboxResponse([chGeFeature({ context: [{ id: 'country.1', short_code: 'CH' }] })]))
      )
      const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
      expect(row.result).toBe('match')
    }
  )

  it('reponse sans contexte pays exploitable -> partial, jamais invente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([{ place_name: 'quelque part', context: [] }])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('partial')
  })

  it(
    'reponse HTTP 200 hors schema (features absent) -> unavailable, jamais partial (zero resultat invente -- ' +
      'meme defaut/remede que le registre francais, revue etape 4/tache 3, point 3)',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ message: 'Not Found' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
        )
      )
      const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
      expect(row.result).toBe('unavailable')
    }
  )

  it('erreur serveur (500) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('unavailable')
  })

  it(
    'panne reseau (fetch qui rejette) -> unavailable, et le message ne transporte JAMAIS le jeton ni l URL ' +
      '(seul connecteur de ce fichier dont la requete porte un secret en parametre)',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error(
            'request to https://api.mapbox.com/geocoding/v5/mapbox.places/x.json?access_token=SUPER-SECRET-TOKEN failed'
          )
        })
      )
      const row = await runKybSource(createAddressGeocodeSource('SUPER-SECRET-TOKEN'), agencyGeo())
      expect(row.result).toBe('unavailable')
      const serialized = JSON.stringify(row.raw_response)
      expect(serialized).not.toContain('SUPER-SECRET-TOKEN')
      expect(serialized).not.toContain('access_token')
    }
  )

  it('timeout du connecteur -> unavailable via le harnais', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo(), 50)
    expect(row.result).toBe('unavailable')
  }, 2_000)

  it('un resultat calcule ne joint jamais le jeton -- seule la requete texte (sans URL) et la reponse Mapbox figurent dans raw_response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('SUPER-SECRET-TOKEN'), agencyGeo())
    const serialized = JSON.stringify(row.raw_response)
    expect(serialized).not.toContain('SUPER-SECRET-TOKEN')
    expect(row.raw_response.query).toBe('Rue du Rhone 1, 1201, Geneve')
    expect(row.raw_response.mapbox).toBeTruthy()
  })
})
