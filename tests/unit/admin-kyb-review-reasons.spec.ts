// File de revue KYB, console admin (étape 5, tâche 3) — qualification pure, testée
// directement.
//
// Même motif que tests/unit/identity-shell-navigation.spec.ts : la page elle-même
// monte react-i18next/@tanstack/react-query/Supabase (non unit-testé ici, pas de
// rendu — ce dépôt n'a pas @testing-library/react), mais « pourquoi ce dossier
// est-il en revue » est une fonction pure exportée, testée directement. C'est le
// cœur de l'enjeu du brief : distinguer cinq situations qui n'appellent pas la
// même décision (score faible, véto échoué, véto absent faute de source, pièce
// d'identité en attente, dossier abandonné par le filet de rattrapage) plutôt que
// de les mettre dans le même sac.

import { describe, it, expect } from 'vitest'
import {
  SWEEP_MAX_ATTEMPTS,
  snakeToCamel,
  hasActiveSignatoryRole,
  activeSignatoryIds,
  checkRowTone,
  displayCheckWeight,
  pendingIdDocumentChecks,
  latestChecksByTypeAndPerson,
  decisionReasonFromEvent,
  qualifyReviewReasons,
  queueRowSignal,
  queuePagerView,
  type ReviewCheck,
  type CurrentVetoType,
} from '@/pages/admin/AdminKybReviewPage'

describe('queueRowSignal — triage AU NIVEAU LISTE, volontairement plus pauvre que qualifyReviewReasons (pas de checks à ce niveau)', () => {
  it('tentatives de relance à la borne -> "sweep_exhausted", quel que soit le score', () => {
    expect(queueRowSignal(0.9, SWEEP_MAX_ATTEMPTS)).toBe('sweep_exhausted')
    expect(queueRowSignal(null, SWEEP_MAX_ATTEMPTS)).toBe('sweep_exhausted')
  })

  it('score NULL, sweep sous la borne -> "score_unknown" (le cas le plus opaque)', () => {
    expect(queueRowSignal(null, 0)).toBe('score_unknown')
    expect(queueRowSignal(null, SWEEP_MAX_ATTEMPTS - 1)).toBe('score_unknown')
  })

  it('score connu, sweep sous la borne -> "score" (rien à deviner de plus à ce niveau)', () => {
    expect(queueRowSignal(0.42, 0)).toBe('score')
  })
})

describe('snakeToCamel — dérive la clé i18n d un check_type/source/result sans dictionnaire dupliqué', () => {
  it('snake_case simple -> camelCase', () => {
    expect(snakeToCamel('registry_lookup')).toBe('registryLookup')
    expect(snakeToCamel('id_document')).toBe('idDocument')
    expect(snakeToCamel('pending_manual_review')).toBe('pendingManualReview')
  })

  it('déjà sans underscore -> inchangé', () => {
    expect(snakeToCamel('match')).toBe('match')
    expect(snakeToCamel('mismatch')).toBe('mismatch')
  })

  it('plusieurs underscores consécutifs ou multiples -> chaque segment capitalisé', () => {
    expect(snakeToCamel('domain_trade_name_similarity')).toBe('domainTradeNameSimilarity')
  })
})

describe('hasActiveSignatoryRole — même règle que active_signatories (recompute_agency_verification, 20260728130000)', () => {
  const TODAY = '2026-07-28'

  it('aucun rôle -> pas de signataire actif', () => {
    expect(hasActiveSignatoryRole([], TODAY)).toBe(false)
  })

  it('signataire à valid_to NULL (mandat en cours, sans terme) -> actif', () => {
    expect(hasActiveSignatoryRole([{ role: 'signatory', validTo: null }], TODAY)).toBe(true)
  })

  it('signataire à valid_to strictement futur -> actif', () => {
    expect(hasActiveSignatoryRole([{ role: 'signatory', validTo: '2026-08-01' }], TODAY)).toBe(true)
  })

  it('signataire à valid_to strictement passé -> radié, pas actif', () => {
    expect(hasActiveSignatoryRole([{ role: 'signatory', validTo: '2026-01-01' }], TODAY)).toBe(false)
  })

  it('valid_to == aujourd hui -> pas actif (SQL : valid_to > current_date, strict)', () => {
    expect(hasActiveSignatoryRole([{ role: 'signatory', validTo: TODAY }], TODAY)).toBe(false)
  })

  it('seulement un rôle ubo (pas signatory) -> pas de signataire actif', () => {
    expect(hasActiveSignatoryRole([{ role: 'ubo', validTo: null }], TODAY)).toBe(false)
  })

  it('un rôle ubo actif + un rôle signatory radié -> toujours pas actif (le rôle qui compte doit lui-même être actif)', () => {
    expect(hasActiveSignatoryRole([{ role: 'ubo', validTo: null }, { role: 'signatory', validTo: '2020-01-01' }], TODAY)).toBe(false)
  })
})

