// MEGGA CRM Sugar v2 — Source de vérité pour le banner Soumissions vendeurs.
// Map seller_leads (table Supabase) → CrmSubmission (shape mock UI) pour
// BnSubmissionsBanner + BnSubmissionsDrawer sur BiensSugarV2Page.
//
// Champs non persistés en DB (defaults raisonnables) :
//   beds/baths/year/energy/floor/motive/deadline/condition/features/photoCount
//   autoChecks : tous 'ok' (le real check viendra avec l'IA validation).

import { useMemo } from 'react'
import { useSellerLeads, type SellerLeadRow } from '@/hooks/useSellerLeads'
import type { CrmSubmission } from '@/components/crm-sugar/biens/biensData'

const PROPERTY_TYPE_MAP: Record<string, CrmSubmission['type']> = {
  apartment: 'appartement',
  appartement: 'appartement',
  house: 'maison',
  maison: 'maison',
  villa: 'villa',
  commercial: 'commercial',
  office: 'office',
  parking: 'parking',
  storage: 'storage',
  land: 'land',
}

const ACCENT_TONES = ['#C8B89E', '#B8A89E', '#A8B5BF', '#9EA7B0', '#D4DDE3', '#B5A89E']

function accentFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ACCENT_TONES[Math.abs(h) % ACCENT_TONES.length]
}

function splitName(full: string): { firstName: string; lastName: string } {
  const t = (full ?? '').trim()
  if (!t) return { firstName: '', lastName: '' }
  const parts = t.split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

// SLA : 24h si < 24h depuis la soumission, sinon 48h
function slaFor(createdAt: string): string {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  return hours < 24 ? 'Réponse < 24h' : 'Réponse < 48h'
}

function parseRooms(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return isNaN(n) ? 0 : n
}

function leadToSubmission(lead: SellerLeadRow): CrmSubmission {
  const p = lead.property_data ?? ({} as SellerLeadRow['property_data'])
  const { firstName, lastName } = splitName(lead.contact_name)
  const typeKey = (p.type ?? '').toLowerCase()
  const type = PROPERTY_TYPE_MAP[typeKey] ?? 'appartement'
  const title = `${type === 'maison' ? 'Maison' : type === 'villa' ? 'Villa' : 'Appartement'}${p.city ? ` · ${p.city}` : ''}`
  return {
    id: lead.id,
    submittedAt: lead.created_at,
    contactId: lead.contact_id,
    contactDraft: lead.contact_id ? undefined : {
      firstName,
      lastName,
      email: lead.contact_email,
      phone: lead.contact_phone ?? '',
      lang: 'fr',
    },
    sla: slaFor(lead.created_at),
    type,
    transaction: 'vente',
    title,
    addr: [p.address, p.city].filter(Boolean).join(', '),
    canton: p.canton ?? '',
    rooms: parseRooms(p.rooms),
    beds: 0,
    baths: 0,
    area: p.surface ?? 0,
    year: 0,
    energy: '',
    floor: null,
    floorsTotal: null,
    askingPrice: lead.estimation_median,
    askingRent: null,
    priceMode: 'agent',
    motive: lead.motivation ?? '',
    deadline: '',
    condition: '',
    photoCount: p.photos?.length ?? 0,
    desc: '',
    features: [],
    accent: accentFromId(lead.id),
    autoChecks: {
      addressMatch: 'ok',
      photosCount: (p.photos?.length ?? 0) >= 3 ? 'ok' : 'warn',
      duplicates: 'ok',
      cantonalRegistry: 'ok',
    },
  }
}

export interface UseBnSubmissionsReturn {
  submissions: CrmSubmission[]
  isLoading: boolean
}

export function useBnSubmissions(): UseBnSubmissionsReturn {
  // On ne lit que les leads 'new' (= non traités) — les autres sont gérés via
  // le pipeline / parcours.
  const { data: leads = [], isLoading } = useSellerLeads('new')

  const submissions = useMemo<CrmSubmission[]>(
    () => leads.map(leadToSubmission),
    [leads],
  )

  return { submissions, isLoading }
}
