// MEGGA CRM Sugar v2 — Réseau d'agences (Tier 5)
// Mock data pour le module multi-tenant. Inspiré de `crm-agencies-data.jsx` du
// bundle (5 agences pré-définies avec chartes graphiques) + relations de partage.
//
// Architecture cible (HANDOFF_RESEAU_AGENCES.md) :
// - 5 vues : Mon réseau / Biens partagés (sortants) / Biens reçus (entrants) /
//   Demandes / Settings agence
// - 4 niveaux de partage : complet / partiel / aperçu / en attente
// - 4 statuts de relation : partner / new / megga-network / blocked
//
// Cette PR couvre uniquement la 1ère vue « Mon réseau » avec mock data.
// Les écritures + RLS Supabase + templates PDF arriveront dans des PRs ultérieures.

export type AgencyRelationStatus = 'partner' | 'new' | 'megga' | 'blocked'

export type AgencyShareLevel = 'full' | 'partial' | 'preview' | 'pending'

export interface AgencyPartner {
  id: string
  name: string
  short: string
  /** Rendu en monogramme stylisé — couleur de fond + texte */
  logoBg: string
  logoColor: string
  logoText: string
  logoLetterSpacing: string
  /** Couleur principale de la charte (pour accents discrets) */
  accent: string
  /** Style général (minimal / classic / editorial / modern) */
  style: 'minimal' | 'classic' | 'editorial' | 'modern'
  city: string
  status: AgencyRelationStatus
  /** Niveau de partage par défaut côté outbound */
  defaultLevel: AgencyShareLevel
  /** # biens que je partage avec eux */
  sharedOut: number
  /** # biens qu'ils me partagent */
  sharedIn: number
  /** Date dernière interaction (ISO) */
  lastInteractionAt: string
  /** Note libre */
  note?: string
}

// 5 agences mock — directement tirées de `crm-agencies-data.jsx` du bundle.
export const RESEAU_PARTNERS: AgencyPartner[] = [
  {
    id: 'naef',
    name: 'Naef Immobilier',
    short: 'NAEF',
    logoBg: '#1E3A5F',
    logoColor: '#FFFFFF',
    logoText: 'NAEF',
    logoLetterSpacing: '.28em',
    accent: '#C9A572',
    style: 'classic',
    city: 'Genève',
    status: 'partner',
    defaultLevel: 'full',
    sharedOut: 12,
    sharedIn: 8,
    lastInteractionAt: '2026-05-02T14:30:00',
    note: 'Partenaire historique — partage par défaut Complet sur tous mes mandats.',
  },
  {
    id: 'bory',
    name: 'Bory & Cie',
    short: 'BORY',
    logoBg: '#2C2416',
    logoColor: '#FFFFFF',
    logoText: 'BORY',
    logoLetterSpacing: '.32em',
    accent: '#B08D5A',
    style: 'editorial',
    city: 'Genève',
    status: 'partner',
    defaultLevel: 'full',
    sharedOut: 7,
    sharedIn: 4,
    lastInteractionAt: '2026-04-28T10:15:00',
    note: 'Spécialistes du segment haut-de-gamme — focus Cologny / Champel.',
  },
  {
    id: 'spg',
    name: 'SPG One',
    short: 'SPG',
    logoBg: '#C8102E',
    logoColor: '#FFFFFF',
    logoText: 'SPG',
    logoLetterSpacing: '.18em',
    accent: '#C8102E',
    style: 'modern',
    city: 'Genève',
    status: 'new',
    defaultLevel: 'partial',
    sharedOut: 2,
    sharedIn: 0,
    lastInteractionAt: '2026-04-20T09:00:00',
    note: 'Rencontre récente au salon SIMI — partage Aperçu/Partiel par défaut.',
  },
  {
    id: 'cardis',
    name: "Cardis Sotheby's",
    short: 'CARDIS',
    logoBg: '#002855',
    logoColor: '#FFFFFF',
    logoText: 'CARDIS',
    logoLetterSpacing: '.20em',
    accent: '#8A7A6A',
    style: 'classic',
    city: 'Genève',
    status: 'partner',
    defaultLevel: 'full',
    sharedOut: 5,
    sharedIn: 11,
    lastInteractionAt: '2026-05-01T16:45:00',
    note: 'Réseau international — surtout buyer leads expat haut de gamme.',
  },
  {
    id: 'megga-lausanne',
    name: 'MEGGA Lausanne',
    short: 'MEGGA',
    logoBg: '#0B0C0E',
    logoColor: '#FFFFFF',
    logoText: 'MEGGA',
    logoLetterSpacing: '.22em',
    accent: '#0B0C0E',
    style: 'minimal',
    city: 'Lausanne',
    status: 'megga',
    defaultLevel: 'full',
    sharedOut: 18,
    sharedIn: 14,
    lastInteractionAt: '2026-05-03T11:00:00',
    note: 'Antenne Lausanne du réseau MEGGA — partage automatique tous biens.',
  },
]

