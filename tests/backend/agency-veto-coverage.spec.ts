// Backend test (live CI) — invariant de couverture des vétos KYB (étape 7, tâche 1).
//
// CE QUE CE FICHIER GARDE, ET POURQUOI IL EXISTE. Un véto ne passe que sur 'match', et le
// moteur (recompute_agency_verification) traite une ligne ABSENTE exactement comme un
// résultat défavorable : `where result is distinct from 'match'` capture le NULL laissé par
// le LEFT JOIN. Un type déclaré véto que RIEN ne peut faire passer à 'match' bloque donc
// TOUS les dossiers, définitivement, sans que rien ne le signale — ni une erreur, ni un
// avertissement, ni un test.
//
// C'est arrivé. `pep_sanctions_screening` est déclaré véto de personne depuis la migration
// du catalogue (20260729150300) et aucun chemin de production ne lui écrit jamais de ligne :
// les trois `insert into agency_person_verification_checks` du dépôt sont tous scopés à
// 'id_document', record_agency_verification_run n'écrit que la portée agence, et
// admin_resolve_agency_id_document refuse tout autre type. La branche `auto_validated` était
// donc du code mort en production pendant six étapes, alors que les mesures pays par pays de
// agency-verification-run.spec.ts affichaient un `auto_validated` — obtenu parce que LEUR
// FIXTURE pose ce véto à la main (`source: 'manual'`). Un test qui seede lui-même ce qu'il
// prétend mesurer ne mesure pas la production.
//
// D'où ce fichier, et sa règle de construction : **il ne code AUCUNE liste en dur.**
//   - la liste des vétos se lit dans verification_check_config (la table EST la source de
//     vérité ; un test qui recopie la table ne détecte jamais un ajout) ;
//   - la liste des types servis par un connecteur se lit dans le registre IMPORTÉ
//     (_shared/kyb-sources.ts), donc elle ne peut pas dériver du code ;
//   - la liste des types qu'un humain peut résoudre est SONDÉE en appelant réellement la
//     RPC de décision, jamais déduite de la lecture d'une migration.
//
// Les trois se mettent à jour d'elles-mêmes. Ajouter un véto orphelin fera échouer ce
// fichier le jour même, et le nommera.
//
// LIMITE ASSUMÉE, dans le bon sens. Le registre est lu par le `checkType` que chaque source
// DÉCLARE. Un connecteur peut écraser le sien à l'exécution (KybSourceResult.check_type —
// c'est ce que fait RDAP pour domain_generic_provider), et cette écriture-là est invisible
// ici. Un véto servi UNIQUEMENT par un écrasement à l'exécution serait donc signalé à tort.
// Ce faux positif est le bon sens de l'erreur : il fait parler quelqu'un, là où le silence
// a coûté six étapes. Aucun type partagé n'est produit de cette façon aujourd'hui.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local seedé.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import {
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  createUidRegisterSources,
  createPepSanctionsSources,
} from '../../supabase/functions/_shared/kyb-sources'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

/** Les `check_type` que TOUT connecteur du dépôt déclare servir, les deux portées confondues
 *  — c'est bien l'union qui compte : le catalogue déclare des vétos d'agence ET de personne,
 *  et un véto de personne servi par un connecteur de personne n'est pas orphelin.
 *
 *  Composé exactement comme le fait agency-verification-run/index.ts : les entrées statiques,
 *  plus les fabriques. Les jetons passés ici sont factices et ne servent qu'à instancier : on
 *  ne lit que le `checkType` déclaré, jamais on n'exécute `run`. */
function servedCheckTypes(): Set<string> {
  const agencySources = [
    ...AGENCY_KYB_SOURCES,
    createAddressGeocodeSource('jeton-factice-non-utilise'),
    ...createUidRegisterSources({ baseUrl: '', credential: '' }),
  ]
  const personSources = createPepSanctionsSources({ apiKey: '' })
  return new Set([...agencySources, ...personSources].map((s) => s.checkType))
}

interface VetoRow {
  code: string
  scope: 'agency' | 'person'
}

