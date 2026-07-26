/**
 * Aiguillage post-connexion (`/auth/callback`).
 *
 * Le piège que ces tests verrouillent : `AGENT_ROLES` décrit des rôles
 * d'AGENCE, et `super_admin` n'en fait pas partie — c'est un rôle de plateforme,
 * `agency_id` NULL. Il retombait donc sur la branche par défaut `/portal`, qui
 * depuis le retrait du portail vendeur (26 juil. 2026) renvoie hors de l'app
 * vers la vitrine. Résultat : connexion réussie, écran de chargement, puis
 * éjection silencieuse — les deux comptes super_admin ne pouvaient plus entrer
 * dans le CRM.
 *
 * Le test existe parce que le correctif est un `|| role === 'super_admin'` qui
 * a tout l'air d'une redondance : quelqu'un le retirera en « simplifiant », et
 * la panne reviendrait sans qu'aucune autre porte ne s'en aperçoive.
 */
import { describe, it, expect } from 'vitest'
import { getRedirectPath } from '@/pages/public/AuthCallbackPage'
import { AGENT_ROLES } from '@/types/auth'
import type { UserRole } from '@/types/auth'

describe('destination post-connexion selon le rôle', () => {
  it('envoie le super_admin dans le CRM, pas sur le portail retiré', () => {
    expect(getRedirectPath('super_admin')).toBe('/dashboard')
  })

  it('ne dépend pas de AGENT_ROLES pour le super_admin (il n’y figure pas)', () => {
    // Si un jour super_admin entre dans AGENT_ROLES, ce test reste vert : c'est
    // la DESTINATION qui est verrouillée, pas le chemin pour y arriver.
    expect(AGENT_ROLES).not.toContain('super_admin' as UserRole)
    expect(getRedirectPath('super_admin')).toBe('/dashboard')
  })

  it('envoie tous les rôles d’agence dans le CRM', () => {
    for (const role of AGENT_ROLES) {
      expect(getRedirectPath(role)).toBe('/dashboard')
    }
  })

  it('ne renvoie JAMAIS un rôle du CRM vers une route retirée', () => {
    const rolesCrm: UserRole[] = [...AGENT_ROLES, 'super_admin']
    for (const role of rolesCrm) {
      expect(getRedirectPath(role)).not.toMatch(/^\/port(al|ail)/)
    }
  })
})
