// MEGGA CRM Sugar v2 — Mock dataset for the agent prototype.
// 1:1 port from the Claude Design bundle (crm-data.jsx).
// Realistic Swiss real-estate context: Genève / Lausanne / Vaud, CHF, FR-CH naming.

import type { StageId } from './tokens'

// ─── Types ───────────────────────────────────────────────────────────────

export interface CrmContact {
  id: string
  type: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'mixed'
  firstName: string
  lastName: string
  email: string
  phone: string
  lang: 'fr' | 'de' | 'en' | 'it'
  status: 'lead' | 'qualified' | 'active' | 'archived'
  score: number
  source: 'website' | 'referral' | 'csv' | 'call' | 'walk-in' | 'AI'
  assignedTo: string
  createdAt: string
  lastActivityAt: string
  kyc: {
    status: 'none' | 'pending' | 'verified' | 'stale'
    riskLevel?: 'low' | 'medium' | 'high'
    expiresAt?: string
  }
  criteria?: {
    transaction: 'vente' | 'location'
    types: string[]
    cantons: string[]
    cities?: string[]
    budgetMin?: number
    budgetMax: number
    areaMin?: number
    areaMax?: number
    roomsMin?: number
    mustHave?: string[]
    niceToHave?: string[]
    deadline?: string
  }
  tags?: string[]
  notes?: string
  avatarBg: string
}

/** Score de bien (santé/chaleur) — attaché par useBiensSugar depuis property_scores
 * (RLS agence). ESTIMATION déterministe, jamais garantie. null = pas encore calculé. */
export interface BienHealth {
  overall: number                 // overall_score 0-100
  label: string                   // 'chaud' | 'a_animer' | 'en_veille'
  dataCompleteness: number | null // 0-1 (richesse réelle des signaux)
}

export interface CrmBien {
  id: string
  ref: string
  status: 'draft' | 'active' | 'reserved' | 'sold' | 'paused'
  type: 'appartement' | 'maison' | 'villa' | 'commercial' | 'office' | 'parking' | 'storage' | 'land'
  transaction: 'vente' | 'location'
  title: string
  addr: string
  canton: string
  /** Ville seule (properties.city) — bonus de proximité du matching fiche deal V4. */
  city?: string
  price: number | null
  rent?: number | null
  charges: number | null
  area: number
  rooms: number
  beds: number
  baths: number
  year: number
  energy: string
  ownerContactId: string | null
  mandat: { type: 'exclusif' | 'simple' | 'recherche'; signedAt?: string; expiresAt?: string; commission?: number }
  visibility: 'private' | 'agency' | 'public'
  publishedTo?: string[]
  stats: { views: number; favorites: number; visitRequests: number }
  photoCount: number
  signedPhotoCount: number
  /** URL de la photo de couverture (1re photo réelle) — galerie Mes biens. */
  coverPhoto?: string | null
  /** Score de bien (estimation) attaché depuis property_scores ; null si non calculé. */
  health?: BienHealth | null
  accent: string
}

export interface CrmDeal {
  id: string
  contactId: string
  bienId: string | null
  stage: StageId
  value: number
  probability: number
  ownerAgentId: string
  /** Prochaine action réelle (prochain reminder pending de la transaction) ;
   *  null quand aucune relance n'est planifiée — la carte affiche alors le
   *  gabarit une ligne « Planifier une action » (Pipeline v2). */
  nextAction: { kind: string; dueAt: string; note: string; reminderId?: string } | null
  risk: 'healthy' | 'at-risk' | 'stalled'
  /** Deal gagné (transactions.status='completed') — sort du board actif. */
  won?: boolean
  /** Deal rangé (transactions.archived_at non NULL) — sort du board, undo possible. */
  archived?: boolean
  updatedAt: string
}

