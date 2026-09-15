// Assemblage PUR du snapshot du briefing matinal (Phase 3) — zéro I/O, zéro Deno,
// testable vitest. La partie PII-critique du briefing vit ici pour être couverte :
// les noms de contacts sont remplacés par des jetons AVANT toute sérialisation, et
// les champs porteurs de noms des agrégats (analytics_cockpit.contributors) sont
// retirés. DeepSeek ne doit JAMAIS voir un nom de client.

import type { Pseudonymizer } from './pseudonymize.ts'

export interface BriefFocusRow {
  contact_id: string
  contact_name: string | null
  score: number | null
  lead_score: number | null
  reason_keys: string[] | null
  property_title: string | null
  property_price: number | null
  city: string | null
  kyc_risk_high: boolean | null
  kyc_days_to_expiry: number | null
}

export interface BriefSnapshot {
  snapshot: string
  itemCount: number
  reminderCount: number
  eventCount: number
}

/** Clés d'agrégats connues pour porter des noms → retirées avant sérialisation. */
const NAME_BEARING_AGG_KEYS = ['contributors']

function stripNameBearing(agg: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(agg ?? {})) {
    if (NAME_BEARING_AGG_KEYS.includes(k)) continue
    out[k] = v
  }
  return out
}

// Rappels : on n'envoie JAMAIS le message_template (texte libre qui contient des
// noms en dur, ex. « relancer Jean Dupont ») ni un nom — seulement un LIBELLÉ de
// TYPE fixe, name-free par construction. Le LLM sait qu'il y a un suivi de tel
// genre, sans aucune PII.
const REMINDER_LABELS: Record<string, string> = {
  follow_up_sent_property: 'relance après un bien envoyé',
  post_visit_feedback: 'feedback de visite à récupérer',
  dormant_lead: 'lead dormant à réveiller',
  missing_document: 'document KYC en attente',
  price_change: 'ajustement de prix à discuter',
  custom: 'suivi à faire',
}
function reminderLabel(type: string): string {
  return REMINDER_LABELS[type] ?? 'suivi à faire'
}

// Rendez-vous du Calendrier (`calendar_events`) : même règle — le TYPE seul, jamais le titre,
// qui peut être l'objet d'un e-mail (« Planifier ») et nommer un client.
const EVENT_LABELS: Record<string, string> = {
  mandate: 'rendez-vous de mandat ou d’estimation',
  notary: 'signature chez le notaire',
  publish: 'publication',
  kyc: 'vérification KYC',
  autre: 'rendez-vous',
}
function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? 'rendez-vous'
}

function compterParLibelle(types: string[], libelle: (t: string) => string): string {
  const counts = new Map<string, number>()
  for (const t of types) counts.set(libelle(t), (counts.get(libelle(t)) ?? 0) + 1)
  return [...counts.entries()].map(([l, n]) => `${n} ${l}`).join(', ')
}

/** Construit le texte du snapshot pseudonymisé. Le `pseudo` accumule le mapping
 *  jeton→valeur (réutilisé ensuite pour re-substituer les vraies valeurs dans la
 *  réponse). INVARIANT : aucune donnée à texte libre saisie par un humain (nom de
 *  contact, TITRE de bien) ne part en clair — tout est tokenisé ; les rappels sont
 *  réduits à des libellés de type. */
export function buildBriefSnapshot(params: {
  focus: BriefFocusRow[]
  cockpit: Record<string, unknown> | null | undefined
  objectif: Record<string, unknown> | null | undefined
  reminderTypes: string[]
  /** Types des rendez-vous du jour (`calendar_events`, séries développées). */
  eventTypes?: string[]
  pseudo: Pseudonymizer
}): BriefSnapshot {
  const { pseudo } = params

  const items = (params.focus ?? []).map((r) => {
    const parts: string[] = []
    parts.push(pseudo.tokenFor(r.contact_name) || 'un contact')
    if (typeof r.score === 'number') parts.push(`match ${r.score}`)
    if (typeof r.lead_score === 'number') parts.push(`engagement ~${Math.round(r.lead_score)} (estimation)`)
    // Le TITRE d'un bien est du texte libre (l'agent peut y écrire un nom de
    // vendeur) → tokenisé, jamais en clair vers DeepSeek. La localité (commune)
    // n'est pas une PII : on la garde pour le contexte descriptif.
    if (r.property_title) parts.push(`bien ${pseudo.tokenFor(r.property_title)}`)
    if (r.city) parts.push(`à ${r.city}`)
    if (typeof r.property_price === 'number' && r.property_price > 0) parts.push(`CHF ${r.property_price}`)
    if (r.reason_keys?.length) parts.push(`raisons: ${r.reason_keys.join(', ')}`)
    if (r.kyc_risk_high) parts.push('KYC à surveiller')
    if (typeof r.kyc_days_to_expiry === 'number') parts.push(`KYC expire dans ${r.kyc_days_to_expiry}j`)
    return `- ${parts.join(' · ')}`
  })

  // Rappels et rendez-vous agrégés par libellé de type (name-free).
  const reminderTypes = params.reminderTypes ?? []
  const eventTypes = params.eventTypes ?? []
  const reminderLine = compterParLibelle(reminderTypes, reminderLabel)
  const cockpit = stripNameBearing(params.cockpit)
  const objectif = params.objectif ?? {}

  // Filet PII final : re-scrub tout (un nom résiduel connu du pseudonymiseur est
  // remplacé ; les jetons {{Cn}} déjà posés ne sont pas touchés).
  const snapshot = pseudo.scrub([
    items.length ? `PRIORITÉS DU JOUR (file scorée ; les scores sont des estimations internes) :\n${items.join('\n')}` : '',
    `OBJECTIF DU MOIS : ${JSON.stringify(objectif).slice(0, 500)}`,
    `COCKPIT : ${JSON.stringify(cockpit).slice(0, 500)}`,
    reminderTypes.length ? `RAPPELS DU JOUR : ${reminderLine}` : '',
    eventTypes.length ? `RENDEZ-VOUS DU JOUR : ${compterParLibelle(eventTypes, eventLabel)}` : '',
  ].filter(Boolean).join('\n\n'))

  return { snapshot, itemCount: items.length, reminderCount: reminderTypes.length, eventCount: eventTypes.length }
}
