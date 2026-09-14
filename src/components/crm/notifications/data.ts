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
  /**
   * La photo du bien ou de l'annonce que l'événement désigne (un match, une diffusion),
   * quand il en a une — elle prend la place du glyphe. `null` sinon.
   */
  image: string | null
  /**
   * Le CANAL de l'événement quand il se reconnaît à son logo mieux qu'à son type :
   * une notification WhatsApp porte le logo WhatsApp (14.09.2026). `null` sinon.
   */
  canal: 'whatsapp' | null
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

/**
 * La teinte et le glyphe de chaque type.
 *
 * ⚠ Glyphes au TRAIT uniquement : les glyphes délégués à la police d'icônes sont pleins,
 * et posés à 20 px à côté des traits ils se lisaient comme des taches.
 * ⚠ Plus de LIBELLÉ depuis le 14.09.2026 : son seul lecteur était la troisième ligne de la
 * cloche (« Message · Il y a 53 min »), qui ne dit plus que l'heure — le titre et la
 * tuile disent déjà le type.
 */
export const KIND_META: Record<NotifKind, { dot: string; icon: MEIconName }> = {
  contact:     { dot: TEINTE.relation,   icon: 'user' },
  message:     { dot: TEINTE.relation,   icon: 'message' },
  // Les correspondances sont proposées par MEGGA AI : elles en portent la teinte.
  matching:    { dot: MXC_COLOR.accent,  icon: 'target' },
  visite:      { dot: TEINTE.agenda,     icon: 'calendar' },
  rappel:      { dot: TEINTE.agenda,     icon: 'clock' },
  pipeline:    { dot: TEINTE.affaires,   icon: 'pipeline' },
  mandat:      { dot: TEINTE.affaires,   icon: 'edit' },
  doc:         { dot: TEINTE.pieces,     icon: 'file-text' },
  bien:        { dot: TEINTE.pieces,     icon: 'home' },
  kyc:         { dot: TEINTE.conformite, icon: 'shield' },
  // ⚠ La pastille « ai » portait le noir de SUGAR, seule de la série à ne pas
  // porter une teinte. MEGGA AI a la sienne — l'accent, celle que le dock arbore.
  ai:          { dot: MXC_COLOR.accent,  icon: 'sparkle' },
  team:        { dot: TEINTE.compte,     icon: 'users' },
  facturation: { dot: TEINTE.compte,     icon: 'credit-card' },
  system:      { dot: TEINTE.systeme,    icon: 'settings' },
}
