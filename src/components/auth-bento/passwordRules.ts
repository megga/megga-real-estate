// MEGGA Auth — Règles password
// Spec : min 12 chars, 1 majuscule, 1 chiffre, 1 caractère spécial.
// Voir handoff-auth/HANDOFF_AUTH_CLAUDE_CODE.md § "Agent — email + password".

export type PasswordRules = {
  length: boolean // >= 12 chars
  upper: boolean // au moins 1 majuscule
  digit: boolean // au moins 1 chiffre
  special: boolean // au moins 1 caractère non alphanumérique
}

export function validatePassword(password: string): PasswordRules {
  return {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
}

export function passwordIsValid(password: string): boolean {
  const r = validatePassword(password)
  return r.length && r.upper && r.digit && r.special
}

export const PASSWORD_RULE_LABELS: Array<{ key: keyof PasswordRules; label: string }> = [
  { key: 'length', label: '12 caractères minimum' },
  { key: 'upper', label: 'Une majuscule' },
  { key: 'digit', label: 'Un chiffre' },
  { key: 'special', label: 'Un caractère spécial' },
]