// ─── Agent + team ────────────────────────────────────────────────────────
// ─── Contacts ────────────────────────────────────────────────────────────
export const CRM_CONTACTS: CrmContact[] = [
  { id: 'c-001', type: 'buyer',  firstName: 'Marie',     lastName: 'Bertrand',  email: 'm.bertrand@bluewin.ch',  phone: '+41 79 412 88 02', lang: 'fr',
    status: 'active', score: 84, source: 'website', assignedTo: 'agt-1',
    createdAt: '2026-04-02T09:00:00', lastActivityAt: '2026-04-29T15:32:00',
    kyc: { status: 'verified', riskLevel: 'low',  expiresAt: '2027-04-02' },
    criteria: { transaction: 'vente', types: ['appartement'], cantons: ['GE'], cities: ['Genève', 'Carouge'], budgetMin: 900000, budgetMax: 1300000, areaMin: 90, roomsMin: 4, mustHave: ['balcon', 'ascenseur'], niceToHave: ['vue lac'] },
    tags: ['famille', 'priorité haute'], notes: "Recherche un 4-5p pour la rentrée scolaire. Décision d'achat en couple, mari basé à Lausanne en semaine.",
    avatarBg: '#0041D9' },

  { id: 'c-002', type: 'buyer',  firstName: 'Pierre',    lastName: 'Vionnet',   email: 'pvionnet@gmail.com',     phone: '+41 78 211 04 91', lang: 'fr',
    status: 'active', score: 71, source: 'referral', assignedTo: 'agt-1',
    createdAt: '2026-03-18T11:30:00', lastActivityAt: '2026-04-21T10:11:00',
    kyc: { status: 'pending', riskLevel: 'medium' },
    criteria: { transaction: 'vente', types: ['maison', 'appartement'], cantons: ['VD'], cities: ['Lausanne', 'Pully', 'Lutry'], budgetMin: 1400000, budgetMax: 2200000, areaMin: 140, roomsMin: 5, mustHave: ['jardin'], niceToHave: ['vue lac', 'piscine'] },
    tags: ['investisseur'], notes: "Cherche à investir, profite de la vente de son entreprise. Pas pressé.",
    avatarBg: '#8B5CF6' },

  { id: 'c-003', type: 'buyer',  firstName: 'Élodie',    lastName: 'Schmidt',   email: 'elodie.s@protonmail.com', phone: '+41 79 808 12 24', lang: 'fr',
    status: 'active', score: 92, source: 'AI', assignedTo: 'agt-1',
    createdAt: '2026-04-25T14:20:00', lastActivityAt: '2026-04-30T08:45:00',
    kyc: { status: 'none' },
    criteria: { transaction: 'vente', types: ['appartement'], cantons: ['GE'], cities: ['Eaux-Vives', 'Champel', 'Plainpalais'], budgetMin: 750000, budgetMax: 1100000, areaMin: 75, roomsMin: 3, mustHave: ['balcon'] },
    tags: ['primo-accédant', 'urgent'], notes: "Lead extrait d'un email transféré. Pré-qualifié par MEGGA AI.",
    avatarBg: '#10B981' },

  { id: 'c-004', type: 'seller', firstName: 'Jean-Marc', lastName: 'Aebischer', email: 'jm.aebischer@gmail.com', phone: '+41 79 222 14 87', lang: 'fr',
    status: 'active', score: 68, source: 'call', assignedTo: 'agt-1',
    createdAt: '2026-02-11T08:00:00', lastActivityAt: '2026-04-28T17:00:00',
    kyc: { status: 'verified', riskLevel: 'low', expiresAt: '2027-02-11' },
    notes: 'Vendeur 4p Eaux-Vives. Mandat exclusif signé. Photos C2PA prises le 14 mars.',
    tags: ['mandat exclusif'],
    avatarBg: '#F59E0B' },

  { id: 'c-005', type: 'buyer',  firstName: 'Camille',   lastName: 'Rougier',   email: 'crougier@swissquote.ch', phone: '+41 78 332 99 11', lang: 'fr',
    status: 'active', score: 55, source: 'walk-in', assignedTo: 'agt-1',
    createdAt: '2026-04-14T16:30:00', lastActivityAt: '2026-04-22T09:00:00',
    kyc: { status: 'none' },
    criteria: { transaction: 'location', types: ['appartement'], cantons: ['GE'], cities: ['Genève'], budgetMax: 3500, areaMin: 80, roomsMin: 3 },
    tags: ['location'], notes: 'Locataire, expat US, arrive en juillet.',
    avatarBg: '#06B6D4' },

  { id: 'c-006', type: 'seller', firstName: 'Catherine', lastName: 'Loreau',    email: 'c.loreau@hotmail.fr',   phone: '+41 79 605 11 03', lang: 'fr',
    status: 'qualified', score: 48, source: 'website', assignedTo: 'agt-1',
    createdAt: '2026-04-26T10:00:00', lastActivityAt: '2026-04-26T10:00:00',
    kyc: { status: 'none' },
    notes: 'Soumission depuis MEGGA Vendre. À contacter sous 48h. Maison Carouge, succession.',
    tags: ['nouveau', 'succession'],
    avatarBg: '#E53935' },

  { id: 'c-007', type: 'buyer',  firstName: 'Antoine',   lastName: 'Picard',    email: 'a.picard@bluewin.ch',   phone: '+41 76 414 22 18', lang: 'fr',
    status: 'active', score: 78, source: 'website', assignedTo: 'agt-1',
    createdAt: '2026-03-30T13:00:00', lastActivityAt: '2026-04-27T14:40:00',
    kyc: { status: 'verified', riskLevel: 'low', expiresAt: '2027-03-30' },
    criteria: { transaction: 'vente', types: ['maison'], cantons: ['GE'], cities: ['Cologny', 'Vandœuvres', 'Vésenaz'], budgetMin: 2500000, budgetMax: 4000000, areaMin: 200, roomsMin: 6, mustHave: ['jardin', 'garage'], niceToHave: ['piscine', 'vue lac'] },
    tags: ['haute valeur', 'famille'], notes: 'Famille 4 enfants, vit actuellement à Cologny en location.',
    avatarBg: '#0041D9' },

  { id: 'c-008', type: 'buyer',  firstName: 'Linda',     lastName: 'Okafor',    email: 'l.okafor@gmail.com',    phone: '+41 78 909 33 12', lang: 'en',
    status: 'lead', score: 32, source: 'csv', assignedTo: 'agt-1',
    createdAt: '2026-04-29T17:00:00', lastActivityAt: '2026-04-29T17:00:00',
    kyc: { status: 'none' },
    notes: 'Importée du CSV salon SIMI 2026. À qualifier.',
    tags: ['salon'],
    avatarBg: '#6366F1' },
]

