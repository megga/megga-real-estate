/**
 * Fixtures de l'ATELIER (page 0 du pager Matching) pour le banc
 * `/dev/matching-atelier` — mocks du handoff design (Carouge, acheteurs scorés).
 *
 * Extraites de la page de banc, qui couvre désormais le pager ENTIER : y laisser
 * 200 lignes de données noyait la mécanique du banc (les quatre états de chaque
 * page) sous le contenu d'une seule d'entre elles.
 *
 * ⛔ Rien ne vient de la base, aucune écriture. La moitié « Recherche » a les
 * siennes dans `matching-recherche/mrhDemo.ts` — elles vivent auprès du
 * composant parce qu'il les consomme lui-même (mode `demo`), alors que
 * l'atelier, présentationnel, se nourrit par ses props.
 */
import type {
  AtelierBuyer, AtelierListing, AtelierPivot, AtelierPoolMatch, AtelierReason,
} from '@/components/matching-atelier/types'

const PHOTO = (id: string, n = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${n}&q=80&auto=format&fit=crop`

const ROOM_LABELS = [
  { room: 'Séjour', label: 'Séjour traversant' },
  { room: 'Séjour', label: 'Coin salon' },
  { room: 'Séjour', label: 'Salon ouvert' },
  { room: 'Cuisine', label: 'Salle à manger' },
  { room: 'Cuisine', label: 'Cuisine équipée' },
  { room: 'Cuisine', label: 'Coin repas' },
  { room: 'Chambres', label: 'Chambre parentale' },
  { room: 'Chambres', label: 'Chambre 2' },
]

export const ATELIER_LISTING: AtelierListing = {
  key: 'm:demo-b-103',
  id: 'demo-b-103',
  kind: 'market',
  ref: 'MG-FL-4827193',
  title: '5 pièces familial — Carouge',
  addr: 'Rue Ancienne 6, 1227 Carouge',
  canton: 'GE',
  lat: 46.1817,
  lng: 6.1397,
  price: 1100000,
  priceWas: 1145000,
  pricePerM2: 9166.67,
  charges: 420,
  type: 'Appartement',
  transaction: 'Vente',
  rooms: 5,
  area: 120,
  beds: 3,
  baths: 2,
  year: 1996,
  floor: 3,
  lift: true,
  features: ['Balcon', 'Cave', 'Parking', 'Ascenseur', 'Parquet'],
  photos: 8,
  gallery: [
    '1502672260266-1c1ef2d93688', '1493809842364-78817add7ffb', '1560448204-e02f11c3d0e2',
    '1522708323590-d24dbb6b0267', '1484154218962-a197022b5858', '1554995207-c18c203602cb',
    '1567016432779-094069958ea5', '1560185007-cde436f6a4d0',
  ].map((id, i) => ({ url: PHOTO(id), room: ROOM_LABELS[i]?.room ?? 'Photos', label: ROOM_LABELS[i]?.label ?? `Photo ${i + 1}` })),
  desc: "Appartement traversant de 120 m² au cœur du Vieux-Carouge. Séjour lumineux ouvert sur balcon plein sud, trois chambres, deux salles d'eau. Cave et place de parc en sus. Proche écoles, marché et tram.",
  quartier: 'Carouge',
  daysOnMarket: 12,
  qualityScore: 92,
  agency: { name: 'Régie du Rhône SA', phone: '+41 22 819 44 00' },
  sourceUrl: null,
  firstSeenAt: '2026-05-29T08:12:00.000Z',
  isFurnished: false,
}

const r = (label: string, detail: string, pts: number, ok: boolean): AtelierReason => ({ label, detail, pts, ok })

function buyer(p: {
  id: string; first: string; last: string; av: string; type: string
  budget: string; zone: string; kyc: AtelierBuyer['kyc']; status: AtelierBuyer['status']
  engage: string; score: number; ai: string; reasons: AtelierReason[]
}): AtelierBuyer {
  return {
    ...p,
    matchId: `demo-match-${p.id}`,
    email: null,
    phone: null,
    language: null,
    snoozedUntil: null,
    criteria: { budget_min: 900000, budget_max: 1300000, zones: ['Carouge'], type: 'Appartement', rooms_min: 4, surface_min: 90 },
    source: 'market',
    sentAt: p.status === 'no-reply' ? '2026-06-04T10:00:00.000Z' : null,
  }
}

export const ATELIER_BUYERS: AtelierBuyer[] = [
  buyer({
    id: 'c-001', first: 'Marie', last: 'Bertrand', av: '#5b6cff', type: 'Acheteuse',
    budget: '0,9–1,3M', zone: 'Carouge', kyc: 'verified', status: 'engaged',
    engage: 'A visité un bien', score: 94,
    ai: "Marie a visité un 5 pièces à Carouge la semaine dernière. Relance à chaud — c'est le moment.",
    reasons: [
      r('Budget', '1,1M dans sa fourchette 0,9–1,3M', 25, true),
      r('Quartier favori', 'Carouge explicitement ciblé', 20, true),
      r('Surface', '120 m² ≥ 90 m² souhaités', 20, true),
      r('Type', 'Appartement', 15, true),
      r('Pièces', '5 ≥ 4 demandées', 10, true),
      r('Année', '1996 — souhaitait plus récent', -5, false),
    ],
  }),
  buyer({
    id: 'c-020', first: 'Sophie', last: 'Marchand', av: '#8B5CF6', type: 'Acheteuse',
    budget: '1–1,4M', zone: 'Carouge / PLO', kyc: 'verified', status: 'to-send',
    engage: 'Nouveau match', score: 91,
    ai: 'Profil quasi-idéal sur tous les axes. Aucun frein KYC — dossier envoyable immédiatement.',
    reasons: [
      r('Budget', '1,1M dans 1–1,4M', 25, true),
      r('Surface', '120 m² ≥ 100 m²', 20, true),
      r('Quartier', 'Carouge ciblé', 18, true),
      r('Type', 'Appartement', 15, true),
      r('Pièces', '5 — cible 4–5', 13, true),
    ],
  }),
  buyer({
    id: 'c-021', first: 'David', last: 'Rey', av: '#2370ff', type: 'Acheteur',
    budget: '0,9–1,2M', zone: 'Rive gauche', kyc: 'pending', status: 'to-send',
    engage: 'Nouveau match', score: 84,
    ai: "Balcon plein sud = critère must-have coché. KYC en cours, sans blocage pour l'envoi.",
    reasons: [
      r('Budget', '1,1M dans 0,9–1,2M', 22, true),
      r('Surface', '120 m² ≥ 95 m²', 18, true),
      r('Type', 'Appartement', 15, true),
      r('Pièces', '5 ≥ 4', 12, true),
      r('Quartier', 'Carouge proche rive gauche', 8, true),
      r('Année', '1996 — préférait < 2000 limite', -5, false),
    ],
  }),
  buyer({
    id: 'c-003', first: 'Élodie', last: 'Schmidt', av: '#1abcfe', type: 'Primo-accédante',
    budget: '0,75–1,1M', zone: 'Eaux-Vives', kyc: 'none', status: 'engaged',
    engage: 'A aimé un bien', score: 80,
    ai: 'Lead pré-qualifié par MEGGA AI. KYC non démarré — rappel doux avant toute offre.',
    reasons: [
      r('Surface', '120 m² ≥ 75 m²', 20, true),
      r('Pièces', '5 ≥ 3', 15, true),
      r('Type', 'Appartement', 15, true),
      r('Budget', '1,1M = plafond exact', 15, true),
      r('Quartier', 'Visait Eaux-Vives, pas Carouge', -8, false),
    ],
  }),
  buyer({
    id: 'c-022', first: 'Laura', last: 'Conti', av: '#e0795f', type: 'Acheteuse',
    budget: '0,8–1,15M', zone: 'Carouge', kyc: 'verified', status: 'no-reply',
    engage: 'Envoyé · sans retour', score: 76,
    ai: 'Dossier envoyé il y a 6 jours, aucune ouverture. Tenter un autre canal (téléphone).',
    reasons: [
      r('Quartier favori', 'Carouge ciblé', 20, true),
      r('Surface', '120 m² ≥ 85 m²', 18, true),
      r('Type', 'Appartement', 15, true),
      r('Budget', '1,1M — haut de fourchette', 12, true),
      r('Pièces', '5 — cible 3–4', 10, true),
      r('Année', '1996 — souhaitait récent', -5, false),
    ],
  }),
  buyer({
    id: 'c-023', first: 'Thomas', last: 'Berger', av: '#74d184', type: 'Investisseur',
    budget: '1–1,5M', zone: 'GE — rendement', kyc: 'verified', status: 'to-send',
    engage: 'Nouveau match', score: 72,
    ai: "Profil investisseur : présenter sous l'angle rendement locatif plutôt que résidence principale.",
    reasons: [
      r('Budget', '1,1M dans 1–1,5M', 20, true),
      r('Type', 'Appartement', 15, true),
      r('Surface', '120 m²', 15, true),
      r('Quartier', 'Carouge — bon locatif', 10, true),
      r('Pièces', '5', 8, true),
      r('Motivation', 'Cherche du rendement, pas une résidence', -12, false),
    ],
  }),
  buyer({
    id: 'c-025', first: 'Marco', last: 'Felli', av: '#679cff', type: 'Acheteur',
    budget: '1–1,3M', zone: 'Genève', kyc: 'stale', status: 'no-reply',
    engage: 'Envoyé · sans retour', score: 64,
    ai: 'Vérification KYC expirée. À re-screener avant de relancer activement.',
    reasons: [
      r('Budget', '1,1M dans 1–1,3M', 20, true),
      r('Type', 'Appartement', 15, true),
      r('Pièces', '5', 12, true),
      r('Surface', '120 m²', 12, true),
      r('Quartier', 'Carouge accepté', 5, true),
    ],
  }),
  buyer({
    id: 'c-029', first: 'Karim', last: 'Haddad', av: '#c98a3a', type: 'Acheteur',
    budget: '0,7–0,95M', zone: 'Genève', kyc: 'none', status: 'to-send',
    engage: 'Nouveau match', score: 48,
    ai: 'Hors budget et trop grand pour son besoin. Faible probabilité — à dé-prioriser.',
    reasons: [
      r('Type', 'Appartement', 15, true),
      r('Quartier', 'Carouge accepté', 10, true),
      r('Budget', '1,1M > plafond 0,95M (+150k)', -10, false),
      r('Pièces', '5 — souhaitait 2–3', -8, false),
      r('Surface', '120 m² au-delà du besoin', -5, false),
    ],
  }),
]

/** Pool « par acheteur » : l'annonce pivot + 2 biens de veille (statique, QA). */
const POOL_EXTRA: AtelierListing[] = [
  {
    ...ATELIER_LISTING,
    key: 'm:demo-p-201', id: 'demo-p-201', ref: 'MG-FL-4831077',
    title: '4 pièces avec terrasse — Carouge',
    addr: 'Rue Jacques-Dalphin 22, 1227 Carouge',
    lat: 46.1809, lng: 6.1372,
    price: 980000, priceWas: null, pricePerM2: 10000, charges: 380,
    rooms: 4, area: 98, beds: 2, baths: 1, year: 2005, floor: 5,
    features: ['Terrasse', 'Ascenseur', 'Cave', 'Parquet'], photos: 11,
    gallery: ['1493663284031-b7e3aefcae8e', '1505691938895-1758d7feb511'].map((id, i) => ({ url: PHOTO(id), room: 'Photos', label: `Photo ${i + 1}` })),
    desc: 'Dernier étage avec terrasse de 18 m², séjour sud, deux chambres. Cave et ascenseur.',
    daysOnMarket: 4, qualityScore: 88, agency: { name: 'Naef Immobilier', phone: '+41 22 839 39 39' },
  },
  {
    ...ATELIER_LISTING,
    key: 'm:demo-p-204', id: 'demo-p-204', ref: 'MG-FL-4825903',
    title: '5 pièces rénové — Plainpalais',
    addr: 'Boulevard des Philosophes 9, 1205 Genève',
    lat: 46.1976, lng: 6.1428,
    price: 1180000, priceWas: 1220000, pricePerM2: 10260, charges: 450,
    rooms: 5, area: 115, beds: 3, baths: 2, year: 1908, floor: 3,
    features: ['Ascenseur', 'Cave', 'Parquet', 'Balcon'], photos: 12,
    gallery: ['1554995207-c18c203602cb', '1560185007-cde436f6a4d0'].map((id, i) => ({ url: PHOTO(id), room: 'Photos', label: `Photo ${i + 1}` })),
    desc: 'Rénovation complète 2021, cuisine ouverte, trois chambres, proche Uni et tram.',
    quartier: 'Plainpalais',
    daysOnMarket: 14, qualityScore: 90, agency: { name: 'Moser Vernet & Cie', phone: '+41 22 839 09 00' },
  },
]

export const ATELIER_PIVOT: AtelierPivot = {
  listing: ATELIER_LISTING,
  buyers: ATELIER_BUYERS,
  actionable: ATELIER_BUYERS.length,
}

/** Les biens proposés à UN acheteur pivot (mode « Par acheteur »). */
export function atelierPoolFor(contactId: string): AtelierPoolMatch[] {
  const b = ATELIER_BUYERS.find((x) => x.id === contactId)
  if (!b) return []
  return [
    { matchId: b.matchId, lid: ATELIER_LISTING.key, L: ATELIER_LISTING, score: b.score, reasons: b.reasons, current: true, snoozedUntil: null, status: 'to-send' as const },
    {
      matchId: `demo-pool-1-${contactId}`, lid: POOL_EXTRA[0].key, L: POOL_EXTRA[0], score: 78,
      reasons: [
        r('Budget', '0,98M dans sa fourchette', 25, true),
        r('Quartier', 'Carouge ciblé', 18, true),
        r('Type', 'Appartement', 15, true),
        r('Surface', '98 m² — proche du souhait', 12, true),
        r('Pièces', '4 — minimum demandé', 8, true),
      ],
      current: false, snoozedUntil: null, status: 'to-send' as const,
    },
    {
      matchId: `demo-pool-2-${contactId}`, lid: POOL_EXTRA[1].key, L: POOL_EXTRA[1], score: 64,
      reasons: [
        r('Surface', '115 m² ≥ souhait', 18, true),
        r('Type', 'Appartement', 15, true),
        r('Pièces', '5', 13, true),
        r('Budget', '1,18M — haut de fourchette', 10, true),
        r('Quartier', 'Plainpalais hors zones cibles', -6, false),
      ],
      current: false, snoozedUntil: null, status: 'to-send' as const,
    },
  ].sort((a, z) => z.score - a.score)
}
