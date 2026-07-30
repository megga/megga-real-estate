// Backend integration spec (live CI) — verrouillage et journalisation des colonnes
// d'identité légale sur agencies (étape 7, tâche 3 — migration
// 20260730130000_agencies_identity_columns_guard.sql).
//
// LE DÉFAUT. `agencies_members_update` (20260527010000) autorise TOUT membre à écrire
// n'importe quelle colonne de la ligne de son agence, et son propre commentaire dit que la
// policy est ouverte « pour l'instant car l'app n'a qu'un seul rôle effectif (agent) ».
// Elle en a plusieurs depuis, et provision_solo_agency pose role='admin' sur le fondateur.
// 20260729151600 a verrouillé les colonnes DE VÉRIFICATION ; les colonnes DÉCLARATIVES,
// celles que les vétos comparent au registre, restaient libres.
//
// Trois faits qui, ensemble, vidaient une partie du dispositif de sa substance :
//   1. un agent SIMPLE pouvait réécrire legal_name / business_registration_number ;
//   2. l'écran de réglages (AgencyFocusSection) les expose sans aucun garde lié à
//      identity_submitted_at ni à verification_status ;
//   3. rien ne rejouait la vérification et RIEN ne l'écrivait au journal — donc une agence
//      validée pouvait changer sa raison sociale et son numéro de registre, les checks
//      continuaient d'attester l'identité PRÉCÉDENTE, le statut restait `validated`, les
//      gardes LAB restaient ouverts, et la modification ne laissait aucune trace.
//
// CE QUE CE FICHIER PROUVE. (1) Un agent simple ne peut plus écrire une colonne d'identité,
// même sur sa propre agence. (2) Un dirigeant peut, MAIS seulement tant que le dossier n'est
// pas soumis — c'est le wizard, et il doit continuer de fonctionner. (3) Une fois soumis,
// plus personne ne les écrit depuis `authenticated`. (4) Chaque changement laisse un
// activity_events.
//
// POURQUOI UN TRIGGER ET NON UN REVOKE DE COLONNE, contrairement à 20260729151600. Le
// verrou voulu est CONDITIONNEL : avant soumission le dirigeant écrit (c'est le wizard, qui
// passe par useAgencySettings donc par un UPDATE direct sur la table), après soumission plus
// personne. Un `revoke update (col) from authenticated` ne sait pas exprimer « avant oui,
// après non » — il aurait cassé le wizard. Le trigger, lui, voit old.identity_submitted_at.
//
// CORRECTIFS DU 30 JUILLET 2026 (deux écarts au brief de la tâche 3, fermés dans ce fichier) :
//
//   Écart 1 (migration 20260730170000_agencies_members_update_rbac.sql) — le trigger
//   ci-dessus ne protège que 5 colonnes NOMMÉES ; `agencies_members_update` (20260527010000)
//   restait ouverte à TOUT membre pour TOUTES les autres (dont `plan`, que rien d'autre ne
//   protégeait — TODO RBAC jamais fermé). Cette policy exige désormais is_agency_admin() :
//   la LIGNE entière se ferme à qui ne dirige pas l'agence (rôle admin|manager), pas
//   seulement les 5 colonnes d'identité. Ancienne assertion « les colonnes mundaines (name,
//   address, phone) restent libres pour tout membre » — devenue fausse, testée à l'inverse
//   ci-dessous. Effet de bord découvert et corrigé dans la même migration :
//   analytics_set_target (feature Analytics, hors chantier KYB) dépendait de cette policy en
//   SECURITY INVOKER — passée SECURITY DEFINER pour ne plus en dépendre.
//
//   Écart 2 (migration 20260730180000_agencies_address_columns_audit.sql) — le brief nomme
//   9 colonnes (5 d'identité + address/city/canton/postal_code) ; seules les 5 étaient
//   gelées ET journalisées. Arbitrage (Thomas, 30 juillet 2026) : les 4 colonnes d'adresse
//   rejoignent la JOURNALISATION (aucune raison de conformité de ne pas savoir qu'une
//   adresse a changé) mais PAS le gel (aucune ne nourrit un véto ; geler fermerait un
//   chemin de correction légitime que la tâche 5 n'a pas vocation à rouvrir).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'

/** Les colonnes que les vétos d'entité comparent au registre — celles que le trigger de gel
 *  (agencies_guard_identity_columns) verrouille une fois identity_submitted_at posé. */
