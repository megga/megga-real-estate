// Regression — vérification d'identité des agences (KYB).
//
// Deux familles de garanties, choisies parce que ce sont exactement celles qui ont
// laissé passer un défaut réel (26 juil. 2026, corrigé par d4220fe2) :
//
//   1. RÉFÉRENTIEL — un sigle homonyme entre pays DOIT rester ambigu. C'est cette
//      ambiguïté, et rien d'autre, qui empêche le backfill d'assigner une forme
//      juridique au mauvais pays. Le défaut trouvé était précisément une ambiguïté
//      manquante : « SA » ne désignait que la SA suisse, donc une agence française
//      sans pays renseigné basculait silencieusement en CH_SA. Aucun linter ne peut
//      voir ça — seule une assertion sur les données le peut.
//
//   2. RLS — la PII de conformité (date de naissance, n° de pièce d'identité) doit
//      être hors de portée d'un agent simple, Y COMPRIS dans sa propre agence. C'est
//      la seule exception du schéma au modèle « tout membre voit tout de son agence ».
//
// Le backfill lui-même n'est pas rejoué : c'est une migration one-shot déjà appliquée.
// Ce qui reste durablement testable est le référentiel qui le gouverne, plus
// l'invariant qu'il doit maintenir (jamais le texte ET la FK sur la même ligne).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

/**
 * Sigles et libellés qui existent dans PLUSIEURS juridictions du référentiel.
 * Chacun doit rester rattaché à ≥ 2 pays : c'est ce qui rend l'appariement non
 * unique et force la revue manuelle au lieu d'un choix arbitraire.
 * Liste volontairement restreinte aux cas où une erreur a une conséquence réelle.
 */
const ALIAS_AMBIGUS = [
  'sa',                      // CH_SA / FR_SA  ← le défaut trouvé le 26 juil. 2026
  'ag',                      // CH_SA / LI_AG
  'gmbh',                    // CH_SARL / LI_GMBH
  'sarl',                    // CH_SARL / FR_SARL
  'societeanonyme',          // CH / FR / LI
  'societaanonima',          // CH / FR / LI
  'entrepriseindividuelle',  // FR_EI / LI_EU  ← corrigé en même temps
  'einzelunternehmen',       // CH_RI / LI_EU
]

