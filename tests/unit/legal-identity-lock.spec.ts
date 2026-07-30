// Unitaire — resolveLegalIdentityLock (étape 7, tâche 3).
//
// Fonction pure testée hors React, même motif que resolveIdentityGateStatus et
// canActOnLabGuard : c'est une règle d'autorisation, elle mérite d'être lisible sans monter
// un arbre de composants.
//
// Ce qu'elle doit être : le MIROIR EXACT du garde serveur agencies_guard_identity_columns()
// (migration 20260730130000), y compris son ORDRE. Le garde teste le rôle d'abord, la
// soumission ensuite ; un écran qui inverserait les deux dirait à un employé d'agence soumise
// « attendez la fin de la vérification » alors que le serveur lui répondrait « ce n'est pas à
// vous de le faire ». Deux messages, deux gestes, et c'est le second qui est vrai.
//
// La sécurité reste en base. Ce que cette fonction garantit, c'est qu'un utilisateur ne
// saisisse pas dans un champ dont l'enregistrement sera refusé.

import { describe, it, expect } from 'vitest'
import { resolveLegalIdentityLock } from '@/hooks/useAgencySettings'

const SUBMITTED = '2026-07-29T08:00:00.000Z'

describe('resolveLegalIdentityLock', () => {
  it('un dirigeant dont le dossier n\'est pas soumis n\'est pas verrouillé — c\'est le wizard', () => {
    expect(resolveLegalIdentityLock({ role: 'admin', identitySubmittedAt: null })).toBeNull()
    expect(resolveLegalIdentityLock({ role: 'manager', identitySubmittedAt: null })).toBeNull()
  })

  it('un dirigeant dont le dossier est soumis est verrouillé pour cause de soumission', () => {
    expect(resolveLegalIdentityLock({ role: 'admin', identitySubmittedAt: SUBMITTED })).toBe('submitted')
    expect(resolveLegalIdentityLock({ role: 'manager', identitySubmittedAt: SUBMITTED })).toBe('submitted')
  })

  it('un agent simple est verrouillé pour cause de rôle, dossier soumis ou non', () => {
    expect(resolveLegalIdentityLock({ role: 'agent', identitySubmittedAt: null })).toBe('role')
    expect(resolveLegalIdentityLock({ role: 'agent', identitySubmittedAt: SUBMITTED })).toBe('role')
  })

  it('le rôle prime sur la soumission — même ordre que le garde serveur', () => {
    // C'est LA raison d'être de ce test : un agent simple d'une agence soumise doit lire
    // « ce n'est pas à vous de le faire », le premier refus qu'il rencontrerait côté serveur.
    expect(resolveLegalIdentityLock({ role: 'assistant', identitySubmittedAt: SUBMITTED })).toBe('role')
  })

  it('un rôle absent ou inconnu est verrouillé — fail-closed', () => {
    expect(resolveLegalIdentityLock({ role: null, identitySubmittedAt: null })).toBe('role')
    expect(resolveLegalIdentityLock({ role: undefined, identitySubmittedAt: null })).toBe('role')
    expect(resolveLegalIdentityLock({ role: 'super_admin', identitySubmittedAt: null })).toBe('role')
  })

  it('une chaîne vide en horodatage ne verrouille pas — elle ne prouve aucune soumission', () => {
    // PostgREST rend `null`, jamais `''`, mais un état local mal initialisé le pourrait :
    // traiter '' comme « soumis » gèlerait un wizard qui n'a rien soumis.
    expect(resolveLegalIdentityLock({ role: 'admin', identitySubmittedAt: '' })).toBeNull()
  })
})