export const RELATION_LABELS: Record<AgencyRelationStatus, string> = {
  partner: 'Partenaire',
  new: 'Nouvelle relation',
  megga: 'Réseau MEGGA',
  blocked: 'Bloquée',
}

export const SHARE_LEVEL_LABELS: Record<AgencyShareLevel, string> = {
  full: 'Complet',
  partial: 'Partiel',
  preview: 'Aperçu',
  pending: 'En attente',
}

export interface ReseauKpi {
  k: string
  v: string
  sub: string
  tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'pending'
}

export const RESEAU_FILTERS: { id: AgencyRelationStatus | 'all'; label: string; count: number }[] = [
  { id: 'all', label: 'Toutes', count: 5 },
  { id: 'partner', label: 'Partenaires', count: 3 },
  { id: 'megga', label: 'Réseau MEGGA', count: 1 },
  { id: 'new', label: 'Nouvelles', count: 1 },
  { id: 'blocked', label: 'Bloquées', count: 0 },
]

// ─── Tabs (5 vues du module Réseau) ──────────────────────────────────────

export type ReseauTabId = 'mon-reseau' | 'sortants' | 'entrants' | 'demandes' | 'settings'

export const RESEAU_TABS: { id: ReseauTabId; label: string; sub: string }[] = [
  { id: 'mon-reseau', label: 'Mon réseau', sub: 'Agences partenaires' },
  { id: 'sortants', label: 'Biens partagés', sub: 'Sortants' },
  { id: 'entrants', label: 'Biens reçus', sub: 'Entrants' },
  { id: 'demandes', label: 'Demandes', sub: 'À traiter' },
  { id: 'settings', label: 'Settings', sub: 'Agence' },
]

// ─── Share rules (biens × agences × niveau) ──────────────────────────────
//
// Pour chaque bien (par ref MEGGA), on liste les agences qui y ont accès et
// à quel niveau. Mock pour MVP — en prod, vit dans `listing_share_rules`
// avec RLS Supabase.

export interface BienShareRule {
  bienId: string
  /** Référence affichage (MG-2026-101) */
  ref: string
  /** Titre court du bien */
  title: string
  /** Adresse / localisation */
  address: string
  /** Prix en CHF (vente) ou loyer mensuel (location) */
  price: number
  transaction: 'vente' | 'location'
  type: string
  rooms: number | null
  area: number
  /** Statut du bien */
  status: 'active' | 'reserved' | 'sold' | 'draft' | 'paused'
  /** Couleur d'accent pour le visuel (héritée du mock CRM_BIENS) */
  accent: string
  /** Règles de partage par agence */
  shares: { agencyId: string; level: AgencyShareLevel }[]
}

