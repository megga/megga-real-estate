// MEGGA CRM — KYC · état du gate onboarding « Première ouverture »
// Partagé entre KycOnboardingPage (pose le flag) et KycPage (le lit pour
// décider d'afficher l'onboarding ou le pager). Module non-composant : évite le
// warning react-refresh d'un export de fonction depuis un fichier de page.

const KYC_ONBOARDED_KEY = 'megga.kyc.onboarded'

// Fallback mémoire : en navigation privée, localStorage.setItem peut lever. Sans
// persistance, le gate rebouclerait vers /bienvenue. Ce flag module tient pour la
// session SPA (pas de reload) même quand le stockage est indisponible.
let kycOnboardedInMemory = false

/** Pose le flag « onboarding KYC vu » (localStorage + repli mémoire). */
export function markKycOnboarded(): void {
  kycOnboardedInMemory = true
  try {
    window.localStorage.setItem(KYC_ONBOARDED_KEY, '1')
  } catch {
    /* stockage indisponible — le flag mémoire prend le relais */
  }
}

/** True si l'onboarding KYC a déjà été vu — pilote l'affichage onboarding vs pager. */
export function isKycOnboarded(): boolean {
  if (kycOnboardedInMemory) return true
  try {
    return window.localStorage.getItem(KYC_ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}
