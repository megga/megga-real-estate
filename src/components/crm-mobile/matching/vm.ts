// Matching mobile — view-models + mappers + données de démo.
//
// Découple la présentation des rows de l'atelier : le composant ne lit QUE ces
// VM (testable + harnais-friendly). `pivotsToGroups` aplatit les pivots (par
// annonce) en groupes par ACHETEUR (inbox mobile), `poolToFocus` projette le
// pool d'un acheteur. Aucune dépendance i18n ici (les libellés sont résolus par
// les composants via `t()` ; seul `mmPriceLabel` reçoit `t` pour « /mois »).

import type { TFunction } from 'i18next'
import { isSnoozed } from '@/hooks/useAtelierMatching'
import type {
  AtelierBuyer,
  AtelierKyc,
  AtelierPivot,
  AtelierPoolMatch,
  AtelierTab,
} from '@/components/matching-atelier/types'

// ─── View-models ─────────────────────────────────────────────────────────
export interface BuyerGroupVM {
  /** contact id */
  id: string
  first: string
  last: string
  /** couleur avatar (identité, jamais accent UI) */
  av: string
  kyc: AtelierKyc
  /** meilleur score (interne — sert au verdict qualitatif, jamais affiché brut) */
  topScore: number
  bienCount: number
  coverUrl: string | null
  /** onglet d'engagement du groupe */
  tab: AtelierTab
  /** tous les matchId actionnables de l'acheteur (un par bien) — gestes liste */
  matchIds: string[]
}

export interface FocusBuyerVM {
  id: string
  first: string
  last: string
  av: string
  kyc: AtelierKyc
  /** bien interne ? (visite proposable uniquement sur properties) */
  budgetMin: number | null
  budgetMax: number | null
  zones: string[]
  surfaceMin: number | null
  roomsMin: number | null
  type: string | null
  source: 'internal' | 'market'
}

export interface PoolMatchVM {
  matchId: string
  listingId: string
  kind: 'property' | 'market'
  title: string
  addr: string
  price: number
  transaction: 'Vente' | 'Location'
  score: number
  coverUrl: string | null
  /** dossier déjà transmis ? (initialise l'état « Envoyé » du focus) */
  alreadySent: boolean
}

export interface FocusVM {
  buyer: FocusBuyerVM
  pool: PoolMatchVM[]
}

// ─── Verdict qualitatif (le score chiffré reste interne) ───────────────────
export type VerdictKey = 'excellent' | 'veryGood' | 'good' | 'explore'
export const verdictKey = (score: number): VerdictKey =>
  score >= 90 ? 'excellent' : score >= 75 ? 'veryGood' : score >= 60 ? 'good' : 'explore'

// ─── Prix lisible (mêmes règles que le proto) ──────────────────────────────
const CHF_THIN = '’'
function mmShort(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return `${n}`
}
function mmCHF(n: number): string {
  return 'CHF ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, CHF_THIN)
}
/** « CHF 850k » (vente) · « CHF 3'200 / mois » (location). `t` pour le suffixe. */
export function mmPriceLabel(
  price: number,
  transaction: 'Vente' | 'Location',
  t: TFunction,
): string {
  if (!price) return ''
  if (transaction === 'Location') return t('atelier.perMonth', { value: mmCHF(price) })
  return `CHF ${mmShort(price)}`
}
/** Budget lisible compact (« CHF 800k – 1.2M »). */
export function mmBudgetLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `CHF ${mmShort(min)} – ${mmShort(max)}`
  if (max != null) return `CHF ${mmShort(max)}`
  if (min != null) return `CHF ${mmShort(min)}`
  return null
}

// ─── Classification d'onglet d'un groupe (mirroir de mmTabOf, statuts réels) ─
function groupTab(statuses: AtelierBuyer['status'][]): AtelierTab {
  if (statuses.some((s) => s === 'engaged')) return 'engaged'
  if (statuses.some((s) => s === 'to-send')) return 'to-send'
  if (statuses.length > 0 && statuses.every((s) => s === 'no-reply')) return 'no-reply'
  return 'to-send'
}

