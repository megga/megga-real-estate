/**
 * Types et référentiel des plans interactifs d'un bien : hotspots cliquables
 * positionnés sur l'image du plan (renvoyant vers les photos d'une pièce) et
 * tags associant une photo à une pièce.
 */

/** Point cliquable sur le plan (coord. en % de l'image), lié à une pièce et ses photos. */
export interface FloorPlanHotspot {
  id: string
  x: number // 0-100 (percentage)
  y: number // 0-100 (percentage)
  label: string
  roomKey: string
  photoUrls: string[]
}

/** Photo rattachée à une pièce ; `isPrimary` désigne la photo de couverture. */
export interface PhotoTag {
  url: string
  room: string
  isPrimary: boolean
}

/** Référentiel des pièces (clé technique → label FR) proposées au tagging. */
export const FLOOR_PLAN_ROOMS = [
  { key: 'salon', label: 'Salon' },
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'chambre', label: 'Chambre' },
  { key: 'salle_de_bain', label: 'Salle de bain' },
  { key: 'bureau', label: 'Bureau' },
  { key: 'entree', label: 'Entrée' },
  { key: 'terrasse', label: 'Terrasse' },
  { key: 'garage', label: 'Garage' },
  { key: 'autre', label: 'Autre' },
] as const

/** Label FR d'une clé de pièce ; retourne la clé brute si inconnue. */
export function getRoomLabel(key: string): string {
  return FLOOR_PLAN_ROOMS.find(r => r.key === key)?.label ?? key
}
