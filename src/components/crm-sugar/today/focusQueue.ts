// MEGGA CRM — Refonte « Aujourd'hui » · File de priorités FOCUS (données + types)
// ----------------------------------------------------------------------------
// Extrait de `today-proto-focus.jsx` : la file et son barème de types, partagés
// par FocusColumn (cockpit) et FocusMode (plein écran). Module non-composant
// (Fast Refresh : pas de mélange composants/constantes dans un fichier .tsx).

import { PHOTO } from './data'

export interface FocusItem {
  id: string
  type: string
  contact: string
  initials: string
  av: string
  kind: string
  time: string
  eta: string
  sub: string
  urgent?: boolean
  bien: { photo: string; price: string }
}

// ─── File de priorités (situations réelles de la journée) ───────────────
export const FOCUS_QUEUE: FocusItem[] = [
  { id: 'marie', type: 'call', contact: 'Marie Bertrand', initials: 'MB', av: '#5b6cff',
    kind: 'RELANCE', time: '10:00', eta: 'dans 7 min',
    sub: 'Suite visite Carouge — opportunité tiède à confirmer',
    bien: { photo: PHOTO.carouge, price: "CHF 890'000" } },
  { id: 'elodie', type: 'kyc', contact: 'Élodie Schmidt', initials: 'ÉS', av: '#39B7C9',
    kind: 'KYC', time: '11:00', eta: "à compléter aujourd'hui",
    sub: "Vérification d'identité requise avant de déposer l'offre",
    bien: { photo: PHOTO.champel, price: "CHF 1'250'000" } },
  { id: 'julien', type: 'sign', contact: 'Julien Aebischer', initials: 'JA', av: '#E08A45',
    kind: 'MANDAT', time: '11:30', eta: 'signature à préparer',
    sub: 'Mandat exclusif prêt — relire les clauses avant signature',
    bien: { photo: PHOTO.cologny, price: "CHF 2'400'000" } },
  { id: 'antoine', type: 'offer', contact: 'Antoine Picard', initials: 'AP', av: '#34C796',
    kind: 'OFFRE', time: '14:00', eta: 'délai dépassé · 2 j', urgent: true,
    sub: 'Suivi offre Villa Cologny — relancer avant expiration',
    bien: { photo: PHOTO.eauxvives, price: "CHF 1'850'000" } },
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
}

export const focusTy = (t: string): FocusTypeDef => FOCUS_TYPE[t] || FOCUS_TYPE.call
