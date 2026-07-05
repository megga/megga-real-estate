// Versions courantes des documents légaux (nLPD). Bumper une version ici →
// ConsentGate redemande l'acceptation à toute la base à la session suivante.
// La preuve est en DB (user_consents, migration 20260705170000) : 1 ligne
// immuable par (user, type, version), écrite par la RPC record_consent.

export const CURRENT_CONSENT_VERSIONS = {
  terms: '2026-07',
  privacy: '2026-07',
} as const

export type RequiredConsentType = keyof typeof CURRENT_CONSENT_VERSIONS

// Pages légales servies par la vitrine (sites/megga-vitrine).
export const LEGAL_URLS: Record<RequiredConsentType, string> = {
  terms: 'https://megga.ch/mentions-legales.html',
  privacy: 'https://megga.ch/confidentialite.html',
}