// ─── Biens (vue agent — différent de la fiche publique) ──────────────────
export const CRM_BIENS: CrmBien[] = [
  { id: 'b-101', ref: 'MG-2026-101', status: 'active',
    type: 'appartement', transaction: 'vente',
    title: '4 pièces lumineux Eaux-Vives', addr: 'Rue du Lac 15, Genève', canton: 'GE',
    price: 850000, charges: 340, area: 85, rooms: 4, beds: 2, baths: 1, year: 1972, energy: 'D',
    ownerContactId: 'c-004',
    mandat: { type: 'exclusif', signedAt: '2026-02-22', expiresAt: '2026-08-22', commission: 3.0 },
    visibility: 'public', publishedTo: ['MEGGA', 'Homegate', 'ImmoScout'],
    stats: { views: 1245, favorites: 38, visitRequests: 7 },
    photoCount: 18, signedPhotoCount: 18,
    accent: '#0041D9' },

  { id: 'b-102', ref: 'MG-2026-102', status: 'active',
    type: 'appartement', transaction: 'vente',
    title: '3 pièces standing Champel', addr: 'Avenue de Champel 42, Genève', canton: 'GE',
    price: 780000, charges: 280, area: 75, rooms: 3, beds: 1, baths: 1, year: 2008, energy: 'B',
    ownerContactId: null,
    mandat: { type: 'simple', signedAt: '2026-03-08', expiresAt: '2026-09-08', commission: 3.0 },
    visibility: 'public', publishedTo: ['MEGGA', 'Homegate'],
    stats: { views: 892, favorites: 24, visitRequests: 5 },
    photoCount: 14, signedPhotoCount: 14,
    accent: '#10B981' },

  { id: 'b-103', ref: 'MG-2026-103', status: 'active',
    type: 'appartement', transaction: 'vente',
    title: '5 pièces familial Carouge', addr: 'Rue Ancienne 6, Carouge', canton: 'GE',
    price: 1100000, charges: 420, area: 120, rooms: 5, beds: 3, baths: 2, year: 1996, energy: 'C',
    ownerContactId: null,
    mandat: { type: 'exclusif', signedAt: '2026-03-25', expiresAt: '2026-09-25', commission: 3.5 },
    visibility: 'public', publishedTo: ['MEGGA', 'Homegate', 'ImmoScout'],
    stats: { views: 1502, favorites: 51, visitRequests: 11 },
    photoCount: 22, signedPhotoCount: 20,
    accent: '#8B5CF6' },

  { id: 'b-104', ref: 'MG-2026-104', status: 'reserved',
    type: 'maison', transaction: 'vente',
    title: 'Villa contemporaine Cologny', addr: 'Chemin du Levant 8, Cologny', canton: 'GE',
    price: 3850000, charges: null, area: 240, rooms: 7, beds: 4, baths: 3, year: 2019, energy: 'A',
    ownerContactId: null,
    mandat: { type: 'exclusif', signedAt: '2026-01-30', expiresAt: '2026-07-30', commission: 3.0 },
    visibility: 'private',
    stats: { views: 421, favorites: 18, visitRequests: 3 },
    photoCount: 24, signedPhotoCount: 24,
    accent: '#F59E0B' },

  { id: 'b-105', ref: 'MG-2026-105', status: 'draft',
    type: 'appartement', transaction: 'vente',
    title: '2 pièces Plainpalais (brouillon)', addr: 'Rue de Carouge 78, Genève', canton: 'GE',
    price: 680000, charges: 220, area: 55, rooms: 2, beds: 1, baths: 1, year: 1985, energy: 'D',
    ownerContactId: null,
    mandat: { type: 'simple' },
    visibility: 'private',
    stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: 0, signedPhotoCount: 0,
    accent: '#7A8079' },

  { id: 'b-106', ref: 'MG-2026-106', status: 'active',
    type: 'appartement', transaction: 'location',
    title: '3 pièces meublé Pâquis', addr: 'Rue de Berne 22, Genève', canton: 'GE',
    price: null, rent: 3200, charges: 180, area: 78, rooms: 3, beds: 2, baths: 1, year: 2010, energy: 'C',
    ownerContactId: null,
    mandat: { type: 'simple', signedAt: '2026-04-12' },
    visibility: 'public', publishedTo: ['MEGGA', 'Homegate'],
    stats: { views: 340, favorites: 12, visitRequests: 4 },
    photoCount: 11, signedPhotoCount: 11,
    accent: '#06B6D4' },
]

