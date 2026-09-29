// Morning brief proactif (07h30 Europe/Zurich) — composition PURE du message.
// Inverse le pull (outil get_daily_brief) en push : visites du jour + rendez-vous du jour +
// relances dues + offres qui expirent + nouveaux leads vendeurs + actions de matching (lot D2).
// 0 LLM : gabarits figés, données déterministes. Le push lui-même (cron, requêtes, envoi Meta) vit
// dans supabase/functions/whatsapp-morning-brief/index.ts ; ce module reste pur (aucun
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

/**
 * Un rendez-vous du Calendrier (`calendar_events`) : son heure, son TYPE et son contact — jamais
 * son titre, qui peut être l'objet d'un e-mail d'une boîte personnelle (« Planifier ») et qui
 * partirait chez Meta pour toute l'agence.
 */
export interface BriefEvent {
  startsAt: string
  allDay: boolean
  /** calendar_events.type (notary, mandate, publish, kyc, autre…). */
  type: string
  who: string | null
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

/**
 * Une action de matching du jour (lot D2) : une ligne de `matching_actions_agence`, la fonction d'« Aujourd'hui ».
 * `who` porte le prénom de l'acheteur, replié sur son nom de famille s'il manque. Un prénom seul s'écrit
 * « pour Julie », jamais « de Julie ».
 */
export interface BriefMatchingAction {
  genre: 'retour' | 'prix' | 'mandat' | 'marche'
  who: string | null
  contactId: string | null
  /** Le statut du match d'une baisse : `sent` (proposé) ou `suggested` (refusé pour le prix, revenu). */
  statut: string | null
  titre: string | null
  ville: string | null
  nombre: number
  nouveaux: number
  baisses: number
  montant: number | null
  /** Vrai UNIQUEMENT si la ligne le dit — comme `ActionMatching.location` (matchingDuJour.ts) : un
   *  montant de location s'écrit « / mois », jamais un prix de vente. */
  location: boolean
}

/** Le matching du jour : les actions, classées par la base, leur total EXACT, et les intéressés sans visite. */
export interface BriefMatching {
  actions: BriefMatchingAction[]
  total: number
  /** Les acheteurs intéressés qui attendent une visite (« À conclure »), noms distincts. */
  interesses: string[]
  /** La lecture des intéressés a atteint sa limite : leur nombre réel est inconnu. */
  interessesAtLimit: boolean
}

export interface MorningBriefData {
  agentFullName: string | null
  visits: BriefVisit[]
  /** Les rendez-vous du jour, séries développées (`occurrencesDuJour`). */
  events?: BriefEvent[]
  /** La requête des rendez-vous a atteint sa limite : le total réel est inconnu. */
  eventsAtLimit?: boolean
  reminders: BriefReminder[]
  /** La lecture des relances a atteint sa limite : le total réel est inconnu. */
  remindersAtLimit?: boolean
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
  /** Lot D2 : le matching du jour. */
  matching?: BriefMatching
}

// Plafonds d'affichage par section (le reste est résumé en « …et N autres ») :
// un brief WhatsApp se lit en 10 secondes, le détail vit dans le CRM / get_daily_brief.
const CAPS = { visits: 6, events: 6, reminders: 5, offers: 3, sellerLeads: 3, matching: 5 } as const

// Limites SQL des requêtes de l'edge function (source unique, importée par index.ts).
// Le composeur s'en sert pour rester honnête : un fetch qui ATTEINT sa limite signifie
// que le total réel est inconnu → en-tête « (20+) » et « …et d'autres », jamais un
// compte présenté comme exact alors qu'il est plafonné. ⚠ `matching` fait EXCEPTION à cette
// règle : sa RPC rend un total EXACT (fenêtre calculée avant la coupe SQL), jamais un « N+ » —
// seule la LISTE des actions affichées est plafonnée. `interesses` suit la règle générale, lui.
export const SQL_LIMITS = { visits: 12, events: 20, reminders: 20, offers: 5, sellerLeads: 5, matching: 20, interesses: 20 } as const

const EVENT_LABELS: Record<WaLang, Record<string, string>> = {
  fr: { mandate: 'Mandat / estimation', notary: 'Signature notaire', publish: 'Publication', kyc: 'Vérification', task: 'Tâche', visite: 'Visite', autre: 'Rendez-vous' },
  en: { mandate: 'Mandate / valuation', notary: 'Notary signing', publish: 'Publication', kyc: 'Verification', task: 'Task', visite: 'Viewing', autre: 'Appointment' },
}

/** Visite telle que la lit `morning-brief-data.ts` : `agentId` sert à filtrer « ta journée ». */
export type BriefVisitRow = BriefVisit & { agentId: string | null }

/** Les six sources du point du jour, scopées AGENCE (lues par `morning-brief-data.ts`). */
export interface BriefAgencyData {
  visits: BriefVisitRow[]
  events: BriefEvent[]
  eventsAtLimit: boolean
  reminders: BriefReminder[]
  remindersAtLimit: boolean
  offers: BriefOffer[]
  sellerLeads: BriefSellerLead[]
  matching: BriefMatching
}

/**
 * « Ta journée » = les visites de CET agent, attribuées à lui ou non attribuées ; celles d'un
 * collègue ne sont pas les siennes. Partagé par le push de 07h30 et l'outil `get_daily_brief` :
 * deux filtres écrits séparément finiraient par ne plus compter la même chose.
 */
export function briefVisitsForAgent<T extends { agentId: string | null }>(visits: T[], profileId: string): T[] {
  return visits.filter((v) => !v.agentId || v.agentId === profileId)
}

/**
 * Nombre d'éléments du point du jour — le {{2}} du template `agent_daily_brief`.
 * `atLimit` : une section a atteint sa limite SQL, le total réel est inconnu. L'appelant
 * l'affiche « N+ », jamais comme un compte exact — la règle des en-têtes du brief.
 */
export function briefItemCount(
  data: Pick<MorningBriefData, 'visits' | 'events' | 'eventsAtLimit' | 'reminders' | 'remindersAtLimit' | 'offers' | 'sellerLeads' | 'matching'>,
): { count: number; atLimit: boolean } {
  const { visits, reminders, offers, sellerLeads } = data
  const events = data.events ?? []
  // Lot D2 : le matching compte (décision de Julien, 24.09.2026) — ses actions au total EXACT de la base, et les
  // intéressés qui attendent une visite. Le modèle part donc aussi un jour de matching seul.
  const m = data.matching
  return {
    count: visits.length + events.length + reminders.length + offers.length + sellerLeads.length
      + (m ? m.total + m.interesses.length : 0),
    // Même règle que l'en-tête « Rendez-vous » du push : les séries développées peuvent dépasser
    // la limite SQL sans l'atteindre, c'est donc la requête qui dit si le total est connu.
    atLimit: visits.length >= SQL_LIMITS.visits || (data.eventsAtLimit ?? events.length >= SQL_LIMITS.events)
      || (data.remindersAtLimit ?? reminders.length >= SQL_LIMITS.reminders)
      || offers.length >= SQL_LIMITS.offers || sellerLeads.length >= SQL_LIMITS.sellerLeads
      || (m?.interessesAtLimit ?? false),
  }
}

const REMINDER_LABELS: Record<WaLang, Record<string, string>> = {
  fr: {
    follow_up_sent_property: 'Retour sur un bien proposé',
    post_visit_feedback: 'Retour de visite',
    dormant_lead: 'Lead dormant',
    missing_document: 'Document manquant',
    price_change: 'Changement de prix',
    custom: 'Rappel',
  },
  en: {
    follow_up_sent_property: 'Feedback on a proposed property',
    post_visit_feedback: 'Visit feedback',
    dormant_lead: 'Dormant lead',
    missing_document: 'Missing document',
    price_change: 'Price change',
    custom: 'Reminder',
  },
}

/** Montant en CHF suisse (apostrophe). Dupliqué de whatsapp-actions.ts : l'importer
 *  tirerait ses imports https: Deno dans le run Vitest. Exporté pour le copilote du matching
 *  (`whatsapp-matching.ts`, lot D2), qui écrit ses montants comme ce point du matin. */
export function fmtCHF(n: number): string {
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
 * Le pluriel tel que le calcule i18next (`Intl.PluralRules`, cardinal) : le français range 0 dans « one »
 * (`Intl.PluralRules('fr').select(0)` rend `one`), l'anglais dans « other ». Mesuré le 25.09.2026 : un
 * contrôle `> 1` donnerait le singulier anglais pour un compte à zéro, faux contre
 * `today.h.matching.retour_other` / `…mandat_other` (dashboard.json) — voir
 * tests/unit/whatsapp-matching-fil.spec.ts.
 */
function pluriel(lang: 'fr' | 'en', n: number): 'one' | 'other' {
  return new Intl.PluralRules(lang).select(n) as 'one' | 'other'
}

/** Une chaîne, sa première lettre en capitale — pour le nom qui OUVRE la ligne du marché à plusieurs
 *  annonces (au milieu d'une phrase, « un acheteur » reste en bas de casse). Elle capitalise aussi un prénom
 *  saisi en minuscule : le brief écrira « Julie · … » là où l'écran d'« Aujourd'hui », qui ne retouche pas
 *  `prenom`, écrit « julie · … ». */
function majFirst(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
 * Le montant d'une baisse, écrit COMME « Aujourd'hui » (`montant()`, filAffichage.ts, sur la clé
 * `fil.valeurs.parMois` de matching.json) : un loyer porte « / mois » (fr) ou « / month » (en), un prix
 * de vente reste nu. Dupliqué parce que `montant()` vit dans `src/` (le bundle navigateur) et que ce module
 * tourne dans le runtime Deno des fonctions edge, qui ne peut pas importer `src/` — ni React ni i18next n'y
 * sont pour rien : filAffichage.ts n'en importe que des types. Confronté à la fonction réelle du CRM par
 * tests/unit/whatsapp-matching-fil.spec.ts.
 */
function montantMatching(location: boolean, valeur: number, fr: boolean): string {
  const chf = fmtCHF(valeur)
  return location ? `${chf} / ${fr ? 'mois' : 'month'}` : chf
}

/**
 * Une action de matching, en une ligne — les phrases du segment d'« Aujourd'hui » (dashboard.json,
 * `today.h.matching`), plus le bien quand l'action en nomme un. « pour Julie », jamais « de Julie ».
 */
export function ligneMatching(a: BriefMatchingAction, fr: boolean): string {
  const qui = a.who ?? (fr ? 'un acheteur' : 'a buyer')
  const avecBien = (base: string) => (a.titre ? `${base} · ${a.titre}` : base)
  switch (a.genre) {
    case 'retour':
      return fr
        ? `Retour à consigner pour ${qui} · ${a.nombre} ${pluriel('fr', a.nombre) === 'one' ? 'bien' : 'biens'}`
        : `Feedback to record for ${qui} · ${a.nombre} ${pluriel('en', a.nombre) === 'one' ? 'property' : 'properties'}`
    case 'prix': {
      // Un montant absent, à zéro ou négatif est écarté par `lireMatching` avant d'atteindre cette ligne
      // (jamais atteint en production) ; en garde ici aussi, pour ne jamais écrire un « CHF 0 » ni une
      // baisse négative qui n'ont pas été mesurés.
      const m = a.montant == null || a.montant <= 0 ? null : montantMatching(a.location, a.montant, fr)
      const baisse = fr ? `Prix baissé${m ? ` de ${m}` : ''}` : `Price down${m ? ` ${m}` : ''}`
      return avecBien(a.statut === 'sent'
        ? (fr ? `${baisse} sur le bien proposé à ${qui}` : `${baisse} on the property proposed to ${qui}`)
        : (fr ? `${baisse} sur le bien refusé par ${qui}` : `${baisse} on the property ${qui} declined`))
    }
    case 'mandat':
      return avecBien(fr
        ? `Nouveau mandat · ${a.nombre} ${pluriel('fr', a.nombre) === 'one' ? 'acquéreur compatible' : 'acquéreurs compatibles'}`
        : `New mandate · ${a.nombre} matching ${pluriel('en', a.nombre) === 'one' ? 'buyer' : 'buyers'}`)
    case 'marche': {
      if (a.nouveaux + a.baisses === 1) {
        const ville = a.ville?.trim()
        const base = a.baisses === 1
          ? (fr ? (ville ? `Bien en baisse à ${ville} pour ${qui}` : `Bien en baisse pour ${qui}`) : (ville ? `Price drop in ${ville} for ${qui}` : `Price drop for ${qui}`))
          : (fr ? (ville ? `Nouveau bien à ${ville} pour ${qui}` : `Nouveau bien pour ${qui}`) : (ville ? `New property in ${ville} for ${qui}` : `New property for ${qui}`))
        return avecBien(base)
      }
      const liste = [
        a.nouveaux ? (fr ? `${a.nouveaux} ${pluriel('fr', a.nouveaux) === 'one' ? 'nouveau bien' : 'nouveaux biens'}` : `${a.nouveaux} new ${pluriel('en', a.nouveaux) === 'one' ? 'property' : 'properties'}`) : null,
        a.baisses ? (fr ? `${a.baisses} en baisse` : `${a.baisses} price ${pluriel('en', a.baisses) === 'one' ? 'drop' : 'drops'}`) : null,
      ].filter(Boolean).join(', ')
      // Seule ligne où `qui` OUVRE la phrase (ailleurs il suit « pour »/« à »/« par ») : la casse s'y voit.
      return `${majFirst(qui)} · ${liste}`
    }
  }
}

/**
 * Les intéressés qui attendent une visite, en une ligne : trois noms au plus. Le pluriel suit le compte
 * ET le plafond — « 20+ » reste un minimum, jamais garanti égal à 1, donc jamais accordé au singulier
 * même si la liste lue n'en montre qu'un.
 */
function ligneInteresses(m: BriefMatching, fr: boolean): string {
  const n = m.interesses.length
  const pluriel_ = n > 1 || m.interessesAtLimit
  const noms = m.interesses.slice(0, 3).join(', ') + (n > 3 ? '…' : '')
  const compte = sectionCount(n, m.interessesAtLimit)
  return fr
    ? `${compte} ${pluriel_ ? 'acheteurs intéressés attendent' : 'acheteur intéressé attend'} une visite : ${noms}`
    : `${compte} interested ${pluriel_ ? 'buyers are' : 'buyer is'} waiting for a viewing: ${noms}`
}

/**
 * Compose le brief du matin. Gras en Markdown (**x**) : le pipeline d'envoi maison
 * (toWhatsAppText) le convertit en gras WhatsApp (*x*), comme toute sortie copilote.
 * Retourne null si la journée est vide : on N'ENVOIE PAS de brief creux (un push
 * quotidien sans contenu tue le canal).
 */
export function composeMorningBrief(data: MorningBriefData, lang: WaLang = 'fr'): string | null {
  const { visits, reminders, offers, sellerLeads } = data
  const events = data.events ?? []
  const m = data.matching
  const sansMatching = !m || (m.total === 0 && m.interesses.length === 0)
  if (!visits.length && !events.length && !reminders.length && !offers.length && !sellerLeads.length && sansMatching) return null

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

  if (events.length) {
    const atLimit = data.eventsAtLimit ?? events.length >= SQL_LIMITS.events
    const eventLabels = EVENT_LABELS[fr ? 'fr' : 'en']
    blocks.push([
      `**${fr ? 'Rendez-vous' : 'Appointments'} (${sectionCount(events.length, atLimit)})**`,
      ...sectionLines(events, CAPS.events, atLimit, (e) => {
        const quand = e.allDay ? (fr ? 'Journée' : 'All day') : timeHHmm(e.startsAt)
        return `- ${quand} · ${eventLabels[e.type] ?? eventLabels.autre}${e.who ? ` · ${e.who}` : ''}`
      }, lang),
    ].join('\n'))
  }

  if (reminders.length) {
    const atLimit = data.remindersAtLimit ?? reminders.length >= SQL_LIMITS.reminders
    blocks.push([
      `**${fr ? 'À relancer' : 'To follow up'} (${sectionCount(reminders.length, atLimit)})**`,
      ...sectionLines(reminders, CAPS.reminders, atLimit, (r) => {
        const label = labels[r.type] ?? labels.custom
        return r.who ? `- ${label}${fr ? ' : ' : ': '}${r.who}` : `- ${label}`
      }, lang),
    ].join('\n'))
  }

  // Lot D2 : le matching du jour, après les relances qui excluent déjà un retour dans la REQUÊTE
  // (`loadAgencyData`, jamais ici). Le total vient de la base : « …et N autres » est exact, même
  // au-delà des vingt actions lues. ⚠ « autres actions », jamais « autres » seul : la ligne des
  // intéressés qui suit compte des ACHETEURS, et un « …et 2 autres » nu se lit comme si c'était eux.
  if (m && !sansMatching) {
    const lignes = m.actions.slice(0, CAPS.matching).map((a) => `- ${ligneMatching(a, fr)}`)
    const reste = m.total - Math.min(m.actions.length, CAPS.matching)
    if (reste > 0) {
      lignes.push(fr
        ? `…et ${reste} ${reste > 1 ? 'autres actions' : 'autre action'}`
        : `…and ${reste} more ${reste > 1 ? 'actions' : 'action'}`)
    }
    if (m.interesses.length) lignes.push(`- ${ligneInteresses(m, fr)}`)
    blocks.push([`**Matching (${sectionCount(m.total + m.interesses.length, m.interessesAtLimit)})**`, ...lignes].join('\n'))
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

/**
 * Le DÉTAIL du point du jour, rendu par l'outil `get_daily_brief` : les six sections du
 * push, SANS ses plafonds d'affichage — c'est ici que le push renvoie pour « le détail ».
 * Valeurs déjà formatées (heure Zurich, CHF à apostrophe, libellé de relance) : le modèle n'a
 * rien à convertir, donc rien à inventer. `total` reprend `briefItemCount`, pour que le nombre
 * annoncé par le template du matin se retrouve ici à l'identique.
 */
export function composeBriefDetail(data: Omit<MorningBriefData, 'agentFullName'>, lang: WaLang = 'fr') {
  const fr = lang !== 'en'
  const labels = REMINDER_LABELS[fr ? 'fr' : 'en']
  const eventLabels = EVENT_LABELS[fr ? 'fr' : 'en']
  const { count, atLimit } = briefItemCount(data)
  return {
    total: atLimit ? `${count}+` : String(count),
    visites_du_jour: data.visits.map((v) => ({
      heure: timeHHmm(v.scheduledAt), qui: v.who, bien: v.propertyTitle, ville: v.city,
    })),
    // Le type et le contact, jamais le titre — même règle que le push (cf. BriefEvent).
    rendez_vous_du_jour: (data.events ?? []).map((e) => ({
      heure: e.allDay ? (fr ? 'journée' : 'all day') : timeHHmm(e.startsAt),
      rendez_vous: eventLabels[e.type] ?? eventLabels.autre, qui: e.who,
    })),
    relances_dues: data.reminders.map((r) => ({ relance: labels[r.type] ?? labels.custom, qui: r.who })),
    offres_qui_expirent: data.offers.map((o) => ({
      montant: fmtCHF(o.amount), par: o.byLabel, expire_le: dateDDMM(o.expiresAt),
    })),
    nouveaux_leads_vendeurs: data.sellerLeads.map((l) => ({
      nom: l.contactName, ville: l.city, estimation: l.estimationMedian ? fmtCHF(l.estimationMedian) : null,
    })),
    // Lot D2 : `total` compte comme l'en-tête « Matching (N) » du push — actions ET intéressés — jamais
    // les actions seules : sinon un jour d'intéressés sans aucune action détaillerait « 0 » sous un
    // en-tête qui en annonce un. `actions_total`, lui, ne compte que les actions (sert `autres`, ce que
    // la LISTE `actions` (vingt au plus) a coupé) ; `acheteurs_interesses_total` porte le même « + »
    // que l'en-tête quand la lecture des intéressés a atteint sa limite.
    ...(data.matching ? {
      matching: {
        total: sectionCount(data.matching.total + data.matching.interesses.length, data.matching.interessesAtLimit),
        actions_total: String(data.matching.total),
        actions: data.matching.actions.map((a) => ligneMatching(a, fr)),
        ...(data.matching.total > data.matching.actions.length ? { autres: data.matching.total - data.matching.actions.length } : {}),
        acheteurs_interesses_sans_visite: data.matching.interesses,
        acheteurs_interesses_total: sectionCount(data.matching.interesses.length, data.matching.interessesAtLimit),
      },
    } : {}),
  }
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
