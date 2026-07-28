// Backend test (live CI) -- socle de l'Edge Function agency-verification-run
// (etape 4, tache 1 -- supabase/functions/agency-verification-run/index.ts et son
// module partage supabase/functions/_shared/kyb-sources.ts).
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
// Deux volets dans ce fichier :
//   1. Le harnais PUR (_shared/kyb-sources.ts) -- import direct, aucun reseau,
//      aucune dependance Deno (ce module n'appelle jamais Deno.env.get, contrairement
//      a _shared/magic-link-token.ts -- aucun shim globalThis.Deno necessaire, meme
//      motif que whatsapp-antifab.spec.ts qui importe deja un _shared/*.ts sans
//      extension de la meme facon).
//   2. La fonction deployee (HTTP, port 54321) -- lecture agence, ecriture des
//      checks, appel du moteur, journalisation. AUCUN connecteur reel dans cette
//      tache : le registre AGENCY_KYB_SOURCES est vide par construction (brief
//      tache 1, « Tu n'ecris aucun connecteur reel dans cette tache »). Les tests
//      HTTP portent donc sur la PLOMBERIE (elle lit, ecrit, appelle le moteur,
//      journalise, rejoue proprement), jamais sur un connecteur reel -- absent
//      jusqu'aux taches 2 et 3.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer -- lire le compte de tests, jamais le code de
// sortie (meme convention que agency-verification-engine.spec.ts).

import { describe, it, expect, afterAll } from 'vitest'
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

    it("AGENCY_KYB_SOURCES est vide dans cette tache -- aucun connecteur reel n'est ecrit ici", () => {
      // Rappel brief tache 1 : "Tu n'ecris aucun connecteur reel dans cette tache."
      // Un check_type non catalogue dans verification_check_types ferait de toute
      // facon echouer l'insert (FK, 20260728103000) -- une entree ici serait deja un
      // vrai connecteur, jamais un double de test. Les taches 2 et 3 rempliront ce
      // registre.
      expect(AGENCY_KYB_SOURCES).toEqual([])
    })
  })

  describe('Edge Function deployee -- contrat HTTP', () => {
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

    it("ecrit (rien a ecrire dans cette tache), appelle bien le moteur apres avoir ecrit, et journalise son passage", async () => {
      const agencyId = await createAgency('happy')
      await addActiveSignatory(agencyId)

      const res = await callRun(agencyId)
      const body = await res.json()
      expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
      expect(body.ok).toBe(true)
      // Registre AGENCY_KYB_SOURCES vide dans cette tache -> zero check ecrit par
      // CETTE fonction. C'est attendu, pas une absence de comportement.
      expect(body.checks_written).toBe(0)

      // Le moteur a bien tourne : sans aucun check, score null -> jamais
      // auto_validated (regle du moteur, 20260728130000), et le statut a bouge du
      // defaut 'pending' vers 'manual_review'.
      const agency = await getAgency(agencyId)
      expect(agency.verification_status).toBe('manual_review')
      expect(num(agency.verification_score)).toBeNull()

      // Deux journalisations DISTINCTES : celle du moteur lui-meme
      // (agency_verification_recomputed, deja garantie par l'etape 3) et celle de
      // CETTE fonction (agency_verification_run, "journalise son passage" -- brief
      // tache 1).
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(1)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(1)
    })

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

    it("rejouable : deux appels de suite n'empilent aucun check propre a cette fonction et font tourner le moteur deux fois", async () => {
      const agencyId = await createAgency('replay')
      await addActiveSignatory(agencyId)

      const res1 = await callRun(agencyId)
      expect(res1.status).toBe(200)
      const res2 = await callRun(agencyId)
      expect(res2.status).toBe(200)

      // Registre vide dans cette tache -> aucune ecriture propre a cette fonction,
      // donc aucun doublon possible de son propre fait, quel que soit le nombre
      // d'appels.
      expect(await getChecks(agencyId)).toHaveLength(0)
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
        // de transaction, cf. l'en-tete de recompute_agency_verification). Le
        // registre de cette tache etant vide, cette fonction n'ecrit rien de son
        // propre chef ici -- ce test verifie que sa plomberie (appel du moteur APRES
        // l'ecriture, sans jamais essayer de reordonner/nettoyer les checks
        // existants elle-meme) laisse le moteur trancher correctement, et que
        // rejouer ne casse pas ce resultat.
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
        // empiler un doublon supplementaire (registre vide -> cette fonction ne
        // touche pas aux 2 lignes deja presentes) : toujours 2 lignes, toujours
        // manual_review.
        const res2 = await callRun(agencyId)
        expect(res2.status).toBe(200)
        expect(await getChecks(agencyId)).toHaveLength(2)
        const agencyAfter = await getAgency(agencyId)
        expect(agencyAfter.verification_status).toBe('manual_review')
      }
    )
  })
})
