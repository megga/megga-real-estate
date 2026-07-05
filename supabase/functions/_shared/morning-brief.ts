// Morning brief proactif (07h30 Europe/Zurich) — composition PURE du message.
// Inverse le pull (outil get_daily_brief) en push : visites du jour + relances dues +
// offres qui expirent + nouveaux leads vendeurs. 0 LLM : gabarits figés, données
// déterministes. Le push lui-même (cron, requêtes, envoi Meta) vit dans
// supabase/functions/whatsapp-morning-brief/index.ts ; ce module reste pur (aucun
// import runtime Deno) pour tourner sous Vitest, comme megga-prose / whatsapp-format.

import type { WaLang } from './whatsapp-i18n.ts'

const ZURICH = 'Europe/Zurich'

export interface BriefVisit {
  scheduledAt: string
  /** Nom du visiteur (contact CRM, sinon buyer_name du formulaire public). */
  who: string | null
  propertyTitle: string | null
  city: string | null
}

export interface BriefReminder {
  /** reminders.type (follow_up_sent_property, post_visit_feedback, …). */
  type: string
  who: string | null
}

export interface BriefOffer {
  amount: number
  byLabel: string
  expiresAt: string
}

export interface BriefSellerLead {
  contactName: string
  city: string | null
  estimationMedian: number | null
}

export interface MorningBriefData {
  agentFullName: string | null
  visits: BriefVisit[]
  reminders: BriefReminder[]
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
}

// Plafonds d'affichage par section (le reste est résumé en « …et N autres ») :
// un brief WhatsApp se lit en 10 secondes, le détail vit dans le CRM / get_daily_brief.
const CAPS = { visits: 6, reminders: 5, offers: 3, sellerLeads: 3 } as const

// Limites SQL des requêtes de l'edge function (source unique, importée par index.ts).
// Le composeur s'en sert pour rester honnête : un fetch qui ATTEINT sa limite signifie
// que le total réel est inconnu → en-tête « (20+) » et « …et d'autres », jamais un
// compte présenté comme exact alors qu'il est plafonné.
export const SQL_LIMITS = { visits: 12, reminders: 20, offers: 5, sellerLeads: 5 } as const

const REMINDER_LABELS: Record<WaLang, Record<string, string>> = {
  fr: {
    follow_up_sent_property: 'Relance après envoi de bien',
    post_visit_feedback: 'Retour de visite',
    dormant_lead: 'Lead dormant',
    missing_document: 'Document manquant',
    price_change: 'Changement de prix',
    custom: 'Rappel',
  },
  en: {
    follow_up_sent_property: 'Follow-up on sent property',
    post_visit_feedback: 'Visit feedback',
    dormant_lead: 'Dormant lead',
    missing_document: 'Missing document',
    price_change: 'Price change',
    custom: 'Reminder',
  },
}

/** Montant en CHF suisse (apostrophe). Dupliqué de whatsapp-actions.ts : l'importer
 *  tirerait ses imports https: Deno dans le run Vitest. */
function fmtCHF(n: number): string {
  return `CHF ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

function timeHHmm(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZURICH, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso))
}

function dateDDMM(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH, day: '2-digit', month: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}.${get('month')}`
}

function sectionLines<T>(items: T[], cap: number, atSqlLimit: boolean, render: (x: T) => string, lang: WaLang): string[] {
  const lines = items.slice(0, cap).map(render)
  const rest = items.length - cap
  if (atSqlLimit) lines.push(lang === 'en' ? '…and more' : '…et d\'autres')
  else if (rest > 0) lines.push(lang === 'en' ? `…and ${rest} more` : `…et ${rest} ${rest > 1 ? 'autres' : 'autre'}`)
  return lines
}

function sectionCount(n: number, atSqlLimit: boolean): string {
  return atSqlLimit ? `${n}+` : String(n)
}

/**
 * Compose le brief du matin. Gras en Markdown (**x**) : le pipeline d'envoi maison
 * (toWhatsAppText) le convertit en gras WhatsApp (*x*), comme toute sortie copilote.
 * Retourne null si la journée est vide : on N'ENVOIE PAS de brief creux (un push
 * quotidien sans contenu tue le canal).
 */