// Mappage des biens existants (CRM_BIENS) avec règles de partage mock.
// Couvre les 6 biens MEGGA du mock.
export const BIEN_SHARE_RULES: BienShareRule[] = [
  {
    bienId: 'b-101',
    ref: 'MG-2026-101',
    title: '4 pièces lumineux Eaux-Vives',
    address: 'Rue du Lac 15, Genève',
    price: 850000,
    transaction: 'vente',
    type: 'Appartement',
    rooms: 4,
    area: 85,
    status: 'active',
    accent: '#0041D9',
    shares: [
      { agencyId: 'naef', level: 'full' },
      { agencyId: 'cardis', level: 'full' },
      { agencyId: 'bory', level: 'partial' },
      { agencyId: 'megga-lausanne', level: 'full' },
    ],
  },
  {
    bienId: 'b-102',
    ref: 'MG-2026-102',
    title: '3 pièces standing Champel',
    address: 'Avenue de Champel 42, Genève',
    price: 780000,
    transaction: 'vente',
    type: 'Appartement',
    rooms: 3,
    area: 75,
    status: 'active',
    accent: '#10B981',
    shares: [
      { agencyId: 'naef', level: 'full' },
      { agencyId: 'megga-lausanne', level: 'full' },
      { agencyId: 'spg', level: 'preview' },
    ],
  },
  {
    bienId: 'b-103',
    ref: 'MG-2026-103',
    title: '5 pièces familial Carouge',
    address: 'Rue Ancienne 6, Carouge',
    price: 1100000,
    transaction: 'vente',
    type: 'Appartement',
    rooms: 5,
    area: 120,
    status: 'active',
    accent: '#8B5CF6',
    shares: [
      { agencyId: 'naef', level: 'full' },
      { agencyId: 'cardis', level: 'partial' },
      { agencyId: 'bory', level: 'partial' },
      { agencyId: 'megga-lausanne', level: 'full' },
      { agencyId: 'spg', level: 'pending' },
    ],
  },
  {
    bienId: 'b-104',
    ref: 'MG-2026-104',
    title: 'Villa contemporaine Cologny',
    address: 'Chemin du Levant 8, Cologny',
    price: 3850000,
    transaction: 'vente',
    type: 'Maison',
    rooms: 7,
    area: 240,
    status: 'reserved',
    accent: '#F59E0B',
    shares: [
      { agencyId: 'cardis', level: 'full' },
      { agencyId: 'bory', level: 'full' },
    ],
  },
  {
    bienId: 'b-105',
    ref: 'MG-2026-105',
    title: '2 pièces Plainpalais',
    address: 'Rue de Carouge 78, Genève',
    price: 680000,
    transaction: 'vente',
    type: 'Appartement',
    rooms: 2,
    area: 55,
    status: 'draft',
    accent: '#7A8079',
    shares: [],
  },
  {
    bienId: 'b-106',
    ref: 'MG-2026-106',
    title: '3 pièces meublé Pâquis',
    address: 'Rue de Berne 22, Genève',
    price: 3200,
    transaction: 'location',
    type: 'Appartement',
    rooms: 3,
    area: 78,
    status: 'active',
    accent: '#06B6D4',
    shares: [
      { agencyId: 'megga-lausanne', level: 'full' },
    ],
  },
]

export const SHARE_LEVEL_TONE: Record<AgencyShareLevel, 'ok' | 'warn' | 'pending' | 'neutral'> = {
  full: 'ok',
  partial: 'warn',
  preview: 'neutral',
  pending: 'pending',
}

export function partnerById(id: string): AgencyPartner | undefined {
  return RESEAU_PARTNERS.find(p => p.id === id)
}

// ─── Biens reçus (entrants — vue 3) ──────────────────────────────────────
//
// Biens que d'autres agences partagent avec mon CRM. Le niveau de partage
// définit ce que je peux voir :
//   - full    : tout (adresse, photos HD, dossier complet, propriétaire)
//   - partial : quartier seul, photos floutées sur certains éléments
//   - preview : quelques lignes (type, surface, prix, quartier large)
//   - pending : demande envoyée, en attente de validation côté agence source
//
// Le composant rendant ces biens doit MASQUER les données selon le niveau.
// Mock pour MVP — en prod, vit dans `listing_share_rules` côté inverse +
// requête RLS scoped sur l'agence reveiveuse.

export interface ReceivedListing {
  /** ID local côté agence source (pour audit) */
  id: string
  sourceAgencyId: string
  level: AgencyShareLevel
  /** Référence côté agence source (NAEF-2026-A12) */
  sourceRef: string
  /** Type de bien (commun à tous les niveaux) */
  type: string
  transaction: 'vente' | 'location'
  rooms: number | null
  area: number
  price: number
  /** Quartier large — visible dès Aperçu */
  zone: string
  /** Ville — visible dès Partiel */
  city: string | null
  /** Adresse complète — visible uniquement à Complet */
  address: string | null
  /** Titre éditorialisé — visible dès Aperçu (mais générique sur Aperçu) */
  title: string
  /** Couleur d'accent pour le visuel */
  accent: string
  /** Date de partage */
  sharedAt: string
}

