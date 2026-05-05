// MEGGA CRM Sugar v2 — Documents data + types
// 1:1 port from `crm-documents-sugar-data.jsx`.

export interface DocPhase {
  id: 'mandate' | 'prep' | 'visits' | 'offer' | 'promise' | 'deed'
  label: string
  icon: string
  color: string
}

export const DOC_PHASES: DocPhase[] = [
  { id: 'mandate', label: 'Mandat', icon: 'file-signature', color: '#1E5BC6' },
  { id: 'prep', label: 'Préparation', icon: 'package', color: '#0891B2' },
  { id: 'visits', label: 'Visites', icon: 'door-open', color: '#0891B2' },
  { id: 'offer', label: 'Offre', icon: 'hand-coin', color: '#C45A00' },
  { id: 'promise', label: 'Compromis', icon: 'file-check', color: '#059669' },
  { id: 'deed', label: 'Acte', icon: 'award', color: '#0B0C0E' },
]

export type DocPhaseId = DocPhase['id']
export type DocStatus =
  | 'missing' | 'draft' | 'pending' | 'signed' | 'expired' | 'archived'

export interface DocStatusMeta {
  label: string
  color: string
  bg: string
}

export const DOC_STATUSES: Record<DocStatus, DocStatusMeta> = {
  missing: { label: 'Manquant', color: '#B91C1C', bg: '#FEEBEC' },
  draft: { label: 'Brouillon', color: '#6E7480', bg: '#F1F3F7' },
  pending: { label: 'En attente', color: '#C45A00', bg: '#FFF1E2' },
  signed: { label: 'Signé', color: '#0E8F3E', bg: '#E2F4E8' },
  expired: { label: 'Expiré', color: '#B91C1C', bg: '#FEEBEC' },
  archived: { label: 'Archivé', color: '#9CA0AB', bg: '#F4F6FA' },
}

export interface DocItem {
  id: string
  phase: DocPhaseId
  type: string
  name: string
  status: DocStatus
  date?: Date | string
  expires?: Date | string
  signers?: string[]
  pages?: number
  size?: string
  customizable?: boolean
  isMain?: boolean
}

export interface DocVendor {
  name: string
  email: string
  phone: string
}

export interface DocFolder {
  id: string
  ref: string
  title: string
  address: string
  type: string
  price: number
  isRent?: boolean
  surface: number
  photo: string
  vendor: DocVendor
  currentPhase: DocPhaseId
  progress: number
  lastActivity: Date
  isArchived?: boolean
  tags: string[]
  docs: DocItem[]
}

export interface DocTemplate {
  id: string
  type: string
  name: string
  desc: string
  pages: number
  lang: string
  lastUsed: Date
  uses: number
  vars: number
}

export interface DocAIAlert {
  kind: 'warn' | 'danger' | 'info'
  icon: string
  title: string
  text: string
  folderId: string
  docId: string
}

export function docFmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function docFmtPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  const s = String(Math.round(n))
  return 'CHF ' + s.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

const today = new Date('2026-05-02T10:00:00')
const daysAgo = (n: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d
}
const daysFromNow = (n: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return d
}

