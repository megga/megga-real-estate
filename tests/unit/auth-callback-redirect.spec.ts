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
import { getRedirectPath, getRedirectPathWithoutProfile } from '@/lib/authRedirect'
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

/**
 * Repli quand la lecture du profil n'aboutit pas. Ce chemin existe parce que la
 * page de callback n'a QUE l'écran d'arrivée à afficher : sans destination de
 * repli elle attendait la lecture indéfiniment, et l'agent restait sur
 * « Ouverture de votre espace » sans message ni bouton (panne du 29 juil. 2026).
 *
 * Le piège à verrouiller : le repli ne doit pas retomber sur la branche par
 * défaut `/portal`. Un agent dont la lecture de profil expire sur un aléa réseau
 * serait alors éjecté vers la vitrine, sans retour — une panne pire que celle
 * qu'on corrige, et invisible en relecture puisque `getRedirectPath` a l'air
 * parfaitement correct.
 */
describe('repli d’aiguillage quand le profil est illisible', () => {
  it('fait entrer dans le CRM quand aucun rôle n’est déclaré', () => {
    expect(getRedirectPathWithoutProfile(null)).toBe('/dashboard')
    expect(getRedirectPathWithoutProfile(undefined)).toBe('/dashboard')
    expect(getRedirectPathWithoutProfile('')).toBe('/dashboard')
  })

  it('n’éjecte JAMAIS vers le portail retiré faute de profil lu', () => {
    for (const meta of [null, undefined, '', 'super_admin', 'inconnu', 'AGENT']) {
      expect(getRedirectPathWithoutProfile(meta)).not.toMatch(/^\/port(al|ail)/)
    }
  })

  it('respecte le rôle déclaré à l’inscription quand il est exploitable', () => {
    for (const role of AGENT_ROLES) {
      expect(getRedirectPathWithoutProfile(role)).toBe('/dashboard')
    }
    // Un particulier déclaré n'a rien à faire dans le CRM, même en dégradé.
    expect(getRedirectPathWithoutProfile('buyer')).toBe('/portal')
    expect(getRedirectPathWithoutProfile('particulier')).toBe('/portal')
  })

  it('ne laisse pas un rôle plateforme s’auto-déclarer dans les métadonnées', () => {
    // `super_admin` se lit en base, jamais dans user_metadata (que le client
    // contrôle). Il tombe donc dans le cas « rôle non exploitable » — dont la
    // destination se trouve être la bonne, mais pour la bonne raison.
    expect(getRedirectPathWithoutProfile('super_admin')).toBe('/dashboard')
  })
})
