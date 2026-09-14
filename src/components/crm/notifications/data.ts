// MEGGA CRM — Notifications : types et registre.
// Les notifications affichées sont dérivées en live par `useAgentNotifications`
// (le tableau démo SUGAR_NOTIFS a été retiré).
//
// ⚠ QUATORZE TYPES, UN PAR SCÉNARIO DU CRM (14.09.2026). Il n'y en avait que huit, et
// tout le reste tombait dans « Système », sous une cloche : mesuré en production, les
// 6 116 « Correspondance suggérée » — l'événement le plus fréquent de la cloche — n'y
// avaient pas de type à eux. Le classement d'une action vit dans `useAgentNotifications`
// (`toKind`), gardé action par action par `agent-notifications-scenarios.spec.ts`.

import type { MEIconName } from '@/components/propertyx/MEIcon'
// i18n : `label` des types de notif en getter (singleton, sans changer les
// appelants).
import i18n from '@/i18n'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

export type NotifKind =
  | 'contact' | 'message' | 'matching' | 'visite' | 'rappel' | 'pipeline' | 'mandat'
  | 'doc' | 'bien' | 'kyc' | 'ai' | 'team' | 'facturation' | 'system'
export type NotifPriority = 'high' | 'med' | 'low'
export type NotifGroup = 'today' | 'yesterday' | 'older'

export interface CrmNotif {
  id: string
  kind: NotifKind
  priority: NotifPriority
  read: boolean
  /** Ce qui s'est passé — le libellé de l'action (« Nouveau prospect WhatsApp »). */
  title: string
  /** Sur quoi — le sujet de l'événement (« Julien Ahmedi (via WhatsApp) »), vide si aucun. */
  body: string
  time: string
  group: NotifGroup
  /** Événements regroupés sous cette ligne (une rafale anonyme de la même action). */
  count: number
  /** Leurs identifiants : lire la ligne les marque tous lus. */
  ids: string[]
  cta: string
  ctaTo: string
}

/**
 * Les teintes des types, écrites UNE fois : un type encode son DOMAINE par une hue
 * (relation, agenda, affaires, conformité…), et deux types d'un même domaine se
 * distinguent par leur glyphe. Les valeurs sont celles que portait déjà le registre.
 */
const TEINTE = {
  relation: '#059669',
  agenda: '#0891B2',
  affaires: '#C45A00',
  pieces: '#1E5BC6',
  conformite: '#E53935',
  compte: '#7A4FD8',
  systeme: '#7A8088',
} as const

// ⚠ Glyphes au TRAIT uniquement : les glyphes délégués à la police d'icônes sont
// pleins, et posés à 20 px à côté des traits ils se lisaient comme des taches.
export const KIND_META: Record<NotifKind, { dot: string; icon: MEIconName; label: string }> = {
  contact:     { dot: TEINTE.relation,   icon: 'user',        get label() { return i18n.t('common:notifications.kind.contact') } },
  message:     { dot: TEINTE.relation,   icon: 'message',     get label() { return i18n.t('common:notifications.kind.message') } },
  // Les correspondances sont proposées par MEGGA AI : elles en portent la teinte.
  matching:    { dot: MXC_COLOR.accent,  icon: 'target',      get label() { return i18n.t('common:notifications.kind.matching') } },
  visite:      { dot: TEINTE.agenda,     icon: 'calendar',    get label() { return i18n.t('common:notifications.kind.visite') } },
  rappel:      { dot: TEINTE.agenda,     icon: 'clock',       get label() { return i18n.t('common:notifications.kind.rappel') } },
  pipeline:    { dot: TEINTE.affaires,   icon: 'pipeline',    get label() { return i18n.t('common:notifications.kind.pipeline') } },
  mandat:      { dot: TEINTE.affaires,   icon: 'edit',        get label() { return i18n.t('common:notifications.kind.mandat') } },
  doc:         { dot: TEINTE.pieces,     icon: 'file-text',   get label() { return i18n.t('common:notifications.kind.doc') } },
  bien:        { dot: TEINTE.pieces,     icon: 'home',        get label() { return i18n.t('common:notifications.kind.bien') } },
  kyc:         { dot: TEINTE.conformite, icon: 'shield',      get label() { return i18n.t('common:notifications.kind.kyc') } },
  // ⚠ La pastille « ai » portait le noir de SUGAR, seule de la série à ne pas
  // porter une teinte. MEGGA AI a la sienne — l'accent, celle que le dock arbore.
  ai:          { dot: MXC_COLOR.accent,  icon: 'sparkle',     get label() { return i18n.t('common:notifications.kind.ai') } },
  team:        { dot: TEINTE.compte,     icon: 'users',       get label() { return i18n.t('common:notifications.kind.team') } },
  facturation: { dot: TEINTE.compte,     icon: 'credit-card', get label() { return i18n.t('common:notifications.kind.facturation') } },
  system:      { dot: TEINTE.systeme,    icon: 'settings',    get label() { return i18n.t('common:notifications.kind.system') } },
}
