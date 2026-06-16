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
  label: (n: string) => string
}

// type → bouton principal + couleur d'accent du badge
export const FOCUS_TYPE: Record<string, FocusTypeDef> = {
  call: { icon: 'phone', badge: '#6F8CFF', live: true, label: (n) => `Appeler ${n.split(' ')[0]}` },
  kyc: { icon: 'shield', badge: '#39B7C9', live: false, label: () => 'Vérifier le KYC' },
  sign: { icon: 'doc', badge: '#E08A45', live: false, label: () => 'Préparer le mandat' },
  offer: { icon: 'offer', badge: '#34C796', live: false, label: () => "Relancer l'offre" },
  match: { icon: 'phone', badge: '#6F8CFF', live: true, label: (n) => `Appeler ${n.split(' ')[0]}` },
}

export const focusTy = (t: string): FocusTypeDef => FOCUS_TYPE[t] || FOCUS_TYPE.call

// Sélectionne la file actionnable à afficher (pur, testable). En live on retire
// le tier « reste » (faible bruit, plié) ; sinon le seed démo n'est servi que
// derrière le flag démo (empty-state honnête en prod : tableau vide).
export function selectFocusQueue(opts: { live: boolean; items: FocusItem[]; isDemo: boolean }): FocusItem[] {
  if (opts.live) return opts.items.filter((it) => it.tier !== 'rest')
  return opts.isDemo ? FOCUS_QUEUE_DEMO : []
}
