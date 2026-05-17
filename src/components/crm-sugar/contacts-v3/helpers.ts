// MEGGA Contacts V3 — helpers de formatage + adaptateur de données.
// Port de `refonte-contacts-shared.jsx` + `crm-screen-contacts-v2.jsx` (cv2Adapt).

import type { CrmContact, CrmBien } from '../mockData'
import { CRM_TEAM, CRM_BIENS, CRM_DEALS, CRM_MATCHES } from '../mockData'
import type { StageId } from '../tokens'

// ─── Référentiel temporel figé (cohérent avec la maquette) ─────────────
// La maquette s'ancre au 17 mai 2026 — date courante du dataset Sugar.
export const RC_NOW = new Date('2026-05-17T10:00:00')

// ─── Formatters ────────────────────────────────────────────────────────
export function rcInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
}

export function rcFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'CHF ' + n.toLocaleString('fr-CH').replace(/ |,/g, "'")
}

export function rcRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const ms = RC_NOW.getTime() - d.getTime()
  const h = ms / 3600000
  if (h < 1) return 'il y a ' + Math.max(1, Math.round(ms / 60000)) + ' min'
  if (h < 24) return 'il y a ' + Math.round(h) + ' h'
  const j = Math.round(h / 24)
  if (j < 7) return 'il y a ' + j + ' j'
  if (j < 30) return 'il y a ' + Math.round(j / 7) + ' sem'
  return 'il y a ' + Math.round(j / 30) + ' mois'
}

// ─── Forme adaptée pour les primitives Rc ───────────────────────────────
export type RcKycStatus = 'verified' | 'pending' | 'stale' | 'none'
export type RcAudience = 'buyer' | 'seller' | 'tenant' | 'watch'

export interface RcMandate {
  ref: string
  title: string
  type: string
  signed: boolean
  commission: number
  price: number | null
  viewsThisWeek: number
  visitRequests: number
  expiresInDays: number | null
}

export interface RcContact extends Omit<CrmContact, 'kyc' | 'type'> {
  // Conserve `type` sur 4 valeurs côté UI : buyer/seller/tenant/landlord.
  type: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'mixed'
  kyc: RcKycStatus
  stage: StageId | null
  matchesSent: number
  visitNext: string | null
  mandates: RcMandate[]
  sourceLabel: string
  assignedToLabel: string
}

/**
 * Patch utilisé pour inline-edit. On exclut `criteria` du Partial parent puis on
 * le rajoute en `Record<string, unknown>` permissif — sinon TS collapse vers la
 * forme stricte `{ transaction, types, cantons, budgetMax }` et refuse les
 * patches partiels comme `{ budgetMin: 950000 }`.
 */
export type RcContactPatch = Partial<Omit<RcContact, 'criteria'>> & {
  criteria?: Record<string, unknown>
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Site web',
  referral: 'Recommandation',
  AI: 'AI · email',
  call: 'Appel direct',
  portal: 'Portail',
  'walk-in': 'Walk-in',
  csv: 'Import',
  other: 'Autre',
}

function mandateFromBien(b: CrmBien): RcMandate {
  return {
    ref: b.id,
    title: b.title || b.addr || b.id,
    type: b.mandat?.type || '—',
    signed: !!b.mandat?.signedAt,
    commission: b.mandat?.commission ?? 0,
    price: b.price ?? b.rent ?? null,
    viewsThisWeek: b.stats?.views ?? 0,
    visitRequests: b.stats?.visitRequests ?? 0,
    expiresInDays: b.mandat?.expiresAt
      ? Math.round(
          (new Date(b.mandat.expiresAt).getTime() - RC_NOW.getTime()) /
            86400000,
        )
      : null,
  }
}

/**
 * cv2Adapt — CrmContact (mockData) → RcContact (forme V3).
 * Calcule kyc string, stage, matchesSent, visitNext, mandates, labels.
 */
export function rcAdaptContact(c: CrmContact): RcContact {
  const deals = CRM_DEALS.filter(d => d.contactId === c.id)
  const matches = CRM_MATCHES.filter(m => m.contactId === c.id)
  const matchesSent = matches.filter(m => m.status !== 'to-send').length

  const nextVisitDeal = deals.find(d => d.stage === 'visit-scheduled')
  const visitNext = nextVisitDeal?.nextAction?.dueAt || null

  const biens = CRM_BIENS.filter(b => b.ownerContactId === c.id)
  const mandates = biens.map(mandateFromBien)

  const stage = deals[0]?.stage ?? null
  const isTenant = c.type === 'tenant' || c.criteria?.transaction === 'location'

  const agents = CRM_TEAM.reduce<Record<string, string>>((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})

  return {
    ...c,
    type: isTenant ? 'tenant' : c.type,
    kyc: (c.kyc?.status ?? 'none') as RcKycStatus,
    stage,
    matchesSent,
    visitNext,
    mandates,
    sourceLabel: SOURCE_LABELS[c.source] ?? c.source,
    assignedToLabel: agents[c.assignedTo] ?? c.assignedTo,
  }
}