describe('activeSignatoryIds — ids des personnes qui comptent pour le moteur (mêmes signataires actifs)', () => {
  const TODAY = '2026-07-28'

  it('liste vide -> liste vide', () => {
    expect(activeSignatoryIds([], TODAY)).toEqual([])
  })

  it('ne retient que les personnes avec un rôle signatory actif', () => {
    const persons = [
      { id: 'p1', roles: [{ role: 'signatory' as const, validTo: null }] },
      { id: 'p2', roles: [{ role: 'ubo' as const, validTo: null }] },
      { id: 'p3', roles: [{ role: 'signatory' as const, validTo: '2020-01-01' }] },
      { id: 'p4', roles: [{ role: 'signatory' as const, validTo: '2027-01-01' }] },
    ]
    expect(activeSignatoryIds(persons, TODAY)).toEqual(['p1', 'p4'])
  })
})

describe('checkRowTone — teinte d une ligne de check individuelle (table brute)', () => {
  it('match -> positive, quel que soit is_veto', () => {
    expect(checkRowTone('match', true)).toBe('positive')
    expect(checkRowTone('match', false)).toBe('positive')
    expect(checkRowTone('match', null)).toBe('positive')
  })

  it('mismatch -> negative', () => {
    expect(checkRowTone('mismatch', true)).toBe('negative')
    expect(checkRowTone('mismatch', false)).toBe('negative')
  })

  it('partial sur un véto -> negative (seul match passe un véto)', () => {
    expect(checkRowTone('partial', true)).toBe('negative')
  })

  it('partial sur un signal pondéré (pas un véto) -> neutral (demi-crédit, pas alarmant)', () => {
    expect(checkRowTone('partial', false)).toBe('neutral')
  })

  it('unavailable -> neutral (exclu du calcul, ni pénalisé ni crédité)', () => {
    expect(checkRowTone('unavailable', true)).toBe('neutral')
    expect(checkRowTone('unavailable', false)).toBe('neutral')
  })

  it('pending_manual_review -> pending (ni pass ni fail, en attente de relecture)', () => {
    expect(checkRowTone('pending_manual_review', true)).toBe('pending')
  })
})

describe('displayCheckWeight — un véto est HORS SCORE, jamais un poids à 0.00 qui se lirait comme "n a pesé pour rien"', () => {
  it('véto -> "veto", quel que soit le poids porté', () => {
    expect(displayCheckWeight(0, true)).toBe('veto')
    expect(displayCheckWeight(null, true)).toBe('veto')
  })

  it('signal pondéré avec un poids connu -> le nombre tel quel', () => {
    expect(displayCheckWeight(3, false)).toBe(3)
    expect(displayCheckWeight(0.75, false)).toBe(0.75)
  })

  it('signal pondéré sans ligne de config retrouvée (LEFT JOIN vide) -> "unknown", jamais un poids inventé', () => {
    expect(displayCheckWeight(null, false)).toBe('unknown')
  })
})