const IDENTITY_COLUMNS: [string, unknown][] = [
  ['legal_name', 'Raison Sociale Substituee SA'],
  ['business_registration_number', 'CHE-999.999.996'],
  ['country', 'FR'],
  ['tva', 'FR12345678901'],
  // legal_form_id est une FK : une valeur arbitraire échouerait sur la contrainte avant
  // d'atteindre le trigger, et le test ne prouverait alors rien du garde. Couvert
  // séparément plus bas avec un id réel du référentiel.
]

/** Étape 7, tâche 3 — correctif écart 2 (30 juillet 2026, migration
 *  20260730180000_agencies_address_columns_audit.sql). `address`, `city`, `canton`,
 *  `postal_code` ne nourrissent qu'un signal scorable (address_geocode, poids 1.50), jamais
 *  un véto : elles restent donc HORS du trigger de gel ci-dessus, y compris après soumission
 *  — un agent a une raison légitime de corriger une adresse (arbitrage Thomas, 30 juillet
 *  2026 : geler fermerait ce chemin légitime, journaliser suffit à la traçabilité). Mais
 *  elles sont désormais JOURNALISÉES au même titre que les colonnes d'identité. */
const ADDRESS_COLUMNS: [string, unknown][] = [
  ['address', '14 rue du Rhone'],
  ['city', 'Geneve'],
  ['canton', 'GE'],
  ['postal_code', '1204'],
]