export const RECEIVED_LISTINGS: ReceivedListing[] = [
  // ── Naef (8 biens partagés en Complet — partenaire historique) ──
  {
    id: 'naef-001', sourceAgencyId: 'naef', level: 'full',
    sourceRef: 'NAEF-26-A12',
    type: 'Appartement', transaction: 'vente',
    rooms: 4, area: 110, price: 1850000,
    zone: 'Genève centre', city: 'Genève',
    address: 'Rue du Rhône 78, 1204 Genève',
    title: '4 pièces standing Rue du Rhône',
    accent: '#1E3A5F', sharedAt: '2026-04-30T10:00:00',
  },
  {
    id: 'naef-002', sourceAgencyId: 'naef', level: 'full',
    sourceRef: 'NAEF-26-A18',
    type: 'Maison', transaction: 'vente',
    rooms: 6, area: 180, price: 2950000,
    zone: 'Cologny', city: 'Cologny',
    address: 'Chemin de la Tulette 14, 1223 Cologny',
    title: 'Maison familiale jardin Cologny',
    accent: '#1E3A5F', sharedAt: '2026-05-01T09:30:00',
  },
  {
    id: 'naef-003', sourceAgencyId: 'naef', level: 'full',
    sourceRef: 'NAEF-26-V03',
    type: 'Appartement', transaction: 'location',
    rooms: 3, area: 85, price: 4200,
    zone: 'Eaux-Vives', city: 'Genève',
    address: "Rue du 31-Décembre 22, 1207 Genève",
    title: '3 pièces meublé Eaux-Vives',
    accent: '#1E3A5F', sharedAt: '2026-04-28T14:15:00',
  },
  {
    id: 'naef-004', sourceAgencyId: 'naef', level: 'partial',
    sourceRef: 'NAEF-26-A22',
    type: 'Appartement', transaction: 'vente',
    rooms: 5, area: 145, price: 2400000,
    zone: 'Champel', city: 'Genève',
    address: null, // partial : pas d'adresse exacte
    title: '5 pièces familial quartier Champel',
    accent: '#1E3A5F', sharedAt: '2026-04-25T11:00:00',
  },

  // ── Bory (4 biens — éditorial haut-de-gamme) ──
  {
    id: 'bory-001', sourceAgencyId: 'bory', level: 'full',
    sourceRef: 'BORY-26-Q08',
    type: 'Maison', transaction: 'vente',
    rooms: 8, area: 320, price: 6500000,
    zone: 'Vandœuvres', city: 'Vandœuvres',
    address: 'Chemin de la Voie-Creuse 6, 1253 Vandœuvres',
    title: 'Propriété contemporaine Vandœuvres',
    accent: '#2C2416', sharedAt: '2026-05-02T08:00:00',
  },
  {
    id: 'bory-002', sourceAgencyId: 'bory', level: 'partial',
    sourceRef: 'BORY-26-Q12',
    type: 'Appartement', transaction: 'vente',
    rooms: 5, area: 165, price: 3200000,
    zone: 'Eaux-Vives', city: 'Genève',
    address: null,
    title: '5 pièces piscine couverte Eaux-Vives',
    accent: '#2C2416', sharedAt: '2026-04-29T16:00:00',
  },

  // ── Cardis (11 biens — réseau international, mix de niveaux) ──
  {
    id: 'cardis-001', sourceAgencyId: 'cardis', level: 'full',
    sourceRef: 'CARDIS-26-S04',
    type: 'Maison', transaction: 'vente',
    rooms: 9, area: 410, price: 12500000,
    zone: 'Genolier', city: 'Genolier',
    address: 'Route de Genolier 18, 1272 Genolier',
    title: 'Domaine prestige avec vignoble',
    accent: '#002855', sharedAt: '2026-05-03T11:00:00',
  },
  {
    id: 'cardis-002', sourceAgencyId: 'cardis', level: 'full',
    sourceRef: 'CARDIS-26-S07',
    type: 'Maison', transaction: 'vente',
    rooms: 7, area: 280, price: 5800000,
    zone: 'Anières', city: 'Anières',
    address: "Chemin de Sous-l'Église 4, 1247 Anières",
    title: 'Villa pieds dans l\'eau Anières',
    accent: '#002855', sharedAt: '2026-05-01T15:30:00',
  },
  {
    id: 'cardis-003', sourceAgencyId: 'cardis', level: 'preview',
    sourceRef: 'CARDIS-26-S15',
    type: 'Appartement', transaction: 'vente',
    rooms: 4, area: 130, price: 2100000,
    zone: 'Carouge', city: null,
    address: null,
    title: 'Appartement Carouge centre',
    accent: '#002855', sharedAt: '2026-04-26T09:45:00',
  },

  // ── MEGGA Lausanne (14 — réseau interne, tous Complet) ──
  {
    id: 'megga-laus-001', sourceAgencyId: 'megga-lausanne', level: 'full',
    sourceRef: 'MGL-26-101',
    type: 'Appartement', transaction: 'vente',
    rooms: 4, area: 95, price: 1200000,
    zone: 'Lausanne Ouchy', city: 'Lausanne',
    address: 'Avenue d\'Ouchy 36, 1006 Lausanne',
    title: '4 pièces vue lac Ouchy',
    accent: '#0B0C0E', sharedAt: '2026-05-03T10:30:00',
  },
  {
    id: 'megga-laus-002', sourceAgencyId: 'megga-lausanne', level: 'full',
    sourceRef: 'MGL-26-104',
    type: 'Maison', transaction: 'vente',
    rooms: 6, area: 220, price: 2400000,
    zone: 'Pully', city: 'Pully',
    address: 'Chemin du Liaudoz 2, 1009 Pully',
    title: 'Maison familiale Pully avec jardin',
    accent: '#0B0C0E', sharedAt: '2026-05-02T13:00:00',
  },

  // ── SPG (0 biens partagés Complet — relation nouvelle, demande pending) ──
  {
    id: 'spg-001', sourceAgencyId: 'spg', level: 'pending',
    sourceRef: 'SPG-26-?',
    type: '—', transaction: 'vente',
    rooms: null, area: 0, price: 0,
    zone: '—', city: null, address: null,
    title: 'Demande de partage envoyée',
    accent: '#C8102E', sharedAt: '2026-04-22T10:00:00',
  },
]

