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
  rejectionReasonFromEvent,
  qualifyReviewReasons,
  queueRowSignal,
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
      { checkId: 'c1', checkType: 'registry_lookup', result: 'match', relatedPersonId: null },
    ])).toEqual([])
  })

  it('un id_document pending_manual_review -> retourné', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p1' },
    ])).toEqual([{ checkId: 'c1', relatedPersonId: 'p1' }])
  })

  it('un id_document déjà résolu (match/mismatch) -> ignoré, ce n est plus une action à faire', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'match', relatedPersonId: 'p1' },
    ])).toEqual([])
  })

  it('id_document pending mais sans personne rattachée (donnée incohérente) -> ignoré, jamais une action sans cible', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: null },
    ])).toEqual([])
  })

  it('plusieurs personnes en attente -> toutes retournées', () => {
    expect(pendingIdDocumentChecks([
      { checkId: 'c1', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p1' },
      { checkId: 'c2', checkType: 'id_document', result: 'pending_manual_review', relatedPersonId: 'p2' },
    ])).toEqual([{ checkId: 'c1', relatedPersonId: 'p1' }, { checkId: 'c2', relatedPersonId: 'p2' }])
  })
})

describe('rejectionReasonFromEvent — le motif de rejet vit dans activity_events.metadata, jamais une colonne (admin_reject_agency_review, 20260728160000)', () => {
  it('événement de rejet avec un motif texte -> le motif', () => {
    expect(rejectionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z',
      metadata: { previous_status: 'manual_review', reason: 'Raison sociale ne correspond pas au registre' },
    })).toBe('Raison sociale ne correspond pas au registre')
  })

  it('un autre type d événement -> null, même si metadata porte une clé reason par coïncidence', () => {
    expect(rejectionReasonFromEvent({
      id: 'e1', action: 'agency_verification_recomputed', createdAt: '2026-07-28T10:00:00Z',
      metadata: { reason: 'ne devrait jamais être lu' },
    })).toBeNull()
  })

  it('événement de rejet sans metadata -> null, jamais un crash', () => {
    expect(rejectionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z', metadata: null,
    })).toBeNull()
  })

  it('événement de rejet avec reason non-string -> null (donnée corrompue, jamais affichée telle quelle)', () => {
    expect(rejectionReasonFromEvent({
      id: 'e1', action: 'agency_verification_rejected', createdAt: '2026-07-28T10:00:00Z',
      metadata: { reason: 42 },
    })).toBeNull()
  })

  it('événement de rejet avec reason blanche -> null (même garde que btrim() côté RPC)', () => {
    expect(rejectionReasonFromEvent({
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

  function allAgencyVetosPassed(): ReviewCheck[] {
    return AGENCY_VETO_TYPES.map((v) => ({ checkType: v.checkType, result: 'match', isVeto: true, relatedPersonId: null }))
  }
  function allPersonVetosPassed(personId: string): ReviewCheck[] {
    return PERSON_VETO_TYPES.map((v) => ({ checkType: v.checkType, result: 'match', isVeto: true, relatedPersonId: personId }))
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
        { checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null },
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
        { checkType: 'registry_lookup', result: 'unavailable', isVeto: true, relatedPersonId: null },
        ...allPersonVetosPassed('p1'),
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'veto_missing_source' }])
  })

  it('cas C bis — véto absent car AUCUN connecteur câblé (aucune ligne du tout, pas même "unavailable") : le cas suisse dominant en pratique', () => {
    // registry_number_format et registry_country_match n'ont aucun connecteur
    // (agency-verification-run/_shared/kyb-sources.ts, AGENCY_KYB_SOURCES) : ils
    // n'apparaissent JAMAIS dans les checks retournés, contrairement à
    // registry_lookup/registry_legal_name_match qui produisent toujours une ligne
    // (au pire "unavailable").
    const reasons = qualifyReviewReasons({
      sweepAttempts: 0,
      score: 0.9,
      checks: [
        { checkType: 'registry_lookup', result: 'match', isVeto: true, relatedPersonId: null },
        { checkType: 'registry_legal_name_match', result: 'match', isVeto: true, relatedPersonId: null },
        // registry_number_format, registry_country_match : aucune ligne.
        ...allPersonVetosPassed('p1'),
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
        { checkType: 'pep_sanctions_screening', result: 'match', isVeto: true, relatedPersonId: 'p1' },
        { checkType: 'id_document', result: 'pending_manual_review', isVeto: true, relatedPersonId: 'p1' },
      ],
      currentVetoTypes: ALL_VETO_TYPES,
      activeSignatoryIds: ['p1'],
    })
    expect(reasons).toEqual([{ code: 'id_document_pending' }])
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
        { checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null },
        { checkType: 'id_document', result: 'pending_manual_review', isVeto: true, relatedPersonId: 'p1' },
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
        { checkType: 'registry_legal_name_match', result: 'mismatch', isVeto: true, relatedPersonId: null },
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
      checks: [{ checkType: 'registry_lookup', result: 'match', isVeto: true, relatedPersonId: null }],
      currentVetoTypes: [], // ni AGENCY_VETO_TYPES ni PERSON_VETO_TYPES connus pour l'instant
      activeSignatoryIds: ['p1'],
    })
    // Aucun type de véto connu -> rien à differ -> la fonction ne doit jamais inventer
    // un "véto absent" à partir d'un catalogue vide ; la vraie raison (score faible)
    // reste seule.
    expect(reasons).toEqual([{ code: 'low_score' }])
  })
})
