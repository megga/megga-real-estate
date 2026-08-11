// MEGGA CRM Sugar — Calendar types, palette + layout helpers
// Refonte « façon Google » — port fidèle de `crm-calendar-sugar-data.jsx`.
// Les événements affichés sont dérivés en live (useCalendarSugar : visites +
// reminders) et enrichis des créneaux « Occupé » des agendas externes
// (Google / Outlook) ; aucun tableau démo ici.

import { createContext, useContext } from 'react'
// i18n : le `label` des types d'événement est un GETTER (lu via l'instance i18n
// singleton à l'accès → traduit + réactif au changement de langue, sans changer
// les sites d'appel `CAL_EVENT_TYPES[x].label`). Cf docs/i18n-conventions §6.
import i18n from '@/i18n'
import { MXC_COLOR, mxCrmPalette } from '@/components/megga-x-crm/tokens'

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
  /** Variante sombre {bg, ink, accent} — aplat opaque sur quasi-noir. */
  darkColors?: CalEventTypeColors
}

// ─── Couleurs FONCTIONNELLES MEGGA (mêmes familles que Pipeline / CRM_STAGES) ──
// Cyan = visites · Bleu = mandat · Vert = signé/compromis · Orange = relance ·
// Gris ardoise = publication · Ardoise = autre. Bloc à fond PLEIN + texte blanc.
// En sombre : aplat opaque légèrement approfondi pour le confort sur fond noir ;
// l'accent (pastille / dot) reprend la teinte éclaircie.
export const CAL_EVENT_TYPES: Record<string, CalEventType> = {
  visite: {
    id: 'visite', get label() { return i18n.t('calendar:eventType.visite') }, short: 'V', icon: 'home',
    bg: '#0891B2', ink: '#FFFFFF', accent: '#0891B2',
    darkColors: { bg: '#0A7A92', ink: '#FFFFFF', accent: '#22B0CE' },
  },
  mandate: {
    id: 'mandate', get label() { return i18n.t('calendar:eventType.mandate') }, short: 'M', icon: 'signature',
    bg: '#1E5BC6', ink: '#FFFFFF', accent: '#1E5BC6',
    darkColors: { bg: '#1C4FA8', ink: '#FFFFFF', accent: '#4C86E8' },
  },
  notary: {
    id: 'notary', get label() { return i18n.t('calendar:eventType.notary') }, short: 'N', icon: 'stamp',
    bg: '#059669', ink: '#FFFFFF', accent: '#059669',
    darkColors: { bg: '#06805B', ink: '#FFFFFF', accent: '#17B683' },
  },
  task: {
    id: 'task', get label() { return i18n.t('calendar:eventType.task') }, short: 'T', icon: 'check',
    bg: '#C45A00', ink: '#FFFFFF', accent: '#C45A00',
    darkColors: { bg: '#A84E00', ink: '#FFFFFF', accent: '#E07A28' },
  },
  publish: {
    id: 'publish', get label() { return i18n.t('calendar:eventType.publish') }, short: 'P', icon: 'upload',
    bg: '#4A5568', ink: '#FFFFFF', accent: '#4A5568',
    darkColors: { bg: '#3E4757', ink: '#FFFFFF', accent: '#AEBAC9' },
  },
  // Vérification d'identité KYC, réservée par le client depuis son lien magique.
  // Type distinct plutôt que « autre » : ce n'est pas un rendez-vous divers, c'est
  // une étape LAB/KYC, et l'agent doit la repérer d'un coup d'œil dans sa semaine.
  // Teinte framboise, la seule libre parmi les six existantes.
  kyc: {
    id: 'kyc', get label() { return i18n.t('calendar:eventType.kyc') }, short: 'K', icon: 'user',
    bg: '#B02A5B', ink: '#FFFFFF', accent: '#B02A5B',
    darkColors: { bg: '#96234D', ink: '#FFFFFF', accent: '#DB5A87' },
  },
  autre: {
    id: 'autre', get label() { return i18n.t('calendar:eventType.autre') }, short: 'A', icon: 'pin',
    bg: '#5B6472', ink: '#FFFFFF', accent: '#5B6472',
    darkColors: { bg: '#4E5561', ink: '#FFFFFF', accent: '#8A93A3' },
  },
}

/** Résout les couleurs d'un type selon le thème (clair ↔ sombre). */
export function eventTypeColors(type: CalEventType, isDark: boolean): CalEventTypeColors {
  return isDark && type.darkColors ? type.darkColors : type
}

export type CalEventTypeId = keyof typeof CAL_EVENT_TYPES

