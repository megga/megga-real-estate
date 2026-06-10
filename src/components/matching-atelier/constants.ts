// Atelier Matching — mappings & filtres partagés (KYC, engagement, onglets).

import type { AtelierBuyer, AtelierKyc, AtelierStatus, AtelierTab } from './types'

// Rappel doux, non bloquant — décision mai 2026 (le KYC ne gate aucun geste)
export const SGA_KYC: Record<AtelierKyc, { tone: 'green' | 'yellow'; label: string }> = {
  verified: { tone: 'green', label: 'KYC vérifié' },
  pending: { tone: 'yellow', label: 'KYC en cours' },
  stale: { tone: 'yellow', label: 'KYC à re-screener' },
  none: { tone: 'yellow', label: 'KYC à compléter' },
}

export const SGA_ENGAGE_TONE: Record<AtelierStatus, string> = {
  engaged: 'green',
  'to-send': 'blue',
  'no-reply': 'ink',
}

export const SGA_TABS: Array<{ key: AtelierTab; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'to-send', label: 'À envoyer' },
  { key: 'engaged', label: 'Engagé' },
  { key: 'no-reply', label: 'Sans retour' },
]

export const sgaMatchTab = (b: AtelierBuyer, tab: AtelierTab): boolean =>
  tab === 'all' || b.status === tab

export const sgaMatchQuery = (b: AtelierBuyer, q: string): boolean =>
  !q || `${b.first} ${b.last} ${b.type} ${b.zone}`.toLowerCase().includes(q.toLowerCase())
