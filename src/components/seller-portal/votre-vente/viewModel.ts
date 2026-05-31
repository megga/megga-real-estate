// MEGGA — Espace vendeur — adaptateur de données.
// Projette le `SellerPortalData` (issu du hook useSellerPortal / contexte) vers le
// view-model attendu par la page « Votre vente » (porté de la shape mock du handoff).
// Lecture seule : aucune écriture, aucune nouvelle entité.
import type { SellerPortalData, MandateStep, SellerOffer } from '@/lib/mockSellerData'

export type VenteOfferStatus = 'pending' | 'counter' | 'accepted'

export interface VenteOfferVM {
  id: string
  amount: number
  status: VenteOfferStatus
  date: string
}

export interface VentePropertyVM {
  id: string
  label: string
  title: string
  address: string
  city: string
  canton: string
  attrs: string[]
  price: number
  mandate: string
  daysOnline: number
  photos: string[]
}

export interface VenteAgentVM {
  name: string
  role: string
  whatsapp: string
  phone: string
  email: string
  photo: string | null
}

export interface VenteVM {
  property: VentePropertyVM
  current: number // index 0..5 dans SELLER_STEPS
  stats: {
    visits: { value: number; sub: string }
    offers: number
    days: number
    medianDays: number
  }
  offers: VenteOfferVM[]
  activity: { text: string; when: string }[]
  agent: VenteAgentVM
}

// ── Mapping étape mandat (7 valeurs DB) → index parcours vendeur (6 cercles) ──
// négociation + notaire fusionnent dans « Négociation » (4) ; signé/vendu → « Signé » (5).
const STEP_INDEX: Record<MandateStep, number> = {
  mandate_signed: 0,
  published: 1,
  visits: 2,
  offers: 3,
  negotiation: 4,
  notary: 4,
  sold: 5,
}

export function mandateStepToIndex(step: MandateStep): number {
  return STEP_INDEX[step] ?? 0
}

// ── Libellés ──────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  studio: 'Studio',
  commercial: 'Commercial',
  office: 'Bureau',
  parking: 'Parking',
  storage: 'Dépôt',
  land: 'Terrain',
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Bien')
}

function roomsLabel(rooms: number): string {
  if (!rooms || rooms <= 0) return ''
  return `${rooms} ${rooms < 2 ? 'pièce' : 'pièces'}`
}

function mandateLabel(t: 'exclusive' | 'simple'): string {
  return t === 'exclusive' ? 'Mandat exclusif' : 'Mandat simple'
}

// ── Dates ───────────────────────────────────────────────────────────────
function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Date relative courte : « aujourd'hui », « il y a 3 h », « il y a 2 j ». */
function relativeWhen(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return "à l'instant"
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 0) return "aujourd'hui"
  if (days < 30) return `il y a ${days} j`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  return fmtDateLong(iso)
}

// ── Offres : statut DB → statut maquette, filtre les offres non pertinentes ──
const OFFER_STATUS: Partial<Record<SellerOffer['status'], VenteOfferStatus>> = {
  pending: 'pending',
  counter_offer: 'counter',
  accepted: 'accepted',
}

// ── Agent : liens d'action ─────────────────────────────────────────────────
function waLink(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : '#'
}

// ── Adaptateur principal ────────────────────────────────────────────────
export function toVenteVM(data: SellerPortalData): VenteVM {
  const p = data.property
  const k = data.kpis

  const photos = p.photos && p.photos.length > 0 ? p.photos : p.photo ? [p.photo] : []

  const attrs = [roomsLabel(p.rooms), p.surface_m2 ? `${p.surface_m2} m²` : '', typeLabel(p.type)].filter(
    Boolean,
  )

  const offers: VenteOfferVM[] = (data.offers || [])
    .map((o): VenteOfferVM | null => {
      const status = OFFER_STATUS[o.status]
      if (!status) return null // rejected / expired : non affichées côté vendeur
      return { id: o.id, amount: o.amount, status, date: fmtDateLong(o.received_at) }
    })
    .filter((o): o is VenteOfferVM => o !== null)

  const visitsSub =
    k.visits_this_month > 0 ? `dont ${k.visits_this_month} ce mois-ci` : 'ce mois-ci'

  return {
    property: {
      id: p.id,
      label: p.city || p.title,
      title: p.title,
      address: p.address,
      city: [p.postal_code, p.city].filter(Boolean).join(' ').trim() || p.city,
      canton: p.canton,
      attrs,
      price: p.price,
      mandate: mandateLabel(p.mandate_type),
      daysOnline: k.days_on_market,
      photos,
    },
    current: mandateStepToIndex(k.current_step),
    stats: {
      visits: { value: k.visits_total, sub: visitsSub },
      offers: offers.length,
      days: k.days_on_market,
      medianDays: 45,
    },
    offers,
    activity: (data.activities || []).map((e) => ({
      text: e.description,
      when: relativeWhen(e.date),
    })),
    agent: {
      name: data.agent.name,
      role: 'Votre conseiller MEGGA',
      whatsapp: waLink(data.agent.phone),
      phone: data.agent.phone ? `tel:${data.agent.phone.replace(/\s/g, '')}` : '#',
      email: data.agent.email ? `mailto:${data.agent.email}` : '#',
      photo: data.agent.photo,
    },
  }
}
