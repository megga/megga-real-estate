// MEGGA CRM Sugar v2 — Calendar types, palette + layout helpers
// 1:1 port from `crm-calendar-sugar-data.jsx`. Les événements affichés sont
// dérivés en live par useCalendarSugar (les anciens tableaux démo ont été retirés).

import { createContext, useContext } from 'react'
// i18n : le `label` des types d'événement est un GETTER (lu via l'instance i18n
// singleton à l'accès → traduit + réactif au changement de langue, sans changer
// les sites d'appel `CAL_EVENT_TYPES[x].label`). Cf docs/i18n-conventions §6.
import i18n from '@/i18n'

export interface CalEventTypeColors {
  bg: string
  ink: string
  accent: string
  dark?: boolean
}

export interface CalEventType extends CalEventTypeColors {
  id: string
  label: string
  short: string
  icon: string
  /** Variante sombre {bg, ink, accent} — handoff dark mode. */
  darkColors?: CalEventTypeColors
}

export const CAL_EVENT_TYPES: Record<string, CalEventType> = {
  visite: { id: 'visite', get label() { return i18n.t('calendar:eventType.visite') }, short: 'V', bg: '#E8E0D2', ink: '#5C4F3C', accent: '#8A7654', icon: 'home',
    darkColors: { bg: '#2A2417', ink: '#E7D7B7', accent: '#C9A86A' } },
  mandate: { id: 'mandate', get label() { return i18n.t('calendar:eventType.mandate') }, short: 'M', bg: '#DCE5DA', ink: '#3F5044', accent: '#5F7A66', icon: 'signature',
    darkColors: { bg: '#17271D', ink: '#BBDDC4', accent: '#6FB585' } },
  notary: { id: 'notary', get label() { return i18n.t('calendar:eventType.notary') }, short: 'N', bg: '#E5D9E0', ink: '#4F3C48', accent: '#7A5C70', icon: 'stamp',
    darkColors: { bg: '#261C26', ink: '#DCC0D4', accent: '#B083A6' } },
  task: { id: 'task', get label() { return i18n.t('calendar:eventType.task') }, short: 'T', bg: '#DCE0E8', ink: '#3F4554', accent: '#5F6A82', icon: 'check',
    darkColors: { bg: '#1B2230', ink: '#BFCBE2', accent: '#7E92BE' } },
  publish: { id: 'publish', get label() { return i18n.t('calendar:eventType.publish') }, short: 'P', bg: '#0B0C0E', ink: '#FFFFFF', accent: '#FFFFFF', icon: 'upload', dark: true,
    darkColors: { bg: '#ECEDF3', ink: '#14141D', accent: '#14141D', dark: true } },
}

/** Résout les couleurs d'un type selon le thème (clair ↔ sombre). */
export function eventTypeColors(type: CalEventType, isDark: boolean): CalEventTypeColors {
  return isDark && type.darkColors ? type.darkColors : type
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
  /** Suivi d'état (réversible) — handoff dark mode / statuts. */
  status?: 'done' | 'cancelled'
}

export interface CalHotBuyer {
  id: string
  name: string
  initials: string
  warm: number
  reason: string
  lastContact: string
  tone: string
}

export interface CalAIInsight {
  id: string
  kind: 'transit' | 'opportunity'
  severity: 'warning' | 'info'
  title: string
  detail: string
  suggestion: string
  events: string[]
}

export interface CalSugarPalette {
  bg: string
  bgGradient: string
  card: string
  cardSubtle: string
  cardHover: string
  hoverSubtle: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  line2: string
  accent: string
  onAccent: string
  ring: string
  /** @deprecated alias de `accent` (compat composants existants). */
  black: string
  todayCol: string
  nowColor: string
  heroBg: string
  heroInk: string
  heroChip: string
  heroChipStrong: string
  heroShadow: string
  warnBg: string
  warnBorder: string
  warnInk: string
  warnIcon: string
  warmBg: string
  warmInk: string
  warmIcon: string
  dangerInk: string
  shadowSm: string
  shadow: string
  shadowHover: string
  isDark: boolean
}

