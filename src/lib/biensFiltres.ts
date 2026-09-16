/**
 * Filtres et regroupements de « Mes biens » — la logique pure, sans écran.
 *
 * ⚖ Demandé par Julien le 16.09.2026 : un agent qui gère beaucoup de biens doit pouvoir
 * les CLASSER comme il travaille — par secteur, par agent, par agence (la sienne ou une
 * agence partenaire en co-mandat)… « il faut vraiment prendre tous les scénarios ».
 *
 * ⛔ AUCUNE DIMENSION INVENTÉE. Chacune lit une colonne réelle de `properties` :
 *   secteur → `canton`, `city` · agent → `created_by` · agence → `partner_agency`
 *   (NULL = l'agence du compte) · type, transaction, statut, mandat → leurs colonnes.
 * L'« agent » est celui qui a CRÉÉ le bien : la table ne porte pas d'agent attitré.
 */
import type { CrmBien } from '@/components/crm/mockData'

/** Les axes de classement. `secteur` range par canton, puis la ville se lit dans le libellé. */
export type DimensionBien = 'canton' | 'ville' | 'agent' | 'agence' | 'type' | 'transaction' | 'statut' | 'mandat'
export type GroupeBiens = 'aucun' | DimensionBien

export interface FiltresBiens {
  cantons: string[]
  villes: string[]
  agents: string[]
  /** `''` = l'agence du compte (aucune agence partenaire). */
  agences: string[]
  types: string[]
  transactions: string[]
  mandats: string[]
  prixMin: number | null
  prixMax: number | null
  piecesMin: number | null
  /** Mandat qui expire (ou a expiré) dans les `JOURS_MANDAT_BIENTOT` jours. */
  mandatBientot: boolean
}

export const FILTRES_VIDES: FiltresBiens = {
  cantons: [], villes: [], agents: [], agences: [], types: [], transactions: [], mandats: [],
  prixMin: null, prixMax: null, piecesMin: null, mandatBientot: false,
}

export const JOURS_MANDAT_BIENTOT = 60

/** Les agences partenaires connues du formulaire d'annonce — des noms propres, jamais traduits. */
export const AGENCES_PARTENAIRES: Record<string, string> = {
  naef: 'Naef Immobilier',
  cardis: "Cardis Sotheby's",
  bernard: 'Bernard Nicod',
}

/** Ordre de lecture des statuts quand on regroupe par statut (le plus « vivant » d'abord). */
const ORDRE_STATUTS = ['active', 'reserved', 'draft', 'paused', 'sold']

/** La valeur d'un bien sur un axe — la clé de filtre ET de groupe. Vide = non renseigné. */
export function valeurBien(b: CrmBien, dim: DimensionBien): string {
  switch (dim) {
    case 'canton': return b.canton ?? ''
    case 'ville': return b.city ?? ''
    case 'agent': return b.agentId ?? ''
    case 'agence': return b.partnerAgency ?? ''
    case 'type': return b.type
    case 'transaction': return b.transaction
    case 'statut': return b.status
    case 'mandat': return b.mandat.type
  }
}

const CLE_FILTRE: Record<Exclude<DimensionBien, 'statut'>, keyof FiltresBiens> = {
  canton: 'cantons', ville: 'villes', agent: 'agents', agence: 'agences', type: 'types', transaction: 'transactions', mandat: 'mandats',
}

/** Le prix qui se compare : la vente, sinon le loyer. */
const prixDe = (b: CrmBien) => b.price ?? b.rent ?? null

/** Garde les biens qui passent TOUS les critères posés ; un critère vide ne filtre rien. */
export function filtrerBiens(biens: CrmBien[], f: FiltresBiens, maintenant: number): CrmBien[] {
  return biens.filter((b) => {
    for (const [dim, cle] of Object.entries(CLE_FILTRE) as [Exclude<DimensionBien, 'statut'>, keyof FiltresBiens][]) {
      const choisis = f[cle] as string[]
      if (choisis.length > 0 && !choisis.includes(valeurBien(b, dim))) return false
    }
    const prix = prixDe(b)
    if (f.prixMin != null && (prix == null || prix < f.prixMin)) return false
    if (f.prixMax != null && (prix == null || prix > f.prixMax)) return false
    if (f.piecesMin != null && !(b.rooms >= f.piecesMin)) return false
    if (f.mandatBientot) {
      if (!b.mandat.expiresAt) return false
      const jours = (new Date(b.mandat.expiresAt).getTime() - maintenant) / 86_400_000
      if (jours > JOURS_MANDAT_BIENTOT) return false
    }
    return true
  })
}

/** Nombre de critères posés — le badge du bouton « Filtres ». */
export function nombreFiltresActifs(f: FiltresBiens): number {
  return (Object.values(CLE_FILTRE) as (keyof FiltresBiens)[]).reduce((n, cle) => n + (f[cle] as string[]).length, 0)
    + (f.prixMin != null ? 1 : 0) + (f.prixMax != null ? 1 : 0) + (f.piecesMin != null ? 1 : 0) + (f.mandatBientot ? 1 : 0)
}

/** Les valeurs présentes sur un axe, avec leur nombre de biens — ce que la palette propose. */
export function valeursPresentes(biens: CrmBien[], dim: DimensionBien): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of biens) {
    const v = valeurBien(b, dim)
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}

/**
 * Range les biens par groupe, dans un ordre de lecture : statuts dans leur ordre de vie,
 * les autres axes par libellé ; « non renseigné » toujours en dernier. L'ordre des biens
 * DANS un groupe est celui reçu (le tri choisi par l'agent).
 */
export function grouperBiens(biens: CrmBien[], dim: DimensionBien, libelle: (cle: string) => string, locale: string): { cle: string; libelle: string; biens: CrmBien[] }[] {
  const groupes = new Map<string, CrmBien[]>()
  for (const b of biens) {
    const v = valeurBien(b, dim)
    const g = groupes.get(v)
    if (g) g.push(b)
    else groupes.set(v, [b])
  }
  return [...groupes.entries()]
    .map(([cle, bs]) => ({ cle, libelle: libelle(cle), biens: bs }))
    .sort((a, b) => {
      // `agence` : la vide EST l'agence du compte — elle passe en tête, pas en queue.
      if (dim === 'agence' && (a.cle === '' || b.cle === '')) return a.cle === '' ? -1 : 1
      if (a.cle === '' || b.cle === '') return a.cle === '' ? 1 : -1
      if (dim === 'statut') return ORDRE_STATUTS.indexOf(a.cle) - ORDRE_STATUTS.indexOf(b.cle)
      return a.libelle.localeCompare(b.libelle, locale)
    })
}
