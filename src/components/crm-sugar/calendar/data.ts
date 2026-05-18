// MEGGA CRM Sugar v2 — Calendar palette + mock events
// 1:1 port from `crm-calendar-sugar-data.jsx`.

export interface CalEventType {
  id: string
  label: string
  short: string
  bg: string
  ink: string
  accent: string
  icon: string
  dark?: boolean
}

export const CAL_EVENT_TYPES: Record<string, CalEventType> = {
  visite: { id: 'visite', label: 'Visite', short: 'V', bg: '#E8E0D2', ink: '#5C4F3C', accent: '#8A7654', icon: 'home' },
  mandate: { id: 'mandate', label: 'Mandat / Estim.', short: 'M', bg: '#DCE5DA', ink: '#3F5044', accent: '#5F7A66', icon: 'signature' },
  notary: { id: 'notary', label: 'Signature notaire', short: 'N', bg: '#E5D9E0', ink: '#4F3C48', accent: '#7A5C70', icon: 'stamp' },
  task: { id: 'task', label: 'Tâche / Relance', short: 'T', bg: '#DCE0E8', ink: '#3F4554', accent: '#5F6A82', icon: 'check' },
  publish: { id: 'publish', label: 'Publication', short: 'P', bg: '#0B0C0E', ink: '#FFFFFF', accent: '#FFFFFF', icon: 'upload', dark: true },
  // Événements externes — synchronisés en lecture seule depuis Google/Outlook.
  gcal: { id: 'gcal', label: 'Google Calendar', short: 'G', bg: '#E2DCEC', ink: '#4A4170', accent: '#6B5BA2', icon: 'check' },
  ocal: { id: 'ocal', label: 'Outlook Calendar', short: 'O', bg: '#D9E2EE', ink: '#33476E', accent: '#4E6BA6', icon: 'check' },
}

export type CalEventTypeId = keyof typeof CAL_EVENT_TYPES

export interface CalEventProperty {
  id: string
  title: string
  area: number
  price: number | null
  tone: string
}

export interface CalEventContact {
  name: string
  role: string
  phone?: string
  warm?: number
}

export interface CalEvent {
  id: string
  type: CalEventTypeId
  title: string
  property?: CalEventProperty
  contact?: CalEventContact
  location?: string
  start: Date
  end: Date
  notes?: string
}

// Build anchor at "Tuesday this week, 14:32"
const today = new Date()
const dayOffset = today.getDay() === 0 ? -5 : 2 - today.getDay()
const ANCHOR = new Date(today)
ANCHOR.setDate(ANCHOR.getDate() + dayOffset)
ANCHOR.setHours(14, 32, 0, 0)

function at(offsetDays: number, h: number, m = 0, durationMin = 60): { start: Date; end: Date } {
  const start = new Date(ANCHOR)
  start.setDate(start.getDate() + offsetDays)
  start.setHours(h, m, 0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + durationMin)
  return { start, end }
}

export const CAL_NOW: Date = ANCHOR