/** Palette libre pour le type « Autre » (aplats opaques + texte blanc). */
export interface CalEventColorOption {
  id: string
  label: string
  hex: string
}
export const CAL_EVENT_COLORS: CalEventColorOption[] = [
  { id: 'slate', get label() { return i18n.t('calendar:color.slate') }, hex: '#5B6472' },
  { id: 'raspberry', get label() { return i18n.t('calendar:color.raspberry') }, hex: '#B0466A' },
  { id: 'amber', get label() { return i18n.t('calendar:color.amber') }, hex: '#C08234' },
  { id: 'olive', get label() { return i18n.t('calendar:color.olive') }, hex: '#6E8A3C' },
  { id: 'emerald', get label() { return i18n.t('calendar:color.emerald') }, hex: '#2E8B6B' },
  { id: 'teal', get label() { return i18n.t('calendar:color.teal') }, hex: '#2E8296' },
  { id: 'indigo', get label() { return i18n.t('calendar:color.indigo') }, hex: '#4E63B4' },
]

export interface CalEventProperty {
  id?: string
  title: string
  area: number | null
  price: number | null
  tone: string
  addr?: string | null
}

export interface CalEventContact {
  name: string
  role: string
  phone?: string
  warm?: number
}

/** Récurrence d'un événement MEGGA. */
export type CalRecurFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly'
export interface CalEventRecurrence {
  freq: CalRecurFreq
  until?: string | null
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
  /** Suivi d'état (réversible). */
  status?: 'done' | 'cancelled'
  /** Journée entière (00:00 → 23:59). */
  allDay?: boolean
  /** Récurrence (null = ponctuel). */
  recurrence?: CalEventRecurrence | null
  /** Couleur libre pour le type « autre ». */
  color?: string
  /** Rattachement CRM (liens profonds bien / contact). */
  bienId?: string | null
  contactId?: string | null
  /**
   * Table d'origine (routage des écritures serveur).
   *
   * `appointment` = RDV de vérification KYC réservé par le CLIENT. Les branches
   * d'écriture de CalendarApp ne le reconnaissent volontairement pas : glisser
   * pour replanifier reste inopérant, parce que déplacer un rendez-vous confirmé
   * sans prévenir le client serait pire que de ne rien faire. Le report passe par
   * les RPC, qui envoient un courriel.
   */
  origin?: 'visit' | 'reminder' | 'appointment'
  /** Événement synchronisé d'un agenda externe (Google/Outlook) → « Occupé », lecture seule. */
  external?: boolean
  source?: 'google' | 'microsoft'
  /** Champs runtime issus de l'expansion des occurrences récurrentes. */
  masterId?: string
  isOccurrence?: boolean
}

/** Style résolu d'un événement (couleurs + libellé + icône). */
export interface CalResolvedStyle {
  bg: string
  ink: string
  accent: string
  icon: string
  label: string
  external?: boolean
  source?: 'google' | 'microsoft'
}

/**
 * Résout la couleur/l'icône/le libellé d'un événement.
 * - externe synchronisé → neutre « Occupé » (contour tireté, lecture seule) ;
 * - type « autre » avec couleur libre → aplat de cette couleur ;
 * - sinon → couleur fonctionnelle du type (selon le thème).
 */
export function calTypeStyle(e: CalEvent, palette: CalSugarPalette): CalResolvedStyle {
  if (e.external) {
    return {
      external: true,
      source: e.source,
      label: e.source === 'microsoft' ? 'Outlook' : 'Google',
      bg: palette.isDark ? 'rgba(255,255,255,0.03)' : palette.cardSubtle,
      ink: palette.muted,
      accent: palette.ghost,
      icon: 'clock',
    }
  }
  const base = CAL_EVENT_TYPES[e.type] ?? CAL_EVENT_TYPES.task
  if (e.type === 'autre' && e.color) {
    return { bg: e.color, ink: '#FFFFFF', accent: e.color, icon: base.icon, label: base.label }
  }
  const c = eventTypeColors(base, palette.isDark)
  return { bg: c.bg, ink: c.ink, accent: c.accent, icon: base.icon, label: base.label }
}