export const DOC_FOLDERS: DocFolder[] = [
  {
    id: 'f-rockwell-attique',
    ref: 'PYJ6-6XB8',
    title: 'Attique Champel — 12 rue Beau-Site',
    address: '12 rue Beau-Site, 1206 Genève',
    type: 'Attique',
    price: 4500000,
    surface: 165,
    photo: '',
    vendor: {
      name: 'M. & Mme Dubois-Laurent',
      email: 'dubois@famille.ch',
      phone: '+41 22 789 45 12',
    },
    currentPhase: 'visits',
    progress: 0.42,
    lastActivity: daysAgo(0),
    tags: ['Prestige', 'Mandat exclusif'],
    docs: [
      { id: 'd1', phase: 'mandate', type: 'mandate-excl', name: 'Mandat de vente exclusif', status: 'signed', date: daysAgo(58), expires: daysFromNow(305), signers: ['Vendeur', 'Agent'], pages: 6, size: '412 Ko' },
      { id: 'd2', phase: 'mandate', type: 'id-vendor', name: "Pièces d'identité vendeurs", status: 'signed', date: daysAgo(58), pages: 4, size: '1.2 Mo' },
      { id: 'd3', phase: 'mandate', type: 'property-deed', name: 'Acte de propriété (extrait RF)', status: 'signed', date: daysAgo(57), pages: 8, size: '890 Ko' },
      { id: 'd4', phase: 'prep', type: 'brochure', name: 'Brochure — Attique Champel', status: 'signed', date: daysAgo(45), pages: 14, size: '6.4 Mo', customizable: true, isMain: true },
      { id: 'd5', phase: 'prep', type: 'dpe', name: 'Certificat énergétique CECB', status: 'signed', date: daysAgo(44), expires: daysFromNow(2920), pages: 12, size: '2.1 Mo' },
      { id: 'd6', phase: 'prep', type: 'floorplan', name: 'Plans architecte (étage 7)', status: 'signed', date: daysAgo(43), pages: 3, size: '4.8 Mo' },
      { id: 'd7', phase: 'prep', type: 'charges', name: 'Décompte de charges 2024-2025', status: 'signed', date: daysAgo(40), pages: 6, size: '380 Ko' },
      { id: 'd8', phase: 'visits', type: 'visit-form', name: 'Bon de visite — A. Reinhardt', status: 'signed', date: daysAgo(12), signers: ['Acheteur', 'Agent'], pages: 2, size: '180 Ko' },
      { id: 'd9', phase: 'visits', type: 'visit-report', name: 'CR de visite — A. Reinhardt', status: 'draft', date: daysAgo(11), pages: 3, size: '245 Ko' },
      { id: 'd10', phase: 'visits', type: 'visit-form', name: 'Bon de visite — Famille Chen', status: 'signed', date: daysAgo(8), signers: ['Acheteur', 'Agent'], pages: 2, size: '180 Ko' },
      { id: 'd11', phase: 'visits', type: 'visit-form', name: 'Bon de visite — S. Volkov', status: 'pending', date: daysAgo(2), signers: ['Acheteur', 'Agent'], pages: 2, size: '172 Ko' },
      { id: 'd12', phase: 'offer', type: 'intent-letter', name: "Lettre d'intention — A. Reinhardt", status: 'missing' },
      { id: 'd13', phase: 'offer', type: 'buyer-kyc', name: 'KYC acheteur (3 dossiers)', status: 'missing' },
      { id: 'd14', phase: 'promise', type: 'promise-sale', name: 'Compromis de vente', status: 'missing' },
      { id: 'd15', phase: 'deed', type: 'deed-sale', name: 'Acte authentique de vente', status: 'missing' },
    ],
  },
  {
    id: 'f-paquis-loft',
    ref: 'PXK4-2FM1',
    title: 'Loft contemporain — Pâquis',
    address: '8 rue de Berne, 1201 Genève',
    type: 'Loft',
    price: 1850000,
    surface: 112,
    photo: '',
    vendor: { name: 'Antoine Mercier', email: 'a.mercier@gmail.com', phone: '+41 78 234 12 89' },
    currentPhase: 'promise',
    progress: 0.78,
    lastActivity: daysAgo(1),
    tags: ['Mandat exclusif', 'Sous compromis'],
    docs: [
      { id: 'l1', phase: 'mandate', type: 'mandate-excl', name: 'Mandat de vente exclusif', status: 'signed', date: daysAgo(95), expires: daysFromNow(270), signers: ['Vendeur', 'Agent'], pages: 6, size: '398 Ko' },
      { id: 'l2', phase: 'mandate', type: 'id-vendor', name: "Pièce d'identité vendeur", status: 'signed', date: daysAgo(95), pages: 2, size: '680 Ko' },
      { id: 'l3', phase: 'prep', type: 'brochure', name: 'Brochure — Loft Pâquis', status: 'signed', date: daysAgo(78), pages: 10, size: '4.2 Mo', customizable: true, isMain: true },
      { id: 'l4', phase: 'prep', type: 'dpe', name: 'CECB (rénovation 2023)', status: 'signed', date: daysAgo(76), expires: daysFromNow(2700), pages: 12, size: '2.0 Mo' },
      { id: 'l5', phase: 'visits', type: 'visit-form', name: '4 bons de visite — divers', status: 'signed', date: daysAgo(35), signers: ['Acheteur', 'Agent'], pages: 8, size: '720 Ko' },
      { id: 'l6', phase: 'offer', type: 'intent-letter', name: "Lettre d'intention — M. Schäfer", status: 'signed', date: daysAgo(18), signers: ['Acheteur'], pages: 2, size: '145 Ko' },
      { id: 'l7', phase: 'offer', type: 'buyer-kyc', name: 'KYC acheteur — M. Schäfer', status: 'signed', date: daysAgo(15), pages: 6, size: '1.4 Mo' },
      { id: 'l8', phase: 'promise', type: 'promise-sale', name: 'Compromis de vente', status: 'pending', date: daysAgo(3), signers: ['Vendeur', 'Acheteur', 'Notaire'], pages: 22, size: '1.8 Mo' },
      { id: 'l9', phase: 'promise', type: 'financing-proof', name: 'Attestation de financement BCGE', status: 'signed', date: daysAgo(8), pages: 1, size: '95 Ko' },
      { id: 'l10', phase: 'deed', type: 'deed-sale', name: 'Acte authentique', status: 'missing' },
    ],
  },
  {
    id: 'f-eaux-vives-villa',
    ref: 'VLM8-9QR2',
    title: 'Villa familiale — Eaux-Vives',
    address: '23 chemin du Velours, 1207 Genève',
    type: 'Villa',
    price: 6900000,
    surface: 320,
    photo: '',
    vendor: { name: 'Mme Hélène Rosset', email: 'h.rosset@me.com', phone: '+41 79 456 22 11' },
    currentPhase: 'mandate',
    progress: 0.15,
    lastActivity: daysAgo(3),
    tags: ['Off-market', 'Confidentiel'],
    docs: [
      { id: 'v1', phase: 'mandate', type: 'mandate-excl', name: 'Mandat de vente', status: 'draft', date: daysAgo(5), signers: ['Vendeur', 'Agent'], pages: 6, size: '380 Ko' },
      { id: 'v2', phase: 'mandate', type: 'id-vendor', name: "Pièce d'identité vendeur", status: 'signed', date: daysAgo(4), pages: 2, size: '540 Ko' },
      { id: 'v3', phase: 'mandate', type: 'property-deed', name: 'Acte de propriété (extrait RF)', status: 'missing' },
      { id: 'v4', phase: 'prep', type: 'dpe', name: 'CECB', status: 'missing' },
      { id: 'v5', phase: 'prep', type: 'brochure', name: 'Brochure — Villa Eaux-Vives', status: 'missing', customizable: true, isMain: true },
      { id: 'v6', phase: 'prep', type: 'floorplan', name: 'Plans + cadastre', status: 'pending', date: daysAgo(2), pages: 4, size: '3.2 Mo' },
    ],
  },
  {
    id: 'f-carouge-loc',
    ref: 'LCR3-8ZW7',
    title: '3.5 pièces meublé — Carouge (location)',
    address: '14 rue Saint-Joseph, 1227 Carouge',
    type: 'Appartement',
    price: 3400,
    isRent: true,
    surface: 78,
    photo: '',
    vendor: { name: 'Régie Foncière Carouge', email: 'location@rfc.ch', phone: '+41 22 343 11 22' },
    currentPhase: 'offer',
    progress: 0.65,
    lastActivity: daysAgo(0),
    tags: ['Location', 'Meublé'],
    docs: [
      { id: 'r1', phase: 'mandate', type: 'mandate-loc', name: 'Mandat de location', status: 'signed', date: daysAgo(22), signers: ['Régie', 'Agent'], pages: 4, size: '260 Ko' },
      { id: 'r2', phase: 'prep', type: 'brochure', name: 'Brochure — 3.5p Carouge', status: 'signed', date: daysAgo(20), pages: 6, size: '2.1 Mo', customizable: true, isMain: true },
      { id: 'r3', phase: 'visits', type: 'visit-form', name: '3 bons de visite', status: 'signed', date: daysAgo(8), signers: ['Locataire', 'Agent'], pages: 6, size: '480 Ko' },
      { id: 'r4', phase: 'offer', type: 'tenant-file', name: 'Dossier locataire — D. Moretti', status: 'pending', date: daysAgo(1), pages: 14, size: '1.6 Mo' },
      { id: 'r5', phase: 'offer', type: 'tenant-kyc', name: 'Justificatifs revenus + extraits OP', status: 'pending', date: daysAgo(1), pages: 8, size: '720 Ko' },
      { id: 'r6', phase: 'promise', type: 'lease', name: 'Bail à loyer', status: 'missing' },
    ],
  },
  {
    id: 'f-cologny-archive',
    ref: 'ARC1-5BN3',
    title: 'Maison Cologny — VENDU 12.2025',
    address: '5 chemin du Petit-Saconnex, 1223 Cologny',
    type: 'Maison',
    price: 5200000,
    surface: 240,
    photo: '',
    vendor: { name: 'Famille Wenger', email: 'wenger@bluewin.ch', phone: '+41 22 789 33 11' },
    currentPhase: 'deed',
    progress: 1.0,
    lastActivity: daysAgo(140),
    isArchived: true,
    tags: ['Archivé', 'Vendu'],
    docs: [
      { id: 'a1', phase: 'mandate', type: 'mandate-excl', name: 'Mandat de vente exclusif', status: 'archived', date: daysAgo(280) },
      { id: 'a2', phase: 'prep', type: 'brochure', name: 'Brochure — Maison Cologny', status: 'archived', date: daysAgo(265), customizable: true, isMain: true },
      { id: 'a3', phase: 'promise', type: 'promise-sale', name: 'Compromis de vente', status: 'archived', date: daysAgo(180) },
      { id: 'a4', phase: 'deed', type: 'deed-sale', name: 'Acte authentique de vente', status: 'archived', date: daysAgo(140) },
      { id: 'a5', phase: 'deed', type: 'transaction-report', name: 'Rapport de transaction final', status: 'archived', date: daysAgo(135) },
    ],
  },
]