export const CAL_EVENTS: CalEvent[] = [
  // J-1
  { id: 'e1', type: 'visite', title: 'Visite — Famille Müller',
    property: { id: 'p1', title: 'Appartement 4.5 · Pully', area: 110, price: 1450000, tone: '#C8B89E' },
    contact: { name: 'Hans Müller', role: 'Acheteur', phone: '+41 79 234 12 67', warm: 92 },
    location: 'Av. de Lavaux 23, 1009 Pully',
    ...at(-1, 10, 0, 45), notes: 'Famille avec 2 enfants. Cherche balcon, calme. Préqualifié 1.4M.' },
  { id: 'e2', type: 'notary', title: 'Signature acte — Vente Genève',
    property: { id: 'p2', title: 'Villa · Cologny', area: 280, price: 3200000, tone: '#B8A89E' },
    contact: { name: 'Maître Dupasquier', role: 'Notaire' },
    location: 'Étude Dupasquier, Rue du Rhône 14',
    ...at(-1, 14, 30, 90), notes: 'Signature finale. Acquéreur : famille Lambert.' },

  // J0
  { id: 'e3', type: 'task', title: 'Relance Mme Dupont',
    contact: { name: 'Sophie Dupont', role: 'Acheteuse', phone: '+41 78 555 21 14', warm: 78 },
    ...at(0, 9, 0, 15), notes: 'Rappel : avait demandé infos sur Lutry après JPO.' },
  { id: 'e4', type: 'mandate', title: 'Estimation — Maison Vevey',
    property: { id: 'p3', title: 'Maison · Vevey', area: 180, price: null, tone: '#A8B5BF' },
    contact: { name: 'Anne et Marc Bovet', role: 'Vendeurs' },
    location: 'Ch. des Vignes 8, 1800 Vevey',
    ...at(0, 11, 0, 60), notes: 'Première visite estimation. Prévoir tablette + fiche comparable.' },
  { id: 'e5', type: 'visite', title: 'Visite — Couple Janssens',
    property: { id: 'p4', title: 'Loft · Lausanne Flon', area: 95, price: 1180000, tone: '#9EA7B0' },
    contact: { name: 'Lina Janssens', role: 'Acheteuse', phone: '+41 76 412 88 03', warm: 88 },
    location: 'Rue Centrale 12, 1003 Lausanne',
    ...at(0, 15, 0, 45), notes: '2ème visite. Très intéressés. Prévoir devis travaux cuisine.' },
  { id: 'e6', type: 'visite', title: 'Visite — M. Rochat',
    property: { id: 'p5', title: 'Studio · Ouchy', area: 38, price: 590000, tone: '#D4DDE3' },
    contact: { name: 'Pierre Rochat', role: 'Acheteur', phone: '+41 79 011 22 89', warm: 65 },
    location: "Quai d'Ouchy 6, 1006 Lausanne",
    ...at(0, 16, 30, 30), notes: 'Investisseur. Premier achat locatif.' },
  { id: 'e7', type: 'task', title: 'Préparer dossier mandat Bovet',
    ...at(0, 18, 0, 45), notes: 'Synthèse comparables + grille tarifaire à imprimer.' },

  // J+1
  { id: 'e8', type: 'publish', title: 'Publication programmée — Loft Flon',
    property: { id: 'p4', title: 'Loft · Lausanne Flon', area: 95, price: 1180000, tone: '#9EA7B0' },
    ...at(1, 9, 0, 0), notes: 'Publication automatique sur MEGGA + portails.' },
  { id: 'e9', type: 'visite', title: 'Visite — Mme Reber',
    property: { id: 'p6', title: 'Maison · Morges', area: 220, price: 2100000, tone: '#B5A89E' },
    contact: { name: 'Claire Reber', role: 'Acheteuse', phone: '+41 77 998 14 22', warm: 94 },
    location: 'Av. de la Gare 45, 1110 Morges',
    ...at(1, 10, 30, 60) },
  { id: 'e10', type: 'visite', title: 'Visite — M. Schneider',
    property: { id: 'p7', title: 'Appart 3.5 · Nyon', area: 78, price: 920000, tone: '#C2C8CE' },
    contact: { name: 'Lukas Schneider', role: 'Acheteur', phone: '+41 78 332 09 11', warm: 71 },
    location: 'Rue de la Morâche 18, 1260 Nyon',
    ...at(1, 14, 0, 45) },
  { id: 'e11', type: 'mandate', title: 'Signature mandat exclusif',
    contact: { name: 'Famille Berthoud', role: 'Vendeurs' },
    ...at(1, 16, 30, 60) },

  // J+2
  { id: 'e12', type: 'visite', title: 'Visite groupe — Villa Cologny',
    property: { id: 'p8', title: 'Villa · Cologny', area: 320, price: 4800000, tone: '#A89E8E' },
    ...at(2, 11, 0, 90), notes: 'Journée portes ouvertes. 5 inscrits.' },
  { id: 'e13', type: 'task', title: 'Briefing équipe matinale',
    ...at(2, 8, 30, 30) },
  { id: 'e14', type: 'notary', title: 'État des lieux — Sortie locataire',
    property: { id: 'p9', title: 'App 2.5 · Renens', area: 52, price: null, tone: '#C8C2BC' },
    ...at(2, 15, 0, 60) },

  // J+3
  { id: 'e15', type: 'visite', title: 'Visite — Couple Tessari',
    property: { id: 'p3', title: 'Maison · Vevey', area: 180, price: null, tone: '#A8B5BF' },
    contact: { name: 'Marco Tessari', role: 'Acheteur', warm: 82 },
    ...at(3, 10, 0, 60) },
  { id: 'e16', type: 'task', title: 'Appel suivi M. Rochat',
    ...at(3, 14, 0, 20) },

  // J+4
  { id: 'e17', type: 'mandate', title: 'Estimation — Penthouse Lausanne',
    contact: { name: 'Élise Marchand', role: 'Vendeuse' },
    ...at(4, 9, 30, 90) },
  { id: 'e18', type: 'visite', title: 'Visite — M. Bonvin',
    property: { id: 'p7', title: 'Appart 3.5 · Nyon', area: 78, price: 920000, tone: '#C2C8CE' },
    ...at(4, 14, 30, 45) },

  // J-2
  { id: 'e19', type: 'visite', title: 'Visite — Famille Roth',
    property: { id: 'p4', title: 'Loft · Lausanne Flon', area: 95, price: 1180000, tone: '#9EA7B0' },
    ...at(-2, 11, 0, 45) },
  { id: 'e20', type: 'task', title: 'Reportage photo Vevey',
    ...at(-2, 14, 0, 120) },
]

