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

import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
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

// ─── Connecteur PEP et sanctions (Dilisense) — logique de décision, fetch stubbé ──────
//
// Volet ajouté par la revue de la tâche 4 (constat 1 + constat 2 — voir
// .superpowers/sdd/progress.md « Revue tâches 4 + 5 »). Les tests du describe précédent
// n'exercent que les chemins où `run` LÈVE (clé absente, nom inexploitable, non-fuite du
// secret) : rien ne faisait jamais tourner `createPepSanctionsSources` contre une réponse
// Dilisense, donc rien ne vérifiait la règle de décision elle-même (0 enregistrement ->
// `match`, >=1 -> `mismatch`), la partition PEP/SANCTION, le `slice(0, 5)`, ni — surtout —
// la garde de forme qui doit REJETER (lever) une réponse 200 dont le corps ne ressemble pas
// à un vrai screening Dilisense. C'est ce trou de couverture qui a laissé passer le
// fail-open du constat 1 : `Array.isArray(data.found_records) ? data.found_records : []`
// traite silencieusement toute forme inattendue comme "aucun enregistrement", donc `match`,
// donc véto satisfait sur une preuve qu'on n'a pas (invariant 1).
//
// fetch STUBBÉ (jamais de réseau réel), même motif que le describe RDAP de
// agency-verification-run.spec.ts. Passe par `runAgencyKybPersonSources` + la vraie
// fabrique — jamais un faux `KybPersonSource` — précisément parce que c'est la fabrique
// elle-même qui est sous revue ici.
describe('connecteur PEP et sanctions (Dilisense) — logique de décision, fetch stubbé (aucun réseau réel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const signatory: PersonForVerification = {
    id: '33333333-3333-3333-3333-333333333333',
    first_name: 'Jean',
    last_name: 'Signataire',
    date_of_birth: '1980-01-01',
    nationality: 'CH',
  }

  function dilisenseResponse(body: Record<string, unknown>, httpStatus = 200): Response {
    return new Response(JSON.stringify(body), {
      status: httpStatus,
      headers: { 'content-type': 'application/json' },
    })
  }

  /** Fait tourner LE connecteur réel (pas un double) contre un corps HTTP donné, et rend
   *  la ligne unique produite pour `signatory`. */
  async function runDilisense(body: Record<string, unknown>, httpStatus = 200) {
    vi.stubGlobal('fetch', vi.fn(async () => dilisenseResponse(body, httpStatus)))
    const rows = await runAgencyKybPersonSources(
      [signatory],
      createPepSanctionsSources({ apiKey: 'clef-de-test-non-secrete' })
    )
    return rows[0]
  }

  it(
    '0 enregistrement (réponse bien formée) -> `match` : le véto est satisfait, la personne ' +
    'n\'est ni PEP ni sanctionnée',
    async () => {
      const row = await runDilisense({ total_hits: 0, found_records: [] })
      expect(row.check_type).toBe('pep_sanctions_screening')
      expect(row.source).toBe('dilisense')
      expect(row.related_person_id).toBe(signatory.id)
      expect(row.result).toBe('match')
    }
  )

  it(
    'found_records null (Dilisense omet le tableau quand le compte est nul) -> `match` ' +
    'quand même, jamais levé : tolérance délibérée, même motif que partitionDilisenseHits ' +
    'côté KYC client',
    async () => {
      const row = await runDilisense({ total_hits: 0, found_records: null })
      expect(row.result).toBe('match')
    }
  )

  it('>= 1 enregistrement -> `mismatch` : le véto ÉCHOUE, dossier en revue humaine', async () => {
    const row = await runDilisense({
      total_hits: 1,
      found_records: [{ source_type: 'SANCTION', name: 'Jean Signataire', source_id: 'ofac-1' }],
    })
    expect(row.result).toBe('mismatch')
  })

  it('partitionne PEP et SANCTION séparément dans la preuve jointe', async () => {
    const row = await runDilisense({
      total_hits: 3,
      found_records: [
        { source_type: 'PEP', name: 'Jean Signataire', source_id: 'pep-1' },
        { source_type: 'PEP', name: 'Jean Signataire', source_id: 'pep-2' },
        { source_type: 'SANCTION', name: 'Jean Signataire', source_id: 'ofac-1' },
      ],
    })
    expect(row.result).toBe('mismatch')
    expect(row.raw_response).toMatchObject({
      total_records: 3,
      pep_records: 2,
      sanction_records: 1,
    })
  })

  it(
    'ne joint jamais plus de 5 enregistrements dans la preuve, même si Dilisense en rend ' +
    'davantage — le compte réel (total_records) reste, lui, non tronqué',
    async () => {
      const found_records = Array.from({ length: 8 }, (_, i) => ({
        source_type: 'SANCTION',
        name: `Homonyme ${i}`,
        source_id: `id-${i}`,
      }))
      const row = await runDilisense({ total_hits: 8, found_records })
      expect(row.result).toBe('mismatch')
      const raw = row.raw_response as Record<string, unknown>
      expect(raw.total_records).toBe(8)
      expect(Array.isArray(raw.records) && (raw.records as unknown[]).length).toBe(5)
    }
  )

  it(
    'réponse 200 de forme inattendue (enveloppe d\'erreur, aucun total_hits) -> LÈVE, ' +
    'jamais un `match` fabriqué — c\'est l\'invariant 1 : un véto ne passe que sur un match ' +
    'venant d\'une réponse effectivement comprise',
    async () => {
      const row = await runDilisense({ error: 'quota exceeded' })
      expect(
        row.result,
        'une enveloppe d\'erreur rendue en 200 ne doit jamais se lire comme "aucun ' +
        'enregistrement" : le véto serait satisfait sur une preuve qu\'on n\'a pas'
      ).toBe('unavailable')
      expect(row.raw_response, 'invariant 4 : raw_response ne doit jamais être nul, même ici').toBeTruthy()
    }
  )

  it(
    'réponse 200 avec found_records d\'un type inattendu (pas un tableau, malgré ' +
    'total_hits présent) -> LÈVE également, jamais un `match` fabriqué',
    async () => {
      const row = await runDilisense({ total_hits: 1, found_records: 'oops' })
      expect(row.result).toBe('unavailable')
    }
  )

  it('la clé API n\'apparaît jamais dans la preuve, même sur une réponse bien formée avec des hits', async () => {
    const secret = 'CLEF-SECRETE-CONNECTEUR-AVEC-HITS'
    vi.stubGlobal('fetch', vi.fn(async () => dilisenseResponse({
      total_hits: 1,
      found_records: [{ source_type: 'PEP', name: 'Jean Signataire', source_id: 'pep-1' }],
    })))
    const rows = await runAgencyKybPersonSources([signatory], createPepSanctionsSources({ apiKey: secret }))
    expect(JSON.stringify(rows[0].raw_response)).not.toContain(secret)
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

  // ─── Le fait que toute cette tâche existe pour produire, cette fois pour de vrai ──
  //
  // CE QUE CE CORRECTIF FERME (revue de la tâche 4). Le test qui vivait ici posait SIX
  // checks à la main -- les quatre vétos d'entité, vat_lookup et id_document, tous en
  // `source: 'manual'` -- ET fournissait le verdict PEP lui-même en LITTÉRAL
  // (`result: 'match'`) dans la charge de record_agency_verification_run. Changer la
  // PORTE (la RPC plutôt qu'un insert direct) sans changer l'AUTEUR du verdict ne prouve
  // rien : c'est exactement ce que faisaient déjà les mesures pays par pays du §7bis, à un
  // insert direct près. Le chemin de production -- Edge Function → connecteur → RPC →
  // moteur -- n'était donc exercé nulle part en portée personne.
  //
  // CE QUE LES DEUX TESTS QUI SUIVENT PROUVENT À LA PLACE. Le verdict PEP est PRODUIT par
  // le vrai connecteur (createPepSanctionsSources + runAgencyKybPersonSources, fetch
  // stubbé -- même logique de décision que le describe « connecteur PEP et sanctions »
  // plus haut, mais jamais avant poussée jusqu'à la RPC ni jusqu'au verdict du dossier), et
  // SEUL ce que le connecteur a produit est transmis à p_person_checks -- jamais un objet
  // écrit à la main. Même patron que runFrenchRegistrySources /
  // runRegistrySourcesAgainstStubbedLindas dans agency-verification-run.spec.ts
  // (« Reprends ce patron », revue de ce constat) : on fait tourner le MODULE réel, jamais
  // la fonction déployée, pour un connecteur qu'on stubbe -- la fonction déployée
  // appellerait le VRAI Dilisense depuis le runtime edge, un réseau réel qu'aucun test de
  // ce dépôt ne s'autorise (le stub vit dans CE processus vitest ; le runtime edge tourne
  // dans un processus Deno séparé dont le fetch n'est stubbable depuis aucun test ici).
  //
  // CE QUI RESTE, HONNÊTEMENT, HORS DE PORTÉE D'UN CONNECTEUR. `id_document` reste posé À
  // LA MAIN (`source: 'manual'`) : ce n'est pas un connecteur manquant par oubli, c'est sa
  // NATURE -- aucun prestataire de liveness n'est branché, la pièce est tranchée par un
  // humain via `admin_resolve_agency_id_document` (une RPC, jamais un connecteur). La
  // ligne posée ici représente l'ISSUE de ce geste humain, jamais le geste lui-même. Les
  // quatre vétos d'entité et vat_lookup restent eux aussi posés à la main : ISOLER la
  // seule variable sous test (le véto PEP) est le patron établi par tout ce chantier (voir
  // « Une précision d'honnêteté » sur les mesures Zefix/registre dans
  // agency-verification-run.spec.ts) -- leur origine connecteur est déjà prouvée
  // ailleurs, dans le même fichier (« un dossier francais complet voit ses QUATRE vetos
  // d'entite satisfaits PAR DES CONNECTEURS »).

  /** Fait tourner LE connecteur réel (jamais un double) contre un corps Dilisense donné,
   *  et rend les lignes produites -- prêtes à passer telles quelles à p_person_checks.
   *  Stubbé le temps de l'appel, et RIEN d'autre : le client Supabase se sert du même
   *  fetch global, d'où le retrait immédiat du stub avant l'appel RPC qui suit. */
  async function runDilisensePersonChecks(
    person: PersonForVerification,
    body: Record<string, unknown>
  ): Promise<Awaited<ReturnType<typeof runAgencyKybPersonSources>>> {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    )
    try {
      return await runAgencyKybPersonSources(
        [person],
        createPepSanctionsSources({ apiKey: 'clef-de-test-non-secrete' })
      )
    } finally {
      vi.unstubAllGlobals()
    }
  }

  /** Le reste d'un dossier français complet -- tout sauf le véto PEP, qui est le sujet de
   *  ces deux tests. Voir l'en-tête ci-dessus pour pourquoi ces lignes-ci restent posées
   *  à la main. */
  async function seedFrenchDossierMinusPep(agencyId: string, personId: string): Promise<void> {
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
  }

  it(
    'un dossier français complet atteint auto_validated, le véto PEP étant PRODUIT PAR LE ' +
      'CONNECTEUR DILISENSE (fetch stubbé) -- jamais par un littéral dans la charge de la RPC',
    async () => {
      const agencyId = await createAgency('auto-validate-connecteur')
      const personId = await addActiveSignatory(agencyId)
      await seedFrenchDossierMinusPep(agencyId, personId)

      const person: PersonForVerification = {
        id: personId, first_name: 'Jean', last_name: 'Signataire',
        date_of_birth: null, nationality: null,
      }
      // Réponse Dilisense bien formée, 0 enregistrement : le connecteur DÉCIDE `match`,
      // rien n'est écrit à la main ici.
      const personChecks = await runDilisensePersonChecks(person, { total_hits: 0, found_records: [] })
      expect(personChecks, 'une ligne, produite par le connecteur').toHaveLength(1)
      expect(personChecks[0].check_type).toBe('pep_sanctions_screening')
      expect(personChecks[0].source).toBe('dilisense')
      expect(personChecks[0].result, 'le connecteur a décidé -- 0 enregistrement -> match').toBe('match')

      const svc = serviceRoleClient()
      const { error } = await svc.rpc('record_agency_verification_run', {
        p_agency_id: agencyId,
        p_checks: [],
        p_person_checks: personChecks,
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
        'le verdict PEP vient du connecteur, jamais d\'une fixture -- et le dossier s\'auto-valide quand même'
      ).toBe('auto_validated')
      expect(Number(agency?.verification_score)).toBeCloseTo(1, 2)

      // La ligne écrite en base porte bien la preuve du connecteur, jamais un objet vide
      // -- invariant 4 (raw_response jamais nul), vérifié sur la ligne réellement stockée.
      const { data: storedPepCheck } = await svc
        .from('agency_person_verification_checks')
        .select('source, result, raw_response')
        .eq('related_person_id', personId)
        .eq('check_type', 'pep_sanctions_screening')
        .single()
      expect(storedPepCheck?.raw_response).toMatchObject({ screened_name: 'Jean Signataire', total_records: 0 })
    }
  )

  it(
    'le contrôle qui rend la preuve concluante : le MÊME connecteur, contre une réponse ' +
      'Dilisense qui rapporte un homonyme, laisse le MÊME dossier en manual_review -- c\'est ' +
      'bien le VERDICT du connecteur qui gouverne, jamais seulement sa présence',
    async () => {
      const agencyId = await createAgency('connecteur-mismatch')
      const personId = await addActiveSignatory(agencyId)
      await seedFrenchDossierMinusPep(agencyId, personId)

      const person: PersonForVerification = {
        id: personId, first_name: 'Jean', last_name: 'Signataire',
        date_of_birth: null, nationality: null,
      }
      // Même connecteur, réponse Dilisense qui rapporte CETTE FOIS un enregistrement : le
      // véto doit échouer -- si le dossier s'auto-validait quand même, la RPC ignorerait
      // le verdict produit et ne ferait que rejouer un littéral, exactement le défaut
      // corrigé ici.
      const personChecks = await runDilisensePersonChecks(person, {
        total_hits: 1,
        found_records: [{ source_type: 'SANCTION', name: 'Jean Signataire', source_id: 'ofac-1' }],
      })
      expect(personChecks[0].result, 'un homonyme rapporté -> le véto ÉCHOUE').toBe('mismatch')

      const svc = serviceRoleClient()
      const { error } = await svc.rpc('record_agency_verification_run', {
        p_agency_id: agencyId,
        p_checks: [],
        p_person_checks: personChecks,
        p_severity: 'info',
        p_metadata: {},
      })
      expect(error).toBeNull()

      const { data: agency } = await svc
        .from('agencies').select('verification_status').eq('id', agencyId).single()
      expect(
        agency?.verification_status,
        'si ce dossier s\'auto-validait quand même, la RPC ignorerait le verdict du connecteur -- ' +
        'et le test précédent ne prouverait alors rien sur son origine'
      ).toBe('manual_review')
    }
  )

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