describe.skipIf(!HAS_KEYS)('verrouillage des colonnes d\'identité légale sur agencies (étape 7, tâche 3)', () => {
  let setup: TwoAgenciesSetup
  const extraAgencyIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
    const svc = serviceRoleClient()
    for (const id of extraAgencyIds) {
      await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    }
  })

  /** Promeut l'agent A au rôle donné — c'est ce qui distingue le dirigeant de l'employé. */
  async function setRoleA(role: 'agent' | 'admin' | 'manager'): Promise<void> {
    const { error } = await serviceRoleClient()
      .from('profiles')
      .update({ role })
      .eq('id', setup.agentAId)
    if (error) throw new Error(`set role ${role}: ${error.message}`)
  }

  /** Pose (ou retire) l'horodatage de soumission en service_role — les colonnes de
   *  vérification sont interdites à `authenticated` depuis 20260729151600. */
  async function setSubmitted(submitted: boolean): Promise<void> {
    const { error } = await serviceRoleClient()
      .from('agencies')
      .update({ identity_submitted_at: submitted ? new Date().toISOString() : null })
      .eq('id', setup.agencyAId)
    if (error) throw new Error(`set submitted: ${error.message}`)
  }

  // ── 1. Un agent simple ne peut plus écrire ces colonnes ────────────────────────────

  describe('un agent simple (role agent)', () => {
    beforeAll(async () => {
      await setRoleA('agent')
      await setSubmitted(false)
    })

    // ÉTAPE 7, TÂCHE 3 — correctif écart 1 (30 juillet 2026). Avant ce correctif, un agent
    // simple ATTEIGNAIT la ligne (agencies_members_update ne posait aucune condition de
    // rôle) et se faisait refuser PAR LE TRIGGER, avec un 42501 explicite. Depuis
    // 20260730170000, agencies_members_update exige is_agency_admin() dans sa clause USING :
    // la ligne est désormais invisible pour un agent simple AVANT que le trigger n'ait la
    // moindre chance de s'exécuter — 0 ligne touchée, pas de refus explicite, même mécanique
    // que l'isolation inter-agences plus bas. Le trigger reste la défense qui tiendrait si
    // CETTE policy régressait (cf. son en-tête) ; il n'est plus le premier mur atteint ici.
    for (const [column, value] of IDENTITY_COLUMNS) {
      it(`ne peut pas écrire ${column} sur sa PROPRE agence`, async () => {
        const before = await serviceRoleClient()
          .from('agencies').select(column).eq('id', setup.agencyAId).single()

        const { error } = await setup.clientA
          .from('agencies')
          .update({ [column]: value })
          .eq('id', setup.agencyAId)
        expect(error).toBeNull()

        const { data } = await serviceRoleClient()
          .from('agencies').select(column).eq('id', setup.agencyAId).single()
        expect(
          (data as Record<string, unknown> | null)?.[column],
          `un agent simple ne dirige pas l'agence : ${column} est une donnée de conformité, ` +
          `pas un réglage — RLS (agencies_members_update) bloque avant même le trigger`
        ).toEqual((before.data as Record<string, unknown> | null)?.[column])
      })
    }

    // ÉTAPE 7, TÂCHE 3 — correctif écart 1 (30 juillet 2026, migration
    // 20260730170000_agencies_members_update_rbac.sql). Les deux tests ci-dessous
    // affirmaient qu'un agent simple pouvait toujours écrire les colonnes MUNDAINES : c'était
    // vrai tant que seul le trigger par colonne protégeait agencies (il ne nomme que les 5
    // d'identité). Le TODO RBAC de 20260527010000 restait ouvert : agencies_members_update
    // elle-même n'exigeait aucun rôle, donc `plan` — que rien d'autre ne protège — restait
    // ouvert à tout membre. La policy exige désormais is_agency_admin() : la LIGNE entière se
    // ferme à qui ne dirige pas l'agence, pas seulement les 5 colonnes d'identité.
    it('ne peut plus écrire une colonne mundaine (name) — la ligne entière se ferme à qui n\'est pas admin/manager', async () => {
      const before = await serviceRoleClient()
        .from('agencies').select('name').eq('id', setup.agencyAId).single()

      const { error } = await setup.clientA
        .from('agencies')
        .update({ name: `Agence Mundaine ${setup.stamp}` })
        .eq('id', setup.agencyAId)
      // USING exclut la ligne : 0 ligne touchée plutôt qu'un refus explicite — même mécanique
      // que l'isolation inter-agences plus bas.
      expect(error).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('name').eq('id', setup.agencyAId).single()
      expect(
        data?.name,
        `un agent simple ne dirige pas l'agence : name n'a pas dû bouger malgré un update "réussi"`
      ).toBe(before.data?.name)
    })

    it('ne peut plus écrire address / city / canton / postal_code non plus — RBAC, pas un garde par colonne', async () => {
      const before = await serviceRoleClient()
        .from('agencies').select('address, city, canton, postal_code').eq('id', setup.agencyAId).single()

      const { error } = await setup.clientA
        .from('agencies')
        .update({ address: '14 rue du Rhone', city: 'Geneve', canton: 'GE', postal_code: '1204' })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('address, city, canton, postal_code').eq('id', setup.agencyAId).single()
      expect(
        data,
        `address n'est pas gelée (aucun véto dessus) mais la LIGNE reste fermée à un agent simple`
      ).toEqual(before.data)
    })
  })

  // ── RBAC de agencies_members_update elle-même (étape 7, tâche 3, écart 1) ──────────

  describe('RBAC de agencies_members_update — les deux rôles dirigeants, et `plan`', () => {
    it('un manager (role manager, pas admin) peut écrire une colonne mundaine — is_agency_admin() couvre les DEUX rôles', async () => {
      await setRoleA('manager')
      await setSubmitted(false)
      const newName = `Agence Manager ${setup.stamp}`
      const { error } = await setup.clientA
        .from('agencies')
        .update({ name: newName })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('name').eq('id', setup.agencyAId).single()
      expect(data?.name).toBe(newName)
    })

    it('un agent simple ne peut plus poser `plan` lui-même — c\'est l\'écart mesuré par la revue', async () => {
      await setRoleA('agent')
      const before = await serviceRoleClient()
        .from('agencies').select('plan').eq('id', setup.agencyAId).single()

      const { error } = await setup.clientA
        .from('agencies')
        .update({ plan: 'enterprise' })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('plan').eq('id', setup.agencyAId).single()
      expect(
        data?.plan,
        `aucun revoke de colonne ni trigger ne protégeait plan avant ce correctif — seule la policy RLS le pouvait`
      ).toBe(before.data?.plan)
    })
  })

  // ── analytics_set_target ne dépend plus de cette policy (effet de bord corrigé) ────

  describe('analytics_set_target résiste au RBAC (RPC SECURITY DEFINER depuis 20260730170000)', () => {
    it('un agent simple peut toujours définir l\'objectif commercial de son agence', async () => {
      await setRoleA('agent')
      const { error } = await setup.clientA.rpc('analytics_set_target', { p_yearly: 900000 })
      expect(
        error,
        `analytics_set_target (20260614150000) était SECURITY INVOKER et s'appuyait sur ` +
        `agencies_members_update ouverte à tout membre. La restreindre à admin/manager sans ` +
        `ajuster cette fonction l'aurait cassée EN SILENCE (RLS filtre par USING : 0 ligne, ` +
        `aucune erreur) pour tout agent simple — porte AxGate du premier login comprise. ` +
        `Corrigée en SECURITY DEFINER (20260730170000), comme les autres écrivains légitimes.`
      ).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('yearly_target').eq('id', setup.agencyAId).single()
      expect(Number(data?.yearly_target)).toBe(900000)
    })
  })

  // ── 2. Le dirigeant écrit AVANT soumission (c'est le wizard) ───────────────────────

  describe('un dirigeant (role admin), dossier NON soumis', () => {
    beforeAll(async () => {
      await setRoleA('admin')
      await setSubmitted(false)
    })

    it('écrit legal_name — sans quoi le wizard d\'onboarding ne fonctionnerait plus', async () => {
      const legal = `Wizard Legal ${setup.stamp}`
      const { error } = await setup.clientA
        .from('agencies')
        .update({ legal_name: legal })
        .eq('id', setup.agencyAId)
      expect(error, `StepAgence écrit ces colonnes via useAgencySettings : ${error?.message}`).toBeNull()

      const { data } = await serviceRoleClient()
        .from('agencies').select('legal_name').eq('id', setup.agencyAId).single()
      expect(data?.legal_name).toBe(legal)
    })

    it('écrit legal_form_id avec un id réel du référentiel', async () => {
      const { data: form } = await serviceRoleClient()
        .from('legal_forms').select('id').limit(1).single()
      const { error } = await setup.clientA
        .from('agencies')
        .update({ legal_form_id: form!.id })
        .eq('id', setup.agencyAId)
      expect(error, `la FK forme juridique fait partie de la saisie du wizard`).toBeNull()
    })

    it('écrit business_registration_number et country', async () => {
      const { error } = await setup.clientA
        .from('agencies')
        .update({ business_registration_number: 'CHE-105.909.036', country: 'CH' })
        .eq('id', setup.agencyAId)
      expect(error, `numéro de registre et pays du siège sont l'étape 2 du wizard`).toBeNull()
    })
  })

  // ── 3. Une fois le dossier soumis, plus personne n'écrit depuis authenticated ──────

  describe('un dirigeant (role admin), dossier SOUMIS', () => {
    beforeAll(async () => {
      await setRoleA('admin')
      await setSubmitted(true)
    })

    afterAll(async () => {
      await setSubmitted(false)
    })

    for (const [column, value] of IDENTITY_COLUMNS) {
      it(`ne peut plus écrire ${column} — l'identité vérifiée est gelée`, async () => {
        const { error } = await setup.clientA
          .from('agencies')
          .update({ [column]: value })
          .eq('id', setup.agencyAId)
        expect(
          error?.code,
          `une agence dont l'identité a été soumise ne doit pas pouvoir la remplacer : les checks ` +
          `attesteraient l'identité PRÉCÉDENTE, statut inchangé, gardes LAB ouverts`
        ).toBe(DENIED)
      })
    }

    it('peut toujours écrire name — le gel ne porte que sur l\'identité légale', async () => {
      const { error } = await setup.clientA
        .from('agencies')
        .update({ name: `Nom Commercial ${setup.stamp}` })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()
    })

    it('service_role n\'est pas gêné par le gel — les RPC de conformité doivent passer', async () => {
      const { error } = await serviceRoleClient()
        .from('agencies')
        .update({ legal_name: `Correction Service ${setup.stamp}` })
        .eq('id', setup.agencyAId)
      expect(
        error,
        `le garde nomme authenticated, comme celui de 20260729151600 : les fixtures et les RPC ` +
        `SECURITY DEFINER (dont le futur chemin de correction) doivent continuer de passer`
      ).toBeNull()
    })
  })

  // ── 4. Isolation inter-agences inchangée ──────────────────────────────────────────

  it('un dirigeant ne peut pas écrire l\'identité d\'une AUTRE agence', async () => {
    await setRoleA('admin')
    await setSubmitted(false)
    const { error, count } = await setup.clientA
      .from('agencies')
      .update({ legal_name: 'Prise De Controle SA' }, { count: 'exact' })
      .eq('id', setup.agencyBId)
    // La policy filtre par USING : la ligne est invisible, donc 0 ligne touchée plutôt
    // qu'un refus explicite. Les deux sont acceptables, l'important est que rien ne change.
    expect(error === null ? count : 0).toBe(0)
    const { data } = await serviceRoleClient()
      .from('agencies').select('legal_name').eq('id', setup.agencyBId).single()
    expect(data?.legal_name).not.toBe('Prise De Controle SA')
  })

  // ── 5. Journalisation ─────────────────────────────────────────────────────────────

  describe('journalisation des changements d\'identité', () => {
    it('un changement de legal_name par le dirigeant laisse un activity_events', async () => {
      await setRoleA('admin')
      await setSubmitted(false)
      const legal = `Journalise ${setup.stamp}-${Math.floor(Math.random() * 1e6)}`

      const { error } = await setup.clientA
        .from('agencies')
        .update({ legal_name: legal })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data: events, error: evErr } = await serviceRoleClient()
        .from('activity_events')
        .select('action, category, actor_kind, actor_id, entity_type, entity_id, metadata')
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')
        .order('created_at', { ascending: false })
        .limit(1)
      expect(evErr).toBeNull()
      expect(
        events?.length,
        `la règle de dépôt exige activity_events pour toute action, et cet écran n'en écrivait aucun`
      ).toBe(1)

      const ev = events![0]
      expect(ev.category, `compliance ferait échouer activity_events_category_check`).toBe('kyc')
      expect(ev.actor_kind).toBe('user')
      expect(ev.actor_id, `c'est un humain qui agit, la trace doit le nommer`).toBe(setup.agentAId)
      expect(ev.entity_type).toBe('agency')
      expect(ev.entity_id).toBe(setup.agencyAId)

      const changed = (ev.metadata as { changed?: string[] } | null)?.changed ?? []
      expect(
        changed,
        `la trace doit dire QUELLES colonnes ont changé, sinon un audit ne peut rien reconstituer`
      ).toContain('legal_name')
    })

    it('la trace ne porte QUE les colonnes réellement changées', async () => {
      await setRoleA('admin')
      await setSubmitted(false)
      const tva = `CHE-${Math.floor(Math.random() * 1e9)}`

      await setup.clientA.from('agencies').update({ tva }).eq('id', setup.agencyAId)

      const { data: events } = await serviceRoleClient()
        .from('activity_events')
        .select('metadata')
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')
        .order('created_at', { ascending: false })
        .limit(1)
      const changed = (events?.[0]?.metadata as { changed?: string[] } | null)?.changed ?? []
      expect(changed).toEqual(['tva'])
    })

    it('un changement de name seul n\'écrit AUCUN événement d\'identité — pas de bruit', async () => {
      await setRoleA('admin')
      await setSubmitted(false)

      const { count: before } = await serviceRoleClient()
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')

      await setup.clientA
        .from('agencies')
        .update({ name: `Sans Bruit ${setup.stamp}-${Math.floor(Math.random() * 1e6)}` })
        .eq('id', setup.agencyAId)

      const { count: after } = await serviceRoleClient()
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')

      expect(after, `un journal qui crie à chaque réglage devient illisible`).toBe(before)
    })

    it('un changement en service_role est journalisé aussi, en actor_kind=system', async () => {
      await setSubmitted(false)
      const legal = `Service Journalise ${setup.stamp}-${Math.floor(Math.random() * 1e6)}`

      const { error } = await serviceRoleClient()
        .from('agencies')
        .update({ legal_name: legal })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data: events } = await serviceRoleClient()
        .from('activity_events')
        .select('actor_kind, actor_id, metadata')
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')
        .order('created_at', { ascending: false })
        .limit(1)
      const ev = events?.[0]
      expect(
        ev?.actor_kind,
        `sans auth.uid(), actor_kind=user violerait activity_events_actor_kind_coherence : ` +
        `'system' est la valeur honnête, pas un contournement`
      ).toBe('system')
      expect(ev?.actor_id, `actor_kind=system IMPOSE actor_id NULL (contrainte de cohérence)`).toBeNull()
      expect((ev?.metadata as { changed?: string[] } | null)?.changed).toContain('legal_name')
    })

    // ── Écart 2 (30 juillet 2026, migration 20260730180000) : address/city/canton/
    // postal_code rejoignent la journalisation, MAIS jamais le gel — même après soumission.

    for (const [column, value] of ADDRESS_COLUMNS) {
      it(`un changement de ${column} par le dirigeant laisse un activity_events, AVANT soumission`, async () => {
        await setRoleA('admin')
        await setSubmitted(false)

        const { error } = await setup.clientA
          .from('agencies')
          .update({ [column]: value })
          .eq('id', setup.agencyAId)
        expect(error).toBeNull()

        const { data: events, error: evErr } = await serviceRoleClient()
          .from('activity_events')
          .select('category, actor_kind, actor_id, metadata')
          .eq('agency_id', setup.agencyAId)
          .eq('action', 'agency_legal_identity_updated')
          .order('created_at', { ascending: false })
          .limit(1)
        expect(evErr).toBeNull()
        expect(events?.length, `${column} n'était ni gelée ni journalisée avant ce correctif`).toBe(1)
        expect(events![0].category, `compliance ferait échouer activity_events_category_check`).toBe('kyc')
        expect(events![0].actor_kind).toBe('user')
        expect(events![0].actor_id).toBe(setup.agentAId)
        const changed = (events![0].metadata as { changed?: string[] } | null)?.changed ?? []
        expect(changed).toContain(column)
      })

      it(`${column} reste écrivable APRÈS soumission — arbitrage : geler l'adresse bloquerait une correction légitime`, async () => {
        await setRoleA('admin')
        await setSubmitted(true)
        try {
          const stamped = `${String(value)}-${Math.floor(Math.random() * 1e6)}`
          const { error } = await setup.clientA
            .from('agencies')
            .update({ [column]: stamped })
            .eq('id', setup.agencyAId)
          expect(
            error,
            `seule l'identité VÉRIFIÉE (5 colonnes) est gelée par agencies_guard_identity_columns ; ` +
            `address/city/canton/postal_code ne nourrissent aucun véto`
          ).toBeNull()

          const { data } = await serviceRoleClient()
            .from('agencies').select(column).eq('id', setup.agencyAId).single()
          expect((data as Record<string, unknown> | null)?.[column]).toBe(stamped)

          const { data: events } = await serviceRoleClient()
            .from('activity_events')
            .select('metadata, severity')
            .eq('agency_id', setup.agencyAId)
            .eq('action', 'agency_legal_identity_updated')
            .order('created_at', { ascending: false })
            .limit(1)
          const changed = (events?.[0]?.metadata as { changed?: string[] } | null)?.changed ?? []
          expect(changed, `même écrivable, le changement reste journalisé après soumission`).toContain(column)
          expect(events?.[0]?.severity, `dossier déjà soumis → warn, même règle que l'identité`).toBe('warn')
        } finally {
          await setSubmitted(false)
        }
      })
    }

    it('un changement combiné (legal_name + city) journalise les DEUX dans la même ligne', async () => {
      await setRoleA('admin')
      await setSubmitted(false)
      const legal = `Combine ${setup.stamp}-${Math.floor(Math.random() * 1e6)}`

      const { error } = await setup.clientA
        .from('agencies')
        .update({ legal_name: legal, city: 'Lausanne' })
        .eq('id', setup.agencyAId)
      expect(error).toBeNull()

      const { data: events } = await serviceRoleClient()
        .from('activity_events')
        .select('metadata')
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')
        .order('created_at', { ascending: false })
        .limit(1)
      const changed = (events?.[0]?.metadata as { changed?: string[] } | null)?.changed ?? []
      expect([...changed].sort()).toEqual(['city', 'legal_name'])
    })

    it('un agent simple ne peut plus écrire address — donc n\'écrit plus non plus cet activity_events', async () => {
      await setRoleA('agent')
      await setSubmitted(false)

      const { count: before } = await serviceRoleClient()
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')

      await setup.clientA
        .from('agencies')
        .update({ address: 'Tentative Agent Simple' })
        .eq('id', setup.agencyAId)

      const { count: after } = await serviceRoleClient()
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', setup.agencyAId)
        .eq('action', 'agency_legal_identity_updated')

      expect(after, `le RBAC (écart 1) bloque déjà l'écriture avant que le trigger AFTER UPDATE ne s'exécute`).toBe(before)
    })
  })
})
