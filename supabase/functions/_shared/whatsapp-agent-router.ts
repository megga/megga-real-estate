// Logique PURE du routage agent WhatsApp (Phase 3). Aucun I/O — testable Node.

/** Code à 6 chiffres si le corps en contient exactement 6 (espaces internes ignorés), sinon null. */
export function extractPairingCode(body: string | null | undefined): string | null {
  if (!body) return null
  const digits = body.replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/** Valide si la date d'expiration est dans le futur. */
export function isPairingCodeValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}