export function composeMorningBrief(data: MorningBriefData, lang: WaLang = 'fr'): string | null {
  const { visits, reminders, offers, sellerLeads } = data
  if (!visits.length && !reminders.length && !offers.length && !sellerLeads.length) return null

  const fr = lang !== 'en'
  const firstName = (data.agentFullName ?? '').trim().split(/\s+/)[0] || null
  const labels = REMINDER_LABELS[fr ? 'fr' : 'en']
  const blocks: string[] = []

  blocks.push(fr
    ? `Bonjour${firstName ? ` ${firstName}` : ''}, ta journée :`
    : `Good morning${firstName ? ` ${firstName}` : ''}, your day:`)

  if (visits.length) {
    const atLimit = visits.length >= SQL_LIMITS.visits
    blocks.push([
      `**${fr ? 'Visites' : 'Visits'} (${sectionCount(visits.length, atLimit)})**`,
      ...sectionLines(visits, CAPS.visits, atLimit, (v) => {
        const place = [v.propertyTitle, v.city].filter(Boolean).join(', ')
        return `- ${timeHHmm(v.scheduledAt)}${v.who ? ` · ${v.who}` : ''}${place ? ` · ${place}` : ''}`
      }, lang),
    ].join('\n'))
  }

  if (reminders.length) {
    const atLimit = reminders.length >= SQL_LIMITS.reminders
    blocks.push([
      `**${fr ? 'À relancer' : 'To follow up'} (${sectionCount(reminders.length, atLimit)})**`,
      ...sectionLines(reminders, CAPS.reminders, atLimit, (r) => {
        const label = labels[r.type] ?? labels.custom
        return r.who ? `- ${label}${fr ? ' : ' : ': '}${r.who}` : `- ${label}`
      }, lang),
    ].join('\n'))
  }

  if (offers.length) {
    const atLimit = offers.length >= SQL_LIMITS.offers
    blocks.push([
      `**${fr ? 'Offres qui expirent' : 'Offers expiring'} (${sectionCount(offers.length, atLimit)})**`,
      ...sectionLines(offers, CAPS.offers, atLimit, (o) =>
        `- ${fmtCHF(o.amount)} (${o.byLabel}) · ${fr ? 'expire le' : 'expires'} ${dateDDMM(o.expiresAt)}`,
      lang),
    ].join('\n'))
  }

  if (sellerLeads.length) {
    const atLimit = sellerLeads.length >= SQL_LIMITS.sellerLeads
    blocks.push([
      `**${fr ? 'Nouveaux leads vendeurs' : 'New seller leads'} (${sectionCount(sellerLeads.length, atLimit)})**`,
      ...sectionLines(sellerLeads, CAPS.sellerLeads, atLimit, (l) => {
        const bits = [l.contactName, l.city, l.estimationMedian ? `est. ${fmtCHF(l.estimationMedian)}` : null]
        return `- ${bits.filter(Boolean).join(' · ')}`
      }, lang),
    ].join('\n'))
  }

  blocks.push(fr
    ? 'Réponds « brief » pour le détail, ou pose-moi une question sur un dossier.'
    : 'Reply "brief" for details, or ask me about any file.')

  return blocks.join('\n\n')
}

function zurichWallParts(now: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** Heure LOCALE Zurich (0-23). Gate applicatif du cron : les deux schedules UTC
 *  (05:30 + 06:30) encadrent le DST, seul celui qui tombe à 07h local agit. */
export function zurichHour(now: Date): number {
  return zurichWallParts(now).h
}

/**
 * Bornes UTC de la journée LOCALE Zurich courante ([startIso, endIso) exclusif) +
 * clé de date locale (YYYY-MM-DD) pour la dédup whatsapp_daily_briefs.
 * Offset dérivé de l'heure murale courante : les 2 jours de bascule DST par an, la
 * borne opposée peut dériver d'1 h — sans enjeu pour un brief de 07h30.
 */
export function zurichDayBoundsUtc(now: Date): { startIso: string; endIso: string; dateKey: string } {
  const w = zurichWallParts(now)
  const wallAsUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
  const offsetMs = Math.round((wallAsUtc - now.getTime()) / 60_000) * 60_000
  const startMs = Date.UTC(w.y, w.mo - 1, w.d) - offsetMs
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 24 * 3600 * 1000).toISOString(),
    dateKey: `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`,
  }
}
