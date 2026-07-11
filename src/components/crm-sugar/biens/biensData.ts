// MEGGA CRM Sugar v2 — Types + helpers de l'écran Mes biens
// 1:1 port from the Claude Design bundle (`crm-biens-data.jsx`).
// Shape CrmSubmission (alimentée en live par useBnSubmissions depuis seller_leads)
// + alertes de publication. Le tableau démo CRM_SUBMISSIONS a été retiré.


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
