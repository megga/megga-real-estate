// Backend test (live CI) — moteur de scoring KYB : recompute_agency_verification()
// (étape 3, tâche 2 — migration 20260728130000_recompute_agency_verification.sql).
//
// Un test par règle de docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-3.md
// (« Les règles de calcul, telles qu'elles doivent être »). Chaque règle a une raison
// de conformité précise ; le nom du test cite la règle pour rester traçable au plan.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer.
//
// Portée des vétos PERSONNE (pep_sanctions_screening, id_document) : évalués sur les
// SIGNATAIRES ACTIFS uniquement, jamais sur les UBO. Ce n'est pas un raccourci — c'est
// ce que produit déjà le reste du chantier : submit_agency_identity()
// (20260728110000) refuse explicitement de poser un check id_document sur une personne
// qui ne porte pas un rôle signatory actif (« related person is not an active
// signatory »). Exiger un check PEP/pièce d'identité sur un UBO passif — qui n'a par
// construction aucun chemin applicatif pour en recevoir un — bloquerait toute agence
// avec UBO en revue humaine à perpétuité, pas par un vrai défaut de conformité mais par
// une incohérence de périmètre entre le moteur et le wizard.
//
// ⚠ LIMITE STRUCTURELLE DU NETTOYAGE (afterAll ci-dessous) — pourquoi ta base locale
// grossit. Chaque test ici appelle recompute_agency_verification(), qui journalise
// SYSTÉMATIQUEMENT un activity_events (category=kyc, actor_kind=system). Cette ligne est
// append-only (trigger enforce_activity_events_immutability, LBA art. 7) : la seule
// UPDATE autorisée sur une ligne actor_kind=system est l'anonymisation nLPD, qui exige
// explicitement agency_id INCHANGÉ. Or supprimer l'agence déclenche
// activity_events_agency_id_fkey (ON DELETE SET NULL), qui tente de mettre agency_id À
// NULL — un changement, donc jamais l'anonymisation — et le trigger lève P0001. Résultat :
// TOUTE agence sur laquelle le moteur a tourné au moins une fois ne peut plus JAMAIS être
// supprimée par un DELETE ordinaire. Ce n'est pas un bug de ce fichier, c'est la garantie
// de conformité elle-même (append-only pendant 10 ans) qu'on ne va pas affaiblir pour
// autant. Le afterAll ci-dessous supprime ce qui peut l'être et RAPPORTE nommément,
// avec la raison exacte renvoyée par Postgres, ce qu'il ne peut pas supprimer — plutôt que
// d'avaler l'erreur en silence (PostgREST renvoie cette erreur dans le corps de la
// réponse, pas en rejet de promesse : un `.then(() => {}, () => {})` qui ignore la valeur
// résolue l'avalait sans même la lire). D'où les agences de test qui persistent en base
// locale d'une exécution à l'autre : attendu, documenté, plus jamais silencieux.

