/**
 * Données de démonstration partagées par les harnais d'aperçu (`/dev/*`).
 *
 * ⛔ Rien ici ne vient de la base et rien ne doit y ressembler à un vrai bien
 * d'agence : ces objets servent à vérifier une composition sans session, pas à
 * simuler un portefeuille.
 *
 * ⚠ Une SEULE fixture partagée. `DEMO_LISTING` vivait dans
 * `MobileShowcasePage.tsx` ; l'aperçu bureau en aurait recopié une variante, et
 * les deux auraient divergé au premier champ ajouté — c'est exactement ce qui
 * est arrivé à la carte des types du wizard (`villa` valait `'villa'` d'un côté
 * et `'house'` de l'autre).
 */
import type { Property } from '@/types/listing'
import { CRM_CONTACTS, type CrmContact } from '@/components/crm-sugar/mockData'
import type {
  FicheContact, FicheLoopItem, FicheNba, FicheReceptionLink,
} from '@/components/crm-sugar/contacts-pager/ContactDetailPager'

export const DEMO_LISTING: Property = {
  id: 'p3', agency_id: 'ag', title: 'Villa contemporaine', description: 'Villa lumineuse de 240 m² avec piscine, vue dégagée, finitions haut de gamme. Quartier résidentiel calme à Cologny, proche des écoles internationales.',
  type: 'villa', status: 'active', price: 3850000, currency: 'CHF', rooms: 7, bedrooms: 5, bathrooms: 3, surface_m2: 240,
  year_built: 2019, charges_monthly: 0, mandate_type: 'Exclusif', energy_class: 'A', mandate_commission_pct: 3, mandate_signed_at: '2026-05-02', mandate_expires_at: '2026-11-02',
  transaction_type: 'buy', address: 'Route de la Capite 12', city: 'Cologny', canton: 'GE', postal_code: '1223', lat: 46.22, lng: 6.18,
  photos: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80'],
  c2pa_verified: true, features: ['Piscine', 'Jardin', 'Garage', 'Cave'], created_by: 'u', created_at: '2026-05-02', published_at: '2026-05-04',
}

/**
 * Contacts de démonstration — `CRM_CONTACTS` COMPLÉTÉ pour que le banc montre
 * les éléments FRAGILES.
 *
 * ⛔ C'est la leçon de `/dev/biens`, qui n'affichait aucune pastille de score
 * faute de `health` dans ses données : un harnais qui cache précisément
 * l'élément défectueux coûte plus cher qu'il ne rapporte. Ici les deux éléments
 * à mesurer sont l'AVATAR (huit teintes de `pickAvatarBg`, dont cinq échouent
 * l'AA sous encre blanche) et la PILULE de type (`CTP_FN`, quatre valeurs).
 *
 * `CRM_CONTACTS` seul en montre l'essentiel mais pas tout — mesuré, pas supposé :
 * sept teintes d'avatar sur huit (#EC4899 manque), et trois KYC sur quatre
 * (`stale` manque). Les TROIS pilules sortent en revanche déjà, ce qui n'allait
 * pas de soi : `type` n'y vaut que `buyer` ou `seller`, et c'est
 * `criteria.transaction === 'location'` qui fait basculer un acheteur sur la
 * pilule `tenant` (cf. `audienceOf`). Compter les `type` aurait conclu à tort
 * qu'il manquait une audience.
 *
 * Les deux contacts ajoutés ferment ce qui reste : la huitième teinte, le KYC
 * `stale`, et le type `landlord` — qui ne crée pas de quatrième pilule (il
 * retombe sur `seller`) mais donne son `audience: 'Bailleur'` à la fiche.
 */
const DEMO_CONTACTS_COMPLEMENT: CrmContact[] = [
  // Locataire par le `type` (et non par ses critères, comme les autres) — plus
  // la huitième teinte d'avatar (#EC4899) et le KYC `stale`.
  {
    id: 'c-d01', type: 'tenant', firstName: 'Sofia', lastName: 'Marchetti',
    email: 's.marchetti@bluewin.ch', phone: '+41 76 318 40 55', lang: 'it',
    status: 'qualified', score: 66, source: 'website', assignedTo: 'agt-1',
    createdAt: '2026-05-04T10:15:00', lastActivityAt: '2026-06-02T16:40:00',
    kyc: { status: 'stale', riskLevel: 'low', expiresAt: '2026-05-20' },
    criteria: { transaction: 'location', types: ['appartement'], cantons: ['VD'], cities: ['Lausanne'], budgetMax: 3200, roomsMin: 3 },
    tags: ['mobilité pro'], notes: 'Arrive de Milan pour un poste à l’EPFL. Bail souhaité au 1er septembre.',
    avatarBg: '#EC4899',
  },
  // Bailleur — l'audience `Bailleur` de la fiche, qui retombe sur la pilule
  // `seller`. La teinte reprend #F59E0B À DESSEIN : c'est la pire du jeu sous
  // encre blanche (2,15:1), autant qu'elle soit visible deux fois.
  {
    id: 'c-d02', type: 'landlord', firstName: 'Bernard', lastName: 'Held',
    email: 'b.held@swissonline.ch', phone: '+41 79 604 27 18', lang: 'de',
    status: 'active', score: 78, source: 'referral', assignedTo: 'agt-1',
    createdAt: '2026-02-11T08:30:00', lastActivityAt: '2026-06-05T09:05:00',
    kyc: { status: 'verified', riskLevel: 'low', expiresAt: '2027-02-11' },
    tags: ['multi-lots'], notes: 'Propriétaire de trois lots à Nyon. Souhaite déléguer la gérance complète.',
    avatarBg: '#F59E0B',
  },
]