export const DOC_TEMPLATES: DocTemplate[] = [
  { id: 'tpl-mandate-excl', type: 'mandate-excl', name: 'Mandat de vente exclusif', desc: 'Mandat avec exclusivité 12 mois — clauses MEGGA standards', pages: 6, lang: 'FR', lastUsed: daysAgo(5), uses: 47, vars: 18 },
  { id: 'tpl-promise-sale', type: 'promise-sale', name: 'Compromis de vente', desc: 'Promesse de vente bilatérale + conditions suspensives', pages: 22, lang: 'FR', lastUsed: daysAgo(3), uses: 23, vars: 42 },
  { id: 'tpl-visit-form', type: 'visit-form', name: 'Bon de visite', desc: 'Confidentialité + non-circumvention', pages: 2, lang: 'FR', lastUsed: daysAgo(0), uses: 156, vars: 9 },
  { id: 'tpl-visit-report', type: 'visit-report', name: 'Compte-rendu de visite', desc: "Synthèse + score d'intérêt acheteur (IA)", pages: 3, lang: 'FR', lastUsed: daysAgo(1), uses: 89, vars: 14 },
  { id: 'tpl-estimation', type: 'estimation', name: 'Estimation de bien', desc: 'Comparables + méthode hédoniste + fourchette', pages: 12, lang: 'FR', lastUsed: daysAgo(8), uses: 34, vars: 28 },
  { id: 'tpl-intent-letter', type: 'intent-letter', name: "Lettre d'intention", desc: "Offre d'achat conditionnelle, validité 7-15 jours", pages: 2, lang: 'FR', lastUsed: daysAgo(11), uses: 18, vars: 11 },
]
