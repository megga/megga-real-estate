// Backend spec (live CI) — vérification de PERSONNE dans le passage KYB (étape 7, tâche 4).
//
// CE QUE CETTE TÂCHE FERME. `pep_sanctions_screening` était déclaré véto de personne sans
// qu'aucun chemin de production ne lui écrive jamais de ligne : le moteur traite une ligne
// absente comme un véto échoué, donc AUCUN dossier ne pouvait atteindre `auto_validated`,
// dans aucun pays (voir tests/backend/agency-veto-coverage.spec.ts, qui l'interdit désormais).
// La cause profonde était que record_agency_verification_run n'écrivait que dans
// agency_verification_checks, portée AGENCE. Les checks de personne n'avaient pas de porte.
//
// Deux volets, testés séparément parce qu'ils peuvent casser indépendamment :
//   1. la RPC accepte et écrit des checks de PERSONNE, dans la MÊME transaction que le
//      reste (checks d'agence, moteur, journal) ;
//   2. le harnais de personne rend TOUJOURS une ligne par (personne, source), quoi qu'il
//      arrive au réseau -- même garantie que le harnais d'agence, pour la même raison : une
//      source muette ne doit jamais faire disparaître un check.
//
// Le connecteur Dilisense lui-même n'est pas exercé contre le vrai service ici (clé absente
// en local, même situation que MAPBOX_TOKEN / GEMINI_API_KEY) : sans clé il lève, et le
// harnais traduit en `unavailable`. C'est précisément ce que ce fichier vérifie, et c'est le
// comportement attendu en production tant que la clé n'est pas posée côté Supabase.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import {
  runAgencyKybPersonSources,
  createPepSanctionsSources,
  type PersonForVerification,
  type KybPersonSource,
} from '../../supabase/functions/_shared/kyb-sources'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const AGENCY_VETO_TYPES = [
  'registry_number_format',
  'registry_lookup',
  'registry_legal_name_match',
  'registry_country_match',
]

describe('harnais de sources de PERSONNE (module pur, sans base)', () => {
  const person: PersonForVerification = {
    id: '11111111-1111-1111-1111-111111111111',
    first_name: 'Jean',
    last_name: 'Signataire',
    date_of_birth: '1980-01-01',
    nationality: 'CH',
  }

  it('rend une ligne par source, même quand la source lève', async () => {
    const boom: KybPersonSource = {
      checkType: 'pep_sanctions_screening',
      source: 'dilisense',
      run: () => { throw new Error('reseau injoignable') },
    }
    const rows = await runAgencyKybPersonSources([person], [boom], 500)
    expect(rows.length, 'une source qui lève ne doit jamais faire disparaître un check').toBe(1)
    expect(rows[0].result).toBe('unavailable')
    expect(rows[0].related_person_id).toBe(person.id)
    expect(
      rows[0].raw_response,
      'la preuve jointe est la raison de l\'échec elle-même, jamais un objet vide'
    ).toBeTruthy()
  })

  it('rend une ligne par (personne, source) — le produit, jamais une seule', async () => {
    const second: PersonForVerification = { ...person, id: '22222222-2222-2222-2222-222222222222' }
    const ok: KybPersonSource = {
      checkType: 'pep_sanctions_screening',
      source: 'dilisense',
      run: () => Promise.resolve({ result: 'match', raw_response: { hits: 0 } }),
    }
    const rows = await runAgencyKybPersonSources([person, second], [ok])
    expect(rows.length).toBe(2)
    expect(new Set(rows.map((r) => r.related_person_id)).size, 'chaque signataire a sa ligne').toBe(2)
  })

  it('n\'écrit rien quand il n\'y a aucun signataire — pas une ligne orpheline', async () => {
    const ok: KybPersonSource = {
      checkType: 'pep_sanctions_screening',
      source: 'dilisense',
      run: () => Promise.resolve({ result: 'match', raw_response: {} }),
    }
    expect((await runAgencyKybPersonSources([], [ok])).length).toBe(0)
  })

  it('une source expirée rend `unavailable`, jamais un verdict fabriqué', async () => {
    const slow: KybPersonSource = {
      checkType: 'pep_sanctions_screening',
      source: 'dilisense',
      run: () => new Promise(() => { /* ne se résout jamais */ }),
    }
    const rows = await runAgencyKybPersonSources([person], [slow], 60)
    expect(rows[0].result).toBe('unavailable')
  })

  it('sans clé API, le connecteur PEP produit `unavailable` et dit ce qui manque', async () => {
    const rows = await runAgencyKybPersonSources([person], createPepSanctionsSources({ apiKey: '' }))
    expect(rows.length, 'la fabrique doit rendre exactement une source').toBe(1)
    expect(rows[0].check_type).toBe('pep_sanctions_screening')
    expect(rows[0].source).toBe('dilisense')
    expect(
      rows[0].result,
      'clé absente = source injoignable, jamais un `match` fabriqué qui vaudrait preuve'
    ).toBe('unavailable')
    expect(
      JSON.stringify(rows[0].raw_response),
      'le message doit nommer ce qui manque, pour qu\'un relecteur sache quoi faire'
    ).toMatch(/DILISENSE_API_KEY|cle|clé/i)
  })

  it('le connecteur PEP refuse d\'interroger une personne sans nom exploitable', async () => {
    const anonymous: PersonForVerification = { ...person, first_name: null, last_name: null }
    const rows = await runAgencyKybPersonSources([anonymous], createPepSanctionsSources({ apiKey: 'clef-factice' }))
    expect(
      rows[0].result,
      'interroger un registre de sanctions sur une chaîne vide rendrait « aucun résultat », ' +
      'c\'est-à-dire un faux blanchiment'
    ).toBe('unavailable')
  })

  it('la clé API n\'apparaît JAMAIS dans la preuve jointe', async () => {
    const secret = 'CLEF-SECRETE-A-NE-PAS-FUIR'
    const rows = await runAgencyKybPersonSources(
      [{ ...person, first_name: null, last_name: null }],
      createPepSanctionsSources({ apiKey: secret })
    )
    expect(
      JSON.stringify(rows[0].raw_response),
      'raw_response est conservé dix ans et lu par un relecteur : un secret ne doit pas y entrer'
    ).not.toContain(secret)
  })
})

