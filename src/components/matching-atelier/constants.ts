// Atelier Matching — mappings & filtres partagés (KYC, engagement, onglets).

import type { AtelierBuyer, AtelierKyc, AtelierStatus, AtelierTab } from './types'
// i18n : `label` en getter (lu via l'instance i18n singleton à l'accès → traduit
// + réactif, sans changer les sites d'appel). Cf docs/i18n-conventions §6.
import i18n from '@/i18n'

// Rappel doux, non bloquant — décision mai 2026 (le KYC ne gate aucun geste)
export const SGA_KYC: Record<AtelierKyc, { tone: 'green' | 'yellow'; label: string }> = {
  verified: { tone: 'green', get label() { return i18n.t('matching:atelierKyc.verified') } },
  pending: { tone: 'yellow', get label() { return i18n.t('matching:atelierKyc.pending') } },
  stale: { tone: 'yellow', get label() { return i18n.t('matching:atelierKyc.stale') } },
  none: { tone: 'yellow', get label() { return i18n.t('matching:atelierKyc.none') } },
}

export const SGA_ENGAGE_TONE: Record<AtelierStatus, string> = {
  engaged: 'green',
  'to-send': 'blue',
  'no-reply': 'ink',
}

export const SGA_TABS: Array<{ key: AtelierTab; label: string }> = [
  { key: 'all', get label() { return i18n.t('matching:tabs.all') } },
  { key: 'to-send', get label() { return i18n.t('matching:tabs.to-send') } },
  { key: 'engaged', get label() { return i18n.t('matching:tabs.engaged') } },
  { key: 'no-reply', get label() { return i18n.t('matching:tabs.no-reply') } },
]

export const atlMatchTab = (b: AtelierBuyer, tab: AtelierTab): boolean =>
  tab === 'all' || b.status === tab

export const atlMatchQuery = (b: AtelierBuyer, q: string): boolean =>
  !q || `${b.first} ${b.last} ${b.type} ${b.zone}`.toLowerCase().includes(q.toLowerCase())