describe.skipIf(!HAS_KEYS)('regression — KYB agences (référentiel + RLS)', () => {
  let setup: TwoAgenciesSetup
  /** Dirigeant de l'agence A (role admin) — doit VOIR la PII de conformité. */
  let clientAdminA: SupabaseClient
  let adminAId: string
  /** Super-admin — seul à voir la pondération du moteur de score. */
  let clientSuperAdmin: SupabaseClient
  let superAdminId: string
  let personId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // Un dirigeant EN PLUS de l'agent simple : il faut les deux simultanément dans la
    // même agence pour prouver que l'un voit et l'autre pas. Promouvoir l'agent
    // existant ne le permettrait pas.
    const mkUser = async (email: string, role: string, agencyId: string | null) => {
      const { data, error } = await service.auth.admin.createUser({
        email, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: email, role: 'agent' },
      })
      if (error) throw new Error(`createUser ${email}: ${error.message}`)
      const id = data.user!.id
      // role/agency_id sont en lecture seule hors service_role (trigger du lockdown
      // 20260627120000) — d'où l'upsert par la clé de service.
      const { error: pErr } = await service
        .from('profiles')
        .upsert({ id, email, full_name: email, role, agency_id: agencyId }, { onConflict: 'id' })
      if (pErr) throw new Error(`profile ${email}: ${pErr.message}`)
      const client = createClient(URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD })
      if (sErr) throw new Error(`signin ${email}: ${sErr.message}`)
      return { id, client }
    }

    // Domaine @megga-test.local : allowlisté par setupTwoAgencies via app_config,
    // condition nécessaire de is_super_admin() (rôle ET email allowlisté).
    const admin = await mkUser(`kyb-admin-a-${setup.stamp}@megga-test.local`, 'admin', setup.agencyAId)
    adminAId = admin.id
    clientAdminA = admin.client

    const su = await mkUser(`kyb-super-${setup.stamp}@megga-test.local`, 'super_admin', null)
    superAdminId = su.id
    clientSuperAdmin = su.client

    // Décor de conformité dans l'agence A, inséré par la clé de service (l'écriture
    // des checks est justement interdite aux clients — cf. test dédié plus bas).
    const { data: person, error: perErr } = await service
      .from('agency_related_persons')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Jean', last_name: `Dupont ${setup.stamp}`,
        date_of_birth: '1970-03-16', id_document_number: 'PASSPORT-SECRET-123',
      })
      .select('id')
      .single()
    if (perErr) throw new Error(`related_person: ${perErr.message}`)
    personId = person.id

    const { error: roleErr } = await service
      .from('agency_person_roles')
      .insert({ related_person_id: personId, role: 'signatory', signature_power: 'individual' })
    if (roleErr) throw new Error(`person_role: ${roleErr.message}`)

    const { error: chkErr } = await service
      .from('agency_verification_checks')
      .insert({ agency_id: setup.agencyAId, check_type: 'registry_lookup', source: 'zefix', result: 'match' })
    if (chkErr) throw new Error(`check: ${chkErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    // Les utilisateurs d'abord : les lignes KYB partent en cascade avec les agences,
    // que setup.cleanup() supprime ensuite.
    await service.auth.admin.deleteUser(adminAId).catch(() => {})
    await service.auth.admin.deleteUser(superAdminId).catch(() => {})
    await setup.cleanup()
  })

  // ─── 1. Référentiel des formes juridiques ──────────────────────────────────
  describe('référentiel', () => {
    it('couvre les 3 juridictions attendues', async () => {
      const { data, error } = await setup.clientA.from('legal_forms').select('country')
      expect(error).toBeNull()
      const parPays = (data ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.country as string] = (acc[r.country as string] ?? 0) + 1
        return acc
      }, {})
      expect(parPays).toEqual({ CH: 7, FR: 8, LI: 6 })
    })

    it('renseigne les 4 langues pour chaque forme', async () => {
      const { data, error } = await setup.clientA
        .from('legal_forms')
        .select('code, label_fr, label_de, label_en, label_it')
      expect(error).toBeNull()
      const incomplets = (data ?? []).filter(
        (r) => !r.label_fr?.trim() || !r.label_de?.trim() || !r.label_en?.trim() || !r.label_it?.trim()
      )
      expect(incomplets.map((r) => r.code)).toEqual([])
    })

    // LE test de non-régression : c'est cette assertion qui aurait attrapé le défaut
    // du 26 juil. 2026 sans intervention humaine.
    it('garde ambigus les sigles homonymes entre pays', async () => {
      const { data, error } = await serviceRoleClient()
        .from('legal_form_aliases')
        .select('alias, legal_forms(country)')
      expect(error).toBeNull()

      const paysParAlias = new Map<string, Set<string>>()
      for (const row of data ?? []) {
        const pays = (row.legal_forms as { country: string } | null)?.country
        if (!pays) continue
        const set = paysParAlias.get(row.alias as string) ?? new Set<string>()
        set.add(pays)
        paysParAlias.set(row.alias as string, set)
      }

      const insuffisants = ALIAS_AMBIGUS.filter((a) => (paysParAlias.get(a)?.size ?? 0) < 2)
      expect(
        insuffisants,
        `ces alias ne désignent plus qu'un seul pays — le backfill les apparierait ` +
        `sans hésiter et pourrait assigner la forme juridique du mauvais pays`
      ).toEqual([])
    })

    it('stocke les alias déjà normalisés', async () => {
      const { data, error } = await serviceRoleClient().from('legal_form_aliases').select('alias')
      expect(error).toBeNull()
      // Un alias non normalisé ne serait jamais apparié : la requête compare à
      // normalize_legal_form_text(saisie), qui ne produit que [a-z0-9].
      const malFormes = (data ?? []).map((r) => r.alias as string).filter((a) => !/^[a-z0-9]+$/.test(a))
      expect(malFormes).toEqual([])
    })

    it('neutralise casse, accents, ponctuation et espaces', async () => {
      const cas: Array<[string, string]> = [
        ['SA', 'sa'],
        ['S.A.', 'sa'],
        ['  Société   Anonyme  ', 'societeanonyme'],
        ['Sàrl', 'sarl'],
        ['S.à r.l.', 'sarl'],
        ['GESELLSCHAFT mit beschränkter Haftung', 'gesellschaftmitbeschrankterhaftung'],
      ]
      for (const [entree, attendu] of cas) {
        const { data, error } = await setup.clientA.rpc('normalize_legal_form_text', { p_text: entree })
        expect(error, `rpc sur « ${entree} »`).toBeNull()
        expect(data, `« ${entree} »`).toBe(attendu)
      }
    })
  })

  // ─── 2. Catalogue et pondération des checks ────────────────────────────────
  describe('catalogue de vérification', () => {
    it('a une seule configuration active par type de check', async () => {
      const service = serviceRoleClient()
      const { data: types } = await service.from('verification_check_types').select('code')
      const { data: config } = await service
        .from('verification_check_config')
        .select('check_type')
        .is('valid_to', null)
      const codes = (config ?? []).map((r) => r.check_type as string)
      expect(new Set(codes).size, 'doublon de configuration active').toBe(codes.length)
      expect(codes.length).toBe((types ?? []).length)
    })

    it('laisse les vétos hors du score (poids nul)', async () => {
      const { data, error } = await serviceRoleClient()
        .from('verification_check_config')
        .select('check_type, weight, is_veto')
        .is('valid_to', null)
      expect(error).toBeNull()
      const vetos = (data ?? []).filter((r) => r.is_veto)
      expect(vetos.length).toBeGreaterThanOrEqual(6)
      // Un véto qui porterait un poids serait interprété deux fois : comme gate ET
      // comme contributeur au score.
      expect(vetos.filter((r) => Number(r.weight) !== 0).map((r) => r.check_type)).toEqual([])
      // Et l'inverse : un signal sans poids ne compterait jamais.
      const signaux = (data ?? []).filter((r) => !r.is_veto)
      expect(signaux.filter((r) => Number(r.weight) <= 0).map((r) => r.check_type)).toEqual([])
    })
  })

  // ─── 3. RLS — la seule exception au modèle « tout le monde voit son agence » ─
  describe('RLS de la PII de conformité', () => {
    it('un agent SIMPLE ne voit rien, dans sa propre agence', async () => {
      const personnes = await setup.clientA.from('agency_related_persons').select('id')
      const roles = await setup.clientA.from('agency_person_roles').select('id')
      const checks = await setup.clientA.from('agency_verification_checks').select('id')
      expect(personnes.data ?? [], 'fuite de PII vers un agent simple').toEqual([])
      expect(roles.data ?? []).toEqual([])
      expect(checks.data ?? []).toEqual([])
    })

    it('le dirigeant de l’agence voit les lignes de SON agence', async () => {
      const { data, error } = await clientAdminA
        .from('agency_related_persons')
        .select('id, agency_id, id_document_number')
      expect(error).toBeNull()
      expect(data?.map((r) => r.id)).toContain(personId)
      expect(data?.every((r) => r.agency_id === setup.agencyAId)).toBe(true)
    })

    it('un dirigeant d’une AUTRE agence ne voit rien', async () => {
      const service = serviceRoleClient()
      await service.from('profiles').update({ role: 'admin' }).eq('id', setup.agentBId)
      try {
        const personnes = await setup.clientB.from('agency_related_persons').select('id')
        const checks = await setup.clientB.from('agency_verification_checks').select('id')
        expect(personnes.data ?? [], 'fuite inter-agences').toEqual([])
        expect(checks.data ?? []).toEqual([])
      } finally {
        await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentBId)
      }
    })

    it('la pondération du score est invisible au dirigeant, visible au super-admin', async () => {
      const dirigeant = await clientAdminA.from('verification_check_config').select('check_type')
      expect(dirigeant.data ?? [], 'les poids fuient — un client pourrait viser le seuil').toEqual([])
      const su = await clientSuperAdmin.from('verification_check_config').select('check_type')
      expect((su.data ?? []).length).toBeGreaterThan(0)
    })

    it('le référentiel reste lisible par tous (il alimente le menu)', async () => {
      const agent = await setup.clientA.from('legal_forms').select('id')
      expect((agent.data ?? []).length).toBe(21)
    })
  })

  // ─── 4. Écritures interdites ───────────────────────────────────────────────
  describe('écritures', () => {
    it('aucun client ne peut se déclarer « match »', async () => {
      const { data, error } = await clientAdminA
        .from('agency_verification_checks')
        .insert({ agency_id: setup.agencyAId, check_type: 'registry_lookup', source: 'manual', result: 'match' })
        .select('id')
      // Pas de policy INSERT → la RLS refuse. On accepte l'erreur explicite comme le
      // retour vide : les deux signifient « rien écrit ».
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })

    it('un dirigeant ne peut pas inscrire une personne chez une autre agence', async () => {
      const { data, error } = await clientAdminA
        .from('agency_related_persons')
        .insert({ agency_id: setup.agencyBId, first_name: 'Intrus', last_name: 'Chez B' })
        .select('id')
      expect(error !== null || (data ?? []).length === 0).toBe(true)
    })

    it('refuse un rôle sémantiquement incohérent', async () => {
      // Un pouvoir de signature sur un UBO, ou une détention sur un signataire :
      // la ligne serait ininterprétable par le moteur de score.
      const { error } = await serviceRoleClient()
        .from('agency_person_roles')
        .insert({ related_person_id: personId, role: 'ubo', signature_power: 'individual' })
      expect(error, 'la contrainte role/attributs ne joue plus').not.toBeNull()
    })
  })

  // ─── 5. Invariant du backfill ──────────────────────────────────────────────
  it('aucune agence ne porte à la fois le texte libre et la FK', async () => {
    const { data, error } = await serviceRoleClient()
      .from('agencies')
      .select('id, legal_form, legal_form_id')
      .not('legal_form', 'is', null)
      .not('legal_form_id', 'is', null)
    expect(error).toBeNull()
    // Le même fait stocké deux fois finirait par se désynchroniser ; le backfill vide
    // le texte dès qu'il a posé la FK.
    expect(data ?? []).toEqual([])
  })

  it('agencies.identity_submitted_at existe et vaut NULL à la création', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Submit ${stamp}`, slug: `agence-submit-${stamp}` })
      .select('id, identity_submitted_at')
      .single()
    expect(error, `insert agence: ${error?.message}`).toBeNull()
    expect(data?.identity_submitted_at, 'une agence neuve n’a rien soumis').toBeNull()
    await svc.from('agencies').delete().eq('id', data!.id)
  })

  it('verification_status accepte "validated" et refuse une valeur inventée', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: ag } = await svc
      .from('agencies')
      .insert({ name: `Agence Statut ${stamp}`, slug: `agence-statut-${stamp}` })
      .select('id')
      .single()

    const { error: okErr } = await svc
      .from('agencies').update({ verification_status: 'validated' }).eq('id', ag!.id)
    expect(okErr, 'la décision humaine doit être représentable').toBeNull()

    const { error: koErr } = await svc
      .from('agencies').update({ verification_status: 'approuve_par_moi' }).eq('id', ag!.id)
    expect(koErr, 'le CHECK doit refuser une valeur hors énumération').not.toBeNull()

    await svc.from('agencies').delete().eq('id', ag!.id)
  })
})