/** Libellés des fréquences de récurrence (i18n). */
export const CAL_RECUR_LABEL: Record<CalRecurFreq, string> = {
  get daily() { return i18n.t('calendar:recur.daily') },
  get weekly() { return i18n.t('calendar:recur.weekly') },
  get biweekly() { return i18n.t('calendar:recur.biweekly') },
  get monthly() { return i18n.t('calendar:recur.monthly') },
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

export interface CalSugarPalette {
  bg: string
  card: string
  /** Surfaces flottantes du calendrier (popovers d'heure/date/recherche,
   *  modale d'événement) : palier haut de l'échelle, jamais le palier « card »
   *  — sinon le popover se confond avec la carte posée dessous. */
  popBg: string
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
  bg: MXC_COLOR.n900,
  card: MXC_COLOR.n1000,
  popBg: MXC_COLOR.n1000,
  cardSubtle: MXC_COLOR.n900,
  cardHover: MXC_COLOR.n900,
  hoverSubtle: MXC_COLOR.n800,
  ink: MXC_COLOR.n100,
  inkSoft: MXC_COLOR.n400,
  muted: MXC_COLOR.n500,
  ghost: MXC_COLOR.n600,
  line: 'rgba(11,12,14,0.06)',
  line2: 'rgba(11,12,14,0.10)',
  accent: MXC_COLOR.accent,
  onAccent: MXC_COLOR.n1000,
  ring: MXC_COLOR.accent,
  black: MXC_COLOR.accent,
  todayCol: 'rgba(11,12,14,0.015)',
  nowColor: '#E54D38',
  heroBg: MXC_COLOR.n100,
  heroInk: MXC_COLOR.n1000,
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
  // Surfaces NEUTRES (gris quasi-noir) alignées sur Matching / Contacts — voir buildCalPalette.
  card: '#17181A',
  popBg: '#1E1F21',
  cardSubtle: '#1E1F21',
  cardHover: '#26272A',
  hoverSubtle: '#1E1F21',
  ink: '#FFFFFF',
  inkSoft: '#C8CCD2',
  muted: '#7E828A',
  ghost: MXC_COLOR.n500,
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.11)',
  accent: MXC_COLOR.accent,
  onAccent: MXC_COLOR.n1000,
  ring: MXC_COLOR.accent,
  black: MXC_COLOR.accent,
  todayCol: 'rgba(255,255,255,0.03)',
  nowColor: '#FF6A52',
  heroBg: `linear-gradient(135deg, ${MXC_COLOR.n400} 0%, ${MXC_COLOR.n300} 100%)`,
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
 * Palette du calendrier selon le thème actif. En sombre, on neutralise les
 * surfaces (gris quasi-noir) et on reprend fond/encre du thème CRM (`t`) pour
 * rester uniforme avec Matching / Contacts (pas de canal bleu surélevé).
 */
export function buildCalPalette(dark: boolean): CalSugarPalette {
  if (!dark) return CAL_LIGHT
  const mx = mxCrmPalette(true)
  return {
    ...CAL_DARK,
    bg: mx.pageBg,
    // Surfaces OPAQUES de MEGGA X. On ne dérive PAS d'un thème : il teintait
    // tout en bleu-violet, et il n'existe plus.
    card: MXC_COLOR.n300,
    cardSubtle: MXC_COLOR.n200,
    hoverSubtle: MXC_COLOR.n400,
    cardHover: MXC_COLOR.n400,
    popBg: MXC_COLOR.n300,
    ink: mx.ink,
    inkSoft: mx.soft,
    muted: mx.sub,
  }
}

/** Context palette — les composants lisent `useCalPalette()` (plus d'import statique). */
export const CalPaletteContext = createContext<CalSugarPalette>(CAL_LIGHT)
export const useCalPalette = (): CalSugarPalette => useContext(CalPaletteContext)
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

// ── Conflits d'agenda ───────────────────────────────────────────────────────
/**
 * Autres RDV du MÊME jour dont la plage horaire chevauche `event`.
 * Ignore l'événement lui-même, les annulés et les journées entières. Les blocs
 * externes « Occupé » NE sont PAS exclus (un RDV MEGGA chevauchant un « Occupé »
 * déclenche l'alerte).
 */
export function calConflicts(event: CalEvent | null | undefined, list: CalEvent[]): CalEvent[] {
  if (!event || !Array.isArray(list) || event.status === 'cancelled' || event.allDay) return []
  const s = event.start.getTime()
  const e = event.end.getTime()
  return list.filter(
    o =>
      o &&
      !o.allDay &&
      o.id !== event.id &&
      o.status !== 'cancelled' &&
      sameDayLocal(o.start, event.start) &&
      o.start.getTime() < e &&
      s < o.end.getTime(),
  )
}

function sameDayLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ── Expansion des occurrences récurrentes ───────────────────────────────────
/**
 * Développe les événements récurrents en occurrences datées dans [rangeStart,
 * rangeEnd]. Les événements simples sont renvoyés tels quels (MÊME référence →
 * React.memo tient). Les occurrences reçoivent un id `masterId@AAAA-M-J`.
 */
export function calExpandEvents(events: CalEvent[], rangeStart: Date, rangeEnd: Date): CalEvent[] {
  const out: CalEvent[] = []
  const DAY = 86400000
  for (const e of events) {
    const rec = e.recurrence
    if (!rec || !rec.freq) { out.push(e); continue }
    const monthly = rec.freq === 'monthly'
    const stepDays = rec.freq === 'daily' ? 1 : rec.freq === 'weekly' ? 7 : rec.freq === 'biweekly' ? 14 : 0
    if (!monthly && stepDays === 0) { out.push(e); continue }
    const durMs = e.end.getTime() - e.start.getTime()
    const until = rec.until ? new Date(rec.until) : null
    const startDay = e.start.getDate()
    const h = e.start.getHours()
    const min = e.start.getMinutes()

    // Occurrence datée pour l'index n (0 = start). Le mensuel est ancré sur le
    // jour du mois de départ, borné à la longueur du mois (31 janv. → 28 févr.,
    // pas de dérive via setMonth).
    const occAt = (n: number): Date => {
      if (monthly) {
        const d = new Date(e.start.getFullYear(), e.start.getMonth() + n, 1)
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(startDay, lastDay))
        d.setHours(h, min, 0, 0)
        return d
      }
      const d = new Date(e.start)
      d.setDate(d.getDate() + n * stepDays)
      return d
    }

    // Fast-forward : saute directement à la première occurrence dans la fenêtre
    // (sinon un événement démarré loin dans le passé épuise le garde avant d'y arriver).
    let n = 0
    if (e.start < rangeStart) {
      if (monthly) {
        n = (rangeStart.getFullYear() - e.start.getFullYear()) * 12 + (rangeStart.getMonth() - e.start.getMonth())
      } else {
        n = Math.floor((rangeStart.getTime() - e.start.getTime()) / (stepDays * DAY))
      }
      if (n < 0) n = 0
      while (occAt(n) < rangeStart) n++
      while (n > 0 && occAt(n - 1) >= rangeStart) n--
    }

    let guard = 0
    while (guard < 500) {
      const occ = occAt(n)
      if (occ > rangeEnd) break
      if (until && occ > until) break
      const en = new Date(occ.getTime() + durMs)
      const key = `${occ.getFullYear()}-${occ.getMonth() + 1}-${occ.getDate()}`
      out.push({ ...e, start: occ, end: en, id: `${e.id}@${key}`, masterId: e.id, isOccurrence: true })
      n++
      guard++
    }
  }
  return out
}