// ─── Mappers (réels) ───────────────────────────────────────────────────────
interface BuyerRecord {
  buyer: AtelierBuyer
  coverUrl: string | null
}

/** Aplatit les pivots (par annonce) en groupes par acheteur, score desc.
 *  Exclut les matches reportés (snoozed) — file cohérente avec le desktop. */
export function pivotsToGroups(pivots: AtelierPivot[]): BuyerGroupVM[] {
  const byContact = new Map<string, BuyerRecord[]>()
  for (const g of pivots) {
    for (const b of g.buyers) {
      if (isSnoozed(b.snoozedUntil)) continue
      const rec: BuyerRecord = { buyer: b, coverUrl: g.listing.gallery[0]?.url ?? null }
      const arr = byContact.get(b.id)
      if (arr) arr.push(rec)
      else byContact.set(b.id, [rec])
    }
  }

  const groups: BuyerGroupVM[] = []
  for (const recs of byContact.values()) {
    // tri par score desc → le premier porte la photo de couverture
    recs.sort((a, z) => z.buyer.score - a.buyer.score)
    const top = recs[0]
    groups.push({
      id: top.buyer.id,
      first: top.buyer.first,
      last: top.buyer.last,
      av: top.buyer.av,
      kyc: top.buyer.kyc,
      topScore: top.buyer.score,
      bienCount: recs.length,
      coverUrl: top.coverUrl,
      tab: groupTab(recs.map((r) => r.buyer.status)),
      matchIds: recs.map((r) => r.buyer.matchId),
    })
  }
  return groups.sort((a, z) => z.topScore - a.topScore)
}

/** Projette buyer + pool (poolFor) en FocusVM, biens reportés exclus. */
export function poolToFocus(buyer: AtelierBuyer, pool: AtelierPoolMatch[]): FocusVM {
  const crit = buyer.criteria
  return {
    buyer: {
      id: buyer.id,
      first: buyer.first,
      last: buyer.last,
      av: buyer.av,
      kyc: buyer.kyc,
      budgetMin: crit?.budget_min ?? null,
      budgetMax: crit?.budget_max ?? null,
      zones: crit?.zones ?? [],
      surfaceMin: crit?.surface_min ?? null,
      roomsMin: crit?.rooms_min ?? null,
      type: crit?.type ?? null,
      source: buyer.source,
    },
    pool: pool
      .filter((p) => !isSnoozed(p.snoozedUntil))
      .map((p) => ({
        matchId: p.matchId,
        listingId: p.L.id,
        kind: p.L.kind,
        title: p.L.title,
        addr: p.L.addr,
        price: p.L.price,
        transaction: p.L.transaction,
        score: p.score,
        coverUrl: p.L.gallery[0]?.url ?? null,
        alreadySent: p.status !== 'to-send',
      })),
  }
}