describe('pendingIdDocumentChecks — pièce(s) d identité en attente de relecture (action "résoudre")', () => {
  it('aucun check id_document -> liste vide', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'registry_lookup', result: 'match', relatedPersonId: null, checkedAt: '2026-07-28T10:00:00Z' },
    ])).toEqual([])
  })

  it('un id_document pending_manual_review -> retourné', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' },
    ])).toEqual([{ checkId: 'c1', relatedPersonId: 'p1' }])
  })

  // Revue étape 5/tâche 3, point 1 (CRITIQUE) : ce test donnait une fausse confiance en
  // ne construisant qu'UNE ligne résolue. En réalité, les tables de checks sont
  // append-only (agency_person_verification_checks, 20260728103000) : résoudre une pièce
  // (admin_resolve_agency_id_document) INSÈRE une nouvelle ligne, elle ne remplace ni
  // ne supprime jamais l'ancienne "pending_manual_review". Un dossier réellement résolu
  // porte donc TOUJOURS les deux lignes en historique, celle-ci le reproduit, dans
  // l'ordre où get_admin_agency_review_detail les rend (checked_at desc : la plus
  // récente en tête, comme dans checks.data côté hook).
  it('un id_document déjà résolu (match/mismatch) -> ignoré même si l ancienne ligne pending_manual_review reste dans l historique (append-only : résoudre INSÈRE, ne remplace jamais)', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c2', checkType: 'id_document', result: 'match', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' },
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p1', checkedAt: '2026-07-20T09:00:00Z' },
    ])).toEqual([])
  })

  it('id_document pending mais sans personne rattachée (donnée incohérente) -> ignoré, jamais une action sans cible', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: null, checkedAt: '2026-07-28T10:00:00Z' },
    ])).toEqual([])
  })

  it('plusieurs personnes en attente -> toutes retournées', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' },
      { checkId: 'c2', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p2', checkedAt: '2026-07-28T10:00:00Z' },
    ])).toEqual([{ checkId: 'c1', relatedPersonId: 'p1' }, { checkId: 'c2', relatedPersonId: 'p2' }])
  })
})

describe('latestChecksByTypeAndPerson — même dédoublonnage que les CTE latest_agency_checks/latest_person_checks du moteur (append-only : la ligne la plus récente par couple type+personne l emporte)', () => {
  it('aucune ligne -> aucune ligne', () => {
    expect(latestChecksByTypeAndPerson([])).toEqual([])
  })

  it('pas de doublon (types/personnes tous distincts) -> tout ressort, inchangé', () => {
    const rows = [
      { checkId: 'c1', checkType: 'registry_lookup', relatedPersonId: null, checkedAt: '2026-07-28T10:00:00Z' },
      { checkId: 'c2', checkType: 'id_document', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' },
    ]
    expect(latestChecksByTypeAndPerson(rows)).toEqual(rows)
  })

  it('deux lignes du même couple (type, personne) -> seule la plus récente (checked_at) survit, quel que soit l ordre du tableau reçu', () => {
    const older = { checkId: 'c1', checkType: 'id_document', relatedPersonId: 'p1', checkedAt: '2026-07-20T09:00:00Z' }
    const newer = { checkId: 'c2', checkType: 'id_document', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' }
    // Ordre "réaliste" (celui de get_admin_agency_review_detail : checked_at desc) ET
    // ordre inverse doivent produire le même résultat -- la fonction ne doit JAMAIS
    // supposer un tableau pré-trié.
    expect(latestChecksByTypeAndPerson([newer, older])).toEqual([newer])
    expect(latestChecksByTypeAndPerson([older, newer])).toEqual([newer])
  })

  it('même couple (type, personne), mais des personnes différentes -> pas de collision entre elles', () => {
    const p1Doc = { checkId: 'c1', checkType: 'id_document', relatedPersonId: 'p1', checkedAt: '2026-07-28T10:00:00Z' }
    const p2Doc = { checkId: 'c2', checkType: 'id_document', relatedPersonId: 'p2', checkedAt: '2026-07-28T10:00:00Z' }
    expect(latestChecksByTypeAndPerson([p1Doc, p2Doc])).toEqual([p1Doc, p2Doc])
  })

  it('checked_at identique (même transaction, ex. rejeu d un connecteur) -> départage par checkId, jamais un choix arbitraire', () => {
    const rows = [
      { checkId: 'c1', checkType: 'registry_lookup', relatedPersonId: null, checkedAt: '2026-07-28T10:00:00Z' },
      { checkId: 'c2', checkType: 'registry_lookup', relatedPersonId: null, checkedAt: '2026-07-28T10:00:00Z' },
    ]
    expect(latestChecksByTypeAndPerson(rows)).toEqual([rows[1]])
  })
})

describe('decisionReasonFromEvent — le motif d une decision motivee vit dans activity_events.metadata, jamais une colonne (admin_reject_agency_review et admin_request_agency_correction)', () => {
  it('événement de rejet avec un motif texte -> le motif', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z',
      metadata: { previous_status: 'manual_review', reason: 'Raison sociale ne correspond pas au registre' },
    })).toBe('Raison sociale ne correspond pas au registre')
  })

  it('événement de DEMANDE DE CORRECTION avec un motif -> le motif (étape 7, tâche 5)', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_correction_requested', createdAt: '2026-07-30T10:00:00Z',
      metadata: { previous_status: 'manual_review', reason: 'Le numéro de registre comporte un chiffre de trop' },
    })).toBe('Le numéro de registre comporte un chiffre de trop')
  })

  it('un autre type d événement -> null, même si metadata porte une clé reason par coïncidence', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_recomputed', createdAt: '2026-07-28T10:00:00Z',
      metadata: { reason: 'ne devrait jamais être lu' },
    })).toBeNull()
  })

  it('événement de rejet sans metadata -> null, jamais un crash', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z', metadata: null,
    })).toBeNull()
  })

  it('événement de rejet avec reason non-string -> null (donnée corrompue, jamais affichée telle quelle)', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z',
      metadata: { reason: 42 },
    })).toBeNull()
  })

  it('événement de rejet avec reason blanche -> null (même garde que btrim() côté RPC)', () => {
    expect(decisionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z',
      metadata: { reason: '   ' },
    })).toBeNull()
  })
})

