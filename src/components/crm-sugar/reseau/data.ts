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