export const CAL_LIGHT: CalSugarPalette = {
  bg: '#EDEFF3',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F4F6F9',
  cardHover: '#FAFBFD',
  hoverSubtle: '#EBEEF2',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  line: 'rgba(11,12,14,0.06)',
  line2: 'rgba(11,12,14,0.10)',
  accent: '#0B0C0E',
  onAccent: '#FFFFFF',
  ring: '#0B0C0E',
  black: '#0B0C0E',
  todayCol: 'rgba(11,12,14,0.015)',
  nowColor: '#E54D38',
  heroBg: '#0B0C0E',
  heroInk: '#FFFFFF',
  heroChip: 'rgba(255,255,255,0.08)',
  heroChipStrong: 'rgba(255,255,255,0.12)',
  heroShadow: '0 16px 36px rgba(11,12,14,0.18)',
  warnBg: '#FBF1E6',
  warnBorder: '#F2D2A8',
  warnInk: '#7A4A14',
  warnIcon: '#A8631C',
  warmBg: '#FFF3E1',
  warmInk: '#7A4A14',
  warmIcon: '#A8631C',
  dangerInk: '#B33A2A',
  shadowSm: '0 2px 8px rgba(11,12,14,0.04), 0 1px 3px rgba(11,12,14,0.05)',
  shadow: '0 8px 24px rgba(11,12,14,0.08), 0 2px 8px rgba(11,12,14,0.05)',
  shadowHover: '0 16px 36px rgba(11,12,14,0.14), 0 4px 12px rgba(11,12,14,0.08)',
  isDark: false,
}

export const CAL_DARK: CalSugarPalette = {
  bg: '#0A0A0F',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 0%, #14141F 0%, #0D0D14 55%, #0A0A0F 100%)',
  // Surfaces neutralisées (handoff cohérence) : alignées sur RC_DARK de Contacts,
  // pour rejoindre la famille sombre commune du CRM (plus de canal bleu surélevé).
  card: '#1A1C22',
  cardSubtle: '#14171E',
  cardHover: '#22242B',
  hoverSubtle: '#1E2027',
  ink: '#FFFFFF',
  inkSoft: '#C8CCD2',
  muted: '#7E828A',
  ghost: '#4A4D54',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.12)',
  accent: '#ECEDF3',
  onAccent: '#0B0C0E',
  ring: '#ECEDF3',
  black: '#ECEDF3',
  todayCol: 'rgba(255,255,255,0.03)',
  nowColor: '#FF6A52',
  heroBg: 'linear-gradient(135deg, #24262C 0%, #181A1F 100%)',
  heroInk: '#ECEDF3',
  heroChip: 'rgba(255,255,255,0.06)',
  heroChipStrong: 'rgba(255,255,255,0.10)',
  heroShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 18px 40px -14px rgba(0,0,0,0.8)',
  warnBg: '#2A2113',
  warnBorder: '#4A3A1C',
  warnInk: '#F2C98A',
  warnIcon: '#F2B855',
  warmBg: '#33280F',
  warmInk: '#F2C98A',
  warmIcon: '#F2B855',
  dangerInk: '#F26B65',
  shadowSm: '0 0 0 1px rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.45)',
  shadow: '0 0 0 1px rgba(255,255,255,0.06), 0 12px 30px -10px rgba(0,0,0,0.65)',
  shadowHover: '0 0 0 1px rgba(255,255,255,0.09), 0 18px 42px -12px rgba(0,0,0,0.78)',
  isDark: true,
}

/**
 * Palette du calendrier selon le thème actif. En sombre, `bg` suit le thème
 * dark du CRM (`t.bg`). Handoff : remplace l'ancien `CAL_PALETTE` statique
 * (qui laissait les cartes blanches en dark mode).
 */
export function buildCalPalette(dark: boolean, t?: { bg?: string }): CalSugarPalette {
  if (!dark) return CAL_LIGHT
  return t?.bg ? { ...CAL_DARK, bg: t.bg } : CAL_DARK
}

/** Context palette — les composants lisent `useCalPalette()` (plus d'import statique). */
export const CalPaletteContext = createContext<CalSugarPalette>(CAL_LIGHT)
export const useCalPalette = (): CalSugarPalette => useContext(CalPaletteContext)

/** @deprecated Compat : alias de la palette claire. Préférer `useCalPalette()`. */
export const CAL_PALETTE: CalSugarPalette = CAL_LIGHT

// ── Chevauchement : packing en colonnes (type Google Agenda) ────────────────
// Pour un ensemble d'events, renvoie pour chacun { col, cols } : sa colonne et
// le nombre total de colonnes de son cluster de chevauchement. Les vues
// positionnent ensuite chaque bloc côte-à-côte (left = base + span*col/cols).
export interface CalLayoutSlot { col: number; cols: number }

