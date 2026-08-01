// Gate identite legale (AgentSugarLayout) - decision pure et testable, sur le
// meme motif que l'ancien resolveOnboardingGate (composants/layout/onboardingGate.ts,
// retire en juillet 2026 avec l'ancien parcours onboarding/premier-jour).
//
// Un gate bloquant sur ce projet a deja cause un incident P0 (commit c830f9a9,
// "boucle onboarding") : une redirection emise sur un etat non resolu a fait
// rebondir un agent indefiniment entre deux routes qui se redirigeaient l'une
// vers l'autre. Ce fichier pin les trois garde-fous qui empechent la meme
// classe de bug ici : jamais de redirection tant que l'etat n'est pas resolu
// (resolveIdentityGateStatus), jamais d'auto-redirection de la route du gate
// (shouldRedirectToIdentityGate), et le cycle complet requis -> soumis ->
// plus jamais requis.

import { describe, it, expect } from 'vitest'
import {
  resolveIdentityGateStatus,
  shouldRedirectToIdentityGate,
  shouldHoldForIdentityGate,
  IDENTITY_GATE_ROUTE,
  type ResolveIdentityGateStatusInput,
} from '@/hooks/useIdentityGate'
import type { UserRole } from '@/types/auth'

// Etat "gate applicable, identite pas encore soumise" - base reutilisee et
// deviee par les tests ci-dessous (memes noms de champs que le hook reel).
const gateApplies: ResolveIdentityGateStatusInput = {
  authLoading: false,
  profile: { role: 'admin', agency_id: 'agency-1' },
  superAdminChecking: false,
  superAdminAllowed: false,
  agencyStatusLoading: false,
  identitySubmittedAt: null,
}

describe('resolveIdentityGateStatus - garde-fou 1 : jamais de redirection sur un etat indetermine', () => {
  it('session/profil en cours de resolution (useAuth().loading) -> loading', () => {
    expect(resolveIdentityGateStatus({ ...gateApplies, authLoading: true })).toBe('loading')
  })

  it('profil absent alors que authLoading est faux -> loading, jamais exempt par defaut', () => {
    // Etat qui ne devrait quasiment jamais survenir (fetchProfile construit
    // toujours un repli), mais s'il survient on ne DEDUIT pas "exempt" faute
    // de donnees : on attend une confirmation positive.
    expect(resolveIdentityGateStatus({ ...gateApplies, profile: null })).toBe('loading')
  })

  it('verification is_super_admin() (RPC) en cours -> loading', () => {
    expect(resolveIdentityGateStatus({ ...gateApplies, superAdminChecking: true })).toBe('loading')
  })

  it('lecture agencies.identity_submitted_at en cours -> loading', () => {
    expect(resolveIdentityGateStatus({ ...gateApplies, agencyStatusLoading: true })).toBe('loading')
  })
})

describe('resolveIdentityGateStatus - cas de base', () => {
  it('pas d agence -> exempt (agence auto-provisionnee au signup, hors gate)', () => {
    expect(
      resolveIdentityGateStatus({
        ...gateApplies,
        profile: { role: 'admin', agency_id: null },
      }),
    ).toBe('exempt')
  })

  it('agent simple avec agence -> exempt, il n engage pas juridiquement l agence', () => {
    expect(
      resolveIdentityGateStatus({
        ...gateApplies,
        profile: { role: 'agent', agency_id: 'agency-1' },
      }),
    ).toBe('exempt')
  })

  it('tous les roles hors admin/manager sont exemptes, y compris super_admin lui-meme', () => {
    const roles: UserRole[] = ['agent', 'assistant', 'buyer', 'seller', 'particulier', 'super_admin']
    for (const role of roles) {
      expect(
        resolveIdentityGateStatus({ ...gateApplies, profile: { role, agency_id: 'agency-1' } }),
      ).toBe('exempt')
    }
  })

  it('manager avec agence et identite non soumise -> required (pas seulement admin)', () => {
    expect(
      resolveIdentityGateStatus({
        ...gateApplies,
        profile: { role: 'manager', agency_id: 'agency-1' },
      }),
    ).toBe('required')
  })

  it('admin/manager exempte via is_super_admin() confirme -> exempt', () => {
    // Decision du plan etape 2 : l'exemption passe par is_super_admin() (role
    // ET allowlist email, migration 20260705160000), explicite plutot que
    // deduite - un autre chantier a du l'ajouter APRES COUP sur l'ancien gate
    // onboarding (commit e6c26c02) faute de l'avoir prevue des le depart.
    expect(resolveIdentityGateStatus({ ...gateApplies, superAdminAllowed: true })).toBe('exempt')
  })

  it('identite soumise -> done', () => {
    expect(
      resolveIdentityGateStatus({ ...gateApplies, identitySubmittedAt: '2026-07-20T08:00:00.000Z' }),
    ).toBe('done')
  })

  it('lecture en echec (identitySubmittedAt undefined, ni null ni horodatage) -> required, fail-closed', () => {
    // Un dirigeant dont on n'a pas la preuve positive de soumission (erreur
    // reseau/RLS sur la requete agence) ne doit pas passer : coherent avec
    // l'objectif 2 du Document Maitre (reduire le risque LAB/KYC).
    expect(
      resolveIdentityGateStatus({ ...gateApplies, identitySubmittedAt: undefined }),
    ).toBe('required')
  })
})