// ─── « Une ligne » de contexte sous le nom (RcContactRow) ───────────────
// La SEULE meta affichée — pas de pile d'infos.
export function rcContextLine(c: RcContact): string {
  if (c.type === 'buyer' || c.type === 'tenant') {
    const cr = c.criteria
    if (!cr) return ''
    const where = (cr.cantons || []).join('/')
    const what = (cr.types || []).join(', ')
    const budget =
      c.type === 'tenant'
        ? cr.budgetMax
          ? `≤ ${rcFmtCHF(cr.budgetMax)}/mois`
          : ''
        : cr.budgetMax
          ? `≤ ${rcFmtCHF(cr.budgetMax)}`
          : ''
    return [`Cherche ${what || 'bien'}`, where, budget]
      .filter(Boolean)
      .join(' · ')
  }
  if (c.type === 'seller') {
    const m = c.mandates[0]
    if (!m) return 'Sans mandat actif'
    return `${m.title} · mandat ${m.type} · ${rcFmtCHF(m.price)}`
  }
  return ''
}

// ─── « À surveiller » — calcul cumulatif sur 4 critères ──────────────────
const ONE_DAY = 86400000
export function rcInWatch(c: RcContact): boolean {
  const now = RC_NOW.getTime()
  const lastMs = new Date(c.lastActivityAt).getTime()
  const createdMs = new Date(c.createdAt).getTime()
  if (now - lastMs > 30 * ONE_DAY) return true // dormant
  if (now - createdMs < 2 * ONE_DAY && c.kyc === 'none') return true // nouveau
  if (c.kyc === 'stale') return true
  if ((c.score || 0) < 50) return true
  return false
}

// ─── Filtres secondaires par audience ───────────────────────────────────
export interface RcFilter {
  id: string
  label: string
  match: (c: RcContact) => boolean
}

export const RC_FILTERS_BY_AUDIENCE: Record<RcAudience, RcFilter[]> = {
  buyer: [
    { id: 'all', label: 'Tous', match: () => true },
    {
      id: 'to-match',
      label: 'À matcher',
      match: c => (c.matchesSent || 0) === 0,
    },
    { id: 'visit', label: 'Visite à venir', match: c => !!c.visitNext },
    {
      id: 'offer',
      label: 'En offre',
      match: c => c.stage === 'offer',
    },
    {
      id: 'warm',
      label: 'À relancer 7j+',
      match: c => {
        const d = new Date(c.lastActivityAt)
        return RC_NOW.getTime() - d.getTime() > 7 * ONE_DAY
      },
    },
  ],
  seller: [
    { id: 'all', label: 'Tous', match: () => true },
    {
      id: 'to-sign',
      label: 'Mandat à signer',
      match: c => c.mandates.some(m => !m.signed),
    },
    {
      id: 'active',
      label: 'Diffusion active',
      match: c => c.mandates.some(m => m.signed && m.viewsThisWeek > 0),
    },
    {
      id: 'silent',
      label: 'Sans visite',
      match: c =>
        c.mandates.length > 0 &&
        c.mandates.every(m => (m.visitRequests || 0) === 0),
    },
    {
      id: 'renew',
      label: 'Renouvellement <30j',
      match: c =>
        c.mandates.some(m => m.expiresInDays != null && m.expiresInDays < 30),
    },
  ],
  tenant: [
    { id: 'all', label: 'Tous', match: () => true },
    {
      id: 'urgent',
      label: 'Urgents',
      match: c => (c.tags || []).includes('urgent'),
    },
    {
      id: 'no-match',
      label: 'Sans matchs envoyés',
      match: c => (c.matchesSent || 0) === 0,
    },
  ],
  watch: [
    { id: 'all', label: 'Tous', match: () => true },
    {
      id: 'new',
      label: 'Nouveaux',
      match: c => {
        const ms = RC_NOW.getTime() - new Date(c.createdAt).getTime()
        return ms < 2 * ONE_DAY && c.kyc === 'none'
      },
    },
    {
      id: 'dormant',
      label: 'Dormants',
      match: c =>
        RC_NOW.getTime() - new Date(c.lastActivityAt).getTime() >
        30 * ONE_DAY,
    },
    {
      id: 'kyc',
      label: 'KYC bloquant',
      match: c => c.kyc === 'none' || c.kyc === 'stale',
    },
    {
      id: 'low',
      label: 'Score < 50',
      match: c => (c.score || 0) < 50,
    },
  ],
}

export const RC_AUDIENCE_LABELS: Record<RcAudience, string> = {
  buyer: 'Acheteurs',
  seller: 'Vendeurs',
  tenant: 'Locataires',
  watch: 'À surveiller',
}
