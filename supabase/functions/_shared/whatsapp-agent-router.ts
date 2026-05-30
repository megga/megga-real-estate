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

export type ToolTier = 'read' | 'auto' | 'confirm'

// Source de vérité du tier par outil. Inconnu => 'confirm' (fail-safe : jamais
// d'exécution d'un outil non classé sans confirmation humaine).
const TOOL_TIERS: Record<string, ToolTier> = {
  get_my_agenda: 'read',
  search_contacts: 'read',
  create_contact: 'auto',
  add_note: 'auto',
  send_client_message: 'confirm',
}

export function toolTier(name: string): ToolTier {
  return TOOL_TIERS[name] ?? 'confirm'
}

const YES = new Set(['oui', 'ok', 'okay', 'yes', 'y', 'vas-y', 'vasy', 'go', 'confirme', 'confirmer', 'valide', "d'accord", 'daccord', 'ouais', 'yep'])
const NO = new Set(['non', 'no', 'n', 'annule', 'annuler', 'stop', 'cancel', 'laisse', 'laisse tomber'])

export function parseConfirmation(body: string | null | undefined): 'yes' | 'no' | 'none' {
  if (!body) return 'none'
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  if (YES.has(norm)) return 'yes'
  if (NO.has(norm)) return 'no'
  return 'none'
}

export function isPendingActionValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}