export const DEMO_CONTACTS: CrmContact[] = [...CRM_CONTACTS, ...DEMO_CONTACTS_COMPLEMENT]

/**
 * Fiche contact de démonstration — l'entrée de `ContactDetailPager`, qui est
 * purement présentationnel (le conteneur porte les requêtes). Le harnais peut
 * donc l'alimenter directement, sans échafaudage dans le code de production.
 *
 * `verified: true` pour que le bluecheck soit rendu, et une identité LBA
 * complète pour que les neuf lignes du bloc Coordonnées portent une valeur —
 * un « — » partout ne dit rien de la composition.
 */
export const DEMO_FICHE: FicheContact = {
  id: 'c-001', firstName: 'Marie', lastName: 'Bertrand', verified: true,
  email: 'm.bertrand@bluewin.ch', phone: '+41 79 412 88 02',
  lang: 'fr', civ: 'mrs', canal: 'whatsapp',
  audience: 'Acheteur', isTenant: false, avatarBg: '#0041D9',
  birth: '14.03.1986', nationality: 'CH', residence: 'CH',
  homeAddress: 'Rue du Rhône 42, 1204 Genève',
  photo: null,
  crit: {
    transaction: 'vente', types: ['appartement'], cantons: ['GE'],
    cities: ['Genève', 'Carouge'], budgetMin: 900000, budgetMax: 1300000,
    areaMin: 90, roomsMin: 4, mustHave: ['balcon', 'ascenseur'],
  },
  notes: 'Recherche un 4-5p pour la rentrée scolaire. Décision d’achat en couple, mari basé à Lausanne en semaine.',
}

/** Boucle de match — page 1 de la fiche. Les quatre états y sont représentés. */
export const DEMO_FICHE_LOOP: {
  items: FicheLoopItem[]; pendingLikes: FicheLoopItem[]; transmitted: number; opened: number
} = {
  items: [
    { matchId: 'm1', title: 'Appartement 4.5p — Eaux-Vives', addr: 'Rue des Eaux-Vives 18, Genève', photo: DEMO_LISTING.photos?.[0] ?? null, state: 'sent', motif: null },
    { matchId: 'm2', title: 'Duplex 5p — Carouge', addr: 'Rue Ancienne 7, Carouge', photo: DEMO_LISTING.photos?.[1] ?? null, state: 'seen', motif: null },
    { matchId: 'm4', title: 'Appartement 3.5p — Champel', addr: 'Avenue de Champel 30, Genève', photo: null, state: 'dismissed', motif: 'Étage trop bas' },
  ],
  pendingLikes: [
    { matchId: 'm3', title: 'Attique 4p — Plainpalais', addr: 'Boulevard du Pont-d’Arve 5, Genève', photo: DEMO_LISTING.photos?.[2] ?? null, state: 'liked', motif: null },
  ],
  transmitted: 4,
  opened: 3,
}

/**
 * Liens de réception — les états qui se PEIGNENT différemment : actif, échu,
 * retiré, et le statut non reconnu (`null`), sur lequel l'UI n'offre pas de
 * retrait.
 */
export const DEMO_FICHE_LINKS: { items: FicheReceptionLink[]; isLoading: boolean; failed: boolean } = {
  items: [
    { id: 'l1', status: 'viewed', channel: 'whatsapp', createdAt: '2026-06-01T10:00:00', expiresAt: '2026-07-01T10:00:00', count: 3, revokedAt: null, active: true },
    { id: 'l2', status: 'expired', channel: 'link', createdAt: '2026-04-02T09:00:00', expiresAt: '2026-05-02T09:00:00', count: 2, revokedAt: null, active: false },
    { id: 'l3', status: 'revoked', channel: 'whatsapp', createdAt: '2026-05-10T14:00:00', expiresAt: '2026-06-10T14:00:00', count: 1, revokedAt: '2026-05-18T08:20:00', active: false },
    { id: 'l4', status: null, channel: null, createdAt: '2026-05-22T11:00:00', expiresAt: '2026-06-22T11:00:00', count: 1, revokedAt: null, active: false },
  ],
  isLoading: false,
  failed: false,
}

/** Prochaine action estimée — bloc additif, absent si `null` : le banc le montre. */
export const DEMO_FICHE_NBA: FicheNba = {
  label: 'Proposer une visite pour l’attique de Plainpalais',
  kycNote: null,
}
