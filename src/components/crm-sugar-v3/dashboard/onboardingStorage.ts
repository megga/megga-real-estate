// MEGGA CRM Sugar v3 — Dashboard Analytics — Onboarding storage helpers
// Extrait de OnboardingChecklist.tsx pour satisfaire la règle
// `react-refresh/only-export-components` (un fichier composant ne peut pas
// exporter à la fois des composants et des helpers/constantes).

export const ONBOARDING_STORAGE_KEY = 'megga.onboarding.dashboard.v1'

export interface OnboardingState {
  version: 1
  completed: Record<string, boolean>
  dismissed: boolean
}

export function loadOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingState
      if (parsed.version === 1) return parsed
    }
  } catch {
    // localStorage might be blocked (incognito) — fallback to default state
  }
  return { version: 1, completed: {}, dismissed: false }
}

export function saveOnboardingState(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / incognito errors
  }
}

/**
 * Helper exporté — permet à un autre composant de marquer une étape complétée
 * programmatiquement (ex : à la fin de la session de relance).
 */
export function markOnboardingStepDone(stepId: string): void {
  const state = loadOnboardingState()
  state.completed[stepId] = true
  saveOnboardingState(state)
}
