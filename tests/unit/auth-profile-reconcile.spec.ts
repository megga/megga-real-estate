// Reconciliation d'une lecture de profil (useAuth.tsx) - decision pure et
// testable, meme motif que resolveIdentityGateStatus (useIdentityGate.ts).
//
// Contexte : incident "Agence non chargee" (onboarding KYB, 01.08.2026). Quand la
// lecture de `profiles` echouait ou depassait son plafond, fetchProfile renvoyait un
// profil SYNTHETISE depuis user_metadata - complet, d'apparence normale, mais avec
// `agency_id: null` par construction (le jeton ne connait pas l'agence). Ce profil
// ecrasait celui deja lu en base, et useAgencySettings/useAgencyIdentity levaient
// alors "Agence non chargee" au moment d'enregistrer, apres toute la saisie.
//
// Ce fichier pin les deux regles qui rendent cette classe de bug impossible :
// un profil synthetise ne remplace jamais un profil lu en base pour le MEME
// utilisateur, et il ne survit jamais a un changement de compte (garde anti-fuite).

import { describe, it, expect } from 'vitest'
import { reconcileProfile } from '@/hooks/useAuth'
import type { UserProfile } from '@/types/auth'

/** Profil tel que lu en base : il porte une agence. */
const loadedProfile: UserProfile = {
  id: 'user-1',
  email: 'dirigeant@agence.ch',
  full_name: 'Dirigeant Un',
  role: 'admin',
  avatar_url: null,
  phone: null,
  canton: 'GE',
  agency_id: 'agency-1',
  created_at: '2026-01-01T00:00:00Z',
}

/** Profil synthetise depuis user_metadata : jamais d'agence, par construction. */
const fallbackProfile: UserProfile = {
  ...loadedProfile,
  canton: null,
  agency_id: null,
}

describe('reconcileProfile', () => {
  it('accepte toujours une lecture reussie', () => {
    expect(reconcileProfile(null, { kind: 'loaded', profile: loadedProfile }, 'user-1'))
      .toEqual(loadedProfile)
  })

  it("n'ecrase JAMAIS un profil lu en base par un repli synthetise", () => {
    // Le coeur de l'incident : c'est ici que `agency_id` disparaissait en pleine saisie.
    const next = reconcileProfile(loadedProfile, { kind: 'fallback', profile: fallbackProfile }, 'user-1')
    expect(next).toEqual(loadedProfile)
    expect(next?.agency_id).toBe('agency-1')
  })

  it("n'ecrase JAMAIS un profil lu en base par une lecture indisponible", () => {
    const next = reconcileProfile(loadedProfile, { kind: 'unavailable' }, 'user-1')
    expect(next).toEqual(loadedProfile)
  })

  it('accepte le repli quand il n y a encore RIEN (premier login, trigger en cours)', () => {
    // Raison d'etre du repli : amorcer le routage. On ne le supprime pas, on le borne.
    expect(reconcileProfile(null, { kind: 'fallback', profile: fallbackProfile }, 'user-1'))
      .toEqual(fallbackProfile)
  })

  it('renvoie null quand il n y a rien et que la lecture est indisponible', () => {
    expect(reconcileProfile(null, { kind: 'unavailable' }, 'user-1')).toBeNull()
  })

  it('ne conserve JAMAIS le profil d un AUTRE utilisateur (garde anti-fuite)', () => {
    // Changement de compte : garder `prev` ferait porter au nouvel arrivant
    // l'agency_id du sortant, donc son tenant. Le repli est preferable.
    const next = reconcileProfile(loadedProfile, { kind: 'fallback', profile: { ...fallbackProfile, id: 'user-2' } }, 'user-2')
    expect(next?.id).toBe('user-2')
    expect(next?.agency_id).toBeNull()
  })

  it('ne conserve pas non plus le profil d un autre utilisateur quand la lecture echoue', () => {
    expect(reconcileProfile(loadedProfile, { kind: 'unavailable' }, 'user-2')).toBeNull()
  })
})
