// Gate CRM (ProtectedRoute) — décision de redirection onboarding/agence/premier-jour.
// Pin le garde-fou agency_id (pré-vol pilote Phase 3) : un agent sans agence est
// verrouillé par la RLS → doit être renvoyé à l'onboarding, jamais laissé sur un
// dashboard vide muet ; super-admins / particuliers non concernés.

import { describe, it, expect } from 'vitest'
import { resolveOnboardingGate } from '@/components/layout/onboardingGate'
import type { UserProfile } from '@/types/auth'

type GateProfile = Pick<
  UserProfile,
  'role' | 'agency_id' | 'onboarding_completed' | 'first_day_done'
>

// Agent pleinement provisionné = accès CRM (null).
const provisioned: GateProfile = {
  role: 'agent',
  agency_id: 'agency-1',
  onboarding_completed: true,
  first_day_done: true,
}

describe('resolveOnboardingGate', () => {
  it('agent pleinement provisionné → null (accès CRM)', () => {
    expect(resolveOnboardingGate(provisioned)).toBeNull()
  })

  it('onboarding pas terminé → onboarding', () => {
    expect(
      resolveOnboardingGate({ ...provisioned, onboarding_completed: false }),
    ).toBe('/dashboard/onboarding')
  })

  it('agent SANS agence (même onboarding marqué terminé) → onboarding', () => {
    expect(
      resolveOnboardingGate({ ...provisioned, agency_id: null }),
    ).toBe('/dashboard/onboarding')
  })

  it('tous les rôles agence sans agence → onboarding', () => {
    for (const role of ['agent', 'manager', 'admin', 'assistant'] as const) {
      expect(
        resolveOnboardingGate({ ...provisioned, role, agency_id: null }),
      ).toBe('/dashboard/onboarding')
    }
  })

  it('super-admin sans agence → NON redirigé (agency_id null légitime)', () => {
    expect(
      resolveOnboardingGate({ ...provisioned, role: 'super_admin', agency_id: null }),
    ).toBeNull()
  })

  it('particulier/acheteur/vendeur sans agence → NON forcé dans l’onboarding agent', () => {
    for (const role of ['particulier', 'buyer', 'seller'] as const) {
      expect(
        resolveOnboardingGate({ ...provisioned, role, agency_id: null }),
      ).toBeNull()
    }
  })

  it('agence OK mais premier jour pas joué → premier-jour', () => {
    expect(
      resolveOnboardingGate({ ...provisioned, first_day_done: false }),
    ).toBe('/dashboard/premier-jour')
  })

  it('agent sans agence ET premier jour non joué → onboarding prioritaire', () => {
    expect(
      resolveOnboardingGate({
        ...provisioned,
        agency_id: null,
        first_day_done: false,
      }),
    ).toBe('/dashboard/onboarding')
  })

  it('profil dev mock (agent + dev-mock-agency) → null (bypass inchangé)', () => {
    expect(
      resolveOnboardingGate({
        role: 'agent',
        agency_id: 'dev-mock-agency',
        onboarding_completed: true,
        first_day_done: true,
      }),
    ).toBeNull()
  })
})
