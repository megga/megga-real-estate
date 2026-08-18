// Tests de la logique pure de la vérification d'identité par Stripe Identity.
// Aucun réseau, aucune clé Stripe : `buildStripeIdentityRecord` reçoit sa date du jour
// en paramètre, comme tout ce chantier.

import { describe, it, expect } from 'vitest'
import {
  stripeDateToIso,
  mapStripeDocumentType,
  isStripeVerificationStatus,
  buildStripeIdentityRecord,
  knownErrorCode,
  requiresManualFallback,
  type StripeVerificationInput,
  resolvesIdDocumentCheck,
} from './kyb-identity-stripe.ts'

const DECLARED = { firstName: 'Grégory', lastName: 'Lyonnet', dateOfBirth: '1980-05-12' }

const VERIFIED: StripeVerificationInput = {
  sessionId: 'vs_test_123',
  status: 'verified',
  firstName: 'GREGORY',
  lastName: 'LYONNET',
  dob: { year: 1980, month: 5, day: 12 },
  documentType: 'passport',
  issuingCountry: 'CH',
  expirationDate: { year: 2030, month: 4, day: 17 },
}

describe('stripeDateToIso — trois entiers vers une date ISO', () => {
  it('date complète', () => {
    expect(stripeDateToIso({ year: 1980, month: 5, day: 12 })).toBe('1980-05-12')
  })

  it('rembourre le mois et le jour à deux chiffres', () => {
    expect(stripeDateToIso({ year: 2030, month: 1, day: 3 })).toBe('2030-01-03')
  })

  it('date partielle -> null : la compléter d\'un 1er janvier inventerait une donnée qu\'un dossier de conformité ne doit pas porter', () => {
    expect(stripeDateToIso({ year: 1980, month: 5 })).toBeNull()
    expect(stripeDateToIso({ year: 1980, month: null, day: 12 })).toBeNull()
    expect(stripeDateToIso({})).toBeNull()
  })

  it('absente ou hors bornes -> null', () => {
    expect(stripeDateToIso(null)).toBeNull()
    expect(stripeDateToIso(undefined)).toBeNull()
    expect(stripeDateToIso({ year: 1980, month: 13, day: 1 })).toBeNull()
    expect(stripeDateToIso({ year: 1980, month: 5, day: 0 })).toBeNull()
  })
})

describe('mapStripeDocumentType — vocabulaire Stripe vers le CHECK de la colonne', () => {
  it('passeport et carte d\'identité se transposent directement', () => {
    expect(mapStripeDocumentType('passport')).toBe('passport')
    expect(mapStripeDocumentType('id_card')).toBe('id_card')
  })

  it('permis de conduire -> `other` : le CHECK ne le connaît pas, et ce n\'est ni un passeport ni une carte', () => {
    expect(mapStripeDocumentType('driving_license')).toBe('other')
  })

  it('Stripe n\'émet JAMAIS residence_permit : cette valeur ne peut venir que du dépôt manuel', () => {
    expect(mapStripeDocumentType('residence_permit')).toBeNull()
  })

  it('absent ou inconnu -> null', () => {
    expect(mapStripeDocumentType(null)).toBeNull()
    expect(mapStripeDocumentType(undefined)).toBeNull()
    expect(mapStripeDocumentType('carte_grise')).toBeNull()
  })
})

describe('isStripeVerificationStatus — garde de la colonne de statut', () => {
  it('les quatre statuts de Stripe passent', () => {
    for (const s of ['requires_input', 'processing', 'verified', 'canceled']) {
      expect(isStripeVerificationStatus(s)).toBe(true)
    }
  })

  it('tout le reste est refusé', () => {
    expect(isStripeVerificationStatus('succeeded')).toBe(false)
    expect(isStripeVerificationStatus(null)).toBe(false)
    expect(isStripeVerificationStatus('')).toBe(false)
  })
})

describe('buildStripeIdentityRecord', () => {
  it('vérification concordante et document valable', () => {
    const r = buildStripeIdentityRecord(VERIFIED, DECLARED, '2026-08-03')
    expect(r.provider).toBe('stripe_identity')
    expect(r.status).toBe('verified')
    expect(r.verdict).toBe('match')
    expect(r.documentType).toBe('passport')
    expect(r.issuingCountry).toBe('CH')
    expect(r.expiresOn).toBe('2030-04-17')
    expect(r.expired).toBe(false)
    expect(r.errorCode).toBeNull()
  })

  it('même barème de comparaison que la lecture par modèle : accents et prénom composé', () => {
    // Le dirigeant ne doit pas obtenir deux verdicts différents selon le chemin qui a
    // lu sa pièce — c'est pourquoi compareName/compareBirthDate sont partagées.
    const r = buildStripeIdentityRecord(
      { ...VERIFIED, firstName: 'GREGORY JEAN' }, DECLARED, '2026-08-03',
    )
    expect(r.fields.firstName).toBe('approx')
    expect(r.verdict).toBe('partial')
  })

  it('document PÉRIMÉ : signalé à part, le verdict de concordance reste indépendant', () => {
    const r = buildStripeIdentityRecord(
      { ...VERIFIED, expirationDate: { year: 2024, month: 1, day: 31 } }, DECLARED, '2026-08-03',
    )
    expect(r.expired).toBe(true)
    expect(r.verdict).toBe('match')
  })

  it('le jour de l\'échéance compte encore comme valable', () => {
    const at = (d: string) => buildStripeIdentityRecord(
      { ...VERIFIED, expirationDate: { year: 2026, month: 8, day: Number(d) } }, DECLARED, '2026-08-03',
    ).expired
    expect(at('3')).toBe(false)
    expect(at('2')).toBe(true)
  })

  it('échéance illisible -> expired null, jamais false : ne pas savoir n\'est pas « valable »', () => {
    const r = buildStripeIdentityRecord({ ...VERIFIED, expirationDate: null }, DECLARED, '2026-08-03')
    expect(r.expiresOn).toBeNull()
    expect(r.expired).toBeNull()
  })

  it('session en attente de reprise : aucun verified_outputs, donc verdict `unreadable` et le code d\'erreur retenu', () => {
    const r = buildStripeIdentityRecord(
      { sessionId: 'vs_1', status: 'requires_input', errorCode: 'selfie_face_mismatch' },
      DECLARED, '2026-08-03',
    )
    expect(r.verdict).toBe('unreadable')
    expect(r.errorCode).toBe('selfie_face_mismatch')
    expect(r.expired).toBeNull()
  })

  it('pièce d\'une AUTRE personne -> mismatch : le cas que la vérification existe pour attraper', () => {
    const r = buildStripeIdentityRecord(
      { ...VERIFIED, firstName: 'JEAN', lastName: 'DUPONT', dob: { year: 1975, month: 11, day: 2 } },
      DECLARED, '2026-08-03',
    )
    expect(r.verdict).toBe('mismatch')
  })

  it('la ligne persistée ne contient AUCUNE donnée d\'identité : ni nom, ni prénom, ni date de naissance, ni numéro', () => {
    const serialized = JSON.stringify(buildStripeIdentityRecord(VERIFIED, DECLARED, '2026-08-03'))
    expect(serialized).not.toContain('LYONNET')
    expect(serialized).not.toContain('GREGORY')
    expect(serialized).not.toContain('1980-05-12')
  })
})

