export interface FloorPlanHotspot {
  id: string
  x: number // 0-100 (percentage)
  y: number // 0-100 (percentage)
  label: string
  roomKey: string
  photoUrls: string[]
}

export interface PhotoTag {
  url: string
  room: string
  isPrimary: boolean
}

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

export type RoomKey = typeof FLOOR_PLAN_ROOMS[number]['key']

export function getRoomLabel(key: string): string {
  return FLOOR_PLAN_ROOMS.find(r => r.key === key)?.label ?? key
}