describe('qualifyReviewReasons — le cœur du brief : pourquoi CE dossier est en revue, cinq situations distinctes', () => {
  const NO_VETO_TYPES: CurrentVetoType[] = []
  const AGENCY_VETO_TYPES: CurrentVetoType[] = [
    { checkType: 'registry_number_format', scope: 'agency' },
    { checkType: 'registry_lookup', scope: 'agency' },
    { checkType: 'registry_legal_name_match', scope: 'agency' },
    { checkType: 'registry_country_match', scope: 'agency' },
  ]
  const PERSON_VETO_TYPES: CurrentVetoType[] = [
    { checkType: 'pep_sanctions_screening', scope: 'person' },
    { checkType: 'id_document', scope: 'person' },
  ]
  const ALL_VETO_TYPES = [...AGENCY_VETO_TYPES, ...PERSON_VETO_TYPES]

  // checkId/checkedAt (nécessaires au dédoublonnage append-only, latestChecksByTypeAndPerson)
  // : une date de référence commune pour tous les checks "passés" par défaut, largement
  // antérieure à la date utilisée par les scénarios de résolution ci-dessous (2026-07-28).
  const BASELINE_CHECKED_AT = '2026-07-20T08:00:00Z'

  function allAgencyVetosPassed(): ReviewCheck[] {
    return AGENCY_VETO_TYPES.map((v, i) => ({
      checkId: `agency-veto-${i}`, checkType: v.checkType, result: 'match', isVeto: true, relatedPersonId: null,
      checkedAt: BASELINE_CHECKED_AT,
    }))
  }
  function allPersonVetosPassed(personId: string): ReviewCheck[] {
    return PERSON_VETO_TYPES.map((v, i) => ({
      checkId: `${personId}-veto-${i}`, checkType: v.checkType, result: 'match', isVeto: true, relatedPersonId: personId,
      checkedAt: BASELINE_CHECKED_AT,
    }))
  }

  it('cas A — score faible, aucun véto en cause : signaux défavorables, pas une contradiction', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.32,
      checks: [...allAgencyVetosPassed(), ...allPersonVetosPassed('p1')],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'low_score' }])
  })

  it('cas B — véto ÉCHOUÉ : ce que l agence déclare contredit une source (mismatch)', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed().filter((c) => c.checkType !== 'registry_legal_name_match'),
        {
          checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null,
          checkId: 'agency-veto-mismatch', checkedAt: BASELINE_CHECKED_AT,
        },
        ...allPersonVetosPassed('p1'),
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_failed' }])
  })

  // Revue étape 5/tâche 3, point 3 (branche 1) : seul le cas `mismatch` était testé
  // ci-dessus pour déclencher "véto échoué". `partial` échoue pourtant un véto au même
  // titre (checkRowTone le documente déjà : seul `match` passe un véto) -- sans ce test,
  // une régression sur `hasFailedVeto` qui n'accepterait plus que `mismatch` passerait
  // inaperçue.
  it('cas B bis — véto échoué via un résultat PARTIAL, pas seulement mismatch (seul match passe un véto)', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed().filter((c) => c.checkType !== 'registry_legal_name_match'),
        {
          checkType: 'registry_legal_name_match', result: 'partial', isVeto: true, relatedPersonId: null,
          checkId: 'agency-veto-partial', checkedAt: BASELINE_CHECKED_AT,
        },
        ...allPersonVetosPassed('p1'),
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_failed' }])
  })

  it('cas C — véto ABSENT faute de source (result=unavailable) : pas la même chose qu un échec', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed().filter((c) => c.checkType !== 'registry_lookup'),
        {
          checkType: 'registry_lookup', result: 'unavailable', isVeto: true, relatedPersonId: null,
          checkId: 'agency-veto-unavailable', checkedAt: BASELINE_CHECKED_AT,
        },
        ...allPersonVetosPassed('p1'),
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_missing_source' }])
  })

  it('cas C bis — véto absent car AUCUNE source applicable (aucune ligne du tout, pas même "unavailable") : ce que produit une juridiction hors CH/FR', () => {
    // Ce commentaire a été deux fois périmé par le chantier LINDAS, et deux fois pour la
    // même raison : les vétos d'entité y ont gagné des propriétaires. registry_number_format
    // a le sien depuis la tâche 1 (un calcul de clé de contrôle, source `internal`, sans
    // juridiction déclarée : il produit TOUJOURS une ligne, au pire "unavailable") ;
    // registry_country_match en a DEUX depuis les tâches 2 et 3 (`zefix` pour un siège
    // suisse, `recherche_entreprises` pour un siège français). Aucun des deux n'est donc
    // encore "sans connecteur", et le cas suisse n'est plus celui que cette fixture décrit.
    // Ce qui produit aujourd'hui l'absence TOTALE de ligne, c'est un siège hors CH/FR : les
    // trois sources de registre déclarent leur juridiction (`appliesTo`) et sont écartées
    // avant exécution, donc sans laisser de ligne. La fixture ci-dessous garde deux vétos
    // absents : c'est la forme d'entrée que cette fonction doit savoir qualifier, pas un
    // inventaire du registre.
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        { checkType: 'registry_lookup', result: 'match', isVeto: true, relatedPersonId: null, checkId: 'agency-veto-a', checkedAt: BASELINE_CHECKED_AT },
        { checkType: 'registry_legal_name_match', result: 'match', isVeto: true, relatedPersonId: null, checkId: 'agency-veto-b', checkedAt: BASELINE_CHECKED_AT },
        // registry_number_format, registry_country_match : aucune ligne.
        ...allPersonVetosPassed('p1'),
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_missing_source' }])
  })

  // Revue étape 5/tâche 3, point 3 (branche 2) : les tests existants donnaient soit tous
  // les vétos personne présents (cas D, "aucun signataire actif" ci-dessous), soit
  // activeSignatoryIds vide (auquel cas le .some() de hasMissingPersonVeto est
  // trivialement faux, quel que soit son corps) -- aucun des deux ne peut prouver que la
  // condition détecte correctement un véto personne VRAIMENT absent. Ici p1 EST un
  // signataire actif, et id_document n'a JAMAIS produit la moindre ligne pour lui (pas
  // même "unavailable" comme au cas C : la source ne s'est même pas exprimée).
  it('cas C ter — véto personne TOTALEMENT absent (aucune ligne, pas même "unavailable") pour un signataire actif', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed(),
        { checkType: 'pep_sanctions_screening', result: 'match', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-pep', checkedAt: BASELINE_CHECKED_AT },
        // id_document : aucune ligne du tout pour p1.
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_missing_source' }])
  })

  it('cas D — pièce d identité en attente de relecture (pending_manual_review), distinct d un échec', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed(),
        { checkType: 'pep_sanctions_screening', result: 'match', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-pep', checkedAt: BASELINE_CHECKED_AT },
        { checkType: 'id_document', result: 'pending_manual_review', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-id', checkedAt: BASELINE_CHECKED_AT },
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'id_document_pending' }])
  })

  // Revue étape 5/tâche 3, point 1 (CRITIQUE, prouvé par sonde) : les tables de checks
  // sont append-only (agency_person_verification_checks, 20260728103000) -- résoudre une
  // pièce (admin_resolve_agency_id_document) INSÈRE une ligne, elle ne remplace ni ne
  // supprime jamais l'ancienne "pending_manual_review". Sans dédoublonnage à la ligne la
  // plus récente par couple (type, personne) -- même règle que les CTE
  // latest_agency_checks/latest_person_checks du moteur, recompute_agency_verification
  // 20260728130000 -- l'écran affichait simultanément "véto échoué" (correct, ligne
  // récente) ET "pièce d'identité en attente" (obsolète, ligne ancienne) : exactement la
  // confusion de catégories que cet écran existe pour éviter, et un très mauvais signal
  // pour un relecteur pressé. Ordre du tableau volontairement "réaliste" (checked_at
  // desc, comme le rend get_admin_agency_review_detail : la ligne la plus récente en
  // tête de checks.data).
  it('cas D bis — historique append-only : une résolution récente en mismatch efface la pièce en attente du même type/personne, jamais les deux motifs à la fois', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        ...allAgencyVetosPassed(),
        { checkType: 'pep_sanctions_screening', result: 'match', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-pep', checkedAt: BASELINE_CHECKED_AT },
        // Ligne la plus récente : la résolution humaine, en mismatch.
        { checkType: 'id_document', result: 'mismatch', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-id-new', checkedAt: '2026-07-28T10:00:00Z' },
        // Ancienne ligne : jamais remplacée ni supprimée (append-only). Doit être
        // ignorée au profit de la ligne ci-dessus, plus récente, pour LE MÊME couple
        // (id_document, p1).
        { checkType: 'id_document', result: 'pending_manual_review', isVeto: true, relatedPersonId: 'p1', checkId: 'p1-id-old', checkedAt: '2026-07-20T08:05:00Z' },
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_failed' }])
  })

  it('cas E — dossier abandonné par le filet de rattrapage (sweep épuisé) : aucun check, score NULL', () => {
    // identity_submitted_at posé (précondition pour atteindre cette file, cf. garde
    // "signataire actif" de submit_agency_identity) -> un signataire actif existait
    // déjà à la soumission, même si le moteur n'a lui-même jamais tourné. Un
    // catalogue de vétos non vide (ALL_VETO_TYPES) ne doit RIEN changer : sans le
    // moindre check, aucun véto ne peut être qualifié d'échoué ou d'absent-faute-de-
    // source, ce récit appartient tout entier à sweep_exhausted.
    const reasons = qualifyReviewReasons({
      sweepAttempts: SWEEP_MAX_ATTEMPTS,
      score: null,
      checks: [],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'sweep_exhausted' }])
  })

  it('sweep attempts sous la borne (4 < 5) : PAS "abandonné" — la vraie raison (score faible) reste visible', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 4,
      score: 0.3,
      checks: [...allAgencyVetosPassed(), ...allPersonVetosPassed('p1')],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'low_score' }])
  })

  it('aucun signataire actif identifié : raison distincte, jamais confondue avec un score faible', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: allAgencyVetosPassed(),
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: [],
    })
    expect(reasons).toEqual([{ code: 'no_active_signatory' }])
  })

  it('plusieurs raisons simultanées : ordre de priorité stable (le plus actionnable en tête)', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: SWEEP_MAX_ATTEMPTS,
      score: 0.2,
      checks: [
        { checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null, checkId: 'c1', checkedAt: BASELINE_CHECKED_AT },
        { checkType: 'id_document', result: 'pending_manual_review', isVeto: true, relatedPersonId: 'p1', checkId: 'c2', checkedAt: BASELINE_CHECKED_AT },
      ],
      currentVetoTypes: NO_VETO_TYPES, // catalogue pas chargé -> ne doit rien casser
      activeSignatoryIds: [],
    })
    expect(reasons.map((r) => r.code)).toEqual([
      'veto_failed', 'id_document_pending', 'no_active_signatory', 'sweep_exhausted',
    ])
  })

  it('score NULL alors qu une autre raison dure est déjà présente : signalé quand même (le plus opaque, pas le moins urgent)', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: null,
      checks: [
        { checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null, checkId: 'c1', checkedAt: BASELINE_CHECKED_AT },
      ],
      currentVetoTypes: NO_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons.map((r) => r.code)).toEqual(['veto_failed', 'low_score'])
  })

  it('score NULL déjà expliqué par le sweep épuisé : "low_score" n ajoute rien, pur bruit', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: SWEEP_MAX_ATTEMPTS,
      score: null,
      checks: [],
      currentVetoTypes: NO_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'sweep_exhausted' }])
  })

  it('catalogue de vétos vide (pas encore chargé) : dégrade proprement, jamais de faux "véto absent"', () => {
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.3,
      checks: [{ checkType: 'registry_lookup', result: 'match', isVeto: true, relatedPersonId: null, checkId: 'c1', checkedAt: BASELINE_CHECKED_AT }],
      currentVetoTypes: [], // ni AGENCY_VETO_TYPES ni PERSON_VETO_TYPES connus pour l'instant
      activeSignatoryIds: ['p1'],
    })
    // Aucun type de véto connu -> rien à differ -> la fonction ne doit jamais inventer
    // un "véto absent" à partir d'un catalogue vide ; la vraie raison (score faible)
    // reste seule.
    expect(reasons).toEqual([{ code: 'low_score' }])
  })
})

