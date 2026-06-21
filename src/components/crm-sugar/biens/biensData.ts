// MEGGA CRM Sugar v2 — Types + helpers de l'écran Mes biens
// 1:1 port from the Claude Design bundle (`crm-biens-data.jsx`).
// Shape CrmSubmission (alimentée en live par useBnSubmissions depuis seller_leads)
// + alertes de publication. Le tableau démo CRM_SUBMISSIONS a été retiré.

import type { CrmBien } from '../mockData'

export interface CrmSubmission {
  id: string
  submittedAt: string
  contactId: string | null
  /** Real seller name from seller_leads.contact_name (never mockData) */
  contactName: string
  /** Real seller email from seller_leads.contact_email (honest fallback) */
  contactEmail: string
  contactDraft?: {
    firstName: string
    lastName: string
    email: string
    phone: string
    lang: string
  }
  sla: string
  type: 'maison' | 'appartement' | 'villa' | 'commercial' | 'office' | 'parking' | 'storage' | 'land'
  transaction: 'vente' | 'location'
  title: string
  addr: string
  canton: string
  rooms: number
  beds: number
  baths: number
  area: number
  year: number
  energy: string
  floor: number | null
  floorsTotal: number | null
  askingPrice?: number | null
  askingRent?: number | null
  priceMode: 'owner' | 'agent'
  motive: string
  deadline: string
  condition: string
  photoCount: number
  desc: string
  features: string[]
  accent: string
  autoChecks: {
    addressMatch: 'ok' | 'warn' | 'error' | 'pending'
    photosCount: 'ok' | 'warn' | 'error' | 'pending'
    duplicates: 'ok' | 'warn' | 'error' | 'pending'
    cantonalRegistry: 'ok' | 'warn' | 'error' | 'pending'
  }
}

// BienHistoryEvent + CRM_BIEN_HISTORY retirés : étaient consommés par
// BnDetailOverlay (onglet Historique) mais le wire backend (query
// activity_events filter entity_type='property') n'existait pas. BnDetailOverlay
// affiche maintenant l'empty state "Aucun événement enregistré".

export interface BienAlert {
  level: 'blocker' | 'warn'
  text: string
}

export function crmBienAlerts(bien: CrmBien): BienAlert[] {
  const alerts: BienAlert[] = []
  if (!bien.price && !bien.rent)
    alerts.push({ level: 'blocker', text: 'Prix non renseigné — requis avant publication.' })
  if (bien.photoCount < 8)
    alerts.push({ level: 'blocker', text: `${bien.photoCount} photos — minimum 8 pour publier.` })
  if (bien.signedPhotoCount < bien.photoCount) {
    const missing = bien.photoCount - bien.signedPhotoCount
    alerts.push({ level: 'warn', text: `${missing} photo(s) non signée(s) C2PA.` })
  }
  if (bien.mandat && bien.mandat.expiresAt) {
    const exp = new Date(bien.mandat.expiresAt)
    const days = Math.round((exp.getTime() - Date.now()) / 86400000)
    if (days >= 0 && days <= 30)
      alerts.push({ level: 'warn', text: `Mandat expire dans ${days} jours.` })
    if (days < 0)
      alerts.push({ level: 'blocker', text: `Mandat expiré depuis ${Math.abs(days)} jours.` })
  }
  if (!bien.ownerContactId && bien.status !== 'draft')
    alerts.push({ level: 'warn', text: 'Vendeur non rattaché à un contact CRM.' })
  if (!bien.energy) alerts.push({ level: 'warn', text: 'Classe énergétique manquante (CECB).' })
  return alerts
}