describe('knownErrorCode / requiresManualFallback', () => {
  it('un code connu passe tel quel', () => {
    expect(knownErrorCode('document_expired')).toBe('document_expired')
    expect(knownErrorCode('selfie_face_mismatch')).toBe('selfie_face_mismatch')
  })

  it('un code inconnu retombe sur `unknown` : jamais le code brut de Stripe à l\'écran', () => {
    expect(knownErrorCode('id_number_mismatch')).toBe('unknown')
    expect(knownErrorCode(null)).toBe('unknown')
    expect(knownErrorCode('')).toBe('unknown')
  })

  it('refus SANS RECOURS -> repli manuel : réessayer ne changerait rien, insister enfermerait l\'utilisateur dans une boucle', () => {
    expect(requiresManualFallback('country_not_supported')).toBe(true)
    expect(requiresManualFallback('under_supported_age')).toBe(true)
  })

  it('refus REPRENABLES -> pas de repli : une photo floue ou un selfie raté se refont', () => {
    // `consent_declined` est ici depuis le 04.08.2026, et c'est le point du correctif :
    // Stripe ne déclare aucun code TERMINAL (seul `canceled` l'est, et il vient de
    // l'intégrateur). Refuser le consentement est un geste rejouable — le classer
    // définitif retirait le bouton « Réessayer » à quelqu'un dont c'était justement le
    // geste à refaire.
    expect(requiresManualFallback('consent_declined')).toBe(false)
    expect(requiresManualFallback('document_unverified_other')).toBe(false)
    expect(requiresManualFallback('selfie_face_mismatch')).toBe(false)
    expect(requiresManualFallback('abandoned')).toBe(false)
    expect(requiresManualFallback(null)).toBe(false)
  })
})

/**
 * ⛔ CE BLOC GARDE LA SEULE PORTE QUI S'OUVRE AUTOMATIQUEMENT DANS LE KYB.
 *
 * `resolvesIdDocumentCheck` décide si la vérification du prestataire dispense d'une revue
 * humaine de la pièce. Introduite le 18.08.2026 pour une raison mesurée : les deux seules
 * agences ayant soumis portaient un score de 1.000 et restaient bloquées en
 * `manual_review` depuis 16 jours, parce que `submit_agency_identity()` pose toujours
 * `id_document / pending_manual_review` et que le moteur refuse d'auto-valider tant qu'un
 * check est en attente.
 *
 * La relâcher, c'est ouvrir le CRM complet — dossiers KYC et signatures — à une agence
 * dont l'identité du dirigeant n'a pas été confirmée. D'où un cas par façon de se tromper.
 */
describe('resolvesIdDocumentCheck', () => {
  it('verified + match résout, et c\'est le seul cas', () => {
    expect(resolvesIdDocumentCheck({ status: 'verified', verdict: 'match' })).toBe(true)
  })

  it('⚠ `partial` NE résout PAS', () => {
    // `partial` = un champ approximatif ou illisible (prénom composé partiellement
    // déclaré, date de naissance absente de la déclaration). C'est exactement le cas où
    // un œil humain apprend quelque chose : le relâcher viderait la revue de son contenu.
    expect(resolvesIdDocumentCheck({ status: 'verified', verdict: 'partial' })).toBe(false)
  })

  it('mismatch et unreadable ne résolvent pas', () => {
    expect(resolvesIdDocumentCheck({ status: 'verified', verdict: 'mismatch' })).toBe(false)
    expect(resolvesIdDocumentCheck({ status: 'verified', verdict: 'unreadable' })).toBe(false)
  })

  it('⛔ le STATUT seul ne suffit jamais', () => {
    // `verified` dit « document authentique, visage concordant » — jamais « le nom que
    // nous détenons est le bon ». C'est cet écart qui a produit un dossier vérifié au nom
    // d'un autre le 17.08.2026 (changement de nom légal).
    expect(resolvesIdDocumentCheck({ status: 'processing', verdict: 'match' })).toBe(false)
    expect(resolvesIdDocumentCheck({ status: 'requires_input', verdict: 'match' })).toBe(false)
    expect(resolvesIdDocumentCheck({ status: 'canceled', verdict: 'match' })).toBe(false)
  })
})