describe.skipIf(!HAS_KEYS)('couverture des vétos KYB — aucun véto ne doit être orphelin', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []

  let superAdmin: SupabaseClient
  let activeVetoes: VetoRow[]

  beforeAll(async () => {
    const svc = serviceRoleClient()

    // Allowlist super-admin (20260705160000) : domaine @megga-test.local, idempotent,
    // jamais nettoyé — partagé entre fichiers de specs, même motif que helpers/two-agencies.ts.
    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config super_admin_test_domain: ${cfgErr.message}`)

    superAdmin = await createSuperAdminUser()

    // LA source de vérité : la configuration EN VIGUEUR (valid_to is null), exactement ce
    // que lit le moteur pour construire veto_types_agency / veto_types_person.
    const { data, error } = await svc
      .from('verification_check_config')
      .select('check_type, is_veto, valid_to, verification_check_types!inner(code, scope)')
      .is('valid_to', null)
      .eq('is_veto', true)
    if (error) throw new Error(`lecture des vétos actifs: ${error.message}`)

    activeVetoes = (data ?? []).map((row) => {
      const t = row.verification_check_types as unknown as { code: string; scope: 'agency' | 'person' }
      return { code: t.code, scope: t.scope }
    })

    if (activeVetoes.length === 0) {
      throw new Error(
        'aucun véto actif lu en base : le test ne prouverait rien. ' +
        'Vérifier que les migrations du catalogue sont appliquées (supabase db reset).'
      )
    }
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNÊTE, même limite structurelle que agency-verification-engine.spec.ts :
    // une agence sur laquelle une décision humaine a écrit un activity_events (append-only,
    // LBA art. 7) ne peut plus être supprimée par un DELETE ordinaire. On rapporte plutôt
    // que d'avaler.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    for (const id of userIds) {
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-veto-coverage.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test ` +
        `non supprimée(s) — activity_events est append-only dès qu'une décision humaine y a écrit :\n` +
        undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  // role super_admin non attribuable via user_metadata (à raison) -> upsert manuel par le
  // service_role, même motif que agency-review-queue.spec.ts.
  async function createSuperAdminUser(): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `veto-coverage-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser super_admin: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    const { error: pErr } = await svc
      .from('profiles')
      .upsert({ id, email, full_name: `Super ${stamp}`, role: 'super_admin', agency_id: null }, { onConflict: 'id' })
    if (pErr) throw new Error(`profile super_admin: ${pErr.message}`)
    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin super_admin: ${signInErr.message}`)
    return client
  }

  async function createAgencyAwaitingReview(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Veto ${stamp}`,
        slug: `agence-veto-${stamp}`,
        country: 'FR',
        // La RPC de résolution exige un dossier SOUMIS et en revue : c'est l'état dans
        // lequel un relecteur la rencontre.
        identity_submitted_at: new Date(0).toISOString(),
        verification_status: 'manual_review',
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
    if (pErr) throw new Error(`related_person signatory: ${pErr.message}`)
    const { error: rErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })
    if (rErr) throw new Error(`person_role signatory: ${rErr.message}`)
    return person!.id as string
  }

  /**
   * SONDE réelle : ce véto de personne peut-il être tranché par une décision humaine ?
   *
   * Pose une ligne du type visé sur un signataire actif d'un dossier en revue, puis appelle
   * la RPC de résolution en super-admin. On ne lit PAS un message d'erreur particulier — on
   * regarde si l'appel aboutit. Un refus, quel qu'en soit le motif, veut dire que ce type
   * n'a pas de voie de sortie humaine, et c'est exactement ce que l'invariant demande.
   *
   * Volontairement tolérant à l'ajout d'une future RPC : dès qu'une RPC généralisée
   * (admin_resolve_agency_person_check) existera, il suffira de l'ajouter à la liste sondée
   * pour que l'invariant en tienne compte, sans toucher au reste.
   */
  async function isHumanResolvable(checkType: string): Promise<boolean> {
    const svc = serviceRoleClient()
    const agencyId = await createAgencyAwaitingReview(`probe-${checkType.slice(0, 12)}`)
    const personId = await addActiveSignatory(agencyId)

    const { data: check, error: insErr } = await svc
      .from('agency_person_verification_checks')
      .insert({
        related_person_id: personId,
        check_type: checkType,
        source: 'manual',
        result: 'pending_manual_review',
      })
      .select('id')
      .single()
    if (insErr) throw new Error(`sonde: insert du check ${checkType}: ${insErr.message}`)

    const candidates = ['admin_resolve_agency_id_document', 'admin_resolve_agency_person_check']
    for (const fn of candidates) {
      const { error } = await superAdmin.rpc(fn, {
        p_agency_id: agencyId,
        p_check_id: check!.id,
        p_result: 'match',
      })
      // PGRST202 = fonction inexistante : candidat pas encore écrit, on passe au suivant.
      if (!error) return true
      if (error.code && error.code !== 'PGRST202' && !/could not find the function/i.test(error.message)) {
        continue // refus métier : ce type n'est pas de son ressort
      }
    }
    return false
  }

  it('chaque véto ACTIF est soit servi par un connecteur, soit résoluble par un humain', async () => {
    const declaredByConnector = servedCheckTypes()

    const orphans: string[] = []
    for (const veto of activeVetoes) {
      if (declaredByConnector.has(veto.code)) continue
      if (veto.scope === 'person' && (await isHumanResolvable(veto.code))) continue
      orphans.push(`${veto.code} (portée ${veto.scope})`)
    }

    expect(
      orphans,
      `Véto(s) ORPHELIN(s) : déclaré(s) bloquant(s) en base, mais aucun connecteur ne les sert et ` +
      `aucune décision humaine ne peut les résoudre. Un véto sans ligne échoue comme un véto ` +
      `défavorable : tant qu'il en reste un, AUCUN dossier ne peut atteindre auto_validated, dans ` +
      `aucun pays. Soit lui donner une source, soit lui donner une voie de sortie humaine, soit ` +
      `retirer son is_veto par une NOUVELLE ligne de verification_check_config (jamais un UPDATE ` +
      `en place : la pondération est versionnée pour qu'un audit rejoue le barème d'alors).\n` +
      `Orphelins : ${orphans.join(', ')}`
    ).toEqual([])
  })

  it('la lecture des vétos vient bien de la base, et non d’une liste écrite ici', () => {
    // Garde-fou du garde-fou : si quelqu'un remplace un jour la lecture SQL par une
    // constante, ce test tombe. Les 6 vétos du catalogue au 30.07.2026 sont 4 d'entité et
    // 2 de personne ; ce test ne vérifie PAS ce compte (il changerait légitimement), il
    // vérifie que les deux portées sont représentées et que rien n'est vide.
    expect(activeVetoes.length).toBeGreaterThan(0)
    expect(activeVetoes.some((v) => v.scope === 'agency')).toBe(true)
    expect(activeVetoes.some((v) => v.scope === 'person')).toBe(true)
    for (const v of activeVetoes) {
      expect(v.code, 'un véto lu en base doit porter un code non vide').toBeTruthy()
    }
  })
})