// ─── Deals (pipeline) ────────────────────────────────────────────────────
// ─── Activity (timeline) ─────────────────────────────────────────────────
// ─── Matchs IA ───────────────────────────────────────────────────────────
// ─── AI Suggestions (today screen) ───────────────────────────────────────
// ─── Helpers ─────────────────────────────────────────────────────────────
// Le Matching Sugar v2 peut être branché sur Supabase via `useMatchingSugar()`.
// Dans ce mode, l'adapter pousse les Contact/Bien Supabase dans ce registry
// runtime — les composants UI continuent d'appeler `crmContactById`/`crmBienById`
// sans changer de signature. Fallback transparent sur les arrays mock si absent.
const _liveContacts = new Map<string, CrmContact>()
const _liveBiens = new Map<string, CrmBien>()

export function registerLiveContact(c: CrmContact): void {
  _liveContacts.set(c.id, c)
}
export function registerLiveBien(b: CrmBien): void {
  _liveBiens.set(b.id, b)
}
export function resetLiveOverrides(): void {
  _liveContacts.clear()
  _liveBiens.clear()
}

export function crmContactById(id: string): CrmContact | undefined {
  return _liveContacts.get(id) ?? CRM_CONTACTS.find(c => c.id === id)
}
export function crmBienById(id: string): CrmBien | undefined {
  return _liveBiens.get(id) ?? CRM_BIENS.find(b => b.id === id)
}