/** L'id d'une occurrence est `masterId@AAAA-M-J` → remonte au maître. */
export function calMasterId(id: string): string {
  return typeof id === 'string' && id.includes('@') ? id.split('@')[0] : id
}

// ── Édition / création inline + parseur NL ──────────────────────────────────

/** Brouillon vierge : visite 09:00–10:00 le jour courant. */
export function calBlankEvent(currentDate: Date): CalEvent {
  const start = new Date(currentDate)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(10, 0, 0, 0)
  return {
    id: `draft_${start.getTime()}`,
    type: 'visite',
    title: '',
    start,
    end,
    allDay: false,
    recurrence: null,
  }
}

/** Fin par défaut d'une récurrence : 3 mois après le début. */
export function calRecurDefaultUntil(start: Date): string {
  const u = new Date(start)
  u.setMonth(u.getMonth() + 3)
  u.setHours(23, 59, 59, 0)
  return u.toISOString()
}

/** Nettoie/normalise un brouillon avant sauvegarde. */
export function calNormalizeDraft(d: CalEvent): CalEvent {
  const label = CAL_EVENT_TYPES[d.type]?.label ?? 'Événement'
  const title = d.title.trim() || label
  const pTitle = d.property?.title?.trim() ?? ''
  const property: CalEventProperty | undefined = pTitle
    ? {
        ...d.property,
        title: pTitle,
        area: d.property?.area != null ? Number(d.property.area) || null : null,
        price:
          d.property?.price != null && `${d.property.price}` !== ''
            ? Number(String(d.property.price).replace(/[^\d]/g, '')) || null
            : null,
        tone: d.property?.tone || '#A8B5BF',
        addr: d.property?.addr?.trim() || null,
      }
    : undefined
  const contact = d.contact && d.contact.name?.trim() ? d.contact : undefined
  const out: CalEvent = {
    ...d,
    title,
    property,
    contact,
    location: d.location?.trim() || undefined,
    notes: d.notes?.trim() || undefined,
  }
  // Cohérence des liens CRM : pas de contenu → pas d'id.
  if (!out.contact) out.contactId = null
  if (!out.property) out.bienId = null
  // Journée entière : 00:00 → 23:59:59 du jour de fin (bornée ≥ début).
  // Sinon (timé, éventuellement multi-jours) : fin toujours ≥ début (+15 min mini).
  out.allDay = !!d.allDay
  if (out.allDay) {
    const s = new Date(out.start); s.setHours(0, 0, 0, 0)
    let e = new Date(out.end); e.setHours(23, 59, 59, 0)
    if (e.getTime() < s.getTime()) e = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59)
    out.start = s
    out.end = e
  } else if (out.end.getTime() <= out.start.getTime()) {
    out.end = new Date(out.start.getTime() + 15 * 60000)
  }
  return out
}
