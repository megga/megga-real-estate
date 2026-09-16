/**
 * « Nouveau bien » — ce qui est rempli, ce qui manque, et ce que l'agent verra.
 *
 * Logique pure, partagée par la jauge de l'aperçu et les boutons du pied : la jauge ne
 * peut pas dire « prêt » quand le bouton « Publier » refuse, ni l'inverse.
 *
 * ⚠ Les conditions de publication sont celles de l'ancien wizard (≥ 5 photos pour une
 * mise en ligne) : deux parcours de création qui publient sous deux règles, c'est un
 * agent qui ne comprend plus pourquoi l'un refuse ce que l'autre accepte.
 */
import type { CrmBien } from '@/components/crm/mockData'
import type { WizardData } from '@/components/crm-wizard/tokens'

export type ClePoint = 'adresse' | 'bien' | 'prix' | 'photos' | 'description' | 'vendeur' | 'mandat'

export interface PointCompletude {
  cle: ClePoint
  /** L'étape où l'agent le remplit (0 Le bien · 1 Photos · 2 Annonce · 3 Mandat). */
  etape: 0 | 1 | 2 | 3
  fait: boolean
  /** Sans lui, pas de mise en ligne (l'enregistrement sans publier reste possible). */
  requisPublication: boolean
}

export const PHOTOS_MIN_PUBLICATION = 5
export const DESCRIPTION_MIN = 200

/** L'adresse compte dès qu'elle est confirmée par la recherche, ou saisie avec NPA et localité. */
export const adresseRemplie = (d: WizardData) =>
  d.addr.trim() !== '' && (!!d.addrConfirmed || (d.postCode.trim() !== '' && (d.city ?? '').trim() !== ''))

export function pointsCompletude(d: WizardData): PointCompletude[] {
  const terrain = d.type === 'terrain'
  return [
    { cle: 'adresse', etape: 0, fait: adresseRemplie(d), requisPublication: true },
    // Un terrain n'a ni pièces ni chambres : sa surface suffit.
    { cle: 'bien', etape: 0, fait: !!d.area && (terrain || !!d.rooms), requisPublication: false },
    { cle: 'prix', etape: 0, fait: d.transaction === 'location' ? !!d.rent : !!d.price, requisPublication: true },
    { cle: 'photos', etape: 1, fait: d.photos.length >= PHOTOS_MIN_PUBLICATION, requisPublication: true },
    { cle: 'description', etape: 2, fait: d.description.trim().length >= DESCRIPTION_MIN, requisPublication: false },
    { cle: 'vendeur', etape: 3, fait: !!d.ownerContactId, requisPublication: false },
    { cle: 'mandat', etape: 3, fait: !!d.mandate?.type && (d.mandate.commission ?? 0) > 0, requisPublication: false },
  ]
}

/** Part des points faits, en pourcentage entier. */
export const pourcentageCompletude = (points: PointCompletude[]) =>
  Math.round((points.filter((p) => p.fait).length / points.length) * 100)

/** Ce qui empêche encore la mise en ligne — vide = « Publier » est permis. */
export const manquesPublication = (points: PointCompletude[]) =>
  points.filter((p) => p.requisPublication && !p.fait).map((p) => p.cle)

/**
 * La carte telle qu'elle apparaîtra dans « Mes biens », construite depuis la saisie —
 * c'est la MÊME carte (`GalCard`) qui la rend, pas une imitation.
 */
export function apercuBien(d: WizardData, titre: string): CrmBien {
  const location = d.transaction === 'location'
  const typeCarte: Record<WizardData['type'], CrmBien['type']> = {
    appartement: 'appartement', attique: 'appartement', duplex: 'appartement', triplex: 'appartement', loft: 'appartement',
    maison: 'maison', villa: 'villa', chalet: 'maison', terrain: 'land', commerce: 'commercial',
  }
  const couverture = d.photos[0]
  return {
    id: 'apercu', ref: '', status: 'draft', type: typeCarte[d.type], transaction: location ? 'location' : 'vente',
    title: titre,
    addr: [d.addrStreet ? `${d.addrStreet} ${d.addrHouseNumber ?? ''}`.trim() : null, d.city].filter(Boolean).join(', ') || d.addr,
    canton: d.cantonShort ?? '', city: d.city,
    price: location ? null : d.price, rent: location ? d.rent : null, charges: d.charges,
    area: d.area ?? 0, rooms: d.rooms ?? 0, beds: d.bedrooms ?? 0, baths: d.bathrooms ?? 0, year: d.year ?? 0, energy: d.energy ?? '',
    ownerContactId: d.ownerContactId, mandat: { type: d.mandate?.type === 'exclusive' ? 'exclusif' : 'simple' },
    visibility: 'agency', stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: d.photos.length, signedPhotoCount: 0,
    coverPhoto: couverture ? couverture.previewUrl ?? couverture.url ?? null : null,
    accent: '', partnerAgency: d.partnerAgency ?? null,
  }
}

/** Un nombre saisi → nombre ou `null` (apostrophe et virgule suisses acceptées). */
export function lireNombre(v: string): number | null {
  const n = parseFloat(v.replace(/[’'\s]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