// ─── Demandes de partage (vue 4) ─────────────────────────────────────────
//
// Workflow d'approbation :
//   - Entrantes : agence X demande l'accès à un de mes biens (à un niveau donné)
//     → je peux approuver tel quel, refuser, ou contre-proposer un autre niveau
//   - Sortantes : j'ai demandé l'accès à un bien d'une autre agence
//     → en attente de leur réponse, ou résolu (approuvée / refusée / contre-proposée)
//
// En prod : `share_requests` table avec statuts + audit trail. Mock pour MVP.

export type ShareRequestDirection = 'incoming' | 'outgoing'
export type ShareRequestStatus = 'pending' | 'approved' | 'refused' | 'countered'

export interface ShareRequest {
  id: string
  direction: ShareRequestDirection
  /** Agence qui demande (incoming) ou à qui je demande (outgoing) */
  agencyId: string
  /** Référence du bien chez le propriétaire — masquée si pas encore approuvée côté outgoing */
  bienRef: string
  bienTitle: string
  bienType: string
  bienPrice: number
  bienTransaction: 'vente' | 'location'
  /** Quartier / zone — toujours visible */
  bienZone: string
  /** Niveau demandé */
  requestedLevel: AgencyShareLevel
  status: ShareRequestStatus
  /** Si countered : niveau proposé en contre */
  counterLevel?: AgencyShareLevel
  /** Message optionnel du demandeur */
  message?: string
  createdAt: string
  /** Date de résolution (approved/refused/countered) */
  resolvedAt?: string
}