describe('resolveIdentityGateStatus - garde-fou 3 : cycle complet requis -> soumis -> plus jamais requis', () => {
  it('requis avant soumission, jamais plus requis apres (incident P0 c830f9a9, boucle onboarding)', () => {
    expect(resolveIdentityGateStatus(gateApplies)).toBe('required')

    // Le dirigeant soumet : agencies.identity_submitted_at passe de null a un
    // horodatage (RPC submit_agency_identity(), tache 1 de cette etape).
    const afterSubmission: ResolveIdentityGateStatusInput = {
      ...gateApplies,
      identitySubmittedAt: '2026-07-27T10:15:00.000Z',
    }
    expect(resolveIdentityGateStatus(afterSubmission)).toBe('done')

    // Re-evaluations repetees (nouvelle navigation, remontage du hook au
    // retour sur /dashboard...) : aucune ne redevient 'required' tant que
    // l'horodatage reste pose. Une regression qui relirait mal l'etat
    // reproduirait exactement la boucle de l'incident P0.
    expect(resolveIdentityGateStatus(afterSubmission)).toBe('done')
    expect(resolveIdentityGateStatus(afterSubmission)).toBe('done')
  })
})

describe('shouldRedirectToIdentityGate - garde-fou 2 : la route du gate ne se redirige jamais vers elle-meme', () => {
  it('required + ailleurs sur le CRM -> redirige vers le gate', () => {
    expect(shouldRedirectToIdentityGate('required', '/dashboard')).toBe(true)
    expect(shouldRedirectToIdentityGate('required', '/dashboard/pipeline')).toBe(true)
  })

  it('required + deja sur /dashboard/identite -> jamais de redirection (incident P0 c830f9a9)', () => {
    expect(shouldRedirectToIdentityGate('required', IDENTITY_GATE_ROUTE)).toBe(false)
  })

  it('statuts non requis -> jamais de redirection, quelle que soit la route', () => {
    for (const status of ['loading', 'exempt', 'done'] as const) {
      expect(shouldRedirectToIdentityGate(status, '/dashboard')).toBe(false)
      expect(shouldRedirectToIdentityGate(status, IDENTITY_GATE_ROUTE)).toBe(false)
    }
  })
})

// Versant affichage du garde-fou 1. Le bloc precedent pin qu'on ne REDIRIGE pas
// sur un etat indetermine ; celui-ci pin qu'on ne rend pas le CRM non plus. Sans
// lui, "loading" laissait passer l'<Outlet/> : le tableau de bord s'affichait
// une fraction de seconde, puis la lecture agence repondait 'required' et
// renvoyait le dirigeant sur le wizard (signale le 1er aout 2026).
describe('shouldHoldForIdentityGate - le CRM ne se montre pas avant que le gate ait tranche', () => {
  it('statut non resolu -> on retient l ecran d arrivee', () => {
    expect(shouldHoldForIdentityGate('loading')).toBe(true)
  })

  it('tout statut tranche -> on rend (le CRM, ou la redirection vers le wizard)', () => {
    for (const status of ['required', 'exempt', 'done'] as const) {
      expect(shouldHoldForIdentityGate(status)).toBe(false)
    }
  })

  // Les deux predicats se lisent ensemble dans AgentSugarLayout : retenir
  // d'abord, rediriger ensuite. Aucun etat ne doit permettre les deux a la fois,
  // sans quoi l'ordre des ternaires deciderait du comportement.
  it('aucun statut ne declenche a la fois la retenue et la redirection', () => {
    for (const status of ['loading', 'required', 'exempt', 'done'] as const) {
      const hold = shouldHoldForIdentityGate(status)
      const redirect = shouldRedirectToIdentityGate(status, '/dashboard')
      expect(hold && redirect).toBe(false)
    }
  })
})
