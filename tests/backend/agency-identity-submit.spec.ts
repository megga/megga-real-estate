// RPC de soumission d'identité — submit_agency_identity() (étape 2 onboarding KYB,
// tâche 1). Le dirigeant clôt sa saisie d'identité légale ; la RPC valide la
// complétude (raison sociale, forme juridique, pays, signataire actif — dans cet
// ordre), pose agencies.identity_submitted_at et journalise dans activity_events.
// Idempotente côté métier : un second appel après un premier succès ne rejoue rien.
//
// Chaque test crée sa propre agence via une vraie inscription (le trigger
// handle_new_user provisionne l'agence solo et pose le fondateur admin) : on ne
// fabrique jamais l'agence à la main, sinon le test ne prouve pas le comportement
// réel. Motif de création d'utilisateur repris de signup-provisioning.spec.ts.
//
// Voir docs/superpowers/plans/2026-07-27-onboarding-kyb-etape-2.md (Task 1) et
// supabase/migrations/20260727100000_submit_agency_identity.sql.

import { describe, it, expect, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

interface Founder {
  id: string
  agencyId: string
  client: SupabaseClient
}

describe.skipIf(!HAS_KEYS)('submit_agency_identity — RPC de soumission', () => {
  const userIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  // Inscrit un fondateur : handle_new_user() -> provision_solo_agency() lui crée une
  // agence solo et le pose admin. C'est la seule façon de tester le comportement réel
  // de is_agency_admin() sans fabriquer un profil à la main.
  async function signUpFounder(): Promise<Founder> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `identity-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: `Fondateur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)

    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
    if (!prof?.agency_id) throw new Error('provisioning: aucune agence solo créée')

    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin: ${signInErr.message}`)

    return { id, agencyId: prof.agency_id as string, client }
  }

  async function getChSaLegalFormId(): Promise<string> {
    const { data, error } = await serviceRoleClient()
      .from('legal_forms')
      .select('id')
      .eq('code', 'CH_SA')
      .single()
    if (error) throw new Error(`legal_forms lookup: ${error.message}`)
    return data!.id as string
  }

  // valid_to nul = signataire actif sans date de fin ; une date passée simule un
  // mandat expiré, utilisé pour prouver que le check regarde bien valid_to et pas
  // seulement l'existence de la ligne.
  async function addSignatory(agencyId: string, validTo: string | null = null): Promise<void> {
    const svc = serviceRoleClient()
    const { data: person, error: perErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Dupont' })
      .select('id')
      .single()
    if (perErr) throw new Error(`related_person: ${perErr.message}`)

    const { error: roleErr } = await svc
      .from('agency_person_roles')
      .insert({
        related_person_id: person!.id,
        role: 'signatory',
        signature_power: 'individual',
        valid_to: validTo,
      })
    if (roleErr) throw new Error(`person_role: ${roleErr.message}`)
  }

  async function completeAgencyIdentity(agencyId: string): Promise<void> {
    const legalFormId = await getChSaLegalFormId()
    const { error } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Test SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', agencyId)
    if (error) throw new Error(`update agency: ${error.message}`)
    await addSignatory(agencyId)
  }

  it('un dirigeant dont l\'agence est complète soumet, et identity_submitted_at est posé', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, `submit: ${error?.message}`).toBeNull()

    const { data: agency } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(agency?.identity_submitted_at, 'identity_submitted_at doit être posé').not.toBeNull()
  })

  it('un second appel ne crée pas un second événement dans activity_events', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const first = await founder.client.rpc('submit_agency_identity')
    expect(first.error, `1er appel: ${first.error?.message}`).toBeNull()

    const { data: agencyAfterFirst } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()

    const second = await founder.client.rpc('submit_agency_identity')
    expect(second.error, `2e appel: ${second.error?.message}`).toBeNull()

    const { data: agencyAfterSecond } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(
      agencyAfterSecond?.identity_submitted_at,
      'un second appel ne doit pas rejouer la pose de identity_submitted_at'
    ).toBe(agencyAfterFirst?.identity_submitted_at)

    const { data: events, error: evErr } = await serviceRoleClient()
      .from('activity_events')
      .select('id')
      .eq('entity_type', 'agency')
      .eq('entity_id', founder.agencyId)
      .eq('action', 'agency_identity_submitted')
    expect(evErr).toBeNull()
    expect(events?.length, 'un second appel ne doit pas re-journaliser').toBe(1)
  })

  it('un agent simple (role agent) reçoit 42501', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    // role/agency_id sont en lecture seule hors service_role (garde 20260627120000).
    const { error: downgradeErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', founder.id)
    expect(downgradeErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'un agent simple ne doit jamais soumettre l\'identité de son agence').not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('une agence sans legal_name est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    // legal_name / legal_form_id / country restent NULL : agence fraîchement
    // provisionnée par le trigger, jamais complétée.

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans raison sociale ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('legal_name')
  })

  it('une agence sans legal_form_id est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Forme SA' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans forme juridique ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('legal_form')
  })

  it('une agence sans country est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Pays SA', legal_form_id: legalFormId })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans pays ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('country')
  })

  it('une agence sans signataire actif est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Signataire SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    // Signataire expiré (valid_to hier) : la ligne existe mais ne compte pas comme
    // active, ce qui prouve que le check regarde valid_to et pas seulement
    // l'existence de la ligne.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await addSignatory(founder.agencyId, yesterday)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans signataire actif ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('signatory')
  })

  // Frontière valid_to : « actif » couvre aussi le futur, pas seulement NULL. Comportement
  // vérifié en base avant d'écrire ces deux assertions (docker exec psql, transaction
  // jetable sur _agency_identity_completeness_error) plutôt que déduit de la lecture du
  // SQL — apr.valid_to > current_date, comparaison stricte.
  it('un signataire dont le valid_to est demain permet la soumission', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Mandat Futur SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await addSignatory(founder.agencyId, tomorrow)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, `submit: ${error?.message}`).toBeNull()

    const { data: agency } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(
      agency?.identity_submitted_at,
      'un mandat qui court encore (valid_to demain) doit compter comme actif'
    ).not.toBeNull()
  })

  it('un signataire dont le valid_to est aujourd\'hui ne compte pas comme actif (comparaison stricte)', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Mandat Limite SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const today = new Date().toISOString().slice(0, 10)
    await addSignatory(founder.agencyId, today)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(
      error,
      'un valid_to égal à aujourd\'hui ne doit pas compter comme actif (comparaison stricte >)'
    ).not.toBeNull()
    expect(error?.message).toContain('signatory')
  })

  // ── Tâche 6 : extension pour la pièce d'identité (agency_person_verification_checks) ──
  // Le fichier recto/verso est déposé côté client dans Storage (bucket documents,
  // préfixe kyb-identity — migration 20260727110000) ; la ligne de check ne peut venir
  // que de CETTE RPC, puisque les tables de checks refusent l'écriture à tout rôle
  // utilisateur (42501, 20260726130300). p_related_person_id est optionnel (défaut
  // null) : tous les tests ci-dessus, inchangés, prouvent la rétrocompatibilité.

  it('un dirigeant qui désigne son propre signataire fait poser un check id_document en attente de revue', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)
    const { data: signatoryRow, error: personErr } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founder.agencyId)
      .single()
    expect(personErr).toBeNull()
    const relatedPersonId = signatoryRow!.id as string

    const { error } = await founder.client.rpc('submit_agency_identity', { p_related_person_id: relatedPersonId })
    expect(error, `submit avec p_related_person_id: ${error?.message}`).toBeNull()

    const { data: check, error: checkErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('check_type, source, result')
      .eq('related_person_id', relatedPersonId)
      .maybeSingle()
    expect(checkErr).toBeNull()
    expect(check?.check_type, 'check_type doit être id_document').toBe('id_document')
    expect(check?.source, 'aucun prestataire à ce stade : source=manual').toBe('manual')
    expect(check?.result, 'en attente de revue humaine, jamais un verdict auto').toBe('pending_manual_review')
  })

  it('un dirigeant qui ne désigne personne (paramètre omis) ne pose aucun check — rétrocompatibilité', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)
    const { data: signatoryRow } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founder.agencyId)
      .single()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, `submit: ${error?.message}`).toBeNull()

    const { data: checks, error: checkErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id')
      .eq('related_person_id', signatoryRow!.id as string)
    expect(checkErr).toBeNull()
    expect(checks?.length ?? 0, 'sans p_related_person_id, aucune ligne de check ne doit apparaître').toBe(0)
  })

  // Le test explicitement demandé : la garde d'appartenance à l'agence appelante.
  it('un dirigeant ne peut pas faire poser un check sur une personne d\'une autre agence', async () => {
    const founderA = await signUpFounder()
    await completeAgencyIdentity(founderA.agencyId)

    const founderB = await signUpFounder()
    await completeAgencyIdentity(founderB.agencyId)
    const { data: personB, error: personBErr } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founderB.agencyId)
      .single()
    expect(personBErr).toBeNull()
    const personBId = personB!.id as string

    const { error } = await founderA.client.rpc('submit_agency_identity', { p_related_person_id: personBId })
    expect(error, 'un dirigeant de l\'agence A ne doit jamais pouvoir cibler une personne de l\'agence B').not.toBeNull()
    expect(error?.code).toBe('42501')

    // Aucune ligne de check ne doit avoir été créée pour la personne visée malgré la tentative.
    const { data: checksOnB, error: checksOnBErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id')
      .eq('related_person_id', personBId)
    expect(checksOnBErr).toBeNull()
    expect(checksOnB?.length ?? 0, 'aucun check ne doit apparaître sur la personne visée').toBe(0)

    // Et la soumission de l'agence A elle-même doit avoir échoué EN ENTIER (pas
    // seulement l'insert du check) : identity_submitted_at doit rester null. La garde
    // de personne est placée AVANT la pose de identity_submitted_at (point d'extension,
    // 20260727100000) — un échec ici avorte toute la transaction de la fonction.
    const { data: agencyA } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founderA.agencyId)
      .maybeSingle()
    expect(agencyA?.identity_submitted_at, 'la soumission entière doit échouer, pas seulement le check').toBeNull()
  })

  it('un related_person_id inexistant est refusé aussi (fail-closed, même erreur que la fuite inter-agences)', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const { error } = await founder.client.rpc('submit_agency_identity', {
      p_related_person_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(error, 'un id qui ne correspond à personne ne doit jamais être toléré silencieusement').not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  // Revue tâche 7, point 2 : la garde d'appartenance à l'agence (ci-dessus) ferme la
  // fuite INTER-agence, mais ne vérifiait pas que la personne visée porte un rôle de
  // SIGNATAIRE ACTIF avant d'y poser une vérification de pièce d'identité — un
  // bénéficiaire effectif (ubo) de la MÊME agence passait la garde puisqu'elle ne
  // teste que agency_id. Pas exploitable aujourd'hui (le client ne transmet que
  // signatoryId, cf. IdentityShell.tsx handleSubmit), mais une fonction SECURITY
  // DEFINER de conformité ne doit pas dépendre pour sa correction d'une hypothèse sur
  // son appelant.
  it('un related_person_id qui désigne un bénéficiaire effectif (pas signataire) de la MÊME agence est refusé, avec un message distinct de la fuite inter-agences', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const svc = serviceRoleClient()
    const { data: ubo, error: uboErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: founder.agencyId, first_name: 'Marie', last_name: 'Curie' })
      .select('id')
      .single()
    expect(uboErr).toBeNull()
    const uboId = ubo!.id as string
    const { error: roleErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: uboId, role: 'ubo', ownership_pct: 40 })
    expect(roleErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity', { p_related_person_id: uboId })
    expect(
      error,
      'un bénéficiaire effectif ne doit jamais pouvoir recevoir une vérification de pièce d\'identité'
    ).not.toBeNull()
    expect(error?.code).toBe('42501')
    expect(
      error?.message,
      'message distinct de la garde inter-agence, pour ne pas confondre les deux causes de refus'
    ).not.toContain('not in caller agency')

    const { data: checksOnUbo, error: checksErr } = await svc
      .from('agency_person_verification_checks')
      .select('id')
      .eq('related_person_id', uboId)
    expect(checksErr).toBeNull()
    expect(checksOnUbo?.length ?? 0, 'aucun check ne doit apparaître sur la personne visée').toBe(0)
  })

  // Revue tâche 6, point 2 (important) : la RPC lisait identity_submitted_at puis
  // écrivait, sans verrou. Deux sessions entrelacées (ou un double clic sur le bouton
  // de soumission) pouvaient toutes deux lire v_submitted = null AVANT que l'une ou
  // l'autre n'écrive quoi que ce soit, et empiler chacune une ligne
  // 'pending_manual_review' pour la même personne + un événement activity_events
  // (append-only, conservé dix ans, jamais purgeable). N CALLS concurrents réels (fetch
  // en parallèle, pas une boucle séquentielle attendue un par un) exercent le verrou
  // FOR UPDATE posé sur la ligne agencies : un seul doit gagner l'écriture.
  it('N appels concurrents (double clic) sur la même personne ne posent qu\'UN SEUL check et qu\'UN SEUL événement (verrou FOR UPDATE)', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)
    const { data: signatoryRow, error: personErr } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founder.agencyId)
      .single()
    expect(personErr).toBeNull()
    const relatedPersonId = signatoryRow!.id as string

    const CONCURRENCY = 8
    // Promise.all (pas de await séquentiel) : les N requêtes HTTP partent ensemble,
    // PostgREST les sert sur des connexions/transactions distinctes — c'est ce qui
    // rend cette course réelle, pas seulement simulée.
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        founder.client.rpc('submit_agency_identity', { p_related_person_id: relatedPersonId })
      )
    )
    for (const r of results) {
      expect(r.error, `appel concurrent: ${r.error?.message}`).toBeNull()
    }

    const { data: checks, error: checksErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id')
      .eq('related_person_id', relatedPersonId)
    expect(checksErr).toBeNull()
    expect(checks?.length, `un seul check malgré ${CONCURRENCY} appels concurrents`).toBe(1)

    const { data: events, error: evErr } = await serviceRoleClient()
      .from('activity_events')
      .select('id')
      .eq('entity_type', 'agency')
      .eq('entity_id', founder.agencyId)
      .eq('action', 'agency_identity_submitted')
    expect(evErr).toBeNull()
    expect(events?.length, `un seul événement malgré ${CONCURRENCY} appels concurrents`).toBe(1)

    const { data: agency } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(agency?.identity_submitted_at).not.toBeNull()
  })

  // Revue tâche 6, point 3 (important) : un appel SANS argument (chemin actuel du
  // client — useAgencyIdentity.ts `submit()` appelle encore la RPC sans
  // p_related_person_id) pose identity_submitted_at ; un appel ULTÉRIEUR AVEC
  // p_related_person_id (une fois la tâche 7 câblée) doit malgré tout poser la ligne
  // de check, pas rester sans effet à cause du retour anticipé « déjà soumis ».
  it('un appel sans p_related_person_id puis un second AVEC pose quand même le check (retour anticipé neutralisait ce chemin)', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)
    const { data: signatoryRow, error: personErr } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founder.agencyId)
      .single()
    expect(personErr).toBeNull()
    const relatedPersonId = signatoryRow!.id as string

    // 1er appel : sans argument — soumet le dossier, ne pose aucun check.
    const first = await founder.client.rpc('submit_agency_identity')
    expect(first.error, `1er appel: ${first.error?.message}`).toBeNull()
    const { data: agencyAfterFirst } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(agencyAfterFirst?.identity_submitted_at, 'le 1er appel doit déjà soumettre le dossier').not.toBeNull()

    // 2e appel : APRÈS soumission, avec p_related_person_id cette fois.
    const second = await founder.client.rpc('submit_agency_identity', { p_related_person_id: relatedPersonId })
    expect(second.error, `2e appel: ${second.error?.message}`).toBeNull()

    const { data: check, error: checkErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('check_type, source, result')
      .eq('related_person_id', relatedPersonId)
      .maybeSingle()
    expect(checkErr).toBeNull()
    expect(check, 'le 2e appel doit poser la ligne de check malgré le dossier déjà soumis').not.toBeNull()
    expect(check?.check_type).toBe('id_document')
    expect(check?.source).toBe('manual')
    expect(check?.result).toBe('pending_manual_review')

    // identity_submitted_at ne doit pas être rejoué (toujours idempotent par ailleurs).
    const { data: agencyAfterSecond } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(agencyAfterSecond?.identity_submitted_at).toBe(agencyAfterFirst?.identity_submitted_at)
  })

  it('un 3e appel avec le même p_related_person_id (déjà coché) reste sans effet — pas de second check pour la même personne', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)
    const { data: signatoryRow } = await serviceRoleClient()
      .from('agency_related_persons')
      .select('id')
      .eq('agency_id', founder.agencyId)
      .single()
    const relatedPersonId = signatoryRow!.id as string

    await founder.client.rpc('submit_agency_identity')
    const second = await founder.client.rpc('submit_agency_identity', { p_related_person_id: relatedPersonId })
    expect(second.error).toBeNull()
    const third = await founder.client.rpc('submit_agency_identity', { p_related_person_id: relatedPersonId })
    expect(third.error, `3e appel: ${third.error?.message}`).toBeNull()

    const { data: checks, error: checksErr } = await serviceRoleClient()
      .from('agency_person_verification_checks')
      .select('id')
      .eq('related_person_id', relatedPersonId)
    expect(checksErr).toBeNull()
    expect(checks?.length, 'un 3e appel avec le même id ne doit jamais reposer une seconde ligne').toBe(1)
  })

  it('l\'événement journalisé porte category=kyc (et non compliance)', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error).toBeNull()

    const { data: event, error: evErr } = await serviceRoleClient()
      .from('activity_events')
      .select('category, severity, actor_kind, actor_id, action, entity_type, entity_id')
      .eq('entity_type', 'agency')
      .eq('entity_id', founder.agencyId)
      .eq('action', 'agency_identity_submitted')
      .maybeSingle()
    expect(evErr).toBeNull()
    expect(event?.category, 'compliance ferait échouer activity_events_category_check').toBe('kyc')
    expect(event?.severity).toBe('info')
    expect(event?.actor_kind).toBe('user')
    expect(event?.actor_id).toBe(founder.id)
  })
})