export const SHARE_REQUESTS: ShareRequest[] = [
  // ── ENTRANTES — d'autres agences demandent mes biens ──
  {
    id: 'req-in-001',
    direction: 'incoming',
    agencyId: 'bory',
    bienRef: 'MG-2026-104',
    bienTitle: 'Villa contemporaine Cologny',
    bienType: 'Maison',
    bienPrice: 3850000,
    bienTransaction: 'vente',
    bienZone: 'Cologny',
    requestedLevel: 'full',
    status: 'pending',
    message: 'Client haut-de-gamme intéressé par les villas contemporaines Cologny — accès complet souhaité pour visite mardi.',
    createdAt: '2026-05-03T09:15:00',
  },
  {
    id: 'req-in-002',
    direction: 'incoming',
    agencyId: 'spg',
    bienRef: 'MG-2026-101',
    bienTitle: '4 pièces lumineux Eaux-Vives',
    bienType: 'Appartement',
    bienPrice: 850000,
    bienTransaction: 'vente',
    bienZone: 'Eaux-Vives',
    requestedLevel: 'partial',
    status: 'pending',
    message: 'Intérêt pour vue en partie large sur ce bien — première rencontre de notre collaboration.',
    createdAt: '2026-05-02T14:30:00',
  },
  {
    id: 'req-in-003',
    direction: 'incoming',
    agencyId: 'cardis',
    bienRef: 'MG-2026-103',
    bienTitle: '5 pièces familial Carouge',
    bienType: 'Appartement',
    bienPrice: 1100000,
    bienTransaction: 'vente',
    bienZone: 'Carouge',
    requestedLevel: 'full',
    status: 'pending',
    createdAt: '2026-05-01T16:00:00',
  },
  {
    id: 'req-in-004',
    direction: 'incoming',
    agencyId: 'naef',
    bienRef: 'MG-2026-102',
    bienTitle: '3 pièces standing Champel',
    bienType: 'Appartement',
    bienPrice: 780000,
    bienTransaction: 'vente',
    bienZone: 'Champel',
    requestedLevel: 'full',
    status: 'approved',
    createdAt: '2026-04-28T11:00:00',
    resolvedAt: '2026-04-28T15:30:00',
  },
  {
    id: 'req-in-005',
    direction: 'incoming',
    agencyId: 'spg',
    bienRef: 'MG-2026-104',
    bienTitle: 'Villa contemporaine Cologny',
    bienType: 'Maison',
    bienPrice: 3850000,
    bienTransaction: 'vente',
    bienZone: 'Cologny',
    requestedLevel: 'full',
    counterLevel: 'preview',
    status: 'countered',
    message: 'Demande contre-proposée en Aperçu — première relation, nous souhaitons commencer par voir les caractéristiques générales avant de partager l\'adresse.',
    createdAt: '2026-04-25T10:00:00',
    resolvedAt: '2026-04-25T18:00:00',
  },
  // ── SORTANTES — je demande des biens à d'autres agences ──
  {
    id: 'req-out-001',
    direction: 'outgoing',
    agencyId: 'spg',
    bienRef: 'SPG-26-?',
    bienTitle: 'Demande sur portfolio général',
    bienType: '—',
    bienPrice: 0,
    bienTransaction: 'vente',
    bienZone: '—',
    requestedLevel: 'preview',
    status: 'pending',
    message: 'Première rencontre — souhait d\'accès Aperçu sur le portfolio Genève centre.',
    createdAt: '2026-04-22T10:00:00',
  },
  {
    id: 'req-out-002',
    direction: 'outgoing',
    agencyId: 'cardis',
    bienRef: 'CARDIS-26-S22',
    bienTitle: '6 pièces lac Versoix',
    bienType: 'Maison',
    bienPrice: 4200000,
    bienTransaction: 'vente',
    bienZone: 'Versoix',
    requestedLevel: 'full',
    counterLevel: 'partial',
    status: 'countered',
    message: 'Cardis a proposé Partiel — vous pouvez accepter ou re-négocier.',
    createdAt: '2026-04-20T14:00:00',
    resolvedAt: '2026-04-21T09:00:00',
  },
  {
    id: 'req-out-003',
    direction: 'outgoing',
    agencyId: 'bory',
    bienRef: 'BORY-26-Q19',
    bienTitle: 'Penthouse vue lac Genève',
    bienType: 'Appartement',
    bienPrice: 8500000,
    bienTransaction: 'vente',
    bienZone: 'Genève centre',
    requestedLevel: 'full',
    status: 'refused',
    message: 'Refusée — exclusivité contractuelle avec un autre partenaire.',
    createdAt: '2026-04-18T11:00:00',
    resolvedAt: '2026-04-19T16:00:00',
  },
]

export const REQUEST_STATUS_LABELS: Record<ShareRequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  refused: 'Refusée',
  countered: 'Contre-proposée',
}

export const REQUEST_STATUS_TONE: Record<ShareRequestStatus, 'ok' | 'warn' | 'pending' | 'danger' | 'neutral'> = {
  pending: 'pending',
  approved: 'ok',
  refused: 'danger',
  countered: 'warn',
}