describe.skipIf(!HAS_KEYS)('record_agency_verification_run — checks de PERSONNE (étape 7, tâche 4)', () => {
  const agencyIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of agencyIds) {
      await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    }
  })

  async function createAgency(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Personne ${stamp}`,
        slug: `agence-personne-${stamp}`,
        country: 'FR',
        identity_submitted_at: new Date().toISOString(),
      })
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

  it('écrit les checks de personne passés en paramètre', async () => {
    const agencyId = await createAgency('write')
    const personId = await addActiveSignatory(agencyId)

    const { error } = await serviceRoleClient().rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: [],
      p_person_checks: [{
        related_person_id: personId,
        check_type: 'pep_sanctions_screening',
        source: 'dilisense',
        result: 'match',
        raw_response: { hits: 0 },
      }],
      p_severity: 'info',
      p_metadata: { sources_run: 1 },
    })
    expect(error, `rpc: ${error?.message}`).toBeNull()

    const { data: checks } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('check_type, source, result, raw_response')
      .eq('related_person_id', personId)
    expect(checks?.length, 'la RPC doit avoir écrit la ligne de personne').toBe(1)
    expect(checks?.[0].check_type).toBe('pep_sanctions_screening')
    expect(checks?.[0].source).toBe('dilisense')
    expect(checks?.[0].result).toBe('match')
  })

  it('l\'appel à 4 arguments reste valide — aucune régression pour les appelants existants', async () => {
    const agencyId = await createAgency('legacy')
    const { error } = await serviceRoleClient().rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: [],
      p_severity: 'info',
      p_metadata: {},
    })
    expect(
      error,
      `p_person_checks doit porter un défaut : la signature s'élargit sans casser l'existant`
    ).toBeNull()
  })

  it('un tableau vide de checks de personne n\'écrit rien et n\'échoue pas', async () => {
    const agencyId = await createAgency('empty')
    const personId = await addActiveSignatory(agencyId)
    const { error } = await serviceRoleClient().rpc('record_agency_verification_run', {
      p_agency_id: agencyId, p_checks: [], p_person_checks: [], p_severity: 'info', p_metadata: {},
    })
    expect(error).toBeNull()
    const { data: checks } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id').eq('related_person_id', personId)
    expect(checks?.length).toBe(0)
  })

  it('atomicité : un p_severity hors CHECK annule AUSSI le check de personne', async () => {
    const agencyId = await createAgency('atomic')
    const personId = await addActiveSignatory(agencyId)

    const { error } = await serviceRoleClient().rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: [],
      p_person_checks: [{
        related_person_id: personId,
        check_type: 'pep_sanctions_screening',
        source: 'dilisense',
        result: 'match',
        raw_response: {},
      }],
      // 'catastrophique' n'est pas dans activity_events_severity_check : l'insert du journal
      // échoue, donc TOUT doit être annulé -- y compris le check de personne écrit avant.
      p_severity: 'catastrophique',
      p_metadata: {},
    })
    expect(error, 'un severity hors CHECK doit faire échouer la RPC').not.toBeNull()

    const { data: checks } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id').eq('related_person_id', personId)
    expect(
      checks?.length,
      'le check de personne doit être annulé avec le reste : la garantie atomique de cette ' +
      'RPC doit couvrir la nouvelle portée, sans quoi un dossier porterait une preuve dont ' +
      'le journal ne dit rien'
    ).toBe(0)
  })

  // ── Le fait que toute cette tâche existe pour produire ─────────────────────────────
  it('un dossier français complet atteint auto_validated SANS fixture posant le véto PEP', async () => {
    const agencyId = await createAgency('auto-validate')
    const personId = await addActiveSignatory(agencyId)
    const svc = serviceRoleClient()

    // Les quatre vétos d'entité en `match` : ce que les connecteurs français produisent
    // réellement sur un SIREN valide (mesuré au §7bis du handoff). Posés ici pour isoler
    // le seul fait à prouver, qui est le véto de PERSONNE.
    await svc.from('agency_verification_checks').insert(
      AGENCY_VETO_TYPES.map((check_type) => ({
        agency_id: agencyId, check_type, source: 'manual', result: 'match',
      }))
    )
    // Un signal scorable, pour que le score existe et dépasse le seuil de 0.85.
    await svc.from('agency_verification_checks').insert({
      agency_id: agencyId, check_type: 'vat_lookup', source: 'manual', result: 'match',
    })
    // La pièce d'identité : la SEULE décision humaine qui doit rester.
    await svc.from('agency_person_verification_checks').insert({
      related_person_id: personId, check_type: 'id_document', source: 'manual', result: 'match',
    })

    // Et le véto PEP, écrit PAR LA RPC comme le fera l'Edge Function en production --
    // jamais par une fixture. C'est toute la différence avec les mesures du §7bis, qui
    // posaient PERSON_VETO_TYPES à la main et rendaient le trou invisible.
    const { error } = await svc.rpc('record_agency_verification_run', {
      p_agency_id: agencyId,
      p_checks: [],
      p_person_checks: [{
        related_person_id: personId,
        check_type: 'pep_sanctions_screening',
        source: 'dilisense',
        result: 'match',
        raw_response: { found_records: [] },
      }],
      p_severity: 'info',
      p_metadata: {},
    })
    expect(error, `rpc: ${error?.message}`).toBeNull()

    const { data: agency } = await svc
      .from('agencies')
      .select('verification_status, verification_score')
      .eq('id', agencyId)
      .single()

    expect(
      agency?.verification_status,
      'c\'est la première fois qu\'un dossier peut aboutir sans qu\'une fixture pose le véto PEP'
    ).toBe('auto_validated')
    expect(Number(agency?.verification_score)).toBeCloseTo(1, 2)
  })

  it('contrôle : le même dossier SANS le véto PEP reste en manual_review', async () => {
    const agencyId = await createAgency('control')
    const personId = await addActiveSignatory(agencyId)
    const svc = serviceRoleClient()

    await svc.from('agency_verification_checks').insert(
      AGENCY_VETO_TYPES.map((check_type) => ({
        agency_id: agencyId, check_type, source: 'manual', result: 'match',
      }))
    )
    await svc.from('agency_verification_checks').insert({
      agency_id: agencyId, check_type: 'vat_lookup', source: 'manual', result: 'match',
    })
    await svc.from('agency_person_verification_checks').insert({
      related_person_id: personId, check_type: 'id_document', source: 'manual', result: 'match',
    })

    // Aucun check de personne PEP : exactement l'état de production d'avant cette tâche.
    const { error } = await svc.rpc('record_agency_verification_run', {
      p_agency_id: agencyId, p_checks: [], p_person_checks: [], p_severity: 'info', p_metadata: {},
    })
    expect(error).toBeNull()

    const { data: agency } = await svc
      .from('agencies').select('verification_status').eq('id', agencyId).single()
    expect(
      agency?.verification_status,
      'sans ce contrôle, la bascule du test précédent pourrait venir d\'autre chose que du véto PEP'
    ).toBe('manual_review')
  })
})
