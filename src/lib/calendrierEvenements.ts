/**
 * Les ÉVÉNEMENTS du Calendrier et leur pont avec la Messagerie (15.09.2026, Julien :
 * « il faudrait que les mails soient aussi connectés avec le calendrier »). Pur : aucun
 * appel réseau ici — `useCalendarEvents` écrit, `useCalendarScreen` lit, la Messagerie
 * dépose un brouillon que `CalendarApp` reprend.
 */
import type { CalEvent } from '@/components/crm/calendar/data'
import type { Database, Json } from '@/types/database'

type LigneEvenement = Database['public']['Tables']['calendar_events']['Insert']

/**
 * Le brouillon du calendrier en colonnes `calendar_events` — la même forme à la création et
 * à la modification. ⚠ Le titre est déjà normalisé par `calNormalizeDraft` (repli sur le
 * libellé du type) ; les bornes sont celles de la table (200 caractères, fin ≥ début,
 * couleur hexadécimale réservée au type « autre »).
 */
export function versLigneEvenement(d: CalEvent): Omit<LigneEvenement, 'agency_id'> {
  return {
    type: d.type,
    title: d.title.trim().slice(0, 200),
    starts_at: d.start.toISOString(),
    ends_at: (d.end.getTime() >= d.start.getTime() ? d.end : d.start).toISOString(),
    all_day: !!d.allDay,
    location: d.location?.trim() || null,
    notes: d.notes?.trim() || null,
    color: d.type === 'autre' && d.color && /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : null,
    recurrence: d.recurrence ? (d.recurrence as unknown as Json) : null,
    status: d.status ?? null,
    contact_id: d.contactId ?? null,
    property_id: d.bienId ?? null,
    mail_thread_id: d.mailThreadId ?? null,
  }
}

/**
 * `createReminder` range le titre saisi dans le calendrier EN TÊTE du message —
 * « [Titre] notes » — et le Calendrier ne le relisait pas : une tâche revenait « Tâche » au
 * rechargement. On le relit ; un message sans crochets (une relance du système) reste tel
 * quel.
 */
export function titreDeRelance(message: string | null): { titre: string | null; reste: string | null } {
  const m = message?.match(/^\[([^\]\n]{1,200})\]\s*([\s\S]*)$/)
  if (!m) return { titre: null, reste: message }
  return { titre: m[1].trim() || null, reste: m[2].trim() || null }
}

// ─── Le pont Messagerie → Calendrier ──────────────────────────────────────────

/** Ce que la Messagerie sait d'un e-mail qu'on veut planifier. */
export interface BrouillonCalendrier {
  titre: string
  notes: string
  contactId: string | null
  contactNom: string | null
  mailThreadId: string
}

/**
 * Le brouillon en attente, en MÉMOIRE et nulle part ailleurs. ⛔ Pas dans l'URL : l'adresse
 * d'un onglet est rangée côté serveur (`crm_open_tabs`) et dans `sessionStorage`, et l'objet
 * et l'extrait d'un courrier n'ont rien à y faire. L'URL ne porte que son JETON
 * (`?nouveau=<jeton>`).
 *
 * ⛔ UN JETON PAR DEMANDE, ET L'URL LE GARDE (15.09.2026). Elle portait `?nouveau=1`, que le
 * Calendrier retirait aussitôt : l'adresse nue devenait celle d'un onglet Calendrier déjà
 * ouvert, que la barre activait — la création s'ouvrait alors depuis un écran CACHÉ (la puce
 * ne correspondait plus à l'écran, Échap n'y faisait rien). Unique, l'adresse reste celle de
 * l'onglet neuf ; et un Calendrier qui la relirait plus tard ne retrouve plus de brouillon.
 */
let enAttente: { jeton: string; brouillon: BrouillonCalendrier } | null = null

/** Dépose le brouillon ; rend le jeton que l'adresse du Calendrier portera (`?nouveau=<jeton>`). */
export function deposerBrouillonCalendrier(b: BrouillonCalendrier): string {
  const jeton = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  enAttente = { jeton, brouillon: b }
  return jeton
}

/**
 * Le brouillon de CE jeton, SANS le consommer. ⚠ Lu dans un initialiseur d'état, que le mode
 * strict de React appelle deux fois : une lecture qui consommerait rendrait `null` au second
 * appel. C'est l'effet qui suit qui l'oublie (`oublierBrouillonCalendrier`).
 */
export function lireBrouillonCalendrier(jeton: string | null): BrouillonCalendrier | null {
  return enAttente && jeton && enAttente.jeton === jeton ? enAttente.brouillon : null
}

/** Oublie le brouillon repris : une relecture de l'écran ne rouvrira pas la création. */
export function oublierBrouillonCalendrier(jeton: string | null): void {
  if (enAttente && enAttente.jeton === jeton) enAttente = null
}

/**
 * L'événement pré-rempli d'un brouillon : type « autre » (le calendrier en propose six
 * autres), à la PROCHAINE heure pleine pour une heure — 09:00 aujourd'hui, le défaut du
 * calendrier, tomberait souvent dans le passé. Hors des heures de bureau, 09:00 : le jour
 * même avant 08:00, le lendemain après 18:00 (vu au banc : planifié à 2 h, il proposait 03:00).
 */
export function evenementDepuisBrouillon(b: BrouillonCalendrier, maintenant = new Date()): CalEvent {
  const start = new Date(maintenant)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  if (start.getHours() < 8) start.setHours(9)
  else if (start.getHours() > 18) { start.setDate(start.getDate() + 1); start.setHours(9) }
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return {
    id: `draft_${start.getTime()}`,
    type: 'autre',
    title: b.titre,
    notes: b.notes,
    start,
    end,
    allDay: false,
    recurrence: null,
    contactId: b.contactId,
    contact: b.contactNom ? { name: b.contactNom, role: '' } : undefined,
    mailThreadId: b.mailThreadId,
  }
}

/** « Re : », « TR : », « Fwd: »… en tête d'objet : un événement porte le sujet, pas le fil. */
const PREFIXES = /^\s*((re|tr|fw|fwd|wg|aw|r|i)\s*:\s*)+/i

/**
 * Le brouillon d'un e-mail : l'objet sans ses « Re : », le contact rattaché au fil s'il y en
 * a un, et dans les notes l'expéditeur, la date et l'extrait — de quoi retrouver pourquoi
 * l'événement existe, même hors de la Messagerie.
 */
export function brouillonDepuisMail(p: {
  sujet: string | null; extrait: string | null; expediteur: string; date: string
  contactId: string | null; contactNom: string | null; mailThreadId: string
  /** « E-mail de {{expediteur}} du {{date}} », traduit par l'appelant. */
  enTete: (o: { expediteur: string; date: string }) => string
}): BrouillonCalendrier {
  const extrait = (p.extrait ?? '').replace(/\s+/g, ' ').trim().slice(0, 280)
  return {
    titre: (p.sujet ?? '').replace(PREFIXES, '').trim(),
    notes: [p.enTete({ expediteur: p.expediteur, date: p.date }), extrait ? `« ${extrait} »` : ''].filter(Boolean).join('\n'),
    contactId: p.contactId,
    contactNom: p.contactNom,
    mailThreadId: p.mailThreadId,
  }
}