// ─── Pagination de la file (correctif revue étape 6) ────────────────────────────
//
// Avant ce correctif, la RPC ne portait aucun limit : PostgREST coupait la réponse à
// max_rows (1000) EN SILENCE, et comme la file est triée par score croissant, les
// dossiers les MIEUX notés tombaient hors de la fenêtre — invisibles, donc jamais
// tranchés. L'arithmétique ci-dessous porte la contrepartie visible de la correction :
// dire au relecteur où il en est ET combien il reste. Une erreur ici redonnerait la
// même maladie (se croire au bout d'une file qui continue), d'où ces cas.
describe('queuePagerView — la fenêtre affichée et ce qu\'il reste derrière', () => {
  const SIZE = 50

  it('première page d\'une file plus longue : annonce la suite', () => {
    const v = queuePagerView(0, 50, 1448, SIZE)
    expect(v.page).toBe(0)
    expect(v.pageCount).toBe(29) // ceil(1448 / 50)
    expect(v.rangeStart).toBe(1)
    expect(v.rangeEnd).toBe(50)
    expect(v.hasPrev).toBe(false)
    expect(v.hasNext, 'il reste 1398 dossiers derrière : le pas suivant doit exister').toBe(true)
  })

  it('dernière page partielle : ferme la file, sans promettre une page de plus', () => {
    // 1448 dossiers, pages de 50 -> la 29e (index 28) ne porte que 48 lignes.
    const v = queuePagerView(1400, 48, 1448, SIZE)
    expect(v.page).toBe(28)
    expect(v.rangeStart).toBe(1401)
    expect(v.rangeEnd).toBe(1448)
    expect(v.hasNext, 'aucun dossier au-delà : proposer une page suivante mentirait').toBe(false)
    expect(v.hasPrev).toBe(true)
  })

  it('file tenant sur une seule page : le relecteur doit pouvoir lire qu\'il a tout vu', () => {
    const v = queuePagerView(0, 12, 12, SIZE)
    expect(v).toEqual({ page: 0, pageCount: 1, rangeStart: 1, rangeEnd: 12, hasPrev: false, hasNext: false })
  })

  it('file vide : aucun rang inventé (jamais « 1-0 sur 0 »)', () => {
    const v = queuePagerView(0, 0, 0, SIZE)
    expect(v.rangeStart).toBe(0)
    expect(v.rangeEnd).toBe(0)
    expect(v.pageCount).toBe(1)
    expect(v.hasPrev).toBe(false)
    expect(v.hasNext).toBe(false)
  })

  // Le cas qui a fait retirer un useEffect correcteur au profit d'un repli côté hook :
  // trancher les derniers dossiers de la dernière page la vide sous le relecteur. Le
  // hook sert alors la dernière page RÉELLE, et la numérotation suit ce décalage-là.
  it('numérote d\'après le décalage réellement servi, pas celui demandé', () => {
    // Le relecteur avait demandé la page 4 (offset 150) ; la file a fondu à 120
    // dossiers, le hook a servi l'offset 100.
    const v = queuePagerView(100, 20, 120, SIZE)
    expect(v.page, 'la page affichée est celle qui a vraiment été servie').toBe(2)
    expect(v.pageCount).toBe(3)
    expect(v.rangeStart).toBe(101)
    expect(v.rangeEnd).toBe(120)
    expect(v.hasNext).toBe(false)
  })

  it('taille de page qui ne divise pas le total : compte la page entamée', () => {
    expect(queuePagerView(0, 50, 51, SIZE).pageCount, 'ceil, jamais floor -- sinon le 51e dossier n\'a aucune page').toBe(2)
    expect(queuePagerView(0, 50, 100, SIZE).pageCount).toBe(2)
    expect(queuePagerView(0, 1, 1, SIZE).pageCount).toBe(1)
  })
})
