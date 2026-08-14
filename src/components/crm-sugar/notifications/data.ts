// MEGGA CRM Sugar v2 — Notifications types + registre.
// 1:1 port from the Claude Design bundle (crm-notifications.jsx). Les
// notifications affichées sont dérivées en live par useAgentNotifications
// (le tableau démo SUGAR_NOTIFS a été retiré).

import type { MEIconName } from '@/components/propertyx/MEIcon'
// i18n : `label` des types de notif en getter (singleton, sans changer les
// appelants).
import i18n from '@/i18n'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

export type NotifKind = 'kyc' | 'visite' | 'offre' | 'mandat' | 'ai' | 'doc' | 'team' | 'system'
export type NotifPriority = 'high' | 'med' | 'low'
export type NotifGroup = 'today' | 'yesterday' | 'older'

export interface SugarNotif {
  id: string
  kind: NotifKind
  priority: NotifPriority
  read: boolean
  title: string
  body: string
  time: string
  group: NotifGroup
  cta: string
  ctaTo: string
}

export const KIND_META: Record<NotifKind, { dot: string; icon: MEIconName; label: string }> = {
  kyc:    { dot: '#E53935', icon: 'shield',   get label() { return i18n.t('common:notifications.kind.kyc') } },
  visite: { dot: '#0891B2', icon: 'calendar', get label() { return i18n.t('common:notifications.kind.visite') } },
  offre:  { dot: '#C45A00', icon: 'bolt',     get label() { return i18n.t('common:notifications.kind.offre') } },
  mandat: { dot: '#1E5BC6', icon: 'file',     get label() { return i18n.t('common:notifications.kind.mandat') } },
  // ⚠ La pastille « ai » portait le noir de SUGAR, seule de la série à ne pas
  // porter une teinte : les six autres encodent leur genre par une hue. MEGGA AI
  // a la sienne — l'accent, celle que le bouton du rail et le dock arborent déjà.
  ai:     { dot: MXC_COLOR.accent, icon: 'sparkle',  get label() { return i18n.t('common:notifications.kind.ai') } },
  doc:    { dot: '#059669', icon: 'file',     get label() { return i18n.t('common:notifications.kind.doc') } },
  team:   { dot: '#7A4FD8', icon: 'share',    get label() { return i18n.t('common:notifications.kind.team') } },
  system: { dot: '#7A8088', icon: 'bell',     get label() { return i18n.t('common:notifications.kind.system') } },
}
