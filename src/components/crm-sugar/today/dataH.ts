// MEGGA CRM — Today V2 « concept H » · PALETTE ET FORMES.
// ----------------------------------------------------------------------------
// Ce module ne contient PLUS aucune donnée de démonstration : tous les blocs de
// la page sont servis par Supabase (lots 0 à 3). Il ne reste que
//   · la palette fonctionnelle, calquée sur le Calendrier ;
//   · les FORMES que les composants lisent, produites par les hooks.
//
// Les constantes `HL_*` du prototype ont été retirées au fur et à mesure de leur
// hydratation : BLOCKS/FREE/NEWS au Lot 0, SIGNALS/GROUPS au Lot 1, HOT/ANN au
// Lot 3. Ne pas les réintroduire : un repli silencieux sur la démo ferait passer
// des personas pour le portefeuille de l'agent.

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
