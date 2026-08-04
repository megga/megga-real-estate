// L'ATTENTE du verdict de vérification — quand elle s'arrête, et sur quoi.
//
// Le verdict n'arrive jamais par la réponse à l'onglet : Stripe redirige dès la capture
// terminée, et c'est le webhook qui écrit la colonne, quelques secondes plus tard. Le
// wizard relit donc la personne en boucle courte pendant une fenêtre bornée, et s'arrête
// dès que le verdict est là.
//
// Tout tient à une distinction que le typage ne fait pas : `requires_input` désigne À LA
// FOIS la session jamais commencée et la session REFUSÉE (Stripe y ajoute alors
// `last_error`). Confondre les deux casse l'attente dans les deux sens — sans le motif,
// une attente trouverait son état de départ déjà « arrivé » et s'arrêterait avant d'avoir
// servi ; avec un motif ignoré, elle relirait indéfiniment un refus déjà tranché.

import { describe, it, expect } from 'vitest'
import {
  identityVerdictArrived,
  signatoryVerdictArrived,
  findSignatory,
  IDENTITY_VERDICT_POLL_MS,
  type IdentityPersonWithRoles,
} from '@/hooks/useAgencyIdentity'

/** Une personne minimale, façonnée par rôle et par état de vérification. */
function personne(over: Partial<IdentityPersonWithRoles> = {}): IdentityPersonWithRoles {
  return {
    id: 'p1',
    firstName: 'Gregory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-04',
    nationality: 'CH',
    roles: [{ role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false }],
    idDocumentType: null,
    idDocumentRead: null,
    verificationStatus: null,
    verificationErrorCode: null,
    verifiedAt: null,
    ...over,
  }
}

describe('identityVerdictArrived — le verdict est-il tombé ?', () => {
  it('`verified` est un verdict : plus rien à attendre', () => {
    expect(identityVerdictArrived('verified', null)).toBe(true)
  })

  it('`canceled` est un verdict : la session est close, la relire n\'apprendra rien', () => {
    expect(identityVerdictArrived('canceled', null)).toBe(true)
  })

  it('`processing` n\'en est pas un — c\'est exactement ce qu\'on attend', () => {
    // Le cas du retour : Stripe a la capture, le webhook n'a pas encore écrit. Arrêter
    // ici laisserait l'écran figé sur « Vérification en cours » jusqu'à un rechargement
    // manuel — donc, en pratique, jusqu'à ce que le dirigeant conclue qu'il ne s'est
    // rien passé.
    expect(identityVerdictArrived('processing', null)).toBe(false)
  })

  it('`requires_input` SANS motif est l\'état de départ, pas un verdict', () => {
    // Une session jamais ouverte. La compter comme arrivée couperait l'attente à
    // l'instant même où elle commence.
    expect(identityVerdictArrived('requires_input', null)).toBe(false)
  })

  it('`requires_input` AVEC motif est un refus — donc un verdict', () => {
    expect(identityVerdictArrived('requires_input', 'selfie_face_mismatch')).toBe(true)
    expect(identityVerdictArrived('requires_input', 'consent_declined')).toBe(true)
  })

  it('aucune vérification jamais lancée : rien n\'est arrivé', () => {
    expect(identityVerdictArrived(null, null)).toBe(false)
  })
})

describe('findSignatory — UNE seule définition du signataire courant', () => {
  it('rend la personne qui porte le rôle signatory', () => {
    const ubo = personne({ id: 'u1', roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 30, pepSelfDeclared: false }] })
    const signataire = personne({ id: 's1' })
    expect(findSignatory([ubo, signataire])?.id).toBe('s1')
  })

  it('rend null sur une liste vide ou sans signataire', () => {
    expect(findSignatory([])).toBeNull()
    const ubo = personne({ roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 30, pepSelfDeclared: false }] })
    expect(findSignatory([ubo])).toBeNull()
  })

  it('rend le PREMIER quand plusieurs signataires sont actifs (signature_power=joint)', () => {
    const a = personne({ id: 'a' })
    const b = personne({ id: 'b' })
    expect(findSignatory([a, b])?.id).toBe('a')
  })
})

describe('signatoryVerdictArrived — la règle telle que la boucle de relecture la lit', () => {
  it('une liste NON CHARGÉE ne conclut rien', () => {
    // `undefined` = la query n'a pas encore répondu. Conclure « arrivé » arrêterait la
    // relecture avant le premier aller-retour réseau.
    expect(signatoryVerdictArrived(undefined)).toBe(false)
  })

  it('une liste sans signataire ne conclut rien non plus', () => {
    expect(signatoryVerdictArrived([])).toBe(false)
  })

  it('suit le verdict du signataire, pas celui d\'une autre personne du dossier', () => {
    const uboVerifie = personne({
      id: 'u1',
      roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 30, pepSelfDeclared: false }],
      verificationStatus: 'verified',
    })
    const signataireEnCours = personne({ id: 's1', verificationStatus: 'processing' })
    expect(signatoryVerdictArrived([uboVerifie, signataireEnCours])).toBe(false)
  })

  it('s\'arrête dès que le signataire est vérifié', () => {
    expect(signatoryVerdictArrived([personne({ verificationStatus: 'verified' })])).toBe(true)
  })
})

describe('cadence de relecture', () => {
  it('reste dans un ordre de grandeur tenable pour PostgREST', () => {
    // Ni du martèlement (sous la seconde), ni une cadence qui rendrait l'attente
    // indiscernable d'un écran figé. La borne HAUTE de la fenêtre vit dans
    // IdentityShell (IDENTITY_VERDICT_WINDOW_MS) ; ici on ne garde que le pas.
    expect(IDENTITY_VERDICT_POLL_MS).toBeGreaterThanOrEqual(2_000)
    expect(IDENTITY_VERDICT_POLL_MS).toBeLessThanOrEqual(10_000)
  })
})