import { describe, it, expect, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PW = 'Test-Password-123!'
const DENIED = '42501'
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

// Catalogue courant (20260728103000) — les 4 vétos ENTITÉ et les 2 vétos PERSONNE,
// tous is_veto=true, poids nul par construction (le poids ne les concerne pas).
const AGENCY_VETO_TYPES = [
  'registry_number_format',
  'registry_lookup',
  'registry_legal_name_match',
  'registry_country_match',
] as const
const PERSON_VETO_TYPES = ['pep_sanctions_screening', 'id_document'] as const

/** PostgREST peut renvoyer un `numeric` en JSON number ou en texte selon la colonne — défensif. */
const num = (x: unknown): number => Number(x)

describe.skipIf(!HAS_KEYS)('recompute_agency_verification — moteur de scoring KYB', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNÊTE (voir la note en tête de fichier) : chaque échec est collecté
    // avec la raison exacte plutôt qu'avalé, une agence qui échoue n'empêche pas les
    // suivantes d'être tentées.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      // cascade : agency_related_persons, agency_person_roles, agency_verification_checks,
      // agency_person_verification_checks partent avec l'agence (ON DELETE CASCADE) —
      // SAUF si le moteur a tourné dessus : voir la note en tête de fichier.
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    for (const id of userIds) {
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-verification-engine.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test ` +
        `non supprimee(s) -- limite structurelle documentee en tete de fichier ` +
        `(activity_events est append-only, LBA art. 7), pas un echec inattendu :\n` +
        undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createAgency(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Moteur ${stamp}`, slug: `agence-moteur-${stamp}` })
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

  /** UBO passif — jamais un signataire : sert les tests qui prouvent que le moteur ne
   *  confond pas « il existe des personnes liées » avec « il existe un signataire actif ». */
  async function addUbo(agencyId: string): Promise<string> {
    const svc = serviceRoleClient()
    const { data: person, error: pErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Marie', last_name: 'Beneficiaire' })
      .select('id')
      .single()
    if (pErr) throw new Error(`related_person ubo: ${pErr.message}`)
    const { error: rErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'ubo', ownership_pct: 30 })
    if (rErr) throw new Error(`person_role ubo: ${rErr.message}`)
    return person!.id as string
  }

  async function insertAgencyCheck(
    agencyId: string, checkType: string, result: string, checkedAt?: string
  ): Promise<void> {
    const svc = serviceRoleClient()
    const row: Record<string, unknown> = { agency_id: agencyId, check_type: checkType, source: 'manual', result }
    if (checkedAt) row.checked_at = checkedAt
    const { error } = await svc.from('agency_verification_checks').insert(row)
    if (error) throw new Error(`agency check ${checkType}: ${error.message}`)
  }

  async function insertPersonCheck(
    personId: string, checkType: string, result: string, checkedAt?: string
  ): Promise<void> {
    const svc = serviceRoleClient()
    const row: Record<string, unknown> = { related_person_id: personId, check_type: checkType, source: 'manual', result }
    if (checkedAt) row.checked_at = checkedAt
    const { error } = await svc.from('agency_person_verification_checks').insert(row)
    if (error) throw new Error(`person check ${checkType}: ${error.message}`)
  }

  /** Pose tous les vétos (entité + personne) en 'match' — le dossier « propre » de référence. */
  async function passAllVetoes(agencyId: string, signatoryId: string): Promise<void> {
    for (const t of AGENCY_VETO_TYPES) await insertAgencyCheck(agencyId, t, 'match')
    for (const t of PERSON_VETO_TYPES) await insertPersonCheck(signatoryId, t, 'match')
  }

  async function recompute(agencyId: string): Promise<void> {
    const { error } = await serviceRoleClient().rpc('recompute_agency_verification', { p_agency_id: agencyId })
    expect(error, `recompute_agency_verification: ${error?.message}`).toBeNull()
  }

  async function getAgency(agencyId: string): Promise<{
    verification_status: string
    verification_score: number | string | null
    verified_at: string | null
  }> {
    const { data, error } = await serviceRoleClient()
      .from('agencies')
      .select('verification_status, verification_score, verified_at')
      .eq('id', agencyId)
      .single()
    if (error) throw new Error(`get agency: ${error.message}`)
    return data as { verification_status: string; verification_score: number | string | null; verified_at: string | null }
  }

  // Inscrit un utilisateur authentifié quelconque — motif repris de
  // agency-verification-config.spec.ts (seul le rôle Postgres 'authenticated' importe).
  async function signUpUser(): Promise<{ id: string; client: SupabaseClient }> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `verif-engine-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: `Testeur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)

    const client = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin: ${signInErr.message}`)

    return { id, client }
  }

  it('un dossier sans veto et de score suffisant passe en auto_validated', async () => {
    const agencyId = await createAgency('happy')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // seul signal -> score 3.00/3.00 = 1.0

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(agency.verification_status).toBe('auto_validated')
    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verified_at, 'auto_validated doit poser verified_at').not.toBeNull()
  })

  it('un score entre les deux seuils part en manual_review', async () => {
    const agencyId = await createAgency('mid-score')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')        // poids 3.00 -> 3.00
    await insertAgencyCheck(agencyId, 'address_geocode', 'mismatch') // poids 1.50 -> 0 ; score 3/4.5=0.667

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeGreaterThanOrEqual(0.5)
    expect(num(agency.verification_score)).toBeLessThan(0.85)
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un score sous le seuil bas part aussi en manual_review (meme statut, la priorite vient du tri)', async () => {
    const agencyId = await createAgency('low-score')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'mismatch')  // poids 3.00 -> 0
    await insertAgencyCheck(agencyId, 'address_geocode', 'match') // poids 1.50 -> 1.50 ; score 1.5/4.5=0.333

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeLessThan(0.5)
    // Même statut que le test précédent (score dans la bande [0.5, 0.85[) : aucune
    // colonne de priorité dédiée, la file admin trie sur le score lui-même.
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un resultat partial vaut 0.5 dans la moyenne ponderee (revue point 3, regle non gardee par un test)', async () => {
    const agencyId = await createAgency('partial-result')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'partial') // seul contributeur -> 3.00*0.5/3.00 = 0.5

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score), 'partial doit valoir exactement 0.5, ni 0 ni 1').toBeCloseTo(0.5, 2)
  })

  it('un veto en mismatch envoie en revue quel que soit le score', async () => {
    const agencyId = await createAgency('veto-mismatch')
    const signatoryId = await addActiveSignatory(agencyId)
    await insertAgencyCheck(agencyId, 'registry_number_format', 'match')
    await insertAgencyCheck(agencyId, 'registry_lookup', 'match')
    await insertAgencyCheck(agencyId, 'registry_legal_name_match', 'mismatch') // l'échec
    await insertAgencyCheck(agencyId, 'registry_country_match', 'match')
    for (const t of PERSON_VETO_TYPES) await insertPersonCheck(signatoryId, t, 'match')
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // score par ailleurs parfait

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un veto ABSENT envoie en revue (aucune ligne, pas seulement un mismatch)', async () => {
    const agencyId = await createAgency('veto-absent')
    const signatoryId = await addActiveSignatory(agencyId)
    // 3 des 4 vétos entité posés en match ; registry_country_match n'a JAMAIS été
    // exécuté pour cette agence (aucune ligne du tout, pas même un 'unavailable').
    await insertAgencyCheck(agencyId, 'registry_number_format', 'match')
    await insertAgencyCheck(agencyId, 'registry_lookup', 'match')
    await insertAgencyCheck(agencyId, 'registry_legal_name_match', 'match')
    for (const t of PERSON_VETO_TYPES) await insertPersonCheck(signatoryId, t, 'match')
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(
      agency.verification_status,
      'un veto jamais execute ne doit jamais etre traite comme reussi par defaut'
    ).toBe('manual_review')
  })

  it('une agence sans signataire actif ne peut pas etre auto-validee', async () => {
    const agencyId = await createAgency('no-signatory')
    // Une UBO existe (il y a bien des « personnes liées »), mais aucun signataire actif.
    await addUbo(agencyId)
    for (const t of AGENCY_VETO_TYPES) await insertAgencyCheck(agencyId, t, 'match')
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(agency.verification_status).not.toBe('auto_validated')
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un unavailable ne fait pas baisser le score, il sort du calcul', async () => {
    const agencyId = await createAgency('unavailable')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')          // poids 3.00, seul compte
    await insertAgencyCheck(agencyId, 'address_geocode', 'unavailable') // exclu num ET denom

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    // Si unavailable comptait comme un mismatch : score = 3/(3+1.5) = 0.667.
    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('auto_validated')
  })

  it('un pending_manual_review force la revue meme avec un score parfait', async () => {
    const agencyId = await createAgency('pending')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // seul contributeur -> score 1.0
    await insertAgencyCheck(agencyId, 'activity_code_match', 'pending_manual_review') // exclu du score, force la revue

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un pending_manual_review au niveau PERSONNE force la revue meme avec un score parfait (revue point 3)', async () => {
    const agencyId = await createAgency('person-pending')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // score parfait par ailleurs
    await insertPersonCheck(signatoryId, 'poa_document_review', 'pending_manual_review') // exclu du score, force la revue

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(
      agency.verification_status,
      'un pending_manual_review cote personne doit forcer la revue, exactement comme cote agence'
    ).toBe('manual_review')
  })

  it('deux checks du meme type ne comptent qu une fois, le plus recent', async () => {
    const agencyId = await createAgency('dedup')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    // Quelques secondes d'écart, pas des jours : un checked_at trop ancien risquerait de
    // tomber AVANT le valid_from de la configuration active (posé au moment où la
    // migration de seed a tourné, pas à l'installation du dépôt) et serait alors exclu
    // du calcul par la jointure temporelle elle-même (règle correcte, mais un autre
    // phénomène que celui que ce test veut isoler).
    const older = new Date(Date.now() - 2000).toISOString()
    const newer = new Date(Date.now() - 1000).toISOString()
    await insertAgencyCheck(agencyId, 'address_geocode', 'mismatch', older)
    await insertAgencyCheck(agencyId, 'address_geocode', 'match', newer)

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    // Si les deux lignes comptaient (moyenne mismatch+match), le score serait 0.5.
    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('auto_validated')
  })

  it('deux checks du meme type ecrits dans LA MEME TRANSACTION (checked_at identique) : le plus recemment insere gagne', async () => {
    // Bug critique (revue) : `checked_at` vaut now() par defaut, l'heure de DEBUT de
    // transaction. Deux lignes du meme type ecrites dans la meme transaction -- ce que
    // fait exactement un connecteur qui rejoue un check -- portent donc un checked_at
    // IDENTIQUE. Un `distinct on (check_type) order by check_type, checked_at desc` sans
    // autre departage retient alors une ligne non specifiee. Repro constatee : un
    // registry_lookup en mismatch insere apres coup etait ignore au profit du plus
    // ancien favorable -- direction inverse de ce qu'exige la conformite (un veto frais
    // defavorable doit gagner, jamais se faire ecarter par un ancien resultat favorable).
    //
    // Un seul appel .insert() avec deux lignes = une seule instruction SQL = une seule
    // transaction Postgres cote serveur -> les deux lignes recoivent le meme now().
    // Seul l'ordre d'insertion physique (ctid) les distingue encore.
    const agencyId = await createAgency('same-tx-tiebreak')
    const signatoryId = await addActiveSignatory(agencyId)
    await insertAgencyCheck(agencyId, 'registry_number_format', 'match')
    const svc = serviceRoleClient()
    const { error: dupErr } = await svc.from('agency_verification_checks').insert([
      { agency_id: agencyId, check_type: 'registry_lookup', source: 'manual', result: 'match' },
      { agency_id: agencyId, check_type: 'registry_lookup', source: 'manual', result: 'mismatch' },
    ])
    if (dupErr) throw new Error(`insert paire same-tx: ${dupErr.message}`)
    await insertAgencyCheck(agencyId, 'registry_legal_name_match', 'match')
    await insertAgencyCheck(agencyId, 'registry_country_match', 'match')
    for (const t of PERSON_VETO_TYPES) await insertPersonCheck(signatoryId, t, 'match')
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // score par ailleurs parfait

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(
      agency.verification_status,
      'la ligne inseree en dernier (mismatch) doit gagner ; un veto frais defavorable ne doit jamais se faire ecarter au profit d un ancien resultat favorable'
    ).toBe('manual_review')
  })

  it('le poids applique est celui en vigueur a la date du check, pas le poids courant', async () => {
    const svc = serviceRoleClient()
    const CHECK_TYPE = 'professional_registry' // inutilisé par les autres tests de ce fichier
    const CONTROL_TYPE = 'lei_lookup'          // témoin, poids jamais touché

    const { data: currentRow, error: curErr } = await svc
      .from('verification_check_config')
      .select('id')
      .eq('check_type', CHECK_TYPE)
      .is('valid_to', null)
      .single()
    if (curErr) throw new Error(`config active ${CHECK_TYPE}: ${curErr.message}`)

    const { data: controlRow, error: ctlErr } = await svc
      .from('verification_check_config')
      .select('weight')
      .eq('check_type', CONTROL_TYPE)
      .is('valid_to', null)
      .single()
    if (ctlErr) throw new Error(`config active ${CONTROL_TYPE}: ${ctlErr.message}`)
    const controlWeight = num(controlRow!.weight)

    const now = Date.now()
    const farPast = new Date(now - 365 * 24 * 3600 * 1000).toISOString()
    const cutover = new Date(now + 3600 * 1000).toISOString() // dans le FUTUR
    const OLD_WEIGHT = 4
    const NEW_WEIGHT = 20

    let oldConfigId: string | null = null
    let newConfigId: string | null = null

    try {
      // Ferme la version courante loin dans le passé (hors de toute date utilisée par ce
      // test) puis reconstruit deux versions ENTIÈREMENT contrôlées par le test :
      // [farPast, cutover) à OLD_WEIGHT (« hier »), [cutover, null) à NEW_WEIGHT
      // (« aujourd'hui », valable seulement après cutover — donc encore dans le futur).
      const { error: closeErr } = await svc
        .from('verification_check_config')
        .update({ valid_to: farPast })
        .eq('id', currentRow!.id)
      if (closeErr) throw new Error(`fermeture config: ${closeErr.message}`)

      const { data: oldRow, error: oldErr } = await svc
        .from('verification_check_config')
        .insert({ check_type: CHECK_TYPE, weight: OLD_WEIGHT, is_veto: false, valid_from: farPast, valid_to: cutover })
        .select('id')
        .single()
      if (oldErr) throw new Error(`insert ancienne config: ${oldErr.message}`)
      oldConfigId = oldRow!.id as string

      const { data: newRow, error: newErr } = await svc
        .from('verification_check_config')
        .insert({ check_type: CHECK_TYPE, weight: NEW_WEIGHT, is_veto: false, valid_from: cutover, valid_to: null })
        .select('id')
        .single()
      if (newErr) throw new Error(`insert nouvelle config: ${newErr.message}`)
      newConfigId = newRow!.id as string

      const agencyId = await createAgency('temporal-weight')
      const signatoryId = await addActiveSignatory(agencyId)
      await passAllVetoes(agencyId, signatoryId)
      // checked_at = maintenant, donc AVANT cutover (futur) -> tombe dans la fenêtre
      // ANCIENNE [farPast, cutover) -> doit appliquer OLD_WEIGHT, jamais NEW_WEIGHT.
      await insertAgencyCheck(agencyId, CHECK_TYPE, 'match')
      await insertAgencyCheck(agencyId, CONTROL_TYPE, 'mismatch')

      await recompute(agencyId)
      const agency = await getAgency(agencyId)

      const expectedWithOldWeight = OLD_WEIGHT / (OLD_WEIGHT + controlWeight)
      const expectedWithWrongCurrentWeight = NEW_WEIGHT / (NEW_WEIGHT + controlWeight)

      expect(num(agency.verification_score), 'doit refleter le bareme en vigueur au moment du check').toBeCloseTo(expectedWithOldWeight, 2)
      expect(num(agency.verification_score)).not.toBeCloseTo(expectedWithWrongCurrentWeight, 2)
    } finally {
      if (newConfigId) await svc.from('verification_check_config').delete().eq('id', newConfigId).then(() => {}, () => {})
      if (oldConfigId) await svc.from('verification_check_config').delete().eq('id', oldConfigId).then(() => {}, () => {})
      await svc.from('verification_check_config').update({ valid_to: null }).eq('id', currentRow!.id).then(() => {}, () => {})
    }
  })

  it('deux fenetres de configuration FERMEES et chevauchantes ne comptent le poids qu une seule fois (revue point 5)', async () => {
    // L'index unique qui protege verification_check_config ne couvre que les lignes
    // OUVERTES (where valid_to is null) : rien n'empeche deux lignes FERMEES du meme
    // check_type de se chevaucher dans le temps. Repro revue : score de 0.800 au lieu de
    // 0.667 attendu -- le moteur doit se defendre lui-meme (ne retenir qu'une seule ligne
    // de config par check), plutot que de supposer la table propre.
    const svc = serviceRoleClient()
    const CHECK_TYPE = 'phone_country_match' // inutilisé par les autres tests de ce fichier

    const { data: currentRow, error: curErr } = await svc
      .from('verification_check_config')
      .select('id')
      .eq('check_type', CHECK_TYPE)
      .is('valid_to', null)
      .single()
    if (curErr) throw new Error(`config active ${CHECK_TYPE}: ${curErr.message}`)

    const now = Date.now()
    const farPast = new Date(now - 24 * 3600 * 1000).toISOString() // ferme la version courante avant les deux fenetres du test
    // Deux fenetres FERMEES (valid_to non-null) qui se CHEVAUCHENT toutes les deux sur
    // "maintenant" -- exactement le scenario que l'index unique (valid_to is null
    // uniquement) ne peut pas empecher.
    const windowAFrom = new Date(now - 2 * 3600 * 1000).toISOString()
    const windowATo = new Date(now + 1 * 3600 * 1000).toISOString()
    const windowBFrom = new Date(now - 3 * 3600 * 1000).toISOString()
    const windowBTo = new Date(now + 2 * 3600 * 1000).toISOString()
    const DUPLICATED_WEIGHT = 3.0

    let rowAId: string | null = null
    let rowBId: string | null = null

    try {
      const { error: closeErr } = await svc
        .from('verification_check_config')
        .update({ valid_to: farPast })
        .eq('id', currentRow!.id)
      if (closeErr) throw new Error(`fermeture config: ${closeErr.message}`)

      const { data: rowA, error: aErr } = await svc
        .from('verification_check_config')
        .insert({ check_type: CHECK_TYPE, weight: DUPLICATED_WEIGHT, is_veto: false, valid_from: windowAFrom, valid_to: windowATo })
        .select('id')
        .single()
      if (aErr) throw new Error(`insert fenetre A: ${aErr.message}`)
      rowAId = rowA!.id as string

      const { data: rowB, error: bErr } = await svc
        .from('verification_check_config')
        .insert({ check_type: CHECK_TYPE, weight: DUPLICATED_WEIGHT, is_veto: false, valid_from: windowBFrom, valid_to: windowBTo })
        .select('id')
        .single()
      if (bErr) throw new Error(`insert fenetre B: ${bErr.message}`)
      rowBId = rowB!.id as string

      const agencyId = await createAgency('overlapping-config')
      const signatoryId = await addActiveSignatory(agencyId)
      await passAllVetoes(agencyId, signatoryId)
      // checked_at = maintenant -> tombe dans LES DEUX fenetres A et B a la fois.
      await insertAgencyCheck(agencyId, CHECK_TYPE, 'match')          // poids 3.00, une seule fois si correct
      await insertAgencyCheck(agencyId, 'address_geocode', 'mismatch') // poids 1.50 -> 0

      await recompute(agencyId)
      const agency = await getAgency(agencyId)

      // Correct : 3.00/(3.00+1.50) = 0.667. Bug (poids compte deux fois) : (3+3)/(3+3+1.5) = 0.800.
      expect(
        num(agency.verification_score),
        'une seule ligne de config doit compter par check, meme si deux fenetres fermees se chevauchent'
      ).toBeCloseTo(2 / 3, 2)
      expect(num(agency.verification_score)).not.toBeCloseTo(0.8, 2)
    } finally {
      if (rowBId) await svc.from('verification_check_config').delete().eq('id', rowBId).then(() => {}, () => {})
      if (rowAId) await svc.from('verification_check_config').delete().eq('id', rowAId).then(() => {}, () => {})
      await svc.from('verification_check_config').update({ valid_to: null }).eq('id', currentRow!.id).then(() => {}, () => {})
    }
  })

  it('un hit PEP ou sanctions au niveau personne envoie en revue', async () => {
    const agencyId = await createAgency('pep-hit')
    const signatoryId = await addActiveSignatory(agencyId)
    for (const t of AGENCY_VETO_TYPES) await insertAgencyCheck(agencyId, t, 'match')
    await insertPersonCheck(signatoryId, 'id_document', 'match')
    await insertPersonCheck(signatoryId, 'pep_sanctions_screening', 'mismatch') // le hit
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // score entité par ailleurs parfait

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(
      agency.verification_status,
      'un hit PEP/sanctions doit bloquer meme un score entite parfait'
    ).toBe('manual_review')
  })

  it('un veto PERSONNE ABSENT envoie en revue, exactement comme un veto agence absent (revue point 3)', async () => {
    const agencyId = await createAgency('person-veto-absent')
    const signatoryId = await addActiveSignatory(agencyId)
    for (const t of AGENCY_VETO_TYPES) await insertAgencyCheck(agencyId, t, 'match')
    await insertPersonCheck(signatoryId, 'id_document', 'match')
    // pep_sanctions_screening n'a JAMAIS ete execute pour ce signataire : aucune ligne,
    // pas meme un 'unavailable'.
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(
      agency.verification_status,
      'un veto personne jamais execute ne doit jamais etre traite comme reussi par defaut'
    ).toBe('manual_review')
  })

  // Checks de PERSONNE SCORABLES (signatory_registry_match poids 3.00, poa_document_review
  // poids 2.00 -- docs/agency-kyb-verification.md §2 B, « signaux moyens ... contribuent
  // au score »). Distincts des vetos de personne ci-dessus : ceux-ci bloquent, ceux-la
  // pesent dans la moyenne, exactement comme les checks d'agence.

  it('un signatory_registry_match et un poa_document_review en mismatch pesent dans le score (pas ignores)', async () => {
    // Repro revue : les deux en mismatch, tout le reste parfait -> l'ancien moteur
    // ignorait les checks de personne scorables et rendait un score de 1.000 (auto_validated).
    const agencyId = await createAgency('person-scored-mismatch')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // poids 3.00 -> 3.00
    await insertPersonCheck(signatoryId, 'signatory_registry_match', 'mismatch') // poids 3.00 -> 0
    await insertPersonCheck(signatoryId, 'poa_document_review', 'mismatch')      // poids 2.00 -> 0
    // score attendu : 3.00 / (3.00+3.00+2.00) = 0.375

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(
      num(agency.verification_score),
      'les mismatch de personne scorables doivent faire baisser le score, pas etre ignores'
    ).toBeCloseTo(0.375, 2)
    expect(agency.verification_status).not.toBe('auto_validated')
    expect(agency.verification_status).toBe('manual_review')
  })

  it('un unavailable sur un check personne scorable ne fait pas baisser le score, il sort du calcul', async () => {
    const agencyId = await createAgency('person-scored-unavailable')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // poids 3.00, seul contributeur si exclu
    await insertPersonCheck(signatoryId, 'signatory_registry_match', 'unavailable') // exclu num ET denom

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    // Si unavailable comptait comme un mismatch : score = 3/(3+3) = 0.5.
    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('auto_validated')
  })

  it('deux checks personne scorables du meme type ne comptent qu une fois, le plus recent', async () => {
    const agencyId = await createAgency('person-scored-dedup')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')
    const older = new Date(Date.now() - 2000).toISOString()
    const newer = new Date(Date.now() - 1000).toISOString()
    await insertPersonCheck(signatoryId, 'poa_document_review', 'mismatch', older)
    await insertPersonCheck(signatoryId, 'poa_document_review', 'match', newer)

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    // Si les deux lignes comptaient (moyenne mismatch+match), le score serait < 1.
    expect(num(agency.verification_score)).toBeCloseTo(1, 2)
    expect(agency.verification_status).toBe('auto_validated')
  })

  it('un statut rejected pose par un humain n est pas ecrase par un passage du moteur', async () => {
    const agencyId = await createAgency('rejected-frozen')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // dossier qui AUTO-VALIDERAIT sinon

    const svc = serviceRoleClient()
    const { error: setErr } = await svc.from('agencies').update({ verification_status: 'rejected' }).eq('id', agencyId)
    if (setErr) throw new Error(`set rejected: ${setErr.message}`)

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(agency.verification_status).toBe('rejected')
  })

  it('un statut validated non plus', async () => {
    const agencyId = await createAgency('validated-frozen')
    // Dossier volontairement SANS AUCUN CHECK : si le moteur écrasait 'validated', on
    // verrait manual_review — la preuve porte sur un cas où l'écrasement bougerait
    // vraiment quelque chose, pas sur un statut qui resterait identique par coïncidence.
    const svc = serviceRoleClient()
    const { error: setErr } = await svc.from('agencies').update({ verification_status: 'validated' }).eq('id', agencyId)
    if (setErr) throw new Error(`set validated: ${setErr.message}`)

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(agency.verification_status).toBe('validated')
  })

  it('une agence sans aucun check scorable a un score null et n est jamais auto-validee', async () => {
    const agencyId = await createAgency('no-checks')
    // Aucun check, aucun signataire : le cas « rien n'a encore été fait ».

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    expect(agency.verification_score).toBeNull()
    expect(agency.verification_status).not.toBe('auto_validated')
  })

  it('verified_at repart a NULL quand le dossier retombe en manual_review (revue point 3)', async () => {
    const agencyId = await createAgency('verified-at-reset')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match') // score 1.0 -> auto_validated

    await recompute(agencyId)
    const first = await getAgency(agencyId)
    expect(first.verification_status).toBe('auto_validated')
    expect(first.verified_at, 'premier passage : auto_validated doit poser verified_at').not.toBeNull()

    // Un nouveau veto agence defavorable fait retomber le dossier en revue.
    await insertAgencyCheck(agencyId, 'registry_legal_name_match', 'mismatch')
    await recompute(agencyId)
    const second = await getAgency(agencyId)

    expect(second.verification_status).toBe('manual_review')
    expect(
      second.verified_at,
      'verified_at ne doit pas continuer a affirmer une confirmation qui n est plus valide'
    ).toBeNull()
  })

  it('le moteur journalise son passage dans activity_events (revue point 3 : sa suppression ne casse aujourd hui aucun test)', async () => {
    const agencyId = await createAgency('audit-log')
    const signatoryId = await addActiveSignatory(agencyId)
    await passAllVetoes(agencyId, signatoryId)
    await insertAgencyCheck(agencyId, 'vat_lookup', 'match')

    await recompute(agencyId)
    const agency = await getAgency(agencyId)

    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('activity_events')
      .select('category, severity, actor_id, actor_kind, action, entity_type, entity_id, metadata')
      .eq('agency_id', agencyId)
      .eq('action', 'agency_verification_recomputed')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw new Error(`activity_events: ${error.message}`)

    expect(data, 'le moteur doit journaliser un activity_events a chaque passage effectif').toHaveLength(1)
    const event = data![0] as Record<string, unknown>
    expect(event.category, 'category doit valoir kyc (jamais compliance, hors CHECK)').toBe('kyc')
    expect(event.actor_kind, 'c est le moteur qui agit, pas un humain').toBe('system')
    expect(event.actor_id, 'actor_kind=system impose actor_id NULL').toBeNull()
    expect(event.entity_type).toBe('agency')
    expect(event.entity_id).toBe(agencyId)
    expect((event.metadata as Record<string, unknown>)?.status).toBe(agency.verification_status)
  })

  it('la RPC est refusee a anon', async () => {
    const { error } = await anonClient().rpc('recompute_agency_verification', { p_agency_id: NIL_UUID })
    expect(error?.code).toBe(DENIED)
  })

  it('la RPC directe est refusee a authenticated (service_role en direct -- une deuxieme voie existe via admin_relaunch_agency_review, gardee is_super_admin, etape 5/tache 2)', async () => {
    const user = await signUpUser()
    const { error } = await user.client.rpc('recompute_agency_verification', { p_agency_id: NIL_UUID })
    expect(error?.code).toBe(DENIED)
  })
})
