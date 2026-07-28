// Backend test (live CI) -- socle de l'Edge Function agency-verification-run
// (etape 4, tache 1 -- supabase/functions/agency-verification-run/index.ts et son
// module partage supabase/functions/_shared/kyb-sources.ts) et connecteur RDAP
// (etape 4, tache 2 -- domain_whois_age, premier connecteur reel du registre).
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
// Trois volets dans ce fichier :
//   1. Le harnais PUR (_shared/kyb-sources.ts) -- import direct, aucun reseau,
//      aucune dependance Deno (ce module n'appelle jamais Deno.env.get, contrairement
//      a _shared/magic-link-token.ts -- aucun shim globalThis.Deno necessaire, meme
//      motif que whatsapp-antifab.spec.ts qui importe deja un _shared/*.ts sans
//      extension de la meme facon).
//   2. La fonction deployee (HTTP, port 54321) -- lecture agence, ecriture des
//      checks, appel du moteur, journalisation. Un seul connecteur reel existe a ce
//      stade (RDAP, domain_whois_age -- tache 2) ; les tests HTTP portent sur la
//      PLOMBERIE (elle lit, ecrit, appelle le moteur, journalise, rejoue proprement)
//      et tiennent compte de ce que CE connecteur ecrit reellement.
//   3. Le connecteur RDAP lui-meme (describe hors skipIf, plus bas dans ce fichier)
//      -- logique pure, fetch STUBBE (jamais de reseau reel dans la suite
//      automatisee, meme motif que _shared/esign-finalize.test.ts qui stubbe deja
//      fetch pour un connecteur externe). Tourne SANS Supabase local -- import
//      direct du module, comme le volet 1.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer -- lire le compte de tests, jamais le code de
// sortie (meme convention que agency-verification-engine.spec.ts). Le volet 3 (fetch
// stubbe) n'est lui-meme jamais concerne par ce skip : il ne touche ni reseau ni DB.

import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import {
  runKybSource,
  runAgencyKybSources,
  AGENCY_KYB_SOURCES,
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

    it('AGENCY_KYB_SOURCES contient exactement le connecteur RDAP ajoute par cette tache (domain_whois_age)', () => {
      // Le registre etait vide a la tache 1 ("Tu n'ecris aucun connecteur reel dans
      // cette tache"). Cette tache (2) y ajoute le premier connecteur reel : RDAP. Un
      // check_type non catalogue dans verification_check_types ferait de toute facon
      // echouer l'insert (FK, 20260728103000) -- cette entree EST donc deja un vrai
      // connecteur, jamais un double de test. La tache 3 (VIES, recherche-entreprises,
      // Mapbox) y ajoutera les siens.
      expect(AGENCY_KYB_SOURCES).toHaveLength(1)
      expect(AGENCY_KYB_SOURCES[0].checkType).toBe('domain_whois_age')
      expect(AGENCY_KYB_SOURCES[0].source).toBe('rdap')
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

    it('ecrit le check RDAP (domain_whois_age, unavailable sans site web declare), appelle bien le moteur apres avoir ecrit, et journalise son passage', async () => {
      const agencyId = await createAgency('happy')
      await addActiveSignatory(agencyId)

      const res = await callRun(agencyId)
      const body = await res.json()
      expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
      expect(body.ok).toBe(true)
      // Un seul connecteur reel dans le registre a ce stade (RDAP, tache 2).
      // createAgency() ne pose pas de website -> le connecteur n'a rien a verifier et
      // produit `unavailable` (jamais un echec, jamais une absence de ligne).
      expect(body.checks_written).toBe(1)
      expect(body.results.unavailable).toBe(1)

      // Le moteur a bien tourne : domain_whois_age est unavailable donc exclu du
      // score (regle du moteur, 20260728130000) -> score toujours null -> jamais
      // auto_validated, et le statut a bouge du defaut 'pending' vers 'manual_review'.
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
      expect(checks).toHaveLength(1)
      expect(checks[0].check_type).toBe('domain_whois_age')
      expect(checks[0].result).toBe('unavailable')
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
        expect(body.checks_written).toBe(1)
        expect(body.results.partial).toBe(1)

        const checks = await getChecks(agencyId)
        expect(checks).toHaveLength(1)
        expect(
          checks[0].check_type,
          'la FK agency_verification_checks.check_type -> verification_check_types.code aurait rejete un code absent du catalogue -- domain_generic_provider y figure deja avec son propre poids (migration 20260728103000)'
        ).toBe('domain_generic_provider')
        expect(checks[0].result).toBe('partial')
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

    it('rejouable : deux appels de suite ecrivent chacun leur propre check RDAP (pas de dedoublonnage cote fonction) et font tourner le moteur deux fois', async () => {
      const agencyId = await createAgency('replay')
      await addActiveSignatory(agencyId)

      const res1 = await callRun(agencyId)
      expect(res1.status).toBe(200)
      const res2 = await callRun(agencyId)
      expect(res2.status).toBe(200)

      // "Rejouable" ne veut pas dire "dedoublonne" : cette fonction insere une ligne a
      // CHAQUE appel (le connecteur RDAP tourne a nouveau), c'est le moteur qui
      // departage plusieurs lignes du meme type par ctid (voir le test dedie plus
      // bas), jamais cette fonction qui filtre avant d'ecrire.
      expect(await getChecks(agencyId)).toHaveLength(2)
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
        // toujours manual_review. Le compte total grandit bien (RDAP ecrit sa propre
        // ligne a chaque appel, +1 a res, +1 a res2), preuve que "rejouable" n'est pas
        // "silencieux" -- seul le resultat DECISIF (le veto seede) ne doit pas bouger.
        const res2 = await callRun(agencyId)
        expect(res2.status).toBe(200)
        expect(await getChecks(agencyId)).toHaveLength(4)
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