export interface CalHotBuyer {
  id: string
  name: string
  initials: string
  warm: number
  reason: string
  lastContact: string
  tone: string
}

export const CAL_HOT_BUYERS: CalHotBuyer[] = [
  { id: 'hb1', name: 'Claire Reber', initials: 'CR', warm: 94, reason: 'Visite demain · 3 visites en 10j · budget validé 2.1M', lastContact: 'Hier', tone: '#0B0C0E' },
  { id: 'hb2', name: 'Hans Müller', initials: 'HM', warm: 92, reason: 'Visite hier · feedback positif · prêt accordé', lastContact: 'Hier', tone: '#0B0C0E' },
  { id: 'hb3', name: 'Lina Janssens', initials: 'LJ', warm: 88, reason: "2ème visite Loft Flon aujourd'hui · couple décisionnaire", lastContact: "Aujourd'hui", tone: '#0B0C0E' },
]

export interface CalAIInsight {
  id: string
  kind: 'transit' | 'opportunity'
  severity: 'warning' | 'info'
  title: string
  detail: string
  suggestion: string
  events: string[]
}

export const CAL_AI_INSIGHTS: CalAIInsight[] = [
  { id: 'ai1', kind: 'transit', severity: 'warning',
    title: 'Trajet serré · 14h45 → 15h00',
    detail: 'Cologny → Lausanne Flon en 15 min : impossible en heure de pointe (estimation 38 min).',
    suggestion: 'Repousser visite Janssens à 15h30 ?',
    events: ['e2', 'e5'] },
  { id: 'ai2', kind: 'opportunity', severity: 'info',
    title: '3 acheteurs chauds non recontactés',
    detail: "Mme Reber, M. Schneider et Mme Vogel n'ont pas été relancés depuis 7+ jours.",
    suggestion: 'Bloquer 30 min jeudi pour relances groupées ?',
    events: [] },
]

export interface CalSugarPalette {
  bg: string
  card: string
  cardSubtle: string
  cardHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  line2: string
  black: string
  shadowSm: string
  shadow: string
  shadowHover: string
}

export const CAL_PALETTE: CalSugarPalette = {
  bg: '#EDEFF3',
  card: '#FFFFFF',
  cardSubtle: '#F4F6F9',
  cardHover: '#FAFBFD',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  line: 'rgba(11,12,14,0.06)',
  line2: 'rgba(11,12,14,0.10)',
  black: '#0B0C0E',
  shadowSm: '0 2px 8px rgba(11,12,14,0.04), 0 1px 3px rgba(11,12,14,0.05)',
  shadow: '0 8px 24px rgba(11,12,14,0.08), 0 2px 8px rgba(11,12,14,0.05)',
  shadowHover: '0 16px 36px rgba(11,12,14,0.14), 0 4px 12px rgba(11,12,14,0.08)',
}