// ─── Démo (harnais /dev/mobile, no-auth) ───────────────────────────────────
// Personas fictifs — aucune donnée réelle, aucun geste n'écrit en mode démo.
const U = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80`

export const DEMO_GROUPS: BuyerGroupVM[] = [
  { id: 'b1', first: 'Marie', last: 'Bertrand', av: '#0041D9', kyc: 'verified', topScore: 94, bienCount: 3, coverUrl: U('photo-1568605114967-8130f3a36994'), tab: 'to-send', matchIds: ['m1a', 'm1b', 'm1c'] },
  { id: 'b2', first: 'Antoine', last: 'Picard', av: '#C45A00', kyc: 'pending', topScore: 88, bienCount: 2, coverUrl: U('photo-1512917774080-9991f1c4c750'), tab: 'engaged', matchIds: ['m2a', 'm2b'] },
  { id: 'b3', first: 'Nadia', last: 'Berset', av: '#0891B2', kyc: 'none', topScore: 72, bienCount: 4, coverUrl: U('photo-1502672260266-1c1ef2d93688'), tab: 'no-reply', matchIds: ['m3a', 'm3b', 'm3c', 'm3d'] },
  { id: 'b4', first: 'Olivier', last: 'Marchand', av: '#6366F1', kyc: 'verified', topScore: 61, bienCount: 1, coverUrl: U('photo-1493809842364-78817add7ffb'), tab: 'to-send', matchIds: ['m4a'] },
]

export const DEMO_FOCUS: Record<string, FocusVM> = {
  b1: {
    buyer: { id: 'b1', first: 'Marie', last: 'Bertrand', av: '#0041D9', kyc: 'verified', budgetMin: 950000, budgetMax: 1200000, zones: ['Carouge', 'Plainpalais'], surfaceMin: 110, roomsMin: 5, type: 'Appartement', source: 'internal' },
    pool: [
      { matchId: 'm1a', listingId: 'p1', kind: 'property', title: '5 pièces familial', addr: 'Rue Ancienne 12, Carouge', price: 1100000, transaction: 'Vente', score: 94, coverUrl: U('photo-1568605114967-8130f3a36994'), alreadySent: false },
      { matchId: 'm1b', listingId: 'p2', kind: 'property', title: '5,5 pièces avec jardin', addr: 'Av. Cardinal-Mermillod, Carouge', price: 1180000, transaction: 'Vente', score: 81, coverUrl: U('photo-1576941089067-2de3c901e126'), alreadySent: false },
      { matchId: 'm1c', listingId: 'p3', kind: 'property', title: '5 pièces rénové', addr: 'Bd du Pont-d’Arve, Plainpalais', price: 980000, transaction: 'Vente', score: 66, coverUrl: U('photo-1493809842364-78817add7ffb'), alreadySent: false },
    ],
  },
  b2: {
    buyer: { id: 'b2', first: 'Antoine', last: 'Picard', av: '#C45A00', kyc: 'pending', budgetMin: 3000000, budgetMax: 4200000, zones: ['Cologny'], surfaceMin: 200, roomsMin: 7, type: 'Villa', source: 'internal' },
    pool: [
      { matchId: 'm2a', listingId: 'p4', kind: 'property', title: 'Villa contemporaine', addr: 'Route de la Capite, Cologny', price: 3850000, transaction: 'Vente', score: 88, coverUrl: U('photo-1512917774080-9991f1c4c750'), alreadySent: true },
      { matchId: 'm2b', listingId: 'p5', kind: 'property', title: 'Villa avec piscine', addr: 'Chemin de Ruth, Cologny', price: 4050000, transaction: 'Vente', score: 77, coverUrl: U('photo-1613490493576-7fde63acd811'), alreadySent: false },
    ],
  },
  b3: {
    buyer: { id: 'b3', first: 'Nadia', last: 'Berset', av: '#0891B2', kyc: 'none', budgetMin: null, budgetMax: 3200, zones: ['Pâquis', 'Eaux-Vives'], surfaceMin: 70, roomsMin: 3, type: 'Appartement', source: 'market' },
    pool: [
      { matchId: 'm3a', listingId: 'm10', kind: 'market', title: '3 pièces meublé', addr: 'Rue de Berne, Pâquis', price: 3100, transaction: 'Location', score: 72, coverUrl: U('photo-1502672260266-1c1ef2d93688'), alreadySent: true },
      { matchId: 'm3b', listingId: 'm11', kind: 'market', title: '3,5 pièces lumineux', addr: 'Rue du Rhône, Eaux-Vives', price: 3250, transaction: 'Location', score: 64, coverUrl: U('photo-1522708323590-d24dbb6b0267'), alreadySent: false },
    ],
  },
  b4: {
    buyer: { id: 'b4', first: 'Olivier', last: 'Marchand', av: '#6366F1', kyc: 'verified', budgetMin: 650000, budgetMax: 800000, zones: ['Servette'], surfaceMin: 90, roomsMin: 4, type: 'Appartement', source: 'internal' },
    pool: [
      { matchId: 'm4a', listingId: 'p6', kind: 'property', title: '4 pièces', addr: 'Rue de la Servette, Genève', price: 720000, transaction: 'Vente', score: 61, coverUrl: U('photo-1493809842364-78817add7ffb'), alreadySent: false },
    ],
  },
}
