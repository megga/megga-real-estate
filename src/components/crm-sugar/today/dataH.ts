// MEGGA CRM — Today V2 « concept H » · DONNÉES DÉMO (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 des constantes de `today-h-live.jsx` (handoff Today V2, 3 août 2026),
// et FORMES que les composants lisent.
//
// État après le Lot 0 : la journée (`HL_BLOCKS`), la fenêtre libre et les
// nouveautés (`HL_NEWS`) ont été RETIRÉES — elles viennent maintenant de
// Supabase via `useTodayH`. Ce qui reste en démonstration est ce qu'aucune
// source ne sert encore, et l'écran le SIGNALE (repère « Démo ») :
//   - `HL_HOT` / `HL_ANN` → Lot 3 (classement des dossiers, actions d'annonces)
// `HL_SIGNALS` / `HL_GROUPS` ont été RETIRÉS au Lot 1 : le fil « Pendant ton
// absence » est vivant (`useAbsenceSignals`). Seule la FORME `HlSignalData`
// subsiste — c'est le contrat que le hook produit.
// `HL_TYPES` / `HL_KIND_TYPE` ne sont pas des données mais la palette
// fonctionnelle, calquée sur le Calendrier : elles restent.

import { PHOTO } from './data'

// ─── Couleurs FONCTIONNELLES MEGGA, calquées sur le Calendrier ─────────────
// (EVENT_TYPES / _DARK) : aplat opaque plein + texte blanc, clair / sombre.
export const HL_TYPES: Record<string, { l: string; d: string }> = {
  relance: { l: '#C45A00', d: '#A84E00' }, // appel / relance (Tâche)
  kyc: { l: '#5B6472', d: '#4E5561' },     // conformité LBA (neutre sobre)
  mandat: { l: '#1E5BC6', d: '#1C4FA8' },  // Mandat / estimation
  visite: { l: '#0891B2', d: '#0A7A92' },  // Visite
  compromis: { l: '#059669', d: '#06805B' }, // Compromis / signé
}

export const HL_KIND_TYPE: Record<string, string> = {
  call: 'relance', shield: 'kyc', doc: 'mandat', home: 'visite', offer: 'compromis',
}

export interface HlBlockData {
  id: string
  /** Minutes depuis minuit — contrat de la timeline. */
  from: number
  /** Durée en minutes — dimensionne le bloc. */
  dur: number
  time: string
  kind: string
  contact: string
  initials: string
  av: string
  role: string
  /** Note MEGGA AI affichée dans le popover et le dossier. */
  line: string
  cta: string
  ctaIcon: string
  done?: boolean
  now?: boolean
  risk?: boolean
  photo?: string
  price?: string
  place?: string
}

export interface HlSignalData {
  id: string
  /** `like` / `skip` = boucle de match · `rappel` = reminders · `ia` = MEGGA AI. */
  type: 'like' | 'skip' | 'rappel' | 'ia'
  who: string
  initials: string
  av?: string
  text: string
  meta: string
  late?: boolean
  cta: string
}

export interface HlHotData {
  id: string
  init: string
  av: string
  name: string
  role: string
  ctx: string
  dot: string
  late?: boolean
  cta: string
  ctaIcon: string
  price: string
  photo?: string
  g1?: string
  g2?: string
}

// ─── Dossiers chauds — classés par MEGGA AI, indépendants de la timeline ──
// Volume-adaptatif : 1 dossier → une carte, jusqu'à ~4.
export const HL_HOT: HlHotData[] = [
  { id: 'marie', init: 'MB', av: '#5b6cff', name: 'Marie Bertrand', role: 'Acheteuse · dossier chaud', ctx: 'appel 10:00', dot: '#C45A00', cta: 'Voir le contact', ctaIcon: 'user', price: "CHF 890'000", photo: PHOTO.carouge },
  { id: 'antoine', init: 'AP', av: '#34C796', name: 'Antoine Picard', role: 'Compromis', ctx: 'délai dépassé de 2 j', dot: '#F26B65', late: true, cta: 'Voir le dossier', ctaIcon: 'arrow', price: "CHF 1'850'000", photo: PHOTO.cologny },
  { id: 'julien', init: 'JA', av: '#E08A45', name: 'Julien Aebischer', role: 'Vendeur · mandat exclusif', ctx: 'signature à valider', dot: '#1E5BC6', cta: 'Préparer', ctaIcon: 'doc', price: "CHF 1'250'000", g1: '#262C3A', g2: '#181B22' },
]

export interface HlAnnData {
  id: string
  title: string
  price: string
  dot: string
  issue: string
  cta: string
  photo?: string
  g1?: string
  g2?: string
}

// ─── Mes annonces — actions de diffusion ────────────────────────────────
// ⚠️ Le motif C2PA de `a1` est un MOTIF DE DÉMO explicitement hors MVP (handoff
// §2.7). Le feed live ne produira que des motifs réels : brouillon incomplet,
// non poussée sur le portail, retours acheteurs.
export const HL_ANN: HlAnnData[] = [
  { id: 'a1', title: 'Villa Cologny', price: "CHF 1'850'000", dot: '#C45A00', issue: '2 photos sans certificat C2PA', cta: 'Certifier', photo: PHOTO.cologny },
  { id: 'a2', title: '4 p · Eaux-Vives', price: "CHF 1'250'000", dot: '#1E5BC6', issue: 'publique — pas encore sur Immobilier.ch', cta: 'Publier', g1: '#262C3A', g2: '#181B22' },
  { id: 'a3', title: 'Duplex · Plainpalais', price: "CHF 1'190'000", dot: '#797D90', issue: 'brouillon — description manquante', cta: 'Compléter', g1: '#2A2A30', g2: '#1B1B20' },
  { id: 'a4', title: '3.5 p · Carouge', price: "CHF 890'000", dot: '#059669', issue: 'diffusée — 2 likes cette semaine', cta: 'Voir les retours', photo: PHOTO.carouge },
]

export interface HlNewsData {
  id: string
  /** Présent dans le payload du handoff, mais `HlNewsCard` ne le rend pas —
   *  la maquette elle-même l'ignore. Optionnel pour ne pas forcer les sources
   *  réelles (`admin_changelog` n'a pas d'icône) à en inventer une. */
  icon?: string
  date: string
  year: string
  fresh?: boolean
  title: string
  desc: string
}
