/**
 * Gate d'affichage de l'entrée « Console admin » dans le CRM.
 *
 * Régression vécue le 26 juil. 2026 : l'entrée était conditionnée à la RÉUSSITE
 * de la RPC `is_super_admin`. Avec `retry: false`, un seul échec réseau la
 * faisait disparaître définitivement du menu profil — sans message, et sans
 * autre chemin vers la console. Le gate étant purement UX (le mur est en DB et
 * sur les edges), le rôle doit suffire à afficher ; la RPC ne peut que retirer.
 */
import { describe, it, expect } from 'vitest'
import { resolveSuperAdminGate } from '@/hooks/useSuperAdminGate'

describe('resolveSuperAdminGate', () => {
  it('affiche dès que le rôle est là, sans attendre la RPC', () => {
    expect(resolveSuperAdminGate({ loading: false, roleOk: true, rpc: undefined }))
      .toEqual({ checking: false, allowed: true })
  })

  it('affiche encore si la RPC a échoué (undefined) — c\'était le bug', () => {
    // `retry: false` + erreur ⇒ data reste undefined pour toute la session.
    expect(resolveSuperAdminGate({ loading: false, roleOk: true, rpc: undefined }).allowed)
      .toBe(true)
  })

  it('retire l\'entrée si la RPC dit explicitement non', () => {
    // Rôle super_admin posé sur un email hors allowlist : la DB refuserait.
    expect(resolveSuperAdminGate({ loading: false, roleOk: true, rpc: false }))
      .toEqual({ checking: false, allowed: false })
  })

  it('confirme quand la RPC dit oui', () => {
    expect(resolveSuperAdminGate({ loading: false, roleOk: true, rpc: true }).allowed).toBe(true)
  })

  it('ne montre rien à un agent, quoi que réponde la RPC', () => {
    for (const rpc of [undefined, true, false]) {
      expect(resolveSuperAdminGate({ loading: false, roleOk: false, rpc }))
        .toEqual({ checking: false, allowed: false })
    }
  })

  it('attend la résolution de session avant de trancher', () => {
    expect(resolveSuperAdminGate({ loading: true, roleOk: true, rpc: true }))
      .toEqual({ checking: true, allowed: false })
  })

  it('bypass dev : le rôle mock suffit, aucune RPC en jeu', () => {
    expect(resolveSuperAdminGate({ loading: false, roleOk: true, rpc: undefined, devBypass: true }))
      .toEqual({ checking: false, allowed: true })
    expect(resolveSuperAdminGate({ loading: false, roleOk: false, rpc: true, devBypass: true }).allowed)
      .toBe(false)
  })
})
