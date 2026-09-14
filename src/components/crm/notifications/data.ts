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
 * La teinte de chaque type — UNE PAR TYPE, et toutes distinctes.
 *
 * ⛔ Elle encodait le DOMAINE (14.09.2026, matin) : deux types d'un même domaine
 * partageaient leur hue et ne se distinguaient que par un glyphe de 20 px — Visite et
 * Rappel, Étape et Mandat, Équipe et Facturation, Correspondance et MEGGA AI. Le même
 * défaut que les pastilles d'acteur du journal (« MEGGA AI, il est pareil que le
 * système »), et le même remède, le même jour (Julien : « fais pareil pour les icônes
 * des évènements »). Choisies pour se séparer : l'écart le plus faible entre deux teintes
 * vaut ΔE 21 (Correspondance / Équipe) ; toutes tiennent le blanc à 3,5:1 au moins — la
 * tuile est un aplat, et c'est le glyphe BLANC qui doit s'y lire (seuil graphique : 3:1).
 * MEGGA AI garde l'ACCENT, sa marque, comme sa pastille d'acteur.
 */
const TEINTE: Record<Exclude<NotifKind, 'ai'>, string> = {
  contact: '#059669',
  message: '#0891B2',
  matching: '#C026D3',
  visite: '#2563EB',
  rappel: '#A16207',
  pipeline: '#EA580C',
  mandat: '#BE185D',
  doc: '#334155',
  bien: '#0F766E',
  kyc: '#DC2626',
  team: '#7E22CE',
  facturation: '#4D7C0F',
  system: '#78716C',
}

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
  contact:     { dot: TEINTE.contact,     icon: 'user' },
  message:     { dot: TEINTE.message,     icon: 'message' },
  matching:    { dot: TEINTE.matching,    icon: 'target' },
  visite:      { dot: TEINTE.visite,      icon: 'calendar' },
  rappel:      { dot: TEINTE.rappel,      icon: 'clock' },
  pipeline:    { dot: TEINTE.pipeline,    icon: 'pipeline' },
  mandat:      { dot: TEINTE.mandat,      icon: 'edit' },
  doc:         { dot: TEINTE.doc,         icon: 'file-text' },
  bien:        { dot: TEINTE.bien,        icon: 'home' },
  kyc:         { dot: TEINTE.kyc,         icon: 'shield' },
  // ⚠ La pastille « ai » portait le noir de SUGAR, seule de la série à ne pas
  // porter une teinte. MEGGA AI a la sienne — l'accent, celle que le dock arbore.
  ai:          { dot: MXC_COLOR.accent,   icon: 'sparkle' },
  team:        { dot: TEINTE.team,        icon: 'users' },
  facturation: { dot: TEINTE.facturation, icon: 'credit-card' },
  system:      { dot: TEINTE.system,      icon: 'settings' },
}
