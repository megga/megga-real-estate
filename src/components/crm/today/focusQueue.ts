// MEGGA CRM — Refonte « Aujourd'hui » · File de priorités FOCUS (données + types)
// ----------------------------------------------------------------------------
// Extrait de `today-proto-focus.jsx` : la file et son barème de types, partagés
// par FocusColumn (cockpit) et FocusMode (plein écran). Module non-composant
// (Fast Refresh : pas de mélange composants/constantes dans un fichier .tsx).
//
// Depuis l'algo Focus (PR algo Focus) : FocusItem porte un `score` (priorité,
// estimation), une `reason` (« pourquoi #1 »), un `tier` (now/next/rest) et un
// `signalKind` (famille de signal). `category` = ex-`kind` (libellé du badge).

import { PHOTO } from './data'
import type { FocusSignalKind, FocusTier } from './focusScore'

export interface FocusItem {
  id: string
  /** Clé du bouton principal (FOCUS_TYPE) : call | kyc | sign | offer | match. */
  type: string
  /** Famille de signal (scoring/tier). */
  signalKind: FocusSignalKind
  contact: string
  contactId: string
  initials: string
  av: string
  /** Libellé du badge : RELANCE | KYC | OFFRE | MANDAT | MATCH (ex-`kind`). */
  category: string
  time: string
  eta: string
  sub: string
  /** Raison lisible « pourquoi #1 » — déterministe, affichée comme estimation. */
  reason: string
  /** Score de priorité brut (interne, comparable entre familles pour le tri). */
  score: number
  /** Score d'affichage 0..100 normalisé (estimation montrée à l'agent). */
  displayScore: number
  /** Score brut du match [70..100] (pour la raison). */
  scoreBrut?: number
  tier: FocusTier
  urgent?: boolean
  bien: { photo: string; price: string; title?: string }
}

// ─── Seed DÉMO — utilisé UNIQUEMENT derrière le flag démo (jamais en prod) ──
// L'empty-state honnête (FocusColumn natif « File traitée ») remplace ce seed
// pour un agent réel à 0 item : on n'affiche plus de personas fictifs.
export const FOCUS_QUEUE_DEMO: FocusItem[] = [
  { id: 'marie', type: 'call', signalKind: 'reminder', contact: 'Marie Bertrand', contactId: 'marie', initials: 'MB', av: '#5b6cff',
    category: 'RELANCE', time: '10:00', eta: 'dans 7 min', score: 52, displayScore: 91, tier: 'now',
    reason: 'Relance prévue aujourd\'hui (10:00)',
    sub: 'Suite visite Carouge — opportunité tiède à confirmer',
    bien: { photo: PHOTO.carouge, price: "CHF 890'000" } },
  { id: 'elodie', type: 'kyc', signalKind: 'reminder', contact: 'Élodie Schmidt', contactId: 'elodie', initials: 'ÉS', av: '#39B7C9',
    category: 'KYC', time: '11:00', eta: "à compléter aujourd'hui", score: 48, displayScore: 84, tier: 'now',
    reason: 'KYC à compléter — vérification requise',
    sub: "Vérification d'identité requise avant de déposer l'offre",
    bien: { photo: PHOTO.champel, price: "CHF 1'250'000" } },
  { id: 'antoine', type: 'offer', signalKind: 'deal', contact: 'Antoine Picard', contactId: 'antoine', initials: 'AP', av: '#34C796',
    category: 'OFFRE', time: '14:00', eta: 'délai dépassé · 2 j', urgent: true, score: 40, displayScore: 70, tier: 'now',
    reason: 'Offre à suivre — closing proche',
    sub: 'Suivi offre Villa Cologny — relancer avant expiration',
    bien: { photo: PHOTO.eauxvives, price: "CHF 1'850'000" } },
  { id: 'julien', type: 'sign', signalKind: 'deal', contact: 'Julien Aebischer', contactId: 'julien', initials: 'JA', av: '#E08A45',
    category: 'MANDAT', time: '11:30', eta: 'signature à préparer', score: 28, displayScore: 49, tier: 'next',
    reason: 'Mandat à préparer — relire les clauses',
    sub: 'Mandat exclusif prêt — relire les clauses avant signature',
    bien: { photo: PHOTO.cologny, price: "CHF 2'400'000" } },
]

export interface FocusTypeDef {
  icon: string
  badge: string
  live: boolean
  /** Clé i18n du bouton principal (namespace dashboard). Interpolation {{name}}
   * = prénom du contact, traduit chez le consommateur (cf i18n-conventions §5). */
  labelKey: string
}

// type → bouton principal + couleur d'accent du badge. `labelKey` est traduit
// par le composant via t(ty.labelKey, { name: prénom }).
export const FOCUS_TYPE: Record<string, FocusTypeDef> = {
  call: { icon: 'phone', badge: '#6F8CFF', live: true, labelKey: 'today.focusTypes.call' },
  kyc: { icon: 'shield', badge: '#39B7C9', live: false, labelKey: 'today.focusTypes.kyc' },
  sign: { icon: 'doc', badge: '#E08A45', live: false, labelKey: 'today.focusTypes.sign' },
  offer: { icon: 'offer', badge: '#34C796', live: false, labelKey: 'today.focusTypes.offer' },
  match: { icon: 'phone', badge: '#6F8CFF', live: true, labelKey: 'today.focusTypes.call' },
  // Focus radar v1 — nouveau mandat vendeur 'new' à réclamer (argent qui attend).
  seller: { icon: 'flame', badge: '#34C796', live: false, labelKey: 'today.focusTypes.seller' },
  // Focus radar v2 — lead qui refroidit / jamais recontacté (relance de fond).
  cooling: { icon: 'clock', badge: '#6F8CFF', live: false, labelKey: 'today.focusTypes.cooling' },
  // Focus radar v3 — visite à préparer (jour) / débrief en attente / no-show.
  // (Les offres qui expirent réutilisent le type 'offer' ci-dessus.)
  visit: { icon: 'cal', badge: '#9b7cf0', live: false, labelKey: 'today.focusTypes.visit' },
  // Focus radar v4 — bien interne à pousser (score de bien backend). UI-only.
  bien: { icon: 'building', badge: '#5b6cff', live: false, labelKey: 'today.focusTypes.bien' },
}

export const focusTy = (t: string): FocusTypeDef => FOCUS_TYPE[t] || FOCUS_TYPE.call

// Code de catégorie (badge) → segment de clé i18n today.tags.* . Le `category`
// reste un CODE stable interne ; seul l'affichage est traduit (chez le
// consommateur : t(`today.tags.${focusTagKey(item.category)}`)).
const TAG_KEY: Record<string, string> = {
  OFFRE: 'offer', MANDAT: 'mandate', RELANCE: 'relance', KYC: 'kyc',
  VENDEUR: 'seller', VISITE: 'visit', BIEN: 'property', MATCH: 'match',
}
export const focusTagKey = (category: string): string => TAG_KEY[category] || category.toLowerCase()

// Sélectionne la file actionnable à afficher (pur, testable). En live on retire
// le tier « reste » (faible bruit, plié) ; sinon le seed démo n'est servi que
// derrière le flag démo (empty-state honnête en prod : tableau vide).
export function selectFocusQueue(opts: { live: boolean; items: FocusItem[]; isDemo: boolean }): FocusItem[] {
  if (opts.live) return opts.items.filter((it) => it.tier !== 'rest')
  return opts.isDemo ? FOCUS_QUEUE_DEMO : []
}
