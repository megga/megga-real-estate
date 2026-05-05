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