export function calLayout(events: CalEvent[]): Map<string, CalLayoutSlot> {
  const result = new Map<string, CalLayoutSlot>()
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  )

  let cluster: CalEvent[] = []
  let clusterEnd = 0

  const flush = (group: CalEvent[]) => {
    if (group.length === 0) return
    const columns: CalEvent[][] = []
    for (const e of group) {
      let placed = false
      for (const colArr of columns) {
        if (colArr[colArr.length - 1].end.getTime() <= e.start.getTime()) {
          colArr.push(e)
          placed = true
          break
        }
      }
      if (!placed) columns.push([e])
    }
    const cols = columns.length
    columns.forEach((colArr, ci) =>
      colArr.forEach(e => result.set(e.id, { col: ci, cols })),
    )
  }

  for (const e of sorted) {
    if (cluster.length && e.start.getTime() >= clusterEnd) {
      flush(cluster)
      cluster = []
      clusterEnd = 0
    }
    cluster.push(e)
    clusterEnd = Math.max(clusterEnd, e.end.getTime())
  }
  flush(cluster)
  return result
}

// ── Édition / création inline (#6/#7) + parseur NL (#9) ─────────────────────

/** Brouillon vierge : visite 09:00–10:00 le jour courant. */
export function calBlankEvent(currentDate: Date): CalEvent {
  const start = new Date(currentDate)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(10, 0, 0, 0)
  return { id: `draft_${start.getTime()}`, type: 'visite', title: '', start, end }
}

/** Nettoie/normalise un brouillon avant sauvegarde (titre, property/contact → null si vides, prix numérique). */
export function calNormalizeDraft(d: CalEvent): CalEvent {
  const label = CAL_EVENT_TYPES[d.type]?.label ?? 'Événement'
  const title = d.title.trim() || label
  const property =
    d.property && d.property.title?.trim()
      ? {
          ...d.property,
          area: Number(d.property.area) || 0,
          price: d.property.price != null && `${d.property.price}` !== '' ? Number(d.property.price) || null : null,
        }
      : undefined
  const contact = d.contact && d.contact.name?.trim() ? d.contact : undefined
  return {
    ...d,
    title,
    property,
    contact,
    location: d.location?.trim() || undefined,
    notes: d.notes?.trim() || undefined,
  }
}

/**
 * Heuristique FR : transforme une phrase en brouillon d'événement pré-rempli.
 * Prototype — à remplacer par un vrai appel LLM en prod. Couvre type, jour,
 * heure et personne (« avec … » ou 1er nom propre).
 * Ex : « visite Marie demain 14h » → Visite — Marie, J+1 14:00–15:00.
 */
export function calParseNL(text: string, currentDate: Date): CalEvent {
  const lower = text.toLowerCase()

  let type: CalEventTypeId = 'task'
  if (/visite|visit/.test(lower)) type = 'visite'
  else if (/estim|mandat/.test(lower)) type = 'mandate'
  else if (/notaire|signature|acte/.test(lower)) type = 'notary'
  else if (/publi/.test(lower)) type = 'publish'
  else if (/relance|appel|t[aâ]che|rappel/.test(lower)) type = 'task'

  const base = new Date(currentDate)
  if (/apr[èe]s.?demain/.test(lower)) base.setDate(base.getDate() + 2)
  else if (/demain/.test(lower)) base.setDate(base.getDate() + 1)
  else if (!/aujourd/.test(lower)) {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const di = dayNames.findIndex(n => lower.includes(n))
    if (di >= 0) {
      const delta = ((di - base.getDay() + 7) % 7) || 7
      base.setDate(base.getDate() + delta)
    }
    const dm = lower.match(/\ble (\d{1,2})\b/) || lower.match(/(\d{1,2})\/(\d{1,2})/)
    if (dm) {
      base.setDate(Number(dm[1]))
      if (dm[2]) base.setMonth(Number(dm[2]) - 1)
    }
  }

  let hour = 9
  let min = 0
  const tm =
    lower.match(/(\d{1,2})\s*h\s*(\d{2})?/) ||
    lower.match(/(\d{1,2}):(\d{2})/) ||
    lower.match(/(\d{1,2})\s*heures?/)
  if (tm) {
    hour = Math.min(23, Number(tm[1]))
    min = tm[2] ? Number(tm[2]) : 0
  }
  const start = new Date(base)
  start.setHours(hour, min, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  let person: string | undefined
  const withMatch = text.match(/avec\s+([A-ZÉÈÀ][\wÀ-ÿ'-]+(?:\s+[A-ZÉÈÀ][\wÀ-ÿ'-]+)?)/)
  if (withMatch) person = withMatch[1].trim()
  else {
    const cap = text.match(/\b([A-ZÉÈÀ][a-zà-ÿ'-]{2,})\b/)
    if (cap) person = cap[1]
  }

  const label = CAL_EVENT_TYPES[type]?.label ?? 'Événement'
  return {
    id: `draft_${start.getTime()}`,
    type,
    title: person ? `${label} — ${person}` : label,
    start,
    end,
    contact: person ? { name: person, role: 'Contact' } : undefined,
  }
}
